// wrappedKategorien.js -- welche Kategorie-Seite ein Termin ausloest.
//
// Simons Vorgabe (02.09.2026): "Wir setzen 6 oder 8 Kategorien, die dann
// vorkommen als moeglicher Slide." Nicht EINE Seite mit wechselndem Inhalt,
// sondern mehrere feste, benannte Seiten mit eigenem Bild und eigenem Ton.
//
// Und sein Nachtrag, der der bessere Weg ist:
//   "Gottesdienst im Dezember ist ja immer auch Advent/Weihnachten.
//    Und Neujahr koennen wir auch uebers Datum machen."
//
// WARUM DAS DATUM VORGEHT: Kategorien sind pro Gemeinde frei benannt.
// Gemessen am 02.09.2026 in Produktion heisst dieselbe Sache je nach
// Gemeinde "Sonntag", "Gottesdienst", "Gottesdienst an Weihnachten" oder
// "Gottesdienst in der Karwoche oder an Ostern". Ein Termin am 24.12. ist
// aber Christvesper, ganz gleich wie die Kategorie heisst. Das Datum luegt
// nicht, der Name schon.
//
// VORRANG: Trifft beides zu (Kategorie UND Datum), gewinnt das Datum -- es
// ist das konkretere Ereignis. Eine Person bekommt nie zwei Seiten ueber
// denselben Termin.

// ---------------------------------------------------------------------------
// Bewegliche Feiertage -- berechnet, NICHT hartkodiert
// ---------------------------------------------------------------------------

/**
 * Ostersonntag nach der Gaussschen Osterformel (gregorianisch).
 *
 * Bewusst gerechnet statt als Jahrestabelle gepflegt: Eine Tabelle laeuft
 * irgendwann ab, und der Rueckblick soll auch 2031 noch stimmen, ohne dass
 * jemand daran denkt.
 *
 * @param {number} jahr
 * @returns {Date} Ostersonntag, lokale Mitternacht
 */
function ostersonntag(jahr) {
  const a = jahr % 19;
  const b = Math.floor(jahr / 100);
  const c = jahr % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31); // 3 = Maerz, 4 = April
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(jahr, monat - 1, tag);
}

/**
 * Der 1. Advent: der vierte Sonntag vor dem 25.12.
 *
 * Gerechnet statt geraten -- er wandert zwischen dem 27.11. und dem 3.12.
 */
function ersterAdvent(jahr) {
  const weihnachten = new Date(jahr, 11, 25);
  // Zum 4. Advent (letzter Sonntag vor/am 24.12.) zurueck, dann 3 Wochen.
  const tagVorWeihnachten = weihnachten.getDay(); // 0 = Sonntag
  const vierterAdvent = new Date(jahr, 11, 25 - (tagVorWeihnachten === 0 ? 7 : tagVorWeihnachten));
  return new Date(vierterAdvent.getFullYear(), vierterAdvent.getMonth(), vierterAdvent.getDate() - 21);
}

/** Aschermittwoch: 46 Tage vor Ostern. */
function aschermittwoch(jahr) {
  const o = ostersonntag(jahr);
  return new Date(o.getFullYear(), o.getMonth(), o.getDate() - 46);
}

/** Erster Sonntag im Oktober (Erntedank). */
function erntedank(jahr) {
  const d = new Date(jahr, 9, 1);
  const versatz = (7 - d.getDay()) % 7;
  return new Date(jahr, 9, 1 + versatz);
}

