import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, renderHook, act, waitFor, fireEvent, cleanup } from '@testing-library/react';

// Verkleinerung beim Hochladen: ein Weg für Chat und Challenges (27.09.2026).
//
// Simon: "Und wie im Chat auch schon eine Verkleinerung der Grafik/Video,
// also Komprimierung. Das kann ja ein System sein."
//
// Vorher: Der Chat verkleinerte Fotos und prüfte danach auf 10 MB — der
// Server nimmt aber nur 5 MB an. Die Challenges verkleinerten Fotos mit
// eigenem Code und eigenem Satz, Aufnahmen prüften sie gar nicht. Jetzt
// laufen beide über fuerUploadVorbereiten: verkleinern, dann gegen die Grenze
// des Servers prüfen, mit demselben Satz.
//
// jsdom kann weder Bilder dekodieren noch auf ein Canvas zeichnen. Beides ist
// hier gestellt, so dass der ECHTE Verkleinerungsweg läuft: ein 4000×3000-
// Handyfoto mit 8 MB wird auf 1920×1440 gebracht und als JPEG mit 600 KB neu
// geschrieben.

const HANDYFOTO_BYTES = 8 * 1024 * 1024;
const VERKLEINERT_BYTES = 600 * 1024;
let gezeichnet: Array<{ breite: number; hoehe: number; typ: string }> = [];

class HandyfotoBild {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 4000;
  naturalHeight = 3000;
  set src(_wert: string) { setTimeout(() => this.onload?.(), 0); }
}

const setError = vi.fn();
const setSuccess = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setError, setSuccess, isOnline: true }),
}));

const apiPost = vi.fn(async () => ({ data: {} }));
vi.mock('../../services/api', () => ({
  default: { post: (...args: unknown[]) => apiPost(...args), get: vi.fn() },
  DATEI_TIMEOUT_MS: 180000,
}));
vi.mock('../../services/analytics', () => ({ track: vi.fn() }));
vi.mock('../../hooks/useDateiOeffnen', () => ({
  useDateiOeffnen: () => ({ dateiOeffnen: vi.fn(), ladendeDatei: null }),
}));

import { useChatDateien } from '../../components/chat/useChatDateien';
import ChallengeSubmitModal from '../../components/konfi/modals/ChallengeSubmitModal';
import { fuerUploadVorbereiten, UPLOAD_GRENZE, zuGrossText } from '../../services/mediaCompression';
import { laeuftAusflug } from '../../services/appSperre';

const datei = (bytes: number, name: string, typ: string) =>
  new File([new Uint8Array(bytes)], name, { type: typ });

