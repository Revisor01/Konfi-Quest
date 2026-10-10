// backend/tests/routes/chatUmfrageEinmaligNamenSpaeter.test.js
//
// Umfragen mit einmaliger Antwort und später aufgedeckten Namen (Simon,
// 10.10.2026: „einmalige antwort. name öffentlich (aber erst später
// veröffentlichen) die beiden optionen.").
//
//   - Einmalige Antwort: Das BACKEND lehnt jede zweite Abgabe ab (ändern,
//     zurücknehmen, ergänzen) -- auch über die alte Adressform
//     /messages/:id/vote, die Store-Apps 2.2.x/2.3.0 nutzen.
//   - Namen später: Vor dem Aufdecken liefert das Backend die Namen an
//     NIEMANDEN aus, auch nicht an die Leitung und nicht an die Person, die
//     die Umfrage erstellt hat. Die Form ist dann die einer anonymen Umfrage
//     (anonymous: true), damit alte Apps keine leeren Namen zeigen.
//   - Aufdecken: wer die Umfrage erstellt hat oder die Leitung im Raum; nach
//     dem Ablauf von selbst (beim Lesen berechnet).
//   - Alte Antwortform: kein Feld fehlt, kein Typ ändert sich.
//
// Gegenprobe (10.10.2026): Mit ausgebauter Einmal-Sperre in votePoll
// (`const einmalig = false`) und mit "Namen später" als gewöhnlicher
// Umfrage mit Namen (gespeichert anonymous = false, ausgeliefert
// `anonymous: Boolean(poll.anonymous)`) fallen 10 der 26 Fälle: die vier
// "verboten"-Fälle der einmaligen Antwort und alle, die vor dem Aufdecken
// keine Namen erwarten.
const http = require('http');
const request = require('supertest');
const { Server } = require('socket.io');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, CHAT_ROOMS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { verbindeSocketClient } = require('../helpers/socketClient');
const chatSyncCache = require('../../utils/chatSyncCache');

const RAUM = CHAT_ROOMS.jahrgang.id;

