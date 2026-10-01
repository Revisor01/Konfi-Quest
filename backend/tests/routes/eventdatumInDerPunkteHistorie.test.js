// backend/tests/routes/eventdatumInDerPunkteHistorie.test.js
//
// Simon, 01.10.2026: „Bei Events, die im Konfiprofil auftauchen, wird das
// Verbuchungsdatum angezeigt anstelle des Eventdatums (wäre da 27.9. gewesen).
// Ich fänd das Eventdatum logischer, damit ich weiß, wo ich nach dem Event
// suchen müsste. Bei den Aktivitäten steht ja auch das Aktivitätsdatum dabei."
//
// Die Punkte-Historien lieferten für Event-Punkte nur `date` =
// event_points.awarded_date (Tag der Verbuchung). Seit 01.10.2026 tragen sie
// ADDITIV `event_date` = events.event_date (der Termin selbst; jede Serie ist
// eine eigene Zeile in events, also das Datum des konkreten Termins).
// `date` bleibt unverändert: Die Apps im Store lesen es und zeigen weiter das
// Verbuchungsdatum — sie brechen nicht.
//
// Ausgangslage: Termin am 27.09.2026, verbucht am 30.09.2026.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, EVENTS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Eventdatum in den Punkte-Historien (01.10.2026)', () => {
  let app;
  let db;

  const ORG = ORGS.testGemeinde.id;
  const EVENT = EVENTS.gottesdienstEvent.id;
  const TERMIN = '2026-09-27T10:00:00+02:00';
  const TERMIN_ISO = new Date(TERMIN).toISOString(); // 2026-09-27T08:00:00.000Z
  const VERBUCHT = '2026-09-30';

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query('UPDATE events SET event_date = $1 WHERE id = $2', [TERMIN, EVENT]);
  });

  afterAll(async () => {
    await closePool();
  });

  // Event-Punkt (verbucht am 30.09.) plus Aktivität und Bonus als Nachbarn.
  async function punkteAnlegen(userId) {
    await db.query('DELETE FROM event_points WHERE konfi_id = $1', [userId]);
    await db.query('DELETE FROM bonus_points WHERE konfi_id = $1', [userId]);
    await db.query('DELETE FROM user_activities WHERE user_id = $1', [userId]);
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
       VALUES ($1, NULL, 2, 2, $2)
       ON CONFLICT (user_id) DO UPDATE SET gottesdienst_points = 2, gemeinde_points = 2, organization_id = $2`,
      [userId, ORG]
    );
    await db.query(
      `INSERT INTO event_points (konfi_id, event_id, points, point_type, description, admin_id, awarded_date, organization_id)
       VALUES ($1, $2, 2, 'gottesdienst', 'Event-Punkte', $3, $4, $5)`,
      [userId, EVENT, USERS.admin1.id, VERBUCHT, ORG]
    );
    await db.query(
      `INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, completed_date, organization_id)
       VALUES ($1, 2, 'gemeinde', 'Sonderleistung', $2, '2026-09-01', $3)`,
      [userId, USERS.admin1.id, ORG]
    );
  }

  // awarded_date so serialisiert, wie es die Route bisher als `date` ausgab.
  async function verbuchtAlsJson(userId) {
    const { rows: [r] } = await db.query(
      'SELECT awarded_date FROM event_points WHERE konfi_id = $1', [userId]
    );
    return JSON.parse(JSON.stringify(r.awarded_date));
  }

  for (const [pfad, nutzer] of [
    ['/api/konfi/points-history', 'konfi1'],
    ['/api/teamer/konfi-history', 'teamer1'],
  ]) {
    it(`${pfad}: Event-Eintrag trägt event_date des Termins, date bleibt das Verbuchungsdatum`, async () => {
      const userId = USERS[nutzer].id;
      await punkteAnlegen(userId);

      const res = await request(app).get(pfad).set('Authorization', `Bearer ${generateToken(nutzer)}`);
      expect(res.status).toBe(200);

      const event = res.body.history.find((h) => h.source_type === 'event');
      expect(event.event_date).toBe(TERMIN_ISO);
      expect(event.date).toBe(await verbuchtAlsJson(userId));
      expect(event.date).not.toBe(event.event_date);

      // Nicht-Events haben kein Eventdatum — dasselbe Feld, Wert null.
      const bonus = res.body.history.find((h) => h.source_type === 'bonus');
      expect(bonus.event_date).toBe(null);
    });
  }

  it('GET /api/admin/konfis/:id/event-points liefert event_date des Termins neben awarded_date', async () => {
    await punkteAnlegen(USERS.konfi1.id);

    const res = await request(app)
      .get(`/api/admin/konfis/${USERS.konfi1.id}/event-points`)
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].event_date).toBe(TERMIN_ISO);
    expect(res.body[0].awarded_date).toBe(await verbuchtAlsJson(USERS.konfi1.id));
  });

  it('GET /api/admin/konfis/:id (Teamer:in): konfiHistory-Event trägt event_date, date bleibt', async () => {
    await punkteAnlegen(USERS.teamer1.id);

    const res = await request(app)
      .get(`/api/admin/konfis/${USERS.teamer1.id}`)
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    expect(res.status).toBe(200);

    const event = res.body.konfiHistory.history.find((h) => h.source_type === 'event');
    expect(event.event_date).toBe(TERMIN_ISO);
    expect(event.date).toBe(await verbuchtAlsJson(USERS.teamer1.id));

    const bonus = res.body.konfiHistory.history.find((h) => h.source_type === 'bonus');
    expect(bonus.event_date).toBe(null);
  });
});
