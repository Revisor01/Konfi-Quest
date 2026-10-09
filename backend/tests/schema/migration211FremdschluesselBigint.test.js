// MIGRATION 211: Fremdschluessel und die Schluessel, auf die sie zeigen,
// werden bigint (10.10.2026, Datenbank BF-12, Rest).
//
// Geprueft auf dem Stand, auf den 211 beim Deploy trifft (eigene Datenbank
// bis vor 211): Ausgangslage 75 gemischte Paare wie in der Produktion,
// danach keines; jeder Fremdschluessel steht noch (gleiche Anzahl, gleiche
// Definition), Werte und Sequenzen bleiben, die Sequenzen laufen ueber
// 2^31 hinaus, ein zweiter Lauf aendert nichts. Dazu der Waechter auf dem
// gemeinsamen Test-Schema (Deploy-Weg): kein Fremdschluessel mit integer
// auf einer Seite -- auch kein kuenftiger, gleich wie er entstand (der
// Textwaechter in migrationenKonventionen.test.js sieht nur
// `INTEGER REFERENCES`, nicht `ADD CONSTRAINT ... FOREIGN KEY`).
//
// Dass die Antworten die Kennungen weiter als Zahl liefern, haelt
// tests/routes/kennungenAlsZahl.test.js fest.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');
const { getTestPool, closePool } = require('../helpers/db');

const MIGRATION = '211_fremdschluessel_bigint.sql';

// Je Fremdschluessel-Paar die Typen beider Seiten.
const GEMISCHT_SQL = `
  SELECT k.conrelid::regclass::text || '.' || a.attname AS spalte,
         format_type(a.atttypid, NULL) AS typ,
         k.confrelid::regclass::text || '.' || r.attname AS ziel,
         format_type(r.atttypid, NULL) AS zieltyp
    FROM pg_constraint k
    CROSS JOIN LATERAL unnest(k.conkey, k.confkey) AS u(ak, rk)
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = u.ak
    JOIN pg_attribute r ON r.attrelid = k.confrelid AND r.attnum = u.rk
   WHERE k.contype = 'f' AND k.connamespace = 'public'::regnamespace
     AND (a.atttypid <> 'int8'::regtype OR r.atttypid <> 'int8'::regtype)
   ORDER BY 1`;
const FREMDSCHLUESSEL_SQL = `
  SELECT conrelid::regclass::text || '.' || conname AS name, pg_get_constraintdef(oid) AS def
    FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace ORDER BY 1`;
const SEQUENZEN_SQL = `
  SELECT seqrelid::regclass::text AS name, format_type(seqtypid, NULL) AS typ, seqmax::text AS max
    FROM pg_sequence
   WHERE seqrelid::regclass::text IN ('challenges_id_seq', 'levels_id_seq', 'konfsprueche_id_seq',
         'materials_id_seq', 'certificate_types_id_seq', 'invite_codes_id_seq', 'wrapped_ausgaben_id_seq')
   ORDER BY 1`;
const CHALLENGE_SPALTEN = 'organization_id, title, description, badge_name, starts_at, ends_at, created_by';
const CHALLENGE_WERTE = (titel) => `1, '${titel}', 'x', 'x', now(), now() + interval '1 day', 7`;
const SPALTENTYP_SQL = `
  SELECT data_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`;

