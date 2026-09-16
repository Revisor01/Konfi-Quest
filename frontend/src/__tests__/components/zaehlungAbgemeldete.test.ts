// KEINE ANSICHT ZAEHLT ABGEMELDETE ALS TEILNEHMENDE (16.09.2026)
//
// Der Befund: Simons Pflichttermin hatte 13 eingetragene Konfis, eine hatte
// sich selbst abgemeldet, eine war von der Leitung abgemeldet worden. Die
// Kacheln zeigten richtig "11 von 13 TN". Die Rueckfrage vor dem Absagen,
// im selben Bild, sagte "13 Konfis angemeldet".
//
// Die Ursache war eine einzige Zeile, die ohne Statusfilter zaehlte:
//
//   get konfiAnzahl() { return participants.filter(p => p.role_name === 'konfi').length; }
//
// Sie gehoert zu einer Fehlerklasse, die im Repo schon mehrfach zugeschlagen
// hat: Eine Ansicht rechnet selbst, statt die eine Regel zu benutzen. Der
// Backend-Test daneben (backend/tests/routes/zaehlungAbgemeldete.test.js)
// prueft die Zahlen, die der Server liefert. Dieser hier prueft die
// Gegenrichtung: dass keine Ansicht sie wieder selbst erfindet.
//
// WICHTIG -- DER TEST DARF NICHT AM KOMMENTAR ANSCHLAGEN: Im Repo ist
// mehrfach passiert, dass eine Pruefung auf eine Zeichenkette ansprang, die
// nur in einem Kommentar stand. Die Dateien werden deshalb vorher von
// Kommentaren befreit. Die Gegenprobe dazu steht unten.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { ohneKommentare } from './abgesagteTermineAnsichten.test';

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
const code = (pfad: string) => ohneKommentare(lies(pfad));

const ADMIN_DETAIL = 'src/components/admin/views/EventDetailView.tsx';
const ADMIN_SECTIONS = 'src/components/admin/views/EventDetailSections.tsx';
const KONFI_DETAIL = 'src/components/konfi/views/EventDetailView.tsx';

describe('Abgemeldete zaehlen nirgends als Teilnehmende', () => {
  it('die Rueckfrage vor dem Absagen zaehlt nur Angemeldete', () => {
    const quelle = code(ADMIN_DETAIL);

    // Der konkrete Fehler: ein Rollenfilter ohne Statusfilter.
    expect(quelle).not.toMatch(
      /konfiAnzahl\(\)\s*\{\s*return participants\.filter\(p => p\.role_name === 'konfi'\)\.length/
    );

    // Und die Regel positiv: Der Zaehler prueft den Buchungsstatus.
    const zeile = quelle.split('\n').find(z => z.includes("p.role_name === 'konfi' && p.status === 'confirmed'"));
    expect(zeile).toBeTypeOf('string');
  });

  it('jede selbst gezaehlte Konfi-Zahl filtert auf confirmed', () => {
    // Die Ansichten duerfen aus der Teilnehmerliste rechnen -- die Liste ist
    // ohnehin geladen, und die Serverzahl meint dasselbe. Was sie NICHT
    // duerfen: dabei den Status weglassen. Ein reiner Rollenfilter, dessen
    // Ergebnis direkt als Zahl verwendet wird (.length), zaehlt Abgemeldete
    // mit -- das ist genau der Befund.
    for (const pfad of [ADMIN_DETAIL, ADMIN_SECTIONS, KONFI_DETAIL]) {
      const treffer = code(pfad).match(
        /participants\.filter\(p => p\.role_name === 'konfi'\)\.length/g
      );
      expect(treffer, `${pfad} zaehlt Konfis ohne Statusfilter`).toBeNull();
    }
  });

  it('die Konfi-Ansicht nimmt die Serverzahl, sie rechnet sie nicht nach', () => {
    const quelle = code(KONFI_DETAIL);
    // registered_count kommt aus event_booking_stats und ist die eine Quelle.
    expect(quelle).toMatch(/const konfiRegistered = \(eventData\.registered_count \|\| 0\)/);
    // Kein zweiter Rechenweg aus participants daneben.
    expect(quelle).not.toMatch(/participants\.filter\([^)]*status === 'confirmed'/);
  });

  it('ein abgesagter Termin zeigt keine Platz-Zahlen, sondern die Abgemeldeten', () => {
    const quelle = code(KONFI_DETAIL);
    // Die Entscheidung vom 16.09.2026: Bei einer Absage steht nicht
    // "0 frei / 0 dabei / 0 von unendlich", sondern die Zahl, um die es ging.
    expect(quelle).toMatch(/istAbgesagterTermin/);
    expect(quelle).toMatch(/abgemeldet_count/);
    // Die Frei-Kachel haengt an der Absage, nicht mehr unbedingt an isUnlimited.
    expect(quelle).toMatch(/istAbgesagterTermin[\s\S]{0,200}label: 'Abgemeldet'/);
  });

  it('Gegenprobe: ein Vorkommen nur im Kommentar zaehlt nicht', () => {
    const nurKommentar = `
      // participants.filter(p => p.role_name === 'konfi').length
      const x = 1;
    `;
    expect(ohneKommentare(nurKommentar)).not.toMatch(
      /participants\.filter\(p => p\.role_name === 'konfi'\)\.length/
    );
  });
});
