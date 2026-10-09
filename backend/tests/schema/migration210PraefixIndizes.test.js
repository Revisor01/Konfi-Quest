// MIGRATION 210: Einzelspalten-Indizes entfernen, die ein laengerer Index
// schon traegt (10.10.2026, Datenbank BF-09, Rest).
//
// Geprueft auf dem Stand, auf den 210 beim Deploy trifft (eigene Datenbank
// bis vor 210): die 24 fallen, die vier Ausnahmen (partieller Partner bzw.
// selbst partiell) bleiben, ein zweiter Lauf aendert nichts, und fehlt der
// laengere Partner, bleibt der Index. Dazu der Waechter auf dem gemeinsamen
// Test-Schema (Deploy-Weg): kein Einzelspalten-Index mehr, den ein laengerer
// B-Baum voll abdeckt -- auch kein kuenftiger.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');
const { getTestPool, closePool } = require('../helpers/db');

const MIGRATION = '210_praefix_indizes_entfernen.sql';

const WEG = [
  'idx_activity_categories_activity_id',
  'idx_certificate_types_organization_id',
  'idx_challenges_org',
  'idx_chat_messages_room_id',
  'idx_chat_participants_room_id',
  'idx_chat_poll_votes_poll_id',
  'idx_chat_reactions_message',
  'idx_event_bookings_event_id',
  'idx_event_bookings_user_id',
  'idx_event_categories_event_id',
  'idx_event_jahrgang_assignments_event_id',
  'idx_event_points_konfi_id',
  'idx_konfspruch_uebersetzungen_spruch',
  'idx_material_events_material_id',
  'idx_material_jahrgaenge_material_id',
  'idx_push_tokens_user_id',
  'idx_roles_organization_id',
  'idx_settings_organization_id',
  'idx_user_activities_user_id',
  'idx_user_badges_user_id',
  'idx_user_certificates_user_id',
  'idx_user_jahrgang_assignments_user_id',
  'idx_user_organizations_user',
  'idx_users_organization_id',
];
// Partner nur partiell (die ersten drei) bzw. selbst partiell.
const BLEIBT = [
  'idx_bonus_points_organization_id',
  'idx_events_organization_id',
  'idx_mail_nachrichten_vorgang_ungelesen',
  'idx_notifications_user_id',
];

// Einzelspalten-B-Baum ohne Bedingung und Ausdruck, nicht eindeutig, ohne
// Constraint -- neben einem laengeren, nicht partiellen B-Baum derselben
// Tabelle mit derselben ersten Spalte (Operator-Klasse, Collation,
// Sortierung). Dieselbe Regel wie in der Migration.
const PRAEFIX_REDUNDANT_SQL = `
  SELECT DISTINCT ac.relname AS name
    FROM pg_index a
    JOIN pg_class ac ON ac.oid = a.indexrelid
    JOIN pg_am aam ON aam.oid = ac.relam AND aam.amname = 'btree'
    JOIN pg_index b ON b.indrelid = a.indrelid AND b.indexrelid <> a.indexrelid
    JOIN pg_class bc ON bc.oid = b.indexrelid
    JOIN pg_am bam ON bam.oid = bc.relam AND bam.amname = 'btree'
   WHERE ac.relnamespace = 'public'::regnamespace
     AND a.indnatts = 1 AND a.indkey[0] <> 0
     AND NOT a.indisunique AND NOT a.indisprimary
     AND a.indpred IS NULL AND a.indexprs IS NULL
     AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = a.indexrelid)
     AND b.indisvalid AND b.indnatts > 1
     AND b.indkey[0] = a.indkey[0]
     AND b.indclass[0] = a.indclass[0]
     AND b.indcollation[0] = a.indcollation[0]
     AND b.indoption[0] = a.indoption[0]
     AND b.indpred IS NULL AND b.indexprs IS NULL
   ORDER BY 1`;

const vorhanden = async (pool, namen) => {
  const { rows } = await pool.query(
    "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1) ORDER BY indexname",
    [namen]
  );
  return rows.map((r) => r.indexname);
};
const anzahlIndizes = async (pool) => (await pool.query(
  "SELECT COUNT(*)::int AS n FROM pg_indexes WHERE schemaname = 'public'")).rows[0].n;

describe('Migration 210 auf dem Stand, auf den sie beim Deploy trifft', () => {
  const DB = 'konfi_test_mig210';
  let pool;
  let vorher;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    vorher = await anzahlIndizes(pool);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('Ausgangslage: alle 24 und die vier Ausnahmen stehen, der Waechter findet genau die 24', async () => {
    expect(await vorhanden(pool, WEG)).toEqual(WEG);
    expect(await vorhanden(pool, BLEIBT)).toEqual(BLEIBT);
    expect((await pool.query(PRAEFIX_REDUNDANT_SQL)).rows.map((r) => r.name)).toEqual(WEG);
  });

  it('danach: die 24 fehlen, die vier Ausnahmen stehen, sonst kein Index weniger', async () => {
    await pool.query(migrationLesen(MIGRATION));
    expect(await vorhanden(pool, WEG)).toEqual([]);
    expect(await vorhanden(pool, BLEIBT)).toEqual(BLEIBT);
    expect(await anzahlIndizes(pool)).toBe(vorher - 24);
    expect((await pool.query(PRAEFIX_REDUNDANT_SQL)).rows).toEqual([]);
  });

  it('der Planer nimmt fuer die Suche nach der Spalte den laengeren Index', async () => {
    await pool.query('SET enable_seqscan = off');
    const { rows } = await pool.query('EXPLAIN SELECT * FROM event_bookings WHERE event_id = 1');
    await pool.query('RESET enable_seqscan');
    expect(rows.map((r) => r['QUERY PLAN']).join('\n')).toMatch(/idx_event_bookings_event_status/);
  });

  it('ein zweiter Lauf scheitert nicht und aendert nichts', async () => {
    const davor = await anzahlIndizes(pool);
    await pool.query(migrationLesen(MIGRATION));
    expect(await anzahlIndizes(pool)).toBe(davor);
  });
});

describe('Migration 210, wenn der laengere Partner fehlt', () => {
  const DB = 'konfi_test_mig210_ohne_partner';
  let pool;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('verboten: idx_challenges_org faellt nicht, wenn idx_challenges_org_audience fehlt', async () => {
    await pool.query('DROP INDEX idx_challenges_org_audience');
    await pool.query(migrationLesen(MIGRATION));
    expect(await vorhanden(pool, ['idx_challenges_org', 'idx_challenges_org_audience'])).toEqual(['idx_challenges_org']);
  });

  it('erlaubt: die uebrigen 23 fallen trotzdem', async () => {
    expect(await vorhanden(pool, WEG)).toEqual(['idx_challenges_org']);
  });
});

describe('Kein praefix-redundanter Index im Test-Schema (Deploy-Weg)', () => {
  let db;
  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  it('kein Einzelspalten-Index, den ein laengerer B-Baum voll abdeckt', async () => {
    // Kommt kuenftig einer dazu, nennt der Fehler seinen Namen.
    expect((await db.query(PRAEFIX_REDUNDANT_SQL)).rows.map((r) => r.name)).toEqual([]);
  });
});
