// backend/tests/routes/challengeNeuigkeitenLeitung.test.js
//
// Challenges wie der Chat -- auch fuer die Leitung (Simon, 27.09.2026):
//
//   "Die Challenges sollen sich verhalten wie der Chat. Neue Nachricht: ein
//    Abzeichen, ein Badge. Ich will sehen, ob da etwas Neues passiert. Es kann
//    ja auch sein, dass ich es immer noch weg loeschen will oder ausblenden
//    will."
//
// Vorher zaehlten Reiter und Challenge fuer Leitung und Team nur wartende
// Freigaben. Bei einer Challenge ohne Freigabe erschien ein neuer Beitrag
// nirgends ausser im Postfach. Jetzt zaehlt jeder fremde, sichtbare Beitrag,
// der seit dem letzten Oeffnen der Challenge hereinkam (badge-counts:
// challengeUpdates, bisher nur fuer Konfis). Wartende Freigaben zaehlen
// weiter getrennt (pendingChallenges) -- ein Beitrag zaehlt nie doppelt.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

describe('Challenge-Neuigkeiten fuer Leitung und Team', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
  });
  afterAll(async () => { await closePool(); });

  async function challenge({ audience = 'konfis_und_team', moderated = false, beendet = false } = {}) {
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, audience, visibility, moderated,
         allowed_media, badge_name, created_by, starts_at, ends_at, is_draft)
       VALUES ($1, 'Runde', 'd', $2, 'public', $3, '["text"]'::jsonb, 'A', $4,
               NOW() - interval '2 days', $5, false)
       RETURNING *`,
      [ORGS.testGemeinde.id, audience, moderated, USERS.orgAdmin1.id,
       beendet ? new Date(Date.now() - 60 * 60 * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );
    if (audience !== 'nur_team') {
      await db.query('INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)',
        [c.id, JAHRGAENGE.jahrgang1.id]);
    }
    return c;
  }

  async function beitrag(wer, challengeId) {
    const res = await request(app)
      .post(`/api/challenges/konfi/${challengeId}/submissions`)
      .set('Authorization', `Bearer ${generateToken(wer)}`)
      .send({ media_type: 'text', text_content: 'Hallo' });
    expect(res.status).toBe(201);
    await warteAufNachwehen(app);
    return res.body;
  }

  const zaehler = async (wer) => (await request(app).get('/api/notifications/badge-counts')
    .set('Authorization', `Bearer ${generateToken(wer)}`)).body;
  const umschalter = async (wer) => (await request(app).get('/api/notifications/badge-counts/je-organisation')
    .set('Authorization', `Bearer ${generateToken(wer)}`)).body.jeOrganisation;
  const geoeffnet = async (wer, challengeId) => {
    const res = await request(app).post(`/api/challenges/konfi/${challengeId}/mark-read`)
      .set('Authorization', `Bearer ${generateToken(wer)}`);
    expect(res.status).toBe(200);
  };

  it('Beitrag ohne Freigabe: 1 an der Challenge, 1 im Postfach, 2 am Umschalter', async () => {
    const c = await challenge();
    await beitrag('konfi1', c.id);
    const z = await zaehler('orgAdmin1');
    expect(z.pendingChallenges).toBe(0);
    expect(z.challengeUpdates).toEqual({ total: 1, byChallenge: { [c.id]: 1 } });
    expect(z.postfach.ungelesen).toBe(1);
    expect(await umschalter('orgAdmin1')).toEqual({ [ORGS.testGemeinde.id]: { offen: 2 } });
  });

  it('Oeffnen der Challenge setzt die Zahl zurueck, wie im Chat', async () => {
    const c = await challenge();
    await beitrag('konfi1', c.id);
    await geoeffnet('orgAdmin1', c.id);
    expect((await zaehler('orgAdmin1')).challengeUpdates).toEqual({ total: 0, byChallenge: {} });
    // Ein weiterer Beitrag danach zaehlt wieder.
    await beitrag('konfi2', c.id);
    expect((await zaehler('orgAdmin1')).challengeUpdates).toEqual({ total: 1, byChallenge: { [c.id]: 1 } });
  });

  it('Beitrag mit Freigabe zaehlt als Freigabe, nicht zusaetzlich als neu', async () => {
    const c = await challenge({ moderated: true });
    const b = await beitrag('konfi1', c.id);
    const vorher = await zaehler('orgAdmin1');
    expect(vorher.pendingChallenges).toBe(1);
    expect(vorher.challengeUpdates.total).toBe(0);

    // Gibt die Gemeindeleitung frei, hat admin1 (Jahrgang 1) den Beitrag noch
    // nicht gesehen: fuer ihn ist er jetzt neu -- bis er die Challenge oeffnet.
    await db.query('INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]);
    invalidateUserCache(USERS.admin1.id);
    const frei = await request(app).put(`/api/challenges/admin/submissions/${b.id}/moderate`)
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`).send({ action: 'approve' });
    expect(frei.status).toBe(200);
    const admin = await zaehler('admin1');
    expect(admin.pendingChallenges).toBe(0);
    // 2 an der Challenge: der freigegebene Beitrag und -- seit 27.09.2026
    // (Audit BF-07) -- die Challenge selbst, die admin1 nie geoeffnet hat und
    // bei der das Team mitmacht. Wartend zaehlte der Beitrag nicht (oben).
    expect(admin.challengeUpdates).toEqual({ total: 2, byChallenge: { [c.id]: 2 } });
    await geoeffnet('admin1', c.id);
    expect((await zaehler('admin1')).challengeUpdates.total).toBe(0);
  });

  it('der eigene Beitrag zaehlt nicht', async () => {
    const c = await challenge();
    // Eingereicht wird aus der geoeffneten Challenge heraus. Ohne das Oeffnen
    // stuende bei teamer1 seit 27.09.2026 (Audit BF-07) die nie geoeffnete
    // Challenge als 1 -- und der Test koennte den eigenen Beitrag nicht mehr
    // von ihr unterscheiden.
    await geoeffnet('teamer1', c.id);
    await beitrag('teamer1', c.id);
    expect((await zaehler('teamer1')).challengeUpdates.total).toBe(0);
    expect((await zaehler('orgAdmin1')).challengeUpdates.total).toBe(1);
  });

  it('Jahrgangsbindung: ohne Jahrgang zaehlt fuer den Admin weder "Konfis und Team" noch "Nur Konfis"', async () => {
    const c = await challenge({ audience: 'konfis' });
    const c2 = await challenge();
    await beitrag('konfi2', c2.id);
    expect((await zaehler('admin1')).challengeUpdates.total).toBe(0);
    await db.query('DELETE FROM challenge_submissions WHERE challenge_id = $1', [c2.id]);
    await beitrag('konfi1', c.id);
    expect((await zaehler('admin1')).challengeUpdates.total).toBe(0);
    // Teamer:in des Jahrgangs und Gemeindeleitung zaehlen ihn. Bei teamer1
    // steht dazu c2 ("Jahrgang und Team", nie geoeffnet) als neue Challenge
    // (seit 27.09.2026, Audit BF-07); c ("Nur die Konfis") ist nur der
    // Beitrag -- dort macht das Team nicht mit.
    expect((await zaehler('teamer1')).challengeUpdates).toEqual({ total: 2, byChallenge: { [c.id]: 1, [c2.id]: 1 } });
    expect((await zaehler('orgAdmin1')).challengeUpdates.total).toBe(1);
  });

  it('Migration 168: am Tag des Updates ist nichts Bestehendes neu, Spaeteres schon', async () => {
    const c = await challenge();
    await beitrag('konfi1', c.id);
    expect((await zaehler('orgAdmin1')).challengeUpdates.total).toBe(1);
    const sql = require('fs').readFileSync(
      require('path').join(__dirname, '../../migrations/168_challenge_lesestand_leitung.sql'), 'utf8');
    await db.query(sql);
    await db.query(sql); // zweimal laufen lassen: idempotent
    expect((await zaehler('orgAdmin1')).challengeUpdates.total).toBe(0);
    expect((await zaehler('teamer1')).challengeUpdates.total).toBe(0);
    // Konfis bekommen keine Zeile -- ihre Neuigkeiten bleiben unberuehrt.
    const { rows } = await db.query(
      "SELECT COUNT(*)::int AS n FROM challenge_read_status WHERE user_type = 'konfi'");
    expect(rows[0].n).toBe(0);
    await beitrag('konfi2', c.id);
    expect((await zaehler('orgAdmin1')).challengeUpdates.total).toBe(1);
  });

  it('eine beendete Challenge traegt keine Zahl mehr', async () => {
    const c = await challenge();
    await db.query(
      `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, text_content, moderation_status)
       VALUES ($1, $2, $3, 'text', 'Spaet', 'approved')`,
      [c.id, USERS.konfi1.id, ORGS.testGemeinde.id]
    );
    await db.query("UPDATE challenges SET ends_at = NOW() - interval '1 hour' WHERE id = $1", [c.id]);
    expect((await zaehler('orgAdmin1')).challengeUpdates.total).toBe(0);
  });
});
