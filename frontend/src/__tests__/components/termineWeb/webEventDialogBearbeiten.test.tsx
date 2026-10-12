// Ein Event bearbeiten und aus der Detailseite kopieren -- im Browser als
// eigener Dialog, gerendert (11.10.2026, Simon: „Web braucht eigene
// kompaktere Modale überall").
//
// Gerendert wird die echte Detailansicht der Leitung (EventDetailView) im
// breiten Fenster mit dem echten Dialog und dem Hook der App
// (useEventFormular). Nachgestellt sind Server, Kontext, Netz und Ionic
// (gerueste/leitungTerminDetail). Geprüft: Vorbelegung aus dem Event (auch die
// Zeitfenster, die der Server in UTC liefert), der genaue Körper an
// PUT /events/:id, danach zurück zur Liste wie in der App, die Warteschlange
// ohne Netz -- und im schmalen Fenster weiter das App-Modal.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent, within, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, teilnahme, oeffne, api, setSuccess, modale,
} from '../gerueste/leitungTerminDetail';

vi.setConfig({ testTimeout: 30_000 });

const breit = vi.hoisted(() => ({ wert: true }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => breit.wert }));

// Netz und Warteschlange: nur isOnline und enqueue nachgestellt, der Rest echt.
const netz = vi.hoisted(() => ({ online: true, enqueue: vi.fn() }));
vi.mock('../../../services/networkMonitor', async (original) => {
  const echt = await original<typeof import('../../../services/networkMonitor')>();
  return {
    ...echt,
    networkMonitor: new Proxy(echt.networkMonitor, { get: (ziel, k) => (k === 'isOnline' ? netz.online : Reflect.get(ziel, k)) }),
  };
});
vi.mock('../../../services/writeQueue', async (original) => {
  const echt = await original<typeof import('../../../services/writeQueue')>();
  return {
    ...echt,
    writeQueue: new Proxy(echt.writeQueue, { get: (ziel, k) => (k === 'enqueue' ? netz.enqueue : Reflect.get(ziel, k)) }),
  };
});

const KATEGORIEN = [{ id: 5, name: 'Gottesdienst' }, { id: 6, name: 'Freizeit' }];
const JAHRGAENGE = [{ id: 1, name: 'Jahrgang 2026' }, { id: 2, name: 'Jahrgang 2027' }];

/** Die Konfi-Freizeit, wie GET /events/7 sie liefert: Zeiten in UTC (Berlin = UTC+2). */
const FREIZEIT = () => termin({
  id: 7, name: 'Konfi-Freizeit', description: 'Drei Tage am See.', location: 'Jugendherberge Musterstadt',
  event_date: '2026-10-16T15:00:00.000Z', event_end_time: '2026-10-18T12:00:00.000Z',
  registration_opens_at: '2026-10-01T08:00:00.000Z', registration_closes_at: '2026-10-14T21:45:00.000Z',
  points: 3, point_type: 'gemeinde', max_participants: 40, waitlist_enabled: false, max_waitlist_size: 2,
  jahrgaenge: [{ id: 1, name: 'Jahrgang 2026' }], categories: [{ id: 6, name: 'Freizeit' }],
  teamer_needed: true, teamer_only: false, teamer_max_participants: 4, teamer_waitlist_enabled: true, teamer_max_waitlist_size: 2,
  checkin_window: 60, bring_items: 'Schlafsack', has_timeslots: false, mandatory: false, is_konfirmation: false,
  participants: [teilnahme(1, 'Kim Konfi')],
});

