/**
 * „Konfi-Sprüche später auch verfolgen: welche Sprüche, welche Übersetzung,
 * eigene" (Simon, 27.09.2026).
 *
 * Gemessen wird `konfispruch-gespeichert` mit
 *   - `quelle`: vorschlag | eigen
 *   - `bibel` (nur beim Vorschlag): luther | gute-nachricht | bigs | elberfelder
 *
 * NICHT gemessen wird die Bibelstelle — auch nicht aus der Vorschlagsliste.
 * Ein Konfirmationsspruch ist öffentlich (Gottesdienst, Urkunde,
 * Gemeindebrief) und macht in einer kleinen Gemeinde die ganze Sitzung einer
 * Konfi wiedererkennbar. Begründung und Frage an Simon: docs/messung/umami.md,
 * S1.
 *
 * Gerendert geprüft: erst nach der Antwort des PATCH, nichts bei einem
 * Fehler, nichts bei unverändertem Speichern, nie Stelle oder Text.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';

const mockApiGet = vi.fn();
const mockApiPatch = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
  },
}));

const mockTrackHandlung = vi.fn();
vi.mock('../../services/analytics', () => ({
  trackHandlung: (...args: unknown[]) => mockTrackHandlung(...args),
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ isOnline: true }),
}));

vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: (fn: () => unknown) => fn() }),
}));

import KonfispruchSelectModal from '../../components/konfi/modals/KonfispruchSelectModal';

const SPRUECHE = [
  {
    id: 11,
    reference: 'Josua 1,9',
    book: 'Josua',
    chapter: 1,
    verse: 9,
    uebersetzungen: {
      luther2017: 'Sei getrost und unverzagt.',
      gute_nachricht: 'Sei mutig und entschlossen!',
      bigs: '',
      elberfelder: '',
    },
  },
  {
    id: 12,
    reference: 'Psalm 23,1',
    book: 'Psalm',
    chapter: 23,
    verse: 1,
    uebersetzungen: {
      luther2017: 'Der HERR ist mein Hirte.',
      gute_nachricht: 'Der HERR ist mein Hirt.',
      bigs: '',
      elberfelder: '',
    },
  },
];

/** Ein PATCH, dessen Antwort der Test selbst freigibt. */
const offenerPatch = () => {
  let ok: (v: unknown) => void = () => {};
  let nein: (e: unknown) => void = () => {};
  mockApiPatch.mockImplementation(() => new Promise((a, b) => { ok = a; nein = b; }));
  return { antworten: () => ok({ data: {} }), scheitern: (e: unknown) => nein(e) };
};

const speichern = async () => {
  // Ionic verschiebt aria-label beim Hydrieren ins Schatten-DOM; der Knopf
  // ist deshalb über seine Klasse zu finden.
  const knopf = document.body.querySelector('ion-button.app-modal-submit-btn');
  expect(knopf).not.toBeNull();
  await act(async () => { fireEvent.click(knopf as HTMLElement); });
};

const zeigen = async (props: Record<string, unknown> = {}) => {
  const onSuccess = vi.fn();
  render(<KonfispruchSelectModal onClose={vi.fn()} onSuccess={onSuccess} {...props} />);
  await screen.findByText('Josua 1,9');
  return { onSuccess };
};

beforeEach(() => {
  cleanup();
  mockApiGet.mockReset().mockResolvedValue({ data: SPRUECHE });
  mockApiPatch.mockReset();
  mockTrackHandlung.mockReset();
});

