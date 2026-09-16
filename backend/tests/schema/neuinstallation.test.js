// backend/tests/schema/neuinstallation.test.js
//
// Waechter fuer den Weg, den NUR eine neue Instanz geht.
//
// init-scripts/ wird in deploy/compose.konfi_quest.yml nach
// /docker-entrypoint-initdb.d gehaengt. Das postgres-Image fuehrt das genau
// einmal aus: beim allerersten Start mit leerem Datenverzeichnis. Fuer die
// laufende Produktion passiert hier nie wieder etwas — und genau deshalb
// faellt ein Fehler dort im Alltag niemandem auf.
//
// Vorgeschichte (16.09.2026): init-scripts/01-create-schema.sql war ein
// handgeschriebenes Schema und damit eine ZWEITE Quelle neben den
// Migrationen. Die beiden waren weit auseinandergelaufen:
//   - 25 Tabellen statt 57,
//   - drei Tabellen, die es in Produktion seit 076/090 nicht mehr gibt
//     (badges, konfi_activities, konfi_badges),
//   - CHECK (attendance_status IN ('present','absent')) — der Code schreibt
//     seit Migration 147 auch 'excused',
//   - und ein CREATE INDEX ... WHERE event_date > CURRENT_TIMESTAMP, das
//     Postgres gar nicht annimmt ("functions in index predicate must be
//     marked IMMUTABLE"). Gemessen: der Container endete mit Exit-Code 3,
//     eine Neuinstallation kam nie hoch.
// Keine Suite konnte das sehen: Die Tests bauen aus prod-schema.sql und
// fassten init-scripts nie an.
//
// Dieser Test baut eine Wegwerf-Datenbank GENAU so auf, wie es eine neue
// Instanz tut — init-scripts einspielen, dann die Migrationen —, und
// vergleicht das Ergebnis mit dem Produktionsschema.
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
const DB_NAME = 'konfi_test_neuinstallation';

const WURZEL = path.join(__dirname, '..', '..', '..');
const INIT_DIR = path.join(WURZEL, 'init-scripts');
const MIGRATIONS_DIR = path.join(WURZEL, 'backend', 'migrations');
const PROD_SCHEMA = path.join(__dirname, 'prod-schema.sql');
const PROD_MIGRATIONEN = path.join(__dirname, 'prod-migrations.txt');

// Die Dateien in init-scripts in genau der Reihenfolge, in der das
// postgres-Entrypoint sie ausfuehrt (alphabetisch).
function initDateien() {
  return fs.readdirSync(INIT_DIR).filter(f => f.endsWith('.sql')).sort();
}

async function dbAnlegen(name) {
  const admin = new Pool({ connectionString: ADMIN_URL });
  await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();
  const url = ADMIN_URL.replace(/\/[^/]+$/, `/${name}`);
  return new Pool({ connectionString: url });
}

async function dbWegraeumen(pool, name) {
  if (pool) await pool.end();
  const admin = new Pool({ connectionString: ADMIN_URL });
  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [name]
  );
  await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
  await admin.end();
}

// Baut die Datenbank so auf, wie eine neue Instanz startet:
// 1. init-scripts (einmalig durch /docker-entrypoint-initdb.d),
// 2. danach backend/database.js runMigrations — alles, was noch nicht
//    in schema_migrations steht.
async function neueInstanzAufbauen(pool) {
  for (const datei of initDateien()) {
    const sql = fs.readFileSync(path.join(INIT_DIR, datei), 'utf8');
    // Ein query()-Aufruf pro Datei = eine implizite Transaktion, und
    // ON_ERROR_STOP-Verhalten wie im Entrypoint: faellt ein Statement,
    // faellt die Datei.
    await pool.query(sql);
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const { rows: applied } = await pool.query('SELECT name FROM schema_migrations');
  const appliedSet = new Set(applied.map(r => r.name));

  const offen = [];
  for (const datei of fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()) {
    if (appliedSet.has(datei)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, datei), 'utf8');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [datei]);
      offen.push(datei);
    } catch (err) {
      throw new Error(`Migration ${datei} laeuft auf einer NEUEN Instanz nicht durch: ${err.message}`);
    }
  }
  return offen;
}

// Baut die Vergleichsdatenbank aus dem Produktions-Dump — derselbe Weg wie
// globalSetup.js fuer die regulaere Testsuite.
async function produktionAufbauen(pool) {
  await pool.query(fs.readFileSync(PROD_SCHEMA, 'utf8'));
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  for (const name of fs.readFileSync(PROD_MIGRATIONEN, 'utf8').split('\n').map(z => z.trim()).filter(Boolean)) {
    await pool.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
  }
  const { rows: applied } = await pool.query('SELECT name FROM schema_migrations');
  const appliedSet = new Set(applied.map(r => r.name));
  for (const datei of fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort()) {
    if (appliedSet.has(datei)) continue;
    await pool.query(fs.readFileSync(path.join(MIGRATIONS_DIR, datei), 'utf8'));
    await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [datei]);
  }
}

const TABELLEN_SQL = `
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
`;
const SPALTEN_SQL = `
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, column_name
`;
const CHECKS_SQL = `
  SELECT t.relname AS tabelle, pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public' AND c.contype = 'c'
  ORDER BY t.relname, pg_get_constraintdef(c.oid)
`;
const VIEWS_SQL = `
  SELECT viewname FROM pg_views WHERE schemaname = 'public' ORDER BY viewname
`;

