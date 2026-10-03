import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup } from '@testing-library/react';

// Die Listen oeffnen eine Challenge als Seite statt als Dialog (2.4.0,
// Simon 02.10.2026: "challenge nicht in modal öffnen, sondern in
// unterseite"). Tippen fuehrt auf /<rolle>/challenges/<id> -- dieselbe
// Adresse, die auch Push und Postfach ansteuern (pushNavigation.ts).

const { push, useOfflineQuery, stabil } = vi.hoisted(() => ({
  push: vi.fn(),
  useOfflineQuery: vi.fn(),
  stabil: {
    user: { id: 4, type: 'teamer', organization_id: 1 },
    setError: vi.fn(),
    setSuccess: vi.fn(),
  },
}));

vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonRouter: () => ({ push }),
}));
vi.mock('../../../contexts/AppContext', () => ({ useApp: () => stabil }));
vi.mock('../../../contexts/BadgeContext', () => ({
  useBadge: () => ({
    challengeUpdatesByChallenge: {},
    pendingChallengesByChallenge: {},
    challengeNeueBeitraegeByChallenge: {},
    challengeNeueWartendByChallenge: {},
  }),
}));
vi.mock('../../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: undefined }),
}));
vi.mock('../../../hooks/useOfflineQuery', () => ({ useOfflineQuery }));
// Die Kopfzeile ist hier nicht Gegenstand (eigene Tests in appKopfzeile.test.tsx).
vi.mock('../../../components/shared/AppKopfzeile', () => ({
  default: () => null,
  AppKopfzeileGross: () => null,
}));

import KonfiChallengesPage from '../../../components/konfi/pages/KonfiChallengesPage';
import TeamerChallengesPage from '../../../components/teamer/pages/TeamerChallengesPage';

const vorZweiWochen = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
const inEinerWoche = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const challenge = {
  id: 5,
  title: 'Foto-Challenge',
  description: 'Mach ein Foto',
  visibility: 'public',
  moderated: true,
  is_draft: false,
  allow_multiple: true,
  allowed_media: ['photo'],
  badge_name: 'Fotograf:in',
  badge_icon: 'flag',
  starts_at: vorZweiWochen,
  ends_at: inEinerWoche,
  status: 'active',
};

const abfrage = (data: unknown) => ({
  data, loading: false, error: null, isStale: false, isOffline: false,
  refresh: vi.fn(), refreshLive: vi.fn(),
});

beforeEach(() => {
  push.mockClear();
  useOfflineQuery.mockReset();
});

afterEach(() => cleanup());

describe('Tippen auf eine Challenge oeffnet ihre Seite', () => {
  it('Konfis: /konfi/challenges/5', () => {
    useOfflineQuery.mockReturnValue(abfrage({ active: [challenge], archive: [], marks: [], offene_stempel: [] }));
    const { getByText } = render(<KonfiChallengesPage />);

    fireEvent.click(getByText('Foto-Challenge'));

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/konfi/challenges/5');
    // Kein Dialog mehr: Die Liste kennt die Detail-Ansicht gar nicht.
    expect(document.querySelector('ion-modal')).toBeNull();
  });

  it('Team: /teamer/challenges/5 (Leitung entsprechend /admin/challenges/5)', () => {
    useOfflineQuery.mockImplementation((schluessel: string) =>
      abfrage(schluessel.startsWith('challenges:bewahrte-stempel') ? [] : [challenge]));
    const { getAllByText } = render(<TeamerChallengesPage />);

    fireEvent.click(getAllByText('Foto-Challenge')[0]);

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/teamer/challenges/5');
    expect(document.querySelector('ion-modal')).toBeNull();
  });
});
