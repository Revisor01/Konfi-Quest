// /api/support -- die Support-Ansicht der Web-Version (03.10.2026).
//
// Simons Entscheidungen vom 02.10.2026 (docs/planung/web-version.md, Punkte
// 3 bis 7 und 10): eine Ansicht fuer Simon und eine Support-Person, beide mit
// Super-Admin-Recht (mit oder ohne Gemeinde). Hier:
//
//   - ANFRAGEN vom Formular auf konfi-quest.de (eingehend ueber
//     POST /api/anfragen, routes/anfragen.js): auflisten, Status und Notiz
//     setzen, in eine Gemeinde samt erster Gemeindeleitung umwandeln --
//     mit DERSELBEN Funktion wie POST /organizations
//     (utils/gemeindeAnlegen.js), in einer Transaktion mit dem Status der
//     Anfrage.
//   - STRUKTUR: Landeskirchen und Kirchenkreise (Migration 191). Gemeinde
//     zuerst -- sie sind Zuordnungen an der Gemeinde fuer die Statistik,
//     Verwaltungsrechte fuer die oberen Ebenen gibt es nicht. Die Zuordnung
//     selbst setzt PUT /organizations/:id (kirchenkreis_id); die Regel fuer
//     die alte Textspalte steht in utils/kirchenkreisZuordnung.js.
//   - STATISTIK je Gemeinde: Konten je Rolle (beide Quellen der
//     Zugehoerigkeit, utils/orgMitglieder.js), aktive Konten, Jahrgaenge.
//     Ohne Namen von Personen; zusammengefasst je Kirchenkreis und
//     Landeskirche wird in der Oberflaeche.
//   - SUPPORT-MAIL (routes/supportMail.js, hier eingehaengt): Posteingang,
//     Verlauf und Antworten zu Anfragen und Gemeinden, Textbausteine,
//     Fusszeile (docs/planung/support-mail.md).
//   - VORGAENGE (routes/supportVorgaenge.js, hier eingehaengt): jede Anfrage,
//     Mail und jedes Anliegen aus dem Formular der Homepage ist ein Vorgang
//     mit Art, Bereich, Dringlichkeit, Status, Gemeinde und Verlauf; Liste,
//     Detail, Einordnen, Antworten, Archivieren, Loeschen, Sammelaktionen
//     (docs/planung/support-vorgaenge.md). Die Routen der Anfragen oben
//     bleiben; ihr Status und der Status des Vorgangs gehen gemeinsam.
//   - UEBERSICHT und GEMEINDEN (routes/supportUebersicht.js, hier
//     eingehaengt): das Dashboard der Web-Ansicht und die Liste der Gemeinden
//     mit ihrer Gemeindeleitung (docs/planung/support-web.md).
//
// INTERNE GEMEINDEN (organizations.intern, Migration 194): Die Review- und
// Test-Gemeinden fuer die Stores erscheinen in keiner Liste und keiner Zahl
// der Support-Ansicht -- Statistik, Zaehlungen an den Kirchenkreisen, Uebersicht
// und Gemeindeliste lassen sie weg. Zugriffe ueber die Kennung bleiben
// moeglich; Mails werden nicht nach `intern` gefiltert.
//
// NUR SUPER-ADMINS (requireSuperAdmin: Rolle oder Merkmal, mit oder ohne
// Gemeinde). Jede andere Rolle bekommt 403, auch die Gemeindeleitung.
//
// PROTOKOLL: Fehler nur mit Code und Meldung, nie err.detail (nennt bei
// einem CHECK oder UNIQUE die Zeile samt Kontaktdaten der Anfrage).

const express = require('express');
const bcrypt = require('bcrypt');
const { body, param, query } = require('express-validator');
const { handleValidationErrors, benutzernameRegel } = require('../middleware/validation');
const { validatePassword } = require('../utils/passwordUtils');
const liveUpdate = require('../utils/liveUpdate');
const { gemeindeAnlegen, konfiLimitLesen, laufzeitLesen, fehlerAlsAntwort } = require('../utils/gemeindeAnlegen');
const {
  umlauteUmschreiben, systemnameFuerNeueGemeinde, systemnameAusAnzeigename,
} = require('../utils/gemeindeSystemname');
const { kirchenkreisIdGueltig } = require('../utils/kirchenkreisZuordnung');
const { zaehleKontenJeGemeinde } = require('../utils/orgMitglieder');
const { ANFRAGE_SPALTEN } = require('../utils/mailNachrichten');
const { vorgangFolgtAnfrage } = require('../utils/supportVorgaenge');

