// Abgemeldet durch die Leitung -> "Wieder anmelden"; Warteliste -> ein Weg
// herunter (Audit 26.09.2026, Screens Konfi/Teamer BF-01 und BF-02)
//
// BF-01: Seit Migration 153 setzt eine Abmeldung durch die Leitung
// booking_status = 'excused'. Die Detailansicht kannte den Wert nicht: Der
// Statuskopf sagte "Offen", unten stand ein grauer Knopf "Nicht verfuegbar",
// nirgends das Wort "abgemeldet" -- und kein Weg zurueck, obwohl das Backend
// die Wiederanmeldung ausdruecklich erlaubt (bookingUtils.js, 16.09.2026)
// und das Handbuch sie verspricht (70-termine.md "Wieder anmelden kann sie
// sich aber selbst").
//
// BF-02: is_registered ist nur bei 'confirmed' wahr. Wer wartete, bekam
// deshalb keinen Abmelden-Knopf, sondern -- weil der Termin voll war -- den
// aktiven Knopf "Warteliste offen", der POST /register rief und mit 409 "Du
// bist bereits angemeldet" endete. Herunter von der Warteliste kam niemand.
//
// Gerendert wird die echte Ansicht mit fester Terminliste (useOfflineQuery
// gemockt); gemessen werden Statustext, Knopftext und der API-Aufruf, den
// ein Tipp ausloest. Der Abmelde-Dialog ist so gemockt, dass "Oeffnen"
// sofort mit einem Grund bestaetigt -- sein Innenleben ist nicht Thema.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const setError = vi.fn();
const setSuccess = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();
const apiGet = vi.fn();
let aktuellesEvent: Record<string, unknown> = {};

interface ModalProps { onUnregister?: (grund: string) => void }

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
    // Der Abmelde-Dialog bestaetigt beim Oeffnen sofort mit einem Grund.
    // Andere Dialoge (Opt-out, QR) tragen kein onUnregister und tun nichts.
    useIonModal: (_komponente: unknown, props: ModalProps) =>
      [() => props?.onUnregister?.('Habe etwas anderes vor'), vi.fn()],
    useIonActionSheet: () => [vi.fn()],
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
    delete: (...a: unknown[]) => apiDelete(...a),
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
const morgen = new Date(Date.now() + 1 * TAG).toISOString();

const basis = {
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
};

beforeEach(() => {
  setError.mockReset(); setSuccess.mockReset(); apiPost.mockReset(); apiDelete.mockReset(); apiGet.mockReset();
  apiGet.mockImplementation(async (url: string) => {
    if (url === '/konfi/events') return { data: [aktuellesEvent] };
    return { data: [] };
  });
  apiPost.mockResolvedValue({ data: { status: 'confirmed' } });
  apiDelete.mockResolvedValue({ data: { message: 'Abmeldung erfolgreich' } });
});

describe('Von der Leitung abgemeldet (booking_status excused)', () => {
  const abgemeldet = {
    ...basis,
    max_participants: 10, registered_count: 2, waitlist_enabled: false,
    booking_status: 'excused', is_registered: false, can_register: true,
  };

  it('sagt es im Kopf und im Text, statt "Offen" und "Nicht verfuegbar" zu zeigen', () => {
    aktuellesEvent = abgemeldet;
    const { container } = render(<EventDetailView eventId={5} onBack={() => undefined} />);

    expect(screen.getByTestId('status').textContent).toBe('Abgemeldet');
    expect(screen.getByText('Von der Leitung abgemeldet')).toBeTruthy();
    expect(screen.queryByText('Nicht verfügbar')).toBeNull();
    expect((container.textContent || '').toLowerCase()).toContain('abgemeldet');
  });

  it('bietet "Wieder anmelden" an, und der Tipp ruft die Anmelderoute', async () => {
    aktuellesEvent = abgemeldet;
    render(<EventDetailView eventId={5} onBack={() => undefined} />);

    const knopf = screen.getByText('Wieder anmelden') as HTMLButtonElement;
    expect(knopf.disabled).toBe(false);
    fireEvent.click(knopf);

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/konfi/events/5/register', {}));
    expect(apiPost).toHaveBeenCalledTimes(1);
  });

  it('ist der Termin voll, fuehrt "Wieder anmelden" auf die Warteliste', async () => {
    aktuellesEvent = {
      ...abgemeldet,
      max_participants: 2, registered_count: 2,
      waitlist_enabled: true, max_waitlist_size: 5, waitlist_count: 1,
    };
    render(<EventDetailView eventId={5} onBack={() => undefined} />);

    const knopf = screen.getByText('Wieder anmelden (Warteliste)') as HTMLButtonElement;
    fireEvent.click(knopf);
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/konfi/events/5/register', {}));
  });

  it('Gegenprobe: ist der Anmeldeschluss vorbei (can_register false), gibt es keinen Knopf zurueck', () => {
    aktuellesEvent = { ...abgemeldet, can_register: false, registration_status: 'closed' };
    render(<EventDetailView eventId={5} onBack={() => undefined} />);

    expect(screen.getByText('Von der Leitung abgemeldet')).toBeTruthy();
    expect(screen.queryByText(/Wieder anmelden/)).toBeNull();
    const gesperrt = screen.getByText('Anmeldung geschlossen') as HTMLButtonElement;
    expect(gesperrt.disabled).toBe(true);
  });
});

