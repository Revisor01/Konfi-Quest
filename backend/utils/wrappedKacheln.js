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
 *
 * VON SECHS AUF DREI (07.09.2026, gemessen an Produktion): 'events',
 * 'punkte' und 'badges' standen hier und hatten damit KEINE Bedingung --
 * sie erschienen auch mit einer glatten Null darauf. Gemessen an einer
 * echten Konfi (Org 1, Jahrgang 2026/27): Ihr Jahrgang hat einen
 * Konfirmationstermin im Mai 2027, der Zeitraum beginnt deshalb am
 * 01.09.2026 -- ihre 20 Abzeichen aus dem Sommer 2026 liegen davor und
 * fallen heraus. Sie bekam eine Seite "0 von 55".
 *
 * Das verletzt Simons Grundregel oben: "Eine Kachel mit einer Null darauf
 * ist keine Erinnerung." Die drei Zahl-Seiten haben jetzt Bedingungen wie
 * jede andere Zahl-Seite auch (siehe BEDINGUNGEN).
 *
 * WAS FEST BLEIBT UND WARUM: 'intro' zeigt Name und Jahrgang, 'werde-teamer'
 * ist reiner Text -- beide koennen gar keine Null tragen. 'abschluss' traegt
 * Gemeinde, Punkte, Konfirmationstermin und Simons Botschaft
 * ("Dein Weg. Deine Zeit. Dein Glaube.") als Seiteninhalt;
 * die drei Zahlen darunter sind eine Zusammenfassung, kein Highlight. Ohne
 * diese drei entstuende bei einer stillen Konfi ueberhaupt kein Rueckblick.
 */
// Reihenfolge wie in der DRAMATURGIE: Auftakt, dann die Einladung ins Team,
// dann der Abschluss als letzte Seite (Simon, 07.09.2026).
const FESTE_KACHELN = ['intro', 'werde-teamer', 'abschluss'];

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
  // 2b: Warteliste-Held:in -- direkt bei den Terminen, weil die Seite von
  // ihnen erzaehlt: nicht wie viele, sondern wie du hineingekommen bist.
  'warteliste',         // 2b du hast gewartet und es hat geklappt
  'kategorie',          // 3  der eigene Schwerpunkt (mehrere moeglich)
  // 3b: Die Sonderseite zur Sommerfreizeit 2026 nach Stavanger. Sie steht
  // direkt bei den Schwerpunkt-Seiten, weil sie dieselbe Frage beantwortet
  // -- wo warst du -- nur eben fuer die eine Fahrt, ueber die man nachher
  // noch jahrelang redet. Wer nicht dabei war, sieht sie nie.
  'stavanger-2026',     // 3b die Fahrt nach Norwegen
  'challenges',         // 4  wie oft du mitgemacht hast
  'challenge-momente',  // 5  Challenges Special: die Bilder, gross
  // 5b: Der Vielseitige -- direkt bei den Challenges, weil er von ihnen
  // erzaehlt: nicht wie viele Beitraege, sondern auf wie vielen Wegen.
  'vielseitig',         // 5b mit wie vielen Medienarten du geantwortet hast
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
  // 7b/7c: Zwei weitere Zeit-/Rhythmus-Seiten, direkt beim aktivsten Monat.
  // Erst WANN im Jahr (Monat), dann WIE LANG (Spanne), dann AN WELCHEM TAG.
  'langer-atem',        // 7b ueber welche Spanne du dabei warst
  'wochentag',          // 7c an welchem Tag deine Termine lagen
  'badges',             // 8
  'seltenstes',         // 8b "Das haben nur x %" -- Simons Idee
  'konfirmation',       // 9  "Konfi"
  // 10: Die Einladung ins Team -- Simons Vorgabe 03.09.2026, "eine letzte
  // Seite bei Konfis: Werde Teamerin".
  //
  // SIE STAND BIS ZUM 07.09.2026 GANZ AM ENDE, hinter dem Abschluss ("erst
  // der Rueckblick, dann der Blick nach vorn"). Simon hat die beiden nach
  // dem Ansehen auf dem Geraet getauscht, woertlich: "Das soll auch die
  // letzte Folie sein. Die Teamer Folie als vorletztes."
  //
  // WARUM DAS BESSER IST: Der Abschluss ist die Seite, die geteilt wird --
  // Gemeinde, Punkte, Konfirmationstermin und Simons Botschaft "Dein Weg.
  // Deine Zeit. Dein Glaube." Was am Ende stehen bleibt, soll das sein,
  // was man weitergibt, nicht die Einladung ins Team.
  'werde-teamer',       // 10 der Blick nach vorn
  'abschluss'           // 11 Uebersicht und Schlusswort -- die letzte Seite
];

/**
 * Obergrenze. Simon, 07.09.2026, woertlich:
 *
 *   "damit es wirklich unterschiedlich ist, sollen die Konfis ja nicht 19
 *    Folien sehen, sondern jeder kriegt maximal 10 Folien. Wir gucken,
 *    welche die besonderen Folien sind, um sie zu kriegen."
 *
 * VON 19 AUF 10 -- UND DIE AUSWAHL WIRD UMGEDREHT.
 *
 * WARUM 19 DIE FALSCHE RICHTUNG WAR: Der Deckel wurde an einem einzigen Tag
 * dreimal hochgesetzt (14 -> 18 -> 19), jedes Mal weil eine neu
 * hinzugekommene Seite eine alte verdraengt hatte. Das kuriert das Symptom.
 * Gemessen kamen dabei 6 bis 19 Seiten heraus, im Schnitt 14,5 -- fuer einen
 * Rueckblick, den man einmal durchwischt, deutlich zu viel, und fuer den
 * Vergleich untereinander nichtssagend: Wer 14 Seiten sieht und wer 15
 * sieht, hat praktisch dasselbe gesehen.
 *
 * WAS STATTDESSEN ZAEHLT: nicht mehr die Position in der Dramaturgie,
 * sondern die SELTENHEIT. Siehe seltenheitFuer() weiter unten.
 */
const MAX_KACHELN = 10;

