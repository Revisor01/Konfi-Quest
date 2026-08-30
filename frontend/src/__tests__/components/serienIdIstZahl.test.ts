import { describe, it, expect } from 'vitest';
import type { Event } from '../../types/event';

// Befund 30.08.2026: Zwei Detail-Ansichten der Leitung deklarierten
// `series_id` als string, der gemeinsame Event-Typ und die Datenbank fuehren
// es als Zahl.
//
// events.series_id ist die id des ERSTEN Termins der Serie
// (backend/routes/events/serien.js: `seriesId = eventId`), also ein
// numerischer Primaerschluessel. Der Treiber liefert ihn als number.
//
// Warum das gefaehrlich war: Die Serie wird ueber einen strikten Vergleich
// gruppiert (AdminEventsPage: `e.series_id === event.series_id`). Haette eine
// der beiden Seiten den Wert als string gefuehrt, waere der Vergleich NIE
// wahr geworden -- 12 !== '12'. Die Leitung haette beim Loeschen eines
// Serien-Termins keine Serien-Rueckfrage bekommen, sondern nur den einen
// Termin geloescht, ohne Hinweis auf die uebrigen.

// Die Gruppierung, wie AdminEventsPage sie vornimmt.
const serienGeschwister = (alle: Event[], termin: Event): Event[] =>
  alle.filter((e) => e.series_id === termin.series_id && e.id !== termin.id);

const termin = (id: number, series_id: number): Event =>
  ({ id, series_id, is_series: true, name: `Termin ${id}` }) as Event;

describe('Serien-Termine gruppieren', () => {
  // Serie mit drei Terminen: der erste (id 12) gibt der Serie ihre id.
  const serie = [termin(12, 12), termin(13, 12), termin(14, 12)];
  const einzeltermin = termin(20, 20);

  it('findet die uebrigen Termine der Serie', () => {
    const geschwister = serienGeschwister([...serie, einzeltermin], serie[0]);
    expect(geschwister.map((e) => e.id)).toEqual([13, 14]);
  });

  it('nimmt den ausgewaehlten Termin selbst nicht mit auf', () => {
    const geschwister = serienGeschwister(serie, serie[1]);
    expect(geschwister.map((e) => e.id)).toEqual([12, 14]);
  });

  it('vermischt zwei Serien nicht', () => {
    const zweiteSerie = [termin(30, 30), termin(31, 30)];
    const geschwister = serienGeschwister([...serie, ...zweiteSerie], zweiteSerie[0]);
    expect(geschwister.map((e) => e.id)).toEqual([31]);
  });

  // Der eigentliche Befund: Mit einer string-Fassung auf einer Seite faellt
  // die Gruppierung stillschweigend auf null Treffer zurueck -- die
  // Serien-Rueckfrage beim Loeschen erscheint dann nie.
  it('faende mit einer string-Fassung keinen einzigen Geschwister-Termin', () => {
    const alsString = { ...serie[0], series_id: '12' } as unknown as Event;
    expect(serienGeschwister(serie, alsString)).toHaveLength(0);
    // Zum Vergleich: mit der Zahl sind es zwei.
    expect(serienGeschwister(serie, serie[0])).toHaveLength(2);
  });

  it('gruppiert nichts, wenn keine series_id gesetzt ist', () => {
    const ohne = { id: 40, name: 'Einzeltermin' } as Event;
    expect(serienGeschwister([...serie, ohne], ohne)).toHaveLength(0);
  });
});
