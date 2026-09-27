import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { dateien, objectUrlAttrappe } from '../medienAttrappen';

// Gemeinsame Anzeige für Bild und Video — Chat und Challenges (27.09.2026).
//
// Simon: "Und wir brauchen die gleichen Systeme wie Download-Fortschritt etc.
// bei Challenges." Die Bausteine kommen aus dem Chat und gelten jetzt für
// beide Quellen: Laden über den Medien-Cache, Fortschritt wie beim Öffnen
// einer Chat-Datei, Fehler mit "Erneut versuchen", ohne Netz die graue Zeile
// statt einer Ladeanzeige, die bis zum Zeitlimit steht.
//
// Gerendert wird die ECHTE Anzeige samt echtem Cache; gestellt sind nur das
// Dateisystem (im Speicher), die API (gezählt) und das Netz.

vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
  DATEI_TIMEOUT_MS: 180000,
}));

let online = true;
const netzHoerer = new Set<(online: boolean) => void>();
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: {
    get isOnline() { return online; },
    subscribe: (fn: (online: boolean) => void) => { netzHoerer.add(fn); return () => { netzHoerer.delete(fn); }; },
  },
}));

vi.mock('../../utils/haptics', () => ({
  haptik: vi.fn(async () => undefined),
  ImpactStyle: { Light: 'LIGHT' },
}));

import LazyImage from '../../components/chat/LazyImage';
import VideoPreview from '../../components/chat/VideoPreview';
import { clearMediaCache } from '../../services/mediaCache';
import FortschrittsBalken from '../../components/shared/FortschrittsBalken';
import { ladeText, sendeText } from '../../utils/fortschritt';

// jsdom kennt keinen IntersectionObserver. Diese Attrappe meldet das Element
// sofort als sichtbar — wie ein Bild, das schon im Bild ist.
class SofortSichtbar {
  private cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) { this.cb = cb; }
  observe = () => { this.cb([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver); };
  disconnect = () => undefined;
  unobserve = () => undefined;
  takeRecords = () => [];
}

const serverBild = (route: string) => ({ data: new Blob([`bild:${route}`], { type: 'image/png' }) });

/** Ein Download, der erst endet, wenn der Test es sagt. */
const offenerDownload = () => {
  let fertig: (wert: unknown) => void = () => undefined;
  let scheitern: (grund: unknown) => void = () => undefined;
  const zusage = new Promise((resolve, reject) => { fertig = resolve; scheitern = reject; });
  return { zusage, fertig, scheitern };
};

let urls: ReturnType<typeof objectUrlAttrappe>;

beforeEach(async () => {
  await clearMediaCache();
  dateien.clear();
  apiGet.mockReset();
  apiGet.mockImplementation(async (route: string) => serverBild(route));
  online = true;
  netzHoerer.clear();
  urls = objectUrlAttrappe();
  (globalThis as unknown as { IntersectionObserver: unknown }).IntersectionObserver = SofortSichtbar;
});

afterEach(() => {
  cleanup();
});

describe('Die Fortschrittsanzeige ist eine für Laden und Senden', () => {
  it('nennt die Prozentzahl, sonst nur "Wird geladen…"', () => {
    expect(ladeText(40)).toBe('Wird geladen… 40 %');
    expect(ladeText(null)).toBe('Wird geladen…');
    expect(sendeText(40)).toBe('Wird gesendet… 40 %');
    expect(sendeText(100)).toBe('Wird verarbeitet…');
  });

  it('der Balken ist als Fortschritt ausgezeichnet', () => {
    render(<FortschrittsBalken prozent={40} beschriftung="Datei wird geladen: 40 Prozent" />);
    const balken = screen.getByRole('progressbar');
    expect(balken.getAttribute('aria-valuenow')).toBe('40');
    expect(balken.getAttribute('aria-label')).toBe('Datei wird geladen: 40 Prozent');
  });
});

