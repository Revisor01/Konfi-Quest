// MIGRATION 175: exakt doppelte Indizes entfernen (Audit Datenbank BF-09,
// 29.09.2026).
//
// Neun Indizes hatten einen Zwilling mit genau derselben Definition --
// Reste aus der SQLite-Uebernahme (sqlite_autoindex_*) neben den Indizes aus
// 064/097/110/124. Jede Zeile wurde in beide geschrieben, Sicherung und
// Autovacuum arbeiteten doppelt. settings raeumt Migration 174 ab, die
// uebrigen acht diese. Behalten wird jeweils der Index, an dem ein
// Constraint haengt oder der die Eindeutigkeit traegt, sonst der aus der
// Migrationskette benannte.
//
// Der Waechter unten findet JEDEN exakten Doppelgaenger, auch kuenftige.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');
const { getTestPool, closePool } = require('../helpers/db');

const MIGRATION = '175_doppelte_indizes.sql';
const DB = 'konfi_test_mig175';

// Paare mit gleicher Tabelle, Spalten, Ausdruecken, Praedikat, Operator-
// klassen, Sortierfolge und Methode.
const DOPPELTE_SQL = `
  WITH ix AS (
    SELECT i.indexrelid, i.indrelid, c.relname AS name,
           i.indkey::text AS spalten, i.indoption::text AS optionen,
           coalesce(pg_get_expr(i.indexprs, i.indrelid), '') AS ausdr,
           coalesce(pg_get_expr(i.indpred, i.indrelid), '') AS praed,
           i.indclass::text AS opclass, i.indcollation::text AS koll, c.relam
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    WHERE t.relnamespace = 'public'::regnamespace
  )
  SELECT a.name || ' = ' || b.name AS paar
  FROM ix a JOIN ix b
    ON a.indrelid = b.indrelid AND a.indexrelid < b.indexrelid
   AND a.spalten = b.spalten AND a.optionen = b.optionen AND a.ausdr = b.ausdr
   AND a.praed = b.praed AND a.opclass = b.opclass AND a.koll = b.koll AND a.relam = b.relam
  ORDER BY 1`;

// Was wegfaellt und was stattdessen bleibt.
const WEG = [
  'idx_25001_sqlite_autoindex_activity_categories_1',
  'idx_chat_poll_votes_poll',
  'idx_chat_polls_message',
  'idx_daily_verses_date_translation',
  'idx_konfi_profiles_user_id',
  'idx_levels_organization_points',
  'idx_notifications_user',
  'idx_password_resets_token',
];
const BLEIBT = [
  'daily_verses_date_translation_key',
  'idx_25067_sqlite_autoindex_password_resets_1',
  'idx_25109_sqlite_autoindex_konfi_profiles_1',
  'idx_chat_poll_votes_poll_id',
  'idx_chat_polls_message_id',
  'idx_notifications_user_id',
  'levels_organization_id_points_required_key',
  'uq_activity_categories_activity_category',
];

const vorhanden = async (db, namen) => {
  const { rows } = await db.query(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1) ORDER BY indexname",
    [namen]
  );
  return rows.map((r) => r.indexname);
};

describe('Migration 175 auf dem Stand, auf den sie beim Deploy trifft', () => {
  let pool;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('Ausgangslage: acht exakte Doppelgaenger', async () => {
    const { rows } = await pool.query(DOPPELTE_SQL);
    expect(rows).toHaveLength(8);
    expect(await vorhanden(pool, WEG)).toEqual([...WEG].sort());
  });

  it('danach keiner mehr -- und die Gegenstuecke stehen noch', async () => {
    await pool.query(migrationLesen(MIGRATION));
    const { rows } = await pool.query(DOPPELTE_SQL);
    expect(rows).toEqual([]);
    expect(await vorhanden(pool, WEG)).toEqual([]);
    expect(await vorhanden(pool, BLEIBT)).toEqual([...BLEIBT].sort());
  });

  it('die Eindeutigkeit bleibt, wo sie war (verbotener Fall)', async () => {
    const { rows } = await pool.query(
      `SELECT c.relname AS name, i.indisunique AS eindeutig FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = ANY($1) ORDER BY 1`,
      [['idx_25067_sqlite_autoindex_password_resets_1', 'idx_25109_sqlite_autoindex_konfi_profiles_1',
        'uq_activity_categories_activity_category']]
    );
    expect(rows.every((r) => r.eindeutig)).toBe(true);
    expect(rows).toHaveLength(3);
    await expect(pool.query(
      `INSERT INTO daily_verses (date, translation, verse_data) VALUES (CURRENT_DATE, 'X', '{}'),
                                                                       (CURRENT_DATE, 'X', '{}')`
    )).rejects.toThrow(/duplicate key value violates unique constraint "daily_verses_date_translation_key"/);
  });

  it('ein zweiter Lauf scheitert nicht', async () => {
    await expect(pool.query(migrationLesen(MIGRATION))).resolves.toBeDefined();
  });
});

describe('Kein exakt doppelter Index im Test-Schema (Deploy-Weg)', () => {
  let db;
  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  it('keine zwei Indizes mit derselben Definition auf derselben Tabelle', async () => {
    // Kommt kuenftig ein Index doppelt dazu, nennt der Fehler das Paar.
    const { rows } = await db.query(DOPPELTE_SQL);
    expect(rows.map((r) => r.paar)).toEqual([]);
  });
});
