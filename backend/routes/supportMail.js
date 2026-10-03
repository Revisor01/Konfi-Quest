// /api/support/... -- Support-Mail: Posteingang, Verlauf, Antworten,
// Textbausteine und Fusszeile (docs/planung/support-mail.md; Simon,
// 03.10.2026: "Ich muss auch auf eine Anfrage reagieren können etc. Deren
// Antwort richtig sortiert werden.").
//
// Eingehaengt in routes/support.js HINTER rbacVerifier und
// requireSuperAdmin: Alle Routen sind nur fuer Super-Admins (Rolle oder
// Merkmal, mit oder ohne Gemeinde); jede andere Rolle bekommt 403, ohne
// Anmeldung 401.
//
// Abholen: services/mailAbholung.js (Hintergrund, nur Cron-Leader).
// Zuordnen eingehender Mails: utils/mailZuordnung.js (eine Stelle).
// Versand: services/mailVersand.js.
//
// PROTOKOLL: Fehler nur mit Code und Meldung, nie err.detail und nie
// Inhalte oder Adressen der Mails.

const express = require('express');
const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');
const { nachAntwort } = require('../utils/nachAntwort');
const { allePostfaecher, POSTFAECHER } = require('../utils/mailPostfaecher');
const { einstellungenLesen, STANDARD_EINSTELLUNGEN } = require('../utils/mailEinstellungen');
const {
  auszug, fadenIds, nachrichtLaden, nachrichtenLaden, verlaufLaden,
} = require('../utils/mailNachrichten');
const { lizenzText } = require('../utils/lizenzen');
const { formatDatum } = require('../utils/zeitformat');
const { antwortSenden, VersandFehler, versandAufDiesemServer } = require('../services/mailVersand');

const TEXT_MAX = 20000;
const BETREFF_MAX = 300;
const TITEL_MAX = 200;
const FUSSZEILE_MAX = 2000;
const ABSENDERNAME_MAX = 100;
const GELESEN_MAX = 1000;
// Der Posteingang zeigt hoechstens so viele Mails (die neuesten). Nicht
// zugeordnete Mails bleiben 180 Tage; bei Werbung im Postfach "support"
// koennen das viele werden.
const EINGANG_MAX = 1000;

/** Fehler ins Protokoll: nur Code und Meldung. */
const protokolliere = (wo, err) => console.error(`${wo}: %s %s`, err.code || '', err.message);

const MAIL_FEHLT = { error: 'Mail nicht gefunden' };
const ANFRAGE_FEHLT = { error: 'Anfrage nicht gefunden' };
const GEMEINDE_FEHLT = { error: 'Gemeinde nicht gefunden' };
const BAUSTEIN_FEHLT = { error: 'Textbaustein nicht gefunden' };

const BAUSTEIN_SPALTEN = 'id, titel, betreff, text, postfach, sortierung, updated_at, bearbeitet_von';

/** Anzeigename einer Gemeinde (display_name, sonst name). */
const GEMEINDE_NAME = "COALESCE(NULLIF(btrim(o.display_name), ''), o.name)";

/**
 * Die erste Gemeindeleitung einer Gemeinde: aktives Konto mit der Rolle
 * org_admin in DIESER Gemeinde (beide Quellen der Zugehoerigkeit), ohne
 * Super-Admins (das ist der Support selbst); Stamm-Gemeinde vor weiterer,
 * dann das aelteste Konto.
 */
async function ersteGemeindeleitung(db, organizationId) {
  const { rows: [leitung] } = await db.query(
    `SELECT x.id, x.username, x.display_name FROM (
       SELECT u.id, u.username, u.display_name, 0 AS quelle
         FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.organization_id = $1 AND r.name = 'org_admin'
          AND u.is_active = true AND u.deleted_at IS NULL AND COALESCE(u.is_super_admin, false) = false
       UNION ALL
       SELECT u.id, u.username, u.display_name, 1 AS quelle
         FROM user_organizations uo
         JOIN users u ON u.id = uo.user_id
         JOIN roles r ON r.id = uo.role_id
        WHERE uo.organization_id = $1 AND r.name = 'org_admin'
          AND u.is_active = true AND u.deleted_at IS NULL AND COALESCE(u.is_super_admin, false) = false
     ) x
     ORDER BY x.quelle, x.id
     LIMIT 1`, [organizationId]);
  return leitung || null;
}