/** Der Körper, den Speichern ohne Änderung schickt: alles aus dem Event, ohne Serienfelder. */
const FREIZEIT_KOERPER = {
  name: 'Konfi-Freizeit', description: 'Drei Tage am See.',
  event_date: '2026-10-16T15:00:00.000Z', event_end_time: '2026-10-18T12:00:00.000Z',
  location: 'Jugendherberge Musterstadt', points: 3, point_type: 'gemeinde', category_ids: [6], jahrgang_ids: [1],
  type: 'event', max_participants: 40,
  registration_opens_at: '2026-10-01T08:00:00.000Z', registration_closes_at: '2026-10-14T21:45:00.000Z',
  has_timeslots: false, waitlist_enabled: false, max_waitlist_size: 2, timeslots: [],
  mandatory: false, is_konfirmation: false, bring_items: 'Schlafsack', checkin_window: 60,
  teamer_needed: true, teamer_only: false, teamer_max_participants: 4,
  teamer_waitlist_enabled: true, teamer_max_waitlist_size: 2,
};

let zeitfenster: unknown[] = [];

beforeEach(() => {
  zuruecksetzen();
  breit.wert = true;
  netz.online = true;
  netz.enqueue.mockReset();
  netz.enqueue.mockResolvedValue(undefined);
  zeitfenster = [];
  zustand.detail = FREIZEIT();
  api.get.mockImplementation((pfad: string) => Promise.resolve({
    data: /^\/events\/\d+$/.test(pfad) ? zustand.detail
      : pfad === '/admin/categories' ? KATEGORIEN
        : pfad === '/admin/jahrgaenge' ? JAHRGAENGE
          : pfad === '/events/7/timeslots' ? zeitfenster
            : [],
  }));
});

const warte = async () => { for (let i = 0; i < 3; i += 1) await act(async () => { await Promise.resolve(); }); };
const bearbeiten = async () => {
  const r = await oeffne();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Event bearbeiten' })); });
  await warte();
  return { ...r, d: screen.getByRole('dialog', { name: 'Event bearbeiten' }) };
};
const textfeld = (d: HTMLElement, name: string) => within(d).getByRole('textbox', { name }) as HTMLInputElement;
const auswahl = (d: HTMLElement, name: string) => within(d).getByRole('combobox', { name }) as HTMLSelectElement;
const datum = (d: HTMLElement, name: string) => within(d).getByLabelText(name) as HTMLInputElement;
const schalter = (d: HTMLElement, name: string) => within(d).getByRole('switch', { name }) as HTMLInputElement;
const haken = (d: HTMLElement, gruppe: string, name: string) =>
  within(within(d).getByRole('group', { name: gruppe })).getByRole('checkbox', { name }) as HTMLInputElement;
const tippe = (feld: HTMLElement, wert: string) => fireEvent.change(feld, { target: { value: wert } });
const speichern = async (d: HTMLElement, knopf = 'Speichern') => {
  await act(async () => { fireEvent.click(within(d).getByRole('button', { name: knopf })); });
  await warte();
};
const eventModalGeoeffnet = () => modale.geoeffnet.filter((m) => m.name === 'EventModal');

