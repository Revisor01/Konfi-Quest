// Befund II (Geraetetest Simon, 16.09.2026):
// "Der Termin zu dem ein Konfi angemeldet war, der abgesagt wurde muss unter
// meine stehen bleiben!"
//
// WAS VORGEFUNDEN WURDE: Er blieb NICHT stehen. Die Wurzel liegt in der
// Umstellung vom 15.09.2026 (Migration 153): Eine Terminabsage meldet seither
// alle Teilnehmenden ab und setzt ihre Buchung auf status = 'excused'.
// Das Backend (backend/routes/konfi.js) liefert daraufhin
//   is_registered   = false   (nur 'confirmed' zaehlt dort)
//   booking_status  = 'excused'
// Der Reiter fragte `is_registered || booking_status === 'opted_out'` --
// beides falsch fuer 'excused'. Der Termin fiel aus "Meine" heraus.
//
// Der Termin selbst bleibt in der Antwort: Die WHERE-Klausel laesst abgesagte
// Termine durch, sobald eine eigene Buchung existiert
// (`e.cancelled IS NOT TRUE OR eb_konfi.id IS NOT NULL`). Es war also allein
// die Anzeige, nicht die Datenlieferung.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { zaehltAlsMeiner } from '../../components/shared/eventFormatting';

const quelle = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

describe('zaehltAlsMeiner(): wer eine Buchung hat, behaelt den Termin unter "Meine"', () => {
  it('der Fall aus dem Geraetetest: angemeldet, dann Termin abgesagt -> status excused', () => {
    const abgesagterTermin = {
      is_registered: false,
      booking_status: 'excused',
      cancelled: true
    };
    expect(zaehltAlsMeiner(abgesagterTermin)).toBe(true);
  });

  it('bestaetigte Anmeldung zaehlt weiterhin', () => {
    expect(zaehltAlsMeiner({ is_registered: true, booking_status: 'confirmed' })).toBe(true);
  });

  it('Warteliste zaehlt', () => {
    expect(zaehltAlsMeiner({ is_registered: false, booking_status: 'waitlist' })).toBe(true);
  });

  it('selbst abgemeldet (Pflichttermin) zaehlt weiterhin -- das konnte der alte Filter schon', () => {
    expect(zaehltAlsMeiner({ is_registered: false, booking_status: 'opted_out' })).toBe(true);
  });

  it('ein Pflichttermin ohne eigene Buchungszeile zaehlt ueber is_registered', () => {
    expect(zaehltAlsMeiner({ is_registered: true })).toBe(true);
  });

  it('ein fremder Termin ohne jede Buchung zaehlt NICHT (der verbotene Fall)', () => {
    expect(zaehltAlsMeiner({ is_registered: false })).toBe(false);
    expect(zaehltAlsMeiner({ is_registered: false, booking_status: null })).toBe(false);
    expect(zaehltAlsMeiner({})).toBe(false);
  });

  it('ein abgesagter Termin OHNE eigene Buchung zaehlt nicht -- er geht die Konfi nichts an', () => {
    expect(zaehltAlsMeiner({ is_registered: false, booking_status: undefined })).toBe(false);
  });
});

describe('GEGENPROBE: der alte Filter faellt bei genau diesem Fall durch', () => {
  it('`is_registered || booking_status === opted_out` verliert den abgesagten Termin', () => {
    const abgesagterTermin = { is_registered: false, booking_status: 'excused' };
    const alterFilter = (e: { is_registered?: boolean; booking_status?: string }) =>
      !!e.is_registered || e.booking_status === 'opted_out';

    // Das war der Fehler: der alte Ausdruck sagt false, der neue true.
    expect(alterFilter(abgesagterTermin)).toBe(false);
    expect(zaehltAlsMeiner(abgesagterTermin)).toBe(true);
  });
});

describe('das Backend liefert den abgesagten Termin ueberhaupt aus', () => {
  it('GET /konfi/events laesst abgesagte Termine mit eigener Buchung durch', () => {
    const konfi = quelle('../backend/routes/konfi.js');
    expect(konfi).toContain('e.cancelled IS NOT TRUE OR eb_konfi.id IS NOT NULL');
  });

  it('die Buchungszeile wird unabhaengig vom Status verknuepft -- auch bei excused', () => {
    // Der LEFT JOIN LATERAL filtert NICHT auf status; haette er das, waere
    // eb_konfi.id bei 'excused' null und der Termin fiele schon im Backend
    // heraus.
    const konfi = quelle('../backend/routes/konfi.js');
    expect(konfi).toContain('WHERE eb_konfi_i.event_id = e.id AND eb_konfi_i.user_id = $2');
  });
});
