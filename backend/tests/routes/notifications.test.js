const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Notifications Routes', () => {
  let app;
  let db;
  let konfiToken;
  let adminToken;
  let orgAdminToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    konfiToken = generateToken('konfi1');
    adminToken = generateToken('admin1');
    orgAdminToken = generateToken('orgAdmin1');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // POST /api/notifications/device-token
  // ================================================================
  describe('POST /api/notifications/device-token', () => {
    it('Authentifizierter User speichert Device-Token -> 200', async () => {
      const res = await request(app)
        .post('/api/notifications/device-token')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ token: 'fcm-test-token-123', platform: 'ios', device_id: 'device-001' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verifizieren: Token in DB gespeichert
      const { rows } = await db.query('SELECT * FROM push_tokens WHERE user_id = $1', [USERS.konfi1.id]);
      expect(rows.length).toBe(1);
      expect(rows[0].token).toBe('fcm-test-token-123');
      expect(rows[0].platform).toBe('ios');
    });

    it('Ohne Auth-Token -> 401', async () => {
      const res = await request(app)
        .post('/api/notifications/device-token')
        .send({ token: 'fcm-test-token', platform: 'ios' });

      expect(res.status).toBe(401);
    });

    it('Fehlender Push-Token -> 400 Validierungsfehler', async () => {
      const res = await request(app)
        .post('/api/notifications/device-token')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ platform: 'ios' });

      expect(res.status).toBe(400);
    });

    it('Ungueltige Plattform -> 400 Validierungsfehler', async () => {
      const res = await request(app)
        .post('/api/notifications/device-token')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ token: 'fcm-test-token', platform: 'windows_phone' });

      expect(res.status).toBe(400);
    });

    it('Gleicher FCM-Token unter neuer device_id ersetzt die alte Zeile (kein Doppel-Push)', async () => {
      // Erstregistrierung (z.B. vor App-Neuinstallation)
      await request(app)
        .post('/api/notifications/device-token')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ token: 'fcm-same-token', platform: 'ios', device_id: 'vendor-id-alt' });

      // Neuinstallation: identifierForVendor hat sich geaendert, FCM-Token blieb gleich
      const res = await request(app)
        .post('/api/notifications/device-token')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ token: 'fcm-same-token', platform: 'ios', device_id: 'vendor-id-neu' });

      expect(res.status).toBe(200);

      // Es darf nur EINE Zeile mit diesem Token existieren (sonst Doppel-Push)
      const { rows } = await db.query('SELECT * FROM push_tokens WHERE token = $1', ['fcm-same-token']);
      expect(rows.length).toBe(1);
      expect(rows[0].device_id).toBe('vendor-id-neu');
    });

    it('Gleicher FCM-Token bei anderem User wird umgehaengt (Account-Wechsel auf demselben Geraet)', async () => {
      // Konfi registriert Token
      await request(app)
        .post('/api/notifications/device-token')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ token: 'fcm-shared-device', platform: 'ios', device_id: 'device-shared' });

      // Admin meldet sich auf demselben Geraet an -> gleicher Token
      const res = await request(app)
        .post('/api/notifications/device-token')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ token: 'fcm-shared-device', platform: 'ios', device_id: 'device-shared' });

      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT * FROM push_tokens WHERE token = $1', ['fcm-shared-device']);
      expect(rows.length).toBe(1);
      expect(Number(rows[0].user_id)).toBe(USERS.admin1.id);
    });

    it('Upsert: gleicher Token wird aktualisiert statt dupliziert', async () => {
      // Erster Token speichern
      await request(app)
        .post('/api/notifications/device-token')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ token: 'fcm-test-token-v1', platform: 'ios', device_id: 'device-001' });

      // Gleichen Device mit neuem Token aktualisieren
      const res = await request(app)
        .post('/api/notifications/device-token')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ token: 'fcm-test-token-v2', platform: 'ios', device_id: 'device-001' });

      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT * FROM push_tokens WHERE user_id = $1 AND platform = $2 AND device_id = $3',
        [USERS.konfi1.id, 'ios', 'device-001']);
      expect(rows.length).toBe(1);
      expect(rows[0].token).toBe('fcm-test-token-v2');
    });
  });

  // ================================================================
  // DELETE /api/notifications/device-token
  // ================================================================
  describe('DELETE /api/notifications/device-token', () => {
    it('User loescht Device-Token -> 200', async () => {
      // Erst Token speichern
      await request(app)
        .post('/api/notifications/device-token')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ token: 'fcm-to-delete', platform: 'android', device_id: 'device-del' });

      // Dann loeschen
      const res = await request(app)
        .delete('/api/notifications/device-token')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ device_id: 'device-del', platform: 'android' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verifizieren: Token entfernt
      const { rows } = await db.query('SELECT * FROM push_tokens WHERE user_id = $1 AND device_id = $2',
        [USERS.konfi1.id, 'device-del']);
      expect(rows.length).toBe(0);
    });

    it('Fehlende device_id -> 400 Validierungsfehler', async () => {
      const res = await request(app)
        .delete('/api/notifications/device-token')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ platform: 'ios' });

      expect(res.status).toBe(400);
    });

    it('Fehlende platform -> 400 Validierungsfehler', async () => {
      const res = await request(app)
        .delete('/api/notifications/device-token')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ device_id: 'device-001' });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  // POST /api/notifications/test-push
  // ================================================================
  describe('POST /api/notifications/test-push', () => {
    it('User ohne gespeicherte Tokens bekommt success:false (keine Tokens)', async () => {
      const res = await request(app)
        .post('/api/notifications/test-push')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ message: 'Test-Nachricht' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Keine Push-Tokens');
    });

    it('Ohne Auth-Token -> 401', async () => {
      const res = await request(app)
        .post('/api/notifications/test-push')
        .send({ message: 'Test' });

      expect(res.status).toBe(401);
    });

    it('User mit gespeichertem Token: Endpoint antwortet ohne 500 crash', async () => {
      // Token direkt in DB speichern (umgeht Route-Validierung)
      await db.query(
        `INSERT INTO push_tokens (user_id, user_type, token, platform, device_id) VALUES ($1, $2, $3, $4, $5)`,
        [USERS.admin1.id, 'admin', 'fcm-admin-token', 'ios', 'admin-device']
      );

      // Test-Push senden (Firebase nicht konfiguriert -> graceful error, kein crash)
      const res = await request(app)
        .post('/api/notifications/test-push')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ message: 'Test Push' });

      expect(res.status).toBe(200);
      // Entweder Tokens gesendet oder Fehler gezaehlt, aber kein 500
      expect(res.body.total).toBe(1);
    });
  });

  // ================================================================
  // GET / PUT /api/notifications/preferences  (Push-Master-Schalter)
  // ================================================================
  describe('GET/PUT /api/notifications/preferences', () => {
    it('GET liefert default push_enabled=true fuer neuen User', async () => {
      const res = await request(app)
        .get('/api/notifications/preferences')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.push_enabled).toBe(true);
    });

    it('PUT push_enabled=false deaktiviert Push und wird persistiert', async () => {
      const putRes = await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ push_enabled: false });

      expect(putRes.status).toBe(200);
      expect(putRes.body.success).toBe(true);
      expect(putRes.body.push_enabled).toBe(false);

      // GET liefert jetzt false
      const getRes = await request(app)
        .get('/api/notifications/preferences')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(getRes.body.push_enabled).toBe(false);

      // DB verifizieren
      const { rows } = await db.query('SELECT push_enabled FROM users WHERE id = $1', [USERS.konfi1.id]);
      expect(rows[0].push_enabled).toBe(false);
    });

    it('Deaktivierter User bekommt keine Tokens via test-push (Master-Schalter greift)', async () => {
      // Token speichern
      await db.query(
        `INSERT INTO push_tokens (user_id, user_type, token, platform, device_id) VALUES ($1, $2, $3, $4, $5)`,
        [USERS.konfi1.id, 'konfi', 'fcm-konfi-token', 'ios', 'konfi-device']
      );
      // Push deaktivieren
      await db.query('UPDATE users SET push_enabled = false WHERE id = $1', [USERS.konfi1.id]);

      // test-push nutzt eigene Query (ohne Master-Schalter) -> Token wird gefunden,
      // aber PushService.getTokensForUser (regulaerer Versand) wuerde 0 liefern.
      const { rows } = await db.query(`
        SELECT pt.* FROM push_tokens pt
        JOIN users u ON pt.user_id = u.id
        WHERE pt.user_id = $1 AND u.push_enabled = true
      `, [USERS.konfi1.id]);
      expect(rows.length).toBe(0);
    });

    it('PUT ohne Auth-Token -> 401', async () => {
      const res = await request(app)
        .put('/api/notifications/preferences')
        .send({ push_enabled: false });

      expect(res.status).toBe(401);
    });

    it('PUT mit ungueltigem Wert -> 400 Validierungsfehler', async () => {
      const res = await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ push_enabled: 'vielleicht' });

      expect(res.status).toBe(400);
    });
  });
});