// WIE VIELE Kategorie- und Datums-Seiten ueberhaupt in die Auswahl gehen.
//
// Das sind KEINE Kontingente mehr im alten Sinn. Frueher entschieden sie
// mit, welche Seiten am Ende uebrig blieben -- wer drei Datums-Treffer
// hatte, verlor dadurch Kategorie-Seiten. Diese Entscheidung trifft jetzt
// die Seltenheit (siehe waehleKacheln), und zwar ueber alle Seiten hinweg.
//
// Was hier bleibt, ist eine Vorauswahl gegen Wildwuchs: Eine Konfi mit
// zwoelf verschiedenen Kategorien soll nicht zwoelf fast gleiche Seiten in
// den Wettbewerb schicken und damit alles andere verdraengen -- die zwei
// staerksten je Sorte reichen, den Rest entscheidet die Seltenheit.
const MAX_DATUM_SEITEN = 2;
const MAX_KATEGORIE_SEITEN = 2;

/**
 * Die Zeit-/Rhythmus-Seiten ('aktivster-monat', 'langer-atem', 'wochentag').
 * Sie beantworten alle dieselbe Frage: WANN warst du da.
 *
 * DAS KONTINGENT IST WEG (07.09.2026) -- und das war ein Fehler, den es zu
 * belegen gilt, nicht bloss aufzuraeumen.
 *
 * BEFUND: 'wochentag' war praktisch UNERREICHBAR. Das Kontingent liess zwei
 * Zeit-Seiten zu und wurde in der Reihenfolge der Dramaturgie gefuellt --
 * 'aktivster-monat' steht dort vor 'langer-atem', und dieses vor
 * 'wochentag'. Wer die Bedingung fuer 'wochentag' erfuellte (mindestens 4
 * Termine an einem Tag UND die Haelfte aller Termine), erfuellte fast immer
 * auch die beiden davor -- denn beide verlangen weniger. Die Seite fiel
 * damit heraus, ohne dass irgendwo etwas fehlschlug.
 *
 * WARUM ES JETZT OHNE GEHT: Die Seltenheit erledigt genau das, wofuer das
 * Kontingent gedacht war. Drei Zeit-Seiten hintereinander waren deshalb
 * schlecht, weil sie einander aehneln -- und was viele bekommen, ist per
 * Definition nicht selten. 'aktivster-monat' trifft fast jeden (Schwelle:
 * zwei Aktivitaeten in einem Monat) und rangiert entsprechend weit hinten;
 * 'wochentag' trifft wenige und rueckt nach vorn. Die Auswahl regelt sich
 * ueber den Wert, nicht ueber eine Sonderregel.
 *
 * Die Liste selbst bleibt: Der Test, der die Erreichbarkeit jeder Seite
 * nachweist, braucht sie, und sie dokumentiert die Verwandtschaft.
 */
const ZEIT_SEITEN = ['aktivster-monat', 'langer-atem', 'wochentag'];

/**
 * DER ROTE FADEN -- Seiten, die immer erscheinen, wenn sie zutreffen.
 *
 * Simons Vorgabe 07.09.2026: "Auftakt und Abschluss muessen bleiben."
 * FESTE_KACHELN (intro, abschluss, werde-teamer) tragen ihn ohne jede
 * Bedingung -- sie koennen gar keine Null tragen. Hier stehen die, die
 * eine Bedingung haben, aber wenn sie erfuellt ist, nicht dem Deckel zum
 * Opfer fallen duerfen.
 *
 * WELCHE UND WARUM -- geprueft, nicht uebernommen:
 *
 *   'events'   Die Termine sind der Kern der Konfi-Zeit. Ohne sie waere
 *              der Abschluss eine Zusammenfassung von nichts: Die Seite
 *              'abschluss' zeigt genau diese Zahl noch einmal.
 *   'punkte'   Dieselbe Begruendung -- steht ebenfalls auf dem Abschluss.
 *   'badges'   Dieselbe Begruendung -- steht ebenfalls auf dem Abschluss.
 *
 * NICHT MEHR DABEI, mit Begruendung:
 *
 *   'seltenstes'   Es war hier, weil es weit hinten in der Dramaturgie
 *                  stand und deshalb als Erstes vom Deckel gefressen
 *                  wurde. Genau dieses Problem loest die Seltenheits-
 *                  Auswahl: Die Seite bekommt ihren Wert aus dem Prozent-
 *                  satz, den sie selbst nennt, und setzt sich damit von
 *                  allein durch -- je seltener das Abzeichen, desto weiter
 *                  vorn. Ein Schutz obendrauf waere doppelt gemoppelt.
 *   'konfirmation' Dasselbe. Sie ist ohnehin selten (nur Jahrgaenge mit
 *                  echtem Konfirmationstermin) und braucht keinen Schutz.
 *   'stavanger-2026' Dasselbe, und hier am deutlichsten: Die Sonderseite
 *                  ist die seltenste Seite ueberhaupt und steht damit
 *                  automatisch ganz vorn.
 *
 * Der Unterschied ist nicht kosmetisch: Ein Schutz ist eine Ausnahme von
 * der Regel und muss gepflegt werden. Die Seltenheit IST die Regel.
 */
const GESCHUETZTE_KACHELN = ['events', 'punkte', 'badges'];

/**
 * DAS SELTENSTE ABZEICHEN IST AB 20 % GESETZT.
 *
 * SIMONS VORGABE (07.09.2026), woertlich: "der seltenste badge den man hat
 * der ist schon richtig cool wenn es nur 20% andere haben oder weniger. Dann
 * muss der."
 *
 * WIE ES VORHER WAR: Die Seite trat mit ihrem gemessenen Prozentwert gegen
 * alle anderen an. Bei einem wirklich seltenen Abzeichen gewann sie fast
 * immer -- aber eben nur fast: Wer eine Sonderseite (5 %), eine
 * Wochentag-Seite und mehrere seltene Kategorie-Seiten mitbrachte, konnte
 * sie trotzdem verlieren. Genau das schliesst Simons Regel aus.
 *
 * WARUM EIN SCHWELLENWERT UND KEIN DAUERSCHUTZ: Ein Abzeichen, das die
 * Haelfte des Jahrgangs hat, ist keine Besonderheit -- dafuer gibt es die
 * Abzeichen-Seite. Erst die Seltenheit macht die Aussage "das haben nur x %"
 * ueberhaupt interessant. Oberhalb der Schwelle konkurriert die Seite
 * deshalb weiter wie jede andere.
 *
 * 20 EINSCHLIESSLICH: Simon sagt "20% andere haben oder weniger".
 */
const SELTENSTES_GESETZT_AB_PROZENT = 20;

/**
 * Ist das seltenste Abzeichen dieser Person so selten, dass seine Seite
 * gesetzt ist?
 *
 * @param {object} slides die `slides` des Snapshots
 * @returns {boolean}
 */
