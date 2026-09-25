// Deep-Link auf einen Teamer-Termin: ?eventId= oeffnet den Termin (24.09.2026)
//
// ANLASS: Sechs Termin-Pushes endeten fuer Teamer:innen auf der Liste, weil es
// kein /teamer/events/:id gab. Die Route leitet jetzt auf ?eventId= um
// (rollenBaeume.ts) -- den Weg, den das Dashboard seit jeher nimmt. Hier wird
// geprueft, was die Seite mit dem Parameter MACHT.
//
// DREI DINGE, die ein Quelltext-Test nicht saehe:
//
//   1. Der Termin oeffnet sich. Und zwar aus der LISTE (GET /events), die
//      bereits nach den zugewiesenen Jahrgaengen gefiltert ist. Ein Termin,
//      der nicht in der Liste steht, geht NICHT auf. Die Seite fragt den
//      Server dann EINMAL nach dem Grund (GET /events/:id, 25.09.2026) --
//      antwortet er 403 mit error_code jahrgang_nicht_zugewiesen, steht die
//      Erklaerung auf der Seite (Block 4); alles andere bleibt die Liste.
//      Der Server prueft die Jahrgangsgrenze seit demselben Tag.
//   2. Ein ZWEITER Link auf einen anderen Termin oeffnet den zweiten. Der
//      alte Schalter (initialEventHandled) stand nach dem ersten Link fuer
//      immer auf "erledigt" -- die Seite bleibt im Tab montiert, der zweite
//      Push lief ins Leere.
//   3. Zurueck aus dem per Link geoeffneten Termin bleibt zurueck. Die Adresse
//      behaelt ?eventId=; ein Effekt, der nur auf den Parameter schaut,
//      spraenge sofort wieder hinein.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import type { Event, Participant } from '../../types/event';

// --- Mocks ----------------------------------------------------------------

const apiGet = vi.fn();
const apiPost = vi.fn();

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
    setSuccess: vi.fn(),
    setError: vi.fn(),
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

