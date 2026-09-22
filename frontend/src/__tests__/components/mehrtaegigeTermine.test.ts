// Mehrtaegige Termine in der Detailansicht.
//
// Simon, 22.09.2026: Die Teamerfreizeit laeuft vom 20.11. 16:30 bis zum
// 22.11. 12:30. In der Detailansicht stand:
//
//   "Freitag, 20. November 2026 · 16:30 – 12:30"
//
// Das liest sich wie ein Termin, der morgens um halb eins endet, bevor er
// abends um halb fuenf beginnt. Im Bearbeiten-Fenster stimmte es, nur die
// Anzeige haengte die Endzeit an den Starttag, ohne den Tageswechsel zu
// pruefen. Betroffen waren alle drei Rollen (Konfi, Team, Leitung), weil
// jede dieselbe Zeile fuer sich gebaut hatte.

import { describe, it, expect } from 'vitest';
import { zeitraumText } from '../../components/shared/eventFormatting';

describe('Zeitraum eines Termins', () => {
  it('nennt bei einem Tagestermin nur die Uhrzeiten', () => {
    const text = zeitraumText({
      event_date: '2026-11-20T16:30:00+01:00',
      event_end_time: '2026-11-20T21:00:00+01:00',
    });
    // Ein Tag: Datum einmal, dann die Spanne.
    expect(text).toContain('20. November 2026');
    expect(text).toContain('16:30');
    expect(text).toContain('21:00');
    // Der Tag darf NICHT zweimal dastehen.
    expect(text.match(/20\. November/g)?.length).toBe(1);
  });

  it('nennt bei einem mehrtaegigen Termin beide Tage', () => {
    const text = zeitraumText({
      event_date: '2026-11-20T16:30:00+01:00',
      event_end_time: '2026-11-22T12:30:00+01:00',
    });
    // Beide Tage muessen vorkommen - das war der Fehler.
    expect(text).toContain('20. November 2026');
    expect(text).toContain('22. November 2026');
    expect(text).toContain('16:30');
    expect(text).toContain('12:30');
  });

  it('kommt ohne Endzeit aus', () => {
    const text = zeitraumText({
      event_date: '2026-11-20T16:30:00+01:00',
      event_end_time: null,
    });
    expect(text).toContain('20. November 2026');
    expect(text).toContain('16:30');
    // Kein Gedankenstrich ins Leere.
    expect(text).not.toContain('–');
  });

  it('erkennt einen Tageswechsel ueber Mitternacht', () => {
    // Uebernachtung: 19:00 bis 09:00 am Folgetag.
    const text = zeitraumText({
      event_date: '2026-11-20T19:00:00+01:00',
      event_end_time: '2026-11-21T09:00:00+01:00',
    });
    expect(text).toContain('20. November 2026');
    expect(text).toContain('21. November 2026');
  });
});
