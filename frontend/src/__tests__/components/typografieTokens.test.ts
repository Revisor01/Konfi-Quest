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
// Skala nicht still wieder auseinanderlaeuft. In diesem Projekt ist beim
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

// Die Skala, wie sie in theme/typografie.css stehen muss. Die Werte bilden
// den gemessenen Bestand vor der Konsolidierung ab — wer hier etwas aendert,
// aendert die Schrift der ganzen App und sollte das absichtlich tun.
const SKALA: Record<string, string> = {
  '--app-text-winzig': '0.6rem',
  '--app-text-mini': '0.65rem',
  '--app-text-meta': '0.7rem',
  '--app-text-klein': '0.75rem',
  '--app-text-hinweis': '0.8rem',
  '--app-text-sekundaer': '0.85rem',
  '--app-text-basis': '0.9rem',
  '--app-text-betont': '0.95rem',
  '--app-text-standard': '1rem',
  '--app-text-gross': '1.1rem',
  '--app-text-untertitel': '1.2rem',
  '--app-text-titel': '1.3rem',
  '--app-text-titel-gross': '1.4rem',
  '--app-text-ueberschrift': '1.5rem',
  '--app-text-ueberschrift-gross': '1.6rem',
  // Von 11 auf 7 Stufen am 05.09.2026: klein/mittel/wasserzeichen/symbol
  // lagen 0,1-0,3rem neben einer anderen Stufe und wurden 0-3 Mal genutzt.
  '--app-anzeige-basis': '1.8rem',
  '--app-anzeige-zahl': '2rem',
  '--app-anzeige-gross': '2.5rem',
  '--app-anzeige-riesig': '3rem',
  '--app-anzeige-hero': '3.5rem',
  '--app-anzeige-maximal': '4rem',
  '--app-anzeige-marke': '5.8rem',
  '--app-icon-inline': '0.9em',
  '--app-text-hinweispunkt': '10px',
  '--app-icon-chat-senden': '15px',
  '--app-icon-accordion': '18px',
  '--app-icon-chat-anhang': '22px',
  '--app-icon-leerzustand': '64px',
  '--app-schrift-normal': '400',
  '--app-schrift-mittel': '500',
  '--app-schrift-halbfett': '600',
  '--app-schrift-fett': '700',
  '--app-schrift-extrafett': '800',
  '--app-schrift-schwer': '900',
};

describe('Typografie-Skala', () => {
  const css = lies('src/theme/typografie.css');

  it('definiert jede Stufe mit exakt dem vermessenen Wert', () => {
    for (const [token, wert] of Object.entries(SKALA)) {
      const treffer = css.match(new RegExp(`${token}: *([^;]+);`));
      expect(treffer, `${token} fehlt in typografie.css`).not.toBeNull();
      expect(treffer![1].trim(), token).toBe(wert);
    }
  });

  it('definiert keine Stufen an der Skala vorbei', () => {
    // Wer eine neue Stufe braucht, traegt sie oben in SKALA ein — sonst
    // waechst die Datei still an der Inventur vorbei.
    const definiert = [...css.matchAll(/(--app-[\w-]+):/g)].map(m => m[1]);
    expect(definiert.sort()).toEqual(Object.keys(SKALA).sort());
  });

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

  it('der "!"-Hinweispunkt ist bei Konfi und Teamer dasselbe Token', () => {
    // Beide Dashboards zeichnen denselben Benachrichtigungspunkt; vor der
    // Konsolidierung stand die 10px-Groesse viermal einzeln im Code.
    expect(lies('src/components/konfi/views/DashboardView.tsx')).toContain('var(--app-text-hinweispunkt)');
    expect(lies('src/components/teamer/pages/TeamerDashboardPage.tsx')).toContain('var(--app-text-hinweispunkt)');
  });
});

describe('Auch die Stylesheets haengen an der Skala', () => {
  const fontDeklarationen = (css: string, eigenschaft: string): string[] =>
    [...css.matchAll(new RegExp(`(?<![\\w-])${eigenschaft}: *([^;]+);`, 'g'))].map(m => m[1].trim());

  it('variables.css setzt keine festen Schriftwerte mehr', () => {
    const css = lies('src/theme/variables.css');
    // clamp() bleibt erlaubt: responsive Groessen sind keine Skala-Stufen.
    const groessen = fontDeklarationen(css, 'font-size').filter(w => !w.startsWith('var(') && !w.startsWith('clamp('));
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
