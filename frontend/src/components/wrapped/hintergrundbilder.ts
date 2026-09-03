// hintergrundbilder.ts — welches Foto hinter welcher Kachel liegt.
//
// Simons Wunsch (02.09.2026): "Es sollten auch Stockbilder im Hintergrund
// sein. Mehr Bilder, mehr Design."
//
// WARUM FESTE ZUORDNUNG STATT ZUFALL: Der Rückblick wird geteilt und
// mehrfach angesehen. Ein Bild, das bei jedem Öffnen wechselt, macht ihn
// beliebig — die Erinnerung soll aber jedes Mal gleich aussehen. Die
// Zuordnung hängt deshalb an der Kachel, nicht am Zufall.
//
// WARUM NICHT ÜBERALL EIN FOTO: Seiten, die von einer großen Zahl leben
// (Punkte, Abschluss), bleiben bewusst ohne Bild. Sonst konkurrieren Motiv
// und Zahl um dieselbe Aufmerksamkeit und beide verlieren.
//
// LESBARKEIT: Über jedem Foto liegt der Farbverlauf der Seite mit 82 %
// Deckkraft (WrappedModal.css). Ohne diese Schicht wäre weißer Text auf
// einem hellen Himmel auf dem Handy in der Sonne unlesbar.

/**
 * Die Motive. Bewusst ruhige, weite Bilder ohne erkennbare Gesichter:
 * Der Rückblick gehört der Konfi, nicht fremden Models auf einem Stockfoto.
 *
 * Die Dateien liegen im Frontend unter /assets/wrapped/ und werden
 * mitgeliefert — kein Netzabruf zur Laufzeit, damit der Rückblick auch
 * offline vollständig ist (die App funktioniert ohne Netz, siehe
 * Offline-Warteschlange).
 *
 * Format WebP, auf 1080 px Breite begrenzt: 640 KB für alle sieben Motive
 * statt 1,8 MB als JPEG (gemessen 02.09.2026). Die Bilder liegen ohnehin
 * unter einer 82-Prozent-Abdunklung, Detailschärfe wäre dort verschenkt.
 * WebP ist sicher — iOS ab 16.4 (App-Mindestversion), Android ab API 24,
 * und die App verarbeitet WebP im Chat bereits.
 */
export type Motiv =
  // ruhig, kirchlich
  | 'kirchenschiff' | 'fenster' | 'kerzen' | 'turm' | 'weg'
  // Landschaft Dithmarschen und Weite
  | 'deich' | 'watt' | 'feld' | 'weite' | 'wald' | 'wasser' | 'himmel'
  // fröhlich und feiernd (Simons Wunsch: "gerne auch ein bisschen
  // verrückte Bilder oder was lustiges")
  | 'konfetti' | 'luftschlangen' | 'feuerwerk' | 'gitarre';

const MOTIV_DATEI: Record<Motiv, string> = {
  kirchenschiff: '/assets/wrapped/kirchenschiff.webp',
  fenster: '/assets/wrapped/fenster.webp',
  kerzen: '/assets/wrapped/kerzen.webp',
  turm: '/assets/wrapped/turm.webp',
  weg: '/assets/wrapped/weg.webp',
  deich: '/assets/wrapped/deich.webp',
  watt: '/assets/wrapped/watt.webp',
  feld: '/assets/wrapped/feld.webp',
  weite: '/assets/wrapped/weite.webp',
  wald: '/assets/wrapped/wald.webp',
  wasser: '/assets/wrapped/wasser.webp',
  himmel: '/assets/wrapped/himmel.webp',
  konfetti: '/assets/wrapped/konfetti.webp',
  luftschlangen: '/assets/wrapped/luftschlangen.webp',
  feuerwerk: '/assets/wrapped/feuerwerk.webp',
  gitarre: '/assets/wrapped/gitarre.webp',
};
/**
 * Kachel -> Motiv. Was hier fehlt, bekommt bewusst kein Bild.
 *
 * Die Auswahl folgt dem Inhalt: Die Momente-Seite zeigt ohnehin echte Fotos
 * der Konfis und braucht keinen weiteren Hintergrund; die Intro-Seite
 * eröffnet mit Weite; das Highlight bekommt ein ruhiges Motiv, damit die
 * Zahl darauf steht und nicht dagegen.
 */
