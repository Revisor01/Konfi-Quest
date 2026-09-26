import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Audit 26.09.2026, UI BF-05 / Koordination K-04: index.html stand auf
// lang="en". Die Sprachangabe steuert Vorlesestimme, Silbentrennung und
// Rechtschreibpruefung -- VoiceOver und TalkBack lasen eine deutsche App mit
// englischer Stimme (WCAG 3.1.1). Zur Laufzeit setzt die App die Sprache
// nirgends, die Angabe in index.html ist also die einzige Quelle.
//
// index.html wird nicht gerendert, sondern von Vite als Huelle ausgeliefert;
// die Datei zu lesen IST hier die Pruefung der ausgelieferten Oberflaeche.

describe('Sprache der App', () => {
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

  it('index.html gibt Deutsch an', () => {
    expect(html).toMatch(/<html\s+lang="de"\s*>/);
    expect(html).not.toContain('lang="en"');
  });
});
