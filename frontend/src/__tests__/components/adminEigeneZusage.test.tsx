// Die eigene Zusage der Leitung: dieselbe Logik wie beim Team -- gerendert
// (Audit Tests 26.09.2026, BF-02; vorher Quelltext-Test, 30.09.2026
// umgestellt).
//
// Simons Auftrag vom 16.09.2026, wörtlich:
//
//   "die anzeige bei teamerinnen mit nicht mehr dabei und doch dabei finde ich
//    richtig gut. das bleibt so. bei admins haben wir die buttons nebeneinander
//    'du bist dabei' 'bin nicht dabei'. und dann ein action modal. da muss die
//    logik einfach identisch sein wie bei teamerinnen bitte. erste abfrage
//    beide danach im wechsel."
//
// VORHER stand in der Leitungssicht eine dritte Handabschrift: beide Knöpfe
// DAUERHAFT, der eigene Stand als fill="solid", die Absage-Beschriftung als
// Zustand ("Abgesagt") statt als Weg, und ein window.prompt() für den Grund.
// Jetzt entscheidet utils/zusageKnoepfe.ts für beide Ansichten, und die
// Leitung bekommt denselben Dialog wie das Team. Welche Quelle die Seite
// liest (booking_status), prüft adminZusageAusBookingStatus; dass die
// Team-Ansicht bleibt, wie sie war, teamerZusageKnoepfe und teamerAbsageGrund.
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { screen, within, fireEvent, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, inTagen, oeffne, abschnitt, knopf, zuletztGeoeffnet, api,
} from './gerueste/leitungTerminDetail';
import {
  welcheKnoepfe, zusageBeschriftung, absageBeschriftung, absageBrauchtGrund, hatZugesagt, hatAbgesagt,
} from '../../utils/zusageKnoepfe';

let prompt: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  zuruecksetzen();
  prompt = vi.spyOn(window, 'prompt').mockReturnValue('nie');
});
afterEach(() => { prompt.mockRestore(); });

const teamTermin = (zusatz: Record<string, unknown> = {}) => termin({ teamer_needed: true, booking_status: null, ...zusatz });

interface K { text: string | null; fill: string | null; farbe: string | null; gesperrt: boolean }
const knoepfe = (): K[] => within(abschnitt('Bist du dabei?')!).getAllByRole('button').map((b) => ({
  text: b.textContent, fill: b.getAttribute('data-fill'), farbe: b.getAttribute('data-color'), gesperrt: (b as HTMLButtonElement).disabled,
}));

describe('Die Regeln stehen an EINER Stelle', () => {
  it('noch nichts entschieden -> beide; zugesagt -> Absage; abgesagt -> Zusage', () => {
    expect(welcheKnoepfe(null)).toBe('beide');
    expect(welcheKnoepfe(undefined)).toBe('beide');
    expect(welcheKnoepfe('confirmed')).toBe('absage');
    expect(welcheKnoepfe('waitlist')).toBe('absage');
    expect(welcheKnoepfe('pending')).toBe('absage');
    expect(welcheKnoepfe('opted_out')).toBe('zusage');
  });

  it('beschriftet die Knöpfe wie beim Team', () => {
    expect(zusageBeschriftung(null)).toBe('Dabei');
    expect(zusageBeschriftung('opted_out')).toBe('Doch dabei');
    expect(zusageBeschriftung(null, 'Warteliste (2/5)')).toBe('Warteliste (2/5)');
    expect(absageBeschriftung(null)).toBe('Nicht dabei');
    expect(absageBeschriftung('confirmed')).toBe('Nicht mehr dabei');
    expect(absageBeschriftung('waitlist')).toBe('Nicht mehr dabei');
  });

  it('verlangt einen Grund NUR für die Absage nach einer Zusage', () => {
    expect(absageBrauchtGrund('confirmed')).toBe(true);
    expect(absageBrauchtGrund('waitlist')).toBe(true);
    expect(absageBrauchtGrund('pending')).toBe(true);
    expect(absageBrauchtGrund(null)).toBe(false);
    expect(absageBrauchtGrund(undefined)).toBe(false);
    expect(absageBrauchtGrund('opted_out')).toBe(false);
  });

  it('trennt zugesagt und abgesagt sauber', () => {
    expect(hatZugesagt('confirmed')).toBe(true);
    expect(hatZugesagt('opted_out')).toBe(false);
    expect(hatAbgesagt('opted_out')).toBe(true);
    expect(hatAbgesagt('confirmed')).toBe(false);
    expect(hatZugesagt('excused')).toBe(false);
    expect(hatAbgesagt('excused')).toBe(false);
  });
});

