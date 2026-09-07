import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund N6/6 (Drei-Ansichten-Bericht): Die Abmeldefrist (2 Tage) ist
// hartcodiert und nur im Konfi-Zweig sichtbar -- fuer die Leitung unsichtbar.
//
// Simons Entscheidung (27.08.2026): Der Wert BLEIBT hartcodiert, aber die
// Regel muss benannt werden -- im Handbuch und in der App.
//
// Warum das mehr als Kosmetik ist: Die Konfi sah die Regel bisher erst, wenn
// sie schon abgelaufen war ("Abmelden geht nur bis 2 Tage vorher"). Die
// Leitung erfuhr nie, dass es sie gibt, und wunderte sich, warum sich jemand
// nicht mehr austragen kann -- das Handbuch fuehrt genau diese Frage als
// Problemfall auf (70-termine.md).
//
// NICHT zu verwechseln mit checkin_window: Das ist das Zeitfenster fuer den
// QR-Code und pro Termin einstellbar. Die Abmeldefrist ist etwas anderes.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const adminDetail = lies('src/components/admin/views/EventDetailSections.tsx');
const konfiDetail = lies('src/components/konfi/views/EventDetailView.tsx');
const handbuch = lies('../docs/handbuch/70-termine.md');
const backend = lies('../backend/routes/konfi.js');
// Der Abmeldeweg des TEAMS -- bewusst ohne Frist (siehe Test unten).
const teamerAbmeldung = lies('../backend/routes/events/buchung.js');

describe('Abmeldefrist ist benannt (N6/6)', () => {
  it('die Leitung sieht die Regel im Termin-Detail', () => {
    expect(adminDetail).toContain('Konfis können sich bis 2 Tage vorher selbst abmelden');
  });

  it('bei "Nur Team" steht der Konfi-Satz nicht da (Befund 06.09.2026)', () => {
    // Der Satz hing nur an `!eventData.mandatory`. An einem teamer_only-Termin
    // nehmen aber gar keine Konfis teil -- die Leitung las eine Regel ueber
    // Leute, die es bei diesem Termin nicht gibt. Zwanzig Zeilen weiter stand
    // `nurTeamer` bereits und schuetzte die Teilnehmerzeile korrekt; der
    // Abmeldetext war beim Absichern uebersehen worden.
    const block = adminDetail.slice(
      adminDetail.indexOf('Anmeldezeitraum — wie Zeitfenster aufgebaut'),
      adminDetail.indexOf('TN gesamt - Konfis und Teamer getrennt')
    );
    expect(block).toContain('{!eventData.teamer_only && (');
    // Und der Satz steht INNERHALB dieser Bedingung, nicht davor.
    expect(block.indexOf('{!eventData.teamer_only && ('))
      .toBeLessThan(block.indexOf('Konfis können sich bis 2 Tage vorher selbst abmelden'));
  });

  it('fuers Team wird KEINE Frist behauptet', () => {
    // Gegenprobe zur naheliegenden "Korrektur": Eine eigene Formulierung
    // ("Das Team kann sich bis 2 Tage vorher abmelden") waere eine zweite
    // Falschaussage. Die Frist steckt allein in der Konfi-Abmeldung
    // (konfi.js, DELETE /konfi/events/:id/register); der Weg des Teams
    // (events/buchung.js, DELETE /:id/book) hat keine Fristpruefung --
    // Teamer:innen koennen sich jederzeit austragen.
    expect(teamerAbmeldung).not.toContain('2 * 24 * 60 * 60 * 1000');
    expect(teamerAbmeldung).not.toContain('nur bis 2 Tage vor dem Event');
    expect(adminDetail).not.toContain('Das Team kann sich bis 2 Tage vorher');
  });

  it('sie steht beim Anmeldezeitraum, nicht irgendwo', () => {
    // Dort liest die Leitung ohnehin, wann an- und abgemeldet werden kann.
    const block = adminDetail.slice(
      adminDetail.indexOf('Anmeldezeitraum — wie Zeitfenster aufgebaut'),
      adminDetail.indexOf('TN gesamt - Konfis und Teamer getrennt')
    );
    expect(block).toContain('bis 2 Tage vorher selbst abmelden');
  });

  it('die Konfi-Meldung bleibt bestehen', () => {
    // Gegenprobe: Der Hinweis fuer die Leitung ersetzt die Meldung an die
    // Konfi nicht, er kommt dazu.
    expect(konfiDetail).toContain('Abmelden geht nur bis 2 Tage vorher');
  });

  it('das Handbuch erklaert die Regel im Anmelde-Kapitel', () => {
    expect(handbuch).toContain('Bis wann sich Konfis wieder abmelden können');
    expect(handbuch).toContain('Zwei Tage vor dem Termin ist Schluss');
  });

  it('das Handbuch grenzt sie gegen den QR-Code ab', () => {
    // Die Verwechslung lag nahe genug, dass sie beim Besprechen passiert ist.
    const abschnitt = handbuch.slice(
      handbuch.indexOf('Bis wann sich Konfis wieder abmelden können'),
      handbuch.indexOf('## Plätze und Warteliste')
    );
    expect(abschnitt).toContain('QR-Code');
    expect(abschnitt).toContain('fest eingestellt');
  });

  it('das Handbuch nennt den Ausweg fuer die Leitung', () => {
    // Wer kurzfristig absagt, muss ausgetragen werden koennen -- sonst waere
    // die Regel ein Problem statt einer Hilfe.
    const abschnitt = handbuch.slice(
      handbuch.indexOf('Bis wann sich Konfis wieder abmelden können'),
      handbuch.indexOf('## Plätze und Warteliste')
    );
    expect(abschnitt).toContain('jederzeit entfernen');
  });

  it('Frontend und Backend nennen dieselbe Frist', () => {
    // Die Zusicherung hinter allem: Zwei hartcodierte Stellen, die
    // zusammenpassen muessen. Laufen sie auseinander, sperrt die App frueher
    // oder spaeter als der Server -- und der Text stimmt fuer keine Seite.
    expect(konfiDetail).toContain('2 * 24 * 60 * 60 * 1000');
    expect(backend).toContain('2 * 24 * 60 * 60 * 1000');
  });
});
