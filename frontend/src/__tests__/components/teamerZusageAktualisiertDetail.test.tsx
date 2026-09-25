// Zu- und Absage im Teamer-Termin aktualisieren die Ansicht sofort
// (17.09.2026)
//
// SIMONS BEFUND (Build 200), woertlich: "wenn ich mich als teamer abmelde
// scheint das zu gehen, aber es wird nicht live im termin sofort fuer den
// teamer aktualisiert zumindest als teamer in der app. muss erst refresh
// machen. beim admin im browser ist es sofort da."
//
// DIE URSACHE, am Code nachgelesen:
//
//   1. Die Teilnehmerliste haengt an einem Effekt mit `[selectedEvent?.id]`.
//      Nach einer Zu-/Absage tauscht die Seite nur das Event-OBJEKT aus --
//      die id bleibt dieselbe, der Effekt feuert nicht, `eventTeilnehmer`
//      bleibt auf dem alten Stand stehen.
//   2. Nachgeladen wurde ausserdem nur die LISTE (GET /events). Die traegt
//      gar keine `participants` -- die Namen stehen allein in der
//      Detailantwort GET /events/:id. Die Leitungsansicht macht es richtig
//      (loadEventData: Event UND Teilnehmerliste aus derselben Antwort).
//
// WARUM DIESER TEST SO GEBAUT IST: Geprueft wird Verhalten, nicht Quelltext.
// Ein `readFileSync`-Test auf "ruft /events/:id auf" waere gruen gewesen,
// solange der Fehler bestand -- den Aufruf gab es ja im Lade-Effekt. Der
// Punkt ist, WANN er passiert. Also: Seite rendern, Termin oeffnen, Knopf
// tippen, und danach die angezeigte Teilnehmerliste lesen.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import type { Event, Participant } from '../../types/event';

// --- Mocks ----------------------------------------------------------------

const apiGet = vi.fn();
const apiPost = vi.fn();
const setSuccess = vi.fn();
const setError = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 9, organization_id: 1, role_name: 'teamer' },
    setSuccess,
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
  useAppLocation: () => ({ search: '', pathname: '/teamer/events' }),
}));

vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true },
}));

vi.mock('../../services/writeQueue', () => ({
  writeQueue: { enqueue: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../../services/notifications', () => ({
  removeDeliveredForEvents: vi.fn(),
}));

vi.mock('../../hooks/useWartendeVorgaenge', () => ({
  useWartendeVorgaenge: () => ({ wartend: [], gescheitert: [], vergessen: [] }),
}));

// Die Termin-LISTE kommt fest herein. Dieser Test prueft nicht das Laden,
// sondern was nach einer Zu-/Absage angezeigt wird.
let listenEvents: Event[] = [];
const refreshEvents = vi.fn().mockResolvedValue(undefined);
const refreshLiveEvents = vi.fn().mockResolvedValue(undefined);

vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => ({
    data: schluessel.startsWith('teamer:events:') ? listenEvents : [],
    loading: false,
    error: null,
    isStale: false,
    isOffline: false,
    refresh: refreshEvents,
    refreshLive: refreshLiveEvents,
  }),
}));

vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/konfi/views/RequestsView', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/QRScannerModal', () => ({ default: () => null }));
vi.mock('../../components/shared/QRDisplayModal', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/RequestDetailModal', () => ({ default: () => null }));
vi.mock('../../components/teamer/modals/TeamerActivityRequestModal', () => ({ default: () => null }));
vi.mock('../../components/teamer/pages/TeamerMaterialDetailPage', () => ({ default: () => null }));
vi.mock('../../components/shared/WartendeVorgaengeKarte', () => ({ default: () => null }));

// Der Absage-Dialog: statt des echten Modals merken wir uns seine Requisiten
// und rufen onAbsage von Hand auf -- der Weg AB der Absage ist der Gegenstand.
interface AbsageProps { onAbsage?: (grund: string) => void; grundPflicht?: boolean }
let absageProps: AbsageProps | null = null;
vi.mock('../../components/teamer/modals/TeamerAbsageModal', () => ({ default: () => null }));

// Die gemeinsame Kopfzeile (AppKopfzeile, 25.09.2026) bringt Glocke und
// Gemeinde-Umschalter mit -- beide haengen an Warteschlange und Router, die
// hier nicht Thema sind. Die Kopfzeile hat eigene Tests (appKopfzeile.test).
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: () => null,
  AppKopfzeileGross: () => null,
}));