const STATUS = ['neu', 'in_arbeit', 'angelegt', 'abgelehnt'];

// Die Felder einer Anfrage in der Antwort: utils/mailNachrichten.js, ANFRAGE_SPALTEN.
const ANFRAGE = ANFRAGE_SPALTEN;

const NICHT_GEFUNDEN = { error: 'Anfrage nicht gefunden' };
const MELDUNG_SCHON_ANGELEGT = 'Aus dieser Anfrage ist schon eine Gemeinde entstanden.';
const NAME_MAX = 200;

/** Fehler ins Protokoll: nur Code und Meldung. */
const protokolliere = (wo, err) => console.error(`${wo}: %s %s`, err.code || '', err.message);

/**
 * Systemname der neuen Gemeinde (organizations.name und .slug).
 *
 * Mit display_name ist `name` der Systemname, wie bei POST /organizations
 * (die App bildet ihn aus dem Anzeigenamen) -- dieselbe Regel
 * systemnameFuerNeueGemeinde. Ohne display_name ist `name` der Name der
 * Gemeinde, wie er im Formular steht; ebenso, wenn `name` nicht wie ein
 * Systemname aussieht (Leerzeichen, Grossbuchstaben ...). Dann entsteht der
 * Systemname aus dem Anzeigenamen (Umlaute als ae/oe/ue/ss).
 */
function systemnameFuerAnlage(name, anzeigename, mitAnzeigename) {
  if (mitAnzeigename && /^[a-z0-9-]+$/.test(umlauteUmschreiben(name))) {
    return systemnameFuerNeueGemeinde(name, anzeigename);
  }
  return systemnameAusAnzeigename(anzeigename);
}

