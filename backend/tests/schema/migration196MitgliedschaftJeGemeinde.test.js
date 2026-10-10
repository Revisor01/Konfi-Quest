// MIGRATION 196: Kontofelder je Gemeinde (Simon, 08.10.2026;
// docs/planung/mehrfach-konten.md, Entscheidungen 5 und 6).
//
// user_organizations bekommt role_title, teamer_since und is_active.
//
// Seit 10.10.2026 steht 196 im Schema-Dump (tests/schema/prod-schema.sql),
// die Datei ist aus backend/migrations/ entfernt; der Test der Migration auf
// dem Stand davor (Uebernahme der Werte vom Konto, Stamm-Zeilen auf den
// Stand am Konto, zweiter Lauf) liegt in der Git-Historie (zuletzt Commit
// 3b935178). Geprueft wird hier, dass das gemeinsame Test-Schema die drei
// Spalten traegt.
const { getTestPool, closePool } = require('../helpers/db');

describe('Migration 196 im Test-Schema (Deploy-Weg)', () => {
  let db;
  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  it('user_organizations: is_active boolean NOT NULL Vorgabe true, role_title und teamer_since frei', async () => {
    const { rows } = await db.query(
      `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'user_organizations'
          AND column_name IN ('role_title', 'teamer_since', 'is_active')
        ORDER BY column_name`);
    expect(rows).toEqual([
      { column_name: 'is_active', data_type: 'boolean', is_nullable: 'NO', column_default: 'true' },
      { column_name: 'role_title', data_type: 'text', is_nullable: 'YES', column_default: null },
      { column_name: 'teamer_since', data_type: 'date', is_nullable: 'YES', column_default: null },
    ]);
  });
});
