// Abgesagte Termine in der Leitungsliste und auf den Startseiten von Konfi und
// Team (15.09.2026) -- gerendert (Audit Tests 26.09.2026, BF-02; bis
// 09.10.2026 am Quelltext geprueft in abgesagteTermineAnsichten.test.ts, dort
// steht der Befund).
//
// Befund A: Alle Terminlisten streichen abgesagte Titel durch und grauen sie
// aus. Befund D: Die Startseiten zeigten den Grund gar nicht -- ausgerechnet
// dort, wo man nach dem Push "Termin abgesagt" ZUERST landet. Und der Wisch
// der Leitung: Ruecknahme gruen, Grund bearbeiten warnfarben, am offenen
// Termin weiter "Event absagen". Wer welche Wisch-Aktion sieht, pruefen
// terminListeRechteGerendert.test.tsx und teamerTerminAbsagen.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, within, act } from '@testing-library/react';
import type { Event } from '../../types/event';

let termine: Event[] = [];
let abgesagteTermine: Event[] = [];
const dashboard = {
  greeting: { display_name: 'Tia Teamer', hour: 9 },
  certificates: [] as unknown[],
  events: [] as unknown[],
  badges: { recent: [], earned_count: 0, total_count: 0 },
  config: { show_challenges: false, show_losung: false },
  has_wrapped: false,
  konfspruch: null,
};

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {}, headers: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }), put: vi.fn().mockResolvedValue({ data: {} }), delete: vi.fn(),
  },
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 1, organization_id: 1, role_name: 'org_admin', type: 'admin' }, setSuccess: vi.fn(), setError: vi.fn(), isOnline: true }),
}));
vi.mock('../../contexts/BadgeContext', () => ({ useBadge: () => ({ pendingEventsCount: 0, pendingRequestsCount: 0 }) }));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveUpdate: () => ({ triggerRefresh: vi.fn() }), useLiveRefresh: () => {} }));
vi.mock('../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ search: '', pathname: '/admin/events' }) }));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => ({
    data: schluessel.startsWith('admin:events:') ? termine
      : schluessel.startsWith('admin:events-cancelled:') ? abgesagteTermine
        : schluessel.startsWith('teamer:dashboard:') ? dashboard : null,
    loading: false, error: null, refresh: vi.fn().mockResolvedValue(undefined), refreshLive: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock('../../services/offlineCache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/offlineCache')>()),
  CACHE_TTL: { DASHBOARD: 1, BADGES: 1, TAGESLOSUNG: 1 },
}));
vi.mock('../../components/admin/ActivityRequestsView', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/EventModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/ActivityRequestModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/TerminAbsagenModal', () => ({ default: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
// Teamer-Startseite: schwere Kinder weg, die Termin-Bausteine bleiben echt.
vi.mock('../../components/wrapped/WrappedModal', () => ({ default: () => null }));
vi.mock('../../components/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../components/shared')>()),
  ProfileHeaderButton: () => null, TrialBanner: () => null, StoreUpdateBanner: () => null,
}));
vi.mock('../../components/shared/BibleTranslationModal', () => ({ default: () => null, getTranslationName: (c: string) => c }));
vi.mock('../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/KonfispruchSelectModal', () => ({ default: () => null }));
vi.mock('../../components/teamer/modals/TeamerOnboardingModal', () => ({ default: () => null }));
vi.mock('../../hooks/useOnboardingOnce', () => ({
  useOnboardingWithUpdateOnce: () => ({
    showOnboarding: false, closeOnboarding: vi.fn(), showUpdateHinweis: false, markUpdateHinweisGesehen: vi.fn(),
    showMitmachenHinweis: false, markMitmachenHinweisGesehen: vi.fn(),
  }),
}));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

