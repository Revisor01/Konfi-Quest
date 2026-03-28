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
});
