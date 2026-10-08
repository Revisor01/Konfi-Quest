// Support-Konten: Super-Admin-Konten OHNE Gemeinde (03.10.2026).
//
// Simons Entscheidungen (docs/planung/web-version.md, Punkt 10 bis 15):
// Die Support-Person hat dieselben Rechte wie ein Super-Admin; ihr Konto hat
// keine Gemeinde (users.organization_id NULL, Systemrolle super_admin,
// Merkmal is_super_admin; Migration 190) und arbeitet nur im Browser
// (Anmeldung mit kann_ohne_gemeinde, routes/auth.js). In eine Gemeinde kommt
// es nur auf ausdruecklichen Schritt und fuer die Gemeinde sichtbar: als
// Gemeindeleitung ueber POST /organizations/:id/members.
//
// Bis hierher gab es keinen Weg, ein solches Konto anzulegen, zu sperren
// oder zu loeschen (nur scripts/ersteinrichtung.js setzte is_super_admin,
// und das an einer Gemeindeleitung). Eingehaengt in routes/organizations.js
// unter /api/organizations/support-konten -- neben den anderen
// Super-Admin-Wegen (Gemeinden, Mitglieder, Kontosuche) --, in eigener Datei.
//
// NUR SUPER-ADMINS (requireSuperAdmin, Rolle oder Merkmal). Die Routen
// greifen nur auf Konten ohne Gemeinde zu; ein Konto mit Gemeinde ist hier
// "nicht gefunden" (404) und wird in seiner Gemeinde verwaltet.
//
// Das Passwort setzt PUT /:id/passwort; wie PUT /users/:id/reset-password
// geht danach die Bestaetigung an die hinterlegte Adresse -- bei einem
// Konto ohne Gemeinde mit dem Satz "der Support von Konfi Quest hat ..."
// (utils/passwortGeaendertMail.js, seit 08.10.2026; bis dahin gar keine Mail,
// weil die Vorlage nur "die Leitung deiner Gemeinde" kannte).

const express = require('express');
const bcrypt = require('bcrypt');
const { body, param } = require('express-validator');
const { handleValidationErrors, commonValidations } = require('../middleware/validation');
const { invalidateUserCache } = require('../middleware/rbac');
const { validatePassword } = require('../utils/passwordUtils');
const { benutzernameSperrenUndPruefen, MELDUNG_VERGEBEN } = require('../utils/benutzernameSperre');
const { kontoSperreAufheben } = require('../utils/kontoSperre');
const { kontoDatenLoeschen, kontoDateienLoeschen, meldeNachKontoLoeschungEinreihen } = require('../utils/kontoLoeschen');
const { meldePasswortGeaendertEinreihen } = require('../utils/passwortGeaendertMail');
const { MELDUNG_LETZTER, bleibtEinSuperAdmin, systemrolleSuperAdmin } = require('../utils/superAdminKonten');
const liveUpdate = require('../utils/liveUpdate');

const NICHT_GEFUNDEN = { error: 'Support-Konto nicht gefunden' };

