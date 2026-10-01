// backend/tests/utils/startbanner.test.js
//
// Das Startbanner sagt, ob diese Replica Hintergrund-Jobs fahren kann
// (Rückmeldung des lokalen Agenten, 01.10.2026).
//
// BEFUND: Gemessen am Test-Backend stand "Background: Gestartet" direkt unter
// "Hintergrund-Jobs DEAKTIVIERT (RUN_BACKGROUND_JOBS=false)". Das Banner war
// fest verdrahtet und behauptete Jobs, die es auf dieser Replica nie gibt --
// und auf jeder anderen Replica laufen sie erst, wenn sie Cron-Leader wird.
//
// Der Test startet server.js als eigenen Prozess gegen die Test-DB (wie
// gracefulShutdown.test.js) und liest die Zeile aus der echten Ausgabe.
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const path = require('path');

vi.setConfig({ testTimeout: 60_000 });

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

function gesund(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/health' }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => req.destroy());
  });
}

/** Startet server.js, wartet auf das Banner und liefert die Background-Zeile. */
async function backgroundZeile(runBackgroundJobs) {
  const port = await freierPort();
  const env = {
    ...process.env,
    DATABASE_URL: TEST_DB_URL,
    PORT: String(port),
    NODE_ENV: 'test',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: '1',
    SMTP_PASS: '',
    SHUTDOWN_DRAIN_MS: '0',
  };
  if (runBackgroundJobs === undefined) delete env.RUN_BACKGROUND_JOBS;
  else env.RUN_BACKGROUND_JOBS = runBackgroundJobs;

  const kind = spawn(process.execPath, [SERVER_JS], { cwd: path.dirname(SERVER_JS), env, stdio: ['ignore', 'pipe', 'pipe'] });
  let ausgabe = '';
  kind.stdout.on('data', (c) => { ausgabe += String(c); });
  kind.stderr.on('data', (c) => { ausgabe += String(c); });
  const beendet = new Promise((resolve) => kind.once('exit', resolve));
  try {
    const bis = Date.now() + 30_000;
    while (Date.now() < bis && !(await gesund(port) && /Background:/.test(ausgabe))) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const zeile = ausgabe.split('\n').find((z) => z.includes('Background:'));
    if (!zeile) throw new Error(`Kein Banner in der Ausgabe:\n${ausgabe}`);
    return zeile.trim();
  } finally {
    kind.kill('SIGTERM');
    await beendet;
  }
}

describe('Startbanner: Hintergrund-Jobs', () => {
  it('RUN_BACKGROUND_JOBS=false: das Banner sagt "Deaktiviert", nicht "Gestartet"', async () => {
    expect(await backgroundZeile('false')).toBe('- Background: Deaktiviert (RUN_BACKGROUND_JOBS=false)');
  });

  it('sonst: das Banner nennt die Leader-Wahl -- gestartet wird erst beim Cron-Leader', async () => {
    expect(await backgroundZeile('true')).toBe('- Background: Leader-Wahl (Jobs laufen auf dem Cron-Leader)');
    expect(await backgroundZeile(undefined)).toBe('- Background: Leader-Wahl (Jobs laufen auf dem Cron-Leader)');
  });
});
