// ZAEHLER AN EINEM TERMIN OHNE JEDE BUCHUNG -- LEITUNGSANSICHT (16.09.2026)
//
// GEGEN PRODUKTION GEMESSEN, nicht vermutet: Nach dem Deploy der Korrektur in
// routes/konfi.js lieferte GET /api/events fuer einen frisch angelegten Termin
// in Org 4 weiterhin
//
//   registered_count = null, abgemeldet_count = null
//
// Die Korrektur vom selben Tag hatte nur die KONFI-Route erfasst, weil der
// Befund ("Anmelden (null/4)") von dort kam. routes/events/lesen.js traegt
// denselben Fehler an ZWEI Abfragen: GET /events (die Terminliste der
// Leitung) und GET /events/:id (die Detailansicht).
//
// DIE FALLE, wortgleich zur Konfi-Route: Das COALESCE steht INNERHALB der
// LATERAL-Unterabfrage. Es schuetzt vor einer NULL-SPALTE, nicht vor einer
// FEHLENDEN ZEILE. event_booking_stats entsteht mit GROUP BY ueber
// event_bookings -- ein Termin ohne jede Buchung hat dort keine Zeile, die
// Unterabfrage liefert nichts, und `ON true` fuellt alle Spalten mit NULL auf.
//
// SCHLIMMER ALS EINE FALSCHE ANZEIGE: Die Werte gehen zusaetzlich in
// SQL-VERGLEICHE ein (`bstats.teamer_count >= e.teamer_max_participants`).
// NULL >= 4 ist in SQL nicht false, sondern NULL -- der Zweig faellt damit
// still weg. Deshalb prueft dieser Test auch registration_status.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Leitungsansicht: Zaehler an einem Termin ohne Buchungen', () => {
  let app;
  let db;
  let adminToken;

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
    adminToken = generateToken('orgAdmin1');
  });

  /** Termin in 21 Tagen, an dem sich niemand anmeldet. */
  async function leererTermin(felder = {}) {
    const spaeter = new Date();
    spaeter.setDate(spaeter.getDate() + 21);
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Termin ohne Anmeldungen',
        event_date: spaeter.toISOString(),
        max_participants: 4,
        points: 0,
        waitlist_enabled: false,
        jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
        ...felder,
      });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  async function ausListe(eventId) {
    const res = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const treffer = res.body.find((e) => e.id === eventId);
    expect(treffer).toBeTruthy();
    return treffer;
  }

  // ----------------------------------------------------------------
  // Vorbedingung: Ohne sie pruefen die Tests unten am Fall vorbei.
  // ----------------------------------------------------------------
  it('die Sicht event_booking_stats hat fuer diesen Termin WIRKLICH keine Zeile', async () => {
    const eventId = await leererTermin();
    const { rows } = await db.query(
      'SELECT * FROM event_booking_stats WHERE event_id = $1',
      [eventId]
    );
    expect(rows.length).toBe(0);
  });

  // ----------------------------------------------------------------
  // GET /events -- die Terminliste der Leitung
  // ----------------------------------------------------------------
  describe('GET /events', () => {
    it('liefert 0 statt null fuer alle acht Zaehler', async () => {
      const eventId = await leererTermin();
      const e = await ausListe(eventId);

      expect(e.registered_count).toBe(0);
      expect(e.waitlist_count).toBe(0);
      expect(e.unprocessed_count).toBe(0);
      expect(e.teamer_unprocessed_count).toBe(0);
      expect(e.total_participants).toBe(0);
      expect(e.teamer_count).toBe(0);
      expect(e.teamer_waitlist_count).toBe(0);
      expect(e.abgemeldet_count).toBe(0);
    });

    it('der Anmeldestatus steht auf offen, nicht auf null', async () => {
      // NULL >= 4 ist in SQL NULL, nicht false -- ein CASE-Zweig, der auf
      // solch einem Vergleich steht, faellt still weg.
      const eventId = await leererTermin();
      const e = await ausListe(eventId);

      expect(e.registration_status).toBe('open');
    });

    it('auch bei einem Team-Termin ohne jede Zusage', async () => {
      const eventId = await leererTermin({
        teamer_needed: true,
        teamer_max_participants: 3,
      });
      const e = await ausListe(eventId);

      expect(e.teamer_count).toBe(0);
      expect(e.teamer_waitlist_count).toBe(0);
      expect(e.teamer_registration_status).toBe('open');
    });
  });

  // ----------------------------------------------------------------
  // GET /events/:id -- die Detailansicht
  // ----------------------------------------------------------------
  describe('GET /events/:id', () => {
    // KEINE ZAEHLER-FELDER IN DER ANTWORT, und das ist Absicht: Die
    // Detailansicht liefert die Teilnehmerliste mit und laesst die Oberflaeche
    // daraus rechnen. bstats dient hier nur den abgeleiteten Status-Werten.
    // Ein Feld hinzuzufuegen waere eine Aenderung ohne Anlass -- geprueft wird
    // deshalb das, was die Route wirklich aussagt.
    it('der Anmeldestatus steht auf offen, nicht auf null', async () => {
      // Hier schlaegt der NULL-Vergleich zu: In SQL ist NULL >= 4 nicht
      // false, sondern NULL. Ein CASE-Zweig auf solch einem Vergleich faellt
      // still weg -- die Zahl selbst wird nie ausgegeben, der Status schon.
      const eventId = await leererTermin();
      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      expect(res.body.registration_status).toBe('open');
    });

    it('auch das Teamer-Kontingent steht auf offen', async () => {
      const eventId = await leererTermin({
        teamer_needed: true,
        teamer_max_participants: 3,
      });
      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      expect(res.body.teamer_registration_status).toBe('open');
    });

    it('die Teilnehmerliste ist leer, nicht null', async () => {
      // Das ist die Zahl, aus der die Oberflaeche hier rechnet.
      const eventId = await leererTermin();
      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(Array.isArray(res.body.participants)).toBe(true);
      expect(res.body.participants.length).toBe(0);
    });
  });

  // ----------------------------------------------------------------
  // Gegenprobe: Mit echten Buchungen muessen die Zahlen weiter stimmen --
  // sonst waere der Test auch gruen, wenn ueberall pauschal 0 herauskaeme.
  // ----------------------------------------------------------------
  describe('Gegenprobe mit echten Buchungen', () => {
    it('zaehlt angemeldete Konfis richtig', async () => {
      const eventId = await leererTermin();
      const res = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${generateToken('konfi1')}`)
        .send({});
      expect(res.status).toBe(201);

      const e = await ausListe(eventId);
      expect(e.registered_count).toBe(1);
      expect(e.abgemeldet_count).toBe(0);
    });

    it('zaehlt Abgemeldete richtig', async () => {
      const eventId = await leererTermin();
      await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${generateToken('konfi1')}`)
        .send({})
        .expect(201);
      const { rows: [b] } = await db.query(
        'SELECT id FROM event_bookings WHERE event_id = $1',
        [eventId]
      );
      await request(app)
        .put(`/api/events/${eventId}/participants/${b.id}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'krank' })
        .expect(200);

      const e = await ausListe(eventId);
      expect(e.registered_count).toBe(0);
      expect(e.abgemeldet_count).toBe(1);
    });
  });
});
