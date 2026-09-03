import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Jede Seite hat FÜNF unterschiedliche Sprüche.
 *
 * SIMONS VORGABE (03.09.2026): "Die Sprüche brauchen Unterschiede. Immer mal
 * aufgetaucht bei weniger als 5, bei mehr als 10 das. Also pro Seite 5
 * Optionen."
 *
 * WARUM DAS EIN TEST IST: Beim ersten Anlauf hatte ich bei `datum:erntedank`
 * versehentlich denselben Spruch zweimal eingetragen — eine Person mit einem
 * Termin und eine mit zwölf hätten dort dasselbe gelesen. Das fällt beim
 * Lesen nicht auf, weil die Liste lang ist, und in der App auch nicht: Man
 * sieht ja immer nur die eigene Stufe.
 */

const quelle = readFileSync(
  resolve(process.cwd(), 'src/components/wrapped/slides/KategorieSeiteSlide.tsx'),
  'utf8'
);

// Jede Seite mit ihren fünf Stufen aus dem Quelltext lesen.
const seiten = [...quelle.matchAll(/'([\w:-]+)':\s*\{\s*auge:\s*'([^']+)',\s*stufen:\s*\[([\s\S]*?)\]/g)]
  .map(([, key, auge, roh]) => ({
    key,
    auge,
    stufen: [...roh.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => m[1]),
  }));

describe('Sprüche der Rückblick-Seiten', () => {
  it('es werden überhaupt Seiten gefunden', () => {
    // Schutz vor einem stillen Fehlschlag: Ändert sich die Schreibweise,
    // liefe die Regex ins Leere und alle Tests wären grün ohne zu prüfen.
    expect(seiten.length).toBeGreaterThanOrEqual(19);
  });

  it.each(seiten.map(s => [s.key, s] as const))('%s hat genau 5 Stufen', (_key, seite) => {
    expect(seite.stufen).toHaveLength(5);
  });

  it.each(seiten.map(s => [s.key, s] as const))('%s hat 5 VERSCHIEDENE Sprüche', (_key, seite) => {
    const einzigartig = new Set(seite.stufen);
    expect(einzigartig.size, `doppelter Spruch: ${[...einzigartig].join(' / ')}`).toBe(5);
  });

  it.each(seiten.map(s => [s.key, s] as const))('%s: kein Spruch ist leer', (_key, seite) => {
    for (const spruch of seite.stufen) {
      expect(spruch.trim().length).toBeGreaterThan(3);
    }
  });

  it('kein Spruch enthält eine Negativ-Aussage', () => {
    // Simons Regel, die über allem steht: keine Fehlzeiten, kein Absagen,
    // kein Vergleich nach unten.
    const verboten = /abgesagt|verpasst|leider|nur wenig|zu selten|nicht geschafft|schade/i;
    for (const seite of seiten) {
      for (const spruch of seite.stufen) {
        expect(verboten.test(spruch), `${seite.key}: "${spruch}"`).toBe(false);
      }
    }
  });
});
