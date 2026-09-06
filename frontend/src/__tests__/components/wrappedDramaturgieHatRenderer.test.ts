import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Jede Seite, die das BACKEND auswaehlen kann, kann das Frontend auch malen.
 *
 * WAS SCHIEFGING (Befund 06.09.2026, zwei Seiten auf einmal):
 *
 *   'challenges' stand in der DRAMATURGIE des Backends und hatte dort eine
 *   Bedingung -- aber keinen Eintrag in der Renderer-Registry des
 *   WrappedModal. addSlide schob die Seite mit `render: undefined` in die
 *   Liste: kein Absturz, keine Meldung, eine leere weisse Seite mitten im
 *   Rueckblick.
 *
 *   Umgekehrt genauso: 'aktivster-monat' HATTE einen Renderer, eine fertige
 *   Komponente und Daten im Snapshot -- stand aber nicht in der DRAMATURGIE.
 *   Seit Snapshot-Version 3 waehlt das Backend die Seiten; die Komponente
 *   wurde dadurch nie mehr gezeigt und niemandem fiel es auf.
 *
 * BEIDE FEHLER SIND DERSELBE FEHLER: Zwei Listen, die zueinander passen
 * muessen, an zwei Orten -- und nichts, das sie gegeneinander haelt. Genau
 * das tut dieser Test, in beide Richtungen.
 *
 * ER LIEST DEN QUELLTEXT, wie es der Teilen-Test daneben schon tut: Beide
 * Listen stehen woertlich im Code, und nur die Frage "kennen sie einander?"
 * ist hier wichtig, nicht das Aussehen der Seiten.
 */

const projekt = resolve(process.cwd(), '..');

const modal = readFileSync(
  resolve(process.cwd(), 'src/components/wrapped/WrappedModal.tsx'), 'utf8'
);
const kacheln = readFileSync(
  resolve(projekt, 'backend/utils/wrappedKacheln.js'), 'utf8'
);

