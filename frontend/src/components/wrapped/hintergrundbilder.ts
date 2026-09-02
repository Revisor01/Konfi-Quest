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

  // Bewusst OHNE Bild (die Zahl traegt die Seite):
  //   punkte, abschluss, endspurt, ueber-das-ziel, bonus, pflicht,
  //   challenge-momente (zeigt eigene Fotos)
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
