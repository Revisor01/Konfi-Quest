// Welches Fenster aufgeht: im Browser ab 992 px die Fenster der Web-Fassung
// (WebChallengeDialog, WebBeitragDialog), in den Apps und im schmalen Fenster
// die Modale der App (ChallengeManageModal, ChallengeSubmitModal über
// useIonModal) -- Simon, 15.10.2026. Geprüft an den Seiten selbst: der Liste
// von Leitung und Team (Neue Challenge, Bearbeiten), der Seite einer
// Challenge für Leitung und Team (Challenge bearbeiten, Beitrag einreichen)
// und der Seite einer Challenge für Konfis (Beitrag einreichen). Danach
// dasselbe wie nach dem Modal: Liste bzw. Beiträge laden neu.
//
// Was in den Fenstern geschieht, prüfen webChallengeDialog.test.tsx und
// webBeitragDialog.test.tsx je Fassung.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within, cleanup, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  breit: true,
  push: vi.fn(),
  presentModal: vi.fn(),
  presentAlert: vi.fn(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  refresh: vi.fn(),
  triggerRefresh: vi.fn(),
  markChallengeAsRead: vi.fn(async () => undefined),
  refreshAllCounts: vi.fn(async () => undefined),
  liste: [] as unknown[],
  user: { id: 4, type: 'admin', organization_id: 1, role_name: 'org_admin' } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  // Die Knöpfe der App als echte Knöpfe (ion-button hat in jsdom keine Rolle).
  IonButton: ({ children, onClick, disabled, 'aria-label': name }: { children?: React.ReactNode; onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) => (
    <button type="button" aria-label={name} onClick={onClick} disabled={disabled}>{children}</button>
  ),
  useIonRouter: () => ({ push: h.push }),
  useIonAlert: () => [h.presentAlert, vi.fn()],
  useIonModal: () => [h.presentModal, vi.fn()],
}));
vi.mock('../../../contexts/AppContext', () => {
  // Stabile Identitäten wie im echten Kontext: Eine je Rendern neue Attrappe ließe das Laden endlos neu anlaufen.
  const stabil = { setError: vi.fn(), setSuccess: vi.fn(), isOnline: true };
  return { useApp: () => Object.assign(stabil, { user: h.user }) };
});
vi.mock('../../../contexts/BadgeContext', () => ({
  useBadge: () => ({
    pendingChallengesByChallenge: {}, challengeUpdatesByChallenge: {}, challengeNeueBeitraegeByChallenge: {}, challengeNeueWartendByChallenge: {},
    markChallengeAsRead: h.markChallengeAsRead, refreshAllCounts: h.refreshAllCounts,
  }),
}));
vi.mock('../../../contexts/LiveUpdateContext', () => ({
  useLiveRefresh: () => undefined,
  useLiveUpdate: () => ({ triggerRefresh: h.triggerRefresh, subscribe: () => () => undefined, socketEpoch: 0 }),
}));
vi.mock('../../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: undefined }),
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../services/api', () => ({
  default: {
    get: (u: string) => h.apiGet(u),
    post: (u: string, b?: unknown, o?: unknown) => h.apiPost(u, b, o),
    put: (u: string, b?: unknown) => h.apiPut(u, b),
    delete: vi.fn(),
  },
}));
vi.mock('../../../hooks/useChallengeDelete', () => ({ useChallengeDelete: () => ({ handleDelete: vi.fn() }) }));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => ({
    data: schluessel.startsWith('challenges:bewahrte-stempel') ? [] : h.liste,
    loading: false, error: null, isStale: false, isOffline: false, refresh: h.refresh, refreshLive: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useDateiOeffnen', () => ({ useDateiOeffnen: () => ({ dateiOeffnen: vi.fn() }) }));
vi.mock('../../../components/shared/ChallengeMedium', () => ({ default: () => <div data-testid="medium" /> }));
// Die Kopfzeile der App mit ihren Knöpfen rechts (Bearbeiten, Einreichen).
vi.mock('../../../components/shared/AppKopfzeile', () => ({
  default: ({ titel, rechts }: { titel: React.ReactNode; rechts?: React.ReactNode }) => (
    <header data-testid="kopfzeile"><span>{titel}</span>{rechts}</header>
  ),
  AppKopfzeileGross: () => null,
}));

import AdminChallengesPage from '../../../components/admin/pages/AdminChallengesPage';
import TeamerChallengesPage from '../../../components/teamer/pages/TeamerChallengesPage';
import ChallengeLeitungPage from '../../../components/shared/ChallengeLeitungPage';
import KonfiChallengeDetailPage from '../../../components/konfi/pages/KonfiChallengeDetailPage';

const JETZT = new Date('2026-10-03T08:30:00Z').getTime();
const tage = (n: number) => new Date(JETZT + n * 24 * 3600 * 1000).toISOString();

const LAUFEND = {
  id: 7,
  title: 'Fürbitten zum Erntedank',
  description: 'Schreibt eine Bitte in einem Satz.',
  challenge_type: 'frei',
  audience: 'konfis_und_team',
  visibility: 'public',
  moderated: false,
  allowed_media: ['text'],
  allow_multiple: true,
  badge_icon: 'heart',
  badge_name: 'Fürbitter:in',
  starts_at: tage(-5),
  ends_at: tage(9),
  is_draft: false,
  locked: true,
  jahrgaenge: [{ id: 1, name: '2026/2027' }],
  submission_count: 0,
  pending_count: 0,
  own_submission_count: 0,
  has_badge: false,
  status: 'active',
};

const LEITUNG = { id: 4, type: 'admin', organization_id: 1, role_name: 'org_admin' };
const TEAMERIN = { id: 13, type: 'teamer', organization_id: 1, role_name: 'teamer' };
const KONFI = { id: 31, type: 'konfi', organization_id: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  h.breit = true;
  h.user = LEITUNG;
  h.liste = [LAUFEND];
  h.apiGet.mockImplementation(async (route: string) => {
    if (route === '/admin/jahrgaenge') return { data: [{ id: 1, name: '2026/2027' }] };
    if (route === '/challenges/admin/7') return { data: LAUFEND };
    if (route === '/challenges/admin/7/submissions') return { data: { challenge: LAUFEND, submissions: [] } };
    if (route === '/challenges/konfi/7') return { data: { challenge: LAUFEND, gallery: [], own_submissions: [] } };
    if (route.startsWith('/challenges')) return { data: [] };
    throw new Error(`unerwartet: ${route}`);
  });
  h.apiPost.mockResolvedValue({ data: { id: 99 } });
  h.apiPut.mockResolvedValue({ data: {} });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(JETZT));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

/** Wartet, bis das Formular geladen ist und Eingaben als Änderung zählen (100 ms). */
const formularBereit = async () => {
  await screen.findByLabelText('Titel');
  await act(async () => { await new Promise((r) => setTimeout(r, 130)); });
};

describe('Liste der Challenges (Leitung, Team): Neue Challenge und Bearbeiten', () => {
  it.each([
    ['Leitung', LEITUNG, <AdminChallengesPage key="a" />],
    ['Team', TEAMERIN, <TeamerChallengesPage key="t" />],
  ])('%s im Browser: „Neue Challenge" öffnet das Fenster der Web-Fassung, nicht das Modal; nach dem Anlegen lädt die Liste neu', async (_rolle, user, seite) => {
    h.user = user;
    render(seite);
    fireEvent.click(screen.getByRole('button', { name: 'Neue Challenge' }));
    const dialog = await screen.findByRole('dialog', { name: 'Neue Challenge' });
    expect(h.presentModal).not.toHaveBeenCalled();

    await formularBereit();
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Gottesbilder' } });
    fireEvent.change(screen.getByLabelText('Beschreibung'), { target: { value: 'Malt euer Bild.' } });
    fireEvent.change(screen.getByLabelText('Name des Stempels'), { target: { value: 'Bildermacher:in' } });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: '2026/2027' }));
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Challenge anlegen' })); });

    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls[0][0]).toBe('/challenges/admin');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Neue Challenge' })).toBeNull());
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it('im Browser: Bearbeiten öffnet das Fenster mit dieser Challenge', async () => {
    render(<AdminChallengesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Bearbeiten: Fürbitten zum Erntedank' }));
    await screen.findByRole('dialog', { name: 'Challenge bearbeiten' });
    await formularBereit();
    expect((screen.getByLabelText('Titel') as HTMLInputElement).value).toBe('Fürbitten zum Erntedank');
    expect(h.presentModal).not.toHaveBeenCalled();
  });

  it('in der App: „Neue Challenge anlegen" öffnet das Modal der App mit der Rückfrage bei Änderungen -- kein Fenster', () => {
    h.breit = false;
    render(<AdminChallengesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neue Challenge anlegen' }));
    expect(h.presentModal).toHaveBeenCalledTimes(1);
    expect(h.presentModal).toHaveBeenCalledWith(expect.objectContaining({ canDismiss: expect.any(Function), backdropDismiss: false }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Seite einer Challenge für Leitung und Team', () => {
  const beitraegeGeladen = () => h.apiGet.mock.calls.filter(([r]) => r === '/challenges/admin/7/submissions').length;
  const zeigen = async () => {
    render(<ChallengeLeitungPage challengeId={7} onBack={vi.fn()} />);
    await screen.findByRole('button', { name: 'Beitrag einreichen' });
    // Erst wenn die Beiträge einmal geladen sind, ist die Seite fertig. Sonst
    // kommt dieses erste Laden unter Last erst nach dem Zählen an (CI,
    // 16.10.2026: 2 statt 1), und das Nachladen nach dem Einreichen ist nicht
    // mehr von ihm zu unterscheiden.
    await waitFor(() => expect(beitraegeGeladen()).toBe(1));
  };

  it('im Browser: „Challenge bearbeiten" öffnet das Fenster mit dieser Challenge', async () => {
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Challenge bearbeiten' }));
    await screen.findByRole('dialog', { name: 'Challenge bearbeiten' });
    await formularBereit();
    expect((screen.getByLabelText('Titel') as HTMLInputElement).value).toBe('Fürbitten zum Erntedank');
    expect(h.presentModal).not.toHaveBeenCalled();
  });

  it('im Browser: „Beitrag einreichen" öffnet „Dein Beitrag"; danach Fenster zu, Beiträge und Zähler neu', async () => {
    await zeigen();
    const vorher = beitraegeGeladen();
    fireEvent.click(screen.getByRole('button', { name: 'Beitrag einreichen' }));
    const dialog = screen.getByRole('dialog', { name: 'Dein Beitrag' });
    expect(h.presentModal).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('Dein Text'), { target: { value: 'Für alle, die trauern.' } });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Beitrag einreichen' })); });

    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    expect(h.apiPost).toHaveBeenCalledWith('/challenges/konfi/7/submissions', {
      media_type: 'text', text_content: 'Für alle, die trauern.', link_url: null, konfi_consent: null,
    }, undefined);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Dein Beitrag' })).toBeNull());
    await waitFor(() => expect(beitraegeGeladen()).toBe(vorher + 1));
    expect(h.refreshAllCounts).toHaveBeenCalled();
    expect(h.triggerRefresh).toHaveBeenCalledWith('challenges');
  });

  it('in der App: Bearbeiten und Einreichen öffnen die Modale der App -- kein Fenster', async () => {
    h.breit = false;
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Challenge bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: 'Beitrag einreichen' }));
    expect(h.presentModal).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Seite einer Challenge für Konfis', () => {
  const zeigen = async () => {
    h.user = KONFI;
    render(<KonfiChallengeDetailPage challengeId={7} onBack={vi.fn()} />);
    await screen.findByRole('button', { name: 'Beitrag einreichen' });
  };

  it('im Browser: „Beitrag einreichen" öffnet „Dein Beitrag"; danach Fenster zu, Galerie und Liste neu', async () => {
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Beitrag einreichen' }));
    const dialog = screen.getByRole('dialog', { name: 'Dein Beitrag' });
    expect(h.presentModal).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText('Dein Text'), { target: { value: 'Mein Platz ist am Deich.' } });
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Beitrag einreichen' })); });

    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/challenges/konfi/7/submissions', {
      media_type: 'text', text_content: 'Mein Platz ist am Deich.', link_url: null, konfi_consent: null,
    }, undefined));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Dein Beitrag' })).toBeNull());
    expect(h.triggerRefresh).toHaveBeenCalledWith('challenges');
  });

  it('in der App: „Beitrag einreichen" öffnet das Modal der App -- kein Fenster', async () => {
    h.breit = false;
    await zeigen();
    fireEvent.click(screen.getByRole('button', { name: 'Beitrag einreichen' }));
    expect(h.presentModal).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
