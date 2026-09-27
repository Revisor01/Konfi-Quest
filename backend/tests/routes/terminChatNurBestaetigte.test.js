// TERMIN-CHAT: BESTAETIGTE KOMMEN HINEIN, WARTENDE ERST BEIM NACHRUECKEN,
// ABGEMELDETE NICHT.
//
// Befund BF-17 (Bericht "Wer bekommt was", 27.09.2026): Code und Handbuch
// liefen auseinander. Das Handbuch sagte "Wer auf der Warteliste steht, ist
// nicht dabei"; der Code nahm beim Anlegen jede Buchung ausser 'cancelled'
// auf (Warteliste, 'opted_out', 'excused') und danach jede neue Buchung samt
// Warteliste (utils/eventChat.js, bookingUtils.js).
//
// Simons Entscheidung zu F-11 (27.09.2026, "ja" wie empfohlen): "Bestätigte
// ja, Wartende erst beim Nachrücken; Abgemeldete nicht; Handbuch anpassen."
//
// Geprueft wird jeder Weg hinein, je mit dem erlaubten und dem verbotenen
// Fall, gegen die echte DB.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const ORG1 = ORGS.testGemeinde.id;

describe('Termin-Chat: nur wer bestaetigt angemeldet ist', () => {
  let app, db, orgAdminToken;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    orgAdminToken = generateToken('orgAdmin1');
  });

  // ------------------------------------------------------------------
  // Werkzeug
  // ------------------------------------------------------------------

  /** Termin des Jahrgangs 1, Konfi- und Team-Kontingent einstellbar. */
  async function termin({ max = 10, teamerMax = 10, mandatory = false } = {}) {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, max_participants,
                           teamer_max_participants, waitlist_enabled, max_waitlist_size,
                           teamer_waitlist_enabled, teamer_max_waitlist_size,
                           teamer_needed, mandatory, points, point_type, registration_opens_at)
       VALUES ('Freizeit', NOW() + interval '20 days', $1, $2, $3, true, 10, true, 10,
               true, $4, 0, 'gemeinde', NOW() - interval '1 day')
       RETURNING id`,
      [ORG1, max, teamerMax, mandatory]
    );
    await db.query(
      'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
      [e.id, JAHRGAENGE.jahrgang1.id]
    );
    return e.id;
  }

  async function neuerKonfi(username) {
    const { rows: [u] } = await db.query(
      `INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
       VALUES ($1, $2, 'x', $3, $4) RETURNING id`,
      [username, `Konfi ${username}`, ROLES.konfi.id, ORG1]
    );
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
       VALUES ($1, $2, 0, 0, $3)`,
      [u.id, JAHRGAENGE.jahrgang1.id, ORG1]
    );
    return u.id;
  }

  async function buchung(eventId, userId, status) {
    const { rows: [b] } = await db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, booking_date, organization_id)
       VALUES ($1, $2, $3, NOW(), $4) RETURNING id`,
      [eventId, userId, status, ORG1]
    );
    return b.id;
  }

  /** Chat ueber die Route anlegen, wie die Leitung es tut. */
  async function chatAnlegen(eventId) {
    const res = await request(app)
      .post(`/api/events/${eventId}/chat`)
      .set('Authorization', `Bearer ${orgAdminToken}`);
    expect(res.status).toBe(201);
    return res.body;
  }

  /** Wer im Chat des Termins sitzt, als sortierte Nutzer-IDs. */
  const mitglieder = async (eventId) => (await db.query(
    `SELECT cp.user_id FROM chat_participants cp
       JOIN chat_rooms cr ON cr.id = cp.room_id
      WHERE cr.event_id = $1
      ORDER BY cp.user_id`,
    [eventId]
  )).rows.map((r) => Number(r.user_id));

  const statusVon = async (eventId, userId) => (await db.query(
    'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
    [eventId, userId]
  )).rows[0]?.status;

  // ==================================================================
  // Anlegen
  // ==================================================================
  it('beim Anlegen: Ersteller:in und Bestaetigte hinein -- Warteliste und Abgemeldete nicht', async () => {
    const eventId = await termin();
    await buchung(eventId, USERS.konfi1.id, 'confirmed');
    await buchung(eventId, USERS.teamer1.id, 'confirmed');
    await buchung(eventId, USERS.konfi2.id, 'waitlist');
    const abgemeldet = await neuerKonfi('abgemeldet_selbst');
    await buchung(eventId, abgemeldet, 'opted_out');
    const entschuldigt = await neuerKonfi('abgemeldet_leitung');
    await buchung(eventId, entschuldigt, 'excused');

    const antwort = await chatAnlegen(eventId);

    // Antwortform unveraendert: chat_room_id, message, participants_added.
    expect(Object.keys(antwort).sort()).toEqual(['chat_room_id', 'message', 'participants_added']);
    expect(antwort.participants_added).toBe(2);
    expect(await mitglieder(eventId)).toEqual(
      [USERS.konfi1.id, USERS.teamer1.id, USERS.orgAdmin1.id].sort((a, b) => a - b)
    );
  });

  // ==================================================================
  // Spaetere Anmeldung
  // ==================================================================
  it('wer sich nach dem Anlegen bestaetigt anmeldet, kommt hinein', async () => {
    const eventId = await termin();
    await chatAnlegen(eventId);

    const res = await request(app)
      .post(`/api/konfi/events/${eventId}/register`)
      .set('Authorization', `Bearer ${generateToken('konfi1')}`)
      .send({});
    expect(res.status).toBe(200);
    expect(await statusVon(eventId, USERS.konfi1.id)).toBe('confirmed');

    expect(await mitglieder(eventId)).toContain(USERS.konfi1.id);
  });

  it('verboten: wer sich anmeldet und auf der Warteliste landet, bleibt draussen', async () => {
    const eventId = await termin({ max: 1 });
    await buchung(eventId, USERS.konfi1.id, 'confirmed');
    await chatAnlegen(eventId);

    const res = await request(app)
      .post(`/api/konfi/events/${eventId}/register`)
      .set('Authorization', `Bearer ${generateToken('konfi2')}`)
      .send({});
    expect(res.status).toBe(200);
    expect(await statusVon(eventId, USERS.konfi2.id)).toBe('waitlist');

    expect(await mitglieder(eventId)).not.toContain(USERS.konfi2.id);
  });

  it('verboten: eine Teamer-Zusage auf die Warteliste des Teams bleibt draussen', async () => {
    const eventId = await termin({ teamerMax: 1 });
    const andereTeamerin = (await db.query(
      `INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
       VALUES ('teamerin_zwei', 'Teamerin Zwei', 'x', $1, $2) RETURNING id`,
      [ROLES.teamer.id, ORG1]
    )).rows[0].id;
    await buchung(eventId, andereTeamerin, 'confirmed');
    await chatAnlegen(eventId);

    const res = await request(app)
      .post(`/api/teamer/events/${eventId}/zusage`)
      .set('Authorization', `Bearer ${generateToken('teamer1')}`)
      .send({ dabei: true });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('waitlist');
    await warteAufNachwehen(app);

    expect(await mitglieder(eventId)).not.toContain(USERS.teamer1.id);
    expect(await mitglieder(eventId)).toContain(Number(andereTeamerin));
  });

  // ==================================================================
  // Eintragen durch die Leitung
  // ==================================================================
  it('Leitung traegt bestaetigt ein: hinein; auf die Warteliste: draussen', async () => {
    const eventId = await termin();
    await chatAnlegen(eventId);

    const bestaetigt = await request(app)
      .post(`/api/events/${eventId}/participants`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ user_id: USERS.konfi1.id, status: 'confirmed' });
    expect(bestaetigt.status).toBe(201);

    const wartend = await request(app)
      .post(`/api/events/${eventId}/participants`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ user_id: USERS.konfi2.id, status: 'waitlist' });
    expect(wartend.status).toBe(201);
    await warteAufNachwehen(app);

    const drin = await mitglieder(eventId);
    expect(drin).toContain(USERS.konfi1.id);
    expect(drin).not.toContain(USERS.konfi2.id);
  });

  // ==================================================================
  // Nachruecken
  // ==================================================================
  it('Wartende kommen beim Nachruecken hinein, die Abgemeldete geht hinaus', async () => {
    const eventId = await termin({ max: 1 });
    await buchung(eventId, USERS.konfi1.id, 'confirmed');
    await buchung(eventId, USERS.konfi2.id, 'waitlist');
    await chatAnlegen(eventId);
    expect(await mitglieder(eventId)).not.toContain(USERS.konfi2.id);

    const res = await request(app)
      .delete(`/api/konfi/events/${eventId}/register`)
      .set('Authorization', `Bearer ${generateToken('konfi1')}`);
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);

    expect(await statusVon(eventId, USERS.konfi2.id)).toBe('confirmed');
    const drin = await mitglieder(eventId);
    expect(drin).toContain(USERS.konfi2.id);
    expect(drin).not.toContain(USERS.konfi1.id);
  });

  // ==================================================================
  // Herabstufen und wieder bestaetigen durch die Leitung
  // ==================================================================
  it('auf die Warteliste zurueckgesetzt: hinaus; wieder bestaetigt: hinein', async () => {
    const eventId = await termin();
    const b = await buchung(eventId, USERS.konfi1.id, 'confirmed');
    await chatAnlegen(eventId);
    expect(await mitglieder(eventId)).toContain(USERS.konfi1.id);

    const runter = await request(app)
      .put(`/api/events/${eventId}/participants/${b}/status`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ status: 'waitlist' });
    expect(runter.status).toBe(200);
    expect(await mitglieder(eventId)).not.toContain(USERS.konfi1.id);

    const hoch = await request(app)
      .put(`/api/events/${eventId}/participants/${b}/status`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ status: 'confirmed' });
    expect(hoch.status).toBe(200);
    await warteAufNachwehen(app);
    expect(await mitglieder(eventId)).toContain(USERS.konfi1.id);
  });

  // ==================================================================
  // Pflichttermin: Abmeldung und Wiederanmeldung
  // ==================================================================
  it('Pflicht-Abmeldung: wer schon drin ist, bleibt (Entscheidung 24.08.2026); Wiederanmelden holt Abgemeldete hinein', async () => {
    const eventId = await termin({ max: 0, mandatory: true });
    await buchung(eventId, USERS.konfi1.id, 'confirmed');
    await buchung(eventId, USERS.konfi2.id, 'opted_out');
    await chatAnlegen(eventId);
    // Beim Anlegen schon abgemeldet: nicht hinein.
    expect(await mitglieder(eventId)).not.toContain(USERS.konfi2.id);

    const ab = await request(app)
      .post(`/api/konfi/events/${eventId}/opt-out`)
      .set('Authorization', `Bearer ${generateToken('konfi1')}`)
      .send({ reason: 'Wir sind im Urlaub' });
    expect(ab.status).toBe(200);
    await warteAufNachwehen(app);
    expect(await statusVon(eventId, USERS.konfi1.id)).toBe('opted_out');
    expect(await mitglieder(eventId)).toContain(USERS.konfi1.id);

    const wieder = await request(app)
      .post(`/api/konfi/events/${eventId}/opt-in`)
      .set('Authorization', `Bearer ${generateToken('konfi2')}`)
      .send({});
    expect(wieder.status).toBe(200);
    await warteAufNachwehen(app);
    expect(await statusVon(eventId, USERS.konfi2.id)).toBe('confirmed');
    expect(await mitglieder(eventId)).toContain(USERS.konfi2.id);
  });

  it('von der Leitung bei der Anwesenheit als "Abgemeldet" verbucht: bleibt, wer schon drin ist', async () => {
    const eventId = await termin();
    const b = await buchung(eventId, USERS.konfi1.id, 'confirmed');
    await chatAnlegen(eventId);

    const res = await request(app)
      .put(`/api/events/${eventId}/participants/${b}/attendance`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ attendance_status: 'excused', excuse_reason: 'krank' });
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);

    expect(await statusVon(eventId, USERS.konfi1.id)).toBe('excused');
    expect(await mitglieder(eventId)).toContain(USERS.konfi1.id);
  });
});