/** Datum ohne Uhrzeit vergleichen -- sonst kippt ein Termin um 20 Uhr raus. */
function nurTag(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

/**
 * Welches Zeitfenster trifft dieses Datum?
 *
 * Reihenfolge ist Absicht: Weihnachten vor Advent, sonst schluckte das
 * Advent-Fenster den 24.12.
 *
 * @param {Date|string} datum
 * @returns {string|null} Schluessel der Datums-Seite oder null
 */
function datumsFenster(datum) {
  if (!datum) return null;
  const d = nurTag(datum);
  if (isNaN(d.getTime())) return null;
  const jahr = d.getFullYear();

  const weihnachtenVon = new Date(jahr, 11, 24);
  const weihnachtenBis = new Date(jahr, 11, 26);
  if (d >= weihnachtenVon && d <= weihnachtenBis) return 'weihnachten';

  const adventVon = ersterAdvent(jahr);
  const adventBis = new Date(jahr, 11, 23);
  if (d >= adventVon && d <= adventBis) return 'advent';

  // Jahreswechsel laeuft ueber den Jahresbruch: 27.12. bis 6.1.
  if ((d.getMonth() === 11 && d.getDate() >= 27) ||
      (d.getMonth() === 0 && d.getDate() <= 6)) return 'jahreswechsel';

  const ostern = ostersonntag(jahr);
  const passionVon = aschermittwoch(jahr);
  const osterMontag = new Date(ostern.getFullYear(), ostern.getMonth(), ostern.getDate() + 1);
  if (d >= passionVon && d <= osterMontag) return 'ostern';

  const ed = erntedank(jahr);
  if (d.getTime() === ed.getTime()) return 'erntedank';

  if (d.getMonth() === 6 || d.getMonth() === 7) return 'sommer';

  return null;
}

// ---------------------------------------------------------------------------
// Kategorie-Erkennung ueber den Namen
// ---------------------------------------------------------------------------

/**
 * UNSER VOKABULAR -- die acht Standardkategorien der App.
 *
 * Simons Entscheidung (03.09.2026), woertlich:
 *   "8 Kategorien als Standard fuer alle, daraus Seiten machen. Aber alles
 *    was andere anlegen ist uns egal. Dann faellt es runter. Oder es wird
 *    allgemein: deine haeufigste Kategorie. Wir definieren und
 *    programmieren die App!"
 *
 * WARUM DAS DER RICHTIGE WEG IST: Der erste Versuch sammelte die frei
 * getippten Namen aus allen fuenf Organisationen ein und riet, auf welche
 * Seite sie gehoeren ("Sonntag" -> Gottesdienst, "Gruppen/ Treffen" ->
 * Jugend). Das ist Woerterbuchpflege ohne Ende: Jede neue Gemeinde erfindet
 * neue Namen, und wir haengen hinterher. Schlimmer noch -- wir haetten fuer
 * das Vokabular fremder Gemeinden Seiten gebaut, die wir selbst nie so
 * genannt haetten.
 *
 * Stattdessen haengen die Seiten an den Standardkategorien, die die App bei
 * jeder neuen Gemeinde selbst anlegt (routes/organizations.js,
 * defaultCategories). Wer sie behaelt, bekommt die Seiten. Wer eigene Namen
 * vergibt, faellt auf die allgemeine Schwerpunkt-Seite ("Deine haeufigste
 * Kategorie: Kreativ") -- niemand geht leer aus, aber wir erfinden auch
 * keine Seite fuer fremdes Vokabular.
 *
 * DIESE LISTE MUSS ZU defaultCategories IN routes/organizations.js PASSEN.
 * Ein Test haelt beide zusammen (wrappedKategorien.test.js).
 *
 * Toleriert wird nur Normalisierung derselben Begriffe: Gross-/Klein-
 * schreibung, Bindestrich, Randleerzeichen. Das ist keine Fremdwort-
 * Erkennung.
 */
const STANDARD_SEITEN = {
  fest: 'Fest',
  senioren: 'Senior:innen',
  jugend: 'Jugend',
  oeffentlichkeit: '\u00d6ffentlichkeitsarbeit',
  freizeit: 'Freizeit',
  weihnachten: 'Weihnachten',
  konzert: 'Konzert',
  kinder: 'Kinder',
  kreativ: 'Kreativ',
  seelsorge: 'Seelsorge',
  // Kasualien traegt eine eigene Seite (Simon, 03.09.2026: "Kasualien ist
  // wichtig"). Es ist zugleich die groesste Gruppe in den Daten -- 12 von 35
  // Aktivitaet-Zuordnungen. Taufe, Trauung, Beerdigung sind fuer Konfis der
  // Ernstfall des Glaubens, nicht eine Statistikzeile.
  kasualien: 'Kasualien',
  // Gottesdienst ebenfalls (Simon: "von mir aus auch"). Die Seite doppelt
  // zwar die Punkte-Achse ein Stueck weit, aber sie ist der Kern der
  // Konfi-Zeit und traegt eine eigene Aussage.
  gottesdienst: 'Gottesdienst',
  // Gemeinde ebenfalls (Simon, 03.09.2026). Damit tragen alle
  // Standardkategorien eine eigene Seite -- die Unterscheidung
  // "Kategorie, aber keine Seite" gibt es nicht mehr.
  gemeinde: 'Gemeinde',
  // Teamer-Seite: erscheint nur im Teamer-Rueckblick.
  teamtreff: 'Teamtreff'
};

// NICHT jede Standardkategorie traegt eine Seite. "Gottesdienst" und
// "Gemeinde" werden beim Anlegen einer Gemeinde weiterhin erzeugt (viele
// erwarten sie), bekommen im Rueckblick aber KEINE eigene Seite: Sie sind
// die Punkte-Achse (activities.type gottesdienst/gemeinde) und wuerden nur
// wiederholen, was die Punkte-Seite ohnehin zeigt. "Kasualien" bleibt
// ebenfalls Kategorie (die Standard-Aktivitaeten Taufe/Hochzeit/Beerdigung
// haengen daran), traegt aber keine eigene Seite -- Simons Zehn sind die
// Anlaesse, nicht die Amtshandlungen.

const NUR_TEAMER = new Set(['teamtreff']);

/** Vergleichsform: klein, Bindestrich wie Leerzeichen, ohne Raender. */
function normalisiere(s) {
  return String(s).trim().toLowerCase().replace(/[-\s]+/g, ' ');
}

/**
 * Ordnet einen Kategorienamen einer festen Seite zu -- NUR wenn er einer
 * unserer acht Standardkategorien entspricht.
 *
 * Alles andere gibt null. Das ist Absicht und kein Loch: Der Aufrufer
 * sammelt diese Faelle in der allgemeinen Seite "Deine haeufigste
 * Kategorie: ...".
 *
 * @param {string} name
 * @returns {string|null} Seiten-Schluessel oder null
 */
function seiteFuerKategorie(name) {
  if (!name || typeof name !== 'string') return null;
  const n = normalisiere(name);
  if (!n) return null;
  for (const [schluessel, anzeige] of Object.entries(STANDARD_SEITEN)) {
    if (n === normalisiere(anzeige) || n === normalisiere(schluessel)) return schluessel;
  }
  return null;
}

module.exports = {
  ostersonntag,
  ersterAdvent,
  aschermittwoch,
  erntedank,
  datumsFenster,
  seiteFuerKategorie,
  STANDARD_SEITEN,
  NUR_TEAMER
};
