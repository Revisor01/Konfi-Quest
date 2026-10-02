// backend/tests/schema/migrationenIdempotent.test.js
//
// Jede Migration laesst sich ein zweites Mal ausfuehren -- ohne Fehler und
// ohne das Schema zu veraendern (Audit Datenbank BF-08, 29.09.2026).
//
// Im Regelbetrieb fuehrt der Migrationslauf eine vermerkte Datei nie erneut
// aus (utils/migrationslauf.js vergleicht nur den Namen in
// schema_migrations). Wiederholt wird eine Migration trotzdem: wenn jemand
// schema_migrations von Hand bereinigt, wenn eine Datenbank aus einem Dump
// ohne passenden Migrationsstand entsteht (so lief der E2E-Stack bis
// 29.09.2026, Tests BF-03) oder wenn eine Migration bewusst noch einmal
// laufen soll. Fuenf Dateien, die sich selbst idempotent nannten,
// scheiterten dabei: 064_add_missing_fks und 064_add_missing_indexes (Spalte
// konfi_id, von 077 umbenannt), 128 und 136 ("cannot drop columns from
// view" nach 154), 132 (liest die Spalte, die sie selbst entfernt). Diese
// Dateien stehen seit dem 02.10.2026 nur noch im Schema-Dump (Stand 173);
// backend/migrations/ haelt die Migrationen danach.
//
// Der Test baut den Deploy-Weg auf, fuehrt danach jede Datei aus
// backend/migrations/ noch einmal aus -- jede in einer eigenen Transaktion
// wie der Migrationslauf -- und verlangt: kein Fehler, gleicher
// Fingerabdruck.
const fs = require('fs');
const path = require('path');
const { schemaFingerabdruck, vergleiche } = require('../../scripts/schemaVergleich');
const {
  MIGRATIONS_DIR, dbAnlegen, dbWegraeumen, migrationsDateien, produktionAufbauen,
} = require('../helpers/schemaAufbau');

const DB = 'konfi_test_idempotenz';

describe('Migrationen: ein zweiter Lauf der ganzen Kette', () => {
  let pool;
  let vorher;
  const fehler = [];
  const ausgefuehrt = [];

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool);
    vorher = await schemaFingerabdruck(pool);

    const client = await pool.connect();
    try {
      for (const datei of migrationsDateien()) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, datei), 'utf8');
        try {
          await client.query('BEGIN');
          await client.query(sql);
          await client.query('COMMIT');
          ausgefuehrt.push(datei);
        } catch (err) {
          await client.query('ROLLBACK');
          fehler.push(`${datei}: ${err.message}`);
        }
      }
    } finally {
      client.release();
    }
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('jede Datei laeuft ein zweites Mal fehlerfrei durch', () => {
    expect(fehler).toEqual([]);
  });

  it('das Schema ist danach Objekt fuer Objekt dasselbe', async () => {
    expect(vergleiche(vorher, await schemaFingerabdruck(pool))).toEqual({});
  });

  it('es wurden wirklich alle Dateien ausgefuehrt', () => {
    // Schutz gegen einen leeren Lauf: Ohne Dateien waere "keine Fehler" wertlos.
    expect(migrationsDateien().length).toBeGreaterThan(0);
    expect(ausgefuehrt).toEqual(migrationsDateien());
  });
});
