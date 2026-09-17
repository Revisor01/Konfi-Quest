// Teamer-Teilnehmerliste: sichtbar, aber nur lesend (16.09.2026)
//
// DER BEFUND (Simon am Geraet, woertlich): "teamer sehen die tn liste nicht!"
//
// URSACHE: Die Teamer-Ansicht las ihren Termin ausschliesslich aus der LISTE
// (GET /events). Die traegt nur Zahlen -- die Namen stehen allein in der
// Detailantwort GET /events/:id, und die hat diese Seite nie abgerufen. Am
// Backend lag es nicht (routes/events/lesen.js liefert die Liste an alle
// ausser Konfis, siehe backend/tests/routes/teamerSiehtTeilnehmerliste.test.js).
//
// DIE ZWEITE HAELFTE: Simon hat am selben Tag entschieden, dass Termine
// Leitungssache sind -- SEHEN ist nicht VERWALTEN. Die Liste darf deshalb
// keine Wisch-Aktionen, keine Action-Sheets und keine Verbuchungs-Knoepfe
// bekommen. Der verbotene Fall wird hier am Quelltext geprueft: ein
// versehentlich eingebauter Knopf faellt im Rendering-Test nicht auf, wenn
// er hinter einer Bedingung steht.
//
// GEGENPROBE (durchgefuehrt 16.09.2026): Nimmt man den Abruf von
// `/events/${selectedEvent.id}` wieder heraus, fallen die Tests 1 und 2.
// Baut man eine IonItemSliding-Zeile mit showAttendanceActionSheet ein (der
// Stand der Leitungsansicht), faellt Test 4.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const quelle = readFileSync(
  resolve(__dirname, '../../components/teamer/pages/TeamerEventsPage.tsx'),
  'utf-8'
);

// Kommentare weg: Die Datei begruendet die Entscheidung im Fliesstext und
// nennt dabei genau die Begriffe, nach denen hier gesucht wird. Ohne diesen
// Schritt waere der Test schon durch seine eigene Begruendung gruen.
const ohneKommentare = quelle
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('Teamer-Teilnehmerliste', () => {
  // ---- ERLAUBTER FALL: SEHEN ------------------------------------------
  it('holt die Teilnehmerliste aus der Detailantwort', () => {
    // Seit dem 17.09.2026 holt ladeTerminDetail(eventId) die Detailantwort
    // -- eine Stelle fuer Oeffnen, Zu-/Absage und Herunterziehen.
    expect(ohneKommentare).toMatch(/api\.get\(`\/events\/\$\{eventId\}`\)/);
    expect(ohneKommentare).toMatch(/ladeTerminDetail\(selectedEvent\.id\)/);
    expect(ohneKommentare).toMatch(/participants/);
    expect(ohneKommentare).toMatch(/setEventTeilnehmer/);
  });

  it('zeigt die Namen der Teilnehmenden an', () => {
    expect(ohneKommentare).toMatch(/participant_name/);
    expect(ohneKommentare).toMatch(/eventTeilnehmer\.length/);
  });

  // Der Status einer Zeile kommt aus DERSELBEN Quelle wie in beiden
  // Leitungs-Listen. Rechnete die Teamer-Liste selbst, hiesse dieselbe
  // Abmeldung hier anders als dort -- genau der Fehler, den
  // utils/teilnahmeStatus.ts am 15.09.2026 abgestellt hat.
  it('nimmt Text und Farbe aus der gemeinsamen Quelle', () => {
    expect(ohneKommentare).toMatch(/teilnahmeDarstellung/);
    expect(ohneKommentare).toMatch(/from '\.\.\/\.\.\/\.\.\/utils\/teilnahmeStatus'/);
  });

  // ---- VERBOTENER FALL: AENDERN ---------------------------------------
  it('bietet keine Verbuchung und keine Wisch-Aktionen an der Liste', () => {
    // Die Werkzeuge der Leitungsansicht duerfen hier gar nicht vorkommen.
    expect(ohneKommentare).not.toMatch(/showAttendanceActionSheet/);
    expect(ohneKommentare).not.toMatch(/IonItemSliding/);
    expect(ohneKommentare).not.toMatch(/attendance-all/);
    expect(ohneKommentare).not.toMatch(/handleRemoveParticipant/);
    expect(ohneKommentare).not.toMatch(/handlePromoteParticipant/);
    // Und kein Schreibzugriff auf die Buchungen eines Termins.
    expect(ohneKommentare).not.toMatch(/api\.put\(`\/events\/[^`]*participants/);
    expect(ohneKommentare).not.toMatch(/api\.delete\(`\/events\/[^`]*bookings/);
  });
});
