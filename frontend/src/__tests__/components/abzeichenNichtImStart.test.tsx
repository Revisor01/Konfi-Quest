import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

// Startverkehr (gemessen 31.08.2026 gegen Produktion, Demo-Konfi):
// GET /konfi/badges war mit 402 ms / 13,4 kB die dickste und langsamste
// Anfrage des App-Starts — gegenueber 152 ms / 3,2 kB fuer die Startseite
// selbst. Beim Start feuert die App rund 25 Anfragen gleichzeitig; ueber
// Mobilfunk stehen die letzten in der Warteschlange des Geraets.
//
// Die Abzeichen zeigt die Startseite wirklich an (ein Kreis je Abzeichen,
// nicht nur eine Zahl) — ersatzlos streichen ginge also nicht. Stattdessen
// laeuft die Anfrage NACHGELAGERT: erst wenn die Startseite ihre eigenen
// Daten hat. Diese Tests halten genau das fest.

// --- Mocks ---

const startAntworten: Record<string, unknown> = {
  '/konfi/dashboard': {
    konfi: {
      id: 7,
      display_name: 'Emilia Test',
      jahrgang_name: '2026',
      gottesdienst_points: 3,
      gemeinde_points: 2,
    },
    total_points: 5,
    recent_badges: [],
    badge_count: 0,
    recent_events: [],
    event_count: 0,
    ranking: [],
  },
  '/konfi/profile': {},
  '/konfi/events': [],
  '/konfi/badges': { available: [], earned: [], stats: { totalVisible: 0, totalSecret: 0 } },
};

const mockApiGet = vi.fn((pfad: string) =>
  Promise.resolve({ data: startAntworten[pfad] ?? {} })
);
const mockApiPost = vi.fn().mockResolvedValue({ data: {} });
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: [string]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 7, type: 'konfi' }, setError: vi.fn() }),
}));

vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveRefresh: () => undefined,
}));

vi.mock('../../contexts/BadgeContext', () => ({
  useBadge: () => ({ refreshAllCounts: vi.fn(), newBadgesCount: 0 }),
}));

vi.mock('../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null } }),
}));

// Der Offline-Cache ist im Test leer und merkt sich nichts: So bildet der
// Testlauf den ALLERERSTEN Start ab — genau den Fall, in dem die Anfrage
// frueher im Startschwung mitlief.
vi.mock('../../services/offlineCache', () => ({
  offlineCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    isStale: () => false,
  },
  CACHE_TTL: {
    DASHBOARD: 5 * 60 * 1000,
    EVENTS: 10 * 60 * 1000,
    PROFILE: 15 * 60 * 1000,
    BADGES: 30 * 60 * 1000,
    TAGESLOSUNG: 24 * 60 * 60 * 1000,
  },
}));

vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: () => () => undefined },
}));

vi.mock('../../services/analytics', () => ({ track: vi.fn() }));

// useOfflineQuery bleibt ECHT (nur so beweist der Test den tatsaechlichen
// Datenverkehr) — die Optionen jedes Aufrufs werden aber mitgeschrieben,
// damit die Tests das Abmelden per `enabled` konkret pruefen koennen.
// Nur die Optionen, die hier geprueft werden: der Hook exportiert seinen
// Options-Typ nicht.
type OfflineQueryOptions = { ttl?: number; enabled?: boolean };
const offlineQueryAufrufe: Array<{ key: string; options?: OfflineQueryOptions }> = [];
vi.mock('../../hooks/useOfflineQuery', async () => {
  const echt = await vi.importActual<typeof import('../../hooks/useOfflineQuery')>(
    '../../hooks/useOfflineQuery'
  );
  return {
    ...echt,
    useOfflineQuery: (key: string, fetcher: () => Promise<unknown>, options?: OfflineQueryOptions) => {
      offlineQueryAufrufe.push({ key, options });
      return echt.useOfflineQuery(key, fetcher, options);
    },
  };
});
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));