// Die Adresse ist veraenderlich: Der Test schaltet sie um und rendert neu --
// so wie der Router es tut, wenn ein zweiter Push kommt.
let aktuelleSuche = '';
vi.mock('../../navigation/useAppLocation', () => ({
  useAppLocation: () => ({ search: aktuelleSuche, pathname: '/teamer/events' }),
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

let listenEvents: Event[] = [];

vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => ({
    data: schluessel.startsWith('teamer:events:') ? listenEvents : [],
    loading: false,
    error: null,
    isStale: false,
    isOffline: false,
    refresh: vi.fn().mockResolvedValue(undefined),
    refreshLive: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/konfi/views/RequestsView', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/QRScannerModal', () => ({ default: () => null }));
vi.mock('../../components/shared/QRDisplayModal', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/RequestDetailModal', () => ({ default: () => null }));
vi.mock('../../components/teamer/modals/TeamerActivityRequestModal', () => ({ default: () => null }));
vi.mock('../../components/teamer/modals/TeamerAbsageModal', () => ({ default: () => null }));
vi.mock('../../components/teamer/pages/TeamerMaterialDetailPage', () => ({ default: () => null }));
vi.mock('../../components/shared/WartendeVorgaengeKarte', () => ({ default: () => null }));

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
    IonItem: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) =>
      React.createElement('div', { onClick, 'data-testid': 'termin-zeile' }, children),
    IonItemGroup: passthrough,
    IonInput: () => null,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
    useIonViewWillEnter: (fn: () => void) => { void fn; },
  };
});

import TeamerEventsPage from '../../components/teamer/pages/TeamerEventsPage';

// --- Testdaten ------------------------------------------------------------

const inDerZukunft = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

const termin = (id: number, name: string): Event => ({
  id,
  name,
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
  // Gebucht: Die Seite oeffnet auf dem Reiter "Meine", und der zeigt nur
  // Termine mit eigener Buchung (zaehltAlsMeiner). Fuer den Deep-Link selbst
  // ist das egal -- er sucht in der ganzen Liste --, aber die Tests unten
  // lesen die sichtbaren Zeilen.
  is_registered: true,
  booking_status: 'confirmed',
} as Event);

const teilnehmer = (id: number, name: string): Participant => ({
  id,
  participant_name: name,
  role_name: 'teamer',
  created_at: '2026-09-01T00:00:00Z',
  status: 'confirmed',
});

/** Teilnehmende je Termin -- am Namen erkennt der Test, WELCHER Termin offen ist. */
const DETAIL: Record<number, Participant[]> = {
  77: [teilnehmer(1, 'Mia Sommer')],
  78: [teilnehmer(2, 'Jonas Winter')],
};

/**
 * Antwort des Servers auf GET /events/:id fuer Termine, die NICHT in der
 * Liste stehen -- so wie axios einen Fehler liefert (response.status/data).
 * Fehlt ein Eintrag, antwortet der Server mit 404 (geloeschter Termin).
 */
let fehlerFuer: Record<number, { status: number; data: Record<string, unknown> }> = {};

const setzeApi = () => {
  apiGet.mockImplementation((pfad: string) => {
    if (pfad === '/events') return Promise.resolve({ data: listenEvents });
    const detail = pfad.match(/^\/events\/(\d+)$/);
    if (detail) {
      const id = Number(detail[1]);
      if (id in DETAIL) {
        return Promise.resolve({ data: { participants: DETAIL[id] } });
      }
      const fehler = fehlerFuer[id] ?? { status: 404, data: { error: 'Event nicht gefunden' } };
      return Promise.reject({ response: fehler });
    }
    return Promise.resolve({ data: [] });
  });
};

const HINWEIS_TITEL = 'Nicht deinem Jahrgang zugeordnet';

const abgerufeneDetails = () =>
  apiGet.mock.calls.map((c) => c[0] as string).filter((p) => /^\/events\/\d+$/.test(p));

const tick = async () => { await act(async () => { await Promise.resolve(); }); };

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  aktuelleSuche = '';
  listenEvents = [termin(77, 'Konfi-Freizeit'), termin(78, 'Elternabend')];
  fehlerFuer = {};
  setzeApi();
});

// --- 1. Der Termin aus dem Link geht auf -- aber nur aus der Liste ---------

describe('?eventId= oeffnet den Termin aus der Liste', () => {
  it('zeigt den Termin mit seiner Teilnehmerliste, ohne dass jemand tippt', async () => {
    aktuelleSuche = '?eventId=77';
    render(<TeamerEventsPage />);

    await waitFor(() => expect(screen.getByText('Mia Sommer')).toBeTruthy());
    expect(abgerufeneDetails()).toEqual(['/events/77']);
  });

  it('ein geloeschter Termin (404) geht nicht auf -- die Liste bleibt, ohne Hinweis', async () => {
    // Der Link traegt eine Kennung, die es nicht mehr gibt. Die Seite fragt
    // einmal nach (um einen fehlenden Jahrgang zu erkennen, Block 4), zeigt
    // aber weder einen Termin noch die Jahrgangs-Erklaerung -- ein 404 ist
    // kein Jahrgangsproblem.
    aktuelleSuche = '?eventId=99';
    render(<TeamerEventsPage />);
    await tick();
    await tick();

    // Die Liste steht, mit beiden sichtbaren Terminen ...
    const zeilen = screen.getAllByTestId('termin-zeile').map((z) => z.textContent || '');
    expect(zeilen.some((t) => t.includes('Konfi-Freizeit'))).toBe(true);
    expect(zeilen.some((t) => t.includes('Elternabend'))).toBe(true);
    // ... genau eine Nachfrage, kein geoeffneter Termin, kein Hinweis.
    expect(abgerufeneDetails()).toEqual(['/events/99']);
    expect(screen.queryByText('Mia Sommer')).toBeNull();
    expect(screen.queryByText('Jonas Winter')).toBeNull();
    expect(screen.queryByText(HINWEIS_TITEL)).toBeNull();
  });

  it('ohne Parameter bleibt es bei der Liste', async () => {
    render(<TeamerEventsPage />);
    await tick();
    expect(abgerufeneDetails()).toEqual([]);
    expect(screen.getAllByTestId('termin-zeile').length).toBeGreaterThan(0);
  });
});

