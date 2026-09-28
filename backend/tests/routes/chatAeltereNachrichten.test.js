// backend/tests/routes/chatAeltereNachrichten.test.js
//
// Aeltere Chat-Nachrichten nachladen: GET /api/chat/rooms/:roomId/messages
// mit ?before=<message_id> (Audit 26.09.2026, app-screens-konfi-teamer BF-04;
// Simon, 28.09.2026: „Chat lädt nur 100 und kein Nachladen. Das muss anders.").
//
// Die App lud einmal die juengsten 100 Nachrichten und danach nur noch Neues
// (?after=). Alles davor war in der App unerreichbar. Jetzt blaettert sie per
// Keyset nach oben: „gib mir die <limit> Nachrichten dieses Raums, die aelter
// sind als diese". Aelter heisst: kleiner im Tupel (created_at, id) — dieselbe
// Reihenfolge wie im Standardzweig (ORDER BY created_at DESC, id DESC). Ein
// reiner Zeitvergleich verliert Nachrichten mit gleichem Zeitstempel an der
// Seitengrenze, ein reiner id-Vergleich passt nicht zur Sortierung, sobald ids
// und Zeitstempel nicht in derselben Reihenfolge laufen.
//
// Vertrag: ohne before bleibt die Route exakt, wie sie ist — die Store-Apps
// (2.2.x, 2.3.0) rufen ?limit=100 und ?after= und kennen before nicht.
//
// Entscheidungen, hier festgehalten und geprueft:
//   - before keine positive ganze Zahl (abc, 0, -5, 12abc, zu gross) → 400.
//   - before zusammen mit after → 400 (zwei Richtungen zugleich ergeben keinen
//     Sinn; keine App schickt beides).
//   - before zeigt auf eine Nachricht, die nicht in DIESEM Raum liegt (fremder
//     Raum, geloeschter Raum, unbekannte id) → 200 mit leerer Liste. Kein
//     Zeitstempel eines anderen Raums fliesst in die Abfrage, und die Antwort
//     verraet nicht, ob die id anderswo existiert.
//   - Die Rechtepruefung ist dieselbe wie ohne before (darfRaumOeffnen) → 403.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, CHAT_ROOMS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const chatSyncCache = require('../../utils/chatSyncCache');

