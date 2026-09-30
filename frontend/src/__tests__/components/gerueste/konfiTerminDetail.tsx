// Gerüst für gerenderte Tests der Termin-Detailansicht der Konfis
// (konfi/views/EventDetailView.tsx).
//
// Entstanden beim Umstellen der Quelltext-Tests auf Verhalten (Audit Tests
// 26.09.2026, BF-02, 30.09.2026). Aufbau wie gerueste/teamerTerminSeite.tsx:
// dieses Modul als ERSTES importieren, es registriert die Attrappen.
//
// Gerendert wird die ECHTE Ansicht samt echter geteilter Bausteine
// (Statuslogik, Absage-Block, Offline-Platzhalter). Nachgestellt sind Server,
// Netz, Warteschlange, Anmeldung und Router; die Modale (Abmelde-Dialog,
// Scanner) werden nur mitgeschrieben -- ihr Innenleben hat eigene Tests
// (abmeldeDialogGerendert).
import React from 'react';
import { vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { Event } from '../../../types/event';

export const zustand = {
  online: true,
  events: [] as Event[],
  teilnehmer: [] as Array<Record<string, unknown>>,
  zeitfenster: [] as Array<Record<string, unknown>>,
  /** Lädt die Terminliste noch (useOfflineQuery.loading)? */
  laedt: false,
};

/** Unter welchem Schlüssel die Ansicht ihre Terminliste liest. */
export const querySchluessel: string[] = [];

export const api = { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() };
export const setSuccess = vi.fn();
export const setError = vi.fn();
export const enqueue = vi.fn();
export const presentAlert = vi.fn();
export const modale = {
  geoeffnet: [] as Array<{ name: string; props: Record<string, unknown> }>,
};
export const zuletztGeoeffnet = (name: string) => [...modale.geoeffnet].reverse().find((m) => m.name === name);
export const leer = (name: string) => ({ default: { [name]: () => null }[name] });

vi.mock('../../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => api.get(...a),
    post: (...a: unknown[]) => api.post(...a),
    put: (...a: unknown[]) => api.put(...a),
    delete: (...a: unknown[]) => api.delete(...a),
  },
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ setSuccess, setError, isOnline: zustand.online, user: { id: 7, type: 'konfi', role_name: 'konfi' } }),
}));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => {
    querySchluessel.push(schluessel);
    return {
    data: zustand.laedt ? null : zustand.events, loading: zustand.laedt, isOffline: !zustand.online,
    refresh: vi.fn(async () => undefined), refreshLive: vi.fn(),
    };
  },
}));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: (...a: unknown[]) => enqueue(...a) } }));
vi.mock('../../../services/networkMonitor', () => ({
  networkMonitor: { get isOnline() { return zustand.online; }, subscribe: () => () => {} },
}));
vi.mock('../../../services/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/analytics')>()),
  track: vi.fn(),
}));
vi.mock('../../../components/common/LoadingSpinner', () => ({
  default: ({ message }: { message?: string }) => <div data-testid="ladeanzeige">{message}</div>,
}));
vi.mock('../../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
vi.mock('../../../components/konfi/modals/UnregisterModal', () => leer('UnregisterModal'));
vi.mock('../../../components/konfi/modals/QRScannerModal', () => leer('QRScannerModal'));
vi.mock('../../../contexts/LiveUpdateContext', () => ({
  useLiveUpdate: () => ({ triggerRefresh: vi.fn() }),
  useLiveRefresh: vi.fn(),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../utils/uuid', () => ({ safeUUID: () => 'uuid-1' }));

type K = { children?: React.ReactNode };
vi.mock('@ionic/react', () => {
  const durch = ({ children }: K) => <>{children}</>;
  return {
    IonPage: React.forwardRef<HTMLDivElement, K>(({ children }, ref) => <div ref={ref}>{children}</div>),
    IonContent: durch, IonHeader: durch, IonToolbar: durch, IonTitle: durch, IonButtons: durch,
    IonList: ({ children }: K) => <section>{children}</section>,
    IonListHeader: ({ children }: K) => <div>{children}</div>,
    IonLabel: ({ children }: K) => <span>{children}</span>,
    IonCard: ({ children }: K) => <div>{children}</div>,
    IonCardContent: ({ children }: K) => <div>{children}</div>,
    IonNote: ({ children }: K) => <span>{children}</span>,
    IonItem: ({ children, onClick }: K & { onClick?: () => void }) => <div onClick={onClick}>{children}</div>,
    // Das Symbol als leeres Element: welches, und ob es Vorlesehilfen verborgen ist.
    IonIcon: ({ icon, 'aria-hidden': verborgen }: { icon?: string; 'aria-hidden'?: boolean | 'true' | 'false' }) => (
      <i data-icon={icon} aria-hidden={verborgen} />
    ),
    IonSpinner: () => null, IonRefresher: () => null, IonRefresherContent: () => null,
    IonButton: ({ children, onClick, disabled, color, fill, 'aria-label': label }: K & {
      onClick?: () => void; disabled?: boolean; color?: string; fill?: string; 'aria-label'?: string;
    }) => (
      <button type="button" onClick={onClick} disabled={disabled} aria-label={label} data-color={color} data-fill={fill}>{children}</button>
    ),
    useIonModal: (komponente: { name?: string } | undefined, props: Record<string, unknown>) => {
      const name = komponente?.name || 'unbekannt';
      return [() => { modale.geoeffnet.push({ name, props }); }, vi.fn()];
    },
    useIonAlert: () => [presentAlert, vi.fn()],
    useIonActionSheet: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

const ladeAnsicht = async () => (await import('../../../components/konfi/views/EventDetailView')).default;

const TAG = 24 * 60 * 60 * 1000;
export const inTagen = (n: number) => new Date(Date.now() + n * TAG).toISOString();

export const termin = (zusatz: Partial<Event> = {}): Event => ({
  id: 5,
  name: 'Sommerfest',
  event_date: inTagen(10),
  points: 2,
  point_type: 'gemeinde',
  type: 'event',
  max_participants: 10,
  registered_count: 2,
  registration_status: 'open',
  can_register: true,
  is_registered: false,
  booking_status: null,
  cancelled: false,
  has_timeslots: false,
  mandatory: false,
  is_konfirmation: false,
  categories: [],
  ...zusatz,
} as Event);

export const zuruecksetzen = () => {
  zustand.online = true;
  zustand.events = [];
  zustand.teilnehmer = [];
  zustand.zeitfenster = [];
  zustand.laedt = false;
  querySchluessel.length = 0;
  for (const f of [api.get, api.post, api.put, api.delete, setSuccess, setError, enqueue, presentAlert]) f.mockReset();
  modale.geoeffnet.length = 0;
  api.get.mockImplementation(async (pfad: string) => {
    if (pfad === '/konfi/events') return { data: zustand.events };
    if (/\/participants$/.test(pfad)) return { data: zustand.teilnehmer };
    if (/\/timeslots$/.test(pfad)) return { data: zustand.zeitfenster };
    return { data: [] };
  });
  api.post.mockResolvedValue({ data: { status: 'confirmed' } });
  api.delete.mockResolvedValue({ data: {} });
  enqueue.mockResolvedValue(undefined);
};

/** Die Ansicht für einen Termin rendern und die Nachlade-Abrufe abwarten. */
export const oeffne = async (event: Event = zustand.events[0]) => {
  if (!zustand.events.includes(event)) zustand.events = [event];
  const EventDetailView = await ladeAnsicht();
  const r = render(<EventDetailView eventId={event.id} onBack={() => undefined} />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
  return r;
};

/** Die Karte "Bist du dabei?". */
export const dabeiKarte = () => {
  const titel = screen.getAllByText('Bist du dabei?').find((el) => el.tagName === 'SPAN')!;
  return titel.closest('section') as HTMLElement;
};

export const knopf = (name: string | RegExp) => screen.queryByRole('button', { name });
