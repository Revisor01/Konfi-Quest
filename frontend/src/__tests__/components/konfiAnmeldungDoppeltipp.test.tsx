// Doppeltipp auf "Anmelden" schickt nur eine Anmeldung
// (Audit 26.09.2026, Screens Konfi/Teamer BF-09)
//
// Die Anmeldung in der Termin-Detailansicht lief ohne Sperre: Ein
// ungeduldiger zweiter Tipp schickte einen zweiten POST, der Server
// antwortete 409 "Du bist bereits für dieses Event angemeldet", und die
// Konfi sah diese Meldung in Rot, obwohl die Anmeldung geklappt hatte.
//
// Gemessen wird an der echten Ansicht (useOfflineQuery und API gemockt):
// wie oft POST /register geht, ob der Knopf waehrend des Sendens gesperrt
// ist und ob eine Fehlermeldung erscheint -- fuer den einfachen Termin, fuer
// eine Konfirmation (dort laeuft vor dem POST noch eine Abfrage) und fuer
// die Zeitfenster-Auswahl.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const setError = vi.fn();
const setSuccess = vi.fn();
const apiPost = vi.fn();
const apiGet = vi.fn();
const presentActionSheet = vi.fn();
let aktuellesEvent: Record<string, unknown> = {};

vi.mock('@ionic/react', () => {
  const pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const IonButton = ({ children, onClick, disabled }: { children?: React.ReactNode; onClick?: () => void; disabled?: boolean }) =>
    <button type="button" onClick={onClick} disabled={disabled}>{children}</button>;
  return {
    IonPage: React.forwardRef<HTMLDivElement, { children?: React.ReactNode }>(({ children }, ref) => <div ref={ref}>{children}</div>),
    IonContent: pass, IonButton, IonIcon: () => null, IonCard: pass, IonCardContent: pass,
    IonLabel: pass, IonList: pass, IonListHeader: pass, IonRefresher: () => null,
    IonRefresherContent: () => null, IonNote: pass,
    useIonAlert: () => [vi.fn()],
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonActionSheet: () => [presentActionSheet],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setSuccess, setError, isOnline: true, user: { id: 7, type: 'konfi' } }),
}));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({ data: [aktuellesEvent], loading: false, refresh: vi.fn(async () => undefined), refreshLive: vi.fn() }),
}));
vi.mock('../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => apiGet(...a),
    post: (...a: unknown[]) => apiPost(...a),
    delete: vi.fn(),
  },
}));
vi.mock('../../components/shared/OfflinePlatzhalter', () => ({ default: () => null }));
vi.mock('../../services/analytics', () => ({ track: vi.fn() }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
vi.mock('../../components/shared', async () => {
  const fmt = await vi.importActual<typeof import('../../components/shared/eventFormatting')>('../../components/shared/eventFormatting');
  return {
    ...fmt,
    SectionHeader: ({ subtitle }: { subtitle?: string }) => <div data-testid="status">{subtitle}</div>,
    AbsageBlock: () => null,
    EmptyState: () => null,
    ListSection: () => null,
  };
});
vi.mock('../../components/konfi/modals/UnregisterModal', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/QRScannerModal', () => ({ default: () => null }));
vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveUpdate: () => ({ triggerRefresh: vi.fn() }),
  useLiveRefresh: vi.fn(),
}));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../utils/uuid', () => ({ safeUUID: () => 'uuid-1' }));

import EventDetailView from '../../components/konfi/views/EventDetailView';

const TAG = 24 * 3600 * 1000;
const inZehnTagen = new Date(Date.now() + 10 * TAG).toISOString();

const offen = {
  id: 5,
  name: 'Sommerfest',
  event_date: inZehnTagen,
  points: 2,
  point_type: 'gemeinde',
  type: 'event',
  registration_status: 'open',
  cancelled: false,
  has_timeslots: false,
  mandatory: false,
  is_konfirmation: false,
  categories: [],
  max_participants: 10, registered_count: 2, waitlist_enabled: false,
  booking_status: null, is_registered: false, can_register: true,
};

// Ein POST, der erst antwortet, wenn der Test es sagt. Der zweite Aufruf
// antwortet wie der Server: 409 "bereits angemeldet".
function haengenderPost() {
  let loese: (wert: unknown) => void = () => undefined;
  const erster = new Promise((r) => { loese = r; });
  apiPost.mockImplementationOnce(() => erster);
  apiPost.mockImplementation(() => Promise.reject({
    response: { status: 409, data: { error: 'Du bist bereits für dieses Event angemeldet' } },
  }));
  return () => loese({ data: { status: 'confirmed' } });
}

