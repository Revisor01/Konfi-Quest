// Mail "Passwort zuruecksetzen" als Auftrag der dauerhaften Warteschlange
// (utils/warteschlange.js; Simon, 08.10.2026).
//
// WARUM: Bis hierher lief der Versand nach der Antwort nur im Speicher des
// Prozesses (nachAntwort). Startete der Container in diesem Augenblick neu,
// kam keine Mail, und die Person wartete auf einen Link, der nie kam.
//
// DER TOKEN STEHT NIE IN DER WARTESCHLANGE. Die naheliegende Fassung -- die
// Route erzeugt den Token und reiht die Mail samt Link ein -- haette den
// Klartext-Token bis zum Versand (und bei einem Fehlschlag 30 Tage lang) in
// nachlauf_auftraege liegen lassen. Wer die Datenbank lesen kann (Backup,
// Dump), haette damit fremde Passwoerter zuruecksetzen koennen; genau das
// war der Grund, Reset-Tokens nur als Hash abzulegen (Audit 22.08.2026).
//
// Deshalb erzeugt der AUFTRAG den Token, im selben Schritt wie den Versand:
// Er legt den Hash in password_resets und schickt die Mail. Im Auftrag
// stehen nur die Konto-ID und ob die Adresse mehrere Konten traegt. Der
// Klartext lebt nur im Speicher, solange die Mail gebaut und gesendet wird.
//
// Scheitert der Versand, wird der Hash wieder geloescht (ein Link, den
// niemand bekommen hat, soll nicht 24 Stunden gelten), und die Warteschlange
// wiederholt den Auftrag spaeter mit einem NEUEN Token. Bricht der Prozess
// genau zwischen Versand und Vermerk ab, kommt hoechstens eine zweite Mail
// mit einem zweiten, ebenfalls gueltigen Link -- lieber das als keine.
//
// Bei der Ausfuehrung wird das Konto neu gelesen: Ist es inzwischen
// geloescht oder gesperrt oder hat es keine Adresse mehr, geht nichts raus.

const crypto = require('crypto');
const emailService = require('../services/emailService');
const { registriereArt, einreihen } = require('./warteschlange');

const ART = 'passwort_reset_mail';
const GUELTIG_MS = 24 * 60 * 60 * 1000;
const RESET_BASIS = 'https://konfi-quest.de/reset-password?token=';

const neuerToken = () => crypto.randomBytes(32).toString('hex');
const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Erzeugt einen Token fuer das Konto, legt seinen Hash ab und schickt die
 * Mail. Wirft bei einem Versandfehler (nachdem der Hash wieder entfernt ist).
 *
 * @returns {Promise<boolean>} ob eine Mail rausging
 */
async function sendeResetMail(db, userId, { mehrereKonten = false } = {}) {
  const { rows: [konto] } = await db.query(
    `SELECT u.id, u.email, u.username, u.display_name AS name, r.name AS role_name,
            COALESCE(o.display_name, o.name) AS gemeinde
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       LEFT JOIN organizations o ON o.id = u.organization_id
      WHERE u.id = $1 AND u.deleted_at IS NULL AND COALESCE(u.is_active, true) = true`,
    [userId]
  );
  const adresse = konto && typeof konto.email === 'string' ? konto.email.trim() : '';
  if (!adresse) return false;

  const userType = konto.role_name === 'konfi' ? 'konfi' : konto.role_name === 'teamer' ? 'teamer' : 'admin';
  const token = neuerToken();
  const { rows: [eintrag] } = await db.query(
    'INSERT INTO password_resets (user_id, user_type, token, expires_at) VALUES ($1, $2, $3, $4) RETURNING id',
    [konto.id, userType, hash(token), new Date(Date.now() + GUELTIG_MS)]
  );

  try {
    // Gemeinde und Benutzername nur, wenn es etwas zu unterscheiden gibt:
    // Bei einem einzigen Konto bleibt die Mail, wie sie war.
    await emailService.sendPasswordResetEmail(
      adresse,
      konto.name,
      token,
      `${RESET_BASIS}${token}`,
      mehrereKonten ? { gemeinde: konto.gemeinde, benutzername: konto.username } : {}
    );
  } catch (err) {
    await db.query('DELETE FROM password_resets WHERE id = $1', [eintrag.id]).catch(() => {});
    throw err;
  }
  return true;
}

registriereArt(ART, async (db, p, k) => {
  await k.schritt('mail', () => sendeResetMail(db, p.userId, { mehrereKonten: p.mehrereKonten === true }));
});

/**
 * Reiht die Reset-Mail fuer ein Konto nach der Antwort ein (wirft nie).
 *
 * @param {{query: Function}} db
 * @param {number} userId
 * @param {{mehrereKonten?: boolean}} [opt]
 * @param {{req?: object}} [einreihOptionen]
 */
function resetMailEinreihen(db, userId, { mehrereKonten = false } = {}, { req = null } = {}) {
  return einreihen(db, ART, { userId, mehrereKonten }, { req, bezeichnung: 'POST /auth/request-password-reset (Mail)' });
}

module.exports = { ART, sendeResetMail, resetMailEinreihen, _hash: hash };
