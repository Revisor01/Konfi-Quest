import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { dateien, cacheInhalt, objectUrlAttrappe } from '../medienAttrappen';

// Öffnen, Wischen und Teilen über den gemeinsamen Medien-Cache (27.09.2026).
//
// Simon: "Und wir brauchen die gleichen Systeme wie Download-Fortschritt etc.
// bei Challenges." Das Öffnen einer Datei (nativ oder im Betrachter mit
// Herunterladen und Teilen), das Wischen zu den übrigen Dateien und das
// Teilen aus dem Chat laufen über denselben Cache — vorher lud der Betrachter
// jede weitere Datei und das Teilen jede Datei am Cache vorbei neu.

vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
  DATEI_TIMEOUT_MS: 180000,
}));

vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: () => () => undefined },
}));

vi.mock('../../utils/haptics', () => ({
  haptik: vi.fn(async () => undefined),
  ImpactStyle: { Light: 'LIGHT' },
}));

const nativOeffnen = vi.fn();
vi.mock('../../utils/nativeFileViewer', () => ({
  openFileNatively: (...args: unknown[]) => nativOeffnen(...args),
}));

const setError = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setError }),
}));

const teilen = vi.fn(async () => undefined);
vi.mock('../../services/systemDialoge', () => ({
  teilen: (...args: unknown[]) => teilen(...args),
}));

// Der Betrachter wird im Hook-Test nur angezeigt, nicht gerendert: gezählt
// wird, WAS er bekäme.
type BetrachterProps = { files: Array<{ url: string; fileName: string; mimeType: string }>; initialIndex: number };
let betrachterProps: BetrachterProps | null = null;
const betrachterZeigen = vi.fn();
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonModal: (_komponente: unknown, props: BetrachterProps) => {
    betrachterProps = props;
    return [betrachterZeigen, vi.fn()];
  },
}));

import { useDateiOeffnen } from '../../hooks/useDateiOeffnen';
import FileViewerModal from '../../components/shared/FileViewerModal';
import { nachrichtTeilen } from '../../components/chat/chatTeilen';
import { clearMediaCache } from '../../services/mediaCache';
import type { Message } from '../../types/chat';

beforeEach(async () => {
  await clearMediaCache();
  dateien.clear();
  apiGet.mockReset();
  apiGet.mockImplementation(async (route: string) => ({ data: new Blob([`inhalt:${route}`], { type: 'image/jpeg' }) }));
  nativOeffnen.mockReset();
  nativOeffnen.mockResolvedValue(false);
  setError.mockReset();
  teilen.mockClear();
  betrachterZeigen.mockReset();
  betrachterProps = null;
  objectUrlAttrappe();
});

afterEach(() => cleanup());

