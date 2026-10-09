// Challenges der Konfis: App und Browser zeigen die Reiter aus
// seiten/challengesKonfi.ts (09.10.2026) -- „Aktuell" und „Archiv" in beiden
// Fassungen (bis dahin im Browser „Laufend" und „Beendet"). Gerendert wird
// die echte Seite, schmal (App) und breit (Web).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, within, cleanup, fireEvent, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({ breit: true, daten: undefined as unknown }));

vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonRouter: () => ({ push: vi.fn() }),
}));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ user: { id: 31, type: 'konfi', organization_id: 1 } }) }));
vi.mock('../../contexts/BadgeContext', () => ({ useBadge: () => ({ challengeUpdatesByChallenge: {} }) }));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: undefined }) }));
vi.mock('../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({ data: h.daten, loading: false, error: null, isStale: false, isOffline: false, refresh: vi.fn(), refreshLive: vi.fn() }),
}));
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: ({ titel }: { titel: React.ReactNode }) => <header>{titel}</header>,
  AppKopfzeileGross: () => null,
}));

import KonfiChallengesPage from '../../components/konfi/pages/KonfiChallengesPage';
import { inFassung, leerVon } from '../../seiten/beschreibung';
import { CHALLENGES_KONFI_LEER_TITEL, CHALLENGES_KONFI_REITER } from '../../seiten/challengesKonfi';

const tage = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000).toISOString();
const challenge = (id: number, extra: Record<string, unknown> = {}) => ({
  id, title: `Challenge ${id}`, description: `Aufgabe ${id}`, challenge_type: 'frei', audience: 'konfis',
  visibility: 'konfi_choice', moderated: true, allowed_media: ['text'], allow_multiple: true, badge_icon: 'flag',
  badge_name: `Stempel ${id}`, starts_at: tage(-5), ends_at: tage(9), is_draft: false, has_submission: false, own_submission_count: 0, ...extra,
});
const ANTWORT = { active: [challenge(11)], archive: [challenge(17, { starts_at: tage(-40), ends_at: tage(-20) })], marks: [], offene_stempel: [] };

const ohneZahl = (el: Element) => {
  let text = el.textContent ?? '';
  el.querySelectorAll('.app-segment-zahl, .web-chip__zahl').forEach((z) => { text = text.replace(z.textContent ?? '', ''); });
  return text.trim();
};

beforeEach(() => { localStorage.clear(); h.daten = ANTWORT; });
afterEach(() => cleanup());

describe('App und Browser zeigen die Reiter der Beschreibung', () => {
  it('App: Aktuell, Archiv', async () => {
    h.breit = false;
    const { container } = render(<KonfiChallengesPage />);
    const namen = () => [...container.querySelectorAll('ion-segment-button ion-label')].map(ohneZahl);
    await waitFor(() => expect(namen()).toEqual(inFassung(CHALLENGES_KONFI_REITER, 'app').map((r) => r.label)));
    expect(namen()).toEqual(['Aktuell', 'Archiv']);
  });

  it('Browser: dieselben Namen in derselben Reihenfolge, dazu Alle', () => {
    h.breit = true;
    render(<KonfiChallengesPage />);
    const namen = within(screen.getByRole('group', { name: 'Challenges nach Zustand' })).getAllByRole('button').map(ohneZahl);
    expect(namen).toEqual(inFassung(CHALLENGES_KONFI_REITER, 'web').map((r) => r.label));
    expect(namen).toEqual(['Aktuell', 'Archiv', 'Alle']);
  });
});

describe('Leerzustände je Reiter: dieselben Worte', () => {
  it('Browser: leeres Archiv', () => {
    h.daten = { ...ANTWORT, archive: [] };
    h.breit = true;
    render(<KonfiChallengesPage />);
    fireEvent.click(within(screen.getByRole('group', { name: 'Challenges nach Zustand' })).getByRole('button', { name: /^Archiv/ }));
    expect(screen.getByText(CHALLENGES_KONFI_LEER_TITEL.archiv)).toBeInTheDocument();
    expect(screen.getByText(leerVon(CHALLENGES_KONFI_REITER, 'archiv'))).toBeInTheDocument();
  });

  it('App: nichts läuft', () => {
    h.daten = { ...ANTWORT, active: [] };
    h.breit = false;
    const { container } = render(<KonfiChallengesPage />);
    expect(container.textContent).toContain(CHALLENGES_KONFI_LEER_TITEL.aktuell);
    expect(container.textContent).toContain(leerVon(CHALLENGES_KONFI_REITER, 'aktuell'));
  });
});
