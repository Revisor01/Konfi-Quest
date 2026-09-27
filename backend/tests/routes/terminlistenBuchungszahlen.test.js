// backend/tests/routes/terminlistenBuchungszahlen.test.js
//
// Die Antwortform der Terminlisten, festgehalten Feld fuer Feld (Audit
// 26.09.2026, Sammelbefund S-04 / Datenbank BF-02 / Betrieb BF-03).
//
// Die Listen GET /events, GET /events/cancelled, GET /konfi/events und die
// Serienliste in GET /events/:id holen ihre Buchungszahlen nicht mehr aus der
// Sicht event_booking_stats (die der Planer im Join gegen die Liste ueber ALLE
// Buchungen ALLER Gemeinden materialisierte), sondern als Aggregat je Termin
// direkt aus event_bookings (utils/buchungszahlen.js). Die Antwort ist ein
// Vertrag mit den Store-Apps: kein Feld anders, kein Typ anders, keine
// Reihenfolge anders, kein null, wo vorher 0 stand.
//
// Deshalb steht hier fuer jeden Zustand einer Buchung -- gebucht (verbucht
// anwesend / abwesend / offen), Warteliste, abgemeldet durch die Leitung
// (excused), selbst abgemeldet (opted_out), geloeschtes Konto, Team-Seite,
// abgesagter Termin, Termin ohne Buchung, Termin mit Zeitfenstern, Termin einer
// anderen Gemeinde -- der konkrete Wert, den die Route liefert. Kein
// toBeDefined. Der letzte Block verlangt zusaetzlich, dass jede Zahl der Listen
// mit der Sicht uebereinstimmt: Die Sicht bleibt die verbindliche Definition
// der Zaehlung, die Listen duerfen nicht von ihr abweichen.
const request = require('supertest');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, EVENTS, JAHRGAENGE } = require('../helpers/seed');
const { getTestApp } = require('../helpers/testApp');
const { generateToken } = require('../helpers/auth');

// Zusaetzliche Konfis der Test-Gemeinde, damit jeder Buchungszustand einmal
// vorkommt. 104 ist ein geloeschtes Konto: Seine Buchung darf nirgends zaehlen.
const EXTRA = {
  konfiExcused:   { id: 101, username: 'konfi-excused',   display_name: 'Konfi Excused' },
  konfiOptedOut:  { id: 102, username: 'konfi-opted-out', display_name: 'Konfi Opted Out' },
  konfiAbwesend:  { id: 103, username: 'konfi-abwesend',  display_name: 'Konfi Abwesend' },
  konfiGeloescht: { id: 104, username: 'konfi-geloescht', display_name: 'Konfi Geloescht' },
};

const ABGESAGT = 5;
const SERIE_KOPF = 6;
const SERIE_ZWEITER = 7;

const nurFelder = (obj, felder) => Object.fromEntries(felder.map(f => [f, obj[f]]));
const reihenfolgeVon = (obj, felder) => Object.keys(obj).filter(k => felder.includes(k));

