const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Notifications Routes', () => {
  let app;
  let db;
  let konfiToken;
  let adminToken;
  let orgAdminToken;
  let teamerToken;

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
    teamerToken = generateToken('teamer1');
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

      // Neuinstallation: identifierForVendor hat sich geändert, FCM-Token blieb gleich
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

      // Dann löschen
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
  // POST /api/notifications/test-push — entfernt (24.08.2026)
  // ================================================================
  describe('POST /api/notifications/test-push (entfernte Route)', () => {
    it('Route existiert nicht mehr -> 404, auch mit gültigem Token', async () => {
      const res = await request(app)
        .post('/api/notifications/test-push')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ message: 'Test' });

      expect(res.status).toBe(404);
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

    it('Deaktivierter User liefert keine Tokens für den Versand (Master-Schalter greift)', async () => {
      // Token speichern
      await db.query(
        `INSERT INTO push_tokens (user_id, user_type, token, platform, device_id) VALUES ($1, $2, $3, $4, $5)`,
        [USERS.konfi1.id, 'konfi', 'fcm-konfi-token', 'ios', 'konfi-device']
      );
      // Push deaktivieren
      await db.query('UPDATE users SET push_enabled = false WHERE id = $1', [USERS.konfi1.id]);

      // Query wie in PushService.getTokensForUser (regulärer Versand): der
      // Master-Schalter filtert den Token trotz Registrierung heraus.
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

  // ================================================================
  // GET /api/notifications/badge-counts (Audit Achse 4, Fund 3)
  // Leichtgewichtiger Zähler-Endpoint, ersetzt die frueheren Voll-Fetches
  // im BadgeContext. Semantik muss den Listen-Ansichten entsprechen.
  // ================================================================
  describe('GET /api/notifications/badge-counts', () => {
    it('Konfi bekommt unread pro Raum + Gesamt (Seed: konfi1 in Raum 1 und 2)', async () => {
      // 2 Nachrichten von admin1 in Raum 1, 1 Nachricht in Raum 2 — kein
      // read_status für konfi1 -> alles ungelesen.
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, content) VALUES
         (1, $1, 'admin', 'Nachricht 1'), (1, $1, 'admin', 'Nachricht 2'), (2, $1, 'admin', 'Nachricht 3')`,
        [USERS.admin1.id]
      );

      const res = await request(app)
        .get('/api/notifications/badge-counts')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.chat.total).toBe(3);
      expect(res.body.chat.byRoom['1']).toBe(2);
      expect(res.body.chat.byRoom['2']).toBe(1);
      // Konfi bekommt keine Admin-Zähler
      expect(res.body.pendingRequests).toBe(0);
      expect(res.body.pendingEvents).toBe(0);
    });

    // Befund H4 (26.08.2026): Der Teamer-Zweig des Challenge-Zaehlers zaehlte
    // ausschliesslich ueber challenge_jahrgang_assignments und lief bei
    // Teamer:innen ohne zugewiesene Jahrgaenge gar nicht erst an.
    // 'nur_team'-Challenges haben per Definition KEINE Jahrgangszuordnung und
    // sind fuer jede:n Teamer:in der Organisation moderierbar (Migration 121,
    // challenges.js:184-205). Folge: Ein Teamer konnte eine Team-Runde
    // moderieren, wurde aber nie per Reiter-Zaehler darauf gestossen.
    describe('pendingChallenges fuer Teamer:innen', () => {
      const challengeAnlegen = async (audience) => {
        const { rows } = await db.query(
          `INSERT INTO challenges (organization_id, title, description, badge_name,
                                   starts_at, ends_at, is_draft, audience)
           VALUES ($1, $2, 'Beschreibung', 'Abzeichen',
                   NOW() - interval '1 day', NOW() + interval '7 days', false, $3)
           RETURNING id`,
          [ORGS.testGemeinde.id, `Challenge ${audience}`, audience]
        );
        return rows[0].id;
      };

      const einreichung = async (challengeId) => {
        await db.query(
          `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id,
                                              media_type, moderation_status)
           VALUES ($1, $2, $3, 'text', 'pending')`,
          [challengeId, USERS.konfi1.id, ORGS.testGemeinde.id]
        );
      };

      const zaehler = async (token) => {
        const res = await request(app)
          .get('/api/notifications/badge-counts')
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        return res.body.pendingChallenges;
      };

      it('zaehlt offene Beitraege einer nur-Team-Challenge', async () => {
        const id = await challengeAnlegen('nur_team');
        await einreichung(id);
        expect(await zaehler(teamerToken)).toBe(1);
      });

      it('zaehlt eine Challenge ohne Jahrgangs-Zuordnung NICHT, wenn sie nicht nur-Team ist', async () => {
        // Gegenprobe: Die Ausnahme gilt ausdruecklich nur fuer 'nur_team'.
        // Eine konfis-Challenge ohne Zuordnung geht diese Teamer:in nichts an.
        const id = await challengeAnlegen('konfis');
        await einreichung(id);
        expect(await zaehler(teamerToken)).toBe(0);
      });

      it('bereits moderierte Beitraege zaehlen nicht mehr', async () => {
        const id = await challengeAnlegen('nur_team');
        await einreichung(id);
        await db.query(
          "UPDATE challenge_submissions SET moderation_status = 'approved' WHERE challenge_id = $1",
          [id]
        );
        expect(await zaehler(teamerToken)).toBe(0);
      });

      it('die Leitung zaehlt weiterhin org-weit', async () => {
        // Gegenprobe: Der Admin-Zweig war korrekt und darf sich nicht aendern.
        const team = await challengeAnlegen('nur_team');
        const konfis = await challengeAnlegen('konfis');
        await einreichung(team);
        await einreichung(konfis);
        expect(await zaehler(adminToken)).toBe(2);
      });
    });

    // Konsolidierung 27.08.2026: Der Abzeichen-Zaehler kam vorher aus einem
    // eigenen Abruf im Frontend und hing als einziger nicht am BadgeContext.
    // Jetzt liefert badge-counts ihn als fuenftes Feld mit.
    describe('newBadges', () => {
      const abzeichenVergeben = async (userId, rolle, anzahl, gesehen = false) => {
        for (let i = 0; i < anzahl; i++) {
          const { rows: [b] } = await db.query(
            `INSERT INTO custom_badges (name, icon, criteria_type, criteria_value,
                                        organization_id, is_active, target_role)
             VALUES ($1, 'star', 'total_points', 1, $2, true, $3) RETURNING id`,
            [`Abzeichen ${rolle} ${i}`, ORGS.testGemeinde.id, rolle]
          );
          await db.query(
            `INSERT INTO user_badges (user_id, badge_id, organization_id, seen)
             VALUES ($1, $2, $3, $4)`,
            [userId, b.id, ORGS.testGemeinde.id, gesehen]
          );
        }
      };

      const zaehler = async (token) => {
        const res = await request(app)
          .get('/api/notifications/badge-counts')
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        return res.body.newBadges;
      };

      it('zaehlt ungesehene Abzeichen einer Konfi', async () => {
        await abzeichenVergeben(USERS.konfi1.id, 'konfi', 2);
        expect(await zaehler(konfiToken)).toBe(2);
      });

      it('gesehene Abzeichen zaehlen nicht mit', async () => {
        await abzeichenVergeben(USERS.konfi1.id, 'konfi', 2, true);
        expect(await zaehler(konfiToken)).toBe(0);
      });

      it('zaehlt ungesehene Abzeichen einer Teamer:in', async () => {
        await abzeichenVergeben(USERS.teamer1.id, 'teamer', 3);
        expect(await zaehler(teamerToken)).toBe(3);
      });

      it('zaehlt nur die Abzeichen der eigenen Rolle', async () => {
        // custom_badges.target_role trennt die Rollen -- ein Konfi-Abzeichen
        // darf im Teamer-Zaehler nicht auftauchen.
        await abzeichenVergeben(USERS.teamer1.id, 'konfi', 2);
        expect(await zaehler(teamerToken)).toBe(0);
      });

      it('die Leitung bekommt immer 0 (kann keine Abzeichen verdienen)', async () => {
        expect(await zaehler(adminToken)).toBe(0);      });
    });

    it('read_status wird respektiert (gelesener Raum zaehlt 0)', async () => {
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, content) VALUES (1, $1, 'admin', 'Alte Nachricht')`,
        [USERS.admin1.id]
      );
      // konfi1 hat Raum 1 NACH der Nachricht gelesen
      await db.query(
        `INSERT INTO chat_read_status (room_id, user_id, user_type, last_read_at) VALUES (1, $1, 'konfi', NOW() + interval '1 minute')`,
        [USERS.konfi1.id]
      );

      const res = await request(app)
        .get('/api/notifications/badge-counts')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.chat.byRoom['1']).toBe(0);
      expect(res.body.chat.total).toBe(0);
    });

    it('Admin bekommt pending-Antraege und unverarbeitete vergangene Events', async () => {
      // Pending-Antrag von konfi1 auf Aktivität 1 (Org 1)
      await db.query(
        `INSERT INTO activity_requests (user_id, activity_id, status, organization_id, requested_date)
         VALUES ($1, 1, 'pending', 1, CURRENT_DATE)`,
        [USERS.konfi1.id]
      );
      // Vergangenes Event mit bestaetigter Buchung ohne attendance_status
      await db.query(
        `UPDATE events SET event_date = NOW() - interval '2 days' WHERE id = 1`
      );
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, 1, 'confirmed', 1)`,
        [USERS.konfi1.id]
      );

      const res = await request(app)
        .get('/api/notifications/badge-counts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingRequests).toBe(1);
      expect(res.body.pendingEvents).toBe(1);
    });

    it('Abgeschlossene Antraege und kuenftige Events zaehlen NICHT', async () => {
      await db.query(
        `INSERT INTO activity_requests (user_id, activity_id, status, organization_id, requested_date)
         VALUES ($1, 1, 'approved', 1, CURRENT_DATE)`,
        [USERS.konfi1.id]
      );
      // Seed-Events liegen alle in der Zukunft; Buchung ohne attendance zählt
      // trotzdem nicht, weil event_date > NOW().
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, 1, 'confirmed', 1)`,
        [USERS.konfi1.id]
      );

      const res = await request(app)
        .get('/api/notifications/badge-counts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.pendingRequests).toBe(0);
      expect(res.body.pendingEvents).toBe(0);
    });

    it('Ohne Token -> 401', async () => {
      const res = await request(app).get('/api/notifications/badge-counts');
      expect(res.status).toBe(401);
    });
  });
});
