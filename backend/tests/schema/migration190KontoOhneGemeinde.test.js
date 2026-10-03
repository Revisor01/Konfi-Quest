// MIGRATION 190: Konten ohne Gemeinde (Simon, 03.10.2026;
// docs/planung/web-version.md, Entscheidungen 11 bis 15).
//
// users.organization_id wird nullable -- aber nur fuer Super-Admins (CHECK) --,
// dazu eine gemeindefreie Systemrolle super_admin, eindeutig je Name unter
// den Rollen ohne Gemeinde (der UNIQUE (organization_id, name) aus dem Dump
// greift bei NULL nicht). Geprueft auf dem Stand, auf den die Migration beim
// Deploy trifft, dazu ein zweiter Lauf und der Fall, dass es die Rolle schon
// gibt.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');

const MIGRATION = '190_konto_ohne_gemeinde.sql';
const DB = 'konfi_test_mig190';

const SPALTE = `SELECT is_nullable FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'organization_id'`;
const SYSTEMROLLEN = `SELECT id, name, display_name, is_system_role, is_active FROM roles
  WHERE organization_id IS NULL AND name = 'super_admin'`;

describe('Migration 190 auf dem Stand, auf den sie beim Deploy trifft', () => {
  let pool;
  let orgId;
  let orgRolle;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    ({ rows: [{ id: orgId }] } = await pool.query(
      "INSERT INTO organizations (name, slug, display_name) VALUES ('g', 'g', 'G') RETURNING id"));
    ({ rows: [{ id: orgRolle }] } = await pool.query(
      "INSERT INTO roles (organization_id, name, display_name) VALUES ($1, 'org_admin', 'Gemeindeleitung') RETURNING id", [orgId]));
    // Ein Bestandskonto, wie es in Produktion steht: mit Gemeinde, ohne Merkmal.
    await pool.query(
      "INSERT INTO users (organization_id, role_id, username, display_name) VALUES ($1, $2, 'bestand', 'Bestand')", [orgId, orgRolle]);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('Ausgangslage: organization_id ist NOT NULL, es gibt keine Systemrolle super_admin', async () => {
    expect((await pool.query(SPALTE)).rows[0].is_nullable).toBe('NO');
    expect((await pool.query(SYSTEMROLLEN)).rows).toEqual([]);
  });

  it('danach: Spalte nullable, genau eine Systemrolle super_admin ohne Gemeinde', async () => {
    await pool.query(migrationLesen(MIGRATION));
    expect((await pool.query(SPALTE)).rows[0].is_nullable).toBe('YES');
    const { rows } = await pool.query(SYSTEMROLLEN);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'super_admin', display_name: 'Super-Admin', is_system_role: true, is_active: true });
  });

  it('das Bestandskonto ist unveraendert', async () => {
    const { rows } = await pool.query("SELECT organization_id, role_id, is_super_admin FROM users WHERE username = 'bestand'");
    expect(rows).toEqual([{ organization_id: orgId, role_id: orgRolle, is_super_admin: false }]);
  });

  it.each([
    ['is_super_admin false', false],
    ['is_super_admin NULL', null],
  ])('verboten: Konto ohne Gemeinde mit %s -> 23514 (CHECK)', async (_fall, merkmal) => {
    const { rows: [rolle] } = await pool.query(SYSTEMROLLEN);
    await expect(pool.query(
      'INSERT INTO users (organization_id, role_id, username, display_name, is_super_admin) VALUES (NULL, $1, $2, $3, $4)',
      [rolle.id, `ohne-${String(merkmal)}`, 'Ohne', merkmal]
    )).rejects.toMatchObject({ code: '23514', constraint: 'users_gemeinde_oder_super_admin' });
  });

  it('erlaubt: Konto ohne Gemeinde mit Super-Admin-Merkmal', async () => {
    const { rows: [rolle] } = await pool.query(SYSTEMROLLEN);
    const { rowCount } = await pool.query(
      "INSERT INTO users (organization_id, role_id, username, display_name, is_super_admin) VALUES (NULL, $1, 'support', 'Support', true)",
      [rolle.id]
    );
    expect(rowCount).toBe(1);
  });

  it('verboten: eine zweite Rolle super_admin ohne Gemeinde -> 23505', async () => {
    await expect(pool.query(
      "INSERT INTO roles (organization_id, name, display_name) VALUES (NULL, 'super_admin', 'Zweite')"
    )).rejects.toMatchObject({ code: '23505', constraint: 'uq_roles_name_ohne_gemeinde' });
  });

  it('erlaubt: eine Rolle super_admin IN einer Gemeinde (wie der Test-Seed) bleibt moeglich', async () => {
    const { rowCount } = await pool.query(
      "INSERT INTO roles (organization_id, name, display_name) VALUES ($1, 'super_admin', 'Super-Admin')", [orgId]);
    expect(rowCount).toBe(1);
  });

  it('ein zweiter Lauf scheitert nicht und legt nichts doppelt an', async () => {
    await expect(pool.query(migrationLesen(MIGRATION))).resolves.toBeDefined();
    expect((await pool.query(SYSTEMROLLEN)).rows).toHaveLength(1);
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS n FROM pg_constraint WHERE conname = 'users_gemeinde_oder_super_admin'");
    expect(rows[0].n).toBe(1);
  });
});

describe('Migration 190, wenn es die Systemrolle schon gibt', () => {
  let pool;
  const DB2 = 'konfi_test_mig190_vorhanden';

  beforeAll(async () => {
    pool = await dbAnlegen(DB2);
    await produktionAufbauen(pool, { vor: MIGRATION });
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB2);
  }, 120000);

  it('uebernimmt die vorhandene Zeile statt eine zweite anzulegen', async () => {
    const { rows: [{ id }] } = await pool.query(
      "INSERT INTO roles (organization_id, name, display_name) VALUES (NULL, 'super_admin', 'Von Hand') RETURNING id");
    await pool.query(migrationLesen(MIGRATION));
    const { rows } = await pool.query(SYSTEMROLLEN);
    expect(rows.map((r) => r.id)).toEqual([id]);
    expect(rows[0].display_name).toBe('Von Hand');
  });
});
