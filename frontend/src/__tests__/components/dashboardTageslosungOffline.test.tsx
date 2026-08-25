import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';

// Offline-Lücke (Audit 25.08.2026): Teamer cachten die Tageslosung mit
// 24-Std-TTL, die Konfi-View lud sie ungecacht per api.get — morgens im Bus
// ohne Netz sah der Teamer die Losung, der Konfi nicht. Diese Tests sichern
// ab, dass die Konfi-View das Teamer-Muster nutzt UND den show_losung-Schalter
// respektiert (abgeschaltete Losung wird gar nicht erst abgerufen).

// --- Mocks ---

const mockApiGet = vi.fn().mockResolvedValue({ data: {} });
const mockApiPut = vi.fn().mockResolvedValue({ data: {} });
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: any[]) => mockApiGet(...args),
    put: (...args: any[]) => mockApiPut(...args),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 7, type: 'konfi' },
    setError: vi.fn(),
  }),
}));

// useOfflineQuery steuerbar mocken: Aufrufe samt Optionen aufzeichnen und
// eine gecachte Losung liefern.
const offlineQueryCalls: Array<{ key: string; options?: any }> = [];
const gecachteLosung = {
  losungstext: 'Der Herr ist mein Hirte.',
  losungsvers: 'Psalm 23,1',
  lehrtext: 'Ich bin der gute Hirte.',
  lehrtextvers: 'Johannes 10,11',
  translation: 'LUT',
};
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (key: string, _fetcher: any, options?: any) => {
    offlineQueryCalls.push({ key, options });
    const enabled = options?.enabled !== false;
    return {
      data: enabled ? gecachteLosung : null,
      loading: false,
      error: null,
      isStale: false,
      isOffline: true,
      refresh: vi.fn(),
      refreshLive: vi.fn(),
    };
  },
}));

// Schwere Kinder wegmocken — hier interessiert nur die Losung
vi.mock('../../components/konfi/views/DashboardSections', () => ({
  getIconFromString: () => 'icon',
  LevelPopoverContent: () => null,
  DashboardBadgePopoverContent: () => null,
  getGreeting: () => 'Moin',
  getFirstName: () => 'Emilia',
  getInitials: () => 'E',
  formatTimeUntil: () => '',
  formatEventTime: () => '',
  formatEventDate: () => '',
  getBadgeColor: () => '#667eea',
  EventCard: () => null,
  RankingSection: () => null,
  LevelIconsRow: () => null,
  LevelProgress: () => null,
}));
vi.mock('../../components/admin/views/ActivityRings', () => ({
  default: () => null,
}));
vi.mock('../../components/shared/BibleTranslationModal', () => ({
  default: () => null,
  getTranslationName: (code: string) => code,
}));

vi.mock('@ionic/react', async () => {
  return {
    IonIcon: () => null,
    useIonAlert: () => [vi.fn()],
    useIonPopover: () => [vi.fn(), vi.fn()],
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

import DashboardView from '../../components/konfi/views/DashboardView';
import { CACHE_TTL } from '../../services/offlineCache';

const dashboardData: any = {
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
};

const renderView = (dashboardConfig: any) =>
  render(
    <DashboardView
      dashboardData={dashboardData}
      dailyVerse={null}
      badgeStats={{ totalAvailable: 0, totalEarned: 0, secretAvailable: 0, secretEarned: 0 }}
      allBadges={{ available: [], earned: [] }}
      upcomingEvents={[]}
      targetGottesdienst={10}
      targetGemeinde={10}
      onOpenPointsHistory={vi.fn()}
      onOpenKonfispruch={vi.fn()}
      dashboardConfig={dashboardConfig}
      sectionOrder={undefined}
    />
  );

describe('Konfi-Dashboard: Tageslosung offline (aus dem Cache)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    offlineQueryCalls.length = 0;
  });

  it('lädt die Losung über useOfflineQuery mit TAGESLOSUNG-TTL (24 Std)', () => {
    const { getByText } = renderView({ show_losung: true, show_challenges: false });

    const call = offlineQueryCalls.find(c => c.key.startsWith('konfi:tageslosung:'));
    expect(call).not.toBe(undefined);
    expect(call!.options?.ttl).toBe(CACHE_TTL.TAGESLOSUNG);
    expect(call!.options?.enabled).toBe(true);

    // Gecachte Losung ist offline sichtbar (Losung ODER Lehrtext, je nach
    // Zufallswahl der View)
    const text = [gecachteLosung.losungstext, gecachteLosung.lehrtext]
      .some(t => {
        try { getByText(`"${t}"`); return true; } catch { return false; }
      });
    expect(text).toBe(true);

    // Kein Direkt-Abruf mehr am Cache vorbei
    expect(mockApiGet).not.toHaveBeenCalledWith('/konfi/tageslosung');
  });

  it('abgeschalteter Schalter (show_losung=false): Losung wird NICHT abgerufen', () => {
    const { queryByText } = renderView({ show_losung: false, show_challenges: false });

    const call = offlineQueryCalls.find(c => c.key.startsWith('konfi:tageslosung:'));
    expect(call).not.toBe(undefined);
    expect(call!.options?.enabled).toBe(false);

    expect(mockApiGet).not.toHaveBeenCalledWith('/konfi/tageslosung');
    expect(queryByText(`"${gecachteLosung.losungstext}"`)).toBe(null);
    expect(queryByText(`"${gecachteLosung.lehrtext}"`)).toBe(null);
  });
});
