// backend/tests/routes/konfiBadgesBefoerderterBleiben.test.js
//
// Konfi-Badges Befoerderter bleiben, wie sie verdient wurden -- auch wenn die
// Leitung das Badge spaeter loescht oder aendert.
//
// Simon, 28.09.2026 (woertlich): "Geloeschte Badges muessen bei befoerdertem
// erhalten bleiben. Auch wenn wir die zb aendern. Weil weniger Punkte als
// Ziel oder so."
//
// Vorher: DELETE /badges/:id nahm alle Exemplare aus user_badges mit, auch
// die Konfi-Badges inzwischen befoerderter Teamer:innen, und GET
// /teamer/profile las konfi_data.badges live aus user_badges/custom_badges --
// ein geloeschtes Badge verschwand aus ihrer Konfi-Historie, ein geaendertes
// zeigte rueckwirkend den neuen Namen und Zielwert.
//
// Jetzt: konfi_data.badges kommt bei vorhandener Kopie der Konfi-Zeit
// (konfi_historie, Migration 170) aus der Kopie. Wer vor dem 28.09.2026
// befoerdert wurde und keine hat, bekommt sie beim Loeschen oder Aendern
// eines seiner Konfi-Badges (Migration 172). Aktuelle Konfis: unveraendert.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

describe('Konfi-Badges Befoerderter bleiben (Simon, 28.09.2026)', () => {
  let app;
  let db;
  let held; // das Konfi-Badge, um das es geht

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    held = await badge({ name: 'Gottesdienst-Held', wert: 10 });
  });

  afterAll(async () => {
    await closePool();
  });

  const orgAdmin = () => generateToken('orgAdmin1');

  // Token einer befoerderten Person: Rolle teamer (role_id 2), sonst wie im Seed.
  const alsTeamer = (userKey) => jwt.sign({
    id: USERS[userKey].id,
    type: 'teamer',
    display_name: USERS[userKey].display_name,
    organization_id: USERS[userKey].org_id,
    role_id: 2
  }, process.env.JWT_SECRET || 'test-secret-key-for-vitest', { expiresIn: '1h' });

  async function badge({ name, wert, rolle = 'konfi', kriterium = 'total_points' }) {
    const { rows: [b] } = await db.query(
      `INSERT INTO custom_badges (name, description, criteria_type, criteria_value, icon, color,
                                  organization_id, target_role, is_active, created_by)
       VALUES ($1, 'Zehn Punkte gesammelt', $2, $3, 'sunny', '#ff9500', $4, $5, true, $6)
       RETURNING id`,
      [name, kriterium, wert, ORGS.testGemeinde.id, rolle, USERS.orgAdmin1.id]
    );
    return Number(b.id);
  }

  const verleihen = (userId, badgeId, tageZurueck = 40) => db.query(
    `INSERT INTO user_badges (user_id, badge_id, awarded_date, organization_id)
     VALUES ($1, $2, NOW() - ($3 || ' days')::interval, $4)`,
    [userId, badgeId, String(tageZurueck), ORGS.testGemeinde.id]
  );

  const befoerdern = async (userKey) => {
    const res = await request(app)
      .post(`/api/admin/konfis/${USERS[userKey].id}/promote-teamer`)
      .set('Authorization', `Bearer ${orgAdmin()}`);
    expect(res.status).toBe(200);
    invalidateUserCache(USERS[userKey].id);
  };

  // teamer1 ist im Seed schon Teamer:in -- mit Konfi-Profil ist sie eine
  // Befoerderte von VOR dem 28.09.2026: Konfi-Vergangenheit, aber keine Kopie.
  const altbestand = () => db.query(
    `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
     VALUES ($1, $2, 4, 7, $3)`,
    [USERS.teamer1.id, JAHRGAENGE.jahrgang1.id, ORGS.testGemeinde.id]
  );

  const konfiBadges = async (token) => {
    const res = await request(app).get('/api/teamer/profile').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body.konfi_data.badges;
  };

  const loeschen = (badgeId, token = orgAdmin()) =>
    request(app).delete(`/api/admin/badges/${badgeId}`).set('Authorization', `Bearer ${token}`);

  const aendern = (badgeId, felder) => request(app).put(`/api/admin/badges/${badgeId}`)
    .set('Authorization', `Bearer ${orgAdmin()}`)
    .send({
      name: 'Gottesdienst-Held', icon: 'sunny', description: 'Zehn Punkte gesammelt',
      criteria_type: 'total_points', criteria_value: 10, color: '#ff9500',
      ...felder
    });

  const kopien = async (userId) => (await db.query(
    'SELECT anlass, erstellt_von, daten FROM konfi_historie WHERE user_id = $1 ORDER BY id', [userId]
  )).rows;

  // Die Form, die GET /teamer/profile fuer ein Konfi-Badge liefert -- die
  // Store-Apps (2.2.0, 2.3.0) lesen genau diese Felder.
  const original = (badgeId, awardedDate) => ({
    badge_id: badgeId,
    name: 'Gottesdienst-Held',
    description: 'Zehn Punkte gesammelt',
    icon: 'sunny',
    color: '#ff9500',
    criteria_type: 'total_points',
    criteria_value: 10,
    awarded_date: awardedDate
  });

  describe('Befoerderte mit Kopie (befoerdert seit dem 28.09.2026)', () => {
    it('Badge loeschen: die Befoerderte zeigt es weiter mit Originalname -- in derselben Form wie vorher', async () => {
      await verleihen(USERS.konfi1.id, held);
      await befoerdern('konfi1');
      const vorher = await konfiBadges(alsTeamer('konfi1'));
      expect(vorher).toHaveLength(1);
      expect(vorher[0].awarded_date).toMatch(ISO);
      expect(vorher).toEqual([original(held, vorher[0].awarded_date)]);

      expect((await loeschen(held)).status).toBe(200);

      expect(await konfiBadges(alsTeamer('konfi1'))).toEqual(vorher);
      // Kein zweites Exemplar der Kopie
      expect(await kopien(USERS.konfi1.id)).toHaveLength(1);

      // Die Leitung sieht in der Konfi-Zeit dasselbe Original.
      const leitung = await request(app).get(`/api/teamer/${USERS.konfi1.id}/konfi-zeit`)
        .set('Authorization', `Bearer ${orgAdmin()}`);
      expect(leitung.status).toBe(200);
      expect(leitung.body.konfi_zeit.abzeichen.map((a) => [a.badge_id, a.name, a.kriterium_wert]))
        .toEqual([[held, 'Gottesdienst-Held', 10]]);
    });

    it('Badge aendern (Name, Zielwert): die Befoerderte zeigt das Original', async () => {
      await verleihen(USERS.konfi1.id, held);
      await befoerdern('konfi1');
      const vorher = await konfiBadges(alsTeamer('konfi1'));

      const res = await aendern(held, { name: 'Kleiner Gottesdienst-Held', criteria_value: 5, icon: 'star', color: '#123456' });
      expect(res.status).toBe(200);
      const { rows: [jetzt] } = await db.query('SELECT name, criteria_value FROM custom_badges WHERE id = $1', [held]);
      expect(jetzt).toEqual({ name: 'Kleiner Gottesdienst-Held', criteria_value: 5 });

      expect(await konfiBadges(alsTeamer('konfi1'))).toEqual(vorher);
      expect(vorher[0].name).toBe('Gottesdienst-Held');
      expect(vorher[0].criteria_value).toBe(10);
    });
  });

  describe('Befoerderte ohne Kopie (befoerdert vor dem 28.09.2026)', () => {
    it('bekommt beim Loeschen eines ihrer Konfi-Badges die Kopie -- mit dem Badge darin', async () => {
      await altbestand();
      await verleihen(USERS.teamer1.id, held);
      const vorher = await konfiBadges(generateToken('teamer1'));
      expect(vorher).toEqual([original(held, vorher[0].awarded_date)]);
      expect(await kopien(USERS.teamer1.id)).toHaveLength(0);

      expect((await loeschen(held)).status).toBe(200);

      const [kopie, ...mehr] = await kopien(USERS.teamer1.id);
      expect(mehr).toHaveLength(0);
      expect(kopie.anlass).toBe('abzeichen_geloescht');
      expect(Number(kopie.erstellt_von)).toBe(USERS.orgAdmin1.id);
      expect(kopie.daten.abzeichen.map((a) => [a.badge_id, a.name])).toEqual([[held, 'Gottesdienst-Held']]);
      expect(kopie.daten.punkte).toEqual({ gottesdienst: 4, gemeinde: 7, gesamt: 11 });

      expect(await konfiBadges(generateToken('teamer1'))).toEqual(vorher);
    });

    it('bekommt beim Aendern eines ihrer Konfi-Badges die Kopie -- vor dem Aendern', async () => {
      await altbestand();
      await verleihen(USERS.teamer1.id, held);
      const vorher = await konfiBadges(generateToken('teamer1'));

      expect((await aendern(held, { name: 'Umbenannt', criteria_value: 3 })).status).toBe(200);

      const [kopie] = await kopien(USERS.teamer1.id);
      expect(kopie.anlass).toBe('abzeichen_geaendert');
      expect(kopie.daten.abzeichen.map((a) => [a.name, a.kriterium_wert])).toEqual([['Gottesdienst-Held', 10]]);
      expect(await konfiBadges(generateToken('teamer1'))).toEqual(vorher);
    });

    it('ohne Kopie und ohne Loeschen bleibt es beim Live-Stand (keine Kopie auf Vorrat)', async () => {
      await altbestand();
      await verleihen(USERS.teamer1.id, held);
      expect((await konfiBadges(generateToken('teamer1'))).map((b) => b.name)).toEqual(['Gottesdienst-Held']);
      expect(await kopien(USERS.teamer1.id)).toHaveLength(0);
    });

    it('ein Teamer-Badge loescht sich ohne Kopie -- es gehoert nicht zur Konfi-Zeit', async () => {
      await altbestand();
      const teamerBadge = await badge({ name: 'Teamer-Jahr', wert: 1, rolle: 'teamer', kriterium: 'teamer_year' });
      await verleihen(USERS.teamer1.id, teamerBadge);

      expect((await loeschen(teamerBadge)).status).toBe(200);
      expect(await kopien(USERS.teamer1.id)).toHaveLength(0);
    });

    it('eine fremde Gemeinde loescht nichts und legt keine Kopie an (404, zurueckgerollt)', async () => {
      await altbestand();
      await verleihen(USERS.teamer1.id, held);

      expect((await loeschen(held, generateToken('orgAdmin2'))).status).toBe(404);
      expect(await kopien(USERS.teamer1.id)).toHaveLength(0);
      const { rows: [{ n }] } = await db.query('SELECT COUNT(*)::int AS n FROM user_badges WHERE badge_id = $1', [held]);
      expect(n).toBe(1);
    });
  });

  describe('aktuelle Konfis', () => {
    it('eine aktuelle Konfi verliert das geloeschte Badge -- und bekommt keine Kopie', async () => {
      await verleihen(USERS.konfi2.id, held);
      const vorher = await request(app).get(`/api/admin/konfis/${USERS.konfi2.id}/badges`)
        .set('Authorization', `Bearer ${orgAdmin()}`);
      expect(vorher.body.earned.map((b) => b.id)).toEqual([held]);

      expect((await loeschen(held)).status).toBe(200);

      const nachher = await request(app).get(`/api/admin/konfis/${USERS.konfi2.id}/badges`)
        .set('Authorization', `Bearer ${orgAdmin()}`);
      expect(nachher.status).toBe(200);
      expect(nachher.body.earned).toEqual([]);
      const { rows: [{ n }] } = await db.query('SELECT COUNT(*)::int AS n FROM user_badges WHERE user_id = $1', [USERS.konfi2.id]);
      expect(n).toBe(0);
      expect(await kopien(USERS.konfi2.id)).toHaveLength(0);
    });

    it('eine aktuelle Konfi sieht die Aenderung sofort', async () => {
      await verleihen(USERS.konfi2.id, held);
      expect((await aendern(held, { name: 'Umbenannt' })).status).toBe(200);

      const res = await request(app).get(`/api/admin/konfis/${USERS.konfi2.id}/badges`)
        .set('Authorization', `Bearer ${orgAdmin()}`);
      expect(res.body.earned.map((b) => b.name)).toEqual(['Umbenannt']);
      expect(await kopien(USERS.konfi2.id)).toHaveLength(0);
    });
  });
});
