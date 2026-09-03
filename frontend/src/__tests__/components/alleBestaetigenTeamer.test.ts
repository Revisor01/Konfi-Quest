import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund H5 (26.08.2026): "Alle bestätigen" gab es nur über der Konfi-Sektion.
// Das Backend unterstützt die Sammelverbuchung für Teamer:innen seit dem
// 25.08. ausdrücklich (events.js:2782, `rolle: 'teamer'`, bewusst getrennt
// weil Teamer:innen Abzeichen aber KEINE Punkte bekommen) — das Frontend rief
// die Route ohne Body auf und bot den Knopf für Teamer:innen gar nicht an.
//
// Folge: Die Leitung musste Teamer:innen einzeln verbuchen, und der Termin
// blieb im "Verbuchen"-Reiter hängen, weil pending_bookings_count beide Rollen
// zählt (events.js:270-274). Bei reinen Teamer-Terminen fehlte der Knopf
// vollständig, weil die Konfi-Sektion dort gar nicht gerendert wird.
//
// Dieser Test liest die Quelldatei, statt die Ansicht zu rendern: Die
// Sichtbarkeit hängt an mehreren geladenen Datenständen (Teilnehmer, Rollen,
// Anwesenheitsstatus), die zu mocken mehr Annahmen einführen würde als der
// Test absichert. Geprüft wird deshalb die Verdrahtung.

const quelle = readFileSync(
  resolve(process.cwd(), 'src/components/admin/views/EventDetailView.tsx'),
  'utf8'
);

describe('Alle bestätigen: auch für Teamer:innen', () => {
  it('der Handler nimmt eine Rolle entgegen', () => {
    expect(quelle).toMatch(/rolle:\s*'konfi'\s*\|\s*'teamer'/);
  });

  it('die Rolle wird an das Backend geschickt', () => {
    // Vorher: api.put(url) ohne Body -> das Backend nahm immer 'konfi' an.
    expect(quelle).toContain("participants/attendance-all`, { rolle }");
  });

  it('es gibt einen Aufruf mit rolle teamer', () => {
    expect(quelle).toMatch(/handleConfirmAllAttendance\([^)]*,\s*'teamer'\)/);
  });

  it('der Knopf zaehlt unverbuchte Teamer:innen, nicht alle', () => {
    // teamerConfirmed = angemeldet; ohne attendance_status = noch nicht verbucht.
    // Zaehlte er alle, stuende dort eine Zahl, die nach dem Verbuchen bleibt.
    expect(quelle).toContain('teamerConfirmed.filter(p => !p.attendance_status).length');
  });

  it('der Knopf verschwindet, wenn nichts mehr offen ist', () => {
    expect(quelle).toMatch(/unprocessedTeamer === 0\)\s*return null/);
  });

  it('die Konfi-Sektion hat ihren Knopf unveraendert behalten', () => {
    // Gegenprobe: Der Umbau darf den funktionierenden Fall nicht mitnehmen.
    expect(quelle).toContain('confirmedParticipants.filter(p => !p.attendance_status).length');
  });

  it('die Rueckfrage nennt bei Teamer:innen keine Punktevergabe', () => {
    // Teamer:innen bekommen Abzeichen, aber keine Punkte. Stuende dort
    // "inkl. Punktevergabe", erwartete die Leitung etwas, das ausbleibt.
    expect(quelle).toContain('Das Team bekommt dabei keine Punkte.');
  });

  it('die Teamer-Sektion erscheint auch bei reinen Teamer-Terminen', () => {
    // Genau dort fehlte der Knopf vorher komplett, weil die Konfi-Sektion
    // bei teamer_only nicht gerendert wird.
    expect(quelle).toContain("eventData?.teamer_only) && (");
  });
});
