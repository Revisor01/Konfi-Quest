// MIGRATION 176: In konfi_profiles.password_plain kann kein Klartext mehr
// landen (Audit Datenbank BF-06 / Sicherheit BF-06, 29.09.2026).
//
// Die Spalte stammt aus der SQLite-Zeit, als Konfi-Passwoerter im Klartext
// gespeichert und der Leitung angezeigt wurden. Migration 165 hat die Werte
// geleert (Produktion vor dem Deploy: 0 von 130 Zeilen mit Wert). Uebrig war:
//   - die Spalte selbst -- jede kuenftige Stelle, die wieder hineinschreibt,
//     haette ein Klartext-Passwort eines Kindes in jeder Sicherung;
//   - eine Schreibstelle (regenerate-password setzte sie auf NULL).
//
// Jetzt: keine Code-Stelle nennt die Spalte mehr, und ein CHECK laesst nur
// NULL zu. DROP COLUMN folgt erst, wenn keine Server-Fassung mehr laeuft, die
// sie noch anfasst: Beim rollenden Deploy und im Test-Backend (eigenes Image)
// laeuft die bisherige Fassung weiter und schreibt dort NULL -- ohne Spalte
// bekaeme die Leitung beim Erzeugen eines Einmalpassworts einen Fehler. Das
// NULL laesst der CHECK zu.
const fs = require('fs');
const path = require('path');
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');
// Fuer die Typen der Ergebnisse (bigint als Zahl), wie in jeder Suite.
require('../helpers/db');

const MIGRATION = '176_kein_klartext_passwort.sql';
const DB = 'konfi_test_mig176';

describe('Migration 176 auf dem Stand, auf den sie beim Deploy trifft', () => {
  let pool;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    await pool.query(`INSERT INTO organizations (id, name, slug) VALUES (1, 'A', 'a')`);
    await pool.query(`INSERT INTO roles (id, name, display_name, organization_id) VALUES (1, 'konfi', 'Konfi', 1)`);
    await pool.query(`INSERT INTO users (id, username, display_name, password_hash, role_id, organization_id)
                      VALUES (1, 'k1', 'K 1', 'x', 1, 1), (2, 'k2', 'K 2', 'x', 1, 1)`);
    await pool.query(`INSERT INTO konfi_profiles (user_id, organization_id, password_plain, gottesdienst_points)
                      VALUES (1, 1, 'Psalm23,1', 4), (2, 1, NULL, 2)`);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('Ausgangslage: ein Klartext laesst sich schreiben', async () => {
    const { rows: [{ password_plain }] } = await pool.query(
      'SELECT password_plain FROM konfi_profiles WHERE user_id = 1'
    );
    expect(password_plain).toBe('Psalm23,1');
  });

  it('leert vorhandene Werte und laesst den Rest stehen', async () => {
    await pool.query(migrationLesen(MIGRATION));
    const { rows } = await pool.query(
      'SELECT user_id, password_plain, gottesdienst_points FROM konfi_profiles ORDER BY user_id'
    );
    expect(rows).toEqual([
      { user_id: 1, password_plain: null, gottesdienst_points: 4 },
      { user_id: 2, password_plain: null, gottesdienst_points: 2 },
    ]);
  });

  it('der verbotene Fall: ein Klartext wird abgelehnt', async () => {
    await expect(pool.query(
      "UPDATE konfi_profiles SET password_plain = 'Johannes3,16' WHERE user_id = 1"
    )).rejects.toThrow(/violates check constraint "konfi_profiles_password_plain_leer"/);
    await expect(pool.query(
      "INSERT INTO konfi_profiles (user_id, organization_id, password_plain) VALUES (2, 1, 'x')"
    )).rejects.toThrow();
  });

  it('der erlaubte Fall: NULL setzen geht (bisherige Server-Fassung im Deploy)', async () => {
    // Genau die Anweisung, die regenerate-password bis zum 29.09.2026 ausfuehrte.
    const { rowCount } = await pool.query(
      'UPDATE konfi_profiles SET password_plain = NULL WHERE user_id = $1', [1]
    );
    expect(rowCount).toBe(1);
  });

  it('ein zweiter Lauf scheitert nicht und legt keinen zweiten CHECK an', async () => {
    await pool.query(migrationLesen(MIGRATION));
    const { rows } = await pool.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'konfi_profiles'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%password_plain%'`);
    expect(rows.map((r) => r.conname)).toEqual(['konfi_profiles_password_plain_leer']);
  });
});

describe('Keine Code-Stelle fasst password_plain mehr an', () => {
  // Voraussetzung fuer das spaetere DROP COLUMN: Liest oder schreibt keine
  // Stelle die Spalte, bricht ihr Wegfall nichts. Migrationen und Tests
  // duerfen sie nennen.
  const BACKEND = path.join(__dirname, '..', '..');
  const ORDNER = ['routes', 'services', 'utils', 'middleware', 'scripts'];
  const EINZELN = ['server.js', 'createApp.js', 'database.js'];

  const dateien = (ordner) => fs.readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
    const voll = path.join(ordner, e.name);
    if (e.isDirectory()) return dateien(voll);
    return e.name.endsWith('.js') ? [voll] : [];
  });

  it('weder in Routen, Diensten, Hilfen noch in Skripten', () => {
    const alle = [
      ...ORDNER.flatMap((o) => dateien(path.join(BACKEND, o))),
      ...EINZELN.map((f) => path.join(BACKEND, f)),
    ];
    expect(alle.length).toBeGreaterThan(50);
    const treffer = alle.filter((f) => fs.readFileSync(f, 'utf8').includes('password_plain'))
      .map((f) => path.relative(BACKEND, f));
    expect(treffer).toEqual([]);
  });
});

// Im gemeinsamen Test-Schema ist die Spalte seit Migration 187 (01.10.2026)
// samt CHECK weg; das prueft migration187PasswordPlainEntfernt.test.js. Der
// CHECK selbst ist oben auf dem Stand vor 176 geprueft.
