// Konfi, /konfi/events/:id: Abmelden mit Grund und die Wahl des Zeitfensters
// -- in der App Modal und Aktionsmenü, im Browser ab 992 px Fenster der
// Web-Fassung (Simon, 15.10.2026).
//
// Gerendert wird die ECHTE Detailansicht (Gerüst konfiTerminDetail), je
// Fassung einmal mit denselben Erwartungen: dieselben Routen und Rümpfe
// (DELETE /konfi/events/:id/register, POST /opt-out, POST /register mit
// timeslot_id), dieselben Einträge im Zeitfenster-Menü, derselbe Satz beim
// ausgebuchten Zeitfenster, dieselbe Ablehnung des Servers. Was sich
// unterscheidet, steht ausdrücklich da: Die App zeigt Meldungen oben
// (setError), der Browser im Fenster, das dann offen bleibt; ohne
// Zeitfenster fragt die App beim Tippen nach, der Browser sperrt „Anmelden"
// und nennt den Grund daneben.
//
// Das Modal der App ist im Gerüst eine Attrappe: Die App-Fassung bestätigt
// es über seine Requisiten mit dem Grund, wie es ihn weitergibt (ohne
// Leerzeichen am Rand). Sein Innenleben prüft webAbsageDialog.test.tsx.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, oeffne, knopf, api, setError, presentAlert, presentActionSheet, modale, zuletztGeoeffnet,
  listeNeuLaden,
} from '../gerueste/konfiTerminDetail';
import { ZEITSLOT_AUSGEBUCHT } from '../../../components/konfi/zeitfensterWahl';
import { ZEITFENSTER_KEINE, ZEITFENSTER_NICHT_GELADEN_WEB } from '../../../utils/termineWeb';

vi.setConfig({ testTimeout: 30_000 });

const breit = vi.hoisted(() => ({ wert: true }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => breit.wert }));

type Fassung = 'app' | 'web';

beforeEach(() => {
  zuruecksetzen();
});

const geoeffnet = (name: string) => modale.geoeffnet.filter((m) => m.name === name);
const nachladen = async () => {
  for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); });
};

const ABLEHNUNG = Object.assign(new Error('x'), { response: { status: 400, data: { error: 'Abmeldung nicht mehr möglich' } } });

// --- Abmelden -----------------------------------------------------------------------

/** Abmelden: der Knopf, dann das Fenster der Fassung mit dem Grund bestätigen. */
const abmelden = async (fassung: Fassung, knopfText: string, grund: string) => {
  fireEvent.click(knopf(knopfText) as HTMLElement);
  if (fassung === 'app') {
    // Die App öffnet ihr Modal -- kein Fenster der Web-Fassung.
    expect(screen.queryByRole('dialog')).toBe(null);
    const modal = zuletztGeoeffnet('UnregisterModal')!;
    await act(async () => { await (modal.props.onUnregister as (g: string) => Promise<unknown>)(grund.trim()); });
    return modal;
  }
  // Der Browser öffnet das Fenster -- kein Modal der App.
  const fenster = screen.getByRole('dialog', { name: 'Abmeldung' });
  expect(geoeffnet('UnregisterModal')).toHaveLength(0);
  fireEvent.change(within(fenster).getByRole('textbox', { name: 'Grund für die Abmeldung' }), { target: { value: grund } });
  await act(async () => { fireEvent.click(within(fenster).getByRole('button', { name: 'Abmeldung bestätigen' })); });
  return null;
};

/** Die Ablehnung: in der App oben, im Browser im Fenster -- das offen bleibt. */
const erwarteAblehnung = (fassung: Fassung, text: string) => {
  if (fassung === 'app') {
    expect(setError).toHaveBeenCalledWith(text);
    return;
  }
  const fenster = screen.getByRole('dialog');
  expect(within(fenster).getByRole('alert')).toHaveTextContent(text);
  expect(setError).not.toHaveBeenCalled();
};

