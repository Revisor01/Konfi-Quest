// Leitung, /admin/events/:id: die eigene Absage („Nicht dabei" / „Nicht mehr
// dabei") -- in der App das Modal des Teams (TeamerAbsageModal), im Browser
// ab 992 px das Fenster der Web-Fassung (Simon, 15.10.2026).
//
// Gerendert wird die ECHTE Detailansicht der Leitung (Gerüst
// leitungTerminDetail) je Fassung einmal, mit denselben Erwartungen: dieselbe
// Grund-Regel wie beim Team (utils/zusageKnoepfe.ts), dieselbe Route und
// derselbe Rumpf (POST /teamer/events/:id/zusage), dieselbe Meldung danach.
// Eine Ablehnung des Servers steht in der App oben, im Browser im Fenster.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, oeffne, knopf, api, setError, setSuccess, modale, zuletztGeoeffnet,
} from '../gerueste/leitungTerminDetail';

vi.setConfig({ testTimeout: 30_000 });

const breit = vi.hoisted(() => ({ wert: true }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => breit.wert }));

type Fassung = 'app' | 'web';

beforeEach(() => {
  zuruecksetzen();
});

const geoeffnet = (name: string) => modale.geoeffnet.filter((m) => m.name === name);

const absagen = async (fassung: Fassung, knopfText: string, grund: string, erwartePflicht: boolean) => {
  fireEvent.click(knopf(knopfText) as HTMLElement);
  if (fassung === 'app') {
    expect(screen.queryByRole('dialog')).toBe(null);
    const modal = zuletztGeoeffnet('TeamerAbsageModal')!;
    expect(modal.props.grundPflicht).toBe(erwartePflicht);
    await act(async () => { (modal.props.onAbsage as (g: string) => void)(grund.trim()); });
    return;
  }
  const fenster = screen.getByRole('dialog', { name: 'Absage' });
  expect(fenster).toHaveAccessibleDescription('Absage für Konfi-Freizeit');
  expect(geoeffnet('TeamerAbsageModal')).toHaveLength(0);
  const feld = within(fenster).getByRole('textbox', { name: erwartePflicht ? 'Grund für die Absage' : 'Grund (freiwillig)' });
  fireEvent.change(feld, { target: { value: grund } });
  await act(async () => { fireEvent.click(within(fenster).getByRole('button', { name: 'Absage bestätigen' })); });
};

describe.each<Fassung>(['app', 'web'])('Leitung sagt die eigene Teilnahme ab (%s): dieselbe Regel, dieselbe Route', (fassung) => {
  beforeEach(() => { breit.wert = fassung === 'web'; });

  it('nach der eigenen Zusage: Grund Pflicht -- POST /teamer/events/7/zusage { dabei: false, reason }', async () => {
    zustand.detail = termin({ teamer_needed: true, booking_status: 'confirmed' });
    await oeffne();
    await absagen(fassung, 'Nicht mehr dabei', ' Krank ', true);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls).toEqual([['/teamer/events/7/zusage', { dabei: false, reason: 'Krank' }]]);
    await waitFor(() => expect(setSuccess).toHaveBeenCalledWith('Absage gespeichert'));
    if (fassung === 'web') expect(screen.queryByRole('dialog')).toBe(null);
  });

  it('noch nichts gesagt: Grund freiwillig -- ohne Grund { dabei: false }', async () => {
    zustand.detail = termin({ teamer_needed: true, booking_status: null });
    await oeffne();
    await absagen(fassung, 'Nicht dabei', '', false);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls).toEqual([['/teamer/events/7/zusage', { dabei: false }]]);
  });

  it('lehnt der Server ab, steht seine Begründung da', async () => {
    api.post.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 400, data: { error: 'Bitte gib einen Grund an.' } } }));
    zustand.detail = termin({ teamer_needed: true, booking_status: 'confirmed' });
    await oeffne();
    await absagen(fassung, 'Nicht mehr dabei', 'Krank', true);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    if (fassung === 'app') {
      await waitFor(() => expect(setError).toHaveBeenCalledWith('Bitte gib einen Grund an.'));
    } else {
      const fenster = screen.getByRole('dialog', { name: 'Absage' });
      await waitFor(() => expect(within(fenster).getByRole('alert')).toHaveTextContent('Bitte gib einen Grund an.'));
      // Oben steht nichts (setError('') beim Laden räumt nur auf).
      expect(setError.mock.calls.filter(([text]) => text)).toEqual([]);
    }
  });
});
