// "Anmelden (null/4)" (16.09.2026) -- gerendert (Audit Tests 26.09.2026,
// BF-02; vorher Quelltext-Test, 30.09.2026 umgestellt).
//
// An einem Termin, zu dem sich noch niemand angemeldet hatte, stand auf dem
// Anmelde-Knopf in der Konfi-Detailansicht "Anmelden (null/4)".
//
// Die Ursache lag im Backend (die Zähler kamen als null an) und ist dort
// behoben. Die Ansicht rechnete die Zahl aber ungeschützt in den Knopftext.
// Ausgelieferte App-Fassungen lesen weiterhin ältere Server-Stände, also
// muss auch die Ansicht die Lücke schließen. Hier wird sie mit genau so
// einer Antwort gerendert.
import { describe, it, expect, beforeEach } from 'vitest';
import { within } from '@testing-library/react';
import { zuruecksetzen, termin, oeffne, dabeiKarte } from './gerueste/konfiTerminDetail';
import type { Event } from '../../types/event';

beforeEach(zuruecksetzen);

/** Ein älterer Server-Stand: Zähler als null statt 0. */
const ohneZaehler = (zusatz: Partial<Event> = {}) =>
  termin({ max_participants: 4, registered_count: null as unknown as number, ...zusatz });

const knoepfe = () => within(dabeiKarte()).getAllByRole('button').map((k) => k.textContent);

describe('Anmelde-Knopf an einem Termin ohne Buchung', () => {
  it('zeigt 0 statt null, wenn der Zähler fehlt', async () => {
    await oeffne(ohneZaehler());
    expect(knoepfe()).toEqual(['Anmelden (0/4)']);
  });

  it('lässt eine echte Zahl unverändert', async () => {
    await oeffne(termin({ max_participants: 4, registered_count: 3 }));
    expect(knoepfe()).toEqual(['Anmelden (3/4)']);
  });

  it('ohne Zähler gilt der Termin nicht als voll -- auch mit Warteliste bleibt es beim Anmelden', async () => {
    // Bei null wäre `null >= 4` false, `null < 4` true -- die Bedingungen
    // lesen den Zähler abgesichert, damit beide Richtungen stimmen.
    await oeffne(ohneZaehler({ waitlist_enabled: true, max_waitlist_size: 5 }));
    expect(knoepfe()).toEqual(['Anmelden (0/4)']);
  });

  it('voll mit Warteliste: der Wartelisten-Knopf zeigt 0 statt null, wenn der Wartelisten-Zähler fehlt', async () => {
    await oeffne(termin({
      max_participants: 4, registered_count: 4, waitlist_enabled: true, max_waitlist_size: 5,
      waitlist_count: null as unknown as number,
    }));
    expect(knoepfe()).toEqual(['Warteliste offen (0/5)']);
  });

  it('von der Leitung abgemeldet, Zähler fehlt: "Wieder anmelden" statt "Ausgebucht"', async () => {
    await oeffne(ohneZaehler({ booking_status: 'excused' }));
    expect(knoepfe()).toEqual(['Wieder anmelden']);
  });

  it('nirgends auf der Seite steht "null"', async () => {
    const { container } = await oeffne(ohneZaehler());
    expect(container.textContent).not.toContain('null');
  });
});
