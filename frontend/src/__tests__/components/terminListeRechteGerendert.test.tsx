// Terminliste der Leitungsansicht: Anlegen, Kopieren, Absagen, Loeschen nur
// fuer die Leitung -- gerendert statt Quelltext gelesen (Audit Tests
// 26.09.2026, BF-02; Regel seit 16.09.2026, terminRechteOberflaeche.test.ts).
//
// Teamer:innen oeffnen dieselbe Seite (AdminEventsPage). Vorher zaehlte sie
// 'teamer' zu den Verwaltungsrollen und bot "Neues Event anlegen", Absagen
// und Loeschen an -- jeder Tipp endete mit 403. Gerendert werden die echte
// Seite und die echte Liste (EventsView) mit ihren Wischaktionen.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import type { Event } from '../../types/event';

let rolle = 'org_admin';
let termine: Event[] = [];
let abgesagteTermine: Event[] = [];

vi.mock('../../services/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: [], headers: {} }), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 1, organization_id: 1, role_name: rolle }, setSuccess: vi.fn(), setError: vi.fn(), isOnline: true }),
}));
vi.mock('../../contexts/BadgeContext', () => ({ useBadge: () => ({ pendingEventsCount: 0, pendingRequestsCount: 0 }) }));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveUpdate: () => ({ triggerRefresh: vi.fn() }), useLiveRefresh: () => {} }));
vi.mock('../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ search: '', pathname: '/admin/events' }) }));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => ({
    data: schluessel.startsWith('admin:events:') ? termine
      : schluessel.startsWith('admin:events-cancelled:') ? abgesagteTermine : [],
    loading: false, refresh: vi.fn().mockResolvedValue(undefined), refreshLive: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock('../../components/admin/ActivityRequestsView', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/EventModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/ActivityRequestModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/TerminAbsagenModal', () => ({ default: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
// Kopfzeile schlicht: nur der rechte Bereich, dort sitzt "Neues Event anlegen".
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: ({ rechts }: { rechts?: React.ReactNode }) => <header>{rechts}</header>,
  AppKopfzeileGross: () => null,
}));

