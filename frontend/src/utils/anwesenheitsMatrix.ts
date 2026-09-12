// Zellstatus-Logik der Anwesenheitsmatrix (AttendanceMatrixModal).
//
// Befund 4 (25.08.2026): Abgemeldete ('opted_out') wurden als "ausstehend"
// (open) dargestellt — Abgemeldete sind aber KEINE ausstehenden Fälle, ihre
// Abmeldung ist eine abgeschlossene Rückmeldung. Sie bekommen deshalb einen
// eigenen Zellstatus und zählen nicht in den Pflicht-Nenner (konsistent zum
// Kachel-Fix 0db13f09 im Event-Detail und zur Anwesenheitsliste per E-Mail).
//
// 'excused' (12.09.2026) ist der zweite Weg zur Abmeldung: Nicht die Konfi
// selbst hat sich in der App abgemeldet, sondern die Leitung trägt nach, was
// ausserhalb gemeldet wurde ("krank, die Mutter hat angerufen"). Fachlich ist
// das dieselbe Aussage — keine Punkte, kein Fehlen im Sinne von
// unentschuldigt — und die Matrix behandelt es deshalb wie 'opted_out': eigener
// Zellstatus, grauer Punkt, nicht im Pflicht-Nenner.

export type MatrixZellStatus = 'present' | 'absent' | 'excused' | 'opted_out' | 'open';

export interface MatrixBookingLike {
  status: string | null;
  attendance_status: 'present' | 'absent' | 'excused' | null;
}

// Status einer einzelnen Zelle (Konfi x Pflichttermin).
// Reihenfolge: Abmeldung schlägt eine (fälschlich) erfasste Anwesenheit —
// wer abgemeldet ist, wird nicht verbucht.
export const getZellStatus = (b: MatrixBookingLike | undefined): MatrixZellStatus => {
  if (!b) return 'open';
  if (b.status === 'opted_out') return 'opted_out';
  if (b.attendance_status === 'present') return 'present';
  if (b.attendance_status === 'absent') return 'absent';
  if (b.attendance_status === 'excused') return 'excused';
  return 'open';
};

export interface MatrixZeilenStats {
  present: number;
  absent: number;
  excused: number;
  opted_out: number;
  open: number;
  // Nenner der Summenspalte: Pflichttermine OHNE die abgemeldeten
  // (beide Wege: Selbstabmeldung und von der Leitung nachgetragene)
  nenner: number;
}

// Zusammenfassung einer Konfi-Zeile über alle Pflichttermine.
export const berechneZeilenStats = (zellen: MatrixZellStatus[]): MatrixZeilenStats => {
  const stats: MatrixZeilenStats = { present: 0, absent: 0, excused: 0, opted_out: 0, open: 0, nenner: 0 };
  zellen.forEach(z => { stats[z]++; });
  stats.nenner = zellen.length - stats.opted_out - stats.excused;
  return stats;
};
