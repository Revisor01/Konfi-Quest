// backend/tests/helpers/schemaAufbau.js
//
// Wegwerf-Datenbanken fuer die Schema-Waechter -- die beiden Wege, auf denen
// ein Schema entsteht:
//
//   neueInstanzAufbauen  init-scripts/ (wie /docker-entrypoint-initdb.d beim
//                        ersten Start), danach die offenen Migrationen
//   produktionAufbauen   prod-schema.sql + prod-migrations.txt, danach die
//                        offenen Migrationen (derselbe Weg wie globalSetup.js
//                        und jeder Deploy)
//
// Frueher lagen die Funktionen in neuinstallation.test.js; seit dem
// 29.09.2026 brauchen sie auch der Idempotenz- und der
// Wiederherstellungs-Test.
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';

const WURZEL = path.join(__dirname, '..', '..', '..');
const INIT_DIR = path.join(WURZEL, 'init-scripts');
const MIGRATIONS_DIR = path.join(WURZEL, 'backend', 'migrations');
const PROD_SCHEMA = path.join(__dirname, '..', 'schema', 'prod-schema.sql');
const PROD_MIGRATIONEN = path.join(__dirname, '..', 'schema', 'prod-migrations.txt');

function urlFuer(name) {
  return ADMIN_URL.replace(/\/[^/]+$/, `/${name}`);
}

// Die SQL-Dateien in init-scripts in genau der Reihenfolge, in der das
// postgres-Entrypoint sie ausfuehrt (alphabetisch).
function initDateien() {
  return fs.readdirSync(INIT_DIR).filter(f => f.endsWith('.sql')).sort();
}

function migrationsDateien() {
  return fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
}

function prodMigrationen() {
  return fs.readFileSync(PROD_MIGRATIONEN, 'utf8').split('\n').map(z => z.trim()).filter(Boolean);
}

async function dbAnlegen(name) {
  const admin = new Pool({ connectionString: ADMIN_URL });
  await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();
  return new Pool({ connectionString: urlFuer(name) });
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

async function schemaMigrationsTabelle(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

// Alles, was noch nicht in schema_migrations steht, der Reihe nach -- wie
// utils/migrationslauf.js (dort je Datei in einer Transaktion; ein Fehler
// bricht hier ab, statt uebersprungen zu werden). Mit `vor` nur die Dateien,
// deren Name davor liegt: der Stand, auf den eine neue Migration trifft.
async function offeneMigrationenAnwenden(pool, { wegBeschreibung = 'diesem Weg', vor = null } = {}) {
  const { rows: applied } = await pool.query('SELECT name FROM schema_migrations');
  const appliedSet = new Set(applied.map(r => r.name));
  const angewandt = [];
  for (const datei of migrationsDateien()) {
    if (appliedSet.has(datei)) continue;
    if (vor && datei >= vor) break;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, datei), 'utf8');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [datei]);
      angewandt.push(datei);
    } catch (err) {
      throw new Error(`Migration ${datei} laeuft auf ${wegBeschreibung} nicht durch: ${err.message}`, { cause: err });
    }
  }
  return angewandt;
}

// Baut die Datenbank so auf, wie eine neue Instanz startet:
// 1. init-scripts (einmalig durch /docker-entrypoint-initdb.d),
// 2. danach der Migrationslauf des Backends.
async function neueInstanzAufbauen(pool) {
  for (const datei of initDateien()) {
    const sql = fs.readFileSync(path.join(INIT_DIR, datei), 'utf8');
    // Ein query()-Aufruf pro Datei = eine implizite Transaktion, und
    // ON_ERROR_STOP-Verhalten wie im Entrypoint: faellt ein Statement,
    // faellt die Datei.
    await pool.query(sql);
  }
  await schemaMigrationsTabelle(pool);
  return offeneMigrationenAnwenden(pool, { wegBeschreibung: 'einer NEUEN Instanz' });
}

// Nur Schritt 1 einer neuen Instanz: das, was nach dem ersten Start des
// Postgres-Containers da ist, bevor ein Backend lief.
async function nurInitScripts(pool) {
  for (const datei of initDateien()) {
    await pool.query(fs.readFileSync(path.join(INIT_DIR, datei), 'utf8'));
  }
}

// Baut die Vergleichsdatenbank aus dem Produktions-Dump -- derselbe Weg wie
// globalSetup.js fuer die regulaere Testsuite.
// Mit `vor` (Dateiname einer Migration) endet der Aufbau davor -- fuer Tests,
// die eine Migration auf genau dem Stand pruefen, auf den sie beim Deploy
// trifft.
async function produktionAufbauen(pool, { vor = null } = {}) {
  await pool.query(fs.readFileSync(PROD_SCHEMA, 'utf8'));
  await schemaMigrationsTabelle(pool);
  for (const name of prodMigrationen()) {
    await pool.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
  }
  return offeneMigrationenAnwenden(pool, { wegBeschreibung: 'dem Deploy-Weg', vor });
}

// Liest eine Migrationsdatei (fuer Tests, die sie erneut ausfuehren).
function migrationLesen(datei) {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, datei), 'utf8');
}

module.exports = {
  ADMIN_URL,
  MIGRATIONS_DIR,
  urlFuer,
  dbAnlegen,
  dbWegraeumen,
  migrationsDateien,
  migrationLesen,
  prodMigrationen,
  neueInstanzAufbauen,
  nurInitScripts,
  produktionAufbauen,
};