/** Die Seiten-Schluessel aus der Renderer-Registry in WrappedModal. */
function rendererSchluessel(): string[] {
  const registry = modal.match(
    /const renderers: Record<string, \(isActive: boolean\) => React\.ReactNode> = \{([\s\S]*?)\n {4}\};/
  );
  if (!registry) throw new Error('Renderer-Registry in WrappedModal.tsx nicht gefunden');
  return [...registry[1].matchAll(/^\s*'([a-z0-9-]+)':\s*\(/gm)].map(m => m[1]);
}

/** Die DRAMATURGIE des Backends -- die Reihenfolge der Erzaehlung. */
function dramaturgie(): string[] {
  const block = kacheln.match(/const DRAMATURGIE = \[([\s\S]*?)\n\];/);
  if (!block) throw new Error('DRAMATURGIE in wrappedKacheln.js nicht gefunden');
  return [...block[1].matchAll(/^\s*'([a-z0-9-]+)',?/gm)].map(m => m[1]);
}

const RENDERER = rendererSchluessel();
const DRAMATURGIE = dramaturgie();

/**
 * 'kategorie' ist KEIN Renderer-Schluessel, sondern ein Platzhalter: An
 * seiner Stelle setzt waehleKacheln() die dynamischen Seiten ein
 * ('kategorie:freizeit', 'datum:advent', 'kategorie-allgemein'). Die malt
 * das Modal ueber KategorieSeiteSlide, nicht ueber die Registry.
 */
const PLATZHALTER = ['kategorie'];

/**
 * Renderer, die es NUR fuer Alt-Snapshots gibt und die die Dramaturgie
 * deshalb bewusst nicht kennt.
 *
 * Version-1- und Version-2-Snapshots stellen ihre Seiten im Frontend selbst
 * zusammen (die Zweige unter `else if (version >= 2)` und darunter). Diese
 * vier Seiten werden nur dort gewaehlt. Sie zu streichen hiesse, bereits
 * erzeugte Rueckblicke zu veraendern -- die duerfen sich nicht aendern.
 *
 * Wer hier etwas eintraegt, muss zeigen koennen, WO die Seite sonst gewaehlt
 * wird. Eine Seite, die nirgends gewaehlt wird, gehoert nicht in diese
 * Liste, sondern in die Dramaturgie.
 */
const NUR_ALT_SNAPSHOTS = ['highlight', 'endspurt', 'ueber-das-ziel'];

/** Die Teamer-Renderer-Registry in buildTeamerSlides. */
function teamerRendererSchluessel(): string[] {
  const bau = modal.slice(modal.indexOf('const buildTeamerSlides'));
  const registry = bau.match(
    /const renderers: Record<string, \(isActive: boolean\) => React\.ReactNode> = \{([\s\S]*?)\n {4}\};/
  );
  if (!registry) throw new Error('Teamer-Renderer-Registry nicht gefunden');
  return [...registry[1].matchAll(/^\s*'([a-z0-9-]+)':\s*\(/gm)].map(m => m[1]);
}

/** Die TEAMER_DRAMATURGIE des Backends. */
function teamerDramaturgie(): string[] {
  const block = kacheln.match(/const TEAMER_DRAMATURGIE = \[([\s\S]*?)\n\];/);
  if (!block) throw new Error('TEAMER_DRAMATURGIE nicht gefunden');
  return [...block[1].matchAll(/^\s*'([a-z0-9-]+)',?/gm)].map(m => m[1]);
}

const TEAMER_RENDERER = teamerRendererSchluessel();
const TEAMER_DRAMATURGIE = teamerDramaturgie();

describe('Dramaturgie und Renderer passen zueinander', () => {
  it('die Listen sind ueberhaupt gefunden worden', () => {
    // Ohne diese Absicherung wuerde ein Umbau der Schreibweise die beiden
    // Pruefungen unten still zu "leer gegen leer" machen -- gruen, aber
    // ohne Aussage.
    expect(RENDERER.length).toBeGreaterThan(10);
    expect(DRAMATURGIE.length).toBeGreaterThan(10);
  });

  it('jede Seite der Dramaturgie hat einen Renderer', () => {
    const ohneRenderer = DRAMATURGIE
      .filter(k => !PLATZHALTER.includes(k))
      .filter(k => !RENDERER.includes(k));
    // 'challenges' fehlte hier -- die Seite blieb leer.
    expect(ohneRenderer).toEqual([]);
  });

  it('jeder Renderer wird von der Dramaturgie auch gewaehlt', () => {
    // Sonst existiert eine fertige Komponente, die niemand je zu sehen
    // bekommt -- so geschehen mit 'aktivster-monat': Renderer da,
    // Komponente da, Daten im Snapshot da, aber seit Version 3 nie
    // ausgewaehlt.
    const nieGewaehlt = RENDERER
      .filter(k => !NUR_ALT_SNAPSHOTS.includes(k))
      .filter(k => !DRAMATURGIE.includes(k));
    expect(nieGewaehlt).toEqual([]);
  });
});

describe('Teamer-Dramaturgie und Renderer passen zueinander', () => {
  // Der Teamer-Rueckblick zeigte bis zum 06.09.2026 sieben fest verdrahtete
  // Seiten; seit er die Auswahl vom Backend bekommt, gilt hier dieselbe
  // Kopplung wie beim Konfi-Rueckblick -- und derselbe Waechter.
  it('die Listen sind ueberhaupt gefunden worden', () => {
    expect(TEAMER_RENDERER.length).toBeGreaterThan(5);
    expect(TEAMER_DRAMATURGIE.length).toBeGreaterThan(5);
  });

  it('jede Teamer-Seite der Dramaturgie hat einen Renderer', () => {
    expect(TEAMER_DRAMATURGIE.filter(k => !TEAMER_RENDERER.includes(k))).toEqual([]);
  });

  it('jeder Teamer-Renderer wird von der Dramaturgie auch gewaehlt', () => {
    expect(TEAMER_RENDERER.filter(k => !TEAMER_DRAMATURGIE.includes(k))).toEqual([]);
  });
});