describe('Terminlisten: Buchungszahlen je Termin, Antwortform unveraendert', () => {
  let db;
  let app;
  let timeslotId;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);

    for (const u of Object.values(EXTRA)) {
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active, deleted_at)
         VALUES ($1, $2, 'x', $3, 1, 1, $4, $5)`,
        [u.id, u.username, u.display_name,
          u.id !== EXTRA.konfiGeloescht.id,
          u.id === EXTRA.konfiGeloescht.id ? new Date() : null]
      );
    }

    const buche = (userId, eventId, status, extra = {}) => db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, attendance_status, timeslot_id, abgemeldet_durch_absage, organization_id)
       VALUES ($1, $2, $3, $4, $5, $6, 1)`,
      [userId, eventId, status, extra.attendance || null, extra.timeslotId || null, extra.durchAbsage || false]
    );

    // Termin 1 (Weihnachtsgottesdienst, 50 Plaetze): jeder Zustand einmal.
    const T1 = EVENTS.gottesdienstEvent.id;
    await buche(USERS.konfi1.id, T1, 'confirmed', { attendance: 'present' });
    await buche(USERS.konfi2.id, T1, 'waitlist');
    await buche(EXTRA.konfiExcused.id, T1, 'excused');
    await buche(EXTRA.konfiOptedOut.id, T1, 'opted_out');
    await buche(EXTRA.konfiAbwesend.id, T1, 'confirmed', { attendance: 'absent' });
    await buche(EXTRA.konfiGeloescht.id, T1, 'confirmed');
    await buche(USERS.teamer1.id, T1, 'confirmed');
    await buche(USERS.admin1.id, T1, 'confirmed', { attendance: 'present' });
    await buche(USERS.orgAdmin1.id, T1, 'waitlist');

    // Termin 2 (Pflichttermin): keine einzige Buchung.

    // Termin 3 (Zeitfenster, ein Fenster mit 10 Plaetzen): eine Konfi im Fenster.
    ({ rows: [{ id: timeslotId }] } = await db.query(
      'SELECT id FROM event_timeslots WHERE event_id = $1', [EVENTS.timeslotEvent.id]
    ));
    await buche(USERS.konfi2.id, EVENTS.timeslotEvent.id, 'confirmed', { timeslotId });

    // Termin 4 (andere Gemeinde): konfi3 gebucht -- darf in Gemeinde 1 nie auftauchen.
    await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id) VALUES ($1, $2, 'confirmed', 2)`,
      [USERS.konfi3.id, EVENTS.event2.id]
    );

    // Termin 5: abgesagt, alle durch die Absage abgemeldet; eine Selbstabmeldung von vorher.
    await db.query(
      `INSERT INTO events (id, name, event_date, organization_id, max_participants, cancelled, cancelled_at, cancelled_by)
       VALUES ($1, 'Abgesagter Ausflug', '2027-02-10T15:00:00+01:00', 1, 20, TRUE, '2027-01-20T09:00:00+01:00', $2)`,
      [ABGESAGT, USERS.admin1.id]
    );
    await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [ABGESAGT, JAHRGAENGE.jahrgang1.id]);
    await buche(USERS.konfi1.id, ABGESAGT, 'excused', { durchAbsage: true });
    await buche(USERS.konfi2.id, ABGESAGT, 'excused', { durchAbsage: true });
    await buche(USERS.teamer1.id, ABGESAGT, 'excused', { durchAbsage: true });
    await buche(EXTRA.konfiOptedOut.id, ABGESAGT, 'opted_out');

    // Termine 6 und 7: eine Serie. Auf dem zweiten: eine Konfi, eine Teamer:in, ein geloeschtes Konto.
    await db.query(
      `INSERT INTO events (id, name, event_date, organization_id, max_participants, is_series, series_id)
       VALUES ($1, 'Serie erster Abend', '2027-03-01T18:00:00+01:00', 1, 15, TRUE, $1),
              ($2, 'Serie zweiter Abend', '2027-03-08T18:00:00+01:00', 1, 15, TRUE, $1)`,
      [SERIE_KOPF, SERIE_ZWEITER]
    );
    await db.query(
      'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $3), ($2, $3)',
      [SERIE_KOPF, SERIE_ZWEITER, JAHRGAENGE.jahrgang1.id]
    );
    await buche(USERS.konfi1.id, SERIE_ZWEITER, 'confirmed');
    await buche(USERS.teamer1.id, SERIE_ZWEITER, 'confirmed');
    await buche(EXTRA.konfiGeloescht.id, SERIE_ZWEITER, 'confirmed');
  });

  afterAll(async () => {
    await closePool();
  });

  // ------------------------------------------------------------------
  // GET /api/events (Leitung, Team)
  // ------------------------------------------------------------------
  describe('GET /api/events', () => {
    const FELDER = [
      'registered_count', 'waitlist_count', 'unprocessed_count', 'teamer_unprocessed_count',
      'total_participants', 'teamer_count', 'teamer_waitlist_count', 'abgemeldet_count',
      'max_participants', 'registration_status', 'teamer_registration_status',
      'is_registered', 'booking_status', 'attendance_status',
      'cancelled_by_name', 'durch_absage_abgemeldet_count',
    ];
    // Reihenfolge der Zaehlfelder in der Antwort (max_participants kommt
    // bereits mit e.* und behaelt dessen Platz, deshalb hier nicht dabei).
    const REIHENFOLGE = FELDER.filter(f => f !== 'max_participants');

    // max_participants kommt in den Listen als ZEICHENKETTE ('50'), nicht als
    // Zahl: Das CASE ueber COALESCE(SUM(Zeitfenster), e.max_participants)
    // ergibt numeric, und numeric liefert der Treiber als String. So ist es
    // heute, so lesen es die Apps -- der Umbau der Zaehlung darf daran nichts
    // aendern. (Nebenbefund, nicht Teil dieses Umbaus.)

    let liste;
    beforeEach(async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);
      liste = res.body;
    });

    it('liefert genau die Termine der eigenen Gemeinde', () => {
      expect(liste.map(e => e.id).sort((a, b) => a - b)).toEqual([1, 2, 3, ABGESAGT, SERIE_KOPF, SERIE_ZWEITER]);
    });

    it('Termin mit allen Buchungszustaenden: jede Zahl, jeder Typ', () => {
      const t = liste.find(e => e.id === EVENTS.gottesdienstEvent.id);
      expect(nurFelder(t, FELDER)).toEqual({
        registered_count: 2,          // konfi1 (anwesend) + konfi-abwesend; nicht: geloeschtes Konto
        waitlist_count: 1,            // konfi2
        unprocessed_count: 0,         // beide bestaetigten Konfis sind verbucht
        teamer_unprocessed_count: 1,  // teamer1 ohne Anwesenheit
        total_participants: 8,        // 6 belegte + 1 selbst abgemeldet + 1 durch Leitung
        teamer_count: 2,              // teamer1 + admin1 (Team-Seite)
        teamer_waitlist_count: 1,     // orgAdmin1
        abgemeldet_count: 2,          // konfi-excused + konfi-opted-out
        max_participants: '50',
        registration_status: 'open',
        teamer_registration_status: 'none',
        is_registered: false,         // orgAdmin1 steht auf der Warteliste
        booking_status: 'waitlist',
        attendance_status: null,
        cancelled_by_name: null,
        durch_absage_abgemeldet_count: 0,
      });
      expect(reihenfolgeVon(t, REIHENFOLGE)).toEqual(REIHENFOLGE);
    });

    it('Termin ohne einzige Buchung: Nullen, kein null', () => {
      const t = liste.find(e => e.id === EVENTS.pflichtEvent.id);
      expect(nurFelder(t, FELDER)).toEqual({
        registered_count: 0,
        waitlist_count: 0,
        unprocessed_count: 0,
        teamer_unprocessed_count: 0,
        total_participants: 0,
        teamer_count: 0,
        teamer_waitlist_count: 0,
        abgemeldet_count: 0,
        max_participants: '0',
        registration_status: 'mandatory',
        teamer_registration_status: 'none',
        is_registered: false,
        booking_status: null,
        attendance_status: null,
        cancelled_by_name: null,
        durch_absage_abgemeldet_count: 0,
      });
    });

    it('Termin mit Zeitfenstern: Kapazitaet aus den Fenstern, eine offene Buchung', () => {
      const t = liste.find(e => e.id === EVENTS.timeslotEvent.id);
      expect(nurFelder(t, FELDER)).toEqual({
        registered_count: 1,
        waitlist_count: 0,
        unprocessed_count: 1,
        teamer_unprocessed_count: 0,
        total_participants: 1,
        teamer_count: 0,
        teamer_waitlist_count: 0,
        abgemeldet_count: 0,
        max_participants: '10',
        registration_status: 'open',
        teamer_registration_status: 'none',
        is_registered: false,
        booking_status: null,
        attendance_status: null,
        cancelled_by_name: null,
        durch_absage_abgemeldet_count: 0,
      });
    });

    it('abgesagter Termin: niemand dabei, aber die Abgemeldeten sind gezaehlt', () => {
      const t = liste.find(e => e.id === ABGESAGT);
      expect(nurFelder(t, FELDER)).toEqual({
        registered_count: 0,
        waitlist_count: 0,
        unprocessed_count: 0,
        teamer_unprocessed_count: 0,
        total_participants: 4,        // 0 belegte + 1 selbst + 2 Konfis + 1 Teamer:in durch die Leitung
        teamer_count: 0,
        teamer_waitlist_count: 0,
        abgemeldet_count: 3,          // 2 excused + 1 opted_out (nur Konfis)
        max_participants: '20',
        registration_status: 'cancelled',
        teamer_registration_status: 'cancelled',
        is_registered: false,
        booking_status: null,
        attendance_status: null,
        cancelled_by_name: 'Test Admin 1',
        durch_absage_abgemeldet_count: 3,
      });
    });

    it('Serientermine: das geloeschte Konto zaehlt nicht', () => {
      const kopf = liste.find(e => e.id === SERIE_KOPF);
      const zweiter = liste.find(e => e.id === SERIE_ZWEITER);
      expect(nurFelder(kopf, ['registered_count', 'teamer_count', 'total_participants'])).toEqual({
        registered_count: 0, teamer_count: 0, total_participants: 0,
      });
      expect(nurFelder(zweiter, ['registered_count', 'teamer_count', 'total_participants', 'unprocessed_count'])).toEqual({
        registered_count: 1, teamer_count: 1, total_participants: 2, unprocessed_count: 1,
      });
    });

    it('die andere Gemeinde sieht nur ihren Termin mit ihren Zahlen', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
      expect(res.status).toBe(200);
      expect(res.body.map(e => e.id)).toEqual([EVENTS.event2.id]);
      expect(nurFelder(res.body[0], ['registered_count', 'waitlist_count', 'teamer_count', 'total_participants', 'abgemeldet_count', 'max_participants', 'registration_status']))
        .toEqual({
          registered_count: 1, waitlist_count: 0, teamer_count: 0, total_participants: 1,
          abgemeldet_count: 0, max_participants: '30', registration_status: 'open',
        });
    });
  });

  // ------------------------------------------------------------------
  // GET /api/events/cancelled
  // ------------------------------------------------------------------
  describe('GET /api/events/cancelled', () => {
    const FELDER = [
      'registered_count', 'waitlist_count', 'unprocessed_count', 'teamer_count',
      'teamer_waitlist_count', 'teamer_unprocessed_count', 'cancelled_by_name',
      'durch_absage_abgemeldet_count', 'registration_status', 'pending_bookings_count',
    ];
    const REIHENFOLGE = [
      'registered_count', 'waitlist_count', 'unprocessed_count', 'teamer_count',
      'teamer_waitlist_count', 'teamer_unprocessed_count', 'cancelled_by_name',
      'durch_absage_abgemeldet_count',
    ];

    it('liefert den abgesagten Termin mit seinen Zahlen', async () => {
      const res = await request(app)
        .get('/api/events/cancelled')
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);
      expect(res.body.map(e => e.id)).toEqual([ABGESAGT]);
      const t = res.body[0];
      expect(nurFelder(t, FELDER)).toEqual({
        registered_count: 0,
        waitlist_count: 0,
        unprocessed_count: 0,
        teamer_count: 0,
        teamer_waitlist_count: 0,
        teamer_unprocessed_count: 0,
        cancelled_by_name: 'Test Admin 1',
        durch_absage_abgemeldet_count: 3,
        registration_status: 'cancelled',
        pending_bookings_count: undefined,
      });
      expect(t).not.toHaveProperty('pending_bookings_count');
      expect(reihenfolgeVon(t, REIHENFOLGE)).toEqual(REIHENFOLGE);
      expect(t.jahrgaenge).toEqual([{ id: JAHRGAENGE.jahrgang1.id, name: JAHRGAENGE.jahrgang1.name }]);
    });

    it('ein abgesagter Termin mit noch bestaetigten Buchungen zaehlt sie (Altbestand vor Migration 153)', async () => {
      // Vor der Sammelabmeldung blieben Buchungen bei einer Absage bestehen;
      // solche Termine liegen noch in der Datenbank. Die Zahlen dazu muessen
      // dieselben bleiben wie bisher.
      await db.query('UPDATE events SET cancelled = TRUE, cancelled_at = NOW() WHERE id = $1', [EVENTS.gottesdienstEvent.id]);
      const res = await request(app)
        .get('/api/events/cancelled')
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);
      const t = res.body.find(e => e.id === EVENTS.gottesdienstEvent.id);
      expect(nurFelder(t, FELDER)).toEqual({
        registered_count: 2,
        waitlist_count: 1,
        unprocessed_count: 0,
        teamer_count: 2,
        teamer_waitlist_count: 1,
        teamer_unprocessed_count: 1,
        cancelled_by_name: null,
        durch_absage_abgemeldet_count: 0,
        registration_status: 'cancelled',
        pending_bookings_count: undefined,
      });
    });

    it('die andere Gemeinde sieht keinen', async () => {
      const res = await request(app)
        .get('/api/events/cancelled')
        .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ------------------------------------------------------------------
  // GET /api/events/:id -- Serienliste
  // ------------------------------------------------------------------
  describe('GET /api/events/:id, series_events', () => {
    it('nennt die uebrigen Serientermine mit Konfi-Zahl, ohne geloeschte Konten', async () => {
      const res = await request(app)
        .get(`/api/events/${SERIE_KOPF}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);
      expect(res.body.series_events).toEqual([{
        id: SERIE_ZWEITER,
        name: 'Serie zweiter Abend',
        event_date: '2027-03-08T17:00:00.000Z',
        // Hier eine Zahl: e.max_participants direkt (bigint), kein CASE.
        max_participants: 15,
        registered_count: 1,
      }]);
      expect(Object.keys(res.body.series_events[0])).toEqual(['id', 'name', 'event_date', 'max_participants', 'registered_count']);
    });

    it('vom zweiten Termin aus: der Kopf ohne Buchung steht mit 0 da, nicht mit null', async () => {
      const res = await request(app)
        .get(`/api/events/${SERIE_ZWEITER}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.status).toBe(200);
      expect(res.body.series_events).toEqual([{
        id: SERIE_KOPF,
        name: 'Serie erster Abend',
        event_date: '2027-03-01T17:00:00.000Z',
        max_participants: 15,
        registered_count: 0,
      }]);
    });
  });

  // ------------------------------------------------------------------
  // GET /api/konfi/events
  // ------------------------------------------------------------------
  describe('GET /api/konfi/events', () => {
    const FELDER = [
      'registered_count', 'waitlist_count', 'teamer_count', 'abgemeldet_count',
      'max_participants', 'chat_room_id', 'registration_status', 'booking_status',
      'attendance_status', 'booked_timeslot_id', 'is_registered', 'is_opted_out',
      'can_register', 'waitlist_position', 'cancelled_by_name', 'categories',
    ];
    const REIHENFOLGE = FELDER.filter(f => f !== 'max_participants');

    let liste;
    beforeEach(async () => {
      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${generateToken('konfi1')}`);
      expect(res.status).toBe(200);
      liste = res.body;
    });

    it('liefert die Termine des eigenen Jahrgangs, den abgesagten nur wegen der eigenen Buchung', () => {
      expect(liste.map(e => e.id).sort((a, b) => a - b)).toEqual([1, 2, 3, ABGESAGT, SERIE_KOPF, SERIE_ZWEITER]);
      for (const t of liste) expect(t).not.toHaveProperty('qr_token');
    });

    it('Termin mit allen Buchungszustaenden aus Konfi-Sicht (konfi1 ist verbucht anwesend)', () => {
      const t = liste.find(e => e.id === EVENTS.gottesdienstEvent.id);
      expect(nurFelder(t, FELDER)).toEqual({
        registered_count: 2,
        waitlist_count: 1,
        teamer_count: 2,
        abgemeldet_count: 2,
        max_participants: '50',
        chat_room_id: null,
        registration_status: 'open',
        booking_status: 'confirmed',
        attendance_status: 'present',
        booked_timeslot_id: null,
        is_registered: true,
        is_opted_out: false,
        can_register: false,
        waitlist_position: null,
        cancelled_by_name: null,
        categories: [],
      });
      expect(reihenfolgeVon(t, REIHENFOLGE)).toEqual(REIHENFOLGE);
    });

    it('Wartelistenplatz: konfi2 steht als Erste auf der Warteliste', async () => {
      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${generateToken('konfi2')}`);
      expect(res.status).toBe(200);
      const t = res.body.find(e => e.id === EVENTS.gottesdienstEvent.id);
      expect(nurFelder(t, ['registered_count', 'waitlist_count', 'booking_status', 'is_registered', 'can_register', 'waitlist_position']))
        .toEqual({
          registered_count: 2, waitlist_count: 1, booking_status: 'waitlist',
          is_registered: false, can_register: false, waitlist_position: 1,
        });
      const fenster = res.body.find(e => e.id === EVENTS.timeslotEvent.id);
      expect(nurFelder(fenster, ['registered_count', 'max_participants', 'booking_status', 'booked_timeslot_id', 'is_registered']))
        .toEqual({ registered_count: 1, max_participants: '10', booking_status: 'confirmed', booked_timeslot_id: timeslotId, is_registered: true });
    });

    it('Pflichttermin ohne Buchung: Nullen, anmeldbar', () => {
      const t = liste.find(e => e.id === EVENTS.pflichtEvent.id);
      expect(nurFelder(t, FELDER)).toEqual({
        registered_count: 0,
        waitlist_count: 0,
        teamer_count: 0,
        abgemeldet_count: 0,
        max_participants: '0',
        chat_room_id: null,
        registration_status: 'mandatory',
        booking_status: null,
        attendance_status: null,
        booked_timeslot_id: null,
        is_registered: false,
        is_opted_out: false,
        can_register: true,
        waitlist_position: null,
        cancelled_by_name: null,
        categories: [],
      });
    });

    it('Zeitfenster-Termin aus Sicht einer Konfi ohne Buchung', () => {
      const t = liste.find(e => e.id === EVENTS.timeslotEvent.id);
      expect(nurFelder(t, ['registered_count', 'waitlist_count', 'teamer_count', 'abgemeldet_count', 'max_participants', 'registration_status', 'booking_status', 'can_register']))
        .toEqual({
          registered_count: 1, waitlist_count: 0, teamer_count: 0, abgemeldet_count: 0,
          max_participants: '10', registration_status: 'open', booking_status: null, can_register: true,
        });
    });

    it('abgesagter Termin: eigene Abmeldung sichtbar, Abgemeldete gezaehlt', () => {
      const t = liste.find(e => e.id === ABGESAGT);
      expect(nurFelder(t, FELDER)).toEqual({
        registered_count: 0,
        waitlist_count: 0,
        teamer_count: 0,
        abgemeldet_count: 3,
        max_participants: '20',
        chat_room_id: null,
        registration_status: 'cancelled',
        booking_status: 'excused',
        attendance_status: null,
        booked_timeslot_id: null,
        is_registered: false,
        is_opted_out: false,
        can_register: false,
        waitlist_position: null,
        cancelled_by_name: 'Test Admin 1',
        categories: [],
      });
    });

    it('Serientermine: Kopf ohne Buchung mit 0, zweiter mit der eigenen Buchung', () => {
      const kopf = liste.find(e => e.id === SERIE_KOPF);
      const zweiter = liste.find(e => e.id === SERIE_ZWEITER);
      expect(nurFelder(kopf, ['registered_count', 'teamer_count', 'abgemeldet_count', 'is_registered', 'can_register']))
        .toEqual({ registered_count: 0, teamer_count: 0, abgemeldet_count: 0, is_registered: false, can_register: true });
      expect(nurFelder(zweiter, ['registered_count', 'teamer_count', 'abgemeldet_count', 'is_registered', 'can_register']))
        .toEqual({ registered_count: 1, teamer_count: 1, abgemeldet_count: 0, is_registered: true, can_register: false });
    });

    it('Konfi der anderen Gemeinde sieht nur ihren Termin', async () => {
      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${generateToken('konfi3')}`);
      expect(res.status).toBe(200);
      expect(res.body.map(e => e.id)).toEqual([EVENTS.event2.id]);
      expect(nurFelder(res.body[0], ['registered_count', 'waitlist_count', 'teamer_count', 'abgemeldet_count', 'max_participants', 'is_registered', 'booking_status']))
        .toEqual({ registered_count: 1, waitlist_count: 0, teamer_count: 0, abgemeldet_count: 0, max_participants: '30', is_registered: true, booking_status: 'confirmed' });
    });
  });

  // ------------------------------------------------------------------
  // Die Listen stimmen mit der Sicht ueberein -- fuer jeden Termin.
  // ------------------------------------------------------------------
  describe('jede Zahl der Listen entspricht event_booking_stats', () => {
    const sicht = async (eventId) => {
      const { rows: [s] } = await db.query('SELECT * FROM event_booking_stats WHERE event_id = $1', [eventId]);
      // Ein Termin ohne Buchung hat in der Sicht keine Zeile -- die Listen
      // liefern dann 0.
      return s || {
        konfi_confirmed: 0, konfi_waitlist: 0, konfi_opted_out: 0, konfi_offen: 0,
        teamer_confirmed: 0, teamer_waitlist: 0, teamer_opted_out: 0, teamer_offen: 0,
        gebucht_gesamt: 0, konfi_excused: 0, teamer_excused: 0,
      };
    };

    it('GET /api/events', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(res.body).toHaveLength(6);
      for (const t of res.body) {
        const s = await sicht(t.id);
        expect({ id: t.id, ...nurFelder(t, ['registered_count', 'waitlist_count', 'unprocessed_count', 'teamer_unprocessed_count', 'teamer_count', 'teamer_waitlist_count', 'total_participants', 'abgemeldet_count']) })
          .toEqual({
            id: t.id,
            registered_count: s.konfi_confirmed,
            waitlist_count: s.konfi_waitlist,
            unprocessed_count: s.konfi_offen,
            teamer_unprocessed_count: s.teamer_offen,
            teamer_count: s.teamer_confirmed,
            teamer_waitlist_count: s.teamer_waitlist,
            total_participants: s.gebucht_gesamt + s.konfi_opted_out + s.teamer_opted_out + s.konfi_excused + s.teamer_excused,
            abgemeldet_count: s.konfi_opted_out + s.konfi_excused,
          });
      }
    });

    it('GET /api/konfi/events', async () => {
      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${generateToken('konfi1')}`);
      expect(res.body).toHaveLength(6);
      for (const t of res.body) {
        const s = await sicht(t.id);
        expect({ id: t.id, ...nurFelder(t, ['registered_count', 'waitlist_count', 'teamer_count', 'abgemeldet_count']) })
          .toEqual({
            id: t.id,
            registered_count: s.konfi_confirmed,
            waitlist_count: s.konfi_waitlist,
            teamer_count: s.teamer_confirmed,
            abgemeldet_count: s.konfi_opted_out + s.konfi_excused,
          });
      }
    });
  });
});
