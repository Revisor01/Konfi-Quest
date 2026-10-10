// MIGRATION 191: Landeskirchen, Kirchenkreise, Zuordnung an der Gemeinde und
// die Anfragen vom Formular (Simon, 02.10.2026; docs/planung/web-version.md,
// Entscheidungen 3, 4 und 6).
//
// Seit 10.10.2026 steht 191 im Schema-Dump (tests/schema/prod-schema.sql),
// die Datei ist aus backend/migrations/ entfernt; der Test der Migration auf
// dem Stand davor (Uebernahme der Freitexte als Kirchenkreise, zweiter Lauf)
// liegt in der Git-Historie (zuletzt Commit 3b935178). Die Migration legte
// Kirchenkreise nur aus vorhandenen Freitexten an -- auf einer neuen Instanz
// keine, der Datenteil des Dumps hat deshalb keine Zeile dafuer. Geprueft
// wird hier auf einer Wegwerf-Datenbank aus dem Dump: Eindeutigkeit,
// Verhalten beim Loeschen und die Anfragen vom Formular.
const { dbAnlegen, dbWegraeumen, produktionAufbauen } = require('../helpers/schemaAufbau');

const DB = 'konfi_test_mig191';

describe('Migration 191 im Schema-Dump', () => {
  let pool;
  const ids = {};

  const gemeinde = async (slug, kirchenkreis) => {
    const { rows: [{ id }] } = await pool.query(
      'INSERT INTO organizations (name, slug, display_name, kirchenkreis) VALUES ($1, $1, $1, $2) RETURNING id',
      [slug, kirchenkreis]);
    ids[slug] = Number(id);
  };

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool);
    await gemeinde('west', 'Dithmarschen');
    await gemeinde('dom', 'Mecklenburg');
    await gemeinde('nord', 'Nordfriesland');
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('der Dump kennt beide Tabellen, die Spalte kirchenkreis_id und die Anfragen', async () => {
    const { rows } = await pool.query(
      `SELECT to_regclass('public.landeskirchen')::text AS l, to_regclass('public.kirchenkreise')::text AS k,
              to_regclass('public.gemeinde_anfragen')::text AS a,
              (SELECT COUNT(*)::int FROM information_schema.columns
                WHERE table_name = 'organizations' AND column_name = 'kirchenkreis_id') AS spalte`);
    expect(rows[0]).toEqual({ l: 'landeskirchen', k: 'kirchenkreise', a: 'gemeinde_anfragen', spalte: 1 });
  });

  it('eine neue Instanz hat keine Kirchenkreise und keine Landeskirchen', async () => {
    const { rows } = await pool.query(
      'SELECT (SELECT COUNT(*)::int FROM kirchenkreise) AS k, (SELECT COUNT(*)::int FROM landeskirchen) AS l');
    expect(rows[0]).toEqual({ k: 0, l: 0 });
    // Kirchenkreise legt sonst die Oberflaeche an; hier von Hand, ohne
    // Landeskirche, und an die Gemeinden gehaengt.
    for (const name of ['Dithmarschen', 'Mecklenburg']) {
      const { rows: [{ id }] } = await pool.query(
        'INSERT INTO kirchenkreise (name) VALUES ($1) RETURNING id', [name]);
      await pool.query('UPDATE organizations SET kirchenkreis_id = $1 WHERE kirchenkreis = $2', [id, name]);
    }
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
