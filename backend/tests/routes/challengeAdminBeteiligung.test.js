// backend/tests/routes/challengeAdminBeteiligung.test.js
//
// Wer aus der Leitung eine Challenge sieht, sie zaehlt und eine Mitteilung
// zu neuen Beitraegen bekommt (Simon, 27.09.2026):
//
//   "Admins sehen nur und kriegen auch nur Infos zu Challenges, an denen sie
//    beteiligt sind, aber Admins sind ja theoretisch an jeder Team-Challenge
//    beteiligt. Also immer wenn Konfi und Team oder nur Team ausgewaehlt ist,
//    dann kriegen die Admins das. Wenn es nur Konfis sind, mit
//    Jahrgangsbindung, und die sind da nicht drin, dann kriegen sie es auch
//    nicht."
//
// Vorher: Ein Admin ohne passenden Jahrgang sah 'konfis_und_team'-Challenges
// nicht und zaehlte sie nicht -- bekam aber zu JEDER Challenge der Gemeinde
// eine Mitteilung, auch zu reinen Konfi-Challenges fremder Jahrgaenge.
// Teamer:innen bekamen zu 'nur_team'-Runden gar keine Mitteilung, obwohl
// sie sie moderieren und ihr Reiter sie zaehlt.
//
// admin1 (Rolle admin, Org 1) hat im Seed KEINEN Jahrgang; teamer1 hat
// Jahrgang 1. Assertions auf konkrete Werte.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

describe('Challenges: Beteiligung von Admins und Team', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
  });
  afterAll(async () => { await closePool(); });

  async function challenge(audience, { jahrgang = JAHRGAENGE.jahrgang1.id, moderated = true } = {}) {
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, audience, visibility, moderated,
         allowed_media, badge_name, created_by, starts_at, ends_at, is_draft)
       VALUES ($1, $2, 'd', $3, 'public', $4, '["text"]'::jsonb, 'A', $5,
               NOW() - interval '1 day', NOW() + interval '7 days', false)
       RETURNING *`,
      [ORGS.testGemeinde.id, `Runde ${audience}`, audience, moderated, USERS.orgAdmin1.id]
    );
    if (jahrgang && audience !== 'nur_team') {
      await db.query('INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)', [c.id, jahrgang]);
    }
    return c;
  }

  async function einreichen(wer, challengeId) {
    const res = await request(app)
      .post(`/api/challenges/konfi/${challengeId}/submissions`)
      .set('Authorization', `Bearer ${generateToken(wer)}`)
      .send({ media_type: 'text', text_content: 'Mein Beitrag' });
    await warteAufNachwehen(app);
    return res;
  }

  const liste = async (wer) => (await request(app).get('/api/challenges/admin')
    .set('Authorization', `Bearer ${generateToken(wer)}`)).body.map((c) => c.title);
  const zaehler = async (wer) => (await request(app).get('/api/notifications/badge-counts')
    .set('Authorization', `Bearer ${generateToken(wer)}`)).body;
  const mitteilungen = async (userId) => (await db.query(
    "SELECT data->>'challengeId' AS challenge_id FROM notifications WHERE user_id = $1 AND type = 'challenge_submission'",
    [userId]
  )).rows.map((r) => Number(r.challenge_id));

  describe('Admin ohne passenden Jahrgang', () => {
    it('erlaubt: "Konfis und Team" sieht, zaehlt und meldet er', async () => {
      const c = await challenge('konfis_und_team');
      expect((await einreichen('konfi1', c.id)).status).toBe(201);
      expect(await liste('admin1')).toEqual(['Runde konfis_und_team']);
      const z = await zaehler('admin1');
      expect(z.pendingChallenges).toBe(1);
      expect(z.challengeApprovals.byChallenge).toEqual({ [c.id]: 1 });
      expect(await mitteilungen(USERS.admin1.id)).toEqual([c.id]);
      const detail = await request(app).get(`/api/challenges/admin/${c.id}/submissions`)
        .set('Authorization', `Bearer ${generateToken('admin1')}`);
      expect(detail.status).toBe(200);
    });

    it('erlaubt: "nur Team" sieht, zaehlt und meldet er', async () => {
      const c = await challenge('nur_team');
      expect((await einreichen('teamer1', c.id)).status).toBe(201);
      expect(await liste('admin1')).toEqual(['Runde nur_team']);
      expect((await zaehler('admin1')).pendingChallenges).toBe(1);
      expect(await mitteilungen(USERS.admin1.id)).toEqual([c.id]);
    });

    it('verboten: "nur Konfis" eines fremden Jahrgangs -- keine Sicht, keine Zahl, keine Mitteilung', async () => {
      const c = await challenge('konfis');
      expect((await einreichen('konfi1', c.id)).status).toBe(201);
      expect(await liste('admin1')).toEqual([]);
      expect((await zaehler('admin1')).pendingChallenges).toBe(0);
      expect(await mitteilungen(USERS.admin1.id)).toEqual([]);
      // Die Gemeindeleitung bekommt sie weiterhin.
      expect(await mitteilungen(USERS.orgAdmin1.id)).toEqual([c.id]);
    });
  });

  describe('Admin mit passendem Jahrgang', () => {
    it('erlaubt: "nur Konfis" seines Jahrgangs sieht, zaehlt und meldet er', async () => {
      await db.query('INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)',
        [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]);
      invalidateUserCache(USERS.admin1.id);
      const c = await challenge('konfis');
      expect((await einreichen('konfi1', c.id)).status).toBe(201);
      expect(await liste('admin1')).toEqual(['Runde konfis']);
      expect((await zaehler('admin1')).pendingChallenges).toBe(1);
      expect(await mitteilungen(USERS.admin1.id)).toEqual([c.id]);
    });
  });

  describe('Team und eigene Beitraege', () => {
    it('Teamer:innen bekommen die Mitteilung zu einer "nur Team"-Runde, wie ihr Reiter sie zaehlt', async () => {
      const c = await challenge('nur_team');
      expect((await einreichen('admin1', c.id)).status).toBe(201);
      expect((await zaehler('teamer1')).pendingChallenges).toBe(1);
      expect(await mitteilungen(USERS.teamer1.id)).toEqual([c.id]);
    });

    it('wer selbst einreicht, bekommt keine Mitteilung ueber den eigenen Beitrag', async () => {
      const c = await challenge('nur_team');
      expect((await einreichen('admin1', c.id)).status).toBe(201);
      expect(await mitteilungen(USERS.admin1.id)).toEqual([]);
      expect(await mitteilungen(USERS.orgAdmin1.id)).toEqual([c.id]);
    });
  });
});
