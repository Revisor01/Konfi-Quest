// backend/tests/routes/chatSocketZustellung.test.js
//
// Audit 26.09.2026, Betrieb BF-08: `newMessage` erreichte jeden Client
// doppelt. Der Nachrichten-Handler sendete erst an den Raum `room_<id>` und
// danach in einer Schleife an jeden persoenlichen Raum `user_<typ>_<id>` --
// wer den Chat offen hatte, sass in beiden und bekam dasselbe Ereignis
// zweimal. Sichtbar war nichts (der Client dedupliziert nach ID), aber der
// BadgeContext laedt je `newMessage` die Zaehler neu: zwei HTTP-Anfragen mit
// je vier Abfragen statt einer, fuer jede Nachricht, bei jedem Teilnehmenden
// mit offenem Chat. Dazu 151 einzelne Broadcasts (und damit 151 NOTIFY ueber
// den Postgres-Adapter) je Nachricht in einem Raum mit 150 Teilnehmenden.
//
// Vertrag (Store-Apps 2.2.x): Ereignisname `newMessage`, Payload
// `{ roomId: number, message: {...} }` -- unveraendert. Was sich aendert, ist
// nur die ANZAHL: genau einmal je Client. Der Zustand des Clients danach ist
// derselbe wie vorher nach zwei Ereignissen -- das prueft der Test ueber
// GET /notifications/badge-counts, den der BadgeContext je Ereignis ruft.
//
// Gegenprobe (dokumentiert): Mit dem alten Doppel-Emit fallen T1 und T4 mit
// "expected 2 to be 1".
const http = require('http');
const request = require('supertest');
const { Server } = require('socket.io');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, CHAT_ROOMS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { verbindeSocketClient } = require('../helpers/socketClient');
const chatSyncCache = require('../../utils/chatSyncCache');

