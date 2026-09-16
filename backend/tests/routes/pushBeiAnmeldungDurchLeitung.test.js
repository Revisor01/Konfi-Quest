// WER VON DER LEITUNG ANGEMELDET WIRD, ERFAEHRT ES AUCH.
//
// Befund 16.09.2026: POST /api/events/:id/participants — der Weg, ueber den
// die Leitung jemanden zu einem Termin anmeldet — schickte keinen einzigen
// Push. Die Route importierte den PushService, rief ihn aber nirgends auf.
// Es gab nur Live-Updates: die erreichen eine offene Sitzung im Browser, aber
// kein Handy. Simon woertlich: "wenn ein admin jemanden zu einem evnt
// anmeldet, muss derjenige einen push bekommen. teamer, leitung oder auch
// konfi. bisher bekommt derjenige nichts."
//
// Die SELBSTanmeldung (POST /api/konfi/events/:id/book bzw. der Teamer-Weg)
// sendet sehr wohl — ueber sendEventRegisteredToKonfi. Genau dieselbe
// Meldung muss auch hier raus.
//
// Geprueft wird:
//   - Konfi wird von der Leitung angemeldet -> Push an die Konfi
//   - Teamer:in wird von der Leitung angemeldet -> Push an die Teamer:in
//   - Wer direkt auf die Warteliste gesetzt wird, bekommt die
//     Wartelisten-Meldung (status 'waitlist'), nicht "angemeldet"
//   - Die Leitung, die sich selbst eintraegt, bekommt keinen Push
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const PushService = require('../../services/pushService');

