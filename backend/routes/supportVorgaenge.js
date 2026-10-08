// /api/support/vorgaenge -- die Vorgaenge der Support-Ansicht (Simon,
// 03.10.2026; docs/planung/support-vorgaenge.md): Liste mit Filtern und Suche,
// Anlegen, Detail mit Verlauf, Einordnen (PATCH), Antworten, Archivieren,
// Wiederherstellen, Loeschen und Sammelaktionen.
//
// Eingehaengt in routes/support.js HINTER rbacVerifier und
// requireSuperAdmin: Alle Routen sind nur fuer Super-Admins (Rolle oder
// Merkmal, mit oder ohne Gemeinde); jede andere Rolle bekommt 403, ohne
// Anmeldung 401. Die Mail-Routen zum Einsortieren stehen in
// routes/supportMail.js.
//
// DIE REGELN stehen in utils/supportVorgaenge.js (Erledigt heisst Archiv,
// Mail-Spalten, Anfrage und Vorgang halten den Status gemeinsam). Hier kommen
// dazu:
//
//   LISTE. filter: offen (Vorgabe: nicht archiviert, Status neu, in_arbeit
//     oder wartet), neu, in_arbeit, wartet (je nicht archiviert), erledigt
//     (Status erledigt), archiv (alle archivierten, auch die erledigten),
//     alle (nicht archiviert, jeder Status -- Zusatz). art, gemeinde (Kennung
//     der Gemeinde), suche (Nummer, Betreff, Beschreibung, Gemeinde, Kontakt,
//     Absender und Betreff der Mails). Neueste Aktivitaet zuerst, hoechstens
//     VORGAENGE_MAX. Interne Gemeinden stehen hier wie jede andere (ihre
//     Vorgaenge bearbeitet der Support); nur die Zahlen der Uebersicht
//     (routes/supportUebersicht.js) lassen sie weg.
//   EMPFAENGER. Eine Antwort geht nur an eine Adresse, die zum Vorgang
//     gehoert: Absender eingehender Mails des Vorgangs, die Kontaktadresse aus
//     dem Formular, die Adresse der Anfrage, Gemeindeleitung und Leitung der
//     Gemeinde (dieselben Regeln wie GET /gemeinden/:id/empfaenger). Ohne
//     Angabe geht sie an die erste. Das Postfach: moin@ fuer den Vorgang einer
//     Anfrage, sonst support@.
//   MISSBRAUCH. Fehler nur mit Code und Meldung ins Protokoll, nie err.detail.

const express = require('express');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const { MITGLIEDSCHAFTEN_SQL } = require('../utils/orgMitglieder');
const {
  NACHRICHT_SPALTEN, NACHRICHT_FROM, ANFRAGE_SPALTEN,
} = require('../utils/mailNachrichten');
const {
  ARTEN, BEREICHE, DRINGLICHKEITEN, STATUS, BETREFF_MAX, NOTIZ_MAX,
  vorgangAnlegen, mailSpalten, statusSetzen, vorgangBewegt, vorgaengeArchivieren, vorgaengeLoeschen,
} = require('../utils/supportVorgaenge');
const { antwortSenden, VersandFehler } = require('../services/mailVersand');
const { empfaengerLaden } = require('./supportMail');

const FILTER = ['offen', 'neu', 'in_arbeit', 'wartet', 'erledigt', 'archiv', 'alle'];
const VORGAENGE_MAX = 1000;
const SAMMEL_MAX = 500;
const TEXT_MAX = 20000;
const SUCHE_MAX = 200;
const AKTIONEN = ['archivieren', 'wiederherstellen', 'loeschen', 'status'];

const VORGANG_FEHLT = { error: 'Vorgang nicht gefunden' };
const GEMEINDE_FEHLT = { error: 'Gemeinde nicht gefunden' };

/** Fehler ins Protokoll: nur Code und Meldung. */
const protokolliere = (wo, err) => console.error(`${wo}: %s %s`, err.code || '', err.message);

