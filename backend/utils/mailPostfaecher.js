// Die beiden Postfaecher der Support-Mail (docs/planung/support-mail.md,
// Abschnitt "Zugangsdaten"; Simon, 03.10.2026).
//
//   moin     Anfragen und Erstkontakt (steht auf der Startseite); Antworten
//            auf Anfragen gehen von hier.
//   support  Hilfe fuer bestehende Gemeinden; Antworten an Gemeindeleitungen
//            gehen von hier.
//
// ZUGANGSDATEN NUR AUS DER UMGEBUNG (Portainer-Stack), nie im Repo:
//
//   MAIL_IMAP_HOST                 IMAP-Server beider Postfaecher (ohne: aus)
//   MAIL_IMAP_PORT                 Vorgabe 993 (TLS)
//   MAIL_SMTP_HOST / _PORT         Vorgabe SMTP_HOST / SMTP_PORT
//   MAIL_MOIN_ADRESSE              Vorgabe moin@konfi-quest.de
//   MAIL_MOIN_USER / _PASS
//   MAIL_SUPPORT_ADRESSE           Vorgabe support@konfi-quest.de
//   MAIL_SUPPORT_USER / _PASS
//
// EINGERICHTET ist ein Postfach, wenn Benutzer, Passwort und IMAP-Host
// gesetzt sind. LEER GILT ALS NICHT GESETZT: Die Referenz-Compose reicht die
// Variablen als `${MAIL_SMTP_HOST:-}` durch -- eine nicht gesetzte Variable
// kommt im Container als leerer Text an, nicht als undefined. Deshalb `||`
// und trim(), nie `??` (Nachtrag des Koordinators vom 03.10.2026; Test in
// tests/utils/mailPostfaecher.test.js).
//
// ZERTIFIKAT WIRD GEPRUEFT wie beim bisherigen Versand
// (utils/smtpKonfiguration.js, smtpTlsOptionen) -- fuer SMTP und IMAP. Der
// Notnagel SMTP_TLS_REJECT_UNAUTHORIZED=false gilt fuer beide und warnt
// bei jedem Aufbau.

const { smtpKonfiguration, smtpTlsOptionen } = require('./smtpKonfiguration');

const POSTFAECHER = Object.freeze(['moin', 'support']);

const STANDARD_ADRESSEN = Object.freeze({
  moin: 'moin@konfi-quest.de',
  support: 'support@konfi-quest.de',
});

const STANDARD_IMAP_PORT = 993;

/** Wert einer Variablen, leer oder nur Leerzeichen = null. */
function gesetzt(env, name) {
  const roh = env[name];
  if (roh === undefined || roh === null) return null;
  const text = String(roh);
  return text.trim() === '' ? null : text;
}

/** Wie gesetzt(), aber ohne Randleerzeichen (Hosts, Benutzer, Adressen). */
function gesetztGetrimmt(env, name) {
  const wert = gesetzt(env, name);
  return wert === null ? null : wert.trim();
}

/** Port als Zahl; leer, keine Zahl oder ausserhalb 1..65535 = Vorgabe. */
function portLesen(wert, vorgabe) {
  if (wert === null) return vorgabe;
  const zahl = Number(wert);
  return Number.isInteger(zahl) && zahl >= 1 && zahl <= 65535 ? zahl : vorgabe;
}

/**
 * Die Konfiguration eines Postfachs.
 *
 * @param {'moin'|'support'} postfach
 * @param {object} [env]  process.env (Parameter fuer die Tests)
 * @returns {{
 *   postfach: string, adresse: string, eingerichtet: boolean, versandBereit: boolean,
 *   imap: {host: string|null, port: number, user: string|null, pass: string|null},
 *   smtp: {host: string|null, port: number|null}
 * }}
 */
