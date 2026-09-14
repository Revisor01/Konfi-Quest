// backend/tests/schema/migration064Indizes.test.js
//
// Waechter fuer 064_add_missing_indexes.sql auf einer FRISCHEN Datenbank.
//
// Es gibt drei Migrationsdateien mit der Nummer 064. database.js sortiert rein
// alphabetisch, also laeuft 064_add_missing_indexes.sql VOR
// 064_consolidate_inline_schemas.sql — und damit bevor die Zertifikats- und
// Material-Tabellen ueberhaupt angelegt sind. `CREATE INDEX IF NOT EXISTS` deckt
// nur den Index, nicht die fehlende Tabelle: Postgres wirft
// `relation "materials" does not exist` und reisst in derselben Transaktion
// alles Nachfolgende mit — auch die activity_categories-Indizes ganz am Ende
// der Datei.
//
// Die regulaere Suite kann das nicht sehen: globalSetup.js laedt das Schema aus
// dem Produktions-Dump und traegt 064 ueber prod-migrations.txt als bereits
// angewandt ein. Die Datei laeuft dort also NIE. Deshalb baut dieser Test seine
// eigene Wegwerf-Datenbank.
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';
const DB_NAME = 'konfi_test_mig064';

const INDEX_SQL = fs.readFileSync(
  path.join(__dirname, '..', '..', 'migrations', '064_add_missing_indexes.sql'),
  'utf8'
);

// Genau die acht Tabellen, die 064_consolidate_inline_schemas.sql erst NACH
// dieser Datei anlegt (material_tags/material_file_tags spaeter per 130 wieder
// gedroppt). Sie fehlen hier bewusst.
const ERST_SPAETER = new Set([
  'certificate_types',
  'user_certificates',
  'material_files',
  'material_events',
  'material_jahrgaenge',
  'material_file_tags',
  'materials',
]);

// Alle Tabellen, auf die die Indexdatei zugreift — aus der Datei selbst
// gelesen, damit ein neuer Index hier nicht stillschweigend durchfaellt.
const alleTabellen = Array.from(
  new Set([...INDEX_SQL.matchAll(/\bON\s+([a-z_]+)\s*\(/g)].map(m => m[1]))
);

// Minimal-Schema: jede Tabelle bekommt nur die Spalten, die die Indexdatei
// tatsaechlich anfasst. Die Typen sind hier egal, es wird nichts eingefuegt.
function minimalSchema() {
  const spalten = new Map();
  for (const treffer of INDEX_SQL.matchAll(/\bON\s+([a-z_]+)\s*\(([^)]*)\)/g)) {
    const tabelle = treffer[1];
    if (ERST_SPAETER.has(tabelle)) continue;
    if (!spalten.has(tabelle)) spalten.set(tabelle, new Set());
    for (const roh of treffer[2].split(',')) {
      // "created_at DESC" -> "created_at"
      const name = roh.trim().split(/\s+/)[0];
      if (name) spalten.get(tabelle).add(name);
    }
  }
  const stmts = [];
  for (const [tabelle, felder] of spalten) {
    const defs = Array.from(felder).map(f => `"${f}" bigint`);
    stmts.push(`CREATE TABLE "${tabelle}" (id bigserial PRIMARY KEY, ${defs.join(', ')})`);
  }
  return stmts;
}

async function frischeDbAufbauen() {
  const admin = new Pool({ connectionString: ADMIN_URL });
  await admin.query(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
  await admin.query(`CREATE DATABASE "${DB_NAME}"`);
  await admin.end();

  const url = ADMIN_URL.replace(/\/[^/]+$/, `/${DB_NAME}`);
  const pool = new Pool({ connectionString: url });
  for (const stmt of minimalSchema()) await pool.query(stmt);
  return pool;
}

async function dbWegraeumen(pool) {
  if (pool) await pool.end();
  const admin = new Pool({ connectionString: ADMIN_URL });
  await admin.query(`
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity
    WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid()
  `);
  await admin.query(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
  await admin.end();
}

describe('Migration 064: Indizes laufen auch auf einer frischen Datenbank durch', () => {
  let pool;

  beforeAll(async () => {
    pool = await frischeDbAufbauen();
  }, 60000);

  afterAll(async () => {
    await dbWegraeumen(pool);
  }, 60000);

  it('die acht spaeter angelegten Tabellen fehlen im Aufbau (Voraussetzung des Tests)', async () => {
    const { rows } = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)`,
      [Array.from(ERST_SPAETER)]
    );
    expect(rows).toHaveLength(0);
    // Und die uebrigen sind da, sonst misst der Test etwas anderes.
    const uebrige = alleTabellen.filter(t => !ERST_SPAETER.has(t));
    const { rows: da } = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)`,
      [uebrige]
    );
    expect(da).toHaveLength(uebrige.length);
  });

  it('die Indexdatei laeuft fehlerfrei durch', async () => {
    // Ein einziger query()-Aufruf = eine implizite Transaktion, genau wie in
    // database.js runMigrations. Faellt ein Statement, ist alles weg.
    await expect(pool.query(INDEX_SQL)).resolves.toBeDefined();
  });

  it('idx_activity_categories_activity_id existiert — die Transaktion ist nicht abgebrochen', async () => {
    // Das vorletzte Statement der Datei, NACH der frueheren Bruchstelle. Seine
    // Existenz beweist, dass die Datei komplett durchlief.
    const { rows } = await pool.query(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = ANY($1)
       ORDER BY indexname`,
      [['idx_activity_categories_activity_id', 'idx_activity_categories_category_id']]
    );
    expect(rows.map(r => r.indexname)).toEqual([
      'idx_activity_categories_activity_id',
      'idx_activity_categories_category_id',
    ]);
  });

  it('die Indizes der fehlenden Tabellen werden uebersprungen, nicht erzwungen', async () => {
    const { rows } = await pool.query(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND indexname LIKE 'idx_material%'`
    );
    expect(rows).toHaveLength(0);
  });

  it('die Indizes der vorhandenen Tabellen sind angelegt (der erlaubte Fall)', async () => {
    const { rows } = await pool.query(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND indexname = ANY($1)
       ORDER BY indexname`,
      [['idx_user_jahrgang_assignments_user_id', 'idx_categories_organization_id']]
    );
    expect(rows.map(r => r.indexname)).toEqual([
      'idx_categories_organization_id',
      'idx_user_jahrgang_assignments_user_id',
    ]);
  });
});
