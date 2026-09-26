import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

/**
 * Dunkelmodus (25.09.2026): folgt der Systemeinstellung.
 *
 * Simons Auftrag war doppelt: ein Dunkelmodus UND ein Pruefstein fuer die
 * Farb-Konsolidierung -- "ueber diesen Weg wuerden wir ja auch direkt
 * erfahren, wo wir vielleicht doch noch was Verstreutes haben." Was im
 * Dunkeln weiss leuchtet, ist eine verstreute Farbe. Beim Einbau fanden sich
 * 22 Inline-Styles mit `white` als Hintergrund und 4 Regeln im Stylesheet.
 *
 * Geprueft wird das STYLESHEET (wie in tabLeisteAndroid.test.ts): jsdom
 * wertet keine Media-Queries aus, und der Fehler entsteht erst am Geraet.
 *
 *   (a) Grundlage: Ionic-Palette und Theme-Variante, beide "system".
 *   (b) Jedes Farbtoken hat eine dunkle Entsprechung -- oder steht mit
 *       Begruendung in der Ausnahmeliste unten. Kein drittes.
 *   (c) Die dunklen -rgb-Tripel passen zu ihren Hexwerten.
 *   (d) Text auf Kartengrund ist lesbar (WCAG 4,5:1).
 *   (e) Kein Weiss und kein Schwarz mehr als fester Hintergrund/Text --
 *       weder in Komponenten noch im Stylesheet.
 */

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const ohneKommentare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

function dateienUnter(verzeichnis: string, endung: string): string[] {
  const voll = resolve(process.cwd(), verzeichnis);
  const raus: string[] = [];
  for (const eintrag of readdirSync(voll)) {
    if (eintrag === 'node_modules' || eintrag === '__tests__' || eintrag === '__mocks__') continue;
    const pfad = join(voll, eintrag);
    if (statSync(pfad).isDirectory()) raus.push(...dateienUnter(join(verzeichnis, eintrag), endung));
    else if (eintrag.endsWith(endung)) raus.push(join(verzeichnis, eintrag));
  }
  return raus;
}

const css = ohneKommentare(lies('src/theme/variables.css'));

/** Alle @media-(dark)-Bloecke, jeweils der Text innerhalb der aeusseren Klammern. */
const dunkelBloecke = [...css.matchAll(/@media \(prefers-color-scheme: dark\) \{([\s\S]*?)\n\}\n/g)].map((m) => m[1]);
// Signalfarben (success/warning/danger/info/neutral/ampel) stehen als Text und
// feine Flaeche -- sie werden weiterhin aufgehellt. Bereichsfarben sind grosse
// Flaechen (Kopfbereiche, Dashboard-Verlaeufe) und bleiben seit 26.09.2026
// original, sonst blenden sie auf schwarzem Grund.
const SIGNAL = ['success', 'warning', 'danger', 'info', 'neutral', 'ampel'];
const istBereichsfarbe = (name: string) => {
  if (!name.startsWith('--app-color-')) return false;
  const kern = name.slice('--app-color-'.length);
  return !SIGNAL.some((sig) => kern.startsWith(sig));
};

const hell = css.replace(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}\n/g, '');
// Die Schatten-Skala lebt in theme/abstaende.css, ihre dunklen Werte stehen
// aber im einen Dunkelblock hier (26.09.2026) -- sonst gaelten sie als verwaist.
const hellMitSchatten = hell + '\n' + ohneKommentare(lies('src/theme/abstaende.css'));

/** Token-Definitionen (Name -> erster Wert) aus einem CSS-Ausschnitt. */
function tokens(quelle: string): Map<string, string> {
  const raus = new Map<string, string>();
  for (const m of quelle.matchAll(/^\s*(--app-[a-z0-9-]+):\s*([^;]+);/gm)) {
    if (!raus.has(m[1])) raus.set(m[1], m[2].trim());
  }
  return raus;
}

/** Ein Token ist ein FARB-Token, wenn sein Wert nach Farbe aussieht. */
const istFarbe = (wert: string) =>
  /#[0-9a-fA-F]{3,8}\b/.test(wert) || /rgba?\(/.test(wert) || /gradient\(/.test(wert) || /^\d+,\s*\d+,\s*\d+$/.test(wert);

/**
 * Tokens, die in beiden Modi ABSICHTLICH gleich bleiben. Jede Zeile traegt
 * ihren Grund; ein Token ohne Grund gehoert nicht hierher, sondern in den
 * Dunkelblock.
 */
const GLEICH_IN_BEIDEN_MODI: Record<string, string> = {
  '--app-weiss': 'echtes Weiss: QR-Code, Text und Knoepfe auf Farbflaechen',
  '--app-schwarz': 'echtes Schwarz: Hintergrund hinter Videos',
  '--app-color-gold': 'Metallfarbe der Abzeichen-Stufen',
  '--app-color-gold-hell': 'Metallfarbe der Abzeichen-Stufen',
  '--app-color-silber': 'Metallfarbe der Abzeichen-Stufen',
  '--app-color-silber-hell': 'Metallfarbe der Abzeichen-Stufen',
  '--app-color-bronze': 'Metallfarbe der Abzeichen-Stufen',
  '--app-color-bronze-hell': 'Metallfarbe der Abzeichen-Stufen',
  '--app-color-medaille-bronze': 'Metallfarbe der Abzeichen-Stufen',
  '--app-color-rakete': 'Akzent auf dem Raketen-Verlauf (weisser Text darauf)',
  '--app-color-rakete-hell': 'Akzent auf dem Raketen-Verlauf (weisser Text darauf)',
  '--app-auth-akzent': 'Anmeldeseiten sind schon dunkel gestaltet (Cosmic)',
  '--app-auth-rosa': 'Anmeldeseiten sind schon dunkel gestaltet (Cosmic)',
  '--app-auth-rosa-hell': 'Anmeldeseiten sind schon dunkel gestaltet (Cosmic)',
  '--app-wrapped-gold': 'Wrapped-Folien bringen eigene dunkle Hintergruende mit',
  '--app-wrapped-gold-rgb': 'Wrapped-Folien bringen eigene dunkle Hintergruende mit',
  '--app-wrapped-gold-hell': 'Wrapped-Folien bringen eigene dunkle Hintergruende mit',
  '--app-wrapped-orange': 'Wrapped-Folien bringen eigene dunkle Hintergruende mit',
  '--app-wrapped-rose': 'Wrapped-Folien bringen eigene dunkle Hintergruende mit',
  '--app-aurora-tuerkis-rgb': 'Schatten des Aurora-Verlaufs, der gleich bleibt',
  '--app-surface-dark': 'Video-Platzhalter, ist schon dunkel',
  '--app-gradient-teamer': 'Rollen-Verlauf mit weissem Text, farbTokens.test.ts nagelt den Wert fest',
  '--app-gradient-konfi': 'Rollen-Verlauf mit weissem Text, farbTokens.test.ts nagelt den Wert fest',
  '--app-gradient-admin': 'Rollen-Verlauf mit weissem Text, farbTokens.test.ts nagelt den Wert fest',
  '--app-gradient-neutral': 'Schieferverlauf mit weissem Text',
  '--app-gradient-wrapped': 'farbige Kachel mit weissem Text',
  '--app-gradient-wrapped-hover': 'farbige Kachel mit weissem Text',
  '--app-gradient-badges': 'farbige Kachel mit weissem Text',
  '--app-gradient-success': 'Neu-Punkt, Ring auf Farbflaeche',
  '--app-gradient-auth-fehler': 'Anmeldeseiten sind schon dunkel gestaltet (Cosmic)',
  '--app-gradient-rakete': 'farbige Kachel mit weissem Text',
  '--app-gradient-rakete-quer': 'farbige Kachel mit weissem Text',
  '--app-gradient-aurora': 'Sperr- und Abdeckflaeche, bewusst farbig',
  '--app-gradient-nacht': 'ist schon ein Nachtverlauf',
  '--app-schatten-punkt-erfolg': 'gruener Glow des Status-Punkts, haengt an der Erfolgsfarbe',
  '--app-schatten-glow-challenges': 'farbiger Glow, folgt der Bereichsfarbe ueber ihr -rgb-Token',
};