// Die Ansichten interessieren hier nicht — geprueft wird der Datenverkehr.
vi.mock('../../components/konfi/views/DashboardView', () => ({ default: () => null }));
vi.mock('../../components/konfi/views/BadgesView', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/PointsHistoryModal', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/KonfispruchSelectModal', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/KonfiOnboardingModal', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/KonfiUpdateWalkthroughModal', () => ({ default: () => null }));
vi.mock('../../components/wrapped/WrappedModal', () => ({ default: () => null }));
vi.mock('../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));
vi.mock('../../components/shared', () => ({ TrialBanner: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));

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

vi.mock('@ionic/react', () => {
  const Durchreiche = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return {
    IonPage: Durchreiche,
    IonHeader: Durchreiche,
    IonToolbar: Durchreiche,
    IonTitle: Durchreiche,
    IonContent: Durchreiche,
    IonRefresher: Durchreiche,
    IonRefresherContent: Durchreiche,
    IonButtons: Durchreiche,
    IonButton: Durchreiche,
    IonIcon: () => null,
    IonSegment: Durchreiche,
    IonSegmentButton: Durchreiche,
    IonLabel: Durchreiche,
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
    useIonViewWillEnter: () => undefined,
  };
});

import KonfiDashboardPage from '../../components/konfi/pages/KonfiDashboardPage';
import KonfiBadgesPage from '../../components/konfi/pages/KonfiBadgesPage';

const abzeichenAufrufe = () =>
  mockApiGet.mock.calls.filter(([pfad]) => pfad === '/konfi/badges').length;

describe('Abzeichen liegen nicht mehr im App-Startschwung', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    offlineQueryAufrufe.length = 0;
  });

  it('die Startseite meldet die Abzeichen-Anfrage beim Start ab', () => {
    render(<KonfiDashboardPage />);

    // `enabled: false` haelt die Anfrage zurueck, solange die Startseite ihre
    // eigenen Daten noch nicht hat. Ohne dieses Abmelden liefe sie im
    // Startschwung mit — sie war dort die dickste und langsamste Anfrage.
    const abzeichenQuery = offlineQueryAufrufe.find(a => a.key === 'konfi:badges:7');
    expect(abzeichenQuery).not.toBe(undefined);
    expect(abzeichenQuery!.options?.enabled).toBe(false);
    expect(abzeichenQuery!.options?.ttl).toBe(30 * 60 * 1000);

    // Die Startseite selbst meldet sich NICHT ab — sie laedt sofort.
    const startQuery = offlineQueryAufrufe.find(a => a.key === 'konfi:dashboard:7');
    expect(startQuery).not.toBe(undefined);
    expect(startQuery!.options?.enabled).toBe(undefined);

    expect(abzeichenAufrufe()).toBe(0);
  });

  it('die Startseite holt die Abzeichen erst NACH ihren eigenen Daten nach', async () => {
    render(<KonfiDashboardPage />);

    // Erste Welle: die Startseite laedt ihre eigenen Daten. Die Abzeichen
    // sind da noch NICHT dabei — genau das ist die Aenderung.
    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/konfi/dashboard'));
    const abzeichenInDerErstenWelle = abzeichenAufrufe();

    // Zweite Welle: sobald die Startseite steht, wird genau EINMAL nachgeladen.
    await waitFor(() => expect(abzeichenAufrufe()).toBe(1));

    expect(abzeichenInDerErstenWelle).toBe(0);
    expect(abzeichenAufrufe()).toBe(1);
  });

  it('die Abzeichen-Seite ruft /konfi/badges weiterhin selbst ab', async () => {
    render(<KonfiBadgesPage />);

    await waitFor(() => expect(abzeichenAufrufe()).toBe(1));
    expect(mockApiGet).toHaveBeenCalledWith('/konfi/badges');
  });

  it('beide Seiten teilen sich denselben Cache-Schluessel', () => {
    // Der Nachlade-Umbau darf die Schluessel nicht auseinanderlaufen lassen:
    // Sonst laedt die Abzeichen-Seite beim Tab-Wechsel ein zweites Mal, statt
    // den Stand der Startseite zu uebernehmen.
    const start = lies('src/components/konfi/pages/KonfiDashboardPage.tsx');
    const seite = lies('src/components/konfi/pages/KonfiBadgesPage.tsx');
    expect(start).toContain("'konfi:badges:' + user?.id");
    expect(seite).toContain("'konfi:badges:' + user?.id");
  });
});

describe('Offline: der Cache traegt die Abzeichen weiterhin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    offlineQueryAufrufe.length = 0;
  });

  it('offline liefert die Startseite die Abzeichen aus dem Cache, ohne Netz', async () => {
    // Der kritische Fall des Umbaus: Wer die App OHNE Netz oeffnet, bekam die
    // Abzeichen frueher aus dem Startabruf. Jetzt kommen sie aus demselben
    // Cache-Schluessel wie zuvor — der Umbau verschiebt nur den ZEITPUNKT des
    // Netzabrufs, nicht die Cache-Nutzung. Beide Seiten teilen den Schluessel,
    // also faellt beim Tab-Wechsel offline nichts weg.
    const { offlineCache } = await import('../../services/offlineCache');
    const { networkMonitor } = await import('../../services/networkMonitor');
    (networkMonitor as { isOnline: boolean }).isOnline = false;
    const gecacht: Record<string, unknown> = {
      'konfi:dashboard:7': startAntworten['/konfi/dashboard'],
      'konfi:badges:7': { available: [], earned: [], stats: { totalVisible: 4, totalSecret: 1 } },
    };
    vi.mocked(offlineCache.get).mockImplementation(async (key: string) =>
      gecacht[key] ? { data: gecacht[key] } : null
    );

    render(<KonfiDashboardPage />);

    // Die Abzeichen kommen aus dem Cache ...
    await waitFor(() => {
      expect(vi.mocked(offlineCache.get).mock.calls.map(([k]) => k)).toContain('konfi:badges:7');
    });
    // ... und es geht dabei KEINE Netzanfrage raus.
    expect(abzeichenAufrufe()).toBe(0);

    (networkMonitor as { isOnline: boolean }).isOnline = true;
  });
});

describe('Der Zaehler an der Reiterleiste haengt nicht an /konfi/badges', () => {
  it('MainTabs bezieht ihn aus dem BadgeContext, nicht aus der Abzeichen-Route', () => {
    const mainTabs = lies('src/components/layout/MainTabs.tsx');
    const badgeContext = lies('src/contexts/BadgeContext.tsx');

    // Der Zaehler kommt aus dem Context ...
    expect(mainTabs).toContain('newBadgesCount } = useBadge()');
    // ... und der Context holt ihn aus dem leichten Zaehler-Endpunkt.
    expect(badgeContext).toContain('/notifications/badge-counts');
    // Weder MainTabs noch der Context rufen die schwere Abzeichen-Route.
    expect(mainTabs).not.toContain("api.get('/konfi/badges')");
    expect(badgeContext).not.toContain("api.get('/konfi/badges')");
  });
});
