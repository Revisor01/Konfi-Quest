// backend/tests/routes/chatZugangNachJahrgang.test.js
//
// Audit "Wer bekommt was" 27.09.2026, BF-05 (HOCH), Frage F-01: Jeder Admin
// durfte jeden gemeinschaftlichen Chat-Raum seiner Gemeinde oeffnen, lesen,
// beschreiben, exportieren und per Socket mithoeren -- auch ohne Teilnahme
// und ohne Zuweisung auf den Jahrgang (`utils/chatRoomAccess.js`:
// `if (user.type === 'admin' && raum.type !== 'direct') return { ok: true }`,
// dieselbe Kopie in `routes/chat.js` darfRaumOeffnen).
//
// Die Regel (Simon, 27.09.2026, CLAUDE.md "Wer sieht und bekommt was"):
//   - Teilnahme genuegt immer.
//   - Ohne Teilnahme gemeindeweit nur der Org-Admin.
//   - Ein Admin ohne Teilnahme nur: Jahrgangs-Chats seiner zugewiesenen
//     Jahrgaenge, Termin-Chats von Terminen aus seiner Terminliste und reine
//     Team-Raeume (Team-Chat, Gruppen ohne Konfis).
//   - Einzelchats nie ohne Teilnahme.
//
// Geprueft werden REST und Socket (die echte joinRoom-Behandlung aus
// utils/chatRoomAccess.js, die server.js einhaengt), der verbotene und der
// erlaubte Fall. Seed: admin1 hat KEINEN Jahrgang, sitzt aber in Raum 1
// (Jahrgang 1), 2 (Direkt mit konfi1) und 3 (Team-Gruppe); orgAdmin1 in
// keinem Raum; Termine 1-3 gehoeren zu Jahrgang 1.
const http = require('http');
const request = require('supertest');
const { Server } = require('socket.io');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, CHAT_ROOMS, EVENTS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { verbindeSocketClient } = require('../helpers/socketClient');
const { socketRaumEreignisse } = require('../../utils/chatRoomAccess');
const { invalidateUserCache } = require('../../middleware/rbac');
const chatSyncCache = require('../../utils/chatSyncCache');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

