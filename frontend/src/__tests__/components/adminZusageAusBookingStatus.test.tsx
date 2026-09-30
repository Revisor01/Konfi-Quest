// DIE EIGENE ZUSAGE DER LEITUNG LIEST DENSELBEN WERT WIE DAS TEAM
// (17.09.2026, Simons Befund) -- gerendert (Audit Tests 26.09.2026, BF-02;
// vorher Quelltext-Test, 30.09.2026 umgestellt).
//
// WÖRTLICH: "Die Logik ist bei Teamer und Admin nicht gleich unter bist du
// dabei. Nachdem man sich als Teamer einmal entschieden hat kommt ein großer
// Button entweder in rot doch nicht dabei oder in grün doch dabei oder so
// ähnlich. So will ich es auch beim Admin."
//
// GEGEN PRODUKTION GEMESSEN: Nach einer Zusage der Leitung über
// POST /teamer/events/:id/zusage liefert GET /events/:id
//
//   booking_status: 'confirmed'   <- richtig
//   participants:   []            <- LEER
//
// Die Seite las aber aus participants.find(p => p.user_id === user.id) --
// undefined heißt "noch nichts entschieden", die Leitung sah IMMER beide
// Knöpfe. Die Teamer-Seite liest booking_status und macht es richtig.
//
// Geprüft wird beides: der gemeinsame Helfer und dass die GERENDERTE Seite
// dem Buchungsstatus des Termins folgt -- genau mit der Antwort, die
// Produktion liefert (eigene Person nicht in participants).
import { describe, it, expect, beforeEach } from 'vitest';
import { within, fireEvent, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, teilnahme, oeffne, abschnitt, knopf, zuletztGeoeffnet,
} from './gerueste/leitungTerminDetail';
import { welcheKnoepfe, zusageBeschriftung, absageBeschriftung } from '../../utils/zusageKnoepfe';

beforeEach(zuruecksetzen);

const knoepfe = () => within(abschnitt('Bist du dabei?')!).getAllByRole('button').map((b) => b.textContent);

/** Team-Termin, wie Produktion ihn nach einer eigenen Zu-/Absage liefert. */
const teamTermin = (booking_status: string | null) => termin({ teamer_needed: true, booking_status, participants: [teilnahme(1, 'Kim Konfi')] });

describe('Der Helfer entscheidet für beide Rollen gleich', () => {
  it('nach einer Zusage steht NUR der rote Weg zurück', () => {
    expect(welcheKnoepfe('confirmed')).toBe('absage');
    expect(absageBeschriftung('confirmed')).toBe('Nicht mehr dabei');
  });

  it('nach einer Absage steht NUR der grüne Weg zurück', () => {
    expect(welcheKnoepfe('opted_out')).toBe('zusage');
    expect(zusageBeschriftung('opted_out')).toBe('Doch dabei');
  });

  it('auch von der Warteliste aus gilt die Zusage als getroffen', () => {
    expect(welcheKnoepfe('waitlist')).toBe('absage');
  });

  it('solange nichts entschieden ist, stehen beide da', () => {
    expect(welcheKnoepfe(null)).toBe('beide');
    expect(welcheKnoepfe(undefined)).toBe('beide');
  });
});

describe('Die Leitungsseite liest den Buchungsstatus des Termins', () => {
  it('zugesagt (booking_status confirmed), eigene Person NICHT in participants: nur "Nicht mehr dabei"', async () => {
    zustand.detail = teamTermin('confirmed');
    await oeffne();
    expect(knoepfe()).toEqual(['Nicht mehr dabei']);
  });

  it('abgesagt (opted_out), participants leer: nur "Doch dabei"', async () => {
    zustand.detail = teamTermin('opted_out');
    await oeffne();
    expect(knoepfe()).toEqual(['Doch dabei']);
  });

  it('auf der Warteliste: nur "Nicht mehr dabei"', async () => {
    zustand.detail = teamTermin('waitlist');
    await oeffne();
    expect(knoepfe()).toEqual(['Nicht mehr dabei']);
  });

  it('nicht aus der Teilnehmerliste: steht die eigene Person dort bestätigt, zählt trotzdem der Buchungsstatus', async () => {
    zustand.detail = termin({
      teamer_needed: true, booking_status: null,
      participants: [teilnahme(1, 'Leitung Selbst', { user_id: 99, role_name: 'admin', status: 'confirmed' })],
    });
    await oeffne();
    expect(knoepfe()).toEqual(['Dabei', 'Nicht dabei']);
  });

  it('auch die Grund-Pflicht hängt am Buchungsstatus: nach Zusage Pflicht, ohne Zusage nicht', async () => {
    zustand.detail = teamTermin('confirmed');
    const erste = await oeffne();
    await act(async () => { fireEvent.click(knopf('Nicht mehr dabei')!); });
    expect(zuletztGeoeffnet('TeamerAbsageModal')?.props.grundPflicht).toBe(true);
    erste.unmount();

    zustand.detail = teamTermin(null);
    await oeffne();
    await act(async () => { fireEvent.click(knopf('Nicht dabei')!); });
    expect(zuletztGeoeffnet('TeamerAbsageModal')?.props.grundPflicht).toBe(false);
  });
});