function seltenstesIstGesetzt(slides) {
  const prozent = slides?.badges?.seltenstes?.prozent;
  // Ohne Abzeichen gibt es keine Seite -- das entscheidet die Bedingung
  // weiter unten. Ohne gemessenen Prozentwert (Alt-Snapshots, zu kleiner
  // Jahrgang) gibt es nichts, worauf sich die Schwelle beziehen koennte:
  // dann konkurriert die Seite wie bisher.
  if (typeof prozent !== 'number' || prozent <= 0) return false;
  return prozent <= SELTENSTES_GESETZT_AB_PROZENT;
}

/**
 * =====================================================================
 * DIE SELTENHEIT -- wie wertvoll ist eine Seite?
 * =====================================================================
 *
 * SIMONS IDEE (07.09.2026), woertlich:
 *
 *   "dann muessen wir ueberlegen, wie man den Dingern eine gewisse
 *    Wertigkeit gibt. Zum Beispiel hat ja nicht jede Kirchengemeinde
 *    Sommerfreizeit. Das ist tendenziell eine extra Kategorie."
 *
 * DIE FRAGE, die jede Seite beantworten muss: Wie viele andere in derselben
 * Gemeinde bekommen diese Seite auch? Je weniger, desto wertvoller.
 *
 * DAS MUSTER GIBT ES SCHON: Das seltenste Abzeichen (routes/wrapped.js,
 * Feld `prozent`) rechnet genau so -- "das haben nur x %" -- und ist die
 * einzige Stelle im Rueckblick, die etwas ueber die Seltenheit einer
 * Leistung sagt. Diese Machart wird hier auf ALLE Seiten ausgedehnt.
 *
 * WOHER DIE ZAHL KOMMT: Das Backend zaehlt in EINER Abfrage aus, wie viele
 * Konfis des Jahrgangs die Voraussetzung je Seite erfuellen, und legt das
 * Ergebnis als `slides.seiten_haeufigkeit` in den Snapshot (Anteil in
 * Prozent, 1 bis 100). Fehlt das Feld -- alte Snapshots, oder ein zu
 * kleiner Jahrgang -- greift die geschaetzte Grundhaeufigkeit unten.
 *
 * WARUM EINE GESCHAETZTE GRUNDHAEUFIGKEIT UEBERHAUPT NOETIG IST: Bei
 * weniger als 5 Konfis im Jahrgang ist ein gemessener Anteil keine
 * Aussage -- bei zweien waere jede Seite entweder "50 %" oder "100 %".
 * Dieselbe Schwelle gilt beim seltensten Abzeichen und aus demselben
 * Grund. Die Schaetzung ist dann die bessere Zahl als eine gemessene, die
 * nichts bedeutet.
 *
 * DIE SCHAETZWERTE sind der Anteil der Konfis, die diese Seite typischer-
 * weise bekommen -- abgeleitet aus den Bedingungen oben, nicht geraten:
 * Was eine niedrige Schwelle hat, trifft viele; was eine hohe hat, wenige.
 */
const GRUND_HAEUFIGKEIT = {
  // Trifft fast jeden: ein einziger Termin/Punkt/Abzeichen reicht.
  events: 95,
  punkte: 95,
  badges: 90,
  // Zwei Aktivitaeten in einem Monat -- fast jeder, der ueberhaupt da war.
  'aktivster-monat': 85,
  // Ein einziger Challenge-Beitrag reicht.
  challenges: 60,
  'challenge-momente': 55,
  // Zwei von drei Medienarten. Audio ist oft gar nicht erlaubt.
  vielseitig: 40,
  // Mindestens 5 Termine UND 60 Tage Spanne.
  'langer-atem': 45,
  // Ein Jahrgang hat einen Konfirmationstermin oder keinen -- innerhalb
  // eines Jahrgangs bekommen ihn darum entweder alle oder niemand. Das ist
  // die eine Seite, deren Seltenheit NICHT zwischen den Konfis eines
  // Jahrgangs variiert; gemessen wuerde sie 100 % ergeben. Der Wert steht
  // hier trotzdem niedriger, weil sie ueber die Gemeinde hinweg selten ist
  // (drei von fuenf Jahrgaengen haben keinen Termin) und weil sie fuer die
  // Person der Zielpunkt der ganzen Konfi-Zeit ist.
  konfirmation: 35,
  // Mindestens 4 Termine an EINEM Wochentag und die Haelfte aller Termine.
  // Deutlich seltener, als das alte Zeit-Kontingent vermuten liess -- es
  // hat die Seite nur nie durchgelassen.
  wochentag: 25,
  // Ein echtes Nachruecken von der Warteliste.
  warteliste: 20,
  // Das seltenste Abzeichen. Der Standardwert gilt nur, wenn das Backend
  // keinen Prozentsatz geliefert hat -- sonst zaehlt der echte (siehe
  // seltenheitFuer).
  seltenstes: 20,
  // Simons Beispiel. Die Kategorie existiert in keiner Gemeinde als
  // Standard; wer sie hat, war bei DER Fahrt dabei.
  'stavanger-2026': 5
};

/**
 * Die Datums-Seiten -- je Fenster ein eigener Wert.
 *
 * EIN GEMEINSAMER WERT WAERE FALSCH, und das laesst sich am Kalender
 * ablesen: Advent hat vier Sonntage und laeuft ueber vier Wochen, Erntedank
 * ist EIN Tag im Jahr. Wer im Advent in der Kirche war, ist damit in bester
 * Gesellschaft; wer ausgerechnet am Erntedanksonntag da war, ist es nicht.
 *
 * GEMESSEN, WARUM DAS NOETIG WAR: Mit einem gemeinsamen Wert (40 %)
 * standen zwei Datums-Seiten gleichauf und nahmen gemeinsam zwei der vier
 * freien Plaetze -- 'vielseitig' (ebenfalls 40 %, aber tatsaechlich
 * seltener) und 'langer-atem' fielen heraus, obwohl sie mehr ueber die
 * Person sagen. Zwei Seiten, die dasselbe erzaehlen ("du warst im
 * Dezember da"), duerfen sich nicht gegenseitig nach oben tragen.
 *
 * Die Werte folgen der Laenge des Fensters und dem, was ueblich ist:
 */
