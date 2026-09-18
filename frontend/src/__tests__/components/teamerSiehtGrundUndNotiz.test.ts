// Das Team sieht Abmeldegrund und Notiz (Simon, 18.09.2026)
//
//   "Die Teamer sollen Abmeldung Grund und Notizen sehen. Wenn ich schreibe
//    geht 14 Uhr statt 15 Uhr müssen das alle sehen."
//
// DIE LAGE VORHER: In der Teilnehmerliste des Teams standen nur Name, Status
// und Jahrgang. Wer eine Notiz schrieb ("geht um 14 Uhr"), erreichte damit
// nur die Leitung -- ausgerechnet die Leute, die am Termin vor Ort sind und
// nach dem Kind schauen, erfuhren nichts davon.
//
// Verbucht wird weiterhin von der Leitung (requireAdmin). Es geht allein ums
// LESEN: Die Angaben liegen ohnehin in der Antwort von GET /events/:id
// (SELECT eb.* in routes/events/lesen.js), sie wurden nur nie angezeigt.
//
// Geprueft wird die Verdrahtung in der Teamer-Seite. Ein Rendertest waere
// hier teurer als er trägt: Die Liste haengt an geladenem Termin, Rolle und
// Buchungsstand -- drei Staende, die zu stellen mehr Annahmen einfuehrt als
// der Test absichert.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ohneKommentare = (quelle: string) =>
  quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const teamerSeite = ohneKommentare(
  readFileSync(resolve(process.cwd(), 'src/components/teamer/pages/TeamerEventsPage.tsx'), 'utf8')
);

describe('Teamer-Teilnehmerliste zeigt Grund und Notiz', () => {
  it('der Abmeldegrund steht in der Liste', () => {
    expect(teamerSeite).toContain('excuse_reason');
    expect(teamerSeite).toMatch(/Abgemeldet:/);
  });

  it('die Notiz steht in der Liste', () => {
    // Simons Beispiel: "geht 14 Uhr statt 15 Uhr".
    expect(teamerSeite).toContain('attendance_note');
    expect(teamerSeite).toMatch(/Notiz:/);
  });

  it('dazu steht, wer es eingetragen hat', () => {
    // Dieselben Hilfsfunktionen wie in der Leitungsansicht -- eine Regel,
    // ein Ort. urheberZeile fuer den Status samt Grund, notizUrheberZeile
    // fuer die Notiz (getrennte Urheber seit Migration 149).
    expect(teamerSeite).toContain('urheberZeile');
    expect(teamerSeite).toContain('notizUrheberZeile');
  });

  it('ein Check-in per QR-Code weist sich auch hier aus', () => {
    // Migration 151. Ohne diese Zeile stuende beim Selbst-Check-in gar
    // nichts -- und das sieht aus wie ein Altbestand.
    expect(teamerSeite).toContain('checkinZeile');
  });

  it('das Team bekommt dadurch keine Knoepfe zum Verbuchen', () => {
    // Lesen ja, verwalten nein: Teilnehmerverwaltung haengt im Backend an
    // requireAdmin (routes/events/index.js). Die Gegenprobe zur Erweiterung.
    expect(teamerSeite).not.toContain('showAttendanceActionSheet');
    expect(teamerSeite).not.toContain('handleRemoveParticipant');
    expect(teamerSeite).not.toMatch(/participants\/attendance/);
  });
});