// --- 2. Ein zweiter Link auf einen anderen Termin wirkt ------------------

describe('Ein zweiter Deep-Link oeffnet den zweiten Termin', () => {
  it('nach ?eventId=77 oeffnet ?eventId=78 den Elternabend', async () => {
    aktuelleSuche = '?eventId=77';
    const { rerender } = render(<TeamerEventsPage />);
    await waitFor(() => expect(screen.getByText('Mia Sommer')).toBeTruthy());

    // Zweiter Push: Der Router aendert die Adresse, die Seite bleibt montiert.
    aktuelleSuche = '?eventId=78';
    rerender(<TeamerEventsPage />);

    await waitFor(() => expect(screen.getByText('Jonas Winter')).toBeTruthy());
    expect(screen.queryByText('Mia Sommer')).toBeNull();
    expect(abgerufeneDetails()).toEqual(['/events/77', '/events/78']);
  });
});

// --- 3. Zurueck bleibt zurueck --------------------------------------------

describe('Zurueck aus dem per Link geoeffneten Termin', () => {
  it('zeigt die Liste und springt nicht wieder in den Termin', async () => {
    aktuelleSuche = '?eventId=77';
    render(<TeamerEventsPage />);
    await waitFor(() => expect(screen.getByText('Mia Sommer')).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Zurück zur Event-Liste'));
    });
    await tick();
    await tick();

    // Die Adresse traegt weiter ?eventId=77 -- trotzdem Liste.
    expect(screen.queryByText('Mia Sommer')).toBeNull();
    expect(screen.getAllByTestId('termin-zeile').some((z) => (z.textContent || '').includes('Konfi-Freizeit'))).toBe(true);
    // Und kein zweiter Detailabruf fuer denselben Termin.
    expect(abgerufeneDetails()).toEqual(['/events/77']);
  });

  it('nach Zurueck oeffnet derselbe Termin wieder, sobald die Adresse den Parameter verlor und neu bekommt', async () => {
    // Tab "Mitmachen" angetippt (Adresse ohne Parameter), spaeter erneut
    // vom Dashboard auf denselben Termin: Der Merker muss zurueckgesetzt sein.
    aktuelleSuche = '?eventId=77';
    const { rerender } = render(<TeamerEventsPage />);
    await waitFor(() => expect(screen.getByText('Mia Sommer')).toBeTruthy());
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Zurück zur Event-Liste'));
    });

    aktuelleSuche = '';
    rerender(<TeamerEventsPage />);
    await tick();
    expect(screen.queryByText('Mia Sommer')).toBeNull();

    aktuelleSuche = '?eventId=77';
    rerender(<TeamerEventsPage />);
    await waitFor(() => expect(screen.getByText('Mia Sommer')).toBeTruthy());
    expect(abgerufeneDetails()).toEqual(['/events/77', '/events/77']);
  });
});

// --- 4. Termin aus einem fremden Jahrgang: der Grund steht da --------------
//
// Simon (25.09.2026): "Konkret fuege ich einen Admin zu einem Jahrgangstermin
// hinzu, und der Admin selbst hat keinen Jahrgang. Kriegt er einen Push, er
// klickt auf den Push und kommt dann aber nicht auf das Event. Dann muesste
// ihm aber eine Fehlermeldung angezeigt werden." Dasselbe trifft Teamer:innen,
// die die Leitung an einen Termin setzt, dessen Jahrgang ihnen fehlt. Der
// Server antwortet 403 mit error_code jahrgang_nicht_zugewiesen (lesen.js);
// die Seite zeigt darauf Grund UND Ausweg -- im Wortlaut der Listen
// ("Kein Jahrgang zugewiesen", KonfisView).

