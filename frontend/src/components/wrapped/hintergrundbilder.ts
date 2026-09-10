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
 * Die Motive. Keine erkennbaren Gesichter: Der Rückblick gehört der Konfi,
 * nicht fremden Models auf einem Stockfoto. Silhouetten, Menschen von
 * hinten und Menschenmengen aus der Ferne sind in Ordnung — ein Model, das
 * in die Kamera lächelt, nicht.
 *
 * NEU AM 09.09.2026: 30 Motive statt der bisherigen 17. Simons Vorgabe war,
 * dass die Bilder "wild sind und Spaß machen ... Watt und Meer und Deich
 * aber auch Stadt und Land und Wald und Wild. Und schön und Party. Aber für
 * 14jährige." Der alte Satz war dafür zu brav — Schafe auf dem Deich,
 * leere Kirchenbänke und dreimal freigestelltes Konfetti als "Party".
 *
 * ALLE MOTIVE SIND HOCHKANT (1080x1920). Die Folien sind hochformatig;
 * von den 17 alten Bildern waren 16 quer, davon wurde die Hälfte
 * weggeschnitten.
 *
 * Die Dateien liegen im Frontend unter /assets/wrapped/ und werden
 * mitgeliefert — kein Netzabruf zur Laufzeit, damit der Rückblick auch
 * offline vollständig ist (die App funktioniert ohne Netz, siehe
 * Offline-Warteschlange).
 *
 * Format WebP, 1080 px breit: 1,6 MB für alle 30 Motive (gemessen
 * 09.09.2026) — als JPEG wären es rund 8 MB. Weil im CSS ohnehin
 * blur(1.5px) über dem Bild liegt, ist es vor dem Packen leicht
 * vorgeglättet; das halbiert die Datei, ohne dass am Bildschirm ein
 * Unterschied zu sehen wäre. Detailschärfe wäre unter der
 * 82-Prozent-Abdunklung ohnehin verschenkt.
 * WebP ist sicher — iOS ab 16.4 (App-Mindestversion), Android ab API 24,
 * und die App verarbeitet WebP im Chat bereits.
 *
 * Herkunft und Fotograf jedes Bildes stehen in docs/bildnachweise.md.
 */
export type Motiv =
  // Weite: Watt, Meer, Deich, Land, Wald — und Stadt bei Nacht.
  | 'watt-abend' | 'priel' | 'nordsee' | 'wald-oben' | 'regenschauer'
  | 'sturmwolken' | 'feld-abend' | 'feld-sturm' | 'duenen' | 'nebel'
  | 'regen' | 'sterne' | 'stadt-nacht' | 'strasse-weit'
  // Feier: laut, hell, in Bewegung.
  | 'lagerfeuer' | 'lagerfeuer-strand' | 'wunderkerze' | 'wunderkerze-blau'
  | 'konfetti-buehne' | 'konzert' | 'haende-hoch' | 'sprung' | 'skatepark'
  | 'graffiti' | 'ballons'
  // Ruhig und kirchlich. HÖCHSTENS ZWEI KIRCHEN (Simon: "Ja Kirche darf
  // eine Dorf und eine Stadtkirche sein. Aber nicht zu viel.") — mehr
  // Kirchenbilder machen aus dem Rückblick einen Gemeindebrief.
  | 'dorfkirche' | 'kirchenschiff' | 'kerze' | 'kerzen' | 'kirchenfenster'
  | 'weg'
  // Sonderseite Sommerfreizeit 2026: der Preikestolen bei Stavanger.
  // Wikimedia Commons, CC0 -- keine Namensnennungspflicht. Bewusst dieses
  // Bild und nicht die Variante mit Touristengruppe: Hier steht eine
  // einzelne Silhouette an der Felskante, kein erkennbares Gesicht. Das
  // ist die Regel im Kopf dieser Datei.
  | 'preikestolen';

