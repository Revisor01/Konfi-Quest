// backend/tests/routes/chatUmfrageNamenNachAblauf.test.js
//
// "Namen später": Läuft die Umfrage ab, gelten die Namen als aufgedeckt
// (utils/umfrageRegeln.js, beim Lesen berechnet). Ein offener Chat bekam
// davon nichts mit -- niemand sendete 'pollUpdated', die Namen erschienen
// erst nach dem Neuladen (Befund 10.10.2026). Der Hintergrund-Lauf
// `umfrage_namen` (utils/umfrageStand.js) deckt abgelaufene Umfragen auf und
// sendet den neuen Stand an den Raum, jede Umfrage genau einmal.
//
// Gegenprobe (10.10.2026): Ohne den Lauf (abgelaufeneNamenAufdecken gibt
// sofort 0 zurück) fallen 4 der 5 Fälle; mit `namen_aufgedeckt_at IS NULL`
// aus dem WHERE entfernt fallen "genau einmal" und "in Ruhe lassen".
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, CHAT_ROOMS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const chatSyncCache = require('../../utils/chatSyncCache');
const { abgelaufeneNamenAufdecken } = require('../../utils/umfrageStand');

const RAUM = CHAT_ROOMS.jahrgang.id;

/** Ein io, das mitschreibt, was an welchen Raum geht. */
const mitschreibendesIo = () => {
  const gesendet = [];
  return {
    gesendet,
    to: (raum) => ({ emit: (ereignis, daten) => gesendet.push({ raum, ereignis, daten }) }),
  };
};

describe('Umfragen: Namen nach dem Ablauf live aufdecken', () => {
  let app;
  let db;
  const token = {};

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    chatSyncCache.clear();
    for (const n of ['konfi1', 'konfi2', 'admin1']) token[n] = generateToken(n);
  });

  afterEach(async () => {
    await warteAufNachwehen(app);
  });

  afterAll(async () => {
    await closePool();
  });

  const anlegen = async (felder) => {
    const res = await request(app)
      .post(`/api/chat/rooms/${RAUM}/polls`)
      .set('Authorization', `Bearer ${token.admin1}`)
      .send({ question: 'Wo fand der Thesenanschlag statt?', options: ['Wittenberg', 'Worms'], ...felder });
    expect(res.status).toBe(201);
    return res.body;
  };

  const abstimmen = async (wer, pollId, index) => {
    const res = await request(app)
      .post(`/api/chat/polls/${pollId}/vote`)
      .set('Authorization', `Bearer ${token[wer]}`)
      .send({ option_index: index });
    expect(res.status).toBe(200);
  };

  /** Ablauf in die Vergangenheit legen (die Route nimmt nur künftige an). */
  const ablaufen = (pollId) => db.query(
    "UPDATE chat_polls SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [pollId]);

  it('deckt eine abgelaufene Umfrage auf und sendet den Stand mit Namen an den Raum', async () => {
    const poll = await anlegen({ namen_spaeter: true, anonymous: false });
    await abstimmen('konfi1', poll.id, 0);
    await abstimmen('konfi2', poll.id, 1);
    await ablaufen(poll.id);

    const io = mitschreibendesIo();
    expect(await abgelaufeneNamenAufdecken(db, io)).toBe(1);

    expect(io.gesendet).toHaveLength(1);
    const [{ raum, ereignis, daten }] = io.gesendet;
    expect(raum).toBe(`room_${RAUM}`);
    expect(ereignis).toBe('pollUpdated');
    expect(daten.roomId).toBe(RAUM);
    expect(daten.messageId).toBe(poll.message_id);
    expect(daten.poll.anonymous).toBe(false);
    expect(daten.poll.namen_aufgedeckt).toBe(true);
    const namen = daten.poll.votes.map((v) => [v.option_index, v.user_name]).sort();
    expect(namen).toEqual([[0, USERS.konfi1.display_name], [1, USERS.konfi2.display_name]]);

    // Der Zeitpunkt ist der Ablauf -- am Lesen ändert sich nichts.
    const { rows: [zeile] } = await db.query(
      'SELECT namen_aufgedeckt_at = expires_at AS gleich FROM chat_polls WHERE id = $1', [poll.id]);
    expect(zeile.gleich).toBe(true);
  });

  it('sendet jede Umfrage genau einmal', async () => {
    const poll = await anlegen({ namen_spaeter: true, anonymous: false });
    await ablaufen(poll.id);
    const io = mitschreibendesIo();
    expect(await abgelaufeneNamenAufdecken(db, io)).toBe(1);
    expect(await abgelaufeneNamenAufdecken(db, io)).toBe(0);
    expect(io.gesendet).toHaveLength(1);
  });

  it('lässt laufende, von Hand aufgedeckte und gewöhnliche Umfragen in Ruhe', async () => {
    const laeuft = await anlegen({ namen_spaeter: true, anonymous: false,
      expires_at: new Date(Date.now() + 3600 * 1000).toISOString() });
    const vonHand = await anlegen({ namen_spaeter: true, anonymous: false });
    const gewoehnlich = await anlegen({ anonymous: true });
    const ohneAblauf = await anlegen({ namen_spaeter: true, anonymous: false });
    await db.query("UPDATE chat_polls SET namen_aufgedeckt_at = NOW() - INTERVAL '1 hour' WHERE id = $1", [vonHand.id]);
    await ablaufen(vonHand.id);
    await ablaufen(gewoehnlich.id);
    await db.query('UPDATE chat_polls SET expires_at = NULL WHERE id = $1', [ohneAblauf.id]);

    const io = mitschreibendesIo();
    expect(await abgelaufeneNamenAufdecken(db, io)).toBe(0);
    expect(io.gesendet).toEqual([]);
    const { rows } = await db.query(
      'SELECT id FROM chat_polls WHERE id = ANY($1) AND namen_aufgedeckt_at IS NOT NULL ORDER BY id',
      [[laeuft.id, gewoehnlich.id, ohneAblauf.id]]);
    expect(rows).toEqual([]);
  });

  it('Store-App-Form: der gesendete Stand trägt alle alten Felder mit ihren Typen', async () => {
    const poll = await anlegen({ namen_spaeter: true, anonymous: false });
    await abstimmen('konfi1', poll.id, 0);
    await ablaufen(poll.id);
    const io = mitschreibendesIo();
    await abgelaufeneNamenAufdecken(db, io);
    const stand = io.gesendet[0].daten.poll;
    expect(Array.isArray(stand.options)).toBe(true);
    expect(Array.isArray(stand.votes)).toBe(true);
    expect(typeof stand.question).toBe('string');
    expect(typeof stand.multiple_choice).toBe('boolean');
    expect(typeof stand.anonymous).toBe('boolean');
    expect(typeof stand.exclusive_options).toBe('boolean');
    expect(stand.poll_id).toBe(poll.id);
    expect(stand.message_id).toBe(poll.message_id);
  });

  it('ohne io (Replica ohne Socket) deckt er trotzdem auf, sendet aber nichts', async () => {
    const poll = await anlegen({ namen_spaeter: true, anonymous: false });
    await ablaufen(poll.id);
    expect(await abgelaufeneNamenAufdecken(db, null)).toBe(1);
    const { rows: [zeile] } = await db.query('SELECT namen_aufgedeckt_at FROM chat_polls WHERE id = $1', [poll.id]);
    expect(zeile.namen_aufgedeckt_at).not.toBeNull();
  });
});