vi.mock('@ionic/react', async () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    IonPage: passthrough,
    IonHeader: passthrough,
    IonToolbar: passthrough,
    IonTitle: passthrough,
    IonContent: passthrough,
    IonRefresher: ({ onIonRefresh }: { onIonRefresh?: (e: unknown) => void }) =>
      React.createElement('button', {
        'data-testid': 'refresher',
        onClick: () => onIonRefresh?.({ detail: { complete: vi.fn() } }),
      }, 'aktualisieren'),
    IonRefresherContent: () => null,
    IonButtons: passthrough,
    IonButton: ({ children, onClick, disabled, ...rest }: {
      children?: React.ReactNode; onClick?: () => void; disabled?: boolean;
      'aria-label'?: string;
    }) => React.createElement(
      'button',
      { onClick, disabled, 'aria-label': rest['aria-label'] },
      children
    ),
    IonIcon: () => null,
    IonSegment: passthrough,
    IonSegmentButton: passthrough,
    IonLabel: passthrough,
    IonList: passthrough,
    IonListHeader: passthrough,
    IonCard: passthrough,
    IonCardContent: passthrough,
    // IonItem traegt in der Liste den onClick, der den Termin oeffnet --
    // ein blosser Passthrough verschluckte ihn.
    IonItem: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) =>
      React.createElement('div', { onClick, 'data-testid': 'termin-zeile' }, children),
    IonItemGroup: passthrough,
    IonInput: () => null,
    // useIonModal: Das erste Argument ist die Komponente, das zweite sind die
    // Requisiten. Am TeamerAbsageModal haengt onAbsage -- die merken wir uns.
    useIonModal: (_komponente: unknown, props: AbsageProps) => {
      const present = () => { absageProps = props; };
      return [present, vi.fn()];
    },
    useIonAlert: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
    useIonViewWillEnter: (fn: () => void) => { void fn; },
  };
});

import TeamerEventsPage from '../../components/teamer/pages/TeamerEventsPage';

// --- Testdaten ------------------------------------------------------------

const TERMIN_ID = 77;

/** In der Zukunft -- sonst zeigt die Ansicht gar keine Zusage-Knoepfe. */
const inDerZukunft = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

const termin = (zusatz: Partial<Event> = {}): Event => ({
  id: TERMIN_ID,
  name: 'Konfi-Freizeit',
  description: '',
  event_date: inDerZukunft,
  location: '',
  points: 0,
  type: 'event',
  max_participants: 20,
  registered_count: 3,
  registration_status: 'open',
  teamer_needed: true,
  teamer_count: 2,
  teamer_max_participants: 0,
  is_registered: false,
  ...zusatz,
} as Event);

const teilnehmer = (name: string, status: Participant['status']): Participant => ({
  id: name.length * 100 + (status === 'confirmed' ? 1 : 2),
  participant_name: name,
  role_name: 'teamer',
  created_at: '2026-09-01T00:00:00Z',
  status,
});

/**
 * Antworten von GET /events/:id in der Reihenfolge, in der sie abgerufen
 * werden: erst der Stand beim Oeffnen, dann der Stand nach der Zu-/Absage.
 */
let detailAntworten: Array<{ participants: Participant[] } & Partial<Event>> = [];
let detailAufrufe = 0;

const setzeApi = () => {
  apiGet.mockImplementation((pfad: string) => {
    if (pfad === '/events') {
      return Promise.resolve({ data: listenEvents });
    }
    if (pfad === `/events/${TERMIN_ID}`) {
      const antwort = detailAntworten[Math.min(detailAufrufe, detailAntworten.length - 1)];
      detailAufrufe += 1;
      return Promise.resolve({ data: antwort });
    }
    if (pfad.startsWith('/material/by-event/')) {
      return Promise.resolve({ data: [] });
    }
    return Promise.resolve({ data: [] });
  });
};

const oeffneTermin = async () => {
  render(<TeamerEventsPage />);
  await act(async () => { await Promise.resolve(); });
  // Termin antippen: Die Liste rendert pro Termin eine Zeile. Die erste
  // Zeile der Seite ist das Suchfeld (auch ein IonItem) -- gemeint ist die
  // Zeile, die den Terminnamen traegt.
  const zeilen = screen.getAllByTestId('termin-zeile')
    .filter(el => (el.textContent || '').includes('Konfi-Freizeit'));
  expect(zeilen.length).toBe(1);
  await act(async () => { fireEvent.click(zeilen[0]); });
  // Die Detailansicht ist offen, sobald die Teilnehmerliste steht.
  await waitFor(() => expect(screen.getByText('Mia Sommer')).toBeTruthy());
};

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  apiPost.mockResolvedValue({ data: { status: 'confirmed' } });
  setSuccess.mockClear();
  setError.mockClear();
  refreshEvents.mockClear();
  refreshLiveEvents.mockClear();
  absageProps = null;
  detailAufrufe = 0;
  listenEvents = [];
  detailAntworten = [];
});

// --- Die Teilnehmerliste veraltet nicht mehr ------------------------------

