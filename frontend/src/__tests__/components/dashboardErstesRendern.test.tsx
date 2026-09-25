import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';

// DIE STARTSEITE DARF IHRE IonPage NICHT AUSTAUSCHEN (16.09.2026)
//
// Simons Befund an Build 198 auf dem echten Geraet: "app startet bei teamer
// und konfi auf weiss", "wegnavigieren zurück auf dashboard klicken alles da",
// "nur dashboard beim start. danach ist es gut. tabs sind da."
//
// Die Ursache liegt nicht in den Daten, sondern im DOM. Ionic haengt jeder
// frisch erzeugten IonPage innerhalb eines Router-Outlets synchron die Klasse
// `ion-page-invisible` an (@ionic/react, IonPage.stableMergedRefs). Abgenommen
// wird sie ausschliesslich vom Seiten-UEBERGANG des Outlets.
//
// Beide Startseiten stiegen bei `loading` frueh mit `<LoadingSpinner
// fullScreen />` aus -- einer EIGENEN IonPage. Damit wechselte die Wurzel der
// Seite den Komponententyp, sobald die Daten da waren. React kann ein
// DOM-Element bei einem Typwechsel nicht wiederverwenden: Es verwirft das alte
// und baut ein neues -- das prompt wieder `ion-page-invisible` bekommt. Ein
// zweiter Uebergang laeuft aber nicht, weil sich die Route nicht geaendert
// hat. Die Seite bleibt unsichtbar, waehrend die Tab-Leiste (ausserhalb des
// Outlets) stehen bleibt: weiss.
//
// Deshalb pruefen diese Tests zweierlei, und zwar BEIM ERSTEN Aufbau, nicht
// erst beim zweiten Betreten:
//   1. Die Seite zeigt nach dem ersten Laden wirklich Inhalt.
//   2. Das Wurzel-Element ist VOR und NACH dem Umschlag DASSELBE DOM-Element.
// Punkt 2 ist der eigentliche Waechter -- Punkt 1 allein war auch vorher gruen.

// --- Gemeinsame Mocks: echter useOfflineQuery, echter Kaltstart ---
// Kein Zwischenspeicher, online. Genau die Lage beim allerersten Start.
vi.mock('../../services/offlineCache', () => ({
  CACHE_TTL: { DASHBOARD: 1000, BADGES: 1000, TAGESLOSUNG: 1000, PROFILE: 1000, EVENTS: 1000 },
  offlineCache: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    isStale: () => false,
  },
}));
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: () => () => undefined },
}));

const teamerDashboard = {
  greeting: { display_name: 'Test Teamer', hour: 9 },
  certificates: [],
  events: [],
  badges: { recent: [], earned_count: 0, total_count: 0 },
  config: { show_challenges: false, show_losung: false },
  has_wrapped: false,
  konfspruch: null,
};

const konfiDashboard = {
  greeting: { display_name: 'Test Konfi', hour: 9 },
  point_config: { target_gottesdienst: 10, target_gemeinde: 10 },
  dashboard_config: { show_events: false, show_losung: false, show_badges: false, show_ranking: false, show_challenges: false, show_konfirmation: false },
  has_wrapped: false,
  total_points: 0,
  gottesdienst_points: 0,
  gemeinde_points: 0,
  ranking: [],
  badges: { recent: [], earned_count: 0, total_count: 0 },
};

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(async (url: string) => {
      if (url === '/teamer/dashboard') return { data: teamerDashboard };
      if (url === '/teamer/badges') return { data: { available: [], earned: [], stats: {} } };
      if (url === '/konfi/dashboard') return { data: konfiDashboard };
      if (url === '/konfi/profile') return { data: { konfspruch: null } };
      if (url === '/konfi/events') return { data: [] };
      if (url === '/konfi/badges/v2') return { data: { available: [], earned: [], stats: {} } };
      return { data: {} };
    }),
  },
}));

vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: vi.fn() }));
vi.mock('../../components/wrapped/WrappedModal', () => ({ default: () => null }));
vi.mock('../../components/shared/BibleTranslationModal', () => ({
  default: () => null,
  getTranslationName: (c: string) => c,
}));
vi.mock('../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));
vi.mock('../../components/teamer/modals/TeamerOnboardingModal', () => ({ default: () => null }));
vi.mock('../../components/teamer/modals/TeamerUpdate220WalkthroughModal', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/KonfiOnboardingModal', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/KonfispruchSelectModal', () => ({ default: () => null }));
vi.mock('../../hooks/useOnboardingOnce', () => ({
  useOnboardingWithUpdateOnce: () => ({
    showOnboarding: false, closeOnboarding: vi.fn(),
    showUpdateHinweis: false, markUpdateHinweisGesehen: vi.fn(),
    showMitmachenHinweis: false, markMitmachenHinweisGesehen: vi.fn(),
  }),
  useOnboardingOnce: () => ({ showOnboarding: false, closeOnboarding: vi.fn() }),
}));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../utils/badgeIcons', () => ({ getIconFromString: () => 'icon' }));

// IonPage als echtes DOM-Element mit weitergereichter ref: nur so laesst sich
// pruefen, ob React dasselbe Element behaelt oder ein neues baut.
const gesehenePages: HTMLElement[] = [];
// Die gemeinsame Kopfzeile (AppKopfzeile, 25.09.2026) bringt Glocke und
// Gemeinde-Umschalter mit -- beide haengen an Warteschlange und Router, die
// hier nicht Thema sind. Die Kopfzeile hat eigene Tests (appKopfzeile.test).
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: () => null,
  AppKopfzeileGross: () => null,
}));

