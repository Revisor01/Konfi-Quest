/**
 * Datums- und Uhrzeitformatierung in Berliner Zeit.
 *
 * WARUM DIESE DATEI EXISTIERT
 * ---------------------------
 * `toLocaleTimeString('de-DE')` ohne `timeZone`-Option formatiert in der
 * ZEITZONE DES PROZESSES, nicht in der des Gebietsschemas. Die Backend-
 * Container liefen bis zum 01.09.2026 in UTC (die Variable TZ stand im Stack
 * nur beim Datenbank-Dienst). Damit ging jede Uhrzeit in Push-Nachrichten und
 * E-Mails zwei Stunden zu frueh raus: Eine Konfirmation um 10:00 wurde als
 * "08:00" angekuendigt.
 *
 * Die Container-Zeitzone ist inzwischen gesetzt -- aber sie ist die falsche
 * Stelle, sich darauf zu verlassen. Sie ging beim letzten Umzug schon einmal
 * verloren, und beim naechsten geht sie wieder verloren. Deshalb tragen die
 * Formatierer ihre Zone hier selbst, und die Variable im Stack ist nur noch
 * der Guertel zum Hosentraeger.
 *
 * Wer eine Uhrzeit oder ein Datum fuer MENSCHEN formatiert, nimmt eine
 * Funktion aus dieser Datei -- kein blankes toLocale* mehr.
 */

const ZONE = 'Europe/Berlin';

/** Zeitzone, in der die App fuer Nutzer:innen rechnet und anzeigt. */
const BERLIN = ZONE;

/**
 * Uhrzeit als "14:05".
 * @param {Date|string|number} wert
 * @param {object} [optionen] zusaetzliche Intl-Optionen
 */
function formatUhrzeit(wert, optionen = {}) {
  return new Date(wert).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ZONE,
    ...optionen
  });
}

/**
 * Datum als "05.10.2026" -- oder in der uebergebenen Form.
 * @param {Date|string|number} wert
 * @param {object} [optionen] zusaetzliche Intl-Optionen (weekday, month: 'long' ...)
 */
function formatDatum(wert, optionen = {}) {
  return new Date(wert).toLocaleDateString('de-DE', {
    timeZone: ZONE,
    ...optionen
  });
}

/**
 * Der heutige Kalendertag in Berliner Zeit als "2026-09-01".
 *
 * ERSATZ FUER `new Date().toISOString().split('T')[0]`. Das lieferte IMMER den
 * UTC-Tag -- zwischen 00:00 und 02:00 Berliner Zeit also den Vortag. Punkte,
 * die eine Leitung um 00:30 verbucht hat, trugen dadurch das Datum von
 * gestern, und die Tageslosung wechselte erst um 02:00 statt um Mitternacht.
 *
 * `sv-SE` ist hier kein Zufall und keine Spielerei: Das schwedische
 * Gebietsschema formatiert Daten von Haus aus als ISO (JJJJ-MM-TT), womit sich
 * der Tag samt Zeitzonenumrechnung in einem Schritt ergibt.
 *
 * @param {Date|string|number} [wert] Zeitpunkt; ohne Angabe: jetzt
 * @returns {string} Datum im Format JJJJ-MM-TT
 */
function heuteBerlin(wert = new Date()) {
  return new Date(wert).toLocaleDateString('sv-SE', { timeZone: ZONE });
}

module.exports = { BERLIN, formatUhrzeit, formatDatum, heuteBerlin };
