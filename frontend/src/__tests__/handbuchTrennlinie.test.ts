// Handbuch: "---" im Rumpf eines Kapitels ist eine Trennlinie, kein Text.
// Befund 27.09.2026 (Handbuch-Navigation, Nebenbefund): Der Generator kannte
// keine Trennlinie, "---" erschien als sichtbarer Absatz -- gezaehlt 24 Mal
// (Abzeichen 2, Challenges 10, Chat 12). Geprueft wird das ERZEUGTE HTML
// unter public/docs; dass es zum Generator passt, prueft die CI getrennt.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';

const quellen = readdirSync(resolve(process.cwd(), '../docs/handbuch'))
  .filter((d) => d.endsWith('.md'))
  .sort();

/** "---"-Zeilen im Rumpf (ohne Frontmatter, ohne Codebloecke). */
const trennlinienDerQuelle = (quelle: string) => {
  const text = readFileSync(resolve(process.cwd(), '../docs/handbuch', quelle), 'utf8');
  const rumpf = text.replace(/^---\n[\s\S]*?\n---\n/, '');
  let imCode = false;
  let n = 0;
  for (const zeile of rumpf.split('\n')) {
    if (zeile.trim().startsWith('```')) { imCode = !imCode; continue; }
    if (!imCode && /^-{3,}\s*$/.test(zeile.trim())) n++;
  }
  return n;
};

const seiteZu = (quelle: string) => `${quelle.replace(/^\d+-/, '').replace(/\.md$/, '')}.html`;
const html = (seite: string) => readFileSync(resolve(process.cwd(), 'public/docs', seite), 'utf8');

describe('Handbuch: Trennlinien', () => {
  it('kein Kapitel zeigt "---" als Text', () => {
    const mitText = quellen.filter((q) => /<p>-{3,}<\/p>/.test(html(seiteZu(q))));
    expect(mitText).toEqual([]);
  });

  it.each(quellen)('%s: jede Trennlinie der Quelle wird zu genau einem <hr>', (quelle) => {
    const erwartet = trennlinienDerQuelle(quelle);
    const hr = (html(seiteZu(quelle)).match(/<hr\b/g) ?? []).length;
    expect(hr).toBe(erwartet);
  });

  it('die Zählung trifft die Kapitel mit Trennlinien (Stand 27.09.2026)', () => {
    // 11 seit 02.10.2026: der Abschnitt „Eine Challenge öffnen" (2.4.0)
    // steht wie jeder h2 des Kapitels hinter einer eigenen Trennlinie.
    expect(trennlinienDerQuelle('80-challenges.md')).toBe(11);
    // 13 seit 28.09.2026: der Abschnitt „Im Verlauf zurückblättern" steht wie
    // jeder h2 des Kapitels hinter einer eigenen Trennlinie.
    // 14 seit 03.10.2026: der Abschnitt „Im Browser Liste und Chat nebeneinander
    // nutzen" steht ebenso hinter einer eigenen Trennlinie.
    expect(trennlinienDerQuelle('90-chat.md')).toBe(14);
    expect(trennlinienDerQuelle('60-badges.md')).toBe(2);
  });
});
