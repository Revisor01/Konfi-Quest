import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import KonfiChallengeDetailPage from '../../../components/konfi/pages/KonfiChallengeDetailPage';

// Das Gegenstueck zum Chat-Raum: Wer die Challenge oeffnet, hat sie gesehen.
// Ohne diesen Aufruf bliebe die rote Zahl am Eintrag, am Reiter und am
// App-Symbol stehen, egal wie oft man hineinsieht (24.09.2026).
//
// Seit 2.4.0 ist die Challenge eine eigene Seite statt eines Dialogs; sie
// meldet sich, sobald sie geladen ist -- eine geloeschte gibt es nicht zu
// lesen.

const { setError } = vi.hoisted(() => ({ setError: vi.fn() }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ setError })
}));

const markChallengeAsRead = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../contexts/BadgeContext', () => ({
  useBadge: () => ({ markChallengeAsRead: (...args: unknown[]) => markChallengeAsRead(...args) })
}));

vi.mock('../../../services/api', () => ({
  default: { get: vi.fn() }
}));

import api from '../../../services/api';

const vorZweiWochen = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();
const inEinerWoche = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

const aktiv = {
  id: 5,
  title: 'Foto-Challenge',
  description: 'Mach ein Foto',
  visibility: 'private',
  is_draft: false,
  allow_multiple: false,
  starts_at: vorZweiWochen,
  ends_at: inEinerWoche
};

describe('KonfiChallengeDetailPage: Oeffnen meldet die Challenge als gelesen', () => {
  beforeEach(() => {
    markChallengeAsRead.mockClear();
    vi.mocked(api.get).mockResolvedValue({ data: { challenge: aktiv, gallery: [], own_submissions: [] } });
  });

  it('ruft markChallengeAsRead genau einmal mit der Challenge-ID', async () => {
    render(<KonfiChallengeDetailPage challengeId={aktiv.id} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(markChallengeAsRead).toHaveBeenCalledTimes(1);
    });
    expect(markChallengeAsRead).toHaveBeenCalledWith(5);
  });

  it('solange die Challenge laedt, meldet die Seite nichts', () => {
    vi.mocked(api.get).mockReturnValue(new Promise(() => undefined));
    render(<KonfiChallengeDetailPage challengeId={aktiv.id} onBack={vi.fn()} />);

    expect(markChallengeAsRead).not.toHaveBeenCalled();
  });

  it('eine geloeschte Challenge (404) meldet die Seite nicht als gelesen', async () => {
    vi.mocked(api.get).mockRejectedValue(Object.assign(new Error('404'), { response: { status: 404 } }));
    const { container } = render(<KonfiChallengeDetailPage challengeId={aktiv.id} onBack={vi.fn()} />);

    await waitFor(() => expect(container.textContent).toContain('Diese Challenge gibt es nicht mehr'));
    expect(markChallengeAsRead).not.toHaveBeenCalled();
  });
});
