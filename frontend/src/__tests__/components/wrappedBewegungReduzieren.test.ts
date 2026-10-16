import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Der Auftritt der Schrift im Rueckblick -- und seine Abschaltung.
 *
 * SIMONS WUNSCH (07.09.2026): "mehr Bewegung beim Erscheinen der Schrift".
 * Die Teile im Slogan-Aufbau (Auge, Zahl, Slogan, Nachsatz) kommen
 * gestaffelt. Wie genau, ist Gestaltung und wird nicht festgeschrieben
 * (Simon, 15.10.2026).
 *
 * WAS DIESER TEST SICHERT: Wer im System "Bewegung reduzieren"
 * eingestellt hat, darf davon NICHTS abbekommen.
 *
 * DIE FALLE DABEI: Der Grundzustand der aelteren Auftritts-Klassen
 * (.wrapped-anim-*) ist `opacity: 0` -- die Deckkraft kommt erst durch die
 * Animation zurueck. Ein blosses `animation: none` haette die Seiten also
 * nicht beruhigt, sondern LEER gemacht. Deshalb muss die Regel die
 * Deckkraft ausdruecklich auf 1 zuruecksetzen. Genau das pruefen die
 * Faelle unten.
 *
 * Vor dieser Aenderung beachtete der Rueckblick "Bewegung reduzieren" nur
 * an zwei Stellen (treibende Hintergrundbilder, Polaroid-Wand); die
 * gesamte Schrift-Bewegung lief trotzdem.
 */

const css = readFileSync(
  resolve(process.cwd(), 'src/components/wrapped/WrappedModal.css'),
  'utf8'
);

/** Liefert den Inhalt aller @media-Bloecke fuer reduzierte Bewegung. */
function bewegungsBloecke(): string[] {
  const bloecke: string[] = [];
  const marke = '@media (prefers-reduced-motion: reduce)';
  let von = css.indexOf(marke);
  while (von !== -1) {
    // Klammern zaehlen, damit verschachtelte Regeln vollstaendig mitkommen.
    const start = css.indexOf('{', von);
    let tiefe = 0;
    let i = start;
    for (; i < css.length; i++) {
      if (css[i] === '{') tiefe++;
      else if (css[i] === '}') {
        tiefe--;
        if (tiefe === 0) break;
      }
    }
    bloecke.push(css.slice(start, i + 1));
    von = css.indexOf(marke, i);
  }
  return bloecke;
}

/** Der Block, der die Schrift-Auftritte abschaltet. */
function schriftBlock(): string {
  const treffer = bewegungsBloecke().filter(b => b.includes('.kat-slogan'));
  expect(treffer).toHaveLength(1);
  return treffer[0];
}

describe('Rueckblick achtet auf "Bewegung reduzieren"', () => {
  it('es gibt einen Block, der die Schrift-Auftritte abschaltet', () => {
    expect(schriftBlock()).toContain('animation: none');
  });

  it('der Block setzt die Deckkraft zurueck -- sonst blieben die Seiten leer', () => {
    const block = schriftBlock();
    expect(block).toMatch(/opacity:\s*1\s*!important/);
    expect(block).toMatch(/transform:\s*none\s*!important/);
    expect(block).toMatch(/animation:\s*none\s*!important/);
  });

  it('alle Teile des Slogan-Aufbaus sind erfasst', () => {
    const block = schriftBlock();
    for (const teil of [
      '.kat-auge',
      '.kat-gemeinde',
      '.kat-zahl',
      '.kat-slogan > span',
      '.kat-nachsatz',
      '.kat-fussnote',
      '.w-aufteilung',
      '.w-merkzettel',
      '.w-bilanz',
      '.w-einladung',
      '.vielseitig-icons',
    ]) {
      expect(block, `${teil} fehlt in der Abschaltung`).toContain(teil);
    }
  });

  it('auch die aelteren Auftritts-Klassen sind erfasst', () => {
    // Diese haben opacity: 0 als Grundzustand -- ohne Ruecksetzung waeren
    // die betroffenen Seiten bei reduzierter Bewegung unsichtbar.
    const block = schriftBlock();
    for (const klasse of [
      'wrapped-anim-fade',
      'wrapped-anim-scale',
      'wrapped-anim-slide-up',
      'wrapped-anim-bounce',
      'wrapped-anim-fly-left',
      'wrapped-anim-fly-right',
      'wrapped-anim-number-pop',
    ]) {
      expect(block, `${klasse} fehlt in der Abschaltung`).toContain(klasse);
    }
  });

  it('jede Klasse mit opacity: 0 als Grundzustand wird zurueckgesetzt', () => {
    // GEGENPROBE gegen kuenftige Ergaenzungen: Wer eine neue Klasse mit
    // opacity: 0 einfuehrt und die Abschaltung vergisst, macht die Seite
    // bei reduzierter Bewegung leer.
    const grundzustand = css.match(
      /\/\* Initial-State[^*]*\*\/\s*([^{]+)\{\s*opacity:\s*0;\s*\}/
    );
    expect(grundzustand, 'Grundzustands-Block nicht gefunden').not.toBeNull();
    const klassen = (grundzustand as RegExpMatchArray)[1]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    expect(klassen.length).toBeGreaterThan(0);
    const block = schriftBlock();
    for (const k of klassen) {
      expect(block, `${k} hat opacity: 0, wird aber nicht zurueckgesetzt`).toContain(
        k.replace(/^\./, '')
      );
    }
  });

  it('die treibenden Hintergrundbilder bleiben ebenfalls abgeschaltet', () => {
    // Bestand: darf durch die neue Regel nicht verlorengehen.
    const bloecke = bewegungsBloecke();
    expect(bloecke.some(b => b.includes('.wrapped-bg-form--oben'))).toBe(true);
    expect(bloecke.some(b => b.includes('.moment-polaroid'))).toBe(true);
  });

  it('das Konfetti faellt nicht endlos weiter, es entfaellt ganz', () => {
    // Bis 09.10.2026 stand .konfetti-piece in keinem der Bloecke: 30
    // Schnipsel fielen mit `infinite` weiter, auch bei reduzierter Bewegung.
    const treffer = bewegungsBloecke().filter(b => b.includes('.konfetti-piece'));
    expect(treffer).toHaveLength(1);
    const regel = treffer[0].match(/\.konfetti-piece\s*\{([^}]*)\}/);
    expect(regel).not.toBeNull();
    expect((regel as RegExpMatchArray)[1]).toMatch(/animation:\s*none\s*!important/);
    expect((regel as RegExpMatchArray)[1]).toMatch(/display:\s*none/);
  });
});