describe('Bearbeiten im breiten Fenster', () => {
  it('öffnet den Dialog „Event bearbeiten", nicht das App-Modal', async () => {
    const { d } = await bearbeiten();
    expect(d).toHaveClass('web-dialog--breit');
    expect(within(d).getByRole('button', { name: 'Speichern' })).toBeInTheDocument();
    expect(eventModalGeoeffnet()).toHaveLength(0);
  });

  it('Vorbelegung aus dem Event: Texte, Ortszeit statt UTC, Anmeldung, Zuordnung, Plätze über 30, Team, Punkte, Check-in', async () => {
    const { d } = await bearbeiten();
    expect(textfeld(d, 'Event-Name').value).toBe('Konfi-Freizeit');
    expect(textfeld(d, 'Ort').value).toBe('Jugendherberge Musterstadt');
    expect(textfeld(d, 'Beschreibung').value).toBe('Drei Tage am See.');
    expect(textfeld(d, 'Was mitbringen (optional)').value).toBe('Schlafsack');
    expect(auswahl(d, 'Für wen ist das Event?').value).toBe('teamer_needed');
    expect(datum(d, 'Datum & Uhrzeit').value).toBe('2026-10-16T17:00');
    expect(datum(d, 'Endzeit (optional)').value).toBe('2026-10-18T14:00');
    expect(schalter(d, 'Anmeldung ab sofort').checked).toBe(false);
    expect(datum(d, 'Anmeldung ab').value).toBe('2026-10-01T10:00');
    expect(datum(d, 'Anmeldeschluss').value).toBe('2026-10-14T23:45');
    expect(haken(d, 'Kategorien (mehrere möglich)', 'Freizeit').checked).toBe(true);
    expect(haken(d, 'Kategorien (mehrere möglich)', 'Gottesdienst').checked).toBe(false);
    expect(haken(d, 'Jahrgänge (mehrere möglich)', 'Jahrgang 2026').checked).toBe(true);
    // 40 Plätze liegen über der Vorgabe 30 und bleiben wählbar (wie der Regler der App).
    expect(auswahl(d, 'Max. Teilnehmer:innen').value).toBe('40');
    expect(auswahl(d, 'Warteliste').value).toBe('0');
    expect(auswahl(d, 'Punkte').value).toBe('3');
    expect(auswahl(d, 'Typ').value).toBe('gemeinde');
    expect(auswahl(d, 'Wie viele Personen werden fürs Team gesucht?').value).toBe('4');
    expect(auswahl(d, 'Warteliste fürs Team').value).toBe('2');
    expect(auswahl(d, 'Check-in-Fenster (Minuten)').value).toBe('60');
    // Eine Serie gibt es nur beim Anlegen.
    expect(within(d).queryByRole('switch', { name: 'Als Serie erstellen' })).toBe(null);
  });

  it('Speichern ohne Änderung: PUT /events/7 mit genau den Werten des Events, ohne Serienfelder; danach zurück zur Liste', async () => {
    const { d, onBack } = await bearbeiten();
    await speichern(d);
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put).toHaveBeenCalledWith('/events/7', FREIZEIT_KOERPER);
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('ein neuer Beginn zieht beim Bearbeiten nur das Ende mit, die gesetzten Anmeldezeiten bleiben', async () => {
    const { d } = await bearbeiten();
    tippe(datum(d, 'Datum & Uhrzeit'), '2026-10-21T17:00');
    expect(datum(d, 'Endzeit (optional)').value).toBe('2026-10-23T14:00');
    expect(datum(d, 'Anmeldeschluss').value).toBe('2026-10-14T23:45');
    tippe(textfeld(d, 'Ort'), '');
    tippe(auswahl(d, 'Für wen ist das Event?'), 'normal');
    await speichern(d);
    expect(api.put).toHaveBeenCalledWith('/events/7', {
      ...FREIZEIT_KOERPER,
      event_date: '2026-10-21T15:00:00.000Z', event_end_time: '2026-10-23T12:00:00.000Z', location: null,
      teamer_needed: false, teamer_max_participants: 0, teamer_waitlist_enabled: false, teamer_max_waitlist_size: 0,
    });
  });

  it('Zeitfenster des Events: in Ortszeit gezeigt, eine geänderte Uhrzeit behält den Tag', async () => {
    zustand.detail = { ...FREIZEIT(), has_timeslots: true };
    zeitfenster = [
      { id: 11, start_time: '2026-10-16T15:00:00.000Z', end_time: '2026-10-16T16:00:00.000Z', max_participants: 8, registered_count: 3 },
    ];
    const { d } = await bearbeiten();
    expect(api.get).toHaveBeenCalledWith('/events/7/timeslots');
    const fenster = within(d).getByRole('group', { name: 'Zeitfenster 1' });
    expect((within(fenster).getByLabelText('Startzeit') as HTMLInputElement).value).toBe('17:00');
    expect((within(fenster).getByLabelText('Endzeit') as HTMLInputElement).value).toBe('18:00');
    expect((within(fenster).getByRole('combobox', { name: 'Max. Teilnehmer:innen' }) as HTMLSelectElement).value).toBe('8');
    tippe(within(fenster).getByLabelText('Endzeit'), '18:30');
    await speichern(d);
    expect(api.put.mock.calls[0][1].timeslots).toEqual([
      { id: 11, start_time: '2026-10-16T15:00:00.000Z', end_time: '2026-10-16T16:30:00.000Z', max_participants: 8, registered_count: 3 },
    ]);
  });

  it('Abbrechen schickt nichts und bleibt auf dem Event', async () => {
    const { d, onBack } = await bearbeiten();
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Abbrechen' })); });
    expect(screen.queryByRole('dialog')).toBe(null);
    expect(api.put).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });

  it('ohne Netz: PUT in die Warteschlange, Meldung wie in der App', async () => {
    netz.online = false;
    const { d, onBack } = await bearbeiten();
    await speichern(d);
    expect(api.put).not.toHaveBeenCalled();
    expect(netz.enqueue).toHaveBeenCalledTimes(1);
    expect(netz.enqueue).toHaveBeenCalledWith({
      method: 'PUT', url: '/events/7', body: FREIZEIT_KOERPER, maxRetries: 5, hasFileUpload: false,
      metadata: { type: 'admin', clientId: expect.any(String), label: 'Event bearbeiten' },
    });
    expect(setSuccess).toHaveBeenCalledWith('Event wird aktualisiert sobald du wieder online bist');
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

// Admins und Teamer:innen sehen in GET /admin/jahrgaenge nur ihre eigenen
// Jahrgänge. Gehört ein Event auch einem fremden, zeigt der Dialog ihn nicht
// als Haken -- er darf aber nicht still aus jahrgang_ids fallen, sobald
// jemand an den sichtbaren Haken dreht (Gegenprüfung 11.10.2026). Die App
// schaltet relativ zum bisherigen Stand um und behält ihn; der Server lehnt
// dann ab, wenn der fremde Jahrgang bleibt.
describe('Jahrgänge außerhalb der eigenen bleiben erhalten', () => {
  const NUR_EIGENER = [{ id: 1, name: 'Jahrgang 2026' }];
  beforeEach(() => {
    zustand.detail = {
      ...FREIZEIT(),
      jahrgaenge: [{ id: 1, name: 'Jahrgang 2026' }, { id: 2, name: 'Jahrgang 2027' }],
    };
    api.get.mockImplementation((pfad: string) => Promise.resolve({
      data: /^\/events\/\d+$/.test(pfad) ? zustand.detail
        : pfad === '/admin/categories' ? KATEGORIEN
          : pfad === '/admin/jahrgaenge' ? NUR_EIGENER
            : [],
    }));
  });
  const gruppe = (d: HTMLElement) => within(d).getByRole('group', { name: 'Jahrgänge (mehrere möglich)' });

  it('der Hinweis nennt den verdeckten Jahrgang; Speichern ohne Klick schickt beide', async () => {
    const { d } = await bearbeiten();
    expect(within(gruppe(d)).getAllByRole('checkbox')).toHaveLength(1);
    expect(within(gruppe(d)).getByText('2 ausgewählt, davon 1 außerhalb deiner Jahrgänge: Jahrgang 2027.')).toBeInTheDocument();
    await speichern(d);
    expect(api.put).toHaveBeenCalledWith('/events/7', { ...FREIZEIT_KOERPER, jahrgang_ids: [1, 2] });
  });

  it('Haken ab und wieder an: PUT /events/7 behält den fremden Jahrgang (jahrgang_ids [1, 2])', async () => {
    const { d } = await bearbeiten();
    await act(async () => { fireEvent.click(haken(d, 'Jahrgänge (mehrere möglich)', 'Jahrgang 2026')); });
    expect(haken(d, 'Jahrgänge (mehrere möglich)', 'Jahrgang 2026').checked).toBe(false);
    expect(within(gruppe(d)).getByText('1 ausgewählt, davon 1 außerhalb deiner Jahrgänge: Jahrgang 2027.')).toBeInTheDocument();
    await act(async () => { fireEvent.click(haken(d, 'Jahrgänge (mehrere möglich)', 'Jahrgang 2026')); });
    await speichern(d);
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put).toHaveBeenCalledWith('/events/7', { ...FREIZEIT_KOERPER, jahrgang_ids: [1, 2] });
  });

  it('nur den eigenen abgehakt: der fremde bleibt (jahrgang_ids [2]) -- wie in der App', async () => {
    const { d } = await bearbeiten();
    await act(async () => { fireEvent.click(haken(d, 'Jahrgänge (mehrere möglich)', 'Jahrgang 2026')); });
    await speichern(d);
    expect(api.put).toHaveBeenCalledWith('/events/7', { ...FREIZEIT_KOERPER, jahrgang_ids: [2] });
  });

  it('lehnt der Server den fremden Jahrgang ab, steht seine Meldung im Dialog, der offen bleibt', async () => {
    api.put.mockRejectedValue({ response: { status: 403, data: { error: 'Kein Zugriff auf diesen Jahrgang' } } });
    const { d, onBack } = await bearbeiten();
    await speichern(d);
    expect(within(d).getByRole('alert')).toHaveTextContent('Kein Zugriff auf diesen Jahrgang');
    expect(screen.getByRole('dialog', { name: 'Event bearbeiten' })).toBe(d);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('Kategorien: eine, die die Liste nicht kennt, bleibt beim Umschalten erhalten', async () => {
    zustand.detail = { ...zustand.detail, categories: [{ id: 6, name: 'Freizeit' }, { id: 9, name: 'Ausflug' }] };
    const { d } = await bearbeiten();
    await act(async () => { fireEvent.click(haken(d, 'Kategorien (mehrere möglich)', 'Gottesdienst')); });
    await speichern(d);
    expect(api.put).toHaveBeenCalledWith('/events/7', { ...FREIZEIT_KOERPER, category_ids: [5, 6, 9], jahrgang_ids: [1, 2] });
  });
});

describe('Kopieren aus der Detailseite im breiten Fenster', () => {
  it('öffnet „Event kopieren" mit der Vorlage; Speichern legt NEU an (POST /events) und führt zurück zur Liste', async () => {
    // Fester Zeitpunkt: Samstag, 03.10.2026, 10:30 Uhr -- die Kopie beginnt um 11:00.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-03T08:30:00Z'));
    const { onBack } = await oeffne();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Event kopieren' })); });
    await warte();
    const d = screen.getByRole('dialog', { name: 'Event kopieren' });
    expect(eventModalGeoeffnet()).toHaveLength(0);
    expect(textfeld(d, 'Event-Name').value).toBe('Konfi-Freizeit');
    // Neues Datum: Die Kopie beginnt wie ein neues Event; „ab sofort" statt des alten Anmeldestarts.
    expect(schalter(d, 'Anmeldung ab sofort').checked).toBe(true);
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Event anlegen' })); });
    await warte();
    expect(api.put).not.toHaveBeenCalled();
    expect(api.post).toHaveBeenCalledTimes(1);
    // Alles aus dem Original; das Datum neu (Dauer 45 Stunden bleibt), Anmeldung ab sofort, Schluss neu gerechnet.
    expect(api.post).toHaveBeenCalledWith('/events', {
      ...FREIZEIT_KOERPER,
      event_date: '2026-10-03T09:00:00.000Z', event_end_time: '2026-10-05T06:00:00.000Z',
      registration_opens_at: null, registration_closes_at: '2026-10-03T08:45:00.000Z',
      is_series: false, series_count: undefined, series_interval: undefined,
      client_id: expect.any(String),
    });
    expect(onBack).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

describe('Schmales Fenster: das App-Modal bleibt', () => {
  it('Bearbeiten und Kopieren öffnen das App-Modal, keinen Dialog', async () => {
    breit.wert = false;
    await oeffne();
    fireEvent.click(screen.getByRole('button', { name: 'Event bearbeiten' }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Event kopieren' })); });
    expect(eventModalGeoeffnet()).toHaveLength(2);
    expect(screen.queryByRole('dialog')).toBe(null);
  });
});
