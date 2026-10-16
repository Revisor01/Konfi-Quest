// Konfi-Termin mit Zeitfenstern: Konnten die Zeitfenster nicht geladen werden,
// sagt die Rückfrage beim Anmelden „Zieh die Seite nach unten, um es erneut
// zu versuchen." -- das Ziehen muss sie dann auch neu laden, nicht nur die
// Terminliste.
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { zustand, zuruecksetzen, termin, oeffne, api, listeNeuLaden } from './gerueste/konfiTerminDetail';

beforeEach(zuruecksetzen);

const zeitfensterAbrufe = () => api.get.mock.calls.filter((c) => c[0] === '/konfi/events/5/timeslots').length;

describe('Zeitfenster nach einem Ladefehler', () => {
  it('nach unten ziehen lädt die Zeitfenster neu, nicht nur die Terminliste', async () => {
    let fehlschlagen = true;
    api.get.mockImplementation(async (pfad: string) => {
      if (/\/timeslots$/.test(pfad)) {
        if (fehlschlagen) throw new Error('Netz weg');
        return { data: zustand.zeitfenster };
      }
      if (/\/participants$/.test(pfad)) return { data: zustand.teilnehmer };
      return { data: [] };
    });
    await oeffne(termin({ has_timeslots: true }));
    expect(zeitfensterAbrufe()).toBe(1);

    fehlschlagen = false;
    await act(async () => {
      fireEvent.click(screen.getByTestId('nach-unten-ziehen'));
      await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    });
    expect(listeNeuLaden).toHaveBeenCalledTimes(1);
    expect(zeitfensterAbrufe()).toBe(2);
  });
});
