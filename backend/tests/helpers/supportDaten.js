// backend/tests/helpers/supportDaten.js -- Testdaten fuer die Support-Ansicht
// (Uebersicht, Gemeindeliste, interne Gemeinden; 03.10.2026).
//
// Alle Zeitpunkte sind FEST und ausdruecklich: nichts hier verlaesst sich auf
// NOW() der Datenbank. Ein Test, der Monats- oder Wochenreihen prueft, legt
// seine Zeilen auf Zeitpunkte, die zum festgelegten "jetzt" des Tests passen
// (vi.setSystemTime) -- sonst wanderten die Zeilen mit dem Kalender aus dem
// Fenster und der Test faellt irgendwann ohne Aenderung am Code.
//
// Erwartet die Seed-Daten (helpers/seed.js: Gemeinden 1 und 2); eigene
// Gemeinden bekommen Kennungen ab 3, eigene Konten ab 60 und eigene Rollen
// ab 100, damit sie den Seed nicht beruehren.
const FEST = '2025-06-15T10:00:00Z';

/**
 * @param {{query: Function}} db
 */
function supportDaten(db) {
  /** Die vier Rollen einer Gemeinde: { konfi, teamer, admin, org_admin } -> Kennung. */
  const rollen = async (organizationId) => {
    const ids = {};
    let n = 0;
    for (const name of ['konfi', 'teamer', 'admin', 'org_admin']) {
      n += 1;
      const id = 100 + organizationId * 10 + n;
      await db.query(
        'INSERT INTO roles (id, name, display_name, organization_id) VALUES ($1, $2, $3, $4)',
        [id, name, name, organizationId]);
      ids[name] = id;
    }
    return ids;
  };

  /** Eine Gemeinde samt ihren vier Rollen; liefert die Rollen. */
  const gemeinde = async (f) => {
    const g = {
      name: `gemeinde-${f.id}`, anzeige: `Gemeinde ${f.id}`, intern: false, is_active: true, is_trial: false,
      trial_ends_at: null, max_konfis: null, created_at: FEST, kirchenkreis_id: null, ...f,
    };
    await db.query(
      `INSERT INTO organizations (id, name, slug, display_name, is_active, intern, is_trial, trial_ends_at,
                                  max_konfis, created_at, kirchenkreis_id)
       VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [g.id, g.name, g.anzeige, g.is_active, g.intern, g.is_trial, g.trial_ends_at, g.max_konfis, g.created_at,
        g.kirchenkreis_id]);
    return rollen(g.id);
  };

  /** Ein Konto mit Stamm-Gemeinde und Rolle (Kennung der Rolle). */
  const konto = async (f) => {
    const k = {
      organization_id: null, username: `konto${f.id}`, display_name: `Konto ${f.id}`, email: null, is_active: true,
      created_at: FEST, last_login_at: null, deleted_at: null, is_super_admin: false, ...f,
    };
    await db.query(
      `INSERT INTO users (id, organization_id, role_id, username, display_name, email, password_hash,
                          is_active, created_at, last_login_at, deleted_at, is_super_admin)
       VALUES ($1, $2, $3, $4, $5, $6, 'hash', $7, $8, $9, $10, $11)`,
      [k.id, k.organization_id, k.role_id, k.username, k.display_name, k.email, k.is_active, k.created_at,
        k.last_login_at, k.deleted_at, k.is_super_admin]);
    return k.id;
  };

  /** Zugehoerigkeit zu einer weiteren Gemeinde (user_organizations) mit der Rolle DORT. */
  const zusatz = (userId, organizationId, roleId) => db.query(
    'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
    [userId, organizationId, roleId]);

  /** Eine Anfrage vom Formular; created_at fest. */
  const anfrage = async (f = {}) => {
    const a = {
      gemeinde: 'Kirchengemeinde Beispiel', kontakt_name: 'Pastorin Probe', email: 'probe@beispiel.example',
      status: 'neu', wunsch_lizenz: null, organization_id: null, created_at: FEST, ...f,
    };
    const { rows: [{ id }] } = await db.query(
      `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, status, wunsch_lizenz, organization_id,
                                      einwilligung_am, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $7) RETURNING id`,
      [a.gemeinde, a.kontakt_name, a.email, a.status, a.wunsch_lizenz, a.organization_id, a.created_at]);
    return Number(id);
  };

  let lfd = 0;
  /** Eine Mail; gesendet_am fest (Vorgabe: steigt je Aufruf um eine Minute). */
  const mail = async (f = {}) => {
    lfd += 1;
    const m = {
      postfach: 'moin', richtung: 'ein', anfrage_id: null, organization_id: null, von_adresse: 'absender@beispiel.example',
      von_name: null, betreff: `Betreff ${lfd}`, text: 'Hallo', gelesen_am: null,
      gesendet_am: new Date(Date.UTC(2026, 8, 1, 8, lfd)), ...f,
    };
    const { rows: [{ id }] } = await db.query(
      `INSERT INTO mail_nachrichten (postfach, richtung, anfrage_id, organization_id, message_id, von_adresse,
                                     von_name, betreff, text, gesendet_am, gelesen_am)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [m.postfach, m.richtung, m.anfrage_id, m.organization_id, `<s${lfd}-${Math.random().toString(36).slice(2)}@x.example>`,
        m.von_adresse, m.von_name, m.betreff, m.text, m.gesendet_am, m.gelesen_am]);
    return Number(id);
  };

  return { rollen, gemeinde, konto, zusatz, anfrage, mail };
}

module.exports = { supportDaten, FEST };