const GRUND_HAEUFIGKEIT_DATUM = {
  // Vier Wochen, vier Sonntage, dazu Adventsandachten -- fast jede Gemeinde
  // hat in dieser Zeit etwas, und fast jede Konfi ist bei etwas davon.
  advent: 70,
  // Drei Tage, aber der Christvesper-Besuch ist fuer viele gesetzt.
  weihnachten: 60,
  // Juli und August -- zwei ganze Monate, allerdings Ferienzeit.
  sommer: 55,
  // 48 Tage, die ganze Passionszeit.
  ostern: 50,
  // Elf Tage, in denen in vielen Gemeinden wenig stattfindet.
  jahreswechsel: 30,
  // EIN Sonntag im Jahr. Die seltenste Datums-Seite, mit Abstand.
  erntedank: 15
};

/**
 * Die Kategorie-Seiten -- ebenfalls je Kategorie.
 *
 * Dieselbe Ueberlegung: "Gottesdienst" hat fast jede Konfi, "Seelsorge"
 * kaum eine. Ein gemeinsamer Wert haette die haeufigste Kategorie so weit
 * nach vorn getragen wie die seltenste.
 */
const GRUND_HAEUFIGKEIT_KATEGORIE_SEITE = {
  gottesdienst: 85,
  gemeinde: 75,
  jugend: 60,
  fest: 55,
  weihnachten: 55,
  freizeit: 45,
  kinder: 40,
  kreativ: 40,
  konzert: 35,
  kasualien: 30,
  oeffentlichkeit: 25,
  senioren: 25,
  seelsorge: 15
};

/** Rueckfall fuer eine Kategorie ohne eigenen Wert. */
const GRUND_HAEUFIGKEIT_KATEGORIE = 50;

/**
 * Dieselbe Rechnung fuer den Teamer-Rueckblick.
 *
 * Der Deckel ist dort SEPARAT (MAX_TEAMER_KACHELN) und die Grundgesamtheit
 * eine andere: Ein Team hat typischerweise 5 bis 15 Leute, ein Jahrgang 10
 * bis 20 Konfis. Die Anteile sind darum eigene Werte und keine Kopie.
 *
 * Abgeleitet aus den Bedingungen (TEAMER_BEDINGUNGEN), nicht geraten.
 */
const GRUND_HAEUFIGKEIT_TEAMER = {
  // Ein einziger begleiteter Termin reicht -- fast jeder im Team.
  'teamer-events': 95,
  'teamer-konfis': 90,
  'teamer-badges': 80,
  // Der erste Termin des Jahres. Wer ueberhaupt einen hatte, hat ihn.
  'teamer-anfang': 85,
  'teamer-erstes-abzeichen': 70,
  // Wer mit anderen zusammen im Einsatz war.
  'teamer-team': 75,
  // Mindestens fuenf Antworten im Chat.
  'teamer-antworten': 50,
  'teamer-zertifikate': 40,
  // "Seit x Jahren dabei" -- nur, wer NICHT im ersten Jahr ist.
  'teamer-jahre': 55,
  // Mindestens fuenf Freigaben. Moderation macht nur ein Teil des Teams.
  'teamer-moderation': 30,
  // Seltener als die Moderation: Freigeben tun viele, eine eigene Challenge
  // stellen deutlich weniger.
  'teamer-challenges': 20,
  // Das erste Jahr -- per Definition wenige zur selben Zeit.
  'teamer-neu-dabei': 25,
  // Wer heute im Team ist UND frueher selbst Konfi in DIESER Gemeinde war.
  'teamer-konfi-zeit': 20,
  // Dieselbe Sonderseite und dieselbe Seltenheit wie im Konfi-Rueckblick.
  'stavanger-2026': 5
};

/**
 * Wie haeufig ist diese Seite -- in Prozent der Konfis, die sie auch
 * bekommen? Kleiner = seltener = wertvoller.
 *
 * @param {string} kachel
 * @param {object} slides
 * @returns {number} 1 bis 100
 */
function haeufigkeitFuer(kachel, slides) {
  const grenzen = (n) => Math.min(100, Math.max(1, n));

  // 1. Das seltenste Abzeichen bringt seine echte Zahl selbst mit -- sie
  //    steht ohnehin auf der Seite ("das haben nur x %"). Sie hier NICHT zu
  //    benutzen hiesse, neben einer gemessenen Zahl eine geschaetzte zu
  //    fuehren.
  if (kachel === 'seltenstes' && (slides.badges?.seltenstes?.prozent || 0) > 0) {
    return grenzen(slides.badges.seltenstes.prozent);
  }

  // 2. Vom Backend gemessen (ab 07.09.2026, nur bei genug Konfis).
  const gemessen = slides.seiten_haeufigkeit;
  if (gemessen && typeof gemessen === 'object' && (gemessen[kachel] || 0) > 0) {
    return grenzen(gemessen[kachel]);
  }

  // 3. Geschaetzte Grundhaeufigkeit.
  if (Object.prototype.hasOwnProperty.call(GRUND_HAEUFIGKEIT, kachel)) {
    return grenzen(GRUND_HAEUFIGKEIT[kachel]);
  }
  if (Object.prototype.hasOwnProperty.call(GRUND_HAEUFIGKEIT_TEAMER, kachel)) {
    return grenzen(GRUND_HAEUFIGKEIT_TEAMER[kachel]);
  }
  if (kachel.startsWith('datum:')) {
    const fenster = kachel.slice('datum:'.length);
    return grenzen(GRUND_HAEUFIGKEIT_DATUM[fenster] ?? 40);
  }
  if (kachel.startsWith('kategorie:')) {
    const name = kachel.slice('kategorie:'.length);
    return grenzen(GRUND_HAEUFIGKEIT_KATEGORIE_SEITE[name] ?? GRUND_HAEUFIGKEIT_KATEGORIE);
  }
  // Die allgemeine Schwerpunkt-Seite bekommt nur, wer ueberwiegend eigene
  // Kategorien nutzt -- das ist eher selten.
  if (kachel === 'kategorie-allgemein') return 35;

  // Unbekannte Seite: mittig einsortieren statt bevorzugen oder benachteiligen.
  return 50;
}

/**
 * Bedingungen der nicht-festen Seiten. `true` = die Seite hat Inhalt.
 * Eine kaputte Bedingung darf nie den ganzen Rueckblick verhindern --
 * deshalb faengt waehleKacheln() Fehler ab.
 */