describe('Bild: Chat und Challenges über denselben Weg', () => {
  it('Chat: lädt über /chat/files/ und zeigt das Bild', async () => {
    const { container } = render(<LazyImage filePath="aa11" fileName="foto.jpg" onClick={vi.fn()} />);

    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    expect(container.querySelector('img')!.getAttribute('src')).toMatch(/^blob:/);
    expect(apiGet.mock.calls.map(([r]) => r)).toEqual(['/chat/files/aa11']);
  });

  it('Challenge: zweites Öffnen lädt nicht erneut vom Server (2 → 1)', async () => {
    const erstes = render(<LazyImage filePath="bb22" fileName="foto.jpg" quelle="challenges" vollbreite />);
    await waitFor(() => expect(erstes.container.querySelector('img')).not.toBeNull());
    erstes.unmount();

    const zweites = render(<LazyImage filePath="bb22" fileName="foto.jpg" quelle="challenges" vollbreite />);

    // Beim zweiten Mal ist das Bild schon beim ersten Zeichnen da.
    expect(zweites.container.querySelector('img')).not.toBeNull();
    expect(apiGet.mock.calls.map(([r]) => r)).toEqual(['/challenges/files/bb22']);
  });

  it('zeigt beim Laden die Anzeige aus dem Chat: "Wird geladen… 40 %" mit Balken', async () => {
    const download = offenerDownload();
    apiGet.mockImplementation((route: string, optionen: { onDownloadProgress?: (e: { loaded: number; total: number }) => void }) => {
      optionen.onDownloadProgress?.({ loaded: 40, total: 100 });
      return download.zusage.then(() => serverBild(route));
    });

    const { container } = render(<LazyImage filePath="cc33" fileName="foto.jpg" quelle="challenges" />);

    await waitFor(() => expect(container.textContent).toContain('Wird geladen… 40 %'));
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40');

    await act(async () => { download.fertig(undefined); });
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('Fehler: sagt es und bietet "Erneut versuchen" — der zweite Versuch lädt', async () => {
    const onError = vi.fn();
    apiGet.mockRejectedValueOnce(Object.assign(new Error('500'), { response: { status: 500 } }));

    const { container } = render(<LazyImage filePath="dd44" fileName="foto.jpg" quelle="challenges" onError={onError} />);

    await waitFor(() => expect(container.textContent).toContain('Das Bild konnte nicht geladen werden.'));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(container.querySelector('img')).toBeNull();

    fireEvent.click(screen.getByText('Erneut versuchen'));

    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    expect(apiGet).toHaveBeenCalledTimes(2);
  });

  it('gelöscht oder kein Zugriff mehr (404/403): "nicht mehr verfügbar", kein zweiter Versuch', async () => {
    apiGet.mockRejectedValueOnce(Object.assign(new Error('404'), { response: { status: 404 } }));

    const { container } = render(<LazyImage filePath="dd55" fileName="foto.jpg" />);

    await waitFor(() => expect(container.textContent).toContain('Das Bild ist nicht mehr verfügbar.'));
    expect(screen.queryByText('Erneut versuchen')).toBeNull();
  });

  it('ohne Netz und nicht auf dem Gerät: graue Zeile statt Ladeanzeige, kein Aufruf', async () => {
    online = false;

    const { container } = render(<LazyImage filePath="ee55" fileName="foto.jpg" quelle="challenges" />);

    await waitFor(() => expect(container.textContent).toContain('Das Bild ist offline nicht verfügbar.'));
    expect(container.textContent).not.toContain('Wird geladen');
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('kommt das Netz zurück, lädt es von selbst', async () => {
    online = false;
    const { container } = render(<LazyImage filePath="ff66" fileName="foto.jpg" quelle="challenges" />);
    await waitFor(() => expect(container.textContent).toContain('offline nicht verfügbar'));
    // Erst melden, wenn die Anzeige zuhört: Sie meldet sich im Effekt nach
    // dem Zeichnen an. Unter Last lag das Zeichnen schon vor, die Anmeldung
    // noch nicht — die Meldung ging ins Leere, der Test fiel (zweimal im
    // Gesamtlauf am 27.09.2026, einzeln nie).
    await waitFor(() => expect(netzHoerer.size).toBe(1));

    online = true;
    await act(async () => { netzHoerer.forEach((fn) => fn(true)); });

    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    expect(apiGet).toHaveBeenCalledTimes(1);
  });

  it('ohne Netz, aber auf dem Gerät: das Bild kommt aus dem Cache', async () => {
    // Wie nach einem Neustart: Datei auf dem Gerät, nichts im Speicher.
    dateien.set('media-cache/challenges-ab12', { data: btoa('bild'), size: 4, mtime: 1 });
    online = false;

    const { container } = render(<LazyImage filePath="ab12" fileName="foto.jpg" quelle="challenges" />);

    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe('Video: dieselbe Vorschau für Chat und Challenges', () => {
  it('Challenge-Video: Fortschritt beim Laden, dann das Video mit Größe', async () => {
    const download = offenerDownload();
    apiGet.mockImplementation((route: string, optionen: { onDownloadProgress?: (e: { loaded: number; total: number }) => void }) => {
      optionen.onDownloadProgress?.({ loaded: 3, total: 4 });
      return download.zusage.then(() => ({ data: new Blob(['film'], { type: 'application/octet-stream' }) }));
    });

    const { container } = render(
      <VideoPreview filePath="vv11" fileName="clip.mov" fileSize={2 * 1024 * 1024} quelle="challenges" vollbreite />
    );

    await waitFor(() => expect(container.textContent).toContain('Wird geladen… 75 %'));
    await act(async () => { download.fertig(undefined); });

    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
    expect(apiGet.mock.calls[0][0]).toBe('/challenges/files/vv11');
    expect(container.textContent).toContain('2 MB');
  });

  it('Fehler mit "Erneut versuchen", Meldung an den Aufrufer wie bisher', async () => {
    const onError = vi.fn();
    apiGet.mockRejectedValueOnce(Object.assign(new Error('500'), { response: { status: 500 } }));

    const { container } = render(<VideoPreview filePath="vv22" fileName="clip.mp4" onError={onError} />);

    await waitFor(() => expect(container.textContent).toContain('Das Video konnte nicht geladen werden.'));
    expect(onError).toHaveBeenCalledWith('Fehler beim Laden des Videos');

    fireEvent.click(screen.getByText('Erneut versuchen'));
    await waitFor(() => expect(container.querySelector('video')).not.toBeNull());
  });

  // Befund 14.09.2026, jetzt am Ablauf statt am Quelltext geprüft: Ein Video
  // wegzuscrollen, bevor es fertig geladen war, hinterließ eine Object-URL bis
  // zum App-Neustart — und meldete einen Fehler für eine Nachricht, die
  // längst nicht mehr auf dem Bildschirm stand.
  it('abgehängt während des Ladens: die danach erzeugte URL wird sofort freigegeben', async () => {
    const onError = vi.fn();
    const download = offenerDownload();
    apiGet.mockImplementation(() => download.zusage.then(() => ({ data: new Blob(['film']) })));

    const { unmount } = render(<VideoPreview filePath="vv33" fileName="clip.mp4" onError={onError} />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => { download.fertig(undefined); });
    await waitFor(() => expect(urls.erzeugt.length).toBe(1));

    expect(urls.freigegeben).toEqual(urls.erzeugt);
    expect(onError).not.toHaveBeenCalled();
  });

  it('abgehängt, dann gescheitert: keine Fehlermeldung mehr', async () => {
    const onError = vi.fn();
    const download = offenerDownload();
    apiGet.mockImplementation(() => download.zusage);

    const { unmount } = render(<VideoPreview filePath="vv44" fileName="clip.mp4" onError={onError} />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
    unmount();

    await act(async () => { download.scheitern(Object.assign(new Error('500'), { response: { status: 500 } })); });

    expect(onError).not.toHaveBeenCalled();
  });

  it('wieder geöffnet: das Video kommt aus dem Cache, nicht vom Server', async () => {
    const erstes = render(<VideoPreview filePath="vv55" fileName="clip.mp4" quelle="challenges" />);
    await waitFor(() => expect(erstes.container.querySelector('video')).not.toBeNull());
    erstes.unmount();

    const zweites = render(<VideoPreview filePath="vv55" fileName="clip.mp4" quelle="challenges" />);
    await waitFor(() => expect(zweites.container.querySelector('video')).not.toBeNull());

    expect(apiGet).toHaveBeenCalledTimes(1);
  });
});