describe.each<Fassung>(['app', 'web'])('Konfi abmelden (%s): dieselbe Funktion, dieselbe Route', (fassung) => {
  beforeEach(() => { breit.wert = fassung === 'web'; });

  it('freiwilliges Event: „Abmelden" -- DELETE /register mit Grund ohne Rand und client_id', async () => {
    await oeffne(termin({ is_registered: true, booking_status: 'confirmed' }));
    const modal = await abmelden(fassung, 'Abmelden', '  Krank ');
    if (modal) expect(modal.props.mandatory).toBeUndefined();
    expect(api.delete.mock.calls).toEqual([['/konfi/events/5/register', { data: { reason: 'Krank', client_id: 'uuid-1' } }]]);
    expect(api.post).not.toHaveBeenCalled();
    // Im Browser schließt das Fenster nach der Antwort.
    if (fassung === 'web') expect(screen.queryByRole('dialog')).toBe(null);
  });

  it('Warteliste: „Von der Warteliste abmelden" -- dieselbe Route', async () => {
    await oeffne(termin({ booking_status: 'waitlist', waitlist_position: 2, registered_count: 10 }));
    await abmelden(fassung, 'Von der Warteliste abmelden', 'Doch keine Zeit');
    expect(api.delete.mock.calls).toEqual([['/konfi/events/5/register', { data: { reason: 'Doch keine Zeit', client_id: 'uuid-1' } }]]);
  });

  it('Pflicht-Event: POST /opt-out mit Grund (das Fenster im Pflicht-Modus)', async () => {
    await oeffne(termin({ mandatory: true, registration_status: 'mandatory', is_registered: true, booking_status: 'confirmed', points: 0 }));
    if (fassung === 'web') {
      fireEvent.click(knopf('Abmelden') as HTMLElement);
      const fenster = screen.getByRole('dialog', { name: 'Abmeldung' });
      expect(within(fenster).getByText('Deine Eltern müssen die Abmeldung noch bei uns bestätigen.')).toBeInTheDocument();
      fireEvent.change(within(fenster).getByRole('textbox', { name: 'Grund für die Abmeldung' }), { target: { value: 'Klassenfahrt' } });
      await act(async () => { fireEvent.click(within(fenster).getByRole('button', { name: 'Abmeldung bestätigen' })); });
    } else {
      const modal = await abmelden(fassung, 'Abmelden', 'Klassenfahrt');
      expect(modal!.props.mandatory).toBe(true);
    }
    expect(api.post.mock.calls).toEqual([['/konfi/events/5/opt-out', { reason: 'Klassenfahrt', client_id: 'uuid-1' }]]);
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('lehnt der Server ab, steht seine Begründung da', async () => {
    api.delete.mockRejectedValue(ABLEHNUNG);
    await oeffne(termin({ is_registered: true, booking_status: 'confirmed' }));
    await abmelden(fassung, 'Abmelden', 'Krank');
    erwarteAblehnung(fassung, 'Abmeldung nicht mehr möglich');
  });
});

// Was nach dem Schließen geschieht, ohne dass gesendet wurde: Das Modal der
// App lädt bei „Abmelden" beim Schließen die Terminliste neu (dismiss ->
// refreshEvents), das Pflicht-Modal nicht. Das Fenster tut dasselbe.
/** Das Abmelde-Fenster der Fassung schließen, ohne zu senden. */
const abbrechen = (fassung: Fassung) => {
  if (fassung === 'app') {
    const modal = zuletztGeoeffnet('UnregisterModal')!;
    act(() => { (modal.props.dismiss as () => void)(); });
    return;
  }
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Abmeldung' })).getByRole('button', { name: 'Abbrechen' }));
  expect(screen.queryByRole('dialog')).toBe(null);
};

describe.each<Fassung>(['app', 'web'])('Abmelden schließen (%s): danach lädt die Terminliste wie nach dem Modal', (fassung) => {
  beforeEach(() => { breit.wert = fassung === 'web'; });

  it('„Abmelden" geschlossen ohne zu senden: kein DELETE, die Terminliste lädt einmal neu', async () => {
    await oeffne(termin({ is_registered: true, booking_status: 'confirmed' }));
    listeNeuLaden.mockClear();
    fireEvent.click(knopf('Abmelden') as HTMLElement);
    expect(listeNeuLaden).not.toHaveBeenCalled();
    abbrechen(fassung);
    expect(listeNeuLaden).toHaveBeenCalledTimes(1);
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('Pflicht-Event geschlossen ohne zu senden: kein POST, die Terminliste lädt nicht neu', async () => {
    await oeffne(termin({ mandatory: true, registration_status: 'mandatory', is_registered: true, booking_status: 'confirmed', points: 0 }));
    listeNeuLaden.mockClear();
    fireEvent.click(knopf('Abmelden') as HTMLElement);
    if (fassung === 'app') {
      const modal = zuletztGeoeffnet('UnregisterModal')!;
      expect(modal.props.mandatory).toBe(true);
      act(() => { (modal.props.dismiss as () => void)(); });
    } else {
      abbrechen(fassung);
    }
    expect(listeNeuLaden).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
});

// --- Zeitfenster -------------------------------------------------------------------------

const SLOT_FREI = { id: 11, start_time: '2026-11-07T09:00:00Z', end_time: '2026-11-07T11:00:00Z', max_participants: 5, registered_count: 2, waitlist_count: 0 };
const SLOT_VOLL = { id: 12, start_time: '2026-11-07T11:00:00Z', end_time: '2026-11-07T13:00:00Z', max_participants: 3, registered_count: 3, waitlist_count: 1 };
const ZEITFENSTER_EVENT = (zusatz: Record<string, unknown> = {}) => termin({ has_timeslots: true, ...zusatz });

type Eintrag = { text: string; handler?: () => unknown; role?: string };

/** Anmelden tippen und die Einträge des Zeitfenster-Menüs (App) bzw. -Fensters (Browser) lesen. */
const zeitfensterOeffnen = async (fassung: Fassung): Promise<string[]> => {
  await act(async () => { fireEvent.click(knopf(/^Anmelden/) as HTMLElement); });
  if (fassung === 'app') {
    expect(screen.queryByRole('dialog')).toBe(null);
    const menue = presentActionSheet.mock.calls.at(-1)![0] as { header: string; buttons: Eintrag[] };
    expect(menue.header).toBe('Zeitslot auswählen');
    return menue.buttons.filter((b) => b.role !== 'cancel').map((b) => b.text);
  }
  expect(presentActionSheet).not.toHaveBeenCalled();
  const fenster = screen.getByRole('dialog', { name: 'Zeitslot auswählen' });
  return within(within(fenster).getByRole('group', { name: 'Zeitfenster' })).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? '');
};

const zeitfensterWaehlen = async (fassung: Fassung, endung: string) => {
  if (fassung === 'app') {
    const menue = presentActionSheet.mock.calls.at(-1)![0] as { buttons: Eintrag[] };
    const eintrag = menue.buttons.find((b) => b.text.endsWith(endung))!;
    let ergebnis: unknown;
    await act(async () => { ergebnis = eintrag.handler?.(); });
    return ergebnis;
  }
  const fenster = screen.getByRole('dialog', { name: 'Zeitslot auswählen' });
  const eintrag = within(fenster).getAllByRole('button').find((b) => (b.getAttribute('aria-label') ?? '').endsWith(endung))!;
  await act(async () => { fireEvent.click(eintrag); });
  return undefined;
};

describe.each<Fassung>(['app', 'web'])('Zeitfenster wählen (%s): dieselben Einträge, dieselbe Anmeldung', (fassung) => {
  beforeEach(() => { breit.wert = fassung === 'web'; });

  it('freie Plätze und ausgebuchte Zeitfenster; ein freies meldet mit timeslot_id an', async () => {
    zustand.zeitfenster = [SLOT_FREI, SLOT_VOLL];
    await oeffne(ZEITFENSTER_EVENT());
    await nachladen();
    const eintraege = await zeitfensterOeffnen(fassung);
    expect(eintraege).toHaveLength(2);
    expect(eintraege[0]).toMatch(/^\d\d:\d\d - \d\d:\d\d \(3 frei\)$/);
    expect(eintraege[1]).toMatch(/^\d\d:\d\d - \d\d:\d\d \(ausgebucht\)$/);
    expect(api.post).not.toHaveBeenCalled();

    await zeitfensterWaehlen(fassung, '(3 frei)');
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls).toEqual([['/konfi/events/5/register', { timeslot_id: 11 }]]);
    if (fassung === 'web') await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
  });

  it('ein ausgebuchtes Zeitfenster ohne Warteliste: derselbe Satz, keine Anmeldung, die Wahl bleibt offen', async () => {
    zustand.zeitfenster = [SLOT_FREI, SLOT_VOLL];
    await oeffne(ZEITFENSTER_EVENT());
    await nachladen();
    await zeitfensterOeffnen(fassung);
    const ergebnis = await zeitfensterWaehlen(fassung, '(ausgebucht)');
    expect(api.post).not.toHaveBeenCalled();
    if (fassung === 'app') {
      // false hält das Aktionsmenü offen.
      expect(ergebnis).toBe(false);
      expect(setError).toHaveBeenCalledWith(ZEITSLOT_AUSGEBUCHT);
    } else {
      const fenster = screen.getByRole('dialog', { name: 'Zeitslot auswählen' });
      expect(within(fenster).getByRole('alert')).toHaveTextContent(ZEITSLOT_AUSGEBUCHT);
      expect(setError).not.toHaveBeenCalled();
    }
  });

  it('voll, aber die Warteliste nimmt auf: „auf Warteliste" -- buchbar, mit timeslot_id', async () => {
    zustand.zeitfenster = [SLOT_VOLL];
    await oeffne(ZEITFENSTER_EVENT({ waitlist_enabled: true, max_waitlist_size: 0 }));
    await nachladen();
    const eintraege = await zeitfensterOeffnen(fassung);
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]).toMatch(/\(voll — auf Warteliste, 1 warten\)$/);
    await zeitfensterWaehlen(fassung, 'warten)');
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls).toEqual([['/konfi/events/5/register', { timeslot_id: 12 }]]);
  });

  it('lehnt der Server die Anmeldung ab, steht seine Begründung da', async () => {
    api.post.mockRejectedValue(Object.assign(new Error('x'), { response: { status: 400, data: { error: 'Anmeldung nicht mehr möglich' } } }));
    zustand.zeitfenster = [SLOT_FREI];
    await oeffne(ZEITFENSTER_EVENT());
    await nachladen();
    await zeitfensterOeffnen(fassung);
    await zeitfensterWaehlen(fassung, '(3 frei)');
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    expect(api.post.mock.calls).toEqual([['/konfi/events/5/register', { timeslot_id: 11 }]]);
    if (fassung === 'app') {
      await waitFor(() => expect(setError).toHaveBeenCalledWith('Anmeldung nicht mehr möglich'));
    } else {
      const fenster = screen.getByRole('dialog', { name: 'Zeitslot auswählen' });
      await waitFor(() => expect(within(fenster).getByRole('alert')).toHaveTextContent('Anmeldung nicht mehr möglich'));
      expect(setError).not.toHaveBeenCalled();
    }
  });
});

// --- Zeitfenster fehlen: App fragt nach, der Browser sperrt und nennt den Grund ------------
describe('Zeitfenster-Event ohne Zeitfenster', () => {
  it('App: „Anmelden" bleibt frei, beim Tippen die Rückfrage „Zeitfenster nicht geladen"; kein POST', async () => {
    breit.wert = false;
    await oeffne(ZEITFENSTER_EVENT());
    await nachladen();
    await act(async () => { fireEvent.click(knopf(/^Anmelden/) as HTMLElement); });
    expect(presentAlert.mock.calls.at(-1)![0]).toEqual(expect.objectContaining({
      header: 'Zeitfenster nicht geladen',
      message: ZEITFENSTER_KEINE,
    }));
    expect(api.post).not.toHaveBeenCalled();
  });

  it('Browser: „Anmelden" gesperrt, daneben der Grund -- keine Rückfrage, kein Fenster', async () => {
    breit.wert = true;
    await oeffne(ZEITFENSTER_EVENT());
    await nachladen();
    const anmelden = knopf(/^Anmelden/) as HTMLButtonElement;
    expect(anmelden).toBeDisabled();
    expect(screen.getByText(ZEITFENSTER_KEINE)).toBeInTheDocument();
    fireEvent.click(anmelden);
    expect(presentAlert).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('Browser: die Zeitfenster kamen nicht an -- gesperrt mit dem Satz für den Browser (neu laden statt ziehen)', async () => {
    breit.wert = true;
    api.get.mockImplementation(async (pfad: string) => {
      if (pfad === '/konfi/events') return { data: zustand.events };
      if (/\/timeslots$/.test(pfad)) throw new Error('Netz weg');
      return { data: [] };
    });
    await oeffne(ZEITFENSTER_EVENT());
    await nachladen();
    expect(knopf(/^Anmelden/)).toBeDisabled();
    expect(screen.getByText(ZEITFENSTER_NICHT_GELADEN_WEB)).toBeInTheDocument();
  });

  it('Browser: solange die Zeitfenster laden, ist „Anmelden" gesperrt, ohne Grund', async () => {
    breit.wert = true;
    api.get.mockImplementation((pfad: string) => {
      if (pfad === '/konfi/events') return Promise.resolve({ data: zustand.events });
      if (/\/timeslots$/.test(pfad)) return new Promise(() => undefined);
      return Promise.resolve({ data: [] });
    });
    await oeffne(ZEITFENSTER_EVENT());
    await nachladen();
    expect(knopf(/^Anmelden/)).toBeDisabled();
    expect(screen.queryByText(ZEITFENSTER_KEINE)).toBe(null);
    expect(screen.queryByText(ZEITFENSTER_NICHT_GELADEN_WEB)).toBe(null);
  });

  it('Browser: ohne Netz geöffnet und nichts gemerkt -- kommt das Netz zurück, kommen die Zeitfenster; kein falscher Grund', async () => {
    breit.wert = true;
    zustand.online = false;
    zustand.zeitfenster = [SLOT_FREI];
    const event = ZEITFENSTER_EVENT();
    const ansicht = await oeffne(event);
    await nachladen();
    expect(api.get).not.toHaveBeenCalledWith('/konfi/events/5/timeslots');

    zustand.online = true;
    const EventDetailView = (await import('../../../components/konfi/views/EventDetailView')).default;
    await act(async () => { ansicht.rerender(<EventDetailView eventId={event.id} onBack={() => undefined} />); });
    await nachladen();
    expect(api.get).toHaveBeenCalledWith('/konfi/events/5/timeslots');
    expect(screen.queryByText(ZEITFENSTER_KEINE)).toBe(null);
    expect(knopf(/^Anmelden/)).toBeEnabled();
  });

  it('App: ohne Netz geöffnet und nichts gemerkt -- kommt das Netz zurück, öffnet „Anmelden" die Wahl statt der Rückfrage', async () => {
    breit.wert = false;
    zustand.online = false;
    zustand.zeitfenster = [SLOT_FREI];
    const event = ZEITFENSTER_EVENT();
    const ansicht = await oeffne(event);
    await nachladen();
    expect(api.get).not.toHaveBeenCalledWith('/konfi/events/5/timeslots');

    zustand.online = true;
    const EventDetailView = (await import('../../../components/konfi/views/EventDetailView')).default;
    await act(async () => { ansicht.rerender(<EventDetailView eventId={event.id} onBack={() => undefined} />); });
    await nachladen();
    expect(api.get).toHaveBeenCalledWith('/konfi/events/5/timeslots');
    await act(async () => { fireEvent.click(knopf(/^Anmelden/) as HTMLElement); });
    expect(presentAlert).not.toHaveBeenCalled();
    expect((presentActionSheet.mock.calls.at(-1)![0] as { header: string }).header).toBe('Zeitslot auswählen');
  });

  it('Browser: ohne Netz geöffnet und nichts gemerkt -- solange die Zeitfenster danach laden, gesperrt ohne Grund', async () => {
    breit.wert = true;
    zustand.online = false;
    api.get.mockImplementation((pfad: string) => {
      if (pfad === '/konfi/events') return Promise.resolve({ data: zustand.events });
      if (/\/timeslots$/.test(pfad)) return new Promise(() => undefined);
      return Promise.resolve({ data: [] });
    });
    const event = ZEITFENSTER_EVENT();
    const ansicht = await oeffne(event);
    await nachladen();

    zustand.online = true;
    const EventDetailView = (await import('../../../components/konfi/views/EventDetailView')).default;
    await act(async () => { ansicht.rerender(<EventDetailView eventId={event.id} onBack={() => undefined} />); });
    await nachladen();
    expect(api.get).toHaveBeenCalledWith('/konfi/events/5/timeslots');
    expect(knopf(/^Anmelden/)).toBeDisabled();
    expect(screen.queryByText(ZEITFENSTER_KEINE)).toBe(null);
    expect(screen.queryByText(ZEITFENSTER_NICHT_GELADEN_WEB)).toBe(null);
  });

  it('Browser: mit Zeitfenstern ist „Anmelden" frei und öffnet die Wahl', async () => {
    breit.wert = true;
    zustand.zeitfenster = [SLOT_FREI];
    await oeffne(ZEITFENSTER_EVENT());
    await nachladen();
    expect(knopf(/^Anmelden/)).toBeEnabled();
    await act(async () => { fireEvent.click(knopf(/^Anmelden/) as HTMLElement); });
    expect(screen.getByRole('dialog', { name: 'Zeitslot auswählen' })).toBeInTheDocument();
  });
});

describe('Zeitfenster-Fenster (web): solange angemeldet wird, bleibt es', () => {
  it('während POST /register schließt nichts; nach der Antwort schließt es', async () => {
    breit.wert = true;
    let fertig: (wert: unknown) => void = () => undefined;
    api.post.mockReturnValue(new Promise((ok) => { fertig = ok; }));
    zustand.zeitfenster = [SLOT_FREI];
    await oeffne(ZEITFENSTER_EVENT());
    await nachladen();
    await zeitfensterOeffnen('web');
    await zeitfensterWaehlen('web', '(3 frei)');
    const fenster = screen.getByRole('dialog', { name: 'Zeitslot auswählen' });
    expect(within(fenster).getByRole('button', { name: 'Schließen' })).toBeDisabled();
    expect(within(fenster).getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
    fireEvent.keyDown(fenster, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Zeitslot auswählen' })).toBe(fenster);
    await act(async () => { fertig({ data: { status: 'confirmed' } }); });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBe(null));
  });
});

describe('Fenster (web) gehören zu ihrem Termin', () => {
  it('wechselt die Ansicht zu einem anderen Termin, ist ein offenes Abmelde-Fenster weg', async () => {
    breit.wert = true;
    const erster = termin({ is_registered: true, booking_status: 'confirmed' });
    const zweiter = termin({ id: 6, name: 'Konfi-Freizeit', is_registered: true, booking_status: 'confirmed' });
    zustand.events = [erster, zweiter];
    const ansicht = await oeffne(erster);
    fireEvent.click(knopf('Abmelden') as HTMLElement);
    expect(screen.getByRole('dialog', { name: 'Abmeldung' })).toHaveAccessibleDescription('Abmeldung von Sommerfest');

    // Dieselbe Instanz bekommt eine neue eventId (wie ParamSeite im Router).
    const EventDetailView = (await import('../../../components/konfi/views/EventDetailView')).default;
    await act(async () => { ansicht.rerender(<EventDetailView eventId={6} onBack={() => undefined} />); });
    await nachladen();
    expect(screen.getByRole('heading', { name: 'Konfi-Freizeit' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(api.delete).not.toHaveBeenCalled();
  });
});
