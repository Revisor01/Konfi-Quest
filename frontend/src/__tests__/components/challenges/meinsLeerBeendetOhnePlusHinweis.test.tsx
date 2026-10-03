import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import KonfiChallengeDetailPage from '../../../components/konfi/pages/KonfiChallengeDetailPage';

// Beendete Challenge, Reiter "Meins", kein eigener Beitrag: Der Leerzustand
// sagte "Tippe oben auf das Plus, um etwas einzureichen" — aber das Plus gibt
// es bei beendeten Challenges gar nicht (canSubmitMore verlangt isActive).
// Der Hinweis zeigte auf einen Knopf, der nicht existiert.

// Stabile Identitaet wie im echten Kontext (setError per useCallback): Eine
// je Rendern neue Attrappe liesse das Laden endlos neu anlaufen.
const { setError } = vi.hoisted(() => ({ setError: vi.fn() }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ setError })
}));

// Das Detail meldet sich beim Oeffnen als gelesen (Neuigkeiten-Zaehler,
// 24.09.2026) -- hier nicht Gegenstand, nur stillgelegt.
vi.mock('../../../contexts/BadgeContext', () => ({
  useBadge: () => ({ markChallengeAsRead: vi.fn() })
}));

const detailAntwort = (challenge: Record<string, unknown>) => ({
  data: { challenge, gallery: [], own_submissions: [] }
});

const basisChallenge = {
  id: 5,
  title: 'Foto-Challenge',
  description: 'Mach ein Foto',
  visibility: 'private', // keine Gruppen-Galerie -> es zaehlt nur "Meins"
  is_draft: false,
  allow_multiple: false
};

const vorEinerWoche = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
const vorZweiWochen = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
const inEinerWoche = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn() }
}));

import api from '../../../services/api';

describe('KonfiChallengeDetailPage: Leerzustand "Meins" ohne toten Plus-Hinweis', () => {
  it('beendete Challenge ohne eigenen Beitrag: KEIN Hinweis auf das Plus', async () => {
    const beendet = { ...basisChallenge, starts_at: vorZweiWochen, ends_at: vorEinerWoche };
    vi.mocked(api.get).mockResolvedValue(detailAntwort(beendet));

    const { container } = render(
      <KonfiChallengeDetailPage challengeId={beendet.id} onBack={vi.fn()} />
    );

    await waitFor(() => {
      expect(container.textContent).toContain('Noch kein Beitrag von dir');
    });
    expect(container.textContent).not.toContain('Tippe oben auf das Plus');
    expect(container.textContent).toContain('Diese Challenge ist beendet');
  });

  it('laufende Challenge ohne eigenen Beitrag: Hinweis auf das Plus bleibt', async () => {
    const aktiv = { ...basisChallenge, starts_at: vorZweiWochen, ends_at: inEinerWoche };
    vi.mocked(api.get).mockResolvedValue(detailAntwort(aktiv));

    const { container } = render(
      <KonfiChallengeDetailPage challengeId={aktiv.id} onBack={vi.fn()} />
    );

    await waitFor(() => {
      expect(container.textContent).toContain('Tippe oben auf das Plus, um etwas einzureichen.');
    });
  });
});