beforeEach(() => {
  setError.mockReset(); setSuccess.mockReset(); apiPost.mockReset(); apiGet.mockReset();
  presentActionSheet.mockReset();
  apiGet.mockImplementation(async (url: string) => {
    if (url === '/konfi/events') return { data: [aktuellesEvent] };
    return { data: [] };
  });
});

describe('Doppeltipp auf "Anmelden"', () => {
  it('schickt nur eine Anmeldung und zeigt keinen Fehler', async () => {
    aktuellesEvent = offen;
    const antworte = haengenderPost();
    render(<EventDetailView eventId={5} onBack={() => undefined} />);

    const knopf = screen.getByText('Anmelden (2/10)') as HTMLButtonElement;
    fireEvent.click(knopf);
    fireEvent.click(knopf);

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    await act(async () => { antworte(); });

    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(setError).not.toHaveBeenCalled();
  });

  it('sperrt den Knopf, solange die Anmeldung unterwegs ist', async () => {
    aktuellesEvent = offen;
    const antworte = haengenderPost();
    render(<EventDetailView eventId={5} onBack={() => undefined} />);

    const knopf = screen.getByText('Anmelden (2/10)') as HTMLButtonElement;
    expect(knopf.disabled).toBe(false);
    fireEvent.click(knopf);

    await waitFor(() => expect((screen.getByText('Anmelden (2/10)') as HTMLButtonElement).disabled).toBe(true));
    await act(async () => { antworte(); });
    await waitFor(() => expect((screen.getByText('Anmelden (2/10)') as HTMLButtonElement).disabled).toBe(false));
  });

  it('Konfirmation: auch waehrend der Vorabfrage geht nur ein POST', async () => {
    aktuellesEvent = { ...offen, is_konfirmation: true };
    // Die Vorabfrage nach einer anderen gebuchten Konfirmation haengt, bis
    // der Test sie loest -- in dieser Zeit kommt der zweite Tipp.
    const wartendeAbfragen: ((wert: unknown) => void)[] = [];
    apiGet.mockImplementation((url: string) => {
      if (url === '/konfi/events') return new Promise((r) => { wartendeAbfragen.push(r); });
      return Promise.resolve({ data: [] });
    });
    apiPost.mockResolvedValueOnce({ data: { status: 'confirmed' } });
    apiPost.mockRejectedValue({ response: { status: 409, data: { error: 'Du bist bereits für dieses Event angemeldet' } } });
    render(<EventDetailView eventId={5} onBack={() => undefined} />);

    const knopf = screen.getByText('Anmelden (2/10)') as HTMLButtonElement;
    fireEvent.click(knopf);
    fireEvent.click(knopf);
    await act(async () => { wartendeAbfragen.forEach((loese) => loese({ data: [aktuellesEvent] })); });

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    expect(setError).not.toHaveBeenCalled();
  });

  it('Zeitfenster: zwei Tipps auf dasselbe Zeitfenster schicken eine Anmeldung', async () => {
    aktuellesEvent = { ...offen, has_timeslots: true };
    apiGet.mockImplementation(async (url: string) => {
      if (url === '/konfi/events') return { data: [aktuellesEvent] };
      if (url === '/konfi/events/5/timeslots') {
        return { data: [{ id: 31, start_time: '2026-10-09T10:00:00Z', end_time: '2026-10-09T11:00:00Z', max_participants: 5, registered_count: 1 }] };
      }
      return { data: [] };
    });
    const antworte = haengenderPost();
    render(<EventDetailView eventId={5} onBack={() => undefined} />);

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/konfi/events/5/timeslots'));
    fireEvent.click(screen.getByText('Anmelden (2/10)'));
    await waitFor(() => expect(presentActionSheet).toHaveBeenCalledTimes(1));

    const knoepfe = presentActionSheet.mock.calls[0][0].buttons as { text: string; role?: string; handler: () => unknown }[];
    const slot = knoepfe.find((k) => k.role !== 'cancel')!;
    expect(slot.text).toContain('4 frei');
    act(() => { slot.handler(); slot.handler(); });

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    expect(apiPost).toHaveBeenCalledWith('/konfi/events/5/register', { timeslot_id: 31 });
    await act(async () => { antworte(); });
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(setError).not.toHaveBeenCalled();
  });

  it('Gegenprobe: ein echter Fehler des Servers erscheint weiter', async () => {
    aktuellesEvent = offen;
    apiPost.mockRejectedValue({ response: { status: 400, data: { error: 'Anmeldung bereits geschlossen' } } });
    render(<EventDetailView eventId={5} onBack={() => undefined} />);

    fireEvent.click(screen.getByText('Anmelden (2/10)'));

    await waitFor(() => expect(setError).toHaveBeenCalledWith('Anmeldung bereits geschlossen'));
    expect(apiPost).toHaveBeenCalledTimes(1);
  });
});
