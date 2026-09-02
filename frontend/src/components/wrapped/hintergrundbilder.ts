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
  | 'kirchenschiff'
  | 'fenster'
  | 'weite'
  | 'wald'
  | 'himmel'
  | 'wasser'
  | 'weg';

const MOTIV_DATEI: Record<Motiv, string> = {
  kirchenschiff: '/assets/wrapped/kirchenschiff.webp',
  fenster: '/assets/wrapped/fenster.webp',
  weite: '/assets/wrapped/weite.webp',
  wald: '/assets/wrapped/wald.webp',
  himmel: '/assets/wrapped/himmel.webp',
  wasser: '/assets/wrapped/wasser.webp',
  weg: '/assets/wrapped/weg.webp',
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
  intro: 'weite',
  highlight: 'fenster',
  events: 'kirchenschiff',
  'lieblings-event': 'wasser',
  badges: 'himmel',
  stempel: 'kirchenschiff',
  chat: 'weg',
  reaktionen: 'weg',
  verlaesslich: 'wald',
  'aktivster-monat': 'wald',
  kategorie: 'fenster',
  konfirmation: 'kirchenschiff',
  zeitraum: 'weite',
  gottesdienst: 'kirchenschiff',
  gemeinde: 'weg',
  'jahrgang-vergleich': 'weite',

  // Bewusst OHNE Bild (die Zahl trägt die Seite):
  //   punkte, abschluss, endspurt, ueber-das-ziel, bonus, pflicht,
  //   challenge-momente (zeigt eigene Fotos), challenges
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
  intro: 'kirchenschiff',
  highlight: 'weite',
  events: 'wasser',
  'lieblings-event': 'weite',
  badges: 'fenster',
  stempel: 'wald',
  chat: 'himmel',
  reaktionen: 'himmel',
  verlaesslich: 'weg',
  'aktivster-monat': 'himmel',
  kategorie: 'wald',
  konfirmation: 'weite',
  zeitraum: 'kirchenschiff',
  gottesdienst: 'fenster',
  gemeinde: 'wald',
  'jahrgang-vergleich': 'wasser',
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
