// Bestaetigungsmail nach einer Passwortaenderung (27.09.2026).
//
// Befund BF-20 (Bericht "Wer bekommt was", 27.09.2026): Die Vorlage
// emailService.sendPasswordChangedEmail existierte, wurde aber nirgends
// gerufen. Wer sein Passwort aenderte -- oder dem es jemand anderes
// aenderte --, bekam keine Nachricht an die hinterlegte Adresse.
//
// Simons Entscheidung zu F-12 (27.09.2026, "ja" wie empfohlen): "Ja, fuer
// Konten mit E-Mail."
//
// ALLE WEGE, DIE EIN PASSWORT AENDERN, rufen diese eine Stelle:
//   - selbst geaendert (POST /auth/change-password)
//   - per Link aus "Passwort vergessen" (POST /auth/reset-password)
//   - die Leitung setzt es (PUT /users/:id mit password,
//     PUT /users/:id/reset-password, POST /admin/konfis/:id/regenerate-password)
// Gerade der letzte Weg gehoert dazu: Die Mail warnt die Kontoinhaberin vor
// einer Aenderung, die sie nicht selbst vorgenommen hat -- und genau das ist
// der Fall, wenn jemand anderes das Passwort setzt. Das neue Passwort steht
// NIE in der Mail; die Leitung gibt es persoenlich weiter.
//
// Gerufen wird NACH der Antwort (utils/nachAntwort.js): Die Aenderung ist
// committet, ein Versandfehler darf sie nicht kippen und die Person nicht
// auf den SMTP-Server warten lassen. Diese Funktion wirft deshalb nie.

const emailService = require('../services/emailService');

/**
 * Schickt die Bestaetigung an die Adresse des Kontos -- wenn es eine hat.
 *
 * @param {{query: Function}} db
 * @param {number|string} userId
 * @param {{durchLeitung?: boolean}} [opt]  true, wenn nicht die Person selbst
 *   das Passwort gesetzt hat, sondern die Leitung.
 * @returns {Promise<boolean>} ob eine Mail rausging
 */
async function meldePasswortGeaendert(db, userId, { durchLeitung = false } = {}) {
  try {
    const { rows: [konto] } = await db.query(
      `SELECT u.email, u.display_name, u.username, u.organization_id IS NULL AS ohne_gemeinde,
              COALESCE(o.display_name, o.name) AS gemeinde
         FROM users u
         LEFT JOIN organizations o ON o.id = u.organization_id
        WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId]
    );
    const adresse = konto && typeof konto.email === 'string' ? konto.email.trim() : '';
    if (!adresse) return false;

    // Ein Konto ohne Gemeinde (Support-Konto) hat keine Leitung, die ihm ein
    // Passwort setzen koennte -- das tut der Support (Befund 03.10.2026).
    await emailService.sendPasswordChangedEmail(
      adresse,
      konto.display_name || konto.username,
      { durchLeitung, durchSupport: durchLeitung && konto.ohne_gemeinde === true, gemeinde: konto.gemeinde || null }
    );
    return true;
  } catch (err) {
    console.error('Bestaetigungsmail nach Passwortaenderung fehlgeschlagen:', err.message);
    return false;
  }
}

module.exports = { meldePasswortGeaendert };
