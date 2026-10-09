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
//
// Seit dem 09.10.2026 gerendert statt am Quelltext geprueft (Audit Tests
// 26.09.2026, BF-02): Die Konfi-Terminseite zeigt den abgesagten Termin
// unter "Meine". Dass das Backend ihn samt Buchung 'excused' liefert -- und
// einen abgesagten Termin ohne eigene Buchung NICHT --, prueft
// backend/tests/routes/absagegrund.test.js an der Antwort von
// GET /konfi/events (vorher las dieser Test backend/routes/konfi.js).

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { zustand, zuruecksetzen, termin, inTagen } from './gerueste/teamerTerminSeite';
import { zaehltAlsMeiner } from '../../components/shared/eventFormatting';

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

describe('gerendert: die Konfi-Terminseite behaelt den abgesagten Termin unter "Meine"', () => {
  // Der Fall aus dem Geraetetest, so wie GET /konfi/events ihn liefert:
  // abgesagt, eigene Buchung 'excused', is_registered false.
  const MEINER = termin({
    id: 1, name: 'Konfi-Freizeit', event_date: inTagen(5), cancelled: true,
    registration_status: 'cancelled', booking_status: 'excused', is_registered: false,
  } as Partial<import('../../types/event').Event>);
  // Abgesagt, aber nie gebucht -- der verbotene Fall.
  const FREMD = termin({
    id: 2, name: 'Stadtrallye', event_date: inTagen(6), cancelled: true,
    registration_status: 'cancelled', booking_status: null, is_registered: false,
  } as Partial<import('../../types/event').Event>);
  const NAMEN = ['Konfi-Freizeit', 'Stadtrallye'];

  const gezeigt = () => screen.queryAllByTestId('zeile')
    .filter((z) => z.getAttribute('data-tippbar') === 'ja')
    .map((z) => NAMEN.find((n) => z.textContent?.includes(n)))
    .filter(Boolean);

  const oeffneKonfiSeite = async () => {
    const KonfiEventsPage = (await import('../../components/konfi/pages/KonfiEventsPage')).default;
    render(<KonfiEventsPage />);
    await act(async () => { await Promise.resolve(); });
  };

  beforeEach(() => {
    zuruecksetzen();
    zustand.events = [MEINER, FREMD];
  });

  it('der abgesagte Termin mit eigener Buchung steht unter "Meine", der fremde nicht', async () => {
    await oeffneKonfiSeite();
    expect(gezeigt()).toEqual(['Konfi-Freizeit']);
  });

  it('unter "Alle" stehen beide -- der fremde fehlt nur unter "Meine"', async () => {
    await oeffneKonfiSeite();
    await act(async () => { fireEvent.click(document.querySelector('[role="tab"][data-wert="alle"]') as HTMLElement); });
    expect(gezeigt()).toEqual(['Konfi-Freizeit', 'Stadtrallye']);
  });
});
