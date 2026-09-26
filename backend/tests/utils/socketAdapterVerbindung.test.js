// backend/tests/utils/socketAdapterVerbindung.test.js
//
// Betrieb BF-01 (Audit 26.09.2026): Ein Verbindungsabbruch zur Datenbank
// beendete alle Backend-Replicas gleichzeitig. Der Socket.IO-Postgres-Adapter
// haelt fuer LISTEN dauerhaft einen ausgecheckten pg-Client ohne
// 'error'-Zuhoerer; bricht die Verbindung ab, wirft Node uncaughtException und
// server.js faehrt herunter.
//
// Dieser Test baut zwei "Replicas" wie in Produktion (je ein Socket.IO-Server
// mit eigenem Adapter-Pool auf derselben Datenbank), bricht die
// LISTEN-Verbindung der ersten gezielt per pg_terminate_backend ab und
// verlangt: Der Prozess lebt, der Fehler ist behandelt (geloggt), die
// Verbindung steht wieder, und eine Nachricht erreicht die andere Replica
// wieder -- zweimal hintereinander, weil der Adapter den toten Client sonst
// nie an den Pool zurueckgibt und der Pool (max 2) beim zweiten Abbruch
// erschoepft waere.
//
// Ohne die Huelle (mitVerbindungsschutz) bricht der Testlauf mit
// "Unhandled Error: terminating connection due to administrator command" ab.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/postgres-adapter');
const { mitVerbindungsschutz } = require('../../utils/socketAdapterVerbindung');
const { getTestPool, closePool } = require('../helpers/db');

const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
const TEST_DB_URL = ADMIN_URL.replace(/\/[^/]+$/, '/konfi_test');

const warte = (ms) => new Promise(r => setTimeout(r, ms));

async function starteReplica(name, log) {
  // Wie server.js: eigener kleiner Pool (max 2) fuer den Adapter. Der
  // application_name macht die Verbindungen dieser Replica in
  // pg_stat_activity gezielt ansprechbar.
  const pool = new Pool({ connectionString: TEST_DB_URL, max: 2, application_name: name });
  pool.on('error', () => {});
  const httpServer = http.createServer();
  const io = new Server(httpServer);
  io.adapter(createAdapter(mitVerbindungsschutz(pool, { log }), { errorHandler: () => {} }));
  await new Promise(resolve => httpServer.listen(0, resolve));
  return { name, pool, io, httpServer };
}

async function beendeReplica(r) {
  await new Promise(resolve => r.io.close(() => resolve()));
  await r.pool.end();
}

function nachrichtAn(io, ereignis, ms = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${ereignis} kam nicht an`)), ms);
    io.once(ereignis, (payload) => { clearTimeout(timer); resolve(payload); });
  });
}

describe('Socket.IO-Adapter: Abbruch der LISTEN-Verbindung', () => {
  let db;
  let a;
  let b;
  const logA = vi.fn();
  const logB = vi.fn();
  const unbehandelt = [];
  const faengeUnbehandelte = (err) => { unbehandelt.push(err); };

  const listenVerbindungen = async (name) => {
    const { rows } = await db.query(
      `SELECT pid FROM pg_stat_activity
       WHERE datname = current_database() AND application_name = $1 AND query LIKE 'LISTEN %'
       ORDER BY pid`,
      [name]
    );
    return rows.map(r => r.pid);
  };

  const warteAufListen = async (name, ohnePid = null) => {
    for (let i = 0; i < 80; i++) {
      const pids = (await listenVerbindungen(name)).filter(p => p !== ohnePid);
      if (pids.length > 0) return pids[0];
      await warte(100);
    }
    throw new Error(`${name}: keine LISTEN-Verbindung innerhalb von 8 s`);
  };

  beforeAll(async () => {
    db = getTestPool();
    process.on('uncaughtException', faengeUnbehandelte);
    a = await starteReplica('paket-c-replica-a', logA);
    b = await starteReplica('paket-c-replica-b', logB);
    await warteAufListen(a.name);
    await warteAufListen(b.name);
  }, 30000);

  afterAll(async () => {
    process.removeListener('uncaughtException', faengeUnbehandelte);
    if (a) await beendeReplica(a);
    if (b) await beendeReplica(b);
    await closePool();
  }, 30000);

  it('Voraussetzung: eine Nachricht von B erreicht A ueber die Datenbank', async () => {
    const ankunft = nachrichtAn(a.io, 'paket-c-ping');
    b.io.serverSideEmit('paket-c-ping', { von: 'B', runde: 0 });
    expect(await ankunft).toEqual({ von: 'B', runde: 0 });
  }, 15000);

  it('nach dem Abbruch lebt der Prozess, der Fehler ist geloggt, die Verbindung steht wieder, Nachrichten kommen an -- zweimal', async () => {
    for (const runde of [1, 2]) {
      const alterPid = (await listenVerbindungen(a.name))[0];
      expect(alterPid).toBeGreaterThan(0);

      const { rows } = await db.query(
        `SELECT count(pg_terminate_backend(pid))::int AS n FROM pg_stat_activity
         WHERE datname = current_database() AND application_name = $1 AND query LIKE 'LISTEN %'`,
        [a.name]
      );
      expect(rows[0].n).toBe(1);

      // Der Prozess lebt und der Fehler ist behandelt: kein uncaughtException,
      // dafuer genau ein Log-Eintrag je Abbruch (pg feuert zwei
      // 'error'-Ereignisse, gemeldet wird einmal).
      await warte(300);
      expect(unbehandelt).toEqual([]);
      const verluste = logA.mock.calls.filter(c => String(c[0]).includes('LISTEN-Verbindung zur Datenbank verloren'));
      expect(verluste).toHaveLength(runde);
      expect(verluste[runde - 1][1]).toBe('terminating connection due to administrator command');

      // Der Adapter verbindet sich neu (1-3 s) und hoert wieder.
      const neuerPid = await warteAufListen(a.name, alterPid);
      expect(neuerPid).not.toBe(alterPid);
      const wiederhergestellt = logA.mock.calls.filter(c => String(c[0]).includes('wieder aufgebaut'));
      expect(wiederhergestellt).toHaveLength(runde);

      // Und die Zustellung an die andere Replica funktioniert in beide Richtungen.
      const anA = nachrichtAn(a.io, 'paket-c-ping');
      b.io.serverSideEmit('paket-c-ping', { von: 'B', runde });
      expect(await anA).toEqual({ von: 'B', runde });

      const anB = nachrichtAn(b.io, 'paket-c-pong');
      a.io.serverSideEmit('paket-c-pong', { von: 'A', runde });
      expect(await anB).toEqual({ von: 'A', runde });
    }

    // Der tote Client wurde jedes Mal an den Pool zurueckgegeben: Der Pool
    // haelt hoechstens seine zwei Plaetze, nichts haengt als Leiche darin.
    expect(a.pool.totalCount).toBeLessThanOrEqual(2);
    expect(a.pool.waitingCount).toBe(0);
    // Replica B war nie betroffen.
    expect(logB).not.toHaveBeenCalled();
  }, 40000);

  it('server.js gibt den Adapter-Pool nur ueber die Huelle an den Adapter', () => {
    const quelle = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');
    expect(quelle).toMatch(/createPgAdapter\(mitVerbindungsschutz\(socketAdapterPool\)/);
  });
});
