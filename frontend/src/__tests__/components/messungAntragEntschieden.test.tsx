/**
 * „Wie oft abgelehnt wird — und auch hier Teamer, Konfi" (Simon, 27.09.2026).
 *
 * Die Leitung entscheidet Anträge an genau einer Stelle: im Modal „Aktivität
 * prüfen" (admin/modals/ActivityRequestModal). Gerendert geprüft wird:
 *
 *   - Gemeldet wird erst, wenn PUT /admin/activities/requests/:id GEANTWORTET
 *     hat — solange die Anfrage läuft, steht noch nichts in der Messung.
 *   - Genau `entscheidung` und `antrag_von`, sonst nichts: kein Grund, keine
 *     Aktivität, keine Punkte, keine Konfi.
 *   - Scheitert die Anfrage, wird nichts gemeldet.
 *   - Offline eingereiht wird nichts gemeldet (die Entscheidung ist noch
 *     nicht gefallen, nur vorgemerkt).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';

const mockApiGet = vi.fn();
const mockApiPut = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    put: (...args: unknown[]) => mockApiPut(...args),
    delete: vi.fn(),
  },
  DATEI_TIMEOUT_MS: 180000,
}));

const mockTrackHandlung = vi.fn();
vi.mock('../../services/analytics', () => ({
  trackHandlung: (...args: unknown[]) => mockTrackHandlung(...args),
}));

const mockSetError = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setSuccess: vi.fn(), setError: mockSetError, isOnline: true }),
}));

vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: (fn: () => unknown) => fn() }),
}));

const mockEnqueue = vi.fn();
vi.mock('../../services/writeQueue', () => ({
  writeQueue: { enqueue: (...args: unknown[]) => mockEnqueue(...args) },
}));

let mockOnline = true;
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: {
    get isOnline() { return mockOnline; },
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock('../../utils/uuid', () => ({ safeUUID: () => 'test-uuid' }));

import ActivityRequestModal from '../../components/admin/modals/ActivityRequestModal';

const antrag = (ueber: Record<string, unknown> = {}) => ({
  id: 41,
  konfi_id: 7,
  konfi_name: 'Emilia Petersen',
  activity_id: 3,
  activity_name: 'Gottesdienst in Hennstedt',
  activity_points: 2,
  activity_type: 'gottesdienst',
  activity_target_role: 'konfi',
  requested_date: '2026-09-20',
  status: 'pending',
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
  ...ueber,
});

/** Ein PUT, dessen Antwort der Test selbst freigibt. */
const offenerPut = () => {
  let antworten: (v: unknown) => void = () => {};
  let scheitern: (e: unknown) => void = () => {};
  mockApiPut.mockImplementation(
    () => new Promise((ok, nein) => { antworten = ok; scheitern = nein; })
  );
  return { antworten: () => antworten({ data: {} }), scheitern: (e: unknown) => scheitern(e) };
};

const oeffnen = async (daten: Record<string, unknown>) => {
  mockApiGet.mockImplementation((url: string) =>
    url === '/admin/activities/requests/41'
      ? Promise.resolve({ data: daten })
      : Promise.resolve({ data: new Blob([]) })
  );
  const onSuccess = vi.fn();
  render(<ActivityRequestModal requestId={41} onClose={vi.fn()} onSuccess={onSuccess} />);
  await screen.findByText('Genehmigen');
  return { onSuccess };
};

const entscheiden = async (knopf: 'Genehmigen' | 'Ablehnen') => {
  await act(async () => { fireEvent.click(screen.getByText(knopf)); });
  const speichern = await waitFor(() => {
    // Ionic verschiebt aria-label beim Hydrieren ins Schatten-DOM; der
    // Knopf ist deshalb über seine Klasse zu finden.
    const el = document.body.querySelector('ion-button.app-modal-submit-btn');
    expect(el).not.toBeNull();
    return el as HTMLElement;
  });
  await act(async () => { fireEvent.click(speichern); });
};

beforeEach(() => {
  cleanup();
  mockApiGet.mockReset();
  mockApiPut.mockReset();
  mockTrackHandlung.mockReset();
  mockEnqueue.mockReset().mockResolvedValue(undefined);
  mockSetError.mockReset();
  mockOnline = true;
});

describe('Antrag entschieden: gemeldet nach der Antwort des Servers', () => {
  it('Genehmigen (Konfi): erst nach der Antwort, genau diese Merkmale', async () => {
    const put = offenerPut();
    const { onSuccess } = await oeffnen(antrag());
    await entscheiden('Genehmigen');

    // Die Anfrage läuft — noch nichts gemeldet.
    expect(mockApiPut).toHaveBeenCalledTimes(1);
    expect(mockApiPut.mock.calls[0][0]).toBe('/admin/activities/requests/41');
    expect(mockTrackHandlung).not.toHaveBeenCalled();

    await act(async () => { put.antworten(); });

    expect(mockTrackHandlung).toHaveBeenCalledTimes(1);
    expect(mockTrackHandlung.mock.calls[0]).toEqual([
      'antrag-entschieden',
      { entscheidung: 'angenommen', antrag_von: 'konfi' },
    ]);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('Ablehnen (Team): abgelehnt, Antrag von teamer — ohne den Grund', async () => {
    const put = offenerPut();
    // Ein vorhandener Kommentar füllt das Grund-Feld vor; ionInput erreicht
    // React in jsdom nicht (siehe passwortVorschlagOrganisation.test.tsx).
    await oeffnen(antrag({
      activity_target_role: 'teamer',
      admin_comment: 'Foto fehlt, bitte nachreichen',
    }));
    await entscheiden('Ablehnen');
    expect(mockApiPut.mock.calls[0][1]).toEqual({
      status: 'rejected',
      admin_comment: 'Foto fehlt, bitte nachreichen',
    });
    expect(mockTrackHandlung).not.toHaveBeenCalled();

    await act(async () => { put.antworten(); });

    expect(mockTrackHandlung).toHaveBeenCalledTimes(1);
    expect(mockTrackHandlung.mock.calls[0]).toEqual([
      'antrag-entschieden',
      { entscheidung: 'abgelehnt', antrag_von: 'teamer' },
    ]);
    // Der Grund, die Aktivität und die Konfi stehen in keinem Argument.
    const gesendet = JSON.stringify(mockTrackHandlung.mock.calls);
    for (const verboten of ['Foto fehlt', 'Hennstedt', 'Emilia', '41']) {
      expect(gesendet, `${verboten} in der Messung`).not.toContain(verboten);
    }
  });

  it('scheitert die Anfrage, wird nichts gemeldet', async () => {
    const put = offenerPut();
    const { onSuccess } = await oeffnen(antrag());
    await entscheiden('Genehmigen');

    await act(async () => {
      put.scheitern({ response: { status: 409, data: { error: 'Antrag wurde bereits bearbeitet' } } });
    });

    expect(mockSetError).toHaveBeenCalledWith('Antrag wurde bereits bearbeitet');
    expect(mockTrackHandlung).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('offline eingereiht wird nichts gemeldet', async () => {
    mockOnline = false;
    const { onSuccess } = await oeffnen(antrag());
    await entscheiden('Genehmigen');

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockApiPut).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(mockTrackHandlung).not.toHaveBeenCalled();
  });
});
