/**
 * E-Mail Service für Konfi Quest
 * Verwendet Nodemailer für den Versand von E-Mails
 */

const nodemailer = require('nodemailer');

// SMTP Transporter erstellen
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'server.godsapp.de',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true', // true für Port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
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
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.SMTP_FROM || 'Konfi Quest <profil@konfi-quest.de>',
    to,
    subject,
    text,
    html: html || text
  };

  try {
    const info = await transporter.sendMail(mailOptions);
 console.log(`E-Mail gesendet an ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
 console.error(`Fehler beim Senden der E-Mail an ${to}:`, error);
    throw error;
  }
};

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

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
    .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { opacity: 0.9; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
    .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px; margin-top: 20px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Konfi Quest</h1>
    </div>
    <div class="content">
      <h2>Hallo ${name}!</h2>
      <p>Du hast angefordert, dein Passwort für Konfi Quest zurückzusetzen.</p>
      <p>Klicke auf den Button unten, um ein neues Passwort zu setzen:</p>
      <p style="text-align: center;">
        <a href="${resetUrl}" class="button">Neues Passwort setzen</a>
      </p>
      <div class="warning">
        <strong>Hinweis:</strong> Dieser Link ist nur 1 Stunde gültig. Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.
      </div>
    </div>
    <div class="footer">
      <p>Konfi Quest - Deine Konfi-App</p>
    </div>
  </div>
</body>
</html>
  `.trim();

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

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
    .success { background: #d1fae5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; text-align: center; }
    .success-icon { font-size: 48px; }
    .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Konfi Quest</h1>
    </div>
    <div class="content">
      <div class="success">
        <div class="success-icon">&#10003;</div>
        <h2>Passwort geändert!</h2>
      </div>
      <p style="margin-top: 20px;">Hallo ${name},</p>
      <p>dein Passwort für Konfi Quest wurde erfolgreich geändert.</p>
      <p style="color: #666; font-size: 14px;">Falls du diese Änderung nicht vorgenommen hast, kontaktiere bitte sofort deinen Administrator.</p>
    </div>
    <div class="footer">
      <p>Konfi Quest - Deine Konfi-App</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to: email, subject, text, html });
};

/**
 * Testet die E-Mail-Konfiguration
 */
const testEmailConnection = async () => {
  const transporter = createTransporter();

  try {
    await transporter.verify();
 console.log('SMTP-Verbindung erfolgreich hergestellt');
    return true;
  } catch (error) {
 console.error('SMTP-Verbindungsfehler:', error);
    return false;
  }
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  testEmailConnection
};
