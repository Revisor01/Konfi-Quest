// "Eintrag zuruecksetzen" steht im Menue -- und nur bei gesetztem Eintrag
// (16.09.2026)
//
// Simons Befund: Eine eingetragene Abmeldung liess sich nicht mehr
// zuruecknehmen. Das Backend kann es jetzt (attendance_status null); dieser
// Test haelt fest, dass die Oberflaeche den Weg auch anbietet -- und dass sie
// ihn NICHT anbietet, wo es nichts zurueckzusetzen gibt.
//
// WICHTIG -- DER TEST DARF NICHT AM KOMMENTAR ANSCHLAGEN: Der Quelltext wird
// vor der Pruefung von Kommentaren befreit (ohneKommentare). Die Gegenprobe
// dazu steht unten.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ohneKommentare } from './abgesagteTermineAnsichten.test';

const DETAIL = 'src/components/admin/views/EventDetailView.tsx';
const code = ohneKommentare(readFileSync(resolve(process.cwd(), DETAIL), 'utf8'));

// Der Block, der den Knopf baut -- von seiner Bedingung bis zur schliessenden
// Klammer. Alles, was dieser Test behauptet, muss DARIN stehen.
const ruecksetzBlock = (() => {
  const start = code.indexOf("text: 'Eintrag zurücksetzen'");
  expect(start).toBeGreaterThan(-1);
  // Von hier aus rueckwaerts bis zur zugehoerigen if-Bedingung.
  const bedingungStart = code.lastIndexOf('if (', start);
  return code.slice(bedingungStart, code.indexOf('});', start) + 3);
})();

describe('Action Sheet der Teilnehmerliste: Eintrag zuruecksetzen', () => {
  it('bietet den Eintrag an', () => {
    expect(code).toContain("text: 'Eintrag zurücksetzen'");
  });

  it('zeigt ihn nur, wenn ein Anwesenheitsstatus gesetzt ist', () => {
    // Die Bedingung des Blocks ist genau das Vorhandensein des Status.
    expect(ruecksetzBlock.startsWith('if (participant.attendance_status)')).toBe(true);
  });

  it('schickt null, nicht einen vierten Status', () => {
    // Ein erfundener Status wie 'reset' oder 'offen' waere ein zweiter
    // Ausdruck fuer "noch nicht verbucht" -- alle Abfragen, die heute
    // `attendance_status IS NULL` schreiben, muessten ihn zusaetzlich kennen.
    expect(ruecksetzBlock).toContain('handleAttendanceUpdate(participant, null)');
  });

  it('ist als folgenschwer gekennzeichnet', () => {
    // Der Eintrag nimmt Punkte zurueck und loescht Grund samt Urheber --
    // dieselbe Art Folge wie "Entfernen", das ebenfalls rot steht.
    expect(ruecksetzBlock).toContain("role: 'destructive'");
  });

  it('der Aufruf-Weg akzeptiert null ueberhaupt', () => {
    // Ohne diese Signatur uebersetzt der Knopf gar nicht erst -- der Test
    // haelt sie fest, damit sie beim Aufraeumen nicht wieder verengt wird.
    expect(code).toContain("status: 'present' | 'absent' | 'excused' | null");
  });

  // GEGENPROBE zum Kommentar-Problem: Ein Vorkommen im Kommentar darf nicht
  // zaehlen. Der Wortlaut steht auch in den Erklaertexten der Datei -- nach
  // dem Entfernen der Kommentare bleibt genau EIN Vorkommen uebrig, das des
  // Knopfes selbst.
  it('zaehlt nur echten Code, keine Kommentare', () => {
    const roh = readFileSync(resolve(process.cwd(), DETAIL), 'utf8');
    const imKommentar = "// text: 'Eintrag zurücksetzen' -- nur ein Beispiel";
    expect(ohneKommentare(`${roh}\n${imKommentar}\n`).includes(imKommentar)).toBe(false);
    const treffer = code.match(/text: 'Eintrag zurücksetzen'/g) || [];
    expect(treffer).toHaveLength(1);
  });
});
