import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

// Konsolidierung 05.09.2026: Abstaende, Eckradien und Schatten leben in
// theme/abstaende.css statt als ~700 verstreute Inline-px-Werte.
// Diese Tests lesen die Quellen und pruefen die Verdrahtung:
//  (a) die Skalen sind vollstaendig und tragen exakt die gemessenen Werte,
//  (b) keine Komponente setzt mehr rohe px-Abstaende oder -Radien inline,
//  (c) alle drei Rollen (admin, teamer, konfi) haengen an denselben Tokens.
// Kommentare werden vor der Pruefung entfernt — dort duerfen alte Werte
// genannt werden, ohne dass der Test anschlaegt.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

/** Alle .tsx unterhalb eines Verzeichnisses, rekursiv. */
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

function ohneKommentare(quelle: string): string {
  // Blockkommentare behalten ihre Zeilenumbrueche, damit die gemeldeten
  // Zeilennummern der CSS-Pruefungen stimmen (vorher um Hunderte verschoben).
  return quelle
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/^\s*\/\/.*$/gm, '');
}

// Bewusste Ausnahmen (jeweils im Code kommentiert):
// - ShareCard: versteckter 1080x1920-Renderer fuer den Bild-Export, eigener
//   Massstab — App-Rhythmus-Tokens waeren dort semantisch falsch.
// - WerdeTeamerSlide: 22px Wrapped-Feinjustierung ausserhalb der Skala.
// - WeiterSoSlide: dasselbe Mass. Sie steht an DERSELBEN Stelle der
//   Dramaturgie (der Blick nach vorn) und muss deshalb denselben Abstand
//   halten -- ein anderer Wert waere an genau dieser Stelle sichtbar.
const AUSGENOMMENE_DATEIEN = ['ShareCard.tsx'];
const AUSGENOMMENE_FUNDE = [
  { datei: 'WerdeTeamerSlide.tsx', fund: 'marginTop: 22' },
  { datei: 'WeiterSoSlide.tsx', fund: 'marginTop: 22' },
];

const ABSTAND_PROPS =
  '(?:padding(?:Top|Bottom|Left|Right)?|margin(?:Top|Bottom|Left|Right)?|gap|rowGap|columnGap|borderRadius)';

// Ionic-Teilvariablen, die Komponenten per style={{ '--padding-start': ... }}
// setzen. Bis 25.09.2026 schloss der Lookbehind (?<![-'"\w]) sie aus, weil vor
// dem Namen ein Anfuehrungszeichen steht -- so wuchsen 61 rohe px-Werte
// ungeprueft heran. Der Name wird MIT Anfuehrungszeichen gematcht, damit der
// Lookbehind fuer die React-Props unveraendert bleibt.
const IONIC_TEILVARIABLEN =
  "'--(?:padding|margin|inner-padding)-(?:start|end|top|bottom)'|'--border-radius'";

/** Reine px-Wertliteral-Grammatik: nur px-Zahlen, 0, auto, Prozente. */
const ROHWERT = /^(?:\d+px|0|auto|\d+%)(?: (?:\d+px|0|auto|\d+%))*$/;

/** Findet rohe px-Abstaende/-Radien in einer Quelldatei (ohne Kommentare). */
function roheFunde(quelle: string): string[] {
  const funde: string[] = [];
  const rein = ohneKommentare(quelle);
  // Zeichenketten-Werte, auch in Ternaries: prop: cond ? '16px' : '12px'
  const proAusdruck = new RegExp(
    `(?<![-'"\\w])(${ABSTAND_PROPS}|${IONIC_TEILVARIABLEN})\\s*:\\s*([^,}\\n]+)`,
    'g'
  );
  for (const [, prop, ausdruck] of rein.matchAll(proAusdruck)) {
    for (const [, literal] of ausdruck.matchAll(/'([^']*)'/g)) {
      if (ROHWERT.test(literal) && literal.includes('px')) {
        funde.push(`${prop.replace(/'/g, '')}: '${literal}'`);
      }
    }
  }
  // Numerische Werte (React deutet Zahlen als px); nacktes margin:/padding:
  // bleibt aussen vor, weil Zahlen dort auch Bibliotheks-Optionen sein
  // koennen (QR-Code-Konfiguration).
  const numerisch = new RegExp(
    '(?<![-\'"\\w])(padding(?:Top|Bottom|Left|Right)|margin(?:Top|Bottom|Left|Right)|gap|rowGap|columnGap|borderRadius)\\s*:\\s*([1-9]\\d*)\\s*[,}\\n]',
    'g'
  );
  for (const [, prop, zahl] of rein.matchAll(numerisch)) funde.push(`${prop}: ${zahl}`);
  return funde;
}

