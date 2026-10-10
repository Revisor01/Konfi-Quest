// MIGRATION 190: Konten ohne Gemeinde (Simon, 03.10.2026;
// docs/planung/web-version.md, Entscheidungen 11 bis 15).
//
// users.organization_id wird nullable -- aber nur fuer Super-Admins (CHECK) --,
// dazu eine gemeindefreie Systemrolle super_admin, eindeutig je Name unter
// den Rollen ohne Gemeinde (der UNIQUE (organization_id, name) aus dem Dump
// greift bei NULL nicht).
//
// Seit 10.10.2026 steht 190 im Schema-Dump (tests/schema/prod-schema.sql),
// die Datei ist aus backend/migrations/ entfernt; der Test der Migration auf
// dem Stand davor (Ausgangslage, zweiter Lauf, vorhandene Rolle) liegt in der
// Git-Historie (zuletzt Commit 3b935178). Die Systemrolle ist eine
// DATENZEILE: Sie kommt jetzt aus dem Datenteil des Dumps
// (schema-erneuern.sh). Fehlte er, haette eine neue Instanz keine Rolle fuer
// das erste Support-Konto (scripts/ersteinrichtung.js). Geprueft auf einer
// Wegwerf-Datenbank aus dem Dump -- die gemeinsame Test-Datenbank leert
// roles vor jedem Test (helpers/db.js).
const { dbAnlegen, dbWegraeumen, produktionAufbauen } = require('../helpers/schemaAufbau');

const DB = 'konfi_test_mig190';

const SPALTE = `SELECT is_nullable FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'organization_id'`;
const SYSTEMROLLEN = `SELECT id, name, display_name, is_system_role, is_active FROM roles
  WHERE organization_id IS NULL AND name = 'super_admin'`;

describe('Migration 190 im Schema-Dump', () => {
  let pool;
  let orgId;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool);
    ({ rows: [{ id: orgId }] } = await pool.query(
      "INSERT INTO organizations (name, slug, display_name) VALUES ('g', 'g', 'G') RETURNING id"));
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('users.organization_id ist nullable', async () => {
    expect((await pool.query(SPALTE)).rows[0].is_nullable).toBe('YES');
  });

  it('der Datenteil des Dumps bringt genau eine Systemrolle super_admin ohne Gemeinde', async () => {
    const { rows } = await pool.query(SYSTEMROLLEN);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'super_admin', display_name: 'Super-Admin', is_system_role: true, is_active: true });
  });

  it('die Sequenz der Rollen steht hinter der Zeile aus dem Dump', async () => {
    const { rows: [rolle] } = await pool.query(SYSTEMROLLEN);
    const { rows: [{ id }] } = await pool.query(
      "INSERT INTO roles (organization_id, name, display_name) VALUES ($1, 'org_admin', 'Gemeindeleitung') RETURNING id", [orgId]);
    expect(Number(id)).toBeGreaterThan(Number(rolle.id));
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
});
