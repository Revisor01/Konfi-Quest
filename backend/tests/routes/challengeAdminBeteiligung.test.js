// backend/tests/routes/challengeAdminBeteiligung.test.js
//
// Wer aus der Leitung eine Challenge sieht, sie zaehlt und eine Mitteilung
// zu neuen Beitraegen bekommt (Simon, 27.09.2026):
//
//   Drei Zielgruppen: "nur Team (ohne Jahrgang alle im Team, Teamer, Admins,
//   org Admins), Team und Konfi (jahrgangsgebunden: alle Konfis, Teamer,
//   Admins, org Admins), Konfis (jahrgangsgebunden: alle Konfis, Teamer,
//   Admins, org Admins)." -- "Konfis und Team darf auch nur ein Admin sehen
//   und ein Teamer, der in dem Jahrgang ist."
//
// Vorher: Die Mitteilung zu einem neuen Beitrag ging an JEDEN Admin der
// Gemeinde, auch zu Challenges fremder Jahrgaenge, die er weder in der Liste
// noch am Reiter sah. Teamer:innen bekamen zu 'nur_team'-Runden gar keine
// Mitteilung, obwohl sie sie moderieren und ihr Reiter sie zaehlt.
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
    it('erlaubt: "nur Team" sieht, zaehlt und meldet er -- ohne Jahrgang', async () => {
      const c = await challenge('nur_team');
      expect((await einreichen('teamer1', c.id)).status).toBe(201);
      expect(await liste('admin1')).toEqual(['Runde nur_team']);
      expect((await zaehler('admin1')).pendingChallenges).toBe(1);
      expect(await mitteilungen(USERS.admin1.id)).toEqual([c.id]);
      const beitraege = await request(app).get(`/api/challenges/admin/${c.id}/submissions`)
        .set('Authorization', `Bearer ${generateToken('admin1')}`);
      expect(beitraege.status).toBe(200);
    });

    for (const audience of ['konfis_und_team', 'konfis']) {
      it(`verboten: "${audience}" eines fremden Jahrgangs -- keine Sicht, keine Zahl, keine Mitteilung`, async () => {
        const c = await challenge(audience);
        expect((await einreichen('konfi1', c.id)).status).toBe(201);
        expect(await liste('admin1')).toEqual([]);
        expect((await zaehler('admin1')).pendingChallenges).toBe(0);
        expect(await mitteilungen(USERS.admin1.id)).toEqual([]);
        const beitraege = await request(app).get(`/api/challenges/admin/${c.id}/submissions`)
          .set('Authorization', `Bearer ${generateToken('admin1')}`);
        expect(beitraege.status).toBe(403);
        // Gemeindeleitung und Teamer:in des Jahrgangs bekommen sie.
        expect(await mitteilungen(USERS.orgAdmin1.id)).toEqual([c.id]);
        expect(await mitteilungen(USERS.teamer1.id)).toEqual([c.id]);
      });
    }
  });

  describe('Admin mit passendem Jahrgang', () => {
    for (const audience of ['konfis_und_team', 'konfis']) {
      it(`erlaubt: "${audience}" seines Jahrgangs sieht, zaehlt und meldet er`, async () => {
        await db.query('INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)',
          [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]);
        invalidateUserCache(USERS.admin1.id);
        const c = await challenge(audience);
        expect((await einreichen('konfi1', c.id)).status).toBe(201);
        expect(await liste('admin1')).toEqual([`Runde ${audience}`]);
        expect((await zaehler('admin1')).pendingChallenges).toBe(1);
        expect(await mitteilungen(USERS.admin1.id)).toEqual([c.id]);
      });
    }
  });

  // BF-16 (Audit wer-bekommt-was, 27.09.2026): Liste und Reiter verlangen
  // Leserecht (can_view) auf den Jahrgang, die Empfaengerliste
  // (ladeMitgliederDerOrganisation mit jahrgangIds) pruefte nur, OB eine
  // Zuweisung besteht. Eine Zuweisung ohne Leserecht loeste eine Mitteilung
  // zu einer Challenge aus, die die Person nirgends sieht.
  describe('Zuweisung ohne Leserecht (can_view = false)', () => {
    for (const [wer, userId] of [['admin1', USERS.admin1.id], ['teamer1', USERS.teamer1.id]]) {
      it(`verboten: ${wer} mit can_view = false -- keine Sicht, keine Zahl, keine Mitteilung`, async () => {
        if (wer === 'admin1') {
          await db.query('INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view) VALUES ($1, $2, false)',
            [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]);
        } else {
          await db.query('UPDATE user_jahrgang_assignments SET can_view = false WHERE user_id = $1 AND jahrgang_id = $2',
            [USERS.teamer1.id, JAHRGAENGE.jahrgang1.id]);
        }
        invalidateUserCache(userId);
        const c = await challenge('konfis_und_team');
        expect((await einreichen('konfi1', c.id)).status).toBe(201);
        expect(await liste(wer)).toEqual([]);
        expect((await zaehler(wer)).pendingChallenges).toBe(0);
        expect(await mitteilungen(userId)).toEqual([]);
        // Die Gemeindeleitung bekommt sie weiter.
        expect(await mitteilungen(USERS.orgAdmin1.id)).toEqual([c.id]);
      });
    }

    it('erlaubt: dieselbe Zuweisung mit can_view = true -- Sicht, Zahl und Mitteilung', async () => {
      // teamer1 ist im Seed Jahrgang 1 zugewiesen (can_view Standard true).
      const c = await challenge('konfis_und_team');
      expect((await einreichen('konfi1', c.id)).status).toBe(201);
      expect(await liste('teamer1')).toEqual(['Runde konfis_und_team']);
      expect((await zaehler('teamer1')).pendingChallenges).toBe(1);
      expect(await mitteilungen(USERS.teamer1.id)).toEqual([c.id]);
    });
  });

  describe('Nur die Konfis', () => {
    it('das Team des Jahrgangs sieht und begleitet sie, reicht aber nichts ein', async () => {
      const c = await challenge('konfis');
      const res = await einreichen('teamer1', c.id);
      expect(res.status).toBe(403);
      expect(await liste('teamer1')).toEqual(['Runde konfis']);
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
