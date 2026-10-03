// Fusszeile und Absendername der Support-Antworten (Migration 193,
// docs/planung/support-mail.md, Entscheidung 6).
//
// Gepflegt wird in der Support-Ansicht (PUT /api/support/mail/einstellungen),
// gespeichert in mail_einstellungen. Hier steht nur der neutrale Vorschlag
// ohne Personennamen -- das Repo ist oeffentlich. Derselbe Vorschlag steht in
// der Migration; tests/schema/migration193SupportMail.test.js haelt beide
// gleich. Fehlt eine Zeile (etwa nach dem Leeren der Tabellen im Testlauf),
// gilt der Vorschlag.

const STANDARD_EINSTELLUNGEN = Object.freeze({
  fusszeile: 'Konfi Quest · Digitale Konfi-Arbeit\nkonfi-quest.de · Handbuch: konfi-quest.de/docs · Datenschutz: konfi-quest.de/datenschutz',
  absendername: 'Konfi Quest',
});

const SCHLUESSEL = Object.freeze(Object.keys(STANDARD_EINSTELLUNGEN));

/**
 * Die Einstellungen, fehlende mit dem Vorschlag aufgefuellt.
 * @param {{query: Function}} db
 * @returns {Promise<{fusszeile: string, absendername: string}>}
 */
async function einstellungenLesen(db) {
  const { rows } = await db.query(
    'SELECT schluessel, wert FROM mail_einstellungen WHERE schluessel = ANY($1::text[])', [SCHLUESSEL]);
  const ergebnis = { ...STANDARD_EINSTELLUNGEN };
  for (const { schluessel, wert } of rows) ergebnis[schluessel] = wert;
  return ergebnis;
}

module.exports = { STANDARD_EINSTELLUNGEN, SCHLUESSEL, einstellungenLesen };
