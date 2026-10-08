/**
 * E-Mail Service für Konfi Quest
 * Verwendet Nodemailer für den Versand von E-Mails
 */

const nodemailer = require('nodemailer');
const { formatUhrzeit, formatDatum } = require('../utils/zeitformat');
const { smtpKonfiguration, smtpMassenKonfiguration } = require('../utils/smtpKonfiguration');
const { adresseFuersProtokoll } = require('../utils/protokoll');

// Gecachte Transporter (einmalig erstellt und wiederverwendet): einer fuer
// Einzelmails, einer fuer die naechtlichen Laeufe an viele (gepoolt und
// gedrosselt, siehe utils/smtpKonfiguration.js smtpMassenKonfiguration).
let cachedTransporter = null;
let cachedMassenTransporter = null;

// SMTP-Konfiguration prüfen. Host und Nutzer kommen AUSSCHLIESSLICH aus der
// Umgebung (Audit 26.09.2026, Sicherheit BF-12 / S-15): Hier stand ein
// eingebauter Fallback-Host -- Betriebsdaten im oeffentlichen Repo, und ein
// Versand, der bei fehlender Konfiguration still an eine eingebaute Adresse
// ging. Fehlt etwas, scheitert der Versand mit dieser klaren Meldung.
const validateSmtpConfig = () => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('SMTP nicht konfiguriert (SMTP_HOST, SMTP_USER, SMTP_PASS)');
    return false;
  }
  return true;
};

// SMTP Transporter erstellen oder aus Cache holen
const getTransporter = ({ massenversand = false } = {}) => {
  if (massenversand && cachedMassenTransporter) return cachedMassenTransporter;
  if (!massenversand && cachedTransporter) return cachedTransporter;

  if (!validateSmtpConfig()) {
    throw new Error('SMTP nicht konfiguriert. SMTP_HOST, SMTP_USER und SMTP_PASS müssen als Umgebungsvariablen gesetzt sein.');
  }

  // Dieselbe Konfiguration wie der Transport in server.js: Zertifikat wird
  // geprueft (BF-09; hier stand `rejectUnauthorized: false`), kein
  // eingebauter Host (BF-12). Begruendung: utils/smtpKonfiguration.js.
  if (massenversand) {
    cachedMassenTransporter = nodemailer.createTransport(smtpMassenKonfiguration());
    return cachedMassenTransporter;
  }
  cachedTransporter = nodemailer.createTransport(smtpKonfiguration());
  return cachedTransporter;
};

// Beide Transporte schliessen (der gepoolte haelt seine Verbindung offen).
// Fuer Tests und das Herunterfahren; danach baut der naechste Versand neu auf.
const transporteSchliessen = () => {
  for (const t of [cachedTransporter, cachedMassenTransporter]) {
    if (t && typeof t.close === 'function') t.close();
  }
  cachedTransporter = null;
  cachedMassenTransporter = null;
};

/**
 * Sendet eine E-Mail
 * @param {Object} options - E-Mail-Optionen
 * @param {string} options.to - Empfänger
 * @param {string} options.subject - Betreff
 * @param {string} options.text - Klartext-Inhalt
 * @param {string} options.html - HTML-Inhalt (optional)
 * @param {string} [options.protokoll] - Kennung fuer das Protokoll im
 *   Fehlerfall (etwa "Anfrage 12"). Steht sie da, nennt das Protokoll nur sie
 *   und den Fehlercode -- weder die Domain der Adresse noch die Meldung des
 *   Mailservers, die die Adresse woertlich enthalten kann (03.10.2026, fuer
 *   die Anfragen vom Formular: keine Daten der Anfrage im Protokoll).
 */
