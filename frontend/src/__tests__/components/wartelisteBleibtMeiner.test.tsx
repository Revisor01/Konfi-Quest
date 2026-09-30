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
// und dass beide Seiten gerendert unter "Meine" genau die Termine mit eigener
// Buchung zeigen und zaehlen (Audit Tests 26.09.2026, BF-02; bis 30.09.2026
// am Quelltext der Seiten geprueft).
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { zaehltAlsMeiner } from '../../components/shared/eventFormatting';
import { zustand, zuruecksetzen, oeffneListe, termin, inTagen } from './gerueste/teamerTerminSeite';

// Die Zustaende, die eine Buchung annehmen kann. Alle bedeuten: Es gibt eine
// Buchungszeile, die Person gehoert also zu diesem Termin.
const MIT_BUCHUNG = [
  { booking_status: 'confirmed', is_registered: true },
  { booking_status: 'waitlist', is_registered: false },
  { booking_status: 'pending', is_registered: false },
  { booking_status: 'opted_out', is_registered: false },
  { booking_status: 'excused', is_registered: false }
];

describe('zaehltAlsMeiner: alle Buchungszustaende', () => {
  it.each(MIT_BUCHUNG)('booking_status $booking_status zaehlt als meiner', (buchung) => {
    expect(zaehltAlsMeiner(buchung)).toBe(true);
  });

  it('ein Termin ohne eigene Buchung zaehlt NICHT (der verbotene Fall)', () => {
    expect(zaehltAlsMeiner({ is_registered: false, booking_status: null })).toBe(false);
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

// --- Gerendert ------------------------------------------------------------------

// Fünf Termine mit eigener Buchung in je einem Zustand, einer ohne. Drei davon
// suchen das Team (für den Reiter "Team").
const TERMINE = [
  termin({ id: 1, name: 'Gottesdienst', event_date: inTagen(3), booking_status: 'confirmed', is_registered: true, teamer_needed: false }),
  termin({ id: 2, name: 'Freizeit', event_date: inTagen(4), booking_status: 'waitlist', teamer_needed: true }),
  termin({ id: 3, name: 'Kinoabend', event_date: inTagen(5), booking_status: 'pending', teamer_needed: false }),
  termin({ id: 4, name: 'Pflichttreffen', event_date: inTagen(6), booking_status: 'opted_out', teamer_needed: true }),
  termin({ id: 5, name: 'Gemeindefest', event_date: inTagen(7), booking_status: 'excused', teamer_needed: false }),
  termin({ id: 6, name: 'Stadtrallye', event_date: inTagen(8), booking_status: null, teamer_needed: true }),
];
const NAMEN = TERMINE.map((t) => t.name as string);
const MEINE = ['Gottesdienst', 'Freizeit', 'Kinoabend', 'Pflichttreffen', 'Gemeindefest'];

/** Welche der sechs Termine die Liste gerade zeigt, in Anzeigereihenfolge. */
const gezeigt = () => screen.getAllByTestId('zeile')
  .filter((z) => z.getAttribute('data-tippbar') === 'ja')
  .map((z) => NAMEN.find((n) => z.textContent?.includes(n)))
  .filter(Boolean);

const kacheln = () => Object.fromEntries(
  [...document.querySelectorAll('.app-stats-row__item')].map((k) => [
    k.querySelector('.app-stats-row__label')?.textContent,
    Number(k.querySelector('.app-stats-row__value')?.textContent),
  ]),
);

beforeEach(() => {
  zuruecksetzen();
  zustand.events = TERMINE;
});

describe('Konfi-Seite: der Reiter "Meine" kennt alle Buchungszustaende', () => {
  const oeffneKonfiSeite = async () => {
    const KonfiEventsPage = (await import('../../components/konfi/pages/KonfiEventsPage')).default;
    render(<KonfiEventsPage />);
    await act(async () => { await Promise.resolve(); });
  };

  it('zeigt Warteliste, Antrag, Abmeldung und Entschuldigung -- nicht den Termin ohne Buchung', async () => {
    await oeffneKonfiSeite();
    expect(gezeigt()).toEqual(MEINE);
  });

  it('die Kachel "Gebucht" zählt dieselben fünf', async () => {
    await oeffneKonfiSeite();
    expect(kacheln()).toMatchObject({ Gebucht: 5 });
  });
});

describe('Teamer-Seite: "Meine" enthaelt Warteliste und eigene Absage', () => {
  it('der Reiter "Meine" zeigt die fünf Termine mit eigener Buchung', async () => {
    await oeffneListe('meine');
    expect(gezeigt()).toEqual(MEINE);
    expect(kacheln()).toMatchObject({ Gebucht: 5 });
  });

  it('der Reiter "Team" zählt unter "Meine" Warteliste und eigene Absage mit', async () => {
    await oeffneListe('team');
    expect(gezeigt()).toEqual(['Freizeit', 'Pflichttreffen', 'Stadtrallye']);
    expect(kacheln()).toEqual({ 'Team gesucht': 3, 'Nur Team': 0, Meine: 2 });
  });

  it('der Reiter "Alle" zählt unter "Meine" alle fünf', async () => {
    await oeffneListe('alle');
    expect(gezeigt()).toEqual(NAMEN);
    expect(kacheln()).toEqual({ Gesamt: 6, Anstehend: 6, Meine: 5 });
  });

  it('Gegenprobe: ohne eigene Buchung steht unter "Meine" nichts', async () => {
    zustand.events = [TERMINE[5]];
    await oeffneListe('meine');
    expect(screen.queryAllByTestId('zeile').filter((z) => z.getAttribute('data-tippbar') === 'ja')).toEqual([]);
    expect(kacheln()).toMatchObject({ Gebucht: 0 });
    // Und der Reiter "Alle" zeigt ihn weiterhin.
    await act(async () => { fireEvent.click(document.querySelector('[role="tab"][data-wert="alle"]') as HTMLElement); });
    expect(gezeigt()).toEqual(['Stadtrallye']);
  });
});
