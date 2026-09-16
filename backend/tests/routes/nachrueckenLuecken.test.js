// SECHS WEGE GEBEN EINEN PLATZ FREI — UND AN KEINEM RUECKTE JEMAND NACH.
//
// Nachgemessen auf Produktion (15.09.2026): 89 von 165 Terminen haben eine
// Warteliste eingeschaltet, 9 Personen warten gerade. Ein verfallender Platz
// ist also kein gedachter Fall.
//
// Die sechs Luecken, alle am 15.09.2026 geschlossen:
//   L1  Konfi meldet sich von einem Pflichttermin ab (opted_out)
//   L2  Die Leitung meldet jemanden ab (excused) -- der schaerfste Fall:
//       "Die Mutter ruft an, das Kind ist krank" passiert Tage vorher.
//   L3  Die Leitung stuft jemanden auf die Warteliste herab
//   L4  Eine Konfi wird geloescht
//   L5  Eine Konfi wird zur Teamer:in befoerdert (alle Buchungen fallen weg)
//   L6  Eine Konfi wechselt den Jahrgang (Termine des alten fallen weg)
//
// Dazu die zentrale Regel (Simons Entscheidung 15.09.2026): An einem
// ABGESAGTEN Termin rueckt NIEMAND nach. Der Guard sitzt in
// promoteFromWaitlist selbst, damit er fuer alle sechs Wege gleichzeitig gilt.
//
// GEPRUEFT WIRD IMMER DASSELBE VIERFACHE: Die richtige Person rueckt nach
// (FIFO), sie bekommt den Push, war_auf_warteliste steht auf true (Migration
// 145 -- sonst verliert der Jahresrueckblick die Information), und sie ist im
// Termin-Chat.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const PushService = require('../../services/pushService');

