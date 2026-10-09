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
//
// Seit dem 09.10.2026 gerendert statt am Quelltext geprueft (Audit Tests
// 26.09.2026, BF-02): die echte Termin-Detailansicht der Leitung (Geruest
// leitungTerminDetail) und die der Konfis. Die Serverseite der Frist -- die
// Konfi-Abmeldung am Vortag scheitert mit "nur bis 2 Tage vor dem Event",
// das Team storniert am Vortag ohne Frist -- pruefen
// backend/tests/routes/buchungStornoRegelnKonfi.test.js und
// abmeldungZweimal.test.js an der Antwort (vorher las dieser Test
// bookingUtils.js und events/buchung.js). Die Handbuch-Pruefungen bleiben
// Inhalts-Waechter am Text des Kapitels.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { render, screen, act } from '@testing-library/react';
import { zustand, zuruecksetzen, termin, oeffne } from './gerueste/leitungTerminDetail';

// Die Konfi-Ansicht liest ihre Terminliste ueber useOfflineQuery (die
// Leitungsansicht nicht) -- hier liefert sie den einen Termin des Tests.
const konfiListe: { events: unknown[] } = { events: [] };
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({
    data: konfiListe.events, loading: false, isOffline: false,
    refresh: vi.fn(async () => undefined), refreshLive: vi.fn(),
  }),
}));

const REGEL = 'Konfis können sich bis 2 Tage vorher selbst abmelden';
const STUNDE = 60 * 60 * 1000;
const inStunden = (n: number) => new Date(Date.now() + n * STUNDE).toISOString();

const handbuch = readFileSync(resolve(process.cwd(), '../docs/handbuch/70-termine.md'), 'utf8');

/** Die Info-Zeile, in der ein Text steht (app-info-row). */
const infoZeileMit = (text: string) => screen.getByText(text).closest('.app-info-row') as HTMLElement;

beforeEach(zuruecksetzen);

describe('Abmeldefrist ist benannt (N6/6) -- Leitungsansicht', () => {
  it('die Leitung sieht die Regel im Termin-Detail', async () => {
    zustand.detail = termin();
    await oeffne();
    expect(screen.getAllByText(REGEL)).toHaveLength(1);
  });

  it('bei "Nur Team" steht der Konfi-Satz nicht da (Befund 06.09.2026)', async () => {
    // An einem teamer_only-Termin nehmen gar keine Konfis teil -- die Leitung
    // las eine Regel ueber Leute, die es bei diesem Termin nicht gibt.
    zustand.detail = termin({ teamer_only: true });
    await oeffne();
    expect(screen.getByText('Anmeldung')).toBeTruthy();
    expect(screen.queryByText(REGEL)).toBeNull();
  });

  it('fuers Team wird KEINE Frist behauptet', async () => {
    // Eine eigene Formulierung ("Das Team kann sich bis 2 Tage vorher
    // abmelden") waere eine zweite Falschaussage: Teamer:innen koennen sich
    // jederzeit austragen (Backend-Test siehe Kopf).
    zustand.detail = termin({ teamer_needed: true });
    await oeffne();
    expect(screen.queryByText(/Das Team kann sich bis 2 Tage vorher/)).toBeNull();
    expect(screen.queryByText(/Teamer:innen können sich bis/)).toBeNull();
    expect(screen.getAllByText(/bis 2 Tage vorher/)).toHaveLength(1);
  });

  it('sie steht beim Anmeldezeitraum, nicht irgendwo', async () => {
    // Dort liest die Leitung ohnehin, wann an- und abgemeldet werden kann.
    zustand.detail = termin({ registration_opens_at: inStunden(-48), registration_closes_at: inStunden(120) });
    await oeffne();
    const zeile = infoZeileMit(REGEL);
    expect(zeile.querySelector('.app-info-row__label')!.textContent).toBe('Anmeldung');
    expect(zeile.textContent).toMatch(/^Anmeldungvon .+bis .+Konfis können sich bis 2 Tage vorher selbst abmelden$/);
  });

  it('am Pflichttermin entfaellt die Anmeldezeile samt Regel', async () => {
    zustand.detail = termin({ mandatory: true, registration_status: 'mandatory' });
    await oeffne();
    expect(screen.queryByText(REGEL)).toBeNull();
  });
});

describe('Abmeldefrist -- Konfi-Ansicht', () => {
  // Gerendert wird die echte Konfi-Detailansicht mit dem Termin, wie
  // GET /konfi/events ihn liefert (angemeldet, bestaetigt).
  const oeffneKonfi = async (stundenBisBeginn: number) => {
    const ereignis = {
      id: 5, name: 'Sommerfest', event_date: inStunden(stundenBisBeginn), points: 2, type: 'event',
      max_participants: 10, registered_count: 2, registration_status: 'open', can_register: false,
      is_registered: true, booking_status: 'confirmed', cancelled: false, has_timeslots: false,
      mandatory: false, is_konfirmation: false, categories: [],
    };
    konfiListe.events = [ereignis];
    const EventDetailView = (await import('../../components/konfi/views/EventDetailView')).default;
    render(<EventDetailView eventId={5} onBack={() => undefined} />);
    for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); });
  };

  it('die Konfi-Meldung bleibt bestehen: am Vortag ist Abmelden gesperrt, mit Grund', async () => {
    await oeffneKonfi(24);
    const gesperrt = screen.getByRole('button', { name: 'Abmelden geht nur bis 2 Tage vorher' }) as HTMLButtonElement;
    expect(gesperrt.disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Abmelden' })).toBeNull();
  });

  it('Frontend und Backend nennen dieselbe Frist: knapp mehr als 2 Tage vorher geht es, knapp weniger nicht', async () => {
    // Die Serverseite (STORNO_FRIST_MS, 2 Tage) pruefen die Backend-Tests
    // aus dem Kopf an der Antwort; hier die Grenze der App.
    await oeffneKonfi(49);
    expect((screen.getByRole('button', { name: 'Abmelden' }) as HTMLButtonElement).disabled).toBe(false);
    document.body.innerHTML = '';
    await oeffneKonfi(47);
    expect(screen.getByRole('button', { name: 'Abmelden geht nur bis 2 Tage vorher' })).toBeTruthy();
  });
});

describe('Abmeldefrist im Handbuch (Inhalts-Waechter)', () => {
  it('das Handbuch erklaert die Regel im Anmelde-Kapitel', () => {
    expect(handbuch).toContain('bis wann Konfis sich abmelden können');
    expect(handbuch).toContain('Zwei Tage vor dem Termin ist Schluss');
  });

  it('das Handbuch grenzt sie gegen den QR-Code ab', () => {
    // Die Verwechslung lag nahe genug, dass sie beim Besprechen passiert ist.
    // Der QR-Hinweis steht beim Pflicht-Event, die Abgrenzung im Abschnitt.
    expect(handbuch).toContain('QR-Code');
    const abschnitt = handbuch.slice(
      handbuch.indexOf('bis wann Konfis sich abmelden können'),
      handbuch.indexOf('## Plätze und Warteliste einstellen')
    );
    expect(abschnitt).toContain('fest eingestellt');
  });

  it('das Handbuch nennt den Ausweg fuer die Leitung', () => {
    // Wer kurzfristig absagt, muss ausgetragen werden koennen.
    const abschnitt = handbuch.slice(
      handbuch.indexOf('bis wann Konfis sich abmelden können'),
      handbuch.indexOf('## Plätze und Warteliste einstellen')
    );
    expect(abschnitt).toContain('jederzeit entfernen');
  });
});
