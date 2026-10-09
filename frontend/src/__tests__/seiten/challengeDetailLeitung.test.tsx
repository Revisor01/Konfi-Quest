// Seite einer Challenge für Team und Leitung: App und Browser zeigen
// dieselben Reiter über den Beiträgen, beide aus seiten/challengeDetailLeitung.ts
// (09.10.2026). Gerendert wird die echte Seite (ChallengeLeitungPage), einmal
// schmal (App), einmal breit (Web-Fassung).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, within, cleanup, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => ({
  breit: true,
  apiGet: vi.fn(),
  user: { id: 4, type: 'admin', organization_id: 1, role_name: 'org_admin' } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonRouter: () => ({ push: vi.fn() }),
  useIonAlert: () => [vi.fn(), vi.fn()],
  useIonModal: () => [vi.fn(), vi.fn()],
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: vi.fn(), setSuccess: vi.fn() }),
}));
vi.mock('../../contexts/BadgeContext', () => ({
  useBadge: () => ({
    pendingChallengesByChallenge: {}, challengeUpdatesByChallenge: {}, challengeNeueBeitraegeByChallenge: {}, challengeNeueWartendByChallenge: {},
    markChallengeAsRead: vi.fn(async () => undefined), refreshAllCounts: vi.fn(async () => undefined),
  }),
}));
vi.mock('../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../services/api', () => ({ default: { get: h.apiGet, put: vi.fn(), delete: vi.fn() } }));
vi.mock('../../hooks/useChallengeFormular', () => ({ useChallengeFormular: () => ({ anlegen: vi.fn(), bearbeiten: vi.fn() }) }));
vi.mock('../../hooks/useDateiOeffnen', () => ({ useDateiOeffnen: () => ({ dateiOeffnen: vi.fn() }) }));
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: ({ titel }: { titel: React.ReactNode }) => <header>{titel}</header>,
  AppKopfzeileGross: () => null,
}));

import ChallengeLeitungPage from '../../components/shared/ChallengeLeitungPage';
import { CHALLENGE_DETAIL_FEED_WARTET, detailReiterFuer } from '../../seiten/challengeDetailLeitung';

const tage = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000).toISOString();
const CHALLENGE = {
  id: 7, title: 'Fürbitten zum Erntedank', description: 'Schreibt eine Bitte.', challenge_type: 'frei',
  audience: 'konfis_und_team', visibility: 'konfi_choice', moderated: true, allowed_media: ['text'], allow_multiple: true,
  badge_icon: 'heart', badge_name: 'Fürbitter:in', starts_at: tage(-5), ends_at: tage(9), is_draft: false,
  jahrgaenge: [], submission_count: 1, pending_count: 1, own_submission_count: 0,
};
const WARTEND = {
  id: 3, user_id: 33, media_type: 'text', text_content: 'Text', file_path: null, file_name: null, link_url: null,
  konfi_consent: 'publish', moderation_status: 'pending', moderation_note: null, created_at: tage(-1), display_name: 'Mara Probe',
};

const antworten = (challenge: Record<string, unknown>, beitraege: unknown[] = []) => {
  h.apiGet.mockImplementation(async (route: string) => {
    if (route === '/challenges/admin/7') return { data: challenge };
    if (route === '/challenges/admin/7/submissions') return { data: { challenge, submissions: beitraege } };
    throw new Error(`unerwartet: ${route}`);
  });
};

/** Die Beschriftung ohne Zahl: der Text ohne die Zahl am Reiter (App) bzw. am Chip (Web). */
const ohneZahl = (el: Element) => {
  let text = el.textContent ?? '';
  el.querySelectorAll('.app-segment-zahl, .web-chip__zahl').forEach((z) => { text = text.replace(z.textContent ?? '', ''); });
  return text.trim();
};

const appReiter = async () => {
  h.breit = false;
  const { container } = render(<ChallengeLeitungPage challengeId={7} onBack={vi.fn()} />);
  await waitFor(() => expect(container.querySelectorAll('ion-segment-button').length).toBeGreaterThan(0));
  return [...container.querySelectorAll('ion-segment-button ion-label')].map(ohneZahl);
};
const webReiter = async () => {
  h.breit = true;
  render(<ChallengeLeitungPage challengeId={7} onBack={vi.fn()} />);
  const gruppe = await screen.findByRole('group', { name: 'Beiträge nach Zustand' });
  return within(gruppe).getAllByRole('button').map(ohneZahl);
};

beforeEach(() => { localStorage.clear(); h.apiGet.mockReset(); });
afterEach(() => cleanup());

const FAELLE: Array<[string, Record<string, unknown>]> = [
  ['mit Freigabe-Pflicht', CHALLENGE],
  ['ohne Freigabe-Pflicht', { ...CHALLENGE, moderated: false }],
  ['nur Leitung (keine Gruppen-Galerie)', { ...CHALLENGE, visibility: 'private' }],
];

describe('App und Browser zeigen dieselben Reiter wie die Beschreibung', () => {
  it.each(FAELLE)('%s', async (_name, challenge) => {
    antworten(challenge);
    const erwartet = detailReiterFuer(challenge).map((r) => r.label);
    expect(await appReiter()).toEqual(erwartet);
    cleanup();
    expect(await webReiter()).toEqual(erwartet);
  });

  it('die Beschreibung selbst: Feed, Wartet, Abgelehnt, Meins -- Wartet nur mit Freigabe, Abgelehnt nicht bei nur Leitung', () => {
    expect(detailReiterFuer(CHALLENGE).map((r) => r.label)).toEqual(['Feed', 'Wartet', 'Abgelehnt', 'Meins']);
    expect(detailReiterFuer({ ...CHALLENGE, moderated: false }).map((r) => r.label)).toEqual(['Feed', 'Abgelehnt', 'Meins']);
    expect(detailReiterFuer({ ...CHALLENGE, visibility: 'private' }).map((r) => r.label)).toEqual(['Feed', 'Wartet', 'Meins']);
  });
});

describe('Leerer Feed, aber etwas wartet: derselbe Hinweis in beiden Fassungen', () => {
  // Bis 09.10.2026 stand er in der App mit geraden Anführungszeichen ("Wartet").
  it('App', async () => {
    antworten(CHALLENGE, [WARTEND]);
    h.breit = false;
    const { container } = render(<ChallengeLeitungPage challengeId={7} onBack={vi.fn()} />);
    await waitFor(() => expect(container.textContent).toContain(CHALLENGE_DETAIL_FEED_WARTET));
    expect(CHALLENGE_DETAIL_FEED_WARTET).toContain('„Wartet“');
  });

  it('Browser', async () => {
    antworten(CHALLENGE, [WARTEND]);
    h.breit = true;
    render(<ChallengeLeitungPage challengeId={7} onBack={vi.fn()} />);
    expect(await screen.findByText(CHALLENGE_DETAIL_FEED_WARTET)).toBeInTheDocument();
    // Wer auf "Wartet" wechselt, findet den Beitrag.
    fireEvent.click(within(screen.getByRole('group', { name: 'Beiträge nach Zustand' })).getByRole('button', { name: /^Wartet/ }));
    expect(await screen.findByText('Text')).toBeInTheDocument();
  });
});
