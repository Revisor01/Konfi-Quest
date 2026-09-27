// WER VON DER LEITUNG AUSGETRAGEN ODER AUF DIE WARTELISTE ZURUECKGESETZT
// WIRD, ERFAEHRT ES -- mit Push und Postfach-Eintrag.
//
// Befund BF-14 (Bericht "Wer bekommt was", 27.09.2026): Das Eintragen durch
// die Leitung meldete sich seit dem 16.09.2026 (pushBeiAnmeldungDurchLeitung),
// Austragen (DELETE /api/events/:id/bookings/:bookingId) und Herabstufen
// (PUT /api/events/:id/participants/:participantId/status, 'waitlist') liefen
// still. Gemessen im Audit: "DELETE /events/1/bookings -> 200 | Pushes an
// konfi1: [] | Postfach konfi1: 0".
//
// Simons Entscheidung (F-06, 27.09.2026): "Ja, mit Postfach-Eintrag, wie beim
// Eintragen." Fuer Konfis und Teamer:innen; nicht an die ausloesende Person
// selbst.
//
// Firebase ist gemockt wie in tests/services/pushEmpfaengerMultiOrg.test.js;
// geprueft wird, was wirklich an welches Geraet ginge, und die Zeile in
// notifications.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const ORG1 = ORGS.testGemeinde.id;

/** Alle Pushes einer Art, als [token, data]. */
const pushesDerArt = (art) => sendFirebasePushNotification.mock.calls
  .filter(([, payload]) => payload.data && payload.data.type === art)
  .map(([token, payload]) => ({ token, title: payload.title, body: payload.body, data: payload.data }));