describe('Konfispruch aus den Vorschlägen', () => {
  it('erst nach der Antwort: quelle vorschlag, bibel luther', async () => {
    const patch = offenerPatch();
    const { onSuccess } = await zeigen();
    await act(async () => { fireEvent.click(screen.getByText('Josua 1,9')); });
    await speichern();

    expect(mockApiPatch).toHaveBeenCalledTimes(1);
    expect(mockApiPatch.mock.calls[0]).toEqual([
      '/konfi/profile',
      { konfspruch_id: 11, translation: 'luther2017' },
    ]);
    expect(mockTrackHandlung).not.toHaveBeenCalled();

    await act(async () => { patch.antworten(); });

    expect(mockTrackHandlung.mock.calls).toEqual([
      ['konfispruch-gespeichert', { quelle: 'vorschlag', bibel: 'luther' }],
    ]);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    // Weder Stelle noch Text noch Kennung.
    expect(JSON.stringify(mockTrackHandlung.mock.calls)).not.toMatch(/Josua|getrost|11|luther2017/);
  });

  it('die gespeicherte Übersetzung wird zum Messwert (gute_nachricht -> gute-nachricht)', async () => {
    mockApiPatch.mockResolvedValue({ data: {} });
    await zeigen({ current: { source: 'liste', id: 11, translation: 'gute_nachricht' } });
    // Anderer Spruch, dieselbe Übersetzung: eine echte Änderung.
    await act(async () => { fireEvent.click(screen.getByText('Psalm 23,1')); });
    await speichern();

    await waitFor(() => expect(mockTrackHandlung).toHaveBeenCalledTimes(1));
    expect(mockTrackHandlung.mock.calls[0]).toEqual([
      'konfispruch-gespeichert',
      { quelle: 'vorschlag', bibel: 'gute-nachricht' },
    ]);
  });

  it('unverändert gespeichert zählt nicht', async () => {
    mockApiPatch.mockResolvedValue({ data: {} });
    const { onSuccess } = await zeigen({ current: { source: 'liste', id: 11, translation: 'luther2017' } });
    await speichern();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mockApiPatch).toHaveBeenCalledTimes(1);
    expect(mockTrackHandlung).not.toHaveBeenCalled();
  });

  it('scheitert das Speichern, wird nichts gemeldet', async () => {
    const patch = offenerPatch();
    const { onSuccess } = await zeigen();
    await act(async () => { fireEvent.click(screen.getByText('Josua 1,9')); });
    await speichern();

    await act(async () => { patch.scheitern({ response: { status: 404, data: {} } }); });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(mockTrackHandlung).not.toHaveBeenCalled();
  });

  it('beim Team gilt dasselbe (PATCH /teamer/profile)', async () => {
    mockApiPatch.mockResolvedValue({ data: {} });
    await zeigen({ apiBasePath: '/teamer', variant: 'teamer' });
    await act(async () => { fireEvent.click(screen.getByText('Psalm 23,1')); });
    await speichern();

    await waitFor(() => expect(mockTrackHandlung).toHaveBeenCalledTimes(1));
    expect(mockApiPatch.mock.calls[0][0]).toBe('/teamer/profile');
    expect(mockTrackHandlung.mock.calls[0]).toEqual([
      'konfispruch-gespeichert',
      { quelle: 'vorschlag', bibel: 'luther' },
    ]);
  });
});

describe('Eigener Konfispruch', () => {
  it('unverändert gespeichert zählt nicht — und nie Text oder Stelle', async () => {
    mockApiPatch.mockResolvedValue({ data: {} });
    const { onSuccess } = await (async () => {
      const onSuccess = vi.fn();
      render(
        <KonfispruchSelectModal
          onClose={vi.fn()}
          onSuccess={onSuccess}
          current={{ source: 'freitext', text: 'Ich bin bei dir', reference: 'Mt 28,20' }}
        />
      );
      await waitFor(() => expect(mockApiGet).toHaveBeenCalled());
      return { onSuccess };
    })();
    await speichern();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mockApiPatch.mock.calls[0]).toEqual([
      '/konfi/profile',
      { konfspruch_freitext: 'Ich bin bei dir', konfspruch_freitext_referenz: 'Mt 28,20' },
    ]);
    expect(mockTrackHandlung).not.toHaveBeenCalled();
  });
});