/** Eine Zeile ohne Zeilenumbrueche (Betreff). */
const einzeilig = (text) => String(text == null ? '' : text).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

// Die Felder einer Liste (Vertrag). gemeinde_name: der Anzeigename der
// Gemeinde, sonst die Angabe aus der Anfrage bzw. dem Formular. ungelesen:
// ungelesene eingehende Mails des Vorgangs. letzte_aktivitaet: das Spaetere
// von letzter Aenderung und juengster Mail.
const LISTE_SPALTEN = `v.id, v.art, v.bereich, v.dringlichkeit, v.status, v.betreff, v.quelle, v.organization_id,
  COALESCE(NULLIF(btrim(g.display_name), ''), g.name, a.gemeinde, v.gemeinde_angabe) AS gemeinde_name,
  v.anfrage_id,
  (SELECT COUNT(*)::int FROM mail_nachrichten um
    WHERE um.vorgang_id = v.id AND um.richtung = 'ein' AND um.gelesen_am IS NULL) AS ungelesen,
  GREATEST(v.updated_at, COALESCE((SELECT MAX(lm.gesendet_am) FROM mail_nachrichten lm WHERE lm.vorgang_id = v.id), v.created_at))
    AS letzte_aktivitaet,
  v.created_at, v.archiviert_am`;

const LISTE_FROM = `support_vorgaenge v
  LEFT JOIN organizations g ON g.id = v.organization_id
  LEFT JOIN gemeinde_anfragen a ON a.id = v.anfrage_id`;

/** Suchtext fuer ILIKE: Platzhalter des Nutzers sind Text. */
const likeMuster = (text) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Moegliche Empfaenger einer Antwort im Vorgang (Reihenfolge = Vorrang):
 * 'absender' (eingehende Mails, zuletzt geschrieben zuerst), 'kontakt'
 * (Adresse aus dem Formular), 'anfrage' (Adresse der Anfrage), dazu die
 * Empfaenger der Gemeinde ('leitung', 'verlauf': supportMail.js,
 * empfaengerLaden). Jede Adresse einmal, klein geschrieben.
 */
async function empfaengerFuerVorgang(db, vorgang) {
  const { rows: absender } = await db.query(
    `SELECT lower(btrim(m.von_adresse)) AS adresse, m.von_name AS name, MAX(m.gesendet_am) AS zuletzt
       FROM mail_nachrichten m
      WHERE m.vorgang_id = $1 AND m.richtung = 'ein' AND NULLIF(btrim(m.von_adresse), '') IS NOT NULL
      GROUP BY lower(btrim(m.von_adresse)), m.von_name
      ORDER BY zuletzt DESC`, [vorgang.id]);
  const liste = [];
  const gesehen = new Set();
  const dazu = (adresse, name, herkunft) => {
    const a = typeof adresse === 'string' ? adresse.trim().toLowerCase() : '';
    if (!a || gesehen.has(a)) return;
    gesehen.add(a);
    liste.push({ adresse: a, name: name || null, herkunft });
  };
  for (const r of absender) dazu(r.adresse, r.name, 'absender');
  dazu(vorgang.kontakt_email, vorgang.kontakt_name, 'kontakt');
  if (vorgang.anfrage_id !== null) {
    const { rows: [a] } = await db.query('SELECT email, kontakt_name FROM gemeinde_anfragen WHERE id = $1', [vorgang.anfrage_id]);
    if (a) dazu(a.email, a.kontakt_name, 'anfrage');
  }
  if (vorgang.organization_id !== null) {
    for (const e of await empfaengerLaden(db, vorgang.organization_id)) dazu(e.adresse, e.name, e.herkunft);
  }
  return liste;
}

