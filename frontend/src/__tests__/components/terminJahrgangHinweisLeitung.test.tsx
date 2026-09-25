// Leitungsansicht eines Termins aus einem fremden Jahrgang (25.09.2026)
//
// Simon: "Konkret fuege ich einen Admin zu einem Jahrgangstermin hinzu, und
// der Admin selbst hat keinen Jahrgang. Kriegt er einen Push, er klickt auf
// den Push und kommt dann aber nicht auf das Event. Dann muesste ihm aber
// eine Fehlermeldung angezeigt werden."
//
// Der Push fuehrt auf /admin/events/:id (EventDetailView). Der Server
// verweigert den Termin seit dem 24.09.2026 mit 403 -- und nennt seit dem
// 25.09.2026 den Grund als error_code jahrgang_nicht_zugewiesen (lesen.js).
// Bis hierher zeigte die Ansicht darauf den roten Kasten "Fehler beim Laden
// der Event-Daten" ueber einer leeren Seite mit dem Titel "Event Details".
//
// Geprueft wird das VERHALTEN der gerenderten Ansicht, nicht der Quelltext:
//   - 403 mit diesem error_code: Grund und Ausweg stehen auf der Seite, KEIN
//     roter Kasten (setError bleibt stumm).
//   - 403 mit anderem Grund und 500: weiterhin der rote Kasten, kein Hinweis
//     (GEGENPROBE -- nur der error_code darf die Erklaerung ausloesen).
//   - 200: der Termin, kein Hinweis.
//   - Wechsel der Kennung in derselben Instanz raeumt den Hinweis weg (der
//     IonRouterOutlet haelt die Seite montiert, siehe
//     eventDetailZustandswechsel.test.tsx).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';

// --- Mocks ----------------------------------------------------------------

const apiGet = vi.fn();
const setError = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 5, organization_id: 1, role_name: 'admin' },
    setSuccess: vi.fn(),
    setError: (...args: unknown[]) => setError(...args),
    isOnline: true,
  }),
}));

vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveUpdate: () => ({ triggerRefresh: vi.fn() }),
  useLiveRefresh: () => {},
}));

