import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';

// --- Mocks ---

const mockApiGet = vi.fn().mockResolvedValue({ data: {} });
const mockApiPost = vi.fn().mockResolvedValue({});
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
  },
}));

vi.mock('../../services/writeQueue', () => ({
  writeQueue: { enqueue: vi.fn() },
}));

vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: vi.fn(() => () => {}) },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 1, type: 'konfi' }, setError: vi.fn() }),
}));

// Seit der Zaehler-Konsolidierung (27.08.2026) stoesst die Seite nach
// mark-seen refreshAllCounts() an -- vorher fehlte jede Aktualisierung und der
// Zaehler blieb die ganze Sitzung stehen (Befund B1, kaputt seit 03.07.2026).
vi.mock('../../contexts/BadgeContext', () => ({
  useBadge: () => ({ refreshAllCounts: vi.fn() }),
}));

vi.mock('../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));

vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveRefresh: vi.fn(),
}));

// useOfflineQuery steuerbar mocken: badgeData wird pro Render von außen gesetzt
let currentBadgeData: any = null;
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (key: string) => {
    if (key.startsWith('konfi:badges')) {
      return { data: currentBadgeData, loading: false, refresh: vi.fn() };
    }
    return { data: { gottesdienst_points: 0, gemeinde_points: 0 }, loading: false, refresh: vi.fn() };
  },
}));

// Schwere Kinder wegmocken — hier interessiert nur der mark-seen-Effekt
vi.mock('../../components/konfi/views/BadgesView', () => ({
  default: () => null,
}));
vi.mock('../../components/common/LoadingSpinner', () => ({
  default: () => null,
}));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

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
  };
});

import KonfiBadgesPage from '../../components/konfi/pages/KonfiBadgesPage';

const badgeDataMit = (unseenIds: number[]) => ({
  earned: unseenIds.map(id => ({ id, seen: false })).concat([{ id: 99, seen: true } as any]),
  available: [],
  stats: { totalVisible: 1, totalSecret: 0 },
});

describe('KonfiBadgesPage: mark-seen Dedupe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentBadgeData = null;
  });

  // Verbotener Fall (gemessen 24.08.2026): badgeData kommt beim Öffnen
  // zweimal an (Cache, dann Netz-Revalidierung) mit identischen unseen-Badges
  // -> es gingen ZWEI POST /konfi/badges/mark-seen raus.
  it('identische unseen-Badges in zwei badgeData-Updates -> genau EIN mark-seen', async () => {
    currentBadgeData = badgeDataMit([1, 2]);
    const { rerender } = render(<KonfiBadgesPage />);

    await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(1));
    expect(mockApiPost).toHaveBeenCalledWith('/konfi/badges/mark-seen');

    // Zweites Update: NEUES Objekt, gleiche unseen-IDs (Netz-Revalidierung)
    currentBadgeData = badgeDataMit([1, 2]);
    rerender(<KonfiBadgesPage />);

    await new Promise(r => setTimeout(r, 50));
    expect(mockApiPost).toHaveBeenCalledTimes(1);
  });

  // Erlaubter Fall: kommen NEUE ungesehene Badges dazu, wird erneut markiert.
  it('neue unseen-Badges -> erneutes mark-seen', async () => {
    currentBadgeData = badgeDataMit([1]);
    const { rerender } = render(<KonfiBadgesPage />);

    await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(1));

    currentBadgeData = badgeDataMit([1, 3]);
    rerender(<KonfiBadgesPage />);

    await waitFor(() => expect(mockApiPost).toHaveBeenCalledTimes(2));
  });

  it('ohne unseen-Badges kein mark-seen', async () => {
    currentBadgeData = { earned: [{ id: 1, seen: true }], available: [], stats: { totalVisible: 1, totalSecret: 0 } };
    render(<KonfiBadgesPage />);

    await new Promise(r => setTimeout(r, 50));
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});
