// TLS-Optionen fuer den Mailversand (Audit 26.09.2026, Sicherheit BF-09).
//
// An beiden Stellen, die einen Mail-Transport bauen (server.js und
// services/emailService.js), stand `tls: { rejectUnauthorized: false }`: Der
// Versand nahm jedes Zertifikat an. Ueber diesen Kanal gehen Passwort-Reset-
// Links, Gemeinde-Einladungen und die Anwesenheits- und Konfispruch-Listen
// ganzer Jahrgaenge (Namen Minderjaehriger). Wer sich zwischen Backend und
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
// Das env-Objekt ist ein Parameter, damit sich die Funktion ohne Eingriff in
// process.env pruefen laesst.
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

module.exports = { smtpTlsOptionen };
