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
      // Aggregierte Felder pruefen
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
      // konfi2 hat keinen Spruch gewaehlt
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
      // Konfirmations-Event fuer Jahrgang1 anlegen + zuordnen (is_konfirmation)
      await db.query(
        `UPDATE events SET is_konfirmation = true WHERE id = $1`,
        [EVENTS.gottesdienstEvent.id]
      );
      await db.query(
        `INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [EVENTS.gottesdienstEvent.id, JAHRGAENGE.jahrgang1.id]
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
      // jede Zeile traegt Name, Konfirmationstermin und Spruch-Feld
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
});