describe('Chat-Zugang nach der Regel (BF-05)', () => {
  let db;
  let app;
  let server;
  let io;
  let port;
  let clients;

  beforeAll(async () => {
    db = getTestPool();
    server = http.createServer();
    io = new Server(server);
    // socket.user wie in server.js (id, aktive Gemeinde, Rolle dort, type);
    // danach die ECHTE Raum-Behandlung, die server.js einhaengt.
    io.use((socket, next) => {
      const { user } = socket.handshake.auth;
      socket.user = user;
      next();
    });
    io.on('connection', (socket) => {
      socket.join(`user_${socket.user.type}_${socket.user.id}`);
      socketRaumEreignisse(socket, db);
    });
    app = getTestApp(db, { io });
    server.on('request', app);
    await new Promise((r) => server.listen(0, r));
    port = server.address().port;
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    chatSyncCache.clear();
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
    clients = [];
  });

  afterEach(async () => {
    for (const c of clients) await c.schliessen();
  });

  afterAll(async () => {
    io.close();
    await new Promise((r) => server.close(r));
    await closePool();
  });

  // --- Hilfen ----------------------------------------------------------

  const rolleVon = (u) => Object.values(ROLES).find((r) => r.id === u.role_id).name;

  const holen = (wer, pfad) =>
    request(app).get(pfad).set('Authorization', `Bearer ${generateToken(wer)}`);

  const ohneTeilnahme = (roomId, user) =>
    db.query('DELETE FROM chat_participants WHERE room_id = $1 AND user_id = $2', [roomId, user.id]);

  const zuweisen = async (user, jahrgangId) => {
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, false)',
      [user.id, jahrgangId]
    );
    invalidateUserCache(user.id);
  };

  // Gruppe mit einer Konfi aus Jahrgang 1 (angelegt von teamer1).
  const gruppeMitKonfi = async () => {
    const { rows: [raum] } = await db.query(
      "INSERT INTO chat_rooms (name, type, created_by, organization_id) VALUES ('Gruppe mit Konfi', 'group', $1, 1) RETURNING id",
      [USERS.teamer1.id]
    );
    await db.query(
      "INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'teamer'), ($1, $3, 'konfi')",
      [raum.id, USERS.teamer1.id, USERS.konfi1.id]
    );
    return raum.id;
  };

  // Termin-Chat mit einer gebuchten Konfi.
  const terminChat = async (eventId) => {
    const { rows: [raum] } = await db.query(
      "INSERT INTO chat_rooms (name, type, event_id, created_by, organization_id) VALUES ('Termin-Chat', 'group', $1, $2, 1) RETURNING id",
      [eventId, USERS.orgAdmin1.id]
    );
    await db.query(
      "INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'konfi')",
      [raum.id, USERS.konfi1.id]
    );
    return raum.id;
  };

  const socketClient = async (user, raumId) => {
    const c = await verbindeSocketClient(port, {
      user: { id: user.id, organization_id: user.org_id, role_name: rolleVon(user), type: user.type },
    });
    clients.push(c);
    if (raumId) {
      c.emit('joinRoom', raumId);
      await new Promise((r) => setTimeout(r, 150));
    }
    return c;
  };

  const schreiben = async (wer, roomId, content) => {
    const res = await request(app)
      .post(`/api/chat/rooms/${roomId}/messages`)
      .set('Authorization', `Bearer ${generateToken(wer)}`)
      .send({ content });
    return res;
  };

  // ======================================================================
  // VERBOTEN
  // ======================================================================
  describe('verboten', () => {
    it('Admin ohne Zuweisung und ohne Teilnahme: Jahrgangs-Chat 1 bleibt auf jedem REST-Weg zu', async () => {
      // Zuerst die Datei einer Konfi, die er danach nicht laden darf.
      const upload = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${generateToken('konfi1')}`)
        .attach('file', PNG, { filename: 'bild.png', contentType: 'image/png' });
      expect(upload.status).toBe(200);

      await ohneTeilnahme(CHAT_ROOMS.jahrgang.id, USERS.admin1);
      const raum = CHAT_ROOMS.jahrgang.id;
      const token = generateToken('admin1');

      expect((await holen('admin1', `/api/chat/rooms/${raum}`)).status).toBe(403);
      expect((await holen('admin1', `/api/chat/rooms/${raum}/messages`)).status).toBe(403);
      expect((await holen('admin1', `/api/chat/rooms/${raum}/participants`)).status).toBe(403);
      expect((await holen('admin1', `/api/chat/files/${upload.body.file_path}`)).status).toBe(403);

      const exportRes = await holen('admin1', `/api/chat/rooms/${raum}/export`);
      expect(exportRes.status).toBe(403);
      expect(exportRes.body.error).toBe('Zugriff verweigert');

      const schreibRes = await schreiben('admin1', raum, 'Mitgelesen?');
      expect(schreibRes.status).toBe(403);

      const umfrage = await request(app)
        .post(`/api/chat/rooms/${raum}/polls`)
        .set('Authorization', `Bearer ${token}`)
        .send({ question: 'Frage?', options: ['A', 'B'] });
      expect(umfrage.status).toBe(404);

      const gelesen = await request(app)
        .post(`/api/chat/rooms/${raum}/mark-read`)
        .set('Authorization', `Bearer ${token}`);
      expect(gelesen.status).toBe(403);

      // Nichts ist durchgerutscht: nur die Datei-Nachricht der Konfi steht da.
      const { rows: [{ anzahl }] } = await db.query(
        'SELECT COUNT(*)::int AS anzahl FROM chat_messages WHERE room_id = $1', [raum]
      );
      expect(anzahl).toBe(1);
    });

    it('Admin ohne Zuweisung sieht den Jahrgangs-Chat nicht in der Raumliste', async () => {
      await ohneTeilnahme(CHAT_ROOMS.jahrgang.id, USERS.admin1);

      const res = await holen('admin1', '/api/chat/rooms');
      expect(res.status).toBe(200);
      // Antwortform unveraendert: ein Array.
      expect(Array.isArray(res.body)).toBe(true);
      const { rows: [teamChat] } = await db.query(
        'SELECT id FROM chat_rooms WHERE is_team_chat = true AND organization_id = 1'
      );
      // Direktchat, Team-Gruppe und der Team-Chat (legt der Sync an) -- kein Raum 1.
      expect(res.body.map((r) => r.id).sort((a, b) => a - b)).toEqual(
        [CHAT_ROOMS.direct.id, CHAT_ROOMS.group.id, teamChat.id]
      );
    });

    it('Die Raumliste bietet niemandem einen Raum an, der sich dann nicht oeffnen laesst', async () => {
      await ohneTeilnahme(CHAT_ROOMS.jahrgang.id, USERS.admin1);
      await gruppeMitKonfi();
      await terminChat(EVENTS.gottesdienstEvent.id);

      for (const wer of ['admin1', 'orgAdmin1', 'teamer1', 'konfi1']) {
        const liste = await holen(wer, '/api/chat/rooms');
        expect(liste.status).toBe(200);
        expect(liste.body.length).toBeGreaterThan(0);
        for (const raum of liste.body) {
          const res = await holen(wer, `/api/chat/rooms/${raum.id}/messages`);
          expect({ wer, raum: raum.id, status: res.status }).toEqual({ wer, raum: raum.id, status: 200 });
        }
      }
    });

    it('Admin ohne Zuweisung: Gruppe mit Konfis bleibt zu -- auch Selbst-Eintragen und Loeschen', async () => {
      const gruppe = await gruppeMitKonfi();
      const token = generateToken('admin1');

      expect((await holen('admin1', `/api/chat/rooms/${gruppe}/messages`)).status).toBe(403);

      // Der Umweg: sich selbst eintragen und danach als Teilnehmer lesen.
      const eintragen = await request(app)
        .post(`/api/chat/rooms/${gruppe}/participants`)
        .set('Authorization', `Bearer ${token}`)
        .send({ user_id: USERS.admin1.id });
      expect(eintragen.status).toBe(403);
      const { rows: plaetze } = await db.query(
        'SELECT 1 FROM chat_participants WHERE room_id = $1 AND user_id = $2', [gruppe, USERS.admin1.id]
      );
      expect(plaetze).toHaveLength(0);

      const austragen = await request(app)
        .delete(`/api/chat/rooms/${gruppe}/participants/${USERS.konfi1.id}/konfi`)
        .set('Authorization', `Bearer ${token}`);
      expect(austragen.status).toBe(403);

      const loeschen = await request(app)
        .delete(`/api/chat/rooms/${gruppe}?force=true`)
        .set('Authorization', `Bearer ${token}`);
      expect(loeschen.status).toBe(403);
      const { rows: raeume } = await db.query('SELECT 1 FROM chat_rooms WHERE id = $1', [gruppe]);
      expect(raeume).toHaveLength(1);
    });

    it('Admin ohne Zuweisung: Termin-Chat eines Jahrgangstermins, den er nicht sieht, bleibt zu', async () => {
      const raum = await terminChat(EVENTS.gottesdienstEvent.id);

      const liste = await holen('admin1', '/api/events');
      expect(liste.status).toBe(200);
      expect(liste.body.map((e) => e.id)).not.toContain(EVENTS.gottesdienstEvent.id);

      expect((await holen('admin1', `/api/chat/rooms/${raum}/messages`)).status).toBe(403);
    });

    it('Socket: joinRoom wird abgelehnt -- keine neue Nachricht aus Jahrgangs-, Konfi-Gruppen- oder Termin-Chat', async () => {
      await ohneTeilnahme(CHAT_ROOMS.jahrgang.id, USERS.admin1);
      const gruppe = await gruppeMitKonfi();
      const termin = await terminChat(EVENTS.gottesdienstEvent.id);

      for (const raum of [CHAT_ROOMS.jahrgang.id, gruppe, termin]) {
        const admin = await socketClient(USERS.admin1, raum);
        // Gegenprobe im selben Raum: konfi1 ist Teilnehmerin und hat ihn offen
        // -- kommt die Nachricht bei ihr an, wurde sie auch gesendet.
        const konfi = await socketClient(USERS.konfi1, raum);

        const res = await schreiben('konfi1', raum, `Nur fuer den Raum ${raum}`);
        expect(res.status).toBe(200);

        expect(await konfi.warteAuf('newMessage', 1)).toHaveLength(1);
        expect(await admin.warteAuf('newMessage', 1, 800)).toHaveLength(0);
        await warteAufNachwehen(app);
      }
    });

    it('Org-Admin: fremder Einzelchat bleibt auch per Socket zu', async () => {
      const leitung = await socketClient(USERS.orgAdmin1, CHAT_ROOMS.direct.id);
      const admin = await socketClient(USERS.admin1, CHAT_ROOMS.direct.id);

      const res = await schreiben('konfi1', CHAT_ROOMS.direct.id, 'Unter uns');
      expect(res.status).toBe(200);

      // admin1 ist Teilnehmer: einmal (Raum und eigener Raum, einmal zugestellt).
      expect(await admin.warteAuf('newMessage', 1)).toHaveLength(1);
      expect(await leitung.warteAuf('newMessage', 1, 800)).toHaveLength(0);
      await warteAufNachwehen(app);
    });
  });

  // ======================================================================
  // ERLAUBT
  // ======================================================================
  describe('erlaubt', () => {
    it('Admin MIT Zuweisung auf Jahrgang 1 oeffnet Raum 1 ohne Teilnahme -- REST und Socket', async () => {
      const upload = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
        .set('Authorization', `Bearer ${generateToken('konfi1')}`)
        .attach('file', PNG, { filename: 'bild.png', contentType: 'image/png' });
      expect(upload.status).toBe(200);

      await ohneTeilnahme(CHAT_ROOMS.jahrgang.id, USERS.admin1);
      await zuweisen(USERS.admin1, JAHRGAENGE.jahrgang1.id);
      const raum = CHAT_ROOMS.jahrgang.id;

      expect((await holen('admin1', `/api/chat/rooms/${raum}`)).status).toBe(200);
      const nachrichten = await holen('admin1', `/api/chat/rooms/${raum}/messages`);
      expect(nachrichten.status).toBe(200);
      expect(nachrichten.body.map((m) => m.id)).toEqual([upload.body.id]);
      expect((await holen('admin1', `/api/chat/rooms/${raum}/export`)).status).toBe(200);
      expect((await holen('admin1', `/api/chat/files/${upload.body.file_path}`)).status).toBe(200);

      const admin = await socketClient(USERS.admin1, raum);
      const res = await schreiben('konfi1', raum, 'Hallo Jahrgang');
      expect(res.status).toBe(200);
      const ereignisse = await admin.warteAuf('newMessage', 1);
      expect(ereignisse).toHaveLength(1);
      expect(ereignisse[0].message.content).toBe('Hallo Jahrgang');
      await warteAufNachwehen(app);
    });

    it('Org-Admin oeffnet ohne Teilnahme Jahrgangs-Chat, Gruppe mit Konfis und Termin-Chat -- REST und Socket', async () => {
      const gruppe = await gruppeMitKonfi();
      const termin = await terminChat(EVENTS.gottesdienstEvent.id);

      for (const raum of [CHAT_ROOMS.jahrgang.id, gruppe, termin]) {
        const { rows } = await db.query(
          'SELECT 1 FROM chat_participants WHERE room_id = $1 AND user_id = $2', [raum, USERS.orgAdmin1.id]
        );
        expect(rows).toHaveLength(0);
        expect((await holen('orgAdmin1', `/api/chat/rooms/${raum}/messages`)).status).toBe(200);

        const leitung = await socketClient(USERS.orgAdmin1, raum);
        const res = await schreiben('konfi1', raum, `Raum ${raum}`);
        expect(res.status).toBe(200);
        expect(await leitung.warteAuf('newMessage', 1)).toHaveLength(1);
        await warteAufNachwehen(app);
      }
    });

    it('Reine Team-Gruppe ist fuer einen Admin ohne Jahrgang offen, auch ohne Teilnahme', async () => {
      await ohneTeilnahme(CHAT_ROOMS.group.id, USERS.admin1);

      expect((await holen('admin1', `/api/chat/rooms/${CHAT_ROOMS.group.id}/messages`)).status).toBe(200);

      const admin = await socketClient(USERS.admin1, CHAT_ROOMS.group.id);
      const res = await schreiben('teamer1', CHAT_ROOMS.group.id, 'Team unter sich');
      expect(res.status).toBe(200);
      expect(await admin.warteAuf('newMessage', 1)).toHaveLength(1);
      await warteAufNachwehen(app);
    });

    it('Termin-Chat: offen genau dann, wenn der Termin in der eigenen Terminliste steht', async () => {
      // Drei Termine aus Jahrgang 1; zwei werden zu Ausnahmen fuers ganze Team.
      await db.query('UPDATE events SET teamer_only = true WHERE id = $1', [EVENTS.pflichtEvent.id]);
      await db.query('DELETE FROM event_jahrgang_assignments WHERE event_id = $1', [EVENTS.timeslotEvent.id]);
      const raeume = {
        [EVENTS.gottesdienstEvent.id]: await terminChat(EVENTS.gottesdienstEvent.id),
        [EVENTS.pflichtEvent.id]: await terminChat(EVENTS.pflichtEvent.id),
        [EVENTS.timeslotEvent.id]: await terminChat(EVENTS.timeslotEvent.id),
      };

      const vergleich = async () => {
        const liste = (await holen('admin1', '/api/events')).body.map((e) => e.id);
        const ergebnis = {};
        for (const [eventId, raum] of Object.entries(raeume)) {
          const status = (await holen('admin1', `/api/chat/rooms/${raum}/messages`)).status;
          ergebnis[eventId] = { inListe: liste.includes(Number(eventId)), status };
        }
        return ergebnis;
      };

      // Ohne Jahrgang: "Nur Team" und der Termin ohne Jahrgang, nicht der Jahrgangstermin.
      expect(await vergleich()).toEqual({
        [EVENTS.gottesdienstEvent.id]: { inListe: false, status: 403 },
        [EVENTS.pflichtEvent.id]: { inListe: true, status: 200 },
        [EVENTS.timeslotEvent.id]: { inListe: true, status: 200 },
      });

      // Mit Zuweisung auf Jahrgang 1 kommt der Jahrgangstermin dazu -- in
      // der Liste UND im Chat.
      await zuweisen(USERS.admin1, JAHRGAENGE.jahrgang1.id);
      expect(await vergleich()).toEqual({
        [EVENTS.gottesdienstEvent.id]: { inListe: true, status: 200 },
        [EVENTS.pflichtEvent.id]: { inListe: true, status: 200 },
        [EVENTS.timeslotEvent.id]: { inListe: true, status: 200 },
      });
    });

    it('Teilnehmer:in darf weiter -- admin1 sitzt ohne Zuweisung in Raum 1 und liest dort', async () => {
      // Seed-Zustand: admin1 steht in Raum 1, hat aber keinen Jahrgang.
      const { rows } = await db.query(
        'SELECT 1 FROM user_jahrgang_assignments WHERE user_id = $1', [USERS.admin1.id]
      );
      expect(rows).toHaveLength(0);

      expect((await holen('admin1', `/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)).status).toBe(200);
      const res = await schreiben('admin1', CHAT_ROOMS.jahrgang.id, 'Ich bin dabei');
      expect(res.status).toBe(200);
      await warteAufNachwehen(app);
    });

    it('Admin ohne Jahrgang traegt jemanden in eine reine Team-Gruppe ein -> 201', async () => {
      await ohneTeilnahme(CHAT_ROOMS.group.id, USERS.admin1);
      const res = await request(app)
        .post(`/api/chat/rooms/${CHAT_ROOMS.group.id}/participants`)
        .set('Authorization', `Bearer ${generateToken('admin1')}`)
        .send({ user_id: USERS.orgAdmin1.id });
      expect(res.status).toBe(201);
    });
  });
});