const MOTIV_DATEI: Record<Motiv, string> = {
  'watt-abend': '/assets/wrapped/watt-abend.webp',
  priel: '/assets/wrapped/priel.webp',
  nordsee: '/assets/wrapped/nordsee.webp',
  'wald-oben': '/assets/wrapped/wald-oben.webp',
  regenschauer: '/assets/wrapped/regenschauer.webp',
  sturmwolken: '/assets/wrapped/sturmwolken.webp',
  'feld-abend': '/assets/wrapped/feld-abend.webp',
  'feld-sturm': '/assets/wrapped/feld-sturm.webp',
  duenen: '/assets/wrapped/duenen.webp',
  nebel: '/assets/wrapped/nebel.webp',
  regen: '/assets/wrapped/regen.webp',
  sterne: '/assets/wrapped/sterne.webp',
  'stadt-nacht': '/assets/wrapped/stadt-nacht.webp',
  'strasse-weit': '/assets/wrapped/strasse-weit.webp',
  lagerfeuer: '/assets/wrapped/lagerfeuer.webp',
  'lagerfeuer-strand': '/assets/wrapped/lagerfeuer-strand.webp',
  wunderkerze: '/assets/wrapped/wunderkerze.webp',
  'wunderkerze-blau': '/assets/wrapped/wunderkerze-blau.webp',
  'konfetti-buehne': '/assets/wrapped/konfetti-buehne.webp',
  konzert: '/assets/wrapped/konzert.webp',
  'haende-hoch': '/assets/wrapped/haende-hoch.webp',
  sprung: '/assets/wrapped/sprung.webp',
  skatepark: '/assets/wrapped/skatepark.webp',
  graffiti: '/assets/wrapped/graffiti.webp',
  ballons: '/assets/wrapped/ballons.webp',
  dorfkirche: '/assets/wrapped/dorfkirche.webp',
  kirchenschiff: '/assets/wrapped/kirchenschiff.webp',
  kerze: '/assets/wrapped/kerze.webp',
  kerzen: '/assets/wrapped/kerzen.webp',
  kirchenfenster: '/assets/wrapped/kirchenfenster.webp',
  weg: '/assets/wrapped/weg.webp',
  preikestolen: '/assets/wrapped/preikestolen.webp',
};
/**
 * Kachel -> Motiv. Was hier fehlt, bekommt bewusst kein Bild.
 *
 * Die Auswahl folgt dem Inhalt: Die Momente-Seite zeigt ohnehin echte Fotos
 * der Konfis und braucht keinen weiteren Hintergrund; die Intro-Seite
 * eröffnet mit Weite; das Highlight bekommt ein lautes Motiv, damit die
 * Seite trägt, von der der Rückblick erzählt.
 *
 * ACHTUNG: Diese Tabelle und KACHEL_ZWEITMOTIV müssen DIESELBEN Schlüssel
 * abdecken, und je Kachel müssen sich beide Motive unterscheiden — zweimal
 * dasselbe Bild wirkt wie ein Fehler, nicht wie Absicht. Zwei Tests wachen
 * darüber (wrappedSeitenHabenBilder, wrappedHintergrundbilder).
 */
