// Die Wege beim Löschen eines Events einer Serie (utils/serieLoeschen.ts) --
// eine Stelle für das Aktionsmenü der App und das Fenster des Browsers
// (Simon, 15.10.2026). Gerendert prüft beide webEventFensterListe.test.tsx.
import { describe, it, expect } from 'vitest';
import { serienLoeschWahl, type SerienTermin } from '../../utils/serieLoeschen';

const abend = (id: number, tag: number, zusatz: Partial<SerienTermin> = {}): SerienTermin => ({
  id, name: `Abend ${id}`, event_date: `2026-11-${String(tag).padStart(2, '0')}T18:00:00Z`, is_series: true, series_id: 9, ...zusatz,
});
const SERIE = [abend(1, 3), abend(2, 10), abend(3, 17)];
const ids = (liste: SerienTermin[] | null) => (liste ? liste.map((e) => e.id).sort() : null);

describe('serienLoeschWahl', () => {
  it('in der Mitte: nur dieses, dieses und alle folgenden (2), die ganze Serie (3)', () => {
    const wahl = serienLoeschWahl(SERIE[1], SERIE)!;
    expect(wahl.titel).toBe('Event einer Serie löschen');
    expect(wahl.satz).toBe('"Abend 2" ist Teil einer Serie mit 3 Events.');
    expect([wahl.nurDiesesText, wahl.folgendeText, wahl.ganzeSerieText])
      .toEqual(['Nur dieses Event löschen', 'Dieses + alle folgenden löschen (2 Events)', 'Ganze Serie löschen (3 Events)']);
    expect(ids(wahl.folgende)).toEqual([2, 3]);
    expect(ids(wahl.ganzeSerie)).toEqual([1, 2, 3]);
  });

  it('am ersten Abend wäre „alle folgenden" die ganze Serie, am letzten nur dieser -- dann gibt es den Weg nicht', () => {
    expect(serienLoeschWahl(SERIE[0], SERIE)!.folgende).toBe(null);
    expect(serienLoeschWahl(SERIE[0], SERIE)!.folgendeText).toBe(null);
    expect(serienLoeschWahl(SERIE[2], SERIE)!.folgende).toBe(null);
  });

  it('keine Serie oder keine weiteren Events der Serie bekannt: keine Wahl (einzeln löschen)', () => {
    expect(serienLoeschWahl(abend(4, 1, { is_series: false, series_id: undefined }), SERIE)).toBe(null);
    expect(serienLoeschWahl(abend(5, 1, { series_id: 77 }), SERIE)).toBe(null);
  });

  it('andere Serien zählen nicht mit', () => {
    const fremd = abend(8, 24, { series_id: 10 });
    expect(ids(serienLoeschWahl(SERIE[1], [...SERIE, fremd])!.ganzeSerie)).toEqual([1, 2, 3]);
  });
});
