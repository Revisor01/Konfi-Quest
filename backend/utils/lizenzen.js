// Die Lizenzen von Konfi Quest -- EINE Stelle fuer das Backend (03.10.2026).
//
// Simon, 03.10.2026: "Die anderen Limits muessen aber erhalten bleiben. [...]
// Am Anfang duerfen die die Limits auch auswaehlen. Bis die EKD wirklich
// zahlt. Also die Leute waehlen ihre Wunsch[lizenz]!"
//
// Die Gemeinde waehlt im Anfrageformular auf konfi-quest.de ihre Wunschlizenz
// (gemeinde_anfragen.wunsch_lizenz, Migration 192). Die Testphase laeuft mit
// 5 Konfis; danach gilt die Konfi-Zahl der gewuenschten Lizenz -- als
// Vorgabe im Formular der Support-Ansicht (frontend/src/utils/lizenzen.ts,
// konfiLimitVorgabe.ts), nicht als Regel des Servers.
//
// Namen, Konfi-Zahlen und Preise wie auf der Startseite (landing.html,
// Abschnitt "preise"). Der Verbund deckt bis zu vier Gemeinden ab und hat
// keine feste Konfi-Zahl; sein Limit wird abgesprochen.
//
// Gleichlauf: tests/utils/lizenzen.test.js haelt diese Liste mit
// TARIF_STUFEN (utils/konfiLimit.js), der Startseite, dem CHECK der
// Migration 192 und der Liste der Oberflaeche zusammen.

const LIZENZEN = Object.freeze([
  Object.freeze({ schluessel: 'klein', name: 'Klein', konfis: 15, euro: 49 }),
  Object.freeze({ schluessel: 'standard', name: 'Standard', konfis: 50, euro: 99 }),
  Object.freeze({ schluessel: 'plus', name: 'Plus', konfis: 75, euro: 139 }),
  Object.freeze({ schluessel: 'gross', name: 'Groß', konfis: 100, euro: 179 }),
  Object.freeze({ schluessel: 'verbund', name: 'Verbund', konfis: null, euro: 390 }),
]);

const LIZENZ_SCHLUESSEL = Object.freeze(LIZENZEN.map((l) => l.schluessel));

module.exports = { LIZENZEN, LIZENZ_SCHLUESSEL };
