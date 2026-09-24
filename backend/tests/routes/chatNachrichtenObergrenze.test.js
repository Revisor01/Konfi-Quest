// backend/tests/routes/chatNachrichtenObergrenze.test.js
//
// Tests fuer die Obergrenze des limit-Parameters an
// GET /api/chat/rooms/:roomId/messages.
//
// Befund: `parseInt(req.query.limit) || 50` ging ohne Pruefung als LIMIT $2 in
// die Abfrage. Ein Aufruf mit ?limit=100000 laedt entsprechend viele Zeilen in
// den Heap eines 512-MB-Containers — samt Reaktionen und Umfrage-Stimmen, die
// im Anschluss fuer JEDE geladene Nachricht nachgeholt werden.
//
// Die Loesung lag daneben: Der after-Zweig derselben Route hat seit immer ein
// festes LIMIT 200. Es war ein unvollstaendig ausgerolltes Muster.
//
// Die Grenze ist 200 und damit doppelt so hoch wie das hoechste, was heute
// ausgelieferte App-Fassungen anfragen (ChatRoom.tsx: limit=100 an zwei
// Stellen). Keine Fassung bekommt dadurch eine kuerzere Antwort als bisher —
// darum geht es hier vor allem: Die Route darf auf keinen Fall WENIGER liefern
// als eine App auf einem Geraet erwartet.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, CHAT_ROOMS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const chatSyncCache = require('../../utils/chatSyncCache');

describe('GET /api/chat/rooms/:roomId/messages — Obergrenze fuer limit', () => {
  let app;
  let db;
  let konfi1Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    chatSyncCache.clear();
    konfi1Token = generateToken('konfi1');
  });

  afterAll(async () => {
    await closePool();
  });

  /**
   * Legt `anzahl` Nachrichten direkt in der Datenbank an — schneller als ueber
   * die Route und ohne Push/Live-Nachwehen.
   */
  async function nachrichten(anzahl) {
    const werte = [];
    const platzhalter = [];
    for (let i = 0; i < anzahl; i++) {
      const p = i * 4;
      platzhalter.push(`($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4})`);
      werte.push(CHAT_ROOMS.jahrgang.id, USERS.konfi1.id, 'konfi', `Nachricht ${i}`);
    }
    await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, content)
       VALUES ${platzhalter.join(', ')}`,
      werte
    );
  }

  const laden = (query) =>
    request(app)
      .get(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages${query}`)
      .set('Authorization', `Bearer ${konfi1Token}`);

  it('liefert bei ?limit=100000 hoechstens 200 Nachrichten', async () => {
    await nachrichten(260);

    const res = await laden('?limit=100000');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // Der Kern des Befunds: Vor der Deckelung kamen hier alle 260 Zeilen
    // zurueck, bei ?limit=100000 in Produktion entsprechend viele mehr.
    expect(res.body).toHaveLength(200);
  });

  it('liefert die vom Client angefragten 100 Nachrichten vollstaendig', async () => {
    // Das ist der Wert, den die ausgelieferten App-Fassungen schicken
    // (ChatRoom.tsx, zwei Stellen). Die Deckelung darf ihn nicht kuerzen.
    await nachrichten(150);

    const res = await laden('?limit=100');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(100);
  });

  it('liefert genau 200 Nachrichten bei ?limit=200', async () => {
    // Die Grenze selbst ist erlaubt, nicht erst der Wert darunter.
    await nachrichten(250);

    const res = await laden('?limit=200');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(200);
  });

  it('bleibt ohne limit bei den voreingestellten 50', async () => {
    await nachrichten(80);

    const res = await laden('');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(50);
  });

  it('nimmt bei ?limit=0 die Vorgabe 50 (Bestandsverhalten von `|| 50`)', async () => {
    await nachrichten(80);

    const res = await laden('?limit=0');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(50);
  });

  it('nimmt bei negativem limit die Vorgabe 50 statt eines SQL-Fehlers', async () => {
    // LIMIT -1 wirft in PostgreSQL; ohne Absicherung waere das ein 500er.
    await nachrichten(80);

    const res = await laden('?limit=-5');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(50);
  });

  it('nimmt bei nicht-numerischem limit die Vorgabe 50', async () => {
    await nachrichten(80);

    const res = await laden('?limit=viele');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(50);
  });

  it('deckelt auch beim Blaettern, offset bleibt wirksam', async () => {
    await nachrichten(260);

    const erste = await laden('?limit=100000&offset=0');
    const zweite = await laden('?limit=100000&offset=200');

    expect(erste.status).toBe(200);
    expect(zweite.status).toBe(200);
    expect(erste.body).toHaveLength(200);
    // 260 Nachrichten, 200 uebersprungen -> 60 uebrig.
    expect(zweite.body).toHaveLength(60);
    // Und keine Nachricht kommt auf beiden Seiten vor.
    const ids = [...erste.body, ...zweite.body].map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('der after-Zweig bleibt bei seinen 200 (Bestandsverhalten)', async () => {
    // Derselbe Deckel, andere Stelle: Das inkrementelle Nachladen war schon
    // begrenzt und muss es bleiben.
    await nachrichten(260);
    const { rows: [erste] } = await db.query(
      'SELECT MIN(id) AS id FROM chat_messages WHERE room_id = $1',
      [CHAT_ROOMS.jahrgang.id]
    );

    const res = await laden(`?after=${erste.id}&limit=100000`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(200);
  });
});