describe('Termin aus einem Jahrgang, dem die Person nicht zugewiesen ist', () => {
  const verweigert = { status: 403, data: { error: 'Kein Zugriff auf diesen Termin', error_code: 'jahrgang_nicht_zugewiesen' } };

  it('zeigt Grund und Ausweg statt der stummen Liste', async () => {
    fehlerFuer = { 99: verweigert };
    aktuelleSuche = '?eventId=99';
    render(<TeamerEventsPage />);

    await waitFor(() => expect(screen.getByText(HINWEIS_TITEL)).toBeTruthy());
    expect(screen.getByText(
      'Dieser Termin gehört zu einem Jahrgang, dem du nicht zugewiesen bist. Die Leitung deiner Gemeinde kann das in den Einstellungen ändern.'
    )).toBeTruthy();
    // Genau eine Nachfrage, kein Termin offen, keine Liste dahinter.
    expect(abgerufeneDetails()).toEqual(['/events/99']);
    expect(screen.queryByText('Mia Sommer')).toBeNull();
    expect(screen.queryAllByTestId('termin-zeile')).toEqual([]);
  });

  it('auch mit komplett leerer Liste -- genau die Person ohne Jahrgang hat oft keine', async () => {
    listenEvents = [];
    fehlerFuer = { 99: verweigert };
    aktuelleSuche = '?eventId=99';
    render(<TeamerEventsPage />);

    await waitFor(() => expect(screen.getByText(HINWEIS_TITEL)).toBeTruthy());
    expect(abgerufeneDetails()).toEqual(['/events/99']);
  });

  it('Zurueck fuehrt zur Liste und fragt nicht erneut nach', async () => {
    fehlerFuer = { 99: verweigert };
    aktuelleSuche = '?eventId=99';
    render(<TeamerEventsPage />);
    await waitFor(() => expect(screen.getByText(HINWEIS_TITEL)).toBeTruthy());

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Zurück zur Event-Liste'));
    });
    await tick();

    expect(screen.queryByText(HINWEIS_TITEL)).toBeNull();
    expect(screen.getAllByTestId('termin-zeile').some((z) => (z.textContent || '').includes('Konfi-Freizeit'))).toBe(true);
    expect(abgerufeneDetails()).toEqual(['/events/99']);
  });

  it('GEGENPROBE: ein 403 OHNE diesen error_code zeigt den Hinweis nicht', async () => {
    // Etwa "Kein Zugriff auf diese Organisation" -- ein anderer Grund, der
    // eine andere Behandlung hat (api.ts). Die Jahrgangs-Erklaerung waere
    // hier falsch.
    fehlerFuer = { 99: { status: 403, data: { error: 'Kein Zugriff auf diese Organisation' } } };
    aktuelleSuche = '?eventId=99';
    render(<TeamerEventsPage />);
    await tick();
    await tick();

    expect(abgerufeneDetails()).toEqual(['/events/99']);
    expect(screen.queryByText(HINWEIS_TITEL)).toBeNull();
    expect(screen.getAllByTestId('termin-zeile').length).toBeGreaterThan(0);
  });

  it('ein Termin AUS der Liste loest keine Nachfrage aus -- er geht einfach auf', async () => {
    // Die Nachfrage gilt nur fuer Kennungen, die die Liste nicht kennt.
    fehlerFuer = { 99: verweigert };
    aktuelleSuche = '?eventId=77';
    render(<TeamerEventsPage />);

    await waitFor(() => expect(screen.getByText('Mia Sommer')).toBeTruthy());
    expect(screen.queryByText(HINWEIS_TITEL)).toBeNull();
    expect(abgerufeneDetails()).toEqual(['/events/77']);
  });
});
