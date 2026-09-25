import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import ChallengeDetailModal from '../../../components/konfi/modals/ChallengeDetailModal';

// Das Gegenstueck zum Chat-Raum: Wer die Challenge oeffnet, hat sie gesehen.
// Ohne diesen Aufruf bliebe die rote Zahl am Eintrag, am Reiter und am
// App-Symbol stehen, egal wie oft man hineinsieht (24.09.2026).

vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ setError: vi.fn() })
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

describe('ChallengeDetailModal: Oeffnen meldet die Challenge als gelesen', () => {
  beforeEach(() => {
    markChallengeAsRead.mockClear();
    vi.mocked(api.get).mockResolvedValue({ data: { challenge: aktiv, gallery: [], own_submissions: [] } });
  });

  it('ruft markChallengeAsRead genau einmal mit der Challenge-ID', async () => {
    render(<ChallengeDetailModal challenge={aktiv as never} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(markChallengeAsRead).toHaveBeenCalledTimes(1);
    });
    expect(markChallengeAsRead).toHaveBeenCalledWith(5);
  });

  it('die leere Huelle (Challenge noch nicht durchgereicht) meldet nichts', () => {
    render(<ChallengeDetailModal challenge={null} onClose={vi.fn()} />);

    expect(markChallengeAsRead).not.toHaveBeenCalled();
  });
});