const helleTokens = tokens(hellMitSchatten);
const helleFarbTokens = [...helleTokens.entries()].filter(([, wert]) => istFarbe(wert)).map(([name]) => name);

describe('Dunkelmodus: Grundlage', () => {
  it('Ionics System-Palette wird in App.tsx geladen, VOR variables.css', () => {
    const app = ohneKommentare(lies('src/App.tsx'));
    const palette = app.indexOf("import '@ionic/react/css/palettes/dark.system.css';");
    const variablen = app.indexOf("import './theme/variables.css';");
    expect(palette).toBeGreaterThan(-1);
    expect(variablen).toBeGreaterThan(palette);
  });

  it('das iOS-Theme laedt dieselbe Variante (-dark-system), nach dem Theme selbst', () => {
    const roh = lies('src/theme/variables.css');
    const theme = roh.indexOf("@import '@rdlabo/ionic-theme-ios27/dist/css/ionic-theme-ios27.css';");
    const dunkel = roh.indexOf("@import '@rdlabo/ionic-theme-ios27/dist/css/ionic-theme-ios27-dark-system.css';");
    expect(dunkel).toBeGreaterThan(theme);
    expect(roh).not.toMatch(/ionic-theme-ios27-dark-(class|always)/);
  });

  it('die dunklen Tokens stehen an EINER Stelle -- ein einziger @media-Block in variables.css', () => {
    expect(dunkelBloecke).toHaveLength(1);
    expect(dunkelBloecke[0]).toMatch(/^\s*:root \{/);
  });
});

describe('Dunkelmodus: jedes Farbtoken hat eine dunkle Entsprechung', () => {
  const dunkleTokens = tokens(dunkelBloecke[0] ?? '');

  it('es gibt genau die erwartete Menge heller Farbtokens (Gegenprobe fuer die Erkennung)', () => {
    // Sinkt die Zahl, erkennt istFarbe() etwas nicht mehr; steigt sie, kam
    // ein Token dazu, das unten eine Entscheidung braucht.
    expect(helleFarbTokens.length).toBeGreaterThanOrEqual(150);
    expect(helleFarbTokens).toContain('--app-color-events');
    expect(helleFarbTokens).toContain('--app-color-events-rgb');
    expect(helleFarbTokens).toContain('--app-gradient-teamer');
    expect(helleFarbTokens).not.toContain('--app-schriftart-ueberschrift');
  });

  it('kein Farbtoken ohne dunkle Entsprechung und ohne Begruendung', () => {
    const fehlend = helleFarbTokens.filter((n) => !dunkleTokens.has(n) && !(n in GLEICH_IN_BEIDEN_MODI));
    expect(fehlend).toEqual([]);
  });

  it('die Ausnahmeliste widerspricht dem Dunkelblock nicht und nennt keine toten Tokens', () => {
    const doppelt = Object.keys(GLEICH_IN_BEIDEN_MODI).filter((n) => dunkleTokens.has(n));
    const tot = Object.keys(GLEICH_IN_BEIDEN_MODI).filter((n) => !helleTokens.has(n));
    expect(doppelt).toEqual([]);
    expect(tot).toEqual([]);
  });

  it('kein dunkles Token ohne helles Gegenstueck (Tippfehler im Namen)', () => {
    const verwaist = [...dunkleTokens.keys()].filter((n) => !helleTokens.has(n));
    expect(verwaist).toEqual([]);
  });

  it('die dunklen Werte unterscheiden sich von den hellen', () => {
    // Eine Kopie des hellen Werts waere kein Dunkelmodus, sondern Ballast.
    //
    // AUSGENOMMEN seit 26.09.2026 die BEREICHSFARBEN: Sie sollen ausdruecklich
    // gleich bleiben (Simon am Geraet: "Die Farben sind furchtbar, koennen
    // original bleiben"). Sie stehen als grosse Flaeche -- ein aufgehellter
    // Wert laesst den Kopfbereich auf schwarzem Grund blenden. Der Test
    // darunter haelt fest, dass sie WIRKLICH gleich sind; hier geht es nur
    // darum, dass jedes andere Token seinen eigenen dunklen Wert hat.
    const gleich = [...dunkleTokens.entries()]
      .filter(([n, w]) => helleTokens.get(n) === w)
      .map(([n]) => n)
      .filter((n) => !istBereichsfarbe(n));
    expect(gleich).toEqual([]);
  });

  it('jedes -rgb-Tripel im Dunkelblock passt exakt zu seinem Hexwert', () => {
    const abweichungen: string[] = [];
    for (const [name, wert] of dunkleTokens) {
      if (!name.endsWith('-rgb')) continue;
      // Eigenstaendige RGB-Tokens ohne Hex-Geschwister (Glasleiste) haben
      // nichts, wogegen man rechnen koennte.
      if (!helleTokens.has(name.slice(0, -4))) continue;
      const hex = dunkleTokens.get(name.slice(0, -4));
      if (!hex) { abweichungen.push(`${name}: Hexwert fehlt im Dunkelblock`); continue; }
      const erwartet = hexZuRgb(hex).join(', ');
      if (wert !== erwartet) abweichungen.push(`${name}: ${wert} != ${erwartet} (${hex})`);
    }
    expect(abweichungen).toEqual([]);
  });

  it('die Bereichs-Bezeichner tragen im Dunkeln denselben Ton wie im Hellen', () => {
    // UMGEDREHT AM 26.09.2026. Bis dahin forderte dieser Test das Gegenteil:
    // "Nicht invertieren, sondern eine Stufe heller" -- gedacht fuer Symbol-
    // und Textfarben auf dunklem Grund. Am Geraet kippte die Rechnung, weil
    // dieselben Tokens die grossen Farbflaechen tragen (SectionHeader und die
    // Dashboard-Verlaeufe lesen sie per var()): Start-, Chat- und Badges-Kopf
    // leuchteten im Dunkeln HELLER als im Hellmodus. Simons Befund: "Die
    // Farben sind furchtbar, koennen original bleiben."
    const abweichend: string[] = [];
    for (const name of ['events', 'activities', 'konfis', 'teamer', 'challenges', 'users', 'badges', 'jahrgang', 'categories', 'chat', 'level']) {
      const h = helleTokens.get(`--app-color-${name}`)!;
      const d = dunkleTokens.get(`--app-color-${name}`)!;
      if (h.trim() !== d.trim()) abweichend.push(`${name}: hell ${h}, dunkel ${d}`);
    }
    expect(abweichend).toEqual([]);
  });

  it('Text auf Kartengrund ist lesbar: mindestens 4,5:1', () => {
    const grund = dunkleTokens.get('--app-surface-card')!;
    const schwach: string[] = [];
    for (const name of ['--app-text-primary', '--app-text-secondary', '--app-text-tertiary', '--app-text-system', '--app-text-emphasis', '--app-text-body', '--app-text-ios', '--app-text-dunkelgrau', '--app-text-mittelgrau', '--app-text-konfis']) {
      const k = kontrast(dunkleTokens.get(name)!, grund);
      if (k < 4.5) schwach.push(`${name}: ${k.toFixed(2)}`);
    }
    expect(schwach).toEqual([]);
    // Und die Statusflaechen mit ihrem Text:
    for (const [flaeche, text] of [['--app-flaeche-fehler', '--app-text-fehler'], ['--app-flaeche-warnung', '--app-text-warnung'], ['--app-flaeche-hinweis', '--app-text-hinweis-dunkel'], ['--app-flaeche-erfolg', '--app-color-success-tief']]) {
      expect(kontrast(dunkleTokens.get(text)!, dunkleTokens.get(flaeche)!)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('Dunkelmodus: kein festes Weiss oder Schwarz mehr als Flaeche', () => {
  // Weisse HINTERGRUENDE und schwarzer TEXT brechen im Dunkeln. Weisser Text
  // auf Farbflaechen ist in beiden Modi richtig und bleibt erlaubt.
  const FLAECHE_TSX = /(?:background|backgroundColor|'--background')\s*:\s*'(?:white|black|#fff|#ffffff|#000|#000000)'/g;
  const TEXT_TSX = /(?:\bcolor|'--color')\s*:\s*'(?:black|#000|#000000)'/g;

  it('keine .tsx-Komponente setzt inline einen weissen/schwarzen Hintergrund oder schwarzen Text', () => {
    const treffer: string[] = [];
    for (const datei of dateienUnter('src', '.tsx')) {
      const code = lies(datei).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const m of code.match(FLAECHE_TSX) ?? []) treffer.push(`${datei}: ${m}`);
      for (const m of code.match(TEXT_TSX) ?? []) treffer.push(`${datei}: ${m}`);
    }
    expect(treffer).toEqual([]);
  });

  // Schwarz mit Deckkraft ist auch Schwarz. `rgba(0,0,0,0.75)` als Textfarbe
  // war der Reaktionszaehler an fremden Chat-Nachrichten -- gedacht fuer die
  // weisse Blase; auf der dunklen (#242426) 1,25:1 (Dunkelmodus-Audit BF-07,
  // 26.09.2026). Die Pruefung darueber sucht nur die Literale black/#000 und
  // fand es nicht. Bestand, der noch umzustellen ist, steht hier mit Zahl und
  // Grund; die Liste darf nur schrumpfen (Nebenbefund des Audits: Hinweistexte
  // der Anmeldeseiten, im Dunkeln ebenso Schwarz auf der dunklen Karte).
  const SCHWARZ_MIT_DECKKRAFT_BESTAND: Record<string, number> = {
    'src/components/auth/ResetPasswordPage.tsx': 2, // "Passwort geaendert" / "Ungueltiger Link"
    'src/components/auth/ForgotPasswordPage.tsx': 1, // "E-Mail gesendet"
    'src/components/auth/KonfiRegisterPage.tsx': 1, // "Schon einen Account?" im zweiten Schritt
  };

  it('kein .tsx setzt inline Schwarz mit Deckkraft als Textfarbe -- ausser dem gezaehlten Bestand', () => {
    // Auch hinter einem Bedingungsoperator: `color: eigene ? '…' : 'rgba(0,0,0,…)'`.
    const TEXT_SCHWARZ_ALPHA = /(?:\bcolor|'--color')\s*:[^\n]*'rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/g;
    const gezaehlt: Record<string, number> = {};
    for (const datei of dateienUnter('src', '.tsx')) {
      const code = lies(datei).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      const n = (code.match(TEXT_SCHWARZ_ALPHA) ?? []).length;
      if (n) gezaehlt[datei] = n;
    }
    expect(gezaehlt).toEqual(SCHWARZ_MIT_DECKKRAFT_BESTAND);
  });

  // Ein IonButton, der nur --background setzt, erbt Ionics Kontrastfarbe der
  // Primaerfarbe -- hell Weiss, in der Dunkelpalette #000. "Zur Teamer:in
  // befoerdern" tat das mit Konfi-Lila: schwarze Schrift auf #5b21b6, 2,34:1
  // (Dunkelmodus-Audit BF-08, 26.09.2026); gleiches Muster am Knopf
  // "Hinzufuegen" der Organisationsverwaltung. Erlaubt ist es nur, wo der
  // Hintergrund Ionics Primaerfarbe SELBST ist -- dazu passt die geerbte
  // Kontrastfarbe in beiden Paletten. Jede Ausnahme mit Grund; die Liste
  // darf nur schrumpfen.
  const HINTERGRUND_OHNE_COLOR_ERLAUBT: Record<string, number> = {
    'src/components/admin/modals/MaterialFormModal.tsx': 1, // "Datei auswaehlen": --background ist var(--ion-color-primary), Ionics eigenes Paar
  };

  it('kein IonButton setzt inline --background ohne --color -- ausser auf Ionics eigener Primaerfarbe', () => {
    const gezaehlt: Record<string, number> = {};
    const fremd: string[] = [];
    for (const datei of dateienUnter('src', '.tsx')) {
      for (const tag of jsxOeffnendeTags(lies(datei), 'IonButton')) {
        if (!/'--background'\s*:/.test(tag) || /'--color'\s*:/.test(tag)) continue;
        gezaehlt[datei] = (gezaehlt[datei] ?? 0) + 1;
        if (!/'--background'\s*:\s*'var\(--ion-color-primary\)'/.test(tag)) fremd.push(`${datei}: ${tag.replace(/\s+/g, ' ').slice(0, 100)}`);
      }
    }
    // Kein Knopf mit eigener Flaechenfarbe ohne eigene Schriftfarbe ...
    expect(fremd).toEqual([]);
    // ... und der Bestand auf Ionics Primaerfarbe ist genau der bekannte.
    expect(gezaehlt).toEqual(HINTERGRUND_OHNE_COLOR_ERLAUBT);
  });

  it('keine Regel im Theme-Stylesheet setzt white/black als Hintergrund oder schwarzen Text', () => {
    const treffer: string[] = [];
    for (const datei of ['src/theme/variables.css', 'src/theme/typografie.css', 'src/theme/abstaende.css']) {
      ohneKommentare(lies(datei)).split('\n').forEach((zeile, i) => {
        const t = zeile.trim();
        if (t.startsWith('--app-') || t.startsWith('--ion-')) return; // Token-Definition
        if (/^(?:--)?background(?:-color)?\s*:\s*(?:white|black|#fff\b|#ffffff|#000\b|#000000)\b/.test(t)) treffer.push(`${datei}:${i + 1} ${t}`);
        if (/^(?:--)?color\s*:\s*(?:black|#000\b|#000000)\b/.test(t)) treffer.push(`${datei}:${i + 1} ${t}`);
      });
    }
    expect(treffer).toEqual([]);
  });

  it('das Kartengrund-Token ist hell weiss und dunkel nicht', () => {
    expect(helleTokens.get('--app-surface-card')).toBe('#ffffff');
    expect(relativeHelligkeit(tokens(dunkelBloecke[0] ?? '').get('--app-surface-card')!)).toBeLessThan(0.05);
  });

  // SIMONS BEFUND AM GERAET (26.09.2026): "Darkmode ist nur halb gut. Koennte
  // du die Listenelemente im Darkmode etwas absetzen. Also grau statt black.
  // Oder andersrum die Hintergruende grau, der Rest black."
  //
  // GEMESSEN, nicht geschaetzt. Der Seitengrund kommt aus Ionics
  // dark.system.css und ist plattformabhaengig: `:root.ios` #000000,
  // `:root.md` #121212. Das iOS-Theme ruehrt ihn nicht an (nachgesehen: es
  // setzt --ion-background-color nur fuer Datumswaehler-Modale).
  //
  // Gemessen wird in dL* (CIE-Helligkeit), NICHT im WCAG-Verhaeltnis: Das
  // Verhaeltnis staucht dicht ueber Schwarz und liest jeden Grauabstand als
  // "1,2:1", auch einen gut sichtbaren. Zum Vergleich der Hellmodus, wo
  // niemand etwas vermisst: #f4f5f8 -> #ffffff sind dL* 3,46.
  //
  //   Karte #1c1c1e ALT:  iOS dL* 10,34   Android dL* 4,88
  //   Karte #242426 NEU:  iOS dL* 14,27   Android dL*  8,81
  //
  // Auf Android war der Schritt nicht einmal halb so gross wie auf iOS --
  // dort war der Befund am schaerfsten.
  const GRUND_IOS = '#000000';      // Ionic dark.system.css, :root.ios
  const GRUND_ANDROID = '#121212';  // Ionic dark.system.css, :root.md

  it('der Seitengrund steht wirklich, wo wir ihn vermuten -- Ionic, nicht wir', () => {
    // Die ganze Rechnung unten haengt daran. Aendert Ionic die Palette oder
    // setzt das Theme doch einen eigenen Grund, muss sie neu gemacht werden.
    const palette = lies('node_modules/@ionic/core/css/palettes/dark.system.css');
    expect(palette).toMatch(/:root\.ios\{--ion-background-color:\s*#000000/);
    expect(palette).toMatch(/:root\.md\{--ion-background-color:\s*#121212/);
    // Und wir selbst ueberschreiben ihn nicht (nur als Rueckfall lesen ist ok).
    const eigene = ohneKommentare(lies('src/theme/variables.css'))
      .split('\n')
      .filter((z) => /^\s*--ion-background-color\s*:/.test(z));
    expect(eigene).toEqual([]);
  });

  it('die Karte setzt sich auf BEIDEN Plattformen ab: dL* mindestens 8', () => {
    const karte = tokens(dunkelBloecke[0] ?? '').get('--app-surface-card')!;
    const iosSchritt = dLStern(GRUND_IOS, karte);
    const androidSchritt = dLStern(GRUND_ANDROID, karte);
    // Der alte Wert #1c1c1e kam auf Android nur auf 4,88 -- genau Simons
    // Befund. 8 ist die Untergrenze, die #242426 auf beiden Seiten haelt.
    expect(iosSchritt).toBeGreaterThanOrEqual(8);
    expect(androidSchritt).toBeGreaterThanOrEqual(8);
    // Und der Schritt ist grosszuegiger als im Hellmodus, wo der Schatten
    // mittraegt (dort dL* 3,46).
    expect(androidSchritt).toBeGreaterThan(dLStern('#f4f5f8', '#ffffff'));
  });

  it('die Stufenleiter steigt: Grund < Karte < gedaempfte Flaeche < Ladeflaeche', () => {
    const d = tokens(dunkelBloecke[0] ?? '');
    const leiter = [
      ['Grund (Android)', GRUND_ANDROID],
      ['Karte', d.get('--app-surface-card')!],
      ['gedaempft', d.get('--app-surface-muted')!],
      ['Ladeflaeche', d.get('--app-surface-dim')!],
    ] as const;
    // Jede Stufe echt heller als die darunter -- keine Gleichstaende. Genau
    // das waere passiert, haette man die Karte auf #2c2c2e gehoben: Sie waere
    // mit --app-surface-muted zusammengefallen und der Platzhalter haette
    // seine eigene Stufe verloren.
    const flach: string[] = [];
    for (let i = 0; i < leiter.length - 1; i++) {
      const schritt = dLStern(leiter[i][1], leiter[i + 1][1]);
      if (schritt < 3) flach.push(`${leiter[i][0]} -> ${leiter[i + 1][0]}: dL* ${schritt.toFixed(2)}`);
    }
    expect(flach).toEqual([]);
    // Und der Rand hebt sich von der Karte ab, sonst ist die Kante weg.
    expect(dLStern(d.get('--app-surface-card')!, d.get('--app-border-soft')!)).toBeGreaterThanOrEqual(3);
  });

  it('die gedaempfte Flaeche setzt sich von der Karte ab, auf der sie liegt', () => {
    // --app-flaeche-gedaempft ist die fixierte Kopfzeile der
    // Anwesenheitsmatrix. Sie liegt AUF einer Karte, nicht auf dem
    // Seitengrund. Hell setzt sie sich mit #fafafa knapp nach unten von Weiss
    // ab; im Dunkeln geht "knapp daneben" nur nach oben, sonst landet man beim
    // Seitengrund. Vorher trug sie denselben Wert wie die Karte (#1c1c1e),
    // war also gar kein Absatz -- und nach dem Anheben der Karte sogar ein
    // Schritt nach unten.
    const d = tokens(dunkelBloecke[0] ?? '');
    const schritt = dLStern(d.get('--app-surface-card')!, d.get('--app-flaeche-gedaempft')!);
    expect(schritt).toBeGreaterThanOrEqual(3);
    // Ihr Text bleibt lesbar (dieselbe 4,5:1-Schwelle wie auf der Karte).
    for (const name of ['--app-text-primary', '--app-text-mittelgrau']) {
      expect(kontrast(d.get(name)!, d.get('--app-flaeche-gedaempft')!)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('die Karte hat im Dunkeln Tiefe, im Hellen nicht -- ueber EIN Token, kein Rohwert', () => {
    // Farbe allein traegt den Unterschied nicht; im Hellmodus macht es der
    // Schatten (dL* 3,46 waere sonst nichts). Die Kartenregel darf deshalb
    // kein festes `box-shadow: none` mehr fuehren.
    const { rumpf } = kartenRegel();
    expect(rumpf).toMatch(/box-shadow:\s*var\(--app-schatten-karte-flaeche\)/);
    expect(rumpf).not.toMatch(/box-shadow:\s*none/);
    // Hell ausdruecklich nichts, dunkel der Kartenschatten aus der Skala.
    expect(helleTokens.get('--app-schatten-karte-flaeche')).toBe('none');
    expect(tokens(dunkelBloecke[0] ?? '').get('--app-schatten-karte-flaeche'))
      .toBe('var(--app-schatten-karte)');
    // Kein Rohwert: die Tiefe kommt aus der konsolidierten Skala.
    expect(tokens(dunkelBloecke[0] ?? '').get('--app-schatten-karte-flaeche'))
      .not.toMatch(/rgba?\(/);
  });

  // BEFUND AM GERAET (Simon, 26.09.2026): "Dark Mode Login Seite und
  // vermutlich auch User erstellen Passwort etc. sind noch hell!"
  //
  // Die Pruefung darueber fand es nicht: Sie sucht die LITERALE white/#fff.
  // `.app-auth-card` schrieb aber `background: var(--app-weiss)` — ein Token,
  // das bewusst KEINE dunkle Entsprechung hat (echtes Weiss fuer QR-Codes und
  // Text auf Farbflaechen). Als Flaechenhintergrund ist es damit ein fest
  // eingebautes Weiss, das der Dunkelmodus nie erreicht. Dasselbe gilt fuer
  // --app-surface-dark als Textfarbe: dunkel auf dunkel.
  //
  // Die Anmeldeseiten stehen ausserhalb der App-Struktur (eigene Seiten vor
  // dem Login), deshalb fielen sie beim Einbau durch.
  const NUR_AUF_FARBFLAECHE = ['--app-weiss'];

  // Weisse Elemente AUF einer Farbflaeche sind richtig so -- sie liegen auf
  // dem lila Anmelde-Verlauf beziehungsweise dem Sperrbildschirm, die in
  // beiden Modi farbig bleiben. Nur Flaechen, die den Seitenhintergrund
  // bilden, muessen dem Dunkelmodus folgen.
  const WEISS_AUF_FARBFLAECHE = [
    '.app-auth-hero__divider-icon',  // Raute auf dem Anmelde-Verlauf
    '.app-sperrbildschirm__knopf',   // weisser Knopf auf dem Verlauf
  ];

  it('kein Weiss-Token dient als Flaechenhintergrund im Stylesheet', () => {
    const treffer: string[] = [];
    for (const datei of ['src/theme/variables.css', 'src/theme/typografie.css', 'src/theme/abstaende.css']) {
      const zeilen = ohneKommentare(lies(datei)).split('\n');
      let selektor = '';
      zeilen.forEach((zeile, i) => {
        const t = zeile.trim();
        const auf = t.match(/^([.#a-zA-Z:[][^{]*)\{/);
        if (auf) selektor = auf[1].trim();
        if (t.startsWith('--app-weiss:')) return; // die Definition selbst
        if (WEISS_AUF_FARBFLAECHE.some((s) => selektor.includes(s))) return;
        for (const token of NUR_AUF_FARBFLAECHE) {
          if (!/^(?:--)?background(?:-color)?\s*:/.test(t) || !t.includes(`var(${token})`)) continue;
          // Als RUECKFALL ist es in Ordnung: `var(--ion-background-color,
          // var(--app-weiss))` nimmt Ionics Wert, sobald er da ist, und faellt
          // nur vor dem Laden auf Weiss zurueck (.app-laedt, Startbildschirm).
          // Getroffen wird nur, wo --app-weiss die erste Wahl ist.
          if (new RegExp(`var\\([^,)]+,\\s*var\\(${token}\\)`).test(t)) continue;
          treffer.push(`${datei}:${i + 1} ${selektor} -> ${t}`);
        }
      });
    }
    expect(treffer).toEqual([]);
  });

  // SIMONS BEFUND (26.09.2026): "Kann es sein das wir hier grau ueber das
  // weiss des popover legen aber nicht ueber den Pfeil. Der ist auf meinem
  // Handy weiss."
  //
  // Ionic faerbt die Pfeilspitze in .popover-arrow::after mit
  // `background: var(--background)` (popover.ios.css:284-294). Wer die Blase
  // ueber ::part(content) einfaerbt, statt --background zu setzen, laesst die
  // Spitze zurueck -- sie ist per clip-path gestanzt und faellt als helle Ecke
  // auf. Der Test haelt fest: Wer ::part(content) faerbt, faerbt den Pfeil mit.
  it('wer die Popover-Blase faerbt, faerbt die Pfeilspitze mit', () => {
    const blase = [...css.matchAll(/([^\n{}]*::part\(content\)[^{]*)\{([^}]*)\}/g)]
      .filter(([, , regeln]) => /(?:^|[\s;])background\s*:/.test(regeln));

    // Eine Regel darf mehrere Selektoren tragen ("a::part(content), b::part(
    // arrow)::after"). Jeden EINZELN pruefen: sonst schneidet der Basis-Name
    // aus der letzten Zeile den Rest der Liste ab, und eine Pfeil-Regel, die
    // eine Zeile darueber steht, bliebe unsichtbar.
    for (const [, selektorliste] of blase) {
      for (const selektor of selektorliste.split(',')) {
        if (!selektor.includes('::part(content)')) continue;
        const basis = selektor.trim().replace(/::part\(content\).*$/, '');
        const roh = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
        // Der Traeger ist die Klasse (bzw. das Element), nicht der ganze
        // Selektor: `:not(...)`-Zusaetze duerfen zwischen der Blasen- und der
        // Pfeil-Regel abweichen -- im Callout-Modus ist die Blase gerade DURCH
        // ein :not() ausgenommen, waehrend der Pfeil ohne Zusatz steht.
        const traeger = basis.match(/(?:^|\s)((?:[a-zA-Z-]+)?\.[\w-]+|[a-zA-Z-]+)(?=[:.\s]|$)/);
        const kern = traeger ? traeger[1] : basis;
        // Der Pfeil kann ueber ::part(arrow) ODER ueber die Callout-Flaeche
        // kommen -- im Callout-Modus ist er Teil desselben SVG-Pfades.
        const faerbtPfeil = new RegExp(
          `${roh(kern)}[^,{}]*::part\\((?:arrow|callout-glass)\\)`
        ).test(css);
        const setztBackground = new RegExp(
          `${roh(kern)}[^,{}]*\\s*\\{[^}]*--background\\s*:`
        ).test(css);
        expect(
          faerbtPfeil || setztBackground,
          `"${selektor.trim()}" faerbt die Blase, aber weder den Pfeil noch --background`
        ).toBe(true);
      }
    }
  });

  // SIMONS BEFUND AM GERAET (26.09.2026): "Die Farben sind furchtbar, koennen
  // original bleiben." Die Bereichsfarben waren im Dunkelblock um eine Stufe
  // aufgehellt -- gedacht als Kontrastausgleich. Weil SectionHeader und die
  // Dashboard-Verlaeufe sie per var() live lesen, leuchteten Start-, Chat- und
  // Badges-Kopf im Dunkeln HELLER als im Hellmodus.
  //
  // Signalfarben sind ausgenommen: success/warning/danger/info/neutral/ampel
  // stehen als Text und feine Flaeche, nicht als grosser Farbblock.
  it('die Bereichsfarben bleiben im Dunkeln unveraendert', () => {
    const dunkel = tokens(dunkelBloecke[0] ?? '');
    const abweichend: string[] = [];
    for (const [name, wert] of dunkel) {
      if (!istBereichsfarbe(name)) continue;
      const hellWert = helleTokens.get(name);
      if (hellWert && hellWert.trim() !== wert.trim()) {
        abweichend.push(`${name}: hell ${hellWert}, dunkel ${wert}`);
      }
    }
    expect(abweichend).toEqual([]);
  });

  // SIMONS BEFUND AM GERAET (26.09.2026): "Die haben in meiner App graue
  // Hintergruende, der Pfeil unten ist aber weiss. Die koennen einfach
  // standard weisse Popover sein."
  //
  // GEMESSEN im Browser mit echtem Theme und echter popoverEnterAnimation
  // (ios27 1.1.0, Ionic 9, iOS-Modus):
  //
  //   vorher hell:   ::part(callout-glass) = rgba(255,255,255,0.42)
  //                                          + brightness(1.35)
  //   vorher dunkel: ::part(callout-glass) = rgba(62,62,62,0.08)
  //                                          + brightness(0.9)
  //   nachher:       rgb(255,255,255) bzw. rgb(28,28,30), backdrop-filter none
  //
  // Die Animation setzt `ios-theme-callout` selbst. In diesem Modus ist
  // ::part(content) transparent und ::part(arrow)::after display:none -- die
  // sichtbare Flaeche ist ::part(callout-glass), ein SVG-Pfad aus Blase UND
  // Spitze. Wer nur --background oder ::part(arrow) faerbt, aendert nichts;
  // genau das war der wirkungslose Versuch vom 26.09.
  it('die Abzeichen-Sprechblase faerbt die Callout-Flaeche deckend', () => {
    // Die Regel muss ::part(callout-glass) treffen -- sonst greift sie im
    // Callout-Modus ueberhaupt nicht.
    const glas = css.match(
      /ion-popover\.badge-detail-popover[^{]*::part\(callout-glass\)[^{]*\{([\s\S]*?)\}/
    );
    expect(glas, '::part(callout-glass) wird nicht gefaerbt').toBeTruthy();
    expect(glas![1]).toMatch(/background:\s*var\(--app-surface-card\)/);
    // Ohne diesen Ausschalter bleibt brightness(1.35) bzw. 0.9 stehen -- der
    // Filter war es, der Blase und Spitze verschieden aussehen liess.
    expect(glas![1]).toMatch(/backdrop-filter:\s*none/);
    expect(glas![1]).toMatch(/-webkit-backdrop-filter:\s*none/);
  });

  it('die Sprechblase traegt die Spezifitaet des Themes', () => {
    // `ion-popover.ios:not(.ios-theme-disabled,.ios26-disabled)` ist Element
    // plus zwei Negationen und schlaegt eine blosse Klasse. Eine Regel, die
    // nur `.badge-detail-popover` heisst, verliert gegen den Dunkelblock des
    // Themes -- gemessen am 26.09.: --background fiel dort auf 0.08 zurueck.
    const zeilen = css
      .split('\n')
      .filter((z) => z.includes('badge-detail-popover') && z.includes('::part('));
    expect(zeilen.length, 'keine ::part-Regel fuer die Sprechblase').toBeGreaterThan(0);
    for (const zeile of zeilen) {
      expect(
        zeile.trimStart().startsWith('ion-popover.'),
        `"${zeile.trim()}" beginnt nicht mit ion-popover und verliert gegen das Theme`
      ).toBe(true);
    }
  });

  it('der Rueckfall ohne Callout sieht genauso aus', () => {
    // Ohne Anker oder mit abgeschalteter Animation entsteht kein Callout;
    // dann traegt wieder ::part(content) plus Pfeilspitze die Farbe. Beide
    // Wege muessen gleich aussehen.
    expect(css).toMatch(
      /ion-popover\.badge-detail-popover:not\(\.ios-theme-callout\)::part\(content\)/
    );
    expect(css).toMatch(/ion-popover\.badge-detail-popover::part\(arrow\)::after/);
  });

  it('die Anmelde-Karte folgt dem Dunkelmodus', () => {
    // Sie ist von `ion-card.app-card` ausgenommen (eigene Breite und
    // Zentrierung) und braucht die Oberflaechen-Tokens deshalb selbst.
    const regel = css.match(/\.app-auth-card \{([\s\S]*?)\}/);
    expect(regel, '.app-auth-card nicht gefunden').toBeTruthy();
    expect(regel![1]).toMatch(/--background:\s*var\(--app-surface-card\)/);
    expect(regel![1]).not.toMatch(/var\(--app-weiss\)/);
    // Textfarbe: --app-surface-dark ist der Video-Platzhalter (#1e1e1e) und
    // bleibt im Dunkeln dunkel -- unlesbar auf dunklem Grund.
    expect(regel![1]).not.toMatch(/--color:\s*var\(--app-surface-dark\)/);
  });
});

describe('Dunkelmodus: Bereichsfarbe als Text (Anmeldeseiten)', () => {
  // GEMESSEN am 26.09.2026 (Dunkelmodus-Audit BF-01, messen.cjs, iOS und
  // Android identisch): "Anmelden" in Konfi-Lila #5b21b6 auf der dunklen
  // Karte #242426 = 1,72:1; "Passwort vergessen?" (0,7 Deckkraft) = 1,40:1;
  // "Noch keinen Account?", "Zurueck zum Login" = 1,72:1. Hell 8,98:1.
  //
  // Die Bereichsfarben bleiben in beiden Modi gleich (Test oben) -- sie sind
  // FLAECHEN. Als SCHRIFT auf einer Karte brauchen sie ein eigenes Text-Token,
  // das im Dunkeln aufhellt; hell ist es die Bereichsfarbe selbst, damit sich
  // dort nichts aendert. Erstes Token dieser Art: --app-text-konfis.
  const dunkel = tokens(dunkelBloecke[0] ?? '');
  const regel = (selektor: string) => {
    const roh = selektor.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
    const m = css.match(new RegExp(`(?:^|\\n)${roh} \\{([^}]*)\\}`));
    expect(m, `${selektor} nicht gefunden`).toBeTruthy();
    return m![1];
  };

  it('das Text-Token ist hell die Bereichsfarbe selbst -- im Hellen aendert sich nichts', () => {
    expect(helleTokens.get('--app-text-konfis')).toBe(helleTokens.get('--app-color-konfis'));
    expect(helleTokens.get('--app-text-konfis-rgb')).toBe(helleTokens.get('--app-color-konfis-rgb'));
  });

  it('dunkel liest es sich auf der Karte: mindestens 4,5:1, auch mit 0,7 Deckkraft', () => {
    const karte = dunkel.get('--app-surface-card')!;
    const text = dunkel.get('--app-text-konfis')!;
    expect(kontrast(text, karte)).toBeGreaterThanOrEqual(4.5);
    // .app-auth-link--muted legt das Token mit 0,7 Deckkraft auf die Karte.
    expect(kontrast(mische(text, 0.7, karte), karte)).toBeGreaterThanOrEqual(4.5);
    // Und es ist wirklich ein eigener, hellerer Ton -- kein Alias der Flaeche.
    expect(text).not.toBe(dunkel.get('--app-color-konfis'));
  });

  it('Ueberschrift, Feldbeschriftung und Links der Anmeldeseiten schreiben mit dem Text-Token', () => {
    for (const selektor of ['.app-auth-card__heading h2', '.app-auth-input__label', '.app-auth-link']) {
      const r = regel(selektor);
      expect(r, selektor).toMatch(/color:\s*var\(--app-text-konfis\)/);
      expect(r, selektor).not.toMatch(/--app-color-(?:konfis|requests|purple)\b/);
    }
    const gedaempft = regel('.app-auth-link--muted');
    expect(gedaempft).toMatch(/color:\s*rgba\(var\(--app-text-konfis-rgb\),\s*0\.7\)/);
    expect(gedaempft).not.toMatch(/--app-color-(?:konfis|requests|purple)-rgb/);
  });
});

describe('Dunkelmodus: Dashboard-Verlaeufe enden auf Flaechen, nicht auf Text', () => {
  // GEMESSEN am 26.09.2026 (Dunkelmodus-Audit BF-02, computed.cjs): Die
  // Ranking-Karte lief von #34c759 nach #a7f3d0 (Mint), die Events-Karte von
  // #dc2626 nach #fca5a5 (Rosa) -- weisse Schrift darauf 1,28:1 bzw. 1,90:1
  // (hell 8,68 / 8,31). Ursache: Die Verlaeufe endeten auf TEXT-Tokens
  // (--app-color-success-tief, --app-text-fehler), die der Dunkelblock fuer
  // ihren Zweck -- Schrift auf dunkler Statusflaeche -- richtig aufhellt.
  // Ein Verlaufsende ist eine Flaeche und braucht ein Flaechen-Token.
  const dunkel = tokens(dunkelBloecke[0] ?? '');
  const verlauf = (klasse: string) => {
    const regel = css.match(new RegExp(`\\.${klasse} \\{([^}]*)\\}`));
    expect(regel, `.${klasse} nicht gefunden`).toBeTruthy();
    const bg = /background:\s*linear-gradient\(([^;]*)\);/.exec(regel![1]);
    expect(bg, `.${klasse} hat keinen Verlauf`).toBeTruthy();
    return bg![1];
  };

  it('kein Text-Token steht als Stufe in einem Verlauf -- nirgends im Stylesheet', () => {
    const treffer = [...css.matchAll(/gradient\(([^;]*)\)/g)]
      .map((m) => m[1])
      .filter((stufen) => /var\(--app-text-|var\(--app-color-success-tief\)/.test(stufen));
    expect(treffer).toEqual([]);
  });

  it('Events- und Ranking-Karte enden auf ihren Flaechen-Tokens', () => {
    expect(verlauf('app-dashboard-section--events')).toMatch(/var\(--app-color-events-tief\) 100%/);
    expect(verlauf('app-dashboard-section--ranking')).toMatch(/var\(--app-color-success-klassisch-dunkel\) 100%/);
  });

  it('weisse Schrift auf den Verlaufsenden: mindestens 4,5:1, hell wie dunkel', () => {
    for (const name of ['--app-color-events-tief', '--app-color-success-klassisch-dunkel']) {
      expect(kontrast('#ffffff', helleTokens.get(name)!), `${name} hell`).toBeGreaterThanOrEqual(4.5);
      expect(kontrast('#ffffff', dunkel.get(name)!), `${name} dunkel`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('im Hellen aendert sich nichts: die Enden tragen die Toene von vorher', () => {
    // Vorher endeten die Verlaeufe hell auf #991b1b (--app-text-fehler) und
    // #155724 (--app-color-success-tief). Die Flaechen-Tokens tragen genau
    // diese Werte -- wer sie aendert, aendert das helle Dashboard und muss
    // hier bewusst nachziehen.
    expect(helleTokens.get('--app-color-events-tief')).toBe('#991b1b');
    expect(helleTokens.get('--app-color-success-klassisch-dunkel')).toBe('#155724');
  });
});

describe('Dunkelmodus: die Kartenregel schlaegt das iOS-Theme an Spezifitaet', () => {
  // GEMESSEN am 26.09.2026 (Dunkelmodus-Audit BF-03, hell-karte.cjs): Auf iOS
  // rendert ion-card.app-card im Dunkeln rgb(28,28,29) -- Ionics
  // --ion-card-background --, nicht das Token #242426; auf Android #242426.
  // Ursache: ionic-theme-ios27 setzt `ion-card.ios:not(.ios-theme-disabled,
  // .ios26-disabled):not(.ion-color) { --background: var(--ion-card-background,
  // …) }` mit Spezifitaet (0,3,1). Die App-Regel `ion-card.app-card:not(
  // .ios-theme-disabled)` hatte (0,2,1) und verlor -- im Hellen unsichtbar,
  // weil beide Wege bei #ffffff enden. Fuenf Karten wurden stattdessen per
  // Inline-Style geflickt, 225 nicht.
  //
  // Der Text-Test kann das Rendering nicht sehen. Er kann aber rechnen, was
  // der Browser rechnet: die Spezifitaet. Die Kartenregel muss JEDEN Karten-
  // Selektor des Themes echt schlagen -- dann ist die Ladereihenfolge der
  // Stylesheets egal, und der Fix haengt nicht an einem @import.
  const THEME = 'node_modules/@rdlabo/ionic-theme-ios27/dist/css/ionic-theme-ios27.css';

  /** Theme-Selektoren, die --background direkt an einer ion-card setzen. */
  function themeKartenSelektoren(): string[] {
    const raus: string[] = [];
    for (const { selektor, rumpf } of regeln(ohneKommentare(lies(THEME)))) {
      if (!/(?:^|;)\s*--background\s*:/.test(rumpf)) continue;
      for (const einzeln of teileObersteEbene(selektor)) {
        if (/^ion-card(?![\w-])/.test(letzterVerbund(einzeln.trim()))) raus.push(einzeln.trim());
      }
    }
    return raus;
  }

  it('die Rechnung stimmt an bekannten Selektoren', () => {
    expect(spezifitaet('ion-card.ios:not(.ios-theme-disabled,.ios26-disabled):not(.ion-color)')).toEqual([0, 3, 1]);
    // Die alte Kartenregel: eine Klasse zu wenig -- genau der Befund.
    expect(spezifitaet('ion-card.app-card:not(.ios-theme-disabled)')).toEqual([0, 2, 1]);
    expect(spezifitaet(':root.ios ion-card.app-card:not(.ios-theme-disabled)')).toEqual([0, 4, 1]);
    expect(spezifitaet('#a .b c::before:hover')).toEqual([1, 2, 2]);
    expect(spezifitaet(':where(.a, #b) .c')).toEqual([0, 1, 0]);
    expect(spezifitaet(':is(.a, #b) .c')).toEqual([1, 1, 0]);
    expect(vergleich([0, 4, 1], [0, 3, 1])).toBeGreaterThan(0);
    expect(vergleich([0, 3, 2], [0, 3, 1])).toBeGreaterThan(0);
    expect(vergleich([0, 2, 9], [0, 3, 0])).toBeLessThan(0);
  });

  it('das Theme setzt --background an ion-card -- die Regel, gegen die gerechnet wird, existiert', () => {
    // Faellt sie beim naechsten Theme-Update weg oder heisst anders, muss die
    // Rechnung neu gemacht werden -- nicht still gruen bleiben.
    const theme = themeKartenSelektoren();
    expect(theme).toContain('ion-card.ios:not(.ios-theme-disabled,.ios26-disabled):not(.ion-color)');
  });

  it('jeder Selektor der Kartenregel ist spezifischer als jeder Karten-Selektor des Themes', () => {
    const { selektoren, rumpf } = kartenRegel();
    expect(rumpf).toMatch(/--background:\s*var\(--app-surface-card\)/);
    // Beide Plattform-Wurzeln: Auf md gibt es heute keine Theme-Regel, aber
    // eine Karte mit mode="ios" unter html.md traegt trotzdem .ios.
    expect(selektoren.some((s) => s.startsWith(':root.ios '))).toBe(true);
    expect(selektoren.some((s) => s.startsWith(':root.md '))).toBe(true);
    const unterlegen: string[] = [];
    for (const eigener of selektoren) {
      for (const fremd of themeKartenSelektoren()) {
        if (vergleich(spezifitaet(eigener), spezifitaet(fremd)) <= 0) {
          unterlegen.push(`${eigener} (${spezifitaet(eigener)}) schlaegt nicht ${fremd} (${spezifitaet(fremd)})`);
        }
      }
    }
    expect(unterlegen).toEqual([]);
  });

  it('keine app-card traegt mehr einen Inline-Flicken fuer den Kartengrund', () => {
    // PostfachModal.tsx hatte vom 25. bis 26.09.2026 `style={{ '--background':
    // 'var(--app-surface-card)' }}` an der IonCard -- ein Symptom-Fix, der die
    // Spezifitaetsfrage verdeckte. Seit die Kartenregel greift, ist er weg; ein
    // neuer waere wieder einer.
    const treffer: string[] = [];
    for (const datei of dateienUnter('src', '.tsx')) {
      const code = lies(datei).replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
      for (const m of code.matchAll(/<IonCard\b[^>]*>/g)) {
        if (/className=["'{`][^"'}]*\bapp-card\b/.test(m[0]) && /'--background'\s*:/.test(m[0])) {
          treffer.push(`${datei}: ${m[0].replace(/\s+/g, ' ').slice(0, 120)}`);
        }
      }
    }
    expect(treffer).toEqual([]);
  });
});

/* --- WCAG-Rechnung --------------------------------------------------- */

function hexZuRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function relativeHelligkeit(hex: string): number {
  const [r, g, b] = hexZuRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function kontrast(a: string, b: string): number {
  const [l1, l2] = [relativeHelligkeit(a), relativeHelligkeit(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Farbe `oben` mit Deckkraft `alpha` auf `unten` gelegt -- so rechnet der Browser rgba(). */
function mische(oben: string, alpha: number, unten: string): string {
  const o = hexZuRgb(oben);
  const u = hexZuRgb(unten);
  return '#' + o.map((c, i) => Math.round(c * alpha + u[i] * (1 - alpha)).toString(16).padStart(2, '0')).join('');
}

/* --- JSX lesen ------------------------------------------------------- */

/**
 * Alle oeffnenden JSX-Tags `<Name …>` einer Datei samt Attributen -- auch wenn
 * in einem {…}-Ausdruck ein `>` steht (Pfeilfunktion, Vergleich) oder ein
 * String eine Klammer enthaelt.
 */
function jsxOeffnendeTags(code: string, name: string): string[] {
  const raus: string[] = [];
  for (const m of code.matchAll(new RegExp(`<${name}(?=[\\s/>])`, 'g'))) {
    let tiefe = 0;
    let anfuehrung: string | null = null;
    for (let i = m.index! + m[0].length; i < code.length; i++) {
      const c = code[i];
      if (anfuehrung) { if (c === anfuehrung && code[i - 1] !== '\\') anfuehrung = null; continue; }
      if (tiefe > 0 && (c === '"' || c === "'" || c === '`')) { anfuehrung = c; continue; }
      if (c === '{') tiefe++;
      else if (c === '}') tiefe--;
      else if (c === '>' && tiefe === 0) { raus.push(code.slice(m.index!, i + 1)); break; }
    }
  }
  return raus;
}

/* --- CSS-Rechnung ---------------------------------------------------- */

/**
 * Alle Regeln eines Stylesheets als Selektor + Rumpf. At-Regeln (@media,
 * @supports, @font-face) werden geoeffnet und ihr Inhalt normal gelesen;
 * ihre eigene Kopfzeile ist keine Regel.
 */
function regeln(cssText: string): { selektor: string; rumpf: string }[] {
  const raus: { selektor: string; rumpf: string }[] = [];
  let kopf = '';
  for (let i = 0; i < cssText.length; i++) {
    const c = cssText[i];
    if (c === '{') {
      if (kopf.trim().startsWith('@')) { kopf = ''; continue; }
      const ende = cssText.indexOf('}', i);
      raus.push({ selektor: kopf.trim(), rumpf: cssText.slice(i + 1, ende) });
      i = ende;
      kopf = '';
    } else if (c === '}') kopf = '';
    else kopf += c;
  }
  return raus;
}

/** Die Kartenregel `ion-card.app-card` aus variables.css: ihre Selektoren einzeln und ihr Rumpf. */
function kartenRegel(): { selektoren: string[]; rumpf: string } {
  const treffer = regeln(css).filter((r) => r.selektor.includes('ion-card.app-card:not(.ios-theme-disabled)') && /--background\s*:/.test(r.rumpf));
  expect(treffer, 'Kartenregel ion-card.app-card nicht gefunden').toHaveLength(1);
  return { selektoren: teileObersteEbene(treffer[0].selektor).map((s) => s.trim()).filter(Boolean), rumpf: treffer[0].rumpf };
}

/** Eine Selektorliste an den Kommas der obersten Ebene trennen -- Kommas in :not(a, b) bleiben. */
function teileObersteEbene(text: string): string[] {
  const raus: string[] = [];
  let tiefe = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[') tiefe++;
    else if (c === ')' || c === ']') tiefe--;
    else if (c === ',' && tiefe === 0) { raus.push(text.slice(start, i)); start = i + 1; }
  }
  raus.push(text.slice(start));
  return raus;
}

/** Der letzte Verbund-Selektor eines komplexen Selektors -- das Element, das die Regel trifft. */
function letzterVerbund(selektor: string): string {
  let tiefe = 0;
  let start = 0;
  for (let i = 0; i < selektor.length; i++) {
    const c = selektor[i];
    if (c === '(' || c === '[') tiefe++;
    else if (c === ')' || c === ']') tiefe--;
    else if (tiefe === 0 && /[\s>+~]/.test(c)) start = i + 1;
  }
  return selektor.slice(start);
}

/**
 * Spezifitaet eines einzelnen komplexen Selektors als [IDs, Klassen, Elemente]
 * nach Selectors Level 4: Klassen, Attribute und Pseudoklassen zaehlen gleich;
 * :not()/:is()/:has() zaehlen wie ihr spezifischstes Argument, :where() nichts;
 * Pseudoelemente zaehlen wie Elemente.
 */
function spezifitaet(selektor: string): [number, number, number] {
  const s = selektor.trim();
  let ids = 0;
  let klassen = 0;
  let elemente = 0;
  let i = 0;
  const name = () => {
    const m = /^[\w-]+/.exec(s.slice(i));
    if (!m) throw new Error(`Name erwartet in "${s}" an Stelle ${i}`);
    i += m[0].length;
    return m[0];
  };
  const klammer = () => {
    let tiefe = 0;
    const start = i + 1;
    for (; i < s.length; i++) {
      if (s[i] === '(') tiefe++;
      else if (s[i] === ')' && --tiefe === 0) { const inhalt = s.slice(start, i); i++; return inhalt; }
    }
    throw new Error(`Klammer nicht geschlossen in "${s}"`);
  };
  while (i < s.length) {
    const c = s[i];
    if (c === '#') { i++; name(); ids++; }
    else if (c === '.') { i++; name(); klassen++; }
    else if (c === '[') { i = s.indexOf(']', i) + 1; klassen++; }
    else if (c === ':' && s[i + 1] === ':') { i += 2; name(); if (s[i] === '(') klammer(); elemente++; }
    else if (c === ':') {
      i++;
      const n = name();
      if (s[i] !== '(') { klassen++; continue; }
      const inhalt = klammer();
      if (n === 'not' || n === 'is' || n === 'has') {
        const max = teileObersteEbene(inhalt).map(spezifitaet).sort(vergleich).pop()!;
        ids += max[0]; klassen += max[1]; elemente += max[2];
      } else if (n !== 'where') klassen++;
    }
    else if (/[\s>+~*]/.test(c)) i++;
    else if (/[a-zA-Z]/.test(c)) { name(); elemente++; }
    else throw new Error(`Unerwartetes Zeichen "${c}" in "${s}"`);
  }
  return [ids, klassen, elemente];
}

/** Positiv, wenn a spezifischer ist als b; 0 bei Gleichstand (dann entscheidet die Reihenfolge). */
function vergleich(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/**
 * L* (CIE-Helligkeit) eines Hexwerts, 0 = Schwarz, 100 = Weiss.
 *
 * Fuer FLAECHEN dicht ueber Schwarz ist das der richtige Massstab, nicht das
 * WCAG-Verhaeltnis: Dessen +0,05 im Zaehler und Nenner staucht den Bereich so,
 * dass #000 -> #1c1c1e und #000 -> #2c2c2e beide als "rund 1,2-1,5:1" lesen,
 * obwohl der zweite Schritt fast doppelt so gross ist. L* ist perzeptuell
 * gleichabstaendig -- ein dL* von 10 sieht unten wie oben gleich weit aus.
 * (WCAG bleibt fuer TEXT auf Flaeche der Massstab, siehe kontrast().)
 */
function lStern(hex: string): number {
  const y = relativeHelligkeit(hex);
  return y <= 216 / 24389 ? y * (24389 / 27) : Math.cbrt(y) * 116 - 16;
}

/** Helligkeitsschritt von a nach b in L*. Positiv heisst: b ist heller. */
function dLStern(a: string, b: string): number {
  return lStern(b) - lStern(a);
}