describe('Design-Tokens: Abstaende, Radien, Schatten (05.09.2026)', () => {
  const tokensCss = lies('src/theme/abstaende.css');

  it('definiert die Abstands-Skala vollstaendig und mit den gemessenen Werten', () => {
    const erwartet: Record<string, string> = {
      '--app-abstand-haar': '1px',
      '--app-abstand-winzig': '2px',
      '--app-abstand-mini': '4px',
      '--app-abstand-kompakt': '6px',
      '--app-abstand-eng': '8px',
      '--app-abstand-schmal': '10px',
      '--app-abstand-mittel': '12px',
      '--app-abstand-mittelweit': '14px',
      '--app-abstand-basis': '16px',
      '--app-abstand-gross': '20px',
      '--app-abstand-weit': '24px',
      '--app-abstand-sehrweit': '28px',
      '--app-abstand-extraweit': '32px',
      '--app-abstand-riesig': '40px',
      '--app-abstand-block': '48px',
    };
    for (const [token, wert] of Object.entries(erwartet)) {
      expect(tokensCss).toContain(`${token}: ${wert};`);
    }
  });

  it('definiert Freiraum-, Radius- und Schatten-Tokens vollstaendig', () => {
    const erwartet: Record<string, string> = {
      '--app-freiraum-aktion-xxs': '34px',
      '--app-freiraum-aktion-xs': '36px',
      '--app-freiraum-aktion-s': '50px',
      '--app-freiraum-aktion-m': '60px',
      '--app-freiraum-aktion-l': '70px',
      '--app-freiraum-aktion-xl': '80px',
      '--app-freiraum-aktion-xxl': '100px',
      '--app-freiraum-aktion-xxl-plus': '110px',
      '--app-freiraum-aktion-xxxl': '120px',
      // kopf-s (50px) und kopf-xxl (90px) entfielen am 05.09.2026 mit dem
      // Angleichen der Rollen-Unterschiede -- niemand nutzte sie mehr.
      '--app-freiraum-kopf-m': '60px',
      '--app-freiraum-kopf-l': '70px',
      '--app-freiraum-kopf-xl': '80px',
      '--app-freiraum-fuss': '56px',
      // Von 15 auf 9 Stufen am 05.09.2026: haarfein/schmal/blase/
      // extragross/kachel/kachel-gross waren Einzelgaenger mit 0-3
      // Nutzungen und wurden auf die Nachbarstufe gezogen (max. 4px).
      '--app-radius-fein': '4px',
      '--app-radius-klein': '8px',
      '--app-radius-knopf': '10px',
      '--app-radius-karte': '12px',
      '--app-radius-weich': '14px',
      '--app-radius-gross': '16px',
      '--app-radius-modal': '24px',
      '--app-radius-kreis': '50%',
      '--app-radius-band': '0 10px 0 10px',
      '--app-schatten-fein': '0 1px 4px rgba(0, 0, 0, 0.06)',
      '--app-schatten-flach': '0 1px 3px rgba(0, 0, 0, 0.1)',
      '--app-schatten-flach-stark': '0 1px 3px rgba(0, 0, 0, 0.2)',
      '--app-schatten-hauch': '0 2px 8px rgba(0, 0, 0, 0.05)',
      '--app-schatten-karte': '0 2px 8px rgba(0, 0, 0, 0.1)',
      '--app-schatten-karte-stark': '0 2px 8px rgba(0, 0, 0, 0.15)',
      '--app-schatten-schwebend': '0 4px 12px rgba(0, 0, 0, 0.1)',
      '--app-schatten-schwebend-weich': '0 4px 16px rgba(0, 0, 0, 0.1)',
      '--app-schatten-schwebend-stark': '0 4px 16px rgba(0, 0, 0, 0.15)',
      '--app-schatten-hoch': '0 8px 24px rgba(0, 0, 0, 0.12)',
      '--app-schatten-modal': '0 10px 28px rgba(0, 0, 0, 0.18)',
      '--app-schatten-punkt-erfolg': '0 2px 6px rgba(16, 185, 129, 0.5)',
      '--app-schatten-glow-challenges': '0 4px 12px rgba(var(--app-color-challenges-rgb), 0.35)',
    };
    for (const [token, wert] of Object.entries(erwartet)) {
      expect(tokensCss).toContain(`${token}: ${wert};`);
    }
  });

  it('bindet die Token-Datei in variables.css ein', () => {
    expect(lies('src/theme/variables.css')).toContain("@import './abstaende.css';");
  });

  it('keine Komponente setzt rohe px-Abstaende oder -Radien inline (auch nicht in Ionic-Teilvariablen)', () => {
    const verstoesse: string[] = [];
    for (const datei of dateienUnter('src/components')) {
      if (AUSGENOMMENE_DATEIEN.some((a) => datei.endsWith(a))) continue;
      for (const fund of roheFunde(lies(datei))) {
        const ausgenommen = AUSGENOMMENE_FUNDE.some(
          (a) => datei.endsWith(a.datei) && fund === a.fund
        );
        if (!ausgenommen) verstoesse.push(`${datei}: ${fund}`);
      }
    }
    expect(verstoesse).toEqual([]);
  });

  // Bis 26.09.2026 pruefte dieser Test nur `boxShadow:` -- die Ionic-Variante
  // `'--box-shadow': '0 4px 16px rgba(0,0,0,0.1)'` (Datumswaehler in vier
  // Modalen, sechs Stellen) blieb unsichtbar, derselbe blinde Fleck wie bei
  // `'--padding-start'`. Seit dem Dunkelmodus zaehlt das doppelt: ein roher
  // Schwarz-Schatten kennt die dunkle Entsprechung des Tokens nicht.
  const SCHATTEN_PROPS = "boxShadow|'--box-shadow'";
  const AUSGENOMMENE_SCHATTEN = [
    // weisser Knopf auf Farbflaeche, gleicher Schatten in beiden Modi; Einzelwert
    { datei: 'OnboardingTour.tsx', fund: "'--box-shadow': '0 6px 18px rgba(0,0,0,0.18)'" },
  ];

  it('neutrale Schwarz-Schatten kommen nur noch als Token vor (boxShadow UND --box-shadow)', () => {
    const verstoesse: string[] = [];
    const muster = new RegExp(`(?<![-'"\\w])(${SCHATTEN_PROPS})\\s*:\\s*'[^']*rgba\\(0,\\s*0,\\s*0[^']*'`, 'g');
    for (const datei of dateienUnter('src/components')) {
      if (AUSGENOMMENE_DATEIEN.some((a) => datei.endsWith(a))) continue;
      const rein = ohneKommentare(lies(datei));
      for (const [fund] of rein.matchAll(muster)) {
        const ausgenommen = AUSGENOMMENE_SCHATTEN.some(
          (a) => datei.endsWith(a.datei) && fund.replace(/\s*:\s*/, ': ') === a.fund
        );
        if (!ausgenommen) verstoesse.push(`${datei}: ${fund.trim()}`);
      }
    }
    expect(verstoesse).toEqual([]);
  });

  it('die Prueffunktion erkennt beide Schreibweisen (Gegenprobe fuer den Test selbst)', () => {
    const muster = new RegExp(`(?<![-'"\\w])(${SCHATTEN_PROPS})\\s*:\\s*'[^']*rgba\\(0,\\s*0,\\s*0[^']*'`, 'g');
    expect([..."{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }".matchAll(muster)]).toHaveLength(1);
    expect([..."{ '--box-shadow': '0 4px 16px rgba(0, 0, 0, 0.1)' }".matchAll(muster)]).toHaveLength(1);
    expect([..."{ '--box-shadow': 'var(--app-schatten-karte)' }".matchAll(muster)]).toHaveLength(0);
    expect([..."{ '--box-shadow': '0 2px 8px rgba(var(--app-color-chat-rgb), 0.35)' }".matchAll(muster)]).toHaveLength(0);
  });

  it('kein Komponenten-CSS (ausser wrapped/) setzt Schwarz-Schatten ohne Token', () => {
    const funde: string[] = [];
    for (const datei of dateienUnter('src/components', '.css').filter((d) => !d.includes('/wrapped/'))) {
      ohneKommentare(lies(datei)).split('\n').forEach((zeile, i) => {
        if (/^\s*(?:--)?box-shadow:.*rgba\(0,\s*0,\s*0/.test(zeile)) funde.push(`${datei}:${i + 1}: ${zeile.trim()}`);
      });
    }
    expect(funde).toEqual([]);
  });

  it('jeder neutrale Schatten hat im Dunkelblock dieselbe Geometrie mit hoeherer Deckkraft', () => {
    // Im Dunkeln verschwindet ein Schatten mit 10 % Schwarz auf #1c1c1e. Die
    // dunkle Entsprechung darf nur die Deckkraft anheben -- ein anderer Versatz
    // oder eine andere Weichzeichnung waere eine Layout-Aenderung durch die
    // Hintertuer.
    const variablesCss = ohneKommentare(lies('src/theme/variables.css'));
    const dunkelBlock = variablesCss.match(/@media \(prefers-color-scheme: dark\) \{([\s\S]*?)\n\}\n/)?.[1] ?? '';
    const zerlege = (wert: string) => {
      const m = wert.match(/^(\d+ \d+px \d+px) rgba\(0, 0, 0, (0?\.\d+)\)$/);
      return m ? { geometrie: m[1], alpha: Number(m[2]) } : null;
    };
    const hell = [...ohneKommentare(tokensCss).matchAll(/(--app-schatten-[a-z-]+):\s*([^;]+);/g)]
      .map(([, name, wert]) => ({ name, wert: wert.trim() }))
      .filter(({ wert }) => zerlege(wert));
    expect(hell.length).toBe(11);
    const abweichungen: string[] = [];
    for (const { name, wert } of hell) {
      const dunkel = dunkelBlock.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
      if (!dunkel) { abweichungen.push(`${name}: fehlt im Dunkelblock`); continue; }
      const h = zerlege(wert)!, d = zerlege(dunkel);
      if (!d) { abweichungen.push(`${name}: dunkler Wert ${dunkel} ist kein Schwarz-Schatten`); continue; }
      if (d.geometrie !== h.geometrie) abweichungen.push(`${name}: Geometrie ${d.geometrie} != ${h.geometrie}`);
      if (!(d.alpha > h.alpha)) abweichungen.push(`${name}: Deckkraft ${d.alpha} nicht groesser als ${h.alpha}`);
      if (d.alpha > 0.6) abweichungen.push(`${name}: Deckkraft ${d.alpha} ueber dem Deckel 0.6`);
    }
    expect(abweichungen).toEqual([]);
  });

  it('alle drei Rollen nutzen dieselben Kern-Tokens', () => {
    const kernTokens = [
      'var(--app-abstand-eng)',
      'var(--app-abstand-mittel)',
      'var(--app-abstand-basis)',
      'var(--app-radius-karte)',
    ];
    for (const rolle of ['admin', 'teamer', 'konfi']) {
      const quelle = dateienUnter(`src/components/${rolle}`)
        .map(lies)
        .join('\n');
      for (const token of kernTokens) {
        expect(quelle, `${rolle} nutzt ${token} nicht`).toContain(token);
      }
    }
  });

  it('jedes verwendete Token ist definiert und jedes definierte wird verwendet', () => {
    const definiert = new Set(
      [...tokensCss.matchAll(/(--app-(?:abstand|radius|schatten|freiraum)-[a-z-]+):/g)].map((m) => m[1])
    );
    const verwendet = new Set<string>();
    const quellen = [
      ...dateienUnter('src/components'),
      ...dateienUnter('src/components', '.css'),
      'src/theme/variables.css',
    ];
    for (const datei of quellen) {
      for (const [, token] of lies(datei).matchAll(
        /var\((--app-(?:abstand|radius|schatten|freiraum)-[a-z-]+)\)/g
      )) {
        verwendet.add(token);
      }
    }
    expect([...verwendet].filter((t) => !definiert.has(t)).sort()).toEqual([]);
    expect([...definiert].filter((t) => !verwendet.has(t)).sort()).toEqual([]);
  });
});

describe('Komponenten-Stylesheets haengen an der Abstands-Skala', () => {
  // 25.09.2026: In variables.css standen zwoelf Ionic-Teilvariablen mit rohen
  // px-Werten (--padding-start: 10px, --border-radius: 12px, ...). Die
  // Pruefung oben greift nur fuer padding/margin/gap als Eigenschaft, nicht
  // fuer die gleichnamigen Ionic-Variablen -- deshalb hier eigens.
  it('Ionic-Teilvariablen in variables.css und Komponenten-CSS tragen Tokens statt px', () => {
    const dateien = [
      'src/theme/variables.css',
      ...dateienUnter('src/components', '.css').filter(d => !d.includes('/wrapped/')),
    ];
    const funde: string[] = [];
    for (const datei of dateien) {
      const zeilen = ohneKommentare(lies(datei)).split('\n');
      zeilen.forEach((zeile, i) => {
        const m = zeile.match(
          /^\s*(--(?:padding|margin|inner-padding)-(?:start|end|top|bottom)|--border-radius):\s*(.+);/
        );
        if (!m) return;
        const ohneVar = m[2].replace(/var\([^)]*\)/g, '');
        if (/(?<![\d.])[1-9]\d*px/.test(ohneVar)) funde.push(`${datei}:${i + 1}: ${zeile.trim()}`);
      });
    }
    expect(funde).toEqual([]);
  });


  // Bestandsaufnahme 25.09.2026: In den .css-Dateien unter components/ stand
  // genau ein roher px-Abstand ausserhalb des Wrapped (FileViewerModal:
  // "+ 12px" in einem calc). Der Wrapped bleibt aussen vor -- seine
  // Story-Folien sind ein pixelfestes Layout mit eigenen Tokens (--w-*),
  // die ShareCard ein 1080x1920-Renderer mit eigenem Massstab.
  it('kein Komponenten-CSS (ausser wrapped/) setzt px-Abstaende ohne Token', () => {
    const dateien = dateienUnter('src/components', '.css').filter(d => !d.includes('/wrapped/'));
    const funde: string[] = [];
    for (const datei of dateien) {
      const zeilen = ohneKommentare(lies(datei)).split('\n');
      zeilen.forEach((zeile, i) => {
        const m = zeile.match(/^\s*(padding|margin|gap|row-gap|column-gap)(-[a-z]+)?:\s*(.+);/);
        if (!m) return;
        // px ausserhalb von var(...) -- auch innerhalb von calc(); "0px" als
        // env()-Rueckfall ist kein Abstand und bleibt erlaubt
        const ohneVar = m[3].replace(/var\([^)]*\)/g, '');
        if (/(?<![\d.])[1-9]\d*px/.test(ohneVar)) funde.push(`${datei}:${i + 1}: ${zeile.trim()}`);
      });
    }
    expect(funde).toEqual([]);
  });
});
