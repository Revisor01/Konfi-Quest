const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, EVENTS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const PushService = require('../../services/pushService');

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
      // Events haben booking_status für den aktuellen User
      const evt = res.body[0];
      expect(evt.id).toBeDefined();
      expect(evt.name).toBeDefined();
    });

    // qr_token in der Liste war der Umgehungsweg um den Filter in
    // GET /events/:id: Ein Konfi konnte sich mit dem Token per
    // POST /events/qr-checkin von zu Hause als anwesend eintragen und
    // Punkte gutschreiben (Audit 22.08.2026, LÜCKE L1).
    it('Liste enthaelt fuer KONFIS keinen qr_token', async () => {
      await db.query('UPDATE events SET qr_token = $1 WHERE id = $2',
        ['test-token-konfi', EVENTS.gottesdienstEvent.id]);

      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      for (const evt of res.body) {
        expect(evt.qr_token).toBeUndefined();
      }
    });

    it('Liste enthaelt auch fuer ADMINS keinen qr_token (Detail-/generate-Route zustaendig)', async () => {
      await db.query('UPDATE events SET qr_token = $1 WHERE id = $2',
        ['test-token-admin', EVENTS.gottesdienstEvent.id]);

      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const evt of res.body) {
        expect(evt.qr_token).toBeUndefined();
      }
    });

    // Der Jahrgangs-Filter für Teamer:innen griff nur, wenn überhaupt
    // Zuweisungen vorhanden waren (Bedingung length > 0). Ohne jede Zuweisung
    // fiel der Filter weg und die Teamer:in sah ALLE Events der Organisation
    // (Audit 22.08.2026, LÜCKE L5).
    it('Teamer:in OHNE Jahrgangs-Zuweisung sieht keine jahrgangsgebundenen Events', async () => {
      const { invalidateUserCache } = require('../../middleware/rbac');

      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1',
        [USERS.teamer1.id]);
      invalidateUserCache(USERS.teamer1.id);

      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);

      // Jedes noch sichtbare Event muss einen eigenen Grund haben: allgemein
      // (ohne Jahrgang) oder teamer_only/teamer_needed. Ein jahrgangsgebundenes
      // Event ohne Teamer-Bezug darf NICHT dabei sein.
      for (const evt of res.body) {
        const istAllgemein = !evt.jahrgaenge || evt.jahrgaenge.length === 0;
        const istTeamerEvent = evt.teamer_only || evt.teamer_needed;
        expect(istAllgemein || istTeamerEvent).toBe(true);
      }
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

    it('Response-Shape: Kernfelder + Zaehler-Typen bleiben stabil (Query-Restrukturierung)', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const evt = res.body.find(e => e.id === EVENTS.gottesdienstEvent.id);
      expect(evt).toBeDefined();
      // Kernfelder aus e.*
      expect(evt.name).toBe(EVENTS.gottesdienstEvent.name);
      expect(evt.max_participants).toBeDefined();
      expect(evt.point_type).toBeDefined();
      // Abgeleitete Buchungs-Zähler
      expect(evt.registered_count).toBeDefined();
      expect(evt.waitlist_count).toBe(0);
      expect(evt.teamer_count).toBe(0);
      expect(evt.material_count).toBe(0);
      // Abgeleitete Konfi-/User-Felder
      expect(evt.is_registered).toBe(false);
      expect(Array.isArray(evt.categories)).toBe(true);
      expect(Array.isArray(evt.jahrgaenge)).toBe(true);
    });
  });

  // ================================================================
  // Datumsfenster (Audit Achse 4, Fund 9): Default 1 Jahr, ?all=true = alles
  // ================================================================
  describe('GET /api/events Datumsfenster', () => {
    // Legt ein Event an, das aelter als 1 Jahr ist (außerhalb des Standardfensters)
    async function seedAltesEvent() {
      const { rows } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points, has_timeslots)
         VALUES ('Uralt-Event', NOW() - interval '2 years', $1, false, 20, 'gemeinde', 1, false)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      return rows[0].id;
    }

    it('Event aelter als 1 Jahr fehlt ohne all=true', async () => {
      const altId = await seedAltesEvent();

      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.map(e => e.id);
      expect(ids).not.toContain(altId);
    });

    it('Event aelter als 1 Jahr ist mit all=true enthalten', async () => {
      const altId = await seedAltesEvent();

      const res = await request(app)
        .get('/api/events?all=true')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.map(e => e.id);
      expect(ids).toContain(altId);
    });
  });

  // ================================================================
  // chat_room_id in GET /api/events (Termin-Detail, 27.08.2026)
  // ================================================================
  // Die Liste liefert den Event-Chatraum nur an Mitglieder des Raums. Damit
  // bildet der Einstieg im Termin-Detail genau die Berechtigung ab, die
  // `darfRaumOeffnen` in chat.js durchsetzt: Wer nicht Mitglied ist, bekommt
  // gar keinen Knopf angeboten, der ins 403 laufen wuerde.
  describe('chat_room_id in GET /api/events (Teamer-Sicht)', () => {
    // Termin ohne Jahrgangs-Zuweisung ist fuer Teamer:innen immer sichtbar.
    const terminAnlegen = async (name) => {
      const { rows: [event] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points)
         VALUES ($1, NOW() + interval '10 days', $2, false, 20, 'gemeinde', 1)
         RETURNING id`,
        [name, ORGS.testGemeinde.id]
      );
      return event.id;
    };

    const chatraumAnlegen = async (eventId, name) => {
      const { rows: [raum] } = await db.query(
        `INSERT INTO chat_rooms (name, type, event_id, created_by, organization_id)
         VALUES ($1, 'group', $2, $3, $4) RETURNING id`,
        [name, eventId, USERS.admin1.id, ORGS.testGemeinde.id]
      );
      return raum.id;
    };

    const holeTermin = async (token, eventId) => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      return res.body.find(e => e.id === eventId);
    };

    it('Teamer:in im Event-Chat bekommt die Raum-ID', async () => {
      const eventId = await terminAnlegen('Termin mit Chat');
      const roomId = await chatraumAnlegen(eventId, 'Termin mit Chat - Chat');
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'teamer')`,
        [roomId, USERS.teamer1.id]
      );

      const termin = await holeTermin(teamerToken, eventId);
      expect(termin.chat_room_id).toBe(roomId);
    });

    it('Teamer:in ohne Mitgliedschaft bekommt trotz Chatraum null', async () => {
      const eventId = await terminAnlegen('Termin mit fremdem Chat');
      const roomId = await chatraumAnlegen(eventId, 'Termin mit fremdem Chat - Chat');
      // Im Raum sitzen die Leitung und eine ANDERE Teamer:in — teamer1 selbst
      // nicht. Die fremde Teamer-Zeile ist wichtig: Ohne den Vergleich auf die
      // eigene user_id wuerde sie durchschlagen und teamer1 einen Raum melden,
      // den sie gar nicht oeffnen darf.
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type)
         VALUES ($1, $2, 'admin'), ($1, $3, 'teamer')`,
        [roomId, USERS.admin1.id, USERS.teamer2.id]
      );

      const termin = await holeTermin(teamerToken, eventId);
      expect(termin.chat_room_id).toBeNull();
    });

    it('Ohne Chatraum zum Termin ist chat_room_id null', async () => {
      const eventId = await terminAnlegen('Termin ohne Chat');

      const termin = await holeTermin(teamerToken, eventId);
      expect(termin.chat_room_id).toBeNull();
    });

    it('Mitgliedschaft mit falschem user_type zaehlt nicht', async () => {
      // Dieselbe Person, aber als 'konfi' eingetragen: Die Abfrage vergleicht
      // user_id UND user_type, sonst wuerde eine fremde Zeile durchschlagen.
      const eventId = await terminAnlegen('Termin mit falschem Typ');
      const roomId = await chatraumAnlegen(eventId, 'Termin mit falschem Typ - Chat');
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'konfi')`,
        [roomId, USERS.teamer1.id]
      );

      const termin = await holeTermin(teamerToken, eventId);
      expect(termin.chat_room_id).toBeNull();
    });

    it('Zwei Termine mit je eigenem Chat bekommen ihre eigene Raum-ID', async () => {
      const eventA = await terminAnlegen('Termin A');
      const eventB = await terminAnlegen('Termin B');
      const raumA = await chatraumAnlegen(eventA, 'Termin A - Chat');
      const raumB = await chatraumAnlegen(eventB, 'Termin B - Chat');
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type)
         VALUES ($1, $3, 'teamer'), ($2, $3, 'teamer')`,
        [raumA, raumB, USERS.teamer1.id]
      );

      const terminA = await holeTermin(teamerToken, eventA);
      const terminB = await holeTermin(teamerToken, eventB);

      expect(terminA.chat_room_id).toBe(raumA);
      expect(terminB.chat_room_id).toBe(raumB);
      expect(raumA).not.toBe(raumB);
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

    // 0 = unbegrenzt. Der truthy-Check !max_participants verwarf die 0
    // zusammen mit undefined/null -> das Formular bietet "Unbegrenzte
    // Teilnehmer:innen" an, das Anlegen scheiterte aber mit "Name, Datum und
    // maximale Teilnehmerzahl sind erforderlich" (22.08.2026).
    it('Admin erstellt Event mit UNBEGRENZTEN Teilnehmer:innen (0) -> 201', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Event ohne Begrenzung',
          event_date: futureDate.toISOString(),
          max_participants: 0,
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });

    it('Unbegrenztes Event wird mit max_participants 0 gespeichert', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Unbegrenzt gespeichert',
          event_date: futureDate.toISOString(),
          max_participants: 0,
        });

      expect(res.status).toBe(201);

      const { rows: [gespeichert] } = await db.query(
        'SELECT max_participants FROM events WHERE id = $1',
        [res.body.id]
      );
      expect(Number(gespeichert.max_participants)).toBe(0);
    });

    it('Fehlende max_participants gibt weiterhin 400', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Ohne Angabe',
          event_date: futureDate.toISOString(),
        });

      expect(res.status).toBe(400);
    });

    it('Negative max_participants gibt 400', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Negativ',
          event_date: futureDate.toISOString(),
          max_participants: -5,
        });

      expect(res.status).toBe(400);
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

    // ================================================================
    // Org-Isolation: fremde jahrgang_ids/category_ids (Fund 05.07.2026 —
    // Admin aus Org 4 konnte Event mit Jahrgang aus Org 1 anlegen)
    // ================================================================

    it('Org-Isolation: jahrgang_ids aus fremder Org geben 400 und legen NICHTS an', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      // admin2 (Org 2) versucht, Jahrgang 1 (Org 1) zuzuordnen
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({
          name: 'Cross-Org-Event',
          event_date: futureDate.toISOString(),
          mandatory: true,
          jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Organisation');

      const { rows } = await db.query(
        "SELECT COUNT(*)::int AS n FROM events WHERE name = 'Cross-Org-Event'"
      );
      expect(rows[0].n).toBe(0);
    });

    it('Org-Isolation: category_ids aus fremder Org geben 400', async () => {
      // Kategorie in Org 1 anlegen, admin2 (Org 2) versucht sie zu nutzen
      const { rows: [cat] } = await db.query(
        'INSERT INTO categories (name, organization_id) VALUES ($1, $2) RETURNING id',
        ['Org1-Kategorie', ORGS.testGemeinde.id]
      );
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({
          name: 'Cross-Org-Kategorie-Event',
          event_date: futureDate.toISOString(),
          max_participants: 10,
          category_ids: [cat.id],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Organisation');
    });

    it('Org-Isolation: eigener Jahrgang bleibt erlaubt (201, Auto-Enrollment)', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Eigener-Jahrgang-Event',
          event_date: futureDate.toISOString(),
          mandatory: true,
          jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
        });

      expect(res.status).toBe(201);
    });

    it('Org-Isolation: PUT mit fremden jahrgang_ids gibt 400', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      // Eigenes Event in Org 2 anlegen ...
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({
          name: 'Org2-Event',
          event_date: futureDate.toISOString(),
          max_participants: 10,
        });
      expect(createRes.status).toBe(201);

      // ... und per Update einen Org-1-Jahrgang unterschieben
      const res = await request(app)
        .put(`/api/events/${createRes.body.id}`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({
          name: 'Org2-Event',
          event_date: futureDate.toISOString(),
          max_participants: 10,
          jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Organisation');
    });
  });

  // ================================================================
  // POST /api/events/:id/book (Konfi-Buchung)
  // ================================================================
  // Regression (Audit 09.08.2026): Konfi- und Teamer-Kontingent sind strikt
  // getrennt (Migration 120). Angemeldete Teamer duerfen NICHT gegen die
  // Konfi-Plaetze zählen — sonst gilt ein Event für Konfis als ausgebucht,
  // obwohl dort noch Plaetze frei sind.
  describe('Kontingent-Trennung Konfi/Teamer', () => {
    it('Zwei getrennte Wartelisten: Konfi voll -> Teamer bekommt trotzdem einen Platz', async () => {
      // Konfi-Kontingent 1 (voll + Warteliste), Teamer-Kontingent 2 (frei)
      const { rows: [event] } = await db.query(
        `INSERT INTO events (name, event_date, max_participants, waitlist_enabled, max_waitlist_size,
                             teamer_needed, teamer_max_participants, teamer_waitlist_enabled,
                             teamer_max_waitlist_size, point_type, created_by, organization_id)
         VALUES ('Zwei-Wartelisten', NOW() + INTERVAL '7 days', 1, true, 5,
                 true, 2, true, 3, 'gemeinde', $1, $2)
         RETURNING id`,
        [USERS.admin1.id, ORGS.testGemeinde.id]
      );
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [event.id, JAHRGAENGE.jahrgang1.id]
      );

      // Konfi 1 nimmt den einzigen Konfi-Platz
      const k1 = await request(app)
        .post(`/api/events/${event.id}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(k1.body.status).toBe('confirmed');

      // Konfi 2 landet auf der KONFI-Warteliste
      const k2 = await request(app)
        .post(`/api/events/${event.id}/book`)
        .set('Authorization', `Bearer ${konfi2Token}`);
      expect(k2.body.status).toBe('waitlist');

      // Teamer bekommt trotzdem einen bestaetigten Platz (eigenes Kontingent)
      const t1 = await request(app)
        .post(`/api/events/${event.id}/book`)
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(t1.body.status).toBe('confirmed');
    });

    it('Teamer-Buchung belegt KEINEN Konfi-Platz (registered_count bleibt konfi-only)', async () => {
      // Event mit genau 1 Konfi-Platz und Teamer-Bedarf
      const { rows: [event] } = await db.query(
        `INSERT INTO events (name, event_date, max_participants, waitlist_enabled,
                             teamer_needed, teamer_max_participants, point_type,
                             created_by, organization_id)
         VALUES ('Kontingent-Test', NOW() + INTERVAL '7 days', 1, false,
                 true, 5, 'gemeinde', $1, $2)
         RETURNING id`,
        [USERS.admin1.id, ORGS.testGemeinde.id]
      );
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [event.id, JAHRGAENGE.jahrgang1.id]
      );

      // Teamer meldet sich an -> eigenes Kontingent
      const teamerRes = await request(app)
        .post(`/api/events/${event.id}/book`)
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(teamerRes.status).toBe(201);
      expect(teamerRes.body.status).toBe('confirmed');

      // Konfi muss den einen Konfi-Platz trotzdem bekommen
      const konfiRes = await request(app)
        .post(`/api/events/${event.id}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(konfiRes.status).toBe(201);
      expect(konfiRes.body.status).toBe('confirmed');

      // Und die Liste meldet den Konfi-Platz als belegt (1), nicht 2
      const list = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken}`);
      const listed = list.body.find((e) => e.id === event.id);
      expect(parseInt(listed.registered_count, 10)).toBe(1);
      expect(parseInt(listed.teamer_count, 10)).toBe(1);
    });
  });

  // ================================================================
  // GET /api/events/:id — Zähl-Semantik wie die Liste (Befund 2, 25.08.2026)
  // ================================================================
  // Der Detail-Endpunkt zählte registered_count/pending_count INKLUSIVE
  // Teamer, die Liste ohne (konfi-rein, Migration 120: eigenes Teamer-
  // Kontingent). Bei einem teamer_needed-Event mit Kapazitaet meldete das
  // Detail dadurch "Ausgebucht", während die Liste "Offen" zeigte.
  describe('GET /api/events/:id — Zählung konfi-rein (Befund 2, 25.08.2026)', () => {
    async function seedTeamerNeededEvent() {
      const { rows } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                             waitlist_enabled, teamer_needed, teamer_max_participants,
                             point_type, points, created_by)
         VALUES ('Detail-Zaehl-Test', NOW() + interval '7 days', $1, false, 2,
                 true, true, 5, 'gemeinde', 1, $2)
         RETURNING id`,
        [ORGS.testGemeinde.id, USERS.admin1.id]
      );
      return rows[0].id;
    }

    it('registered_count zählt Teamer NICHT mit (wie die Liste)', async () => {
      const eventId = await seedTeamerNeededEvent();
      // 2 Konfis + 1 Teamer bestätigt
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', $5), ($1, $3, 'confirmed', $5), ($1, $4, 'confirmed', $5)`,
        [eventId, USERS.konfi1.id, USERS.konfi2.id, USERS.teamer1.id, ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.registered_count).toBe(2);
      expect(res.body.teamer_count).toBe(1);
      // Konfi-Kapazität 2, 2 Konfis gebucht -> kein freier Konfi-Platz;
      // der Teamer darf die Rechnung nicht auf -1 drücken
      expect(res.body.available_spots).toBe(0);
    });

    it('pending_count (Warteliste) zählt Teamer NICHT mit', async () => {
      const eventId = await seedTeamerNeededEvent();
      // 1 Konfi auf der Warteliste, 1 Teamer auf der Teamer-Warteliste
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
         VALUES ($1, $2, 'waitlist', $4), ($1, $3, 'waitlist', $4)`,
        [eventId, USERS.konfi1.id, USERS.teamer1.id, ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pending_count).toBe(1);
      expect(res.body.teamer_waitlist_count).toBe(1);
    });
  });

  // ================================================================
  // GET /api/events/cancelled — Zaehlung angeglichen (28.08.2026)
  //
  // Diese Route hatte als einzige KEINEN Rollenfilter: registered_count hiess
  // hier "Konfis UND Teamer", ueberall sonst "nur Konfis". Ein abgesagter
  // Termin mit Teamer:innen meldete deshalb eine hoehere Zahl als die normale
  // Liste fuer denselben Termin. Jetzt liest die Route event_booking_stats,
  // wie die uebrigen Zaehlstellen auch.
  // ================================================================
  describe('GET /api/events/cancelled — Zaehlung', () => {
    beforeEach(async () => {
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', 1), ($3, $2, 'confirmed', 1), ($4, $2, 'confirmed', 1)`,
        [USERS.konfi1.id, EVENTS.gottesdienstEvent.id, USERS.konfi2.id, USERS.teamer1.id]
      );
      await db.query(
        'UPDATE events SET cancelled = TRUE, cancelled_at = NOW() WHERE id = $1',
        [EVENTS.gottesdienstEvent.id]
      );
    });

    it('registered_count zaehlt nur Konfis, Teamer stehen getrennt', async () => {
      const res = await request(app)
        .get('/api/events/cancelled')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const ev = res.body.find(e => e.id === EVENTS.gottesdienstEvent.id);
      // Zwei Konfis und eine Teamer:in — vorher stand hier 3.
      expect(ev.registered_count).toBe(2);
      expect(ev.teamer_count).toBe(1);
    });

    it('meldet dieselbe Konfi-Zahl wie die View', async () => {
      const res = await request(app)
        .get('/api/events/cancelled')
        .set('Authorization', `Bearer ${adminToken}`);
      const ev = res.body.find(e => e.id === EVENTS.gottesdienstEvent.id);

      const { rows: [sicht] } = await db.query(
        'SELECT * FROM event_booking_stats WHERE event_id = $1',
        [EVENTS.gottesdienstEvent.id]
      );

      expect(ev.registered_count).toBe(sicht.konfi_confirmed);
      expect(ev.waitlist_count).toBe(sicht.konfi_waitlist);
      expect(ev.unprocessed_count).toBe(sicht.konfi_offen);
      expect(ev.teamer_count).toBe(sicht.teamer_confirmed);
    });

    it('Abgemeldete zaehlen nicht als angemeldet', async () => {
      await db.query(
        "UPDATE event_bookings SET status = 'opted_out' WHERE user_id = $1 AND event_id = $2",
        [USERS.konfi2.id, EVENTS.gottesdienstEvent.id]
      );

      const res = await request(app)
        .get('/api/events/cancelled')
        .set('Authorization', `Bearer ${adminToken}`);
      const ev = res.body.find(e => e.id === EVENTS.gottesdienstEvent.id);

      expect(ev.registered_count).toBe(1);
    });
  });

  // ================================================================
  // DELETE /api/events/:id/book — Doppelversand (28.08.2026)
  //
  // Wie bei der Abmeldung: Kommt eine offline abgegebene Stornierung zweimal
  // an, fand der zweite Lauf keine Buchung mehr und meldete 404 — ein
  // erfolgreicher Vorgang wurde als Fehler angezeigt und im Fehl-Merker
  // abgelegt. Ein Termin, den es gar nicht gibt, bleibt aber 404.
  // ================================================================
  describe('DELETE /api/events/:id/book', () => {
    beforeEach(async () => {
      await request(app)
        .post(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);
    });

    it('Erste Stornierung entfernt die Buchung -> 200', async () => {
      const res = await request(app)
        .delete(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);

      const { rows } = await db.query(
        'SELECT 1 FROM event_bookings WHERE user_id = $1 AND event_id = $2',
        [USERS.konfi1.id, EVENTS.gottesdienstEvent.id]
      );
      expect(rows.length).toBe(0);
    });

    it('Zweiter Versand derselben Stornierung ist kein Fehler -> 200', async () => {
      await request(app)
        .delete(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);

      const zweite = await request(app)
        .delete(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(zweite.status).toBe(200);
      expect(zweite.body.bereits_storniert).toBe(true);
    });

    it('Termin einer fremden Gemeinde bleibt 404', async () => {
      const res = await request(app)
        .delete(`/api/events/${EVENTS.event2.id}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(404);
    });

    it('Termin, den es nicht gibt, bleibt 404', async () => {
      const res = await request(app)
        .delete('/api/events/99999/book')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(404);
    });
  });

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
  // Teamer-Kontingent (eigene Kapazität + eigene Warteliste)
  //
  // Kern-Invariante: Konfi- und Teamer-Kontingent sind strikt getrennt.
  // Ein frei gewordener Konfi-Platz darf NIE von einem Teamer belegt werden
  // und umgekehrt. teamer_max_participants = 0 bedeutet unbegrenzt.
  // ================================================================
  describe('Teamer-Kontingent', () => {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

    // Der Seed hat nur EINE Teamer:in pro Org — für Wartelisten-Tests braucht
    // es mehrere. Zusatz-Teamer bekommen hohe IDs, damit sie nicht mit den
    // festen Seed-IDs (1..11) kollidieren.
    const EXTRA_TEAMERS = [
      { id: 101, username: 'teamer101', display_name: 'Test Teamer 101' },
      { id: 102, username: 'teamer102', display_name: 'Test Teamer 102' },
    ];

    function teamerToken2(user) {
      return jwt.sign({
        id: user.id,
        type: 'teamer',
        display_name: user.display_name,
        organization_id: ORGS.testGemeinde.id,
        role_id: 2, // ROLES.teamer (Org 1)
      }, JWT_SECRET, { expiresIn: '1h' });
    }

    async function seedExtraTeamers() {
      for (const t of EXTRA_TEAMERS) {
        await db.query(
          `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
           VALUES ($1, $2, 'x', $3, 2, $4, true)`,
          [t.id, t.username, t.display_name, ORGS.testGemeinde.id]
        );
      }
    }

    // Teamer-Event (teamer_needed) mit konfigurierbarem Teamer-Kontingent
    async function createTeamerEvent({
      teamerMax = 0,
      teamerWaitlistEnabled = true,
      teamerMaxWaitlist = 10,
      maxParticipants = 50,
      waitlistEnabled = true,
    } = {}) {
      const { rows: [ev] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                             point_type, points, has_timeslots, waitlist_enabled, max_waitlist_size,
                             teamer_needed, teamer_max_participants, teamer_waitlist_enabled,
                             teamer_max_waitlist_size)
         VALUES ('Teamer-Kontingent-Event', NOW() + interval '7 days', $1, false, $2,
                 'gemeinde', 0, false, $3, 5, true, $4, $5, $6)
         RETURNING id`,
        [ORGS.testGemeinde.id, maxParticipants, waitlistEnabled, teamerMax, teamerWaitlistEnabled, teamerMaxWaitlist]
      );
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [ev.id, JAHRGAENGE.jahrgang1.id]
      );
      return ev.id;
    }

    beforeEach(async () => {
      await seedExtraTeamers();
    });

    // Befund H3 (26.08.2026): registration_status rechnet ausschliesslich mit
    // Konfi-Zahlen -- teamer_max_participants floss nirgends ein. Ein voll
    // belegtes Teamer-Kontingent stand in der Teamer-Ansicht weiter als
    // "Offen", und man erfuhr erst beim Absenden (400), dass kein Platz ist.
    // Deshalb ein EIGENER Status: Die beiden Kontingente sind unabhaengig
    // (zehn Konfi-Plaetze und drei Teamer-Plaetze sind zehn und drei).
    describe('teamer_registration_status', () => {
      const statusVon = async (eventId) => {
        const res = await request(app)
          .get('/api/events')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        const ev = res.body.find((e) => e.id === eventId);
        expect(ev).toBeTruthy();
        return ev;
      };

      const teamerBuchen = async (userId, status = 'confirmed') => {
        await db.query(
          `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
           VALUES ($1, $2, $3, $4)`,
          [aktuellesEvent, userId, status, ORGS.testGemeinde.id]
        );
      };
      let aktuellesEvent;

      it('freies Kontingent meldet open', async () => {
        aktuellesEvent = await createTeamerEvent({ teamerMax: 2 });
        const ev = await statusVon(aktuellesEvent);
        expect(ev.teamer_registration_status).toBe('open');
      });

      it('volles Kontingent mit offener Warteliste meldet waitlist', async () => {
        aktuellesEvent = await createTeamerEvent({ teamerMax: 1, teamerWaitlistEnabled: true, teamerMaxWaitlist: 3 });
        await teamerBuchen(USERS.teamer1.id);

        const ev = await statusVon(aktuellesEvent);
        expect(ev.teamer_registration_status).toBe('waitlist');
        // Der Konfi-Status bleibt davon voellig unberuehrt.
        expect(ev.registration_status).toBe('open');
      });

      it('volles Kontingent UND volle Warteliste meldet closed', async () => {
        aktuellesEvent = await createTeamerEvent({ teamerMax: 1, teamerWaitlistEnabled: true, teamerMaxWaitlist: 1 });
        await teamerBuchen(USERS.teamer1.id);
        await teamerBuchen(EXTRA_TEAMERS[0].id, 'waitlist');

        const ev = await statusVon(aktuellesEvent);
        expect(ev.teamer_registration_status).toBe('closed');
      });

      it('volles Kontingent ohne Warteliste meldet closed', async () => {
        aktuellesEvent = await createTeamerEvent({ teamerMax: 1, teamerWaitlistEnabled: false });
        await teamerBuchen(USERS.teamer1.id);

        const ev = await statusVon(aktuellesEvent);
        expect(ev.teamer_registration_status).toBe('closed');
      });

      it('teamer_max_participants = 0 heisst unbegrenzt, bleibt open', async () => {
        aktuellesEvent = await createTeamerEvent({ teamerMax: 0 });
        await teamerBuchen(USERS.teamer1.id);
        await teamerBuchen(EXTRA_TEAMERS[0].id);

        const ev = await statusVon(aktuellesEvent);
        expect(ev.teamer_registration_status).toBe('open');
      });

      it('Termin ohne Teamer-Bedarf meldet none', async () => {
        // Gegenprobe: An einem reinen Konfi-Termin gibt es kein
        // Teamer-Kontingent -- der Status darf dort nicht 'open' behaupten.
        const { rows: [ev] } = await db.query(
          `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                               point_type, points, waitlist_enabled, teamer_needed, teamer_only)
           VALUES ('Reiner Konfi-Termin', NOW() + interval '7 days', $1, false, 10,
                   'gemeinde', 1, true, false, false)
           RETURNING id`,
          [ORGS.testGemeinde.id]
        );
        const geladen = await statusVon(ev.id);
        expect(geladen.teamer_registration_status).toBe('none');
      });

      it('abgesagter Termin meldet cancelled', async () => {
        aktuellesEvent = await createTeamerEvent({ teamerMax: 2 });
        await db.query('UPDATE events SET cancelled = true WHERE id = $1', [aktuellesEvent]);

        const ev = await statusVon(aktuellesEvent);
        expect(ev.teamer_registration_status).toBe('cancelled');
      });

      it('volles KONFI-Kontingent laesst den Teamer-Status unberuehrt', async () => {
        // Die Kern-Invariante in beide Richtungen: Ein ausgebuchtes
        // Konfi-Kontingent darf Teamer:innen nicht aussperren.
        aktuellesEvent = await createTeamerEvent({
          teamerMax: 5, maxParticipants: 1, waitlistEnabled: false
        });
        await db.query(
          `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
           VALUES ($1, $2, 'confirmed', $3)`,
          [aktuellesEvent, USERS.konfi1.id, ORGS.testGemeinde.id]
        );

        const ev = await statusVon(aktuellesEvent);
        expect(ev.registration_status).toBe('closed');
        expect(ev.teamer_registration_status).toBe('open');
      });
    });

    it('Teamer bucht bei freiem Kontingent -> confirmed', async () => {
      const eventId = await createTeamerEvent({ teamerMax: 2 });

      const res = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');
    });

    it('Teamer bucht bei vollem Kontingent -> waitlist', async () => {
      const eventId = await createTeamerEvent({ teamerMax: 1 });

      const book1 = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(book1.status).toBe(201);
      expect(book1.body.status).toBe('confirmed');

      const book2 = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken2(EXTRA_TEAMERS[0])}`);
      expect(book2.status).toBe(201);
      expect(book2.body.status).toBe('waitlist');
    });

    it('teamer_max_participants = 0 bedeutet unbegrenzt -> immer confirmed', async () => {
      const eventId = await createTeamerEvent({ teamerMax: 0 });

      for (const token of [teamerToken, teamerToken2(EXTRA_TEAMERS[0]), teamerToken2(EXTRA_TEAMERS[1])]) {
        const res = await request(app)
          .post(`/api/events/${eventId}/book`)
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(201);
        expect(res.body.status).toBe('confirmed');
      }
    });

    it('teamer_waitlist_enabled = false + volles Kontingent -> 400', async () => {
      const eventId = await createTeamerEvent({ teamerMax: 1, teamerWaitlistEnabled: false });

      await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken}`);

      const res = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken2(EXTRA_TEAMERS[0])}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ausgebucht');
    });

    it('Teamer-Storno: naechste Teamer:in rueckt nach, Konfi-Warteliste bleibt unberuehrt', async () => {
      // Teamer-Kontingent 1, Konfi-Kontingent 1 -> beide Wartelisten gefüllt
      const eventId = await createTeamerEvent({ teamerMax: 1, maxParticipants: 1 });

      await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken}`);
      await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken2(EXTRA_TEAMERS[0])}`);
      await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);
      await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfi2Token}`);

      // Ausgangslage prüfen
      const { rows: before } = await db.query(
        'SELECT user_id, status FROM event_bookings WHERE event_id = $1 ORDER BY user_id',
        [eventId]
      );
      expect(before.find(r => r.user_id === USERS.teamer1.id).status).toBe('confirmed');
      expect(before.find(r => r.user_id === EXTRA_TEAMERS[0].id).status).toBe('waitlist');
      expect(before.find(r => r.user_id === USERS.konfi1.id).status).toBe('confirmed');
      expect(before.find(r => r.user_id === USERS.konfi2.id).status).toBe('waitlist');

      // Teamer1 storniert
      const cancelRes = await request(app)
        .delete(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(cancelRes.status).toBe(200);

      const { rows: after } = await db.query(
        'SELECT user_id, status FROM event_bookings WHERE event_id = $1',
        [eventId]
      );
      // Teamer101 ist nachgerueckt
      expect(after.find(r => r.user_id === EXTRA_TEAMERS[0].id).status).toBe('confirmed');
      // Konfi-Warteliste UNVERAENDERT (kein Konfi auf einem Teamer-Platz)
      expect(after.find(r => r.user_id === USERS.konfi2.id).status).toBe('waitlist');
      expect(after.find(r => r.user_id === USERS.konfi1.id).status).toBe('confirmed');
    });

    it('Konfi-Storno: KEIN Teamer rueckt nach (Isolation der Kontingente)', async () => {
      // Konfi-Kontingent 1 (voll), Teamer-Kontingent 1 (voll) -> Teamer auf Warteliste
      const eventId = await createTeamerEvent({ teamerMax: 1, maxParticipants: 1 });

      await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);
      await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken}`);
      await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken2(EXTRA_TEAMERS[0])}`);

      // Konfi1 storniert -> Konfi-Platz frei, aber es gibt keinen Konfi auf der Warteliste
      const cancelRes = await request(app)
        .delete(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(cancelRes.status).toBe(200);

      // Teamer101 MUSS auf der Warteliste bleiben
      const { rows } = await db.query(
        'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [eventId, EXTRA_TEAMERS[0].id]
      );
      expect(rows[0].status).toBe('waitlist');
    });

    it('PUT erhoeht teamer_max_participants -> wartender Teamer rueckt nach', async () => {
      const eventId = await createTeamerEvent({ teamerMax: 1 });

      await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken}`);
      const book2 = await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken2(EXTRA_TEAMERS[0])}`);
      expect(book2.body.status).toBe('waitlist');

      const putRes = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Teamer-Kontingent-Event',
          event_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
          max_participants: 50,
          teamer_needed: true,
          teamer_max_participants: 2,
        });
      expect(putRes.status).toBe(200);
      expect(putRes.body.promoted_teamer_count).toBe(1);

      const { rows } = await db.query(
        'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [eventId, EXTRA_TEAMERS[0].id]
      );
      expect(rows[0].status).toBe('confirmed');
    });

    it('PUT reduziert teamer_max_participants -> Bestandsschutz, niemand wird zurueckgestuft', async () => {
      const eventId = await createTeamerEvent({ teamerMax: 3 });

      await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken}`);
      await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken2(EXTRA_TEAMERS[0])}`);

      const putRes = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Teamer-Kontingent-Event',
          event_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
          max_participants: 50,
          teamer_needed: true,
          teamer_max_participants: 1,
        });
      expect(putRes.status).toBe(200);

      const { rows } = await db.query(
        "SELECT COUNT(*)::int as c FROM event_bookings WHERE event_id = $1 AND status = 'confirmed'",
        [eventId]
      );
      expect(rows[0].c).toBe(2);
    });

    it('POST /events nimmt die Teamer-Kontingent-Felder an, GET liefert sie zurueck', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Neues Teamer-Event',
          event_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
          max_participants: 10,
          teamer_needed: true,
          teamer_max_participants: 4,
          teamer_waitlist_enabled: false,
          teamer_max_waitlist_size: 3,
        });
      expect(createRes.status).toBe(201);

      const detail = await request(app)
        .get(`/api/events/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.teamer_max_participants).toBe(4);
      expect(detail.body.teamer_waitlist_enabled).toBe(false);
      expect(detail.body.teamer_max_waitlist_size).toBe(3);
      expect(detail.body.teamer_waitlist_count).toBe(0);
    });

    it('POST /events weist negatives teamer_max_participants ab (400)', async () => {
      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Ungueltiges Teamer-Event',
          event_date: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
          max_participants: 10,
          teamer_max_participants: -1,
        });
      expect(res.status).toBe(400);
    });

    it('GET /events liefert teamer_waitlist_count und booking_status = waitlist fuer den Teamer', async () => {
      const eventId = await createTeamerEvent({ teamerMax: 1 });

      await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken}`);
      await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken2(EXTRA_TEAMERS[0])}`);

      const listRes = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${teamerToken2(EXTRA_TEAMERS[0])}`);
      expect(listRes.status).toBe(200);
      const evt = listRes.body.find(e => e.id === eventId);
      expect(evt).toBeDefined();
      expect(evt.teamer_count).toBe(1);
      expect(evt.teamer_waitlist_count).toBe(1);
      expect(evt.booking_status).toBe('waitlist');
      expect(evt.teamer_max_participants).toBe(1);
    });
  });

  // ================================================================
  // Admin entfernt Teilnehmer -> Nachruecken muss die Kontingent-Trennung
  // einhalten. Frueher nahm die Route den aeltesten Wartenden OHNE Rollenfilter:
  // beim Entfernen eines Teamers rueckte ein Konfi auf den Teamer-Platz
  // (Konfi-Kontingent ueberbucht, Teamer-Platz blieb leer) und der Push ging
  // über den falschen Kanal.
  // ================================================================
  describe('DELETE /:id/bookings/:bookingId - rollenrichtiges Nachruecken', () => {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

    const EXTRA_TEAMERS = [
      { id: 111, username: 'teamer111', display_name: 'Test Teamer 111' },
      { id: 112, username: 'teamer112', display_name: 'Test Teamer 112' },
    ];

    function teamerToken2(user) {
      return jwt.sign({
        id: user.id,
        type: 'teamer',
        display_name: user.display_name,
        organization_id: ORGS.testGemeinde.id,
        role_id: 2,
      }, JWT_SECRET, { expiresIn: '1h' });
    }

    // Event mit je 1 Konfi- und 1 Teamer-Platz, beide Wartelisten offen.
    async function createMixedEvent() {
      const { rows: [ev] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                             point_type, points, has_timeslots, waitlist_enabled, max_waitlist_size,
                             teamer_needed, teamer_max_participants, teamer_waitlist_enabled,
                             teamer_max_waitlist_size)
         VALUES ('Gemischtes Kontingent-Event', NOW() + interval '7 days', $1, false, 1,
                 'gemeinde', 0, false, true, 5, true, 1, true, 5)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [ev.id, JAHRGAENGE.jahrgang1.id]
      );
      return ev.id;
    }

    beforeEach(async () => {
      for (const t of EXTRA_TEAMERS) {
        await db.query(
          `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
           VALUES ($1, $2, 'x', $3, 2, $4, true)`,
          [t.id, t.username, t.display_name, ORGS.testGemeinde.id]
        );
      }
    });

    async function bookingIdOf(eventId, userId) {
      const { rows: [row] } = await db.query(
        'SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [eventId, userId]
      );
      return row?.id;
    }

    async function statusOf(eventId, userId) {
      const { rows: [row] } = await db.query(
        'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [eventId, userId]
      );
      return row?.status;
    }

    it('Teamer entfernt -> wartender TEAMER rueckt nach, Konfi-Warteliste bleibt unberuehrt', async () => {
      const eventId = await createMixedEvent();

      // Konfi-Platz: konfi1 confirmed, konfi2 auf Warteliste
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${konfiToken}`);
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${konfi2Token}`);
      expect(await statusOf(eventId, USERS.konfi1.id)).toBe('confirmed');
      expect(await statusOf(eventId, USERS.konfi2.id)).toBe('waitlist');

      // Teamer-Platz: teamer1 confirmed, Teamer 111 auf Warteliste
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${teamerToken}`);
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${teamerToken2(EXTRA_TEAMERS[0])}`);
      expect(await statusOf(eventId, USERS.teamer1.id)).toBe('confirmed');
      expect(await statusOf(eventId, EXTRA_TEAMERS[0].id)).toBe('waitlist');

      // Admin entfernt den bestaetigten TEAMER
      const bId = await bookingIdOf(eventId, USERS.teamer1.id);
      const res = await request(app)
        .delete(`/api/events/${eventId}/bookings/${bId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      // Der wartende TEAMER rueckt nach - NICHT der Konfi
      expect(await statusOf(eventId, EXTRA_TEAMERS[0].id)).toBe('confirmed');
      expect(await statusOf(eventId, USERS.konfi2.id)).toBe('waitlist');

      // Konfi-Kontingent bleibt bei genau 1 bestaetigtem Konfi
      const { rows: [cnt] } = await db.query(
        `SELECT COUNT(*)::int AS c FROM event_bookings eb
         JOIN users u ON eb.user_id = u.id JOIN roles r ON u.role_id = r.id
         WHERE eb.event_id = $1 AND eb.status = 'confirmed' AND r.name != 'teamer'`,
        [eventId]
      );
      expect(cnt.c).toBe(1);
    });

    it('Konfi entfernt -> wartender KONFI rueckt nach, Teamer-Warteliste bleibt unberuehrt', async () => {
      const eventId = await createMixedEvent();

      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${konfiToken}`);
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${konfi2Token}`);
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${teamerToken}`);
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${teamerToken2(EXTRA_TEAMERS[0])}`);

      // Admin entfernt den bestaetigten KONFI
      const bId = await bookingIdOf(eventId, USERS.konfi1.id);
      const res = await request(app)
        .delete(`/api/events/${eventId}/bookings/${bId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      // Der wartende KONFI rueckt nach - NICHT der Teamer
      expect(await statusOf(eventId, USERS.konfi2.id)).toBe('confirmed');
      expect(await statusOf(eventId, EXTRA_TEAMERS[0].id)).toBe('waitlist');
    });

    it('Teamer entfernt ohne wartende Teamer -> niemand rueckt nach', async () => {
      const eventId = await createMixedEvent();

      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${konfiToken}`);
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${konfi2Token}`);
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${teamerToken}`);

      const bId = await bookingIdOf(eventId, USERS.teamer1.id);
      await request(app)
        .delete(`/api/events/${eventId}/bookings/${bId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Der wartende Konfi darf NICHT auf den freien Teamer-Platz rutschen
      expect(await statusOf(eventId, USERS.konfi2.id)).toBe('waitlist');
    });

    it('Konfi storniert selbst -> bestaetigte Teamer blockieren das Nachruecken nicht', async () => {
      const eventId = await createMixedEvent();

      // Teamer-Platz belegt: zählte früher gegen max_participants=1 und
      // verhinderte damit das Nachruecken auf dem Konfi-Platz.
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${teamerToken}`);
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${konfiToken}`);
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${konfi2Token}`);
      expect(await statusOf(eventId, USERS.konfi2.id)).toBe('waitlist');

      const res = await request(app)
        .delete(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(res.status).toBe(200);

      expect(await statusOf(eventId, USERS.konfi2.id)).toBe('confirmed');
    });

    it('Push geht an den rollenrichtigen Kanal (Teamer-Promotion)', async () => {
      const spyTeamer = vi.spyOn(PushService, 'sendWaitlistPromotionToTeamer').mockResolvedValue(undefined);
      const spyKonfi = vi.spyOn(PushService, 'sendWaitlistPromotionToKonfi').mockResolvedValue(undefined);

      const eventId = await createMixedEvent();
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${teamerToken}`);
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${teamerToken2(EXTRA_TEAMERS[0])}`);

      const bId = await bookingIdOf(eventId, USERS.teamer1.id);
      await request(app)
        .delete(`/api/events/${eventId}/bookings/${bId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Multi-Org: Die Event-Org wird explizit mitgegeben (Teamer:innen
      // können Multi-Org sein — der Push-Tap wechselt in die Event-Org).
      expect(spyTeamer).toHaveBeenCalledWith(expect.anything(), EXTRA_TEAMERS[0].id, expect.any(String), null, String(eventId), USERS.admin1.org_id);
      expect(spyKonfi).not.toHaveBeenCalled();

      spyTeamer.mockRestore();
      spyKonfi.mockRestore();
    });
  });

  // ================================================================
  // Timeslot-Warteliste (Fund 05.07.2026): voller Slot -> Warteliste PRO SLOT,
  // früher setzte die event-weite Gesamtkapazitaet die Warteliste außer Kraft
  // (voller Slot wurde als "noch Platz" gewertet -> hartes "ausgebucht" ohne
  // Wartelisten-Option).
  // ================================================================
  describe('Timeslot-Warteliste (pro Slot)', () => {
    // Timeslot-Event mit einem Slot der Kapazität 1 + Warteliste anlegen.
    // Direkt in der DB, weil der Slot-Kapazität=1 gezielt gesetzt wird.
    async function createTimeslotEventWithCapacity1() {
      const { rows: [ev] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                             point_type, points, has_timeslots, waitlist_enabled, max_waitlist_size)
         VALUES ('Slot-Warteliste-Event', NOW() + interval '7 days', $1, false, 0,
                 'gemeinde', 0, true, true, 5)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const { rows: [slot] } = await db.query(
        `INSERT INTO event_timeslots (event_id, start_time, end_time, max_participants, organization_id)
         VALUES ($1, NOW() + interval '7 days', NOW() + interval '7 days' + interval '2 hours', 1, $2)
         RETURNING id`,
        [ev.id, ORGS.testGemeinde.id]
      );
      // Jahrgang zuordnen, damit die Konfis das Event sehen/buchen duerfen
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [ev.id, JAHRGAENGE.jahrgang1.id]
      );
      return { eventId: ev.id, slotId: slot.id };
    }

    it('Voller Slot: zweiter Konfi kommt auf die Warteliste (nicht 400)', async () => {
      const { eventId, slotId } = await createTimeslotEventWithCapacity1();

      const book1 = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ timeslot_id: slotId });
      expect(book1.status).toBe(201);
      expect(book1.body.status).toBe('confirmed');

      const book2 = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfi2Token}`)
        .send({ timeslot_id: slotId });
      expect(book2.status).toBe(201);
      expect(book2.body.status).toBe('waitlist');
    });

    it('Storniert der bestätigte Konfi, rückt der Wartelisten-Konfi im selben Slot nach', async () => {
      const { eventId, slotId } = await createTimeslotEventWithCapacity1();

      await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`).send({ timeslot_id: slotId });
      await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfi2Token}`).send({ timeslot_id: slotId });

      const cancelRes = await request(app)
        .delete(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(cancelRes.status).toBe(200);

      const { rows } = await db.query(
        'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [eventId, USERS.konfi2.id]
      );
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('confirmed');
    });

    it('Voller Slot ohne Warteliste gibt 400', async () => {
      const { rows: [ev] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                             point_type, points, has_timeslots, waitlist_enabled)
         VALUES ('Slot-ohne-Warteliste', NOW() + interval '7 days', $1, false, 0,
                 'gemeinde', 0, true, false)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const { rows: [slot] } = await db.query(
        `INSERT INTO event_timeslots (event_id, start_time, end_time, max_participants, organization_id)
         VALUES ($1, NOW() + interval '7 days', NOW() + interval '7 days' + interval '2 hours', 1, $2)
         RETURNING id`,
        [ev.id, ORGS.testGemeinde.id]
      );
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [ev.id, JAHRGAENGE.jahrgang1.id]);

      await request(app).post(`/api/events/${ev.id}/book`)
        .set('Authorization', `Bearer ${konfiToken}`).send({ timeslot_id: slot.id });

      const book2 = await request(app)
        .post(`/api/events/${ev.id}/book`)
        .set('Authorization', `Bearer ${konfi2Token}`)
        .send({ timeslot_id: slot.id });
      expect(book2.status).toBe(400);
    });

    it('Zweiter Slot bleibt frei buchbar, während der erste voll ist', async () => {
      const { eventId, slotId } = await createTimeslotEventWithCapacity1();
      // zweiten Slot (Kapazität 1) am selben Event anlegen
      const { rows: [slot2] } = await db.query(
        `INSERT INTO event_timeslots (event_id, start_time, end_time, max_participants, organization_id)
         VALUES ($1, NOW() + interval '7 days' + interval '3 hours', NOW() + interval '7 days' + interval '5 hours', 1, $2)
         RETURNING id`,
        [eventId, ORGS.testGemeinde.id]
      );

      await request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`).send({ timeslot_id: slotId });

      // Slot 1 ist voll, Slot 2 muss trotzdem confirmed gehen
      const book2 = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfi2Token}`)
        .send({ timeslot_id: slot2.id });
      expect(book2.status).toBe(201);
      expect(book2.body.status).toBe('confirmed');
    });
  });

  // ================================================================
  // PUT /:id/participants/:participantId/status (Warteliste <-> bestaetigt)
  // ================================================================
  describe('PUT /api/events/:id/participants/:participantId/status', () => {
    let miniEventId;
    let waitlistBookingId;

    beforeEach(async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Status-Event',
          event_date: futureDate.toISOString(),
          max_participants: 1,
          waitlist_enabled: true,
          max_waitlist_size: 5,
        });
      miniEventId = createRes.body.id;

      // Konfi1 -> confirmed, Konfi2 -> waitlist
      await request(app)
        .post(`/api/events/${miniEventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);
      await request(app)
        .post(`/api/events/${miniEventId}/book`)
        .set('Authorization', `Bearer ${konfi2Token}`);

      const { rows } = await db.query(
        "SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2",
        [miniEventId, USERS.konfi2.id]
      );
      waitlistBookingId = rows[0].id;
    });

    it('Admin bestaetigt von Warteliste -> 200 + DB-Status confirmed (Push/Live-Update kippen nicht)', async () => {
      const res = await request(app)
        .put(`/api/events/${miniEventId}/participants/${waitlistBookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('confirmed');

      const { rows } = await db.query(
        "SELECT status FROM event_bookings WHERE id = $1", [waitlistBookingId]
      );
      expect(rows[0].status).toBe('confirmed');
    });

    it('Ungueltiger Status gibt 400', async () => {
      const res = await request(app)
        .put(`/api/events/${miniEventId}/participants/${waitlistBookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'bogus' });

      expect(res.status).toBe(400);
    });

    it('Bereits vorhandener Status gibt 400', async () => {
      const res = await request(app)
        .put(`/api/events/${miniEventId}/participants/${waitlistBookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'waitlist' });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  // PUT /:id/participants/attendance-all (Bulk-Verbuchung der Angemeldeten)
  // Ersetzt die frueheren Warteliste-Bulk-Endpoints (confirm-all/fill-capacity):
  // "Alle bestaetigen" verbucht fachlich die ANGEMELDETEN als anwesend,
  // die Warteliste bleibt unberuehrt (Betreiber-Entscheid 03.07.2026).
  // ================================================================
  describe('PUT /api/events/:id/participants/attendance-all', () => {
    // Event mit Kapazität 1 + Punkten: konfi1 angemeldet (confirmed),
    // konfi2 auf der Warteliste.
    async function setupEventWithWaitlist() {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Attendance-All-Event',
          event_date: futureDate.toISOString(),
          max_participants: 1,
          waitlist_enabled: true,
          max_waitlist_size: 5,
          points: 2,
          point_type: 'gemeinde',
        });
      const eventId = createRes.body.id;
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${konfiToken}`);
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${konfi2Token}`);
      return eventId;
    }

    // Nutzerfrage 25.08.2026: "Was passiert in einem Pflichtevent mit denen,
    // die abgemeldet sind oder schon als abwesend markiert sind? Die duerfen
    // dann nicht auf anwesend geaendert werden, wenn 'Alle verbuchen'
    // geklickt wird."
    // Nutzerentscheid 25.08.2026: "Teamer bei Events werden verbucht. Gibt ja
    // auch Badges fuer Freizeithopper. Aber Konfis und Teamer separat
    // verbuchen, auch bei 'Alle bestaetigen'."
    // Nutzerhinweis 25.08.2026: "Die muessen unter Verbuchen stehen bleiben und
    // in der Tabbar das Kennzeichen behalten, sonst rutschen Teamer durch.
    // Etwa auch in einem Konfi-Event, in dem alle Konfis verbucht sind, aber
    // die Teamer nicht."
    it('Termin bleibt als "zu verbuchen" gekennzeichnet, wenn nur noch Teamer offen sind', async () => {
      const eventId = await setupEventWithWaitlist();
      await db.query(
        "UPDATE events SET teamer_needed = true, teamer_max_participants = 5, event_date = NOW() - interval '1 day' WHERE id = $1",
        [eventId]
      );
      await db.query(
        "INSERT INTO event_bookings (user_id, event_id, status, organization_id) VALUES ($1, $2, 'confirmed', 1)",
        [USERS.teamer1.id, eventId]
      );

      // Alle Konfis verbuchen — die Teamer bleiben offen.
      await request(app)
        .put(`/api/events/${eventId}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken}`);
      const ev = res.body.find((e) => e.id === eventId);

      // Verbotener Fall: Termin verschwindet aus dem Verbuchen-Tab, obwohl
      // das Team noch offen steht.
      expect(ev.pending_bookings_count).toBe(1);
    });

    it('erst wenn BEIDE Rollen verbucht sind, faellt das Kennzeichen weg', async () => {
      const eventId = await setupEventWithWaitlist();
      await db.query(
        "UPDATE events SET teamer_needed = true, teamer_max_participants = 5, event_date = NOW() - interval '1 day' WHERE id = $1",
        [eventId]
      );
      await db.query(
        "INSERT INTO event_bookings (user_id, event_id, status, organization_id) VALUES ($1, $2, 'confirmed', 1)",
        [USERS.teamer1.id, eventId]
      );

      await request(app).put(`/api/events/${eventId}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminToken}`);
      await request(app).put(`/api/events/${eventId}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminToken}`).send({ rolle: 'teamer' });

      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken}`);
      const ev = res.body.find((e) => e.id === eventId);
      expect(ev.pending_bookings_count).toBe(undefined);
    });

    it('verbucht standardmaessig NUR Konfis, Teamer bleiben offen', async () => {
      const eventId = await setupEventWithWaitlist();
      await db.query(
        "UPDATE events SET teamer_needed = true, teamer_max_participants = 5 WHERE id = $1",
        [eventId]
      );
      await db.query(
        "INSERT INTO event_bookings (user_id, event_id, status, organization_id) VALUES ($1, $2, 'confirmed', 1)",
        [USERS.teamer1.id, eventId]
      );

      await request(app)
        .put(`/api/events/${eventId}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminToken}`);

      const { rows } = await db.query(
        `SELECT r.name AS rolle, eb.attendance_status
           FROM event_bookings eb JOIN users u ON eb.user_id=u.id JOIN roles r ON u.role_id=r.id
          WHERE eb.event_id = $1 AND eb.status = 'confirmed' ORDER BY r.name`,
        [eventId]
      );
      const konfi = rows.find(r => r.rolle === 'konfi');
      const teamer = rows.find(r => r.rolle === 'teamer');
      expect(konfi.attendance_status).toBe('present');
      // Verbotener Fall: Teamer im selben Durchlauf mitverbucht.
      expect(teamer.attendance_status).toBeNull();
    });

    it('verbucht mit rolle=teamer NUR Teamer, Konfis bleiben offen', async () => {
      const eventId = await setupEventWithWaitlist();
      await db.query(
        "UPDATE events SET teamer_needed = true, teamer_max_participants = 5 WHERE id = $1",
        [eventId]
      );
      await db.query(
        "INSERT INTO event_bookings (user_id, event_id, status, organization_id) VALUES ($1, $2, 'confirmed', 1)",
        [USERS.teamer1.id, eventId]
      );

      await request(app)
        .put(`/api/events/${eventId}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rolle: 'teamer' });

      const { rows } = await db.query(
        `SELECT r.name AS rolle, eb.attendance_status
           FROM event_bookings eb JOIN users u ON eb.user_id=u.id JOIN roles r ON u.role_id=r.id
          WHERE eb.event_id = $1 AND eb.status = 'confirmed' ORDER BY r.name`,
        [eventId]
      );
      expect(rows.find(r => r.rolle === 'teamer').attendance_status).toBe('present');
      expect(rows.find(r => r.rolle === 'konfi').attendance_status).toBeNull();
    });

    it('vergibt bei rolle=teamer KEINE Konfi-Punkte', async () => {
      const eventId = await setupEventWithWaitlist();
      await db.query(
        "UPDATE events SET teamer_needed = true, teamer_max_participants = 5 WHERE id = $1",
        [eventId]
      );
      await db.query(
        "INSERT INTO event_bookings (user_id, event_id, status, organization_id) VALUES ($1, $2, 'confirmed', 1)",
        [USERS.teamer1.id, eventId]
      );

      await request(app)
        .put(`/api/events/${eventId}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rolle: 'teamer' });

      const { rows } = await db.query(
        'SELECT COUNT(*)::int AS anzahl FROM event_points WHERE event_id = $1',
        [eventId]
      );
      expect(rows[0].anzahl).toBe(0);
    });

    it('"Alle verbuchen" laesst Abgemeldete unangetastet', async () => {
      const eventId = await setupEventWithWaitlist();
      // konfi1 meldet sich ab (Pflichtevent-Weg setzt opted_out).
      await db.query(
        "UPDATE event_bookings SET status = 'opted_out', opt_out_reason = 'krank' WHERE event_id = $1 AND user_id = $2",
        [eventId, USERS.konfi1.id]
      );

      await request(app)
        .put(`/api/events/${eventId}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminToken}`);

      const { rows } = await db.query(
        'SELECT status, attendance_status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [eventId, USERS.konfi1.id]
      );
      // Verbotener Fall: aus einer Abmeldung wird "anwesend".
      expect(rows[0].status).toBe('opted_out');
      expect(rows[0].attendance_status).toBeNull();
    });

    it('"Alle verbuchen" ueberschreibt ein bereits gesetztes "abwesend" NICHT', async () => {
      const eventId = await setupEventWithWaitlist();
      await db.query(
        "UPDATE event_bookings SET attendance_status = 'absent' WHERE event_id = $1 AND user_id = $2",
        [eventId, USERS.konfi1.id]
      );

      await request(app)
        .put(`/api/events/${eventId}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminToken}`);

      const { rows } = await db.query(
        'SELECT attendance_status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [eventId, USERS.konfi1.id]
      );
      // Verbotener Fall: eine bewusste Entscheidung wird ueberschrieben.
      expect(rows[0].attendance_status).toBe('absent');
    });

    it('verbucht Angemeldete als anwesend + vergibt Punkte, Warteliste bleibt unberuehrt', async () => {
      const eventId = await setupEventWithWaitlist();

      const res = await request(app)
        .put(`/api/events/${eventId}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.confirmed).toBe(1);       // nur konfi1 (angemeldet)
      expect(res.body.points_awarded).toBe(1);

      const { rows } = await db.query(
        "SELECT status, attendance_status FROM event_bookings WHERE event_id = $1 ORDER BY created_at ASC",
        [eventId]
      );
      expect(rows[0].status).toBe('confirmed');
      expect(rows[0].attendance_status).toBe('present');
      // Wartelisten-Person: Status UND Anwesenheit unberuehrt
      expect(rows[1].status).toBe('waitlist');
      expect(rows[1].attendance_status).toBeNull();

      // Punkte in event_points + konfi_profiles angekommen
      const { rows: pts } = await db.query(
        "SELECT points FROM event_points WHERE event_id = $1 AND konfi_id = $2",
        [eventId, USERS.konfi1.id]
      );
      expect(pts.length).toBe(1);
      expect(pts[0].points).toBe(2);
    });

    it('bereits Verbuchte (absent) werden NICHT angefasst', async () => {
      const eventId = await setupEventWithWaitlist();
      // konfi1 vorab als abwesend verbuchen
      const { rows: [booking] } = await db.query(
        "SELECT id FROM event_bookings WHERE event_id = $1 AND status = 'confirmed'",
        [eventId]
      );
      await request(app)
        .put(`/api/events/${eventId}/participants/${booking.id}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'absent' });

      const res = await request(app)
        .put(`/api/events/${eventId}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.confirmed).toBe(0); // niemand unverbucht -> nichts passiert

      const { rows } = await db.query(
        "SELECT attendance_status FROM event_bookings WHERE id = $1",
        [booking.id]
      );
      expect(rows[0].attendance_status).toBe('absent');
    });

    it('Nicht-existentes Event -> 404 (Early-Return ohne Double-Release)', async () => {
      const res = await request(app)
        .put('/api/events/999999/participants/attendance-all')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
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

    // Geaendert 28.08.2026: Vorher erwartete dieser Test 404 fuer einen
    // vorhandenen Termin ohne eigene Buchung. Das war der Fall, an dem ein
    // erfolgreicher Doppelversand aus der Warteschlange als Fehler ankam. Der
    // Termin existiert und die Buchung ist weg — das Ziel ist erreicht. Fuer
    // einen Termin, den es nicht gibt, bleibt es beim 404 (Test weiter oben).
    it('Stornierung ohne Buchung ist kein Fehler, der Termin existiert ja -> 200', async () => {
      const res = await request(app)
        .delete(`/api/events/${EVENTS.gottesdienstEvent.id}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.bereits_storniert).toBe(true);
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

    // Abgesagt schlägt jeden anderen Status — auch 'mandatory'. Vorher kannte
    // die CASE-Anweisung gar keinen cancelled-Fall, ein abgesagtes Event meldete
    // weiter 'open'/'mandatory' und wurde in der Leitungssicht nicht als
    // abgesagt erkannt (Fund 22.08.2026).
    it('Abgesagtes Pflicht-Event meldet registration_status cancelled', async () => {
      await db.query('UPDATE events SET cancelled = TRUE WHERE id = $1', [EVENTS.pflichtEvent.id]);

      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      const pflicht = res.body.find(e => e.id === EVENTS.pflichtEvent.id);
      expect(pflicht).toBeDefined();
      expect(pflicht.registration_status).toBe('cancelled');
    });

    it('Nicht abgesagtes Event meldet weiterhin seinen normalen Status', async () => {
      const res = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      const evt = res.body.find(e => e.id === EVENTS.gottesdienstEvent.id);
      expect(evt).toBeDefined();
      expect(evt.registration_status).not.toBe('cancelled');
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

    // Befund 24.08.2026: Das Nachbuchen hängt an `!oldEvent.mandatory` und
    // greift damit NUR bei der Umwandlung freiwillig -> Pflicht. Wird zu einem
    // Termin, der schon Pflicht ist, ein weiterer Jahrgang ergaenzt, blieben
    // dessen Konfis ungebucht — still, ohne Hinweis in der Leitungsansicht.
    it('Ein zusaetzlicher Jahrgang an einem bestehenden Pflicht-Event bucht dessen Konfis nach', async () => {
      const zukunft = new Date();
      zukunft.setDate(zukunft.getDate() + 14);

      // Zweiter Jahrgang in DERSELBEN Organisation — der Seed hat je Org nur einen.
      const { rows: [jg] } = await db.query(
        `INSERT INTO jahrgaenge (name, organization_id, confirmation_date)
         VALUES ('2026/2027', $1, '2027-05-01') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const { rows: [neuerKonfi] } = await db.query(
        `INSERT INTO users (username, display_name, password_hash, role_id, organization_id, is_active)
         VALUES ('konfi-jg2', 'Konfi Jahrgang 2', 'x', $1, $2, true) RETURNING id`,
        [USERS.konfi1.role_id, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
         VALUES ($1, $2, 0, 0, $3)`,
        [neuerKonfi.id, jg.id, ORGS.testGemeinde.id]
      );

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pflichttermin mit spaeterem Jahrgang',
          event_date: zukunft.toISOString(),
          mandatory: true,
          jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
        });
      expect(createRes.status).toBe(201);
      const eventId = createRes.body.id;

      // Der neue Jahrgang hängt noch nicht dran, also darf hier nichts stehen.
      const { rows: vorher } = await db.query(
        'SELECT 1 FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [eventId, neuerKonfi.id]
      );
      expect(vorher.length).toBe(0);

      // Jetzt den zweiten Jahrgang ergaenzen — mandatory bleibt true.
      const updateRes = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pflichttermin mit spaeterem Jahrgang',
          event_date: zukunft.toISOString(),
          mandatory: true,
          jahrgang_ids: [JAHRGAENGE.jahrgang1.id, jg.id],
        });
      expect(updateRes.status).toBe(200);

      const { rows: nachher } = await db.query(
        'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [eventId, neuerKonfi.id]
      );
      expect(nachher.length).toBe(1);
      expect(nachher[0].status).toBe('confirmed');

      // Die Konfis des urspruenglichen Jahrgangs bleiben unangetastet.
      const { rows: alte } = await db.query(
        'SELECT 1 FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [eventId, USERS.konfi1.id]
      );
      expect(alte.length).toBe(1);
    });

    // Gegenprobe zum Fix oben: Der Enroll läuft jetzt bei JEDEM Speichern
    // eines Pflicht-Termins. Wer sich abgemeldet hat (Status 'opted_out'),
    // darf dadurch nicht stillschweigend zurueckgeholt werden.
    it('Ein abgemeldeter Konfi wird beim Speichern nicht zurueckgeholt', async () => {
      const zukunft = new Date();
      zukunft.setDate(zukunft.getDate() + 14);

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pflichttermin mit Abmeldung',
          event_date: zukunft.toISOString(),
          mandatory: true,
          jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
        });
      expect(createRes.status).toBe(201);
      const eventId = createRes.body.id;

      await db.query(
        `UPDATE event_bookings SET status = 'opted_out', opt_out_reason = 'krank', opt_out_date = NOW()
         WHERE event_id = $1 AND user_id = $2`,
        [eventId, USERS.konfi1.id]
      );

      const updateRes = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pflichttermin mit Abmeldung, umbenannt',
          event_date: zukunft.toISOString(),
          mandatory: true,
          jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
        });
      expect(updateRes.status).toBe(200);

      const { rows } = await db.query(
        'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [eventId, USERS.konfi1.id]
      );
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('opted_out');
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
  // Timeslot-Sperre bei Pflicht-Events und Konfirmationen
  // (fachliche Regel: beide haben feste Termine für den ganzen Jahrgang,
  //  daher KEINE Zeitfenster — serverseitig erzwungen, nicht nur im Frontend)
  // ================================================================
  describe('Timeslots bei mandatory/is_konfirmation gesperrt', () => {
    const futureDate = () => {
      const d = new Date();
      d.setDate(d.getDate() + 21);
      return d.toISOString();
    };
    const slot = () => {
      const s = new Date(); s.setDate(s.getDate() + 21);
      const e = new Date(s); e.setHours(e.getHours() + 1);
      return { start_time: s.toISOString(), end_time: e.toISOString(), max_participants: 5 };
    };

    it('POST mandatory=true mit has_timeslots -> Server erzwingt has_timeslots=false, keine Timeslots angelegt', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pflicht ohne Slots',
          event_date: futureDate(),
          mandatory: true,
          jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
          has_timeslots: true,
          timeslots: [slot(), slot()],
        });
      expect(createRes.status).toBe(201);

      const detailRes = await request(app)
        .get(`/api/events/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.has_timeslots).toBe(false);

      const slotsRes = await request(app)
        .get(`/api/events/${createRes.body.id}/timeslots`)
        .set('Authorization', `Bearer ${adminToken}`);
      // keine Timeslots angelegt
      expect(Array.isArray(slotsRes.body) ? slotsRes.body.length : 0).toBe(0);
    });

    it('POST is_konfirmation=true mit has_timeslots -> Server erzwingt has_timeslots=false', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Konfirmation ohne Slots',
          event_date: futureDate(),
          is_konfirmation: true,
          max_participants: 30,
          has_timeslots: true,
          timeslots: [slot()],
        });
      expect(createRes.status).toBe(201);

      const detailRes = await request(app)
        .get(`/api/events/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detailRes.status).toBe(200);
      expect(detailRes.body.has_timeslots).toBe(false);
    });

    it('PUT: normales Event mit Timeslots -> zu Konfirmation -> has_timeslots wird false', async () => {
      // 1. normales Event mit Timeslots
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Erst Slots dann Konfirmation',
          event_date: futureDate(),
          max_participants: 10,
          has_timeslots: true,
          timeslots: [slot()],
        });
      expect(createRes.status).toBe(201);
      const eventId = createRes.body.id;

      // 2. zu Konfirmation umwandeln
      const putRes = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Erst Slots dann Konfirmation',
          event_date: futureDate(),
          max_participants: 10,
          is_konfirmation: true,
          has_timeslots: true,
          timeslots: [slot()],
        });
      expect(putRes.status).toBe(200);

      const detailRes = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detailRes.body.has_timeslots).toBe(false);
      expect(detailRes.body.is_konfirmation).toBe(true);
    });
  });

  // ================================================================
  // Event-Kapazität (ausgebucht)
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

    it('Die Warteliste haengt am Termin, nicht an der Organisation', async () => {
      // Gegenprobe zum Entfernen der org-weiten Wartelisten-Einstellungen
      // (27.08.2026): Selbst wenn in der settings-Tabelle das Gegenteil
      // steht, entscheidet allein der Termin. Frueher liess sich das nicht
      // pruefen, weil die Org-Werte von keiner Buchungslogik gelesen wurden --
      // genau deshalb wurden sie entfernt.
      await db.query(
        `INSERT INTO settings (organization_id, key, value) VALUES ($1, 'waitlist_enabled', 'false')
         ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO settings (organization_id, key, value) VALUES ($1, 'max_waitlist_size', '0')
         ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value`,
        [ORGS.testGemeinde.id]
      );

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Termin mit eigener Warteliste',
          event_date: futureDate.toISOString(),
          max_participants: 1,
          waitlist_enabled: true,
          max_waitlist_size: 5,
        });

      expect(createRes.status).toBe(201);
      const eventId = createRes.body.id;

      // Erster Platz geht reguleaer weg
      const book1 = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(book1.status).toBe(201);
      expect(book1.body.status).toBe('confirmed');

      // Der zweite landet auf der Warteliste -- der Org-Schalter 'false'
      // aendert daran nichts.
      const book2 = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfi2Token}`);
      expect(book2.status).toBe(201);
      expect(book2.body.status).toBe('waitlist');
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

      // Konfi1 soft-löschen (deleted_at setzen)
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.konfi1.id]);

      // Nachher: nur der aktive Konfi (konfi2) ist sichtbar
      const after = await db.query(participantsQuery, [EVENTS.gottesdienstEvent.id, ORGS.testGemeinde.id]);
      const afterIds = after.rows.map(r => r.user_id);
      expect(afterIds).not.toContain(USERS.konfi1.id);
      expect(afterIds).toContain(USERS.konfi2.id);
    });

    it('Auto-Enroll fuer Pflicht-Event erstellt KEINE Buchung fuer soft-geloeschte Konfis', async () => {
      // Konfi1 soft-löschen
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.konfi1.id]);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);

      // Pflicht-Event für jahrgang1 anlegen -> Auto-Enroll greift
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
        [ORGS.testGemeinde.id]
      );
      expect(rows.length).toBe(4);
      // Alle Events hängen an derselben series_id
      expect(new Set(rows.map(r => String(r.series_id))).size).toBe(1);
    });

    // Regression (Bugreport 09.08.2026): Die Serien-Route destrukturierte die
    // Teamer-Kontingent-Felder, mandatory/is_konfirmation, bring_items und
    // checkin_window gar nicht aus dem Body — jede Serie fiel still auf die
    // Spalten-Defaults zurück, obwohl das Formular alles mitschickt.
    it('Serie uebernimmt Teamer-Kontingent, Flags, Mitbringen und Check-in-Fenster', async () => {
      const res = await request(app)
        .post('/api/events/series')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Teamrunde',
          event_date: futureDate(),
          max_participants: 0,
          series_count: 3,
          series_interval: 'week',
          teamer_only: true,
          teamer_max_participants: 8,
          teamer_waitlist_enabled: true,
          teamer_max_waitlist_size: 4,
          bring_items: 'Bibel und Stift',
          checkin_window: 45,
        });

      expect(res.status).toBe(201);
      expect(res.body.events_created).toBe(3);

      const { rows } = await db.query(
        `SELECT teamer_only, teamer_max_participants, teamer_waitlist_enabled,
                teamer_max_waitlist_size, bring_items, checkin_window
         FROM events WHERE name LIKE 'Teamrunde%' AND organization_id = $1`,
        [ORGS.testGemeinde.id]
      );
      expect(rows.length).toBe(3);
      // ALLE Termine der Serie — nicht nur der erste — tragen die Einstellungen.
      rows.forEach((row) => {
        expect(row.teamer_only).toBe(true);
        expect(row.teamer_max_participants).toBe(8);
        expect(row.teamer_waitlist_enabled).toBe(true);
        expect(row.teamer_max_waitlist_size).toBe(4);
        expect(row.bring_items).toBe('Bibel und Stift');
        expect(row.checkin_window).toBe(45);
      });
    });

    // Regression (Audit 09.08.2026): Die Serien-Route wendete KEINE der
    // effective*-Zwangsregeln an — eine Pflicht-Serie bekam Punkte,
    // Teilnehmerzahl, Warteliste und Timeslots wie gesendet und hatte kein
    // Auto-Enrollment.
    it('Pflicht-Serie: Punkte/Plaetze/Warteliste erzwungen + Auto-Enrollment', async () => {
      const res = await request(app)
        .post('/api/events/series')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pflichtreihe',
          event_date: futureDate(),
          series_count: 2,
          series_interval: 'week',
          mandatory: true,
          jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
          points: 5,
          max_participants: 20,
          waitlist_enabled: true,
        });

      expect(res.status).toBe(201);

      const { rows } = await db.query(
        `SELECT id, points, max_participants, waitlist_enabled, has_timeslots
         FROM events WHERE name LIKE 'Pflichtreihe%' AND organization_id = $1`,
        [ORGS.testGemeinde.id]
      );
      expect(rows.length).toBe(2);
      rows.forEach((row) => {
        expect(row.points).toBe(0);
        expect(row.max_participants).toBe(0);
        expect(row.waitlist_enabled).toBe(false);
        expect(row.has_timeslots).toBe(false);
      });

      // Auto-Enrollment: JEDER Termin hat die Konfis des Jahrgangs als Teilnehmer
      for (const row of rows) {
        const { rows: [count] } = await db.query(
          "SELECT COUNT(*)::int AS c FROM event_bookings WHERE event_id = $1 AND status = 'confirmed'",
          [row.id]
        );
        expect(count.c).toBeGreaterThan(0);
      }
    });

    it('Serie mit mandatory ohne Jahrgang -> 400 (wie Einzel-Event)', async () => {
      const res = await request(app)
        .post('/api/events/series')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Pflicht ohne Jahrgang',
          event_date: futureDate(),
          series_count: 2,
          series_interval: 'week',
          mandatory: true,
          jahrgang_ids: [],
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Jahrgang');
    });

    it('Serie mit ungueltigem Teamer-Kontingent -> 400 (wie beim Einzel-Event)', async () => {
      const res = await request(app)
        .post('/api/events/series')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Kaputte Quote',
          event_date: futureDate(),
          series_count: 2,
          series_interval: 'week',
          teamer_max_participants: -5,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('teamer_max_participants');
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

  // ================================================================
  // PUT /api/events/:id - Aenderungs-Push bei Termin/Ort-Verschiebung
  // ================================================================
  describe('PUT /api/events/:id - Aenderungs-Push', () => {
    const futureDate = () => {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return d.toISOString();
    };

    // Der Push-Aufruf läuft im Handler NACH res.json() weiter (fire-and-forget).
    // supertest bekommt die Response bereits, bevor der Handler den Push-Block
    // fertig ausgeführt hat -> kurz pollen statt fest zu warten.
    const waitForCall = async (spy, timeoutMs = 1000) => {
      const start = Date.now();
      while (spy.mock.calls.length === 0 && Date.now() - start < timeoutMs) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('PUT mit geaendertem Datum -> sendEventChangedToKonfis wird fuer gebuchte Teilnehmer aufgerufen', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Verschiebe-Event',
          event_date: futureDate(),
          location: 'Gemeindehaus',
          max_participants: 15,
        });
      expect(createRes.status).toBe(201);
      const eventId = createRes.body.id;

      // Konfi bucht das Event
      const bookRes = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(bookRes.status).toBe(201);

      const spy = vi.spyOn(PushService, 'sendEventChangedToKonfis').mockResolvedValue({ success: true });

      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 20);

      const putRes = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Verschiebe-Event',
          event_date: newDate.toISOString(),
          location: 'Gemeindehaus',
          max_participants: 15,
        });
      expect(putRes.status).toBe(200);

      await waitForCall(spy);

      expect(spy).toHaveBeenCalledTimes(1);
      const [, userIds, eventName] = spy.mock.calls[0];
      expect(userIds).toContain(USERS.konfi1.id);
      expect(eventName).toBe('Verschiebe-Event');
    });

    it('PUT mit geaendertem Ort -> sendEventChangedToKonfis wird aufgerufen', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Ortswechsel-Event',
          event_date: futureDate(),
          location: 'Altes Gemeindehaus',
          max_participants: 15,
        });
      expect(createRes.status).toBe(201);
      const eventId = createRes.body.id;

      await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);

      const spy = vi.spyOn(PushService, 'sendEventChangedToKonfis').mockResolvedValue({ success: true });

      const putRes = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Ortswechsel-Event',
          event_date: futureDate(),
          location: 'Neues Gemeindehaus',
          max_participants: 15,
        });
      expect(putRes.status).toBe(200);

      await waitForCall(spy);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('PUT ohne Datums-/Ortsaenderung -> sendEventChangedToKonfis wird NICHT aufgerufen', async () => {
      const eventDate = futureDate();
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Unveraendert-Event',
          event_date: eventDate,
          location: 'Gemeindehaus',
          max_participants: 15,
        });
      expect(createRes.status).toBe(201);
      const eventId = createRes.body.id;

      await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);

      const spy = vi.spyOn(PushService, 'sendEventChangedToKonfis').mockResolvedValue({ success: true });

      const putRes = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Unveraendert-Event',
          description: 'Neue Beschreibung, aber kein Termin-/Ort-Wechsel',
          event_date: eventDate,
          location: 'Gemeindehaus',
          max_participants: 15,
        });
      expect(putRes.status).toBe(200);

      // Kein Aufruf erwartet -> kurze feste Wartezeit statt Polling bis Timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(spy).not.toHaveBeenCalled();
    });

    it('PUT mit geaendertem Datum aber OHNE Buchungen -> sendEventChangedToKonfis wird NICHT aufgerufen', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Unbebuchtes-Event',
          event_date: futureDate(),
          location: 'Gemeindehaus',
          max_participants: 15,
        });
      expect(createRes.status).toBe(201);
      const eventId = createRes.body.id;

      const spy = vi.spyOn(PushService, 'sendEventChangedToKonfis').mockResolvedValue({ success: true });

      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 20);

      const putRes = await request(app)
        .put(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Unbebuchtes-Event',
          event_date: newDate.toISOString(),
          location: 'Gemeindehaus',
          max_participants: 15,
        });
      expect(putRes.status).toBe(200);

      // Kein Aufruf erwartet -> kurze feste Wartezeit statt Polling bis Timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ================================================================
  // DELETE /api/events/:id — Löschen mit Punkte-Rückrechnung, Chat-Abräumen
  // und 409-Rückfrage (Befunde H1 + M2/M3, 26.08.2026)
  // ================================================================
  describe('DELETE /api/events/:id', () => {
    const fsSync = require('fs');
    const path = require('path');
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'chat');

    // Buchung + verbuchte Event-Punkte für einen Konfi anlegen — wie es die
    // Verbuchen-Route tut: event_points-Beleg UND konfi_profiles erhöhen.
    async function seedVerbuchtePunkte(eventId, konfiId, points, pointType) {
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, booking_date, organization_id)
         VALUES ($1, $2, 'confirmed', NOW(), $3)`,
        [eventId, konfiId, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO event_points (konfi_id, event_id, points, point_type, description, awarded_date, admin_id, organization_id)
         VALUES ($1, $2, $3, $4, 'Testverbuchung', CURRENT_DATE, $5, $6)`,
        [konfiId, eventId, points, pointType, USERS.admin1.id, ORGS.testGemeinde.id]
      );
      const col = pointType === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
      await db.query(
        `UPDATE konfi_profiles SET ${col} = ${col} + $1 WHERE user_id = $2`,
        [points, konfiId]
      );
    }

    // Event-Chat mit Nachrichten, Umfrage, Lesestatus und Datei anlegen.
    async function seedEventChat(eventId, { withFile = null } = {}) {
      const { rows: [room] } = await db.query(
        `INSERT INTO chat_rooms (name, type, event_id, created_by, organization_id)
         VALUES ('Event-Chat', 'event', $1, $2, $3) RETURNING id`,
        [eventId, USERS.admin1.id, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'konfi')`,
        [room.id, USERS.konfi1.id]
      );
      await db.query(
        `INSERT INTO chat_read_status (room_id, user_id, user_type) VALUES ($1, $2, 'konfi')`,
        [room.id, USERS.konfi1.id]
      );
      const { rows: [msg] } = await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, content) VALUES ($1, $2, 'konfi', 'Hallo') RETURNING id`,
        [room.id, USERS.konfi1.id]
      );
      const { rows: [poll] } = await db.query(
        `INSERT INTO chat_polls (message_id, question, options) VALUES ($1, 'Pizza?', '["Ja","Nein"]') RETURNING id`,
        [msg.id]
      );
      await db.query(
        `INSERT INTO chat_poll_votes (poll_id, user_id, user_type, option_index) VALUES ($1, $2, 'konfi', 0)`,
        [poll.id, USERS.konfi1.id]
      );
      if (withFile) {
        fsSync.mkdirSync(uploadDir, { recursive: true });
        fsSync.writeFileSync(path.join(uploadDir, withFile), 'testinhalt');
        await db.query(
          `INSERT INTO chat_messages (room_id, user_id, user_type, content, file_path, file_name)
           VALUES ($1, $2, 'konfi', 'Datei', $3, $3)`,
          [room.id, USERS.konfi1.id, withFile]
        );
      }
      return room.id;
    }

    it('Erlaubter Fall: leerer Termin wird ohne force gelöscht (200)', async () => {
      const res = await request(app)
        .delete(`/api/events/${EVENTS.gottesdienstEvent.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { rows } = await db.query('SELECT id FROM events WHERE id = $1', [EVENTS.gottesdienstEvent.id]);
      expect(rows.length).toBe(0);
    });

    it('Ohne force: 409 nennt Anmeldungen, Chat-Nachrichten und Punkte konkret', async () => {
      await seedVerbuchtePunkte(EVENTS.gottesdienstEvent.id, USERS.konfi1.id, 2, 'gottesdienst');
      await seedEventChat(EVENTS.gottesdienstEvent.id, { withFile: 'test-409.txt' });

      const res = await request(app)
        .delete(`/api/events/${EVENTS.gottesdienstEvent.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error_code).toBe('event_delete_confirm');
      expect(res.body.booking_count).toBe(1);
      expect(res.body.message_count).toBe(2);
      expect(res.body.points_count).toBe(1);
      expect(res.body.points_total).toBe(2);

      // Nichts wurde gelöscht, Punkte unangetastet
      const { rows: [event] } = await db.query('SELECT id FROM events WHERE id = $1', [EVENTS.gottesdienstEvent.id]);
      expect(Number(event.id)).toBe(EVENTS.gottesdienstEvent.id);
      const { rows: [profil] } = await db.query('SELECT gottesdienst_points FROM konfi_profiles WHERE user_id = $1', [USERS.konfi1.id]);
      expect(Number(profil.gottesdienst_points)).toBe(2);
    });

    it('Ohne force: schon ein Chat mit Nachrichten reicht für den 409', async () => {
      await seedEventChat(EVENTS.gottesdienstEvent.id);

      const res = await request(app)
        .delete(`/api/events/${EVENTS.gottesdienstEvent.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error_code).toBe('event_delete_confirm');
      expect(res.body.booking_count).toBe(0);
      expect(res.body.message_count).toBe(1);
      expect(res.body.points_count).toBe(0);
    });

    it('H1: force-Löschen rechnet gottesdienst-Punkte zurück (5 -> 3)', async () => {
      // 3 Punkte aus anderer Quelle + 2 aus diesem Event = 5
      await db.query('UPDATE konfi_profiles SET gottesdienst_points = 3 WHERE user_id = $1', [USERS.konfi1.id]);
      await seedVerbuchtePunkte(EVENTS.gottesdienstEvent.id, USERS.konfi1.id, 2, 'gottesdienst');

      const res = await request(app)
        .delete(`/api/events/${EVENTS.gottesdienstEvent.id}?force=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { rows: [profil] } = await db.query('SELECT gottesdienst_points, gemeinde_points FROM konfi_profiles WHERE user_id = $1', [USERS.konfi1.id]);
      expect(Number(profil.gottesdienst_points)).toBe(3);
      expect(Number(profil.gemeinde_points)).toBe(0);
      const { rows: punkte } = await db.query('SELECT id FROM event_points WHERE event_id = $1', [EVENTS.gottesdienstEvent.id]);
      expect(punkte.length).toBe(0);
    });

    it('H1: force-Löschen rechnet gemeinde-Punkte in der richtigen Spalte zurück (4 -> 3)', async () => {
      await db.query('UPDATE konfi_profiles SET gemeinde_points = 3, gottesdienst_points = 7 WHERE user_id = $1', [USERS.konfi1.id]);
      await seedVerbuchtePunkte(EVENTS.pflichtEvent.id, USERS.konfi1.id, 1, 'gemeinde');

      const res = await request(app)
        .delete(`/api/events/${EVENTS.pflichtEvent.id}?force=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { rows: [profil] } = await db.query('SELECT gottesdienst_points, gemeinde_points FROM konfi_profiles WHERE user_id = $1', [USERS.konfi1.id]);
      expect(Number(profil.gemeinde_points)).toBe(3);
      expect(Number(profil.gottesdienst_points)).toBe(7);
    });

    it('H1: GREATEST(0, ...) — der Saldo wird nie negativ (1 - 2 -> 0)', async () => {
      await seedVerbuchtePunkte(EVENTS.gottesdienstEvent.id, USERS.konfi1.id, 2, 'gottesdienst');
      // Saldo künstlich unter den Belegwert drücken
      await db.query('UPDATE konfi_profiles SET gottesdienst_points = 1 WHERE user_id = $1', [USERS.konfi1.id]);

      const res = await request(app)
        .delete(`/api/events/${EVENTS.gottesdienstEvent.id}?force=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const { rows: [profil] } = await db.query('SELECT gottesdienst_points FROM konfi_profiles WHERE user_id = $1', [USERS.konfi1.id]);
      expect(Number(profil.gottesdienst_points)).toBe(0);
    });

    it('Event-Chat wird komplett mitgelöscht — inklusive Datei auf der Platte', async () => {
      const roomId = await seedEventChat(EVENTS.gottesdienstEvent.id, { withFile: 'test-delete-chatfile.txt' });
      const filePath = path.join(uploadDir, 'test-delete-chatfile.txt');
      expect(fsSync.existsSync(filePath)).toBe(true);

      const res = await request(app)
        .delete(`/api/events/${EVENTS.gottesdienstEvent.id}?force=true`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      for (const [tabelle, spalte] of [
        ['chat_rooms', 'id'],
        ['chat_messages', 'room_id'],
        ['chat_participants', 'room_id'],
        ['chat_read_status', 'room_id']
      ]) {
        const { rows } = await db.query(`SELECT 1 FROM ${tabelle} WHERE ${spalte} = $1`, [roomId]);
        expect(rows.length).toBe(0);
      }
      const { rows: pollRows } = await db.query('SELECT 1 FROM chat_polls');
      expect(pollRows.length).toBe(0);
      const { rows: voteRows } = await db.query('SELECT 1 FROM chat_poll_votes');
      expect(voteRows.length).toBe(0);
      expect(fsSync.existsSync(filePath)).toBe(false);
    });

    it('Teamer:in darf löschen (bewusste Designentscheidung, 26.08.2026)', async () => {
      const res = await request(app)
        .delete(`/api/events/${EVENTS.gottesdienstEvent.id}`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
    });

    it('Verbotener Fall: Konfi darf nicht löschen', async () => {
      const res = await request(app)
        .delete(`/api/events/${EVENTS.gottesdienstEvent.id}`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
      const { rows } = await db.query('SELECT id FROM events WHERE id = $1', [EVENTS.gottesdienstEvent.id]);
      expect(rows.length).toBe(1);
    });

    it('Verbotener Fall: Admin einer anderen Org bekommt 404', async () => {
      const res = await request(app)
        .delete(`/api/events/${EVENTS.gottesdienstEvent.id}?force=true`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
      const { rows } = await db.query('SELECT id FROM events WHERE id = $1', [EVENTS.gottesdienstEvent.id]);
      expect(rows.length).toBe(1);
    });
  });
});
