// Gerüst für gerenderte Tests der Zähler an den Reitern -- vom Server bis
// zur roten Zahl unten (MainTabs) und zurück (Seiten, die etwas als gesehen
// melden).
//
// Entstanden beim Umstellen der Quelltext-Tests auf Verhalten (BF-02,
// 09.10.2026): abzeichenZaehlerTeamer und neuigkeitenVerdrahtung lasen dafür
// MainTabs.tsx, rollenBaeume.ts, reiterZaehler.ts und BadgeContext.tsx als
// Text.
//
// EINBINDEN wie die anderen Gerüste: dieses Modul als ERSTES importieren.
//
// ECHT sind: BadgeProvider (er holt GET /notifications/badge-counts und
// rechnet die Zahlen), navigation/reiterZaehler.ts, der Rollenbaum und
// MainTabs; dazu jede Seite, die ein Test hineinreicht. Nachgestellt sind:
// der Server (`zustand.antworten` je Pfad, POST wird mitgeschrieben), die
// Anmeldung (`zustand.user`), Netz und Warteschlange, der
// Offline-Zwischenspeicher (holt einmal über die echte Abruf-Funktion der
// Seite), Messung, Kopfzeile, App-Symbol und die Reiterleiste selbst
// (schlichte Elemente: der Reiter als <a data-tab>, die rote Zahl als
// <span class="reiter-zahl">). Das übrige Ionic ist echt. Das Outlet von
// MainTabs rendert nichts -- Seiten werden einzeln gerendert.
import React from 'react';
import { vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

export const zustand = {
  user: null as Record<string, unknown> | null,
  online: true,
  /** Antworten je GET-Pfad; fehlt einer, antwortet der Server mit {}. */
  antworten: new Map<string, unknown>(),
};

export const api = {
  get: vi.fn(async (pfad: string) => ({ data: zustand.antworten.has(pfad) ? zustand.antworten.get(pfad) : {}, headers: {} })),
  post: vi.fn(async () => ({ data: {} })),
};
export const enqueue = vi.fn();
export const appSymbolSetzen = vi.fn();

vi.mock('../../../services/api', () => ({
  default: {
    get: (...a: [string]) => api.get(...a),
    post: (...a: []) => api.post(...a),
  },
}));
vi.mock('../../../contexts/AppContext', () => ({ useApp: () => ({ user: zustand.user, setError: vi.fn(), setSuccess: vi.fn() }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({
  useLiveUpdate: () => ({ socketEpoch: 0 }),
  useLiveRefresh: () => {},
}));
vi.mock('../../../contexts/ModalContext', () => ({
  ModalProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: undefined }),
}));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: (...a: unknown[]) => enqueue(...a) } }));
vi.mock('../../../services/networkMonitor', () => ({
  networkMonitor: { get isOnline() { return zustand.online; }, subscribe: () => () => {} },
}));
vi.mock('../../../services/websocket', () => ({
  initializeWebSocket: () => ({ on: vi.fn(), off: vi.fn() }),
  getSocket: () => null,
}));
vi.mock('../../../services/tokenStore', () => ({ getToken: () => 'test-token' }));
vi.mock('../../../services/notifications', () => ({ removeDeliveredForChatRoom: vi.fn() }));
vi.mock('../../../services/appSymbolZahl', () => ({
  appSymbolZahlNativ: () => false,
  appSymbolZahlSetzen: (...a: unknown[]) => appSymbolSetzen(...a),
}));
vi.mock('@capawesome/capacitor-badge', () => ({
  Badge: { set: vi.fn().mockResolvedValue(undefined), clear: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../services/analytics', () => ({ bereichAusPfad: () => null, trackBereich: vi.fn(), track: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => false }));
vi.mock('@rdlabo/ionic-theme-ios27', () => ({ registerTabBarEffect: vi.fn() }));
vi.mock('../../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: () => null }));
// Die Abzeichen-Ansicht hat eigene Tests; hier zaehlt, was die Badge-Seiten
// beim Oeffnen melden.
vi.mock('../../../components/konfi/views/BadgesView', () => ({ default: () => null }));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
// Der Zwischenspeicher holt einmal je Schluessel über die ECHTE Abruf-
// Funktion der Seite -- so ist auch geprüft, welche Route sie ruft.
vi.mock('../../../hooks/useOfflineQuery', async () => {
  const R = await import('react');
  return {
    useOfflineQuery: (schluessel: string, holen: () => Promise<unknown>) => {
      const [data, setData] = R.useState<unknown>(null);
      R.useEffect(() => { void holen().then(setData); }, [schluessel]);
      return { data, loading: false, error: null, isStale: false, isOffline: false, refresh: vi.fn(), refreshLive: vi.fn() };
    },
  };
});

type K = { children?: React.ReactNode };
// Echtes Ionic -- die Seiten rendern wie in der App. Nur die Reiterleiste
// ist ein schlichter Nachbau: so sind Reiter und Zahl ohne Shadow-DOM und
// ohne Ionics Router lesbar.
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  IonTabs: ({ children }: K) => <div>{children}</div>,
  IonRouterOutlet: () => null,
  IonTabBar: ({ children }: K) => <nav>{children}</nav>,
  IonTabButton: ({ children, tab, href }: K & { tab: string; href: string }) => <a data-tab={tab} href={href}>{children}</a>,
  IonBadge: ({ children, color }: K & { color?: string }) => <span className="reiter-zahl" data-farbe={color}>{children}</span>,
  isPlatform: () => false,
  useIonRouter: () => ({ push: vi.fn() }),
}));

import { BadgeProvider, useBadge } from '../../../contexts/BadgeContext';

export const KONFI = { id: 1, type: 'konfi', role_name: 'konfi', organization_id: 1 };
export const TEAMER = { id: 2, type: 'teamer', role_name: 'teamer', organization_id: 1 };
export const LEITUNG = { id: 3, type: 'admin', role_name: 'admin', organization_id: 1 };

/** Antwort von GET /notifications/badge-counts; nicht genannte Zahlen sind 0. */
export const zaehlerAntwort = (zahlen: {
  chat?: number; newBadges?: number; pendingRequests?: number; pendingEvents?: number;
  /** Offene Freigaben je Challenge (Team, Leitung); pendingChallenges ist ihre Summe. */
  freigabenJe?: Record<number, number>;
  /** Challenge-Neuigkeiten je Challenge; der Zaehler am Reiter ist ihre Summe. */
  neuigkeitenJe?: Record<number, number>;
  /** Neue Beitraege seit dem letzten Oeffnen je Challenge (Leitung, Team); ohne: aelterer Server. */
  neueBeitraegeJe?: Record<number, number>;
  /** Davon wartend je Challenge. */
  neueWartendJe?: Record<number, number>;
}) => {
  const summe = (je?: Record<number, number>) => Object.values(je ?? {}).reduce((s, n) => s + n, 0);
  return {
    ...(zahlen.neueBeitraegeJe
      ? { challengeNeueBeitraege: { byChallenge: zahlen.neueBeitraegeJe, wartendByChallenge: zahlen.neueWartendJe ?? {} } }
      : {}),
    chat: { total: zahlen.chat ?? 0, byRoom: zahlen.chat ? { 1: zahlen.chat } : {} },
    pendingRequests: zahlen.pendingRequests ?? 0,
    pendingEvents: zahlen.pendingEvents ?? 0,
    pendingChallenges: summe(zahlen.freigabenJe),
    newBadges: zahlen.newBadges ?? 0,
    challengeUpdates: { total: summe(zahlen.neuigkeitenJe), byChallenge: zahlen.neuigkeitenJe ?? {} },
    challengeApprovals: { total: summe(zahlen.freigabenJe), byChallenge: zahlen.freigabenJe ?? {} },
    postfach: { ungelesen: 0 },
  };
};

export const zuruecksetzen = (user: Record<string, unknown> | null = KONFI) => {
  zustand.user = user;
  zustand.online = true;
  zustand.antworten = new Map<string, unknown>([['/notifications/badge-counts', zaehlerAntwort({})]]);
  api.get.mockClear();
  api.post.mockClear();
  enqueue.mockReset();
  appSymbolSetzen.mockReset();
};

/** Die Zahlen des BadgeContext, wie ein Leser sie sieht. */
export const kontext: { aktuell: ReturnType<typeof useBadge> | null } = { aktuell: null };
const Leser: React.FC = () => { kontext.aktuell = useBadge(); return null; };

export const warte = async (runden = 6) => {
  for (let i = 0; i < runden; i += 1) await act(async () => { await Promise.resolve(); });
};

/** Rendert unter dem echten BadgeProvider; `kinder` z. B. eine Seite oder MainTabs. */
export const mitZaehlern = async (kinder: React.ReactNode, pfad = '/') => {
  const baum = (k: React.ReactNode) => (
    <MemoryRouter initialEntries={[pfad]}>
      <BadgeProvider>
        <Leser />
        {k}
      </BadgeProvider>
    </MemoryRouter>
  );
  const r = render(baum(kinder));
  await warte();
  /** Rendert neu, im selben Provider (wie ein Neuladen der Seite). */
  const neu = async (k: React.ReactNode = kinder) => { r.rerender(baum(k)); await warte(); };
  return { ...r, neu };
};

export interface Reiter { tab: string; name: string; zahl: string | null; farbe: string | null }

/** Rendert die Reiterleiste auf `pfad` und liefert die Reiter in ihrer Reihenfolge. */
export const zeigeReiter = async (pfad: string): Promise<Reiter[]> => {
  const MainTabs = (await import('../../../components/layout/MainTabs')).default;
  const { container } = await mitZaehlern(<MainTabs />, pfad);
  return [...container.querySelectorAll('a[data-tab]')].map((a) => {
    const zahl = a.querySelector('.reiter-zahl');
    return {
      tab: a.getAttribute('data-tab') ?? '',
      name: a.querySelector('ion-label')?.textContent ?? '',
      zahl: zahl ? zahl.textContent : null,
      farbe: zahl ? zahl.getAttribute('data-farbe') : null,
    };
  });
};

/** Wie oft der Provider die Zahlen geholt hat. */
export const zaehlerAbrufe = () => api.get.mock.calls.filter(([p]) => p === '/notifications/badge-counts').length;
