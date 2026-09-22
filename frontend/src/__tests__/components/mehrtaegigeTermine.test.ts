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
//
// ZEITZONE: Die Uhrzeiten werden hier BERECHNET, nicht hingeschrieben. Ein
// erster Anlauf pruefte auf "16:30" und fiel in der CI, die in UTC laeuft —
// dort steht bei 16:30+01:00 eben 15:30. Lokal war er gruen. Genau die
// Falle, die in CLAUDE.md unter "Testumgebung spiegelt die Produktion"
// beschrieben ist.

import { describe, it, expect } from 'vitest';
import { zeitraumText } from '../../components/shared/eventFormatting';

// Wie die Anzeige selbst formatiert — so ist der Test unabhaengig davon,
// in welcher Zeitzone er laeuft.
const zeit = (iso: string) =>
  new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
const tagLang = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

describe('Zeitraum eines Termins', () => {
  it('nennt bei einem Tagestermin nur die Uhrzeiten', () => {
    const beginn = '2026-11-20T16:30:00+01:00';
    const ende = '2026-11-20T21:00:00+01:00';
    const text = zeitraumText({ event_date: beginn, event_end_time: ende });

    expect(text).toContain(tagLang(beginn));
    expect(text).toContain(zeit(beginn));
    expect(text).toContain(zeit(ende));
    // Der Tag darf NICHT zweimal dastehen.
    const tag = tagLang(beginn);
    expect(text.split(tag).length - 1).toBe(1);
  });

  it('nennt bei einem mehrtaegigen Termin beide Tage', () => {
    const beginn = '2026-11-20T16:30:00+01:00';
    const ende = '2026-11-22T12:30:00+01:00';
    const text = zeitraumText({ event_date: beginn, event_end_time: ende });

    // Beide Tage muessen vorkommen — das war der Fehler.
    expect(text).toContain(tagLang(beginn));
    expect(text).toContain(tagLang(ende));
    expect(tagLang(beginn)).not.toBe(tagLang(ende));   // Gegenprobe zur Vorbedingung
    expect(text).toContain(zeit(beginn));
    expect(text).toContain(zeit(ende));
  });

  it('kommt ohne Endzeit aus', () => {
    const beginn = '2026-11-20T16:30:00+01:00';
    const text = zeitraumText({ event_date: beginn, event_end_time: null });

    expect(text).toContain(tagLang(beginn));
    expect(text).toContain(zeit(beginn));
    // Kein Gedankenstrich ins Leere.
    expect(text).not.toContain('–');
  });

  it('erkennt einen Tageswechsel ueber Mitternacht', () => {
    // Uebernachtung: 19:00 bis 09:00 am Folgetag. Die Endzeit sieht
    // kleiner aus als die Startzeit — verglichen wird trotzdem der Tag.
    const beginn = '2026-11-20T19:00:00+01:00';
    const ende = '2026-11-21T09:00:00+01:00';
    const text = zeitraumText({ event_date: beginn, event_end_time: ende });

    expect(text).toContain(tagLang(beginn));
    expect(text).toContain(tagLang(ende));
    expect(tagLang(beginn)).not.toBe(tagLang(ende));
  });
});
