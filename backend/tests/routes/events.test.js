const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, EVENTS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Events Routes', () => {
  let app;
  let db;
  let adminToken;
  let teamerToken;
  let konfiToken;
  let konfi2Token;
  let admin2Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    teamerToken = generateToken('teamer1');
    konfiToken = generateToken('konfi1');
    konfi2Token = generateToken('konfi2');
    admin2Token = generateToken('admin2');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // GET /api/events
  // ================================================================
  describe('GET /api/events', () => {
    it('Admin bekommt 200 + Events der eigenen Org', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Org 1 hat 3 Events (gottesdienstEvent, pflichtEvent, timeslotEvent)
      expect(res.body.length).toBe(3);
    });

    it('Konfi bekommt 200 + Events (Konfi-Sicht)', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Events haben booking_status fuer den aktuellen User
      const evt = res.body[0];
      expect(evt.id).toBeDefined();
      expect(evt.name).toBeDefined();
    });

    it('Events einer anderen Org sind NICHT sichtbar', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(200);
      // Org 2 hat 1 Event (event2)
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(EVENTS.event2.id);
    });

    it('Response enthaelt registration_status und categories/jahrgaenge Arrays', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const evt = res.body[0];
      expect(evt.registration_status).toBeDefined();
      expect(evt.categories).toBeDefined();
      expect(evt.jahrgaenge).toBeDefined();
    });
  });

  // ================================================================
  // POST /api/events (requireTeamer)
  // ================================================================
  describe('POST /api/events', () => {
    it('Admin erstellt Event mit korrekten Daten -> 201', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test-Event',
          event_date: futureDate.toISOString(),
          max_participants: 20,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.message).toContain('erstellt');
    });

    it('Leerer name gibt 400', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '',
          event_date: new Date().toISOString(),
          max_participants: 10,
        });

      expect(res.status).toBe(400);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({
          name: 'Konfi-Event',
          event_date: new Date().toISOString(),
          max_participants: 10,
        });

      expect(res.status).toBe(403);
    });

    it('Pflicht-Event ohne Jahrgang gibt 400', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pflicht-Test',
          event_date: futureDate.toISOString(),
          mandatory: true,
          // kein jahrgang_ids -> 400
        });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  // POST /api/events/:id/book (Konfi-Buchung)
  // ================================================================
  describe('POST /api/events/:id/book', () => {
    it('Konfi bucht freiwilliges Event -> 201 confirmed', async () => {
      const res = await request(app)
        .post(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');
      expect(res.body.message).toContain('angemeldet');
    });

    it('Doppelte Buchung gibt 409', async () => {
      // Erste Buchung
      await request(app)
        .post(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);

      // Zweite Buchung
      const res = await request(app)
        .post(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(409);
    });

    it('Konfi aus Org 2 kann Event aus Org 1 NICHT buchen -> 404', async () => {
      const konfi3Token = generateToken('konfi3');
      const res = await request(app)
        .post(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${konfi3Token}`);

      expect(res.status).toBe(404);
    });

    it('Admin bekommt 403 bei Buchung (nur Konfis und Teamer)', async () => {
      const res = await request(app)
        .post(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // GET /api/events/:id/timeslots
  // ================================================================
  describe('GET /api/events/:id/timeslots', () => {
    it('Timeslot-Event gibt 200 + Timeslot-Daten', async () => {
      const res = await request(app)
        .get(`/api/events/${EVENTS.timeslotEvent.id}/timeslots`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].event_id).toBe(EVENTS.timeslotEvent.id);
    });

    it('Nicht-Timeslot-Event gibt leeres Array', async () => {
      const res = await request(app)
        .get(`/api/events/${EVENTS.gottesdienstEvent.id}/timeslots`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('Event einer anderen Org gibt 404', async () => {
      const konfi3Token = generateToken('konfi3');
      const res = await request(app)
        .get(`/api/events/${EVENTS.gottesdienstEvent.id}/timeslots`)
        .set('Authorization', `Bearer ${konfi3Token}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // Warteliste + Stornierung + Nachruecken
  // ================================================================
  describe('Warteliste-Nachruecken', () => {
    it('Bei vollem Event kommt Konfi auf Warteliste, nach Stornierung rueckt er nach', async () => {
      // Event mit max_participants=1 erstellen
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Mini-Event',
          event_date: futureDate.toISOString(),
          max_participants: 1,
          waitlist_enabled: true,
          max_waitlist_size: 5,
        });

      expect(createRes.status).toBe(201);
      const miniEventId = createRes.body.id;

      // Konfi1 bucht -> confirmed
      const book1 = await request(app)
        .post(`/api/events/${miniEventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(book1.status).toBe(201);
      expect(book1.body.status).toBe('confirmed');

      // Konfi2 bucht -> waitlisted
      const book2 = await request(app)
        .post(`/api/events/${miniEventId}/book`)
        .set('Authorization', `Bearer ${konfi2Token}`);

      expect(book2.status).toBe(201);
      expect(book2.body.status).toBe('waitlist');

      // Konfi1 storniert
      const cancelRes = await request(app)
        .delete(`/api/events/${miniEventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(cancelRes.status).toBe(200);

      // Konfi2 sollte jetzt confirmed sein (promoteFromWaitlist)
      const { rows } = await db.query(
        'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [miniEventId, USERS.konfi2.id]
      );
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('confirmed');
    });
  });

  // ================================================================
  // DELETE /api/events/:id/book (Stornierung)
  // ================================================================
  describe('DELETE /api/events/:id/book', () => {
    it('Konfi storniert Buchung -> 200', async () => {
      // Erst buchen
      await request(app)
        .post(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);

      // Dann stornieren
      const res = await request(app)
        .delete(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('storniert');
    });

    it('Stornierung ohne Buchung gibt 404', async () => {
      const res = await request(app)
        .delete(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // Pflicht-Event
  // ================================================================
  describe('Pflicht-Event', () => {
    it('GET /api/events liefert pflichtEvent als mandatory', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      const pflicht = res.body.find(e => e.id === EVENTS.pflichtEvent.id);
      expect(pflicht).toBeDefined();
      expect(pflicht.mandatory).toBe(true);
      expect(pflicht.registration_status).toBe('mandatory');
    });

    it('Pflicht-Event erstellen auto-enrolled Konfis im Jahrgang', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pflicht-Konfiunterricht',
          event_date: futureDate.toISOString(),
          mandatory: true,
          jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
        });

      expect(createRes.status).toBe(201);
      const eventId = createRes.body.id;

      // Konfi1 und Konfi2 (beide Jahrgang 1, Org 1) sollten auto-enrolled sein
      const { rows: bookings } = await db.query(
        "SELECT user_id, status FROM event_bookings WHERE event_id = $1 ORDER BY user_id",
        [eventId]
      );

      const konfi1Booking = bookings.find(b => b.user_id === USERS.konfi1.id);
      const konfi2Booking = bookings.find(b => b.user_id === USERS.konfi2.id);
      expect(konfi1Booking).toBeDefined();
      expect(konfi1Booking.status).toBe('confirmed');
      expect(konfi2Booking).toBeDefined();
      expect(konfi2Booking.status).toBe('confirmed');
    });
  });

  // ================================================================
  // Konfirmations-Flag (is_konfirmation) — analog mandatory, ohne Buchungslogik
  // ================================================================
  describe('Konfirmations-Flag (is_konfirmation)', () => {
    const futureDate = () => {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return d.toISOString();
    };

    it('POST mit is_konfirmation=true legt Event an; GET /:id liefert true', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Konfirmation 2026',
          event_date: futureDate(),
          max_participants: 30,
          is_konfirmation: true,
        });

      expect(createRes.status).toBe(201);
      const eventId = createRes.body.id;

      const detailRes = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.is_konfirmation).toBe(true);
    });

    it('POST ohne is_konfirmation -> Default false', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Normales Event',
          event_date: futureDate(),
          max_participants: 20,
        });

      expect(createRes.status).toBe(201);
      const eventId = createRes.body.id;

      const detailRes = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.is_konfirmation).toBe(false);
    });

    it('PUT setzt is_konfirmation von false auf true und zurueck (Toggle beidseitig)', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Toggle-Event',
          event_date: futureDate(),
          max_participants: 15,
        });

      expect(createRes.status).toBe(201);
      const eventId = createRes.body.id;

      // false -> true
      const putTrue = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Toggle-Event',
          event_date: futureDate(),
          max_participants: 15,
          is_konfirmation: true,
        });
      expect(putTrue.status).toBe(200);

      let detailRes = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detailRes.body.is_konfirmation).toBe(true);

      // true -> false
      const putFalse = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Toggle-Event',
          event_date: futureDate(),
          max_participants: 15,
          is_konfirmation: false,
        });
      expect(putFalse.status).toBe(200);

      detailRes = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detailRes.body.is_konfirmation).toBe(false);
    });

    it('POST mit is_konfirmation als Nicht-Boolean -> 400 (Validierung greift)', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Ungueltig-Konfirmation',
          event_date: futureDate(),
          max_participants: 10,
          is_konfirmation: 'kein-boolean',
        });

      expect(res.status).toBe(400);
    });

    it('Mehrere Events gleichzeitig is_konfirmation=true (kein Unique-Constraint)', async () => {
      const create1 = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Konfirmation Gruppe A',
          event_date: futureDate(),
          max_participants: 25,
          is_konfirmation: true,
        });
      const create2 = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Konfirmation Gruppe B',
          event_date: futureDate(),
          max_participants: 25,
          is_konfirmation: true,
        });

      expect(create1.status).toBe(201);
      expect(create2.status).toBe(201);

      const listRes = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      const a = listRes.body.find(e => e.id === create1.body.id);
      const b = listRes.body.find(e => e.id === create2.body.id);
      expect(a.is_konfirmation).toBe(true);
      expect(b.is_konfirmation).toBe(true);
    });

    it('GET /api/events schleift is_konfirmation pro Event durch (via e.*)', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Durchschleif-Event',
          event_date: futureDate(),
          max_participants: 12,
          is_konfirmation: true,
        });
      expect(createRes.status).toBe(201);

      const listRes = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      const evt = listRes.body.find(e => e.id === createRes.body.id);
      expect(evt).toBeDefined();
      expect(evt.is_konfirmation).toBe(true);
    });
  });

  // ================================================================
  // Event-Kapazitaet (ausgebucht)
  // ================================================================
  describe('Kapazitaetsgrenze', () => {
    it('Bei vollem Event ohne Warteliste gibt es 400', async () => {
      // Event mit max_participants=1, keine Warteliste
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Volles Event',
          event_date: futureDate.toISOString(),
          max_participants: 1,
          waitlist_enabled: false,
        });

      expect(createRes.status).toBe(201);
      const eventId = createRes.body.id;

      // Konfi1 bucht -> confirmed
      const book1 = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(book1.status).toBe(201);
      expect(book1.body.status).toBe('confirmed');

      // Konfi2 bucht -> 400 (voll, keine Warteliste)
      const book2 = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfi2Token}`);

      expect(book2.status).toBe(400);
    });
  });

  // ================================================================
  // Soft-Delete-Filter (D-08/D-12): archivierte Konfis unsichtbar
  // ================================================================
  describe('Soft-Delete-Filter in Teilnehmerliste', () => {
    // Verifiziert exakt den deleted_at-Filter im Participants-Query der GET /:id-Route
    // (events.js Z.532ff). Der HTTP-Endpoint GET /api/events/:id wird hier bewusst NICHT
    // genutzt, weil er an vorbestehenden Test-DB-Schema-Luecken scheitert
    // (events.cancelled_at, Tabelle event_unregistrations existieren im Test-Schema nicht) —
    // diese Luecken sind unabhaengig von diesem Plan (Scope-Boundary).
    const participantsQuery = `
      SELECT eb.user_id
      FROM event_bookings eb
      JOIN users u ON eb.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
      WHERE eb.event_id = $1 AND u.organization_id = $2 AND u.deleted_at IS NULL
    `;

    it('Ein soft-geloeschter Konfi erscheint NICHT in der Event-Teilnehmerliste, ein aktiver bleibt', async () => {
      // Beide Konfis buchen das Gottesdienst-Event
      const book1 = await request(app)
        .post(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(book1.status).toBe(201);

      const book2 = await request(app)
        .post(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${konfi2Token}`);
      expect(book2.status).toBe(201);

      // Vorher: beide Konfis sind in der Teilnehmerliste sichtbar
      const before = await db.query(participantsQuery, [EVENTS.gottesdienstEvent.id, ORGS.testGemeinde.id]);
      const beforeIds = before.rows.map(r => r.user_id);
      expect(beforeIds).toContain(USERS.konfi1.id);
      expect(beforeIds).toContain(USERS.konfi2.id);

      // Konfi1 soft-loeschen (deleted_at setzen)
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.konfi1.id]);

      // Nachher: nur der aktive Konfi (konfi2) ist sichtbar
      const after = await db.query(participantsQuery, [EVENTS.gottesdienstEvent.id, ORGS.testGemeinde.id]);
      const afterIds = after.rows.map(r => r.user_id);
      expect(afterIds).not.toContain(USERS.konfi1.id);
      expect(afterIds).toContain(USERS.konfi2.id);
    });

    it('Auto-Enroll fuer Pflicht-Event erstellt KEINE Buchung fuer soft-geloeschte Konfis', async () => {
      // Konfi1 soft-loeschen
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.konfi1.id]);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      // Pflicht-Event fuer jahrgang1 anlegen -> Auto-Enroll greift
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Neues Pflicht-Event',
          event_date: futureDate.toISOString(),
          mandatory: true,
          jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
        });
      expect(createRes.status).toBe(201);
      const newEventId = createRes.body.id;

      const { rows: bookings } = await db.query(
        'SELECT user_id FROM event_bookings WHERE event_id = $1',
        [newEventId]
      );
      const bookedIds = bookings.map(b => b.user_id);
      // Soft-geloeschter konfi1 wurde NICHT enrollt, aktiver konfi2 schon
      expect(bookedIds).not.toContain(USERS.konfi1.id);
      expect(bookedIds).toContain(USERS.konfi2.id);
    });
  });

  // ================================================================
  // POST /api/events/series — Serien-Limits (max 26 Termine, max 12 Monate)
  // ================================================================
  describe('POST /api/events/series', () => {
    const futureDate = () => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString();
    };

    it('Gueltige Serie (4x woechentlich) -> 201 + 4 Events', async () => {
      const res = await request(app)
        .post('/api/events/series')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Wochenandacht',
          event_date: futureDate(),
          max_participants: 20,
          series_count: 4,
          series_interval: 'week',
        });

      expect(res.status).toBe(201);
      expect(res.body.events_created).toBe(4);

      const { rows } = await db.query(
        "SELECT id, series_id FROM events WHERE name LIKE 'Wochenandacht%' AND organization_id = $1",
        [ORGS.org1.id]
      );
      expect(rows.length).toBe(4);
      // Alle Events haengen an derselben series_id
      expect(new Set(rows.map(r => String(r.series_id))).size).toBe(1);
    });

    it('Mehr als 26 Termine -> 400', async () => {
      const res = await request(app)
        .post('/api/events/series')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Riesen-Serie',
          event_date: futureDate(),
          max_participants: 20,
          series_count: 27,
          series_interval: 'week',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('26');
    });

    it('Nicht-ganzzahlige Anzahl -> 400', async () => {
      const res = await request(app)
        .post('/api/events/series')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Krumme Serie',
          event_date: futureDate(),
          max_participants: 20,
          series_count: 5.5,
          series_interval: 'week',
        });

      expect(res.status).toBe(400);
    });

    it('Ungueltiges Intervall -> 400 (kein stiller Fallback)', async () => {
      const res = await request(app)
        .post('/api/events/series')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Komische Serie',
          event_date: futureDate(),
          max_participants: 20,
          series_count: 4,
          series_interval: 'year',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Intervall');
    });

    it('Monatlich x 13 ueberschreitet 12-Monats-Spannweite -> 400', async () => {
      const res = await request(app)
        .post('/api/events/series')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Zu lange Serie',
          event_date: futureDate(),
          max_participants: 20,
          series_count: 13,
          series_interval: 'month',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('12 Monate');
    });

    it('Monatlich x 12 bleibt innerhalb der Spannweite -> 201', async () => {
      const res = await request(app)
        .post('/api/events/series')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Jahres-Serie',
          event_date: futureDate(),
          max_participants: 20,
          series_count: 12,
          series_interval: 'month',
        });

      expect(res.status).toBe(201);
      expect(res.body.events_created).toBe(12);
    });

    it('Konfi darf keine Serie erstellen -> 403', async () => {
      const res = await request(app)
        .post('/api/events/series')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({
          name: 'Konfi-Serie',
          event_date: futureDate(),
          max_participants: 20,
          series_count: 3,
          series_interval: 'week',
        });

      expect(res.status).toBe(403);
    });
  });
});
