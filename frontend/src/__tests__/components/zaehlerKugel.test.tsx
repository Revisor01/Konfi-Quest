import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ZaehlerKugel from '../../components/shared/ZaehlerKugel';

/**
 * Die rote Kugel am Listen-Symbol (Chat-Raum, Challenge): am Rand des
 * Symbols, nicht darauf.
 *
 * Simon am iPhone (25.09.2026): "der Badge-Indikator auf dem Icon in der
 * Liste darf etwas hoeher und etwas weiter nach rechts, dass es staerker am
 * Rand des Icons liegt, aber noch darueber."
 *
 * Gemessen im Browser: Der Elternknoten (position: relative) ist so breit
 * wie der Symbolkreis und um dessen margin-top hoeher. Mit right: 0 lag der
 * Mittelpunkt der Kugel INNERHALB des Kreisradius (11,7px bei r 14; 14,4px
 * bei r 16). Der Vertrag hier: Mittelpunkt auf oder knapp ausserhalb des
 * Kreisrands (Abstand >= r), aber die Kugel ueberlappt noch (Abstand < r + 8).
 * Hoeher als top: 0 geht nicht -- .app-list-item__main beschneidet mit
 * overflow: hidden alles darueber (bei -2px gemessen).
 */
const css = readFileSync(join(process.cwd(), 'src/theme/variables.css'), 'utf8');
const abstaende = readFileSync(join(process.cwd(), 'src/theme/abstaende.css'), 'utf8');
const px = (quelle: string, muster: RegExp): number => {
  const m = quelle.match(muster);
  if (!m) throw new Error(`nicht gefunden: ${muster}`);
  return parseFloat(m[1]);
};

const KUGEL = 16;
// Die beiden Symbolkreise, an denen die Kugel haengt, aus dem Stylesheet.
const KREIS = px(css, /\.app-icon-circle \{[^}]*?\bwidth:\s*(\d+)px/);
const KREIS_LG = px(css, /\.app-icon-circle--lg \{[^}]*?\bwidth:\s*(\d+)px/);
const KREIS_MARGIN = px(abstaende, /--app-abstand-mini:\s*(\d+)px/);

const stil = () => {
  const { container } = render(<ZaehlerKugel anzahl={2} label="ungelesene Nachrichten" />);
  return (container.firstChild as HTMLElement).style;
};

/** Abstand Kugelmitte -> Kreismitte, im Koordinatensystem des Elternknotens. */
const abstand = (kreis: number, top: number, right: number): number => {
  const kugelMitte = { x: kreis - right - KUGEL / 2, y: top + KUGEL / 2 };
  const kreisMitte = { x: kreis / 2, y: KREIS_MARGIN + kreis / 2 };
  return Math.hypot(kugelMitte.x - kreisMitte.x, kugelMitte.y - kreisMitte.y);
};

describe('ZaehlerKugel: Lage am Symbolkreis', () => {
  it('die Stylesheet-Masse sind die gemessenen: Kreis 28/32px, Rand oben 4px', () => {
    expect(KREIS).toBe(28);
    expect(KREIS_LG).toBe(32);
    expect(KREIS_MARGIN).toBe(4);
  });

  it('haengt mit top 0 und right -4px am Elternknoten, 16px gross', () => {
    const s = stil();
    expect(s.top).toBe('0px');
    expect(s.right).toBe('-4px');
    expect(s.width).toBe('16px');
    expect(s.height).toBe('16px');
    expect(s.position).toBe('absolute');
  });

  it.each([
    ['Challenge-Liste', KREIS],
    ['Chat-Liste (--lg)', KREIS_LG],
  ])('%s: Mittelpunkt auf dem Kreisrand, Kugel ueberlappt noch', (_name, kreis) => {
    const s = stil();
    const d = abstand(kreis, parseFloat(s.top), parseFloat(s.right));
    const r = kreis / 2;
    expect(d).toBeGreaterThanOrEqual(r);          // nicht mehr auf dem Symbol
    expect(d).toBeLessThan(r + KUGEL / 2);          // aber noch darueber
  });

  it('die Zahlen: 14,1px bei r 14 und 17,0px bei r 16', () => {
    expect(abstand(KREIS, 0, -4)).toBeCloseTo(14.14, 1);
    expect(abstand(KREIS_LG, 0, -4)).toBeCloseTo(16.97, 1);
  });

  it('Gegenprobe der Formel: mit right 0 lag der Mittelpunkt im Kreis', () => {
    expect(abstand(KREIS, 0, 0)).toBeLessThan(KREIS / 2);
    expect(abstand(KREIS_LG, 0, 0)).toBeLessThan(KREIS_LG / 2);
  });

  it('nicht hoeher als 0 -- die Zeile beschneidet darueber', () => {
    // .app-list-item__main hat overflow: hidden; die Kugel liegt in ihr.
    expect(css).toMatch(/\.app-list-item__main \{[^}]*overflow:\s*hidden/);
    expect(parseFloat(stil().top)).toBeGreaterThanOrEqual(0);
  });

  it('bei 0 wird nichts gerendert', () => {
    const { container } = render(<ZaehlerKugel anzahl={0} label="x" />);
    expect(container.firstChild).toBeNull();
  });
});