const sendEmail = async ({ to, subject, text, html, massenversand = false, protokoll = null }) => {
  const transporter = getTransporter({ massenversand });

  // Absender aus SMTP_FROM, sonst der SMTP-Nutzer -- kein eingebauter
  // Fallback mehr (BF-12); getTransporter() hat SMTP_USER bereits verlangt.
  const smtpFrom = process.env.SMTP_FROM || `Konfi Quest <${process.env.SMTP_USER}>`;

  const mailOptions = {
    from: smtpFrom,
    to,
    subject,
    text,
    html: html || text
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    if (protokoll) {
      console.error('Fehler beim Senden der E-Mail (%s): %s', protokoll, error.code || error.responseCode || 'ohne Code');
    } else {
      // Nur die Domain der Adresse (Audit Sicherheit BF-14, 29.09.2026).
      console.error('Fehler beim Senden der E-Mail an %s:', adresseFuersProtokoll(to), error);
    }
    // Transporter-Cache invalidieren bei Verbindungsfehler
    if (error.code === 'ECONNECTION' || error.code === 'EAUTH' || error.code === 'ESOCKET') {
      if (massenversand) {
        if (cachedMassenTransporter) cachedMassenTransporter.close();
        cachedMassenTransporter = null;
      } else {
        cachedTransporter = null;
      }
    }
    throw error;
  }
};

// ====================================================================
// GEMEINSAMES MAIL-LAYOUT (Header + Footer) — eine Quelle für alle Templates
// ====================================================================

const WEBSITE_URL = 'https://konfi-quest.de';
const DATENSCHUTZ_URL = 'https://konfi-quest.de/datenschutz.html';
const LOGO_URL = 'https://konfi-quest.de/assets/icon/icon-192x192.png';
const SLOGAN = 'Die App für eine moderne Konfi-Zeit';