const KACHEL_MOTIV: Partial<Record<string, Motiv>> = {
  intro: 'watt',
  highlight: 'konfetti',
  events: 'kirchenschiff',
  'lieblings-event': 'deich',
  badges: 'feuerwerk',
  stempel: 'luftschlangen',
  chat: 'gitarre',
  reaktionen: 'konfetti',
  verlaesslich: 'turm',
  'aktivster-monat': 'feld',
  kategorie: 'fenster',
  'kategorie-allgemein': 'fenster',
  konfirmation: 'kerzen',
  zeitraum: 'weite',
  gottesdienst: 'kerzen',
  gemeinde: 'weg',
  'jahrgang-vergleich': 'watt',
  challenges: 'luftschlangen',

  // Die 14 Kategorie-Seiten (Simons Standardkategorien, 03.09.2026).
  // Jede bekommt ein Motiv, das zum Anlass passt -- ohne Eintrag hier
  // rendert die Seite nackt, ohne Fehler und ohne dass es jemandem
  // auffaellt. Genau diese Art stiller Luecke soll es nicht mehr geben.
  'kategorie:fest': 'konfetti',
  'kategorie:senioren': 'fenster',
  'kategorie:jugend': 'gitarre',
  'kategorie:oeffentlichkeit': 'turm',
  'kategorie:freizeit': 'deich',
  'kategorie:weihnachten': 'kerzen',
  'kategorie:konzert': 'gitarre',
  'kategorie:kinder': 'feld',
  'kategorie:kreativ': 'luftschlangen',
  'kategorie:seelsorge': 'weg',
  'kategorie:kasualien': 'kerzen',
  'kategorie:gottesdienst': 'kirchenschiff',
  'kategorie:gemeinde': 'weg',

  // Die Datums-Seiten. Sie haengen nicht an der Kategorie, sondern am
  // event_date -- deshalb eigene Motive.
  'datum:weihnachten': 'kerzen',
  'datum:advent': 'kerzen',
  'datum:jahreswechsel': 'feuerwerk',
  'datum:ostern': 'fenster',
  'datum:erntedank': 'feld',
  'datum:sommer': 'watt',

  // JEDE Seite bekommt ein Bild (Simon, 03.09.2026: "pro Wrapped-Seite").
  // Frueher blieben punkte/abschluss bewusst ohne Motiv -- die Begruendung
  // war, dass die grosse Zahl sonst mit dem Bild konkurriert. Seit der
  // Schleier abgestuft ist (unten dicht, oben offen) gilt das nicht mehr:
  // Die Zahl steht im abgedunkelten Bereich, das Motiv darueber.
  punkte: 'weite',
  abschluss: 'himmel',
  endspurt: 'weg',
  'ueber-das-ziel': 'feuerwerk',
  bonus: 'konfetti',
  pflicht: 'turm',
  'challenge-momente': 'wald',
  // Das seltenste Abzeichen -- Feuerwerk, weil es ein Moment ist.
  seltenstes: 'feuerwerk',
  'werde-teamer': 'gitarre',

  // Teamer-Rueckblick (03.09.2026).
  'teamer-intro': 'weite',
  'teamer-events': 'kirchenschiff',
  'teamer-konfis': 'konfetti',
  'teamer-badges': 'feuerwerk',
  'teamer-zertifikate': 'fenster',
  'teamer-jahre': 'weg',
  'teamer-abschluss': 'himmel',
};
/**
 * Das ZWEITE, schwächere Motiv unten links. Simons Entwurf legt zwei
 * Bildformen übereinander -- eine große oben rechts (Deckkraft 0.85), eine
 * ruhigere unten links (0.32). Das gibt der Fläche Tiefe, ohne unruhig zu
 * werden.
 *
 * Bewusst ein ANDERES Motiv als oben: zweimal dasselbe Bild wirkt wie ein
 * Fehler, nicht wie Absicht.
 */
