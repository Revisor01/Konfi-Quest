// backend/tests/routes/konfiZeitBeiBefoerderung.test.js
//
// Die Konfi-Zeit bleibt als dauerhafte Kopie erhalten (Audit 26.09.2026,
// backend-fachlogik-punkte-termine BF-09; Simons Entscheidung vom 28.09.2026).
//
// Simon woertlich: "Loeschen bei Befoerderung ist gewollt damit der Jahrgang
// spaeter weg kann. Wir legen eine persistent kopie der Konfi history fuer
// den Teamer."
//
// Vorher: Die Befoerderung loeschte alle Buchungen -- auch die verbuchte
// Teilnahme an der Konfifreizeit vor einem Jahr. Was blieb, hing an lebenden
// Tabellen und ging mit dem Loeschen des alten Jahrgangs (Termine,
// Event-Punkte) ebenfalls.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE, BADGES, ACTIVITIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

describe('Konfi-Zeit als dauerhafte Kopie (BF-09)', () => {
  let app;
  let db;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
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

  async function termin(name, tageVersatz, jahrgaenge) {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, location, organization_id, max_participants, point_type, points)
       VALUES ($1, NOW() + ($2 || ' days')::interval, 'Gemeindehaus', $3, 0, 'gemeinde', 2) RETURNING id`,
      [name, String(tageVersatz), ORGS.testGemeinde.id]
    );
    for (const jg of jahrgaenge) {
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [e.id, jg]);
    }
    return Number(e.id);
  }

  async function buchung(eventId, userId, status, anwesenheit = null) {
    await db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, attendance_status, organization_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [eventId, userId, status, anwesenheit, ORGS.testGemeinde.id]
    );
  }

  async function eventPunkte(eventId, userId, punkte) {
    await db.query(
      `INSERT INTO event_points (konfi_id, event_id, points, point_type, awarded_date, organization_id)
       VALUES ($1, $2, $3, 'gemeinde', CURRENT_DATE - 20, $4)`,
      [userId, eventId, punkte, ORGS.testGemeinde.id]
    );
  }

  /** Eine Konfi-Zeit mit allem, was dazugehoert. */
  async function konfiZeitAnlegen(userId, jahrgangId) {
    const freizeit = await termin('Konfifreizeit', -20, [jahrgangId]);
    await buchung(freizeit, userId, 'confirmed', 'present');
    await eventPunkte(freizeit, userId, 2);
    const unterricht = await termin('Konfi-Unterricht', -10, [jahrgangId]);
    await buchung(unterricht, userId, 'excused', 'excused');
    const kuenftig = await termin('Konfirmation', 30, [jahrgangId]);
    await buchung(kuenftig, userId, 'confirmed');

    await db.query(
      `INSERT INTO user_activities (user_id, activity_id, admin_id, completed_date, organization_id, points, comment)
       VALUES ($1, $2, $3, CURRENT_DATE - 15, $4, 2, 'Kuchen gebacken')`,
      [userId, ACTIVITIES.gemeindefest.id, USERS.admin1.id, ORGS.testGemeinde.id]
    );
    await db.query(
      'INSERT INTO user_badges (user_id, badge_id, organization_id) VALUES ($1, $2, $3)',
      [userId, BADGES.streak.id, ORGS.testGemeinde.id]
    );
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, audience, badge_name, badge_icon,
                               created_by, starts_at, ends_at, is_draft)
       VALUES ($1, 'Lieblingsort', 'd', 'konfis', 'Entdecker', 'map', $2, NOW() - interval '30 days', NOW() - interval '5 days', false)
       RETURNING id`,
      [ORGS.testGemeinde.id, USERS.orgAdmin1.id]
    );
    await db.query('INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)', [c.id, jahrgangId]);
    await db.query(
      `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, text_content, moderation_status, approved_at)
       VALUES ($1, $2, $3, 'text', 'Am Deich', 'approved', NOW() - interval '25 days')`,
      [c.id, userId, ORGS.testGemeinde.id]
    );
    await db.query(
      `UPDATE konfi_profiles SET gottesdienst_points = 3, gemeinde_points = 4,
              konfspruch_freitext = 'Fürchte dich nicht', konfspruch_freitext_referenz = 'Jes 43,1'
        WHERE user_id = $1`,
      [userId]
    );
    return { freizeit, unterricht, kuenftig, challengeId: Number(c.id) };
  }

  const befoerdern = (userId) => request(app)
    .post(`/api/admin/konfis/${userId}/promote-teamer`)
    .set('Authorization', `Bearer ${orgAdmin()}`);

  it('die Befoerderung legt die Kopie mit den vergangenen Events an, BEVOR die Buchungen geloescht werden', async () => {
    const { freizeit, unterricht, challengeId } = await konfiZeitAnlegen(USERS.konfi1.id, JAHRGAENGE.jahrgang1.id);

    const res = await befoerdern(USERS.konfi1.id);
    expect(res.status).toBe(200);

    // Das Loeschen der Buchungen bleibt (gewollt).
    const { rows: [{ n: buchungen }] } = await db.query(
      'SELECT COUNT(*)::int AS n FROM event_bookings WHERE user_id = $1', [USERS.konfi1.id]
    );
    expect(buchungen).toBe(0);

    const { rows: kopien } = await db.query(
      'SELECT anlass, jahrgang_id, jahrgang_name, erstellt_von, daten FROM konfi_historie WHERE user_id = $1',
      [USERS.konfi1.id]
    );
    expect(kopien).toHaveLength(1);
    const [kopie] = kopien;
    expect(kopie.anlass).toBe('befoerderung');
    expect(Number(kopie.jahrgang_id)).toBe(JAHRGAENGE.jahrgang1.id);
    expect(kopie.jahrgang_name).toBe('2025/2026');
    expect(Number(kopie.erstellt_von)).toBe(USERS.orgAdmin1.id);

    const d = kopie.daten;
    // Vergangene Termine mit Anwesenheit und Punkten -- der kuenftige nicht.
    expect(d.termine.map((t) => [t.event_id, t.name, t.status, t.anwesenheit, t.punkte])).toEqual([
      [freizeit, 'Konfifreizeit', 'confirmed', 'present', 2],
      [unterricht, 'Konfi-Unterricht', 'excused', 'excused', 0]
    ]);
    expect(d.termine[0].ort).toBe('Gemeindehaus');
    expect(d.punkte).toEqual({ gottesdienst: 3, gemeinde: 4, gesamt: 7 });
    expect(d.aktivitaeten.map((a) => [a.name, a.punkte, a.kommentar])).toEqual([['Gemeindefest', 2, 'Kuchen gebacken']]);
    expect(d.bonuspunkte.map((b) => [b.beschreibung, b.punkte])).toEqual([['Sonderpunkte Weihnachten', 3]]);
    expect(d.abzeichen.map((a) => [a.badge_id, a.name])).toEqual([[BADGES.streak.id, 'Fleissig']]);
    expect(d.stempel.map((s) => [s.challenge_id, s.badge_name])).toEqual([[challengeId, 'Entdecker']]);
    expect(d.konfispruch).toEqual({ source: 'freitext', text: 'Fürchte dich nicht', reference: 'Jes 43,1' });
  });

  it('die Kopie ueberlebt das Loeschen des Jahrgangs -- samt Terminen, die es danach nicht mehr gibt', async () => {
    const { rows: [alt] } = await db.query(
      `INSERT INTO jahrgaenge (name, organization_id, confirmation_date) VALUES ('2023/2024', $1, '2024-05-01') RETURNING id`,
      [ORGS.testGemeinde.id]
    );
    await db.query('UPDATE konfi_profiles SET jahrgang_id = $1 WHERE user_id = $2', [alt.id, USERS.konfi1.id]);
    const { freizeit } = await konfiZeitAnlegen(USERS.konfi1.id, alt.id);

    expect((await befoerdern(USERS.konfi1.id)).status).toBe(200);
    const loeschen = await request(app).delete(`/api/admin/jahrgaenge/${alt.id}`)
      .set('Authorization', `Bearer ${orgAdmin()}`);
    expect(loeschen.status).toBe(200);

    // Der Termin ist weg ...
    const { rows: [{ n: termine }] } = await db.query('SELECT COUNT(*)::int AS n FROM events WHERE id = $1', [freizeit]);
    expect(termine).toBe(0);

    // ... in der Konfi-Zeit steht er weiter, eine Kopie, kein Duplikat.
    const { rows: kopien } = await db.query('SELECT jahrgang_id, jahrgang_name FROM konfi_historie WHERE user_id = $1', [USERS.konfi1.id]);
    expect(kopien).toHaveLength(1);
    expect(kopien[0].jahrgang_id).toBeNull();
    expect(kopien[0].jahrgang_name).toBe('2023/2024');

    invalidateUserCache(USERS.konfi1.id);
    const eigene = await request(app).get('/api/teamer/konfi-zeit')
      .set('Authorization', `Bearer ${alsTeamer('konfi1')}`);
    expect(eigene.status).toBe(200);
    expect(eigene.body.konfi_zeit.jahrgang_name).toBe('2023/2024');
    expect(eigene.body.konfi_zeit.anlass).toBe('befoerderung');
    expect(eigene.body.konfi_zeit.termine.map((t) => [t.name, t.anwesenheit, t.punkte])).toEqual([
      ['Konfifreizeit', 'present', 2],
      ['Konfi-Unterricht', 'excused', 0]
    ]);
  });

  it('wer vor dem 28.09.2026 befoerdert wurde, bekommt die Kopie beim Loeschen des Jahrgangs', async () => {
    const { rows: [alt] } = await db.query(
      `INSERT INTO jahrgaenge (name, organization_id, confirmation_date) VALUES ('2022/2023', $1, '2023-05-01') RETURNING id`,
      [ORGS.testGemeinde.id]
    );
    // teamer1: Ex-Konfi ohne Kopie, Buchungen damals schon geloescht, die
    // Event-Punkte stehen noch.
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
       VALUES ($1, $2, 1, 2, $3)`,
      [USERS.teamer1.id, alt.id, ORGS.testGemeinde.id]
    );
    const freizeit = await termin('Konfifreizeit 2022', -400, [alt.id]);
    await eventPunkte(freizeit, USERS.teamer1.id, 2);

    const res = await request(app).delete(`/api/admin/jahrgaenge/${alt.id}`)
      .set('Authorization', `Bearer ${orgAdmin()}`);
    expect(res.status).toBe(200);

    const { rows: kopien } = await db.query('SELECT anlass, jahrgang_name, daten FROM konfi_historie WHERE user_id = $1', [USERS.teamer1.id]);
    expect(kopien).toHaveLength(1);
    expect(kopien[0].anlass).toBe('jahrgang_geloescht');
    expect(kopien[0].jahrgang_name).toBe('2022/2023');
    expect(kopien[0].daten.termine.map((t) => [t.name, t.punkte])).toEqual([['Konfifreizeit 2022', 2]]);
    expect(kopien[0].daten.punkte).toEqual({ gottesdienst: 1, gemeinde: 2, gesamt: 3 });
  });

  it('bricht die Befoerderung ab, entsteht auch keine Kopie', async () => {
    await konfiZeitAnlegen(USERS.konfi1.id, JAHRGAENGE.jahrgang1.id);
    // Befoerdert werden nur Konfis: teamer1 ist keine -> 400, vor jedem Schreiben.
    const res = await befoerdern(USERS.teamer1.id);
    expect(res.status).toBe(400);
    const { rows: [{ n }] } = await db.query('SELECT COUNT(*)::int AS n FROM konfi_historie', []);
    expect(n).toBe(0);
  });

  describe('wer die Kopie sieht', () => {
    beforeEach(async () => {
      await konfiZeitAnlegen(USERS.konfi1.id, JAHRGAENGE.jahrgang1.id);
      expect((await befoerdern(USERS.konfi1.id)).status).toBe(200);
      invalidateUserCache(USERS.konfi1.id);
    });

    it('die Person selbst', async () => {
      const res = await request(app).get('/api/teamer/konfi-zeit')
        .set('Authorization', `Bearer ${alsTeamer('konfi1')}`);
      expect(res.status).toBe(200);
      expect(res.body.konfi_zeit.termine).toHaveLength(2);
    });

    it('eine andere Teamer:in sieht ueber die eigene Route nur ihre eigene (hier: keine)', async () => {
      const res = await request(app).get('/api/teamer/konfi-zeit')
        .set('Authorization', `Bearer ${generateToken('teamer1')}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ konfi_zeit: null });
    });

    it('die Leitung ihrer Gemeinde in der Detailansicht -- Org-Leitung und Leitung', async () => {
      const org = await request(app).get(`/api/teamer/${USERS.konfi1.id}/konfi-zeit`)
        .set('Authorization', `Bearer ${orgAdmin()}`);
      expect(org.status).toBe(200);
      expect(org.body.konfi_zeit.jahrgang_name).toBe('2025/2026');

      const leitung = await request(app).get(`/api/teamer/${USERS.konfi1.id}/konfi-zeit`)
        .set('Authorization', `Bearer ${generateToken('admin1')}`);
      expect(leitung.status).toBe(200);
      expect(leitung.body.konfi_zeit.termine).toHaveLength(2);
    });

    it('nicht: Teamer:innen ueber die Leitungs-Route, Konfis, fremde Gemeinden', async () => {
      const teamer = await request(app).get(`/api/teamer/${USERS.konfi1.id}/konfi-zeit`)
        .set('Authorization', `Bearer ${generateToken('teamer1')}`);
      expect(teamer.status).toBe(403);

      const konfi = await request(app).get('/api/teamer/konfi-zeit')
        .set('Authorization', `Bearer ${generateToken('konfi2')}`);
      expect(konfi.status).toBe(403);

      const fremd = await request(app).get(`/api/teamer/${USERS.konfi1.id}/konfi-zeit`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
      expect(fremd.status).toBe(200);
      expect(fremd.body).toEqual({ konfi_zeit: null });
    });
  });
});
