import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor, fireEvent, act, cleanup } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { dateien, objectUrlAttrappe, knopf } from '../medienAttrappen';

// Nachweisfotos der Anträge auf dem gemeinsamen Medien-System (27.09.2026).
//
// Simon: „Fotos Anträge und Material ja bitte." Vorher lud jede der drei
// Anzeigen ihr Foto mit eigenem api.get: Die Konfi-Ansicht zeigte "Lade
// Foto..." und bei einem Fehler den Rat, die Seite herunterzuziehen; die
// Leitung sah bei einem Fehler "Lade Foto..." für immer; ohne Netz stand die
// Ladeanzeige bis zum Zeitlimit. Hochgeladen wurde über einen eigenen Weg
// (compressForUpload) mit eigenem Satz ("Foto ist zu groß") und einem Balken
// ohne Zahl.
//
// Jetzt: dieselben Bausteine wie Chat und Challenges — Fortschritt, "Erneut
// versuchen", die Zeile ohne Netz, Verkleinerung und Grenze des Servers,
// dieselbe Sende-Anzeige. Mit einer Ausnahme, gewollt: Nachweisfotos landen
// nie im Geräte-Cache (Begründung in services/mediaCache.ts, NUR_ANZEIGEN).
//
// Gerendert werden die echten Ansichten mit dem echten Medien-Cache; gestellt
// sind Dateisystem (im Speicher, gezählt), API (gezählt) und Netz.

vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn(async () => ({ data: {} }));
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
    put: vi.fn(async () => ({ data: {} })),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
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

const setError = vi.fn();
const setSuccess = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setError, setSuccess, isOnline: true, user: { id: 7, organization_id: 3, type: 'konfi' } }),
}));
vi.mock('../../services/analytics', () => ({ track: vi.fn(), trackHandlung: vi.fn() }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));

// Die Auswahlliste der Aktivitäten kommt im Formular aus dem Offline-Cache;
// hier steht sie fest, es geht um das Foto.
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({
    data: [{ id: 1, name: 'Gottesdienst besucht', points: 2, type: 'gottesdienst' }],
    loading: false, error: null, isStale: false, isOffline: false, refresh: vi.fn(), refreshLive: vi.fn(),
  }),
}));

import RequestDetailModal, { type ActivityRequest } from '../../components/konfi/modals/RequestDetailModal';
import LeitungAntragModal from '../../components/admin/modals/ActivityRequestModal';
import AktivitaetMeldenModal from '../../components/konfi/modals/ActivityRequestModal';
import TeamerAktivitaetMeldenModal from '../../components/teamer/modals/TeamerActivityRequestModal';
import { clearMediaCache, getMediaBlob } from '../../services/mediaCache';
import { UPLOAD_GRENZE } from '../../services/mediaCompression';

const antrag: ActivityRequest = {
  id: 41,
  activity_id: 7,
  activity_name: 'Gottesdienst besucht',
  activity_points: 2,
  activity_type: 'gottesdienst',
  requested_date: '2026-09-20',
  photo_filename: 'a'.repeat(64),
  status: 'pending',
  created_at: '2026-09-20T10:00:00Z',
  updated_at: '2026-09-20T10:00:00Z',
};

const leitungsAntrag = { ...antrag, konfi_id: 9, konfi_name: 'Emilia Test' };

const KONFI_ROUTE = '/konfi/activity-requests/41/photo';
const LEITUNG_ROUTE = '/admin/activities/requests/41/photo';
// Der Antragsdialog der Leitung lädt nur diesen einen Antrag (28.09.2026).
const LEITUNG_ANTRAG = '/admin/activities/requests/41';

const fotoAufrufe = () => apiGet.mock.calls.filter(([r]) => String(r).endsWith('/photo')).length;

const serverFehler = (status: number) => Object.assign(new Error(String(status)), { response: { status } });

let urls: ReturnType<typeof objectUrlAttrappe>;