vi.mock('../../services/offlineCache', () => ({
  offlineCache: { get: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../services/analytics', () => ({
  trackHandlung: vi.fn(),
}));

vi.mock('../../components/common/LoadingSpinner', () => ({
  default: () => React.createElement('div', null, 'laedt'),
}));

// Die Abschnitte der Ansicht spielen fuer den Hinweis keine Rolle; sie
// erscheinen nur mit geladenem Termin.
vi.mock('../../components/admin/views/EventDetailSections', () => ({
  EventInfoCard: () => null,
  DescriptionSection: () => null,
  SeriesEventsSection: () => null,
  UnregistrationsSection: () => null,
  EventMaterialSection: () => null,
  EventActionsSection: () => null,
  TimeslotsSection: () => null,
}));

vi.mock('../../components/admin/modals/EventModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/ParticipantManagementModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AnwesenheitNotizModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AbmeldungNachtragenModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/TerminAbsagenModal', () => ({ default: () => null }));
vi.mock('../../components/shared/QRDisplayModal', () => ({ default: () => null }));
vi.mock('../../components/teamer/pages/TeamerMaterialDetailPage', () => ({ default: () => null }));
vi.mock('../../components/teamer/modals/TeamerAbsageModal', () => ({ default: () => null }));

vi.mock('@ionic/react', async () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    IonPage: passthrough,
    IonHeader: passthrough,
    IonToolbar: passthrough,
    IonTitle: passthrough,
    IonContent: passthrough,
    IonButtons: passthrough,
    IonButton: ({ children, onClick, ...rest }: {
      children?: React.ReactNode; onClick?: () => void; 'aria-label'?: string;
    }) => React.createElement('button', { onClick, 'aria-label': rest['aria-label'] }, children),
    IonIcon: () => null,
    IonCard: passthrough,
    IonCardContent: passthrough,
    IonItem: passthrough,
    IonLabel: passthrough,
    IonList: passthrough,
    IonListHeader: passthrough,
    IonRefresher: () => null,
    IonRefresherContent: () => null,
    IonItemSliding: passthrough,
    IonItemOptions: passthrough,
    IonItemOption: passthrough,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonActionSheet: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

import EventDetailView from '../../components/admin/views/EventDetailView';

// --- Testdaten ------------------------------------------------------------

const HINWEIS_TITEL = 'Nicht deinem Jahrgang zugeordnet';
const HINWEIS_TEXT = 'Dieser Termin gehört zu einem Jahrgang, dem du nicht zugewiesen bist. Die Leitung deiner Gemeinde kann das in den Einstellungen ändern.';

const VERWEIGERT = {
  response: { status: 403, data: { error: 'Kein Zugriff auf diesen Termin', error_code: 'jahrgang_nicht_zugewiesen' } },
};

const terminAntwort = (id: number, name: string) => ({
  data: {
    id,
    name,
    event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    points: 0,
    type: 'event',
    max_participants: 20,
    registered_count: 0,
    registration_status: 'open',
    available_spots: 20,
    participants: [],
    unregistrations: [],
    created_at: '2026-08-01T00:00:00Z',
  },
});

/** Antworten je Kennung: eine Termin-Antwort oder ein axios-artiger Fehler. */
let antworten: Record<number, { data: unknown } | { response: { status: number; data: unknown } }> = {};

beforeEach(() => {
  apiGet.mockReset();
  setError.mockReset();
  antworten = {};
  apiGet.mockImplementation((pfad: string) => {
    const detail = pfad.match(/^\/events\/(\d+)$/);
    if (detail) {
      const antwort = antworten[Number(detail[1])];
      if (!antwort) return Promise.reject({ response: { status: 404, data: { error: 'Event nicht gefunden' } } });
      return 'response' in antwort ? Promise.reject(antwort) : Promise.resolve(antwort);
    }
    // Material am Termin: keines.
    return Promise.resolve({ data: [] });
  });
});

const rendern = (eventId: number) => render(<EventDetailView eventId={eventId} onBack={vi.fn()} />);

/**
 * Gemeldete Fehler -- ohne die Leerung. Die Ansicht ruft beim Wechsel der
 * Kennung setError('') auf, um den vorigen Fehler wegzuraeumen; das ist
 * keine Meldung.
 */
const gemeldeteFehler = () =>
  setError.mock.calls.map((c) => c[0] as string).filter((text) => text !== '');

// --- Tests ----------------------------------------------------------------

describe('Termin aus einem Jahrgang, dem die Leitungsperson nicht zugewiesen ist', () => {
  it('zeigt Grund und Ausweg -- und keinen roten Kasten', async () => {
    antworten = { 42: VERWEIGERT };
    rendern(42);

    await waitFor(() => expect(screen.getByText(HINWEIS_TITEL)).toBeTruthy());
    expect(screen.getByText(HINWEIS_TEXT)).toBeTruthy();
    // Kein Ladezustand mehr, kein Platzhaltertitel der leeren Seite.
    expect(screen.queryByText('laedt')).toBeNull();
    expect(screen.queryByText('Event Details')).toBeNull();
    // Der bisherige Fehlerweg bleibt stumm: Das ist eine Antwort mit Grund,
    // kein Fehler der App.
    expect(gemeldeteFehler()).toEqual([]);
  });

  it('der Zurueck-Knopf bleibt auf der Hinweis-Seite erreichbar', async () => {
    antworten = { 42: VERWEIGERT };
    const onBack = vi.fn();
    render(<EventDetailView eventId={42} onBack={onBack} />);
    await waitFor(() => expect(screen.getByText(HINWEIS_TITEL)).toBeTruthy());

    await act(async () => { screen.getByLabelText('Zurück').click(); });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('GEGENPROBE: ein 403 mit anderem Grund zeigt den Hinweis nicht, sondern wie bisher den Fehler', async () => {
    antworten = { 42: { response: { status: 403, data: { error: 'Kein Zugriff auf diese Organisation' } } } };
    rendern(42);

    await waitFor(() => expect(gemeldeteFehler()).toEqual(['Fehler beim Laden der Event-Daten']));
    expect(screen.queryByText(HINWEIS_TITEL)).toBeNull();
  });

  it('GEGENPROBE: ein Serverfehler zeigt den Hinweis nicht', async () => {
    antworten = { 42: { response: { status: 500, data: { error: 'Datenbankfehler' } } } };
    rendern(42);

    await waitFor(() => expect(gemeldeteFehler()).toEqual(['Fehler beim Laden der Event-Daten']));
    expect(screen.queryByText(HINWEIS_TITEL)).toBeNull();
  });

  it('ERLAUBT: ein zugaenglicher Termin erscheint wie immer, ohne Hinweis', async () => {
    antworten = { 7: terminAntwort(7, 'Konfi-Freizeit') };
    rendern(7);

    await waitFor(() => expect(screen.getAllByText('Konfi-Freizeit').length).toBeGreaterThan(0));
    expect(screen.queryByText(HINWEIS_TITEL)).toBeNull();
    expect(gemeldeteFehler()).toEqual([]);
  });

  it('Wechsel der Kennung in derselben Instanz: vom verweigerten zum zugaenglichen Termin', async () => {
    // Der IonRouterOutlet reicht eine neue eventId in DIESELBE Instanz.
    // Bleibt der Hinweis stehen, saehe man ihn ueber dem naechsten Termin.
    antworten = { 42: VERWEIGERT, 7: terminAntwort(7, 'Konfi-Freizeit') };
    const { rerender } = rendern(42);
    await waitFor(() => expect(screen.getByText(HINWEIS_TITEL)).toBeTruthy());

    rerender(<EventDetailView eventId={7} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getAllByText('Konfi-Freizeit').length).toBeGreaterThan(0));
    expect(screen.queryByText(HINWEIS_TITEL)).toBeNull();
  });

  it('... und zurueck: vom zugaenglichen zum verweigerten', async () => {
    antworten = { 42: VERWEIGERT, 7: terminAntwort(7, 'Konfi-Freizeit') };
    const { rerender } = rendern(7);
    await waitFor(() => expect(screen.getAllByText('Konfi-Freizeit').length).toBeGreaterThan(0));

    rerender(<EventDetailView eventId={42} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(HINWEIS_TITEL)).toBeTruthy());
    expect(screen.queryByText('Konfi-Freizeit')).toBeNull();
  });
});
