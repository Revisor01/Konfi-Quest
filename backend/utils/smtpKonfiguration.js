// SMTP-Konfiguration fuer den Mailversand -- eine Quelle fuer beide
// Transporte (server.js und services/emailService.js).
//
// KEIN EINGEBAUTER HOST, KEIN EINGEBAUTER NUTZER (Audit 26.09.2026,
// Sicherheit BF-12 / S-15): An beiden Stellen stand ein Fallback-Hostname
// samt Absenderadresse im Code -- Betriebsdaten im oeffentlichen Repo, und
// ein Versand, der bei fehlender Konfiguration still an eine eingebaute
// Adresse ging. Host und Nutzer kommen jetzt ausschliesslich aus der
// Umgebung (SMTP_HOST, SMTP_USER). Fehlen sie, gibt es keinen stillen Ersatz:
// smtpKonfiguration() warnt beim Aufbau, und emailService.js weist den
// Versand mit einer klaren Meldung ab.
//
// ZERTIFIKAT WIRD GEPRUEFT (Audit 26.09.2026, Sicherheit BF-09): An beiden
// Stellen stand `tls: { rejectUnauthorized: false }` -- der Versand nahm
// jedes Zertifikat an. Ueber diesen Kanal gehen Passwort-Reset-Links,
// Gemeinde-Einladungen und die Anwesenheits- und Konfispruch-Listen ganzer
// Jahrgaenge (Namen Minderjaehriger). Wer sich zwischen Backend und
// Mailserver setzen kann, las mit und setzte fremde Passwoerter.
//
// STANDARD IST STRENG: Das Zertifikat des Mailservers muss zur Kette und zum
// Hostnamen passen (SMTP_HOST). Passt es beim Anbieter nicht -- etwa weil der
// Server unter einem anderen Namen zertifiziert ist als dem, den wir
// ansprechen --, wuerde nach dem Deploy keine Mail mehr rausgehen. Deshalb
// gibt es einen Notnagel: SMTP_TLS_REJECT_UNAUTHORIZED=false schaltet die
// Pruefung ab, aber nicht still -- bei jedem Aufbau eines Transports steht
// eine Warnzeile im Log. Sie soll stoeren, bis das Zertifikat stimmt.
//
// Vor dem Deploy pruefen (Hostname und Port aus dem Stack einsetzen):
//   openssl s_client -connect <SMTP_HOST>:465 -servername <SMTP_HOST> </dev/null
//   (bei STARTTLS auf 587: openssl s_client -starttls smtp -connect <SMTP_HOST>:587)
// "Verify return code: 0 (ok)" -> alles gut; sonst den Notnagel setzen und
// beim Anbieter ein passendes Zertifikat einfordern.
//
// Das env-Objekt ist ein Parameter, damit sich beide Funktionen ohne Eingriff
// in process.env pruefen lassen.
const smtpTlsOptionen = (env = process.env) => {
  const wert = String(env.SMTP_TLS_REJECT_UNAUTHORIZED ?? '').trim().toLowerCase();
  const abgeschaltet = wert === 'false';
  if (abgeschaltet) {
    console.warn(
      'WARNUNG: SMTP_TLS_REJECT_UNAUTHORIZED=false -- der Mailversand prueft das ' +
      'Zertifikat des Mailservers NICHT. Reset-Links und Listen mit Namen gehen ' +
      'ungeschuetzt gegen Mitlesen raus. Nur als Notnagel, bis das Zertifikat passt.'
    );
  }
  return { rejectUnauthorized: !abgeschaltet };
};

const smtpKonfiguration = (env = process.env) => {
  if (!env.SMTP_HOST || !env.SMTP_USER) {
    console.warn(
      'WARNUNG: SMTP_HOST oder SMTP_USER nicht gesetzt -- der Mailversand ist nicht ' +
      'konfiguriert, einen eingebauten Ersatz gibt es nicht. Reset-Links, Einladungen ' +
      'und Listen gehen so nicht raus. Beide Werte als Stack-Variablen setzen.'
    );
  }
  return {
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT || '465', 10),
    secure: env.SMTP_SECURE !== 'false', // Default: true (Port 465 mit TLS)
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    },
    tls: smtpTlsOptionen(env)
  };
};

module.exports = { smtpTlsOptionen, smtpKonfiguration };
