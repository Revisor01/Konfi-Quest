// GET /chat/rooms zaehlt eigene Nachrichten nicht als ungelesen
// (Audit 26.09.2026, Fachlogik Chat/Challenges/Rueckblick BF-10).
//
// Zwei Zaehler, zwei Bedeutungen: GET /notifications/badge-counts schliesst
// eigene Nachrichten aus (seit 24.08.2026), GET /chat/rooms zaehlte sie mit.
// Die App nimmt die Zahl aus badge-counts und faellt nur ohne Wert auf
// room.unread_count zurueck -- in genau diesem Fall (und fuer den "Neu"-
// Trenner beim Oeffnen, useChatSocket.ts) stand nach der eigenen Nachricht
// eine 1 am eigenen Chat. Die Store-Apps 2.2.0/2.3.0 lesen das Feld genauso
// (ChatOverview: chatUnreadByRoom[room.id] ?? room.unread_count).
//
// Die Form bleibt: dasselbe Feld, dieselbe Art Wert -- nur die Zahl wird
// richtig. Gemessen wird gegen badge-counts als Referenz.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, CHAT_ROOMS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

describe('GET /chat/rooms: unread_count ohne eigene Nachrichten', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    Object.values(USERS).forEach(u => invalidateUserCache(u.id));
  });

  afterAll(async () => {
    await closePool();
  });

  const nachricht = (userKey, userType, raum, text) =>
    db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, content, message_type, created_at)
       VALUES ($1, $2, $3, $4, 'text', NOW() - INTERVAL '1 minute')`,
      [raum, USERS[userKey].id, userType, text]
    );

  const raeume = async (userKey) => {
    const res = await request(app).get('/api/chat/rooms').set('Authorization', `Bearer ${generateToken(userKey)}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    return res.body;
  };

  const zaehler = async (userKey) => {
    const res = await request(app).get('/api/notifications/badge-counts').set('Authorization', `Bearer ${generateToken(userKey)}`);
    expect(res.status).toBe(200);
    return res.body.chat.byRoom;
  };

  it('nur eigene Nachricht im Raum: 0, wie badge-counts', async () => {
    await nachricht('konfi1', 'konfi', CHAT_ROOMS.direct.id, 'Hallo');

    const raum = (await raeume('konfi1')).find(r => r.id === CHAT_ROOMS.direct.id);
    const byRoom = await zaehler('konfi1');

    expect(Number(raum.unread_count)).toBe(0);
    expect(Number(raum.unread_count)).toBe(byRoom[CHAT_ROOMS.direct.id]);
  });

  it('fremde Nachrichten zaehlen, eigene dazwischen nicht', async () => {
    await nachricht('admin1', 'admin', CHAT_ROOMS.direct.id, 'Frage');
    await nachricht('konfi1', 'konfi', CHAT_ROOMS.direct.id, 'Antwort');
    await nachricht('admin1', 'admin', CHAT_ROOMS.direct.id, 'Danke');

    const raum = (await raeume('konfi1')).find(r => r.id === CHAT_ROOMS.direct.id);
    const byRoom = await zaehler('konfi1');

    expect(Number(raum.unread_count)).toBe(2);
    expect(Number(raum.unread_count)).toBe(byRoom[CHAT_ROOMS.direct.id]);
  });

  it('Gegenprobe: fuer die andere Seite zaehlt die Nachricht der Konfi', async () => {
    await nachricht('konfi1', 'konfi', CHAT_ROOMS.direct.id, 'Hallo');

    const raum = (await raeume('admin1')).find(r => r.id === CHAT_ROOMS.direct.id);

    expect(Number(raum.unread_count)).toBe(1);
  });

  it('gleiche Nummer, anderer Typ ist nicht "eigen"', async () => {
    // Der Ausschluss vergleicht user_id UND user_type, wie badge-counts.
    await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, content, message_type, created_at)
       VALUES ($1, $2, 'admin', 'Fremd mit gleicher Nummer', 'text', NOW() - INTERVAL '1 minute')`,
      [CHAT_ROOMS.jahrgang.id, USERS.konfi1.id]
    );

    const raum = (await raeume('konfi1')).find(r => r.id === CHAT_ROOMS.jahrgang.id);
    const byRoom = await zaehler('konfi1');

    expect(Number(raum.unread_count)).toBe(1);
    expect(Number(raum.unread_count)).toBe(byRoom[CHAT_ROOMS.jahrgang.id]);
  });

  it('die Form bleibt: unread_count ist weiter derselbe Werttyp wie bisher', async () => {
    await nachricht('admin1', 'admin', CHAT_ROOMS.direct.id, 'Frage');

    const raum = (await raeume('konfi1')).find(r => r.id === CHAT_ROOMS.direct.id);

    // COUNT(*) ist bigint; database.js wandelt es in eine Zahl (setTypeParser
    // 20). So lesen es die ausgelieferten Apps seit jeher.
    expect(raum.unread_count).toBe(1);
  });
});
