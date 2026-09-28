// Die Leitung lädt einen Antrag einzeln und die Anträge EINER Person
// (28.09.2026, Leitung BF-04).
//
// Vorher: Der Antragsdialog lud beim Öffnen EINES Antrags die ganze
// Antragsgeschichte der Gemeinde (GET /admin/activities/requests, ohne
// LIMIT) und suchte den einen per .find() heraus. Die Detailansicht einer
// Konfi lud dieselbe Gesamtliste und filtertete sie nach `konfi_id` — ein
// Feld, das die Liste seit der Umbenennung in `user_id` nicht mehr trägt: Die
// offenen Anträge der Person erschienen dort NIE.
//
// Geprüft wird Verhalten: welche Adresse gerufen wird und was danach zu sehen
// ist.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    put: vi.fn(async () => ({ data: {} })),
    post: vi.fn(async () => ({ data: {} })),
    delete: vi.fn(async () => ({ data: {} })),
  },
  DATEI_TIMEOUT_MS: 180000,
}));

const setError = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    setSuccess: vi.fn(),
    setError,
    isOnline: true,
    user: { id: 5, organization_id: 1, type: 'admin', role_name: 'org_admin' },
  }),
}));

vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveUpdate: () => ({ triggerRefresh: vi.fn() }),
  useLiveRefresh: () => {},
}));

vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: (fn: () => unknown) => fn() }),
}));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: vi.fn(() => () => {}) },
}));
vi.mock('../../services/analytics', () => ({ track: vi.fn(), trackHandlung: vi.fn() }));

// Kopfzeile, Abzeichen, Stempel und Rückblick haben eigene Tests und hängen
// an Kontexten, die hier nicht Thema sind.
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: () => null,
  AppKopfzeileGross: () => null,
}));
vi.mock('../../components/admin/views/KonfiBadgesSection', () => ({ default: () => null }));
vi.mock('../../components/shared/ChallengeStempelSektion', () => ({ default: () => null }));
vi.mock('../../components/wrapped/WrappedModal', () => ({ default: () => null }));

import ActivityRequestModal from '../../components/admin/modals/ActivityRequestModal';
import KonfiDetailView from '../../components/admin/views/KonfiDetailView';

const KONFI_ID = 9;

const antrag = {
  id: 41,
  user_id: KONFI_ID,
  konfi_name: 'Emilia Test',
  activity_id: 3,
  activity_name: 'Gemeindefest geholfen',
  activity_points: 2,
  activity_type: 'gemeinde',
  activity_target_role: 'konfi',
  requested_date: '2026-09-20',
  comment: 'Kuchen verkauft',
  photo_filename: null,
  status: 'pending',
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
};

beforeEach(() => {
  apiGet.mockReset();
  setError.mockReset();
});

afterEach(() => cleanup());

describe('Antragsdialog der Leitung', () => {
  it('lädt nur diesen einen Antrag, nie die ganze Liste', async () => {
    apiGet.mockImplementation(async (route: string) => {
      if (route === '/admin/activities/requests/41') return { data: antrag };
      throw new Error(`unerwartet: ${route}`);
    });

    render(<ActivityRequestModal requestId={41} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await screen.findByText('Kuchen verkauft');
    expect(apiGet.mock.calls.map(([r]) => r)).toEqual(['/admin/activities/requests/41']);
    expect(setError).not.toHaveBeenCalled();
  });

  it('meldet den Grund des Servers, wenn der Antrag nicht zugänglich ist', async () => {
    apiGet.mockRejectedValue(
      Object.assign(new Error('403'), { response: { status: 403, data: { error: 'Kein Zugriff auf diesen Konfi' } } })
    );

    render(<ActivityRequestModal requestId={41} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => expect(setError).toHaveBeenCalledWith('Kein Zugriff auf diesen Konfi'));
  });
});

describe('Detailansicht einer Konfi', () => {
  it('fragt nur die offenen Anträge dieser Person ab und zeigt sie als wartend', async () => {
    apiGet.mockImplementation(async (route: string) => {
      if (route === `/admin/konfis/${KONFI_ID}`) {
        return {
          data: {
            id: KONFI_ID, name: 'Emilia Test', display_name: 'Emilia Test', username: 'emilia',
            role_name: 'konfi', jahrgang_name: '2026/2027', activities: [], bonusPoints: [],
            gottesdienst_points: 0, gemeinde_points: 0,
            gottesdienst_enabled: true, gemeinde_enabled: true,
          },
        };
      }
      if (route === '/admin/activities/requests') return { data: [antrag] };
      return { data: [] };
    });

    render(<KonfiDetailView konfiId={KONFI_ID} onBack={vi.fn()} />);

    await screen.findByText(/Gemeindefest geholfen \(gemeldet\)/);

    const listenAufrufe = apiGet.mock.calls.filter(([r]) => String(r).startsWith('/admin/activities/requests'));
    expect(listenAufrufe).toEqual([
      ['/admin/activities/requests', { params: { user_id: KONFI_ID, status: 'pending' } }],
    ]);
  });
});
