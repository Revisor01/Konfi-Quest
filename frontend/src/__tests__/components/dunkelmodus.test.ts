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
    for (const name of ['--app-text-primary', '--app-text-secondary', '--app-text-tertiary', '--app-text-system', '--app-text-emphasis', '--app-text-body', '--app-text-ios', '--app-text-dunkelgrau', '--app-text-mittelgrau']) {
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

    for (const [, selektor] of blase) {
      const basis = selektor.trim().replace(/::part\(content\).*$/, '');
      const faerbtPfeil = new RegExp(
        `${basis.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}[^\\n{}]*::part\\(arrow\\)`
      ).test(css);
      const setztBackground = new RegExp(
        `${basis.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*--background\\s*:`
      ).test(css);
      expect(
        faerbtPfeil || setztBackground,
        `"${selektor.trim()}" faerbt die Blase, aber weder den Pfeil noch --background`
      ).toBe(true);
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

  // SIMONS BEFUND (26.09.2026): "auf dem Dashboard bei Badges ist der Pfeil
  // unten durchsichtig. Bei Stempel (alle Rollen), bei Badges im Dashboard
  // Konfi und Teamer und bei Badges auf der Seite bei Konfi und Teamer."
  //
  // Gemessen im Theme-Stylesheet: ion-popover.ios setzt
  // `--background: rgba(<glas>, 0.67)`, und ::part(arrow)::after bekommt dort
  // NUR clip-path und backdrop-filter -- kein eigenes background. Die
  // gestanzte Spitze erbt also das Glas und zeigt, was darunter liegt.
  it('die Abzeichen-Sprechblase ist deckend, Blase wie Pfeilspitze', () => {
    const regel = css.match(/\.badge-popover-auto-width,\s*\n\.badge-detail-popover \{([\s\S]*?)\}/);
    expect(regel, '.badge-detail-popover nicht gefunden').toBeTruthy();
    // Deckende Flaeche statt Theme-Glas -- die Spitze erbt sie mit.
    expect(regel![1]).toMatch(/--background:\s*var\(--app-surface-card\)/);
    // Und ausdruecklich noch einmal fuer die Spitze, falls jemand spaeter
    // ::part(content) faerbt statt --background.
    expect(css).toMatch(/\.badge-detail-popover::part\(arrow\)::after/);
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
