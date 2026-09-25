import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { QueueItem, FailedAction } from '../../services/writeQueue';
import type { PostfachAntwort, PostfachEintrag } from '../../utils/postfach';

// Das Postfach (25.09.2026): zwei Bereiche -- die Offline-Warteschlange und
// die empfangenen Mitteilungen aus GET /notifications/postfach. Antippen
// markiert als gelesen und fuehrt zum Ziel, ueber denselben Weg wie ein
// angetippter Push (utils/pushNavigation).

type StubProps = { children?: ReactNode };

vi.mock('@ionic/react', () => ({
  IonModal: (props: StubProps & { isOpen?: boolean }) =>
    (props.isOpen ? <div data-testid="modal">{props.children}</div> : null),
  IonHeader: (props: StubProps) => <div>{props.children}</div>,
  IonToolbar: (props: StubProps) => <div>{props.children}</div>,
  IonTitle: (props: StubProps) => <div>{props.children}</div>,
  IonButtons: (props: StubProps) => <div>{props.children}</div>,
  IonButton: (props: StubProps & { onClick?: () => void; disabled?: boolean }) =>
    <button type="button" onClick={props.onClick} disabled={props.disabled}>{props.children}</button>,
  IonContent: (props: StubProps) => <div>{props.children}</div>,
  IonList: (props: StubProps) => <div>{props.children}</div>,
  IonListHeader: (props: StubProps) => <div>{props.children}</div>,
  IonItem: (props: StubProps & { onClick?: () => void; className?: string; 'data-ungelesen'?: string }) => (
    <div role="button" onClick={props.onClick} className={props.className} data-ungelesen={props['data-ungelesen']}>
      {props.children}
    </div>
  ),
  IonLabel: (props: StubProps) => <div>{props.children}</div>,
  IonSpinner: () => <span data-testid="spinner" />,
  IonCard: (props: StubProps) => <div>{props.children}</div>,
  IonCardContent: (props: StubProps) => <div>{props.children}</div>,
  IonIcon: (props: { icon?: string }) => <span data-testid="icon" data-icon={props.icon} />,
}));

const mockGet = vi.fn();
const mockPut = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (...a: unknown[]) => mockGet(...a), put: (...a: unknown[]) => mockPut(...a) },
}));

const mockSwitchOrg = vi.fn();
let mockOrganizations: Array<{ id: number; name: string; role_name: string }> = [];
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 7, type: 'konfi', organization_id: 1 },
    activeOrgId: null,
    organizations: mockOrganizations,
    switchOrg: mockSwitchOrg,
  }),
}));

const mockRefresh = vi.fn();
vi.mock('../../contexts/BadgeContext', () => ({
  useBadge: () => ({ postfachUngelesen: 0, refreshAllCounts: mockRefresh }),
}));

let mockWartend: QueueItem[] = [];
let mockGescheitert: FailedAction[] = [];
vi.mock('../../hooks/useWartendeVorgaenge', () => ({
  useWartendeVorgaenge: () => ({
    wartend: mockWartend,
    gescheitert: mockGescheitert,
    vergessen: vi.fn(),
    alleVergessen: vi.fn(),
  }),
}));

vi.mock('../../utils/pushNavigation', async (original) => {
  const echt = await original<typeof import('../../utils/pushNavigation')>();
  return { ...echt, pushZielMelden: vi.fn() };
});

import PostfachModal, { POSTFACH_SEITENGROESSE } from '../../components/common/PostfachModal';
import { oeffnePostfach } from '../../utils/postfach';
import { pushZielMelden } from '../../utils/pushNavigation';

const eintrag = (id: number, teil: Partial<PostfachEintrag> = {}): PostfachEintrag => ({
  id,
  title: `Mitteilung ${id}`,
  message: `Text ${id}`,
  type: 'badge_earned',
  data: { badge_id: id },
  read_at: null,
  created_at: '2026-09-25T08:00:00.000Z',
  organization_id: 1,
  organization_name: 'Test-Gemeinde',
  ...teil,
});

const antwort = (eintraege: PostfachEintrag[], weitere = false): { data: PostfachAntwort } => ({
  data: { eintraege, ungelesen: eintraege.filter(e => !e.read_at).length, weitere },
});

