// DELETE /events/:id/book: FUER KONFIS GELTEN DIESELBEN REGELN WIE AUF DER
// KONFI-ROUTE (Audit 26.09.2026, Punkte/Termine BF-01)
//
// Die Konfi-App meldet ueber DELETE /konfi/events/:id/register ab. Diese
// Route setzt drei Regeln durch: Pflichttermine nur per Opt-out, Abmelden nur
// bis zwei Tage vorher, Protokoll in event_unregistrations. Die aeltere
// generische Route DELETE /events/:id/book war mit einem Konfi-Token ebenso
// erreichbar, prueften aber nur "gibt es eine Buchung" -- und loeschte sie,
// einschliesslich eines von der Leitung gesetzten Anwesenheitsvermerks, auch
// nach dem Termin. Ein "unentschuldigt gefehlt" am Pflichttermin liess sich
// so von der betroffenen Person selbst entfernen.
//
// Die Regeln stehen jetzt an EINER Stelle (bookingUtils.pruefeKonfiStorno)
// und gelten auf beiden Wegen. Fuer Team und Leitung aendert sich nichts:
// Teamer:innen haben kein Anmeldefenster und keine Frist (Handbuch
// 70-termine "Selbst zu- oder absagen").
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('DELETE /events/:id/book — Regeln fuer Konfis wie auf der Konfi-Route', () => {
  let app;
  let db;
  let konfiToken;
  let teamerToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    konfiToken = generateToken('konfi1');
    teamerToken = generateToken('teamer1');
  });

  // Termin direkt in der Datenbank, mit genau den Eigenschaften des Falls
  // (Muster: buchungKern.test.js).
  async function termin({ tageAbHeute = 30, mandatory = false, teamer_needed = false } = {}) {
    const { rows: [e] } = await db.query(
      `INSERT INTO events
         (name, event_date, organization_id, mandatory, max_participants,
          point_type, points, has_timeslots, waitlist_enabled, max_waitlist_size,
          teamer_needed, teamer_max_participants, teamer_waitlist_enabled, teamer_max_waitlist_size,
          registration_opens_at, registration_closes_at)
       VALUES ('Storno-Termin', NOW() + ($1 || ' days')::interval, $2, $3, 10,
               'gemeinde', 1, false, false, 10,
               $4, 0, false, 10,
               NOW() - interval '10 days', NOW() + ($1 || ' days')::interval)
       RETURNING id`,
      [String(tageAbHeute), ORGS.testGemeinde.id, mandatory, teamer_needed]
    );
    await db.query(
      'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
      [e.id, JAHRGAENGE.jahrgang1.id]
    );
    return e.id;
  }

  async function buchung(eventId, userId, { status = 'confirmed', attendance = null } = {}) {
    await db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, attendance_status, organization_id, booking_date)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [eventId, userId, status, attendance, ORGS.testGemeinde.id]
    );
  }

  async function buchungLesen(eventId, userId) {
    const { rows: [row] } = await db.query(
      'SELECT status, attendance_status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    return row || null;
  }

  async function protokollZeilen(eventId, userId) {
    const { rows: [row] } = await db.query(
      'SELECT COUNT(*)::int AS anzahl FROM event_unregistrations WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    return row.anzahl;
  }

  const storno = (eventId, token) =>
    request(app)
      .delete(`/api/events/${eventId}/book`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

  // ------------------------------------------------------------------
  // Verbotene Faelle -- je Regel einer, mit der konkreten Meldung
  // ------------------------------------------------------------------

  it('Pflichttermin: 400 "nur ueber Opt-out", Buchung bleibt', async () => {
    const eventId = await termin({ mandatory: true });
    await buchung(eventId, USERS.konfi1.id);

    const res = await storno(eventId, konfiToken);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Pflicht-Events können nur über Opt-out abgemeldet werden');
    expect(await buchungLesen(eventId, USERS.konfi1.id)).toEqual({ status: 'confirmed', attendance_status: null });
  });

  it('Frist verstrichen (Termin morgen): 400 "nur bis 2 Tage vorher", Buchung bleibt', async () => {
    const eventId = await termin({ tageAbHeute: 1 });
    await buchung(eventId, USERS.konfi1.id);

    const res = await storno(eventId, konfiToken);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Abmeldung ist nur bis 2 Tage vor dem Event möglich');
    expect(await buchungLesen(eventId, USERS.konfi1.id)).toEqual({ status: 'confirmed', attendance_status: null });
  });

  it('Anwesenheit vermerkt (gefehlt am Pflichttermin gestern): 400, der Vermerk bleibt', async () => {
    // Der Fall aus dem Bericht: Leitung traegt "absent" ein, die Konfi
    // loescht den Eintrag selbst -- danach stand sie als nie angemeldet da.
    const eventId = await termin({ tageAbHeute: -1, mandatory: true });
    await buchung(eventId, USERS.konfi1.id, { attendance: 'absent' });

    const res = await storno(eventId, konfiToken);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Die Anwesenheit ist bereits verbucht — Änderungen macht die Leitung');
    expect(await buchungLesen(eventId, USERS.konfi1.id)).toEqual({ status: 'confirmed', attendance_status: 'absent' });
  });

  it('Anwesenheit vermerkt, freiwilliger Termin weit voraus: derselbe Riegel, unabhaengig von der Frist', async () => {
    const eventId = await termin({ tageAbHeute: 30 });
    await buchung(eventId, USERS.konfi1.id, { attendance: 'present' });

    const res = await storno(eventId, konfiToken);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Die Anwesenheit ist bereits verbucht — Änderungen macht die Leitung');
    expect(await buchungLesen(eventId, USERS.konfi1.id)).toEqual({ status: 'confirmed', attendance_status: 'present' });
  });

  // ------------------------------------------------------------------
  // Erlaubte Faelle
  // ------------------------------------------------------------------

  it('freiwilliger Termin in 30 Tagen, nichts verbucht: 200, Buchung weg, Abmeldung protokolliert', async () => {
    const eventId = await termin({ tageAbHeute: 30 });
    await buchung(eventId, USERS.konfi1.id);

    const res = await storno(eventId, konfiToken);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Buchung erfolgreich storniert');
    expect(await buchungLesen(eventId, USERS.konfi1.id)).toBeNull();
    // Dasselbe Protokoll wie auf der Konfi-Route -- vorher blieb der Weg
    // ueber /book ohne Spur.
    expect(await protokollZeilen(eventId, USERS.konfi1.id)).toBe(1);
  });

  it('Warteliste, Termin morgen: 200 -- die Frist gilt nicht fuer Wartende (wie auf der Konfi-Route)', async () => {
    const eventId = await termin({ tageAbHeute: 1 });
    await buchung(eventId, USERS.konfi1.id, { status: 'waitlist' });

    const res = await storno(eventId, konfiToken);

    expect(res.status).toBe(200);
    expect(await buchungLesen(eventId, USERS.konfi1.id)).toBeNull();
  });

  // ------------------------------------------------------------------
  // Team: nichts aendert sich
  // ------------------------------------------------------------------

  it('Teamer:in storniert am Vortag: 200 -- fuer das Team gibt es keine Frist', async () => {
    const eventId = await termin({ tageAbHeute: 1, teamer_needed: true });
    await buchung(eventId, USERS.teamer1.id);

    const res = await storno(eventId, teamerToken);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Buchung erfolgreich storniert');
    expect(await buchungLesen(eventId, USERS.teamer1.id)).toBeNull();
    // Kein Konfi-Protokoll fuer Team-Absagen -- so war es, so bleibt es.
    expect(await protokollZeilen(eventId, USERS.teamer1.id)).toBe(0);
  });

  it('Teamer:in an einem Pflichttermin mit Teambedarf: 200 -- der Pflicht-Riegel gilt nur fuer Konfis', async () => {
    const eventId = await termin({ tageAbHeute: 30, mandatory: true, teamer_needed: true });
    await buchung(eventId, USERS.teamer1.id);

    const res = await storno(eventId, teamerToken);

    expect(res.status).toBe(200);
    expect(await buchungLesen(eventId, USERS.teamer1.id)).toBeNull();
  });
});