describe('Neuinstallation: init-scripts + Migrationen ergeben das Produktionsschema', () => {
  let neu;
  let prod;
  const NEU_DB = DB_NAME;
  const PROD_DB = `${DB_NAME}_referenz`;

  beforeAll(async () => {
    neu = await dbAnlegen(NEU_DB);
    await neueInstanzAufbauen(neu);
    prod = await dbAnlegen(PROD_DB);
    await produktionAufbauen(prod);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(neu, NEU_DB);
    await dbWegraeumen(prod, PROD_DB);
  }, 120000);

  it('init-scripts laeuft auf einer leeren Datenbank fehlerfrei durch', async () => {
    // Beweis, dass der Aufbau oben nicht stillschweigend gescheitert ist:
    // ohne Tabellen waere jeder folgende Vergleich wertlos.
    const { rows } = await neu.query(TABELLEN_SQL);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('dieselben Tabellen wie in Produktion', async () => {
    const { rows: a } = await neu.query(TABELLEN_SQL);
    const { rows: b } = await prod.query(TABELLEN_SQL);
    expect(a.map(r => r.tablename)).toEqual(b.map(r => r.tablename));
  });

  it('dieselben Views wie in Produktion', async () => {
    // event_booking_stats entsteht erst in Migration 128/136/154 — ein
    // fehlender View faellt sonst erst beim ersten Seitenaufruf auf.
    const { rows: a } = await neu.query(VIEWS_SQL);
    const { rows: b } = await prod.query(VIEWS_SQL);
    expect(a.map(r => r.viewname)).toEqual(b.map(r => r.viewname));
  });

  it('dieselben Spalten mit denselben Typen', async () => {
    const schluessel = rows => rows.map(r => `${r.table_name}.${r.column_name}:${r.data_type}`);
    const { rows: a } = await neu.query(SPALTEN_SQL);
    const { rows: b } = await prod.query(SPALTEN_SQL);
    expect(schluessel(a)).toEqual(schluessel(b));
  });

  it('dieselben CHECK-Constraints', async () => {
    // Die Klasse Fehler, die den Anlass gab: ein CHECK, der einen Wert
    // verbietet, den der Code schreibt.
    const schluessel = rows => rows.map(r => `${r.tabelle}: ${r.definition}`);
    const { rows: a } = await neu.query(CHECKS_SQL);
    const { rows: b } = await prod.query(CHECKS_SQL);
    expect(schluessel(a)).toEqual(schluessel(b));
  });
});

describe('Neuinstallation: die Werte, die der Code schreibt, sind erlaubt', () => {
  let pool;
  const DB = `${DB_NAME}_werte`;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await neueInstanzAufbauen(pool);
    // Minimalgeruest fuer eine Buchung: Organisation, Rolle, Nutzer, Termin.
    await pool.query(`INSERT INTO organizations (id, name, slug) VALUES (901, 'Waechter', 'waechter-neuinstallation')`);
    await pool.query(`INSERT INTO roles (id, name, display_name, organization_id)
                      VALUES (901, 'waechter', 'Waechter', 901)`);
    await pool.query(`INSERT INTO users (id, username, display_name, password_hash, role_id, organization_id)
                      VALUES (901, 'waechter', 'Waechter', 'x', 901, 901)`);
    await pool.query(`INSERT INTO events (id, name, event_date, organization_id)
                      VALUES (901, 'Waechter-Termin', NOW(), 901)`);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  const buchung = async (spalte, wert) => {
    await pool.query('DELETE FROM event_bookings WHERE id = 9901');
    await pool.query(
      `INSERT INTO event_bookings (id, event_id, user_id, organization_id, ${spalte})
       VALUES (9901, 901, 901, 901, $1)`,
      [wert]
    );
    const { rows } = await pool.query(`SELECT ${spalte} AS wert FROM event_bookings WHERE id = 9901`);
    return rows[0].wert;
  };

  // routes/events/anwesenheit.js laesst genau diese drei Werte zu.
  it.each(['present', 'absent', 'excused'])(
    "attendance_status = '%s' ist erlaubt",
    async (wert) => {
      expect(await buchung('attendance_status', wert)).toBe(wert);
    }
  );

  // Migration 153: 'excused' kam zu den Buchungsstatus dazu.
  it.each(['confirmed', 'waitlist', 'cancelled', 'opted_out', 'pending', 'excused'])(
    "status = '%s' ist erlaubt",
    async (wert) => {
      expect(await buchung('status', wert)).toBe(wert);
    }
  );

  // Migration 151: checkin_quelle hat bewusst einen CHECK.
  it.each(['qr', 'manuell'])("checkin_quelle = '%s' ist erlaubt", async (wert) => {
    expect(await buchung('checkin_quelle', wert)).toBe(wert);
  });

  it('checkin_quelle = "erfunden" wird abgelehnt (der verbotene Fall)', async () => {
    // Gegenstueck zu den erlaubten Faellen: der CHECK greift wirklich,
    // die Spalte ist nicht einfach ungeprueft.
    await expect(buchung('checkin_quelle', 'erfunden')).rejects.toThrow();
  });

  // Migration 155: status_vor_absage merkt sich den Stand vor der Absage.
  it.each(['confirmed', 'waitlist'])("status_vor_absage = '%s' ist erlaubt", async (wert) => {
    expect(await buchung('status_vor_absage', wert)).toBe(wert);
  });

  it('status_vor_absage = "cancelled" wird abgelehnt (der verbotene Fall)', async () => {
    await expect(buchung('status_vor_absage', 'cancelled')).rejects.toThrow();
  });
});
