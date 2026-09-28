import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// Der Rückblick-Hinweis auf der Teamer-Startseite lässt sich PRO AUSGABE
// wegklicken (28.09.2026, Screens Konfi/Teamer BF-07).
//
// Die Seite merkt sich das Wegklicken unter
// `wrapped_hinweis_t_<user>_<wrapped_ausgabe_id>`. GET /teamer/dashboard
// lieferte die Id bis zum 28.09.2026 nie -- der Schlüssel endete immer auf
// `_alt`, und wer den Hinweis einmal wegklickte, sah den nächsten
// Team-Rückblick auf der Startseite nie. Das Backend liefert die Id jetzt
// (teamerDashboardRueckblick.test.js); dieser Test hält fest, dass die Seite
// sie so verwendet: weggeklickt gilt nur für DIESE Ausgabe.

const USER_ID = 3;
const HINWEIS = 'Dein Team-Jahr Wrapped ist da!';

const speicher = new Map<string, string>();
const prefSet = vi.fn(async ({ key, value }: { key: string; value: string }) => { speicher.set(key, value); });
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: speicher.get(key) ?? null })),
    set: (arg: { key: string; value: string }) => prefSet(arg),
  },
}));

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(async () => ({ data: {} })) },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: USER_ID, type: 'teamer' }, setError: vi.fn() }),
}));

vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveRefresh: vi.fn(),
}));

// Je Ausgabe EIN festes Objekt: Die Seite haengt Effekte an die
// Dashboard-Daten; ein bei jedem Rendern neues Objekt liesse sie endlos laufen.
const dashboardJeAusgabe = new Map<number, object>();
const dashboardFuer = (ausgabeId: number) => {
  if (!dashboardJeAusgabe.has(ausgabeId)) {
    dashboardJeAusgabe.set(ausgabeId, {
      greeting: { display_name: 'Test Teamer', hour: 9 },
      certificates: [],
      events: [],
      badges: { recent: [], earned_count: 0, total_count: 0 },
      config: { show_challenges: false, show_losung: false },
      has_wrapped: true,
      wrapped_ausgabe_id: ausgabeId,
      wrapped_titel: 'Team-Rückblick 2026',
      konfspruch: null,
    });
  }
  return dashboardJeAusgabe.get(ausgabeId);
};
const leer = { data: null, loading: false, error: null, refresh: vi.fn(), refreshLive: vi.fn() };
const offlineAntwort = new Map<number, object>();

let wrappedAusgabeId = 7;
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (key: string) => {
    if (key.startsWith('teamer:dashboard:')) {
      if (!offlineAntwort.has(wrappedAusgabeId)) {
        offlineAntwort.set(wrappedAusgabeId, {
          data: dashboardFuer(wrappedAusgabeId),
          loading: false, error: null, refresh: vi.fn(), refreshLive: vi.fn(),
        });
      }
      return offlineAntwort.get(wrappedAusgabeId);
    }
    return leer;
  },
}));

vi.mock('../../services/offlineCache', () => ({
  CACHE_TTL: { DASHBOARD: 1, BADGES: 1, TAGESLOSUNG: 1 },
}));

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

beforeEach(() => {
  cleanup();
  speicher.clear();
  prefSet.mockClear();
  wrappedAusgabeId = 7;
});

describe('Teamer-Startseite: Rückblick-Hinweis je Ausgabe', () => {
  it('Wegklicken merkt sich genau diese Ausgabe', async () => {
    render(<TeamerDashboardPage />);
    await screen.findByText(HINWEIS);

    fireEvent.click(screen.getByLabelText('Hinweis ausblenden'));

    await waitFor(() => expect(screen.queryByText(HINWEIS)).toBeNull());
    expect(prefSet).toHaveBeenCalledWith({ key: `wrapped_hinweis_t_${USER_ID}_7`, value: '1' });
  });

  it('eine weggeklickte Ausgabe bleibt weg', async () => {
    speicher.set(`wrapped_hinweis_t_${USER_ID}_7`, '1');

    render(<TeamerDashboardPage />);

    await waitFor(() => expect(screen.queryByText(HINWEIS)).toBeNull());
  });

  it('die nächste Ausgabe meldet sich wieder, auch wenn die vorige weggeklickt ist', async () => {
    speicher.set(`wrapped_hinweis_t_${USER_ID}_7`, '1');
    // So steht es heute auf den Geräten: ohne Id vom Server weggeklickt.
    speicher.set(`wrapped_hinweis_t_${USER_ID}_alt`, '1');
    wrappedAusgabeId = 8;

    render(<TeamerDashboardPage />);

    // Kurz warten, bis der Merker gelesen ist -- der Hinweis muss danach
    // noch stehen.
    await waitFor(() => expect(speicher.has(`wrapped_hinweis_t_${USER_ID}_8`)).toBe(false));
    expect(await screen.findByText(HINWEIS)).toBeTruthy();
  });
});
