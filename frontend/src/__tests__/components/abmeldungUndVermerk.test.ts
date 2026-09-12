import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Simons Fall (12.09.2026): Eine Mutter meldet ihre Tochter telefonisch ab,
// wegen Krankheit — nicht in der App. In der Anwesenheitsliste gab es nur
// "anwesend" (falsch) und "abwesend" (richtig, sieht aber aus wie
// unentschuldigtes Fehlen). Der Grund ging verloren, und die Kolleginnen sahen
// nicht, dass abgemeldet wurde.
//
// Zweiter Fall: Eine Konfirmandin bittet, schon um 14 Uhr zu gehen. Sie war
// da, bekommt ihre Punkte, ist ANWESEND — der Vermerk soll trotzdem stehen.
//
// Zwei getrennte Felder (Entscheidung Simon): Ein gemeinsames haette je nach
// Status eine andere Bedeutung, und beide koennen nebeneinander stehen.
//
// Dieser Test liest die Quelldateien, statt die Ansicht zu rendern: Die
// Sichtbarkeit haengt an mehreren geladenen Datenstaenden (Teilnehmer, Rollen,
// Anwesenheitsstatus) — sie zu mocken fuehrte mehr Annahmen ein, als der Test
// absichert. Geprueft wird die Verdrahtung.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const detail = lies('src/components/admin/views/EventDetailView.tsx');
const abschnitte = lies('src/components/admin/views/EventDetailSections.tsx');
const matrixModal = lies('src/components/admin/modals/AttendanceMatrixModal.tsx');
const css = lies('src/theme/variables.css');
const typen = lies('src/types/event.ts');

describe('Abmeldung nachtragen (excused)', () => {
  it('der Handler kennt den dritten Status', () => {
    expect(detail).toMatch(/status:\s*'present'\s*\|\s*'absent'\s*\|\s*'excused'/);
  });

  it('das Auswahlmenue bietet "Abgemeldet" an', () => {
    expect(detail).toContain("showAbmeldungAlert(participant)");
    expect(detail).toContain("'Abmeldung bearbeiten' : 'Abgemeldet'");
  });

  it('der Grund wird als eigenes Feld erfragt und geschickt', () => {
    expect(detail).toContain("name: 'excuse_reason'");
    expect(detail).toContain('excuse_reason: texte.excuse_reason');
  });

  it('der Grund wird nur bei excused gesetzt', () => {
    // Sonst bliebe "krank" an einer Buchung stehen, die inzwischen auf
    // anwesend steht.
    expect(detail).toContain("const grund = status === 'excused' ? (texte?.excuse_reason || null) : null;");
  });

  it('die Zeile wird grau, nicht rot', () => {
    // Rot hiesse "hat gefehlt" — die Abmeldung war gemeldet.
    expect(detail).toContain("isExcused ? 'app-list-item--neutral'");
    expect(detail).toContain("isExcused ? 'app-icon-circle--neutral'");
    expect(detail).toContain("isExcused ? 'app-corner-badge--neutral'");
  });

  it('die grauen Klassen sind im CSS definiert', () => {
    expect(css).toContain('.app-list-item--neutral, ion-item.app-list-item--neutral { border-left-color: var(--app-color-neutral); }');
    expect(css).toContain('.app-corner-badge--neutral { background-color: var(--app-color-neutral); }');
    expect(css).toContain('.app-icon-circle--neutral { background-color: var(--app-color-neutral); }');
  });

  it('die Selbstabmeldung bleibt rot — sie wird nicht mit umgefaerbt', () => {
    // Gegenprobe: Der Umbau darf den funktionierenden Fall nicht mitnehmen.
    expect(detail).toContain("isOptedOut ? 'app-list-item--danger'");
  });

  it('der Grund steht in der Teilnehmerliste, nicht nur im Menue', () => {
    // "Damit das auch die Kolleginnen sehen."
    expect(detail).toContain('{isExcused && participant.excuse_reason && (');
    expect(abschnitte).toContain('{istAbgemeldet && participant.excuse_reason && (');
  });

  it('der Zeitfenster-Abschnitt faerbt ebenfalls grau', () => {
    expect(abschnitte).toContain("const istAbgemeldet = participant.attendance_status === 'excused';");
    expect(abschnitte).toContain("istAbgemeldet ? 'app-list-item--neutral'");
  });
});

describe('Vermerk (unabhaengig vom Status)', () => {
  it('wird bei JEDEM gesetzten Status angeboten, nicht nur bei excused', () => {
    expect(detail).toContain('if (participant.attendance_status) {');
    expect(detail).toContain("'Vermerk bearbeiten' : 'Vermerk hinzufügen'");
  });

  it('ist ein eigenes Feld, getrennt vom Grund', () => {
    expect(detail).toContain("name: 'attendance_note'");
    expect(detail).toContain("name: 'excuse_reason'");
  });

  it('aendert den Status nicht', () => {
    // showVermerkAlert schickt den vorhandenen Status mit, weil die Route
    // ihn verlangt — es ist derselbe wie zuvor.
    expect(detail).toContain('handleAttendanceUpdate(participant, status, {');
  });

  it('behaelt den Grund, wenn nur der Vermerk geaendert wird', () => {
    // Die Route setzt excuse_reason bei jedem 'excused'-Schreiben neu —
    // ohne Mitschicken waere er nach dem Vermerk-Speichern weg.
    expect(detail).toContain("...(status === 'excused' ? { excuse_reason: participant.excuse_reason || '' } : {})");
  });

  it('steht in der Teilnehmerliste bei jedem Status', () => {
    // Nicht an isExcused gebunden: "ging um 14 Uhr" gilt bei Anwesenheit.
    expect(detail).toContain('{participant.attendance_note && (');
    expect(abschnitte).toContain('{participant.attendance_note && (');
  });
});

describe('Typen tragen die neuen Felder', () => {
  it('attendance_status kennt excused', () => {
    expect(typen).toMatch(/attendance_status\?:\s*'present'\s*\|\s*'absent'\s*\|\s*'excused'\s*\|\s*null/);
  });

  it('excuse_reason und attendance_note sind deklariert', () => {
    expect(typen).toContain('excuse_reason?: string | null;');
    expect(typen).toContain('attendance_note?: string | null;');
  });
});

describe('Anwesenheitsmatrix zeigt die Abmeldung', () => {
  it('das Modal kennt den Zellstatus und zeichnet ihn grau', () => {
    expect(matrixModal).toContain("s === 'opted_out' || s === 'excused' ? ICON_ENTFERNEN_GEFUELLT");
    expect(css).toContain('.attendance-matrix__dot--excused {');
  });

  it('die Legende benennt beide Abmelde-Wege getrennt', () => {
    expect(matrixModal).toContain('<span>Abgemeldet</span>');
    expect(matrixModal).toContain('<span>Abgemeldet (nachgetragen)</span>');
  });

  it('Grund und Vermerk haengen als Hinweis an der Zelle', () => {
    expect(matrixModal).toContain('title={hinweis || undefined}');
  });

  it('der leere Statistik-Rueckfall kennt excused', () => {
    // Sonst stuende dort undefined, sobald eine Zeile keine Stats hat.
    expect(matrixModal).toContain('{ present: 0, absent: 0, excused: 0, open: 0, opted_out: 0, nenner: 0 }');
  });
});
