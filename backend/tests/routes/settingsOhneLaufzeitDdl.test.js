// routes/settings.js ohne Laufzeit-DDL (Nebenbefund der Pakete, 29.09.2026;
// Paket I2).
//
// Beim Laden des Routers lief `ensureOrgColumn`: eine Abfrage auf
// information_schema und -- falls settings.organization_id fehlte -- ALTER
// TABLE, UPDATE, DROP CONSTRAINT settings_pkey und ein neuer UNIQUE. Das ist
// toter Code, seit die Spalte auf beiden Wegen entsteht, auf denen ein Schema
// entsteht:
//
//   - neue Instanz: init-scripts/01-create-schema.sql legt settings mit
//     organization_id an (schon vor jedem Migrationslauf);
//   - Bestand: Migration 064 macht genau dasselbe idempotent, Migration 174
//     setzt NOT NULL und den Primaerschluessel (organization_id, key).
//
// Toter Code, der im Ernstfall settings_pkey (Migration 174) wieder abreissen
// wuerde -- und bei jedem Start eine Abfrage ohne Nutzen. Entfernt.
const { getTestPool, closePool } = require('../helpers/db');
const { dbAnlegen, dbWegraeumen, nurInitScripts } = require('../helpers/schemaAufbau');
const settingsRouten = require('../../routes/settings');

describe('Einstellungen: kein Laufzeit-DDL beim Laden', () => {
  afterAll(async () => { await closePool(); });

  it('der Router stellt beim Laden keine einzige Abfrage', () => {
    const abfragen = [];
    const db = {
      query: (text) => { abfragen.push(String(text).trim().split('\n')[0]); return Promise.resolve({ rows: [] }); },
      getClient: () => { throw new Error('nicht erwartet'); },
    };
    const durch = (req, res, next) => next();

    settingsRouten(db, durch, { requireOrgAdmin: durch });

    expect(abfragen).toEqual([]);
  });

  it('Bestand (Dump + Migrationen, wie die Test-DB): Spalte NOT NULL, Primärschlüssel (organization_id, key)', async () => {
    const db = getTestPool();
    const { rows: [spalte] } = await db.query(
      `SELECT is_nullable FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'organization_id'`
    );
    expect(spalte).toEqual({ is_nullable: 'NO' });
    const { rows: [pk] } = await db.query(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid = 'public.settings'::regclass AND contype = 'p'`
    );
    expect(pk).toEqual({ def: 'PRIMARY KEY (organization_id, key)' });
  });

  describe('neue Instanz', () => {
    const DB = 'konfi_test_settings_init';
    let pool;
    beforeAll(async () => {
      pool = await dbAnlegen(DB);
      await nurInitScripts(pool);
    }, 120000);
    afterAll(async () => { await dbWegraeumen(pool, DB); }, 60000);

    it('die init-scripts legen settings.organization_id schon vor jedem Migrationslauf an', async () => {
      const { rows } = await pool.query(
        `SELECT data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'settings' AND column_name = 'organization_id'`
      );
      expect(rows).toEqual([{ data_type: 'integer' }]);
    });
  });
});
