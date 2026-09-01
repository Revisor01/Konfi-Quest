const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, CHAT_ROOMS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { isEncrypted } = require('../../utils/photoCrypto');
const chatSyncCache = require('../../utils/chatSyncCache');

describe('Chat Routes', () => {
  let app;
  let db;
  let konfi1Token;
  let konfi2Token;
  let konfi3Token;
  let admin1Token;
  let teamer1Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    // Der Chat-Sync-TTL-Cache ist Modul-State und ueberlebt das truncate —
    // ohne clear() wuerde GET /rooms den Mitgliedschafts-Sync gegen die frisch
    // geseedete DB faelschlich ueberspringen.
    chatSyncCache.clear();
    konfi1Token = generateToken('konfi1');
    konfi2Token = generateToken('konfi2');
    konfi3Token = generateToken('konfi3');
    admin1Token = generateToken('admin1');
    teamer1Token = generateToken('teamer1');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // GET /api/chat/rooms
  // ================================================================
  describe('GET /api/chat/rooms', () => {
    it('Konfi1 bekommt 200 + seine Raeume (Jahrgang + Direct)', async () => {
      const res = await request(app)
        .get('/api/chat/rooms')
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Konfi1 ist in Room 1 (Jahrgang) und Room 2 (Direct)
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      const roomIds = res.body.map(r => r.id);
      expect(roomIds).toContain(CHAT_ROOMS.jahrgang.id);
      expect(roomIds).toContain(CHAT_ROOMS.direct.id);
    });

    it('Admin1 bekommt 200 + seine Raeume', async () => {
      const res = await request(app)
        .get('/api/chat/rooms')
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Admin1 ist in Room 1 (Jahrgang), Room 2 (Direct), Room 3 (Group)
      expect(res.body.length).toBeGreaterThanOrEqual(2);
    });

    it('Konfi3 (Org 2) sieht NICHT Raeume aus Org 1', async () => {
      const res = await request(app)
        .get('/api/chat/rooms')
        .set('Authorization', `Bearer ${konfi3Token}`);

      expect(res.status).toBe(200);
      const roomIds = res.body.map(r => r.id);
      // Konfi3 darf Org-1-Räume nicht sehen
      expect(roomIds).not.toContain(CHAT_ROOMS.jahrgang.id);
      expect(roomIds).not.toContain(CHAT_ROOMS.direct.id);
      expect(roomIds).not.toContain(CHAT_ROOMS.group.id);
    });

    it('Ohne Token gibt 401', async () => {
      const res = await request(app)
        .get('/api/chat/rooms');

      expect(res.status).toBe(401);
    });
  });

  // ================================================================
  // POST /api/chat/rooms
  // ================================================================
  describe('POST /api/chat/rooms', () => {
    it('Admin erstellt Gruppenraum -> 200', async () => {
      const res = await request(app)
        .post('/api/chat/rooms')
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ name: 'Test-Gruppe', type: 'group' });

      expect(res.status).toBe(200);
      expect(res.body.room_id).toBeDefined();
      expect(res.body.created).toBe(true);
    });

    it('Konfi darf keine Gruppe erstellen -> 403', async () => {
      const res = await request(app)
        .post('/api/chat/rooms')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ name: 'Konfi-Gruppe', type: 'group' });

      expect(res.status).toBe(403);
    });

    it('Ohne Name gibt 400', async () => {
      const res = await request(app)
        .post('/api/chat/rooms')
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ type: 'group' });

      expect(res.status).toBe(400);
    });

    // Jahrgangschat: der Raum aus dem Seed (id 1) gehoert zu Jahrgang 1 und
    // fuehrt konfi1 + konfi2 als Teilnehmer. Ein spaeter angelegter Konfi
    // wurde frueher nie eingetragen, weil die Route mit 409 abbrach.
    it('Bestehender Jahrgangschat: neuer Konfi wird nachgetragen -> 200', async () => {
      const { rows: [neuerKonfi] } = await db.query(
        `INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
         VALUES ('konfi.neu', 'Neue Konfirmandin', 'x', $1, $2) RETURNING id`,
        [USERS.konfi1.role_id, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
         VALUES ($1, $2, 0, 0, $3)`,
        [neuerKonfi.id, 1, ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .post('/api/chat/rooms')
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ type: 'jahrgang', name: 'Jahrgang 2025/2026', jahrgang_id: 1 });

      expect(res.status).toBe(200);
      expect(res.body.room_id).toBe(CHAT_ROOMS.jahrgang.id);
      expect(res.body.created).toBe(false);

      const { rows } = await db.query(
        'SELECT user_type FROM chat_participants WHERE room_id = $1 AND user_id = $2',
        [CHAT_ROOMS.jahrgang.id, neuerKonfi.id]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].user_type).toBe('konfi');
    });

    it('Bestehender Jahrgangschat: vorhandene Teilnehmer bleiben einfach -> keine Dubletten', async () => {
      await request(app)
        .post('/api/chat/rooms')
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ type: 'jahrgang', name: 'Jahrgang 2025/2026', jahrgang_id: 1 });

      const { rows } = await db.query(
        'SELECT user_id FROM chat_participants WHERE room_id = $1 AND user_id = $2',
        [CHAT_ROOMS.jahrgang.id, USERS.konfi1.id]
      );
      expect(rows).toHaveLength(1);
    });

    it('Jahrgangschat einer fremden Organisation bleibt zu -> 403', async () => {
      const res = await request(app)
        .post('/api/chat/rooms')
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ type: 'jahrgang', name: 'Fremd', jahrgang_id: 2 });

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // POST /api/chat/direct
  // ================================================================
  describe('POST /api/chat/rooms — Konfi-zu-Konfi', () => {
    // POST /direct lehnt die Kombination korrekt ab; über POST /rooms mit
    // type='direct' und einer Konfi in participants liess sie sich umgehen —
    // geprüft wurde nur der Raum-Typ, nicht die Rolle der Teilnehmer
    // (Audit 22.08.2026).
    it('Konfi kann KEINEN Raum mit einer anderen Konfi anlegen', async () => {
      const vorher = await db.query('SELECT COUNT(*)::int AS c FROM chat_rooms');

      const res = await request(app)
        .post('/api/chat/rooms')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ type: 'direct', name: 'Heimlich', participants: [USERS.konfi2.id] });

      expect(res.status).toBe(403);

      // Kein verwaister Raum zurueckgeblieben
      const nachher = await db.query('SELECT COUNT(*)::int AS c FROM chat_rooms');
      expect(nachher.rows[0].c).toBe(vorher.rows[0].c);
    });

    it('Konfi darf weiterhin einen Raum mit dem Team anlegen', async () => {
      const res = await request(app)
        .post('/api/chat/rooms')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ type: 'direct', name: 'Frage ans Team', participants: [USERS.admin1.id] });

      expect([200, 201]).toContain(res.status);
    });
  });

  // Admins und Teamer:innen duerfen nur Konfis ihrer zugewiesenen Jahrgaenge
  // direkt anschreiben — dieselbe Grenze, die darfJahrgang im Rest des
  // Systems zieht. Fuer Teamer:innen gilt sie seit dem 23.08.2026
  // (Nutzerhinweis), fuer Admins seit dem 01.09.2026 (Simons Regel vom
  // 31.08.2026). Leitung (org_admin) und Super-Admins bleiben ausgenommen.
  describe('Jahrgangsgrenze fuer Admins und Teamer:innen im Direktchat', () => {
    it('Teamer:in schreibt Konfi des EIGENEN Jahrgangs an -> 200', async () => {
      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${teamer1Token}`)
        .send({ target_user_id: USERS.konfi1.id });

      expect(res.status).toBe(200);
      expect(res.body.room_id).toBeDefined();
    });

    it('Teamer:in schreibt Konfi eines FREMDEN Jahrgangs an -> 403', async () => {
      const { invalidateUserCache } = require('../../middleware/rbac');

      // konfi2 in einen Jahrgang verschieben, dem teamer1 NICHT zugewiesen ist.
      await db.query(
        'INSERT INTO jahrgaenge (id, name, organization_id) VALUES (99, $1, 1) ON CONFLICT DO NOTHING',
        ['Fremder Jahrgang']
      );
      await db.query('UPDATE konfi_profiles SET jahrgang_id = 99 WHERE user_id = $1', [USERS.konfi2.id]);
      invalidateUserCache(USERS.teamer1.id);

      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${teamer1Token}`)
        .send({ target_user_id: USERS.konfi2.id });

      expect(res.status).toBe(403);
    });

    // Neue Teamer:innen sind bewusst keinem Jahrgang zugewiesen. Sie sollen
    // deshalb GAR KEINE Konfis direkt anschreiben können.
    it('Teamer:in OHNE Jahrgangs-Zuweisung erreicht keinen Konfi -> 403', async () => {
      const { invalidateUserCache } = require('../../middleware/rbac');
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);
      invalidateUserCache(USERS.teamer1.id);

      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${teamer1Token}`)
        .send({ target_user_id: USERS.konfi1.id });

      expect(res.status).toBe(403);
    });

    // Seit dem 01.09.2026 gilt Simons Jahrgangsregel auch fuer die Rolle
    // 'admin' — der Direktchat war die letzte Stelle, an der ein Admin noch
    // jeden Konfi der Gemeinde erreichte. admin1 hat im Seed KEINE
    // Jahrgangszuweisung; vorher stand hier "Admin erreicht JEDEN Konfi der
    // Organisation -> 200". Die Detailfaelle (mit/ohne Zuweisung, org_admin,
    // Super-Admin-Flag, Konfi ohne Jahrgang) liegen in
    // jahrgangsBindungAdmin.test.js.
    it('Admin OHNE Jahrgangszuweisung erreicht keinen Konfi mehr -> 403, kein Raum', async () => {
      const { invalidateUserCache } = require('../../middleware/rbac');
      await db.query(
        'INSERT INTO jahrgaenge (id, name, organization_id) VALUES (99, $1, 1) ON CONFLICT DO NOTHING',
        ['Fremder Jahrgang']
      );
      await db.query('UPDATE konfi_profiles SET jahrgang_id = 99 WHERE user_id = $1', [USERS.konfi2.id]);
      invalidateUserCache(USERS.admin1.id);

      const vorher = await db.query('SELECT COUNT(*)::int AS c FROM chat_rooms');

      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ target_user_id: USERS.konfi2.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Du kannst nur Konfirmand:innen aus deinen Jahrgängen anschreiben');

      // Kein Raum entstanden
      const nachher = await db.query('SELECT COUNT(*)::int AS c FROM chat_rooms');
      expect(nachher.rows[0].c).toBe(vorher.rows[0].c);
    });

    it('Admin MIT Zuweisung erreicht den Konfi seines Jahrgangs -> 200', async () => {
      const { invalidateUserCache } = require('../../middleware/rbac');
      // konfi2 liegt im Seed in Jahrgang 1 — admin1 bekommt genau diesen.
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, 1)',
        [USERS.admin1.id]
      );
      invalidateUserCache(USERS.admin1.id);

      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ target_user_id: USERS.konfi2.id });

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(true);
    });
  });

  // ================================================================
  // Gegenrichtung: Konfi -> Team
  //
  // Nutzerhinweis 23.08.2026: Konfis sollen Teamer:innen ebenfalls nur über
  // einen gemeinsamen Jahrgang erreichen. Leitung (org_admin), Admins und
  // Super-Admins bleiben für jeden Konfi erreichbar.
  // ================================================================
  describe('Jahrgangsgrenze fuer Konfis in Richtung Team', () => {
    // teamer1 aus dem Jahrgang von konfi1 herausnehmen.
    const teamerAusJahrgangNehmen = async () => {
      const { invalidateUserCache } = require('../../middleware/rbac');
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);
      invalidateUserCache(USERS.teamer1.id);
      invalidateUserCache(USERS.konfi1.id);
    };

    it('Konfi schreibt Teamer:in des EIGENEN Jahrgangs an -> 200', async () => {
      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ target_user_id: USERS.teamer1.id });

      expect(res.status).toBe(200);
      expect(res.body.room_id).toBeDefined();
      // created:true belegt, dass der Raum wirklich neu entstanden ist — bei
      // einem schon vorhandenen Chat gaebe die Route auch ohne Berechtigung 200.
      expect(res.body.created).toBe(true);
    });

    it('Konfi schreibt Teamer:in OHNE gemeinsamen Jahrgang an -> 403', async () => {
      await teamerAusJahrgangNehmen();

      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ target_user_id: USERS.teamer1.id });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Diese Teamer:in ist nicht für deinen Jahrgang zuständig');
    });

    it('Konfi erreicht die Leitung (org_admin) immer -> 200', async () => {
      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ target_user_id: USERS.orgAdmin1.id });

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(true);
    });

    it('Konfi erreicht Admins immer -> 200', async () => {
      // Mit admin1 besteht laut Seed schon ein Chat — die Route gaebe dann
      // auch ohne Berechtigungspruefung den vorhandenen Raum zurück. Deshalb
      // hier orgAdminSuper, mit dem noch kein Raum existiert: So beweist der
      // 200 wirklich die Berechtigung und nicht nur den Dedup-Pfad.
      const { rows: [vorher] } = await db.query(
        `SELECT 1 FROM chat_rooms cr
           JOIN chat_participants a ON a.room_id = cr.id AND a.user_id = $1
           JOIN chat_participants b ON b.room_id = cr.id AND b.user_id = $2
          WHERE cr.type = 'direct'`,
        [USERS.konfi1.id, USERS.orgAdminSuper.id]
      );
      expect(vorher).toBeUndefined();

      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ target_user_id: USERS.orgAdminSuper.id });

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(true);
    });

    it('gesperrte Teamer:in taucht in /available-users nicht auf', async () => {
      await teamerAusJahrgangNehmen();

      const res = await request(app)
        .get('/api/chat/available-users')
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(200);
      const ids = res.body.users.map(u => u.id);
      expect(ids).not.toContain(USERS.teamer1.id);
      // Die Leitung bleibt sichtbar. admin1 taucht bewusst NICHT auf: Mit ihm
      // besteht laut Seed bereits ein Direktchat (Raum 2), und die Route
      // blendet vorhandene Chats aus. Das belegt der Gegen-Check darunter.
      expect(ids).toContain(USERS.orgAdmin1.id);

      const { rows: [bestehend] } = await db.query(
        `SELECT 1 FROM chat_rooms cr
           JOIN chat_participants a ON a.room_id = cr.id AND a.user_id = $1
           JOIN chat_participants b ON b.room_id = cr.id AND b.user_id = $2
          WHERE cr.type = 'direct'`,
        [USERS.konfi1.id, USERS.admin1.id]
      );
      expect(bestehend).toBeTruthy();
      expect(ids).not.toContain(USERS.admin1.id);
    });

    it('zustaendige Teamer:in taucht in /available-users auf und traegt Typ "teamer"', async () => {
      const res = await request(app)
        .get('/api/chat/available-users')
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(200);
      const treffer = res.body.users.find(u => u.id === USERS.teamer1.id);
      expect(treffer).toBeDefined();
      // Frueher kam hier hart 'admin' zurück.
      expect(treffer.type).toBe('teamer');
      expect(treffer.role_description).toBe('Teamer:in');
    });

    it('gesperrte Teamer:in laesst sich auch nicht ueber POST /rooms eintragen -> 403', async () => {
      await teamerAusJahrgangNehmen();

      const res = await request(app)
        .post('/api/chat/rooms')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({
          type: 'direct',
          name: 'Umweg',
          participants: [USERS.teamer1.id],
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Diese Teamer:in ist nicht für deinen Jahrgang zuständig');
    });

    it('Konfi ohne Jahrgang erreicht die Leitung weiterhin -> 200', async () => {
      const { invalidateUserCache } = require('../../middleware/rbac');
      await db.query('UPDATE konfi_profiles SET jahrgang_id = NULL WHERE user_id = $1', [USERS.konfi1.id]);
      invalidateUserCache(USERS.konfi1.id);

      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ target_user_id: USERS.orgAdmin1.id });

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(true);
    });

    it('Teamer:in erreicht das Team weiterhin, unabhaengig vom Jahrgang', async () => {
      const { invalidateUserCache } = require('../../middleware/rbac');
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);
      invalidateUserCache(USERS.teamer1.id);

      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${teamer1Token}`)
        .send({ target_user_id: USERS.admin1.id });

      expect(res.status).toBe(200);
    });

    // Ohne diese Prüfung wäre die Regel oben wertlos — derselbe Umgehungsweg
    // wie beim Konfi-zu-Konfi-Fall (Audit 22.08.2026).
    it('die Grenze laesst sich nicht ueber POST /rooms umgehen -> 403', async () => {
      const { invalidateUserCache } = require('../../middleware/rbac');
      await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.teamer1.id]);
      invalidateUserCache(USERS.teamer1.id);

      const vorher = await db.query('SELECT COUNT(*)::int AS c FROM chat_rooms');

      const res = await request(app)
        .post('/api/chat/rooms')
        .set('Authorization', `Bearer ${teamer1Token}`)
        .send({ type: 'direct', name: 'Umweg', participants: [USERS.konfi1.id] });

      expect(res.status).toBe(403);

      // Kein verwaister Raum zurueckgeblieben
      const nachher = await db.query('SELECT COUNT(*)::int AS c FROM chat_rooms');
      expect(nachher.rows[0].c).toBe(vorher.rows[0].c);
    });
  });

  describe('POST /api/chat/direct', () => {
    it('Konfi1 erstellt Direct-Chat mit Admin1 -> 200', async () => {
      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ target_user_id: USERS.admin1.id, target_user_type: 'admin' });

      expect(res.status).toBe(200);
      expect(res.body.room_id).toBeDefined();
      // Koennte existing sein (Seed hat Direct-Room konfi1+admin1)
    });

    it('Konfi darf keinen Direct-Chat mit anderem Konfi erstellen -> 403', async () => {
      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ target_user_id: USERS.konfi2.id, target_user_type: 'konfi' });

      expect(res.status).toBe(403);
    });

    it('Ohne target_user_id gibt 400', async () => {
      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('Direct-Chat mit Teamerin: user_type wird serverseitig als teamer gespeichert, Raum fuer Teamerin sichtbar', async () => {
      // Client schickt (wie früher) target_user_type 'admin' — der Server MUSS
      // die echte Rolle nehmen, sonst findet die Teamerin den Raum nicht.
      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ target_user_id: USERS.teamer1.id, target_user_type: 'admin' });

      expect(res.status).toBe(200);
      const roomId = res.body.room_id;

      const { rows } = await db.query(
        'SELECT user_id, user_type FROM chat_participants WHERE room_id = $1 ORDER BY user_id',
        [roomId]
      );
      expect(rows).toContainEqual({ user_id: USERS.teamer1.id, user_type: 'teamer' });

      // Und die Teamerin sieht den Raum in ihrer Liste
      const roomsRes = await request(app)
        .get('/api/chat/rooms')
        .set('Authorization', `Bearer ${teamer1Token}`);
      expect(roomsRes.status).toBe(200);
      expect(roomsRes.body.map((r) => r.id)).toContain(roomId);
    });
  });

  // ================================================================
  // GET /api/chat/rooms/:roomId/messages
  // ================================================================
  describe('GET /api/chat/rooms/:roomId/messages', () => {
    it('Konfi1 kann Nachrichten aus seinem Raum lesen', async () => {
      // Zuerst eine Nachricht senden
      await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ content: 'Hallo Test-Nachricht' });

      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      const messages = res.body.filter(m => m.content === 'Hallo Test-Nachricht');
      expect(messages.length).toBe(1);
    });

    it('Konfi3 (nicht Teilnehmer in Org1 Room) bekommt 403', async () => {
      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi3Token}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // POST /api/chat/rooms/:roomId/messages
  // ================================================================
  describe('POST /api/chat/rooms/:roomId/messages', () => {
    it('Konfi1 sendet Nachricht in Jahrgangs-Chat -> 200', async () => {
      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ content: 'Hallo Test' });

      expect(res.status).toBe(200);
      expect(res.body.content).toBe('Hallo Test');
      expect(res.body.sender_id).toBe(USERS.konfi1.id);
      expect(res.body.sender_name).toBe(USERS.konfi1.display_name);
    });

    it('Leere Nachricht ohne Datei gibt 400', async () => {
      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('Nicht-Teilnehmer bekommt 403', async () => {
      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi3Token}`)
        .send({ content: 'Hallo' });

      expect(res.status).toBe(403);
    });

    it('reply_to auf nicht-existente Nachricht -> 200 ohne FK-Crash, reply_to wird ignoriert', async () => {
      // Reproduziert den Offline-Reply-Bug: Antwort auf eine (lokale/optimistische)
      // Nachricht, die serverseitig nie existiert hat. Frueher: 500 (FK-Constraint).
      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ content: 'Antwort auf Geist', reply_to: 999999999 });

      expect(res.status).toBe(200);
      expect(res.body.content).toBe('Antwort auf Geist');
      expect(res.body.reply_to_id == null).toBe(true);
    });

    it('reply_to auf echte Nachricht -> Reply-Bezug bleibt erhalten', async () => {
      const first = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ content: 'Ursprung' });
      expect(first.status).toBe(200);

      const reply = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ content: 'Echte Antwort', reply_to: first.body.id });

      expect(reply.status).toBe(200);
      expect(reply.body.reply_to_id).toBe(first.body.id);
    });
  });

  // ================================================================
  // GET /api/chat/rooms/:roomId/participants
  // ================================================================
  // ================================================================
  // Chat-Export (nur Leitung)
  // ================================================================
  describe('GET /api/chat/rooms/:roomId/export', () => {
    beforeEach(async () => {
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, created_at)
         VALUES ($1, $2, 'konfi', 'text', 'Erste Nachricht', NOW() - interval '2 hours'),
                ($1, $3, 'admin', 'text', 'Antwort der Leitung', NOW() - interval '1 hour')`,
        [CHAT_ROOMS.jahrgang.id, USERS.konfi1.id, USERS.admin1.id]
      );
    });

    it('Admin exportiert als Text -> 200 mit Verlauf', async () => {
      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/export`)
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.text).toContain('Erste Nachricht');
      expect(res.text).toContain('Antwort der Leitung');
      // Aelteste zuerst
      expect(res.text.indexOf('Erste Nachricht')).toBeLessThan(res.text.indexOf('Antwort der Leitung'));
    });

    it('Admin exportiert als JSON -> 200 mit Nachrichten-Array', async () => {
      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/export?format=json`)
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(res.status).toBe(200);
      const daten = JSON.parse(res.text);
      expect(daten.anzahl_nachrichten).toBe(2);
      expect(daten.nachrichten[0].content).toBe('Erste Nachricht');
    });

    it('Konfi bekommt 403 — auch im eigenen Chat', async () => {
      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/export`)
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(403);
    });

    it('Teamer:in bekommt 403', async () => {
      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.group.id}/export`)
        .set('Authorization', `Bearer ${teamer1Token}`);

      expect(res.status).toBe(403);
    });

    it('Chat einer FREMDEN Organisation -> 404 (verraet keine Existenz)', async () => {
      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.jahrgang2.id}/export`)
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(res.status).toBe(404);
    });

    it('Geloeschte Nachrichten erscheinen als Platzhalter, nicht im Klartext', async () => {
      await db.query(
        `UPDATE chat_messages SET deleted_at = NOW()
         WHERE room_id = $1 AND content = 'Erste Nachricht'`,
        [CHAT_ROOMS.jahrgang.id]
      );

      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/export`)
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(res.status).toBe(200);
      expect(res.text).not.toContain('Erste Nachricht');
      expect(res.text).toContain('[gelöscht]');
    });
  });

  describe('GET /api/chat/rooms/:roomId/participants', () => {
    it('Admin bekommt 200 + Teilnehmer-Liste', async () => {
      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/participants`)
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Room 1 hat 4 Teilnehmer (konfi1, konfi2, teamer1, admin1)
      expect(res.body.length).toBe(4);
    });

    it('Konfi1 (Teilnehmer) kann Teilnehmer sehen', async () => {
      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/participants`)
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(4);
    });
  });

  // ================================================================
  // POST /api/chat/rooms/:roomId/participants
  // ================================================================
  describe('POST /api/chat/rooms/:roomId/participants', () => {
    // Seit dem 01.09.2026 braucht der Admin fuer Konfi-Teilnehmer den
    // passenden Jahrgang (admin1 hat im Seed keinen).
    const admin1JahrgangGeben = async () => {
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, 1)',
        [USERS.admin1.id]
      );
      require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
    };

    it('Admin fuegt Konfi des EIGENEN Jahrgangs zu Gruppenchat hinzu -> 201', async () => {
      await admin1JahrgangGeben();

      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.group.id}/participants`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ user_id: USERS.konfi1.id, user_type: 'konfi' });

      expect(res.status).toBe(201);

      // Pruefe dass Teilnehmer-Anzahl gestiegen
      const participantsRes = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.group.id}/participants`)
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(participantsRes.status).toBe(200);
      // Room 3 hatte 2 (teamer1 + admin1), jetzt 3
      expect(participantsRes.body.length).toBe(3);
    });

    // Ohne diese Grenze waere die Bindung aus POST /rooms trivial umgehbar:
    // Gruppe leer anlegen, fremden Konfi nachtraeglich eintragen.
    it('Admin OHNE passenden Jahrgang kann keinen Konfi eintragen -> 403', async () => {
      // Der rbac-Cache (30 s TTL) haelt sonst die Zuweisung aus dem
      // vorherigen Test fest — truncate/seed leert ihn NICHT.
      require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);

      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.group.id}/participants`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ user_id: USERS.konfi1.id, user_type: 'konfi' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Du kannst nur Konfirmand:innen aus deinen Jahrgängen anschreiben');

      // Konfi1 ist nachweislich NICHT eingetragen worden
      const { rows } = await db.query(
        'SELECT COUNT(*)::int AS c FROM chat_participants WHERE room_id = $1 AND user_id = $2',
        [CHAT_ROOMS.group.id, USERS.konfi1.id]
      );
      expect(rows[0].c).toBe(0);
    });

    it('Konfi darf keine Teilnehmer hinzufuegen -> 403', async () => {
      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.group.id}/participants`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ user_id: USERS.konfi2.id, user_type: 'konfi' });

      expect(res.status).toBe(403);
    });

    it('Teilnehmer nur in Gruppenchats hinzufuegbar -> 400', async () => {
      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/participants`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ user_id: USERS.konfi1.id, user_type: 'konfi' });

      expect(res.status).toBe(400);
    });
  });

  // ================================================================
  // DELETE /api/chat/rooms/:roomId/participants/:userId/:userType
  // ================================================================
  describe('DELETE /api/chat/rooms/:roomId/participants/:userId/:userType', () => {
    it('Admin entfernt Teilnehmer aus Gruppenchat -> 200', async () => {
      // Zuerst Konfi1 zum Gruppenchat hinzufuegen (braucht seit dem
      // 01.09.2026 den passenden Jahrgang)
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, 1)',
        [USERS.admin1.id]
      );
      require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
      await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.group.id}/participants`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ user_id: USERS.konfi1.id, user_type: 'konfi' });

      // Dann entfernen
      const res = await request(app)
        .delete(`/api/chat/rooms/${CHAT_ROOMS.group.id}/participants/${USERS.konfi1.id}/konfi`)
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(res.status).toBe(200);

      // Pruefe dass Teilnehmer nicht mehr in Liste
      const participantsRes = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.group.id}/participants`)
        .set('Authorization', `Bearer ${admin1Token}`);

      const userIds = participantsRes.body.map(p => p.user_id);
      expect(userIds).not.toContain(USERS.konfi1.id);
    });

    it('Nicht-existenten Teilnehmer entfernen -> 404', async () => {
      const res = await request(app)
        .delete(`/api/chat/rooms/${CHAT_ROOMS.group.id}/participants/999/konfi`)
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // Datei-Endpoints (supertest file mock)
  // ================================================================
  describe('POST /api/chat/rooms/:roomId/messages (Datei)', () => {
    it('Nachricht mit Datei-Anhang -> 200', async () => {
      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .field('content', 'Datei-Nachricht')
        .attach('file', Buffer.from('PNG test content'), {
          filename: 'test.png',
          contentType: 'image/png',
        });

      // Magic-Bytes von Buffer.from('PNG test content') sind keine echten PNG Magic-Bytes
      // validateMagicBytes gibt 415 bei falschen Magic-Bytes zurück
      expect([200, 400, 415]).toContain(res.status);
    });

    it('Nachricht nur mit Datei (ohne content) -> 200', async () => {
      // Echte gueltige 1x1-PNG (IHDR/IDAT/IEND) — file-type@22 verlangt eine
      // valide Struktur, nicht nur die Magic-Bytes (strenger als file-type@19).
      const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .attach('file', pngBuffer, {
          filename: 'bild.png',
          contentType: 'image/png',
        });

      expect(res.status).toBe(200);
      expect(res.body.id).toBeDefined();
      expect(res.body.file_name).toBe('bild.png');
    });

    it('Hochgeladene Datei liegt VERSCHLUESSELT auf der Platte', async () => {
      const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .attach('file', pngBuffer, { filename: 'bild.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      const storedName = res.body.file_path;
      expect(storedName).toMatch(/^[a-f0-9]{64}$/);

      // Datei auf der Platte muss den AES-Magic-Header tragen (NICHT Klartext-PNG)
      const onDisk = fs.readFileSync(path.join(os.tmpdir(), 'konfi-test-uploads', 'chat', storedName));
      expect(isEncrypted(onDisk)).toBe(true);
      expect(onDisk.subarray(0, 8).equals(pngBuffer.subarray(0, 8))).toBe(false);
    });

    // Die Route prüft den Token von Hand (Video-Elemente können keine Header
    // senden). Frueher hiess das `req.user = decoded`: Angaben ungeprueft für
    // die volle Token-Laufzeit, und organization_id immer die PRIMAER-Org —
    // in einer Zweit-Gemeinde bekam man die eigenen Dateien nicht
    // (Audit 22.08.2026).
    it('deaktiviertes Konto bekommt keine Datei mehr', async () => {
      const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const up = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .attach('file', pngBuffer, { filename: 'bild.png', contentType: 'image/png' });
      expect(up.status).toBe(200);

      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.konfi1.id]);
      try {
        const down = await request(app)
          .get(`/api/chat/files/${up.body.file_path}`)
          .set('Authorization', `Bearer ${konfi1Token}`);
        expect(down.status).toBe(401);
      } finally {
        await db.query('UPDATE users SET is_active = true WHERE id = $1', [USERS.konfi1.id]);
      }
    });

    it('nach einem Passwortwechsel greift der Soft-Revoke auch hier', async () => {
      const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const up = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .attach('file', pngBuffer, { filename: 'bild.png', contentType: 'image/png' });
      expect(up.status).toBe(200);

      // Sperre in die Zukunft datieren, damit sie das bestehende Token
      // sicher erfasst (iat hat nur Sekundenaufloesung).
      await db.query(
        "UPDATE users SET token_invalidated_at = NOW() + INTERVAL '5 seconds' WHERE id = $1",
        [USERS.konfi1.id]
      );
      try {
        const down = await request(app)
          .get(`/api/chat/files/${up.body.file_path}`)
          .set('Authorization', `Bearer ${konfi1Token}`);
        expect(down.status).toBe(401);
      } finally {
        await db.query('UPDATE users SET token_invalidated_at = NULL WHERE id = $1', [USERS.konfi1.id]);
      }
    });

    it('Token mit Anspruch auf eine fremde Organisation -> 403', async () => {
      const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const up = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .attach('file', pngBuffer, { filename: 'bild.png', contentType: 'image/png' });
      expect(up.status).toBe(200);

      // konfi1 ist NICHT Mitglied von Org 2 — der Header darf nichts bewirken.
      const down = await request(app)
        .get(`/api/chat/files/${up.body.file_path}`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .set('X-Active-Organization', '2');
      expect(down.status).toBe(403);
    });

    // Befund 1 (26.08.2026): Die Datei-Auslieferung prüfte deleted_at nicht —
    // der Anhang einer "gelöschten" Nachricht blieb für alle Raum-Mitglieder
    // abrufbar. Die Datei selbst bleibt bewusst liegen (Soft-Delete: die
    // Leitung kann rechtlich relevante Inhalte wiederherstellen).
    it('Anhang einer gelöschten Nachricht: Abruf 404, Datei bleibt auf der Platte', async () => {
      const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const up = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .attach('file', pngBuffer, { filename: 'bild.png', contentType: 'image/png' });
      expect(up.status).toBe(200);
      const storedName = up.body.file_path;

      // Vor dem Löschen: Datei abrufbar
      const before = await request(app)
        .get(`/api/chat/files/${storedName}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(before.status).toBe(200);

      // Eigene Nachricht löschen (Soft-Delete, deleted_at wird gesetzt)
      const del = await request(app)
        .delete(`/api/chat/messages/${up.body.id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(del.status).toBe(200);

      // Danach: kein Abruf mehr — weder für die Absenderin noch für die Leitung
      const after = await request(app)
        .get(`/api/chat/files/${storedName}`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(after.status).toBe(404);
      const afterAdmin = await request(app)
        .get(`/api/chat/files/${storedName}`)
        .set('Authorization', `Bearer ${admin1Token}`);
      expect(afterAdmin.status).toBe(404);

      // Die Datei bleibt bewusst auf der Platte (Wiederherstellbarkeit)
      expect(fs.existsSync(path.join(os.tmpdir(), 'konfi-test-uploads', 'chat', storedName))).toBe(true);
    });

    it('Abruf via /files entschluesselt zum Originalinhalt (Roundtrip)', async () => {
      const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

      const up = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .attach('file', pngBuffer, { filename: 'bild.png', contentType: 'image/png' });

      expect(up.status).toBe(200);
      const storedName = up.body.file_path;

      const down = await request(app)
        .get(`/api/chat/files/${storedName}`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .buffer(true)
        .parse((res, cb) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(down.status).toBe(200);
      // Entschluesselter Download == Original-Upload
      expect(Buffer.isBuffer(down.body)).toBe(true);
      expect(down.body.equals(pngBuffer)).toBe(true);
    });
  });

  // ================================================================
  // POST /api/chat/rooms/:roomId/polls
  // ================================================================
  describe('POST /api/chat/rooms/:roomId/polls', () => {
    it('Admin erstellt Umfrage -> 201 (Socket-Emit kippt ohne io nicht)', async () => {
      // Regression für Audit Achse 2, Luecke 10a: Der Poll-Handler emittet nun
      // 'newMessage' + Push. In Tests ist io=null -> alle Emits sind No-ops und
      // duerfen den 201-Pfad nicht stoeren.
      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/polls`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({
          question: 'Wann treffen wir uns?',
          options: ['Montag', 'Dienstag'],
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.message_id).toBeDefined();
      expect(res.body.question).toBe('Wann treffen wir uns?');
      expect(res.body.options).toEqual(['Montag', 'Dienstag']);
      expect(res.body.votes).toEqual([]);
    });

    it('Konfi darf keine Umfrage erstellen -> 403', async () => {
      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/polls`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({
          question: 'Frage?',
          options: ['A', 'B'],
        });

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // Private Zweiergespraeche: kein Admin-Bypass
  //
  // Entscheidung 23.08.2026: Die Leitung darf jeden Raum ihrer Gemeinde
  // oeffnen — AUSSER fremde Direktchats. Gruppen-, Jahrgangs- und Team-Chats
  // bleiben offen, ein Zwiegespraech ist privat.
  // ================================================================
  describe('Fremde Direktchats sind auch fuer die Leitung zu', () => {
    // Raum 2 ist ein Direktchat konfi1 <-> admin1. orgAdmin1 steht nicht drin.
    let orgAdmin1Token;

    beforeEach(() => {
      orgAdmin1Token = generateToken('orgAdmin1');
    });

    it('Leitung kann einen fremden Direktchat NICHT lesen -> 403', async () => {
      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.direct.id}/messages`)
        .set('Authorization', `Bearer ${orgAdmin1Token}`);
      expect(res.status).toBe(403);
    });

    it('Leitung kann einen fremden Direktchat NICHT oeffnen -> 403', async () => {
      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.direct.id}`)
        .set('Authorization', `Bearer ${orgAdmin1Token}`);
      expect(res.status).toBe(403);
    });

    it('Leitung kann einen fremden Direktchat NICHT exportieren -> 403', async () => {
      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.direct.id}/export`)
        .set('Authorization', `Bearer ${orgAdmin1Token}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Private Zweiergespräche lassen sich nicht exportieren');
    });

    it('Leitung kann in einem fremden Direktchat NICHT schreiben -> 403', async () => {
      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.direct.id}/messages`)
        .set('Authorization', `Bearer ${orgAdmin1Token}`)
        .send({ content: 'Mitgelesen?' });
      expect(res.status).toBe(403);
    });

    it('Leitung kann in einem fremden Direktchat KEINE Umfrage anlegen -> 404', async () => {
      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.direct.id}/polls`)
        .set('Authorization', `Bearer ${orgAdmin1Token}`)
        .send({ question: 'Frage?', options: ['A', 'B'] });
      expect(res.status).toBe(404);
    });

    it('Am EIGENEN Direktchat aendert sich nichts -> 200', async () => {
      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.direct.id}/messages`)
        .set('Authorization', `Bearer ${admin1Token}`);
      expect(res.status).toBe(200);
    });

    it('Gruppenchats bleiben fuer die Leitung offen -> 200', async () => {
      const { rows } = await db.query(
        'SELECT 1 FROM chat_participants WHERE room_id = $1 AND user_id = $2',
        [CHAT_ROOMS.group.id, USERS.orgAdmin1.id]
      );
      expect(rows.length).toBe(0);

      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.group.id}/messages`)
        .set('Authorization', `Bearer ${orgAdmin1Token}`);
      expect(res.status).toBe(200);
    });

    it('Jahrgangs-Chats bleiben fuer die Leitung offen -> 200', async () => {
      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${orgAdmin1Token}`);
      expect(res.status).toBe(200);
    });

    it('Teamer:innen kommen weiterhin nicht in fremde Raeume -> 403', async () => {
      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.direct.id}/messages`)
        .set('Authorization', `Bearer ${teamer1Token}`);
      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // Exklusive Umfragen über BEIDE Abstimm-Routen
  //
  // Befund 23.08.2026: POST /messages/:messageId/vote hatte eine eigene,
  // unvollstaendige Kopie der Abstimmlogik und ignorierte exclusive_options
  // vollstaendig — über sie konnten mehrere Personen dieselbe Option belegen,
  // während /polls/:pollId/vote das korrekt mit 409 ablehnt.
  // ================================================================
  // ================================================================
  // Abstimmen: dieselbe Raum-Regel wie ueberall sonst (28.08.2026)
  //
  // Die Abstimm-Route hatte eine eigene Kopie der Zugriffspruefung, die
  // strikt einen Eintrag in chat_participants verlangte. Damit durfte die
  // Leitung in einem Gruppenchat, in dem sie nicht eingetragen ist, eine
  // Umfrage ANLEGEN, aber nicht abstimmen. Jetzt laeuft beides ueber
  // darfRaumOeffnen — inklusive der Ausnahme fuer fremde Direktchats.
  // ================================================================
  describe('Abstimmen folgt der Raum-Regel', () => {
    let orgAdmin1Token;

    beforeEach(() => {
      orgAdmin1Token = generateToken('orgAdmin1');
    });

    const umfrageAnlegen = async (roomId, token) => {
      const res = await request(app)
        .post(`/api/chat/rooms/${roomId}/polls`)
        .set('Authorization', `Bearer ${token}`)
        .send({ question: 'Wann treffen wir uns?', options: ['Freitag', 'Samstag'] });
      expect(res.status).toBe(201);
      return res.body;
    };

    it('Leitung stimmt in ihrer eigenen Gruppenchat-Umfrage ab -> 200 (der erlaubte Fall)', async () => {
      // Vorbedingung absichern: orgAdmin1 ist NICHT Teilnehmerin von Raum 3.
      const { rows } = await db.query(
        'SELECT 1 FROM chat_participants WHERE room_id = $1 AND user_id = $2',
        [CHAT_ROOMS.group.id, USERS.orgAdmin1.id]
      );
      expect(rows.length).toBe(0);

      const poll = await umfrageAnlegen(CHAT_ROOMS.group.id, orgAdmin1Token);

      const res = await request(app)
        .post(`/api/chat/polls/${poll.id}/vote`)
        .set('Authorization', `Bearer ${orgAdmin1Token}`)
        .send({ option_index: 0 });

      expect(res.status).toBe(200);
    });

    it('Konfi aus einer anderen Gemeinde darf nicht abstimmen -> 403', async () => {
      const poll = await umfrageAnlegen(CHAT_ROOMS.jahrgang.id, admin1Token);

      const res = await request(app)
        .post(`/api/chat/polls/${poll.id}/vote`)
        .set('Authorization', `Bearer ${konfi3Token}`)
        .send({ option_index: 0 });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Zugriff auf diesen Raum verweigert');
    });

    it('Leitung darf im fremden Direktchat nicht abstimmen -> 403', async () => {
      // Raum 2 ist der Direktchat konfi1 <-> admin1; orgAdmin1 gehoert nicht dazu.
      // admin1 ist Teilnehmer und darf dort anlegen.
      const poll = await umfrageAnlegen(CHAT_ROOMS.direct.id, admin1Token);

      const res = await request(app)
        .post(`/api/chat/polls/${poll.id}/vote`)
        .set('Authorization', `Bearer ${orgAdmin1Token}`)
        .send({ option_index: 0 });

      expect(res.status).toBe(403);
    });

    it('Abgelaufene fremde Umfrage verraet ihren Zustand nicht -> 403 statt 400', async () => {
      const poll = await umfrageAnlegen(CHAT_ROOMS.jahrgang.id, admin1Token);
      await db.query(
        "UPDATE chat_polls SET expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1",
        [poll.id]
      );

      const res = await request(app)
        .post(`/api/chat/polls/${poll.id}/vote`)
        .set('Authorization', `Bearer ${konfi3Token}`)
        .send({ option_index: 0 });

      expect(res.status).toBe(403);
    });

    it('Ueber die Nachrichten-ID gilt dieselbe Regel -> 403', async () => {
      const poll = await umfrageAnlegen(CHAT_ROOMS.jahrgang.id, admin1Token);

      const res = await request(app)
        .post(`/api/chat/messages/${poll.message_id}/vote`)
        .set('Authorization', `Bearer ${konfi3Token}`)
        .send({ option_index: 0 });

      expect(res.status).toBe(403);
    });
  });

  describe('Exklusive Umfragen — beide Abstimm-Routen', () => {
    const exklusiveUmfrageAnlegen = async () => {
      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/polls`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({
          question: 'Wer macht welche Tour?',
          options: ['Tour A', 'Tour B'],
          exclusive_options: true,
        });
      expect(res.status).toBe(201);
      return res.body;
    };

    it('ueber /messages/:id/vote ist eine belegte Option gesperrt -> 409 (der Befund)', async () => {
      const poll = await exklusiveUmfrageAnlegen();

      const erste = await request(app)
        .post(`/api/chat/messages/${poll.message_id}/vote`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ option_index: 0 });
      expect(erste.status).toBe(200);

      const zweite = await request(app)
        .post(`/api/chat/messages/${poll.message_id}/vote`)
        .set('Authorization', `Bearer ${konfi2Token}`)
        .send({ option_index: 0 });
      expect(zweite.status).toBe(409);
      expect(zweite.body.error).toBe('Diese Option ist bereits vergeben');
    });

    it('ueber /polls/:id/vote ebenso -> 409 (war schon vorher richtig)', async () => {
      const poll = await exklusiveUmfrageAnlegen();

      const erste = await request(app)
        .post(`/api/chat/polls/${poll.id}/vote`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ option_index: 0 });
      expect(erste.status).toBe(200);

      const zweite = await request(app)
        .post(`/api/chat/polls/${poll.id}/vote`)
        .set('Authorization', `Bearer ${konfi2Token}`)
        .send({ option_index: 0 });
      expect(zweite.status).toBe(409);
    });

    it('beide Routen mischbar: erst /polls, dann /messages -> 409', async () => {
      const poll = await exklusiveUmfrageAnlegen();

      const erste = await request(app)
        .post(`/api/chat/polls/${poll.id}/vote`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ option_index: 1 });
      expect(erste.status).toBe(200);

      const zweite = await request(app)
        .post(`/api/chat/messages/${poll.message_id}/vote`)
        .set('Authorization', `Bearer ${konfi2Token}`)
        .send({ option_index: 1 });
      expect(zweite.status).toBe(409);
    });

    it('eine FREIE Option bleibt waehlbar — der erlaubte Fall', async () => {
      const poll = await exklusiveUmfrageAnlegen();

      const erste = await request(app)
        .post(`/api/chat/messages/${poll.message_id}/vote`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ option_index: 0 });
      expect(erste.status).toBe(200);

      const zweite = await request(app)
        .post(`/api/chat/messages/${poll.message_id}/vote`)
        .set('Authorization', `Bearer ${konfi2Token}`)
        .send({ option_index: 1 });
      expect(zweite.status).toBe(200);
    });

    it('die eigene Wahl laesst sich ueber /messages wieder freigeben', async () => {
      const poll = await exklusiveUmfrageAnlegen();

      await request(app)
        .post(`/api/chat/messages/${poll.message_id}/vote`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ option_index: 0 })
        .expect(200);

      // Nochmal dieselbe Option = Toggle off
      const zurueck = await request(app)
        .post(`/api/chat/messages/${poll.message_id}/vote`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ option_index: 0 });
      expect(zurueck.status).toBe(200);
      expect(zurueck.body.action).toBe('removed');

      // Jetzt ist sie für Konfi2 frei.
      const andere = await request(app)
        .post(`/api/chat/messages/${poll.message_id}/vote`)
        .set('Authorization', `Bearer ${konfi2Token}`)
        .send({ option_index: 0 });
      expect(andere.status).toBe(200);
    });
  });

  // ================================================================
  // Anonyme Umfragen: Kennungen fremder Stimmen
  //
  // Befund 23.08.2026: Bei anonymous=true fehlte zwar der Name, user_id und
  // user_type kamen aber je Stimme weiterhin mit. Über die Teilnehmerliste
  // liess sich daraus aufloesen, wer was gewählt hat.
  // ================================================================
  describe('GET /api/chat/rooms/:roomId/messages — Anonymitaet von Umfragen', () => {
    const umfrageAnlegen = async (anonymous) => {
      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/polls`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ question: 'Wer kommt mit?', options: ['Ja', 'Nein'], anonymous });
      expect(res.status).toBe(201);
      return res.body;
    };

    const abstimmen = async (token, messageId, optionIndex) => {
      const res = await request(app)
        .post(`/api/chat/messages/${messageId}/vote`)
        .set('Authorization', `Bearer ${token}`)
        .send({ option_index: optionIndex });
      expect(res.status).toBe(200);
    };

    const umfrageLesen = async (token, messageId) => {
      const res = await request(app)
        .get(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      const treffer = res.body.find(m => m.id === messageId);
      expect(treffer).toBeDefined();
      return treffer;
    };

    it('anonym: fremde Stimmen kommen OHNE user_id und user_type', async () => {
      const poll = await umfrageAnlegen(true);
      await abstimmen(konfi1Token, poll.message_id, 0);

      // Konfi2 liest: die Stimme von Konfi1 ist fremd.
      const msg = await umfrageLesen(konfi2Token, poll.message_id);
      expect(msg.anonymous).toBe(true);
      expect(msg.votes).toHaveLength(1);
      expect(msg.votes[0].user_id).toBeNull();
      expect(msg.votes[0].user_type).toBeNull();
      expect(msg.votes[0].user_name).toBeUndefined();
      // Die Zählung bleibt erhalten — nur die Zuordnung fällt weg.
      expect(msg.votes[0].option_index).toBe(0);
    });

    it('anonym: die EIGENE Stimme behaelt ihre Kennung (sonst nicht markierbar)', async () => {
      const poll = await umfrageAnlegen(true);
      await abstimmen(konfi1Token, poll.message_id, 1);

      const msg = await umfrageLesen(konfi1Token, poll.message_id);
      expect(msg.votes).toHaveLength(1);
      expect(msg.votes[0].user_id).toBe(USERS.konfi1.id);
      expect(msg.votes[0].user_type).toBe('konfi');
      expect(msg.votes[0].option_index).toBe(1);
    });

    it('anonym mit mehreren Stimmen: nur die eigene traegt eine Kennung', async () => {
      const poll = await umfrageAnlegen(true);
      await abstimmen(konfi1Token, poll.message_id, 0);
      await abstimmen(konfi2Token, poll.message_id, 1);

      const msg = await umfrageLesen(konfi1Token, poll.message_id);
      expect(msg.votes).toHaveLength(2);

      const eigene = msg.votes.filter(v => v.user_id !== null);
      const fremde = msg.votes.filter(v => v.user_id === null);
      expect(eigene).toHaveLength(1);
      expect(eigene[0].user_id).toBe(USERS.konfi1.id);
      expect(fremde).toHaveLength(1);
      expect(fremde[0].user_type).toBeNull();
    });

    it('nicht anonym: Kennung UND Name kommen mit — der erlaubte Fall', async () => {
      const poll = await umfrageAnlegen(false);
      await abstimmen(konfi1Token, poll.message_id, 0);

      const msg = await umfrageLesen(konfi2Token, poll.message_id);
      expect(msg.anonymous).toBe(false);
      expect(msg.votes).toHaveLength(1);
      expect(msg.votes[0].user_id).toBe(USERS.konfi1.id);
      expect(msg.votes[0].user_type).toBe('konfi');
      expect(msg.votes[0].user_name).toBe(USERS.konfi1.display_name);
    });

    it('anonym: auch die Leitung kann fremde Stimmen nicht zuordnen', async () => {
      // Die Zusage gilt gegenueber der Gruppe UND der Leitung — anders als bei
      // Challenges, wo die Leitung bewusst alles sieht.
      const poll = await umfrageAnlegen(true);
      await abstimmen(konfi1Token, poll.message_id, 0);

      const msg = await umfrageLesen(admin1Token, poll.message_id);
      expect(msg.votes).toHaveLength(1);
      expect(msg.votes[0].user_id).toBeNull();
      expect(msg.votes[0].user_type).toBeNull();
    });
  });
  // ================================================================
  // POST /api/chat/badge-update — entfernt (24.08.2026)
  // ================================================================
  describe('POST /api/chat/badge-update (entfernte Route)', () => {
    it('Route existiert nicht mehr -> 404, auch mit gültigem Token', async () => {
      const res = await request(app)
        .post('/api/chat/badge-update')
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({});

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // DELETE /api/chat/rooms/:roomId/messages — Team-Chat leeren
  // (Nutzerwunsch 26.08.2026: Muelleimer im Header, Raum bleibt bestehen)
  // ================================================================
  // ================================================================
  // DELETE /api/chat/messages/:messageId — einzelne Nachricht loeschen
  //
  // Befund 26.08.2026: Der Kommentar an der Route sagt "Fremde Nachricht: nur
  // Leitung/Admins", und die Oberflaeche haelt sich daran (MessageBubble zeigt
  // den Papierkorb Teamer:innen nur bei eigenen Nachrichten, Konfis nie).
  // Der Code prueft das aber nicht: darfRaumOeffnen liefert fuer JEDE:N
  // Teilnehmer:in true. Damit konnte jede Konfi per API jede fremde Nachricht
  // im selben Raum loeschen.
  // ================================================================
  describe('DELETE /api/chat/messages/:messageId', () => {
    // Raum 1 (Jahrgang) hat konfi1, konfi2, teamer1 und admin1 als Teilnehmer.
    const RAUM = CHAT_ROOMS.jahrgang.id;

    const nachrichtVon = async (userId, userType, inhalt) => {
      const { rows: [msg] } = await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content)
         VALUES ($1, $2, $3, 'text', $4) RETURNING id`,
        [RAUM, userId, userType, inhalt]
      );
      return msg.id;
    };

    const istGeloescht = async (id) => {
      const { rows: [msg] } = await db.query(
        'SELECT deleted_at FROM chat_messages WHERE id = $1', [id]
      );
      return msg.deleted_at !== null;
    };

    it('Konfi darf die eigene Nachricht loeschen -> 200', async () => {
      const id = await nachrichtVon(USERS.konfi1.id, 'konfi', 'Meine Nachricht');

      const res = await request(app)
        .delete(`/api/chat/messages/${id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(200);
      expect(await istGeloescht(id)).toBe(true);
    });

    it('Konfi darf die Nachricht einer ANDEREN Konfi NICHT loeschen -> 403', async () => {
      const id = await nachrichtVon(USERS.konfi2.id, 'konfi', 'Fremde Nachricht');

      const res = await request(app)
        .delete(`/api/chat/messages/${id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(403);
      expect(await istGeloescht(id)).toBe(false);
    });

    it('Konfi darf die Nachricht der Leitung NICHT loeschen -> 403', async () => {
      const id = await nachrichtVon(USERS.admin1.id, 'admin', 'Ansage der Leitung');

      const res = await request(app)
        .delete(`/api/chat/messages/${id}`)
        .set('Authorization', `Bearer ${konfi1Token}`);

      expect(res.status).toBe(403);
      expect(await istGeloescht(id)).toBe(false);
    });

    it('Teamer:in darf eine fremde Nachricht NICHT loeschen -> 403', async () => {
      // Die Oberflaeche zeigt Teamer:innen den Papierkorb bewusst nur bei
      // eigenen Nachrichten -- das Backend muss dasselbe durchsetzen.
      const id = await nachrichtVon(USERS.konfi1.id, 'konfi', 'Konfi-Nachricht');

      const res = await request(app)
        .delete(`/api/chat/messages/${id}`)
        .set('Authorization', `Bearer ${teamer1Token}`);

      expect(res.status).toBe(403);
      expect(await istGeloescht(id)).toBe(false);
    });

    it('Teamer:in darf die eigene Nachricht loeschen -> 200', async () => {
      const id = await nachrichtVon(USERS.teamer1.id, 'teamer', 'Meine Nachricht');

      const res = await request(app)
        .delete(`/api/chat/messages/${id}`)
        .set('Authorization', `Bearer ${teamer1Token}`);

      expect(res.status).toBe(200);
      expect(await istGeloescht(id)).toBe(true);
    });

    it('Leitung darf eine fremde Nachricht loeschen -> 200', async () => {
      // Gegenprobe: Die Regel darf nicht pauschal blocken. Nur Admins duerfen
      // fremde Nachrichten entfernen (Entscheidung 23.08.2026, rechtlich
      // relevante Inhalte).
      const id = await nachrichtVon(USERS.konfi1.id, 'konfi', 'Konfi-Nachricht');

      const res = await request(app)
        .delete(`/api/chat/messages/${id}`)
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(res.status).toBe(200);
      expect(await istGeloescht(id)).toBe(true);
    });

    it('Leitung darf in einem fremden Zweiergespraech NICHT loeschen -> 403', async () => {
      // Raum 2 ist ein Direktchat zwischen konfi1 und admin1. admin2 gehoert
      // nicht dazu und darf dort auch als Leitung nichts loeschen.
      const { rows: [msg] } = await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content)
         VALUES ($1, $2, 'konfi', 'text', 'Privat') RETURNING id`,
        [CHAT_ROOMS.direct.id, USERS.konfi1.id]
      );
      const admin2Token = generateToken('admin2');

      const res = await request(app)
        .delete(`/api/chat/messages/${msg.id}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(403);
      expect(await istGeloescht(msg.id)).toBe(false);
    });
  });

  describe('DELETE /api/chat/rooms/:roomId/messages (Team-Chat leeren)', () => {
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    const CHAT_DIR = path.join(os.tmpdir(), 'konfi-test-uploads', 'chat');
    const TEAM_ROOM_ID = 50;

    beforeEach(async () => {
      // Automatischen Team-Chat samt Mitgliedern und Verlauf anlegen
      await db.query(
        `INSERT INTO chat_rooms (id, name, type, is_team_chat, organization_id, created_by)
         VALUES ($1, 'Team', 'admin', true, 1, $2)`,
        [TEAM_ROOM_ID, USERS.admin1.id]
      );
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type)
         VALUES ($1, $2, 'admin'), ($1, $3, 'teamer')`,
        [TEAM_ROOM_ID, USERS.admin1.id, USERS.teamer1.id]
      );
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content)
         VALUES ($1, $2, 'admin', 'text', 'Hallo Team'),
                ($1, $3, 'teamer', 'text', 'Moin')`,
        [TEAM_ROOM_ID, USERS.admin1.id, USERS.teamer1.id]
      );
    });

    async function messageMitDatei(filename) {
      await fs.promises.mkdir(CHAT_DIR, { recursive: true });
      await fs.promises.writeFile(path.join(CHAT_DIR, filename), Buffer.from('testdatei'));
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, file_path, file_name)
         VALUES ($1, $2, 'admin', 'file', 'Anhang', $3, 'anhang.txt')`,
        [TEAM_ROOM_ID, USERS.admin1.id, filename]
      );
    }

    it('Leitung leert den Team-Chat -> 200, Nachrichten und Dateien weg, Raum und Mitglieder bleiben', async () => {
      const filename = 'teamchat-clear-test.bin';
      await messageMitDatei(filename);

      // Umfrage samt Stimme anhaengen — die CASCADE-Regeln muessen mitraeumen
      const { rows: [pollMsg] } = await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content)
         VALUES ($1, $2, 'admin', 'poll', 'Umfrage') RETURNING id`,
        [TEAM_ROOM_ID, USERS.admin1.id]
      );
      const { rows: [poll] } = await db.query(
        `INSERT INTO chat_polls (message_id, question, options)
         VALUES ($1, 'Wer kommt?', '["Ja","Nein"]') RETURNING id`,
        [pollMsg.id]
      );
      await db.query(
        `INSERT INTO chat_poll_votes (poll_id, user_id, user_type, option_index)
         VALUES ($1, $2, 'teamer', 0)`,
        [poll.id, USERS.teamer1.id]
      );

      const res = await request(app)
        .delete(`/api/chat/rooms/${TEAM_ROOM_ID}/messages`)
        .set('Authorization', `Bearer ${admin1Token}`);
      expect(res.status).toBe(200);
      expect(res.body.deleted_count).toBe(4);

      const { rows: [msgCount] } = await db.query(
        'SELECT COUNT(*)::int AS count FROM chat_messages WHERE room_id = $1', [TEAM_ROOM_ID]
      );
      expect(msgCount.count).toBe(0);
      const { rows: [pollCount] } = await db.query('SELECT COUNT(*)::int AS count FROM chat_polls WHERE id = $1', [poll.id]);
      expect(pollCount.count).toBe(0);
      expect(fs.existsSync(path.join(CHAT_DIR, filename))).toBe(false);

      // Raum und Mitglieder bleiben bestehen
      const { rows: [room] } = await db.query('SELECT id FROM chat_rooms WHERE id = $1', [TEAM_ROOM_ID]);
      expect(room).toBeDefined();
      const { rows: [partCount] } = await db.query(
        'SELECT COUNT(*)::int AS count FROM chat_participants WHERE room_id = $1', [TEAM_ROOM_ID]
      );
      expect(partCount.count).toBe(2);
    });

    it('Verbotener Fall: Teamer bekommt 403, Nachrichten bleiben', async () => {
      const res = await request(app)
        .delete(`/api/chat/rooms/${TEAM_ROOM_ID}/messages`)
        .set('Authorization', `Bearer ${teamer1Token}`);
      expect(res.status).toBe(403);

      const { rows: [msgCount] } = await db.query(
        'SELECT COUNT(*)::int AS count FROM chat_messages WHERE room_id = $1', [TEAM_ROOM_ID]
      );
      expect(msgCount.count).toBe(2);
    });

    it('Verbotener Fall: Konfi bekommt 403', async () => {
      const res = await request(app)
        .delete(`/api/chat/rooms/${TEAM_ROOM_ID}/messages`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.status).toBe(403);
    });

    it('Normaler Chat (kein Team-Chat) laesst sich NICHT leeren -> 409', async () => {
      const res = await request(app)
        .delete(`/api/chat/rooms/${CHAT_ROOMS.group.id}/messages`)
        .set('Authorization', `Bearer ${admin1Token}`);
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Nur der Team-Chat lässt sich leeren.');
    });

    it('Team-Chat einer ANDEREN Org -> 404', async () => {
      // admin2 gehoert zu Org 2, der Team-Chat zu Org 1
      const admin2Token = generateToken('admin2');
      const res = await request(app)
        .delete(`/api/chat/rooms/${TEAM_ROOM_ID}/messages`)
        .set('Authorization', `Bearer ${admin2Token}`);
      expect(res.status).toBe(404);

      const { rows: [msgCount] } = await db.query(
        'SELECT COUNT(*)::int AS count FROM chat_messages WHERE room_id = $1', [TEAM_ROOM_ID]
      );
      expect(msgCount.count).toBe(2);
    });

    // Das Leeren entfernt ALLE Nachrichten samt Dateien in einer Schleife.
    // Der weite generalLimiter (2000/15min) ist dafuer keine echte Bremse —
    // CodeQL meldete die Route deshalb als "Missing rate limiting"
    // (26.08.2026). Geprueft wird die Verdrahtung in createApp, mit einem
    // echten express-rate-limit und kleinem Limit.
    describe('Rate-Limit', () => {
      const rateLimit = require('express-rate-limit');
      const { createApp } = require('../../createApp');

      function appMitLimit(max) {
        return createApp(db, {
          uploadsDir: path.join(os.tmpdir(), 'konfi-test-uploads'),
          rateLimiters: {
            chatClearLimiter: rateLimit({
              windowMs: 60 * 1000,
              max,
              message: { error: 'Zu viele Leerungen des Team-Chats. Bitte versuche es spaeter erneut.' },
              standardHeaders: true,
              legacyHeaders: false
            })
          }
        });
      }

      it('erlaubte Aufrufe kommen durch, der Aufruf ueber dem Limit wird mit 429 geblockt', async () => {
        const begrenzt = appMitLimit(2);

        // Zwei Leerungen sind erlaubt und erreichen den Handler.
        for (let i = 0; i < 2; i++) {
          const res = await request(begrenzt)
            .delete(`/api/chat/rooms/${TEAM_ROOM_ID}/messages`)
            .set('Authorization', `Bearer ${admin1Token}`);
          expect(res.status).toBe(200);
        }

        // Der dritte Aufruf greift VOR dem Handler.
        const res = await request(begrenzt)
          .delete(`/api/chat/rooms/${TEAM_ROOM_ID}/messages`)
          .set('Authorization', `Bearer ${admin1Token}`);
        expect(res.status).toBe(429);
        expect(res.body.error).toBe('Zu viele Leerungen des Team-Chats. Bitte versuche es spaeter erneut.');
      });

      it('der Limiter haengt nur am Leeren, nicht am Lesen der Nachrichten', async () => {
        const begrenzt = appMitLimit(1);

        const geleert = await request(begrenzt)
          .delete(`/api/chat/rooms/${TEAM_ROOM_ID}/messages`)
          .set('Authorization', `Bearer ${admin1Token}`);
        expect(geleert.status).toBe(200);

        // GET auf denselben Pfad zaehlt nicht mit -> bleibt erreichbar.
        const gelesen = await request(begrenzt)
          .get(`/api/chat/rooms/${TEAM_ROOM_ID}/messages`)
          .set('Authorization', `Bearer ${admin1Token}`);
        expect(gelesen.status).toBe(200);
      });
    });
  });

  // ================================================================
  // DELETE /api/chat/rooms/:roomId — Raum loeschen raeumt die Dateien mit weg
  // ================================================================
  describe('DELETE /api/chat/rooms/:roomId (Dateien aufraeumen)', () => {
    // Gefunden 28.08.2026 beim Aufteilen von events.js: Diese Stelle baute den
    // Pfad ueber path.join(__dirname, '..', 'uploads', 'chat', ...), obwohl das
    // Modul ein uploadsDir injiziert bekommt und es an vier anderen Stellen
    // auch benutzt. Weicht das echte Upload-Verzeichnis vom Standardpfad ab —
    // wie hier im Test und wie ueberall dort, wo die Uploads auf einem eigenen
    // Volume liegen —, loeschte die Stelle am falschen Ort: Der Raum war weg,
    // die Dateien blieben auf der Platte liegen.
    // Gruppenraum, nicht Jahrgang: Jahrgangs-Raeume laufen ueber das Loeschen
    // des Jahrgangs und lassen sich hier nicht direkt entfernen.
    const RAUM = CHAT_ROOMS.group.id;
    const chatDir = path.join(os.tmpdir(), 'konfi-test-uploads', 'chat');

    it('loescht die Dateien im injizierten uploadsDir, nicht im Standardpfad', async () => {
      fs.mkdirSync(chatDir, { recursive: true });
      const dateiname = `test-raumloeschen-${Date.now()}.jpg`;
      const dateipfad = path.join(chatDir, dateiname);
      fs.writeFileSync(dateipfad, 'Inhalt');

      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, file_path)
         VALUES ($1, $2, 'admin', 'file', 'Datei', $3)`,
        [RAUM, USERS.admin1.id, dateiname]
      );

      expect(fs.existsSync(dateipfad)).toBe(true);

      const res = await request(app)
        .delete(`/api/chat/rooms/${RAUM}`)
        .query({ force: 'true' })
        .set('Authorization', `Bearer ${admin1Token}`);
      expect(res.status).toBe(200);

      // Der Raum ist weg — und die Datei mit ihm.
      expect(fs.existsSync(dateipfad)).toBe(false);

      const { rows: [raum] } = await db.query(
        'SELECT COUNT(*)::int AS count FROM chat_rooms WHERE id = $1', [RAUM]
      );
      expect(raum.count).toBe(0);
    });
  });

  // ================================================================
  // POST /api/chat/messages/:messageId/reactions
  // ================================================================
  describe('POST /api/chat/messages/:messageId/reactions', () => {
    // Befund HOCH (Chat-Pruefauftrag 27.08.2026): Teamer:innen konnten auf
    // keine Nachricht reagieren. Die Route speichert user_type aus
    // req.user.type -- fuer Teamer:innen 'teamer' --, der CHECK an
    // chat_message_reactions kannte aber nur 'admin' und 'konfi'. Ergebnis:
    // 500 statt 200, waehrend Admin und Konfi funktionierten. Behoben mit
    // Migration 132.
    //
    // Raum 1 (Jahrgang) hat konfi1, konfi2, teamer1 und admin1 als Teilnehmer.
    const RAUM = CHAT_ROOMS.jahrgang.id;

    const nachrichtVon = async (userId, userType) => {
      const { rows: [msg] } = await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content)
         VALUES ($1, $2, $3, 'text', 'Nachricht zum Reagieren') RETURNING id`,
        [RAUM, userId, userType]
      );
      return msg.id;
    };

    const reaktionenAus = async (messageId) => {
      const { rows } = await db.query(
        `SELECT user_id, user_type, emoji FROM chat_message_reactions
          WHERE message_id = $1 ORDER BY user_type`,
        [messageId]
      );
      return rows;
    };

    it('Teamer:in reagiert im eigenen Raum -> 200 und die Reaktion steht in der DB', async () => {
      const id = await nachrichtVon(USERS.konfi1.id, 'konfi');

      const res = await request(app)
        .post(`/api/chat/messages/${id}/reactions`)
        .set('Authorization', `Bearer ${teamer1Token}`)
        .send({ emoji: 'heart' });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('added');
      expect(res.body.emoji).toBe('heart');

      expect(await reaktionenAus(id)).toEqual([
        { user_id: USERS.teamer1.id, user_type: 'teamer', emoji: 'heart' },
      ]);
    });

    it('Teamer:in nimmt die eigene Reaktion wieder zurueck -> 200 und die DB ist leer', async () => {
      const id = await nachrichtVon(USERS.konfi1.id, 'konfi');

      const gesetzt = await request(app)
        .post(`/api/chat/messages/${id}/reactions`)
        .set('Authorization', `Bearer ${teamer1Token}`)
        .send({ emoji: 'pray' });
      expect(gesetzt.status).toBe(200);
      expect(gesetzt.body.action).toBe('added');

      const zurueck = await request(app)
        .post(`/api/chat/messages/${id}/reactions`)
        .set('Authorization', `Bearer ${teamer1Token}`)
        .send({ emoji: 'pray' });

      expect(zurueck.status).toBe(200);
      expect(zurueck.body.action).toBe('removed');
      expect(await reaktionenAus(id)).toEqual([]);
    });

    it('Admin reagiert weiterhin -> 200 und die Reaktion steht in der DB', async () => {
      const id = await nachrichtVon(USERS.konfi1.id, 'konfi');

      const res = await request(app)
        .post(`/api/chat/messages/${id}/reactions`)
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ emoji: 'like' });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('added');

      expect(await reaktionenAus(id)).toEqual([
        { user_id: USERS.admin1.id, user_type: 'admin', emoji: 'like' },
      ]);
    });

    it('Konfi reagiert weiterhin -> 200 und die Reaktion steht in der DB', async () => {
      const id = await nachrichtVon(USERS.teamer1.id, 'teamer');

      const res = await request(app)
        .post(`/api/chat/messages/${id}/reactions`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ emoji: 'laugh' });

      expect(res.status).toBe(200);
      expect(res.body.action).toBe('added');

      expect(await reaktionenAus(id)).toEqual([
        { user_id: USERS.konfi1.id, user_type: 'konfi', emoji: 'laugh' },
      ]);
    });

    // Messung 28.08.2026 (Punkt 5 des Handoffs): Das 403 fuer
    // Nicht-Teilnehmende war gemessen, aber durch keinen Test festgehalten.
    // Diese vier Tests halten den Ist-Zustand fest, damit er nicht still
    // wegbricht.
    //
    // Beachte den Unterschied zum Abstimmen: Reagieren verlangt strikt einen
    // Eintrag in chat_participants, kennt also KEINEN Leitungs-Zugriff auf
    // Gruppen- und Jahrgangschats. Lesen der Reaktionen (GET, weiter unten)
    // laesst die Leitung dagegen durch (darfRaumOeffnen). Beim Abstimmen wurde
    // das am 28.08.2026 angeglichen; hier bleibt es bewusst beim strengeren
    // Verhalten, solange es niemand anders entscheidet.
    it('Fremde Gemeinde darf nicht reagieren -> 403', async () => {
      const id = await nachrichtVon(USERS.konfi1.id, 'konfi');

      const res = await request(app)
        .post(`/api/chat/messages/${id}/reactions`)
        .set('Authorization', `Bearer ${konfi3Token}`)
        .send({ emoji: 'like' });

      expect(res.status).toBe(403);
      expect(await reaktionenAus(id)).toEqual([]);
    });

    it('Leitung ohne Teilnahme darf im Gruppenchat nicht reagieren -> 403', async () => {
      const orgAdmin1Token = generateToken('orgAdmin1');
      const { rows } = await db.query(
        'SELECT 1 FROM chat_participants WHERE room_id = $1 AND user_id = $2',
        [CHAT_ROOMS.group.id, USERS.orgAdmin1.id]
      );
      expect(rows.length).toBe(0);

      const { rows: [msg] } = await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, content, message_type)
         VALUES ($1, $2, 'teamer', 'Hallo Gruppe', 'text') RETURNING id`,
        [CHAT_ROOMS.group.id, USERS.teamer1.id]
      );

      const res = await request(app)
        .post(`/api/chat/messages/${msg.id}/reactions`)
        .set('Authorization', `Bearer ${orgAdmin1Token}`)
        .send({ emoji: 'like' });

      expect(res.status).toBe(403);
    });

    it('Leitung DARF die Reaktionen desselben Raums aber lesen -> 200', async () => {
      // Gegenprobe: Lesen laeuft ueber darfRaumOeffnen und laesst die Leitung
      // durch. Die beiden Regeln sind unterschiedlich — festgehalten, damit
      // niemand die eine fuer einen Fehler der anderen haelt.
      const orgAdmin1Token = generateToken('orgAdmin1');
      const { rows: [msg] } = await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, content, message_type)
         VALUES ($1, $2, 'teamer', 'Hallo Gruppe', 'text') RETURNING id`,
        [CHAT_ROOMS.group.id, USERS.teamer1.id]
      );

      const res = await request(app)
        .get(`/api/chat/messages/${msg.id}/reactions`)
        .set('Authorization', `Bearer ${orgAdmin1Token}`);

      expect(res.status).toBe(200);
    });

    it('Nachricht, die es nicht gibt -> 404', async () => {
      const res = await request(app)
        .post('/api/chat/messages/999999/reactions')
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ emoji: 'like' });

      expect(res.status).toBe(404);
    });

    it('Alle drei Rollen reagieren auf dieselbe Nachricht -> drei Zeilen', async () => {
      // Gegenprobe zum zu engen CHECK: nur wenn alle drei user_type-Werte
      // erlaubt sind, stehen hier auch drei Reaktionen.
      const id = await nachrichtVon(USERS.konfi2.id, 'konfi');

      for (const [token, emoji] of [
        [admin1Token, 'like'],
        [teamer1Token, 'heart'],
        [konfi1Token, 'wow'],
      ]) {
        const res = await request(app)
          .post(`/api/chat/messages/${id}/reactions`)
          .set('Authorization', `Bearer ${token}`)
          .send({ emoji });
        expect(res.status).toBe(200);
      }

      expect(await reaktionenAus(id)).toEqual([
        { user_id: USERS.admin1.id,  user_type: 'admin',  emoji: 'like' },
        { user_id: USERS.konfi1.id,  user_type: 'konfi',  emoji: 'wow' },
        { user_id: USERS.teamer1.id, user_type: 'teamer', emoji: 'heart' },
      ]);
    });

    it('Teamer:in reagiert in einem fremden Raum NICHT -> 403 und nichts in der DB', async () => {
      // Verbotener Fall: Raum 2 ist der Direktchat konfi1 <-> admin1,
      // teamer1 ist dort kein Teilnehmer.
      const { rows: [msg] } = await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content)
         VALUES ($1, $2, 'konfi', 'text', 'Fremder Direktchat') RETURNING id`,
        [CHAT_ROOMS.direct.id, USERS.konfi1.id]
      );

      const res = await request(app)
        .post(`/api/chat/messages/${msg.id}/reactions`)
        .set('Authorization', `Bearer ${teamer1Token}`)
        .send({ emoji: 'heart' });

      expect(res.status).toBe(403);
      expect(await reaktionenAus(msg.id)).toEqual([]);
    });
  });
});