module.exports = (db, rbacVerifier, { requireSuperAdmin }) => {
  const router = express.Router();
  router.use(rbacVerifier, requireSuperAdmin);

  // Support-Mail -- hinter derselben Pruefung (nur Super-Admin).
  router.use(require('./supportMail')(db));

  // Uebersicht und Gemeindeliste -- ebenso (nur Super-Admin).
  router.use(require('./supportUebersicht')(db));

  // Vorgaenge (docs/planung/support-vorgaenge.md) -- ebenso (nur Super-Admin).
  router.use(require('./supportVorgaenge')(db));

  const id = param('id').isInt({ min: 1 }).withMessage('Ungültige ID');
  const nameFeld = (feld = 'name') => body(feld)
    .isString().withMessage('Name ist erforderlich').bail()
    .trim().notEmpty().withMessage('Name ist erforderlich').bail()
    .isLength({ max: NAME_MAX }).withMessage(`Höchstens ${NAME_MAX} Zeichen`);
  const verweis = (feld, meldung) => body(feld).optional({ values: 'null' })
    .custom(kirchenkreisIdGueltig).withMessage(meldung);

  // ========================================================================
  // ANFRAGEN
  // ========================================================================

  // GET /anfragen?status= -- neueste zuerst.
  router.get('/anfragen', [
    query('status').optional().isIn(STATUS).withMessage(`status: ${STATUS.join(', ')}`),
    handleValidationErrors,
  ], async (req, res) => {
    try {
      const params = [];
      let filter = '';
      if (req.query.status) {
        params.push(req.query.status);
        filter = 'WHERE a.status = $1';
      }
      const { rows } = await db.query(
        `SELECT ${ANFRAGE} FROM gemeinde_anfragen a ${filter} ORDER BY a.created_at DESC, a.id DESC`, params);
      res.json(rows);
    } catch (err) {
      protokolliere('GET /support/anfragen', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // PATCH /anfragen/:id { status?, notiz? } -- das Objekt. status_seit
  // laeuft neu, wenn sich der Status aendert (Frist fuer abgelehnte,
  // BackgroundService.cleanupAbgelehnteAnfragen). Eine Anfrage, aus der eine
  // Gemeinde entstanden ist, behaelt den Status "angelegt" (409); die Notiz
  // bleibt aenderbar.
  router.patch('/anfragen/:id', [
    id,
    body('status').optional().isIn(STATUS).withMessage(`status: ${STATUS.join(', ')}`),
    body('notiz').optional({ values: 'null' }).isString().withMessage('Text erwartet').bail()
      .isLength({ max: 5000 }).withMessage('Höchstens 5000 Zeichen'),
    handleValidationErrors,
  ], async (req, res) => {
    const hat = (feld) => Object.prototype.hasOwnProperty.call(req.body, feld);
    if (!hat('status') && !hat('notiz')) {
      return res.status(400).json({ error: 'Nichts zu ändern: status oder notiz angeben' });
    }
    const anfrageId = Number(req.params.id);
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const { rows: [jetzt] } = await client.query(
        'SELECT status, organization_id FROM gemeinde_anfragen WHERE id = $1 FOR UPDATE', [anfrageId]);
      if (!jetzt) {
        await client.query('ROLLBACK');
        return res.status(404).json(NICHT_GEFUNDEN);
      }
      if (hat('status') && jetzt.status === 'angelegt' && jetzt.organization_id !== null
          && req.body.status !== 'angelegt') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `${MELDUNG_SCHON_ANGELEGT} Der Status bleibt „angelegt".` });
      }
      const notiz = typeof req.body.notiz === 'string' ? (req.body.notiz.trim() || null) : null;
      const { rows: [anfrage] } = await client.query(
        `UPDATE gemeinde_anfragen AS a SET
           status = CASE WHEN $2 THEN $3 ELSE a.status END,
           status_seit = CASE WHEN $2 AND a.status <> $3 THEN NOW() ELSE a.status_seit END,
           notiz = CASE WHEN $4 THEN $5 ELSE a.notiz END,
           bearbeitet_von = $6,
           updated_at = NOW()
         WHERE a.id = $1
         RETURNING ${ANFRAGE}`,
        [anfrageId, hat('status'), hat('status') ? req.body.status : 'neu', hat('notiz'), notiz, req.user.id]
      );
      // Der Vorgang der Anfrage folgt: neu/in Arbeit bleiben offen, angelegt
      // und abgelehnt sind erledigt (Archiv); die Notiz folgt ebenfalls.
      await vorgangFolgtAnfrage(client, anfrageId);
      await client.query('COMMIT');
      res.json(anfrage);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      protokolliere(`PATCH /support/anfragen/${anfrageId}`, err);
      res.status(500).json({ error: 'Datenbankfehler' });
    } finally {
      client.release();
    }
  });

  // POST /anfragen/:id/anlegen -- Gemeinde samt erster Gemeindeleitung aus
  // der Anfrage. Dieselbe Anlage wie POST /organizations
  // (utils/gemeindeAnlegen.js: Rollen, Vorlagen, Benutzername systemweit,
  // Laufzeit, Konfi-Limit), in EINER Transaktion mit dem Status der Anfrage:
  // Scheitert die Anlage, bleibt die Anfrage, wie sie war. Antwort
  // 201 { organization_id, admin_id }; Fehler wie bei POST /organizations,
  // dazu 404 (keine Anfrage) und 409 (schon angelegt).
  const passwortPolicy = body('admin_password').custom((wert) => {
    const fehler = validatePassword(wert || '');
    if (fehler) throw new Error(fehler);
    return true;
  });

  router.post('/anfragen/:id/anlegen', [
    id,
    nameFeld('name'),
    body('display_name').optional({ values: 'falsy' }).isString().withMessage('Text erwartet').bail()
      .trim().isLength({ max: NAME_MAX }).withMessage(`Höchstens ${NAME_MAX} Zeichen`),
    benutzernameRegel('admin_username'),
    passwortPolicy,
    body('admin_display_name').trim().notEmpty().withMessage('Admin-Anzeigename ist erforderlich'),
    body('admin_email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Ungültige E-Mail-Adresse'),
    verweis('kirchenkreis_id', 'Ungültiger Kirchenkreis'),
    handleValidationErrors,
  ], async (req, res) => {
    const anfrageId = Number(req.params.id);
    const {
      name, display_name, description, contact_name, contact_email, contact_phone,
      address, website_url, max_konfis, admin_username, admin_password, admin_display_name,
      admin_email, kirchenkreis_id,
    } = req.body;

    const anzeigename = display_name || name;
    const systemname = systemnameFuerAnlage(name, anzeigename, Boolean(display_name));
    if (!systemname) {
      return res.status(400).json({ error: 'Aus diesem Namen lässt sich kein Systemname bilden' });
    }

    const konfiLimit = konfiLimitLesen(max_konfis);
    if (konfiLimit.fehler) {
      return res.status(konfiLimit.fehler.status).json(konfiLimit.fehler.body);
    }
    const { trialEndsAt, isTrial } = laufzeitLesen(req.body);

    let passwortHash;
    try {
      passwortHash = await bcrypt.hash(admin_password, 10);
    } catch (err) {
      protokolliere('POST /support/anfragen/:id/anlegen (Passwort)', err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }

    const client = await db.getClient();
    let antwort;
    try {
      await client.query('BEGIN');
      const { rows: [anfrage] } = await client.query(
        'SELECT id, status FROM gemeinde_anfragen WHERE id = $1 FOR UPDATE', [anfrageId]);
      if (!anfrage) {
        await client.query('ROLLBACK');
        return res.status(404).json(NICHT_GEFUNDEN);
      }
      if (anfrage.status === 'angelegt') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: MELDUNG_SCHON_ANGELEGT });
      }

      const ergebnis = await gemeindeAnlegen(client, {
        name: systemname,
        slug: systemname,
        display_name: anzeigename,
        description, contact_name, contact_email, contact_phone, address, website_url,
        kirchenkreis: null,
        kirchenkreis_id,
        max_konfis: konfiLimit.wert,
        trial_ends_at: trialEndsAt,
        is_trial: isTrial,
        // Die erste Gemeindeleitung: eigene Adresse, sonst die der Gemeinde
        // (wie POST /organizations).
        admin: {
          username: admin_username,
          email: admin_email || contact_email || null,
          display_name: admin_display_name,
          passwortHash,
        },
      });
      if (ergebnis.fehler) {
        await client.query('ROLLBACK');
        return res.status(ergebnis.fehler.status).json(ergebnis.fehler.body);
      }

      await client.query(
        `UPDATE gemeinde_anfragen SET
           status = 'angelegt',
           status_seit = CASE WHEN status <> 'angelegt' THEN NOW() ELSE status_seit END,
           organization_id = $2, bearbeitet_von = $3, updated_at = NOW()
         WHERE id = $1`,
        [anfrageId, ergebnis.organizationId, req.user.id]
      );
      // Der Vorgang der Anfrage ist erledigt (Archiv) und kennt die Gemeinde.
      await vorgangFolgtAnfrage(client, anfrageId);
      await client.query('COMMIT');
      antwort = { organization_id: ergebnis.organizationId, admin_id: ergebnis.adminId };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      const fehler = fehlerAlsAntwort(err);
      if (fehler) {
        return res.status(fehler.status).json(fehler.body);
      }
      protokolliere(`POST /support/anfragen/${anfrageId}/anlegen`, err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    } finally {
      client.release();
    }

    res.status(201).json(antwort);
    // Wie POST /organizations: Live-Update nur an den Ausfuehrenden.
    liveUpdate.sendToUserByRole(req.user.id, 'organizations', 'create', null, req.user.organization_id);
  });

  // ========================================================================
  // STRUKTUR: Landeskirchen
  // ========================================================================

  const landeskirchenLaden = async (dbOderClient, nurId = null) => {
    const { rows } = await dbOderClient.query(
      `SELECT l.id, l.name,
              COALESCE(json_agg(json_build_object('id', k.id, 'name', k.name) ORDER BY lower(k.name), k.id)
                         FILTER (WHERE k.id IS NOT NULL), '[]'::json) AS kirchenkreise
         FROM landeskirchen l
         LEFT JOIN kirchenkreise k ON k.landeskirche_id = l.id
        ${nurId === null ? '' : 'WHERE l.id = $1'}
        GROUP BY l.id
        ORDER BY lower(l.name), l.id`,
      nurId === null ? [] : [nurId]
    );
    return rows;
  };

  router.get('/landeskirchen', async (req, res) => {
    try {
      res.json(await landeskirchenLaden(db));
    } catch (err) {
      protokolliere('GET /support/landeskirchen', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  const LANDESKIRCHE_DOPPELT = { error: 'Diese Landeskirche gibt es schon' };

  router.post('/landeskirchen', [nameFeld(), handleValidationErrors], async (req, res) => {
    try {
      const { rows: [neu] } = await db.query(
        'INSERT INTO landeskirchen (name) VALUES ($1) RETURNING id', [req.body.name]);
      res.status(201).json((await landeskirchenLaden(db, neu.id))[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json(LANDESKIRCHE_DOPPELT);
      protokolliere('POST /support/landeskirchen', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  router.put('/landeskirchen/:id', [id, nameFeld(), handleValidationErrors], async (req, res) => {
    try {
      const { rowCount } = await db.query(
        'UPDATE landeskirchen SET name = $2 WHERE id = $1', [req.params.id, req.body.name]);
      if (rowCount === 0) return res.status(404).json({ error: 'Landeskirche nicht gefunden' });
      res.json((await landeskirchenLaden(db, Number(req.params.id)))[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json(LANDESKIRCHE_DOPPELT);
      protokolliere('PUT /support/landeskirchen/:id', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Nur ohne Kirchenkreise (409): Sonst verloeren deren Gemeinden still ihre
  // Landeskirche in der Statistik.
  router.delete('/landeskirchen/:id', [id, handleValidationErrors], async (req, res) => {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const { rows: [lk] } = await client.query(
        `SELECT l.id, (SELECT COUNT(*)::int FROM kirchenkreise k WHERE k.landeskirche_id = l.id) AS kreise
           FROM landeskirchen l WHERE l.id = $1 FOR UPDATE`, [req.params.id]);
      if (!lk) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Landeskirche nicht gefunden' });
      }
      if (lk.kreise > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `An dieser Landeskirche hängen noch ${lk.kreise} Kirchenkreise. Ordne sie zuerst einer anderen zu oder lösche sie.`,
        });
      }
      await client.query('DELETE FROM landeskirchen WHERE id = $1', [req.params.id]);
      await client.query('COMMIT');
      res.json({ message: 'Landeskirche gelöscht' });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      protokolliere('DELETE /support/landeskirchen/:id', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    } finally {
      client.release();
    }
  });

  // ========================================================================
  // STRUKTUR: Kirchenkreise
  // ========================================================================

  const kirchenkreiseLaden = async (dbOderClient, nurId = null) => {
    const { rows } = await dbOderClient.query(
      `SELECT k.id, k.name, k.landeskirche_id, l.name AS landeskirche,
              (SELECT COUNT(*)::int FROM organizations o WHERE o.kirchenkreis_id = k.id AND NOT o.intern) AS anzahl_gemeinden
         FROM kirchenkreise k
         LEFT JOIN landeskirchen l ON l.id = k.landeskirche_id
        ${nurId === null ? '' : 'WHERE k.id = $1'}
        ORDER BY lower(l.name) NULLS FIRST, lower(k.name), k.id`,
      nurId === null ? [] : [nurId]
    );
    return rows;
  };

  router.get('/kirchenkreise', async (req, res) => {
    try {
      res.json(await kirchenkreiseLaden(db));
    } catch (err) {
      protokolliere('GET /support/kirchenkreise', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  const KIRCHENKREIS_DOPPELT = { error: 'Diesen Kirchenkreis gibt es in dieser Landeskirche schon' };
  const LANDESKIRCHE_FEHLT = { error: 'Landeskirche nicht gefunden' };

  /** landeskirche_id pruefen: null ist erlaubt, sonst muss es sie geben. */
  const landeskircheDa = async (client, wert) => {
    if (wert === null || wert === undefined) return true;
    const { rows } = await client.query('SELECT 1 FROM landeskirchen WHERE id = $1', [wert]);
    return rows.length > 0;
  };

  router.post('/kirchenkreise', [
    nameFeld(), verweis('landeskirche_id', 'Ungültige Landeskirche'), handleValidationErrors,
  ], async (req, res) => {
    try {
      const landeskircheId = req.body.landeskirche_id ?? null;
      if (!(await landeskircheDa(db, landeskircheId))) return res.status(400).json(LANDESKIRCHE_FEHLT);
      const { rows: [neu] } = await db.query(
        'INSERT INTO kirchenkreise (name, landeskirche_id) VALUES ($1, $2) RETURNING id',
        [req.body.name, landeskircheId]);
      res.status(201).json((await kirchenkreiseLaden(db, neu.id))[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json(KIRCHENKREIS_DOPPELT);
      protokolliere('POST /support/kirchenkreise', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // PUT /kirchenkreise/:id { name, landeskirche_id? } -- landeskirche_id nur,
  // wenn mitgeschickt (null loest die Zuordnung). Der neue Name zieht in die
  // Textspalte der Gemeinden dieses Kirchenkreises (utils/kirchenkreisZuordnung.js).
  router.put('/kirchenkreise/:id', [
    id, nameFeld(), verweis('landeskirche_id', 'Ungültige Landeskirche'), handleValidationErrors,
  ], async (req, res) => {
    const kreisId = Number(req.params.id);
    const mitLandeskirche = Object.prototype.hasOwnProperty.call(req.body, 'landeskirche_id');
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      if (mitLandeskirche && !(await landeskircheDa(client, req.body.landeskirche_id))) {
        await client.query('ROLLBACK');
        return res.status(400).json(LANDESKIRCHE_FEHLT);
      }
      const { rowCount } = await client.query(
        `UPDATE kirchenkreise SET name = $2,
                landeskirche_id = CASE WHEN $3 THEN $4::bigint ELSE landeskirche_id END
          WHERE id = $1`,
        [kreisId, req.body.name, mitLandeskirche, mitLandeskirche ? req.body.landeskirche_id : null]);
      if (rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Kirchenkreis nicht gefunden' });
      }
      await client.query(
        'UPDATE organizations SET kirchenkreis = $2, updated_at = NOW() WHERE kirchenkreis_id = $1',
        [kreisId, req.body.name]);
      await client.query('COMMIT');
      res.json((await kirchenkreiseLaden(db, kreisId))[0]);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err.code === '23505') return res.status(409).json(KIRCHENKREIS_DOPPELT);
      protokolliere('PUT /support/kirchenkreise/:id', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    } finally {
      client.release();
    }
  });

  // DELETE /kirchenkreise/:id -- die Gemeinden verlieren die Zuordnung und
  // den gespiegelten Namen in der Textspalte; die Gemeinden selbst bleiben.
  router.delete('/kirchenkreise/:id', [id, handleValidationErrors], async (req, res) => {
    const kreisId = Number(req.params.id);
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const { rows: [kk] } = await client.query('SELECT id FROM kirchenkreise WHERE id = $1 FOR UPDATE', [kreisId]);
      if (!kk) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Kirchenkreis nicht gefunden' });
      }
      // Alle Gemeinden verlieren die Zuordnung; gemeldet werden die sichtbaren
      // (interne zaehlen nirgends mit).
      const { rows: [{ gemeinden }] } = await client.query(
        `WITH geloest AS (
           UPDATE organizations SET kirchenkreis_id = NULL, kirchenkreis = NULL, updated_at = NOW()
            WHERE kirchenkreis_id = $1
        RETURNING intern
         )
         SELECT COUNT(*) FILTER (WHERE NOT intern)::int AS gemeinden FROM geloest`, [kreisId]);
      await client.query('DELETE FROM kirchenkreise WHERE id = $1', [kreisId]);
      await client.query('COMMIT');
      res.json({ message: 'Kirchenkreis gelöscht', gemeinden_ohne_zuordnung: gemeinden });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      protokolliere('DELETE /support/kirchenkreise/:id', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    } finally {
      client.release();
    }
  });

  // ========================================================================
  // STATISTIK
  // ========================================================================

  // GET /statistik -- je Gemeinde: Zuordnung, Konten je Rolle, aktive
  // Konten, Jahrgaenge. Keine Namen von Personen. Alle Gemeinden, auch
  // gesperrte (is_active) und solche ohne Konten (dann Nullen) -- ausser den
  // internen (organizations.intern).
  router.get('/statistik', async (req, res) => {
    try {
      const [{ rows: gemeinden }, konten] = await Promise.all([
        db.query(
          `SELECT o.id,
                  COALESCE(NULLIF(btrim(o.display_name), ''), o.name) AS name,
                  o.name AS systemname,
                  COALESCE(o.is_active, true) AS is_active,
                  o.kirchenkreis_id, k.name AS kirchenkreis,
                  k.landeskirche_id, l.name AS landeskirche,
                  (SELECT COUNT(*)::int FROM jahrgaenge j WHERE j.organization_id = o.id) AS jahrgaenge
             FROM organizations o
             LEFT JOIN kirchenkreise k ON k.id = o.kirchenkreis_id
             LEFT JOIN landeskirchen l ON l.id = k.landeskirche_id
            WHERE NOT o.intern
            ORDER BY lower(COALESCE(NULLIF(btrim(o.display_name), ''), o.name)), o.id`),
        zaehleKontenJeGemeinde(db),
      ]);
      const leer = { konten: { konfi: 0, teamer: 0, admin: 0, org_admin: 0 }, aktiv_30_tage: 0 };
      res.json({
        stand: new Date().toISOString(),
        gemeinden: gemeinden.map(({ jahrgaenge, ...g }) => {
          const z = konten.get(Number(g.id)) || leer;
          return { ...g, konten: z.konten, aktiv_30_tage: z.aktiv_30_tage, jahrgaenge };
        }),
      });
    } catch (err) {
      protokolliere('GET /support/statistik', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  return router;
};