const KACHEL_MOTIV: Partial<Record<string, Motiv>> = {
  intro: 'watt-abend',
  highlight: 'konfetti-buehne',
  events: 'kirchenschiff',
  'lieblings-event': 'nordsee',
  badges: 'wunderkerze',
  stempel: 'konfetti-buehne',
  chat: 'stadt-nacht',
  reaktionen: 'haende-hoch',
  verlaesslich: 'dorfkirche',
  'aktivster-monat': 'feld-abend',
  kategorie: 'kirchenfenster',
  'kategorie-allgemein': 'kirchenfenster',
  // Ballons statt Kerzen (11.09.2026, Simon: "Die Seite mit der Zeit bis zur
  // Konfi ist mit Kerzen zu klassisch. Eher auch Ballons."). Eine
  // Konfirmation ist ein Fest, kein Trauergottesdienst.
  konfirmation: 'ballons',
  zeitraum: 'sterne',
  gottesdienst: 'kerze',
  gemeinde: 'weg',
  'jahrgang-vergleich': 'priel',
  challenges: 'skatepark',
  'kategorie:fest': 'konfetti-buehne',
  'kategorie:senioren': 'kirchenfenster',
  'kategorie:jugend': 'skatepark',
  'kategorie:oeffentlichkeit': 'stadt-nacht',
  'kategorie:freizeit': 'duenen',
  'kategorie:weihnachten': 'kerzen',
  'kategorie:konzert': 'konzert',
  'kategorie:kinder': 'feld-abend',
  'kategorie:kreativ': 'graffiti',
  'kategorie:seelsorge': 'weg',
  'kategorie:kasualien': 'kerze',
  'kategorie:gottesdienst': 'kirchenschiff',
  'kategorie:gemeinde': 'weg',
  'datum:weihnachten': 'kerzen',
  'datum:advent': 'kerze',
  'datum:jahreswechsel': 'wunderkerze',
  'datum:ostern': 'kirchenfenster',
  'datum:erntedank': 'feld-sturm',
  'datum:sommer': 'watt-abend',
  punkte: 'sterne',
  abschluss: 'sturmwolken',
  endspurt: 'strasse-weit',
  'ueber-das-ziel': 'sprung',
  bonus: 'wunderkerze-blau',
  pflicht: 'dorfkirche',
  warteliste: 'nebel',
  'langer-atem': 'weg',
  wochentag: 'regen',
  vielseitig: 'lagerfeuer',
  'challenge-momente': 'wald-oben',
  seltenstes: 'lagerfeuer',
  'werde-teamer': 'lagerfeuer-strand',
  // Der Blick nach vorn waehrend der Konfizeit: ein Weg, der weitergeht.
  'weiter-so': 'strasse-weit',
  'stavanger-2026': 'preikestolen',
  'teamer-intro': 'watt-abend',
  'teamer-events': 'kirchenschiff',
  'teamer-konfis': 'haende-hoch',
  'teamer-badges': 'wunderkerze',
  'teamer-zertifikate': 'kirchenfenster',
  'teamer-challenge-beitraege': 'konfetti-buehne',
  'teamer-challenges': 'skatepark',
  'teamer-team': 'lagerfeuer-strand',
  'teamer-neu-dabei': 'duenen',
  'teamer-anfang': 'weg',
  'teamer-antworten': 'kirchenfenster',
  'teamer-jahre': 'wald-oben',
  'teamer-konfi-zeit': 'nordsee',
  'teamer-abschluss': 'sturmwolken',
  'teamer-segen': 'sterne',
  'teamer-segen-abschluss': 'regenschauer',
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
  intro: 'sterne',
  highlight: 'haende-hoch',
  events: 'dorfkirche',
  'lieblings-event': 'duenen',
  badges: 'konfetti-buehne',
  stempel: 'wunderkerze',
  chat: 'strasse-weit',
  reaktionen: 'konzert',
  verlaesslich: 'feld-abend',
  'aktivster-monat': 'sterne',
  kategorie: 'kirchenschiff',
  'kategorie-allgemein': 'kirchenschiff',
  // Zweitmotiv ebenfalls weg vom Kirchlichen: Kirchenfenster stand hier und
  // machte die Seite zusammen mit den Kerzen doppelt feierlich-kirchlich.
  konfirmation: 'konfetti-buehne',
  zeitraum: 'nebel',
  gottesdienst: 'kirchenschiff',
  gemeinde: 'watt-abend',
  'jahrgang-vergleich': 'regenschauer',
  challenges: 'graffiti',
  'kategorie:fest': 'haende-hoch',
  'kategorie:senioren': 'nebel',
  'kategorie:jugend': 'graffiti',
  'kategorie:oeffentlichkeit': 'strasse-weit',
  'kategorie:freizeit': 'nordsee',
  'kategorie:weihnachten': 'kirchenfenster',
  'kategorie:konzert': 'konfetti-buehne',
  'kategorie:kinder': 'regen',
  'kategorie:kreativ': 'konfetti-buehne',
  'kategorie:seelsorge': 'nebel',
  'kategorie:kasualien': 'kirchenschiff',
  'kategorie:gottesdienst': 'kirchenfenster',
  'kategorie:gemeinde': 'watt-abend',
  'datum:weihnachten': 'kirchenschiff',
  'datum:advent': 'kirchenfenster',
  'datum:jahreswechsel': 'sterne',
  'datum:ostern': 'regenschauer',
  'datum:erntedank': 'wald-oben',
  'datum:sommer': 'duenen',
  punkte: 'feld-abend',
  abschluss: 'watt-abend',
  endspurt: 'sterne',
  'ueber-das-ziel': 'konfetti-buehne',
  bonus: 'wunderkerze',
  pflicht: 'kirchenschiff',
  warteliste: 'kerze',
  'langer-atem': 'sterne',
  wochentag: 'kirchenfenster',
  vielseitig: 'haende-hoch',
  'challenge-momente': 'nebel',
  seltenstes: 'konfetti-buehne',
  'werde-teamer': 'weg',
  'weiter-so': 'duenen',
  'stavanger-2026': 'sturmwolken',
  'teamer-intro': 'sterne',
  'teamer-events': 'dorfkirche',
  'teamer-konfis': 'konfetti-buehne',
  'teamer-badges': 'haende-hoch',
  'teamer-zertifikate': 'kirchenschiff',
  'teamer-challenge-beitraege': 'graffiti',
  'teamer-challenges': 'konzert',
  'teamer-team': 'feld-abend',
  'teamer-neu-dabei': 'watt-abend',
  'teamer-anfang': 'sterne',
  'teamer-antworten': 'stadt-nacht',
  'teamer-jahre': 'nebel',
  'teamer-konfi-zeit': 'priel',
  'teamer-abschluss': 'watt-abend',
  'teamer-segen': 'nebel',
  'teamer-segen-abschluss': 'watt-abend',
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
 * 14 Seiten mit je zwei Motiven -- also bis zu 28 Bildplaetze -- bei damals
 * nur 16 Motiven. Gemessen am 03.09.2026 kam `watt` bei einem einzigen Konfi
 * DREIMAL vor (intro, freizeit, abschluss), fuenf weitere Motive doppelt.
 *
 * Diese Funktion verteilt stattdessen: Jede Seite bekommt ihr Wunschmotiv,
 * wenn es noch frei ist -- sonst das naechste freie aus derselben Stimmung.
 * Erst wenn alle 31 vergeben sind, faengt die Vergabe von vorn an -- seit
 * dem 09.09.2026 kommt das in der Praxis nicht mehr vor: Der laengste
 * Rueckblick hat rund 26 Seiten, es gibt 30 Motive plus den Preikestolen.
 *
 * DIE REIHENFOLGE DER SEITEN ENTSCHEIDET, nicht der Zufall: Derselbe
 * Rueckblick sieht bei jedem Oeffnen gleich aus. Das ist dieselbe
 * Ueberlegung wie bei der Pinnwand -- eine geteilte Erinnerung darf sich
 * nicht bei jedem Ansehen veraendern.
 */

/**
 * Motive nach Stimmung -- fuer den Ersatz, wenn das Wunschmotiv weg ist.
 *
 * WIE GROSS JEDE LISTE SEIN MUSS: Laeuft eine Stimmung leer, greift
 * verteileMotive auf IRGENDEIN freies Motiv zurueck -- dann steht ein
 * Lagerfeuer hinter der Konfirmation. Gemessen am 09.09.2026 braucht ein
 * voller Konfi-Rueckblick hoechstens 14 Motive aus 'weite', 9 aus 'feier'
 * und 3 aus 'ruhig'; ein Teamer-Rueckblick 15 / 2 / 0. Die Listen sind
 * genau darauf ausgelegt (14 / 10 / 6). Simons Regel dahinter: "es gibt
 * aber immer 3 passende oder so pro slide. Also es muss schon passen."
 *
 * PREIKESTOLEN STEHT BEWUSST IN KEINER LISTE. Er ist der Ort, von dem die
 * Stavanger-Seite erzaehlt, und darf nicht als Ersatz an eine fruehere
 * Seite fallen. Vorher stand er in 'weite' -- gemessen: Bei neun Seiten
 * vor ihr bekam 'langer-atem' den Felsen und die Stavanger-Seite ging leer
 * aus. Der Test wrappedStavanger2026 deckt genau diesen Fall ab.
 */
const STIMMUNG: Record<string, Motiv[]> = {
  // ruhig, kirchlich
  ruhig: ['kirchenschiff', 'kirchenfenster', 'kerzen', 'kerze', 'dorfkirche', 'weg'],
  // Weite: Watt, Meer, Land, Wald -- und Stadt bei Nacht.
  weite: ['watt-abend', 'priel', 'nordsee', 'wald-oben', 'regenschauer',
    'sturmwolken', 'feld-abend', 'feld-sturm', 'duenen', 'nebel', 'regen',
    'sterne', 'stadt-nacht', 'strasse-weit'],
  // feiern
  feier: ['lagerfeuer', 'lagerfeuer-strand', 'wunderkerze', 'wunderkerze-blau',
    'konfetti-buehne', 'konzert', 'haende-hoch', 'sprung', 'skatepark', 'graffiti',
    'ballons'],
};

/** Welche Stimmung passt zu einer Seite? */
function stimmungFuer(kachel: string): keyof typeof STIMMUNG {
  // 'konfirmation' steht bewusst bei 'feier' und NICHT bei 'ruhig'
  // (11.09.2026): Als "ruhig" eingestuft bekam die Seite Kerzen und
  // Kirchenfenster zugelost -- genau das "zu klassisch kirchlich", das Simon
  // aufgefallen ist. Eine Konfirmation ist der Festtag, auf den alles
  // zulaeuft.
  if (/badges|seltenstes|challenges|stempel|fest|konzert|kreativ|jugend|ueber-das-ziel|bonus|konfirmation/.test(kachel)) return 'feier';
  if (/gottesdienst|kasualien|advent|weihnachten|ostern|seelsorge|senioren|erntedank|pflicht/.test(kachel)) return 'ruhig';
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
    // Zweitbild. Bei 13 Seiten waren das 26 Bildplaetze auf 16 Motive:
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