module.exports = (db, rbacVerifier, { requireSuperAdmin }) => {
  const router = express.Router();
  router.use(rbacVerifier, requireSuperAdmin);

  const passwortPolicy = body('password').custom((wert) => {
    const fehler = validatePassword(typeof wert === 'string' ? wert : '');
    if (fehler) throw new Error(fehler);
    return true;
  });
  const kontoId = param('id').isInt({ min: 1 }).withMessage('Ungültige ID');

  // Sitzungen beenden: Zugangs-Tokens per Soft-Revoke, Refresh-Tokens
  // widerrufen und sofort ablaufen lassen (keine Gnadenfrist), Push-Tokens
  // weg -- wie PUT /users/:id/reset-password. Im Client der Transaktion.
  const sitzungenBeenden = async (client, id) => {
    await client.query('UPDATE users SET token_invalidated_at = NOW() WHERE id = $1', [id]);
    await client.query(
      `UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()), expires_at = NOW()
        WHERE user_id = $1 AND expires_at > NOW()`,
      [id]
    );
    await client.query('DELETE FROM push_tokens WHERE user_id = $1', [id]);
  };

  // GET / -- alle Support-Konten, mit den Gemeinden, in denen sie Gast sind.
  router.get('/', async (req, res) => {
    try {
      const { rows } = await db.query(`
        SELECT u.id, u.username, u.display_name, u.email,
               COALESCE(u.is_active, true) AS is_active,
               u.last_login_at, u.created_at,
               COALESCE((
                 SELECT json_agg(json_build_object(
                          'id', o.id, 'name', o.name, 'display_name', o.display_name,
                          'role_name', r.name) ORDER BY o.display_name, o.id)
                   FROM user_organizations uo
                   JOIN organizations o ON o.id = uo.organization_id
                   JOIN roles r ON r.id = uo.role_id
                  WHERE uo.user_id = u.id
               ), '[]'::json) AS gemeinden
          FROM users u
         WHERE u.organization_id IS NULL AND u.deleted_at IS NULL
         ORDER BY u.display_name, u.id
      `);
      res.json(rows);
    } catch (err) {
      console.error('Database error in GET /organizations/support-konten:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // POST / -- Support-Konto anlegen. Benutzername systemweit eindeutig, unter
  // derselben Sperre wie POST /users und POST /organizations
  // (utils/benutzernameSperre.js); Passwortregeln wie ueberall
  // (validatePassword).
  router.post('/', [
    commonValidations.username,
    body('display_name').trim().notEmpty().withMessage('Anzeigename ist erforderlich'),
    passwortPolicy,
    body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Ungültige E-Mail-Adresse'),
    handleValidationErrors,
  ], async (req, res) => {
    const { username, display_name, password } = req.body;
    const email = (req.body.email || '').trim() || null;
    try {
      const rolle = await systemrolleSuperAdmin(db);
      if (!rolle) {
        console.error('POST /organizations/support-konten: Systemrolle super_admin fehlt (Migration 190 nicht gelaufen?)');
        return res.status(500).json({ error: 'Die Rolle für Support-Konten fehlt. Bitte den Migrationsstand prüfen.' });
      }
      const hash = await bcrypt.hash(password, 10);
      const client = await db.getClient();
      let konto;
      try {
        await client.query('BEGIN');
        if (await benutzernameSperrenUndPruefen(client, username)) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: MELDUNG_VERGEBEN });
        }
        ({ rows: [konto] } = await client.query(
          `INSERT INTO users (organization_id, role_id, username, email, display_name, password_hash, is_active, is_super_admin)
           VALUES (NULL, $1, $2, $3, $4, $5, true, true)
           RETURNING id, username, display_name, email, is_active, created_at`,
          [rolle, username, email, display_name, hash]
        ));
        // Ein vorher durchprobierter Benutzername startet frei (utils/kontoSperre.js).
        await kontoSperreAufheben(client, konto.id);
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK').catch(() => {});
        throw txErr;
      } finally {
        client.release();
      }
      res.status(201).json({ ...konto, gemeinden: [] });
    } catch (err) {
      console.error('Database error in POST /organizations/support-konten:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // PATCH /:id -- sperren ({ is_active: false }) oder entsperren
  // ({ is_active: true }). Sperren beendet alle Sitzungen. Das letzte aktive
  // Super-Admin-Konto laesst sich nicht sperren (409).
  router.patch('/:id', [
    kontoId,
    body('is_active').isBoolean({ strict: true }).withMessage('is_active muss true oder false sein'),
    handleValidationErrors,
  ], async (req, res) => {
    const id = Number(req.params.id);
    const aktiv = req.body.is_active;
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      // Beim Sperren zuerst die Sperre ueber alle Super-Admin-Aenderungen
      // (bleibtEinSuperAdmin), dann die Zeile -- dieselbe Reihenfolge wie
      // beim Loeschen, damit sich zwei Aufrufe nicht gegenseitig blockieren.
      const bleibt = aktiv || await bleibtEinSuperAdmin(client, id);
      const { rows: [vorhanden] } = await client.query(
        'SELECT id FROM users WHERE id = $1 AND organization_id IS NULL AND deleted_at IS NULL FOR UPDATE', [id]);
      if (!vorhanden) {
        await client.query('ROLLBACK');
        return res.status(404).json(NICHT_GEFUNDEN);
      }
      if (!bleibt) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: MELDUNG_LETZTER.sperren });
      }
      const { rows: [konto] } = await client.query(
        `UPDATE users SET is_active = $2, updated_at = NOW() WHERE id = $1
          RETURNING id, username, display_name, email, is_active`,
        [id, aktiv]
      );
      if (!aktiv) await sitzungenBeenden(client, id);
      await client.query('COMMIT');
      invalidateUserCache(id);
      if (!aktiv) liveUpdate.disconnectUserSockets(id);
      res.json(konto);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Database error in PATCH /organizations/support-konten/%s:', id, err);
      res.status(500).json({ error: 'Datenbankfehler' });
    } finally {
      client.release();
    }
  });

  // PUT /:id/passwort -- neues Passwort setzen. Beendet alle Sitzungen und
  // hebt eine Kontosperre nach Fehlversuchen auf, wie
  // PUT /users/:id/reset-password.
  router.put('/:id/passwort', [kontoId, passwortPolicy, handleValidationErrors], async (req, res) => {
    const id = Number(req.params.id);
    try {
      const hash = await bcrypt.hash(req.body.password, 10);
      const client = await db.getClient();
      try {
        await client.query('BEGIN');
        const { rowCount } = await client.query(
          `UPDATE users SET password_hash = $2, updated_at = NOW()
            WHERE id = $1 AND organization_id IS NULL AND deleted_at IS NULL`,
          [id, hash]
        );
        if (rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json(NICHT_GEFUNDEN);
        }
        await sitzungenBeenden(client, id);
        await kontoSperreAufheben(client, id);
        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK').catch(() => {});
        throw txErr;
      } finally {
        client.release();
      }
      invalidateUserCache(id);
      liveUpdate.disconnectUserSockets(id);
      res.json({ message: 'Passwort gesetzt' });

      // Bestaetigung an die hinterlegte Adresse, ohne das Passwort.
      meldePasswortGeaendertEinreihen(db, id, { durchLeitung: id !== Number(req.user.id) },
        { req, bezeichnung: 'PUT /organizations/support-konten/:id/passwort (Mail)' });
    } catch (err) {
      console.error('Database error in PUT /organizations/support-konten/%s/passwort:', id, err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // DELETE /:id -- Support-Konto loeschen, mit der gemeinsamen Kontoloeschung
  // (utils/kontoLoeschen.js): Gast-Mitgliedschaften, Chats, Mitteilungen,
  // alles, was zur Person gehoert. Das letzte aktive Super-Admin-Konto
  // laesst sich nicht loeschen (409).
  router.delete('/:id', [kontoId, handleValidationErrors], async (req, res) => {
    const id = Number(req.params.id);
    let ergebnis = null;
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const bleibt = await bleibtEinSuperAdmin(client, id);
      const { rows: [konto] } = await client.query(
        'SELECT id FROM users WHERE id = $1 AND organization_id IS NULL AND deleted_at IS NULL FOR UPDATE', [id]);
      if (!konto) {
        await client.query('ROLLBACK');
        return res.status(404).json(NICHT_GEFUNDEN);
      }
      if (!bleibt) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: MELDUNG_LETZTER.loeschen });
      }
      ergebnis = await kontoDatenLoeschen(client, id);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('Database error in DELETE /organizations/support-konten/%s:', id, err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    } finally {
      client.release();
    }

    invalidateUserCache(id);
    liveUpdate.disconnectUserSockets(id);
    await kontoDateienLoeschen(ergebnis?.dateien);
    res.json({ message: 'Support-Konto gelöscht' });
    meldeNachKontoLoeschungEinreihen(db, ergebnis,
      { req, bezeichnung: 'DELETE /organizations/support-konten/:id (Meldungen nach Kontoloeschung)' });
  });

  return router;
};
