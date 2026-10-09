// Challenges von Team und Leitung: App und Browser zeigen die Reiter aus
// seiten/challengesLeitung.ts (09.10.2026) -- dieselben Namen für dieselben
// Mengen (bis dahin im Browser „Laufend" und „Beendet" statt „Aktuell" und
// „Archiv"). Gerendert wird die echte Seite, schmal (App) und breit (Web).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, within, cleanup, fireEvent, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  breit: true,
  liste: [] as unknown[],
  user: { id: 4, type: 'admin', organization_id: 1, role_name: 'org_admin' } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonRouter: () => ({ push: vi.fn() }),
}));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ user: h.user, setError: vi.fn(), setSuccess: vi.fn() }) }));
vi.mock('../../contexts/BadgeContext', () => ({
  useBadge: () => ({
    pendingChallengesByChallenge: { 11: 2 }, challengeUpdatesByChallenge: {}, challengeNeueBeitraegeByChallenge: {}, challengeNeueWartendByChallenge: {},
  }),
}));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: undefined }) }));
vi.mock('../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../hooks/useChallengeFormular', () => ({ useChallengeFormular: () => ({ anlegen: vi.fn(), bearbeiten: vi.fn() }) }));
vi.mock('../../hooks/useChallengeDelete', () => ({ useChallengeDelete: () => ({ handleDelete: vi.fn() }) }));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => ({
    data: schluessel.startsWith('challenges:bewahrte-stempel') ? [] : h.liste,
    loading: false, error: null, isStale: false, isOffline: false, refresh: vi.fn(), refreshLive: vi.fn(),
  }),
}));
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: ({ titel }: { titel: React.ReactNode }) => <header>{titel}</header>,
  AppKopfzeileGross: () => null,
}));

import AdminChallengesPage from '../../components/admin/pages/AdminChallengesPage';
import { inFassung, leerVon } from '../../seiten/beschreibung';
import { CHALLENGES_LEITUNG_LEER_TITEL, CHALLENGES_LEITUNG_REITER } from '../../seiten/challengesLeitung';

const tage = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000).toISOString();
const challenge = (id: number, extra: Record<string, unknown> = {}) => ({
  id, title: `Challenge ${id}`, description: `Aufgabe ${id}`, challenge_type: 'frei', audience: 'konfis_und_team',
  visibility: 'konfi_choice', moderated: true, allowed_media: ['text'], allow_multiple: true, badge_icon: 'flag',
  badge_name: `Stempel ${id}`, starts_at: tage(-5), ends_at: tage(9), is_draft: false, jahrgaenge: [],
  submission_count: 0, pending_count: 0, own_submission_count: 0, ...extra,
});
const ALLE = [challenge(11), challenge(12, { starts_at: tage(20), ends_at: tage(30) }), challenge(13, { starts_at: tage(-40), ends_at: tage(-20) })];

/** Die Beschriftung ohne Zahl: der Text ohne die Zahl am Reiter (App) bzw. am Chip (Web). */
const ohneZahl = (el: Element) => {
  let text = el.textContent ?? '';
  el.querySelectorAll('.app-segment-zahl, .web-chip__zahl').forEach((z) => { text = text.replace(z.textContent ?? '', ''); });
  return text.trim();
};

beforeEach(() => { localStorage.clear(); h.liste = ALLE; });
afterEach(() => cleanup());

describe('App und Browser zeigen die Reiter der Beschreibung', () => {
  it('App: Aktuell, Geplant, Archiv -- mit der orangen Zahl am Reiter Aktuell', async () => {
    h.breit = false;
    const { container } = render(<AdminChallengesPage />);
    const namen = () => [...container.querySelectorAll('ion-segment-button ion-label')].map(ohneZahl);
    await waitFor(() => expect(namen()).toEqual(inFassung(CHALLENGES_LEITUNG_REITER, 'app').map((r) => r.label)));
    expect(namen()).toEqual(['Aktuell', 'Geplant', 'Archiv']);
    expect(container.querySelector('ion-segment-button .app-segment-zahl')?.getAttribute('aria-label')).toBe('2 warten auf Freigabe');
  });

  it('Browser: dieselben Namen, dazu Alle und Wartet auf Freigabe', () => {
    h.breit = true;
    render(<AdminChallengesPage />);
    const gruppe = screen.getByRole('group', { name: 'Challenges nach Zustand' });
    const namen = within(gruppe).getAllByRole('button').map(ohneZahl);
    expect(namen).toEqual(inFassung(CHALLENGES_LEITUNG_REITER, 'web').map((r) => r.label));
    expect(namen).toEqual(['Aktuell', 'Geplant', 'Archiv', 'Alle', 'Wartet auf Freigabe']);
    // Die App-Reiter stehen in derselben Reihenfolge vorn.
    expect(namen.slice(0, 3)).toEqual(inFassung(CHALLENGES_LEITUNG_REITER, 'app').map((r) => r.label));
    expect(within(gruppe).getByRole('button', { name: /^Wartet auf Freigabe/ })).toHaveTextContent('2 Beiträge warten auf Freigabe');
  });

  it('nur im Browser stehen, was die Beschreibung als nurIn web begründet', () => {
    const nurWeb = CHALLENGES_LEITUNG_REITER.filter((r) => r.nurIn === 'web');
    expect(nurWeb.map((r) => r.schluessel)).toEqual(['alle', 'wartet']);
    for (const r of nurWeb) expect(r.warum?.length ?? 0).toBeGreaterThan(20);
  });
});

describe('Leerzustände je Reiter: dieselben Worte', () => {
  it('Browser: Archiv ohne beendete Challenge', () => {
    h.liste = [challenge(11)];
    h.breit = true;
    render(<AdminChallengesPage />);
    fireEvent.click(within(screen.getByRole('group', { name: 'Challenges nach Zustand' })).getByRole('button', { name: /^Archiv/ }));
    expect(screen.getByText(CHALLENGES_LEITUNG_LEER_TITEL.archiv)).toBeInTheDocument();
    expect(screen.getByText(leerVon(CHALLENGES_LEITUNG_REITER, 'archiv'))).toBeInTheDocument();
  });

  it('App: Aktuell ohne laufende Challenge', () => {
    h.liste = [];
    h.breit = false;
    const { container } = render(<AdminChallengesPage />);
    expect(container.textContent).toContain(CHALLENGES_LEITUNG_LEER_TITEL.aktuell);
    expect(container.textContent).toContain(leerVon(CHALLENGES_LEITUNG_REITER, 'aktuell'));
  });
});