vi.mock('@ionic/react', () => {
  type P = { children?: React.ReactNode };
  const durch = ({ children }: P) => <>{children}</>;
  return {
    IonPage: React.forwardRef<HTMLDivElement, P>(({ children }, ref) => <div ref={ref}>{children}</div>),
    IonContent: durch, IonRefresher: () => null, IonRefresherContent: () => null, IonIcon: () => null,
    IonSegment: durch, IonSegmentButton: durch, IonLabel: durch, IonList: durch, IonListHeader: durch,
    IonItemGroup: durch, IonItemOptions: durch, IonCard: durch, IonCardContent: durch,
    IonSelect: durch, IonSelectOption: durch, IonInput: () => null,
    IonButton: ({ children, onClick, 'aria-label': label }: P & { onClick?: () => void; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>,
    IonItem: ({ children, onClick }: P & { onClick?: () => void }) => <div onClick={onClick}>{children}</div>,
    IonItemSliding: ({ children }: P) => <div data-testid="termin">{children}</div>,
    IonItemOption: ({ children, onClick, 'aria-label': label }: P & { onClick?: () => void; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} onClick={onClick}>{children}</button>,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonActionSheet: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

import AdminEventsPage from '../../components/admin/pages/AdminEventsPage';
import KonfiEventsView from '../../components/konfi/views/EventsView';

// Feste Uhr, nur Date: Die Termine liegen sicher in der Zukunft, unabhaengig
// vom Tag, an dem der Test laeuft (BF-15).
const JETZT = new Date('2026-09-20T10:00:00+02:00');
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(JETZT);
  rolle = 'org_admin';
  abgesagteTermine = [];
  termine = [{
    id: 31, name: 'Konfi-Freizeit', description: '', event_date: '2026-10-10T08:00:00.000Z', location: '',
    points: 2, type: 'event', max_participants: 20, registered_count: 3, registration_status: 'open',
    cancelled: false, categories: [], jahrgaenge: [],
  } as unknown as Event];
});
afterEach(() => { vi.useRealTimers(); });

const WISCH = ['Event kopieren', 'Event absagen', 'Event löschen'];

describe.each(['org_admin', 'admin'])('ERLAUBT: %s', (leitung) => {
  it('sieht "Neues Event anlegen" und am Termin Kopieren, Absagen, Loeschen', () => {
    rolle = leitung;
    render(<AdminEventsPage />);
    expect(screen.getByRole('button', { name: 'Neues Event anlegen' })).toBeInTheDocument();
    const zeile = screen.getByTestId('termin');
    expect(within(zeile).getByText('Konfi-Freizeit')).toBeInTheDocument();
    for (const name of WISCH) expect(within(zeile).getByRole('button', { name })).toBeInTheDocument();
  });
});

describe('VERBOTEN: Teamer:innen', () => {
  it('sehen die Liste, aber weder "Neues Event anlegen" noch eine Wischaktion', () => {
    rolle = 'teamer';
    render(<AdminEventsPage />);
    const zeile = screen.getByTestId('termin');
    expect(within(zeile).getByText('Konfi-Freizeit')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Neues Event anlegen' })).toBe(null);
    for (const name of WISCH) expect(within(zeile).queryByRole('button', { name })).toBe(null);
  });
});

// Am ABGESAGTEN Termin (teamerTerminAbsagen, bis 30.09.2026 am Quelltext
// geprueft): Die Rechte sind nicht weggefallen, nur auf die Leitung
// zusammengezogen -- sie bietet Absagegrund, Zuruecknehmen und Loeschen an.
const WISCH_ABGESAGT = ['Absagegrund bearbeiten', 'Absage zurücknehmen', 'Event löschen'];
// Abgesagte Termine laedt die Seite ueber einen eigenen Abruf (/events/cancelled).
const abgesagt = () => {
  abgesagteTermine = [{ ...termine[0], registration_status: 'cancelled', cancelled: true, cancelled_reason: 'Sturm' } as Event];
  termine = [];
};

describe.each(['org_admin', 'admin'])('ERLAUBT: %s am abgesagten Termin', (leitung) => {
  it('sieht Absagegrund bearbeiten, Absage zuruecknehmen und Loeschen -- aber nicht noch einmal "Event absagen"', () => {
    rolle = leitung;
    abgesagt();
    render(<AdminEventsPage />);
    const zeile = screen.getByTestId('termin');
    for (const name of WISCH_ABGESAGT) expect(within(zeile).getByRole('button', { name })).toBeInTheDocument();
    expect(within(zeile).queryByRole('button', { name: 'Event absagen' })).toBe(null);
  });
});

describe('VERBOTEN: Teamer:innen am abgesagten Termin', () => {
  it('sehen keine der drei Wischaktionen', () => {
    rolle = 'teamer';
    abgesagt();
    render(<AdminEventsPage />);
    for (const name of WISCH_ABGESAGT) expect(screen.queryByRole('button', { name })).toBe(null);
  });
});

describe('Konfi-Liste', () => {
  it('hat gar keine Wischaktionen -- weder am aktiven noch am abgesagten Termin', () => {
    const aktiv = termine[0];
    const weg = { ...aktiv, id: 32, name: 'Konfi-Tag', registration_status: 'cancelled', cancelled: true } as Event;
    render(
      <KonfiEventsView events={[aktiv, weg]} activeTab="alle" onTabChange={() => undefined} onSelectEvent={() => undefined} />
    );
    expect(screen.getByText('Konfi-Freizeit')).toBeInTheDocument();
    expect(screen.getByText('Konfi-Tag')).toBeInTheDocument();
    expect(screen.queryAllByTestId('termin')).toHaveLength(0);
    for (const name of [...WISCH, ...WISCH_ABGESAGT]) expect(screen.queryByRole('button', { name })).toBe(null);
  });
});
