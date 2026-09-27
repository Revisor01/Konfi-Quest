import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-07: Schriftgroessen und Zoom.
//
// (a) Zoom im Browser. `maximum-scale=1.0, user-scalable=no` sperrte das
//     Zwei-Finger-Zoomen (WCAG 1.4.4). Gemessen mit Playwright, Android-
//     Kennung, Zwei-Finger-Geste auf /login: Skala 1,00 -> 5,00. Ohne die
//     Sperre zoomt iOS beim Antippen eines Feldes von selbst heran, wenn
//     dessen Schrift unter 16 px liegt -- gemessen: alle 43 Feld-Vorkommen
//     (27 Beschriftungen, drei Rollen, Formulare der Leitung) 16 px. Die Regel
//     unten haelt fest, dass niemand ein Feld kleiner setzt. In den Apps
//     sperrt Capacitor das Zoomen selbst (zoomEnabled, Vorgabe false).
//
// (b) Systemschrift. Der Bericht meinte, die App folge auf iOS nicht der
//     Textgroesse, weil `-apple-system-body` im Projekt fehle. Das Projekt
//     braucht es nicht selbst: Ionic 9 setzt es in typography.css
//     (`@supports (-webkit-touch-callout: none) { html { font:
//     var(--ion-dynamic-font) } }`, core.css: `--ion-dynamic-font:
//     -apple-system-body`), und die ganze Typografie haengt an rem. Die
//     Tests halten fest, dass das so bleibt -- dass niemand die Wurzelschrift
//     ueberschreibt, die Zeile nicht aus einer neuen Ionic-Fassung faellt und
//     Android nicht per setTextZoom abgekoppelt wird. Am Geraet bestaetigt
//     ist es damit nicht (siehe Audit-Bericht, Pruefschritte).
//
// (c) Reiter-Beschriftungen 8,8 px (Android) / 9,4 px (iOS) -> 0.7rem.
// ---------------------------------------------------------------------------

const frontend = process.cwd();
const lies = (pfad: string) => readFileSync(resolve(frontend, pfad), 'utf8');
const flach = (text: string) => text.replace(/\s+/g, ' ');

const dateien = (ordner: string, endung: RegExp): string[] =>
  readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) return name === '__tests__' ? [] : dateien(pfad, endung);
    return endung.test(name) ? [pfad] : [];
  });

// Oeffnungstags von JSX-Elementen, klammerbewusst (ein `=>` in einem
// Handler beendet den Tag nicht).
const oeffnungstags = (quelle: string, namen: RegExp): string[] => {
  const tags: string[] = [];
  for (const m of quelle.matchAll(namen)) {
    let tiefe = 0;
    let anfuehrung: string | null = null;
    for (let i = m.index!; i < quelle.length; i++) {
      const z = quelle[i];
      if (anfuehrung) { if (z === anfuehrung) anfuehrung = null; continue; }
      if (z === "'" || z === '"' || z === '`') anfuehrung = z;
      else if (z === '{') tiefe++;
      else if (z === '}') tiefe--;
      else if (z === '>' && tiefe === 0) { tags.push(quelle.slice(m.index!, i + 1)); break; }
    }
  }
  return tags;
};

// CSS-Regeln als [Selektor, Rumpf] -- @media/@supports-Bloecke werden
// aufgeloest, Kommentare entfernt.
const regeln = (css: string): Array<[string, string]> => {
  const ohne = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...ohne.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);
};

describe('Zoomen im Browser ist erlaubt (UI BF-07a, WCAG 1.4.4)', () => {
  const meta = lies('index.html').match(/<meta\s+name="viewport"\s+content="([^"]+)"/);

  it('der Viewport sperrt das Zoomen nicht', () => {
    expect(meta).not.toBeNull();
    expect(meta![1]).toContain('width=device-width');
    expect(meta![1]).toContain('initial-scale=1.0');
    expect(meta![1]).not.toMatch(/maximum-scale/);
    expect(meta![1]).not.toMatch(/user-scalable\s*=\s*(no|0)/);
  });

  it('in den Apps bleibt das Zoomen aus: capacitor.config.ts schaltet zoomEnabled nicht an', () => {
    expect(lies('capacitor.config.ts')).not.toMatch(/zoomEnabled\s*:\s*true/);
  });

  it('kein Stylesheet setzt Eingabefelder unter 16 px (iOS zoomte sonst beim Antippen heran)', () => {
    // Erfasst Regeln, die ein Feld direkt treffen: ueber den Elementnamen
    // oder eine Klasse, die an einem Feld steht (.app-auth-input__value).
    // Geerbte Groessen aus einem Behaelter sieht nur die gerenderte Messung
    // (Audit-Bericht BF-07) -- dort waren alle Felder 16 px.
    const feldKlassen = new Set<string>();
    for (const pfad of dateien(resolve(frontend, 'src/components'), /\.tsx$/)) {
      for (const tag of oeffnungstags(readFileSync(pfad, 'utf8'), /<(?:IonInput|IonTextarea|IonSearchbar|input|textarea)\b/g)) {
        tag.match(/className="([^"]+)"/)?.[1].split(/\s+/).forEach((k) => feldKlassen.add(k));
      }
    }
    expect(feldKlassen.has('app-auth-input__value')).toBe(true);
    const klasse = [...feldKlassen].map((k) => `\\.${k}(?![\\w-])`).join('|');
    const feld = new RegExp(`ion-input|ion-textarea|ion-searchbar|native-input|native-textarea|searchbar-input|(^|[\\s,>+~(])(input|textarea|select)\\b${klasse ? `|${klasse}` : ''}`);
    const zuKlein: string[] = [];
    for (const pfad of dateien(resolve(frontend, 'src'), /\.css$/)) {
      for (const [selektor, rumpf] of regeln(readFileSync(pfad, 'utf8'))) {
        if (!feld.test(selektor)) continue;
        const groesse = rumpf.match(/(?:^|;)\s*(?:--)?font-size\s*:\s*([^;!]+)/);
        if (!groesse) continue;
        const wert = groesse[1].trim();
        const ok = wert === 'inherit' || /^(1(\.0+)?rem|1[6-9](\.\d+)?px|[2-9]\d(\.\d+)?px|var\(--app-text-(standard|gross|untertitel|titel\S*|ueberschrift\S*)\))$/.test(wert);
        if (!ok) zuKlein.push(`${relative(frontend, pfad)}: ${selektor} { font-size: ${wert} }`);
      }
    }
    expect(zuKlein).toEqual([]);
  });

  it('keine Komponente verkleinert ein Feld per style', () => {
    const treffer: string[] = [];
    for (const pfad of dateien(resolve(frontend, 'src/components'), /\.tsx$/)) {
      for (const tag of oeffnungstags(readFileSync(pfad, 'utf8'), /<(?:IonInput|IonTextarea|IonSearchbar|input|textarea)\b/g)) {
        if (/style=\{\{[^}]*fontSize/.test(tag)) treffer.push(`${relative(frontend, pfad)}: ${tag.slice(0, 40)}`);
      }
    }
    expect(treffer).toEqual([]);
  });
});