/**
 * Moegliche Empfaenger einer Mail an eine Gemeinde: Gemeindeleitungen und
 * Leitung mit Adresse (beide Quellen der Zugehoerigkeit, aktiv, ohne
 * Super-Admins), dazu die Absender aus dem Verlauf der Gemeinde. Jede
 * Adresse einmal (klein geschrieben), in dieser Reihenfolge.
 * @returns {Promise<Array<{adresse: string, name: string|null, herkunft: 'gemeindeleitung'|'leitung'|'verlauf'}>>}
 */
async function empfaengerLaden(db, organizationId) {
  const [{ rows: konten }, { rows: verlauf }] = await Promise.all([
    db.query(
      `SELECT lower(btrim(x.email)) AS adresse, x.display_name AS name, x.rolle FROM (
         SELECT u.id, u.email, u.display_name, r.name AS rolle
           FROM users u JOIN roles r ON r.id = u.role_id
          WHERE u.organization_id = $1
         UNION
         SELECT u.id, u.email, u.display_name, r.name AS rolle
           FROM user_organizations uo
           JOIN users u ON u.id = uo.user_id
           JOIN roles r ON r.id = uo.role_id
          WHERE uo.organization_id = $1
       ) x
       JOIN users u ON u.id = x.id
      WHERE x.rolle IN ('org_admin', 'admin')
        AND NULLIF(btrim(x.email), '') IS NOT NULL
        AND u.is_active = true AND u.deleted_at IS NULL AND COALESCE(u.is_super_admin, false) = false
      ORDER BY CASE x.rolle WHEN 'org_admin' THEN 0 ELSE 1 END, lower(x.display_name), x.id`, [organizationId]),
    db.query(
      `SELECT m.von_adresse AS adresse, m.von_name AS name, MAX(m.gesendet_am) AS zuletzt
         FROM mail_nachrichten m
        WHERE m.organization_id = $1 AND m.richtung = 'ein' AND NULLIF(btrim(m.von_adresse), '') IS NOT NULL
        GROUP BY m.von_adresse, m.von_name
        ORDER BY zuletzt DESC`, [organizationId]),
  ]);
  const ergebnis = [];
  const gesehen = new Set();
  for (const k of konten) {
    if (gesehen.has(k.adresse)) continue;
    gesehen.add(k.adresse);
    ergebnis.push({ adresse: k.adresse, name: k.name || null, herkunft: k.rolle === 'org_admin' ? 'gemeindeleitung' : 'leitung' });
  }
  for (const v of verlauf) {
    const adresse = String(v.adresse).trim().toLowerCase();
    if (gesehen.has(adresse)) continue;
    gesehen.add(adresse);
    ergebnis.push({ adresse, name: v.name || null, herkunft: 'verlauf' });
  }
  return ergebnis;
}

/** Fehler des Versands als Antwort. */
function versandFehlerAntwort(res, wo, err) {
  if (err instanceof VersandFehler) return res.status(err.status).json({ error: err.message });
  protokolliere(wo, err);
  return res.status(500).json({ error: 'Datenbankfehler' });
}

