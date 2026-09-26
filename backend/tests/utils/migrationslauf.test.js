// backend/tests/utils/migrationslauf.test.js
//
// Der Migrationslauf beim Start darf nicht an den Zeitgrenzen des App-Pools
// scheitern (Audit 26.09.2026, Datenbank BF-03 und BF-04).
//
// Der App-Pool setzt statement_timeout und query_timeout auf 30 s. Bis zum
// 26.09.2026 liefen Lock- und Migrationsverbindung mit genau diesen Grenzen:
//   - Die zweite Replica wartete auf pg_advisory_lock; dauerte der Lauf der
//     ersten laenger als 30 s, brach Postgres den Lock-Aufruf ab und der
//     Prozess endete mit "DB nicht erreichbar" (reproduziert: Exit 1 nach 31 s).
//   - Ein einzelnes Migrations-Statement ueber 30 s (Backfill, CREATE INDEX
//     auf Millionen Zeilen) scheiterte, der Server startete mit altem Schema.
//
// Hier laeuft der Lauf gegen einen Pool mit 500 ms Grenze (statt 30 s, damit
// der Test schnell ist) und Migrationen, die laenger brauchen. Ohne die
// Freischaltung in utils/migrationslauf.js faellt der erste Test mit
// "canceling statement due to statement timeout" und der zweite mit
// "Migrations-Lock nicht bekommen: canceling statement due to statement
// timeout".
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Pool } = require('pg');
const { fuehreMigrationenAus, MIGRATION_ADVISORY_LOCK_ID } = require('../../utils/migrationslauf');

const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
const TEST_DB_URL = ADMIN_URL.replace(/\/[^/]+$/, '/konfi_test');

// Kurze Grenze: Der Fehlerfall zeigt sich in unter einer Sekunde statt nach 30.
const GRENZE_MS = 500;

const stumm = { log: () => {}, error: () => {} };

describe('Migrationslauf ohne die 30-s-Grenzen des App-Pools', () => {
  let pool;
  let verzeichnis;
  const angelegteDateien = [];

  beforeAll(() => {
    pool = new Pool({
      connectionString: TEST_DB_URL,
      max: 4,
      statement_timeout: GRENZE_MS,
      query_timeout: GRENZE_MS,
    });
    verzeichnis = fs.mkdtempSync(path.join(os.tmpdir(), 'konfi-migrationen-'));
  });

  afterEach(async () => {
    // Die Testmigrationen duerfen nicht als "angewandt" in der gemeinsamen
    // Test-DB stehen bleiben -- der naechste Lauf faende sie sonst vor.
    for (const datei of angelegteDateien) {
      await pool.query('DELETE FROM schema_migrations WHERE name = $1', [datei]);
      fs.rmSync(path.join(verzeichnis, datei), { force: true });
    }
    angelegteDateien.length = 0;
  });

  afterAll(async () => {
    await pool.end();
    fs.rmSync(verzeichnis, { recursive: true, force: true });
  });

  function migration(name, sql) {
    fs.writeFileSync(path.join(verzeichnis, name), sql);
    angelegteDateien.push(name);
    return name;
  }

  it('Pool-Grenze greift: eine gewoehnliche Abfrage ueber der Grenze wird abgebrochen', async () => {
    // Vorbedingung des Tests, nicht der Fix: Die Grenze ist scharf.
    await expect(pool.query('SELECT pg_sleep(1.2)')).rejects.toThrow(/timeout/);
  });

  it('eine Migration, die laenger als die Pool-Grenze braucht, laeuft durch', async () => {
    const name = migration('999_test_lange_migration.sql', 'SELECT pg_sleep(1.2);');

    const ergebnis = await fuehreMigrationenAus(pool, { verzeichnis, logger: stumm });

    expect(ergebnis.fehlgeschlagen).toEqual([]);
    expect(ergebnis.neu).toBe(1);
    const { rows } = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
    expect(rows).toHaveLength(1);
  }, 15000);

  it('die wartende Replica ueberlebt einen Lock-Halter, der laenger als die Grenze braucht', async () => {
    migration('999_test_leer.sql', 'SELECT 1;');

    // Ein anderer Prozess (die erste Replica) haelt den Migrations-Lock 1,2 s.
    const halter = new Pool({ connectionString: TEST_DB_URL, max: 1 });
    const client = await halter.connect();
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_ADVISORY_LOCK_ID]);
    const freigabe = setTimeout(() => {
      client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_ADVISORY_LOCK_ID]).catch(() => {});
    }, 1200);

    const start = Date.now();
    try {
      const ergebnis = await fuehreMigrationenAus(pool, { verzeichnis, logger: stumm });
      expect(ergebnis.fehlgeschlagen).toEqual([]);
      expect(ergebnis.neu).toBe(1);
      // Er hat wirklich gewartet, statt den Lock zu ueberspringen.
      expect(Date.now() - start).toBeGreaterThanOrEqual(1100);
    } finally {
      clearTimeout(freigabe);
      client.release();
      await halter.end();
    }
  }, 15000);

  it('eine fehlerhafte Migration wird uebersprungen und gemeldet, der Lauf geht weiter', async () => {
    migration('998_test_kaputt.sql', 'SELECT * FROM tabelle_die_es_nicht_gibt;');
    migration('999_test_danach.sql', 'SELECT 1;');

    const ergebnis = await fuehreMigrationenAus(pool, { verzeichnis, logger: stumm });

    expect(ergebnis.neu).toBe(1);
    expect(ergebnis.fehlgeschlagen).toHaveLength(1);
    expect(ergebnis.fehlgeschlagen[0].file).toBe('998_test_kaputt.sql');
    expect(ergebnis.fehlgeschlagen[0].message).toContain('tabelle_die_es_nicht_gibt');
  });

  it('gibt die freigeschalteten Verbindungen nicht in den Pool zurueck', async () => {
    migration('999_test_leer.sql', 'SELECT 1;');
    await fuehreMigrationenAus(pool, { verzeichnis, logger: stumm });

    // Jede Verbindung, die der Pool danach herausgibt, traegt wieder die
    // Grenze -- sonst liefe irgendwann eine App-Abfrage ohne Zeitgrenze.
    for (let i = 0; i < 4; i++) {
      const { rows: [r] } = await pool.query("SELECT current_setting('statement_timeout') AS grenze");
      expect(r.grenze).toBe(`${GRENZE_MS}ms`);
    }
  });

  it('meldet einen abgebrochenen Lock-Aufruf als Lock-Problem, nicht als unerreichbare Datenbank', async () => {
    const kaputterPool = {
      connect: async () => ({
        query: async (cfg) => {
          const text = typeof cfg === 'string' ? cfg : cfg.text;
          if (text.includes('pg_advisory_lock')) {
            throw new Error('canceling statement due to statement timeout');
          }
          return { rows: [] };
        },
        release: () => {},
      }),
      query: async () => ({ rows: [] }),
    };

    await expect(fuehreMigrationenAus(kaputterPool, { verzeichnis, logger: stumm }))
      .rejects.toThrow('Migrations-Lock nicht bekommen: canceling statement due to statement timeout');
  });
});
