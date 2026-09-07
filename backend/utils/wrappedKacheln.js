// wrappedKacheln.js -- welche Seiten ein Rueckblick zeigt und in welcher
// Reihenfolge.
//
// SIMONS MODELL (02./03.09.2026): Keine Sammlung aus "vier festen plus vier
// zufaelligen", sondern eine ERZAEHLUNG mit fester Dramaturgie, in die sich
// dynamische Seiten einschieben:
//
//   Opener - Events - Kategorie - Challenges - Challenges Special -
//   Punkte - Aktivster Monat - Badges - Konfi - Abschluss
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
const FESTE_KACHELN = ['intro', 'events', 'punkte', 'badges', 'abschluss', 'werde-teamer'];

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
  // 'chat' STAND HIER (bis 06.09.2026) und wurde nie gezeigt: Es gab
  // keinen Renderer und ueberhaupt keine Chat-Komponente -- die Seite blieb
  // leer. Ersatzlos gestrichen statt nachgebaut, weil die Chat-Zahlen
  // bereits eine Seite haben: Das persoenliche Highlight ('chat_star',
  // 'reaktions_magnet') zeigt genau diese Werte, und zwar genau dann, wenn
  // jemand darin heraussticht. Eine zweite Chat-Seite haette dieselbe Zahl
  // ein zweites Mal erzaehlt.
  'events',             // 2  Termine des Jahres
  'kategorie',          // 3  der eigene Schwerpunkt (mehrere moeglich)
  'challenges',         // 4  wie oft du mitgemacht hast
  'challenge-momente',  // 5  Challenges Special: die Bilder, gross
  'punkte',             // 6
  // 7: Der aktivste Monat -- eine Zeit-/Rhythmus-Seite ("wann warst du am
  // meisten unterwegs"). Sie stand bis zum 06.09.2026 NICHT hier, obwohl es
  // die Komponente, den Renderer und die Daten (slides.aktivster_monat)
  // laengst gab. Seit Snapshot-Version 3 das Backend die Seiten waehlt,
  // wurde sie deshalb nie mehr gezeigt -- nur der v2-Fallback im Frontend
  // kannte sie noch.
  //
  // Der Platz ist bewusst hier: nach den Punkten, vor den Abzeichen. Die
  // Punkte sagen WIE VIEL, der Monat sagt WANN -- zusammen ergeben sie das
  // Bild des Jahres, bevor es zu den Auszeichnungen geht.
  'aktivster-monat',    // 7  wann du am meisten unterwegs warst
  'badges',             // 8
  'seltenstes',         // 8b "Das haben nur x %" -- Simons Idee
  'konfirmation',       // 9  "Konfi"
  'abschluss',          // 10 Uebersicht
  // 11: Die Einladung ins Team -- Simons Vorgabe 03.09.2026, "eine letzte
  // Seite bei Konfis: Werde Teamerin". Steht bewusst NACH dem Abschluss:
  // erst der Rueckblick, dann der Blick nach vorn.
  'werde-teamer'
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
  // Kachel." Eine einzelne Teilnahme ist keine Geschichte -- deshalb erst
  // ab dem ersten echten Beitrag.
  challenges: (s) => (s.challenges?.beitraege || 0) > 0,
  // Nur wenn das Backend ein seltenstes Abzeichen bestimmt hat. Das setzt
  // mindestens 5 Konfis in der Gemeinde voraus -- bei zweien waere "50 %"
  // eine Zahl ohne Aussage.
  seltenstes: (s) => Boolean(s.badges?.seltenstes?.name),
  'challenge-momente': (s) => (s.challenge_momente?.length || 0) > 0,
  // Mindestens zwei Aktivitaeten in dem Monat. Bei einer einzigen waere
  // "dein aktivster Monat" keine Aussage ueber einen Rhythmus, sondern nur
  // der Monat, in dem zufaellig das Einzige stattfand -- und "1 Aktivitaet"
  // gross auf einer Seite ist wieder eine Kachel mit fast einer Null darauf.
  'aktivster-monat': (s) => (s.aktivster_monat?.aktivitaeten || 0) >= 2,
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

  // Abschluss und Einladung stehen IMMER am Ende, auch wenn der Deckel
  // vorher greift.
  const schluss = ohneDoppelte.filter(k => k === 'abschluss' || k === 'werde-teamer');
  const rest = ohneDoppelte.filter(k => k !== 'abschluss' && k !== 'werde-teamer');
  return [...rest.slice(0, MAX_KACHELN - schluss.length), ...schluss];
}

/**
 * =====================================================================
 * DER TEAMER-RUECKBLICK
 * =====================================================================
 *
 * BEFUND 06.09.2026: Der Teamer-Rueckblick hatte sieben fest verdrahtete
 * Seiten OHNE jede Bedingung -- das Handbuch (95-wrapped.md) hielt das sogar
 * ausdruecklich fest ("immer genau sieben Seiten, ohne Bedingungen"). Simons
 * Grundregel "Eine Kachel mit einer Null darauf ist keine Erinnerung" galt
 * damit fuer Konfis, aber nicht fuers Team: Wer neu dabei war, bekam
 * "0 Abzeichen", "0 Zertifikate" und "0 Konfis" als eigene Seiten
 * hintereinander.
 *
 * Die einzige Ausnahme war die Jahre-Seite, die das Frontend seit dem
 * 01.09.2026 bei fehlendem teamer_since aussparte -- eine Bedingung an der
 * falschen Stelle, im Frontend statt in der Auswahl.
 */