describe('Absage im Termin: die Ansicht aktualisiert sich sofort', () => {
  it('nach der Absage steht der eigene Name mit neuem Stand in der Liste', async () => {
    // Vorher: zugesagt und in der Liste als "Gebucht". Nachher: abgesagt.
    listenEvents = [termin({ is_registered: true, booking_status: 'confirmed' })];
    detailAntworten = [
      { participants: [teilnehmer('Simon Luthe', 'confirmed'), teilnehmer('Mia Sommer', 'confirmed')] },
      { participants: [teilnehmer('Simon Luthe', 'opted_out'), teilnehmer('Mia Sommer', 'confirmed')] },
    ];
    setzeApi();

    await oeffneTermin();

    // Ausgangslage: beide gebucht, niemand abgemeldet.
    expect(screen.queryByText('Abgemeldet')).toBeNull();

    // Auf "Nicht mehr dabei" tippen -> der Absage-Dialog geht auf.
    await act(async () => {
      fireEvent.click(screen.getByText('Nicht mehr dabei'));
    });
    expect(absageProps).not.toBeNull();

    // Grund angeben und absagen.
    await act(async () => { absageProps!.onAbsage?.('Bin krank'); });

    // DER PUNKT: Die Teilnehmerliste zeigt den neuen Stand -- OHNE dass
    // jemand die Seite neu geladen hat.
    await waitFor(() => expect(screen.getByText('Abgemeldet')).toBeTruthy());
    expect(apiPost).toHaveBeenCalledWith(
      `/teamer/events/${TERMIN_ID}/zusage`,
      { dabei: false, reason: 'Bin krank' }
    );
    expect(setError).not.toHaveBeenCalled();
  });

  it('nach der Zusage steht der neue Stand in der Liste', async () => {
    // Gegenrichtung: vorher abgesagt, jetzt doch dabei.
    listenEvents = [termin({ is_registered: false, booking_status: 'opted_out' })];
    detailAntworten = [
      { participants: [teilnehmer('Simon Luthe', 'opted_out'), teilnehmer('Mia Sommer', 'confirmed')] },
      { participants: [teilnehmer('Simon Luthe', 'confirmed'), teilnehmer('Mia Sommer', 'confirmed')] },
    ];
    setzeApi();

    await oeffneTermin();
    expect(screen.getByText('Abgemeldet')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText('Doch dabei'));
    });

    await waitFor(() => expect(screen.queryByText('Abgemeldet')).toBeNull());
    expect(setError).not.toHaveBeenCalled();
  });
});

// --- Eine Route fuer beide Richtungen -------------------------------------

describe('Zusage und Absage nehmen dieselbe Route', () => {
  it('der gruene Knopf ruft die Zusage-Route, nicht /book', async () => {
    listenEvents = [termin({ is_registered: false, booking_status: 'opted_out' })];
    detailAntworten = [
      { participants: [teilnehmer('Simon Luthe', 'opted_out'), teilnehmer('Mia Sommer', 'confirmed')] },
      { participants: [teilnehmer('Simon Luthe', 'confirmed'), teilnehmer('Mia Sommer', 'confirmed')] },
    ];
    setzeApi();

    await oeffneTermin();
    await act(async () => { fireEvent.click(screen.getByText('Doch dabei')); });

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    expect(apiPost).toHaveBeenCalledWith(`/teamer/events/${TERMIN_ID}/zusage`, { dabei: true });
    // Und eben NICHT der alte Weg, der keinen absage_nach_zusage-Uebergang
    // protokolliert.
    const pfade = apiPost.mock.calls.map(c => c[0]);
    expect(pfade).not.toContain(`/events/${TERMIN_ID}/book`);
  });

  it('eine bestaetigte Zusage wird gemeldet, nicht nur die Warteliste', async () => {
    listenEvents = [termin({ is_registered: false, booking_status: 'opted_out' })];
    detailAntworten = [
      { participants: [teilnehmer('Simon Luthe', 'opted_out'), teilnehmer('Mia Sommer', 'confirmed')] },
      { participants: [teilnehmer('Simon Luthe', 'confirmed'), teilnehmer('Mia Sommer', 'confirmed')] },
    ];
    setzeApi();

    await oeffneTermin();
    await act(async () => { fireEvent.click(screen.getByText('Doch dabei')); });

    await waitFor(() => expect(setSuccess).toHaveBeenCalledTimes(1));
    expect(setSuccess).toHaveBeenCalledWith('Du bist dabei');
  });
});

// --- Pull-to-Refresh im Detail --------------------------------------------

describe('Herunterziehen im Termin', () => {
  it('holt den Termin frisch, statt den alten Stand zurueckzuschreiben', async () => {
    listenEvents = [termin({ is_registered: true, booking_status: 'confirmed' })];
    detailAntworten = [
      { participants: [teilnehmer('Simon Luthe', 'confirmed'), teilnehmer('Mia Sommer', 'confirmed')] },
      { participants: [teilnehmer('Simon Luthe', 'confirmed'), teilnehmer('Mia Sommer', 'opted_out')] },
    ];
    setzeApi();

    await oeffneTermin();
    expect(screen.queryByText('Abgemeldet')).toBeNull();

    await act(async () => { fireEvent.click(screen.getAllByTestId('refresher')[0]); });

    // Mia hat sich inzwischen abgemeldet -- das Herunterziehen muss es zeigen.
    await waitFor(() => expect(screen.getByText('Abgemeldet')).toBeTruthy());
  });
});
