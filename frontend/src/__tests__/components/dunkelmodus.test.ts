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
const hell = css.replace(/@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n\}\n/g, '');

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
};

const helleTokens = tokens(hell);
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
    const gleich = [...dunkleTokens.entries()].filter(([n, w]) => helleTokens.get(n) === w).map(([n]) => n);
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

  it('die Bereichs-Bezeichner tragen im Dunkeln hellere Toene als im Hellen', () => {
    // "Nicht invertieren, sondern eine Stufe heller" -- fuer die Bereiche,
    // die als Symbol- und Textfarbe auf dunklem Grund stehen.
    const zuDunkel: string[] = [];
    for (const name of ['events', 'activities', 'konfis', 'teamer', 'challenges', 'users', 'badges', 'jahrgang', 'categories', 'chat', 'level']) {
      const h = relativeHelligkeit(helleTokens.get(`--app-color-${name}`)!);
      const d = relativeHelligkeit(dunkleTokens.get(`--app-color-${name}`)!);
      if (d <= h) zuDunkel.push(`${name}: ${d.toFixed(3)} <= ${h.toFixed(3)}`);
    }
    expect(zuDunkel).toEqual([]);
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
