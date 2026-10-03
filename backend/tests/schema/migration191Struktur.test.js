// MIGRATION 191: Landeskirchen, Kirchenkreise, Zuordnung an der Gemeinde und
// die Anfragen vom Formular (Simon, 02.10.2026; docs/planung/web-version.md,
// Entscheidungen 3, 4 und 6).
//
// Geprueft auf dem Stand, auf den die Migration beim Deploy trifft: Gemeinden
// mit Freitext im Kirchenkreis (verschiedene Schreibweisen, leer, ohne),
// danach die Uebernahme, die Eindeutigkeit, das Verhalten beim Loeschen und
// ein zweiter Lauf.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');

const MIGRATION = '191_landeskirchen_kirchenkreise_anfragen.sql';
const DB = 'konfi_test_mig191';

describe('Migration 191 auf dem Stand, auf den sie beim Deploy trifft', () => {
  let pool;
  const ids = {};

  const gemeinde = async (slug, kirchenkreis) => {
    const { rows: [{ id }] } = await pool.query(
      'INSERT INTO organizations (name, slug, display_name, kirchenkreis) VALUES ($1, $1, $1, $2) RETURNING id',
      [slug, kirchenkreis]);
    ids[slug] = Number(id);
  };
  const zuordnung = async () => {
    const { rows } = await pool.query(
      `SELECT o.slug, o.kirchenkreis AS text, k.name AS kirchenkreis, k.landeskirche_id
         FROM organizations o LEFT JOIN kirchenkreise k ON k.id = o.kirchenkreis_id
        ORDER BY o.id`);
    return rows;
  };

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    // So stehen die Freitexte in Produktion: frei getippt, mal mit Leerraum,
    // mal klein, mal leer.
    await gemeinde('west', 'Dithmarschen');
    await gemeinde('hennstedt', ' dithmarschen ');
    await gemeinde('dom', 'Mecklenburg');
    await gemeinde('leer', '   ');
    await gemeinde('ohne', null);
    await gemeinde('nord', 'Nordfriesland');
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('Ausgangslage: keine Tabellen, keine Spalte kirchenkreis_id', async () => {
    const { rows } = await pool.query(
      `SELECT to_regclass('public.landeskirchen') AS l, to_regclass('public.kirchenkreise') AS k,
              to_regclass('public.gemeinde_anfragen') AS a,
              (SELECT COUNT(*)::int FROM information_schema.columns
                WHERE table_name = 'organizations' AND column_name = 'kirchenkreis_id') AS spalte`);
    expect(rows[0]).toEqual({ l: null, k: null, a: null, spalte: 0 });
  });

  it('übernimmt jeden Freitext als Kirchenkreis ohne Landeskirche, gleiche Schreibweisen als einen', async () => {
    await pool.query(migrationLesen(MIGRATION));
    const { rows } = await pool.query('SELECT name, landeskirche_id FROM kirchenkreise ORDER BY name');
    expect(rows).toEqual([
      { name: 'Dithmarschen', landeskirche_id: null },
      { name: 'Mecklenburg', landeskirche_id: null },
      { name: 'Nordfriesland', landeskirche_id: null },
    ]);
  });

  it('verknüpft die Gemeinden; der Freitext bleibt, wie er war', async () => {
    expect(await zuordnung()).toEqual([
      { slug: 'west', text: 'Dithmarschen', kirchenkreis: 'Dithmarschen', landeskirche_id: null },
      { slug: 'hennstedt', text: ' dithmarschen ', kirchenkreis: 'Dithmarschen', landeskirche_id: null },
      { slug: 'dom', text: 'Mecklenburg', kirchenkreis: 'Mecklenburg', landeskirche_id: null },
      { slug: 'leer', text: '   ', kirchenkreis: null, landeskirche_id: null },
      { slug: 'ohne', text: null, kirchenkreis: null, landeskirche_id: null },
      { slug: 'nord', text: 'Nordfriesland', kirchenkreis: 'Nordfriesland', landeskirche_id: null },
    ]);
  });

  it('verboten: zwei Landeskirchen gleichen Namens (ohne Groß/klein) -> 23505', async () => {
    await pool.query("INSERT INTO landeskirchen (name) VALUES ('Nordkirche')");
    await expect(pool.query("INSERT INTO landeskirchen (name) VALUES ('nordkirche')"))
      .rejects.toMatchObject({ code: '23505', constraint: 'uq_landeskirchen_name' });
  });

  it('verboten: derselbe Kirchenkreis zweimal ohne Landeskirche -> 23505', async () => {
    await expect(pool.query("INSERT INTO kirchenkreise (name) VALUES ('DITHMARSCHEN')"))
      .rejects.toMatchObject({ code: '23505', constraint: 'uq_kirchenkreise_landeskirche_name' });
  });

  it('erlaubt: derselbe Name in einer Landeskirche; dort verboten ein zweites Mal', async () => {
    const { rows: [{ id: lk }] } = await pool.query("SELECT id FROM landeskirchen WHERE name = 'Nordkirche'");
    await pool.query("INSERT INTO kirchenkreise (name, landeskirche_id) VALUES ('Dithmarschen', $1)", [lk]);
    await expect(pool.query("INSERT INTO kirchenkreise (name, landeskirche_id) VALUES ('dithmarschen', $1)", [lk]))
      .rejects.toMatchObject({ code: '23505' });
  });

  it('ein zweiter Lauf scheitert nicht, legt nichts doppelt an und ändert keine Zuordnung', async () => {
    const vorher = await zuordnung();
    await expect(pool.query(migrationLesen(MIGRATION))).resolves.toBeDefined();
    expect(await zuordnung()).toEqual(vorher);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM kirchenkreise');
    expect(rows[0].n).toBe(4);
  });

  it('Landeskirche weg: der Kirchenkreis bleibt ohne; Kirchenkreis weg: die Gemeinde bleibt ohne Zuordnung', async () => {
    const { rows: [mv] } = await pool.query("SELECT id FROM kirchenkreise WHERE name = 'Mecklenburg'");
    const { rows: [{ id: lk }] } = await pool.query("INSERT INTO landeskirchen (name) VALUES ('Probe') RETURNING id");
    await pool.query('UPDATE kirchenkreise SET landeskirche_id = $1 WHERE id = $2', [lk, mv.id]);
    await pool.query('DELETE FROM landeskirchen WHERE id = $1', [lk]);
    expect((await pool.query('SELECT landeskirche_id FROM kirchenkreise WHERE id = $1', [mv.id])).rows[0].landeskirche_id).toBeNull();

    await pool.query('DELETE FROM kirchenkreise WHERE id = $1', [mv.id]);
    const { rows: [dom] } = await pool.query('SELECT kirchenkreis_id, kirchenkreis FROM organizations WHERE id = $1', [ids.dom]);
    expect(dom).toEqual({ kirchenkreis_id: null, kirchenkreis: 'Mecklenburg' });
  });

  describe('gemeinde_anfragen', () => {
    const anfrage = (felder = {}) => pool.query(
      `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, status, organization_id, bearbeitet_von)
       VALUES ($1, 'Pastorin Probe', 'probe@example.test', NOW(), COALESCE($2, 'neu'), $3, $4)
       RETURNING id, status, status_seit, created_at, updated_at`,
      [felder.gemeinde || 'Kirchengemeinde Probe', felder.status || null, felder.organization_id || null, felder.bearbeitet_von || null]);

    it('neu angelegt: Status neu, Zeitpunkte gesetzt', async () => {
      const { rows: [a] } = await anfrage();
      expect(a.status).toBe('neu');
      expect(a.status_seit).toBeInstanceOf(Date);
      expect(a.created_at).toBeInstanceOf(Date);
    });

    it.each(['neu', 'in_arbeit', 'angelegt', 'abgelehnt'])('erlaubt: Status %s', async (status) => {
      const { rows: [a] } = await anfrage({ status });
      expect(a.status).toBe(status);
    });

    it('verboten: ein anderer Status -> 23514', async () => {
      await expect(anfrage({ status: 'erledigt' }))
        .rejects.toMatchObject({ code: '23514', constraint: 'gemeinde_anfragen_status_check' });
    });

    it('verboten: ohne Einwilligung (einwilligung_am) -> 23502', async () => {
      await expect(pool.query(
        "INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email) VALUES ('G', 'K', 'k@example.test')"))
        .rejects.toMatchObject({ code: '23502' });
    });

    it('verboten: negative Zahl der Konfis -> 23514', async () => {
      await expect(pool.query(
        `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, anzahl_konfis)
         VALUES ('G', 'K', 'k@example.test', NOW(), -1)`))
        .rejects.toMatchObject({ code: '23514', constraint: 'gemeinde_anfragen_anzahlen_check' });
    });

    it('Gemeinde und Konto weg: die Anfrage bleibt, die Verweise werden leer', async () => {
      const { rows: [{ id: rolle }] } = await pool.query(
        "INSERT INTO roles (organization_id, name, display_name) VALUES ($1, 'org_admin', 'Gemeindeleitung') RETURNING id", [ids.nord]);
      const { rows: [{ id: konto }] } = await pool.query(
        "INSERT INTO users (organization_id, role_id, username, display_name) VALUES ($1, $2, 'bearbeiter', 'B') RETURNING id",
        [ids.west, rolle]);
      const { rows: [a] } = await anfrage({ status: 'angelegt', organization_id: ids.nord, bearbeitet_von: konto });

      await pool.query('DELETE FROM users WHERE id = $1', [konto]);
      await pool.query('DELETE FROM roles WHERE id = $1', [rolle]);
      await pool.query('DELETE FROM organizations WHERE id = $1', [ids.nord]);
      const { rows: [nachher] } = await pool.query(
        'SELECT status, organization_id, bearbeitet_von FROM gemeinde_anfragen WHERE id = $1', [a.id]);
      expect(nachher).toEqual({ status: 'angelegt', organization_id: null, bearbeitet_von: null });
    });
  });
});