describe('Auf der Warteliste (booking_status waitlist)', () => {
  const wartend = {
    ...basis,
    max_participants: 4, registered_count: 4,
    waitlist_enabled: true, max_waitlist_size: 5, waitlist_count: 2, waitlist_position: 2,
    booking_status: 'waitlist', is_registered: false, can_register: false,
  };

  it('nennt den Platz und bietet "Von der Warteliste abmelden" statt "Warteliste offen"', () => {
    aktuellesEvent = wartend;
    render(<EventDetailView eventId={5} onBack={() => undefined} />);

    expect(screen.getByTestId('status').textContent).toBe('Warteliste (2)');
    expect(screen.getByText('Du stehst auf Platz 2 der Warteliste')).toBeTruthy();
    expect(screen.queryByText(/Warteliste offen/)).toBeNull();
    expect(screen.getByText('Von der Warteliste abmelden')).toBeTruthy();
  });

  it('der Tipp ruft die Abmelderoute (DELETE), nicht die Anmelderoute', async () => {
    aktuellesEvent = wartend;
    render(<EventDetailView eventId={5} onBack={() => undefined} />);

    fireEvent.click(screen.getByText('Von der Warteliste abmelden'));

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith(
      '/konfi/events/5/register',
      { data: { reason: 'Habe etwas anderes vor', client_id: 'uuid-1' } }
    ));
    expect(apiPost).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it('auch in den letzten 48 Stunden: die Abmeldefrist gilt nicht fuer Wartende', async () => {
    aktuellesEvent = { ...wartend, event_date: morgen };
    render(<EventDetailView eventId={5} onBack={() => undefined} />);

    expect(screen.queryByText('Abmelden geht nur bis 2 Tage vorher')).toBeNull();
    fireEvent.click(screen.getByText('Von der Warteliste abmelden'));
    await waitFor(() => expect(apiDelete).toHaveBeenCalledTimes(1));
  });
});

describe('Gegenproben: die anderen Zustaende bleiben, wie sie waren', () => {
  it('bestaetigt angemeldet, Termin morgen: die Frist sperrt weiter', () => {
    aktuellesEvent = {
      ...basis, event_date: morgen,
      max_participants: 10, registered_count: 3,
      booking_status: 'confirmed', is_registered: true, can_register: false,
    };
    render(<EventDetailView eventId={5} onBack={() => undefined} />);

    expect(screen.getByTestId('status').textContent).toBe('Angemeldet');
    const gesperrt = screen.getByText('Abmelden geht nur bis 2 Tage vorher') as HTMLButtonElement;
    expect(gesperrt.disabled).toBe(true);
    expect(screen.queryByText(/Warteliste abmelden/)).toBeNull();
  });

  it('ohne eigene Buchung: "Anmelden (2/10)" wie bisher', () => {
    aktuellesEvent = {
      ...basis,
      max_participants: 10, registered_count: 2, waitlist_enabled: false,
      booking_status: null, is_registered: false, can_register: true,
    };
    render(<EventDetailView eventId={5} onBack={() => undefined} />);

    expect(screen.getByTestId('status').textContent).toBe('Offen');
    expect(screen.getByText('Anmelden (2/10)')).toBeTruthy();
    expect(screen.queryByText(/abgemeldet/i)).toBeNull();
  });

  it('abgesagter Termin schlaegt alles: auch Wartende und Abgemeldete sehen nur die Absage', () => {
    aktuellesEvent = {
      ...basis, cancelled: true, registration_status: 'cancelled',
      max_participants: 4, registered_count: 4, waitlist_enabled: true,
      booking_status: 'waitlist', is_registered: false, can_register: false, waitlist_position: 1,
    };
    render(<EventDetailView eventId={5} onBack={() => undefined} />);

    expect(screen.getByText('Dieser Termin ist abgesagt')).toBeTruthy();
    expect(screen.queryByText(/Warteliste abmelden/)).toBeNull();
  });
});
