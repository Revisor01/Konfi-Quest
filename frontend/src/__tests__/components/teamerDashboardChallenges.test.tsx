import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';

// Drei-Ansichten-Befund M8 (26.08.2026): Die Challenges-Teaser-Karte auf der
// Teamer-Startseite lud die Verwaltungsliste GET /challenges/admin. Die
// enthält auch reine Konfi-Challenges (audience='konfis'), an denen Teamer
// nicht teilnehmen dürfen — sie standen trotzdem als "DEINE CHALLENGE" auf
// der Startkarte. Diese Tests sichern ab, dass die Karte stattdessen den
// Teilnehmer-Endpunkt GET /challenges/konfi nutzt (der serverseitig nach
// audience filtert: 'nur_team' org-weit, 'konfis_und_team' je Jahrgang)
// und dessen active-Liste anzeigt.

const inZweiTagen = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

// --- Mocks ---

const mockApiGet = vi.fn((url: string) => {
  if (url === '/challenges/konfi') {
    // Teilnehmer-Endpunkt: serverseitig bereits nach audience gefiltert —
    // die reine Konfi-Challenge kommt hier gar nicht erst an.
    return Promise.resolve({
      data: {
        active: [
          { id: 41, title: 'Team-Foto-Challenge', ends_at: inZweiTagen, challenge_type: 'beitrag' }
        ],
        archive: [],
        marks: []
      }
    });
  }
  if (url === '/challenges/admin') {
    // Verwaltungsliste: enthält AUCH die reine Konfi-Challenge. Würde die
    // Karte wieder hierüber laden, stünde "Nur-Konfi-Challenge" im Teaser.
    return Promise.resolve({
      data: [
        { id: 41, title: 'Team-Foto-Challenge', status: 'active', ends_at: inZweiTagen, audience: 'konfis_und_team', challenge_type: 'beitrag' },
        { id: 42, title: 'Nur-Konfi-Challenge', status: 'active', ends_at: inZweiTagen, audience: 'konfis', challenge_type: 'beitrag' }
      ]
    });
  }
  return Promise.resolve({ data: {} });
});
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...(args as [string])),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 3, type: 'teamer' }, setError: vi.fn() }),
}));

vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveRefresh: vi.fn(),
}));

// Dashboard-Daten kommen über useOfflineQuery — steuerbar mocken.
// TeamerDashboardPage exportiert seinen DashboardData-Typ nicht; hier steht
// der Ausschnitt, den die Seite in diesen Tests liest.
interface TestDashboardData {
  greeting: { display_name: string; hour: number };
  certificates: unknown[];
  events: unknown[];
  badges: { recent: unknown[]; earned_count: number; total_count: number };
  config: { show_challenges: boolean; show_losung: boolean };
  has_wrapped: boolean;
  konfspruch: null;
}

const dashboardData: TestDashboardData = {
  greeting: { display_name: 'Test Teamer', hour: 9 },
  certificates: [],
  events: [],
  badges: { recent: [], earned_count: 0, total_count: 0 },
  config: { show_challenges: true, show_losung: false },
  has_wrapped: false,
  konfspruch: null,
};
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (key: string) => {
    if (key.startsWith('teamer:dashboard:')) {
      return { data: dashboardData, loading: false, error: null, refresh: vi.fn(), refreshLive: vi.fn() };
    }
    return { data: null, loading: false, error: null, refresh: vi.fn(), refreshLive: vi.fn() };
  },
}));

vi.mock('../../services/offlineCache', () => ({
  CACHE_TTL: { DASHBOARD: 1, BADGES: 1, TAGESLOSUNG: 1 },
}));

// Schwere Kinder wegmocken — hier interessiert nur die Challenges-Karte.
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/wrapped/WrappedModal', () => ({ default: () => null }));
vi.mock('../../components/shared', () => ({
  ProfileHeaderButton: () => null,
  TrialBanner: () => null,
}));
vi.mock('../../components/shared/BibleTranslationModal', () => ({
  default: () => null,
  getTranslationName: (code: string) => code,
}));
vi.mock('../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/KonfispruchSelectModal', () => ({ default: () => null }));
vi.mock('../../components/teamer/modals/TeamerOnboardingModal', () => ({ default: () => null }));
vi.mock('../../components/teamer/modals/TeamerUpdateWalkthroughModal', () => ({ default: () => null }));
vi.mock('../../hooks/useOnboardingOnce', () => ({
  useOnboardingWithUpdateOnce: () => ({
    showOnboarding: false,
    closeOnboarding: vi.fn(),
    showUpdateHinweis: false,
    markUpdateHinweisGesehen: vi.fn(),
    showMitmachenHinweis: false,
    markMitmachenHinweisGesehen: vi.fn(),
  }),
}));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../utils/badgeIcons', () => ({ getIconFromString: () => 'icon' }));

vi.mock('@ionic/react', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    IonPage: passthrough,
    IonHeader: passthrough,
    IonToolbar: passthrough,
    IonTitle: passthrough,
    IonContent: passthrough,
    IonIcon: () => null,
    IonRefresher: () => null,
    IonRefresherContent: () => null,
    useIonPopover: () => [vi.fn(), vi.fn()],
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

import TeamerDashboardPage from '../../components/teamer/pages/TeamerDashboardPage';

describe('Teamer-Dashboard: Challenges-Teaser über den Teilnehmer-Endpunkt', () => {
  beforeEach(() => {
    mockApiGet.mockClear();
  });

  it('lädt die Karte über GET /challenges/konfi und zeigt dessen active-Liste', async () => {
    const { findByText } = render(<TeamerDashboardPage />);

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/challenges/konfi'));
    expect(await findByText('Team-Foto-Challenge')).toBeTruthy();
  });

  it('ruft die Verwaltungsliste GET /challenges/admin NICHT auf — keine reinen Konfi-Challenges im Teaser', async () => {
    const { queryByText } = render(<TeamerDashboardPage />);

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/challenges/konfi'));
    expect(mockApiGet).not.toHaveBeenCalledWith('/challenges/admin');
    expect(queryByText('Nur-Konfi-Challenge')).toBe(null);
  });
});