module.exports = (db) => {
  const router = express.Router();

  const id = param('id').isInt({ min: 1 }).withMessage('Ungültige ID');
  const textFeld = body('text')
    .isString().withMessage('Text ist erforderlich').bail()
    .trim().notEmpty().withMessage('Text ist erforderlich').bail()
    .isLength({ max: TEXT_MAX }).withMessage(`Höchstens ${TEXT_MAX} Zeichen`);
  const betreffFeld = body('betreff').optional({ values: 'null' })
    .isString().withMessage('Text erwartet').bail()
    .isLength({ max: BETREFF_MAX }).withMessage(`Höchstens ${BETREFF_MAX} Zeichen`);
  const postfachFeld = (feld) => body(feld).optional({ values: 'null' })
    .isIn(POSTFAECHER).withMessage(`postfach: ${POSTFAECHER.join(', ')} oder null`);

  // ==========================================================================
  // ZUSTAND UND ZAEHLER
  // ==========================================================================

  // GET /mail/status -- je Postfach: Adresse, eingerichtet, letzter Abruf und
  // letzter Fehler. auf_diesem_server (zusaetzlich zum Vertrag): false auf
  // einem Server mit RUN_BACKGROUND_JOBS=false -- dort wird weder abgeholt
  // noch gesendet.
  router.get('/mail/status', async (req, res) => {
    try {
      const { rows } = await db.query('SELECT postfach, abgeholt_am, fehler, fehler_am FROM mail_abholstand');
      const stand = new Map(rows.map((r) => [r.postfach, r]));
      const aufDiesemServer = versandAufDiesemServer();
      res.json({
        postfaecher: allePostfaecher().map((k) => {
          const s = stand.get(k.postfach) || {};
          return {
            postfach: k.postfach,
            adresse: k.adresse,
            eingerichtet: k.eingerichtet,
            abgeholt_am: s.abgeholt_am || null,
            fehler: s.fehler || null,
            fehler_am: s.fehler_am || null,
            auf_diesem_server: aufDiesemServer,
          };
        }),
      });
    } catch (err) {
      protokolliere('GET /support/mail/status', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // GET /mail/zaehler -- ungelesene eingehende Mails.
  router.get('/mail/zaehler', async (req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT anfrage_id, organization_id, COUNT(*)::int AS n
           FROM mail_nachrichten
          WHERE richtung = 'ein' AND gelesen_am IS NULL
          GROUP BY anfrage_id, organization_id`);
      const ergebnis = { anfragen: 0, gemeinden: 0, eingang: 0, je_anfrage: {}, je_gemeinde: {} };
      for (const r of rows) {
        if (r.anfrage_id !== null) {
          ergebnis.anfragen += r.n;
          ergebnis.je_anfrage[r.anfrage_id] = r.n;
        } else if (r.organization_id !== null) {
          ergebnis.gemeinden += r.n;
          ergebnis.je_gemeinde[r.organization_id] = r.n;
        } else {
          ergebnis.eingang += r.n;
        }
      }
      res.json(ergebnis);
    } catch (err) {
      protokolliere('GET /support/mail/zaehler', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // ==========================================================================
  // POSTEINGANG UND MAILS
  // ==========================================================================

  // GET /mail/eingang?postfach= -- nicht zugeordnete eingehende Mails,
  // neueste zuerst (hoechstens EINGANG_MAX).
  router.get('/mail/eingang', [
    query('postfach').optional().isIn(POSTFAECHER).withMessage(`postfach: ${POSTFAECHER.join(', ')}`),
    handleValidationErrors,
  ], async (req, res) => {
    try {
      const params = [EINGANG_MAX];
      let filter = '';
      if (req.query.postfach) {
        params.push(req.query.postfach);
        filter = 'AND m.postfach = $2';
      }
      const { rows } = await db.query(
        `SELECT m.id, m.postfach, m.von_adresse, m.von_name, m.betreff, m.text, m.gesendet_am, m.gelesen_am, m.anhaenge
           FROM mail_nachrichten m
          WHERE m.anfrage_id IS NULL AND m.organization_id IS NULL AND m.richtung = 'ein' ${filter}
          ORDER BY m.gesendet_am DESC, m.id DESC
          LIMIT $1`, params);
      res.json(rows.map(({ text, ...m }) => ({
        id: m.id,
        postfach: m.postfach,
        von_adresse: m.von_adresse,
        von_name: m.von_name,
        betreff: m.betreff,
        auszug: auszug(text),
        gesendet_am: m.gesendet_am,
        gelesen_am: m.gelesen_am,
        anhaenge: m.anhaenge,
      })));
    } catch (err) {
      protokolliere('GET /support/mail/eingang', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // GET /mail/nachrichten/:id -- die Mail mit allen Feldern und `verlauf`:
  // alle Mails desselben Fadens (sie selbst eingeschlossen), aelteste zuerst.
  router.get('/mail/nachrichten/:id', [id, handleValidationErrors], async (req, res) => {
    try {
      const mail = await nachrichtLaden(db, Number(req.params.id));
      if (!mail) return res.status(404).json(MAIL_FEHLT);
      const verlauf = await nachrichtenLaden(db, await fadenIds(db, mail.id));
      res.json({ ...mail, verlauf });
    } catch (err) {
      protokolliere('GET /support/mail/nachrichten/:id', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // POST /mail/gelesen { ids } -- gelesen_am fuer eingehende Mails ohne
  // Datum; ausgehende und schon gelesene bleiben. Antwort { gelesen: n }.
  router.post('/mail/gelesen', [
    body('ids').isArray({ min: 1, max: GELESEN_MAX }).withMessage(`ids: Liste mit 1 bis ${GELESEN_MAX} Kennungen`),
    body('ids.*').isInt({ min: 1 }).withMessage('Ungültige ID'),
    handleValidationErrors,
  ], async (req, res) => {
    try {
      const { rowCount } = await db.query(
        `UPDATE mail_nachrichten SET gelesen_am = NOW()
          WHERE id = ANY($1::bigint[]) AND richtung = 'ein' AND gelesen_am IS NULL`,
        [req.body.ids.map(Number)]);
      res.json({ gelesen: rowCount });
    } catch (err) {
      protokolliere('POST /support/mail/gelesen', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // POST /mail/nachrichten/:id/zuordnen { anfrage_id } | { organization_id }
  // | {} -- der ganze Faden zur Anfrage, zur Gemeinde oder zurueck in den
  // Posteingang. Zu einer Anfrage zaehlt das als Bewegung (updated_at).
  // Antwort { anzahl, anfrage_id, organization_id, ids }.
  router.post('/mail/nachrichten/:id/zuordnen', [
    id,
    body('anfrage_id').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Ungültige Anfrage'),
    body('organization_id').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Ungültige Gemeinde'),
    handleValidationErrors,
  ], async (req, res) => {
    const anfrageId = req.body.anfrage_id == null ? null : Number(req.body.anfrage_id);
    const organizationId = req.body.organization_id == null ? null : Number(req.body.organization_id);
    if (anfrageId !== null && organizationId !== null) {
      return res.status(400).json({ error: 'Entweder anfrage_id oder organization_id angeben, nicht beides.' });
    }
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const ids = await fadenIds(client, Number(req.params.id));
      if (ids.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json(MAIL_FEHLT);
      }
      if (anfrageId !== null) {
        const { rows } = await client.query('SELECT id FROM gemeinde_anfragen WHERE id = $1 FOR UPDATE', [anfrageId]);
        if (rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json(ANFRAGE_FEHLT);
        }
      }
      if (organizationId !== null) {
        const { rows } = await client.query('SELECT id FROM organizations WHERE id = $1', [organizationId]);
        if (rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json(GEMEINDE_FEHLT);
        }
      }
      const { rowCount } = await client.query(
        'UPDATE mail_nachrichten SET anfrage_id = $2, organization_id = $3 WHERE id = ANY($1::bigint[])',
        [ids, anfrageId, organizationId]);
      if (anfrageId !== null) {
        await client.query('UPDATE gemeinde_anfragen SET updated_at = NOW() WHERE id = $1', [anfrageId]);
      }
      await client.query('COMMIT');
      res.json({ anzahl: rowCount, anfrage_id: anfrageId, organization_id: organizationId, ids });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      protokolliere('POST /support/mail/nachrichten/:id/zuordnen', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    } finally {
      client.release();
    }
  });

  // POST /mail/nachrichten/:id/antworten { text, betreff? } -- Antwort auf
  // eine eingehende Mail an ihren Absender, vom selben Postfach. Die Antwort
  // bekommt die Zuordnung der Mail (Posteingang bleibt Posteingang).
  router.post('/mail/nachrichten/:id/antworten', [id, textFeld, betreffFeld, handleValidationErrors], async (req, res) => {
    let gespeichert;
    try {
      const mail = await nachrichtLaden(db, Number(req.params.id));
      if (!mail) return res.status(404).json(MAIL_FEHLT);
      if (mail.richtung !== 'ein') {
        return res.status(400).json({ error: 'Antworten geht nur auf eingehende Mails.' });
      }
      if (!mail.von_adresse) {
        return res.status(400).json({ error: 'Die Mail hat keinen Absender, an den die Antwort gehen könnte.' });
      }
      gespeichert = await antwortSenden(db, {
        postfach: mail.postfach,
        an: mail.von_adresse,
        betreff: req.body.betreff,
        text: req.body.text,
        anfrageId: mail.anfrage_id,
        organizationId: mail.organization_id,
        bezug: mail,
        standardBetreff: mail.betreff,
        verfasstVon: req.user.id,
      }, { danach: (arbeit) => nachAntwort(req, arbeit, 'Gesendet-Ordner (Posteingang)') });
    } catch (err) {
      return versandFehlerAntwort(res, 'POST /support/mail/nachrichten/:id/antworten', err);
    }
    res.status(201).json({ nachricht: gespeichert });
  });

  // ==========================================================================
  // VERLAUF UND ANTWORTEN: ANFRAGEN
  // ==========================================================================

  router.get('/anfragen/:id/verlauf', [id, handleValidationErrors], async (req, res) => {
    try {
      const anfrageId = Number(req.params.id);
      const { rows } = await db.query('SELECT id FROM gemeinde_anfragen WHERE id = $1', [anfrageId]);
      if (rows.length === 0) return res.status(404).json(ANFRAGE_FEHLT);
      res.json(await verlaufLaden(db, { anfrageId }));
    } catch (err) {
      protokolliere('GET /support/anfragen/:id/verlauf', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // POST /anfragen/:id/antworten { text, betreff? } -> 201 { nachricht }.
  // Vom Postfach "moin" an die Adresse der Anfrage.
  router.post('/anfragen/:id/antworten', [id, textFeld, betreffFeld, handleValidationErrors], async (req, res) => {
    let gespeichert;
    try {
      const anfrageId = Number(req.params.id);
      const { rows: [anfrage] } = await db.query(
        'SELECT id, gemeinde, email FROM gemeinde_anfragen WHERE id = $1', [anfrageId]);
      if (!anfrage) return res.status(404).json(ANFRAGE_FEHLT);
      const verlauf = await verlaufLaden(db, { anfrageId });
      gespeichert = await antwortSenden(db, {
        postfach: 'moin',
        an: anfrage.email,
        betreff: req.body.betreff,
        text: req.body.text,
        anfrageId,
        bezug: verlauf.length > 0 ? verlauf[verlauf.length - 1] : null,
        standardBetreff: `Eure Anfrage für ${anfrage.gemeinde}`,
        verfasstVon: req.user.id,
      }, { danach: (arbeit) => nachAntwort(req, arbeit, 'Gesendet-Ordner (Anfrage)') });
    } catch (err) {
      return versandFehlerAntwort(res, 'POST /support/anfragen/:id/antworten', err);
    }
    res.status(201).json({ nachricht: gespeichert });
  });

  // ==========================================================================
  // VERLAUF UND ANTWORTEN: GEMEINDEN
  // ==========================================================================

  const gemeindeLaden = async (organizationId) => {
    const { rows: [g] } = await db.query(
      `SELECT o.id, ${GEMEINDE_NAME} AS name, o.trial_ends_at FROM organizations o WHERE o.id = $1`, [organizationId]);
    return g || null;
  };

  router.get('/gemeinden/:id/verlauf', [id, handleValidationErrors], async (req, res) => {
    try {
      const organizationId = Number(req.params.id);
      if (!(await gemeindeLaden(organizationId))) return res.status(404).json(GEMEINDE_FEHLT);
      res.json(await verlaufLaden(db, { organizationId }));
    } catch (err) {
      protokolliere('GET /support/gemeinden/:id/verlauf', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // GET /gemeinden/:id/empfaenger -> [{ adresse, name, herkunft }]
  router.get('/gemeinden/:id/empfaenger', [id, handleValidationErrors], async (req, res) => {
    try {
      const organizationId = Number(req.params.id);
      if (!(await gemeindeLaden(organizationId))) return res.status(404).json(GEMEINDE_FEHLT);
      res.json(await empfaengerLaden(db, organizationId));
    } catch (err) {
      protokolliere('GET /support/gemeinden/:id/empfaenger', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // POST /gemeinden/:id/antworten { an, text, betreff? } -> 201 { nachricht }.
  // Vom Postfach "support"; `an` muss unter den Empfaengern stehen.
  router.post('/gemeinden/:id/antworten', [
    id,
    body('an').isString().withMessage('Empfänger ist erforderlich').bail()
      .trim().notEmpty().withMessage('Empfänger ist erforderlich').bail()
      .isLength({ max: 320 }).withMessage('Ungültiger Empfänger'),
    textFeld,
    betreffFeld,
    handleValidationErrors,
  ], async (req, res) => {
    let gespeichert;
    try {
      const organizationId = Number(req.params.id);
      const gemeinde = await gemeindeLaden(organizationId);
      if (!gemeinde) return res.status(404).json(GEMEINDE_FEHLT);
      const an = req.body.an.trim().toLowerCase();
      const empfaenger = await empfaengerLaden(db, organizationId);
      if (!empfaenger.some((e) => e.adresse === an)) {
        return res.status(400).json({ error: 'Diese Adresse gehört nicht zu den Empfängern dieser Gemeinde.' });
      }
      const verlauf = await verlaufLaden(db, { organizationId });
      gespeichert = await antwortSenden(db, {
        postfach: 'support',
        an,
        betreff: req.body.betreff,
        text: req.body.text,
        organizationId,
        bezug: verlauf.length > 0 ? verlauf[verlauf.length - 1] : null,
        standardBetreff: `Konfi Quest – ${gemeinde.name}`,
        verfasstVon: req.user.id,
      }, { danach: (arbeit) => nachAntwort(req, arbeit, 'Gesendet-Ordner (Gemeinde)') });
    } catch (err) {
      return versandFehlerAntwort(res, 'POST /support/gemeinden/:id/antworten', err);
    }
    res.status(201).json({ nachricht: gespeichert });
  });

  // ==========================================================================
  // PLATZHALTER
  // ==========================================================================

  // GET /mail/platzhalter?anfrage_id= bzw. ?organization_id= ->
  // { name, gemeinde, lizenz, testphase_bis, benutzername, absender };
  // was es nicht gibt, ist ein leerer Text.
  router.get('/mail/platzhalter', [
    query('anfrage_id').optional().isInt({ min: 1 }).withMessage('Ungültige Anfrage'),
    query('organization_id').optional().isInt({ min: 1 }).withMessage('Ungültige Gemeinde'),
    handleValidationErrors,
  ], async (req, res) => {
    const mitAnfrage = req.query.anfrage_id !== undefined;
    const mitGemeinde = req.query.organization_id !== undefined;
    if (mitAnfrage === mitGemeinde) {
      return res.status(400).json({ error: 'Genau eines angeben: anfrage_id oder organization_id.' });
    }
    try {
      const { absendername } = await einstellungenLesen(db);
      const datum = (wert) => (wert ? formatDatum(wert, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
      let name = '';
      let gemeindeName = '';
      let lizenz = '';
      let organizationId = null;

      if (mitAnfrage) {
        const { rows: [anfrage] } = await db.query(
          'SELECT kontakt_name, gemeinde, wunsch_lizenz, organization_id FROM gemeinde_anfragen WHERE id = $1',
          [Number(req.query.anfrage_id)]);
        if (!anfrage) return res.status(404).json(ANFRAGE_FEHLT);
        name = anfrage.kontakt_name || '';
        gemeindeName = anfrage.gemeinde || '';
        lizenz = lizenzText(anfrage.wunsch_lizenz);
        organizationId = anfrage.organization_id;
      } else {
        organizationId = Number(req.query.organization_id);
        const { rows: [wunsch] } = await db.query(
          `SELECT wunsch_lizenz FROM gemeinde_anfragen WHERE organization_id = $1
            ORDER BY status_seit DESC, id DESC LIMIT 1`, [organizationId]);
        lizenz = lizenzText(wunsch && wunsch.wunsch_lizenz);
      }

      let testphaseBis = '';
      let benutzername = '';
      if (organizationId !== null) {
        const gemeinde = await gemeindeLaden(organizationId);
        if (!gemeinde && mitGemeinde) return res.status(404).json(GEMEINDE_FEHLT);
        if (gemeinde) {
          if (mitGemeinde) gemeindeName = gemeinde.name || '';
          testphaseBis = datum(gemeinde.trial_ends_at);
          const leitung = await ersteGemeindeleitung(db, organizationId);
          if (leitung) {
            benutzername = leitung.username || '';
            if (mitGemeinde) name = leitung.display_name || '';
          }
        }
      }

      res.json({
        name, gemeinde: gemeindeName, lizenz, testphase_bis: testphaseBis, benutzername, absender: absendername,
      });
    } catch (err) {
      protokolliere('GET /support/mail/platzhalter', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // ==========================================================================
  // TEXTBAUSTEINE
  // ==========================================================================

  router.get('/mail/bausteine', async (req, res) => {
    try {
      const { rows } = await db.query(`SELECT ${BAUSTEIN_SPALTEN} FROM mail_bausteine ORDER BY sortierung, id`);
      res.json(rows);
    } catch (err) {
      protokolliere('GET /support/mail/bausteine', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  const titelFeld = body('titel')
    .isString().withMessage('Titel ist erforderlich').bail()
    .trim().notEmpty().withMessage('Titel ist erforderlich').bail()
    .isLength({ max: TITEL_MAX }).withMessage(`Höchstens ${TITEL_MAX} Zeichen`);
  const sortierungFeld = body('sortierung').optional({ values: 'null' })
    .isInt({ min: -1000000, max: 1000000 }).withMessage('Sortierung: ganze Zahl');
  const bausteinFelder = [titelFeld, textFeld, betreffFeld, postfachFeld('postfach'), sortierungFeld];

  /** Betreff eines Bausteins: leer = null. */
  const bausteinBetreff = (wert) => (typeof wert === 'string' && wert.trim() !== '' ? wert.trim() : null);

  // POST /mail/bausteine { titel, text, betreff?, postfach?, sortierung? } -> 201
  router.post('/mail/bausteine', [...bausteinFelder, handleValidationErrors], async (req, res) => {
    try {
      const sortierung = req.body.sortierung == null
        ? (await db.query('SELECT COALESCE(MAX(sortierung), 0) + 10 AS n FROM mail_bausteine')).rows[0].n
        : Number(req.body.sortierung);
      const { rows: [neu] } = await db.query(
        `INSERT INTO mail_bausteine (titel, betreff, text, postfach, sortierung, bearbeitet_von)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${BAUSTEIN_SPALTEN}`,
        [req.body.titel, bausteinBetreff(req.body.betreff), req.body.text, req.body.postfach ?? null, sortierung, req.user.id]);
      res.status(201).json(neu);
    } catch (err) {
      protokolliere('POST /support/mail/bausteine', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // PUT /mail/bausteine/:id { titel, text, betreff?, postfach?, sortierung? }
  // -- titel und text immer; betreff, postfach und sortierung nur, wenn
  // mitgeschickt (null leert betreff und postfach).
  router.put('/mail/bausteine/:id', [id, ...bausteinFelder, handleValidationErrors], async (req, res) => {
    const hat = (feld) => Object.prototype.hasOwnProperty.call(req.body, feld);
    try {
      const { rows: [geaendert] } = await db.query(
        `UPDATE mail_bausteine SET
           titel = $2, text = $3,
           betreff = CASE WHEN $4 THEN $5 ELSE betreff END,
           postfach = CASE WHEN $6 THEN $7 ELSE postfach END,
           sortierung = CASE WHEN $8 THEN $9::int ELSE sortierung END,
           updated_at = NOW(), bearbeitet_von = $10
         WHERE id = $1
         RETURNING ${BAUSTEIN_SPALTEN}`,
        [Number(req.params.id), req.body.titel, req.body.text,
          hat('betreff'), bausteinBetreff(req.body.betreff),
          hat('postfach'), req.body.postfach ?? null,
          hat('sortierung') && req.body.sortierung != null, req.body.sortierung == null ? null : Number(req.body.sortierung),
          req.user.id]);
      if (!geaendert) return res.status(404).json(BAUSTEIN_FEHLT);
      res.json(geaendert);
    } catch (err) {
      protokolliere('PUT /support/mail/bausteine/:id', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  router.delete('/mail/bausteine/:id', [id, handleValidationErrors], async (req, res) => {
    try {
      const { rowCount } = await db.query('DELETE FROM mail_bausteine WHERE id = $1', [Number(req.params.id)]);
      if (rowCount === 0) return res.status(404).json(BAUSTEIN_FEHLT);
      res.json({ message: 'Textbaustein gelöscht' });
    } catch (err) {
      protokolliere('DELETE /support/mail/bausteine/:id', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // ==========================================================================
  // EINSTELLUNGEN: Fusszeile und Absendername
  // ==========================================================================

  router.get('/mail/einstellungen', async (req, res) => {
    try {
      res.json(await einstellungenLesen(db));
    } catch (err) {
      protokolliere('GET /support/mail/einstellungen', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // PUT /mail/einstellungen { fusszeile?, absendername? } -> { fusszeile, absendername }
  // Die Fusszeile darf leer sein (dann keine); der Absendername nicht, und er
  // ist einzeilig (er steht in der Kopfzeile From).
  router.put('/mail/einstellungen', [
    body('fusszeile').optional()
      .isString().withMessage('Text erwartet').bail()
      .isLength({ max: FUSSZEILE_MAX }).withMessage(`Höchstens ${FUSSZEILE_MAX} Zeichen`),
    body('absendername').optional()
      .isString().withMessage('Text erwartet').bail()
      .trim().notEmpty().withMessage('Absendername ist erforderlich').bail()
      .isLength({ max: ABSENDERNAME_MAX }).withMessage(`Höchstens ${ABSENDERNAME_MAX} Zeichen`).bail()
      .custom((wert) => !/[\r\n]/.test(wert)).withMessage('Absendername in einer Zeile'),
    handleValidationErrors,
  ], async (req, res) => {
    const werte = Object.keys(STANDARD_EINSTELLUNGEN)
      .filter((k) => Object.prototype.hasOwnProperty.call(req.body, k))
      .map((k) => [k, k === 'fusszeile' ? req.body[k].replace(/\r\n?/g, '\n').trim() : req.body[k]]);
    if (werte.length === 0) {
      return res.status(400).json({ error: 'Nichts zu ändern: fusszeile oder absendername angeben' });
    }
    try {
      for (const [schluessel, wert] of werte) {
        await db.query(
          `INSERT INTO mail_einstellungen (schluessel, wert, updated_at, bearbeitet_von)
           VALUES ($1, $2, NOW(), $3)
           ON CONFLICT (schluessel) DO UPDATE SET wert = EXCLUDED.wert, updated_at = NOW(), bearbeitet_von = EXCLUDED.bearbeitet_von`,
          [schluessel, wert, req.user.id]);
      }
      res.json(await einstellungenLesen(db));
    } catch (err) {
      protokolliere('PUT /support/mail/einstellungen', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  return router;
};

module.exports.ersteGemeindeleitung = ersteGemeindeleitung;
module.exports.empfaengerLaden = empfaengerLaden;
