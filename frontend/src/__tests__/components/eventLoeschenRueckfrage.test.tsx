// Die zweite Rueckfrage beim Loeschen eines Termins erscheint wirklich
// (16.09.2026)
//
// DER FEHLER: Ein Termin mit Anmeldungen liess sich nicht loeschen. Man tippte
// auf "Loeschen", der Dialog verschwand -- und sonst passierte nichts. Der
// Termin blieb stehen, ohne Meldung, ohne Rueckfrage.
//
// DIE KETTE, nachgelesen in beiden Paketen:
//
//   1. @ionic/core (alert.js, buttonClick): Der Knopf-Handler wird
//      `await`ed, BEVOR der Alert geschlossen wird. Ein asynchroner
//      Handler laeuft also vollstaendig im noch OFFENEN Alert.
//   2. @ionic/react (useController.present): Ein zweiter present-Aufruf,
//      waehrend noch ein Overlay offen ist, wird mit
//      `if (overlayRef.current) { return; }` STILL verworfen -- kein Fehler,
//      kein Log. Freigegeben wird die Referenz erst im DidDismiss-Handler.
//
// Zusammen: Der `await api.delete(...)` im Handler des ersten Alerts laeuft,
// waehrend dieser Alert noch offen ist. Das Backend antwortet mit 409 und den
// konkreten Zahlen (booking_count, message_count, points_total) -- das ist
// KEIN Fehler, sondern eine Rueckfrage. Der Aufruf der zweiten Rueckfrage
// trifft aber auf das noch belegte overlayRef und verpufft. Erst DANACH
// schliesst der erste Alert. Fuer die Nutzerin: Dialog weg, nichts passiert.
//
// WARUM DIESER TEST SO GEBAUT IST: Geprueft wird Verhalten, nicht Quelltext.
// Ein Test auf "confirmForceDelete existiert" waere gruen gewesen, solange der
// Fehler bestand -- die Funktion gab es ja die ganze Zeit. Der useIonAlert-Mock
// hier bildet deshalb GENAU die beiden Mechaniken oben nach:
//
//   - present() waehrend ein Alert offen ist -> wird still verworfen,
//   - der Knopf-Handler wird abgewartet, DANN erst schliesst der Alert.
//
// Ein naiver Mock, der jeden present-Aufruf mitzaehlt, wuerde den Fehler nicht
// zeigen -- er wuerde gruen leuchten, obwohl die App kaputt ist.
//
// Gegenprobe (Fix zurueckgedreht) ist gelaufen: Beide Rueckfrage-Tests fallen.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import type { Event } from '../../types/event';

// --- Der Ionic-Alert-Nachbau ----------------------------------------------

interface AlertKnopf {
  text: string;
  role?: string;
  handler?: () => unknown | Promise<unknown>;
}
interface AlertOptionen {
  header?: string;
  message?: string;
  buttons: AlertKnopf[];
  onDidDismiss?: () => void;
  backdropDismiss?: boolean;
}

/** Alle Alerts, die WIRKLICH aufgegangen sind (verworfene fehlen hier). */
let offeneAlerts: AlertOptionen[] = [];
/** Der aktuell offene Alert -- entspricht overlayRef.current in Ionic. */
let aktiverAlert: AlertOptionen | null = null;
/** Jeder present-Versuch, auch der still verworfene. */
let presentVersuche: AlertOptionen[] = [];

const presentAlert = (optionen: AlertOptionen) => {
  presentVersuche.push(optionen);
  // @ionic/react useController.present: `if (overlayRef.current) return;`
  if (aktiverAlert) return;
  aktiverAlert = optionen;
  offeneAlerts.push(optionen);
};

const dismissAlert = async () => {
  const alert = aktiverAlert;
  aktiverAlert = null;
  alert?.onDidDismiss?.();
};

/**
 * Tippt auf einen Knopf des aktuell offenen Alerts -- mit der Reihenfolge aus
 * @ionic/core buttonClick: erst den Handler ABWARTEN, dann schliessen.
 */
