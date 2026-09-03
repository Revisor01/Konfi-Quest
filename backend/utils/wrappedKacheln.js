// wrappedKacheln.js -- welche Seiten ein Rueckblick zeigt und in welcher
// Reihenfolge.
//
// SIMONS MODELL (02./03.09.2026): Keine Sammlung aus "vier festen plus vier
// zufaelligen", sondern eine ERZAEHLUNG mit fester Dramaturgie, in die sich
// dynamische Seiten einschieben:
//
//   Opener - Chat - Events - Kategorie - Challenges - Challenges Special -
//   Punkte - Badges - Konfi - Abschluss
//
// Rund zehn Seiten fuer eine sehr aktive Person. Die Zahl ergibt sich aus
// dem, was jemand getan hat, nicht aus einer festen Obergrenze.
//
// WAS DABEI GILT (Simons Regeln, nicht aufweichen):
//   - KEINE Negativ-Seiten. Kein Highlight fuers Absagen, keine Fehlzeiten.
//   - Vergleiche nur nach oben und anonym. Wer unter dem Schnitt liegt,
//     bekommt die Seite gar nicht erst.
//   - Challenges ohne Punkte, ohne Zaehler, ohne Rangliste (Migration 118).
//   - Wer wenig getan hat, bekommt keine leere Seite. Eine Kachel mit einer
//     Null darauf ist keine Erinnerung.
//
// WARUM DIESE DATEI FRUEHER NICHTS TAT: Sie existierte seit dem 02.09.2026,
// wurde aber von KEINEM Aufrufer benutzt -- WrappedModal.tsx stellte die
// Seiten fest verdrahtet zusammen. Zwanzig gruene Tests bewiesen nur, dass
// das Modul isoliert funktioniert. Seit dem 03.09.2026 ruft
// generateKonfiSnapshot() waehleKacheln() auf und legt das Ergebnis als
// `kacheln` in den Snapshot.

const { seiteFuerKategorie, datumsFenster, NUR_TEAMER } = require('./wrappedKategorien');

/**
 * Die feste Dramaturgie. Diese Seiten tragen die Erzaehlung (Auftakt, Mitte,
 * Schluss) und erscheinen bei jeder Person -- ohne sie entstuende bei einer
 * stillen Konfi gar kein Rueckblick.
 */
const FESTE_KACHELN = ['intro', 'events', 'punkte', 'badges', 'abschluss'];

/**
 * Die Reihenfolge der Erzaehlung. Jede Seite -- fest wie dynamisch -- hat
 * hier ihren Platz. Was nicht zutrifft, faellt heraus; die Reihenfolge der
 * uebrigen bleibt.
 *
 * Simons Tabelle vom 02.09.2026, um die Kategorie- und Datums-Seiten
 * erweitert (die stehen an Position 4, "der eigene Schwerpunkt").
 */
const DRAMATURGIE = [
  'intro',              // 1  Auftakt
  'chat',               // 2  nur wer wirklich geschrieben hat
  'events',             // 3  Termine des Jahres
  'kategorie',          // 4  der eigene Schwerpunkt (mehrere moeglich)
  'challenges',         // 5  zwei Momente und Stempel
  'challenge-momente',  // 6  Challenges Special: die Bilder, gross
  'punkte',             // 7
  'badges',             // 8
  'seltenstes',         // 8b "Das haben nur x %" -- Simons Idee
  'konfirmation',       // 9  "Konfi"
  'abschluss'           // 10 Uebersicht
];

/**
 * Obergrenze. Simon: "rund zehn Seiten fuer eine sehr aktive Person" --
 * plus Kategorie-Seiten, die mehrfach vorkommen duerfen. 14 ist die harte
 * Grenze, ab der niemand mehr durchblaettert.
 */
const MAX_KACHELN = 14;

// Getrennte Kontingente, KEIN gemeinsames Limit. Gemessen am 03.09.2026:
// Mit einem gemeinsamen Deckel von 3 verdraengten drei Datums-Treffer
// (Weihnachten, Advent, Ostern) saemtliche Kategorie-Seiten -- eine Konfi
// mit 8 Gottesdiensten und 3 Kasualien sah davon keine einzige. Die beiden
// erzaehlen Verschiedenes und duerfen sich nicht gegenseitig auffressen.
const MAX_DATUM_SEITEN = 2;
const MAX_KATEGORIE_SEITEN = 2;

/**
 * Bedingungen der nicht-festen Seiten. `true` = die Seite hat Inhalt.
 * Eine kaputte Bedingung darf nie den ganzen Rueckblick verhindern --
 * deshalb faengt waehleKacheln() Fehler ab.
 */