const BEDINGUNGEN = {
  // Die drei Zahl-Seiten der Erzaehlung. Sie standen bis zum 07.09.2026 in
  // FESTE_KACHELN und hatten deshalb gar keine Bedingung -- siehe die
  // Begruendung dort.
  //
  // Die Schwelle ist bewusst "groesser als null" und nicht hoeher: Ein
  // einziger Termin, ein einziger Punkt, ein einziges Abzeichen IST eine
  // Erinnerung, und die Seiten erzaehlen das auch so ("Einmal
  // hingegangen.", "Der Anfang ist gemacht.", "Das erste ist das
  // schoenste."). Verboten ist nur die Null.
  events: (s) => (s.events?.total_attended || 0) > 0,
  punkte: (s) => (s.punkte?.total || 0) > 0,
  badges: (s) => (s.badges?.total_earned || 0) > 0,
  // Simons Regel woertlich: "Wer nicht viel geschrieben hat, braucht keine
  // Kachel." Eine einzelne Teilnahme ist keine Geschichte -- deshalb erst
  // ab dem ersten echten Beitrag.
  // Nur bei einem echten Nachruecken. NULL in der Spalte heisst UNBEKANNT
  // (Bestandszeilen vor Migration 145) und ergibt hier 0 -- niemand bekommt
  // die Seite auf Verdacht.
  warteliste: (s) => (s.warteliste?.nachgerueckt || 0) > 0,
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
  // Mindestens 5 Termine UND eine Spanne, die etwas aussagt. Bei zwei
  // Terminen im September und im Mai waeren es rechnerisch auch 240 Tage --
  // die Zahl erzaehlte dann das Gegenteil von "du warst durchgehend dabei".
  'langer-atem': (s) => (s.langer_atem?.termine || 0) >= 5 && (s.langer_atem?.tage || 0) >= 60,
  // Nur wenn ein Tag wirklich heraussticht: mindestens 4 Termine an dem Tag
  // und die Haelfte aller Termine. Sonst ist "dein Wochentag" nur der Tag,
  // der zufaellig einmal oefter vorkam.
  wochentag: (s) => (s.wochentag?.anzahl || 0) >= 4 && (s.wochentag?.anteil || 0) >= 50,
  // "2 von 3 Medienarten" statt "alle drei": allowed_media steht per Default
  // auf ["text","photo"], Audio ist oft gar nicht erlaubt -- eine Seite, die
  // alle drei verlangt, traefe fast nie zu.
  vielseitig: (s) => (s.medienarten?.length || 0) >= 2,
  konfirmation: (s) => Boolean(s.zeitraum?.konfirmation),
  // STAVANGER 2026 -- die Sonderseite zur Sommerfreizeit.
  //
  // Sie erscheint NUR, wenn die Person die Kategorie "Sommerfreizeit" im
  // Zeitraum der Fahrt hat. Das Backend setzt dafuer ein einzelnes
  // Wahrheitsfeld in den Snapshot (routes/wrapped.js); hier steht bewusst
  // KEINE Zahl und kein Schwellenwert:
  //
  //   Die "14 Tage" auf der Seite sind ein FESTER TEXT (Simon, 07.09.2026).
  //   Die Fahrt dauerte 14 Tage, ganz gleich wie oft jemand angehakt wurde.
  //   Eine gerechnete Zahl wuerde sagen "3 Tage in Norwegen" -- das waere
  //   eine Aussage ueber die Pflege der Liste, nicht ueber die Fahrt.
  //
  // Solange die Kategorie in keiner Gemeinde existiert (Stand 07.09.2026),
  // ist das Feld ueberall false und die Seite erscheint nirgends.
  'stavanger-2026': (s) => s.stavanger_2026 === true
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
  //
  // Bevorzugt aus dem fertig gezaehlten `datums_fenster`: Das Backend hat
  // damit oben schon entschieden, welcher Termin dem Datum und welcher der
  // Kategorie zufaellt (Simons Regel "jeder Termin zaehlt nur einmal",
  // 07.09.2026). Hier ein zweites Mal zu zaehlen hiesse, dieselbe Frage
  // zweimal zu beantworten -- und die zweite Antwort koennte abweichen.
  //
  // Der Rueckfall auf `termine_daten` bleibt fuer Snapshots, die vor dem
  // 07.09.2026 entstanden sind und das Feld noch nicht tragen. Er zaehlt
  // wie frueher und aendert an ihnen darum nichts.
  const datumsTreffer = new Map();
  const gezaehlt = slides.datums_fenster;
  if (gezaehlt && typeof gezaehlt === 'object') {
    for (const [fenster, n] of Object.entries(gezaehlt)) {
      if ((n || 0) > 0) datumsTreffer.set(fenster, n);
    }
  } else {
    for (const t of (slides.termine_daten || [])) {
      const fenster = datumsFenster(t);
      if (!fenster) continue;
      datumsTreffer.set(fenster, (datumsTreffer.get(fenster) || 0) + 1);
    }
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

  // 1. WER KOMMT UEBERHAUPT IN FRAGE. Unveraendert: Eine Seite muss etwas
  //    zu erzaehlen haben, sonst ist sie draussen -- Simons Grundregel
  //    "Eine Kachel mit einer Null darauf ist keine Erinnerung" steht ueber
  //    der Seltenheit. Eine seltene leere Seite bleibt eine leere Seite.
  const infrage = [];
  for (const key of DRAMATURGIE) {
    if (key === 'kategorie') { infrage.push(...kategorieSeiten); continue; }
    if (FESTE_KACHELN.includes(key)) { infrage.push(key); continue; }
    const bedingung = BEDINGUNGEN[key];
    if (!bedingung) continue;
    let trifft = false;
    try { trifft = bedingung(slides, schnitt) === true; } catch { trifft = false; }
    if (trifft) infrage.push(key);
  }

  const ohneDoppelte = infrage.filter((k, i, arr) => arr.indexOf(k) === i);
  if (ohneDoppelte.length <= MAX_KACHELN) return ohneDoppelte;

  // 2. DER ROTE FADEN IST GESETZT. Er wird nicht gewogen: Auftakt und
  //    Abschluss muessen bleiben (Simon), und die drei Zahl-Seiten stehen
  //    auf dem Abschluss noch einmal -- ohne sie fasste er etwas zusammen,
  //    das nie gezeigt wurde.
  const gesetzt = ohneDoppelte.filter(
    k => FESTE_KACHELN.includes(k) ||
         GESCHUETZTE_KACHELN.includes(k) ||
         // Das seltenste Abzeichen ab 20 % (Simon: "Dann muss der.").
         // Steht hier und nicht in GESCHUETZTE_KACHELN, weil der Schutz an
         // eine BEDINGUNG geknuepft ist -- oberhalb der Schwelle
         // konkurriert die Seite ganz normal.
         (k === 'seltenstes' && seltenstesIstGesetzt(slides))
  );

  // 2b. EIN PLATZ FUER DEN EIGENEN SCHWERPUNKT.
  //
  // GEMESSEN, nachdem die Seltenheit stand: Eine sehr aktive Konfi mit acht
  // Gottesdiensten, drei Kasualien, drei Terminen in der Passionszeit und
  // zwei im Advent bekam davon KEINE EINZIGE Seite -- die vier freien
  // Plaetze gingen an Stavanger (5 %), das seltenste Abzeichen (8 %), die
  // Warteliste (20 %) und den Wochentag (25 %). Alle vier sind seltener als
  // jede Kategorie- oder Datums-Seite, und alle vier haben recht: Sie SIND
  // seltener.
  //
  // Trotzdem waere das Ergebnis falsch. Die Kategorie- und Datums-Seiten
  // stehen in Simons Dramaturgie an Position 3 als "der eigene
  // Schwerpunkt" -- sie erzaehlen, WO jemand war, waehrend die uebrigen
  // erzaehlen, WIE OFT oder WIE BESONDERS. Ein Rueckblick ohne sie sagt
  // nicht mehr, worum es in dem Jahr ging.
  //
  // Deshalb ist EIN Platz fuer sie reserviert -- der seltenste ihrer Art.
  // Nicht zwei: Die Seltenheit soll die Regel bleiben, die Reservierung ist
  // die Ausnahme, und eine Ausnahme bleibt so klein wie moeglich.
  const istSchwerpunkt = (k) =>
    k.startsWith('kategorie:') || k.startsWith('datum:') || k === 'kategorie-allgemein';
  const schwerpunkte = ohneDoppelte.filter(k => istSchwerpunkt(k) && !gesetzt.includes(k));
  if (schwerpunkte.length > 0 && gesetzt.length < MAX_KACHELN) {
    const seltenster = [...schwerpunkte].sort((a, b) => {
      const d = haeufigkeitFuer(a, slides) - haeufigkeitFuer(b, slides);
      return d !== 0 ? d : ohneDoppelte.indexOf(a) - ohneDoppelte.indexOf(b);
    })[0];
    gesetzt.push(seltenster);
  }

  // 2c. HOECHSTENS ZWEI SCHWERPUNKT-SEITEN INSGESAMT.
  //
  // GEMESSEN: Eine Konfi mit einem Weihnachts- und einem Advents-Termin
  // bekam BEIDE Datums-Seiten -- sie liegen naturgemaess dicht beieinander
  // (Dezember) und erzaehlen fast dasselbe. Zusammen nahmen sie zwei der
  // vier freien Plaetze, und 'vielseitig', 'langer-atem', 'challenges' und
  // 'challenge-momente' fielen samt und sonders heraus.
  //
  // Zwei sind genug: eine, die den Schwerpunkt zeigt, und eine zweite, wenn
  // sie sich ueber die Seltenheit durchsetzt. Was darueber hinausgeht,
  // wiederholt sich.
  const MAX_SCHWERPUNKT_SEITEN = 2;
  const imWettbewerb = ohneDoppelte.filter(k => !gesetzt.includes(k));

  // 3. DIE UEBRIGEN PLAETZE GEHEN AN DIE SELTENSTEN.
  //
  //    Das ist der Kern von Simons Entscheidung (07.09.2026): Nicht mehr
  //    die Position in der Dramaturgie entscheidet, wer bleibt, sondern
  //    die Frage "wie viele andere bekommen diese Seite auch".
  //
  //    Warum das die bessere Regel ist, laesst sich an einem Fall zeigen,
  //    der gemessen wurde: 'wochentag' stand ganz hinten bei den
  //    Zeit-Seiten und war deshalb praktisch unerreichbar -- obwohl die
  //    Seite eine der seltensten ueberhaupt ist (mindestens 4 Termine an
  //    einem Tag UND die Haelfte aller Termine). Nach Position verlor sie
  //    immer, nach Seltenheit gewinnt sie fast immer.
  const platz = Math.max(0, MAX_KACHELN - gesetzt.length);
  const nachSeltenheit = [...imWettbewerb].sort((a, b) => {
    const ha = haeufigkeitFuer(a, slides);
    const hb = haeufigkeitFuer(b, slides);
    if (ha !== hb) return ha - hb;             // seltener zuerst
    // Gleich selten: die Reihenfolge der Dramaturgie entscheidet. Damit
    // bleibt das Ergebnis bei gleichen Daten immer dasselbe -- ein
    // Rueckblick wird geteilt und mehrfach geoeffnet.
    return ohneDoppelte.indexOf(a) - ohneDoppelte.indexOf(b);
  });
  const zusaetzlich = [];
  let schwerpunkteDrin = gesetzt.filter(istSchwerpunkt).length;
  for (const k of nachSeltenheit) {
    if (zusaetzlich.length >= platz) break;
    if (istSchwerpunkt(k)) {
      if (schwerpunkteDrin >= MAX_SCHWERPUNKT_SEITEN) continue;
      schwerpunkteDrin += 1;
    }
    zusaetzlich.push(k);
  }
  const behalten = new Set([...gesetzt, ...zusaetzlich]);

  // 4. ANZEIGEREIHENFOLGE BLEIBT DIE DRAMATURGIE. Die Seltenheit
  //    entscheidet, WER mitkommt -- nicht, in welcher Reihenfolge erzaehlt
  //    wird. Ein Rueckblick, der nach Seltenheit sortiert ist, faengt mit
  //    der Sonderseite an und hoert bei den Terminen auf; das ist eine
  //    Rangliste, keine Erzaehlung.
  return ohneDoppelte.filter(k => behalten.has(k));
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

/**
 * Der Deckel des Teamer-Rueckblicks -- SEPARAT vom Konfi-Deckel.
 *
 * BEFUND 07.09.2026: Es gab hier gar keinen. Der Kommentar unten in
 * waehleTeamerKacheln behauptete, "der Teamer-Rueckblick hat hoechstens
 * sieben Seiten, MAX_KACHELN kann hier gar nicht greifen" -- das stimmte,
 * als die Dramaturgie sieben Eintraege hatte. Sie hat inzwischen 15, und
 * gemessen bekommt eine aktive Teamer:in davon 14. Der Kommentar war nicht
 * mitgewachsen, und weil nichts fehlschlug, fiel es nicht auf.
 *
 * ZEHN, WIE BEI DEN KONFIS (Simons Vorgabe: "Teamer-Dramaturgie analog
 * behandeln"). Die Begruendung ist dieselbe: Ein Rueckblick, den man einmal
 * durchwischt, traegt keine 14 Seiten, und ein Deckel, den alle
 * ausschoepfen, macht alle Rueckblicke gleich.
 */
const MAX_TEAMER_KACHELN = 10;

/**
 * Der rote Faden des Teamer-Rueckblicks -- dieselbe Ueberlegung wie bei den
 * Konfis (GESCHUETZTE_KACHELN).
 *
 * 'teamer-abschluss' fasst Termine, Konfis und Abzeichen zusammen. Fielen
 * die drei Seiten heraus, fasste er etwas zusammen, das nie gezeigt wurde.
 */
const GESCHUETZTE_TEAMER_KACHELN = ['teamer-events', 'teamer-konfis', 'teamer-badges'];

/** Die Reihenfolge des Teamer-Rueckblicks. */
const TEAMER_DRAMATURGIE = [
  'teamer-intro',        // 1  Auftakt
  // 2: Der Anfang -- der eine Termin, mit dem das Jahr losging. Steht VOR
  // der Gesamtzahl: erst der Moment, dann die Bilanz.
  'teamer-anfang',       // 2  wie das Jahr begann
  'teamer-events',       // 3  die Termine des Jahres
  // 3b: Dieselbe Sonderseite wie im Konfi-Rueckblick. Simons Vorgabe:
  // "das sehen dann nur die teamer und konfis die dabei waren" -- die
  // Fahrt gehoert beiden Seiten gleichermassen.
  'stavanger-2026',      // 3b die Fahrt nach Norwegen
  'teamer-konfis',       // 4  wen du begleitet hast
  // 4b: Dein Team -- direkt nach den Konfis, weil beide von Menschen
  // erzaehlen: erst wen du begleitet hast, dann mit wem zusammen.
  'teamer-team',         // 4b mit wem zusammen
  'teamer-badges',       // 5  Abzeichen
  // 6: Das erste Abzeichen -- direkt nach der Abzeichen-Seite, weil es
  // dieselbe Sache aus der Naehe zeigt: nicht wie viele, sondern welches
  // zuerst.
  'teamer-erstes-abzeichen', // 6  womit es losging
  'teamer-zertifikate',  // 7  Zertifikate
  // 6: Der Antwortende -- die Zuwendung, die im Team selten jemand sieht.
  // Steht bei den Menschen-Seiten (nach den Konfis), nicht bei den Zahlen.
  // 7b: Die Challenge-Begleiterin -- die Moderationsarbeit, die sonst
  // niemand sieht. Steht bei den Taetigkeits-Seiten, vor dem Chat.
  // 7a: Was du dem Jahrgang aufgegeben hast (09.09.2026). Steht VOR der
  // Moderation: erst die Challenge stellen, dann die Beitraege freigeben --
  // das ist die Reihenfolge, in der es passiert.
  'teamer-challenges',   // 7a was du gestellt hast
  'teamer-moderation',   // 7b was du freigegeben hast
  'teamer-antworten',    // 8  wie oft du geantwortet hast
  'teamer-jahre',        // 9  "seit x Jahren dabei"
  // 7: Die eigene Geschichte -- wer heute im Team ist und frueher selbst
  // Konfi war. Steht bewusst NACH den Jahren im Team: erst wie lange du
  // dabei bist, dann wie es angefangen hat. Und vor dem Abschluss, damit
  // der Rueckblick auf dem persoenlichsten Punkt ausklingt.
  // 9b: Neu dabei -- das Gegenstueck zu "seit x Jahren". Steht direkt
  // daneben, weil beide dieselbe Frage beantworten: wie lange schon.
  'teamer-neu-dabei',    // 9b dein erstes Jahr
  'teamer-konfi-zeit',   // 10 vom Konfi zur Teamer:in
  'teamer-abschluss'     // 11 Uebersicht
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
  'teamer-anfang': (s) => Boolean(s.anfang?.name),
  'teamer-erstes-abzeichen': (s) => Boolean(s.erstes_abzeichen?.name),
  'teamer-antworten': (s) => (s.chat?.antworten || 0) >= 5,
  'teamer-team': (s) => (s.team?.mitstreitende || 0) > 0,
  // Erst ab fuenf Freigaben. Eine einzelne ist keine Geschichte -- dieselbe
  // Schwelle wie bei den Antworten.
  'teamer-moderation': (s) => (s.moderation?.freigegeben || 0) >= 5,
  // SCHON AB DER ERSTEN, anders als bei Freigaben und Antworten: Eine
  // Challenge zu stellen ist keine Wiederholungstat, sondern ein Einfall,
  // den jemand aufgeschrieben und dem Jahrgang gegeben hat (Simon,
  // 09.09.2026: "Wir sind ja auch froh wenn die das machen.").
  'teamer-challenges': (s) => (s.challenges_gestellt?.total || 0) > 0,
  // Nur im ERSTEN Jahr. Und nur, wenn das Startjahr ueberhaupt bekannt ist:
  // "unbekannt" ist nicht "neu" -- wer seit Jahren dabei ist, aber kein
  // Eintrittsdatum hinterlegt hat, darf nicht als Neuling begruesst werden.
  'teamer-neu-dabei': (s) => s.neu_dabei?.erstes_jahr === true,
  // Wer im ersten Jahr ist, bekommt NICHT zusaetzlich "seit x Jahren dabei" --
  // das waere dieselbe Auskunft zweimal, einmal davon mit einer 1.
  'teamer-jahre': (s) => Boolean(s.engagement?.teamer_seit) && s.neu_dabei?.erstes_jahr !== true,
  // Nur wenn die Person wirklich selbst Konfi in DIESER Gemeinde war. Wer
  // von aussen ins Team kam, bekommt die Seite nicht -- eine erfundene
  // Herkunft waere schlimmer als gar keine Seite.
  'teamer-konfi-zeit': (s) => Boolean(s.konfi_zeit),
  // Dieselbe Sonderseite und dieselbe Regel wie im Konfi-Rueckblick.
  'stavanger-2026': (s) => s.stavanger_2026 === true
};

/**
 * Waehlt die Seiten eines Teamer-Rueckblicks in Anzeigereihenfolge.
 *
 * @param {object} slides die `slides` des Teamer-Snapshots
 * @returns {string[]} Seiten-Schluessel in Anzeigereihenfolge
 */
/**
 * Die Seiten des Zuspruchs -- kein Rueckblick, sondern ein Segen.
 *
 * SIMON, 09.09.2026: "Angenommen es gibt einen Teamer fuer den nichts zu
 * berechnen ist in dem Jahr. Dann soll der was bekommen aber keinen
 * Rueckblick und kein wir vermissen dich. Eher ein Segen, ein positiver
 * Zuspruch."
 *
 * Drei Seiten wie ein Rueckblick, aber ohne eine einzige Zahl: ankommen,
 * der Zuspruch, danke. Der Abschluss traegt bewusst NICHT die Uebersicht
 * ('teamer-abschluss') -- die fasste Termine, Konfis und Abzeichen
 * zusammen, also genau die Nullen, um die es hier geht.
 */
const SEGEN_KACHELN = ['teamer-intro', 'teamer-segen', 'teamer-segen-abschluss'];

/**
 * Kam fuer diese Person ueberhaupt etwas zusammen?
 *
 * Geprueft wird gegen dieselben Bedingungen, die auch die Seiten aussuchen
 * (TEAMER_BEDINGUNGEN) -- ohne die vier, die nichts ueber das JAHR sagen:
 *   teamer-jahre / teamer-neu-dabei  hae1ngen am Eintrittsdatum, nicht am Jahr
 *   teamer-konfi-zeit                haengt an der eigenen Konfi-Zeit
 *   stavanger-2026                   ist eine Sonderseite
 * Wer nur eine dieser vier haette, saesse vor einem Rueckblick, der ihm
 * ueber DIESES Jahr nichts erzaehlt.
 *
 * SIMONS SCHWELLE (09.09.2026): nur bei WIRKLICH nichts. Ein einziger
 * begleiteter Termin genuegt fuer den normalen Rueckblick.
 *
 * @param {object} slides die `slides` des Teamer-Snapshots
 * @returns {boolean} true, wenn nichts zusammenkam
 */
const OHNE_AUSSAGE_UEBERS_JAHR = ['teamer-jahre', 'teamer-neu-dabei', 'teamer-konfi-zeit', 'stavanger-2026'];

function teamerJahrIstLeer(slides) {
  // KAPUTTE DATEN SIND NICHT "LEER". Einen Segen zu schicken hiesse zu
  // behaupten, die Person haette nichts getan -- das darf aus einem
  // Datenfehler nie folgen. Erkennbar am fehlenden `zeitraum`: Den traegt
  // jeder echte Snapshot, auch der einer Teamer:in ganz ohne Eintraege.
  if (!slides || typeof slides !== 'object') return false;
  if (!slides.zeitraum) return false;
  for (const [key, bedingung] of Object.entries(TEAMER_BEDINGUNGEN)) {
    if (OHNE_AUSSAGE_UEBERS_JAHR.includes(key)) continue;
    try {
      if (bedingung(slides) === true) return false;
    } catch {
      // Eine kaputte Bedingung darf niemanden faelschlich in den Segen
      // schicken -- im Zweifel gilt das Jahr als nicht leer.
      return false;
    }
  }
  return true;
}

function waehleTeamerKacheln(slides) {
  if (!slides || typeof slides !== 'object') return [...FESTE_TEAMER_KACHELN];

  // Kam nichts zusammen, gibt es keinen Rueckblick, sondern den Zuspruch.
  if (teamerJahrIstLeer(slides)) return [...SEGEN_KACHELN];

  const infrage = [];
  for (const key of TEAMER_DRAMATURGIE) {
    if (FESTE_TEAMER_KACHELN.includes(key)) { infrage.push(key); continue; }
    const bedingung = TEAMER_BEDINGUNGEN[key];
    if (!bedingung) continue;
    let trifft = false;
    // Eine kaputte Bedingung darf nie den ganzen Rueckblick verhindern.
    try { trifft = bedingung(slides) === true; } catch { trifft = false; }
    if (trifft) infrage.push(key);
  }

  const ohneDoppelte = infrage.filter((k, i, arr) => arr.indexOf(k) === i);
  if (ohneDoppelte.length <= MAX_TEAMER_KACHELN) return ohneDoppelte;

  // Dieselbe Auswahl wie bei den Konfis: Der rote Faden ist gesetzt, die
  // uebrigen Plaetze gehen an die seltensten. Die ANZEIGEREIHENFOLGE bleibt
  // die Dramaturgie -- die Seltenheit entscheidet, wer mitkommt, nicht wie
  // erzaehlt wird.
  const gesetzt = ohneDoppelte.filter(
    k => FESTE_TEAMER_KACHELN.includes(k) || GESCHUETZTE_TEAMER_KACHELN.includes(k)
  );
  const imWettbewerb = ohneDoppelte.filter(k => !gesetzt.includes(k));
  const platz = Math.max(0, MAX_TEAMER_KACHELN - gesetzt.length);
  const nachSeltenheit = [...imWettbewerb].sort((a, b) => {
    const d = haeufigkeitFuer(a, slides) - haeufigkeitFuer(b, slides);
    return d !== 0 ? d : ohneDoppelte.indexOf(a) - ohneDoppelte.indexOf(b);
  });
  const behalten = new Set([...gesetzt, ...nachSeltenheit.slice(0, platz)]);
  return ohneDoppelte.filter(k => behalten.has(k));
}

module.exports = {
  waehleKacheln,
  waehleTeamerKacheln,
  teamerJahrIstLeer,
  SEGEN_KACHELN,
  waehleKategorieSeiten,
  FESTE_KACHELN,
  DRAMATURGIE,
  MAX_KACHELN,
  MAX_DATUM_SEITEN,
  MAX_KATEGORIE_SEITEN,
  ZEIT_SEITEN,
  GRUND_HAEUFIGKEIT,
  GRUND_HAEUFIGKEIT_DATUM,
  GRUND_HAEUFIGKEIT_KATEGORIE_SEITE,
  haeufigkeitFuer,
  GESCHUETZTE_KACHELN,
  SELTENSTES_GESETZT_AB_PROZENT,
  seltenstesIstGesetzt,
  BEDINGUNGEN,
  FESTE_TEAMER_KACHELN,
  MAX_TEAMER_KACHELN,
  GESCHUETZTE_TEAMER_KACHELN,
  GRUND_HAEUFIGKEIT_TEAMER,
  TEAMER_DRAMATURGIE,
  TEAMER_BEDINGUNGEN
};
