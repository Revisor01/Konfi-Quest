import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-12: prefers-reduced-motion nur in Wrapped
// (drei Bloecke) und am „Was ist neu"-Banner. Login-Schuetteln, Ladepunkte,
// Abzeichen-Puls, Karten-Uebergaenge, Ionic-Seitenwechsel und der Wisch der
// Einfuehrung liefen bei „Bewegung reduzieren" unveraendert.
//
// Seitdem: EIN globaler Block in theme/barrierefreiheit.css stellt alle
// Klassen mit unserem Praefix app- und alle Inline-Animationen still;
// App.tsx schaltet Ionics Web Animations ab, OnboardingTour den Swiper-Wisch
// (beides ueber utils/bewegung.ts). Wrapped behaelt seine eigenen, bewusst
// gestalteten Regeln -- der globale Block darf sie nicht ueberdecken.
//
// Zaehlmethode wie im Bericht: grep prefers-reduced-motion ueber src (ohne
// Tests). Beobachtet: 4 Stellen in 2 Dateien. Ziel: dazu barrierefreiheit.css.
// ---------------------------------------------------------------------------

const wurzel = resolve(process.cwd(), 'src');
const lies = (pfad: string) => readFileSync(join(wurzel, pfad), 'utf8');

const alleDateien = (ordner: string, endungen: string[]): string[] =>
  readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) return name === '__tests__' ? [] : alleDateien(pfad, endungen);
    return endungen.some((e) => pfad.endsWith(e)) ? [pfad] : [];
  });

/** Innerste Regelbloecke einer CSS-Datei: [Selektor(en), Deklarationen]. */
const regeln = (css: string): Array<[string, string]> =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);

describe('Bewegung reduzieren gilt fuer die ganze App (UI BF-12)', () => {
  const css = lies('theme/barrierefreiheit.css');

  it('der globale Block: app-Klassen samt Pseudo-Elementen und Inline-Animationen, Dauer 0,01 ms mit !important', () => {
    // Inhalt des @media-Blocks einschliesslich der schliessenden Klammer der inneren Regel.
    const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?\})\s*\}/);
    expect(block).not.toBeNull();
    const innere = regeln(block![1]);
    expect(innere.length).toBe(1);
    const [selektoren, deklarationen] = innere[0];
    for (const s of ['[class*="app-"]', '[class*="app-"]::before', '[class*="app-"]::after', '[style*="animation"]', '[style*="transition"]']) {
      expect(selektoren.split(',').map((t) => t.trim())).toContain(s);
    }
    expect(deklarationen).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
    expect(deklarationen).toMatch(/animation-iteration-count:\s*1\s*!important/);
    expect(deklarationen).toMatch(/transition-duration:\s*0\.01ms\s*!important/);
  });

  it('jede Animation und jeder Uebergang im Theme haengt an einer app-Klasse (sonst greift der Block nicht)', () => {
    const themeDateien = alleDateien(join(wurzel, 'theme'), ['.css']);
    expect(themeDateien.length).toBeGreaterThanOrEqual(3);
    const ungedeckt: string[] = [];
    for (const datei of themeDateien) {
      for (const [selektor, deklarationen] of regeln(readFileSync(datei, 'utf8'))) {
        if (!/(?:^|[\s;])(?:animation|transition)\s*:/.test(deklarationen)) continue;
        if (selektor.startsWith('@keyframes') || /^\d+%|^from$|^to$/.test(selektor)) continue;
        if (!selektor.includes('app-')) ungedeckt.push(`${relative(wurzel, datei)}: ${selektor}`);
      }
    }
    expect(ungedeckt).toEqual([]);
  });

  it('Inline-Animationen der Komponenten stehen im style-Attribut -- die Ladepunkte als Beispiel', () => {
    expect(lies('components/common/LoadingSpinner.tsx')).toMatch(/animation:\s*`pulse/);
  });

  it('Wrapped bleibt aussen vor: keine app-Klasse an seinen Animationen, keine Inline-Animation, eigene Regeln erhalten', () => {
    const wrappedTsx = alleDateien(join(wurzel, 'components/wrapped'), ['.tsx']).map((d) => readFileSync(d, 'utf8')).join('\n');
    expect(wrappedTsx).not.toMatch(/className=[^\n]*wrapped-anim[^\n]*app-|className=[^\n]*app-[^\n]*wrapped-anim/);
    expect(wrappedTsx.match(/^\s*(?:animation|transition):/gm) ?? []).toEqual([]);
    const wrappedCss = lies('components/wrapped/WrappedModal.css');
    expect((wrappedCss.match(/@media \(prefers-reduced-motion: reduce\)/g) ?? []).length).toBe(3);
  });

  it('Ionic-Uebergaenge und Onboarding-Wisch folgen derselben Einstellung', () => {
    expect(lies('App.tsx')).toMatch(/setupIonicReact\(\{[\s\S]*?animated:\s*!bewegungReduziert\(\)/);
    expect(lies('components/shared/OnboardingTour.tsx')).toContain('speed={bewegungReduziert() ? 0 : 300}');
  });

  it('Zaehlmethode des Berichts: prefers-reduced-motion steht jetzt auch im globalen Theme', () => {
    const treffer = alleDateien(wurzel, ['.css', '.ts', '.tsx'])
      .filter((d) => readFileSync(d, 'utf8').includes('prefers-reduced-motion'))
      .map((d) => relative(wurzel, d))
      .sort();
    expect(treffer).toEqual(['components/wrapped/WrappedModal.css', 'theme/barrierefreiheit.css', 'theme/variables.css', 'utils/bewegung.ts']);
  });
});