const KACHEL_ZWEITMOTIV: Partial<Record<string, Motiv>> = {
  intro: 'himmel',
  highlight: 'luftschlangen',
  events: 'turm',
  'lieblings-event': 'wasser',
  badges: 'konfetti',
  stempel: 'feuerwerk',
  chat: 'wald',
  reaktionen: 'luftschlangen',
  verlaesslich: 'feld',
  'aktivster-monat': 'himmel',
  kategorie: 'kirchenschiff',
  'kategorie-allgemein': 'kirchenschiff',
  konfirmation: 'fenster',
  zeitraum: 'deich',
  gottesdienst: 'kirchenschiff',
  gemeinde: 'watt',
  'jahrgang-vergleich': 'weite',
  challenges: 'konfetti',

  'kategorie:fest': 'luftschlangen',
  'kategorie:senioren': 'wald',
  'kategorie:jugend': 'wald',
  'kategorie:oeffentlichkeit': 'himmel',
  'kategorie:freizeit': 'watt',
  'kategorie:weihnachten': 'fenster',
  'kategorie:konzert': 'luftschlangen',
  'kategorie:kinder': 'himmel',
  'kategorie:kreativ': 'konfetti',
  'kategorie:seelsorge': 'wald',
  'kategorie:kasualien': 'kirchenschiff',
  'kategorie:gottesdienst': 'fenster',
  'kategorie:gemeinde': 'watt',

  'datum:weihnachten': 'kirchenschiff',
  'datum:advent': 'fenster',
  'datum:jahreswechsel': 'himmel',
  'datum:ostern': 'weite',
  'datum:erntedank': 'wald',
  'datum:sommer': 'deich',

  // Auch hier jede Seite -- das Zweitmotiv gibt der Flaeche Tiefe.
  // Bewusst ein ANDERES Motiv als oben: zweimal dasselbe Bild wirkt wie
  // ein Fehler, nicht wie Absicht.
  punkte: 'feld',
  abschluss: 'watt',
  endspurt: 'himmel',
  'ueber-das-ziel': 'konfetti',
  bonus: 'luftschlangen',
  pflicht: 'kirchenschiff',
  'challenge-momente': 'wasser',
  seltenstes: 'konfetti',
  'werde-teamer': 'weg',

  'teamer-intro': 'himmel',
  'teamer-events': 'turm',
  'teamer-konfis': 'luftschlangen',
  'teamer-badges': 'konfetti',
  'teamer-zertifikate': 'kirchenschiff',
  'teamer-jahre': 'wald',
  'teamer-abschluss': 'watt',
};
/**
 * Liefert den Bildpfad für eine Kachel, oder null wenn sie ohne Foto bleibt.
 */
export function hintergrundFuer(kachel: string): string | null {
  const motiv = KACHEL_MOTIV[kachel];
  return motiv ? MOTIV_DATEI[motiv] : null;
}

/**
 * Das zweite, schwächere Motiv unten links -- oder null.
 */
export function zweitbildFuer(kachel: string): string | null {
  const motiv = KACHEL_ZWEITMOTIV[kachel];
  return motiv ? MOTIV_DATEI[motiv] : null;
}

/**
 * Alle ausgelieferten Motive — für den Vorablauf (Preload), damit beim
 * Durchblättern kein Bild nachlädt und die Seite kurz nackt aussieht.
 */
export function alleMotive(): string[] {
  return Object.values(MOTIV_DATEI);
}

export { KACHEL_MOTIV, KACHEL_ZWEITMOTIV, MOTIV_DATEI };

/**
 * MOTIVE OHNE WIEDERHOLUNG VERGEBEN (Simon, 03.09.2026: "Es duerfen niemals
 * zweimal die gleichen Bilder im bg sein bei einem Konfi").
 *
 * WARUM DIE FESTE ZUORDNUNG DAS NICHT KONNTE: Ein Rueckblick hat bis zu
 * 14 Seiten mit je zwei Motiven -- also bis zu 28 Bildplaetze -- bei nur
 * 16 Motiven. Gemessen am 03.09.2026 kam `watt` bei einem einzigen Konfi
 * DREIMAL vor (intro, freizeit, abschluss), fuenf weitere Motive doppelt.
 *
 * Diese Funktion verteilt stattdessen: Jede Seite bekommt ihr Wunschmotiv,
 * wenn es noch frei ist -- sonst das naechste freie aus derselben Stimmung.
 * Erst wenn alle 16 vergeben sind, faengt die Vergabe von vorn an (bei mehr
 * als 8 Seiten unvermeidlich, dann aber mit groesstmoeglichem Abstand).
 *
 * DIE REIHENFOLGE DER SEITEN ENTSCHEIDET, nicht der Zufall: Derselbe
 * Rueckblick sieht bei jedem Oeffnen gleich aus. Das ist dieselbe
 * Ueberlegung wie bei der Pinnwand -- eine geteilte Erinnerung darf sich
 * nicht bei jedem Ansehen veraendern.
 */

