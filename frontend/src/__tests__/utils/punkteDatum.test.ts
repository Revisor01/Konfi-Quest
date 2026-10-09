// utils/punkteDatum: Event-Punkte zeigen das Datum des Termins, Aktivitaeten
// und Bonuspunkte ihr eigenes; ohne Eventdatum (aelterer Server) das
// Verbuchungsdatum. Die Liste ordnet nach dem angezeigten Datum.
import { describe, it, expect } from 'vitest';
import { punkteAnzeigeDatum, nachAnzeigeDatumAbsteigend } from '../../utils/punkteDatum';

describe('punkteAnzeigeDatum', () => {
  it('Event-Punkte: das Datum des Termins, nicht das der Verbuchung', () => {
    expect(punkteAnzeigeDatum({ event_date: '2026-09-06T10:00:00Z', date: '2026-10-01T08:00:00Z', awarded_date: '2026-10-01T08:00:00Z' }))
      .toBe('2026-09-06T10:00:00Z');
  });

  it('Aktivitaet oder Bonus (Mischliste): das Datum des Eintrags', () => {
    expect(punkteAnzeigeDatum({ event_date: null, date: '2026-08-20' })).toBe('2026-08-20');
  });

  it('aelterer Server ohne Eventdatum: das Verbuchungsdatum wie bisher', () => {
    expect(punkteAnzeigeDatum({ awarded_date: '2026-10-01T08:00:00Z' })).toBe('2026-10-01T08:00:00Z');
  });

  it('ganz ohne Datum: leerer Text', () => {
    expect(punkteAnzeigeDatum({})).toBe('');
  });
});

describe('nachAnzeigeDatumAbsteigend', () => {
  it('ordnet nach dem angezeigten Datum, neueste zuerst -- nicht nach Verbuchung', () => {
    const liste = [
      { id: 'spaet-verbucht', event_date: '2026-09-01', awarded_date: '2026-10-05' },
      { id: 'aktivitaet', date: '2026-09-20' },
      { id: 'frueh-verbucht', event_date: '2026-09-28', awarded_date: '2026-09-29' },
    ];
    expect(nachAnzeigeDatumAbsteigend(liste).map((e) => e.id)).toEqual(['frueh-verbucht', 'aktivitaet', 'spaet-verbucht']);
  });

  it('laesst die Eingabe unveraendert und stellt Eintraege ohne Datum ans Ende', () => {
    const liste = [{ id: 'ohne' }, { id: 'mit', date: '2026-01-01' }];
    expect(nachAnzeigeDatumAbsteigend(liste).map((e) => e.id)).toEqual(['mit', 'ohne']);
    expect(liste.map((e) => e.id)).toEqual(['ohne', 'mit']);
  });

  it('bei Gleichstand bleibt die Reihenfolge der Antwort', () => {
    const liste = [{ id: 'a', date: '2026-05-01' }, { id: 'b', date: '2026-05-01' }, { id: 'c', date: '2026-05-01' }];
    expect(nachAnzeigeDatumAbsteigend(liste).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
});
