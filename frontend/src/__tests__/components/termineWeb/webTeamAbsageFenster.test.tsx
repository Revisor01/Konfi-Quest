// Team, /teamer/events?eventId=: „Nicht dabei" / „Nicht mehr dabei" -- in der
// App das Modal (TeamerAbsageModal), im Browser ab 992 px das Fenster der
// Web-Fassung (Simon, 15.10.2026).
//
// Gerendert wird die ECHTE Seite (TeamerEventsPage) je Fassung einmal, mit
// denselben Erwartungen: dieselbe Grund-Regel (nach einer Zusage Pflicht,
// sonst freiwillig), dieselbe Route und derselbe Rumpf
// (POST /teamer/events/:id/zusage), ohne Netz dieselbe Warteschlange, nach
// dem Senden dieselbe Meldung. Was sich unterscheidet: Eine Ablehnung des
// Servers steht in der App oben (setError), im Browser im Fenster, das dann
// offen bleibt.
//
// Das Modal der App ist im Gerüst eine Attrappe: Die App-Fassung bestätigt
// es über seine Requisiten mit dem Grund, wie es ihn weitergibt. Sein
// Innenleben prüft webAbsageDialog.test.tsx.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import {
  h, api, setError, setSuccess, geoeffnet, zuletztGeoeffnet, zuruecksetzen, richteEin, oeffne, termin, inTagen, JETZT,
} from './geruestWeb';

type Fassung = 'app' | 'web';

const ZUGESAGT = termin(402, 'Konfi-Freizeit', {
  event_date: inTagen(14), teamer_needed: true, teamer_registration_status: 'open', is_registered: true, booking_status: 'confirmed',
  teamer_count: 3, teamer_max_participants: 6,
});
const OFFEN = termin(401, 'Teamabend', {
  event_date: inTagen(5), teamer_only: true, teamer_needed: true, teamer_registration_status: 'open', teamer_count: 2, teamer_max_participants: 8,
});
const EVENTS = [ZUGESAGT, OFFEN];

beforeEach(() => {
  zuruecksetzen();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
});
afterEach(() => { vi.useRealTimers(); });

const oeffneEvent = async (fassung: Fassung, eventId: number) => {
  h.api.get.mockImplementation((pfad: string) => {
    if (pfad === `/events/${eventId}`) return Promise.resolve({ data: { ...EVENTS.find((e) => e.id === eventId), participants: [] } });
    return Promise.resolve({ data: [] });
  });
  richteEin({ nutzer: 'teamer', pfad: '/teamer/events', suche: `?eventId=${eventId}`, daten: { 'teamer:events:': EVENTS, 'teamer:requests:': [] } });
  h.breit = fassung === 'web';
  await oeffne('team');
  for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
};

/** „Nicht (mehr) dabei" tippen, mit Grund bestätigen -- im Modal der App bzw. im Fenster. */
const absagen = async (fassung: Fassung, knopfText: string, grund: string, erwartePflicht: boolean) => {
  fireEvent.click(screen.getByRole('button', { name: knopfText }));
  if (fassung === 'app') {
    expect(screen.queryByRole('dialog')).toBe(null);
    const modal = zuletztGeoeffnet('TeamerAbsageModal')!;
    expect(modal.props.grundPflicht).toBe(erwartePflicht);
    await act(async () => { (modal.props.onAbsage as (g: string) => void)(grund.trim()); });
    return;
  }
  const fenster = screen.getByRole('dialog', { name: 'Absage' });
  expect(geoeffnet('TeamerAbsageModal')).toHaveLength(0);
  const feld = within(fenster).getByRole('textbox', { name: erwartePflicht ? 'Grund für die Absage' : 'Grund (freiwillig)' });
  if (erwartePflicht) expect(feld).toHaveAttribute('aria-required', 'true');
  else expect(feld).not.toHaveAttribute('aria-required');
  fireEvent.change(feld, { target: { value: grund } });
  await act(async () => { fireEvent.click(within(fenster).getByRole('button', { name: 'Absage bestätigen' })); });
};