beforeEach(async () => {
  await clearMediaCache();
  dateien.clear();
  online = true;
  netzHoerer.clear();
  vi.clearAllMocks();
  apiGet.mockReset();
  apiGet.mockImplementation(async (route: string) => {
    if (route === LEITUNG_ANTRAG) return { data: leitungsAntrag };
    if (route.endsWith('/photo') || route.startsWith('/chat/files/')) {
      return { data: new Blob([`foto:${route}`], { type: 'image/jpeg' }) };
    }
    throw new Error(`unerwartet: ${route}`);
  });
  apiPost.mockReset();
  urls = objectUrlAttrappe();
});

afterEach(() => cleanup());

const fotoIn = (container: HTMLElement) => container.querySelector('img[alt="Foto zur Aktivität"]');

describe('Konfi und Team: das eigene Foto im offenen Antrag', () => {
  it('zeigt beim Laden, wie weit es ist — "Wird geladen… 40 %" mit Balken', async () => {
    let fertig: () => void = () => undefined;
    apiGet.mockImplementationOnce((route: string, optionen: { onDownloadProgress: (e: { loaded: number; total: number }) => void }) => {
      optionen.onDownloadProgress({ loaded: 40, total: 100 });
      return new Promise((resolveFoto) => { fertig = () => resolveFoto({ data: new Blob(['x'], { type: 'image/jpeg' }) }); });
    });

    const { container } = render(<RequestDetailModal request={antrag} onClose={vi.fn()} />);

    await waitFor(() => expect(container.textContent).toContain('Wird geladen… 40 %'));
    expect(container.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('40');
    expect(apiGet.mock.calls[0][0]).toBe(KONFI_ROUTE);

    await act(async () => { fertig(); });
    await waitFor(() => expect(fotoIn(container)).not.toBeNull());
  });

  it('ein Fehler zeigt "Erneut versuchen" — der zweite Versuch holt das Foto', async () => {
    apiGet.mockRejectedValueOnce(serverFehler(500));

    const { container, getByText } = render(<RequestDetailModal request={antrag} onClose={vi.fn()} />);

    await waitFor(() => expect(container.textContent).toContain('Das Foto konnte nicht geladen werden.'));
    // Vorher stand hier der Rat, die Seite herunterzuziehen.
    expect(container.textContent).not.toContain('Zieh die Seite nach unten');

    await act(async () => { fireEvent.click(getByText('Erneut versuchen')); });

    await waitFor(() => expect(fotoIn(container)).not.toBeNull());
    expect(fotoAufrufe()).toBe(2);
  });

  it('ohne Netz: die graue Zeile statt einer Ladeanzeige, kein Aufruf — und von selbst, sobald das Netz zurück ist', async () => {
    online = false;

    const { container } = render(<RequestDetailModal request={antrag} onClose={vi.fn()} />);

    await waitFor(() => expect(container.textContent).toContain('Das Foto ist offline nicht verfügbar.'));
    expect(fotoAufrufe()).toBe(0);
    // Erst melden, wenn die Anzeige zuhört (sie meldet sich im Effekt nach
    // dem Zeichnen an; unter Last kommt das Zeichnen zuerst).
    await waitFor(() => expect(netzHoerer.size).toBe(1));

    online = true;
    await act(async () => { netzHoerer.forEach((fn) => fn(true)); });

    await waitFor(() => expect(fotoIn(container)).not.toBeNull());
    expect(fotoAufrufe()).toBe(1);
  });

  it('inzwischen entschieden (403): "nicht mehr verfügbar", ohne sinnlosen zweiten Versuch', async () => {
    apiGet.mockRejectedValueOnce(serverFehler(403));

    const { container } = render(<RequestDetailModal request={antrag} onClose={vi.fn()} />);

    await waitFor(() => expect(container.textContent).toContain('Das Foto ist nicht mehr verfügbar.'));
    expect(container.textContent).not.toContain('Erneut versuchen');
  });

  it('ein entschiedener Antrag fragt gar nicht erst nach dem Foto', async () => {
    const { container } = render(<RequestDetailModal request={{ ...antrag, status: 'approved' }} onClose={vi.fn()} />);

    await waitFor(() => expect(container.textContent).toContain('Punkte sind da'));
    expect(fotoIn(container)).toBeNull();
    expect(fotoAufrufe()).toBe(0);
  });
});

describe('Nachweisfotos bleiben nicht auf dem Gerät', () => {
  it('zweimal öffnen: zweimal vom Server, nichts im Dateisystem, die URL geht beim Schließen mit', async () => {
    const erstes = render(<RequestDetailModal request={antrag} onClose={vi.fn()} />);
    await waitFor(() => expect(fotoIn(erstes.container)).not.toBeNull());
    const ersteUrl = fotoIn(erstes.container)!.getAttribute('src');
    erstes.unmount();

    const zweites = render(<RequestDetailModal request={antrag} onClose={vi.fn()} />);
    await waitFor(() => expect(fotoIn(zweites.container)).not.toBeNull());

    expect(fotoAufrufe()).toBe(2);
    expect(dateien.size).toBe(0);
    expect(urls.freigegeben).toContain(ersteUrl);
  });

  it('eine Chat-Datei gleichen Namens beantwortet keine Anfrage nach dem Nachweisfoto', async () => {
    await getMediaBlob('41');
    expect(dateien.size).toBe(1);

    const { container } = render(<RequestDetailModal request={antrag} onClose={vi.fn()} />);
    await waitFor(() => expect(fotoIn(container)).not.toBeNull());

    expect(apiGet.mock.calls.map(([r]) => r)).toEqual(['/chat/files/41', KONFI_ROUTE]);
    expect(dateien.size).toBe(1);
  });

  it('die Leitung legt beim Prüfen nichts ab', async () => {
    const erstes = render(<LeitungAntragModal requestId={41} onClose={vi.fn()} onSuccess={vi.fn()} />);
    await waitFor(() => expect(fotoIn(erstes.container)).not.toBeNull());
    erstes.unmount();
    const zweites = render(<LeitungAntragModal requestId={41} onClose={vi.fn()} onSuccess={vi.fn()} />);
    await waitFor(() => expect(fotoIn(zweites.container)).not.toBeNull());

    expect(apiGet.mock.calls.filter(([r]) => r === LEITUNG_ROUTE).length).toBe(2);
    expect(dateien.size).toBe(0);
  });
});

describe('Leitung: Antrag prüfen', () => {
  it('lädt über die Route der Leitung und zeigt den Fortschritt', async () => {
    let fertig: () => void = () => undefined;
    apiGet.mockImplementation(async (route: string, optionen?: { onDownloadProgress?: (e: { loaded: number; total: number }) => void }) => {
      if (route === LEITUNG_ANTRAG) return { data: leitungsAntrag };
      optionen?.onDownloadProgress?.({ loaded: 25, total: 100 });
      return new Promise((resolveFoto) => { fertig = () => resolveFoto({ data: new Blob([`foto:${route}`], { type: 'image/jpeg' }) }); });
    });

    const { container } = render(<LeitungAntragModal requestId={41} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => expect(container.textContent).toContain('Wird geladen… 25 %'));
    await act(async () => { fertig(); });
    await waitFor(() => expect(fotoIn(container)).not.toBeNull());
    expect(apiGet.mock.calls.map(([r]) => r)).toEqual([LEITUNG_ANTRAG, LEITUNG_ROUTE]);
  });

  it('ein Fehler bleibt nicht als "Lade Foto..." stehen, sondern bietet "Erneut versuchen"', async () => {
    apiGet.mockImplementation(async (route: string) => {
      if (route === LEITUNG_ANTRAG) return { data: leitungsAntrag };
      throw serverFehler(500);
    });

    const { container, getByText } = render(<LeitungAntragModal requestId={41} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waitFor(() => expect(container.textContent).toContain('Das Foto konnte nicht geladen werden.'));
    expect(container.textContent).not.toContain('Lade Foto...');

    apiGet.mockImplementation(async (route: string) => ({ data: new Blob([`foto:${route}`], { type: 'image/jpeg' }) }));
    await act(async () => { fireEvent.click(getByText('Erneut versuchen')); });

    await waitFor(() => expect(fotoIn(container)).not.toBeNull());
  });

  it('Foto löschen: die Anzeige verschwindet und gibt ihre URL frei', async () => {
    const { container, getByText } = render(<LeitungAntragModal requestId={41} onClose={vi.fn()} onSuccess={vi.fn()} />);
    await waitFor(() => expect(fotoIn(container)).not.toBeNull());
    const url = fotoIn(container)!.getAttribute('src');

    await act(async () => { fireEvent.click(getByText('Foto löschen')); });

    await waitFor(() => expect(fotoIn(container)).toBeNull());
    expect(apiDelete).toHaveBeenCalledWith(`/admin/activities/requests/41/photo`);
    expect(urls.freigegeben).toContain(url);
    expect(dateien.size).toBe(0);
  });

  it('das Konfi-Detail öffnet das Foto sofort und lädt darin über dieselbe Anzeige', () => {
    // KonfiDetailView selbst zu zeichnen brauchte ein Dutzend Attrappen für
    // Dinge, die mit dem Foto nichts zu tun haben. Die Anzeige ist oben
    // gerendert geprüft; hier, dass das Konfi-Detail sie nimmt und nicht
    // mehr selbst lädt.
    const quelle = readFileSync(resolve(process.cwd(), 'src/components/admin/views/KonfiDetailView.tsx'), 'utf8');
    expect(quelle).toContain('<NachweisFoto key={antragId} antragId={antragId} leitung vollflaeche />');
    expect(quelle).not.toContain('/photo`');
    // Die Foto-Ansicht steht außerhalb der Komponente: innen definiert wäre
    // sie bei jedem Zeichnen ein neuer Typ, und das Foto lüde jedes Mal neu.
    expect(quelle.indexOf('const NachweisFotoAnsicht')).toBeGreaterThan(-1);
    expect(quelle.indexOf('const NachweisFotoAnsicht')).toBeLessThan(quelle.indexOf('const KonfiDetailView'));
  });
});

// --- Hochladen -------------------------------------------------------------

// jsdom kann weder Bilder dekodieren noch auf ein Canvas zeichnen. Gestellt
// wie in uploadVerkleinerungGemeinsam: ein 4000×3000-Handyfoto mit 8 MB wird
// auf 1920×1440 gebracht und als JPEG mit 600 KB neu geschrieben.
const HANDYFOTO_BYTES = 8 * 1024 * 1024;
const VERKLEINERT_BYTES = 600 * 1024;

class HandyfotoBild {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 4000;
  naturalHeight = 3000;
  set src(_wert: string) { setTimeout(() => this.onload?.(), 0); }
}

const datei = (bytes: number, name: string, typ: string) => new File([new Uint8Array(bytes)], name, { type: typ });

const fotoWaehlen = (gewaehlt: File) => {
  // Die Dateiauswahl des Systems: Das unsichtbare Feld meldet die Datei.
  HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
    Object.defineProperty(this, 'files', { value: [gewaehlt], configurable: true });
    this.onchange?.({ target: this } as unknown as Event);
  };
};

describe('Hochladen: verkleinert, mit der Grenze des Servers und der Sende-Anzeige', () => {
  beforeEach(() => {
    (globalThis as unknown as { Image: unknown }).Image = HandyfotoBild;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: () => undefined,
      getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toBlob = function (cb: BlobCallback, typ?: string) {
      cb(new Blob([new Uint8Array(VERKLEINERT_BYTES)], { type: typ }));
    };
  });

  const melden = async (Modal: React.FC<{ onClose: () => void; onSuccess: () => void }>, gewaehlt: File) => {
    fotoWaehlen(gewaehlt);
    const ansicht = render(<Modal onClose={vi.fn()} onSuccess={vi.fn()} />);
    await act(async () => { fireEvent.click(ansicht.getByText('Gottesdienst besucht')); });
    await act(async () => { fireEvent.click(ansicht.getByText('Foto hinzufügen')); });
    return ansicht;
  };

  it('die Grenze ist die des Servers: 5 MB', () => {
    expect(UPLOAD_GRENZE.nachweisfoto).toBe(5 * 1024 * 1024);
  });

  it('ein 8-MB-Handyfoto geht als 600-KB-JPEG an den Server', async () => {
    apiPost.mockImplementation(async (route: string) => (route === '/konfi/upload-photo' ? { data: { filename: 'f'.repeat(64) } } : { data: {} }));
    const { container, getByText } = await melden(AktivitaetMeldenModal, datei(HANDYFOTO_BYTES, 'IMG_1.png', 'image/png'));
    await waitFor(() => expect(getByText('Foto ausgewählt')).toBeTruthy());

    await act(async () => { fireEvent.click(knopf(container, 'Aktivität absenden')); });

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(2));
    const [route, formular] = apiPost.mock.calls[0];
    const gesendet = (formular as FormData).get('photo') as File;
    expect(route).toBe('/konfi/upload-photo');
    expect(gesendet.size).toBe(VERKLEINERT_BYTES);
    expect(gesendet.type).toBe('image/jpeg');
    expect(gesendet.name).toBe('IMG_1.jpg');
    expect(apiPost.mock.calls[1][1]).toMatchObject({ photo_filename: 'f'.repeat(64) });
    expect(setError).not.toHaveBeenCalled();
  });

  it('ein Foto, das auch verkleinert zu groß bleibt: derselbe Satz wie in Chat und Challenges', async () => {
    // Ein GIF wird nicht umgerechnet (es könnte bewegt sein) — 6 MB bleiben 6 MB.
    const { queryByText } = await melden(AktivitaetMeldenModal, datei(6 * 1024 * 1024, 'bewegt.gif', 'image/gif'));

    await waitFor(() => expect(setError).toHaveBeenCalledWith('Datei ist zu groß (max. 5 MB).'));
    expect(queryByText('Foto ausgewählt')).toBeNull();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('das Team geht denselben Weg', async () => {
    const { queryByText } = await melden(TeamerAktivitaetMeldenModal, datei(6 * 1024 * 1024, 'bewegt.gif', 'image/gif'));

    await waitFor(() => expect(setError).toHaveBeenCalledWith('Datei ist zu groß (max. 5 MB).'));
    expect(queryByText('Foto ausgewählt')).toBeNull();
  });

  it.each([
    ['Konfi', AktivitaetMeldenModal],
    ['Team', TeamerAktivitaetMeldenModal],
  ] as const)('%s: beim Senden "Wird gesendet… 40 %" mit Balken, bei 100 % "Wird verarbeitet…"', async (_rolle, Modal) => {
    let fortschritt: ((e: { loaded: number; total: number }) => void) | undefined;
    let fertig: () => void = () => undefined;
    apiPost.mockImplementation((route: string, _daten: unknown, optionen?: { onUploadProgress?: (e: { loaded: number; total: number }) => void }) => {
      if (route !== '/konfi/upload-photo') return Promise.resolve({ data: {} });
      fortschritt = optionen?.onUploadProgress;
      return new Promise((resolveUpload) => { fertig = () => resolveUpload({ data: { filename: 'f'.repeat(64) } }); });
    });
    const { container, getByText } = await melden(Modal, datei(100 * 1024, 'klein.jpg', 'image/jpeg'));
    await waitFor(() => expect(getByText('Foto ausgewählt')).toBeTruthy());

    await act(async () => { fireEvent.click(knopf(container, 'Aktivität absenden')); });
    await waitFor(() => expect(fortschritt).toBeDefined());

    await act(async () => { fortschritt!({ loaded: 40, total: 100 }); });
    expect(container.textContent).toContain('Wird gesendet… 40 %');
    const balken = container.querySelector('[role="progressbar"]')!;
    expect(balken.getAttribute('aria-valuenow')).toBe('40');
    expect(balken.getAttribute('aria-label')).toBe('Foto wird gesendet: 40 Prozent');

    await act(async () => { fortschritt!({ loaded: 100, total: 100 }); });
    expect(container.textContent).toContain('Wird verarbeitet…');

    await act(async () => { fertig(); });
    await waitFor(() => expect(setSuccess).toHaveBeenCalledTimes(1));
  });
});
