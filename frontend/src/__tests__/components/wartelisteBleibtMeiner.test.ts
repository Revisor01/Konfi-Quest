// Befund (16.09.2026): "Ein Termin, auf dessen Warteliste ich stehe, fehlt
// unter 'Meine'."
//
// WAS VORGEFUNDEN WURDE: Die Regel, wer unter "Meine" gehoert, stand in DREI
// handgebauten Varianten nebeneinander -- und genau deshalb fehlte an jeder
// Stelle etwas anderes:
//
//   konfi/views/EventsView.tsx        zaehltAlsMeiner()            (behoben)
//   konfi/pages/KonfiEventsPage.tsx   is_registered || opted_out   -> ohne Warteliste
//   teamer/pages/TeamerEventsPage.tsx is_registered                -> ohne Warteliste UND ohne eigene Absage
//
// Das Backend setzt `is_registered` nur bei status = 'confirmed'
// (backend/routes/konfi.js). Wer auf der Warteliste steht, hat
// status = 'waitlist' -> is_registered = false -> faellt aus dem Filter.
// Die KARTENDARSTELLUNG der Teamer-Seite kennt 'waitlist' und 'opted_out'
// sehr wohl und faerbt sie ein -- nur der Filter davor kannte sie nicht.
//
// Geprueft wird deshalb beides: dass zaehltAlsMeiner() die Faelle abdeckt,
// und dass die beiden Seiten diese Funktion auch wirklich aufrufen statt
// weiter selbst zu rechnen.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { zaehltAlsMeiner } from '../../components/shared/eventFormatting';
import { ohneKommentare } from './abgesagteTermineAnsichten.test';

const code = (pfad: string) => ohneKommentare(readFileSync(resolve(process.cwd(), pfad), 'utf8'));

const KONFI_SEITE = 'src/components/konfi/pages/KonfiEventsPage.tsx';
const TEAMER_SEITE = 'src/components/teamer/pages/TeamerEventsPage.tsx';

// Die Zustaende, die eine Buchung annehmen kann. Alle bedeuten: Es gibt eine
// Buchungszeile, die Person gehoert also zu diesem Termin.
const MIT_BUCHUNG = [
  { booking_status: 'confirmed', is_registered: true },
  { booking_status: 'waitlist', is_registered: false },
  { booking_status: 'pending', is_registered: false },
  { booking_status: 'opted_out', is_registered: false },
  { booking_status: 'excused', is_registered: false }
];

describe('Konfi-Seite: der Reiter "Meine" kennt alle Buchungszustaende', () => {
  it.each(MIT_BUCHUNG)('booking_status $booking_status zaehlt als meiner', (buchung) => {
    expect(zaehltAlsMeiner(buchung)).toBe(true);
  });

  it('ein Termin ohne eigene Buchung zaehlt NICHT (der verbotene Fall)', () => {
    expect(zaehltAlsMeiner({ is_registered: false, booking_status: null })).toBe(false);
  });

  it('KonfiEventsPage filtert ueber zaehltAlsMeiner statt selbst zu rechnen', () => {
    const quelle = code(KONFI_SEITE);
    expect(quelle).toContain('zaehltAlsMeiner');
    // Die alte handgebaute Regel darf nicht mehr im Code stehen.
    expect(quelle).not.toContain("booking_status === 'opted_out'");
  });
});

describe('Teamer-Seite: "Meine" enthaelt Warteliste und eigene Absage', () => {
  it('Warteliste zaehlt als meiner', () => {
    expect(zaehltAlsMeiner({ is_registered: false, booking_status: 'waitlist' })).toBe(true);
  });

  it('wer selbst abgesagt hat, findet den Termin weiter unter "Meine"', () => {
    expect(zaehltAlsMeiner({ is_registered: false, booking_status: 'opted_out' })).toBe(true);
  });

  it('TeamerEventsPage filtert ueber zaehltAlsMeiner statt nur ueber is_registered', () => {
    const quelle = code(TEAMER_SEITE);
    expect(quelle).toContain('zaehltAlsMeiner');
    // GENAU vier Vorkommen: der Import plus die drei Stellen (meineEvents,
    // Zaehler "Meine" im Reiter Team, Zaehler "Meine" im Reiter Alle).
    //
    // Auf die exakte Zahl statt auf ">= 4": Eine Untergrenze haelt auch dann
    // noch, wenn eine der drei Stellen zurueckfaellt und dafuer anderswo zwei
    // neue entstehen -- also genau in dem Fall, den dieser Test fangen soll.
    // Kommt eine vierte Stelle dazu, faellt der Test und will hier
    // nachgetragen werden; das ist beabsichtigt.
    const treffer = quelle.match(/zaehltAlsMeiner/g) ?? [];
    expect(treffer.length).toBe(4);
  });

  it('keiner der drei Filter rechnet noch mit blossem e.is_registered', () => {
    const quelle = code(TEAMER_SEITE);
    expect(quelle).not.toContain('safeEvents.filter(e => e.is_registered)');
    expect(quelle).not.toContain('teamEvents.filter(e => e.is_registered)');
    expect(quelle).not.toContain('alleEvents.filter(e => e.is_registered)');
  });
});

describe('GEGENPROBE: die alten Regeln fallen bei genau diesen Faellen durch', () => {
  const warteliste = { is_registered: false, booking_status: 'waitlist' };
  const selbstAbgesagt = { is_registered: false, booking_status: 'opted_out' };

  it('die Konfi-Regel `is_registered || opted_out` verliert die Warteliste', () => {
    const alt = (e: { is_registered?: boolean; booking_status?: string }) =>
      !!e.is_registered || e.booking_status === 'opted_out';
    expect(alt(warteliste)).toBe(false);
    expect(zaehltAlsMeiner(warteliste)).toBe(true);
  });

  it('die Teamer-Regel `is_registered` verliert Warteliste UND eigene Absage', () => {
    const alt = (e: { is_registered?: boolean }) => !!e.is_registered;
    expect(alt(warteliste)).toBe(false);
    expect(alt(selbstAbgesagt)).toBe(false);
    expect(zaehltAlsMeiner(warteliste)).toBe(true);
    expect(zaehltAlsMeiner(selbstAbgesagt)).toBe(true);
  });
});