describe.each<Fassung>(['app', 'web'])('Team sagt ab (%s): dieselbe Regel, dieselbe Route', (fassung) => {
  it('nach einer Zusage: Grund Pflicht -- POST /zusage { dabei: false, reason }', async () => {
    await oeffneEvent(fassung, 402);
    await absagen(fassung, 'Nicht mehr dabei', ' Krank ', true);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls).toEqual([['/teamer/events/402/zusage', { dabei: false, reason: 'Krank' }]]);
    await waitFor(() => expect(setSuccess).toHaveBeenCalledWith('Absage gespeichert'));
    if (fassung === 'web') expect(screen.queryByRole('dialog')).toBe(null);
  });

  it('noch nichts gesagt: Grund freiwillig -- ohne Grund geht { dabei: false }', async () => {
    await oeffneEvent(fassung, 401);
    await absagen(fassung, 'Nicht dabei', '', false);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls).toEqual([['/teamer/events/401/zusage', { dabei: false }]]);
  });

  it('ohne Netz: dieselbe Absage in die Warteschlange, dieselbe Meldung', async () => {
    await oeffneEvent(fassung, 402);
    h.online = false;
    await absagen(fassung, 'Nicht mehr dabei', 'Krank', true);
    await waitFor(() => expect(h.enqueue).toHaveBeenCalledTimes(1));
    expect(h.enqueue.mock.calls[0][0]).toEqual(expect.objectContaining({
      method: 'POST', url: '/teamer/events/402/zusage', body: { dabei: false, reason: 'Krank' },
    }));
    expect(api.post).not.toHaveBeenCalled();
    expect(setSuccess).toHaveBeenCalledWith('Wird gesendet, sobald du wieder online bist');
  });

  it('lehnt der Server ab, steht seine Begründung da', async () => {
    api.post.mockRejectedValue(Object.assign(new Error('x'), {
      response: { status: 400, data: { error: 'Bitte gib einen Grund an.', error_code: 'grund_erforderlich' } },
    }));
    await oeffneEvent(fassung, 402);
    await absagen(fassung, 'Nicht mehr dabei', 'Krank', true);
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    if (fassung === 'app') {
      await waitFor(() => expect(setError).toHaveBeenCalledWith('Bitte gib einen Grund an.'));
    } else {
      const fenster = screen.getByRole('dialog', { name: 'Absage' });
      await waitFor(() => expect(within(fenster).getByRole('alert')).toHaveTextContent('Bitte gib einen Grund an.'));
      expect(setError).not.toHaveBeenCalled();
      expect(setSuccess).not.toHaveBeenCalled();
    }
  });
});

describe('Absage-Fenster (web) gehört zu seinem Event', () => {
  it('führt die Zurück-Taste des Browsers vom offenen Fenster weg, geht es beim nächsten Event nicht wieder auf', async () => {
    h.api.get.mockImplementation((pfad: string) => {
      const treffer = EVENTS.find((e) => pfad === `/events/${e.id}`);
      return Promise.resolve({ data: treffer ? { ...treffer, participants: [] } : [] });
    });
    richteEin({ nutzer: 'teamer', pfad: '/teamer/events', suche: '?eventId=402', daten: { 'teamer:events:': EVENTS, 'teamer:requests:': [] } });
    h.breit = true;
    const seite = await oeffne('team');
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: 'Nicht mehr dabei' }));
    expect(screen.getByRole('dialog', { name: 'Absage' })).toHaveAccessibleDescription('Absage für Konfi-Freizeit');

    // Zurück zur Liste, dann ein anderes Event.
    await seite.wechsleAdresse('/teamer/events');
    expect(screen.queryByRole('dialog')).toBe(null);
    await seite.wechsleAdresse('/teamer/events', '?eventId=401');
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('button', { name: 'Nicht dabei' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('führt die Zurück-Taste weg und öffnet man DASSELBE Event wieder, geht das Fenster nicht von selbst auf', async () => {
    h.api.get.mockImplementation((pfad: string) => {
      const treffer = EVENTS.find((e) => pfad === `/events/${e.id}`);
      return Promise.resolve({ data: treffer ? { ...treffer, participants: [] } : [] });
    });
    richteEin({ nutzer: 'teamer', pfad: '/teamer/events', suche: '?eventId=402', daten: { 'teamer:events:': EVENTS, 'teamer:requests:': [] } });
    h.breit = true;
    const seite = await oeffne('team');
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: 'Nicht mehr dabei' }));
    expect(screen.getByRole('dialog', { name: 'Absage' })).toBeInTheDocument();

    // Zurück zur Liste, dann dasselbe Event wieder.
    await seite.wechsleAdresse('/teamer/events');
    expect(screen.queryByRole('dialog')).toBe(null);
    await seite.wechsleAdresse('/teamer/events', '?eventId=402');
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('button', { name: 'Nicht mehr dabei' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBe(null);

    // Wer jetzt absagen will, bekommt das Fenster wieder -- mit leerem Grund.
    fireEvent.click(screen.getByRole('button', { name: 'Nicht mehr dabei' }));
    const fenster = screen.getByRole('dialog', { name: 'Absage' });
    expect(within(fenster).getByRole('textbox', { name: 'Grund für die Absage' })).toHaveValue('');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('springt die Adresse ohne die Liste zu einem anderen Event und zurück, geht das Fenster nicht von selbst auf', async () => {
    h.api.get.mockImplementation((pfad: string) => {
      const treffer = EVENTS.find((e) => pfad === `/events/${e.id}`);
      return Promise.resolve({ data: treffer ? { ...treffer, participants: [] } : [] });
    });
    richteEin({ nutzer: 'teamer', pfad: '/teamer/events', suche: '?eventId=402', daten: { 'teamer:events:': EVENTS, 'teamer:requests:': [] } });
    h.breit = true;
    const seite = await oeffne('team');
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole('button', { name: 'Nicht mehr dabei' }));
    expect(screen.getByRole('dialog', { name: 'Absage' })).toBeInTheDocument();

    // Etwa über einen Link im Chat direkt zum nächsten Event, dann Zurück.
    await seite.wechsleAdresse('/teamer/events', '?eventId=401');
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('button', { name: 'Nicht dabei' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBe(null);
    await seite.wechsleAdresse('/teamer/events', '?eventId=402');
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('button', { name: 'Nicht mehr dabei' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(api.post).not.toHaveBeenCalled();
  });
});