const tippeAlertKnopf = async (text: string) => {
  const alert = aktiverAlert;
  if (!alert) throw new Error(`Kein Alert offen -- "${text}" nicht antippbar`);
  const knopf = alert.buttons.find(b => b.text === text);
  if (!knopf) throw new Error(`Knopf "${text}" fehlt im Alert "${alert.header}"`);
  await act(async () => {
    if (knopf.role === 'cancel') {
      // isCancel(role): Ionic schliesst sofort, ohne den Handler abzuwarten.
      await dismissAlert();
      knopf.handler?.();
      return;
    }
    const ergebnis = await knopf.handler?.();
    if (ergebnis !== false) await dismissAlert();
  });
};

// --- Mocks ----------------------------------------------------------------

const apiDelete = vi.fn();
const setError = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [], headers: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 1, organization_id: 1, role_name: 'org_admin' },
    setSuccess: vi.fn(),
    setError,
    isOnline: true,
  }),
}));

vi.mock('../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));

vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveUpdate: () => ({ triggerRefresh: vi.fn() }),
  useLiveRefresh: () => {},
}));

vi.mock('../../navigation/useAppLocation', () => ({
  useAppLocation: () => ({ search: '', pathname: '/admin/events' }),
}));

// Die Termine kommen fest herein statt ueber den Offline-Cache: Dieser Test
// prueft das Loeschen, nicht das Laden.
let testEvents: Event[] = [];
const refreshEvents = vi.fn().mockResolvedValue(undefined);

vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => ({
    data: schluessel.startsWith('admin:events:') ? testEvents : [],
    loading: false,
    error: null,
    isStale: false,
    isOffline: false,
    refresh: refreshEvents,
    refreshLive: vi.fn().mockResolvedValue(undefined),
  }),
}));

// EventsView ersetzt durch je einen Knopf pro Termin: Der Wisch-Gestus der
// echten Liste ist hier nicht der Gegenstand -- der Weg AB onDeleteEvent ist es.
vi.mock('../../components/admin/EventsView', () => ({
  default: ({ events, onDeleteEvent }: {
    events: Event[];
    onDeleteEvent?: (e: Event) => void;
  }) => React.createElement(
    'div',
    null,
    events.map(e => React.createElement(
      'button',
      { key: e.id, onClick: () => onDeleteEvent?.(e) },
      `loeschen-${e.id}`
    ))
  ),
}));

