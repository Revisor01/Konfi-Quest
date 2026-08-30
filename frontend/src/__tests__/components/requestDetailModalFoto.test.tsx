import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';

// Lint-Durchsicht 30.08.2026: Der Foto-Effekt in RequestDetailModal hing an
// [request], das Cleanup las aber photoUrl aus der Closure des Effekt-Laufs —
// zu diesem Zeitpunkt immer noch der ALTE Wert (meist null). Folge:
// 1. Die Blob-URL des geladenen Fotos wurde beim Schliessen NIE freigegeben
//    (Speicherleck, ein Blob pro angesehenem Foto bis zum App-Neustart).
// 2. Beim Wechsel auf einen Antrag OHNE Foto blieb das alte Foto stehen —
//    das Modal zeigte das Bild des vorherigen Antrags.

// --- Mocks ---

const mockApiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    delete: vi.fn(),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    setError: vi.fn(),
  }),
}));

import RequestDetailModal, { ActivityRequest } from '../../components/konfi/modals/RequestDetailModal';

const baseRequest: ActivityRequest = {
  id: 41,
  activity_id: 7,
  activity_name: 'Gottesdienst besucht',
  activity_points: 2,
  activity_type: 'gottesdienst',
  requested_date: '2026-08-20',
  photo_filename: 'foto-41.jpg',
  status: 'pending',
  created_at: '2026-08-20T10:00:00Z',
  updated_at: '2026-08-20T10:00:00Z',
};

let createdUrls: string[];
const revokeMock = vi.fn();

beforeEach(() => {
  createdUrls = [];
  revokeMock.mockClear();
  mockApiGet.mockReset();
  mockApiGet.mockResolvedValue({ data: new Blob(['jpegdata'], { type: 'image/jpeg' }) });
  let n = 0;
  vi.stubGlobal('URL', Object.assign(Object.create(URL), {
    createObjectURL: vi.fn(() => {
      const url = `blob:test-${++n}`;
      createdUrls.push(url);
      return url;
    }),
    revokeObjectURL: revokeMock,
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RequestDetailModal — Foto-Blob-Verwaltung', () => {
  it('gibt die Blob-URL des geladenen Fotos beim Unmount frei', async () => {
    const { container, unmount } = render(
      <RequestDetailModal request={baseRequest} onClose={vi.fn()} />
    );

    await waitFor(() => {
      const img = container.querySelector('img[alt="Foto zur Aktivität"]');
      expect(img).not.toBeNull();
    });
    expect(createdUrls).toEqual(['blob:test-1']);

    unmount();

    expect(revokeMock).toHaveBeenCalledWith('blob:test-1');
  });

  it('zeigt beim Wechsel auf einen Antrag ohne Foto nicht das alte Foto und gibt dessen URL frei', async () => {
    const { container, rerender } = render(
      <RequestDetailModal request={baseRequest} onClose={vi.fn()} />
    );

    await waitFor(() => {
      const img = container.querySelector('img[alt="Foto zur Aktivität"]');
      expect(img?.getAttribute('src')).toBe('blob:test-1');
    });

    const ohneFoto: ActivityRequest = {
      ...baseRequest,
      id: 42,
      photo_filename: undefined,
    };
    rerender(<RequestDetailModal request={ohneFoto} onClose={vi.fn()} />);

    await waitFor(() => {
      const img = container.querySelector('img[alt="Foto zur Aktivität"]');
      expect(img).toBeNull();
    });
    expect(container.textContent).toContain('Kein Foto hochgeladen');
    expect(revokeMock).toHaveBeenCalledWith('blob:test-1');
  });
});
