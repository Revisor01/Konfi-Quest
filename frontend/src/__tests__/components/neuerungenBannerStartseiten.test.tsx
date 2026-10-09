import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, act, within } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund (27.08.2026): Die beiden Neuerungs-Karten stecken laengst in EINEM
// Bauteil (shared/NeuerungenBanner). Trotzdem stand auf der Startseite der
// Leitung nur die "Was ist neu"-Karte -- handgebaut aus UpdateHinweisKarte,
// ohne die Mitmachen-Karte. Genau die Drift, die drei getrennte
// Komponentenbaeume immer wieder erzeugen.
//
// Der Befund ist, dass eine Anzeige in EINEM der drei Baeume FEHLT. Seit
// 09.10.2026 werden deshalb ALLE sechs Seiten gerendert -- die drei
// Startseiten und die drei Stellen, an denen die Karten dauerhaft stehen --
// und an jeder wird dasselbe geprueft. Die echten Karten und das echte
// Banner; nachgestellt sind Server, Anmeldung, der Onboarding-Merker und die
// Erklaer-Fenster (als Marken, deren Erscheinen das Oeffnen zeigt).
//
// WAECHTER (bleibt Quelltext): keine handgebaute Einzelkarte neben dem
// Bauteil. Eine Einzelkarte, die gerade gleich aussieht, saehe im DOM gleich
// aus -- erst die naechste Aenderung am Bauteil liefe an ihr vorbei.

const { stand, merker } = vi.hoisted(() => ({
  stand: {
    user: {} as Record<string, unknown>,
    antworten: new Map<string, unknown>(),
  },
  merker: {
    showUpdateHinweis: true,
    showMitmachenHinweis: true,
    markUpdateHinweisGesehen: (() => {}) as (...a: unknown[]) => void,
    markMitmachenHinweisGesehen: (() => {}) as (...a: unknown[]) => void,
  },
}));

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(async (pfad: string) => ({ data: stand.antworten.has(pfad) ? stand.antworten.get(pfad) : [], headers: {} })),
    put: vi.fn(async () => ({ data: {} })),
    post: vi.fn(async () => ({ data: {} })),
  },
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: stand.user, setUser: vi.fn(), setError: vi.fn(), setSuccess: vi.fn(), signOut: vi.fn(), isOnline: true }),
}));
vi.mock('../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {}, useLiveUpdate: () => ({ triggerRefresh: vi.fn() }) }));
vi.mock('../../contexts/BadgeContext', () => ({ useBadge: () => ({ refreshAllCounts: vi.fn() }) }));
vi.mock('../../hooks/useOfflineQuery', async () => {
  const R = await import('react');
  return {
    useOfflineQuery: (schluessel: string, holen: () => Promise<unknown>) => {
      const [data, setData] = R.useState<unknown>(null);
      R.useEffect(() => { void holen().then(setData); }, [schluessel]);
      return { data, loading: false, error: null, isStale: false, isOffline: false, refresh: vi.fn(async () => undefined), refreshLive: vi.fn() };
    },
  };
});
vi.mock('../../hooks/useOnboardingOnce', () => ({
  useOnboardingWithUpdateOnce: () => ({
    showOnboarding: false, closeOnboarding: vi.fn(),
    showNeuerungen: false, schliesseNeuerungen: vi.fn(),
    showUpdateHinweis: merker.showUpdateHinweis,
    markUpdateHinweisGesehen: merker.markUpdateHinweisGesehen,
    showMitmachenHinweis: merker.showMitmachenHinweis,
    markMitmachenHinweisGesehen: merker.markMitmachenHinweisGesehen,
  }),
}));
vi.mock('@capacitor/preferences', () => ({
  Preferences: { get: vi.fn(async () => ({ value: null })), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) },
}));
vi.mock('../../navigation/breitesLayout', () => ({ useBreitesLayout: () => false }));
vi.mock('../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ pathname: '/start', search: '' }) }));
vi.mock('../../hooks/useMediaCacheControl', () => ({ useMediaCacheControl: () => ({ cacheLabel: '', clearMediaCache: vi.fn() }) }));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true, subscribe: () => () => {} } }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../services/analytics', async (original) => ({
  ...(await original<typeof import('../../services/analytics')>()),
  track: vi.fn(), trackHandlung: vi.fn(),
}));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn(), haptik: vi.fn(async () => undefined), ImpactStyle: { Light: 'LIGHT' } }));
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonRouter: () => ({ push: vi.fn() }),
  useIonModal: () => [vi.fn(), vi.fn()],
  useIonPopover: () => [vi.fn(), vi.fn()],
}));

