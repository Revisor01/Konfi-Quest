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
// Seit 08.10.2026 steht 175 im Schema-Dump (tests/schema/prod-schema.sql),
// die Datei ist aus backend/migrations/ entfernt; der Test der Migration auf
// dem Stand davor liegt in der Git-Historie. Geprueft wird hier, dass der
// Dump ohne die acht Zwillinge und mit ihren Gegenstuecken kommt.
//
// Der Waechter unten findet JEDEN exakten Doppelgaenger, auch kuenftige.
const { getTestPool, closePool } = require('../helpers/db');

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

describe('Kein exakt doppelter Index im Test-Schema (Deploy-Weg)', () => {
  let db;
  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  it('die acht Zwillinge fehlen, ihre Gegenstuecke stehen -- eindeutig, wo sie es waren', async () => {
    expect(await vorhanden(db, WEG)).toEqual([]);
    expect(await vorhanden(db, BLEIBT)).toEqual([...BLEIBT].sort());
    const { rows } = await db.query(
      `SELECT c.relname AS name, i.indisunique AS eindeutig FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = ANY($1) ORDER BY 1`,
      [['idx_25067_sqlite_autoindex_password_resets_1', 'idx_25109_sqlite_autoindex_konfi_profiles_1',
        'uq_activity_categories_activity_category']]
    );
    expect(rows).toEqual([
      { name: 'idx_25067_sqlite_autoindex_password_resets_1', eindeutig: true },
      { name: 'idx_25109_sqlite_autoindex_konfi_profiles_1', eindeutig: true },
      { name: 'uq_activity_categories_activity_category', eindeutig: true },
    ]);
  });

  it('keine zwei Indizes mit derselben Definition auf derselben Tabelle', async () => {
    // Kommt kuenftig ein Index doppelt dazu, nennt der Fehler das Paar.
    const { rows } = await db.query(DOPPELTE_SQL);
    expect(rows.map((r) => r.paar)).toEqual([]);
  });
});