const oeffnen = async () => {
  await act(async () => { oeffnePostfach(); });
  await screen.findByTestId('modal');
};

describe('PostfachModal', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPut.mockReset().mockResolvedValue({ data: { success: true } });
    mockSwitchOrg.mockReset().mockResolvedValue({ ok: true, type: 'konfi' });
    mockRefresh.mockReset().mockResolvedValue(undefined);
    vi.mocked(pushZielMelden).mockReset();
    mockWartend = [];
    mockGescheitert = [];
    mockOrganizations = [{ id: 1, name: 'Test-Gemeinde', role_name: 'konfi' }];
  });

  it('ist zu, bis jemand die Glocke tippt -- und laedt erst dann', async () => {
    mockGet.mockResolvedValue(antwort([]));
    render(<PostfachModal />);
    expect(screen.queryByTestId('modal')).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();

    await oeffnen();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/notifications/postfach', { params: { limit: POSTFACH_SEITENGROESSE } });
  });

  it('zeigt beide Bereiche: Warteschlange und Mitteilungen', async () => {
    mockWartend = [{
      id: 'q1', method: 'POST', url: '/x', maxRetries: 3, retryCount: 0, createdAt: 0, hasFileUpload: false,
      metadata: { type: 'konfi', clientId: 'q1', label: 'Aktivität melden: Gottesdienst' },
    }];
    mockGet.mockResolvedValue(antwort([eintrag(12), eintrag(11, { read_at: '2026-09-24T10:00:00.000Z' })]));
    render(<PostfachModal />);
    await oeffnen();

    expect(screen.getByTestId('postfach-warteschlange')).toBeTruthy();
    expect(screen.getByText('Aktivität melden: Gottesdienst')).toBeTruthy();
    expect(await screen.findByText('Mitteilung 12')).toBeTruthy();
    expect(screen.getByText('Mitteilung 11')).toBeTruthy();
  });

  it('ohne Warteschlange fehlt der Bereich -- kein leerer Kasten', async () => {
    mockGet.mockResolvedValue(antwort([eintrag(1)]));
    render(<PostfachModal />);
    await oeffnen();
    await screen.findByText('Mitteilung 1');
    expect(screen.queryByTestId('postfach-warteschlange')).toBeNull();
  });

  it('ungelesene Mitteilungen sind erkennbar, gelesene nicht', async () => {
    mockGet.mockResolvedValue(antwort([eintrag(12), eintrag(11, { read_at: '2026-09-24T10:00:00.000Z' })]));
    const { container } = render(<PostfachModal />);
    await oeffnen();
    await screen.findByText('Mitteilung 12');

    const zeilen = container.querySelectorAll('.app-postfach-eintrag');
    expect(zeilen.length).toBe(2);
    expect(container.querySelectorAll('.app-postfach-eintrag--ungelesen').length).toBe(1);
    expect(zeilen[0].getAttribute('data-ungelesen')).toBe('true');
    expect(zeilen[1].getAttribute('data-ungelesen')).toBe('false');
  });

  it('Antippen markiert als gelesen und fuehrt zum Ziel der Rolle', async () => {
    mockGet.mockResolvedValue(antwort([eintrag(12)]));
    render(<PostfachModal />);
    await oeffnen();
    fireEvent.click(await screen.findByText('Mitteilung 12'));

    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/notifications/postfach/12/gelesen'));
    await waitFor(() => expect(pushZielMelden).toHaveBeenCalledWith('/konfi/badges'));
    // Kein Gemeinde-Wechsel: Mitteilung und Konto gehoeren zu Gemeinde 1.
    expect(mockSwitchOrg).not.toHaveBeenCalled();
    // Danach ist das Postfach zu.
    await waitFor(() => expect(screen.queryByTestId('modal')).toBeNull());
  });

  it('eine bereits gelesene Mitteilung wird nicht noch einmal gemeldet, fuehrt aber zum Ziel', async () => {
    mockGet.mockResolvedValue(antwort([eintrag(5, { type: 'activity_request_decision', read_at: '2026-09-24T10:00:00.000Z' })]));
    render(<PostfachModal />);
    await oeffnen();
    fireEvent.click(await screen.findByText('Mitteilung 5'));

    await waitFor(() => expect(pushZielMelden).toHaveBeenCalledWith('/konfi/requests'));
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('eine Mitteilung aus einer anderen Gemeinde wechselt erst dorthin -- wie ein Push', async () => {
    mockOrganizations = [
      { id: 1, name: 'Test-Gemeinde', role_name: 'konfi' },
      { id: 2, name: 'Andere Gemeinde', role_name: 'teamer' },
    ];
    mockSwitchOrg.mockResolvedValue({ ok: true, type: 'teamer' });
    mockGet.mockResolvedValue(antwort([eintrag(20, { organization_id: 2, organization_name: 'Andere Gemeinde' })]));
    render(<PostfachModal />);
    await oeffnen();
    // Bei mehreren Gemeinden steht der Name an der Mitteilung.
    expect(await screen.findByText(/Andere Gemeinde/)).toBeTruthy();

    fireEvent.click(screen.getByText('Mitteilung 20'));
    await waitFor(() => expect(mockSwitchOrg).toHaveBeenCalledWith(2));
    // Die Route wird mit der Rolle in der ZIEL-Gemeinde gebaut.
    await waitFor(() => expect(pushZielMelden).toHaveBeenCalledWith('/teamer/badges'));
  });

  it('bei nur einer Gemeinde steht kein Gemeindename an der Mitteilung', async () => {
    mockGet.mockResolvedValue(antwort([eintrag(1)]));
    render(<PostfachModal />);
    await oeffnen();
    await screen.findByText('Mitteilung 1');
    expect(screen.queryByText(/Test-Gemeinde/)).toBeNull();
  });

  it('"Alle gelesen" meldet einmal an den Server und laesst die Zaehler nachladen', async () => {
    mockGet.mockResolvedValue(antwort([eintrag(1), eintrag(2)]));
    const { container } = render(<PostfachModal />);
    await oeffnen();
    await screen.findByText('Mitteilung 1');
    expect(container.querySelectorAll('.app-postfach-eintrag--ungelesen').length).toBe(2);

    fireEvent.click(screen.getByText('Alle gelesen'));
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/notifications/postfach/gelesen'));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(container.querySelectorAll('.app-postfach-eintrag--ungelesen').length).toBe(0);
    // Ohne Ungelesene verschwindet der Knopf.
    expect(screen.queryByText('Alle gelesen')).toBeNull();
  });

  it('"Ältere laden" fragt mit der kleinsten bekannten Kennung als Cursor nach', async () => {
    mockGet
      .mockResolvedValueOnce(antwort([eintrag(30), eintrag(29)], true))
      .mockResolvedValueOnce(antwort([eintrag(28)], false));
    render(<PostfachModal />);
    await oeffnen();
    await screen.findByText('Mitteilung 29');

    fireEvent.click(screen.getByText('Ältere Mitteilungen laden'));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(mockGet).toHaveBeenLastCalledWith('/notifications/postfach', { params: { limit: POSTFACH_SEITENGROESSE, vor: 29 } });
    expect(await screen.findByText('Mitteilung 28')).toBeTruthy();
    // Die ersten bleiben stehen -- es wird angehaengt, nicht ersetzt.
    expect(screen.getByText('Mitteilung 30')).toBeTruthy();
    // Nichts Aelteres mehr: Knopf weg.
    await waitFor(() => expect(screen.queryByText('Ältere Mitteilungen laden')).toBeNull());
  });

  it('ohne Mitteilungen steht ein Leerzustand, kein leerer Kasten', async () => {
    mockGet.mockResolvedValue(antwort([]));
    render(<PostfachModal />);
    await oeffnen();
    expect(await screen.findByText('Nichts Neues')).toBeTruthy();
  });

  it('offline sagt die Liste, was fehlt -- die Warteschlange bleibt sichtbar', async () => {
    mockGescheitert = [{
      id: 'f1', label: 'Abmeldung Sommerfest', type: 'opt-out', createdAt: 0, failedAt: 0,
      error: { status: 409, message: 'Konflikt' },
    }];
    mockGet.mockRejectedValue(new Error('Network Error'));
    render(<PostfachModal />);
    await oeffnen();
    expect(await screen.findByText(/Deine Mitteilungen/)).toBeTruthy();
    expect(screen.getByText('Abmeldung Sommerfest')).toBeTruthy();
  });
});
