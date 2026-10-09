// "Ausstehend" / "zu verbuchen" gilt AB BEGINN -- in allen Ansichten
// (Simon, 09.10.2026). Vorher zeigten Konfi- und Team-Ansichten (App und
// Web) den Stand erst nach dem ENDE, waehrend Reiter "Verbuchen", seine rote
// Zahl und die Detailansicht einer Person schon ab Beginn rechneten: Waehrend
// des Konfisamstags stand bei der Konfi "Angemeldet", beim Team "Dabei".
//
// Eine Regel-Stelle: shared/eventFormatting.ts (istBegonnen,
// anwesenheitAusstehend). Geprueft wird der laufende Termin -- der Fall, an
// dem Beginn und Ende auseinanderfallen -- und daneben der kommende.
import { describe, it, expect, vi } from 'vitest';
import { anwesenheitAusstehend, istBegonnen, zuVerbuchendeTermine } from '../../components/shared/eventFormatting';
import {
  konfiListeStatus, konfiDetailStatus, teamListeStatus, teamDetailStatus, teamZusageZustand,
  leitungListeStatus, leitungDetailStatus,
} from '../../utils/termineWeb';
import type { Event } from '../../types/event';

const JETZT = new Date('2026-10-10T11:00:00Z');
// Konfisamstag 10:00-14:00: begonnen, nicht vorbei.
const LAUFEND = { event_date: '2026-10-10T08:00:00Z', event_end_time: '2026-10-10T12:00:00Z' };
const KOMMEND = { event_date: '2026-10-17T08:00:00Z', event_end_time: '2026-10-17T12:00:00Z' };

const termin = (zeit: typeof LAUFEND, zusatz: Partial<Event> = {}): Event => ({
  id: 1, name: 'Konfisamstag', ...zeit,
  registration_status: 'closed', registered_count: 5, max_participants: 20,
  is_registered: true, booking_status: 'confirmed', attendance_status: null,
  ...zusatz,
} as unknown as Event);

describe('die Regel-Stelle', () => {
  it('istBegonnen nimmt den Start, nicht das Ende', () => {
    expect(istBegonnen(LAUFEND, JETZT)).toBe(true);
    expect(istBegonnen(KOMMEND, JETZT)).toBe(false);
  });

  it('ausstehend: begonnen, angemeldet, ohne Anwesenheit -- nicht auf der Warteliste, nicht verbucht', () => {
    expect(anwesenheitAusstehend(termin(LAUFEND), JETZT)).toBe(true);
    expect(anwesenheitAusstehend(termin(KOMMEND), JETZT)).toBe(false);
    expect(anwesenheitAusstehend(termin(LAUFEND, { booking_status: 'waitlist', is_registered: false }), JETZT)).toBe(false);
    expect(anwesenheitAusstehend(termin(LAUFEND, { attendance_status: 'present' }), JETZT)).toBe(false);
    expect(anwesenheitAusstehend(termin(LAUFEND, { is_registered: false, booking_status: null }), JETZT)).toBe(false);
  });
});

describe('Konfi und Team: laufender Termin steht als ausstehend da', () => {
  it('Konfi, Liste und Detail', () => {
    expect(konfiListeStatus(termin(LAUFEND), false, JETZT).text).toBe('Ausstehend');
    expect(konfiDetailStatus(termin(LAUFEND), JETZT).text).toBe('Ausstehend');
    expect(konfiListeStatus(termin(KOMMEND), false, JETZT).text).toBe('Angemeldet');
    expect(konfiDetailStatus(termin(KOMMEND), JETZT).text).toBe('Angemeldet');
  });

  it('Konfi: schon verbucht zeigt der laufende Termin den Stand, nicht "Angemeldet"', () => {
    expect(konfiDetailStatus(termin(LAUFEND, { attendance_status: 'present' }), JETZT).text).toBe('Verbucht');
    expect(konfiListeStatus(termin(LAUFEND, { attendance_status: 'absent' }), false, JETZT).text).toBe('Verpasst');
  });

  it('Konfi, Pflicht-Event: ab Beginn ausstehend', () => {
    expect(konfiListeStatus(termin(LAUFEND, { mandatory: true }), false, JETZT).text).toBe('Ausstehend');
    expect(konfiListeStatus(termin(KOMMEND, { mandatory: true }), false, JETZT).text).toBe('Angemeldet');
  });

  it('Team, Liste, Detail und die Karte "Bist du dabei?"', () => {
    expect(teamListeStatus(termin(LAUFEND), JETZT).text).toBe('Ausstehend');
    expect(teamDetailStatus(termin(LAUFEND), JETZT).text).toBe('Ausstehend');
    expect(teamZusageZustand(termin(LAUFEND), JETZT)?.hinweis?.text).toBe('Anwesenheit ausstehend');
    expect(teamListeStatus(termin(KOMMEND), JETZT).text).toBe('Dabei');
    expect(teamDetailStatus(termin(KOMMEND), JETZT).text).toBe('Dabei');
    expect(teamZusageZustand(termin(KOMMEND), JETZT)?.zeigtKnoepfe).toBe(true);
  });
});

describe('Leitung: laufender Termin mit offenen Buchungen heisst "Verbuchen"', () => {
  it('Liste und Detail', () => {
    const e = termin(LAUFEND, { pending_bookings_count: 3 } as Partial<Event>);
    expect(leitungListeStatus(e, JETZT).text).toBe('Verbuchen');
    expect(leitungDetailStatus(e, [{ status: 'confirmed', attendance_status: null }], JETZT).text).toBe('Verbuchen');
    const k = termin(KOMMEND, { pending_bookings_count: 3 } as Partial<Event>);
    expect(leitungListeStatus(k, JETZT).text).not.toBe('Verbuchen');
  });


  it('der Reiter "Verbuchen" nimmt den laufenden Termin auf, den kommenden nicht', () => {
    vi.useFakeTimers();
    vi.setSystemTime(JETZT);
    try {
      const laufend = { id: 1, ...LAUFEND, pending_bookings_count: 2, registration_status: 'closed' };
      const kommend = { id: 2, ...KOMMEND, pending_bookings_count: 2, registration_status: 'closed' };
      expect(zuVerbuchendeTermine([laufend, kommend] as never[]).map((e: { id: number }) => e.id)).toEqual([1]);
    } finally {
      vi.useRealTimers();
    }
  });
});

// Dass die App-Ansichten dieselbe Stelle fragen, haelt
// components/abgesagteTermineAnsichten.test.ts fest.
