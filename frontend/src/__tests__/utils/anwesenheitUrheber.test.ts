import { describe, it, expect } from 'vitest';
import { urheberZeile, notizUrheberZeile } from '../../utils/anwesenheitUrheber';

// Simon (13.09.2026): "vielleicht wäre es noch gut zu wissen wer den Eintrag
// gemacht hat" — in der Teilnehmerliste, klein unter Grund und Notiz.
//
// Der schwierige Teil ist nicht das Formatieren, sondern das Fehlen: NULL
// heisst UNBEKANNT, nicht NIEMAND. Buchungen von vor Migration 148 und
// Selbst-Check-ins per QR-Code haben keinen Urheber.
//
// ZWEI URHEBER (Migration 149): Simons Rueckfrage "Was ist wenn einer einen
// Vermerk schreibt und einer den Grund" liess sich mit einem Namen nicht
// beantworten. Status und Notiz haben seither je eigene Angaben, und jede
// Zeile nennt ihren eigenen Urheber.

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

  it('liest NUR das Status-Paar, nie das der Notiz', () => {
    // Gegenprobe zur Trennung: Sonst stuende der Notiz-Name unter dem
    // Abmeldegrund — genau der Fehler, den Migration 149 behebt.
    expect(urheberZeile({
      note_set_by_name: 'Anna Meier',
      note_set_at: '2026-09-13T10:00:00Z'
    })).toBeNull();
  });
});

describe('Urheber-Zeile der Notiz', () => {
  it('nennt Namen und kurzes Datum, mit eigenem Wortlaut', () => {
    // "Notiz von ..." statt "Eingetragen von ...": Stehen beide Zeilen
    // untereinander, muss klar sein, welcher Name zu welchem Eintrag gehoert.
    expect(notizUrheberZeile({
      note_set_by_name: 'Anna Meier',
      note_set_at: '2026-09-13T10:00:00Z'
    })).toBe('Notiz von Anna Meier, 13.09.');
  });

  it('ohne Namen faellt die Zeile weg — nicht "unbekannt"', () => {
    // Notizen von vor Migration 149 tragen keinen eigenen Urheber.
    expect(notizUrheberZeile({ note_set_by_name: null, note_set_at: null })).toBeNull();
    expect(notizUrheberZeile({})).toBeNull();
    expect(notizUrheberZeile(null)).toBeNull();
    expect(notizUrheberZeile(undefined)).toBeNull();
  });

  it('ohne Zeitpunkt bleibt der Name allein stehen', () => {
    expect(notizUrheberZeile({ note_set_by_name: 'Anna Meier', note_set_at: null }))
      .toBe('Notiz von Anna Meier');
  });

  it('liest NUR das Notiz-Paar, nie das des Status', () => {
    // Die Gegenrichtung derselben Gegenprobe.
    expect(notizUrheberZeile({
      attendance_set_by_name: 'Simon Luthe',
      attendance_set_at: '2026-09-13T10:00:00Z'
    })).toBeNull();
  });

  it('beide Zeilen koennen verschiedene Namen tragen', () => {
    // Simons Fall: A traegt den Grund ein, B schreibt die Notiz.
    const buchung = {
      attendance_set_by_name: 'Simon Luthe',
      attendance_set_at: '2026-09-13T10:00:00Z',
      note_set_by_name: 'Anna Meier',
      note_set_at: '2026-09-14T10:00:00Z'
    };
    expect(urheberZeile(buchung)).toBe('Eingetragen von Simon Luthe, 13.09.');
    expect(notizUrheberZeile(buchung)).toBe('Notiz von Anna Meier, 14.09.');
  });
});