// Erklaer-Fenster als Marken: Ihr Erscheinen ist das Oeffnen.
const { marke, leer } = vi.hoisted(() => ({
  marke: (name: string) => () => ({ default: () => <div data-fenster={name} /> }),
  leer: () => ({ default: () => null }),
}));
vi.mock('../../components/admin/modals/AdminUpdate230WalkthroughModal', marke('walkthrough'));
vi.mock('../../components/teamer/modals/TeamerUpdate230WalkthroughModal', marke('walkthrough'));
vi.mock('../../components/konfi/modals/KonfiUpdate230WalkthroughModal', marke('walkthrough'));
vi.mock('../../components/shared/MitmachenErklaerungModal', marke('mitmachen'));

// Inhalte, um die es hier nicht geht.
vi.mock('../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
vi.mock('../../components/common/LoadingSpinner', leer);
vi.mock('../../components/admin/KonfisView', leer);
vi.mock('../../components/konfi/views/DashboardView', leer);
vi.mock('../../components/wrapped/WrappedModal', leer);
vi.mock('../../components/admin/modals/AdminOnboardingModal', leer);
vi.mock('../../components/teamer/modals/TeamerOnboardingModal', leer);
vi.mock('../../components/konfi/modals/KonfiOnboardingModal', leer);
vi.mock('../../components/konfi/modals/KonfispruchSelectModal', leer);
vi.mock('../../components/konfi/modals/PointsHistoryModal', leer);
vi.mock('../../components/admin/pages/AdminInvitePage', leer);
vi.mock('../../components/shared/ChangeEmailModal', leer);
vi.mock('../../components/shared/ChangePasswordModal', leer);
vi.mock('../../components/shared/AppSperreSchalter', leer);
vi.mock('../../components/shared/EinladungenKarte', leer);
vi.mock('../../components/shared/PushAuswahl', leer);
vi.mock('../../components/shared/AbsturzberichteSchalter', leer);
vi.mock('../../components/shared/DeleteAccountModal', leer);
vi.mock('../../components/shared/SpiritFooter', leer);
vi.mock('../../components/admin/modals/ChangeRoleTitleModal', leer);
vi.mock('../../components/shared/BibleTranslationModal', () => ({ default: () => null, getTranslationName: (c: string) => c }));

import AdminKonfisPage from '../../components/admin/pages/AdminKonfisPage';
import TeamerDashboardPage from '../../components/teamer/pages/TeamerDashboardPage';
import KonfiDashboardPage from '../../components/konfi/pages/KonfiDashboardPage';
import AdminSettingsPage from '../../components/admin/pages/AdminSettingsPage';
import TeamerProfilePage from '../../components/teamer/pages/TeamerProfilePage';
import ProfileView from '../../components/konfi/views/ProfileView';

const LEITUNG = { id: 3, type: 'admin', role_name: 'org_admin', organization_id: 1, display_name: 'Pastor Test' };
const TEAMER = { id: 9, type: 'teamer', role_name: 'teamer', organization_id: 1, display_name: 'Tjark Test' };
const KONFI = { id: 7, type: 'konfi', role_name: 'konfi', organization_id: 1, display_name: 'Emilia Test' };

const KONFI_PROFIL = {
  id: 7, username: 'emilia', display_name: 'Emilia Test', jahrgang_name: '2026', jahrgang_year: 2026,
  created_at: '2025-09-01T10:00:00Z', total_points: 0, badge_count: 0, activity_count: 0, event_count: 0,
  pending_requests: 0, bible_translation: 'LUT',
  progress_overview: { monthly_points: [], achievements: { total_activities: 0, total_events: 0, total_badges: 0 } },
};

const antworten = () => new Map<string, unknown>([
  ['/teamer/dashboard', {
    greeting: { display_name: 'Tjark Test', hour: 9 }, certificates: [], events: [],
    badges: { recent: [], earned_count: 0, total_count: 0 },
    config: { show_challenges: false, show_losung: false }, has_wrapped: false, konfspruch: null,
  }],
  ['/konfi/dashboard', {
    konfi: { id: 7, display_name: 'Emilia Test', jahrgang_name: '2026', gottesdienst_points: 0, gemeinde_points: 0 },
    total_points: 0, recent_badges: [], badge_count: 0, recent_events: [], event_count: 0, ranking: [], has_wrapped: false,
  }],
  ['/konfi/profile', {}],
  ['/konfi/badges/v2', { available: [], earned: [], stats: { totalVisible: 0, totalSecret: 0 } }],
  ['/teamer/profile', {
    user: { display_name: 'Tjark Test', username: 'tjark.test', email: '', role_title: '', teamer_since: null, organization_name: 'Testgemeinde', bible_translation: 'LUT' },
    konfi_data: null,
  }],
  ['/challenges/konfi', { active: [], archive: [], marks: [] }],
  ['/auth/me', { email: '', created_at: null }],
]);

type Seite = { rolle: string; user: Record<string, unknown>; zeige: () => React.ReactElement };

// Die drei Startseiten -- je Rolle die Seite, auf der man nach dem Login
// landet. Fuer die Leitung ist das /admin/konfis.
const STARTSEITEN: Seite[] = [
  { rolle: 'Leitung', user: LEITUNG, zeige: () => <AdminKonfisPage /> },
  { rolle: 'Teamer:in', user: TEAMER, zeige: () => <TeamerDashboardPage /> },
  { rolle: 'Konfi', user: KONFI, zeige: () => <KonfiDashboardPage /> },
];
// Profil bzw. "Mehr" -- dort stehen dieselben Karten dauerhaft, ohne X.
const DAUERHAFT: Seite[] = [
  { rolle: 'Leitung ("Mehr")', user: LEITUNG, zeige: () => <AdminSettingsPage /> },
  { rolle: 'Teamer:in (Profil)', user: TEAMER, zeige: () => <TeamerProfilePage /> },
  { rolle: 'Konfi (Profil)', user: KONFI, zeige: () => <ProfileView profile={KONFI_PROFIL as never} onReload={vi.fn()} presentingElement={null} /> },
];

const zeige = async (seite: Seite) => {
  stand.user = seite.user;
  render(seite.zeige());
  for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); });
};

