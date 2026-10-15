import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

// Typografie-Konsolidierung vom 05.09.2026: Vorher lagen 607 Inline-fontSize
// und 254 Inline-fontWeight verstreut in den Komponenten — zentral aenderbar
// war nur die Farbe (75 Farb-Tokens, EIN Schrift-Token). Seitdem ist
// theme/typografie.css die eine Stelle fuer Schriftgroessen und -schnitte.
//
// Diese Tests lesen die Quellen, statt zu rendern (wie
// umlauteUndZurueckIcon.test.ts): Sie pruefen die Verdrahtung, damit die
// Schrift nicht still wieder an der einen Stelle vorbeilaeuft. Welche Stufen
// es gibt und wie gross sie sind, legen sie nicht fest -- das ist Gestaltung
// und bleibt frei aenderbar (Simon, 15.10.2026). In diesem Projekt ist beim
// Umbauen mehrfach eine Rolle vergessen worden — deshalb pruefen die Tests
// admin, teamer und konfi ausdruecklich getrennt.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

/** Alle Dateien mit Endung unterhalb eines Verzeichnisses, rekursiv. */
function dateienUnter(verzeichnis: string, endung = '.tsx'): string[] {
  const voll = resolve(process.cwd(), verzeichnis);
  const raus: string[] = [];
  for (const eintrag of readdirSync(voll)) {
    const pfad = join(voll, eintrag);
    if (statSync(pfad).isDirectory()) raus.push(...dateienUnter(join(verzeichnis, eintrag), endung));
    else if (eintrag.endsWith(endung)) raus.push(join(verzeichnis, eintrag));
  }
  return raus;
}

// ShareCard rendert das pixelfeste 1080px-Teilen-Bild (html-to-image).
// Dort MUESSEN die Groessen absolute Pixel bleiben: Haengte das Export-Bild
// an rem, veraenderte die Systemschriftgroesse des Geraets das Bild.
const AUSNAHMEN = ['ShareCard.tsx'];

const istAusnahme = (pfad: string) => AUSNAHMEN.some(a => pfad.endsWith(a));

describe('Typografie-Skala', () => {
  it('wird von variables.css importiert', () => {
    expect(lies('src/theme/variables.css')).toContain("@import './typografie.css';");
  });
});

