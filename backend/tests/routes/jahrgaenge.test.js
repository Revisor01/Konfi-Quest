const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, EVENTS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

// emailService: in der Testumgebung gibt es keinen SMTP-Server. Die matrix-email-
// Route ruft emailService.sendKonfiMatrixEmail auf. Statt vi.mock (greift bei diesem
// CJS-Setup nicht zuverlaessig) wird die Methode pro Test per vi.spyOn auf der real
// geladenen Modul-Instanz ersetzt -> Route und Test teilen dieselbe Instanz.
const emailService = require('../../services/emailService');

describe('Jahrgaenge Routes', () => {
  let app;
  let db;
  let adminToken;
  let teamerToken;
  let konfiToken;
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
    admin2Token = generateToken('admin2');

    // Jahrgangs-Bindung (01.09.2026): Liste, PUT, DELETE, Matrix, Sprueche
    // und matrix-email verlangen seither eine Zuweisung — admin1 hat im Seed
    // bewusst keine. Fuer die Bestandstests bekommt er jahrgang1; die Faelle
    // OHNE Zuweisung stehen in jahrgangsBindungAdmin.test.js.
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin2.id, JAHRGAENGE.jahrgang2.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
    require('../../middleware/rbac').invalidateUserCache(USERS.admin2.id);
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // GET /api/admin/jahrgaenge
  // ================================================================
  describe('GET /api/admin/jahrgaenge', () => {
    it('Admin bekommt 200 + Array mit Jahrgaengen der eigenen Org', async () => {
      const res = await request(app)
        .get('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Org 1 hat 1 Jahrgang
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe(JAHRGAENGE.jahrgang1.name);
      // Aggregierte Felder prüfen
      expect(res.body[0].konfi_count).toBeDefined();
      // konfspruch_enabled wird pro Jahrgang geliefert (D-01)
      expect(res.body[0].konfspruch_enabled).toBe(true);
    });

    it('Teamer bekommt 200 (requireTeamer erlaubt Teamer)', async () => {
      const res = await request(app)
        .get('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Ohne Token bekommt 401', async () => {
      const res = await request(app)
        .get('/api/admin/jahrgaenge');

      expect(res.status).toBe(401);
    });

    it('Admin aus Org 2 sieht nur eigene Jahrgaenge', async () => {
      const res = await request(app)
        .get('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].id).toBe(JAHRGAENGE.jahrgang2.id);
    });
  });

  // ================================================================
  // POST /api/admin/jahrgaenge
  // ================================================================
  describe('POST /api/admin/jahrgaenge', () => {
    it('Admin erstellt Jahrgang -> 201', async () => {
      const res = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '2026/2027', confirmation_date: '2027-05-01' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('2026/2027');
    });

    it('Teamer bekommt 403 auf POST', async () => {
      const res = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ name: '2026/2027', confirmation_date: '2027-05-01' });

      expect(res.status).toBe(403);
    });

    it('Leerer Name gibt 400', async () => {
      const res = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '', confirmation_date: '2027-05-01' });

      expect(res.status).toBe(400);
    });

    it('Fehlendes confirmation_date ist erlaubt -> 201 (D-04: kein Pflichtfeld mehr)', async () => {
      // confirmation_date wird in Phase 119 entkoppelt. POST ohne das Feld muss
      // auch im Prod-Schema funktionieren (Migration 094 droppt den NOT-NULL-Constraint).
      const res = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '2026/2027' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('2026/2027');
    });

    it('Jahrgang mit optionalen Feldern erstellen', async () => {
      const res = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '2026/2027',
          gottesdienst_enabled: true,
          gemeinde_enabled: false,
          target_gottesdienst: 15,
          target_gemeinde: 0,
        });

      expect(res.status).toBe(201);
      expect(res.body.gottesdienst_enabled).toBe(true);
      expect(res.body.gemeinde_enabled).toBe(false);
    });

    it('Ohne konfspruch_enabled -> 201, defaultet auf true (D-03)', async () => {
      const res = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '2026/2027' });

      expect(res.status).toBe(201);
      expect(res.body.konfspruch_enabled).toBe(true);
    });

    it('Mit konfspruch_enabled=false -> 201, persistiert false (D-01)', async () => {
      const res = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '2026/2027', konfspruch_enabled: false });

      expect(res.status).toBe(201);
      expect(res.body.konfspruch_enabled).toBe(false);
    });

    it('konfspruch_enabled als Nicht-Boolean -> 400', async () => {
      const res = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '2026/2027', konfspruch_enabled: 'ja' });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  // PUT /api/admin/jahrgaenge/:id
  // ================================================================
  describe('PUT /api/admin/jahrgaenge/:id', () => {
    it('Admin aktualisiert Jahrgang -> 200', async () => {
      const res = await request(app)
        .put(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Umbenannt 2025/2026' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('aktualisiert');
    });

    it('Fehlendes confirmation_date ist erlaubt -> 200 (D-04: kein Pflichtfeld mehr)', async () => {
      const res = await request(app)
        .put(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Umbenannt 2025/2026' });

      expect(res.status).toBe(200);
    });

    it('PUT mit konfspruch_enabled=false -> 200, GET zeigt false (D-01)', async () => {
      const putRes = await request(app)
        .put(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '2025/2026', konfspruch_enabled: false });

      expect(putRes.status).toBe(200);

      const getRes = await request(app)
        .get('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`);

      const jg = getRes.body.find(j => j.id === JAHRGAENGE.jahrgang1.id);
      expect(jg.konfspruch_enabled).toBe(false);
    });

    it('PUT ohne konfspruch_enabled laesst bestehenden Wert unveraendert (COALESCE)', async () => {
      // Zuerst auf false setzen
      await request(app)
        .put(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '2025/2026', konfspruch_enabled: false });

      // Dann ohne das Feld erneut aktualisieren
      await request(app)
        .put(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Neuer Name' });

      const getRes = await request(app)
        .get('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`);

      const jg = getRes.body.find(j => j.id === JAHRGAENGE.jahrgang1.id);
      expect(jg.konfspruch_enabled).toBe(false);
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .put('/api/admin/jahrgaenge/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test' });

      expect(res.status).toBe(404);
    });

    it('Admin aus Org 2 kann Jahrgang aus Org 1 NICHT aendern -> 404', async () => {
      const res = await request(app)
        .put(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ name: 'Versuch' });

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // DELETE /api/admin/jahrgaenge/:id
  // ================================================================
  describe('DELETE /api/admin/jahrgaenge/:id', () => {
    it('Jahrgang mit Konfis gibt 409 (in Benutzung)', async () => {
      // Jahrgang 1 hat Konfis zugeordnet
      const res = await request(app)
        .delete(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
    });

    it('Admin loescht leeren Jahrgang -> 200', async () => {
      // Neuen leeren Jahrgang erstellen
      const createRes = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Leerer Jahrgang', confirmation_date: '2027-05-01' });

      const newId = createRes.body.id;

      const res = await request(app)
        .delete(`/api/admin/jahrgaenge/${newId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelöscht');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .delete('/api/admin/jahrgaenge/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('Befoerderter Ex-Konfi (Rolle teamer) blockiert die Loeschung NICHT', async () => {
      // Neuer leerer Jahrgang
      const createRes = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Befoerderungs-Jahrgang', confirmation_date: '2027-05-01' });
      const newId = createRes.body.id;

      // teamer1 (id 3, Rolle teamer) bekommt ein konfi_profiles an diesem Jahrgang
      // — simuliert einen beförderten Konfi mit erhaltenen WERTEN (Punkte etc.).
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
         VALUES (3, $1, 5, 3, 1)`,
        [newId]
      );

      // Löschung muss durchgehen (kein 409), trotz vorhandenem konfi_profiles.
      const res = await request(app)
        .delete(`/api/admin/jahrgaenge/${newId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      // WICHTIG: Profil bleibt ERHALTEN (Werte einsehbar), nur Jahrgang-Bindung
      // gelöst (jahrgang_id = NULL). Punkte unverändert. User bleibt.
      const { rows: profiles } = await db.query(
        'SELECT jahrgang_id, gottesdienst_points, gemeinde_points FROM konfi_profiles WHERE user_id = 3'
      );
      expect(profiles.length).toBe(1);
      expect(profiles[0].jahrgang_id).toBeNull();
      expect(Number(profiles[0].gottesdienst_points)).toBe(5);
      expect(Number(profiles[0].gemeinde_points)).toBe(3);
      const { rows: users } = await db.query('SELECT 1 FROM users WHERE id = 3');
      expect(users.length).toBe(1);
    });

    it('AKTIVER Konfi blockiert die Loeschung weiterhin (409)', async () => {
      const createRes = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Aktiv-Konfi-Jahrgang', confirmation_date: '2027-05-01' });
      const newId = createRes.body.id;

      // konfi1 (id 1, Rolle konfi) an den Jahrgang -> muss blockieren
      await db.query('UPDATE konfi_profiles SET jahrgang_id = $1 WHERE user_id = 1', [newId]);

      const res = await request(app)
        .delete(`/api/admin/jahrgaenge/${newId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(409);
    });

    it('Admin aus Org 2 kann Jahrgang aus Org 1 NICHT loeschen', async () => {
      // Neuen leeren Jahrgang in Org 1 erstellen
      const createRes = await request(app)
        .post('/api/admin/jahrgaenge')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Org1 Jahrgang', confirmation_date: '2027-05-01' });

      const res = await request(app)
        .delete(`/api/admin/jahrgaenge/${createRes.body.id}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // GET /api/admin/jahrgaenge/:id/attendance-matrix
  // ================================================================
  describe('GET /api/admin/jahrgaenge/:id/attendance-matrix', () => {
    beforeEach(async () => {
      // Pflichtevent dem Jahrgang1 zuordnen
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [EVENTS.pflichtEvent.id, JAHRGAENGE.jahrgang1.id]
      );
      // konfi1: anwesend, konfi2: abwesend (booking aber kein attendance)
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, attendance_status, organization_id)
         VALUES ($1, $2, 'confirmed', 'present', $4),
                ($1, $3, 'confirmed', 'absent',  $4)
         ON CONFLICT (user_id, event_id) DO UPDATE SET attendance_status = EXCLUDED.attendance_status`,
        [EVENTS.pflichtEvent.id, USERS.konfi1.id, USERS.konfi2.id, 1]
      );
    });

    it('Admin bekommt Matrix mit Konfis, Events und Bookings', async () => {
      const res = await request(app)
        .get(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/attendance-matrix`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.jahrgang.id).toBe(JAHRGAENGE.jahrgang1.id);
      expect(Array.isArray(res.body.konfis)).toBe(true);
      expect(Array.isArray(res.body.events)).toBe(true);
      expect(Array.isArray(res.body.bookings)).toBe(true);

      // mindestens konfi1+konfi2 in Liste
      const konfiIds = res.body.konfis.map(k => k.user_id);
      expect(konfiIds).toContain(USERS.konfi1.id);
      expect(konfiIds).toContain(USERS.konfi2.id);

      // Pflichtevent in events
      const eventIds = res.body.events.map(e => e.id);
      expect(eventIds).toContain(EVENTS.pflichtEvent.id);

      // konfi1 = present, konfi2 = absent
      const present = res.body.bookings.find(b => b.user_id === USERS.konfi1.id && b.event_id === EVENTS.pflichtEvent.id);
      const absent = res.body.bookings.find(b => b.user_id === USERS.konfi2.id && b.event_id === EVENTS.pflichtEvent.id);
      expect(present.attendance_status).toBe('present');
      expect(absent.attendance_status).toBe('absent');
    });

    it('Teamer bekommt 403 (requireAdmin)', async () => {
      const res = await request(app)
        .get(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/attendance-matrix`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });

    it('Admin aus anderer Org bekommt 404', async () => {
      const res = await request(app)
        .get(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/attendance-matrix`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });

    it('Nicht-existierende Jahrgang-ID gibt 404', async () => {
      const res = await request(app)
        .get('/api/admin/jahrgaenge/99999/attendance-matrix')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // GET /api/admin/jahrgaenge/:id/sprueche
  // ================================================================
  describe('GET /api/admin/jahrgaenge/:id/sprueche', () => {
    let spruchId;

    beforeEach(async () => {
      // truncateAll leert konfsprueche vor jedem Test (Migration-Seed weg) ->
      // den globalen Spruch + Uebersetzung hier frisch anlegen (analog konfi.test.js).
      const { rows: [spruch] } = await db.query(
        `INSERT INTO konfsprueche (reference, book, chapter, verse, organization_id, sort_order)
         VALUES ('Psalm 23,1', 'Psalm', 23, 1, NULL, 1)
         RETURNING id`
      );
      spruchId = spruch.id;
      await db.query(
        `INSERT INTO konfspruch_uebersetzungen (spruch_id, translation, text)
         VALUES ($1, 'luther2017', 'Der Herr ist mein Hirte.')`,
        [spruchId]
      );
      // konfi1: Listen-Wahl (Spruch aus der Liste), konfi2: kein Spruch
      await db.query(
        `UPDATE konfi_profiles
         SET konfspruch_id = $1, konfspruch_translation = 'luther2017',
             konfspruch_freitext = NULL, konfspruch_freitext_referenz = NULL
         WHERE user_id = $2`,
        [spruchId, USERS.konfi1.id]
      );
    });

    it('Admin bekommt Liste Konfi -> Spruch (mit und ohne Spruch)', async () => {
      const res = await request(app)
        .get(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/sprueche`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const konfi1Entry = res.body.find(r => r.user_id === USERS.konfi1.id);
      const konfi2Entry = res.body.find(r => r.user_id === USERS.konfi2.id);
      expect(konfi1Entry).toBeDefined();
      expect(konfi1Entry.konfspruch).not.toBeNull();
      expect(konfi1Entry.konfspruch.source).toBe('liste');
      expect(konfi1Entry.konfspruch.text).toBe('Der Herr ist mein Hirte.');
      // konfi2 hat keinen Spruch gewählt
      expect(konfi2Entry).toBeDefined();
      expect(konfi2Entry.konfspruch).toBeNull();
    });

    it('Freitext-Spruch wird mit Referenz geliefert', async () => {
      await db.query(
        `UPDATE konfi_profiles
         SET konfspruch_id = NULL, konfspruch_freitext = 'Mein eigener Spruch',
             konfspruch_freitext_referenz = 'Johannes 3,16'
         WHERE user_id = $1`,
        [USERS.konfi2.id]
      );

      const res = await request(app)
        .get(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/sprueche`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const konfi2Entry = res.body.find(r => r.user_id === USERS.konfi2.id);
      expect(konfi2Entry.konfspruch.source).toBe('freitext');
      expect(konfi2Entry.konfspruch.text).toBe('Mein eigener Spruch');
      expect(konfi2Entry.konfspruch.reference).toBe('Johannes 3,16');
    });

    it('Teamer bekommt 403 (requireAdmin)', async () => {
      const res = await request(app)
        .get(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/sprueche`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });

    it('Admin aus anderer Org bekommt 404', async () => {
      const res = await request(app)
        .get(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/sprueche`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });

    it('laedt die Sprueche aller Konfis in EINER Sammel-Abfrage', async () => {
      // Vorher lief pro Konfi mit Listen-Wahl eine eigene Abfrage
      // (N+1). Gemessen mit zwei solchen Konfis: 4 Abfragen
      // (Jahrgang-Pruefung + Konfi-Liste + 2x Spruch). Seit der
      // Buendelung sind es 3, unabhaengig von der Zahl der Konfis.
      await db.query(
        `INSERT INTO konfsprueche (reference, book, chapter, verse, organization_id, sort_order)
         VALUES ('Johannes 3,16', 'Johannes', 3, 16, NULL, 2)
         RETURNING id`
      );
      const { rows: [zweiterSpruch] } = await db.query(
        `SELECT id FROM konfsprueche WHERE reference = 'Johannes 3,16'`
      );
      await db.query(
        `INSERT INTO konfspruch_uebersetzungen (spruch_id, translation, text)
         VALUES ($1, 'luther2017', 'Also hat Gott die Welt geliebt.')`,
        [zweiterSpruch.id]
      );
      await db.query(
        `UPDATE konfi_profiles
         SET konfspruch_id = $1, konfspruch_translation = 'luther2017'
         WHERE user_id = $2`,
        [zweiterSpruch.id, USERS.konfi2.id]
      );

      // Warm-up: fuellt den rbac-User-Cache (der beforeEach invalidiert ihn
      // seit 01.09.2026), damit der Zaehler unten NUR die Abfragen der Route
      // misst und nicht die Token-Verifikation mitzaehlt.
      await request(app)
        .get(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/sprueche`)
        .set('Authorization', `Bearer ${adminToken}`);

      const abfragen = vi.spyOn(db, 'query');
      const res = await request(app)
        .get(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/sprueche`)
        .set('Authorization', `Bearer ${adminToken}`);
      const anzahl = abfragen.mock.calls.length;
      abfragen.mockRestore();

      expect(res.status).toBe(200);
      expect(anzahl).toBe(3);

      // Und die Sprueche stimmen trotz Buendelung.
      const konfi1Entry = res.body.find(r => r.user_id === USERS.konfi1.id);
      const konfi2Entry = res.body.find(r => r.user_id === USERS.konfi2.id);
      expect(konfi1Entry.konfspruch.text).toBe('Der Herr ist mein Hirte.');
      expect(konfi2Entry.konfspruch.text).toBe('Also hat Gott die Welt geliebt.');
      expect(konfi2Entry.konfspruch.reference).toBe('Johannes 3,16');
    });

    it('derselbe Spruch in zwei Uebersetzungen bleibt auseinandergehalten', async () => {
      // Die Uebersetzung haengt am Konfi, nicht am Spruch. Wuerde die
      // Sammel-Abfrage nur nach spruch_id zuordnen, bekaemen beide Konfis
      // denselben Text.
      await db.query(
        `INSERT INTO konfspruch_uebersetzungen (spruch_id, translation, text)
         VALUES ($1, 'bigs', 'Adonaj ist meine Hirtin.')`,
        [spruchId]
      );
      await db.query(
        `UPDATE konfi_profiles
         SET konfspruch_id = $1, konfspruch_translation = 'bigs'
         WHERE user_id = $2`,
        [spruchId, USERS.konfi2.id]
      );

      const res = await request(app)
        .get(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/sprueche`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const konfi1Entry = res.body.find(r => r.user_id === USERS.konfi1.id);
      const konfi2Entry = res.body.find(r => r.user_id === USERS.konfi2.id);
      expect(konfi1Entry.konfspruch.text).toBe('Der Herr ist mein Hirte.');
      expect(konfi1Entry.konfspruch.translation).toBe('luther2017');
      expect(konfi2Entry.konfspruch.text).toBe('Adonaj ist meine Hirtin.');
      expect(konfi2Entry.konfspruch.translation).toBe('bigs');
    });

    it('fehlende Uebersetzung liefert leeren Text, nicht null', async () => {
      // LEFT JOIN auf konfspruch_uebersetzungen: den Spruch gibt es, die
      // gewaehlte Uebersetzung nicht. Die Antwortform bleibt gleich
      // (source/id/reference vorhanden, text ist '').
      await db.query(
        `UPDATE konfi_profiles
         SET konfspruch_id = $1, konfspruch_translation = 'gibtesnicht'
         WHERE user_id = $2`,
        [spruchId, USERS.konfi2.id]
      );

      const res = await request(app)
        .get(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/sprueche`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const konfi2Entry = res.body.find(r => r.user_id === USERS.konfi2.id);
      expect(konfi2Entry.konfspruch.source).toBe('liste');
      expect(konfi2Entry.konfspruch.id).toBe(spruchId);
      expect(konfi2Entry.konfspruch.reference).toBe('Psalm 23,1');
      expect(konfi2Entry.konfspruch.text).toBe('');
      expect(konfi2Entry.konfspruch.translation).toBe('gibtesnicht');
    });

    it('ein Spruch aus einer FREMDEN Org wird nicht aufgeloest', async () => {
      // Die Org-Schranke (organization_id IS NULL OR = eigene) muss die
      // Buendelung ueberleben.
      const { rows: [fremd] } = await db.query(
        `INSERT INTO konfsprueche (reference, book, chapter, verse, organization_id, sort_order)
         VALUES ('Rut 1,16', 'Rut', 1, 16, 2, 3)
         RETURNING id`
      );
      await db.query(
        `INSERT INTO konfspruch_uebersetzungen (spruch_id, translation, text)
         VALUES ($1, 'luther2017', 'Wo du hingehst, da will auch ich hingehen.')`,
        [fremd.id]
      );
      await db.query(
        `UPDATE konfi_profiles
         SET konfspruch_id = $1, konfspruch_translation = 'luther2017'
         WHERE user_id = $2`,
        [fremd.id, USERS.konfi2.id]
      );

      const res = await request(app)
        .get(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/sprueche`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const konfi2Entry = res.body.find(r => r.user_id === USERS.konfi2.id);
      expect(konfi2Entry.konfspruch).toBeNull();
    });
  });

  // ================================================================
  // POST /api/admin/jahrgaenge/:id/matrix-email
  // ================================================================
  describe('POST /api/admin/jahrgaenge/:id/matrix-email', () => {
    let sendMailSpy;

    afterEach(() => {
      if (sendMailSpy) sendMailSpy.mockRestore();
    });

    beforeEach(async () => {
      // No-Op-Spy auf der real geladenen emailService-Instanz (CJS-sicher).
      sendMailSpy = vi.spyOn(emailService, 'sendKonfiMatrixEmail')
        .mockResolvedValue({ success: true, messageId: 'test' });
      // Admin1 eine E-Mail-Adresse geben (Seed setzt keine)
      await db.query(`UPDATE users SET email = 'admin1@example.com' WHERE id = $1`, [USERS.admin1.id]);
      // Konfirmations-Event für Jahrgang1 anlegen + zuordnen (is_konfirmation)
      await db.query(
        `UPDATE events SET is_konfirmation = true WHERE id = $1`,
        [EVENTS.gottesdienstEvent.id]
      );
      await db.query(
        `INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [EVENTS.gottesdienstEvent.id, JAHRGAENGE.jahrgang1.id]
      );
      // Konfi1 zum Konfirmations-Event buchen (confirmed) -> sein Termin (pro Konfi, nicht Jahrgang-weit)
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', $3) ON CONFLICT DO NOTHING`,
        [EVENTS.gottesdienstEvent.id, USERS.konfi1.id, USERS.konfi1.org_id]
      );
    });

    it('type=anwesenheit -> 200 + E-Mail-Versand', async () => {
      const res = await request(app)
        .post(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/matrix-email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'anwesenheit' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(emailService.sendKonfiMatrixEmail).toHaveBeenCalledTimes(1);
      const args = emailService.sendKonfiMatrixEmail.mock.calls[0];
      expect(args[0]).toBe('admin1@example.com');
      expect(args[3]).toBe('anwesenheit');
    });

    // Befund 4 (25.08.2026): Abgemeldete ('opted_out') sind KEINE ausstehenden
    // Fälle — die Abmeldung ist eine abgeschlossene Rückmeldung. Der Nenner
    // der Anwesenheitsliste zählte sie trotzdem mit ("1 von 2", obwohl der
    // zweite Termin abgemeldet war). Konsistent zum Kachel-Fix 0db13f09.
    it('type=anwesenheit: Abgemeldete zählen nicht in den Pflicht-Nenner (Befund 4)', async () => {
      // Zwei Pflicht-Events für Jahrgang 1
      await db.query(
        `INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [EVENTS.pflichtEvent.id, JAHRGAENGE.jahrgang1.id]
      );
      const { rows: [zweitesPflicht] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points)
         VALUES ('Zweiter Pflichttermin', NOW() - interval '3 days', $1, true, 0, 'gemeinde', 1)
         RETURNING id`,
        [USERS.admin1.org_id]
      );
      await db.query(
        `INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)`,
        [zweitesPflicht.id, JAHRGAENGE.jahrgang1.id]
      );
      // Konfi1: am ersten Pflichttermin abgemeldet, am zweiten anwesend
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
         VALUES ($1, $2, 'opted_out', $3)`,
        [EVENTS.pflichtEvent.id, USERS.konfi1.id, USERS.konfi1.org_id]
      );
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, attendance_status, organization_id)
         VALUES ($1, $2, 'confirmed', 'present', $3)`,
        [zweitesPflicht.id, USERS.konfi1.id, USERS.konfi1.org_id]
      );

      const res = await request(app)
        .post(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/matrix-email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'anwesenheit' });

      expect(res.status).toBe(200);
      const rows = emailService.sendKonfiMatrixEmail.mock.calls[0][4];
      const konfi1Row = rows.find(r => r.display_name === USERS.konfi1.display_name);
      expect(konfi1Row).toBeDefined();
      // 1 anwesend von 1 zählendem Pflichttermin (der abgemeldete zählt nicht)
      expect(konfi1Row.present_count).toBe(1);
      expect(konfi1Row.total_count).toBe(1);
      // Konfi2 hat keine Abmeldung -> voller Nenner 2
      const konfi2Row = rows.find(r => r.display_name === USERS.konfi2.display_name);
      expect(konfi2Row).toBeDefined();
      expect(konfi2Row.present_count).toBe(0);
      expect(konfi2Row.total_count).toBe(2);
    });

    it('type=sprueche -> 200 + Zeilen enthalten Name, Termin und Spruch', async () => {
      const res = await request(app)
        .post(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/matrix-email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'sprueche' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(emailService.sendKonfiMatrixEmail).toHaveBeenCalledTimes(1);
      const args = emailService.sendKonfiMatrixEmail.mock.calls[0];
      expect(args[3]).toBe('sprueche');
      const rows = args[4];
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
      // jede Zeile trägt Name, Konfirmationstermin und Spruch-Feld
      expect(rows[0]).toHaveProperty('display_name');
      expect(rows[0]).toHaveProperty('konfirmation_date');
      expect(rows[0]).toHaveProperty('konfspruch');
      // Konfirmationstermin aus is_konfirmation-Event ist gesetzt
      expect(rows[0].konfirmation_date).not.toBeNull();
    });

    it('Admin ohne E-Mail-Adresse -> 400', async () => {
      await db.query(`UPDATE users SET email = NULL WHERE id = $1`, [USERS.admin1.id]);
      const res = await request(app)
        .post(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/matrix-email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'anwesenheit' });

      expect(res.status).toBe(400);
      expect(emailService.sendKonfiMatrixEmail).not.toHaveBeenCalled();
    });

    it('Fremder Jahrgang (andere Org) -> 404', async () => {
      await db.query(`UPDATE users SET email = 'admin2@example.com' WHERE id = $1`, [USERS.admin2.id]);
      const res = await request(app)
        .post(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/matrix-email`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ type: 'anwesenheit' });

      expect(res.status).toBe(404);
    });

    it('Ungueltiger type -> 400', async () => {
      const res = await request(app)
        .post(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/matrix-email`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'quatsch' });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  // Mindestens eine Punktart muss aktiv bleiben (Befund 24.08.2026)
  //
  // Die Sperre existierte nur in der Oberflaeche. Per API liess sich ein
  // Jahrgang erzeugen, in dem gar keine Punkte mehr vergeben werden können.
  // ================================================================
  describe('PUT /admin/jahrgaenge/:id — beide Punktarten aus', () => {
    it('beide zugleich abschalten -> 400', async () => {
      const res = await request(app)
        .put(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test', gottesdienst_enabled: false, gemeinde_enabled: false });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Mindestens eine Punktart');
    });

    it('die zweite abschalten, wenn die erste schon aus ist -> 400', async () => {
      await db.query('UPDATE jahrgaenge SET gottesdienst_enabled = false WHERE id = $1',
        [JAHRGAENGE.jahrgang1.id]);

      // Nur gemeinde mitschicken: der Endzustand zählt, nicht die Eingabe.
      const res = await request(app)
        .put(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test', gemeinde_enabled: false });

      expect(res.status).toBe(400);
    });

    it('EINE abschalten bleibt erlaubt -> 200', async () => {
      const res = await request(app)
        .put(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test', gottesdienst_enabled: false });

      expect(res.status).toBe(200);
    });
  });

});