describe('Umfragen: einmalige Antwort und Namen später', () => {
  let app;
  let db;
  let server;
  let io;
  let port;
  let clients;
  const token = {};

  beforeAll(async () => {
    db = getTestPool();
    server = http.createServer();
    io = new Server(server);
    io.on('connection', (socket) => {
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
    for (const n of ['konfi1', 'konfi2', 'teamer1', 'admin1', 'orgAdmin1', 'admin2']) {
      token[n] = generateToken(n);
    }
  });

  afterEach(async () => {
    for (const c of clients) await c.schliessen();
    await warteAufNachwehen(app);
  });

  afterAll(async () => {
    io.close();
    await new Promise((r) => server.close(r));
    await closePool();
  });

  const anlegen = async (felder, von = 'admin1') => {
    const res = await request(app)
      .post(`/api/chat/rooms/${RAUM}/polls`)
      .set('Authorization', `Bearer ${token[von]}`)
      .send({ question: 'Wie heißt der erste Jünger?', options: ['Petrus', 'Andreas', 'Johannes'], ...felder });
    expect(res.status).toBe(201);
    return res.body;
  };

  const abstimmen = (wer, id, body, adresse = 'polls') => request(app)
    .post(`/api/chat/${adresse}/${id}/vote`)
    .set('Authorization', `Bearer ${token[wer]}`)
    .send(body);

  const lesen = async (wer, messageId) => {
    const res = await request(app)
      .get(`/api/chat/rooms/${RAUM}/messages`)
      .set('Authorization', `Bearer ${token[wer]}`);
    expect(res.status).toBe(200);
    const treffer = res.body.filter((m) => m.id === messageId);
    expect(treffer).toHaveLength(1);
    return treffer[0];
  };

  const stimmenInDb = async (pollId, userId) => (await db.query(
    'SELECT option_index FROM chat_poll_votes WHERE poll_id = $1 AND user_id = $2 ORDER BY option_index',
    [pollId, userId])).rows.map((r) => r.option_index);

  const aufdecken = (wer, pollId) => request(app)
    .post(`/api/chat/polls/${pollId}/aufdecken`)
    .set('Authorization', `Bearer ${token[wer]}`)
    .send();

  // ================================================================
  // Einmalige Antwort
  // ================================================================
  describe('Einmalige Antwort', () => {
    it('die erste Abgabe geht durch -> 200, die Stimme steht', async () => {
      const poll = await anlegen({ einmalige_antwort: true });
      const res = await abstimmen('konfi1', poll.id, { option_index: 1 });
      expect(res.status).toBe(200);
      expect(res.body.action).toBe('added');
      expect(await stimmenInDb(poll.id, USERS.konfi1.id)).toEqual([1]);
    });

    it('verboten: eine andere Antwort wählen -> 403, die erste Stimme bleibt', async () => {
      const poll = await anlegen({ einmalige_antwort: true });
      expect((await abstimmen('konfi1', poll.id, { option_index: 1 })).status).toBe(200);

      const res = await abstimmen('konfi1', poll.id, { option_index: 2 });
      expect(res.status).toBe(403);
      expect(res.body.action).toBe('locked');
      expect(res.body.error).toBe('Du hast schon geantwortet. Deine Antwort steht fest und lässt sich nicht mehr ändern.');
      expect(await stimmenInDb(poll.id, USERS.konfi1.id)).toEqual([1]);
    });

    it('verboten: die eigene Stimme zurücknehmen (alte Apps tippen sie erneut an) -> 403', async () => {
      const poll = await anlegen({ einmalige_antwort: true });
      expect((await abstimmen('konfi1', poll.id, { option_index: 0 })).status).toBe(200);

      // Store-Apps 2.2.x/2.3.0 stimmen über die Nachrichten-ID ab.
      const res = await abstimmen('konfi1', poll.message_id, { option_index: 0 }, 'messages');
      expect(res.status).toBe(403);
      expect(res.body.action).toBe('locked');
      expect(await stimmenInDb(poll.id, USERS.konfi1.id)).toEqual([0]);
    });

    it('verboten: bei Mehrfachauswahl nachträglich eine Antwort ergänzen -> 403', async () => {
      const poll = await anlegen({ einmalige_antwort: true, multiple_choice: true });
      const erste = await abstimmen('konfi1', poll.id, { option_indices: [0, 2] });
      expect(erste.status).toBe(200);
      expect(erste.body.option_indices).toEqual([0, 2]);
      expect(await stimmenInDb(poll.id, USERS.konfi1.id)).toEqual([0, 2]);

      const zweite = await abstimmen('konfi1', poll.id, { option_index: 1 });
      expect(zweite.status).toBe(403);
      const dritte = await abstimmen('konfi1', poll.id, { option_indices: [1] });
      expect(dritte.status).toBe(403);
      expect(await stimmenInDb(poll.id, USERS.konfi1.id)).toEqual([0, 2]);
    });

    it('bei Mehrfachauswahl über die alte Adressform: die erste Antwort steht fest', async () => {
      // Store-Apps kennen den Schritt "Antwort abgeben" nicht und schicken je
      // Antippen eine Option. Die erste ist die Abgabe.
      const poll = await anlegen({ einmalige_antwort: true, multiple_choice: true });
      expect((await abstimmen('konfi1', poll.message_id, { option_index: 2 }, 'messages')).status).toBe(200);
      expect((await abstimmen('konfi1', poll.message_id, { option_index: 0 }, 'messages')).status).toBe(403);
      expect(await stimmenInDb(poll.id, USERS.konfi1.id)).toEqual([2]);
    });

    it('andere Personen antworten unabhängig davon -> 200', async () => {
      const poll = await anlegen({ einmalige_antwort: true });
      expect((await abstimmen('konfi1', poll.id, { option_index: 0 })).status).toBe(200);
      expect((await abstimmen('konfi2', poll.id, { option_index: 0 })).status).toBe(200);
      expect(await stimmenInDb(poll.id, USERS.konfi2.id)).toEqual([0]);
    });

    it('erlaubt: eine normale Umfrage lässt sich weiterhin ändern und zurücknehmen', async () => {
      const poll = await anlegen({});
      expect(poll.einmalige_antwort).toBe(false);
      expect((await abstimmen('konfi1', poll.id, { option_index: 0 })).status).toBe(200);
      const wechsel = await abstimmen('konfi1', poll.id, { option_index: 1 });
      expect(wechsel.status).toBe(200);
      expect(wechsel.body.action).toBe('added');
      expect(await stimmenInDb(poll.id, USERS.konfi1.id)).toEqual([1]);
      const zurueck = await abstimmen('konfi1', poll.id, { option_index: 1 });
      expect(zurueck.status).toBe(200);
      expect(zurueck.body.action).toBe('removed');
      expect(await stimmenInDb(poll.id, USERS.konfi1.id)).toEqual([]);
    });

    it('option_indices: bei Einzelauswahl nur eine Antwort -> 400', async () => {
      const poll = await anlegen({ einmalige_antwort: true });
      const res = await abstimmen('konfi1', poll.id, { option_indices: [0, 1] });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bei dieser Umfrage kannst du nur eine Antwort wählen');
      expect(await stimmenInDb(poll.id, USERS.konfi1.id)).toEqual([]);
    });

    it('option_indices: leer, doppelt oder außerhalb -> 400', async () => {
      const poll = await anlegen({ einmalige_antwort: true, multiple_choice: true });
      expect((await abstimmen('konfi1', poll.id, { option_indices: [] })).status).toBe(400);
      expect((await abstimmen('konfi1', poll.id, { option_indices: [1, 1] })).status).toBe(400);
      expect((await abstimmen('konfi1', poll.id, { option_indices: [0, 3] })).status).toBe(400);
      expect((await abstimmen('konfi1', poll.id, { option_indices: ['a'] })).status).toBe(400);
      expect(await stimmenInDb(poll.id, USERS.konfi1.id)).toEqual([]);
    });
  });

  // ================================================================
  // Namen später
  // ================================================================
  describe('Namen später', () => {
    it('anonym und Namen später zugleich -> 400', async () => {
      const res = await request(app)
        .post(`/api/chat/rooms/${RAUM}/polls`)
        .set('Authorization', `Bearer ${token.admin1}`)
        .send({ question: 'Quiz', options: ['A', 'B'], anonymous: true, namen_spaeter: true });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Eine Umfrage ist entweder anonym oder deckt die Namen später auf, nicht beides');
      const { rows: [{ n }] } = await db.query('SELECT COUNT(*)::int AS n FROM chat_polls');
      expect(n).toBe(0);
    });

    it('Namen später ohne anonymous-Angabe und mit anonymous: false -> 201', async () => {
      const ohne = await anlegen({ namen_spaeter: true });
      expect(ohne.namen_spaeter).toBe(true);
      expect(ohne.anonymous).toBe(true);
      expect(ohne.namen_aufgedeckt).toBe(false);
      const mit = await anlegen({ namen_spaeter: true, anonymous: false });
      expect(mit.namen_spaeter).toBe(true);
      // In der Datenbank steht anonymous = true: Wer die neue Spalte nicht
      // kennt, behandelt die Umfrage als anonym.
      const { rows: [zeile] } = await db.query('SELECT anonymous FROM chat_polls WHERE id = $1', [mit.id]);
      expect(zeile.anonymous).toBe(true);
    });

    it('vor dem Aufdecken bekommt NIEMAND die Namen: Konfi, Ersteller, Leitung', async () => {
      const poll = await anlegen({ namen_spaeter: true, anonymous: false });
      expect((await abstimmen('konfi1', poll.id, { option_index: 0 })).status).toBe(200);
      expect((await abstimmen('konfi2', poll.id, { option_index: 1 })).status).toBe(200);

      for (const wer of ['konfi1', 'admin1', 'orgAdmin1', 'teamer1']) {
        const msg = await lesen(wer, poll.message_id);
        expect(msg.anonymous).toBe(true);
        expect(msg.namen_spaeter).toBe(true);
        expect(msg.namen_aufgedeckt).toBe(false);
        expect(msg.namen_aufgedeckt_at).toBeNull();
        expect(msg.votes).toHaveLength(2);
        for (const v of msg.votes) {
          expect(v.user_name).toBeUndefined();
        }
        // Fremde Stimmen ohne Kennung -- nur die eigene ist markierbar.
        const fremde = msg.votes.filter((v) => v.user_id !== null);
        expect(fremde.length).toBe(wer === 'konfi1' ? 1 : 0);
      }
    });

    it('vor dem Aufdecken: auch das Live-Update trägt keine Namen', async () => {
      const poll = await anlegen({ namen_spaeter: true, anonymous: false });
      const c = await verbindeSocketClient(port, {});
      clients.push(c);
      c.emit('joinRoom', RAUM);
      await new Promise((r) => setTimeout(r, 100));

      expect((await abstimmen('konfi1', poll.id, { option_index: 0 })).status).toBe(200);
      const [ereignis] = await c.warteAuf('pollUpdated', 1);
      expect(ereignis.poll.anonymous).toBe(true);
      expect(ereignis.poll.namen_spaeter).toBe(true);
      expect(ereignis.poll.namen_aufgedeckt).toBe(false);
      expect(ereignis.poll.votes).toEqual([{ user_id: null, user_type: null, option_index: 0 }]);
    });

    it('Aufdecken durch die Person, die die Umfrage erstellt hat -> 200, danach Namen für alle', async () => {
      const poll = await anlegen({ namen_spaeter: true, anonymous: false });
      expect((await abstimmen('konfi1', poll.id, { option_index: 2 })).status).toBe(200);

      const res = await aufdecken('admin1', poll.id);
      expect(res.status).toBe(200);
      expect(res.body.poll_id).toBe(poll.id);
      expect(res.body.namen_aufgedeckt).toBe(true);
      expect(typeof res.body.namen_aufgedeckt_at).toBe('string');

      const msg = await lesen('konfi2', poll.message_id);
      expect(msg.anonymous).toBe(false);
      expect(msg.namen_aufgedeckt).toBe(true);
      expect(msg.votes).toEqual([{
        user_id: USERS.konfi1.id, user_type: 'konfi', option_index: 2, user_name: USERS.konfi1.display_name,
      }]);
    });

    it('Aufdecken durch die Leitung im Raum (nicht Erstellerin) -> 200', async () => {
      const poll = await anlegen({ namen_spaeter: true });
      const res = await aufdecken('orgAdmin1', poll.id);
      expect(res.status).toBe(200);
      expect(res.body.namen_aufgedeckt).toBe(true);
    });

    it('Aufdecken sendet den neuen Stand per Socket an den Raum, mit Namen', async () => {
      const poll = await anlegen({ namen_spaeter: true });
      expect((await abstimmen('konfi1', poll.id, { option_index: 0 })).status).toBe(200);
      const c = await verbindeSocketClient(port, {});
      clients.push(c);
      c.emit('joinRoom', RAUM);
      await new Promise((r) => setTimeout(r, 100));

      expect((await aufdecken('admin1', poll.id)).status).toBe(200);
      const [ereignis] = await c.warteAuf('pollUpdated', 1);
      expect(ereignis.roomId).toBe(RAUM);
      expect(ereignis.messageId).toBe(poll.message_id);
      expect(ereignis.poll.anonymous).toBe(false);
      expect(ereignis.poll.namen_aufgedeckt).toBe(true);
      expect(ereignis.poll.votes[0].user_name).toBe(USERS.konfi1.display_name);
    });

    it('verboten: eine Konfi deckt auf -> 403, die Namen bleiben verborgen', async () => {
      const poll = await anlegen({ namen_spaeter: true });
      const res = await aufdecken('konfi1', poll.id);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Die Namen kann nur aufdecken, wer die Umfrage erstellt hat, oder die Leitung');
      const { rows: [zeile] } = await db.query('SELECT namen_aufgedeckt_at FROM chat_polls WHERE id = $1', [poll.id]);
      expect(zeile.namen_aufgedeckt_at).toBeNull();
    });

    it('verboten: eine Teamerin deckt auf -> 403', async () => {
      const poll = await anlegen({ namen_spaeter: true });
      expect((await aufdecken('teamer1', poll.id)).status).toBe(403);
    });

    it('verboten: Leitung einer anderen Gemeinde -> 403 (Raum-Regel)', async () => {
      const poll = await anlegen({ namen_spaeter: true });
      const res = await aufdecken('admin2', poll.id);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Zugriff auf diesen Raum verweigert');
    });

    it('eine Umfrage ohne "Namen später" lässt sich nicht aufdecken -> 400', async () => {
      const poll = await anlegen({ anonymous: true });
      const res = await aufdecken('admin1', poll.id);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bei dieser Umfrage werden keine Namen aufgedeckt');
    });

    it('unbekannte Umfrage -> 404', async () => {
      expect((await aufdecken('admin1', 999999)).status).toBe(404);
    });

    it('nach dem Ablauf sind die Namen ohne Zutun aufgedeckt', async () => {
      const poll = await anlegen({ namen_spaeter: true, expires_in_hours: 1 });
      expect((await abstimmen('konfi1', poll.id, { option_index: 1 })).status).toBe(200);
      expect((await lesen('konfi2', poll.message_id)).anonymous).toBe(true);

      await db.query("UPDATE chat_polls SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [poll.id]);

      const msg = await lesen('konfi2', poll.message_id);
      expect(msg.anonymous).toBe(false);
      expect(msg.namen_aufgedeckt).toBe(true);
      expect(new Date(msg.namen_aufgedeckt_at).getTime()).toBe(new Date(msg.expires_at).getTime());
      expect(msg.votes[0].user_name).toBe(USERS.konfi1.display_name);
      // Die Spalte bleibt leer -- der Ablauf wird beim Lesen ausgewertet.
      const { rows: [zeile] } = await db.query('SELECT namen_aufgedeckt_at FROM chat_polls WHERE id = $1', [poll.id]);
      expect(zeile.namen_aufgedeckt_at).toBeNull();
    });

    it('kombinierbar: einmalig + Namen später + Mehrfachauswahl', async () => {
      const poll = await anlegen({ namen_spaeter: true, einmalige_antwort: true, multiple_choice: true });
      expect(poll.multiple_choice).toBe(true);
      expect(poll.einmalige_antwort).toBe(true);
      expect(poll.namen_spaeter).toBe(true);
      expect((await abstimmen('konfi1', poll.id, { option_indices: [0, 1] })).status).toBe(200);
      expect((await abstimmen('konfi1', poll.id, { option_index: 0 })).status).toBe(403);
      expect((await lesen('admin1', poll.message_id)).votes.every((v) => v.user_name === undefined)).toBe(true);
    });
  });

  // ================================================================
  // Alte Antwortform (Store-Apps 2.2.x, 2.3.0)
  // ================================================================
  describe('Die Antwortformen bleiben, wie die Store-Apps sie lesen', () => {
    const ALTE_ANLEGEN_FELDER = ['id', 'message_id', 'question', 'options', 'multiple_choice', 'anonymous', 'exclusive_options', 'expires_at', 'votes'];
    const ALTE_NACHRICHT_FELDER = ['poll_id', 'question', 'options', 'multiple_choice', 'anonymous', 'exclusive_options', 'expires_at', 'votes', 'reactions', 'message_type'];
    const ALTE_STIMME_FELDER = ['message', 'poll_id', 'option_index', 'user_id', 'action'];

    it('Anlegen: alle alten Felder mit ihren Typen, neue nur dazu', async () => {
      const poll = await anlegen({ anonymous: false, multiple_choice: true });
      expect(Object.keys(poll)).toEqual(expect.arrayContaining(ALTE_ANLEGEN_FELDER));
      expect(typeof poll.id).toBe('number');
      expect(Array.isArray(poll.options)).toBe(true);
      expect(poll.multiple_choice).toBe(true);
      expect(poll.anonymous).toBe(false);
      expect(poll.exclusive_options).toBe(false);
      expect(poll.expires_at).toBeNull();
      expect(poll.votes).toEqual([]);
      expect(poll.einmalige_antwort).toBe(false);
      expect(poll.namen_spaeter).toBe(false);
    });

    it('Nachrichtenliste: alte Felder unverändert, Stimmen mit Namen bei offener Umfrage', async () => {
      const poll = await anlegen({ anonymous: false });
      expect((await abstimmen('konfi1', poll.message_id, { option_index: 0 }, 'messages')).status).toBe(200);
      const msg = await lesen('konfi2', poll.message_id);
      expect(Object.keys(msg)).toEqual(expect.arrayContaining(ALTE_NACHRICHT_FELDER));
      expect(msg.anonymous).toBe(false);
      expect(typeof msg.multiple_choice).toBe('boolean');
      expect(typeof msg.exclusive_options).toBe('boolean');
      expect(msg.options).toEqual(['Petrus', 'Andreas', 'Johannes']);
      expect(msg.votes).toEqual([{
        user_id: USERS.konfi1.id, user_type: 'konfi', option_index: 0, user_name: USERS.konfi1.display_name,
      }]);
    });

    it('Abstimmen: alte Felder der Antwort bleiben', async () => {
      const poll = await anlegen({});
      const res = await abstimmen('konfi1', poll.id, { option_index: 1 });
      expect(res.status).toBe(200);
      expect(Object.keys(res.body)).toEqual(expect.arrayContaining(ALTE_STIMME_FELDER));
      expect(res.body.message).toBe('Stimme erfolgreich abgegeben');
      expect(res.body.option_index).toBe(1);
      expect(res.body.user_id).toBe(USERS.konfi1.id);
    });
  });
});