describe('Die Leitung meldet jemanden an — die Person bekommt einen Push', () => {
  let app, db, adminToken;
  let pushSpy;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    // admin1 hat im Seed keinen Jahrgang; die Jahrgangs-Bindung (14.09.2026)
    // verlangt ihn fuer jeden Schreibweg an einem Termin.
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
    // sendEventRegisteredToTeamer delegiert an sendEventRegisteredToKonfi
    // (rollenagnostisch, siehe pushService.js) — ein Spy reicht deshalb fuer
    // beide Rollen. Wird der Teamer-Weg gewaehlt, laeuft er durch denselben.
    pushSpy = vi.spyOn(PushService, 'sendEventRegisteredToKonfi').mockResolvedValue({ success: true });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ------------------------------------------------------------------
  // Werkzeug
  // ------------------------------------------------------------------

  /**
   * Termin mit Konfi- und Team-Kontingent. `max`/`teamerMax` steuern, wer
   * noch einen bestaetigten Platz bekommt und wer auf die Warteliste faellt.
   */
  async function termin({ max = 10, teamerMax = 10, jahrgang = JAHRGAENGE.jahrgang1.id } = {}) {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, max_participants,
                           teamer_max_participants, waitlist_enabled, max_waitlist_size,
                           teamer_waitlist_enabled, teamer_max_waitlist_size,
                           teamer_needed, points, point_type)
       VALUES ('Konfistunde', NOW() + interval '14 days', $1, $2, $3, true, 10, true, 10, true, 0, 'gemeinde')
       RETURNING id`,
      [ORGS.testGemeinde.id, max, teamerMax]
    );
    if (jahrgang) {
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [e.id, jahrgang]
      );
    }
    return e.id;
  }

  async function neuerKonfi(username) {
    const { rows: [u] } = await db.query(
      `INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
       VALUES ($1, $2, 'x', $3, $4) RETURNING id`,
      [username, `Konfi ${username}`, ROLES.konfi.id, ORGS.testGemeinde.id]
    );
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
       VALUES ($1, $2, 0, 0, $3)`,
      [u.id, JAHRGAENGE.jahrgang1.id, ORGS.testGemeinde.id]
    );
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)',
      [u.id, JAHRGAENGE.jahrgang1.id]
    );
    return u.id;
  }

  const anmelden = (eventId, userId, body = {}) =>
    request(app)
      .post(`/api/events/${eventId}/participants`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: userId, ...body });

  /** Die Push-Aufrufe fuer eine bestimmte Person. */
  const pushesAn = (userId) => pushSpy.mock.calls.filter(c => c[1] === userId);

  // ==================================================================
  // Konfi
  // ==================================================================
  it('eine von der Leitung angemeldete Konfi bekommt den Push "angemeldet"', async () => {
    const eventId = await termin();
    const res = await anmelden(eventId, USERS.konfi1.id);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('confirmed');

    await warteAufNachwehen(app);

    const aufrufe = pushesAn(USERS.konfi1.id);
    expect(aufrufe.length).toBe(1);
    // Signatur: (db, userId, eventName, eventDate, status, eventId, timeslot, orgId)
    expect(aufrufe[0][2]).toBe('Konfistunde');
    expect(aufrufe[0][4]).toBe('confirmed');
    expect(aufrufe[0][5]).toBe(String(eventId));
    expect(aufrufe[0][7]).toBe(ORGS.testGemeinde.id);
  });

  // ==================================================================
  // Teamer:in
  // ==================================================================
  it('eine von der Leitung angemeldete Teamer:in bekommt denselben Push', async () => {
    const eventId = await termin();
    const res = await anmelden(eventId, USERS.teamer1.id);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('confirmed');

    await warteAufNachwehen(app);

    const aufrufe = pushesAn(USERS.teamer1.id);
    expect(aufrufe.length).toBe(1);
    expect(aufrufe[0][2]).toBe('Konfistunde');
    expect(aufrufe[0][4]).toBe('confirmed');
  });

  // ==================================================================
  // Warteliste
  // ==================================================================
  it('wer wegen voller Plaetze auf die Warteliste faellt, bekommt die Wartelisten-Meldung', async () => {
    const eventId = await termin({ max: 1 });
    const besetzt = await neuerKonfi('besetzt_den_platz');
    await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
       VALUES ($1, $2, 'confirmed', $3)`,
      [besetzt, eventId, ORGS.testGemeinde.id]
    );

    const res = await anmelden(eventId, USERS.konfi1.id);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('waitlist');

    await warteAufNachwehen(app);

    const aufrufe = pushesAn(USERS.konfi1.id);
    expect(aufrufe.length).toBe(1);
    expect(aufrufe[0][4]).toBe('waitlist');
  });

  it('wer von der Leitung direkt auf die Warteliste gesetzt wird, bekommt die Wartelisten-Meldung', async () => {
    const eventId = await termin();
    const res = await anmelden(eventId, USERS.konfi1.id, { status: 'waitlist' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('waitlist');

    await warteAufNachwehen(app);

    const aufrufe = pushesAn(USERS.konfi1.id);
    expect(aufrufe.length).toBe(1);
    expect(aufrufe[0][4]).toBe('waitlist');
  });

  // ==================================================================
  // Kein Push an die ausloesende Person
  // ==================================================================
  it('die Leitung, die sich selbst eintraegt, bekommt keinen Push', async () => {
    const eventId = await termin();
    const res = await anmelden(eventId, USERS.admin1.id);
    expect(res.status).toBe(201);

    await warteAufNachwehen(app);

    expect(pushesAn(USERS.admin1.id).length).toBe(0);
    // Und an sonst niemanden ging deswegen etwas raus.
    expect(pushSpy.mock.calls.length).toBe(0);
  });

  it('auch als Zeichenkette uebergeben bleibt die Selbstzuordnung ohne Push', async () => {
    // Der Rumpf ist JSON: user_id kann als "4" statt 4 ankommen. Ein strikter
    // Vergleich haette hier einen Push an die ausloesende Person geschickt.
    const eventId = await termin();
    const res = await anmelden(eventId, String(USERS.admin1.id));
    expect(res.status).toBe(201);

    await warteAufNachwehen(app);
    expect(pushSpy.mock.calls.length).toBe(0);
  });

  // ==================================================================
  // Abgewiesene Anmeldungen loesen nichts aus
  // ==================================================================
  it('eine abgewiesene Doppelanmeldung schickt keinen Push', async () => {
    const eventId = await termin();
    await anmelden(eventId, USERS.konfi1.id).expect(201);
    await warteAufNachwehen(app);
    pushSpy.mockClear();

    const zweite = await anmelden(eventId, USERS.konfi1.id);
    expect(zweite.status).toBe(409);

    await warteAufNachwehen(app);
    expect(pushSpy.mock.calls.length).toBe(0);
  });
});
