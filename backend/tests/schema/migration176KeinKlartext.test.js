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
//
// Seit 09.10.2026 steht 176 im Schema-Dump (tests/schema/prod-schema.sql),
// die Datei ist aus backend/migrations/ entfernt; der Test der Migration auf
// dem Stand davor liegt in der Git-Historie. Geprueft wird hier, dass der
// Dump den CHECK traegt -- auf dem Stand vor 187, das die Spalte entfernt.
const fs = require('fs');
const path = require('path');
const { dbAnlegen, dbWegraeumen, produktionAufbauen } = require('../helpers/schemaAufbau');
// Fuer die Typen der Ergebnisse (bigint als Zahl), wie in jeder Suite.
require('../helpers/db');

const DB = 'konfi_test_mig176';

describe('Migration 176 im Schema-Dump (Stand vor 187)', () => {
  let pool;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: '187_password_plain_entfernen.sql' });
    await pool.query(`INSERT INTO organizations (id, name, slug) VALUES (1, 'A', 'a')`);
    await pool.query(`INSERT INTO roles (id, name, display_name, organization_id) VALUES (1, 'konfi', 'Konfi', 1)`);
    await pool.query(`INSERT INTO users (id, username, display_name, password_hash, role_id, organization_id)
                      VALUES (1, 'k1', 'K 1', 'x', 1, 1)`);
    await pool.query(`INSERT INTO konfi_profiles (user_id, organization_id, gottesdienst_points)
                      VALUES (1, 1, 4)`);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('der Dump traegt genau einen CHECK auf password_plain', async () => {
    const { rows } = await pool.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'konfi_profiles'::regclass AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%password_plain%'`);
    expect(rows.map((r) => r.conname)).toEqual(['konfi_profiles_password_plain_leer']);
  });

  it('der verbotene Fall: ein Klartext wird abgelehnt', async () => {
    await expect(pool.query(
      "UPDATE konfi_profiles SET password_plain = 'Johannes3,16' WHERE user_id = 1"
    )).rejects.toThrow(/violates check constraint "konfi_profiles_password_plain_leer"/);
  });

  it('der erlaubte Fall: NULL setzen geht (bisherige Server-Fassung im Deploy)', async () => {
    const { rowCount } = await pool.query(
      'UPDATE konfi_profiles SET password_plain = NULL WHERE user_id = $1', [1]
    );
    expect(rowCount).toBe(1);
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
// CHECK selbst ist oben auf dem Stand vor 187 geprueft.
