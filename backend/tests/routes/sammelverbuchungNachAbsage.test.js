// backend/tests/routes/sammelverbuchungNachAbsage.test.js
//
// SAMMELVERBUCHUNG AN EINEM ABGESAGTEN TERMIN (Audit Punkte/Termine,
// "Unklar", geklaert 29.09.2026).
//
// Der Befund: PUT /events/:id/participants/attendance-all prueft weder
// events.cancelled noch das Datum. Geklaert am Code: Die Route nimmt nur
// Buchungen mit status = 'confirmed' und ohne attendance_status. Die Absage
// setzt alle Angemeldeten und Wartenden auf status = 'excused'
// (utils/bookingUtils.meldeAlleAbBeiAbsage) -- der Sammelknopf findet danach
// niemanden mehr und vergibt keine Punkte. Eine Pruefung auf `cancelled`
// fehlt also nicht; sie waere doppelt. Wer nach der Absage doch Punkte
// bekommen soll, bekommt sie einzeln ueber die Leitung (Simon, 15.09.2026) --
// darum sperrt die Route abgesagte Termine auch nicht grundsaetzlich.
//
// Dieser Test haelt das fest, damit die Absicherung nicht unbemerkt wandert.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, EVENTS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Sammelverbuchung nach der Absage', () => {
  let app;
  let db;
  const E = EVENTS.gottesdienstEvent.id; // 2 Punkte, kein Pflichttermin

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
       VALUES ($1, $3, 'confirmed', $4), ($2, $3, 'confirmed', $4)`,
      [USERS.konfi1.id, USERS.konfi2.id, E, ORGS.testGemeinde.id]);
  });
  afterAll(async () => { await closePool(); });

  const bearer = () => `Bearer ${generateToken('orgAdmin1')}`;
  const alleVerbuchen = async () => {
    const res = await request(app)
      .put(`/api/events/${E}/participants/attendance-all`)
      .set('Authorization', bearer())
      .send({});
    await warteAufNachwehen(app);
    return res;
  };
  const punkte = async () => (await db.query(
    `SELECT COUNT(*)::int AS n FROM event_points WHERE event_id = $1`, [E])).rows[0].n;

  it('nach der Absage verbucht „Alle verbuchen" niemanden und vergibt keine Punkte', async () => {
    const absage = await request(app)
      .put(`/api/events/${E}/cancel`)
      .set('Authorization', bearer())
      .send({ reason: 'Sturm' });
    expect(absage.status).toBe(200);

    const res = await alleVerbuchen();
    expect(res.status).toBe(200);
    expect({ confirmed: res.body.confirmed, points_awarded: res.body.points_awarded })
      .toEqual({ confirmed: 0, points_awarded: 0 });
    expect(await punkte()).toBe(0);
    const { rows } = await db.query(
      `SELECT status, attendance_status FROM event_bookings WHERE event_id = $1 ORDER BY user_id`, [E]);
    expect(rows).toEqual([
      { status: 'excused', attendance_status: 'excused' },
      { status: 'excused', attendance_status: 'excused' },
    ]);
  });

  it('Gegenprobe: ohne Absage verbucht der Knopf beide und vergibt Punkte', async () => {
    const res = await alleVerbuchen();
    expect(res.status).toBe(200);
    expect({ confirmed: res.body.confirmed, points_awarded: res.body.points_awarded })
      .toEqual({ confirmed: 2, points_awarded: 2 });
    expect(await punkte()).toBe(2);
  });
});