/**
 * Fest: Auftakt und Abschluss tragen die Erzaehlung. Ohne sie entstuende bei
 * einer neuen Teamer:in gar kein Rueckblick.
 */
const FESTE_TEAMER_KACHELN = ['teamer-intro', 'teamer-abschluss'];

/** Die Reihenfolge des Teamer-Rueckblicks. */
const TEAMER_DRAMATURGIE = [
  'teamer-intro',        // 1  Auftakt
  'teamer-events',       // 2  die Termine des Jahres
  'teamer-konfis',       // 3  wen du begleitet hast
  'teamer-badges',       // 4  Abzeichen
  'teamer-zertifikate',  // 5  Zertifikate
  // 6: Der Antwortende -- die Zuwendung, die im Team selten jemand sieht.
  // Steht bei den Menschen-Seiten (nach den Konfis), nicht bei den Zahlen.
  'teamer-antworten',    // 6  wie oft du geantwortet hast
  'teamer-jahre',        // 7  "seit x Jahren dabei"
  // 7: Die eigene Geschichte -- wer heute im Team ist und frueher selbst
  // Konfi war. Steht bewusst NACH den Jahren im Team: erst wie lange du
  // dabei bist, dann wie es angefangen hat. Und vor dem Abschluss, damit
  // der Rueckblick auf dem persoenlichsten Punkt ausklingt.
  'teamer-konfi-zeit',   // 8  vom Konfi zur Teamer:in
  'teamer-abschluss'     // 9  Uebersicht
];

/**
 * Bedingungen der nicht-festen Teamer-Seiten. Dieselbe Regel wie bei den
 * Konfis: Eine Seite erscheint nur, wenn sie etwas zu erzaehlen hat.
 */
const TEAMER_BEDINGUNGEN = {
  // Wer im Zeitraum keinen Termin begleitet hat, braucht keine Termin-Seite.
  'teamer-events': (s) => (s.events_geleitet?.total || 0) > 0,
  // "0 Konfis betreut" ist keine Erinnerung, sondern eine Luecke in der
  // Jahrgangs-Zuweisung.
  'teamer-konfis': (s) => (s.konfis_betreut?.total_konfis || 0) > 0,
  'teamer-badges': (s) => (s.badges?.total_earned || 0) > 0,
  'teamer-zertifikate': (s) => (s.zertifikate?.total || 0) > 0,
  // Ohne Eintrittsdatum rechnet das Backend 0 Jahre -- das waere eine
  // Aussage ueber eine fehlende Angabe, nicht ueber die Person. Diese
  // Pruefung stand bisher im Frontend (WrappedModal); sie gehoert hierher,
  // wo alle anderen auch stehen.
  // Erst ab fuenf Antworten. Eine einzelne Antwort ist keine Geschichte --
  // dieselbe Schwelle, die im Konfi-Zweig fuer den Chat galt.
  'teamer-antworten': (s) => (s.chat?.antworten || 0) >= 5,
  'teamer-jahre': (s) => Boolean(s.engagement?.teamer_seit),
  // Nur wenn die Person wirklich selbst Konfi in DIESER Gemeinde war. Wer
  // von aussen ins Team kam, bekommt die Seite nicht -- eine erfundene
  // Herkunft waere schlimmer als gar keine Seite.
  'teamer-konfi-zeit': (s) => Boolean(s.konfi_zeit)
};

/**
 * Waehlt die Seiten eines Teamer-Rueckblicks in Anzeigereihenfolge.
 *
 * @param {object} slides die `slides` des Teamer-Snapshots
 * @returns {string[]} Seiten-Schluessel in Anzeigereihenfolge
 */
function waehleTeamerKacheln(slides) {
  if (!slides || typeof slides !== 'object') return [...FESTE_TEAMER_KACHELN];

  const gewaehlt = [];
  for (const key of TEAMER_DRAMATURGIE) {
    if (FESTE_TEAMER_KACHELN.includes(key)) { gewaehlt.push(key); continue; }
    const bedingung = TEAMER_BEDINGUNGEN[key];
    if (!bedingung) continue;
    let trifft = false;
    // Eine kaputte Bedingung darf nie den ganzen Rueckblick verhindern.
    try { trifft = bedingung(slides) === true; } catch { trifft = false; }
    if (trifft) gewaehlt.push(key);
  }

  // Doppelte raus, Reihenfolge bleibt. Der Abschluss steht immer am Ende --
  // er ist die letzte Seite der DRAMATURGIE und wird nie gedeckelt (der
  // Teamer-Rueckblick hat hoechstens sieben Seiten, MAX_KACHELN kann hier
  // gar nicht greifen).
  return gewaehlt.filter((k, i, arr) => arr.indexOf(k) === i);
}

module.exports = {
  waehleKacheln,
  waehleTeamerKacheln,
  waehleKategorieSeiten,
  FESTE_KACHELN,
  DRAMATURGIE,
  MAX_KACHELN,
  MAX_DATUM_SEITEN,
  MAX_KATEGORIE_SEITEN,
  BEDINGUNGEN,
  FESTE_TEAMER_KACHELN,
  TEAMER_DRAMATURGIE,
  TEAMER_BEDINGUNGEN
};
