import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

// Das eigene Stylesheet der Web-Fassungen (theme/web-ansicht.css, 03.10.2026,
// docs/planung/support-web.md, Entscheidung 2). Es gilt nur dort, wo eine
// Seite ihre web-Klassen setzt, und haelt sich an die Regeln der App: nur
// Tokens, keine eigenen Farbwerte (der Dunkelmodus kommt dadurch von selbst),
// keine Bewegung (die Regel fuer reduzierte Bewegung greift nur an
// app-Klassen), keine fremden Ionic-Regeln. Der Test liest die Quelle.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const css = lies('src/theme/web-ansicht.css');
/** Ohne Kommentare: dort duerfen alte Werte und Begriffe stehen. */
const ohneKommentare = (quelle: string) => quelle.replace(/\/\*[\s\S]*?\*\//g, '');
const rein = ohneKommentare(css);

const regeln = (quelle: string): Array<[string, string]> =>
  [...quelle.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);

describe('theme/web-ansicht.css: eigenes Stylesheet der Web-Fassungen', () => {
  it('wird global eingebunden, nach variables.css (dessen Tokens es liest)', () => {
    const app = lies('src/App.tsx');
    expect(app).toContain("import './theme/web-ansicht.css';");
    expect(app.indexOf("import './theme/web-ansicht.css';")).toBeGreaterThan(app.indexOf("import './theme/variables.css';"));
  });

  it('jede Klasse traegt das Praefix web- (einzige Ausnahme: der Punkt der App fuer Ungelesenes)', () => {
    const klassen = new Set([...rein.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
    // Zahlen wie 0.01 oder 1.5 sind keine Klassen: nur Namen mit Buchstaben am Anfang zaehlen.
    const fremd = [...klassen].filter((k) => !k.startsWith('web-') && k !== 'app-ungelesen-punkt');
    expect(fremd).toEqual([]);
    expect(klassen.size).toBeGreaterThan(60);
  });

  it('keine eigenen Farbwerte: weder #hex noch rgb(), rgba(), hsl() -- nur Tokens (der Dunkelmodus kommt von selbst)', () => {
    expect(rein.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
    expect(rein.match(/\b(?:rgb|rgba|hsl|hsla)\(/g) ?? []).toEqual([]);
    // Benannte Farben ausser transparent/currentColor/inherit gibt es auch nicht.
    const benannt = [...rein.matchAll(/(?:^|;|\{)\s*(?:color|background(?:-color)?|border(?:-color)?|fill|stroke)\s*:\s*([a-z]+)\s*[;}]/g)].map((m) => m[1]);
    expect(benannt.filter((n) => !['transparent', 'currentColor', 'inherit', 'none', 'currentcolor'].includes(n))).toEqual([]);
  });

  it('Farben und Schatten stehen als var(--app-…), var(--ion-…) oder var(--web-…)', () => {
    const unerlaubt: string[] = [];
    for (const [, rumpf] of regeln(rein)) {
      for (const m of rumpf.matchAll(/var\((--[\w-]+)/g)) {
        if (!/^--(?:app|ion|web)-/.test(m[1])) unerlaubt.push(m[1]);
      }
    }
    expect(unerlaubt).toEqual([]);
    // Jedes --web-Token, das gelesen wird, ist auch definiert.
    const definiert = new Set([...rein.matchAll(/(--web-[\w-]+)\s*:/g)].map((m) => m[1]));
    const gelesen = new Set([...rein.matchAll(/var\((--web-[\w-]+)/g)].map((m) => m[1]));
    expect([...gelesen].filter((t) => !definiert.has(t))).toEqual([]);
  });

  it('der Dunkelmodus legt nur Aliasse um -- Seitengrund und Hover --, keine Farbwerte', () => {
    const von = rein.indexOf('@media (prefers-color-scheme: dark)');
    expect(von).toBeGreaterThan(-1);
    // Die schliessende Klammer des Blocks steht als einzige in Spalte 0.
    const block = rein.slice(von, rein.indexOf('\n}', von));
    expect(block).toContain('--web-grund');
    expect(block).toContain('--web-hover');
    const werte = [...block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]);
    expect(werte.map(([name]) => name)).toEqual(['--web-grund', '--web-hover']);
    expect(werte.filter(([, wert]) => !/^var\(--(?:app|ion)-[\w-]+\)$/.test(wert))).toEqual([]);
  });

  it('keine Uebergaenge und Animationen -- die Regel fuer reduzierte Bewegung greift nur an app-Klassen', () => {
    expect(rein).not.toMatch(/(?:^|[\s;{])(?:transition|animation)(?:-[a-z]+)?\s*:/);
    expect(rein).not.toContain('@keyframes');
    // Auch im Kommentar kein zweiter Fundort fuer die Zaehlmethode von bewegungsreduktion.test.ts.
    expect(css).not.toContain('prefers-reduced-motion');
  });

  it('greift in keinen Ionic-Baustein ein ausser in den Inhalt der Seite (ion-content.web-inhalt)', () => {
    const ionRegeln = regeln(rein).filter(([selektor]) => /(^|[\s,>+~(])ion-[a-z]/.test(selektor));
    expect(ionRegeln.map(([s]) => s)).toEqual(['ion-content.web-inhalt']);
  });

  it('Schriftgroessen nur als Token; Abstaende, Radien und Schatten ebenso (Breiten und Hoehen duerfen Pixel sein)', () => {
    const zeilen = rein.split('\n');
    const roheSchrift = zeilen.filter((z) => /^\s*font-size\s*:\s*[\d.]+(?:px|rem|em)\b/.test(z));
    expect(roheSchrift).toEqual([]);
    const roheAbstaende = zeilen.filter((z) => /^\s*(?:padding|margin|gap|row-gap|column-gap)(?:-[a-z]+)?\s*:\s*[^;]*(?<![\w(-])[1-9]\d*px/.test(z) && !/var\(/.test(z));
    expect(roheAbstaende).toEqual([]);
    expect(zeilen.filter((z) => /^\s*border-radius\s*:\s*[1-9]\d*px/.test(z))).toEqual([]);
    expect(zeilen.filter((z) => /^\s*box-shadow\s*:\s*[^;]*rgba/.test(z))).toEqual([]);
  });

  it('sichtbarer Fokus an allem Bedienbaren: Links, Knoepfe, Chips, Akkordeons, Suchfeld, Diagrammflaeche, Kacheln', () => {
    const fokus = regeln(rein).filter(([s]) => s.includes(':focus-visible')).map(([s]) => s).join('\n');
    for (const klasse of ['.web-link', '.web-knopf', '.web-chip', '.web-akkordeon__kopf', '.web-suche__eingabe', '.web-diagramm__flaeche', 'a.web-kachel']) {
      expect(fokus, klasse).toContain(`${klasse}:focus-visible`);
    }
  });
});

describe('Bausteine der Web-Fassung: Ionic nur, wo es Arbeit leistet', () => {
  const alle = (ordner: string): string[] =>
    readdirSync(ordner).flatMap((n) => {
      const p = join(ordner, n);
      return statSync(p).isDirectory() ? alle(p) : p.endsWith('.tsx') || p.endsWith('.ts') ? [p] : [];
    });
  const dateien = alle(resolve(process.cwd(), 'src/components/support/web'));

  it('keine IonList, IonItem, IonCard, IonListHeader in den Web-Varianten', () => {
    expect(dateien.length).toBeGreaterThan(15);
    const funde: string[] = [];
    for (const d of dateien) {
      const text = readFileSync(d, 'utf8');
      for (const m of text.matchAll(/<(IonList|IonItem|IonCard|IonCardContent|IonListHeader|IonLabel|IonSegment|IonRefresher)\b/g)) funde.push(`${d}: ${m[1]}`);
    }
    expect(funde).toEqual([]);
  });

  it('Links sind echte <a href> mit dem Router-Muster der Leiste (useIonRouter, kein onClick auf Nicht-Links)', () => {
    const link = readFileSync(resolve(process.cwd(), 'src/components/support/web/WebLink.tsx'), 'utf8');
    expect(link).toContain('<a href={href}');
    expect(link).toContain('useIonRouter');
    expect(link).toContain("router.push(href, 'none', 'push')");
    expect(link).toMatch(/ereignis\.button !== 0 \|\| ereignis\.metaKey \|\| ereignis\.ctrlKey/);
  });
});