describe('GET /api/chat/rooms/:roomId/messages?before= — aeltere Nachrichten nachladen', () => {
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
   * Legt `anzahl` Nachrichten im Raum an, jede eine Sekunde nach der vorigen
   * (Nachricht 0 ist die aelteste). Gibt die ids in dieser Reihenfolge zurueck.
   */
  async function nachrichten(anzahl, raumId = CHAT_ROOMS.jahrgang.id) {
    const werte = [];
    const platzhalter = [];
    for (let i = 0; i < anzahl; i++) {
      const p = i * 5;
      platzhalter.push(`($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, TIMESTAMPTZ '2026-01-01 00:00:00+00' + ($${p + 5} || ' seconds')::interval)`);
      werte.push(raumId, USERS.konfi1.id, 'konfi', `Nachricht ${i}`, String(i));
    }
    const { rows } = await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, content, created_at)
       VALUES ${platzhalter.join(', ')}
       RETURNING id`,
      werte
    );
    return rows.map(r => Number(r.id));
  }

  /** Eine Nachricht mit festem Zeitstempel anlegen, id zurueck. */
  async function nachrichtUm(zeit, inhalt, raumId = CHAT_ROOMS.jahrgang.id) {
    const { rows: [n] } = await db.query(
      `INSERT INTO chat_messages (room_id, user_id, user_type, content, created_at)
       VALUES ($1, $2, 'konfi', $3, $4) RETURNING id`,
      [raumId, USERS.konfi1.id, inhalt, zeit]
    );
    return Number(n.id);
  }

  const laden = (query, raumId = CHAT_ROOMS.jahrgang.id, token = konfi1Token) =>
    request(app)
      .get(`/api/chat/rooms/${raumId}/messages${query}`)
      .set('Authorization', `Bearer ${token}`);

  const ids = (res) => res.body.map(m => Number(m.id));

  describe('liefert die richtigen aelteren Nachrichten', () => {
    it('blaettert vom juengsten Block lueckenlos bis zum Anfang, ohne Dubletten', async () => {
      const alle = await nachrichten(230);

      // So oeffnet die App den Raum: die juengsten 100.
      const block = await laden('?limit=100');
      expect(block.status).toBe(200);
      expect(ids(block)).toEqual(alle.slice(130));

      // Nach oben scrollen: je 50 aeltere, jeweils vor der aeltesten geladenen.
      const seite1 = await laden(`?before=${alle[130]}&limit=50`);
      expect(seite1.status).toBe(200);
      expect(ids(seite1)).toEqual(alle.slice(80, 130));

      const seite2 = await laden(`?before=${alle[80]}&limit=50`);
      expect(ids(seite2)).toEqual(alle.slice(30, 80));

      // Letzte Seite: nur noch 30 — weniger als angefordert, der Anfang ist
      // erreicht. Genau daran erkennt die App „Anfang des Chats".
      const seite3 = await laden(`?before=${alle[30]}&limit=50`);
      expect(ids(seite3)).toEqual(alle.slice(0, 30));

      // Vor der aeltesten Nachricht gibt es nichts mehr.
      const dahinter = await laden(`?before=${alle[0]}&limit=50`);
      expect(dahinter.status).toBe(200);
      expect(dahinter.body).toEqual([]);

      // Zusammen genau alle 230, jede einmal.
      const zusammen = [...ids(seite3), ...ids(seite2), ...ids(seite1), ...ids(block)];
      expect(zusammen).toEqual(alle);
    });

    it('liefert chronologisch (aelteste zuerst) wie der Standardzweig', async () => {
      const alle = await nachrichten(10);

      const res = await laden(`?before=${alle[6]}&limit=3`);

      expect(res.status).toBe(200);
      // Die drei direkt davor, nicht die drei aeltesten des Raums.
      expect(ids(res)).toEqual([alle[3], alle[4], alle[5]]);
      expect(res.body.map(m => m.content)).toEqual(['Nachricht 3', 'Nachricht 4', 'Nachricht 5']);
    });

    it('bringt dieselben Felder wie der Standardzweig (Reaktionen, Absender)', async () => {
      const alle = await nachrichten(3);
      await db.query(
        `INSERT INTO chat_message_reactions (message_id, user_id, user_type, emoji)
         VALUES ($1, $2, 'konfi', '👍')`,
        [alle[0], USERS.konfi2.id]
      );

      const res = await laden(`?before=${alle[2]}`);

      expect(res.status).toBe(200);
      expect(ids(res)).toEqual([alle[0], alle[1]]);
      expect(res.body[0].sender_name).toBe(USERS.konfi1.display_name);
      expect(res.body[0].reactions).toHaveLength(1);
      expect(res.body[0].reactions[0].emoji).toBe('👍');
      expect(res.body[1].reactions).toEqual([]);
    });

    it('ordnet nach (created_at, id), nicht nach der id allein', async () => {
      // Die spaeter angelegte Nachricht (groessere id) traegt den AELTEREN
      // Zeitstempel — so sortiert sie auch der Standardzweig. Ein reines
      // `id < before` faende sie nicht.
      const spaet = await nachrichtUm('2026-03-01T10:00:00Z', 'spaeter geschrieben');
      const frueh = await nachrichtUm('2026-03-01T09:00:00Z', 'frueher datiert');
      expect(frueh).toBeGreaterThan(spaet);

      const res = await laden(`?before=${spaet}`);

      expect(res.status).toBe(200);
      expect(ids(res)).toEqual([frueh]);
    });
  });

  describe('gleiche Zeitstempel', () => {
    it('findet Nachrichten mit demselben created_at wie der Anker, sofern ihre id kleiner ist', async () => {
      const zeit = '2026-05-05T12:00:00Z';
      const gleich = [];
      for (let i = 0; i < 6; i++) gleich.push(await nachrichtUm(zeit, `gleich ${i}`));

      const res = await laden(`?before=${gleich[4]}`);

      expect(res.status).toBe(200);
      // Mit `created_at < anker` kaeme hier [] zurueck — vier Nachrichten weg.
      expect(ids(res)).toEqual(gleich.slice(0, 4));
    });

    it('verliert und verdoppelt keine Nachricht, wenn die Seitengrenze mitten in gleiche Zeitstempel faellt', async () => {
      const alle = [];
      for (let i = 0; i < 7; i++) alle.push(await nachrichtUm('2026-05-05T12:00:00Z', `A${i}`));
      for (let i = 0; i < 5; i++) alle.push(await nachrichtUm('2026-05-05T12:00:05Z', `B${i}`));

      const block = await laden('?limit=4');
      expect(ids(block)).toEqual(alle.slice(8));

      const gesehen = [...ids(block)];
      let anker = ids(block)[0];
      let seiten = 0;
      for (;;) {
        const seite = await laden(`?before=${anker}&limit=3`);
        expect(seite.status).toBe(200);
        if (seite.body.length === 0) break;
        gesehen.unshift(...ids(seite));
        anker = ids(seite)[0];
        seiten += 1;
        expect(seiten).toBeLessThan(10); // Schutz gegen Endlosschleife
      }

      expect(gesehen).toEqual(alle);
      expect(seiten).toBe(3); // 8 aeltere Nachrichten, je 3: 3 + 3 + 2
    });
  });

  describe('Grenzen', () => {
    it('nimmt ohne limit die Vorgabe 50', async () => {
      const alle = await nachrichten(120);

      const res = await laden(`?before=${alle[110]}`);

      expect(res.status).toBe(200);
      expect(ids(res)).toEqual(alle.slice(60, 110));
    });

    it('deckelt limit auch mit before auf 200', async () => {
      const alle = await nachrichten(260);

      const res = await laden(`?before=${alle[259]}&limit=100000`);

      expect(res.status).toBe(200);
      expect(ids(res)).toEqual(alle.slice(59, 259));
    });

    it('ignoriert offset, sobald before gesetzt ist (Keyset ersetzt das Ueberspringen)', async () => {
      const alle = await nachrichten(20);

      const res = await laden(`?before=${alle[10]}&limit=5&offset=3`);

      expect(res.status).toBe(200);
      expect(ids(res)).toEqual(alle.slice(5, 10));
    });

    it.each([
      ['abc'],
      ['0'],
      ['-5'],
      ['12abc'],
      ['1.5'],
      ['99999999999999999999'],
    ])('lehnt before=%s mit 400 ab', async (wert) => {
      await nachrichten(3);

      const res = await laden(`?before=${encodeURIComponent(wert)}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Ungültiger Wert für before');
    });

    it('lehnt before zusammen mit after mit 400 ab', async () => {
      const alle = await nachrichten(5);

      const res = await laden(`?before=${alle[4]}&after=${alle[0]}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('before und after lassen sich nicht kombinieren');
    });
  });

  describe('fremder Raum', () => {
    it('Anker aus einem Raum ohne Zugriff: leere Liste, kein Blick in den fremden Raum', async () => {
      // konfi1 sitzt nicht in der Team-Gruppe (Raum 3).
      const eigene = await nachrichten(5);
      const fremd = await nachrichtUm('2027-01-01T00:00:00Z', 'Team intern', CHAT_ROOMS.group.id);

      const res = await laden(`?before=${fremd}`);

      expect(res.status).toBe(200);
      // Haette die Abfrage den Zeitstempel der fremden Nachricht benutzt,
      // kaemen hier alle fuenf eigenen Nachrichten zurueck.
      expect(res.body).toEqual([]);
      expect(eigene).toHaveLength(5);
    });

    it('Anker aus einem anderen eigenen Raum: ebenfalls leer', async () => {
      await nachrichten(5);
      const direkt = await nachrichtUm('2027-01-01T00:00:00Z', 'im Direktchat', CHAT_ROOMS.direct.id);

      const res = await laden(`?before=${direkt}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('unbekannte id: leere Liste', async () => {
      await nachrichten(5);

      const res = await laden('?before=987654321');

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('Raum ohne Zugriff bleibt mit before verschlossen (403)', async () => {
      const team = await nachrichten(5, CHAT_ROOMS.group.id);

      const res = await laden(`?before=${team[4]}`, CHAT_ROOMS.group.id);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Zugriff verweigert' });
    });

    it('erlaubter Fall: die Teamerin blaettert in der Team-Gruppe', async () => {
      const team = await nachrichten(5, CHAT_ROOMS.group.id);

      const res = await laden(`?before=${team[4]}`, CHAT_ROOMS.group.id, generateToken('teamer1'));

      expect(res.status).toBe(200);
      expect(ids(res)).toEqual(team.slice(0, 4));
    });
  });

  describe('ohne before unveraendert (Vertrag mit den Store-Apps)', () => {
    it('?limit=100 liefert weiter die juengsten 100, chronologisch', async () => {
      const alle = await nachrichten(150);

      const res = await laden('?limit=100');

      expect(res.status).toBe(200);
      expect(ids(res)).toEqual(alle.slice(50));
    });

    it('?after= liefert weiter nur Neueres, chronologisch', async () => {
      const alle = await nachrichten(10);

      const res = await laden(`?after=${alle[6]}`);

      expect(res.status).toBe(200);
      expect(ids(res)).toEqual(alle.slice(7));
    });

    it('limit/offset blaettert weiter wie bisher', async () => {
      const alle = await nachrichten(30);

      const res = await laden('?limit=10&offset=10');

      expect(res.status).toBe(200);
      expect(ids(res)).toEqual(alle.slice(10, 20));
    });

    it('leerer before-Parameter gilt als nicht gesetzt', async () => {
      // ?before= ohne Wert: so baut kein Client absichtlich, aber eine leere
      // Variable in einer URL-Vorlage ergibt genau das. Dann gilt der
      // Standardzweig, kein 400.
      const alle = await nachrichten(60);

      const res = await laden('?before=&limit=20');

      expect(res.status).toBe(200);
      expect(ids(res)).toEqual(alle.slice(40));
    });
  });
});
