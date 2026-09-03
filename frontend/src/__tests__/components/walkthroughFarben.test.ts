import { describe, it, expect } from 'vitest';
import { SLIDES as admin211 } from '../../components/admin/modals/AdminUpdate211WalkthroughModal';
import { SLIDES as teamer211 } from '../../components/teamer/modals/TeamerUpdate211WalkthroughModal';
import { SLIDES as konfi211 } from '../../components/konfi/modals/KonfiUpdate211WalkthroughModal';

// Simons Farbordnung (03.09.2026): Jede Folie traegt die Farbe des Bereichs,
// von dem sie handelt -- nicht irgendeine.
//   Material            -> orange  (--app-color-material)
//   Rollen/Jahrgaenge    -> blau    (--app-color-jahrgang)
//   Jahresrueckblick     -> lila    (--app-color-wrapped)
//   Challenges           -> pink    (--app-color-challenges)
// Vorher lagen Material auf activities (gruen) und der Rueckblick auf
// challenges (pink) -- beides gehoerte anderen Bereichen.

type Slide = { title: string; text: string; color: string; rgb: string };

const ALLE: [string, Slide[]][] = [
  ['Leitung', admin211 as Slide[]],
  ['Team', teamer211 as Slide[]],
  ['Konfi', konfi211 as Slide[]],
];

// Welche Farbe gehoert zu einer Folie, erkannt am Titel.
const ERWARTET: Array<{ stichwort: RegExp; farbe: string }> = [
  { stichwort: /Material/i, farbe: 'material' },
  { stichwort: /Rollen und Jahrgänge/i, farbe: 'jahrgang' },
  { stichwort: /Rückblick|Fotos/i, farbe: 'wrapped' },
  { stichwort: /Challenges/i, farbe: 'challenges' },
];

describe('Walkthrough 2.1.1: Folienfarben folgen dem Bereich', () => {
  for (const [rolle, slides] of ALLE) {
    for (const regel of ERWARTET) {
      const treffer = slides.filter(s => regel.stichwort.test(s.title));
      for (const slide of treffer) {
        it(`${rolle}: "${slide.title}" ist ${regel.farbe}`, () => {
          expect(slide.color).toBe(`var(--app-color-${regel.farbe})`);
          expect(slide.rgb).toBe(`--app-color-${regel.farbe}-rgb`);
        });
      }
    }
  }

  it.each(ALLE)('%s: color und rgb passen immer zusammen', (_rolle, slides) => {
    // Sonst faerbt der Verlauf anders als das Icon -- faellt beim Lesen
    // nicht auf, sieht aber falsch aus.
    for (const s of slides) {
      const name = s.color.replace('var(--app-color-', '').replace(')', '');
      expect(s.rgb).toBe(`--app-color-${name}-rgb`);
    }
  });
});

describe('Walkthrough 2.1.1: Challenges werden noch einmal erklaert', () => {
  it.each(ALLE)('%s hat eine Folie, die sagt was Challenges sind', (_rolle, slides) => {
    // Simons Wunsch 03.09.2026: "Das sollten wir schon noch mal erwaehnen,
    // was das eigentlich sein soll" -- uebernommen aus dem 2.0er-Walkthrough.
    const folie = slides.find(s => /Challenges/i.test(s.title));
    expect(folie).toBeDefined();
    expect(folie!.text).toMatch(/keine Punkte|ohne Punkte/);
    expect(folie!.text).toMatch(/Stempel/);
  });

  it.each(ALLE)('%s stellt die Challenges-Folie an den Anfang', (_rolle, slides) => {
    expect(/Challenges/i.test(slides[0].title)).toBe(true);
  });
});
