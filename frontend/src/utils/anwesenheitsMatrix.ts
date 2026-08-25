// Zellstatus-Logik der Anwesenheitsmatrix (AttendanceMatrixModal).
//
// Befund 4 (25.08.2026): Abgemeldete ('opted_out') wurden als "ausstehend"
// (open) dargestellt — Abgemeldete sind aber KEINE ausstehenden Fälle, ihre
// Abmeldung ist eine abgeschlossene Rückmeldung. Sie bekommen deshalb einen
// eigenen Zellstatus und zählen nicht in den Pflicht-Nenner (konsistent zum
// Kachel-Fix 0db13f09 im Event-Detail und zur Anwesenheitsliste per E-Mail).

export type MatrixZellStatus = 'present' | 'absent' | 'opted_out' | 'open';

export interface MatrixBookingLike {
  status: string | null;
  attendance_status: 'present' | 'absent' | null;
}

// Status einer einzelnen Zelle (Konfi x Pflichttermin).
// Reihenfolge: Abmeldung schlägt eine (fälschlich) erfasste Anwesenheit —
// wer abgemeldet ist, wird nicht verbucht.
export const getZellStatus = (b: MatrixBookingLike | undefined): MatrixZellStatus => {
  if (!b) return 'open';
  if (b.status === 'opted_out') return 'opted_out';
  if (b.attendance_status === 'present') return 'present';
  if (b.attendance_status === 'absent') return 'absent';
  return 'open';
};

export interface MatrixZeilenStats {
  present: number;
  absent: number;
  opted_out: number;
  open: number;
  // Nenner der Summenspalte: Pflichttermine OHNE die abgemeldeten
  nenner: number;
}

// Zusammenfassung einer Konfi-Zeile über alle Pflichttermine.
export const berechneZeilenStats = (zellen: MatrixZellStatus[]): MatrixZeilenStats => {
  const stats: MatrixZeilenStats = { present: 0, absent: 0, opted_out: 0, open: 0, nenner: 0 };
  zellen.forEach(z => { stats[z]++; });
  stats.nenner = zellen.length - stats.opted_out;
  return stats;
};