describe('Die Schrift folgt der Systemgroesse (UI BF-07b)', () => {
  it('App.tsx laedt Ionics core.css und typography.css', () => {
    const app = lies('src/App.tsx');
    expect(app).toContain("import '@ionic/react/css/core.css';");
    expect(app).toContain("import '@ionic/react/css/typography.css';");
  });

  it('Ionic setzt auf iOS die Wurzelschrift auf die Textgroesse des Systems (-apple-system-body)', () => {
    const typografie = flach(lies('node_modules/@ionic/react/css/typography.css'));
    expect(typografie).toMatch(/@supports ?\(-webkit-touch-callout: ?none\) ?\{ ?html ?\{ ?font: ?var\(--ion-dynamic-font, 16px var\(--ion-font-family\)\)/);
    expect(flach(lies('node_modules/@ionic/react/css/core.css'))).toMatch(/html ?\{ ?--ion-dynamic-font: ?-apple-system-body/);
  });

  it('kein eigenes Stylesheet ueberschreibt --ion-dynamic-font oder die Wurzelschrift', () => {
    const treffer: string[] = [];
    for (const pfad of dateien(resolve(frontend, 'src'), /\.css$/)) {
      for (const [selektor, rumpf] of regeln(readFileSync(pfad, 'utf8'))) {
        if (/--ion-dynamic-font\s*:/.test(rumpf)) treffer.push(`${relative(frontend, pfad)}: ${selektor} setzt --ion-dynamic-font`);
        const wurzel = selektor.split(',').some((s) => /^(html|:root|body)([.:[][^\s>+~]*)?$/.test(s.trim()));
        if (wurzel && /(?:^|;)\s*font(-size)?\s*:/.test(rumpf)) treffer.push(`${relative(frontend, pfad)}: ${selektor} setzt die Wurzelschrift`);
      }
    }
    expect(treffer).toEqual([]);
  });

  it('die Textstufen der Skala sind rem und wachsen damit mit', () => {
    const skala = [...lies('src/theme/typografie.css').matchAll(/(--app-text-[\w-]+):\s*([^;]+);/g)];
    expect(skala.length).toBeGreaterThanOrEqual(15);
    expect(skala.filter(([, name, wert]) => name !== '--app-text-hinweispunkt' && !/^[\d.]+rem$/.test(wert.trim())).map((m) => `${m[1]}: ${m[2]}`)).toEqual([]);
  });

  it('Android: die WebView wird nicht per setTextZoom von der Systemschrift abgekoppelt', () => {
    const quellen = dateien(resolve(frontend, 'android/app/src/main'), /\.(java|kt)$/);
    expect(quellen.length).toBeGreaterThan(0);
    expect(quellen.filter((p) => /setTextZoom|textZoom/.test(readFileSync(p, 'utf8'))).map((p) => relative(frontend, p))).toEqual([]);
    const capBruecke = 'node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/Bridge.java';
    if (existsSync(resolve(frontend, capBruecke))) expect(lies(capBruecke)).not.toMatch(/setTextZoom/);
  });
});

describe('Reiter-Beschriftungen (UI BF-07c)', () => {
  const css = lies('src/theme/variables.css');

  it('0.7rem auf beiden Plattformen', () => {
    expect(lies('src/theme/typografie.css')).toMatch(/--app-text-reiter:\s*0\.7rem;/);
    const md = css.match(/ion-tab-bar\.md ion-tab-button ion-label,[^{]*\{[^}]*\}/);
    expect(md![0]).toContain('font-size: var(--app-text-reiter) !important');
    const ios = css.match(/ion-tab-bar\.ios ion-tab-button ion-label \{[^}]*\}/);
    expect(ios).not.toBeNull();
    expect(ios![0]).toContain('font-size: min(var(--app-text-reiter), 12px) !important');
  });

  it('Android: die Beschriftung hat die ganze Breite des Reiters (Ionics 12-px-Innenabstand aufgehoben)', () => {
    const knopf = css.match(/ion-tab-bar\.md ion-tab-button \{[^}]*\}/);
    expect(knopf![0]).toMatch(/--padding-start:\s*0 !important/);
    expect(knopf![0]).toMatch(/--padding-end:\s*0 !important/);
  });
});