beforeEach(() => {
  vi.clearAllMocks();
  gezeichnet = [];
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:vorschau-${++n}`);
  URL.revokeObjectURL = vi.fn();
  (globalThis as unknown as { Image: unknown }).Image = HandyfotoBild;
  HTMLCanvasElement.prototype.getContext = vi.fn(function (this: HTMLCanvasElement) {
    return {
      drawImage: () => { gezeichnet.push({ breite: this.width, hoehe: this.height, typ: '' }); },
      getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
    };
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback, typ?: string) {
    gezeichnet[gezeichnet.length - 1].typ = typ || '';
    cb(new Blob([new Uint8Array(VERKLEINERT_BYTES)], { type: typ }));
  };
});

afterEach(() => cleanup());

describe('Die Grenzen sind die des Servers, der Satz ist derselbe', () => {
  it('Chat 5 MB, Challenges 50 MB', () => {
    expect(UPLOAD_GRENZE.chat).toBe(5 * 1024 * 1024);
    expect(UPLOAD_GRENZE.challenges).toBe(50 * 1024 * 1024);
    expect(zuGrossText(UPLOAD_GRENZE.chat)).toBe('Datei ist zu groß (max. 5 MB).');
    expect(zuGrossText(UPLOAD_GRENZE.challenges)).toBe('Datei ist zu groß (max. 50 MB).');
  });

  it('ein Handyfoto wird erst verkleinert, dann geprüft — 8 MB passen danach in 5 MB', async () => {
    const { file, bildVorschau } = await fuerUploadVorbereiten(datei(HANDYFOTO_BYTES, 'IMG_1.png', 'image/png'), UPLOAD_GRENZE.chat);

    expect(gezeichnet).toEqual([{ breite: 1920, hoehe: 1440, typ: 'image/jpeg' }]);
    expect(file.size).toBe(VERKLEINERT_BYTES);
    expect(file.name).toBe('IMG_1.jpg');
    expect(bildVorschau).toMatch(/^blob:/);
  });

  it('ein Video bleibt, wie es ist, und fällt über die Grenze — mit freigegebener Vorschau', async () => {
    const video = datei(6 * 1024 * 1024, 'clip.mov', 'video/quicktime');

    await expect(fuerUploadVorbereiten(video, UPLOAD_GRENZE.chat)).rejects.toThrow('Datei ist zu groß (max. 5 MB).');
    const durch = await fuerUploadVorbereiten(video, UPLOAD_GRENZE.challenges);
    expect(durch.file).toBe(video);
    expect(durch.bildVorschau).toBeNull();
    expect(gezeichnet).toEqual([]);
  });
});

describe('Chat: derselbe Weg', () => {
  const auswaehlen = async (gewaehlt: File) => {
    const { result } = renderHook(() => useChatDateien({ messages: [] }));
    await act(async () => {
      await result.current.dateiUebernehmen(gewaehlt);
    });
    return result;
  };

  it('eine PDF mit 6 MB: abgelehnt mit dem Satz des Servers (vorher ging sie bis 10 MB durch)', async () => {
    const ergebnis = await auswaehlen(datei(6 * 1024 * 1024, 'plan.pdf', 'application/pdf'));

    expect(setError).toHaveBeenCalledWith('Datei ist zu groß (max. 5 MB).');
    expect(ergebnis.current.selectedFile).toBeNull();
  });

  it('eine PDF mit 4 MB geht durch, ohne Bildvorschau', async () => {
    const ergebnis = await auswaehlen(datei(4 * 1024 * 1024, 'plan.pdf', 'application/pdf'));

    expect(setError).not.toHaveBeenCalled();
    expect(ergebnis.current.selectedFile?.name).toBe('plan.pdf');
    expect(ergebnis.current.selectedFilePreview).toBeNull();
  });

  it('ein Handyfoto mit 8 MB wird verkleinert und geht durch', async () => {
    const ergebnis = await auswaehlen(datei(HANDYFOTO_BYTES, 'IMG_2.jpg', 'image/jpeg'));

    expect(setError).not.toHaveBeenCalled();
    expect(ergebnis.current.selectedFile?.size).toBe(VERKLEINERT_BYTES);
  });
});

describe('Challenge-Foto einreichen: verkleinert, mit der Sende-Anzeige des Chats', () => {
  const challenge = {
    id: 5, title: 'Foto-Challenge', visibility: 'public', allowed_media: ['photo'],
    starts_at: new Date(Date.now() - 86400000).toISOString(), ends_at: new Date(Date.now() + 86400000).toISOString(),
  };

  // Ob die App-Sperre beim Öffnen der Auswahl abgemeldet war.
  let ausflugBeimOeffnen: boolean | null = null;

  const fotoWaehlen = (gewaehlt: File) => {
    // Die Dateiauswahl des Systems: Das unsichtbare Feld meldet die Datei.
    ausflugBeimOeffnen = null;
    HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
      ausflugBeimOeffnen = laeuftAusflug();
      Object.defineProperty(this, 'files', { value: [gewaehlt], configurable: true });
      this.onchange?.({ target: this } as unknown as Event);
    };
  };

  it('das Foto geht verkleinert als JPEG an den Server', async () => {
    fotoWaehlen(datei(HANDYFOTO_BYTES, 'IMG_3.png', 'image/png'));
    const { container, getByText } = render(
      <ChallengeSubmitModal challenge={challenge as never} onClose={vi.fn()} onSuccess={vi.fn()} />
    );

    await act(async () => { fireEvent.click(getByText('Foto hinzufügen')); });
    // Die Auswahl ging über die Hülle auf — mit abgemeldeter App-Sperre.
    expect(ausflugBeimOeffnen).toBe(true);
    await waitFor(() => expect(container.querySelector('img[alt="Dein Foto"]')).not.toBeNull());

    await act(async () => { fireEvent.click(container.querySelector('[aria-label="Beitrag einreichen"]')!); });

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    const formular = apiPost.mock.calls[0][1] as FormData;
    const gesendet = formular.get('file') as File;
    expect(gesendet.size).toBe(VERKLEINERT_BYTES);
    expect(gesendet.type).toBe('image/jpeg');
    expect(gesendet.name).toBe('IMG_3.jpg');
  });

  it('zeigt beim Senden "Wird gesendet… 40 %" und bei 100 % "Wird verarbeitet…"', async () => {
    fotoWaehlen(datei(100 * 1024, 'klein.jpg', 'image/jpeg'));
    let fortschritt: ((e: { loaded: number; total: number }) => void) | undefined;
    let fertig: () => void = () => undefined;
    apiPost.mockImplementationOnce((_route: string, _daten: unknown, optionen: { onUploadProgress?: (e: { loaded: number; total: number }) => void }) => {
      fortschritt = optionen.onUploadProgress;
      return new Promise((resolve) => { fertig = () => resolve({ data: {} }); });
    });
    const { container, getByText } = render(
      <ChallengeSubmitModal challenge={challenge as never} onClose={vi.fn()} onSuccess={vi.fn()} />
    );
    await act(async () => { fireEvent.click(getByText('Foto hinzufügen')); });
    await waitFor(() => expect(container.querySelector('img[alt="Dein Foto"]')).not.toBeNull());

    await act(async () => { fireEvent.click(container.querySelector('[aria-label="Beitrag einreichen"]')!); });
    await waitFor(() => expect(fortschritt).toBeDefined());

    await act(async () => { fortschritt!({ loaded: 40, total: 100 }); });
    expect(container.textContent).toContain('Wird gesendet… 40 %');
    expect(container.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('40');

    await act(async () => { fortschritt!({ loaded: 100, total: 100 }); });
    expect(container.textContent).toContain('Wird verarbeitet…');

    await act(async () => { fertig(); });
  });

  it('ein Foto, das auch verkleinert zu groß bleibt: derselbe Satz wie im Chat', async () => {
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback, typ?: string) {
      cb(new Blob([new Uint8Array(51 * 1024 * 1024)], { type: typ }));
    };
    fotoWaehlen(datei(60 * 1024 * 1024, 'riesig.png', 'image/png'));
    const { getByText } = render(
      <ChallengeSubmitModal challenge={challenge as never} onClose={vi.fn()} onSuccess={vi.fn()} />
    );

    await act(async () => { fireEvent.click(getByText('Foto hinzufügen')); });

    await waitFor(() => expect(setError).toHaveBeenCalledWith('Datei ist zu groß (max. 50 MB).'));
    expect(apiPost).not.toHaveBeenCalled();
  });
});
