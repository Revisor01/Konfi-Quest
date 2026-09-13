import { describe, it, expect } from 'vitest';
import { urheberZeile } from '../../utils/anwesenheitUrheber';

// Simon (13.09.2026): "vielleicht wäre es noch gut zu wissen wer den Eintrag
// gemacht hat" — in der Teilnehmerliste, klein unter Grund und Vermerk.
//
// Der schwierige Teil ist nicht das Formatieren, sondern das Fehlen: NULL
// heisst UNBEKANNT, nicht NIEMAND. Buchungen von vor Migration 148 und
// Selbst-Check-ins per QR-Code haben keinen Urheber.

describe('Urheber-Zeile der Anwesenheit', () => {
  it('nennt Namen und kurzes Datum', () => {
    expect(urheberZeile({
      attendance_set_by_name: 'Simon Luthe',
      attendance_set_at: '2026-09-13T10:00:00Z'
    })).toBe('Eingetragen von Simon Luthe, 13.09.');
  });

  it('das Jahr steht NICHT in der Zeile', () => {
    // Sie steht an einem Termin, dessen Datum eine Zeile darueber sichtbar ist.
    expect(urheberZeile({
      attendance_set_by_name: 'Simon Luthe',
      attendance_set_at: '2026-09-13T10:00:00Z'
    })).not.toContain('2026');
  });

  it('ohne Namen faellt die Zeile weg — nicht "unbekannt"', () => {
    // Bestandszeilen vor Migration 148.
    expect(urheberZeile({ attendance_set_by_name: null, attendance_set_at: null })).toBeNull();
    expect(urheberZeile({})).toBeNull();
    expect(urheberZeile(null)).toBeNull();
    expect(urheberZeile(undefined)).toBeNull();
  });

  it('ein Datum ohne Namen ergibt ebenfalls nichts', () => {
    // Ein blosses Datum beantwortet "wer war das?" nicht.
    expect(urheberZeile({ attendance_set_by_name: null, attendance_set_at: '2026-09-13T10:00:00Z' })).toBeNull();
  });

  it('ein leerer Name zaehlt wie kein Name', () => {
    expect(urheberZeile({ attendance_set_by_name: '   ', attendance_set_at: '2026-09-13T10:00:00Z' })).toBeNull();
  });

  it('ohne Zeitpunkt bleibt der Name allein stehen', () => {
    expect(urheberZeile({ attendance_set_by_name: 'Simon Luthe', attendance_set_at: null }))
      .toBe('Eingetragen von Simon Luthe');
  });

  it('ein unlesbarer Zeitstempel ergibt kein "Invalid Date"', () => {
    const zeile = urheberZeile({ attendance_set_by_name: 'Simon Luthe', attendance_set_at: 'kaputt' });
    expect(zeile).toBe('Eingetragen von Simon Luthe');
    expect(zeile).not.toContain('Invalid');
  });
});
