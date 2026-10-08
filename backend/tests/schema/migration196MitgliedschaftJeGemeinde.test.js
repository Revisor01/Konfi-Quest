// MIGRATION 196: Kontofelder je Gemeinde (Simon, 08.10.2026;
// docs/planung/mehrfach-konten.md, Entscheidungen 5 und 6).
//
// Geprueft auf dem Stand, auf den die Migration beim Deploy trifft (nach
// 195): user_organizations bekommt role_title, teamer_since und is_active;
// weitere Gemeinden uebernehmen einmal die Werte vom Konto; Stamm-Zeilen
// (Altbestand aus Migration 101) werden auf den Stand am Konto gesetzt --
// auch eine abweichende Rolle. Ein zweiter Lauf aendert nichts, auch keine
// inzwischen nur in einer Gemeinde gesetzte Sperre.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');

const MIGRATION = '196_mitgliedschaft_je_gemeinde.sql';
const DB = 'konfi_test_mig196';

describe('Migration 196 auf dem Stand, auf den sie beim Deploy trifft', () => {
  let pool;
  let orgA;
  let orgB;
  let rollen;
  let person;
  let gesperrt;

  const spalten = async () => (await pool.query(
    `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user_organizations'
        AND column_name IN ('role_title', 'teamer_since', 'is_active')
      ORDER BY column_name`)).rows;
  const zeilen = async (userId) => (await pool.query(
    `SELECT organization_id, role_id, role_title, teamer_since::text AS teamer_since, is_active
       FROM user_organizations WHERE user_id = $1 ORDER BY organization_id`, [userId])).rows
    .map((z) => ({ ...z, organization_id: Number(z.organization_id), role_id: Number(z.role_id) }));

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    ({ rows: [{ id: orgA }] } = await pool.query(
      "INSERT INTO organizations (name, slug, display_name) VALUES ('a', 'a', 'A') RETURNING id"));
    ({ rows: [{ id: orgB }] } = await pool.query(
      "INSERT INTO organizations (name, slug, display_name) VALUES ('b', 'b', 'B') RETURNING id"));
    rollen = {};
    for (const [org, name] of [[orgA, 'org_admin'], [orgA, 'teamer'], [orgB, 'teamer']]) {
      const { rows: [r] } = await pool.query(
        'INSERT INTO roles (organization_id, name, display_name) VALUES ($1, $2, $2) RETURNING id', [org, name]);
      rollen[`${name}_${org}`] = Number(r.id);
    }
    // Zuhause in A Org-Leitung (Konto), Stamm-Zeile veraltet als Teamer:in,
    // in B Teamer:in.
    ({ rows: [{ id: person }] } = await pool.query(
      `INSERT INTO users (organization_id, role_id, username, display_name, role_title, teamer_since)
       VALUES ($1, $2, 'mehrfach', 'Mehrfach', 'Pastorin', '2019-08-01') RETURNING id`,
      [orgA, rollen[`org_admin_${orgA}`]]));
    await pool.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3), ($1, $4, $5)`,
      [person, orgA, rollen[`teamer_${orgA}`], orgB, rollen[`teamer_${orgB}`]]);
    // Ein gesperrtes Konto mit weiterer Gemeinde.
    ({ rows: [{ id: gesperrt }] } = await pool.query(
      `INSERT INTO users (organization_id, role_id, username, display_name, is_active)
       VALUES ($1, $2, 'gesperrt', 'Gesperrt', false) RETURNING id`,
      [orgA, rollen[`teamer_${orgA}`]]));
    await pool.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [gesperrt, orgB, rollen[`teamer_${orgB}`]]);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('Ausgangslage: keine Spalten je Gemeinde', async () => {
    expect(await spalten()).toEqual([]);
  });

  it('legt die Spalten an: is_active boolean NOT NULL Vorgabe true, die anderen frei', async () => {
    await pool.query(migrationLesen(MIGRATION));
    expect(await spalten()).toEqual([
      { column_name: 'is_active', data_type: 'boolean', is_nullable: 'NO', column_default: 'true' },
      { column_name: 'role_title', data_type: 'text', is_nullable: 'YES', column_default: null },
      { column_name: 'teamer_since', data_type: 'date', is_nullable: 'YES', column_default: null },
    ]);
  });

  it('Stamm-Zeile auf den Stand am Konto (auch die Rolle), weitere Gemeinde mit den Werten vom Konto', async () => {
    expect(await zeilen(person)).toEqual([
      { organization_id: Number(orgA), role_id: rollen[`org_admin_${orgA}`], role_title: 'Pastorin', teamer_since: '2019-08-01', is_active: true },
      { organization_id: Number(orgB), role_id: rollen[`teamer_${orgB}`], role_title: 'Pastorin', teamer_since: '2019-08-01', is_active: true },
    ]);
  });

  it('ein gesperrtes Konto bleibt auch in der weiteren Gemeinde gesperrt', async () => {
    expect((await zeilen(gesperrt)).map((z) => z.is_active)).toEqual([false]);
  });

  it('das Konto selbst ist unveraendert', async () => {
    const { rows: [u] } = await pool.query(
      'SELECT role_id, role_title, teamer_since::text AS t, is_active FROM users WHERE id = $1', [person]);
    expect(u).toEqual({ role_id: String(rollen[`org_admin_${orgA}`]), role_title: 'Pastorin', t: '2019-08-01', is_active: true });
  });

  it('zweiter Lauf: aendert nichts, auch keine Sperre nur in einer Gemeinde', async () => {
    await pool.query('UPDATE user_organizations SET is_active = false, role_title = NULL WHERE user_id = $1', [person]);
    const vorher = await zeilen(person);
    await pool.query(migrationLesen(MIGRATION));
    expect(await zeilen(person)).toEqual(vorher);
  });
});