const BASE_STYLES = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header img { width: 56px; height: 56px; border-radius: 12px; margin-bottom: 10px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header .slogan { margin: 6px 0 0; font-size: 14px; opacity: 0.9; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { opacity: 0.9; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin-top: 20px; font-size: 14px; }
    .success { background: #d1fae5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; text-align: center; }
    .success-icon { font-size: 48px; }
    .date { font-size: 20px; font-weight: 700; color: #667eea; text-align: center; margin: 16px 0; }
    .footer { text-align: center; color: #888; font-size: 12px; margin-top: 24px; line-height: 1.8; }
    .footer a { color: #667eea; text-decoration: none; }
`;

// headerGradient: optionaler eigener Verlauf (z.B. gruen für Bestaetigungen)
const renderHeader = (headerGradient = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)') => `
    <div class="header" style="background: ${headerGradient};">
      <img src="${LOGO_URL}" alt="Konfi Quest" />
      <h1>Konfi Quest</h1>
      <p class="slogan">${SLOGAN}</p>
    </div>
`;

const renderFooter = () => `
    <div class="footer">
      <p>Konfi Quest - ${SLOGAN}</p>
      <p>
        <a href="${WEBSITE_URL}">konfi-quest.de</a>
        &nbsp;&middot;&nbsp;
        <a href="${DATENSCHUTZ_URL}">Datenschutz</a>
      </p>
    </div>
`;

// Komplettes HTML-Geruest um einen Inhalts-Block (content-Bereich)
const wrapHtml = (contentHtml, { headerGradient } = {}) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="container">
    ${renderHeader(headerGradient)}
    <div class="content">
      ${contentHtml}
    </div>
    ${renderFooter()}
  </div>
</body>
</html>
`.trim();

/**
 * Sendet eine Passwort-Reset E-Mail
 * @param {string} email - E-Mail-Adresse des Empfängers
 * @param {string} name - Name des Benutzers
 * @param {string} resetToken - Reset-Token
 * @param {string} resetUrl - Vollständige Reset-URL
 * @param {{gemeinde?: string|null, benutzername?: string|null}} [konto]
 *   Seit 27.09.2026 (BF-20): Eine Adresse kann an Konten in mehreren
 *   Gemeinden haengen (E-Mail ist nur je Gemeinde eindeutig). Jedes Konto
 *   bekommt seine EIGENE Mail mit eigenem Link; Gemeinde und Benutzername
 *   sagen, zu welchem Konto dieser Link gehoert. Optional und am Ende --
 *   ohne die Angaben bleibt die Mail, wie sie war.
 */
const sendPasswordResetEmail = async (email, name, resetToken, resetUrl, { gemeinde = null, benutzername = null } = {}) => {
  // CR/LF raus: Der Gemeindename steht im Betreff (Header-Injection-Schutz
  // wie bei sendGemeindeEinladungEmail).
  const gemeindeZeile = gemeinde ? String(gemeinde).replace(/[\r\n]+/g, ' ').trim() : '';
  const subject = gemeindeZeile
    ? `Passwort zurücksetzen (${gemeindeZeile}) - Konfi Quest`
    : 'Passwort zurücksetzen - Konfi Quest';

  const kontoText = [
    gemeindeZeile ? `Gemeinde: ${gemeindeZeile}` : null,
    benutzername ? `Benutzername: ${benutzername}` : null
  ].filter(Boolean).join('\n');
  const kontoHtml = [
    gemeindeZeile ? `Gemeinde: <strong>${escapeHtml(gemeindeZeile)}</strong>` : null,
    benutzername ? `Benutzername: <strong>${escapeHtml(benutzername)}</strong>` : null
  ].filter(Boolean).join('<br>');

  // "24 Stunden": So lange gilt der Link (routes/auth.js, expiresAt), und so
  // steht es im Handbuch. Hier stand bis zum 27.09.2026 "1 Stunde".
  const text = `
Hallo ${name},

du hast angefordert, dein Passwort für Konfi Quest zurückzusetzen.
${kontoText ? `\nDieser Link gilt für dein Konto:\n${kontoText}\n` : ''}
Klicke auf folgenden Link, um ein neues Passwort zu setzen:
${resetUrl}

Dieser Link ist 24 Stunden gültig.

Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.

Viele Grüße,
Dein Konfi Quest Team
  `.trim();

  const html = wrapHtml(`
      <h2>Hallo ${escapeHtml(name)}!</h2>
      <p>Du hast angefordert, dein Passwort für Konfi Quest zurückzusetzen.</p>
      ${kontoHtml ? `<p>Dieser Link gilt für dein Konto:<br>${kontoHtml}</p>` : ''}
      <p>Klicke auf den Button unten, um ein neues Passwort zu setzen:</p>
      <p style="text-align: center;">
        <a href="${escapeHtml(resetUrl)}" class="button">Neues Passwort setzen</a>
      </p>
      <div class="warning">
        <strong>Hinweis:</strong> Dieser Link ist 24 Stunden gültig. Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.
      </div>
  `);

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Sendet eine Bestätigung nach erfolgreicher Passwortänderung.
 *
 * Gerufen seit dem 27.09.2026 aus utils/passwortGeaendertMail.js, fuer
 * jeden Weg, der ein Passwort aendert (Simon, F-12). Das neue Passwort
 * steht NIE in der Mail.
 *
 * @param {string} email - E-Mail-Adresse des Empfängers
 * @param {string} name - Name des Benutzers
 * @param {{durchLeitung?: boolean, gemeinde?: string|null}} [opt]
 *   durchLeitung: Die Leitung hat das Passwort gesetzt, nicht die Person.
 */
// durchSupport (08.10.2026): Ein Support-Konto hat keine Gemeinde und damit
// keine "Leitung deiner Gemeinde" -- gesetzt hat das Passwort der Support.
const sendPasswordChangedEmail = async (email, name, { durchLeitung = false, durchSupport = false, gemeinde = null } = {}) => {
  const subject = 'Passwort geändert - Konfi Quest';

  const SUPPORT_SATZ = 'der Support von Konfi Quest hat ein neues Passwort für dein Konto gesetzt. Das Passwort selbst steht nicht in dieser Mail — du bekommst es vom Support.';
  const vonWem = durchSupport
    ? SUPPORT_SATZ
    : durchLeitung
      ? `die Leitung deiner Gemeinde${gemeinde ? ` (${gemeinde})` : ''} hat ein neues Passwort für dein Konto bei Konfi Quest gesetzt. Das Passwort selbst steht nicht in dieser Mail — du bekommst es von ihr.`
      : 'dein Passwort für Konfi Quest wurde erfolgreich geändert.';
  const vonWemHtml = durchSupport
    ? SUPPORT_SATZ
    : durchLeitung
      ? `die Leitung deiner Gemeinde${gemeinde ? ` (${escapeHtml(gemeinde)})` : ''} hat ein neues Passwort für dein Konto bei Konfi Quest gesetzt. Das Passwort selbst steht nicht in dieser Mail — du bekommst es von ihr.`
      : 'dein Passwort für Konfi Quest wurde erfolgreich geändert.';

  const text = `
Hallo ${name},

${vonWem}

Falls du diese Änderung nicht vorgenommen oder erwartet hast, kontaktiere bitte sofort deinen Administrator.

Viele Grüße,
Dein Konfi Quest Team
  `.trim();

  const html = wrapHtml(`
      <div class="success">
        <div class="success-icon">&#10003;</div>
        <h2>Passwort geändert!</h2>
      </div>
      <p style="margin-top: 20px;">Hallo ${escapeHtml(name)},</p>
      <p>${vonWemHtml}</p>
      <p style="color: #666; font-size: 14px;">Falls du diese Änderung nicht vorgenommen oder erwartet hast, kontaktiere bitte sofort deinen Administrator.</p>
  `, { headerGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' });

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Erinnert eine Org-Admin:in daran, dass die Lizenz (kein Trial) bald ablaeuft.
 * @param {string} email - E-Mail der Admin:in
 * @param {string} name - Anzeigename der Admin:in
 * @param {string} orgName - Anzeigename der Organisation
 * @param {Date}   endDate - Ablaufdatum (trial_ends_at)
 * @param {number} daysLeft - verbleibende Tage
 */
const sendLicenseExpiryReminderEmail = async (email, name, orgName, endDate, daysLeft) => {
  const dateStr = formatDatum(endDate, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const subject = `Lizenz läuft in ${daysLeft} Tagen ab - Konfi Quest`;

  const text = `
Hallo ${name},

die Lizenz für eure Gemeinde "${orgName}" bei Konfi Quest läuft am ${dateStr} ab (noch ${daysLeft} Tag${daysLeft === 1 ? '' : 'e'}).

Nach Ablauf wird der Zugang für eure Gemeinde automatisch gesperrt, bis die Lizenz verlängert wird.

Bitte wende dich rechtzeitig an uns, um die Lizenz zu verlängern.

Viele Grüße,
Dein Konfi Quest Team
  `.trim();

  const html = wrapHtml(`
      <h2>Hallo ${escapeHtml(name)}!</h2>
      <p>die Lizenz für eure Gemeinde <strong>${escapeHtml(orgName)}</strong> läuft bald ab:</p>
      <div class="date">${escapeHtml(dateStr)} &middot; noch ${escapeHtml(daysLeft)} Tag${daysLeft === 1 ? '' : 'e'}</div>
      <div class="warning">
        <strong>Hinweis:</strong> Nach Ablauf wird der Zugang für eure Gemeinde automatisch gesperrt, bis die Lizenz verlängert wird. Bitte wende dich rechtzeitig an uns, um die Lizenz zu verlängern.
      </div>
  `);

  // Naechtlicher Lauf an die Gemeindeleitungen: gepoolt und gedrosselt.
  return sendEmail({ to: email, subject, text, html, massenversand: true });
};

/**
 * "Letzte Chance"-Warnung an Admins, bevor ein Jahrgang automatisch gelöscht
 * wird. Bewusst "gelöscht" (NICHT "archiviert") -- das interne Backup/Archiv
 * wird nach aussen nicht kommuniziert. Mit Hinweis aufs Befoerdern.
 */
/**
 * Einladung in eine weitere Gemeinde (26.09.2026). Nennt die Frist, weil sie
 * nach 14 Tagen verfaellt -- wie die Loeschwarnung fuer Jahrgaenge.
 */
const sendGemeindeEinladungEmail = async (email, name, orgName, rolleName, expiresAt) => {
  const frist = expiresAt
    ? formatDatum(new Date(expiresAt), { day: '2-digit', month: '2-digit', year: 'numeric' })
    : null;
  const subject = `Einladung von ${String(orgName).replace(/[\r\n]+/g, ' ').trim()} - Konfi Quest`;

  const text = `
Hallo ${name},

${orgName} lädt dich ein, dort als ${rolleName} mitzuarbeiten.

Du behältst dein Konto und dein Passwort. Nimmst du an, kannst du in der App
oben links zwischen deinen Gemeinden wechseln. Deine bisherige Gemeinde bleibt
unverändert.

Öffne die App, um die Einladung anzunehmen oder abzulehnen.${frist ? `

Die Einladung gilt bis zum ${frist}.` : ''}

Viele Grüße,
Dein Konfi Quest Team
  `.trim();

  const html = wrapHtml(`
      <h2>Hallo ${escapeHtml(name)}!</h2>
      <p><strong>${escapeHtml(orgName)}</strong> lädt dich ein, dort als
         <strong>${escapeHtml(rolleName)}</strong> mitzuarbeiten.</p>
      <p>Du behältst dein Konto und dein Passwort. Nimmst du an, kannst du in der
         App oben links zwischen deinen Gemeinden wechseln — deine bisherige
         Gemeinde bleibt unverändert.</p>
      <p>Öffne die App, um die Einladung anzunehmen oder abzulehnen.</p>
      ${frist ? `<div class="date">Gültig bis ${escapeHtml(frist)}</div>` : ''}
  `, { headerGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' });

  return sendEmail({ to: email, subject, text, html });
};

const sendJahrgangDeletionWarningEmail = async (email, name, orgName, jahrgangName, daysLeft) => {
  // CR/LF raus: Der Jahrgangsname (von der Leitung vergeben) steht im Betreff
  // (Header-Injection-Schutz wie bei sendKonfiMatrixEmail).
  const betreffName = String(jahrgangName).replace(/[\r\n]+/g, ' ').trim();
  const subject = `Jahrgang "${betreffName}" wird in ${daysLeft} Tagen gelöscht - Konfi Quest`;

  const text = `
Hallo ${name},

der Jahrgang "${jahrgangName}" in eurer Gemeinde "${orgName}" wird in ${daysLeft} Tag${daysLeft === 1 ? '' : 'en'} automatisch gelöscht.

Das ist die letzte Gelegenheit, Konfis dieses Jahrgangs noch zu Teamer:innen zu befördern. Beförderte Teamer:innen behalten ihre Punkte und Badges und bleiben euch erhalten - alle anderen Konfis dieses Jahrgangs werden mit der Löschung entfernt.

Wenn ihr nichts unternehmt, geschieht die Löschung automatisch.

Viele Grüße,
Dein Konfi Quest Team
  `.trim();

  const html = wrapHtml(`
      <h2>Hallo ${escapeHtml(name)}!</h2>
      <p>der Jahrgang <strong>${escapeHtml(jahrgangName)}</strong> in eurer Gemeinde <strong>${escapeHtml(orgName)}</strong> wird bald gelöscht:</p>
      <div class="date">Löschung in ${escapeHtml(daysLeft)} Tag${daysLeft === 1 ? '' : 'en'}</div>
      <div class="warning">
        <strong>Letzte Chance:</strong> Befördert jetzt noch Konfis dieses Jahrgangs zu Teamer:innen, wenn sie euch erhalten bleiben sollen. Beförderte Teamer:innen behalten ihre Punkte und Badges. Alle anderen Konfis dieses Jahrgangs werden mit der Löschung entfernt. Geschieht nichts, wird der Jahrgang automatisch gelöscht.
      </div>
  `);

  // Naechtlicher Lauf an die Jahrgangsleitungen: gepoolt und gedrosselt.
  return sendEmail({ to: email, subject, text, html, massenversand: true });
};

// HTML-Escaping für JEDEN Wert, der ins Mail-HTML eingesetzt wird
// (Audit Chat/Challenges/Rückblick BF-11, 29.09.2026): Anzeigename,
// Gemeinde- und Jahrgangsname sind frei wählbar. Bis dahin maskierten nur
// drei der sechs Vorlagen; Lizenz- und Löschwarnung setzten die Namen roh
// ein -- Layoutbruch und Phishing-Optik über einen präparierten Namen. Auch
// server-eigene Werte (Link, Datum, Zahl) gehen hier durch, damit die Regel
// ohne Ausnahme gilt. Der Textteil bleibt Klartext und wird nicht maskiert.
const escapeHtml = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// Formatiert ein Datum (oder null) als deutsches Datum bzw. einen Platzhalter.
const formatKonfirmationDate = (value) => {
  if (!value) return 'noch kein Termin';
  // Datum UND Uhrzeit (falls zwei Konfirmationen am selben Tag -> Uhrzeit unterscheidet sie).
  const d = new Date(value);
  const datum = formatDatum(d, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const zeit = formatUhrzeit(d);
  return `${datum}, ${zeit} Uhr`;
};

// Baut die Textdarstellung eines gewaehlten Konfispruchs (oder Platzhalter).
const formatSpruchText = (konfspruch) => {
  if (!konfspruch) return 'noch keiner';
  if (konfspruch.source === 'liste') {
    const text = konfspruch.text && konfspruch.text.trim().length > 0 ? konfspruch.text : '';
    return text ? `${konfspruch.reference} - ${text}` : konfspruch.reference;
  }
  // Freitext: Text + Referenz
  return konfspruch.reference ? `${konfspruch.text} (${konfspruch.reference})` : konfspruch.text;
};

/**
 * Schickt der Admin:in die Anwesenheitsmatrix oder die Konfispruch-Liste eines
 * Jahrgangs an die eigene Adresse (fuers Buero, D-08/D-09).
 * @param {string} email - eigene E-Mail-Adresse der Admin:in
 * @param {string} adminName - Anzeigename der Admin:in
 * @param {string} jahrgangName - Name des Jahrgangs
 * @param {'anwesenheit'|'sprueche'} type - gewuenschte Ansicht
 * @param {Array} rows - bei 'anwesenheit': { display_name, present_count, total_count };
 *                       bei 'sprueche':   { display_name, konfirmation_date, konfspruch }
 */
const sendKonfiMatrixEmail = async (email, adminName, jahrgangName, type, rows = []) => {
  const isSprueche = type === 'sprueche';
  const titel = isSprueche ? 'Konfisprüche' : 'Anwesenheit';
  // CR/LF aus dem Subject entfernen (Header-Injection-Schutz): jahrgangName ist
  // admin-kontrolliert, darf den SMTP-Header aber nicht aufbrechen können.
  const safeJahrgangName = String(jahrgangName).replace(/[\r\n]+/g, ' ').trim();
  const subject = `${titel} - Jahrgang ${safeJahrgangName} - Konfi Quest`;

  let textBody;
  let tableHtml;

  if (isSprueche) {
    // Liste: Name + Konfirmationstermin + Spruch
    const textLines = rows.map(r => {
      const termin = formatKonfirmationDate(r.konfirmation_date);
      const spruch = formatSpruchText(r.konfspruch);
      return `${r.display_name} | Konfirmation: ${termin} | Spruch: ${spruch}`;
    });
    textBody = textLines.length > 0 ? textLines.join('\n') : 'Keine Konfis in diesem Jahrgang.';

    const rowsHtml = rows.length > 0
      ? rows.map(r => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(r.display_name)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(formatKonfirmationDate(r.konfirmation_date))}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(formatSpruchText(r.konfspruch))}</td>
        </tr>`).join('')
      : `<tr><td colspan="3" style="padding:8px;">Keine Konfis in diesem Jahrgang.</td></tr>`;

    tableHtml = `
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #667eea;">Konfi</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #667eea;">Konfirmation</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #667eea;">Konfispruch</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;
  } else {
    // Anwesenheit: Name + besuchte/gesamte Pflicht-Events
    const textLines = rows.map(r => `${r.display_name} | Anwesenheit: ${r.present_count} von ${r.total_count} Pflicht-Events`);
    textBody = textLines.length > 0 ? textLines.join('\n') : 'Keine Konfis in diesem Jahrgang.';

    const rowsHtml = rows.length > 0
      ? rows.map(r => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(r.display_name)}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(`${r.present_count} von ${r.total_count}`)}</td>
        </tr>`).join('')
      : `<tr><td colspan="2" style="padding:8px;">Keine Konfis in diesem Jahrgang.</td></tr>`;

    tableHtml = `
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #667eea;">Konfi</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #667eea;">Anwesenheit (Pflicht-Events)</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>`;
  }

  const text = `
Hallo ${adminName},

hier ist die ${titel}-Übersicht für den Jahrgang "${jahrgangName}":

${textBody}

Diese E-Mail hast du dir selbst aus der App geschickt.

Viele Grüße,
Dein Konfi Quest Team
  `.trim();

  const html = wrapHtml(`
      <h2>Hallo ${escapeHtml(adminName)}!</h2>
      <p>hier ist die <strong>${escapeHtml(titel)}</strong>-Übersicht für den Jahrgang <strong>${escapeHtml(jahrgangName)}</strong>:</p>
      ${tableHtml}
      <p style="color:#666;font-size:14px;margin-top:20px;">Diese E-Mail hast du dir selbst aus der App geschickt.</p>
  `);

  return sendEmail({ to: email, subject, text, html });
};

// ====================================================================
// ANFRAGEN VOM FORMULAR AUF konfi-quest.de (03.10.2026)
// ====================================================================

const KONTAKT_ADRESSE = 'moin@konfi-quest.de';

/**
 * Bestaetigung an die Adresse, die im Anfrageformular stand.
 *
 * BEWUSST OHNE JEDE EINGABE AUS DEM FORMULAR -- kein Name, keine Gemeinde,
 * keine Nachricht: Das Formular ist oeffentlich, die Adresse kann jemand
 * Fremdes eintragen. Mit eingesetzten Feldern liesse sich ueber unseren
 * Server beliebiger Text an beliebige Adressen schicken. So bekommt eine
 * fremde Adresse hoechstens diesen festen Text (und hoechstens drei am Tag,
 * routes/anfragen.js).
 *
 * @param {string} email
 * @param {{protokoll: string}} opt  Kennung fuers Protokoll ("Anfrage 12")
 */
const sendAnfrageBestaetigungEmail = async (email, { protokoll }) => {
  const subject = 'Eure Anfrage bei Konfi Quest';

  const text = `
Hallo,

vielen Dank für eure Anfrage! Sie ist bei uns angekommen. Wir melden uns in den nächsten Tagen bei euch und richten eure Gemeinde ein.

Habt ihr bis dahin Fragen, schreibt uns an ${KONTAKT_ADRESSE}.

Diese Mail ging an die Adresse, die im Anfrageformular auf konfi-quest.de eingetragen wurde. Habt ihr keine Anfrage gestellt, sagt uns bitte kurz Bescheid; dann löschen wir sie.

Viele Grüße,
Euer Konfi Quest Team
  `.trim();

  const html = wrapHtml(`
      <h2>Vielen Dank für eure Anfrage!</h2>
      <p>Sie ist bei uns angekommen. Wir melden uns in den nächsten Tagen bei euch und richten eure Gemeinde ein.</p>
      <p>Habt ihr bis dahin Fragen, schreibt uns an <a href="mailto:${escapeHtml(KONTAKT_ADRESSE)}">${escapeHtml(KONTAKT_ADRESSE)}</a>.</p>
      <p style="color: #666; font-size: 14px;">Diese Mail ging an die Adresse, die im Anfrageformular auf konfi-quest.de eingetragen wurde. Habt ihr keine Anfrage gestellt, sagt uns bitte kurz Bescheid; dann löschen wir sie.</p>
  `, { headerGradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' });

  return sendEmail({ to: email, subject, text, html, protokoll });
};

/**
 * Hinweis an ein Super-Admin-Konto: Eine neue Anfrage liegt in der
 * Support-Ansicht.
 *
 * NUR GEMEINDE, KIRCHENKREIS, LANDESKIRCHE UND KENNUNG -- keine Kontaktdaten
 * der anfragenden Person (Name, Funktion, E-Mail, Mobilnummer, Nachricht).
 * Die stehen in der Support-Ansicht; ein Postfach muss sie nicht noch einmal
 * halten. Die Datenschutzerklaerung (Abschnitt 9c) sagt das so.
 *
 * @param {string} email   Adresse des Super-Admin-Kontos
 * @param {string} name    Anzeigename des Kontos
 * @param {{id: number, gemeinde: string, kirchenkreis?: string|null, landeskirche?: string|null}} anfrage
 */
const sendAnfrageHinweisEmail = async (email, name, anfrage) => {
  const einzeilig = (wert) => String(wert == null ? '' : wert).replace(/[\r\n]+/g, ' ').trim();
  const gemeinde = einzeilig(anfrage.gemeinde);
  const ort = [einzeilig(anfrage.kirchenkreis), einzeilig(anfrage.landeskirche)].filter(Boolean).join(', ');
  const subject = `Neue Anfrage: ${gemeinde} - Konfi Quest`;

  const text = `
Hallo ${name},

eine neue Anfrage ist über das Formular auf konfi-quest.de eingegangen:

Anfrage ${anfrage.id}: ${gemeinde}${ort ? ` (${ort})` : ''}

Kontaktdaten und Nachricht stehen in der Support-Ansicht auf ${WEBSITE_URL}.

Viele Grüße,
Dein Konfi Quest Team
  `.trim();

  const html = wrapHtml(`
      <h2>Hallo ${escapeHtml(name)}!</h2>
      <p>Eine neue Anfrage ist über das Formular auf konfi-quest.de eingegangen:</p>
      <div class="date">Anfrage ${escapeHtml(anfrage.id)}: ${escapeHtml(gemeinde)}</div>
      ${ort ? `<p style="text-align: center;">${escapeHtml(ort)}</p>` : ''}
      <p>Kontaktdaten und Nachricht stehen in der Support-Ansicht.</p>
      <p style="text-align: center;">
        <a href="${escapeHtml(WEBSITE_URL)}" class="button">Zur Support-Ansicht</a>
      </p>
  `);

  return sendEmail({ to: email, subject, text, html, protokoll: `Hinweis zu Anfrage ${anfrage.id}` });
};

module.exports = {
  sendEmail,
  transporteSchliessen,
  sendAnfrageBestaetigungEmail,
  sendAnfrageHinweisEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendLicenseExpiryReminderEmail,
  sendJahrgangDeletionWarningEmail,
  sendGemeindeEinladungEmail,
  sendKonfiMatrixEmail,
};
