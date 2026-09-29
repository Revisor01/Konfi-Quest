// backend/tests/routes/wrappedTeamerNurTeamAbzeichen.test.js
//
// DER TEAM-RUECKBLICK ZAEHLT NUR TEAM-ABZEICHEN (Nebenbefund vom 29.09.2026).
//
// Eine beförderte Teamer:in behaelt ihre Konfi-Abzeichen
// (konfiBadgesBefoerderterBleiben.test.js). Der Team-Rueckblick las
// user_badges ohne Blick auf custom_badges.target_role: Die Seite
// "Abzeichen" zaehlte die Konfi-Abzeichen mit -- ueber einem Nenner, der nur
// die Team-Abzeichen kennt ("3 von 1") --, "Das erste Abzeichen" konnte ein
// Konfi-Abzeichen aus der Zeit vor der Befoerderung sein, und ein Jahr, in
// dem es nur Konfi-Abzeichen gab, galt in GET /wrapped/team-jahre als
// lieferbar. Jetzt zieht jede dieser Stellen dieselbe Grenze wie der Nenner
// und die Aktivitaeten (target_role = 'teamer').
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, BADGES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Team-Rückblick: nur Team-Abzeichen', () => {
  let app;
  let db;
  const JAHR = new Date().getFullYear() - 1;
  let teamBadge;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    ({ rows: [teamBadge] } = await db.query(
      `INSERT INTO custom_badges (name, criteria_type, criteria_value, organization_id, icon, color, is_active, target_role)
       VALUES ('Team-Stern', 'total_points', 1, $1, 'star', '#123456', true, 'teamer') RETURNING id, name`,
      [ORGS.testGemeinde.id]));
    // teamer1: im Februar noch Konfi (Konfi-Abzeichen), im Juni im Team.
    await db.query(
      `INSERT INTO user_badges (user_id, badge_id, organization_id, awarded_date) VALUES
         ($1, $2, $3, make_date($5, 2, 1)),
         ($1, $4, $3, make_date($5, 6, 1))`,
      [USERS.teamer1.id, BADGES.streak.id, ORGS.testGemeinde.id, teamBadge.id, JAHR]);
  });
  afterAll(async () => { await closePool(); });

  const erzeuge = async () => {
    const res = await request(app)
      .post('/api/wrapped/generate-teamer')
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
      .send({ jahr: JAHR });
    await warteAufNachwehen(app);
    expect(res.status).toBe(200);
    const { rows: [snap] } = await db.query(
      `SELECT data FROM wrapped_snapshots WHERE user_id = $1 AND wrapped_type = 'teamer'`,
      [USERS.teamer1.id]);
    const data = typeof snap.data === 'string' ? JSON.parse(snap.data) : snap.data;
    return data.slides;
  };

  it('Seite „Abzeichen": nur das Team-Abzeichen, passend zum Nenner', async () => {
    const slides = await erzeuge();
    expect(slides.badges.total_earned).toBe(1);
    expect(slides.badges.total_available).toBe(1);
    expect(slides.badges.badges.map((b) => b.name)).toEqual(['Team-Stern']);
  });

  it('„Das erste Abzeichen" des Jahres ist das erste im Team, nicht das aus der Konfi-Zeit', async () => {
    const slides = await erzeuge();
    expect(slides.erstes_abzeichen.name).toBe('Team-Stern');
  });

  it('Gegenprobe: ohne Team-Abzeichen bleibt die Seite leer', async () => {
    await db.query('DELETE FROM user_badges WHERE badge_id = $1', [teamBadge.id]);
    const slides = await erzeuge();
    expect(slides.badges.total_earned).toBe(0);
    expect(slides.badges.badges).toEqual([]);
    expect(slides.erstes_abzeichen).toBeNull();
  });

  describe('GET /wrapped/team-jahre', () => {
    const jahre = async () => {
      const res = await request(app)
        .get('/api/wrapped/team-jahre')
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);
      return res.body.map((j) => j.jahr);
    };

    it('ein Jahr mit nur einem Konfi-Abzeichen einer heutigen Teamer:in ist nicht lieferbar', async () => {
      await db.query(
        `INSERT INTO user_badges (user_id, badge_id, organization_id, awarded_date)
         VALUES ($1, $2, $3, make_date(2021, 3, 1))`,
        [USERS.teamer1.id, BADGES.categoryBased.id, ORGS.testGemeinde.id]);
      expect(await jahre()).not.toContain(2021);
    });

    it('ein Jahr mit einem Team-Abzeichen ist lieferbar', async () => {
      // Ein Abzeichen je Person (uq_user_badges_user_badge): das Team-Abzeichen
      // aus beforeEach ins Jahr 2021 verlegen.
      await db.query(
        `UPDATE user_badges SET awarded_date = make_date(2021, 3, 1) WHERE user_id = $1 AND badge_id = $2`,
        [USERS.teamer1.id, teamBadge.id]);
      expect(await jahre()).toContain(2021);
    });
  });
});