const updateKarte = () => document.querySelector('.app-whatsnew:not(.app-whatsnew--mitmachen)') as HTMLElement | null;
const mitmachenKarte = () => document.querySelector('.app-whatsnew--mitmachen') as HTMLElement | null;
const fenster = (name: string) => document.querySelector(`[data-fenster="${name}"]`);

let markUpdate: ReturnType<typeof vi.fn>;
let markMitmachen: ReturnType<typeof vi.fn>;
beforeEach(() => {
  cleanup();
  stand.antworten = antworten();
  markUpdate = vi.fn();
  markMitmachen = vi.fn();
  merker.showUpdateHinweis = true;
  merker.showMitmachenHinweis = true;
  merker.markUpdateHinweisGesehen = markUpdate as unknown as (...a: unknown[]) => void;
  merker.markMitmachenHinweisGesehen = markMitmachen as unknown as (...a: unknown[]) => void;
});

describe('Neuerungs-Karten stehen auf ALLEN drei Startseiten', () => {
  it.each(STARTSEITEN)('$rolle sieht beide Karten auf der Startseite', async (seite) => {
    await zeige(seite);
    expect(document.querySelectorAll('.app-whatsnew')).toHaveLength(2);
    expect(updateKarte()).not.toBeNull();
    expect(mitmachenKarte()).not.toBeNull();
  });

  it.each(STARTSEITEN)('$rolle kann beide Karten wegklicken', async (seite) => {
    // Auf der Startseite ist das Banner wegklickbar (X). Fehlen die
    // Ausblenden-Handler, steht die Karte dort fuer immer.
    await zeige(seite);
    fireEvent.click(within(updateKarte()!).getByRole('button', { name: 'Hinweis ausblenden' }));
    expect(markUpdate).toHaveBeenCalledTimes(1);
    fireEvent.click(within(mitmachenKarte()!).getByRole('button', { name: 'Hinweis ausblenden' }));
    expect(markMitmachen).toHaveBeenCalledTimes(1);
    // Wegklicken oeffnet nichts.
    expect(fenster('walkthrough')).toBeNull();
    expect(fenster('mitmachen')).toBeNull();
  });

  it.each(STARTSEITEN)('$rolle haengt die Sichtbarkeit an den Onboarding-Merker', async (seite) => {
    // Ohne diese Flags stuenden die Karten bei JEDEM Start wieder da --
    // auch bei Leuten, die sie laengst weggeklickt haben.
    merker.showUpdateHinweis = false;
    await zeige(seite);
    expect(updateKarte()).toBeNull();
    expect(mitmachenKarte()).not.toBeNull();
    cleanup();
    merker.showUpdateHinweis = true;
    merker.showMitmachenHinweis = false;
    await zeige(seite);
    expect(updateKarte()).not.toBeNull();
    expect(mitmachenKarte()).toBeNull();
  });

  it.each(STARTSEITEN)('$rolle hat zu beiden Karten ein Ziel', async (seite) => {
    // Eine Karte, die nichts oeffnet, ist eine Sackgasse. Jede Rolle hat einen
    // eigenen Walkthrough; die Mitmachen-Erklaerung ist fuer alle dieselbe.
    await zeige(seite);
    await act(async () => { fireEvent.click(updateKarte()!); });
    expect(fenster('walkthrough')).not.toBeNull();
    await act(async () => { fireEvent.click(mitmachenKarte()!); });
    expect(fenster('mitmachen')).not.toBeNull();
    // Oeffnen zaehlt als gesehen -- beim naechsten Start steht die Karte nicht mehr.
    expect(markUpdate).toHaveBeenCalledTimes(1);
    expect(markMitmachen).toHaveBeenCalledTimes(1);
  });
});

