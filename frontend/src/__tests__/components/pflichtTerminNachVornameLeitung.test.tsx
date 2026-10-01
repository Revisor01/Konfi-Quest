// Konfis eines Pflicht-Termins nach Vornamen (01.10.2026), Leitungsansicht.
//
// Rückmeldung aus einer Gemeinde, über Simon: "bei Pflichtevents, bei anderen
// könnte ja die Anmeldereihenfolge im Zweifel relevant sein - kann da die
// Konfiliste nach Vornamen sortiert sein? Wie in der Konfiansicht?" Die
// Leitung gleicht die Liste häufig mit einer händischen ab, und das Suchen
// kostete Zeit. Bis dahin stand die Liste in der Reihenfolge der Buchungen.
//
// Regel: Pflicht-Termin -> nach Name (wie die Konfi-Liste, Name beginnt mit
// dem Vornamen); sonst bleibt die Anmeldereihenfolge (Warteliste, "wer war
// zuerst da").
import { describe, it, expect, beforeEach } from 'vitest';
import { zustand, zuruecksetzen, termin, teilnahme, oeffne } from './gerueste/leitungTerminDetail';
import { konfisInReihenfolge } from '../../utils/teilnehmerReihenfolge';

beforeEach(zuruecksetzen);

// Reihenfolge der Buchungen, wie der Server sie liefert.
const GEBUCHT = [
  teilnahme(1, 'Zoe Zander'),
  teilnahme(2, 'Anna Albers'),
  teilnahme(3, 'Ömer Öztürk'),
  teilnahme(4, 'Ben Bauer'),
  teilnahme(5, 'Ole Olsen', { status: 'excused', attendance_status: 'excused' }),
];

/** Reihenfolge, in der die Namen in der gerenderten Ansicht stehen. */
const reihenfolge = (namen: string[]) => {
  const text = document.body.textContent || '';
  return [...namen].sort((a, b) => text.indexOf(a) - text.indexOf(b));
};
const NAMEN = GEBUCHT.map((p) => p.participant_name);

describe('Konfi-Liste eines Termins (Leitung)', () => {
  it('Pflicht-Termin: nach Vornamen, Umlaute an ihrer Stelle, Abgemeldete mittendrin', async () => {
    zustand.detail = termin({ mandatory: true, participants: GEBUCHT });
    await oeffne();
    expect(reihenfolge(NAMEN)).toEqual(['Anna Albers', 'Ben Bauer', 'Ole Olsen', 'Ömer Öztürk', 'Zoe Zander']);
  });

  it('Pflicht-Termin mit Zeitfenstern: auch innerhalb eines Fensters nach Vornamen', async () => {
    const slot = { id: 31, start_time: '2026-10-10T08:00:00Z', end_time: '2026-10-10T10:00:00Z', max_participants: 10, registered_count: 3 };
    zustand.detail = termin({
      mandatory: true, has_timeslots: true, timeslots: [slot],
      participants: [
        teilnahme(1, 'Zoe Zander', { timeslot_id: 31 }),
        teilnahme(2, 'Anna Albers', { timeslot_id: 31 }),
        teilnahme(4, 'Ben Bauer', { timeslot_id: 31 }),
      ],
    });
    await oeffne();
    expect(reihenfolge(['Zoe Zander', 'Anna Albers', 'Ben Bauer'])).toEqual(['Anna Albers', 'Ben Bauer', 'Zoe Zander']);
  });

  it('anderer Termin: Anmeldereihenfolge bleibt', async () => {
    zustand.detail = termin({ mandatory: false, participants: GEBUCHT });
    await oeffne();
    expect(reihenfolge(NAMEN)).toEqual(NAMEN);
  });
});

describe('konfisInReihenfolge', () => {
  it('Pflicht: sortiert eine Kopie, die Eingabe bleibt unverändert', () => {
    const eingabe = [{ participant_name: 'b' }, { participant_name: 'A' }, { participant_name: 'c' }];
    expect(konfisInReihenfolge(eingabe, true).map((p) => p.participant_name)).toEqual(['A', 'b', 'c']);
    expect(eingabe.map((p) => p.participant_name)).toEqual(['b', 'A', 'c']);
  });

  it('kein Pflicht-Termin (auch unbekannt): genau die Eingabe', () => {
    const eingabe = [{ participant_name: 'b' }, { participant_name: 'A' }];
    expect(konfisInReihenfolge(eingabe, false)).toBe(eingabe);
    expect(konfisInReihenfolge(eingabe, undefined)).toBe(eingabe);
  });

  it('fehlender Name stört die Sortierung nicht', () => {
    const eingabe = [{ participant_name: 'Mia' }, { participant_name: undefined as unknown as string }];
    expect(konfisInReihenfolge(eingabe, true).map((p) => p.participant_name)).toEqual([undefined, 'Mia']);
  });
});
