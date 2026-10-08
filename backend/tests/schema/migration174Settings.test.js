// MIGRATION 174: settings bekommt einen Primaerschluessel (Audit Datenbank
// BF-10, 29.09.2026).
//
// settings hatte keinen Primaerschluessel, nur zwei gleiche UNIQUE auf
// (organization_id, key) bei nullbarer organization_id. Ein UNIQUE behandelt
// NULL als verschieden: Zeilen ohne Gemeinde konnten sich beliebig oft
// wiederholen. Gelesen wird settings nur je Gemeinde (organization_id = $1 in
// settings.js, konfi.js, teamer.js, losungService.js), geschrieben ebenso;
// users.organization_id ist NOT NULL. Zeilen ohne Gemeinde sieht also keine
// Stelle -- die Migration entfernt sie und fuehrt (organization_id, key) als
// Primaerschluessel.
//
// Seit 08.10.2026 steht 174 im Schema-Dump (tests/schema/prod-schema.sql),
// die Datei ist aus backend/migrations/ entfernt; der Test der Migration auf
// dem Stand davor liegt in der Git-Historie. Geprueft wird hier, dass der
// Dump den Primaerschluessel traegt.
const { getTestPool, closePool } = require('../helpers/db');

describe('Migration 174 im Test-Schema (Deploy-Weg)', () => {
  let db;
  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  it('settings hat den Primaerschluessel', async () => {
    const { rows } = await db.query(
      "SELECT conname FROM pg_constraint WHERE conrelid = 'settings'::regclass AND contype = 'p'"
    );
    expect(rows.map((r) => r.conname)).toEqual(['settings_pkey']);
  });
});
