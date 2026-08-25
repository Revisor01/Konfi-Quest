import { describe, it, expect } from 'vitest';

// Bugreport 25.08.2026 (Konfi-Fahrt, Event 105): Die Teilnehmerzahl stand auf
// "0 / 21", obwohl 19 Konfis gebucht hatten. Ursache: Bei Pflichtterminen
// zeigte die erste Kachel die ANWESENDEN (attendance_status === 'present')
// statt der Angemeldeten — solange niemand als anwesend erfasst war, also 0.
// Der Nenner zaehlte ausserdem ALLE Buchungen, inklusive der Abgemeldeten:
// deshalb "21" bei 19 tatsaechlich Gebuchten und "17 Konfis" in der Liste.
//
// Echte Daten des Falls: 19 confirmed konfi, 2 teamer confirmed,
// 2 opted_out konfi, attendance_status ueberall NULL.
type P = { role_name?: string; status: string; attendance_status?: string | null };

const zaehle = (participants: P[]) => {
  const konfiOnly = participants.filter((p) => p.role_name !== 'teamer');
  const konfiConfirmed = konfiOnly.filter((p) => p.status === 'confirmed').length;
  const konfiOptedOut = konfiOnly.filter((p) => p.status === 'opted_out').length;
  const present = konfiOnly.filter((p) => p.attendance_status === 'present').length;
  return { zaehler: konfiConfirmed, nenner: konfiConfirmed + konfiOptedOut, present };
};

const fall = (): P[] => [
  ...Array.from({ length: 19 }, () => ({ role_name: 'konfi', status: 'confirmed', attendance_status: null })),
  ...Array.from({ length: 2 }, () => ({ role_name: 'teamer', status: 'confirmed', attendance_status: null })),
  ...Array.from({ length: 2 }, () => ({ role_name: 'konfi', status: 'opted_out', attendance_status: null })),
];

describe('Pflichttermin: Teilnehmerzahl', () => {
  it('zeigt die Angemeldeten, nicht die Anwesenden', () => {
    const { zaehler, present } = zaehle(fall());
    expect(zaehler).toBe(19);
    expect(present).toBe(0); // niemand erfasst — darf den Zaehler NICHT bestimmen
  });

  it('zaehlt Teamer:innen nicht in die Konfi-Zahl', () => {
    expect(zaehle(fall()).zaehler).toBe(19); // nicht 21
  });

  it('sinkt der Nenner, wenn sich jemand abmeldet', () => {
    const vorher = zaehle(fall());
    expect(`${vorher.zaehler}/${vorher.nenner}`).toBe('19/21');

    // Eine weitere Person meldet sich ab: 18 gebucht, 3 abgemeldet
    const nachher = zaehle([
      ...Array.from({ length: 18 }, () => ({ role_name: 'konfi', status: 'confirmed', attendance_status: null })),
      ...Array.from({ length: 2 }, () => ({ role_name: 'teamer', status: 'confirmed', attendance_status: null })),
      ...Array.from({ length: 3 }, () => ({ role_name: 'konfi', status: 'opted_out', attendance_status: null })),
    ]);
    expect(`${nachher.zaehler}/${nachher.nenner}`).toBe('18/21');
  });

  it('erfasste Anwesenheit aendert die Anmeldezahl nicht', () => {
    const mitAnwesenheit: P[] = [
      ...Array.from({ length: 19 }, (_, i) => ({
        role_name: 'konfi', status: 'confirmed',
        attendance_status: i < 15 ? 'present' : null,
      })),
      ...Array.from({ length: 2 }, () => ({ role_name: 'konfi', status: 'opted_out', attendance_status: null })),
    ];
    const r = zaehle(mitAnwesenheit);
    expect(r.zaehler).toBe(19);
    expect(r.present).toBe(15);
  });
});