describe('Im Profil und unter "Mehr" stehen die Karten dauerhaft', () => {
  it.each(DAUERHAFT)('$rolle zeigt beide Karten -- auch nach dem Wegklicken auf der Startseite', async (seite) => {
    merker.showUpdateHinweis = false;
    merker.showMitmachenHinweis = false;
    await zeige(seite);
    expect(updateKarte()).not.toBeNull();
    expect(mitmachenKarte()).not.toBeNull();
  });

  it.each(DAUERHAFT)('$rolle zeigt sie ohne X, und sie oeffnen ihre Erklaerung', async (seite) => {
    // Dort sind sie der feste Weg zu den Erklaerungen (Nutzerhinweis
    // 23.08.2026) -- ein X waere eine Sackgasse ohne Rueckweg.
    await zeige(seite);
    expect(within(updateKarte()!).queryByRole('button', { name: 'Hinweis ausblenden' })).toBeNull();
    expect(within(mitmachenKarte()!).queryByRole('button', { name: 'Hinweis ausblenden' })).toBeNull();
    await act(async () => { fireEvent.click(updateKarte()!); });
    expect(fenster('walkthrough')).not.toBeNull();
    await act(async () => { fireEvent.click(mitmachenKarte()!); });
    expect(fenster('mitmachen')).not.toBeNull();
  });
});

describe('Waechter: keine handgebaute Einzelkarte neben dem Bauteil', () => {
  const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');
  it.each([
    'src/components/admin/pages/AdminKonfisPage.tsx',
    'src/components/teamer/pages/TeamerDashboardPage.tsx',
    'src/components/konfi/pages/KonfiDashboardPage.tsx',
    'src/components/admin/pages/AdminSettingsPage.tsx',
    'src/components/teamer/pages/TeamerProfilePage.tsx',
    'src/components/konfi/views/ProfileView.tsx',
  ])('%s', (pfad) => {
    // Wer eine der beiden Karten direkt einbindet, umgeht das gemeinsame
    // Bauteil -- und genau so ist die Mitmachen-Karte bei der Leitung
    // verlorengegangen.
    const quelle = lies(pfad);
    expect(quelle).not.toContain('<UpdateHinweisKarte');
    expect(quelle).not.toContain('<MitmachenHinweisKarte');
  });
});
