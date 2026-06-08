/**
 * E-Mail Service für Konfi Quest
 * Verwendet Nodemailer für den Versand von E-Mails
 */

const nodemailer = require('nodemailer');

// Gecachter Transporter (wird einmalig erstellt und wiederverwendet)
let cachedTransporter = null;

// SMTP-Credentials prüfen
const validateSmtpConfig = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('SMTP-Credentials nicht konfiguriert (SMTP_USER, SMTP_PASS)');
    return false;
  }
  return true;
};

// SMTP Transporter erstellen oder aus Cache holen
const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (!validateSmtpConfig()) {
    throw new Error('SMTP-Credentials nicht konfiguriert. SMTP_USER und SMTP_PASS müssen als Umgebungsvariablen gesetzt sein.');
  }

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'server.godsapp.de',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE !== 'false', // Default: true (Port 465 mit TLS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  return cachedTransporter;
};

/**
 * Sendet eine E-Mail
 * @param {Object} options - E-Mail-Optionen
 * @param {string} options.to - Empfänger
 * @param {string} options.subject - Betreff
 * @param {string} options.text - Klartext-Inhalt
 * @param {string} options.html - HTML-Inhalt (optional)
 */
const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = getTransporter();

  const smtpFrom = process.env.SMTP_FROM || `Konfi Quest <${process.env.SMTP_USER || 'noreply@konfi-quest.de'}>`;

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
    console.error(`Fehler beim Senden der E-Mail an ${to}:`, error);
    // Transporter-Cache invalidieren bei Verbindungsfehler
    if (error.code === 'ECONNECTION' || error.code === 'EAUTH' || error.code === 'ESOCKET') {
      cachedTransporter = null;
    }
    throw error;
  }
};

// ====================================================================
// GEMEINSAMES MAIL-LAYOUT (Header + Footer) — eine Quelle fuer alle Templates
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

// headerGradient: optionaler eigener Verlauf (z.B. gruen fuer Bestaetigungen)
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
 */
const sendPasswordResetEmail = async (email, name, resetToken, resetUrl) => {
  const subject = 'Passwort zurücksetzen - Konfi Quest';

  const text = `
Hallo ${name},

du hast angefordert, dein Passwort für Konfi Quest zurückzusetzen.

Klicke auf folgenden Link, um ein neues Passwort zu setzen:
${resetUrl}

Dieser Link ist 1 Stunde gültig.

Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.

Viele Grüße,
Dein Konfi Quest Team
  `.trim();

  const html = wrapHtml(`
      <h2>Hallo ${name}!</h2>
      <p>Du hast angefordert, dein Passwort für Konfi Quest zurückzusetzen.</p>
      <p>Klicke auf den Button unten, um ein neues Passwort zu setzen:</p>
      <p style="text-align: center;">
        <a href="${resetUrl}" class="button">Neues Passwort setzen</a>
      </p>
      <div class="warning">
        <strong>Hinweis:</strong> Dieser Link ist nur 1 Stunde gültig. Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.
      </div>
  `);

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Sendet eine Bestätigung nach erfolgreicher Passwortänderung
 * @param {string} email - E-Mail-Adresse des Empfängers
 * @param {string} name - Name des Benutzers
 */
const sendPasswordChangedEmail = async (email, name) => {
  const subject = 'Passwort geändert - Konfi Quest';

  const text = `
Hallo ${name},

dein Passwort für Konfi Quest wurde erfolgreich geändert.

Falls du diese Änderung nicht vorgenommen hast, kontaktiere bitte sofort deinen Administrator.

Viele Grüße,
Dein Konfi Quest Team
  `.trim();

  const html = wrapHtml(`
      <div class="success">
        <div class="success-icon">&#10003;</div>
        <h2>Passwort geändert!</h2>
      </div>
      <p style="margin-top: 20px;">Hallo ${name},</p>
      <p>dein Passwort für Konfi Quest wurde erfolgreich geändert.</p>
      <p style="color: #666; font-size: 14px;">Falls du diese Änderung nicht vorgenommen hast, kontaktiere bitte sofort deinen Administrator.</p>
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
  const dateStr = new Date(endDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const subject = `Lizenz läuft in ${daysLeft} Tagen ab - Konfi Quest`;

  const text = `
Hallo ${name},

die Lizenz für eure Organisation "${orgName}" bei Konfi Quest läuft am ${dateStr} ab (noch ${daysLeft} Tag${daysLeft === 1 ? '' : 'e'}).

Nach Ablauf wird der Zugang für eure Organisation automatisch gesperrt, bis die Lizenz verlängert wird.

Bitte wende dich rechtzeitig an uns, um die Lizenz zu verlängern.

Viele Grüße,
Dein Konfi Quest Team
  `.trim();

  const html = wrapHtml(`
      <h2>Hallo ${name}!</h2>
      <p>die Lizenz für eure Organisation <strong>${orgName}</strong> läuft bald ab:</p>
      <div class="date">${dateStr} &middot; noch ${daysLeft} Tag${daysLeft === 1 ? '' : 'e'}</div>
      <div class="warning">
        <strong>Hinweis:</strong> Nach Ablauf wird der Zugang für eure Organisation automatisch gesperrt, bis die Lizenz verlängert wird. Bitte wende dich rechtzeitig an uns, um die Lizenz zu verlängern.
      </div>
  `);

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Testet die E-Mail-Konfiguration
 */
const testEmailConnection = async () => {
  if (!validateSmtpConfig()) {
    return false;
  }

  try {
    const transporter = getTransporter();
    await transporter.verify();
    return true;
  } catch (error) {
    console.error('SMTP-Verbindungsfehler:', error);
    cachedTransporter = null;
    return false;
  }
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendLicenseExpiryReminderEmail,
  testEmailConnection
};