vi.mock('@ionic/react', () => {
  type P = { children?: React.ReactNode };
  const durch = ({ children }: P) => <>{children}</>;
  return {
    IonPage: React.forwardRef<HTMLDivElement, P>(({ children }, ref) => <div ref={ref}>{children}</div>),
    IonHeader: durch, IonToolbar: durch, IonTitle: durch, IonButtons: durch,
    IonContent: durch, IonRefresher: () => null, IonRefresherContent: () => null, IonIcon: () => null, IonSpinner: () => null,
    IonSegment: durch, IonSegmentButton: durch, IonLabel: durch, IonList: durch, IonListHeader: durch,
    IonItemGroup: durch, IonItemOptions: durch, IonCard: durch, IonCardContent: durch,
    IonSelect: durch, IonSelectOption: durch, IonInput: () => null, IonNote: durch, IonBadge: durch,
    IonButton: ({ children, onClick, 'aria-label': label }: P & { onClick?: () => void; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>,
    IonItem: ({ children, onClick }: P & { onClick?: () => void }) => <div onClick={onClick}>{children}</div>,
    IonItemSliding: ({ children }: P) => <div data-testid="termin">{children}</div>,
    IonItemOption: ({ children, onClick, 'aria-label': label }: P & { onClick?: () => void; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonPopover: () => [vi.fn(), vi.fn()],
    useIonActionSheet: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
    useIonViewWillEnter: () => {},
  };
});

import AdminEventsPage from '../../components/admin/pages/AdminEventsPage';
import { EventCard } from '../../components/konfi/views/DashboardSections';
import TeamerDashboardPage from '../../components/teamer/pages/TeamerDashboardPage';

const GRUND = 'Heizung im Gemeindehaus defekt';
const URHEBER = {
  cancelled_reason: GRUND,
  cancelled_by_name: 'Anna Meier', cancelled_at: '2026-09-15T08:00:00+02:00',
  cancelled_reason_set_by_name: 'Bernd Schulz', cancelled_reason_set_at: '2026-09-16T09:30:00+02:00',
};

const JETZT = new Date('2026-09-20T10:00:00+02:00');
const offen = (id: number, name: string) => ({
  id, name, title: name, description: '', event_date: '2026-10-10T08:00:00.000Z', location: '',
  points: 2, type: 'event', max_participants: 20, registered_count: 3, registration_status: 'open',
  cancelled: false, categories: [], jahrgaenge: [],
}) as unknown as Event;
// Wie die Listen ihn liefern: registration_status='cancelled' (die Liste der
// Abgesagten traegt zusaetzlich cancelled=true -- hier bewusst ohne).
const abgesagt = (id: number, name: string, zusatz: Record<string, unknown> = {}) =>
  ({ ...offen(id, name), registration_status: 'cancelled', cancelled: undefined, ...URHEBER, ...zusatz }) as unknown as Event;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
  termine = [];
  abgesagteTermine = [];
  dashboard.events = [];
});
afterEach(() => { vi.useRealTimers(); });

const zeileMit = (name: string) => screen.getAllByTestId('termin').find((z) => z.textContent?.includes(name)) as HTMLElement;
const titelVon = (zeile: HTMLElement) => zeile.querySelector('.app-list-item__title') as HTMLElement;

describe('Leitungsliste: abgesagte Termine', () => {
  it('Befund A: streicht durch und graut aus -- den offenen Termin nicht', () => {
    termine = [offen(31, 'Konfi-Freizeit')];
    abgesagteTermine = [abgesagt(32, 'Konfi-Tag')];
    render(<AdminEventsPage />);
    expect(titelVon(zeileMit('Konfi-Tag')).style.textDecoration).toBe('line-through');
    expect(titelVon(zeileMit('Konfi-Tag')).style.color).toBe('var(--app-text-muted)');
    expect(titelVon(zeileMit('Konfi-Freizeit')).style.textDecoration).toBe('none');
  });

  it('der Absageblock steht in der Zeile: Grund einmal, beide Urheber', () => {
    abgesagteTermine = [abgesagt(32, 'Konfi-Tag')];
    render(<AdminEventsPage />);
    const zeile = zeileMit('Konfi-Tag');
    expect(within(zeile).getAllByText(GRUND)).toHaveLength(1);
    expect(within(zeile).getAllByText('Abgesagt von Anna Meier, 15.09.')).toHaveLength(1);
    expect(within(zeile).getAllByText('Grund geändert von Bernd Schulz, 16.09.')).toHaveLength(1);
  });

  it('die Ruecknahme ist gruen, das Bearbeiten des Grundes warnfarben', () => {
    abgesagteTermine = [abgesagt(32, 'Konfi-Tag')];
    render(<AdminEventsPage />);
    const zeile = zeileMit('Konfi-Tag');
    const kreis = (name: string) => within(zeile).getByRole('button', { name }).querySelector('.app-icon-circle')!.className;
    expect(kreis('Absage zurücknehmen')).toBe('app-icon-circle app-icon-circle--lg app-icon-circle--success');
    expect(kreis('Absagegrund bearbeiten')).toBe('app-icon-circle app-icon-circle--lg app-icon-circle--warning');
  });

  it('an einem NICHT abgesagten Termin bietet derselbe Wisch weiter "Event absagen" -- und keine Ruecknahme', () => {
    termine = [offen(31, 'Konfi-Freizeit')];
    render(<AdminEventsPage />);
    const zeile = zeileMit('Konfi-Freizeit');
    expect(within(zeile).getByRole('button', { name: 'Event absagen' })).toBeTruthy();
    expect(within(zeile).queryByRole('button', { name: 'Absage zurücknehmen' })).toBeNull();
    expect(within(zeile).queryByRole('button', { name: 'Absagegrund bearbeiten' })).toBeNull();
  });
});

describe('Konfi-Startseite: die Kachel', () => {
  it('Befund D: streicht durch, sagt ABGESAGT und zeigt Grund samt Urhebern', () => {
    render(<EventCard event={abgesagt(32, 'Konfi-Tag') as never} onClick={() => undefined} />);
    expect(screen.getByText('ABGESAGT')).toBeTruthy();
    expect((screen.getByText('Konfi-Tag') as HTMLElement).style.textDecoration).toBe('line-through');
    expect(screen.getAllByText(GRUND)).toHaveLength(1);
    expect(screen.getAllByText('Abgesagt von Anna Meier, 15.09.')).toHaveLength(1);
  });

  it('ein offener Termin bleibt ungestrichen und ohne Absage', () => {
    render(<EventCard event={offen(31, 'Konfi-Freizeit') as never} onClick={() => undefined} />);
    expect((screen.getByText('Konfi-Freizeit') as HTMLElement).style.textDecoration).toBe('none');
    expect(screen.queryByText('ABGESAGT')).toBeNull();
  });
});

describe('Team-Startseite: die Kachel', () => {
  it('Befund D: streicht durch, sagt ABGESAGT und zeigt den Grund', async () => {
    dashboard.events = [abgesagt(32, 'Konfi-Tag'), offen(31, 'Konfi-Freizeit')];
    render(<TeamerDashboardPage />);
    await act(async () => { await Promise.resolve(); });
    const kachel = screen.getByText('Konfi-Tag').closest('.app-dashboard-glass-card') as HTMLElement;
    expect(within(kachel).getByText('ABGESAGT')).toBeTruthy();
    expect((within(kachel).getByText('Konfi-Tag') as HTMLElement).style.textDecoration).toBe('line-through');
    expect(within(kachel).getAllByText(GRUND)).toHaveLength(1);
    expect(within(kachel).getAllByText('Abgesagt von Anna Meier, 15.09.')).toHaveLength(1);
    const andere = screen.getByText('Konfi-Freizeit').closest('.app-dashboard-glass-card') as HTMLElement;
    expect((within(andere).getByText('Konfi-Freizeit') as HTMLElement).style.textDecoration).toBe('none');
  });
});
