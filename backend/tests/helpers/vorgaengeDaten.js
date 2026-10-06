// backend/tests/helpers/vorgaengeDaten.js -- Testdaten fuer die Support-
// Vorgaenge (Migration 195; docs/planung/support-vorgaenge.md).
//
// Alle Zeitpunkte sind FEST und ausdruecklich, wo ein Test sie prueft; sonst
// gilt NOW() der Datenbank. Erwartet die Seed-Daten (helpers/seed.js:
// Gemeinden 1 und 2).
const MAIL_ENV = Object.freeze({
  MAIL_IMAP_HOST: 'imap.example.test',
  MAIL_MOIN_USER: 'moin-benutzer',
  MAIL_MOIN_PASS: 'geheim-moin',
  MAIL_SUPPORT_USER: 'support-benutzer',
  MAIL_SUPPORT_PASS: 'geheim-support',
  SMTP_HOST: 'smtp.example.test',
  SMTP_PORT: '465',
});

/** Alle Felder einer Zeile in support_vorgaenge, die ein Test setzen mag. */
const VORGANG_STANDARD = Object.freeze({
  art: 'frage',
  bereich: null,
  dringlichkeit: 'normal',
  status: 'neu',
  betreff: 'Frage zum Kalender',
  beschreibung: null,
  quelle: 'support',
  organization_id: null,
  anfrage_id: null,
  erstellt_von: null,
  kontakt_name: null,
  kontakt_email: null,
  kontakt_funktion: null,
  gemeinde_angabe: null,
  einwilligung_am: null,
  notiz: null,
  archiviert_am: null,
  status_seit: null,
  created_at: null,
  updated_at: null,
});

/**
 * @param {{query: Function}} db
 */
function vorgaengeDaten(db) {
  let lfd = 0;

  /** Ein Vorgang; erledigt wird archiviert, wenn archiviert_am fehlt. Liefert die Kennung. */
  const vorgang = async (f = {}) => {
    const w = { ...VORGANG_STANDARD, ...f };
    if (w.status === 'erledigt' && !w.archiviert_am) w.archiviert_am = new Date();
    const { rows: [{ id }] } = await db.query(
      `INSERT INTO support_vorgaenge
         (art, bereich, dringlichkeit, status, betreff, beschreibung, quelle, organization_id, anfrage_id, erstellt_von,
          kontakt_name, kontakt_email, kontakt_funktion, gemeinde_angabe, einwilligung_am, notiz, archiviert_am,
          status_seit, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
               COALESCE($18, NOW()), COALESCE($19, NOW()), COALESCE($20, $19, NOW()))
       RETURNING id`,
      [w.art, w.bereich, w.dringlichkeit, w.status, w.betreff, w.beschreibung, w.quelle, w.organization_id, w.anfrage_id,
        w.erstellt_von, w.kontakt_name, w.kontakt_email, w.kontakt_funktion, w.gemeinde_angabe, w.einwilligung_am, w.notiz,
        w.archiviert_am, w.status_seit, w.created_at, w.updated_at]);
    return Number(id);
  };

  /** Eine Anfrage vom Formular samt ihrem Vorgang (wie POST /api/anfragen sie anlegt); liefert { anfrage, vorgang }. */
  const anfrageMitVorgang = async (f = {}) => {
    const a = {
      gemeinde: 'Kirchengemeinde Büsum', kontakt_name: 'Pastorin Probe', email: 'probe@buesum.example',
      status: 'neu', nachricht: null, notiz: null, organization_id: null, ...f,
    };
    const { rows: [{ id }] } = await db.query(
      `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, status, nachricht, notiz, organization_id)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7) RETURNING id`,
      [a.gemeinde, a.kontakt_name, a.email, a.status, a.nachricht, a.notiz, a.organization_id]);
    const { vorgangFuerAnfrage } = require('../../utils/supportVorgaenge');
    return { anfrage: Number(id), vorgang: await vorgangFuerAnfrage(db, Number(id)) };
  };

  /**
   * Eine gespeicherte Mail; gesendet_am steigt mit jedem Aufruf um eine Minute.
   * Die Spalten anfrage_id/organization_id folgen dem Vorgang, wenn vorgang_id
   * gesetzt ist und sie fehlen.
   */
  const mail = async (f = {}) => {
    lfd += 1;
    let anfrageId = f.anfrage_id ?? null;
    let organizationId = f.organization_id ?? null;
    if (f.vorgang_id && f.anfrage_id === undefined && f.organization_id === undefined) {
      const { rows: [v] } = await db.query('SELECT anfrage_id, organization_id FROM support_vorgaenge WHERE id = $1', [f.vorgang_id]);
      anfrageId = v.anfrage_id;
      organizationId = v.anfrage_id ? null : v.organization_id;
    }
    const { rows: [{ id }] } = await db.query(
      `INSERT INTO mail_nachrichten (postfach, richtung, vorgang_id, anfrage_id, organization_id, message_id, in_reply_to, referenzen,
                                     von_adresse, von_name, an_adressen, betreff, text, anhaenge, gesendet_am, gelesen_am,
                                     archiviert_am, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $17, COALESCE($18, NOW()))
       RETURNING id`,
      [f.postfach || 'support', f.richtung || 'ein', f.vorgang_id ?? null, anfrageId, organizationId,
        f.message_id || `<v${lfd}-${Math.random().toString(36).slice(2)}@x.example>`, f.in_reply_to || null, f.referenzen || [],
        f.von_adresse === undefined ? 'absender@gemeinde.example' : f.von_adresse, f.von_name || null,
        f.an_adressen || ['support@konfi-quest.de'], f.betreff || `Betreff ${lfd}`, f.text || 'Hallo',
        JSON.stringify(f.anhaenge || []), f.gesendet_am || new Date(Date.UTC(2026, 9, 1, 8, lfd)), f.gelesen_am || null,
        f.archiviert_am || null, f.created_at || null]);
    return Number(id);
  };

  const vorgangZeile = async (id) => (await db.query('SELECT * FROM support_vorgaenge WHERE id = $1', [id])).rows[0];
  const mailZeile = async (id) => (await db.query('SELECT * FROM mail_nachrichten WHERE id = $1', [id])).rows[0];
  const anfrageZeile = async (id) => (await db.query('SELECT * FROM gemeinde_anfragen WHERE id = $1', [id])).rows[0];
  const anzahl = async (tabelle) => (await db.query(`SELECT COUNT(*)::int AS n FROM ${tabelle}`)).rows[0].n;

  return { vorgang, anfrageMitVorgang, mail, vorgangZeile, mailZeile, anfrageZeile, anzahl };
}

module.exports = { MAIL_ENV, VORGANG_STANDARD, vorgaengeDaten };
