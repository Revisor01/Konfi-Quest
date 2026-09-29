// Termin-Detailseite der Konfis (KonfiEventDetailPage) -- Verhaltenstest.
//
// Anlass: Audit Tests 26.09.2026, BF-10 -- die Seite hinter
// /konfi/events/:id hatte keinen Test. Sie liest die Kennung aus der Adresse,
// reicht sie an die Detailansicht und fuehrt "Zurueck" in die Terminliste,
// wenn es keinen Verlauf gibt (etwa nach einem Push oder Deep Link).
//
// Gerendert werden die echte Seite und die echte Detailansicht in einem
// echten Router; ersetzt sind Netz/Cache und die Ionic-Bausteine.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const push = vi.fn();
const goBack = vi.fn();
let kannZurueck = false;
let termine: Array<Record<string, unknown>> = [];

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
    useIonActionSheet: () => [vi.fn()],
    useIonRouter: () => ({ push, goBack, canGoBack: () => kannZurueck }),
  };
});
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setSuccess: vi.fn(), setError: vi.fn(), isOnline: true, user: { id: 7, type: 'konfi' } }),
}));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({ data: termine, loading: false, refresh: vi.fn(async () => undefined), refreshLive: vi.fn() }),
}));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(async () => ({ data: [] })), post: vi.fn(), delete: vi.fn() } }));
vi.mock('../../components/shared/OfflinePlatzhalter', () => ({ default: () => null }));
vi.mock('../../services/analytics', () => ({ track: vi.fn() }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
// Kopfzeile schlicht: Titel und, wenn die Seite es anbietet, der Zurueck-Knopf.
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: ({ titel, onZurueck }: { titel: string; onZurueck?: () => void }) => (
    <header>
      <span data-testid="kopfzeile">{titel}</span>
      {onZurueck && <button type="button" onClick={onZurueck}>Zurück</button>}
    </header>
  ),
  AppKopfzeileGross: ({ titel }: { titel: string }) => <h1>{titel}</h1>,
}));
vi.mock('../../components/shared', async () => {
  const fmt = await vi.importActual<typeof import('../../components/shared/eventFormatting')>('../../components/shared/eventFormatting');
  return { ...fmt, SectionHeader: () => null, AbsageBlock: () => null, EmptyState: () => null, ListSection: () => null };
});
vi.mock('../../components/konfi/modals/UnregisterModal', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/QRScannerModal', () => ({ default: () => null }));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveUpdate: () => ({ triggerRefresh: vi.fn() }), useLiveRefresh: vi.fn() }));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

import KonfiEventDetailPage from '../../components/konfi/pages/KonfiEventDetailPage';

const termin = (id: number, name: string) => ({
  id, name,
  event_date: '2030-10-01T16:00:00.000Z',
  points: 2, point_type: 'gemeinde', type: 'event',
  registration_status: 'open', cancelled: false, has_timeslots: false,
  mandatory: false, is_konfirmation: false, categories: [],
  max_participants: 10, registered_count: 2, waitlist_enabled: false,
  booking_status: null, is_registered: false, can_register: true,
});

const oeffne = (adresse: string) => render(
  <MemoryRouter initialEntries={[adresse]}>
    <Routes>
      <Route path="/konfi/events/:id" element={<KonfiEventDetailPage />} />
    </Routes>
  </MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
  kannZurueck = false;
  termine = [termin(5, 'Sommerfest'), termin(12, 'Gemeindefest')];
});

describe('Termin-Detailseite der Konfis', () => {
  it('zeigt den Termin, dessen Kennung in der Adresse steht', () => {
    oeffne('/konfi/events/12');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Gemeindefest');
    expect(screen.queryByText('Sommerfest')).toBe(null);
  });

  it('ein Termin, den die Konfi nicht in ihrer Liste hat, erscheint als "nicht gefunden" -- ohne fremde Daten', () => {
    oeffne('/konfi/events/99');
    expect(screen.getByTestId('kopfzeile').textContent).toBe('Event nicht gefunden');
    expect(screen.queryByText('Sommerfest')).toBe(null);
    expect(screen.queryByText('Gemeindefest')).toBe(null);
  });

  it('eine unsinnige Kennung fuehrt auf "nicht gefunden" statt zu einem Absturz', () => {
    oeffne('/konfi/events/abc');
    expect(screen.getByTestId('kopfzeile').textContent).toBe('Event nicht gefunden');
  });

  it('Zurueck mit Verlauf geht einen Schritt zurueck', () => {
    kannZurueck = true;
    oeffne('/konfi/events/5');
    fireEvent.click(screen.getByText('Zurück'));
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('Zurueck ohne Verlauf (Push, Deep Link) fuehrt in die Terminliste', () => {
    oeffne('/konfi/events/5');
    fireEvent.click(screen.getByText('Zurück'));
    expect(goBack).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/konfi/events', 'back', 'pop');
  });
});
