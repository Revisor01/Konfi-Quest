import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import KonfiChallengeDetailPage from '../../../components/konfi/pages/KonfiChallengeDetailPage';

// Eine Challenge, die endet, während ihr Detail offen ist, muss sich als
// beendet zeigen (Release-Audit 26.09.2026, Toolchain BF-12).
//
// Bis 29.09.2026 war „läuft" per useMemo an die Challenge gebunden und
// rechnete Date.now() nur, wenn sich die Challenge-Daten änderten. Endete
// sie bei offenem Detail, stand weiter „Worum geht es?" mit Restzeit — und
// das Plus zum Einreichen blieb, bis irgendetwas die Daten neu lud.
//
// Echte Zeit statt Uhr-Attrappe: Die Challenge endet 1,2 s nach dem Öffnen,
// der Test wartet höchstens 4 s.

// Stabile Funktionen wie im echten Kontext. Eine je Rendern neue
// setError-Attrappe ließe loadDetail bei jedem Rendern neu entstehen und das
// Detail endlos nachladen -- dann änderten sich die Daten ständig, und der
// Test sähe das Ende auch ohne Korrektur (so beim ersten Entwurf passiert).
const { setError, markChallengeAsRead } = vi.hoisted(() => ({
  setError: vi.fn(),
  markChallengeAsRead: vi.fn()
}));

vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ setError })
}));

vi.mock('../../../contexts/BadgeContext', () => ({
  useBadge: () => ({ markChallengeAsRead })
}));

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn() }
}));

import api from '../../../services/api';

const basisChallenge = {
  id: 7,
  title: 'Foto-Challenge',
  description: 'Mach ein Foto',
  visibility: 'private',
  is_draft: false,
  allow_multiple: false
};

const detailAntwort = (challenge: Record<string, unknown>) => ({
  data: { challenge, gallery: [], own_submissions: [] }
});

describe('KonfiChallengeDetailPage: Ende bei offener Challenge', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it('wechselt beim Ende von „Worum geht es?" auf „Worum ging es?" und „Beendet"', async () => {
    const start = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const ende = new Date(Date.now() + 1200).toISOString();
    const challenge = { ...basisChallenge, starts_at: start, ends_at: ende };
    vi.mocked(api.get).mockResolvedValue(detailAntwort(challenge));

    const { container } = render(
      <KonfiChallengeDetailPage challengeId={challenge.id} onBack={vi.fn()} />
    );

    await waitFor(() => {
      expect(container.textContent).toContain('Tippe oben auf das Plus, um etwas einzureichen.');
    });
    expect(container.textContent).toContain('Worum geht es?');

    await waitFor(() => {
      expect(container.textContent).toContain('Worum ging es?');
    }, { timeout: 4000 });
    expect(container.textContent).toContain('Beendet');
    expect(container.textContent).toContain('Diese Challenge ist beendet');
    expect(container.textContent).not.toContain('Tippe oben auf das Plus');
    // Genau ein Abruf: Der Wechsel kommt von der Uhr, nicht von neu geladenen Daten.
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('wechselt beim Start von „noch nicht aktiv" auf „läuft"', async () => {
    const start = new Date(Date.now() + 1200).toISOString();
    const ende = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const challenge = { ...basisChallenge, starts_at: start, ends_at: ende };
    vi.mocked(api.get).mockResolvedValue(detailAntwort(challenge));

    const { container } = render(
      <KonfiChallengeDetailPage challengeId={challenge.id} onBack={vi.fn()} />
    );

    await waitFor(() => {
      expect(container.textContent).toContain('Worum ging es?');
    });

    await waitFor(() => {
      expect(container.textContent).toContain('Worum geht es?');
    }, { timeout: 4000 });
    expect(container.textContent).toContain('Tippe oben auf das Plus, um etwas einzureichen.');
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});
