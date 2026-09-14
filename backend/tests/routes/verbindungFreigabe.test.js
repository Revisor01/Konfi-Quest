// Freigabe der Datenbank-Verbindung: client.release() gehoert ins finally.
//
// Der Fehler, den diese Datei festhaelt: Stand `client.release()` im try
// hinter dem COMMIT und warf danach noch Code (hier: das synchrone
// emitRoomsChanged in chat.js), fing der Transaktions-catch den Fehler und
// schickte ein ROLLBACK auf einen Client, den der Pool laengst an einen
// ANDEREN Request weitergereicht hatte. Auf der physischen Verbindung stand
// dann: BEGIN | COMMIT | BEGIN | INSERT B | ROLLBACK — der spaete ROLLBACK
// von A brach die Transaktion von B ab. Zusaetzlich reichte das zweite
// release() den Client eines Fremden weiter; der Doppel-Release-Schutz von
// pg-pool greift dabei nicht, weil `release` bei jedem Checkout neu zugewiesen
// wird.
//
// Messbar gemacht mit einem Pool auf max: 1 — beide Requests bekommen
// zwangslaeufig DIESELBE physische Verbindung — und einem db-Wrapper, der
// jede Anweisung pro Verbindung protokolliert.
const request = require('supertest');
const { Pool } = require('pg');
const os = require('os');
const path = require('path');
const { createApp } = require('../../createApp');
const { truncateAll } = require('../helpers/db');
const { seed, USERS, CHAT_ROOMS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

require('pg').types.setTypeParser(20, (val) => parseInt(val, 10));

const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
const TEST_DB_URL = ADMIN_URL.replace(/\/[^/]+$/, '/konfi_test');

describe('Verbindungsfreigabe: client.release() steht im finally', () => {
  let pool;            // echter Pool mit max: 1
  let db;              // Wrapper wie backend/database.js
  let verlauf;         // [{ verbindung, sql }]
  let hilfsPool;       // zweiter Pool fuer Aufraeumen/Pruefen (blockiert max:1 nicht)

  // Jede physische Verbindung bekommt eine Nummer, damit der Verlauf lesbar ist.
  const verbindungsNummern = new WeakMap();
  let naechsteNummer = 1;
  const nummerFuer = (client) => {
    const roh = client.connection || client;
    if (!verbindungsNummern.has(roh)) verbindungsNummern.set(roh, naechsteNummer++);
    return verbindungsNummern.get(roh);
  };

  const protokollieren = (client) => {
    if (client.__protokolliert) return client;
    client.__protokolliert = true;
    const echtesQuery = client.query.bind(client);
    // ALLE Argumente durchreichen: pg ruft query auch mit Callback auf
    // (z.B. beim Zurueckgeben an den Pool). Schluckt der Wrapper den
    // Callback, haengt der Pool beim naechsten Checkout.
    client.query = (...args) => {
      const text = args[0];
      const sql = typeof text === 'string' ? text : (text && text.text) || '';
      verlauf.push({ verbindung: nummerFuer(client), sql: sql.trim().split('\n')[0].slice(0, 60) });
      return echtesQuery(...args);
    };
    return client;
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString: TEST_DB_URL, max: 1, options: '-c timezone=Europe/Berlin' });
    hilfsPool = new Pool({ connectionString: TEST_DB_URL, max: 2, options: '-c timezone=Europe/Berlin' });
    db = {
      query: (text, params) => pool.query(text, params),
      getClient: async () => protokollieren(await pool.connect()),
      end: () => pool.end(),
    };
  });

  afterAll(async () => {
    await pool.end();
    await hilfsPool.end();
  });

  beforeEach(async () => {
    verlauf = [];
    const hilfsDb = {
      query: (t, p) => hilfsPool.query(t, p),
      getClient: () => hilfsPool.connect(),
    };
    if (pool.idleCount !== pool.totalCount) {
      throw new Error(`Pool nicht frei: total=${pool.totalCount} idle=${pool.idleCount} waiting=${pool.waitingCount}`);
    }
    await truncateAll(hilfsDb);
    await seed(hilfsDb);
  });

  // Baut eine App mit einem io-Stub, dessen emit nach Wunsch wirft.
  const appMit = (ioWirft) => createApp(db, {
    uploadsDir: path.join(os.tmpdir(), 'konfi-test-uploads'),
    io: {
      to: () => ({
        emit: () => {
          if (ioWirft) throw new Error('Socket kaputt');
        },
      }),
    },
  });

  // Zweiter Request: schreibt in einer eigenen Transaktion auf DERSELBEN
  // physischen Verbindung (max: 1) eine Chat-Nachricht und committet.
  const zweiterRequestSchreibt = async () => {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, created_at)
         VALUES ($1, $2, 'konfi', 'text', 'Nachricht von B', NOW())`,
        [CHAT_ROOMS.jahrgang.id, USERS.konfi1.id]
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  };

  const anzahlNachrichtenVonB = async () => {
    const { rows } = await hilfsPool.query(
      "SELECT COUNT(*)::int AS anzahl FROM chat_messages WHERE content = 'Nachricht von B'"
    );
    return rows[0].anzahl;
  };

  // Nur die Anweisungen EINER Verbindung, in der Reihenfolge ihres Auftretens.
  const verlaufDerVerbindung = (nummer) =>
    verlauf.filter(e => e.verbindung === nummer).map(e => e.sql);

  it('verbotener Fall: wirft der Socket-Versand nach dem COMMIT, bleibt die Transaktion des naechsten Requests unversehrt', async () => {
    // Der zweite Request muss SCHON auf den Client warten, wenn A ihn
    // zurueckgibt. Nur dann liegt er mit seinem BEGIN VOR dem verspaeteten
    // ROLLBACK von A — genau der gemessene Verlauf
    // BEGIN | COMMIT | BEGIN | INSERT B | ROLLBACK.
    // Das Signal dafuer setzt der io-Stub: er wird von der Route unmittelbar
    // nach dem Freigeben (fehlerhafter Stand) bzw. nach dem finally
    // (richtiger Stand) gerufen.
    let bGestartet = null;
    const app = createApp(db, {
      uploadsDir: path.join(os.tmpdir(), 'konfi-test-uploads'),
      io: {
        to: () => ({
          emit: () => {
            if (!bGestartet) bGestartet = zweiterRequestSchreibt();
            throw new Error('Socket kaputt');
          },
        }),
      },
    });
    const adminToken = generateToken('admin1');

    // Der Raum muss leer sein, sonst antwortet die Route mit 409 statt zu loeschen.
    await hilfsPool.query('DELETE FROM chat_messages WHERE room_id = $1', [CHAT_ROOMS.group.id]);

    const antwort = await request(app)
      .delete(`/api/chat/rooms/${CHAT_ROOMS.group.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Die Antwortform bleibt unveraendert: 200 mit derselben Meldung.
    expect(antwort.status).toBe(200);
    expect(antwort.body).toEqual({ message: 'Chat-Raum erfolgreich gelöscht' });

    // Der Socket-Versand hat geworfen — B ist also wirklich angestossen worden.
    expect(bGestartet).not.toBeNull();
    await bGestartet;

    // Es gibt genau eine physische Verbindung (max: 1).
    const verbindungen = new Set(verlauf.map(e => e.verbindung));
    expect(verbindungen.size).toBe(1);

    const anweisungen = verlaufDerVerbindung([...verbindungen][0]);
    const begins = anweisungen.map((sql, i) => ({ sql, i })).filter(e => e.sql === 'BEGIN');
    // Zwei Transaktionen: die Raum-Loeschung und die von B.
    expect(begins.length).toBe(2);

    // Nach dem BEGIN von B darf KEIN ROLLBACK mehr kommen — auch nicht der
    // verspaetete von A.
    const nachBeginVonB = anweisungen.slice(begins[1].i);
    expect(nachBeginVonB).not.toContain('ROLLBACK');

    // Und der Datensatz von B steht nach dem COMMIT wirklich in der DB.
    expect(await anzahlNachrichtenVonB()).toBe(1);
  });

  it('erlaubter Fall: ohne Fehler kommt der zweite Request durch und der Pool haelt genau einen freien Client', async () => {
    const app = appMit(false);
    const adminToken = generateToken('admin1');

    await hilfsPool.query('DELETE FROM chat_messages WHERE room_id = $1', [CHAT_ROOMS.group.id]);

    const antwort = await request(app)
      .delete(`/api/chat/rooms/${CHAT_ROOMS.group.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(antwort.status).toBe(200);
    expect(antwort.body).toEqual({ message: 'Chat-Raum erfolgreich gelöscht' });

    await zweiterRequestSchreibt();
    expect(await anzahlNachrichtenVonB()).toBe(1);

    // Genau ein Client, genau einmal freigegeben: Ein Doppel-Release wuerde
    // den Zaehler verruecken (idleCount 2 bei totalCount 1 ist unmoeglich,
    // pg-pool wuerde stattdessen den Client eines Fremden weiterreichen).
    expect(pool.totalCount).toBe(1);
    expect(pool.idleCount).toBe(1);
    expect(pool.waitingCount).toBe(0);

    // Der Raum ist wirklich weg.
    const { rows } = await hilfsPool.query('SELECT COUNT(*)::int AS anzahl FROM chat_rooms WHERE id = $1', [CHAT_ROOMS.group.id]);
    expect(rows[0].anzahl).toBe(0);
  });

  it('Zaehlprobe: die Raum-Transaktion selbst laeuft als BEGIN ... COMMIT ohne ROLLBACK durch', async () => {
    const app = appMit(true);
    const adminToken = generateToken('admin1');
    await hilfsPool.query('DELETE FROM chat_messages WHERE room_id = $1', [CHAT_ROOMS.group.id]);

    await request(app)
      .delete(`/api/chat/rooms/${CHAT_ROOMS.group.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Nur das Fenster der Transaktion betrachten: davor stehen die lesenden
    // Vorpruefungen der Route, die ueber db.query auf derselben (einzigen)
    // Verbindung laufen.
    const anweisungen = verlaufDerVerbindung(1);
    const beginn = anweisungen.indexOf('BEGIN');
    expect(beginn).toBeGreaterThanOrEqual(0);
    const transaktion = anweisungen.slice(beginn);
    expect(transaktion[transaktion.length - 1]).toBe('COMMIT');
    expect(transaktion).not.toContain('ROLLBACK');
    // Genau EIN BEGIN: die Route oeffnet nur eine Transaktion.
    expect(anweisungen.filter(sql => sql === 'BEGIN').length).toBe(1);
  });
});
