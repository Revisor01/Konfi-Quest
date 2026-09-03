import { describe, it, expect } from 'vitest';
import { verteileMotive } from '../../components/wrapped/hintergrundbilder';

/**
 * Innerhalb EINES Rückblicks wiederholt sich kein Motiv.
 *
 * SIMONS VORGABE (03.09.2026): "Es dürfen niemals zweimal die gleichen
 * Bilder im bg sein bei einem Konfi."
 *
 * WARUM DIE FESTE ZUORDNUNG DAS NICHT KONNTE: Ein Rückblick hat bis zu
 * 14 Seiten mit je zwei Motiven — bis zu 28 Bildplätze — bei 16 Motiven.
 * Gemessen am 03.09.2026 kam `watt` bei einem einzigen Konfi DREIMAL vor
 * (intro, freizeit, abschluss), fünf weitere Motive doppelt.
 */

const KONFI_TYPISCH = [
  'intro', 'chat', 'events', 'kategorie:freizeit', 'kategorie:gottesdienst',
  'challenges', 'challenge-momente', 'punkte', 'badges', 'seltenstes',
  'konfirmation', 'abschluss', 'werde-teamer',
];

const TEAMER = [
  'teamer-intro', 'teamer-events', 'teamer-konfis', 'teamer-badges',
  'teamer-zertifikate', 'teamer-jahre', 'teamer-abschluss',
];

function alleMotiveAus(zuweisung: Record<string, { haupt: string; zweit: string }>) {
  // Nur das Hauptmotiv: Seit dem 03.09.2026 bekommt jede Seite GENAU EIN
  // Bild. Zwei Motive je Seite waren bei 16 Motiven und bis zu 13 Seiten
  // nicht ohne Wiederholung vergebbar.
  return Object.values(zuweisung).map(z => z.haupt);
}

describe('Keine doppelten Hintergrundbilder in einem Rückblick', () => {
  it('ein typischer Konfi-Rückblick zeigt jedes Motiv höchstens einmal', () => {
    const motive = alleMotiveAus(verteileMotive(KONFI_TYPISCH));
    const doppelte = motive.filter((m, i) => motive.indexOf(m) !== i);
    expect(doppelte, `doppelt: ${[...new Set(doppelte)].join(', ')}`).toEqual([]);
  });

  it('ein Teamer-Rückblick zeigt jedes Motiv höchstens einmal', () => {
    const motive = alleMotiveAus(verteileMotive(TEAMER));
    const doppelte = motive.filter((m, i) => motive.indexOf(m) !== i);
    expect(doppelte).toEqual([]);
  });

  it('jede Seite bekommt genau EIN Motiv', () => {
    const z = verteileMotive(KONFI_TYPISCH);
    for (const [kachel, { haupt }] of Object.entries(z)) {
      expect(haupt, `${kachel} ohne Motiv`).toBeTruthy();
    }
  });

  it('die Verteilung ist bei gleicher Seitenfolge IMMER gleich', () => {
    // Ein geteilter Rückblick darf sich nicht bei jedem Öffnen verändern.
    const a = JSON.stringify(verteileMotive(KONFI_TYPISCH));
    const b = JSON.stringify(verteileMotive(KONFI_TYPISCH));
    expect(a).toBe(b);
  });

  it('auch eine sehr kurze Seitenfolge bekommt Motive', () => {
    const z = verteileMotive(['intro', 'abschluss']);
    expect(Object.keys(z)).toHaveLength(2);
    const motive = alleMotiveAus(z);
    expect(new Set(motive).size).toBe(motive.length);
  });

  it('mehr Bildplätze als Motive brechen nicht', () => {
    // 16 Motive, hier 20 Seiten. Wiederholung ist dann
    // unvermeidlich — es darf aber nichts leer bleiben oder werfen.
    const viele = Array.from({ length: 20 }, (_, i) => `kategorie:test${i}`);
    const z = verteileMotive(viele);
    expect(Object.keys(z)).toHaveLength(20);
    for (const { haupt } of Object.values(z)) {
      expect(haupt).toBeTruthy();
    }
  });
});