function postfachKonfig(postfach, env = process.env) {
  if (!POSTFAECHER.includes(postfach)) {
    throw new Error(`Unbekanntes Postfach: ${postfach}`);
  }
  const gross = postfach.toUpperCase();
  const adresse = (gesetztGetrimmt(env, `MAIL_${gross}_ADRESSE`) || STANDARD_ADRESSEN[postfach]).toLowerCase();
  const user = gesetztGetrimmt(env, `MAIL_${gross}_USER`);
  // Das Passwort bleibt, wie es ist (Leerzeichen koennen dazugehoeren) --
  // nur ganz leer gilt als nicht gesetzt.
  const pass = gesetzt(env, `MAIL_${gross}_PASS`);
  const imapHost = gesetztGetrimmt(env, 'MAIL_IMAP_HOST');
  const smtpHost = gesetztGetrimmt(env, 'MAIL_SMTP_HOST') || gesetztGetrimmt(env, 'SMTP_HOST');
  const smtpPortText = gesetztGetrimmt(env, 'MAIL_SMTP_PORT') || gesetztGetrimmt(env, 'SMTP_PORT');
  const eingerichtet = Boolean(user && pass && imapHost);

  return {
    postfach,
    adresse,
    eingerichtet,
    // Antworten brauchen ausserdem einen SMTP-Host (eigener oder der
    // allgemeine). Ohne ihn gilt das Postfach fuer den Versand als nicht
    // eingerichtet (503 wie ohne Zugangsdaten).
    versandBereit: eingerichtet && Boolean(smtpHost),
    imap: {
      host: imapHost,
      port: portLesen(gesetztGetrimmt(env, 'MAIL_IMAP_PORT'), STANDARD_IMAP_PORT),
      user,
      pass,
    },
    smtp: {
      host: smtpHost,
      port: smtpPortText === null ? null : portLesen(smtpPortText, null),
    },
  };
}

/** Alle Postfaecher in fester Reihenfolge (moin, support). */
function allePostfaecher(env = process.env) {
  return POSTFAECHER.map((p) => postfachKonfig(p, env));
}

/**
 * SMTP-Optionen fuer nodemailer.createTransport -- dieselbe Konfiguration
 * wie der bisherige Versand (smtpKonfiguration: Zertifikat geprueft, kein
 * eingebauter Host), nur mit der Anmeldung des Postfachs und, falls gesetzt,
 * eigenem Host und Port.
 *
 * Mit eigenem Port (MAIL_SMTP_PORT) richtet sich TLS nach dem Port: 465 =
 * TLS von Anfang an, sonst STARTTLS, und zwar Pflicht (requireTLS) -- die
 * Anmeldung des Postfachs geht nie im Klartext. Ohne eigenen Port gilt
 * SMTP_SECURE wie beim bisherigen Versand.
 */
function smtpOptionen(konfig, env = process.env) {
  const eigenerPort = gesetztGetrimmt(env, 'MAIL_SMTP_PORT');
  const optionen = smtpKonfiguration({
    ...env,
    SMTP_HOST: konfig.smtp.host || '',
    SMTP_PORT: konfig.smtp.port === null ? undefined : String(konfig.smtp.port),
    SMTP_SECURE: eigenerPort ? String(konfig.smtp.port === 465) : env.SMTP_SECURE,
    SMTP_USER: konfig.imap.user || '',
    SMTP_PASS: konfig.imap.pass || '',
  });
  if (!optionen.secure) optionen.requireTLS = true;
  return optionen;
}

/**
 * Optionen fuer new ImapFlow(...). TLS von Anfang an (Port 993); auf 143
 * STARTTLS als Pflicht (doSTARTTLS: true). Kein Protokoll der Bibliothek
 * (logger: false) -- es enthielte Betreffzeilen und Adressen.
 */
function imapOptionen(konfig, env = process.env) {
  const mitTls = konfig.imap.port !== 143;
  return {
    host: konfig.imap.host,
    port: konfig.imap.port,
    secure: mitTls,
    ...(mitTls ? {} : { doSTARTTLS: true }),
    auth: { user: konfig.imap.user, pass: konfig.imap.pass },
    tls: smtpTlsOptionen(env),
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: 30 * 1000,
    greetingTimeout: 15 * 1000,
    socketTimeout: 2 * 60 * 1000,
  };
}

/** Meldung, wenn ein Postfach (noch) nicht eingerichtet ist. */
const nichtEingerichtetMeldung = (konfig) => `Das Postfach ${konfig.adresse} ist noch nicht eingerichtet.`;

module.exports = {
  POSTFAECHER,
  STANDARD_ADRESSEN,
  STANDARD_IMAP_PORT,
  postfachKonfig,
  allePostfaecher,
  smtpOptionen,
  imapOptionen,
  nichtEingerichtetMeldung,
};
