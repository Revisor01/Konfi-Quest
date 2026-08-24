// backend/tests/globalSetup.js — Test-DB erstellen, Schema + Migrationen ausfuehren
// Gibt Teardown-Funktion zurück (Vitest-Pattern)
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const TEST_DB_NAME = 'konfi_test';
const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';

module.exports = async function globalSetup() {
  // 1. Test-DB droppen falls vorhanden, neu erstellen
  const adminPool = new Pool({ connectionString: ADMIN_URL });
  await adminPool.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
  await adminPool.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  await adminPool.end();

  // 2. Auf Test-DB verbinden
  const testUrl = ADMIN_URL.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`);
  const testPool = new Pool({ connectionString: testUrl });

  // 3. Schema aus dem Produktions-Dump laden.
  //
  //    Frueher entstand das Test-Schema aus vier Schichten: repo-root
  //    init-script, ein ~250-zeiliger handgeschriebener ALTER/CREATE-Block hier,
  //    weitere Einzel-Statements und dann die Migrationen. Jede Schicht
  //    verschluckte ihre Fehler. Ergebnis war ein Schema, das der Produktion
  //    nur ungefaehr entsprach: `daily_verses` fehlte komplett,
  //    `activities.category` ebenso, dazu ~200 Spalten mit abweichendem Typ
  //    (Prod ist eine SQLite-Migrationshinterlassenschaft: bigint/text/uuid).
  //    Fehler liefen dadurch still ins Leere — der Tageslosungs-Cache und die
  //    gesamte Wrapped-Snapshot-Generierung waren faktisch ungetestet, obwohl
  //    die Suite gruen war (Audit 22.08.2026).
  //
  //    Warum ein Dump und nicht die Migrationen? Das Repo KANN Produktion
  //    nicht reproduzieren: Die Kette beginnt erst bei 064, und für mehrere
  //    Objekte (daily_verses, activities.category, konfi_profiles.password_plain)
  //    gibt es nirgends ein DDL. Wer aus den Migrationen baut, testet ein
  //    Schema, das es so nie gab.
  //
  //    Aktualisieren: bash backend/tests/schema/refresh-schema.sh
  const schemaDatei = path.join(__dirname, 'schema', 'prod-schema.sql');
  if (!fs.existsSync(schemaDatei)) {
    throw new Error(
      `[globalSetup] Schema-Datei fehlt: ${schemaDatei}\n` +
      'Mit "bash backend/tests/schema/refresh-schema.sh" aus Produktion holen.'
    );
  }
  await testPool.query(fs.readFileSync(schemaDatei, 'utf8'));

  //    Absicherung: pg_dump schreibt normalerweise
  //    `set_config('search_path', '', false)` in den Kopf und stellt den Pfad
  //    danach nicht wieder her — im Dump ist jeder Bezeichner voll qualifiziert
  //    (public.users), spaetere Statements sind es nicht. refresh-schema.sh
  //    filtert die Zeile bereits heraus; falls doch einmal ein ungefilterter
  //    Dump eingespielt wird, faengt das hier den Fall ab. Am der DATENBANK
  //    gesetzt, damit auch die spaeteren Test-Verbindungen den Pfad haben.
  await testPool.query(`ALTER DATABASE "${TEST_DB_NAME}" SET search_path TO public`);
  await testPool.query('SET search_path TO public');

  // 4. Migrationsstand aus Produktion uebernehmen.
  //    Der Dump ist bereits das Ergebnis dieser Migrationen — sie duerfen
  //    nicht erneut laufen. Danach greift derselbe Weg wie beim Deploy: nur
  //    was noch NICHT angewandt ist, kommt oben drauf.
  await testPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const standDatei = path.join(__dirname, 'schema', 'prod-migrations.txt');
  if (fs.existsSync(standDatei)) {
    const bereitsAngewandt = fs.readFileSync(standDatei, 'utf8')
      .split('\n').map(z => z.trim()).filter(Boolean);
    for (const name of bereitsAngewandt) {
      await testPool.query(
        'INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING',
        [name]
      );
    }
  }

  // 5. Offene Migrationen anwenden — identisch zu database.js runMigrations.
  //
  //    Fehler brechen hier BEWUSST ab. Frueher wurde eine gescheiterte
  //    Migration nur geloggt und trotzdem als "applied" markiert; Schema-Drift
  //    blieb dadurch dauerhaft unsichtbar und die Suite gruen. Wer eine
  //    Migration kaputt macht, soll das sofort sehen.
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  const { rows: applied } = await testPool.query('SELECT name FROM schema_migrations');
  const appliedSet = new Set(applied.map(r => r.name));
  let migCount = 0;

  for (const file of migrationFiles) {
    if (appliedSet.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await testPool.query(sql);
      await testPool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      migCount++;
    } catch (err) {
      await testPool.end();
      throw new Error(
        `[globalSetup] Migration ${file} fehlgeschlagen: ${err.message}\n` +
        'Die Migration laeuft so auch beim Deploy nicht durch. Entweder sie ist ' +
        'fehlerhaft, oder sie setzt einen Schema-Stand voraus, den ' +
        'backend/tests/schema/prod-schema.sql noch nicht hat (dann refresh-schema.sh).'
      );
    }
  }

  await testPool.end();
  console.log(`[globalSetup] Test-DB "${TEST_DB_NAME}" erstellt (${migCount} neue Migrationen)`);

  // Teardown-Funktion zurueckgeben (Vitest-Pattern)
  return async function globalTeardown() {
    const adminPool = new Pool({ connectionString: ADMIN_URL });
    // Aktive Connections terminieren
    await adminPool.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${TEST_DB_NAME}' AND pid <> pg_backend_pid()
    `);
    await adminPool.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
    await adminPool.end();
    console.log(`[globalTeardown] Test-DB "${TEST_DB_NAME}" gedroppt`);
  };
};
