import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';

// Lint-Durchsicht 30.08.2026, Gegenstueck zum Konfi/Teamer-Fund
// (requestDetailModalFoto.test.tsx): Auch die Leitungs-Detailansicht eines
// Antrags laedt das Nachweisfoto als Blob-URL — gab sie beim Schliessen aber
// nie frei. Ein Blob pro angesehenem Foto blieb bis zum App-Neustart im
// Speicher.

// --- Mocks ---

const mockApiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    setSuccess: vi.fn(),
    setError: vi.fn(),
    isOnline: true,
  }),
}));

vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: (fn: () => unknown) => fn() }),
}));

vi.mock('../../services/writeQueue', () => ({
  writeQueue: { enqueue: vi.fn() },
}));

vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: vi.fn(() => () => {}) },
}));

vi.mock('../../utils/uuid', () => ({ safeUUID: () => 'test-uuid' }));

import ActivityRequestModal from '../../components/admin/modals/ActivityRequestModal';

const antrag = {
  id: 41,
  konfi_id: 7,
  konfi_name: 'Emilia Test',
  activity_id: 3,
  activity_name: 'Gottesdienst besucht',
  activity_points: 2,
  activity_type: 'gottesdienst',
  requested_date: '2026-08-20',
  photo_filename: 'foto-41.jpg',
  status: 'pending',
  created_at: '2026-08-20T10:00:00Z',
  updated_at: '2026-08-20T10:00:00Z',
};

const revokeMock = vi.fn();

beforeEach(() => {
  revokeMock.mockClear();
  mockApiGet.mockReset();
  mockApiGet.mockImplementation((url: string) => {
    if (url === '/admin/activities/requests') {
      return Promise.resolve({ data: [antrag] });
    }
    return Promise.resolve({ data: new Blob(['jpegdata'], { type: 'image/jpeg' }) });
  });
  vi.stubGlobal('URL', Object.assign(Object.create(URL), {
    createObjectURL: vi.fn(() => 'blob:admin-test-1'),
    revokeObjectURL: revokeMock,
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ActivityRequestModal (Leitung) — Foto-Blob-Verwaltung', () => {
  it('gibt die Blob-URL des Nachweisfotos beim Unmount frei', async () => {
    const { container, unmount } = render(
      <ActivityRequestModal requestId={41} onClose={vi.fn()} onSuccess={vi.fn()} />
    );

    await waitFor(() => {
      const img = container.querySelector('img[src="blob:admin-test-1"]');
      expect(img).not.toBeNull();
    });

    unmount();

    expect(revokeMock).toHaveBeenCalledWith('blob:admin-test-1');
  });
});