const BEDINGUNGEN = {
  // Simons Regel woertlich: "Wer nicht viel geschrieben hat, braucht keine
  // Chat-Kachel." Eine einzelne Nachricht ist keine Geschichte.
  chat: (s, schnitt) => {
    const eigene = s.chat?.nachrichten_gesendet || 0;
    if (eigene < 5) return false;
    const mittel = schnitt?.chat;
    // Vergleich nur nach oben: unter dem Schnitt gibt es die Seite nicht.
    return typeof mittel !== 'number' || eigene >= mittel;
  },
  challenges: (s) => (s.challenges?.beitraege || 0) > 0,
  // Nur wenn das Backend ein seltenstes Abzeichen bestimmt hat. Das setzt
  // mindestens 5 Konfis in der Gemeinde voraus -- bei zweien waere "50 %"
  // eine Zahl ohne Aussage.
  seltenstes: (s) => Boolean(s.badges?.seltenstes?.name),
  'challenge-momente': (s) => (s.challenge_momente?.length || 0) > 0,
  konfirmation: (s) => Boolean(s.zeitraum?.konfirmation)
};

/**
 * Waehlt die Kategorie- und Datums-Seiten.
 *
 * VORRANG DATUM VOR KATEGORIE (Simon, 02.09.2026): "Gottesdienst im
 * Dezember ist ja immer auch Advent." Ein Termin am 24.12. ist Christvesper,
 * ganz gleich wie die Kategorie heisst. Trifft beides zu, gewinnt das Datum.
 *
 * @param {object} slides
 * @returns {string[]} z. B. ['datum:weihnachten', 'kategorie:freizeit']
 */
function waehleKategorieSeiten(slides) {
  const seiten = [];

  // 1. Datums-Seiten aus den Terminen -- sie gehen vor.
  const datumsTreffer = new Map();
  for (const t of (slides.termine_daten || [])) {
    const fenster = datumsFenster(t);
    if (!fenster) continue;
    datumsTreffer.set(fenster, (datumsTreffer.get(fenster) || 0) + 1);
  }
  const datumsSeiten = [...datumsTreffer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_DATUM_SEITEN)
    .map(([fenster]) => `datum:${fenster}`);

  // 2. Kategorie-Seiten -- nur unsere Standardnamen, alles andere faellt auf
  //    die allgemeine Schwerpunkt-Seite (siehe unten).
  const verteilung = slides.kategorie?.verteilung || [];
  const kategorieSeiten = [];
  let fremde = 0;
  for (const eintrag of verteilung) {
    const seite = seiteFuerKategorie(eintrag.kategorie);
    if (!seite) { fremde += eintrag.count || 0; continue; }
    if (NUR_TEAMER.has(seite)) continue; // Teamtreff nur im Teamer-Rueckblick
    const key = `kategorie:${seite}`;
    if (!kategorieSeiten.includes(key)) kategorieSeiten.push(key);
  }
  seiten.push(...datumsSeiten, ...kategorieSeiten.slice(0, MAX_KATEGORIE_SEITEN));

  // 3. Auffangnetz: Wer ueberwiegend eigene Kategorien nutzt, bekommt die
  //    allgemeine Seite "Deine haeufigste Kategorie: ..." statt gar nichts.
  //    Simons Regel: "Oder es wird allgemein: deine haeufigste Kategorie."
  if (seiten.length === 0 && fremde > 0 && slides.kategorie?.top_kategorie) {
    seiten.push('kategorie-allgemein');
  }

  return seiten;
}

/**
 * Waehlt die Seiten eines Konfi-Rueckblicks in Anzeigereihenfolge.
 *
 * @param {object} slides    die `slides` des Snapshots
 * @param {object} [schnitt] anonyme Jahrgangsmittelwerte ({chat, events})
 * @returns {string[]} Seiten-Schluessel in Anzeigereihenfolge
 */
function waehleKacheln(slides, schnitt = null) {
  if (!slides || typeof slides !== 'object') return [...FESTE_KACHELN];

  const kategorieSeiten = (() => {
    try { return waehleKategorieSeiten(slides); } catch { return []; }
  })();

  const gewaehlt = [];
  for (const key of DRAMATURGIE) {
    if (key === 'kategorie') {
      gewaehlt.push(...kategorieSeiten);
      continue;
    }
    if (FESTE_KACHELN.includes(key)) { gewaehlt.push(key); continue; }
    const bedingung = BEDINGUNGEN[key];
    if (!bedingung) continue;
    let trifft = false;
    try { trifft = bedingung(slides, schnitt) === true; } catch { trifft = false; }
    if (trifft) gewaehlt.push(key);
  }

  // Doppelte raus (Reihenfolge bleibt), dann deckeln. Der Abschluss ist
  // IMMER die letzte Seite -- auch wenn der Deckel vorher greift.
  const ohneDoppelte = gewaehlt.filter((k, i, arr) => arr.indexOf(k) === i);
  if (ohneDoppelte.length <= MAX_KACHELN) return ohneDoppelte;

  const ohneAbschluss = ohneDoppelte.filter(k => k !== 'abschluss');
  return [...ohneAbschluss.slice(0, MAX_KACHELN - 1), 'abschluss'];
}

module.exports = {
  waehleKacheln,
  waehleKategorieSeiten,
  FESTE_KACHELN,
  DRAMATURGIE,
  MAX_KACHELN,
  MAX_DATUM_SEITEN,
  MAX_KATEGORIE_SEITEN,
  BEDINGUNGEN
};
