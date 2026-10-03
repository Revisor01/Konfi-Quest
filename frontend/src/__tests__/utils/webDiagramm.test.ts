// Rechnen fuer die Diagramme der Web-Fassung (utils/webDiagramm.ts,
// 03.10.2026): runde Teilstriche, Balkenpfade, gestapelte Segmente mit
// 2 px Luecke.
import { describe, it, expect } from 'vitest';
import { balkenPfad, flaechenPfad, linienPfad, schoeneSkala, stapelSegmente, zahlText } from '../../utils/webDiagramm';

describe('schoeneSkala: wenige, runde Teilstriche', () => {
  it.each([
    [118, [0, 50, 100, 150]],
    [141, [0, 50, 100, 150]],
    [6, [0, 2, 4, 6]],
    [1501, [0, 500, 1000, 1500, 2000]],
    [455, [0, 200, 400, 600]],
    [89, [0, 25, 50, 75, 100]],
  ])('groesster Wert %i -> %j', (hoechster, ticks) => {
    expect(schoeneSkala(hoechster).ticks).toEqual(ticks);
  });

  it('die Obergrenze liegt nie unter dem groessten Wert und ist ein Vielfaches des Schritts', () => {
    for (const wert of [1, 2, 3, 7, 13, 99, 100, 101, 249, 1000, 4321]) {
      const s = schoeneSkala(wert);
      expect(s.max).toBeGreaterThanOrEqual(wert);
      expect(s.max % s.schritt).toBe(0);
      expect(s.ticks[0]).toBe(0);
      expect(s.ticks[s.ticks.length - 1]).toBe(s.max);
    }
  });

  it('Zaehlungen kennen keine Bruchteile: auch bei Wert 3 ist der Schritt ganzzahlig', () => {
    expect(schoeneSkala(3).ticks).toEqual([0, 1, 2, 3]);
    expect(schoeneSkala(1).ticks).toEqual([0, 1]);
  });

  it('ohne Werte (0 oder ungueltig) bleibt eine brauchbare Achse mit 0 bis 4', () => {
    expect(schoeneSkala(0).ticks).toEqual([0, 1, 2, 3, 4]);
    expect(schoeneSkala(Number.NaN).ticks).toEqual([0, 1, 2, 3, 4]);
  });

  it('das Ziel steuert die Zahl der Abschnitte: kleine Diagramme mit zwei', () => {
    expect(schoeneSkala(100, 2).ticks).toEqual([0, 50, 100]);
  });
});

describe('stapelSegmente: von unten nach oben, 2 px Luecke zum Nachbarn', () => {
  it('das untere Segment hat keine Luecke, das obere verliert 2 px Hoehe an der Unterkante', () => {
    // 10 Einheiten a 2 px = 20 px unten, 5 a 2 px = 10 px oben; Boden bei y = 100.
    const [unten, oben] = stapelSegmente([10, 5], 2, 100, 2);
    expect(unten).toMatchObject({ reihe: 0, y: 80, hoehe: 20, wert: 10 });
    expect(oben).toMatchObject({ reihe: 1, y: 70, hoehe: 8, wert: 5 });
    // Die Luecke: Oberkante des unteren (80) minus Unterkante des oberen (70 + 8 = 78) = 2 px.
    expect(unten.y - (oben.y + oben.hoehe)).toBe(2);
  });

  it('Reihen mit Wert 0 fehlen, die uebrigen behalten ihre Reihe', () => {
    const segmente = stapelSegmente([0, 4, 0, 3], 10, 200, 2);
    expect(segmente.map((s) => s.reihe)).toEqual([1, 3]);
    // Das erste gezeichnete Segment ist das unterste: ohne Luecke.
    expect(segmente[0].hoehe).toBe(40);
  });

  it('die Luecke frisst ein sehr niedriges Segment nie ganz auf', () => {
    const [, oben] = stapelSegmente([5, 1], 1, 100, 2);
    expect(oben.hoehe).toBeGreaterThan(0);
  });
});

describe('Pfade', () => {
  it('balkenPfad: oben gerundet, unten gerade, leer ohne Hoehe', () => {
    expect(balkenPfad(0, 0, 10, 0)).toBe('');
    expect(balkenPfad(0, 0, 0, 10)).toBe('');
    const pfad = balkenPfad(10, 20, 24, 50, 4);
    expect(pfad.startsWith('M10,70V24Q10,20 14,20H30Q34,20 34,24V70Z')).toBe(true);
  });

  it('balkenPfad: ein sehr flacher Balken rundet nur so weit, wie er hoch ist', () => {
    expect(balkenPfad(0, 0, 24, 2, 4)).toContain('V2');
    expect(balkenPfad(0, 0, 24, 2, 4)).toContain('Q0,0 2,0');
  });

  it('linienPfad und flaechenPfad', () => {
    expect(linienPfad([[0, 10], [5, 4], [10, 8]])).toBe('M0,10L5,4L10,8');
    expect(flaechenPfad([[0, 10], [10, 8]], 20)).toBe('M0,10L10,8L10,20L0,20Z');
    expect(flaechenPfad([], 20)).toBe('');
  });

  it('zahlText: deutsche Tausenderpunkte', () => {
    expect(zahlText(1501)).toBe('1.501');
    expect(zahlText(12)).toBe('12');
  });
});
