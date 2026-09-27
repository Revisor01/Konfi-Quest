// backend/tests/utils/socketAdapterSchliessen.test.js
//
// Herunterfahren waehrend des Starts (CI, 27.09.2026): Der Test „endet nach
// SIGTERM mit Exit 0" in gracefulShutdown.test.js fiel im CI mit Exit 1 nach
// 10,4 s. Im Log: SIGTERM, HTTP und Socket.IO geschlossen, Haupt-Pool
// geschlossen -- dann hing `socketAdapterPool.end()` bis zum Notausstieg.
//
// DIE URSACHE liegt in @socket.io/postgres-adapter 0.5.0 (dist/util.js):
// initClient() holt sich einen Client, setzt LISTEN ab und merkt ihn sich
// ERST DANACH in `this.client`. close() gibt nur `this.client` zurueck. Faellt
// io.close() in diese Luecke -- beim Start einer Replica, die sofort wieder
// gestoppt wird --, bleibt der Client fuer immer ausgeliehen, und pool.end()
// wartet ewig.
//
// DIE HUELLE (utils/socketAdapterVerbindung.js) merkt sich deshalb jeden
// ausgeliehenen Client; schliessen() gibt alle zurueck und laesst keine neue
// Verbindung mehr zu. server.js ruft es zwischen io.close() und
// socketAdapterPool.end().
//
// GEGENPROBE: Mit einem schliessen(), das nichts tut, meldet der erste Test
// „haengt" statt „beendet".
const http = require('http');
const { Pool } = require('pg');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/postgres-adapter');
const { mitVerbindungsschutz } = require('../../utils/socketAdapterVerbindung');

const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
const TEST_DB_URL = ADMIN_URL.replace(/\/[^/]+$/, '/konfi_test');

const warte = (ms) => new Promise(r => setTimeout(r, ms));

function neuerPool() {
  const pool = new Pool({ connectionString: TEST_DB_URL, max: 2 });
  pool.on('error', () => {});
  return pool;
}

// Wie lange pool.end() braucht -- oder 'haengt', wenn es nach 4 s nicht
// fertig ist.
async function endeOderHaengt(pool) {
  return Promise.race([
    pool.end().then(() => 'beendet'),
    warte(4000).then(() => 'haengt'),
  ]);
}

describe('Socket.IO-Adapter: Herunterfahren waehrend des Verbindungsaufbaus', () => {
  it('io.close() waehrend der Adapter noch verbindet: der Adapter-Pool schliesst trotzdem', async () => {
    const pool = neuerPool();
    const verbindung = mitVerbindungsschutz(pool, { log: () => {} });
    // Angehaengt, aber nicht lauschend: io.close() braucht die Engine, und
    // ein listen() gaebe dem Verbindungsaufbau Zeit, fertig zu werden.
    const io = new Server(http.createServer());
    // io.adapter() legt den Adapter des Haupt-Namespaces sofort an; sein
    // initClient() wartet jetzt auf pool.connect().
    io.adapter(createAdapter(verbindung, { errorHandler: () => {} }));

    // Sofort stoppen -- wie ein SIGTERM direkt nach dem Start.
    io.close();
    verbindung.schliessen();

    expect(await endeOderHaengt(pool)).toBe('beendet');
    expect(pool.totalCount).toBe(0);
  });

  it('ein beim Stopp noch ausgeliehener Client wird zurueckgegeben', async () => {
    const pool = neuerPool();
    const verbindung = mitVerbindungsschutz(pool, { log: () => {} });

    // So haelt der Adapter seinen LISTEN-Client: ausgeliehen, nie freigegeben.
    const client = await verbindung.connect();
    await client.query('LISTEN "schliessen_test"');
    expect(pool.totalCount).toBe(1);

    verbindung.schliessen();

    expect(await endeOderHaengt(pool)).toBe('beendet');
    expect(pool.totalCount).toBe(0);
  });

  it('nach schliessen() baut die Huelle keine neue Verbindung mehr auf', async () => {
    const pool = neuerPool();
    const verbindung = mitVerbindungsschutz(pool, { log: () => {} });
    verbindung.schliessen();

    // Der Adapter versucht nach einem Abbruch neu zu verbinden. Nach dem
    // Stopp darf daraus keine Verbindung mehr werden: Die Anfrage bleibt
    // offen, statt einen Client zu belegen oder einen neuen Versuch
    // auszuloesen.
    const ergebnis = await Promise.race([
      verbindung.connect().then(() => 'verbunden', () => 'abgelehnt'),
      warte(300).then(() => 'offen'),
    ]);
    expect(ergebnis).toBe('offen');
    expect(pool.totalCount).toBe(0);
    expect(await endeOderHaengt(pool)).toBe('beendet');
  });

  it('ohne schliessen() bleibt der normale Weg unveraendert: release() gibt den Client frei', async () => {
    const pool = neuerPool();
    const verbindung = mitVerbindungsschutz(pool, { log: () => {} });

    const client = await verbindung.connect();
    client.release();
    // Doppelter Aufruf bleibt folgenlos (wie bisher).
    client.release();

    expect(pool.totalCount).toBe(1);
    expect(pool.idleCount).toBe(1);
    expect(await endeOderHaengt(pool)).toBe('beendet');
  });
});