describe('Keine rohen Schriftwerte mehr in den Komponenten', () => {
  const alleTsx = dateienUnter('src/components').filter(d => !istAusnahme(d));

  it('keine Komponente setzt fontSize als px/rem/em/Zahl', () => {
    // Dynamisch berechnete Groessen (ActivityRings: size * 0.22) bleiben
    // erlaubt — die Regex greift nur Literale.
    const treffer: string[] = [];
    for (const datei of alleTsx) {
      for (const zeile of lies(datei).split('\n')) {
        if (/fontSize:\s*['"`]?[\d.]/.test(zeile)) treffer.push(`${datei}: ${zeile.trim()}`);
      }
    }
    expect(treffer).toEqual([]);
  });

  it('keine Komponente setzt fontWeight als Zahl oder Schluesselwort', () => {
    const treffer: string[] = [];
    for (const datei of alleTsx) {
      for (const zeile of lies(datei).split('\n')) {
        if (/fontWeight:\s*['"`]?(\d|bold|normal)/.test(zeile)) treffer.push(`${datei}: ${zeile.trim()}`);
      }
    }
    expect(treffer).toEqual([]);
  });
});

describe('Alle drei Rollen haengen an derselben Skala', () => {
  // Beim Umbau ist in diesem Projekt mehrfach eine Rolle vergessen worden
  // (zuletzt die Teamer-Wrapped-Kachel am 11.08.2026). Deshalb je Rolle
  // einzeln: keine rohen Werte UND echte Verwendung der Tokens.
  for (const rolle of ['admin', 'teamer', 'konfi'] as const) {
    it(`${rolle} nutzt die Text- und Schnitt-Tokens`, () => {
      const quellen = dateienUnter(`src/components/${rolle}`).map(lies).join('\n');
      expect(/var\(--app-text-[\w-]+\)/.test(quellen), `${rolle}: kein Text-Token in Verwendung`).toBe(true);
      expect(/var\(--app-schrift-[\w-]+\)/.test(quellen), `${rolle}: kein Schnitt-Token in Verwendung`).toBe(true);
      expect(quellen.match(/fontSize:\s*['"`]?[\d.]/g) ?? []).toEqual([]);
      expect(quellen.match(/fontWeight:\s*['"`]?(\d|bold|normal)/g) ?? []).toEqual([]);
    });
  }
});

describe('Auch die Stylesheets haengen an der Skala', () => {
  const fontDeklarationen = (css: string, eigenschaft: string): string[] =>
    [...css.matchAll(new RegExp(`(?<![\\w-])${eigenschaft}: *([^;]+);`, 'g'))].map(m => m[1].trim());

  it('variables.css setzt keine festen Schriftwerte mehr', () => {
    const css = lies('src/theme/variables.css');
    // clamp() bleibt erlaubt: responsive Groessen sind keine Skala-Stufen.
    // Ebenso min(var(...), px): eine Skala-Stufe mit Obergrenze (Reiter im
    // iOS-Look, UI-Audit BF-07 -- dort laufen zu grosse Beschriftungen in die
    // Nachbarin, statt gekuerzt zu werden).
    const groessen = fontDeklarationen(css, 'font-size').filter(w => !w.startsWith('var(') && !w.startsWith('clamp(') && !w.startsWith('min(var('));
    expect(groessen).toEqual([]);
    const schnitte = fontDeklarationen(css, 'font-weight').filter(w => !w.startsWith('var('));
    expect(schnitte).toEqual([]);
  });

  it('FileViewerModal.css setzt keine festen Schriftwerte mehr', () => {
    const css = lies('src/components/shared/FileViewerModal.css');
    expect(fontDeklarationen(css, 'font-size').filter(w => !w.startsWith('var('))).toEqual([]);
    expect(fontDeklarationen(css, 'font-weight').filter(w => !w.startsWith('var('))).toEqual([]);
  });

  it('WrappedModal.css: rem-Werte an der Skala, px und clamp bleiben pixelfest', () => {
    // Die Story-Folien sind ein pixelfestes Layout mit eigenen responsiven
    // Tokens (--w-*, clamp). px-Werte bleiben dort bewusst stehen; die
    // beiden Folien-Schmuckstuecke 5rem/16rem sind dokumentierte
    // Einzelstuecke (Highlight-Zahl und Hintergrund-Symbol).
    const css = lies('src/components/wrapped/WrappedModal.css');
    const rest = fontDeklarationen(css, 'font-size')
      .filter(w => !w.startsWith('var(') && !w.startsWith('clamp(') && !/^[\d.]+px$/.test(w))
      .filter(w => w !== '5rem' && w !== '16rem');
    expect(rest).toEqual([]);
    expect(fontDeklarationen(css, 'font-weight').filter(w => !w.startsWith('var('))).toEqual([]);
  });
});

describe('Wrapped: die eigene px-Skala (--w-*) wird auch genutzt', () => {
  // Der Rueckblick hat bewusst eigene pixelfeste Tokens (Kopfkommentar in
  // WrappedModal.css). Bestandsaufnahme 25.09.2026: neun Regeln setzten
  // 11/12/17px roh, obwohl --w-marke/--w-label/--w-text genau diese Werte
  // tragen -- zwei Pflegestellen fuer denselben Wert.
  it('kein font-size wiederholt den Wert eines --w-Tokens als rohe Zahl', () => {
    const css = lies('src/components/wrapped/WrappedModal.css');
    const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, '');
    const pxTokens = [...ohneKommentare.matchAll(/(--w-[\w-]+):\s*(\d+px);/g)].map(m => m[2]);
    expect(pxTokens.length).toBeGreaterThanOrEqual(3);
    const funde: string[] = [];
    ohneKommentare.split('\n').forEach((zeile, i) => {
      const m = zeile.match(/^\s*font-size:\s*(\d+px);/);
      if (m && pxTokens.includes(m[1])) funde.push(`${i + 1}: ${zeile.trim()}`);
    });
    expect(funde).toEqual([]);
  });
});