describe('Chat: newMessage erreicht jeden Client genau einmal', () => {
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
    // Wie server.js: jeder Socket sitzt in seinem persoenlichen Raum, und
    // `joinRoom` bringt ihn in den Chat-Raum. Die Zugriffspruefung entfaellt
    // hier -- getestet wird die Zustellung, nicht die Berechtigung.
    io.on('connection', (socket) => {
      const { userId, userType } = socket.handshake.auth;
      socket.join(`user_${userType}_${userId}`);
      socket.on('joinRoom', (roomId) => socket.join(`room_${roomId}`));
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

  // Client anlegen; `imRaum` = Chat offen (zusaetzlich im Socket-Raum des Chats).
  async function client(user, { imRaum } = {}) {
    const c = await verbindeSocketClient(port, { userId: user.id, userType: user.type });
    if (imRaum) {
      c.emit('joinRoom', imRaum);
      // Der Beitritt ist ein eigenes Paket; kurz warten, bis der Server ihn
      // verarbeitet hat, sonst ginge die erste Nachricht am Raum vorbei.
      await new Promise((r) => setTimeout(r, 100));
    }
    clients.push(c);
    return c;
  }

  async function nachrichtSenden(von, roomId, content) {
    const res = await request(app)
      .post(`/api/chat/rooms/${roomId}/messages`)
      .set('Authorization', `Bearer ${generateToken(von)}`)
      .send({ content });
    expect(res.status).toBe(200);
    return res.body;
  }

  it('T1: Wer den Chat offen hat (im Raum UND im eigenen Raum), bekommt die Nachricht EINMAL', async () => {
    const konfi2 = await client(USERS.konfi2, { imRaum: CHAT_ROOMS.jahrgang.id });

    const antwort = await nachrichtSenden('konfi1', CHAT_ROOMS.jahrgang.id, 'Hallo Raum');

    const ereignisse = await konfi2.warteAuf('newMessage', 1);
    expect(ereignisse).toHaveLength(1);

    // Vertrag: Form und Inhalt des Payloads wie bisher.
    const [payload] = ereignisse;
    expect(payload.roomId).toBe(CHAT_ROOMS.jahrgang.id);
    expect(typeof payload.roomId).toBe('number');
    expect(payload.message.id).toBe(antwort.id);
    expect(payload.message.content).toBe('Hallo Raum');
    expect(payload.message.sender_id).toBe(USERS.konfi1.id);
    expect(payload.message.sender_name).toBe(USERS.konfi1.display_name);
    expect(payload.message.message_type).toBe('text');
    // Dasselbe Objekt wie die HTTP-Antwort -- kein Feld weniger.
    expect(Object.keys(payload.message).sort()).toEqual(Object.keys(antwort).sort());

    await warteAufNachwehen(app);
  });

  it('T2: Wer den Chat NICHT offen hat, bekommt sie ueber den eigenen Raum -- ebenfalls einmal', async () => {
    const teamer1 = await client(USERS.teamer1);

    await nachrichtSenden('konfi1', CHAT_ROOMS.jahrgang.id, 'Hallo Team');

    const ereignisse = await teamer1.warteAuf('newMessage', 1);
    expect(ereignisse).toHaveLength(1);
    expect(ereignisse[0].roomId).toBe(CHAT_ROOMS.jahrgang.id);
    expect(ereignisse[0].message.content).toBe('Hallo Team');

    await warteAufNachwehen(app);
  });

  it('T3: Die Leitung, die den Raum ohne Teilnehmerschaft mitliest, bekommt sie weiterhin -- einmal', async () => {
    // orgAdmin1 steht nicht in chat_participants von Raum 1, darf den Raum
    // aber betreten (utils/chatRoomAccess.js). Sie haengt nur am Raum-Emit.
    // Wuerde nur noch an die user_-Raeume gesendet, verloere sie den Live-Kanal.
    const leitung = await client(USERS.orgAdmin1, { imRaum: CHAT_ROOMS.jahrgang.id });

    await nachrichtSenden('konfi1', CHAT_ROOMS.jahrgang.id, 'Hallo Leitung');

    const ereignisse = await leitung.warteAuf('newMessage', 1);
    expect(ereignisse).toHaveLength(1);
    expect(ereignisse[0].message.content).toBe('Hallo Leitung');

    await warteAufNachwehen(app);
  });

  it('T4: Der Zaehler nach EINEM Ereignis ist derselbe wie frueher nach zweien', async () => {
    // Der BadgeContext ruft je newMessage GET /notifications/badge-counts.
    // Das Ergebnis haengt nicht davon ab, wie oft er ruft -- die Zahl kommt
    // aus der Datenbank. Nach einem Ereignis steht dort eine ungelesene
    // Nachricht in Raum 1; genau das sah der Client frueher nach dem zweiten
    // Abruf auch.
    const konfi2 = await client(USERS.konfi2, { imRaum: CHAT_ROOMS.jahrgang.id });
    const teamer1 = await client(USERS.teamer1);

    await nachrichtSenden('konfi1', CHAT_ROOMS.jahrgang.id, 'Zaehltest');

    expect(await konfi2.warteAuf('newMessage', 1)).toHaveLength(1);
    expect(await teamer1.warteAuf('newMessage', 1)).toHaveLength(1);

    for (const wer of ['konfi2', 'teamer1']) {
      const res = await request(app)
        .get('/api/notifications/badge-counts')
        .set('Authorization', `Bearer ${generateToken(wer)}`);
      expect(res.status).toBe(200);
      expect(res.body.chat.total).toBe(1);
      expect(res.body.chat.byRoom[String(CHAT_ROOMS.jahrgang.id)]).toBe(1);
    }

    // Der Absender selbst bekommt das Ereignis auch (fuer die eigene
    // Ansicht), seine eigene Nachricht zaehlt aber nicht als ungelesen.
    await warteAufNachwehen(app);
  });

  it('T5: Sender mit offenem Chat bekommt seine eigene Nachricht einmal (ersetzt die optimistische Kopie)', async () => {
    const konfi1 = await client(USERS.konfi1, { imRaum: CHAT_ROOMS.jahrgang.id });

    await nachrichtSenden('konfi1', CHAT_ROOMS.jahrgang.id, 'Meine Nachricht');

    const ereignisse = await konfi1.warteAuf('newMessage', 1);
    expect(ereignisse).toHaveLength(1);

    await warteAufNachwehen(app);
  });

  it('T6: Umfrage im Raum -- newMessage ebenfalls genau einmal je Client', async () => {
    const konfi2 = await client(USERS.konfi2, { imRaum: CHAT_ROOMS.jahrgang.id });
    const teamer1 = await client(USERS.teamer1);

    const res = await request(app)
      .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/polls`)
      .set('Authorization', `Bearer ${generateToken('admin1')}`)
      .send({ question: 'Wann?', options: ['Montag', 'Dienstag'] });
    expect(res.status).toBe(201);

    const beiKonfi = await konfi2.warteAuf('newMessage', 1);
    const beiTeamer = await teamer1.warteAuf('newMessage', 1);
    expect(beiKonfi).toHaveLength(1);
    expect(beiTeamer).toHaveLength(1);
    expect(beiKonfi[0].message.message_type).toBe('poll');
    expect(beiKonfi[0].message.question).toBe('Wann?');
    expect(beiKonfi[0].message.options).toEqual(['Montag', 'Dienstag']);

    await warteAufNachwehen(app);
  });
});