describe('Austragen und Herabstufen durch die Leitung melden sich bei der Person', () => {
  let app, db, orgAdminToken;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    orgAdminToken = generateToken('orgAdmin1');
    for (const [userId, token] of [
      [USERS.konfi1.id, 'token-konfi1'],
      [USERS.konfi2.id, 'token-konfi2'],
      [USERS.teamer1.id, 'token-teamer1'],
      [USERS.orgAdmin1.id, 'token-orgadmin1'],
    ]) {
      await db.query(
        `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, 'ios', $3)`,
        [userId, token, `geraet-${token}`]
      );
    }
    sendFirebasePushNotification.mockClear();
  });

  /** Termin des Jahrgangs 1 mit einem Konfi-Platz, Warteliste und Team. */
  async function termin() {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, max_participants,
                           teamer_max_participants, waitlist_enabled, max_waitlist_size,
                           teamer_waitlist_enabled, teamer_max_waitlist_size,
                           teamer_needed, points, point_type)
       VALUES ('Konfistunde', NOW() + interval '14 days', $1, 1, 5, true, 10, true, 10, true, 0, 'gemeinde')
       RETURNING id`,
      [ORG1]
    );
    await db.query(
      'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
      [e.id, JAHRGAENGE.jahrgang1.id]
    );
    return e.id;
  }

  async function buchung(eventId, userId, status) {
    const { rows: [b] } = await db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, booking_date, organization_id)
       VALUES ($1, $2, $3, NOW(), $4) RETURNING id`,
      [eventId, userId, status, ORG1]
    );
    return b.id;
  }

  const postfach = async (userId, art) => (await db.query(
    `SELECT title, message, data, organization_id FROM notifications
      WHERE user_id = $1 AND type = $2`,
    [userId, art]
  )).rows;

  const austragen = (eventId, bookingId, token = orgAdminToken) => request(app)
    .delete(`/api/events/${eventId}/bookings/${bookingId}`)
    .set('Authorization', `Bearer ${token}`);

  const statusSetzen = (eventId, bookingId, status) => request(app)
    .put(`/api/events/${eventId}/participants/${bookingId}/status`)
    .set('Authorization', `Bearer ${orgAdminToken}`)
    .send({ status });

  // ==================================================================
  // Austragen
  // ==================================================================
  it('eine ausgetragene Konfi bekommt Push und Postfach-Eintrag "Vom Event ausgetragen"', async () => {
    const eventId = await termin();
    const b = await buchung(eventId, USERS.konfi1.id, 'confirmed');

    const res = await austragen(eventId, b);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Teilnehmer erfolgreich entfernt' });
    await warteAufNachwehen(app);

    const pushes = pushesDerArt('event_removed');
    expect(pushes.map((p) => p.token)).toEqual(['token-konfi1']);
    expect(pushes[0].title).toBe('Vom Event ausgetragen');
    expect(pushes[0].body).toMatch(/^Die Leitung hat dich aus "Konfistunde" am .+ ausgetragen\.$/);
    expect(pushes[0].data.event_id).toBe(String(eventId));
    expect(pushes[0].data.organization_id).toBe(String(ORG1));

    const eintraege = await postfach(USERS.konfi1.id, 'event_removed');
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0].title).toBe('Vom Event ausgetragen');
    expect(eintraege[0].data.event_id).toBe(String(eventId));
    expect(eintraege[0].organization_id).toBe(ORG1);
  });

  it('eine ausgetragene Teamer:in bekommt dieselbe Mitteilung', async () => {
    const eventId = await termin();
    const b = await buchung(eventId, USERS.teamer1.id, 'confirmed');

    expect((await austragen(eventId, b)).status).toBe(200);
    await warteAufNachwehen(app);

    expect(pushesDerArt('event_removed').map((p) => p.token)).toEqual(['token-teamer1']);
    expect(await postfach(USERS.teamer1.id, 'event_removed')).toHaveLength(1);
  });

  it('auch wer von der Warteliste ausgetragen wird, erfaehrt es', async () => {
    const eventId = await termin();
    await buchung(eventId, USERS.konfi1.id, 'confirmed');
    const wartend = await buchung(eventId, USERS.konfi2.id, 'waitlist');

    expect((await austragen(eventId, wartend)).status).toBe(200);
    await warteAufNachwehen(app);

    expect(pushesDerArt('event_removed').map((p) => p.token)).toEqual(['token-konfi2']);
    expect(await postfach(USERS.konfi1.id, 'event_removed')).toHaveLength(0);
  });

  it('der Platz geht an die Wartende -- sie bekommt das Nachruecken, nicht das Austragen', async () => {
    const eventId = await termin();
    const b = await buchung(eventId, USERS.konfi1.id, 'confirmed');
    await buchung(eventId, USERS.konfi2.id, 'waitlist');

    expect((await austragen(eventId, b)).status).toBe(200);
    await warteAufNachwehen(app);

    expect(pushesDerArt('event_removed').map((p) => p.token)).toEqual(['token-konfi1']);
    // Der Nachrueck-Push laeuft in dieser Route (seit jeher) direkt nach der
    // Antwort im Handler, nicht ueber nachAntwort -- warteAufNachwehen sieht
    // ihn nicht. Deshalb hier auf ihn warten statt ihn sofort zu erwarten.
    await vi.waitFor(() => {
      expect(pushesDerArt('waitlist_promotion').map((p) => p.token)).toEqual(['token-konfi2']);
    });
    expect(pushesDerArt('event_removed').map((p) => p.token)).toEqual(['token-konfi1']);
  });

  it('verboten: wer sich selbst austraegt, bekommt nichts aufs eigene Handy und keinen Eintrag', async () => {
    const eventId = await termin();
    const eigene = await buchung(eventId, USERS.orgAdmin1.id, 'confirmed');

    expect((await austragen(eventId, eigene)).status).toBe(200);
    await warteAufNachwehen(app);

    expect(pushesDerArt('event_removed')).toEqual([]);
    expect(await postfach(USERS.orgAdmin1.id, 'event_removed')).toHaveLength(0);
  });

  it('verboten: eine schon abgemeldete Person bekommt beim Entfernen der Zeile keine neue Nachricht', async () => {
    const eventId = await termin();
    const abgemeldet = await buchung(eventId, USERS.konfi1.id, 'opted_out');

    expect((await austragen(eventId, abgemeldet)).status).toBe(200);
    await warteAufNachwehen(app);

    expect(pushesDerArt('event_removed')).toEqual([]);
    expect(await postfach(USERS.konfi1.id, 'event_removed')).toHaveLength(0);
  });

  it('verboten: wer sich selbst abmeldet, bekommt die Abmelde-Bestaetigung, nicht "ausgetragen"', async () => {
    const eventId = await termin();
    await buchung(eventId, USERS.konfi1.id, 'confirmed');

    const res = await request(app)
      .delete(`/api/konfi/events/${eventId}/register`)
      .set('Authorization', `Bearer ${generateToken('konfi1')}`)
      .send({ reason: 'Bin krank' });
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);

    expect(pushesDerArt('event_removed')).toEqual([]);
    expect(await postfach(USERS.konfi1.id, 'event_removed')).toHaveLength(0);
  });

  // ==================================================================
  // Auf die Warteliste zuruecksetzen
  // ==================================================================
  it('wer auf die Warteliste zurueckgesetzt wird, bekommt "Auf die Warteliste gesetzt"', async () => {
    const eventId = await termin();
    const b = await buchung(eventId, USERS.konfi1.id, 'confirmed');

    const res = await statusSetzen(eventId, b, 'waitlist');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Teilnehmer:in auf Warteliste gesetzt', status: 'waitlist' });
    await warteAufNachwehen(app);

    const pushes = pushesDerArt('event_waitlisted');
    expect(pushes.map((p) => p.token)).toEqual(['token-konfi1']);
    expect(pushes[0].title).toBe('Auf die Warteliste gesetzt');
    expect(pushes[0].body).toMatch(/^Die Leitung hat dich für "Konfistunde" am .+ auf die Warteliste gesetzt\. Rückst du nach, bekommst du Bescheid\.$/);
    expect(pushes[0].data.event_id).toBe(String(eventId));

    const eintraege = await postfach(USERS.konfi1.id, 'event_waitlisted');
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0].organization_id).toBe(ORG1);
    // Kein "ausgetragen" -- die Person steht weiter auf dem Termin.
    expect(pushesDerArt('event_removed')).toEqual([]);
  });

  it('eine herabgestufte Teamer:in bekommt dieselbe Mitteilung', async () => {
    const eventId = await termin();
    const b = await buchung(eventId, USERS.teamer1.id, 'confirmed');

    expect((await statusSetzen(eventId, b, 'waitlist')).status).toBe(200);
    await warteAufNachwehen(app);

    expect(pushesDerArt('event_waitlisted').map((p) => p.token)).toEqual(['token-teamer1']);
  });

  it('verboten: der Weg zurueck (Warteliste -> bestaetigt) meldet das Nachruecken, nicht die Warteliste', async () => {
    const eventId = await termin();
    const wartend = await buchung(eventId, USERS.konfi1.id, 'waitlist');

    expect((await statusSetzen(eventId, wartend, 'confirmed')).status).toBe(200);
    await warteAufNachwehen(app);

    expect(pushesDerArt('event_waitlisted')).toEqual([]);
    expect(pushesDerArt('waitlist_promotion').map((p) => p.token)).toEqual(['token-konfi1']);
  });

  it('verboten: wer sich selbst auf die Warteliste setzt, bekommt nichts', async () => {
    const eventId = await termin();
    const eigene = await buchung(eventId, USERS.orgAdmin1.id, 'confirmed');

    expect((await statusSetzen(eventId, eigene, 'waitlist')).status).toBe(200);
    await warteAufNachwehen(app);

    expect(pushesDerArt('event_waitlisted')).toEqual([]);
    expect(await postfach(USERS.orgAdmin1.id, 'event_waitlisted')).toHaveLength(0);
  });

  it('ohne Push-Geraet steht die Mitteilung trotzdem im Postfach', async () => {
    const eventId = await termin();
    const b = await buchung(eventId, USERS.konfi1.id, 'confirmed');
    await db.query('DELETE FROM push_tokens WHERE user_id = $1', [USERS.konfi1.id]);

    expect((await austragen(eventId, b)).status).toBe(200);
    await warteAufNachwehen(app);

    expect(pushesDerArt('event_removed')).toEqual([]);
    expect(await postfach(USERS.konfi1.id, 'event_removed')).toHaveLength(1);
  });
});