vi.mock('@ionic/react', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const IonPage = React.forwardRef<HTMLDivElement, { children?: React.ReactNode }>(
    ({ children }, ref) => {
      const merke = (node: HTMLDivElement | null) => {
        if (node && !gesehenePages.includes(node)) gesehenePages.push(node);
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      };
      return <div ref={merke} data-testid="ionpage">{children}</div>;
    }
  );
  return {
    IonPage,
    IonHeader: passthrough, IonToolbar: passthrough, IonTitle: passthrough,
    IonContent: passthrough, IonIcon: () => null, IonSpinner: () => null,
    IonRefresher: () => null, IonRefresherContent: () => null,
    IonCard: passthrough, IonCardContent: passthrough, IonList: passthrough,
    IonListHeader: passthrough, IonLabel: passthrough, IonItem: passthrough,
    IonButton: passthrough, IonButtons: passthrough, IonBadge: passthrough,
    IonGrid: passthrough, IonRow: passthrough, IonCol: passthrough,
    IonProgressBar: () => null, IonChip: passthrough, IonAvatar: passthrough,
    IonSkeletonText: () => null, IonNote: passthrough, IonText: passthrough,
    IonModal: () => null, IonFab: passthrough, IonFabButton: passthrough,
    useIonPopover: () => [vi.fn(), vi.fn()],
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
    useIonViewWillEnter: vi.fn(),
    useIonViewDidEnter: vi.fn(),
  };
});

const mockUser = { id: 3, type: 'teamer', display_name: 'Test Teamer' };
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: mockUser, setError: vi.fn(), setSuccess: vi.fn() }),
}));

import TeamerDashboardPage from '../../components/teamer/pages/TeamerDashboardPage';

describe('Startseite beim ERSTEN Aufbau (Teamer)', () => {
  // NICHT AN DER BEGRUESSUNG ERKENNEN (zweimal korrigiert):
  //
  // Zuerst stand hier toContain('Guten') -- das traf drei von vier
  // Tageszeiten, und ab 22 Uhr sagt die Seite "Gute Nacht". Der Test fiel
  // also jede Nacht (16.09.2026).
  //
  // Dann eine feste Uhrzeit plus toContain('Guten Morgen'). Auch das war
  // falsch: Die Begruessung wuerfelt VOR der Uhrzeitpruefung
  // (Math.random() < 0.2 -> "Moin"). Der Test fiel damit statistisch bei
  // jedem fuenften Lauf -- unabhaengig von der Uhrzeit (17.09.2026).
  //
  // Die Begruessung taugt als Erkennungsmerkmal also gar nicht. Geprueft
  // wird jetzt der Anzeigename, der in JEDER Variante vorkommt ("Moin, Test!"
  // ebenso wie "Guten Morgen, Test!") -- und genau das soll der Test ja
  // wissen: Steht ueberhaupt Inhalt da, oder nur der Ladebildschirm?
  beforeEach(() => {
    gesehenePages.length = 0;
  });

  it('zeigt nach dem ersten Laden den Inhalt, nicht nur den Ladebildschirm', async () => {
    const { container } = render(<TeamerDashboardPage />);
    await waitFor(() => {
      expect(container.textContent).toContain('Test');
    }, { timeout: 3000 });
  });

  it('behaelt beim Umschlag von "laedt" auf "fertig" DASSELBE Wurzel-Element', async () => {
    const { container } = render(<TeamerDashboardPage />);
    await waitFor(() => {
      expect(container.textContent).toContain('Test');
    }, { timeout: 3000 });
    // Genau EIN Wurzel-Element ueber beide Zustaende. Waeren es zwei, haette
    // Ionic dem zweiten `ion-page-invisible` angehaengt, ohne dass ein
    // Uebergang es je wieder abnimmt -- die weisse Startseite.
    expect(gesehenePages.length).toBe(1);
    expect(container.querySelectorAll('[data-testid="ionpage"]').length).toBe(1);
  });
});