describe('Ein Platz wird frei — jemand rueckt nach', () => {
  let app, db, adminToken, konfiToken;
  let pushSpy, teamPushSpy;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    konfiToken = generateToken('konfi1');
    // admin1 hat im Seed keinen Jahrgang; die Jahrgangs-Bindung (14.09.2026)
    // verlangt ihn fuer jeden Schreibweg an einem Termin.
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
    pushSpy = vi.spyOn(PushService, 'sendWaitlistPromotionToKonfi').mockResolvedValue(undefined);
    teamPushSpy = vi.spyOn(PushService, 'sendWaitlistPromotionToTeamer').mockResolvedValue(undefined);
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ------------------------------------------------------------------
  // Werkzeug
  // ------------------------------------------------------------------

  /** Zusaetzliche Konfis: der Seed hat in Org 1 nur zwei. */
  async function neuerKonfi(username, jahrgangId = JAHRGAENGE.jahrgang1.id) {
    const { rows: [u] } = await db.query(
      `INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
       VALUES ($1, $2, 'x', $3, $4) RETURNING id`,
      [username, `Konfi ${username}`, ROLES.konfi.id, ORGS.testGemeinde.id]
    );
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
       VALUES ($1, $2, 0, 0, $3)`,
      [u.id, jahrgangId, ORGS.testGemeinde.id]
    );
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)',
      [u.id, jahrgangId]
    );
    return u.id;
  }

  async function neuerTeamer(username) {
    const { rows: [u] } = await db.query(
      `INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
       VALUES ($1, $2, 'x', $3, $4) RETURNING id`,
      [username, `Teamer ${username}`, ROLES.teamer.id, ORGS.testGemeinde.id]
    );
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)',
      [u.id, JAHRGAENGE.jahrgang1.id]
    );
    return u.id;
  }

  /**
   * Termin mit Konfi-Kapazitaet 1 und eingeschalteter Warteliste — so ist
   * jeder frei werdende Platz sofort sichtbar.
   */
  async function termin({
    max = 1, teamerMax = 0, pflicht = false, abgesagt = false, jahrgang = JAHRGAENGE.jahrgang1.id
  } = {}) {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                           teamer_max_participants, waitlist_enabled, max_waitlist_size,
                           teamer_waitlist_enabled, teamer_needed, points, point_type, cancelled)
       VALUES ('Konfistunde', NOW() + interval '14 days', $1, $2, $3, $4, true, 10, true, true, 0, 'gemeinde', $5)
       RETURNING id`,
      [ORGS.testGemeinde.id, pflicht, max, teamerMax, abgesagt]
    );
    if (jahrgang) {
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [e.id, jahrgang]
      );
    }
    // Ein Chat-Raum zum Termin: nur dann kann der Eintritt des Nachrueckers
    // ueberhaupt geprueft werden.
    await db.query(
      `INSERT INTO chat_rooms (name, type, event_id, organization_id, created_by)
       VALUES ('Konfistunde', 'group', $1, $2, $3)`,
      [e.id, ORGS.testGemeinde.id, USERS.admin1.id]
    );
    return e.id;
  }

  /**
   * Buchung anlegen. `wartetSeit` steuert created_at, damit die FIFO-Reihenfolge
   * unabhaengig von der Einfuegereihenfolge pruefbar ist.
   */
  async function bucht(eventId, userId, status = 'confirmed', wartetSeit = null) {
    const { rows: [b] } = await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id, created_at)
       VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW())) RETURNING id`,
      [userId, eventId, status, ORGS.testGemeinde.id, wartetSeit]
    );
    return b.id;
  }

  const buchung = async (eventId, userId) => {
    const { rows: [r] } = await db.query(
      'SELECT status, war_auf_warteliste FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    return r;
  };

  const imChat = async (eventId, userId) => {
    const { rows: [r] } = await db.query(
      `SELECT COUNT(*)::int AS n FROM chat_participants cp
         JOIN chat_rooms cr ON cp.room_id = cr.id
        WHERE cr.event_id = $1 AND cp.user_id = $2`,
      [eventId, userId]
    );
    return r.n;
  };

  /** Die vier Beweise fuer ein sauberes Nachruecken. */
  async function istNachgerueckt(eventId, userId) {
    const b = await buchung(eventId, userId);
    expect(b.status).toBe('confirmed');
    expect(b.war_auf_warteliste).toBe(true);
    expect(await imChat(eventId, userId)).toBe(1);
    expect(pushSpy.mock.calls.map(c => c[1])).toContain(userId);
  }

  // ==================================================================
  // L1 — Konfi meldet sich vom Pflichttermin ab (opted_out)
  // ==================================================================
  describe('L1: Konfi meldet sich vom Pflichttermin ab', () => {
    it('der frei gewordene Platz geht an die erste Wartende', async () => {
      const eventId = await termin({ pflicht: true });
      const warteA = await neuerKonfi('warte_a');
      await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, warteA, 'waitlist');

      const res = await request(app)
        .post(`/api/konfi/events/${eventId}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin krank geworden' });

      expect(res.status).toBe(200);
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('opted_out');
      await istNachgerueckt(eventId, warteA);
    });

    it('wer zuerst wartete, rueckt zuerst nach', async () => {
      const eventId = await termin({ pflicht: true });
      const frueh = await neuerKonfi('frueh');
      const spaet = await neuerKonfi('spaet');
      await bucht(eventId, USERS.konfi1.id, 'confirmed');
      // Absichtlich in der falschen Reihenfolge eingefuegt: entscheidend ist
      // created_at, nicht die Einfuegereihenfolge.
      await bucht(eventId, spaet, 'waitlist', new Date(Date.now() - 60_000).toISOString());
      await bucht(eventId, frueh, 'waitlist', new Date(Date.now() - 600_000).toISOString());

      await request(app)
        .post(`/api/konfi/events/${eventId}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin krank geworden' })
        .expect(200);

      expect((await buchung(eventId, frueh)).status).toBe('confirmed');
      expect((await buchung(eventId, spaet)).status).toBe('waitlist');
    });

    it('leere Warteliste: die Abmeldung gelingt, niemand rueckt nach', async () => {
      const eventId = await termin({ pflicht: true });
      await bucht(eventId, USERS.konfi1.id, 'confirmed');

      const res = await request(app)
        .post(`/api/konfi/events/${eventId}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin krank geworden' });

      expect(res.status).toBe(200);
      expect(pushSpy).not.toHaveBeenCalled();
    });

    it('ein wartender Teamer rueckt NICHT auf einen Konfi-Platz', async () => {
      const eventId = await termin({ pflicht: true, teamerMax: 5 });
      const wartenderTeamer = await neuerTeamer('wartet_team');
      await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, wartenderTeamer, 'waitlist');

      await request(app)
        .post(`/api/konfi/events/${eventId}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin krank geworden' })
        .expect(200);

      expect((await buchung(eventId, wartenderTeamer)).status).toBe('waitlist');
      expect(pushSpy).not.toHaveBeenCalled();
    });

    it('die zweite Abmeldung (Offline-Wiederholung) rueckt niemanden zusaetzlich nach', async () => {
      const eventId = await termin({ pflicht: true });
      const warteA = await neuerKonfi('warte_a');
      const warteB = await neuerKonfi('warte_b');
      await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, warteA, 'waitlist', new Date(Date.now() - 600_000).toISOString());
      await bucht(eventId, warteB, 'waitlist', new Date(Date.now() - 60_000).toISOString());

      const abmelden = () => request(app)
        .post(`/api/konfi/events/${eventId}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin krank geworden' });

      await abmelden().expect(200);
      const zweite = await abmelden();
      expect(zweite.status).toBe(200);
      expect(zweite.body.bereits_abgemeldet).toBe(true);

      expect((await buchung(eventId, warteA)).status).toBe('confirmed');
      expect((await buchung(eventId, warteB)).status).toBe('waitlist');
    });
  });

  // ==================================================================
  // L2 — Die Leitung meldet ab (excused)
  // ==================================================================
  describe('L2: Die Leitung meldet jemanden ab', () => {
    const abmelden = (eventId, bookingId, token) =>
      request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${token}`)
        .send({ attendance_status: 'excused', excuse_reason: 'Krank, Mutter hat angerufen' });

    it('der frei gewordene Konfi-Platz geht an die erste Wartende', async () => {
      const eventId = await termin();
      const warteA = await neuerKonfi('warte_a');
      const bookingId = await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, warteA, 'waitlist');

      const res = await abmelden(eventId, bookingId, adminToken);
      expect(res.status).toBe(200);
      await istNachgerueckt(eventId, warteA);
    });

    it('wer zuerst wartete, rueckt zuerst nach', async () => {
      const eventId = await termin();
      const frueh = await neuerKonfi('frueh');
      const spaet = await neuerKonfi('spaet');
      const bookingId = await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, spaet, 'waitlist', new Date(Date.now() - 60_000).toISOString());
      await bucht(eventId, frueh, 'waitlist', new Date(Date.now() - 600_000).toISOString());

      await abmelden(eventId, bookingId, adminToken).expect(200);

      expect((await buchung(eventId, frueh)).status).toBe('confirmed');
      expect((await buchung(eventId, spaet)).status).toBe('waitlist');
    });

    it('ein frei gewordener TEAM-Platz geht an die Team-Warteliste, nicht an Konfis', async () => {
      const eventId = await termin({ max: 5, teamerMax: 1 });
      const wartenderTeamer = await neuerTeamer('wartet_team');
      const wartendeKonfi = await neuerKonfi('wartet_konfi');
      const bookingId = await bucht(eventId, USERS.teamer1.id, 'confirmed');
      await bucht(eventId, wartenderTeamer, 'waitlist');
      await bucht(eventId, wartendeKonfi, 'waitlist');

      await abmelden(eventId, bookingId, adminToken).expect(200);

      const b = await buchung(eventId, wartenderTeamer);
      expect(b.status).toBe('confirmed');
      expect(b.war_auf_warteliste).toBe(true);
      expect(await imChat(eventId, wartenderTeamer)).toBe(1);
      // Der Push geht ueber den Team-Einstiegspunkt raus.
      expect(teamPushSpy.mock.calls.map(c => c[1])).toContain(wartenderTeamer);
      // Die wartende Konfi bleibt: Ihr Kontingent (max 5) ist gar nicht frei
      // geworden, und der Team-Platz gehoert ihr nicht.
      expect((await buchung(eventId, wartendeKonfi)).status).toBe('waitlist');
      expect(pushSpy).not.toHaveBeenCalled();
    });

    it('leere Warteliste: die Abmeldung gelingt, niemand rueckt nach', async () => {
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id, 'confirmed');

      await abmelden(eventId, bookingId, adminToken).expect(200);
      expect(pushSpy).not.toHaveBeenCalled();
    });

    it('anwesend statt abgemeldet: niemand rueckt nach', async () => {
      const eventId = await termin();
      const warteA = await neuerKonfi('warte_a');
      const bookingId = await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, warteA, 'waitlist');

      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present' })
        .expect(200);

      expect((await buchung(eventId, warteA)).status).toBe('waitlist');
      expect(pushSpy).not.toHaveBeenCalled();
    });
  });

  // ==================================================================
  // L3 — Herabstufung auf die Warteliste
  // ==================================================================
  describe('L3: Die Leitung stuft auf die Warteliste herab', () => {
    const herabstufen = (eventId, bookingId) =>
      request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'waitlist' });

    it('der frei gewordene Platz geht an die erste Wartende', async () => {
      const eventId = await termin();
      const warteA = await neuerKonfi('warte_a');
      const bookingId = await bucht(eventId, USERS.konfi1.id, 'confirmed');
      // Die Wartende wartet laenger als die gleich Herabgestufte -- sonst
      // waere die FIFO-Reihenfolge nicht eindeutig.
      await bucht(eventId, warteA, 'waitlist', new Date(Date.now() - 600_000).toISOString());

      const res = await herabstufen(eventId, bookingId);
      expect(res.status).toBe(200);

      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('waitlist');
      await istNachgerueckt(eventId, warteA);
    });

    it('die Herabgestufte holt sich ihren eigenen Platz NICHT zurueck', async () => {
      // Allein auf der Warteliste waere sie selbst der aelteste Eintrag. Genau
      // das darf die Herabstufung nicht zunichte machen.
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id, 'confirmed');

      await herabstufen(eventId, bookingId).expect(200);

      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.status).toBe('waitlist');
      expect(b.war_auf_warteliste).toBe(false);
      expect(pushSpy).not.toHaveBeenCalled();
    });

    it('ein wartender Teamer rueckt NICHT auf den frei gewordenen Konfi-Platz', async () => {
      const eventId = await termin({ teamerMax: 5 });
      const wartenderTeamer = await neuerTeamer('wartet_team');
      const bookingId = await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, wartenderTeamer, 'waitlist', new Date(Date.now() - 600_000).toISOString());

      await herabstufen(eventId, bookingId).expect(200);
      expect((await buchung(eventId, wartenderTeamer)).status).toBe('waitlist');
    });

    it('die Befoerderung von Hand haelt fest, dass die Person gewartet hat', async () => {
      // Kein Nachruecken, sondern der Gegenweg: Die Leitung holt eine bestimmte
      // Person von der Warteliste. FIFO gilt hier bewusst nicht -- aber
      // war_auf_warteliste muss trotzdem gesetzt werden (Migration 145).
      const eventId = await termin({ max: 5 });
      const warteA = await neuerKonfi('warte_a');
      const bookingId = await bucht(eventId, warteA, 'waitlist');

      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed' })
        .expect(200);

      const b = await buchung(eventId, warteA);
      expect(b.status).toBe('confirmed');
      expect(b.war_auf_warteliste).toBe(true);
    });
  });

  // ==================================================================
  // L4 — Konfi geloescht
  // ==================================================================
  describe('L4: Eine Konfi wird geloescht', () => {
    it('ihre Plaetze gehen an die Wartenden', async () => {
      const eventId = await termin();
      const opfer = await neuerKonfi('wird_geloescht');
      const warteA = await neuerKonfi('warte_a');
      await bucht(eventId, opfer, 'confirmed');
      await bucht(eventId, warteA, 'waitlist');

      const res = await request(app)
        .delete(`/api/admin/konfis/${opfer}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      await istNachgerueckt(eventId, warteA);
    });

    it('mehrere Termine: auf jeden frei gewordenen Platz rueckt jemand nach', async () => {
      const eventA = await termin();
      const eventB = await termin();
      const opfer = await neuerKonfi('wird_geloescht');
      const warteA = await neuerKonfi('warte_a');
      const warteB = await neuerKonfi('warte_b');
      await bucht(eventA, opfer, 'confirmed');
      await bucht(eventB, opfer, 'confirmed');
      await bucht(eventA, warteA, 'waitlist');
      await bucht(eventB, warteB, 'waitlist');

      await request(app)
        .delete(`/api/admin/konfis/${opfer}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect((await buchung(eventA, warteA)).status).toBe('confirmed');
      expect((await buchung(eventB, warteB)).status).toBe('confirmed');
    });

    it('eine geloeschte Wartelisten-Buchung gibt keinen Platz frei', async () => {
      const eventId = await termin();
      const opfer = await neuerKonfi('wird_geloescht');
      const warteA = await neuerKonfi('warte_a');
      await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, opfer, 'waitlist', new Date(Date.now() - 900_000).toISOString());
      await bucht(eventId, warteA, 'waitlist');

      await request(app)
        .delete(`/api/admin/konfis/${opfer}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Der einzige bestaetigte Platz ist weiter belegt.
      expect((await buchung(eventId, warteA)).status).toBe('waitlist');
      expect(pushSpy).not.toHaveBeenCalled();
    });
  });

  // ==================================================================
  // L5 — Konfi wird Teamer:in
  // ==================================================================
  describe('L5: Eine Konfi wird zur Teamer:in befoerdert', () => {
    it('ihre Konfi-Plaetze gehen an wartende KONFIS, nicht an wartende Teamer', async () => {
      const eventId = await termin({ teamerMax: 5 });
      const kandidatin = await neuerKonfi('wird_teamer');
      const warteKonfi = await neuerKonfi('warte_a');
      const warteTeamer = await neuerTeamer('wartet_team');
      await bucht(eventId, kandidatin, 'confirmed');
      // Der Teamer wartet LAENGER — ohne Rollentrennung bekaeme er den Platz.
      await bucht(eventId, warteTeamer, 'waitlist', new Date(Date.now() - 900_000).toISOString());
      await bucht(eventId, warteKonfi, 'waitlist');

      const res = await request(app)
        .post(`/api/admin/konfis/${kandidatin}/promote-teamer`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      await istNachgerueckt(eventId, warteKonfi);
      expect((await buchung(eventId, warteTeamer)).status).toBe('waitlist');
    });

    it('leere Warteliste: die Befoerderung gelingt, niemand rueckt nach', async () => {
      const eventId = await termin();
      const kandidatin = await neuerKonfi('wird_teamer');
      await bucht(eventId, kandidatin, 'confirmed');

      await request(app)
        .post(`/api/admin/konfis/${kandidatin}/promote-teamer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(pushSpy).not.toHaveBeenCalled();
    });
  });

  // ==================================================================
  // L6 — Jahrgangswechsel
  // ==================================================================
  describe('L6: Eine Konfi wechselt den Jahrgang', () => {
    it('die Plaetze in den Terminen des alten Jahrgangs gehen an die Wartenden', async () => {
      const eventId = await termin();
      const wechslerin = await neuerKonfi('wechselt');
      const warteA = await neuerKonfi('warte_a');
      await bucht(eventId, wechslerin, 'confirmed');
      await bucht(eventId, warteA, 'waitlist');

      // Ziel-Jahrgang in DERSELBEN Organisation (jahrgang2 des Seeds gehoert
      // zu Org 2 und waere fuer admin1 gar nicht erreichbar).
      const { rows: [ziel] } = await db.query(
        `INSERT INTO jahrgaenge (name, organization_id, confirmation_date)
         VALUES ('Ziel-Jahrgang', $1, '2027-05-01') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      // admin1 braucht auch den Ziel-Jahrgang (Jahrgangs-Bindung, edit).
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
        [USERS.admin1.id, ziel.id]
      );
      require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);

      const res = await request(app)
        .put(`/api/admin/konfis/${wechslerin}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Konfi wechselt', jahrgang_id: ziel.id });
      expect(res.status).toBe(200);

      // Die Buchung der Wechslerin ist weg (das war schon vorher so) ...
      const { rows: rest } = await db.query(
        'SELECT 1 FROM event_bookings WHERE event_id = $1 AND user_id = $2', [eventId, wechslerin]
      );
      expect(rest.length).toBe(0);
      // ... und jetzt rueckt auch jemand nach.
      await istNachgerueckt(eventId, warteA);
    });
  });

  // ==================================================================
  // Der zentrale Guard: abgesagter Termin
  // ==================================================================
  describe('An einem abgesagten Termin rueckt NIEMAND nach', () => {
    it('L1 (Abmeldung vom Pflichttermin) befoerdert niemanden', async () => {
      const eventId = await termin({ pflicht: true, abgesagt: true });
      const warteA = await neuerKonfi('warte_a');
      await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, warteA, 'waitlist');

      await request(app)
        .post(`/api/konfi/events/${eventId}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin krank geworden' })
        .expect(200);

      const b = await buchung(eventId, warteA);
      expect(b.status).toBe('waitlist');
      // Die Buchung wurde ueberhaupt nicht angefasst: Die Spalte ist nullable
      // (Migration 145) und steht deshalb noch auf NULL, nicht auf false.
      expect(b.war_auf_warteliste).toBeNull();
      expect(pushSpy).not.toHaveBeenCalled();
    });

    it('L2 (Leitung meldet ab) befoerdert niemanden', async () => {
      const eventId = await termin({ abgesagt: true });
      const warteA = await neuerKonfi('warte_a');
      const bookingId = await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, warteA, 'waitlist');

      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'Krank' })
        .expect(200);

      expect((await buchung(eventId, warteA)).status).toBe('waitlist');
      expect(pushSpy).not.toHaveBeenCalled();
    });

    it('L4 (Loeschung) befoerdert niemanden', async () => {
      const eventId = await termin({ abgesagt: true });
      const opfer = await neuerKonfi('wird_geloescht');
      const warteA = await neuerKonfi('warte_a');
      await bucht(eventId, opfer, 'confirmed');
      await bucht(eventId, warteA, 'waitlist');

      await request(app)
        .delete(`/api/admin/konfis/${opfer}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect((await buchung(eventId, warteA)).status).toBe('waitlist');
      expect(pushSpy).not.toHaveBeenCalled();
    });

    it('das Entfernen durch die Leitung befoerdert niemanden', async () => {
      const eventId = await termin({ abgesagt: true });
      const warteA = await neuerKonfi('warte_a');
      const bookingId = await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, warteA, 'waitlist');

      await request(app)
        .delete(`/api/events/${eventId}/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect((await buchung(eventId, warteA)).status).toBe('waitlist');
      expect(pushSpy).not.toHaveBeenCalled();
    });

    it('am NICHT abgesagten Termin rueckt beim Entfernen sehr wohl jemand nach (Gegenprobe zum Guard)', async () => {
      const eventId = await termin({ abgesagt: false });
      const warteA = await neuerKonfi('warte_a');
      const bookingId = await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, warteA, 'waitlist');

      await request(app)
        .delete(`/api/events/${eventId}/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await istNachgerueckt(eventId, warteA);
    });
  });

  // ==================================================================
  // Kein doppeltes Nachruecken bei gleichzeitigen Anfragen
  // ==================================================================
  describe('Zwei Anfragen gleichzeitig befoerdern nicht zweimal dieselbe Person', () => {
    it('SKIP LOCKED: zwei frei werdende Plaetze holen ZWEI verschiedene Wartende', async () => {
      const eventId = await termin({ max: 2 });
      const wegA = await neuerKonfi('weg_a');
      const wegB = await neuerKonfi('weg_b');
      const warteA = await neuerKonfi('warte_a');
      const warteB = await neuerKonfi('warte_b');
      const bookingA = await bucht(eventId, wegA, 'confirmed');
      const bookingB = await bucht(eventId, wegB, 'confirmed');
      await bucht(eventId, warteA, 'waitlist', new Date(Date.now() - 600_000).toISOString());
      await bucht(eventId, warteB, 'waitlist', new Date(Date.now() - 300_000).toISOString());

      const entfernen = (bookingId) => request(app)
        .delete(`/api/events/${eventId}/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const [r1, r2] = await Promise.all([entfernen(bookingA), entfernen(bookingB)]);
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);

      // Beide Wartenden sind drin, und zwar genau einmal jede.
      expect((await buchung(eventId, warteA)).status).toBe('confirmed');
      expect((await buchung(eventId, warteB)).status).toBe('confirmed');
      const { rows: [z] } = await db.query(
        "SELECT COUNT(*)::int AS n FROM event_bookings WHERE event_id = $1 AND status = 'confirmed'",
        [eventId]
      );
      // Genau zwei Bestaetigte -- die Kapazitaet ist nicht ueberschritten.
      expect(z.n).toBe(2);
    });

    it('nur EIN Platz wird frei, aber zwei warten: genau einer rueckt nach', async () => {
      const eventId = await termin({ max: 1 });
      const warteA = await neuerKonfi('warte_a');
      const warteB = await neuerKonfi('warte_b');
      const bookingId = await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, warteA, 'waitlist', new Date(Date.now() - 600_000).toISOString());
      await bucht(eventId, warteB, 'waitlist', new Date(Date.now() - 300_000).toISOString());

      await request(app)
        .delete(`/api/events/${eventId}/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect((await buchung(eventId, warteA)).status).toBe('confirmed');
      expect((await buchung(eventId, warteB)).status).toBe('waitlist');
    });
  });

  // ==================================================================
  // Die Kapazitaetserhoehung laeuft jetzt ueber dieselbe Funktion
  // ==================================================================
  describe('Kapazitaet erhoehen befoerdert ueber den gemeinsamen Weg', () => {
    it('Nachgerueckte tragen war_auf_warteliste und sind im Termin-Chat', async () => {
      // Vorher lief das an promoteFromWaitlist vorbei: war_auf_warteliste blieb
      // false (der Jahresrueckblick verlor die Information) und der Eintritt in
      // den Termin-Chat unterblieb.
      const eventId = await termin({ max: 1 });
      const warteA = await neuerKonfi('warte_a');
      const warteB = await neuerKonfi('warte_b');
      await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, warteA, 'waitlist', new Date(Date.now() - 600_000).toISOString());
      await bucht(eventId, warteB, 'waitlist', new Date(Date.now() - 300_000).toISOString());

      const res = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Konfistunde', event_date: new Date(Date.now() + 14 * 86400000).toISOString(), max_participants: 3 });
      expect(res.status).toBe(200);

      await istNachgerueckt(eventId, warteA);
      await istNachgerueckt(eventId, warteB);
    });

    it('erhoeht sich die Kapazitaet nur um einen Platz, rueckt auch nur einer nach', async () => {
      const eventId = await termin({ max: 1 });
      const warteA = await neuerKonfi('warte_a');
      const warteB = await neuerKonfi('warte_b');
      await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, warteA, 'waitlist', new Date(Date.now() - 600_000).toISOString());
      await bucht(eventId, warteB, 'waitlist', new Date(Date.now() - 300_000).toISOString());

      await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Konfistunde', event_date: new Date(Date.now() + 14 * 86400000).toISOString(), max_participants: 2 })
        .expect(200);

      expect((await buchung(eventId, warteA)).status).toBe('confirmed');
      expect((await buchung(eventId, warteB)).status).toBe('waitlist');
    });
  });
});