describe('Leitung: eigene Zusage', () => {
  it('erste Abfrage: beide Knöpfe nebeneinander, grün "Dabei" und rot "Nicht dabei", beide Outline', async () => {
    zustand.detail = teamTermin();
    await oeffne();
    expect(knoepfe()).toEqual([
      { text: 'Dabei', fill: 'outline', farbe: 'success', gesperrt: false },
      { text: 'Nicht dabei', fill: 'outline', farbe: 'danger', gesperrt: false },
    ]);
  });

  it('danach im Wechsel: nach der Zusage nur der rote Weg, nach der Absage nur der grüne', async () => {
    zustand.detail = teamTermin({ booking_status: 'confirmed' });
    const erste = await oeffne();
    expect(knoepfe()).toEqual([{ text: 'Nicht mehr dabei', fill: 'outline', farbe: 'danger', gesperrt: false }]);
    erste.unmount();

    zustand.detail = teamTermin({ booking_status: 'opted_out' });
    await oeffne();
    expect(knoepfe()).toEqual([{ text: 'Doch dabei', fill: 'outline', farbe: 'success', gesperrt: false }]);
  });

  it('keine Zustands-Beschriftungen wie "Du bist dabei", "Bin dabei", "Abgesagt" an den Knöpfen', async () => {
    zustand.detail = teamTermin({ booking_status: 'confirmed' });
    await oeffne();
    for (const k of knoepfe()) expect(['Du bist dabei', 'Bin dabei', 'Bin nicht dabei', 'Abgesagt']).not.toContain(k.text);
  });

  it('die Zusage ruft dieselbe Route wie das Team', async () => {
    zustand.detail = teamTermin();
    await oeffne();
    await act(async () => { fireEvent.click(knopf('Dabei')!); });
    expect(api.post).toHaveBeenCalledWith('/teamer/events/7/zusage', { dabei: true });
  });

  it('die Absage fragt den Grund im Dialog des Teams ab, nicht per window.prompt -- und sendet über dieselbe Route', async () => {
    zustand.detail = teamTermin({ booking_status: 'confirmed' });
    await oeffne();
    await act(async () => { fireEvent.click(knopf('Nicht mehr dabei')!); });
    const dialog = zuletztGeoeffnet('TeamerAbsageModal')!;
    expect(dialog.props.grundPflicht).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();

    await act(async () => { (dialog.props.onAbsage as (g: string) => void)(' Krank '); });
    expect(api.post).toHaveBeenCalledWith('/teamer/events/7/zusage', { dabei: false, reason: 'Krank' });
  });

  it('offline: beide gesperrt, mit Hinweis', async () => {
    zustand.online = false;
    zustand.cache.set('admin:events:1', [teamTermin()]);
    await oeffne();
    expect(knoepfe().map((k) => k.gesperrt)).toEqual([true, true]);
    expect(screen.getByText('Ohne Netz nicht möglich — versuch es später nochmal.')).toBeInTheDocument();
  });

  it('nur wo das Team gefragt ist, und nicht an abgesagten oder vergangenen Terminen', async () => {
    for (const fall of [
      termin({ teamer_needed: false, teamer_only: false }),
      teamTermin({ registration_status: 'cancelled', cancelled: true }),
      teamTermin({ event_date: inTagen(-2) }),
    ]) {
      zuruecksetzen();
      zustand.detail = fall;
      const r = await oeffne();
      expect(abschnitt('Bist du dabei?'), JSON.stringify(fall)).toBeNull();
      r.unmount();
    }
  });

  it('auch an einem Termin nur fürs Team', async () => {
    zustand.detail = termin({ teamer_only: true, booking_status: null });
    await oeffne();
    expect(knoepfe().map((k) => k.text)).toEqual(['Dabei', 'Nicht dabei']);
  });
});
