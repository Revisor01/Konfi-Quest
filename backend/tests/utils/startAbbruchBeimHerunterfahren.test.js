// backend/tests/utils/startAbbruchBeimHerunterfahren.test.js
//
// Stopp waehrend des Starts (CI, 27.09.2026): database.js prueft beim
// Modul-Laden die Datenbank und spielt die Migrationen ein. Faellt ein
// SIGTERM in diese Phase, schliesst gracefulShutdown den Pool; der
// Start-Promise scheitert dann an „Cannot use a pool after calling end on the
// pool", meldete „Database startup failed (DB nicht erreichbar)" und rief in
// Produktion process.exit(1) -- vor dem geordneten Exit 0 des Shutdowns. Ein
// regulaerer Stopp einer gerade startenden Replica sah damit wie ein Absturz
// aus.
//
// Der Test laedt database.js in einem eigenen Prozess mit NODE_ENV=production
// (nur dort beendet der Fehlerzweig den Prozess), schliesst den Pool sofort
// wieder -- wie gracefulShutdown -- und verlangt Exit 0 ohne die Meldung
// „Database startup failed".
//
// GEGENPROBE: Ohne die Pruefung auf pool.ending endet der Prozess mit Exit 1.
const { spawn } = require('child_process');
const path = require('path');

const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
const TEST_DB_URL = ADMIN_URL.replace(/\/[^/]+$/, '/konfi_test');
const DATABASE_JS = path.join(__dirname, '..', '..', 'database.js');

function lauf(skript, extraEnv = {}) {
  return new Promise((resolve) => {
    const ausgabe = [];
    const kind = spawn(process.execPath, ['-e', skript], {
      cwd: path.dirname(DATABASE_JS),
      env: { ...process.env, DATABASE_URL: TEST_DB_URL, NODE_ENV: 'production', ...extraEnv },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    kind.stdout.on('data', (c) => ausgabe.push(String(c)));
    kind.stderr.on('data', (c) => ausgabe.push(String(c)));
    kind.once('exit', (code) => resolve({ code, text: ausgabe.join('') }));
  });
}

describe('Start von database.js, wenn gleich wieder heruntergefahren wird', () => {
  it('Pool sofort geschlossen: kein Startfehler, Exit 0', async () => {
    const { code, text } = await lauf(`
      const db = require(${JSON.stringify(DATABASE_JS)});
      db.end().then(() => setTimeout(() => process.exit(0), 1500));
    `);
    if (code !== 0) console.log(text);
    expect(text).not.toMatch(/Database startup failed/);
    expect(code).toBe(0);
  }, 20000);

  it('ohne Herunterfahren bleibt ein echter Startfehler ein Startfehler (Exit 1)', async () => {
    // Nicht erreichbarer Port: Das ist weiterhin ein harter Abbruch.
    const { code, text } = await lauf(`
      require(${JSON.stringify(DATABASE_JS)});
      setTimeout(() => process.exit(0), 8000);
    `, {
      DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:1/konfi_test',
      PG_CONN_TIMEOUT: '1000',
    });
    expect(text).toMatch(/Database startup failed \(DB nicht erreichbar\)/);
    expect(code).toBe(1);
  }, 20000);
});
