// Seite einer Challenge für Konfis: App und Browser zeigen dieselben Reiter
// (Feed, Meins) und dieselben Leertexte, beide aus seiten/challengeDetailKonfi.ts
// (09.10.2026). Gerendert wird die echte Seite, schmal (App) und breit (Web).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, within, cleanup, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => ({ breit: true, apiGet: vi.fn() }));

vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonRouter: () => ({ push: vi.fn() }),
  useIonModal: () => [vi.fn(), vi.fn()],
}));
vi.mock('../../contexts/AppContext', () => {
  const stabil = { user: { id: 31, type: 'konfi', organization_id: 1 }, setError: vi.fn() };
  return { useApp: () => stabil };
});
vi.mock('../../contexts/BadgeContext', () => ({
  useBadge: () => ({ markChallengeAsRead: vi.fn(), challengeUpdatesByChallenge: {} }),
}));
vi.mock('../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../services/api', () => ({ default: { get: h.apiGet } }));
vi.mock('../../hooks/useDateiOeffnen', () => ({ useDateiOeffnen: () => ({ dateiOeffnen: vi.fn() }) }));
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: ({ titel }: { titel: React.ReactNode }) => <header>{titel}</header>,
  AppKopfzeileGross: () => null,
}));

import KonfiChallengeDetailPage from '../../components/konfi/pages/KonfiChallengeDetailPage';
import { CHALLENGE_DETAIL_KONFI_REITER, konfiDetailLeer } from '../../seiten/challengeDetailKonfi';

const tage = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000).toISOString();
const CHALLENGE = {
  id: 7, title: 'Mein Lieblingsplatz', description: 'Fotografiert den Ort.', challenge_type: 'frei', audience: 'konfis',
  visibility: 'public', moderated: false, allowed_media: ['text'], allow_multiple: true, badge_icon: 'camera',
  badge_name: 'Fotograf:in', starts_at: tage(-8), ends_at: tage(6), is_draft: false,
};
const antworten = (challenge: Record<string, unknown> = CHALLENGE) => {
  h.apiGet.mockResolvedValue({ data: { challenge, gallery: [], own_submissions: [] } });
};
/** Die Beschriftung ohne Zahl: der Text ohne die Zahl am Reiter (App) bzw. am Chip (Web). */
const ohneZahl = (el: Element) => {
  let text = el.textContent ?? '';
  el.querySelectorAll('.app-segment-zahl, .web-chip__zahl').forEach((z) => { text = text.replace(z.textContent ?? '', ''); });
  return text.trim();
};

beforeEach(() => { localStorage.clear(); h.apiGet.mockReset(); antworten(); });
afterEach(() => cleanup());

describe('App und Browser zeigen dieselben Reiter wie die Beschreibung', () => {
  const erwartet = CHALLENGE_DETAIL_KONFI_REITER.map((r) => r.label);

  it('App', async () => {
    h.breit = false;
    const { container } = render(<KonfiChallengeDetailPage challengeId={7} onBack={vi.fn()} />);
    await waitFor(() => expect(container.querySelectorAll('ion-segment-button').length).toBeGreaterThan(0));
    expect([...container.querySelectorAll('ion-segment-button ion-label')].map(ohneZahl)).toEqual(erwartet);
  });

  it('Browser', async () => {
    h.breit = true;
    render(<KonfiChallengeDetailPage challengeId={7} onBack={vi.fn()} />);
    const gruppe = await screen.findByRole('group', { name: 'Beiträge' });
    expect(within(gruppe).getAllByRole('button').map(ohneZahl)).toEqual(erwartet);
  });

  it('bei "nur Leitung" fehlt die Leiste in beiden Fassungen', async () => {
    antworten({ ...CHALLENGE, visibility: 'private' });
    h.breit = false;
    const app = render(<KonfiChallengeDetailPage challengeId={7} onBack={vi.fn()} />);
    await waitFor(() => expect(app.container.textContent).toContain(konfiDetailLeer('meins', true, 'app').titel));
    expect(app.container.querySelector('ion-segment-button')).toBeNull();
    cleanup();
    h.breit = true;
    render(<KonfiChallengeDetailPage challengeId={7} onBack={vi.fn()} />);
    await screen.findByText(konfiDetailLeer('meins', true, 'web').text);
    expect(screen.queryByRole('group', { name: 'Beiträge' })).toBeNull();
  });
});

describe('Leertexte aus der Beschreibung -- „Meins" nennt je Fassung den Knopf, den es dort gibt', () => {
  it('App: Feed; Meins (bei "nur Leitung" der einzige Bereich) mit dem Plus', async () => {
    h.breit = false;
    const feed = render(<KonfiChallengeDetailPage challengeId={7} onBack={vi.fn()} />);
    await waitFor(() => expect(feed.container.textContent).toContain(konfiDetailLeer('feed', true, 'app').text));
    cleanup();
    antworten({ ...CHALLENGE, visibility: 'private' });
    const meins = render(<KonfiChallengeDetailPage challengeId={7} onBack={vi.fn()} />);
    await waitFor(() => expect(meins.container.textContent).toContain('Tippe oben auf das Plus, um etwas einzureichen.'));
  });

  it('Browser: Meins mit „Beitrag einreichen"', async () => {
    h.breit = true;
    render(<KonfiChallengeDetailPage challengeId={7} onBack={vi.fn()} />);
    expect(await screen.findByText(konfiDetailLeer('feed', true, 'web').text)).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('group', { name: 'Beiträge' })).getByRole('button', { name: /^Meins/ }));
    expect(await screen.findByText('Reiche oben rechts über „Beitrag einreichen“ deinen Beitrag ein.')).toBeInTheDocument();
  });
});
