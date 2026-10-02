import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';

// Die Begrüßung auf der Teamer-Startseite würfelte bei JEDEM Rendern neu
// (Math.random() im Render, Release-Audit 26.09.2026, Toolchain BF-12): mit
// 20 % „Moin, …", sonst nach Tageszeit. Jedes Neuzeichnen der Seite —
// Nachladen, Pull-to-Refresh, eine Live-Aktualisierung — konnte die
// Begrüßung umspringen lassen. Gewürfelt wird jetzt einmal beim Öffnen.

const mockApiGet = vi.fn((url: string) => {
  if (url === '/challenges/konfi') {
    return Promise.resolve({ data: { active: [], archive: [], marks: [] } });
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

const dashboardData: { greeting: { display_name: string; hour: number; role_title?: string | null } } & Record<string, unknown> = {
  greeting: { display_name: 'Test Teamer', hour: 9 },
  certificates: [],
  events: [],
  badges: { recent: [], earned_count: 0, total_count: 0 },
  config: { show_challenges: false, show_losung: false },
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

// Schwere Kinder wegmocken — hier interessiert nur die Begrüßung.
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/wrapped/WrappedModal', () => ({ default: () => null }));
vi.mock('../../components/shared', () => ({
  ProfileHeaderButton: () => null,
  TrialBanner: () => null,
  StoreUpdateBanner: () => null,
}));
vi.mock('../../components/shared/BibleTranslationModal', () => ({
  default: () => null,
  getTranslationName: (code: string) => code,
}));
vi.mock('../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/KonfispruchSelectModal', () => ({ default: () => null }));
vi.mock('../../components/teamer/modals/TeamerOnboardingModal', () => ({ default: () => null }));
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
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: () => null,
  AppKopfzeileGross: () => null,
}));

vi.mock('@ionic/react', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    IonPage: passthrough,
    IonHeader: passthrough,
    IonToolbar: passthrough,
    IonTitle: passthrough,
    IonContent: passthrough,
    IonButton: passthrough,
    IonIcon: () => null,
    IonRefresher: () => null,
    IonRefresherContent: () => null,
    useIonPopover: () => [vi.fn(), vi.fn()],
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

import TeamerDashboardPage from '../../components/teamer/pages/TeamerDashboardPage';

const begruessung = (container: HTMLElement) =>
  container.querySelector('.app-dashboard-greeting')?.textContent;

describe('Teamer-Startseite: Begrüßung springt beim Neuzeichnen nicht um', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('bleibt „Moin", auch wenn der Zufall beim nächsten Rendern anders fiele', async () => {
    const zufall = vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const { container, rerender } = render(<TeamerDashboardPage />);
    await waitFor(() => expect(begruessung(container)).toBe('Moin, Test!'));

    zufall.mockReturnValue(0.9);
    rerender(<TeamerDashboardPage />);
    rerender(<TeamerDashboardPage />);

    expect(begruessung(container)).toBe('Moin, Test!');
  });

  it('bleibt bei der Tageszeit, auch wenn der Zufall beim nächsten Rendern „Moin" ergäbe', async () => {
    const zufall = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const { container, rerender } = render(<TeamerDashboardPage />);
    await waitFor(() => expect(begruessung(container)).toMatch(/^Gut(en|e) \w+, Test!$/));
    const vorher = begruessung(container);

    zufall.mockReturnValue(0.1);
    rerender(<TeamerDashboardPage />);

    expect(begruessung(container)).toBe(vorher);
  });
});

// Rückmeldung des lokalen Agenten (01.10.2026), Simon: angleichen. Unter dem
// Gruß stand fest „Teamer:in", im Profil die selbst gewählte Bezeichnung
// (role_title). Jetzt an beiden Stellen dieselbe Regel
// (utils/rollenNamen.selbstbezeichnung): eigene Bezeichnung, sonst
// „Teamer:in". Der Server liefert sie in greeting.role_title mit (additiv).
describe('Teamer-Startseite: unter dem Gruß die eigene Bezeichnung', () => {
  const unterzeile = (container: HTMLElement) =>
    container.querySelector('.app-dashboard-subtitle')?.textContent;

  afterEach(() => {
    delete dashboardData.greeting.role_title;
  });

  it('zeigt die eigene Bezeichnung', async () => {
    dashboardData.greeting.role_title = 'Jugendmitarbeiter';
    const { container } = render(<TeamerDashboardPage />);
    await waitFor(() => expect(unterzeile(container)).toBe('Jugendmitarbeiter'));
  });

  it('ohne Bezeichnung, nur aus Leerzeichen oder von einem älteren Server: „Teamer:in"', async () => {
    for (const wert of [null, '   ', undefined]) {
      if (wert === undefined) delete dashboardData.greeting.role_title;
      else dashboardData.greeting.role_title = wert;
      const { container, unmount } = render(<TeamerDashboardPage />);
      await waitFor(() => expect(unterzeile(container)).toBe('Teamer:in'));
      unmount();
    }
  });
});