/** Motive nach Stimmung -- fuer den Ersatz, wenn das Wunschmotiv weg ist. */
const STIMMUNG: Record<string, Motiv[]> = {
  // ruhig, kirchlich
  ruhig: ['kirchenschiff', 'fenster', 'kerzen', 'turm', 'weg'],
  // Weite und Landschaft
  weite: ['deich', 'watt', 'feld', 'weite', 'wald', 'wasser', 'himmel'],
  // feiern
  feier: ['konfetti', 'luftschlangen', 'feuerwerk', 'gitarre'],
};

/** Welche Stimmung passt zu einer Seite? */
function stimmungFuer(kachel: string): keyof typeof STIMMUNG {
  if (/badges|seltenstes|challenges|stempel|fest|konzert|kreativ|jugend|ueber-das-ziel|bonus/.test(kachel)) return 'feier';
  if (/gottesdienst|kasualien|konfirmation|advent|weihnachten|ostern|seelsorge|senioren|erntedank|pflicht/.test(kachel)) return 'ruhig';
  return 'weite';
}

/**
 * Vergibt Haupt- und Zweitmotiv fuer eine ganze Seitenfolge, ohne dass sich
 * ein Motiv innerhalb dieses Rueckblicks wiederholt.
 *
 * @param kacheln die Seiten in Anzeigereihenfolge
 * @returns Map von Kachel -> { haupt, zweit } als Dateipfade
 */
export function verteileMotive(kacheln: string[]): Record<string, { haupt: string; zweit: string }> {
  const vergeben = new Set<Motiv>();
  const ergebnis: Record<string, { haupt: string; zweit: string }> = {};
  const alle = Object.keys(MOTIV_DATEI) as Motiv[];

  const nimm = (wunsch: Motiv | undefined, kachel: string): Motiv => {
    if (wunsch && !vergeben.has(wunsch)) { vergeben.add(wunsch); return wunsch; }
    const passend = STIMMUNG[stimmungFuer(kachel)];
    const ausStimmung = passend.find(m => !vergeben.has(m));
    if (ausStimmung) { vergeben.add(ausStimmung); return ausStimmung; }
    const frei = alle.find(m => !vergeben.has(m));
    if (frei) { vergeben.add(frei); return frei; }
    // Alle 16 verbraucht (ab 17 Seiten): von vorn beginnen. Die
    // Wiederholung liegt dann so weit auseinander wie moeglich.
    vergeben.clear();
    const start = wunsch || alle[0];
    vergeben.add(start);
    return start;
  };

  for (const kachel of kacheln) {
    // NUR EIN MOTIV JE SEITE (Simon, 03.09.2026: "Es duerfen niemals
    // zweimal die gleichen Bilder im bg sein bei einem Konfi").
    //
    // Der erste Anlauf vergab zwei Motive je Seite -- Haupt- und
    // Zweitbild. Bei 13 Seiten sind das 26 Bildplaetze auf 16 Motive:
    // Wiederholung ist dann mathematisch unvermeidlich, und der Test hat
    // das sofort gezeigt (10 doppelte Motive).
    //
    // Das Zweitmotiv war ohnehin nur ein schwacher Akzent (28 % Deckkraft,
    // 6 px Weichzeichner) -- es aufzugeben kostet fast nichts und macht
    // Simons Regel ueberhaupt erst erfuellbar. Beide Felder bleiben in der
    // Rueckgabe, damit die Aufrufer unveraendert bleiben; `zweit` ist jetzt
    // schlicht leer.
    const haupt = nimm(KACHEL_MOTIV[kachel], kachel);
    ergebnis[kachel] = { haupt: MOTIV_DATEI[haupt], zweit: '' };
  }
  return ergebnis;
}