describe('Migration 211 auf dem Stand, auf den sie beim Deploy trifft', () => {
  const DB = 'konfi_test_mig211';
  let pool;
  let fksVorher;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    fksVorher = (await pool.query(FREMDSCHLUESSEL_SQL)).rows;
    // Ein Bestand ueber mehrere der umgestellten Spalten.
    await pool.query("INSERT INTO organizations (id, name, slug) VALUES (1, 'A', 'a')");
    await pool.query("INSERT INTO roles (id, name, display_name, organization_id) VALUES (901, 'konfi', 'Konfi', 1)");
    await pool.query(`INSERT INTO users (id, username, display_name, password_hash, role_id, organization_id)
                      VALUES (7, 'k7', 'K 7', 'x', 901, 1)`);
    await pool.query(`INSERT INTO challenges (id, ${CHALLENGE_SPALTEN}) VALUES (41, ${CHALLENGE_WERTE('Probe')})`);
    await pool.query("SELECT setval('challenges_id_seq', 41)");
    await pool.query(`INSERT INTO challenge_read_status (challenge_id, user_id, user_type) VALUES (41, 7, 'konfi')`);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('Ausgangslage: 75 Paare mit integer, die sieben Sequenzen sind integer', async () => {
    expect((await pool.query(GEMISCHT_SQL)).rows).toHaveLength(75);
    const seq = (await pool.query(SEQUENZEN_SQL)).rows;
    expect(seq.map((s) => s.typ)).toEqual(Array(7).fill('integer'));
    expect(await pool.query(SPALTENTYP_SQL, ['bewahrte_stempel', 'herkunft_challenge_id'])
      .then((r) => r.rows[0].data_type)).toBe('integer');
  });

  it('danach: kein Paar mit integer, jeder Fremdschluessel steht unveraendert', async () => {
    await pool.query(migrationLesen(MIGRATION));
    expect((await pool.query(GEMISCHT_SQL)).rows).toEqual([]);
    expect((await pool.query(FREMDSCHLUESSEL_SQL)).rows).toEqual(fksVorher);
    expect(await pool.query(SPALTENTYP_SQL, ['bewahrte_stempel', 'herkunft_challenge_id'])
      .then((r) => r.rows[0].data_type)).toBe('bigint');
  });

  it('die Werte bleiben, die Sequenz zaehlt weiter und reicht ueber 2^31', async () => {
    const { rows } = await pool.query('SELECT challenge_id::text, user_id::text FROM challenge_read_status ORDER BY challenge_id');
    expect(rows).toEqual([{ challenge_id: '41', user_id: '7' }]);
    const seq = (await pool.query(SEQUENZEN_SQL)).rows;
    expect(seq.map((s) => [s.typ, s.max])).toEqual(Array(7).fill(['bigint', '9223372036854775807']));
    const { rows: [neu] } = await pool.query(
      `INSERT INTO challenges (${CHALLENGE_SPALTEN}) VALUES (${CHALLENGE_WERTE('Danach')}) RETURNING id::text`);
    expect(neu.id).toBe('42');
    await pool.query("SELECT setval('challenges_id_seq', 2147483647)");
    const { rows: [gross] } = await pool.query(
      `INSERT INTO challenges (${CHALLENGE_SPALTEN}) VALUES (${CHALLENGE_WERTE('Gross')}) RETURNING id::text`);
    expect(gross.id).toBe('2147483648');
    const { rowCount } = await pool.query(
      "INSERT INTO challenge_read_status (challenge_id, user_id, user_type) VALUES ($1, 7, 'konfi')", [gross.id]);
    expect(rowCount).toBe(1);
  });

  it('verboten bleibt: ein Fremdschluessel auf eine Challenge, die es nicht gibt -> 23503', async () => {
    await expect(pool.query("INSERT INTO challenge_read_status (challenge_id, user_id, user_type) VALUES (999999, 7, 'konfi')"))
      .rejects.toMatchObject({ code: '23503', constraint: 'challenge_read_status_challenge_id_fkey' });
  });

  it('ein zweiter Lauf scheitert nicht und aendert nichts', async () => {
    await pool.query(migrationLesen(MIGRATION));
    expect((await pool.query(GEMISCHT_SQL)).rows).toEqual([]);
    expect((await pool.query(FREMDSCHLUESSEL_SQL)).rows).toEqual(fksVorher);
  });
});

describe('Kein Fremdschluessel mit integer im Test-Schema (Deploy-Weg)', () => {
  let db;
  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  it('beide Seiten jedes Fremdschluessels sind bigint', async () => {
    // Kommt kuenftig einer dazu, nennt der Fehler Spalte und Ziel.
    expect((await db.query(GEMISCHT_SQL)).rows).toEqual([]);
  });
});
