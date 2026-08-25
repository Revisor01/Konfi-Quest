import { describe, it, expect } from 'vitest';
import { getZellStatus, berechneZeilenStats, MatrixZellStatus } from '../../utils/anwesenheitsMatrix';

// Befund 4 (25.08.2026, Prod-Events 105/129/132): Die Anwesenheitsmatrix
// behandelte Abgemeldete ('opted_out') als "ausstehend" — sie waren von
// "noch nicht verbucht" nicht unterscheidbar, und der Nenner der Summenspalte
// zählte auch Termine, von denen sich der Konfi abgemeldet hatte.

describe('Anwesenheitsmatrix: Zellstatus', () => {
  it('keine Buchung -> open (ausstehend)', () => {
    expect(getZellStatus(undefined)).toBe('open');
  });

  it('confirmed ohne Anwesenheit -> open', () => {
    expect(getZellStatus({ status: 'confirmed', attendance_status: null })).toBe('open');
  });

  it('anwesend -> present, gefehlt -> absent', () => {
    expect(getZellStatus({ status: 'confirmed', attendance_status: 'present' })).toBe('present');
    expect(getZellStatus({ status: 'confirmed', attendance_status: 'absent' })).toBe('absent');
  });

  it('Abgemeldete sind opted_out, NICHT open (Befund 4)', () => {
    expect(getZellStatus({ status: 'opted_out', attendance_status: null })).toBe('opted_out');
  });

  it('Abmeldung schlägt eine fälschlich erfasste Anwesenheit', () => {
    expect(getZellStatus({ status: 'opted_out', attendance_status: 'present' })).toBe('opted_out');
  });
});

describe('Anwesenheitsmatrix: Zeilen-Summe', () => {
  // Prod-Fall Event 105: Konfi mit Abmeldung an einem von vier Pflichtterminen
  it('Nenner zählt abgemeldete Termine nicht mit', () => {
    const zellen: MatrixZellStatus[] = ['present', 'present', 'opted_out', 'open'];
    const stats = berechneZeilenStats(zellen);
    expect(stats.present).toBe(2);
    expect(stats.opted_out).toBe(1);
    expect(stats.open).toBe(1);
    expect(stats.nenner).toBe(3); // 4 Termine minus 1 Abmeldung
  });

  it('ohne Abmeldungen bleibt der Nenner die Terminanzahl', () => {
    const stats = berechneZeilenStats(['present', 'absent', 'open']);
    expect(stats.nenner).toBe(3);
    expect(stats.absent).toBe(1);
  });

  it('leere Zeile: alles 0', () => {
    const stats = berechneZeilenStats([]);
    expect(stats).toEqual({ present: 0, absent: 0, opted_out: 0, open: 0, nenner: 0 });
  });
});
