// Abgemeldete zaehlen nirgends als Teilnehmende -- an der gerenderten Ansicht
// geprueft (Audit Tests 26.09.2026, BF-02; ersetzt die Quelltext-Suche in
// zaehlungAbgemeldete.test.ts).
//
// BEFUND 16.09.2026: Die Rueckfrage vor dem Absagen sagte "13 Konfis
// angemeldet", waehrend die Kacheln "11 von 13" zeigten -- sie zaehlte jede
// Konfi-Buchung, auch Selbstabmeldung ('opted_out') und Abmeldung durch die
// Leitung ('excused'). Angemeldet ist nur 'confirmed'. Die Konfi-Ansicht
// nimmt die Zahl des Servers und rechnet nicht nach; ein abgesagter Termin
// zeigt statt freier Plaetze die Zahl der Abgemeldeten.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

// --- gemeinsam -----------------------------------------------------------------
const apiGet = vi.fn();
let modale: Array<{ Komponente: unknown; props: Record<string, unknown> }> = [];
let konfiTermine: Array<Record<string, unknown>> = [];

vi.mock('../../services/api', () => ({
  default: { get: (url: string) => apiGet(url), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 99, organization_id: 1, role_name: 'org_admin', type: 'admin' }, setSuccess: vi.fn(), setError: vi.fn(), isOnline: true }),
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveUpdate: () => ({ triggerRefresh: vi.fn() }), useLiveRefresh: () => {} }));
vi.mock('../../services/offlineCache', () => ({ offlineCache: { get: vi.fn().mockResolvedValue(null) } }));
vi.mock('../../services/analytics', () => ({ trackHandlung: vi.fn(), track: vi.fn() }));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({ data: konfiTermine, loading: false, refresh: vi.fn(async () => undefined), refreshLive: vi.fn() }),
}));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/shared/PostfachGlocke', () => ({ default: () => null }));
vi.mock('../../components/shared/OrgSwitcherButton', () => ({ default: () => null }));
vi.mock('../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
vi.mock('../../components/shared/OfflinePlatzhalter', () => ({ default: () => null }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../components/konfi/modals/UnregisterModal', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/QRScannerModal', () => ({ default: () => null }));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
// Die Kacheln im Kopf der Konfi-Ansicht als Liste "Zahl Beschriftung".
vi.mock('../../components/shared', async () => {
  const echt = await vi.importActual<typeof import('../../components/shared/eventFormatting')>('../../components/shared/eventFormatting');
  return {
    ...echt,
    SectionHeader: ({ stats }: { stats: Array<{ value: unknown; label: string }> }) => (
      <ul data-testid="kacheln">{stats.map((s) => <li key={s.label}>{`${s.value} ${s.label}`}</li>)}</ul>
    ),
    AbsageBlock: () => null, EmptyState: () => null, ListSection: () => null,
  };
});
vi.mock('@ionic/react', () => {
  type P = { children?: React.ReactNode };
  const durch = ({ children }: P) => <>{children}</>;
  return {
    IonPage: durch, IonHeader: durch, IonToolbar: durch, IonTitle: durch, IonContent: durch, IonButtons: durch,
    IonCard: durch, IonCardContent: durch, IonItem: durch, IonLabel: durch, IonList: durch, IonListHeader: durch,
    IonItemSliding: durch, IonItemOptions: durch, IonItemOption: durch, IonNote: durch,
    IonIcon: () => null, IonRefresher: () => null, IonRefresherContent: () => null,
    IonButton: ({ children, onClick }: P & { onClick?: () => void }) => <button type="button" onClick={onClick}>{children}</button>,
    useIonModal: (Komponente: unknown, props: Record<string, unknown>) => { modale.push({ Komponente, props }); return [vi.fn(), vi.fn()]; },
    useIonActionSheet: () => [vi.fn(), vi.fn()],
    useIonAlert: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});
vi.mock('../../components/admin/modals/EventModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/ParticipantManagementModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AnwesenheitNotizModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AbmeldungNachtragenModal', () => ({ default: () => null }));
vi.mock('../../components/shared/QRDisplayModal', () => ({ default: () => null }));
vi.mock('../../components/teamer/pages/TeamerMaterialDetailPage', () => ({ default: () => null }));
vi.mock('../../components/teamer/modals/TeamerAbsageModal', () => ({ default: () => null }));
const { TerminAbsagenModal } = vi.hoisted(() => ({ TerminAbsagenModal: () => null }));
vi.mock('../../components/admin/modals/TerminAbsagenModal', () => ({ default: TerminAbsagenModal }));

import LeitungDetail from '../../components/admin/views/EventDetailView';
import KonfiDetail from '../../components/konfi/views/EventDetailView';

const inEinerWoche = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const teilnahme = (id: number, status: string, role_name = 'konfi') => ({
  id, user_id: id + 100, participant_name: `Person ${id}`, role_name, status, attendance_status: null, created_at: '2026-09-01T10:00:00Z',
});

beforeEach(() => {
  vi.clearAllMocks();
  modale = [];
  konfiTermine = [];
});

describe('Leitung: Rueckfrage vor dem Absagen', () => {
  it('zaehlt nur angemeldete Konfis -- nicht Selbstabmeldung, Abmeldung durch die Leitung, Warteliste oder Team', async () => {
    apiGet.mockImplementation(async (url: string) => (url === '/events/7' ? { data: {
      id: 7, name: 'Pflichttermin', event_date: inEinerWoche, points: 0, type: 'event', max_participants: 20,
      registered_count: 2, registration_status: 'open', unregistrations: [], created_at: '2026-08-01T00:00:00Z',
      participants: [
        teilnahme(1, 'confirmed'), teilnahme(2, 'confirmed'),
        teilnahme(3, 'opted_out'), teilnahme(4, 'excused'), teilnahme(5, 'waitlist'),
        teilnahme(6, 'confirmed', 'teamer'),
      ],
    } } : { data: [] }));
    render(<LeitungDetail eventId={7} onBack={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText('Person 1').length).toBeGreaterThan(0));
    // Die Props des letzten Renderns -- so haelt Ionic sie fuer present() bereit.
    const absage = modale.filter((m) => m.Komponente === TerminAbsagenModal).at(-1);
    expect(absage?.props.konfiAnzahl).toBe(2);
  });
});

describe('Konfi: Zahlen im Kopf des Termins', () => {
  const termin = (zusatz: Record<string, unknown>) => ({
    id: 5, name: 'Sommerfest', event_date: inEinerWoche, points: 2, point_type: 'gemeinde', type: 'event',
    registration_status: 'open', cancelled: false, has_timeslots: false, mandatory: false, is_konfirmation: false,
    categories: [], max_participants: 10, registered_count: 4, waitlist_enabled: false,
    booking_status: null, is_registered: false, can_register: true,
    ...zusatz,
  });
  const kacheln = () => Array.from(screen.getByTestId('kacheln').querySelectorAll('li')).map((l) => l.textContent);

  it('"Dabei" ist die Zahl des Servers, "Frei" der Rest -- auch wenn die Teilnehmerliste anders aussieht', () => {
    konfiTermine = [termin({ participants: [teilnahme(1, 'confirmed'), teilnahme(2, 'opted_out')] })];
    render(<KonfiDetail eventId={5} onBack={vi.fn()} />);
    expect(kacheln()).toEqual(['6 Frei', '2 Punkte', '4 Dabei']);
  });

  it('ein abgesagter Termin zeigt die Abgemeldeten statt freier Plaetze', () => {
    konfiTermine = [termin({ registration_status: 'cancelled', cancelled: true, abgemeldet_count: 7 })];
    render(<KonfiDetail eventId={5} onBack={vi.fn()} />);
    expect(kacheln()).toEqual(['7 Abgemeldet', '2 Punkte', '4 Dabei']);
  });
});