module.exports = (db) => {
  const router = express.Router();

  const id = param('id').isInt({ min: 1 }).withMessage('Ungültige ID');

  const artFeld = (pflicht) => {
    const kette = pflicht ? body('art') : body('art').optional();
    return kette.isIn(ARTEN).withMessage(`art: ${ARTEN.join(', ')}`);
  };
  const bereichFeld = body('bereich').optional({ values: 'null' })
    .isIn(BEREICHE).withMessage(`bereich: ${BEREICHE.join(', ')} oder null`);
  const dringlichkeitFeld = body('dringlichkeit').optional()
    .isIn(DRINGLICHKEITEN).withMessage(`dringlichkeit: ${DRINGLICHKEITEN.join(', ')}`);
  const betreffFeld = (pflicht) => {
    const kette = pflicht ? body('betreff') : body('betreff').optional();
    return kette
      .isString().withMessage('Betreff ist erforderlich').bail()
      .custom((wert) => einzeilig(wert) !== '').withMessage('Betreff ist erforderlich').bail()
      .custom((wert) => einzeilig(wert).length <= BETREFF_MAX).withMessage(`Höchstens ${BETREFF_MAX} Zeichen`);
  };
  const gemeindeFeld = body('organization_id').optional({ values: 'null' })
    .isInt({ min: 1 }).withMessage('Ungültige Gemeinde');
  const textFeld = body('text')
    .isString().withMessage('Text ist erforderlich').bail()
    .trim().notEmpty().withMessage('Text ist erforderlich').bail()
    .isLength({ max: TEXT_MAX }).withMessage(`Höchstens ${TEXT_MAX} Zeichen`);
  const anFeld = body('an').optional({ values: 'null' })
    .isString().withMessage('Ungültiger Empfänger').bail()
    .trim().isLength({ max: 320 }).withMessage('Ungültiger Empfänger');

  // ==========================================================================
  // Laden
  // ==========================================================================

  /**
   * Das Detail (Vertrag): alle Felder der Liste, dazu status_seit, updated_at,
   * notiz, beschreibung, kontakt_*, gemeinde_angabe, einwilligung_am,
   * erstellt_von(_name), verlauf (Mails, aelteste zuerst), anfrage, gemeinde,
   * leitung und empfaenger.
   */
  const detail = async (c, vorgangId) => {
    const { rows: [v] } = await c.query(
      `SELECT ${LISTE_SPALTEN}, v.status_seit, v.updated_at, v.notiz, v.beschreibung,
              v.kontakt_name, v.kontakt_email, v.kontakt_funktion, v.gemeinde_angabe, v.einwilligung_am,
              v.erstellt_von, eu.display_name AS erstellt_von_name
         FROM ${LISTE_FROM}
         LEFT JOIN users eu ON eu.id = v.erstellt_von
        WHERE v.id = $1`, [vorgangId]);
    if (!v) return null;
    const [{ rows: verlauf }, anfrage, gemeinde, leitung, empfaenger] = await Promise.all([
      c.query(`SELECT ${NACHRICHT_SPALTEN} FROM ${NACHRICHT_FROM} WHERE m.vorgang_id = $1 ORDER BY m.gesendet_am, m.id`, [vorgangId]),
      v.anfrage_id === null ? null : c.query(`SELECT ${ANFRAGE_SPALTEN} FROM gemeinde_anfragen a WHERE a.id = $1`, [v.anfrage_id]),
      v.organization_id === null ? null : c.query(
        `SELECT o.id, o.name, COALESCE(NULLIF(btrim(o.display_name), ''), o.name) AS display_name,
                COALESCE(o.is_active, true) AS is_active, o.is_trial, o.trial_ends_at, o.max_konfis, o.intern,
                -- wie GET /gemeinden (routes/supportUebersicht.js): Konfis, die aufs Limit zaehlen
                (SELECT COUNT(*)::int FROM users u JOIN roles r ON r.id = u.role_id
                  WHERE r.name = 'konfi' AND u.organization_id = o.id AND u.deleted_at IS NULL) AS konfi_count,
                o.kirchenkreis_id, k.name AS kirchenkreis, k.landeskirche_id, l.name AS landeskirche,
                (SELECT x.wunsch_lizenz FROM gemeinde_anfragen x WHERE x.organization_id = o.id
                  ORDER BY x.status_seit DESC, x.id DESC LIMIT 1) AS wunsch_lizenz
           FROM organizations o
           LEFT JOIN kirchenkreise k ON k.id = o.kirchenkreis_id
           LEFT JOIN landeskirchen l ON l.id = k.landeskirche_id
          WHERE o.id = $1`, [v.organization_id]),
      v.organization_id === null ? null : c.query(
        `SELECT u.id, u.display_name, u.username, u.email, ms.is_active, u.last_login_at
           FROM (${MITGLIEDSCHAFTEN_SQL}) ms
           JOIN users u ON u.id = ms.user_id
          WHERE ms.rolle = 'org_admin' AND ms.organization_id = $1
          ORDER BY lower(u.display_name), u.id`, [v.organization_id]),
      empfaengerFuerVorgang(c, v),
    ]);
    return {
      ...v,
      verlauf,
      anfrage: anfrage ? anfrage.rows[0] || null : null,
      gemeinde: gemeinde ? gemeinde.rows[0] || null : null,
      leitung: leitung ? leitung.rows : [],
      empfaenger,
    };
  };

  const mitTransaktion = async (arbeit) => {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const ergebnis = await arbeit(client);
      await client.query(ergebnis && ergebnis.zurueck ? 'ROLLBACK' : 'COMMIT');
      return ergebnis;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  };

  const fehlerAntwort = (res, wo, err) => {
    if (err instanceof VersandFehler) return res.status(err.status).json({ error: err.message });
    protokolliere(wo, err);
    return res.status(500).json({ error: 'Datenbankfehler' });
  };

  // ==========================================================================
  // LISTE
  // ==========================================================================

  // GET /vorgaenge?filter=&art=&gemeinde=&suche= -> [ Eintrag ] (Felder: LISTE_SPALTEN)
  router.get('/vorgaenge', [
    query('filter').optional().isIn(FILTER).withMessage(`filter: ${FILTER.join(', ')}`),
    query('art').optional().isIn(ARTEN).withMessage(`art: ${ARTEN.join(', ')}`),
    query('gemeinde').optional().isInt({ min: 1 }).withMessage('Ungültige Gemeinde'),
    query('suche').optional().isString().isLength({ max: SUCHE_MAX }).withMessage(`Höchstens ${SUCHE_MAX} Zeichen`),
    handleValidationErrors,
  ], async (req, res) => {
    try {
      const filter = req.query.filter || 'offen';
      const bedingungen = [];
      const params = [];
      const param_ = (wert) => { params.push(wert); return `$${params.length}`; };

      if (filter === 'offen') bedingungen.push("v.archiviert_am IS NULL AND v.status IN ('neu', 'in_arbeit', 'wartet')");
      else if (filter === 'archiv') bedingungen.push('v.archiviert_am IS NOT NULL');
      else if (filter === 'erledigt') bedingungen.push("v.status = 'erledigt'");
      else if (filter === 'alle') bedingungen.push('v.archiviert_am IS NULL');
      else bedingungen.push(`v.archiviert_am IS NULL AND v.status = ${param_(filter)}`);

      if (req.query.art) bedingungen.push(`v.art = ${param_(req.query.art)}`);
      if (req.query.gemeinde) bedingungen.push(`v.organization_id = ${param_(Number(req.query.gemeinde))}`);

      const suche = typeof req.query.suche === 'string' ? einzeilig(req.query.suche) : '';
      if (suche) {
        const muster = param_(likeMuster(suche));
        const nummer = /^#?\s*(\d{1,15})$/.exec(suche);
        bedingungen.push(`(
          v.betreff ILIKE ${muster} OR v.beschreibung ILIKE ${muster}
          OR g.display_name ILIKE ${muster} OR g.name ILIKE ${muster}
          OR a.gemeinde ILIKE ${muster} OR a.kontakt_name ILIKE ${muster} OR a.email ILIKE ${muster}
          OR v.gemeinde_angabe ILIKE ${muster} OR v.kontakt_name ILIKE ${muster} OR v.kontakt_email ILIKE ${muster}
          OR EXISTS (SELECT 1 FROM mail_nachrichten sm WHERE sm.vorgang_id = v.id
                      AND (sm.betreff ILIKE ${muster} OR sm.von_adresse ILIKE ${muster} OR sm.von_name ILIKE ${muster}))
          ${nummer ? `OR v.id = ${param_(Number(nummer[1]))}` : ''})`);
      }

      const { rows } = await db.query(
        `SELECT ${LISTE_SPALTEN} FROM ${LISTE_FROM}
          WHERE ${bedingungen.join(' AND ')}
          ORDER BY letzte_aktivitaet DESC, v.id DESC
          LIMIT ${VORGAENGE_MAX}`, params);
      res.json(rows);
    } catch (err) {
      protokolliere('GET /support/vorgaenge', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // ==========================================================================
  // ANLEGEN
  // ==========================================================================

  // POST /vorgaenge { art, bereich?, dringlichkeit?, betreff, organization_id?, text?, an? }
  // -> 201 Detail. Mit `text` geht zugleich eine Mail vom Postfach support an
  // `an` (ohne Angabe: der erste Empfaenger der Gemeinde); sie gehoert zum
  // neuen Vorgang. Scheitert der Versand, entsteht kein Vorgang. Quelle
  // 'support', erstellt_von das Konto.
  router.post('/vorgaenge', [
    artFeld(true), bereichFeld, dringlichkeitFeld, betreffFeld(true), gemeindeFeld,
    body('text').optional({ values: 'null' })
      .isString().withMessage('Text erwartet').bail()
      .isLength({ max: TEXT_MAX }).withMessage(`Höchstens ${TEXT_MAX} Zeichen`),
    anFeld,
    handleValidationErrors,
  ], async (req, res) => {
    const organizationId = req.body.organization_id == null ? null : Number(req.body.organization_id);
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    try {
      if (organizationId !== null) {
        const { rows } = await db.query('SELECT id FROM organizations WHERE id = $1', [organizationId]);
        if (rows.length === 0) return res.status(404).json(GEMEINDE_FEHLT);
      }
      let an = null;
      if (text) {
        if (organizationId === null) {
          return res.status(400).json({ error: 'Für eine Mail braucht der Vorgang eine Gemeinde.' });
        }
        const empfaenger = await empfaengerLaden(db, organizationId);
        const gewuenscht = typeof req.body.an === 'string' ? req.body.an.trim().toLowerCase() : '';
        if (gewuenscht) {
          if (!empfaenger.some((e) => e.adresse === gewuenscht)) {
            return res.status(400).json({ error: 'Diese Adresse gehört nicht zu den Empfängern dieser Gemeinde.' });
          }
          an = gewuenscht;
        } else if (empfaenger.length > 0) {
          an = empfaenger[0].adresse;
        } else {
          return res.status(400).json({ error: 'Für diese Gemeinde ist keine Adresse bekannt.' });
        }
      }

      const { id: vorgangId } = await vorgangAnlegen(db, {
        art: req.body.art,
        bereich: req.body.bereich ?? null,
        dringlichkeit: req.body.dringlichkeit || 'normal',
        betreff: einzeilig(req.body.betreff),
        quelle: 'support',
        organizationId,
        erstelltVon: req.user.id,
      });

      if (text) {
        try {
          await antwortSenden(db, {
            postfach: 'support',
            an,
            text,
            vorgangId,
            standardBetreff: einzeilig(req.body.betreff),
            verfasstVon: req.user.id,
          }, { nachlauf: { req, bezeichnung: 'Gesendet-Ordner (Vorgang)' } });
        } catch (err) {
          // Ohne Mail kein Vorgang: Wer es erneut versucht, legt nichts doppelt an.
          await db.query('DELETE FROM support_vorgaenge WHERE id = $1', [vorgangId]).catch(() => {});
          throw err;
        }
      }
      res.status(201).json(await detail(db, vorgangId));
    } catch (err) {
      return fehlerAntwort(res, 'POST /support/vorgaenge', err);
    }
  });

  // ==========================================================================
  // DETAIL UND EINORDNEN
  // ==========================================================================

  router.get('/vorgaenge/:id', [id, handleValidationErrors], async (req, res) => {
    try {
      const v = await detail(db, Number(req.params.id));
      if (!v) return res.status(404).json(VORGANG_FEHLT);
      res.json(v);
    } catch (err) {
      protokolliere('GET /support/vorgaenge/:id', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // PATCH /vorgaenge/:id { art?, bereich?, dringlichkeit?, status?, betreff?, organization_id?, notiz? }
  // -> das Detail. status 'erledigt' archiviert; ein anderer Status holt einen
  // erledigten Vorgang aus dem Archiv. status_seit laeuft neu, wenn sich der
  // Status aendert. Eine neue Gemeinde zieht die Mails des Vorgangs mit; die
  // Notiz eines Anfrage-Vorgangs ist die Notiz der Anfrage.
  router.patch('/vorgaenge/:id', [
    id, artFeld(false), bereichFeld, dringlichkeitFeld, betreffFeld(false), gemeindeFeld,
    body('status').optional().isIn(STATUS).withMessage(`status: ${STATUS.join(', ')}`),
    body('notiz').optional({ values: 'null' }).isString().withMessage('Text erwartet').bail()
      .isLength({ max: NOTIZ_MAX }).withMessage(`Höchstens ${NOTIZ_MAX} Zeichen`),
    handleValidationErrors,
  ], async (req, res) => {
    const hat = (feld) => Object.prototype.hasOwnProperty.call(req.body, feld);
    const FELDER = ['art', 'bereich', 'dringlichkeit', 'status', 'betreff', 'organization_id', 'notiz'];
    if (!FELDER.some(hat)) {
      return res.status(400).json({ error: `Nichts zu ändern: ${FELDER.join(', ')} angeben` });
    }
    const vorgangId = Number(req.params.id);
    try {
      const ergebnis = await mitTransaktion(async (client) => {
        const { rows: [v] } = await client.query(
          'SELECT id, anfrage_id, organization_id FROM support_vorgaenge WHERE id = $1 FOR UPDATE', [vorgangId]);
        if (!v) return { zurueck: true, status: 404, body: VORGANG_FEHLT };
        const organizationId = hat('organization_id') && req.body.organization_id !== null
          ? Number(req.body.organization_id) : null;
        if (organizationId !== null) {
          const { rows } = await client.query('SELECT id FROM organizations WHERE id = $1', [organizationId]);
          if (rows.length === 0) return { zurueck: true, status: 404, body: GEMEINDE_FEHLT };
        }
        const notiz = hat('notiz') && typeof req.body.notiz === 'string' ? (req.body.notiz.trim() || null) : null;
        await client.query(
          `UPDATE support_vorgaenge SET
             art = CASE WHEN $2 THEN $3 ELSE art END,
             bereich = CASE WHEN $4 THEN $5 ELSE bereich END,
             dringlichkeit = CASE WHEN $6 THEN $7 ELSE dringlichkeit END,
             betreff = CASE WHEN $8 THEN $9 ELSE betreff END,
             organization_id = CASE WHEN $10 THEN $11::bigint ELSE organization_id END,
             notiz = CASE WHEN $12 THEN $13 ELSE notiz END,
             updated_at = NOW()
           WHERE id = $1`,
          [vorgangId,
            hat('art'), req.body.art ?? null,
            hat('bereich'), req.body.bereich ?? null,
            hat('dringlichkeit'), req.body.dringlichkeit ?? null,
            hat('betreff'), hat('betreff') ? einzeilig(req.body.betreff) : null,
            hat('organization_id'), organizationId,
            hat('notiz'), notiz]);
        if (hat('organization_id')) {
          const spalten = mailSpalten({ anfrage_id: v.anfrage_id, organization_id: organizationId });
          await client.query(
            'UPDATE mail_nachrichten SET anfrage_id = $2, organization_id = $3 WHERE vorgang_id = $1',
            [vorgangId, spalten.anfrage_id, spalten.organization_id]);
        }
        if (hat('notiz') && v.anfrage_id !== null) {
          await client.query('UPDATE gemeinde_anfragen SET notiz = $2 WHERE id = $1', [v.anfrage_id, notiz]);
        }
        if (hat('status')) await statusSetzen(client, vorgangId, req.body.status, { userId: req.user.id });
        await vorgangBewegt(client, vorgangId, { bearbeitetVon: req.user.id });
        return { status: 200 };
      });
      if (ergebnis.status !== 200) return res.status(ergebnis.status).json(ergebnis.body);
      res.json(await detail(db, vorgangId));
    } catch (err) {
      return fehlerAntwort(res, 'PATCH /support/vorgaenge/:id', err);
    }
  });

  // ==========================================================================
  // ANTWORTEN
  // ==========================================================================

  // POST /vorgaenge/:id/antworten { betreff?, text, an? } -> 201 { nachricht }.
  // Vom Postfach moin (Vorgang einer Anfrage) bzw. support, mit [Vorgang N]
  // im Betreff, an `an` (Empfaenger: im Kopf). Ein Vorgang "neu" geht auf
  // "in Arbeit".
  router.post('/vorgaenge/:id/antworten', [
    id, textFeld, betreffFeld(false), anFeld, handleValidationErrors,
  ], async (req, res) => {
    let gespeichert;
    try {
      const vorgangId = Number(req.params.id);
      const { rows: [v] } = await db.query(
        `SELECT v.id, v.betreff, v.anfrage_id, v.organization_id, v.kontakt_email, v.kontakt_name, a.gemeinde AS anfrage_gemeinde
           FROM support_vorgaenge v LEFT JOIN gemeinde_anfragen a ON a.id = v.anfrage_id
          WHERE v.id = $1`, [vorgangId]);
      if (!v) return res.status(404).json(VORGANG_FEHLT);
      const empfaenger = await empfaengerFuerVorgang(db, v);
      const gewuenscht = typeof req.body.an === 'string' ? req.body.an.trim().toLowerCase() : '';
      let an;
      if (gewuenscht) {
        if (!empfaenger.some((e) => e.adresse === gewuenscht)) {
          return res.status(400).json({ error: 'Diese Adresse gehört nicht zu den Empfängern dieses Vorgangs.' });
        }
        an = gewuenscht;
      } else if (empfaenger.length > 0) {
        an = empfaenger[0].adresse;
      } else {
        return res.status(400).json({ error: 'Für diesen Vorgang ist keine Empfängeradresse bekannt.' });
      }
      const { rows: [letzte] } = await db.query(
        `SELECT ${NACHRICHT_SPALTEN} FROM ${NACHRICHT_FROM}
          WHERE m.vorgang_id = $1 ORDER BY m.gesendet_am DESC, m.id DESC LIMIT 1`, [vorgangId]);
      gespeichert = await antwortSenden(db, {
        postfach: v.anfrage_id !== null ? 'moin' : 'support',
        an,
        betreff: req.body.betreff,
        text: req.body.text,
        vorgangId,
        bezug: letzte || null,
        standardBetreff: v.anfrage_gemeinde ? `Eure Anfrage für ${v.anfrage_gemeinde}` : v.betreff,
        verfasstVon: req.user.id,
      }, { nachlauf: { req, bezeichnung: 'Gesendet-Ordner (Vorgang)' } });
    } catch (err) {
      return fehlerAntwort(res, 'POST /support/vorgaenge/:id/antworten', err);
    }
    res.status(201).json({ nachricht: gespeichert });
  });

  // ==========================================================================
  // ARCHIVIEREN, WIEDERHERSTELLEN, LOESCHEN
  // ==========================================================================

  const archivRoute = (pfad, archivieren) => router.post(`/vorgaenge/:id/${pfad}`, [id, handleValidationErrors], async (req, res) => {
    const vorgangId = Number(req.params.id);
    try {
      const betroffen = await mitTransaktion((client) => vorgaengeArchivieren(client, [vorgangId], archivieren));
      if (betroffen.length === 0) return res.status(404).json(VORGANG_FEHLT);
      res.json(await detail(db, vorgangId));
    } catch (err) {
      return fehlerAntwort(res, `POST /support/vorgaenge/:id/${pfad}`, err);
    }
  });
  archivRoute('archivieren', true);
  archivRoute('wiederherstellen', false);

  // DELETE /vorgaenge/:id -- der Vorgang, seine Mails in Konfi Quest und eine
  // daran haengende Anfrage. Im Postfach bleibt alles.
  router.delete('/vorgaenge/:id', [id, handleValidationErrors], async (req, res) => {
    try {
      const geloescht = await mitTransaktion((client) => vorgaengeLoeschen(client, [Number(req.params.id)]));
      if (geloescht.length === 0) return res.status(404).json(VORGANG_FEHLT);
      res.json({ message: 'Vorgang gelöscht' });
    } catch (err) {
      return fehlerAntwort(res, 'DELETE /support/vorgaenge/:id', err);
    }
  });

  // ==========================================================================
  // SAMMELAKTIONEN
  // ==========================================================================

  // POST /vorgaenge/sammel { ids: [..], aktion, status? } -> { aktion, anzahl, ids }
  // ids: die tatsaechlich betroffenen Vorgaenge (unbekannte Kennungen werden
  // uebergangen), aufsteigend. aktion 'status' verlangt `status`.
  router.post('/vorgaenge/sammel', [
    body('ids').isArray({ min: 1, max: SAMMEL_MAX }).withMessage(`ids: Liste mit 1 bis ${SAMMEL_MAX} Kennungen`),
    body('ids.*').isInt({ min: 1 }).withMessage('Ungültige ID'),
    body('aktion').isIn(AKTIONEN).withMessage(`aktion: ${AKTIONEN.join(', ')}`),
    body('status').if(body('aktion').equals('status')).isIn(STATUS).withMessage(`status: ${STATUS.join(', ')}`),
    handleValidationErrors,
  ], async (req, res) => {
    const ids = [...new Set(req.body.ids.map(Number))];
    try {
      const betroffen = await mitTransaktion(async (client) => {
        switch (req.body.aktion) {
          case 'archivieren': return vorgaengeArchivieren(client, ids, true);
          case 'wiederherstellen': return vorgaengeArchivieren(client, ids, false);
          case 'loeschen': return vorgaengeLoeschen(client, ids);
          default: {
            const { rows } = await client.query('SELECT id FROM support_vorgaenge WHERE id = ANY($1::bigint[]) ORDER BY id', [ids]);
            for (const r of rows) await statusSetzen(client, r.id, req.body.status, { userId: req.user.id });
            return rows.map((r) => Number(r.id));
          }
        }
      });
      res.json({ aktion: req.body.aktion, anzahl: betroffen.length, ids: betroffen });
    } catch (err) {
      return fehlerAntwort(res, 'POST /support/vorgaenge/sammel', err);
    }
  });

  return router;
};

module.exports.empfaengerFuerVorgang = empfaengerFuerVorgang;
module.exports.LISTE_SPALTEN = LISTE_SPALTEN;
