// backend/tests/utils/gracefulShutdown.test.js
//
// Graceful Shutdown von server.js (Audit 26.09.2026, Betrieb BF-07).
//
// BEFUND: Jeder Stopp endete nach exakt 10 s mit Exit 1. server.close()
// -> db.end() -> socketAdapterPool.end(): Der Socket.IO-Postgres-Adapter
// haelt fuer LISTEN dauerhaft einen Client aus dem Adapter-Pool ausgecheckt
// und gibt ihn nur ueber io.close() zurueck; pool.end() wartete ewig, der
// 30-s-Aufraeumtimer des Adapters lief weiter gegen den geschlossenen Pool
// ("Cannot use a pool after calling end on the pool"), nach 10 s griff der
// Notausstieg mit Exit 1. Der Container meldete damit jeden regulaeren Stopp
// als Absturz, und jeder Deploy dauerte je Replica 10 s laenger.
//
// Gemessen vor dem Fix (Port 6439, Test-DB): Exit 1 nach 10 014 ms.
// Nach dem Fix: Exit 0 nach 833 ms.
//
// Dieser Test startet server.js als eigenen Prozess gegen die Test-DB, wartet
// auf /api/health, haelt eine Keep-Alive-Verbindung offen, sendet SIGTERM und
// misst Exit-Code und Dauer. Der zweite Test prueft die Drain-Phase: Solange
// SHUTDOWN_DRAIN_MS laeuft, meldet /api/health 503 (Traefik nimmt die Replica
// aus dem Pool), alle anderen Anfragen werden weiter beantwortet.
//
// GEGENPROBE: Mit der alten Reihenfolge (server.close, dann Pools, ohne
// io.close) faellt der erste Test mit "expected 1 to be 0" und einer Dauer
// von rund 10 000 ms.
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
const TEST_DB_URL = ADMIN_URL.replace(/\/[^/]+$/, '/konfi_test');
const SERVER_JS = path.join(__dirname, '..', '..', 'server.js');

function freierPort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

function hole(port, pfad, agent) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: pfad, agent }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Zeit abgelaufen')));
  });
}

async function warteAufGesund(port, maxMs = 30000) {
  const bis = Date.now() + maxMs;
  while (Date.now() < bis) {
    try {
      const r = await hole(port, '/api/health');
      if (r.status === 200) return;
    } catch {
      // noch nicht da
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`server.js wurde auf Port ${port} nicht gesund`);
}

async function starteServer(extraEnv = {}) {
  const port = await freierPort();
  const ausgabe = [];
  const kind = spawn(process.execPath, [SERVER_JS], {
    cwd: path.dirname(SERVER_JS),
    env: {
      ...process.env,
      DATABASE_URL: TEST_DB_URL,
      PORT: String(port),
      NODE_ENV: 'test',
      // Diese Replica ist Cron-Leader: Auch die Hintergrund-Jobs muessen
      // beim Stopp sauber mitgehen.
      RUN_BACKGROUND_JOBS: 'true',
      // SMTP schnell scheitern lassen statt gegen einen echten Host zu laufen.
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: '1',
      SMTP_PASS: '',
      SHUTDOWN_DRAIN_MS: '0',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  kind.stdout.on('data', (c) => ausgabe.push(String(c)));
  kind.stderr.on('data', (c) => ausgabe.push(String(c)));

  const beendet = new Promise((resolve) => {
    kind.once('exit', (code, signal) => resolve({ code, signal }));
  });

  await warteAufGesund(port);
  return {
    kind,
    port,
    text: () => ausgabe.join(''),
    // Sendet SIGTERM und misst bis zum exit-Ereignis.
    async stoppe() {
      const start = Date.now();
      kind.kill('SIGTERM');
      const ergebnis = await beendet;
      return { ...ergebnis, dauerMs: Date.now() - start };
    },
  };
}

describe('Graceful Shutdown von server.js', () => {
  let server;

  afterEach(async () => {
    if (server && server.kind.exitCode === null) {
      server.kind.kill('SIGKILL');
    }
    server = null;
  });

  it('endet nach SIGTERM mit Exit 0 in unter 3 s -- auch mit offener Keep-Alive-Verbindung', async () => {
    server = await starteServer();

    // Eine leerlaufende Keep-Alive-Verbindung, wie sie jede App-Instanz
    // haelt. Ohne closeIdleConnections() hielte sie server.close() offen.
    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    const gesund = await hole(server.port, '/api/health', agent);
    expect(gesund.status).toBe(200);

    const { code, signal, dauerMs } = await server.stoppe();
    agent.destroy();

    // Bei einem Fehlschlag steht die Ursache im Log des Kindprozesses.
    if (code !== 0) console.log(server.text());
    expect(signal).toBeNull();
    expect(code).toBe(0);
    expect(dauerMs).toBeLessThan(3000);

    const log = server.text();
    // Die Zeile des Befunds: Der Adapter-Timer lief gegen den geschlossenen
    // Pool. (Ein Hintergrund-Job, der genau im Moment des Stopps noch lief,
    // darf denselben Fehlertext loggen -- das ist ein anderer, harmloser Pfad.)
    expect(log).not.toContain('Socket.IO-Postgres-Adapter Fehler: Cannot use a pool after calling end on the pool');
    expect(log).not.toContain('Shutdown-Timeout erreicht');
    expect(log).toContain('Socket.IO-Adapter-Pool geschlossen.');
  }, 45000);

  it('meldet waehrend der Drain-Phase auf /api/health 503 und beantwortet andere Anfragen weiter', async () => {
    server = await starteServer({ SHUTDOWN_DRAIN_MS: '1500' });

    const start = Date.now();
    server.kind.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 200));

    const health = await hole(server.port, '/api/health');
    expect(health.status).toBe(503);
    expect(JSON.parse(health.body)).toEqual({ status: 'STOPPING', message: 'Konfi Points API wird beendet' });

    // Die API selbst antwortet in dieser Zeit noch -- Traefik hat die
    // Replica noch im Pool, laufende Nutzer:innen merken nichts.
    const status = await hole(server.port, '/api/status');
    expect(status.status).toBe(200);
    expect(JSON.parse(status.body).checks.database).toBe('ok');

    const { code } = await new Promise((resolve) => {
      server.kind.once('exit', (c) => resolve({ code: c }));
    });
    const dauerMs = Date.now() - start;
    expect(code).toBe(0);
    expect(dauerMs).toBeGreaterThanOrEqual(1500);
    expect(dauerMs).toBeLessThan(4500);
  }, 45000);
});
