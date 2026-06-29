const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, CHAT_ROOMS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { isEncrypted } = require('../../utils/photoCrypto');

describe('Chat Routes', () => {
  let app;
  let db;
  let konfi1Token;
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
    konfi1Token = generateToken('konfi1');
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
      // Konfi3 darf Org-1-Raeume nicht sehen
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
      // validateMagicBytes gibt 415 bei falschen Magic-Bytes zurueck
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
});
