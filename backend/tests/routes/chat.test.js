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

  // Teamer:innen duerfen nur Konfis ihrer zugewiesenen Jahrgänge direkt
  // anschreiben — dieselbe Grenze, die checkJahrgangAccess im Rest des Systems
  // zieht. Der Chat war die einzige Stelle ohne sie (Nutzerhinweis 23.08.2026).
  // Alle Konfis erreichen nur org_admin und admin.
  describe('Jahrgangsgrenze fuer Teamer:innen im Direktchat', () => {
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

    it('Admin erreicht JEDEN Konfi der Organisation -> 200', async () => {
      const { invalidateUserCache } = require('../../middleware/rbac');
      await db.query(
        'INSERT INTO jahrgaenge (id, name, organization_id) VALUES (99, $1, 1) ON CONFLICT DO NOTHING',
        ['Fremder Jahrgang']
      );
      await db.query('UPDATE konfi_profiles SET jahrgang_id = 99 WHERE user_id = $1', [USERS.konfi2.id]);
      invalidateUserCache(USERS.admin1.id);

      const res = await request(app)
        .post('/api/chat/direct')
        .set('Authorization', `Bearer ${admin1Token}`)
        .send({ target_user_id: USERS.konfi2.id });

      expect(res.status).toBe(200);
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
    it('Admin fuegt Teilnehmer zu Gruppenchat hinzu -> 201', async () => {
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
      // Zuerst Konfi1 zum Gruppenchat hinzufuegen
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
});