describe('Eine Challenge-Datei öffnen', () => {
  const kontext = () => [
    { pfad: 'ab12', name: 'erstes.jpg' },
    { pfad: 'cd34', name: 'zweites.png' },
  ];

  it('lädt über /challenges/files/ und zeigt den Betrachter mit Wisch-Kontext', async () => {
    const { result } = renderHook(() => useDateiOeffnen({ quelle: 'challenges', kontext, fehlerOrt: 'challenge-datei' }));

    await act(async () => { await result.current.dateiOeffnen('cd34', 'zweites.png'); });

    expect(apiGet.mock.calls.map(([r]) => r)).toEqual(['/challenges/files/cd34']);
    expect(betrachterZeigen).toHaveBeenCalledTimes(1);
    expect(betrachterProps!.initialIndex).toBe(1);
    expect(betrachterProps!.files.map((f) => f.url)).toEqual(['/api/challenges/files/ab12', expect.stringMatching(/^blob:/)]);
    expect(betrachterProps!.files.map((f) => f.mimeType)).toEqual(['image/jpeg', 'image/png']);
    expect(setError).not.toHaveBeenCalled();
  });

  it('zweites Öffnen derselben Datei: kein zweiter Download (2 → 1)', async () => {
    const { result } = renderHook(() => useDateiOeffnen({ quelle: 'challenges', kontext, fehlerOrt: 'challenge-datei' }));

    await act(async () => { await result.current.dateiOeffnen('ab12', 'erstes.jpg'); });
    await act(async () => { await result.current.dateiOeffnen('ab12', 'erstes.jpg'); });

    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(betrachterZeigen).toHaveBeenCalledTimes(2);
  });

  it('zeigt beim Laden den Fortschritt, beim Treffer im Cache gar keine Anzeige', async () => {
    let fertig: () => void = () => undefined;
    apiGet.mockImplementation((route: string, optionen: { onDownloadProgress?: (e: { loaded: number; total: number }) => void }) => {
      optionen.onDownloadProgress?.({ loaded: 1, total: 2 });
      return new Promise((resolve) => { fertig = () => resolve({ data: new Blob([route]) }); });
    });
    const stände: Array<{ pfad: string; prozent: number | null } | null> = [];
    const { result } = renderHook(() => {
      const wert = useDateiOeffnen({ quelle: 'challenges', kontext, fehlerOrt: 'challenge-datei' });
      stände.push(wert.ladendeDatei);
      return wert;
    });

    let laeuft: Promise<void> = Promise.resolve();
    act(() => { laeuft = result.current.dateiOeffnen('ab12', 'erstes.jpg'); });
    await waitFor(() => expect(result.current.ladendeDatei).toEqual({ pfad: 'ab12', prozent: 50 }));
    await act(async () => { fertig(); await laeuft; });
    expect(result.current.ladendeDatei).toBeNull();

    stände.length = 0;
    await act(async () => { await result.current.dateiOeffnen('ab12', 'erstes.jpg'); });
    expect(stände.filter(Boolean)).toEqual([]);
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it('nativ geöffnet: kein Betrachter der App', async () => {
    nativOeffnen.mockResolvedValue(true);
    const { result } = renderHook(() => useDateiOeffnen({ quelle: 'challenges', kontext, fehlerOrt: 'challenge-datei' }));

    await act(async () => { await result.current.dateiOeffnen('ab12', 'erstes.jpg'); });

    expect(nativOeffnen).toHaveBeenCalledWith(expect.any(Blob), 'erstes.jpg', 'image/jpeg');
    expect(betrachterZeigen).not.toHaveBeenCalled();
  });
});

describe('Der Betrachter holt weitere Dateien über den Cache', () => {
  const datei = { url: '/api/challenges/files/ab12', fileName: 'erstes.jpg', mimeType: 'image/jpeg' };

  it('legt die Datei in den Cache und lädt sie beim nächsten Mal nicht neu', async () => {
    const erstes = render(<FileViewerModal files={[datei]} onClose={vi.fn()} />);
    await waitFor(() => expect(erstes.container.querySelector('img')).not.toBeNull());
    erstes.unmount();

    expect(cacheInhalt()).toEqual(['challenges-ab12']);

    const zweites = render(<FileViewerModal files={[datei]} onClose={vi.fn()} />);
    await waitFor(() => expect(zweites.container.querySelector('img')).not.toBeNull());

    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  // Bis zum 27.09.2026 lief Material hier "weiter direkt" am Cache vorbei;
  // seit Simons „Fotos Anträge und Material ja bitte." gehört es dazu.
  it('Material-Dateien laufen ebenfalls über den Cache', async () => {
    const material = { url: '/api/material/files/xy99', fileName: 'plan.jpg', mimeType: 'image/jpeg' };

    const erstes = render(<FileViewerModal files={[material]} onClose={vi.fn()} />);
    await waitFor(() => expect(erstes.container.querySelector('img')).not.toBeNull());
    erstes.unmount();
    const zweites = render(<FileViewerModal files={[material]} onClose={vi.fn()} />);
    await waitFor(() => expect(zweites.container.querySelector('img')).not.toBeNull());

    expect(apiGet.mock.calls.map(([r]) => r)).toEqual(['/material/files/xy99']);
    expect(cacheInhalt()).toEqual(['material-xy99']);
  });

  it('andere API-Adressen laufen weiter direkt und landen nicht auf dem Gerät', async () => {
    const foto = { url: '/api/admin/activities/requests/41/photo', fileName: 'foto.jpg', mimeType: 'image/jpeg' };
    apiGet.mockResolvedValue({ data: new Blob(['x']), headers: { 'content-type': 'image/jpeg' } });

    const { container } = render(<FileViewerModal files={[foto]} onClose={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());

    expect(apiGet.mock.calls[0][0]).toBe('/admin/activities/requests/41/photo');
    expect(cacheInhalt()).toEqual([]);
  });
});

describe('Teilen aus dem Chat nimmt die Datei vom Gerät', () => {
  it('zweimal dieselbe Datei teilen: ein Download', async () => {
    const nachricht = { id: 1, file_path: 'ef56', file_name: 'plan.pdf', content: '' } as unknown as Message;

    await nachrichtTeilen(nachricht, vi.fn());
    await nachrichtTeilen(nachricht, vi.fn());

    expect(apiGet.mock.calls.map(([r]) => r)).toEqual(['/chat/files/ef56']);
    expect(teilen).toHaveBeenCalledTimes(2);
  });
});