vi.mock('../../components/admin/ActivityRequestsView', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/EventModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/ActivityRequestModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/TerminAbsagenModal', () => ({ default: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));

interface ActionSheetKnopf { text: string; role?: string; handler?: () => void }
let aktivesActionSheet: { buttons: ActionSheetKnopf[] } | null = null;

vi.mock('@ionic/react', async () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    IonPage: passthrough,
    IonHeader: passthrough,
    IonToolbar: passthrough,
    IonTitle: passthrough,
    IonContent: passthrough,
    IonRefresher: () => null,
    IonRefresherContent: () => null,
    IonButtons: passthrough,
    IonButton: passthrough,
    IonIcon: () => null,
    IonSegment: passthrough,
    IonSegmentButton: passthrough,
    IonLabel: passthrough,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonActionSheet: () => [
      (optionen: { buttons: ActionSheetKnopf[] }) => { aktivesActionSheet = optionen; },
      vi.fn(),
    ],
    useIonAlert: () => [presentAlert, dismissAlert],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

import AdminEventsPage from '../../components/admin/pages/AdminEventsPage';

// --- Testdaten ------------------------------------------------------------

const termin = (id: number, zusatz: Partial<Event> = {}): Event => ({
  id,
  name: `Termin ${id}`,
  description: '',
  event_date: '2026-10-01T18:00:00.000Z',
  location: '',
  points: 0,
  type: 'gottesdienst',
  max_participants: 20,
  registered_count: 7,
  registration_status: 'open',
  ...zusatz,
} as Event);

/** Genau die 409-Antwort aus events/verwaltung.js. */
const konflikt409 = (booking_count = 7, message_count = 0, points_total = 0) => ({
  response: {
    status: 409,
    data: {
      error: 'Event hat Anmeldungen',
      error_code: 'event_delete_confirm',
      booking_count,
      message_count,
      points_total,
    },
  },
});

const oeffneSeite = async () => {
  render(<AdminEventsPage />);
  await act(async () => { await Promise.resolve(); });
};

beforeEach(() => {
  offeneAlerts = [];
  aktiverAlert = null;
  presentVersuche = [];
  aktivesActionSheet = null;
  apiDelete.mockReset();
  setError.mockClear();
  refreshEvents.mockClear();
  testEvents = [];
});

// --- Einzeltermin ---------------------------------------------------------

describe('Einzeltermin mit Anmeldungen loeschen', () => {
  it('die zweite Rueckfrage geht auf und nennt die Verluste', async () => {
    testEvents = [termin(42)];
    apiDelete.mockRejectedValueOnce(konflikt409(7, 3, 12));

    await oeffneSeite();
    await act(async () => { fireEvent.click(screen.getByText('loeschen-42')); });

    // Erster Alert: die gewoehnliche Sicherheitsfrage.
    expect(offeneAlerts).toHaveLength(1);
    expect(offeneAlerts[0].header).toBe('Event löschen');

    await tippeAlertKnopf('Löschen');

    // DER PUNKT: Der zweite Alert ist wirklich AUFGEGANGEN, nicht nur
    // angefordert worden.
    await waitFor(() => expect(offeneAlerts).toHaveLength(2));
    expect(offeneAlerts[1].header).toBe('Wirklich löschen?');
    expect(offeneAlerts[1].message).toContain('7 Anmeldungen');
    expect(offeneAlerts[1].message).toContain('3 Chat-Nachrichten');
    expect(offeneAlerts[1].message).toContain('12 bereits vergebene Punkte');
    // Kein present-Versuch darf unterwegs verpufft sein.
    expect(presentVersuche).toHaveLength(2);
    // Und die 409 ist keine Fehlermeldung -- sie ist eine Rueckfrage.
    expect(setError).not.toHaveBeenCalled();
  });

  it('nach dem Bestaetigen wird mit force=true geloescht', async () => {
    testEvents = [termin(42)];
    apiDelete
      .mockRejectedValueOnce(konflikt409())
      .mockResolvedValueOnce({ data: { message: 'geloescht' } });

    await oeffneSeite();
    await act(async () => { fireEvent.click(screen.getByText('loeschen-42')); });
    await tippeAlertKnopf('Löschen');
    await waitFor(() => expect(offeneAlerts).toHaveLength(2));
    await tippeAlertKnopf('Endgültig löschen');

    await waitFor(() => expect(apiDelete).toHaveBeenCalledTimes(2));
    expect(apiDelete).toHaveBeenNthCalledWith(1, '/events/42');
    expect(apiDelete).toHaveBeenNthCalledWith(2, '/events/42?force=true');
    expect(setError).not.toHaveBeenCalled();
  });

  it('Abbrechen in der zweiten Rueckfrage loescht nichts', async () => {
    // Gegenprobe: Die Rueckfrage muss auch etwas verhindern koennen.
    testEvents = [termin(42)];
    apiDelete.mockRejectedValueOnce(konflikt409());

    await oeffneSeite();
    await act(async () => { fireEvent.click(screen.getByText('loeschen-42')); });
    await tippeAlertKnopf('Löschen');
    await waitFor(() => expect(offeneAlerts).toHaveLength(2));
    await tippeAlertKnopf('Abbrechen');

    expect(apiDelete).toHaveBeenCalledTimes(1);
    expect(apiDelete).toHaveBeenCalledWith('/events/42');
  });

  it('ein leerer Termin wird ohne zweite Rueckfrage geloescht', async () => {
    // Gegenprobe: Der Fix darf keinen zusaetzlichen Dialog erfinden.
    testEvents = [termin(43)];
    apiDelete.mockResolvedValueOnce({ data: { message: 'geloescht' } });

    await oeffneSeite();
    await act(async () => { fireEvent.click(screen.getByText('loeschen-43')); });
    await tippeAlertKnopf('Löschen');

    await waitFor(() => expect(apiDelete).toHaveBeenCalledTimes(1));
    expect(apiDelete).toHaveBeenCalledWith('/events/43');
    expect(offeneAlerts).toHaveLength(1);
    expect(setError).not.toHaveBeenCalled();
  });

  it('ein echter Fehler bleibt eine Fehlermeldung, keine Rueckfrage', async () => {
    // Gegenprobe: Nur die 409 ist eine Rueckfrage. Ein 500 muss weiterhin
    // als Meldung ankommen.
    testEvents = [termin(44)];
    apiDelete.mockRejectedValueOnce({
      response: { status: 500, data: { error: 'Datenbank nicht erreichbar' } },
    });

    await oeffneSeite();
    await act(async () => { fireEvent.click(screen.getByText('loeschen-44')); });
    await tippeAlertKnopf('Löschen');

    await waitFor(() => expect(setError).toHaveBeenCalledTimes(1));
    expect(setError).toHaveBeenCalledWith('Datenbank nicht erreichbar');
    expect(offeneAlerts).toHaveLength(1);
  });
});

// --- Serie ----------------------------------------------------------------

describe('Serien-Termine mit Anmeldungen loeschen', () => {
  const serie = () => [
    termin(1, { is_series: true, series_id: 'abc', event_date: '2026-10-01T18:00:00.000Z' }),
    termin(2, { is_series: true, series_id: 'abc', event_date: '2026-10-08T18:00:00.000Z' }),
  ];

  it('die zweite Rueckfrage geht auf und summiert ueber alle Termine', async () => {
    testEvents = serie();
    apiDelete
      .mockRejectedValueOnce(konflikt409(4, 1, 5))
      .mockRejectedValueOnce(konflikt409(3, 2, 7));

    await oeffneSeite();
    await act(async () => { fireEvent.click(screen.getByText('loeschen-1')); });

    // Serie: erst das Action Sheet.
    expect(aktivesActionSheet).not.toBeNull();
    const ganzeSerie = aktivesActionSheet!.buttons.find(b => b.text.startsWith('Ganze Serie löschen'));
    expect(ganzeSerie).not.toBeUndefined();
    await act(async () => { ganzeSerie!.handler?.(); });

    expect(offeneAlerts).toHaveLength(1);
    expect(offeneAlerts[0].header).toBe('Serie löschen');

    await tippeAlertKnopf('Löschen');

    await waitFor(() => expect(offeneAlerts).toHaveLength(2));
    expect(offeneAlerts[1].header).toBe('Wirklich löschen?');
    expect(offeneAlerts[1].message).toContain('2 Termine der Serie');
    expect(offeneAlerts[1].message).toContain('7 Anmeldungen');
    expect(offeneAlerts[1].message).toContain('3 Chat-Nachrichten');
    expect(offeneAlerts[1].message).toContain('12 bereits vergebene Punkte');
    expect(presentVersuche).toHaveLength(2);
    expect(setError).not.toHaveBeenCalled();
  });

  it('nach dem Bestaetigen gehen alle betroffenen Termine mit force=true', async () => {
    testEvents = serie();
    apiDelete
      .mockRejectedValueOnce(konflikt409(4))
      .mockRejectedValueOnce(konflikt409(3))
      .mockResolvedValue({ data: { message: 'geloescht' } });

    await oeffneSeite();
    await act(async () => { fireEvent.click(screen.getByText('loeschen-1')); });
    const ganzeSerie = aktivesActionSheet!.buttons.find(b => b.text.startsWith('Ganze Serie löschen'));
    await act(async () => { ganzeSerie!.handler?.(); });
    await tippeAlertKnopf('Löschen');
    await waitFor(() => expect(offeneAlerts).toHaveLength(2));
    await tippeAlertKnopf('Endgültig löschen');

    await waitFor(() => expect(apiDelete).toHaveBeenCalledTimes(4));
    const aufrufe = apiDelete.mock.calls.map(c => c[0]);
    expect(aufrufe.slice(2).sort()).toEqual(['/events/1?force=true', '/events/2?force=true']);
    expect(setError).not.toHaveBeenCalled();
  });

  it('eine leere Serie wird ohne zweite Rueckfrage geloescht', async () => {
    // Gegenprobe wie beim Einzeltermin.
    testEvents = serie();
    apiDelete.mockResolvedValue({ data: { message: 'geloescht' } });

    await oeffneSeite();
    await act(async () => { fireEvent.click(screen.getByText('loeschen-1')); });
    const ganzeSerie = aktivesActionSheet!.buttons.find(b => b.text.startsWith('Ganze Serie löschen'));
    await act(async () => { ganzeSerie!.handler?.(); });
    await tippeAlertKnopf('Löschen');

    await waitFor(() => expect(apiDelete).toHaveBeenCalledTimes(2));
    expect(offeneAlerts).toHaveLength(1);
    expect(setError).not.toHaveBeenCalled();
  });
});
