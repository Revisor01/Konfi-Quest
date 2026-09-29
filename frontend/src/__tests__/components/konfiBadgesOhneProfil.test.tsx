// Badges-Seite der Konfi zeigt die Abzeichen auch ohne Profilantwort
// (Audit 26.09.2026, Screens Konfi/Teamer BF-12 b)
//
// Die Seite verwarf die ganze Abzeichenliste, solange GET /konfi/profile
// nicht (oder nicht mehr) geladen war -- `if (!badgeData || !konfiData)
// return []`. Das Profil dient nur als Rueckfall fuer den Punkte-Fortschritt
// bei Abzeichen, zu denen der Server keinen `progress` liefert. Scheiterte der
// Profilabruf (500, Zeitueberschreitung), standen die Kopfzahlen aus `stats`
// neben "Keine Badges gefunden".
//
// Gemessen wird, was die Seite an BadgesView weiterreicht.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import type { AnzeigeBadge } from '../../types/dashboard';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn().mockResolvedValue({}) },
}));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ user: { id: 1, type: 'konfi' } }) }));
vi.mock('../../contexts/BadgeContext', () => ({ useBadge: () => ({ refreshAllCounts: vi.fn() }) }));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null } }) }));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: vi.fn() }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('@ionic/react', () => {
  const pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  return { IonPage: pass, IonContent: pass, IonRefresher: () => null, IonRefresherContent: () => null };
});

let gezeigt: AnzeigeBadge[] = [];
vi.mock('../../components/konfi/views/BadgesView', () => ({
  default: ({ badges }: { badges: AnzeigeBadge[] }) => { gezeigt = badges; return null; },
}));

let profil: Record<string, number> | null = null;
const abzeichen = {
  earned: [{ id: 1, name: 'Erstes Event', criteria_type: 'event_count', criteria_value: 1, seen: true, earned: true, earned_at: '2026-09-01' }],
  available: [
    { id: 2, name: 'Zehn Punkte', criteria_type: 'total_points', criteria_value: 10 },
    { id: 3, name: 'Drei Events', criteria_type: 'event_count', criteria_value: 3, progress: { current: 1, percentage: 33 } },
  ],
  stats: { totalVisible: 3, totalSecret: 0 },
};
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => schluessel.startsWith('konfi:badges')
    ? { data: abzeichen, loading: false, refresh: vi.fn(), refreshLive: vi.fn() }
    : { data: profil, loading: false, refresh: vi.fn(), refreshLive: vi.fn() },
}));

import KonfiBadgesPage from '../../components/konfi/pages/KonfiBadgesPage';

beforeEach(() => {
  gezeigt = [];
  profil = null;
});

describe('KonfiBadgesPage ohne Profilantwort', () => {
  it('zeigt alle Abzeichen, auch wenn das Profil fehlt', () => {
    render(<KonfiBadgesPage />);

    expect(gezeigt.map((b) => b.id).sort()).toEqual([1, 2, 3]);
    expect(gezeigt.find((b) => b.id === 1)?.is_earned).toBe(true);
    // Fortschritt vom Server bleibt, ohne Profil gibt es keinen Rueckfall.
    expect(gezeigt.find((b) => b.id === 3)?.progress_percentage).toBe(33);
    expect(gezeigt.find((b) => b.id === 2)?.progress_percentage).toBe(0);
  });

  it('mit Profil rechnet der Rueckfall den Punkte-Fortschritt wie bisher', () => {
    profil = { total_points: 4, gottesdienst_points: 1, gemeinde_points: 3 };
    render(<KonfiBadgesPage />);

    expect(gezeigt).toHaveLength(3);
    expect(gezeigt.find((b) => b.id === 2)?.progress_points).toBe(4);
    expect(gezeigt.find((b) => b.id === 2)?.progress_percentage).toBe(40);
    expect(gezeigt.find((b) => b.id === 3)?.progress_percentage).toBe(33);
  });
});
