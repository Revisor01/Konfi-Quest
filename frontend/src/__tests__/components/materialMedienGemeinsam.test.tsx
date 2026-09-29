import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, waitFor, fireEvent, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { dateien, cacheInhalt, objectUrlAttrappe, knopf } from '../medienAttrappen';

// Material-Dateien auf dem gemeinsamen Medien-System (27.09.2026).
//
// Simon: „Fotos Anträge und Material ja bitte." Vorher luden drei Stellen
// jede Material-Datei bei jedem Antippen neu per api.get (Material-Reiter,
// Material-Detail an Events, Formular der Leitung) — ohne Cache, ohne
// Fortschritt; der Betrachter holte die übrigen Dateien am Cache vorbei, das
// Formular legte je Öffnen eine Kopie in Documents/temp ab. Hochgeladen wurde
// ungeprüft und ohne Rückmeldung.
//
// Jetzt: Medien-Cache mit eigener Quelle ('material'), Fortschritt in der
// Zeile, Öffnen/Betrachter/Teilen über useDateiOeffnen, Verkleinerung und die
// Grenze des Servers (20 MB), Sende-Anzeige. Links bleiben Links — sie öffnen
// im Browser und landen nie im Cache. Gelöschtes verschwindet vom Gerät.
//
// Gerendert werden die echten Ansichten mit dem echten Cache; gestellt sind
// Dateisystem (im Speicher), API (gezählt), Netz und die Ionic-Dialoge.

vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn(async (..._args: unknown[]) => ({ data: {} }));
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
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { get isOnline() { return online; }, subscribe: () => () => undefined },
}));

vi.mock('../../utils/haptics', () => ({
  haptik: vi.fn(async () => undefined),
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM' },
  triggerPullHaptic: vi.fn(),
}));
vi.mock('../../utils/nativeFileViewer', () => ({ openFileNatively: vi.fn(async () => false) }));

const setError = vi.fn();
const setSuccess = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 3, organization_id: 1, type: 'admin', role_name: 'org_admin' }, setError, setSuccess, isOnline: true }),
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: vi.fn() }));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: vi.fn() }));
vi.mock('../../components/shared/OrgSwitcherButton', () => ({ default: () => null }));
vi.mock('../../components/shared/PostfachGlocke', () => ({ default: () => null }));
vi.mock('../../services/analytics', async (original) => ({
  // materialInhalt bleibt echt (reine Funktion der Messung „Material angesehen").
  ...(await original<typeof import('../../services/analytics')>()),
  track: vi.fn(),
  trackHandlung: vi.fn(),
}));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));

// Ionic-Dialoge: Der Betrachter wird angezeigt, nicht gerendert (gezählt
// wird, was er bekäme); Rückfragen werden sofort bestätigt.
type BetrachterProps = { files: Array<{ url: string; fileName: string; mimeType: string }>; initialIndex: number };
let betrachter: BetrachterProps | null = null;
const betrachterZeigen = vi.fn();
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonModal: (_k: unknown, props: BetrachterProps) => {
    if (props && 'files' in props) betrachter = props;
    return [betrachterZeigen, vi.fn()];
  },
  useIonAlert: () => [(optionen: { buttons: Array<{ role?: string; handler?: () => void }> }) => {
    optionen.buttons.find((b) => b.role === 'destructive')?.handler?.();
  }],
}));

import TeamerMaterialDetailPage from '../../components/teamer/pages/TeamerMaterialDetailPage';
import TeamerMaterialPage from '../../components/teamer/pages/TeamerMaterialPage';
import MaterialFormModal from '../../components/admin/modals/MaterialFormModal';
import AdminMaterialPage from '../../components/admin/pages/AdminMaterialPage';
import { clearMediaCache, getMediaBlob } from '../../services/mediaCache';
import { UPLOAD_GRENZE } from '../../services/mediaCompression';
import { laeuftAusflug } from '../../services/appSperre';

const PLAN = 'a'.repeat(64);
const FOTO = 'b'.repeat(64);
const plan = { id: 1, original_name: 'plan.pdf', stored_name: PLAN, mime_type: 'application/pdf', file_size: 2_400_000, created_at: '2026-09-01T10:00:00Z' };
const foto = { id: 2, original_name: 'foto.jpg', stored_name: FOTO, mime_type: 'image/jpeg', file_size: 800_000, created_at: '2026-09-01T10:00:00Z' };

let serverDateien: typeof plan[] = [];
let materialWeg = false;

const detail = () => ({
  id: 5, title: 'Freizeit-Ablauf', description: 'Alles für die Freizeit', created_at: '2026-09-01T10:00:00Z',
  created_by: 3, files: serverDateien, links: [{ id: 9, url: 'https://example.org/lied' }], link_url: 'https://example.org/lied',
});

const dateiAufrufe = () => apiGet.mock.calls.filter(([r]) => String(r).startsWith('/material/files/')).length;
const ohneNetz = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });

beforeEach(async () => {
  await clearMediaCache();
  dateien.clear();
  // Der zuletzt geladene Stand (offlineCache) liegt im Browser in localStorage.
  localStorage.clear();
  online = true;
  vi.clearAllMocks();
  betrachter = null;
  serverDateien = [plan, foto];
  materialWeg = false;
  apiGet.mockReset();
  apiGet.mockImplementation(async (route: string) => {
    if (!online) throw ohneNetz();
    if (route.startsWith('/material/files/')) return { data: new Blob([`datei:${route}`], { type: 'application/octet-stream' }) };
    if (route === '/material/5') {
      if (materialWeg) throw Object.assign(new Error('404'), { response: { status: 404 } });
      return { data: detail() };
    }
    if (route === '/material') return { data: [{ id: 5, title: 'Freizeit-Ablauf', file_count: serverDateien.length, created_at: '2026-09-01T10:00:00Z', created_by: 3, ist_global: true }] };
    if (route === '/admin/jahrgaenge' || route === '/events') return { data: [] };
    if (route.startsWith('/chat/files/')) return { data: new Blob([`chat:${route}`]) };
    throw new Error(`unerwartet: ${route}`);
  });
  apiPost.mockReset();
  objectUrlAttrappe();
});

afterEach(() => cleanup());

const detailOeffnen = async () => {
  const ansicht = render(<TeamerMaterialDetailPage materialId={5} onClose={vi.fn()} />);
  await waitFor(() => expect(ansicht.getByText('plan.pdf')).toBeTruthy());
  return ansicht;
};

/**
 * Eine Datei antippen und warten, bis sie offen ist (der Betrachter kam).
 * useDateiOeffnen überhört einen Tipp, solange eine Datei noch lädt — so
 * wie ein Mensch nach dem Öffnen erst wieder tippt, wenn sie offen ist.
 */
const antippen = async (ansicht: ReturnType<typeof render>, name: string) => {
  const vorher = betrachterZeigen.mock.calls.length;
  await act(async () => { fireEvent.click(ansicht.getByText(name)); });
  await waitFor(() => expect(betrachterZeigen.mock.calls.length).toBe(vorher + 1));
};

describe('Material-Detail (Team und Leitung am Event): Dateien über den Medien-Cache', () => {
  it('eine Datei antippen öffnet sie — beim zweiten Mal ohne Download', async () => {
    const ansicht = await detailOeffnen();

    await antippen(ansicht, 'plan.pdf');
    await waitFor(() => expect(betrachterZeigen).toHaveBeenCalledTimes(1));
    await antippen(ansicht, 'plan.pdf');
    await waitFor(() => expect(betrachterZeigen).toHaveBeenCalledTimes(2));

    expect(dateiAufrufe()).toBe(1);
    expect(cacheInhalt()).toEqual([`material-${PLAN}`]);
  });

  it('der Betrachter bekommt alle Dateien des Materials mit dem Typ des Servers', async () => {
    const ansicht = await detailOeffnen();

    await antippen(ansicht, 'foto.jpg');
    await waitFor(() => expect(betrachterZeigen).toHaveBeenCalledTimes(1));

    expect(betrachter!.files.map((f) => [f.fileName, f.mimeType])).toEqual([
      ['plan.pdf', 'application/pdf'],
      ['foto.jpg', 'image/jpeg'],
    ]);
    expect(betrachter!.initialIndex).toBe(1);
    // Die andere Datei holt der Betrachter selbst — über denselben Cache.
    expect(betrachter!.files[0].url).toBe(`/api/material/files/${PLAN}`);
  });

  it('zeigt in der Zeile, wie weit das Laden ist — "Wird geladen… 40 %" mit Balken', async () => {
    let fertig: () => void = () => undefined;
    const ansicht = await detailOeffnen();
    apiGet.mockImplementationOnce((_route: string, optionen: { onDownloadProgress: (e: { loaded: number; total: number }) => void }) => {
      optionen.onDownloadProgress({ loaded: 40, total: 100 });
      return new Promise((resolveDatei) => { fertig = () => resolveDatei({ data: new Blob(['pdf']) }); });
    });

    await act(async () => { fireEvent.click(ansicht.getByText('plan.pdf')); });

    await waitFor(() => expect(ansicht.container.textContent).toContain('Wird geladen… 40 %'));
    const balken = ansicht.container.querySelector('[aria-label="Datei wird geladen: 40 Prozent"]')!;
    expect(balken.getAttribute('role')).toBe('progressbar');
    expect(balken.getAttribute('aria-valuenow')).toBe('40');

    await act(async () => { fertig(); });
    await waitFor(() => expect(ansicht.container.textContent).not.toContain('Wird geladen…'));
    expect(ansicht.container.textContent).toContain('2.3 MB');
  });

  it('eine Chat-Datei gleichen Namens beantwortet keine Material-Anfrage', async () => {
    await getMediaBlob(PLAN);
    const ansicht = await detailOeffnen();

    await antippen(ansicht, 'plan.pdf');
    await waitFor(() => expect(betrachterZeigen).toHaveBeenCalledTimes(1));

    expect(dateiAufrufe()).toBe(1);
    expect(cacheInhalt()).toEqual([`chat-${PLAN}`, `material-${PLAN}`]);
  });

  it('Links öffnen im Browser und landen nicht im Cache', async () => {
    const fenster = vi.spyOn(window, 'open').mockImplementation(() => null);
    const ansicht = await detailOeffnen();

    await act(async () => { fireEvent.click(ansicht.getByText('example.org')); });

    await waitFor(() => expect(fenster).toHaveBeenCalledWith('https://example.org/lied', '_blank'));
    expect(betrachterZeigen).not.toHaveBeenCalled();
    expect(dateiAufrufe()).toBe(0);
    expect(cacheInhalt()).toEqual([]);
    fenster.mockRestore();
  });

  it('ohne Netz: der zuletzt geladene Stand, die Datei vom Gerät', async () => {
    const erstes = await detailOeffnen();
    await antippen(erstes, 'plan.pdf');
    await waitFor(() => expect(betrachterZeigen).toHaveBeenCalledTimes(1));
    erstes.unmount();

    online = false;
    const zweites = await detailOeffnen();
    await antippen(zweites, 'plan.pdf');

    await waitFor(() => expect(betrachterZeigen).toHaveBeenCalledTimes(2));
    expect(dateiAufrufe()).toBe(1);
    expect(setError).not.toHaveBeenCalled();
  });
});

describe('Gelöschtes Material verschwindet vom Gerät', () => {
  it('eine gelöschte Datei: beim nächsten Öffnen weg aus Liste und Cache', async () => {
    const erstes = await detailOeffnen();
    await antippen(erstes, 'plan.pdf');
    await antippen(erstes, 'foto.jpg');
    await waitFor(() => expect(cacheInhalt()).toEqual([`material-${PLAN}`, `material-${FOTO}`]));
    erstes.unmount();

    // Die Leitung hat plan.pdf gelöscht; der Server führt nur noch das Foto.
    serverDateien = [foto];
    const zweites = render(<TeamerMaterialDetailPage materialId={5} onClose={vi.fn()} />);
    await waitFor(() => expect(zweites.getByText('foto.jpg')).toBeTruthy());

    expect(zweites.queryByText('plan.pdf')).toBeNull();
    expect(cacheInhalt()).toEqual([`material-${FOTO}`]);
  });

  it('ein gelöschtes Material (404): alle Dateien und der gemerkte Stand gehen', async () => {
    const erstes = await detailOeffnen();
    await antippen(erstes, 'plan.pdf');
    await waitFor(() => expect(cacheInhalt()).toEqual([`material-${PLAN}`]));
    erstes.unmount();

    materialWeg = true;
    const zweites = render(<TeamerMaterialDetailPage materialId={5} onClose={vi.fn()} />);
    await waitFor(() => expect(zweites.getByText('Nicht gefunden')).toBeTruthy());
    expect(cacheInhalt()).toEqual([]);

    // Auch ohne Netz taucht es nicht wieder auf.
    zweites.unmount();
    online = false;
    const drittes = render(<TeamerMaterialDetailPage materialId={5} onClose={vi.fn()} />);
    await waitFor(() => expect(drittes.getByText('Nicht gefunden')).toBeTruthy());
  });

  it('die Leitung löscht ein Material: seine Dateien gehen auch vom eigenen Gerät', async () => {
    const detailAnsicht = await detailOeffnen();
    await antippen(detailAnsicht, 'plan.pdf');
    await antippen(detailAnsicht, 'foto.jpg');
    await waitFor(() => expect(cacheInhalt()).toEqual([`material-${PLAN}`, `material-${FOTO}`]));
    detailAnsicht.unmount();

    const liste = render(<AdminMaterialPage />);
    await waitFor(() => expect(liste.getByText('Freizeit-Ablauf')).toBeTruthy());
    await act(async () => {
      fireEvent.click(liste.container.querySelector('[aria-label="Material löschen"]')!);
    });

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/material/5'));
    await waitFor(() => expect(cacheInhalt()).toEqual([]));
  });

  it('die Leitung löscht eine Datei im Formular: sie geht auch vom eigenen Gerät', async () => {
    const formular = render(<MaterialFormModal material={detail() as never} onClose={vi.fn()} onSuccess={vi.fn()} />);
    await antippen(formular, 'plan.pdf');
    await waitFor(() => expect(cacheInhalt()).toEqual([`material-${PLAN}`]));

    await act(async () => {
      fireEvent.click(formular.container.querySelectorAll('[aria-label="Datei löschen"]')[0]);
    });

    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith('/material/files/1'));
    await waitFor(() => expect(cacheInhalt()).toEqual([]));
  });
});

describe('Material-Reiter: derselbe Weg', () => {
  it('Detail öffnen, Datei öffnen — beim zweiten Mal ohne Download, ohne Netz aus dem gemerkten Stand', async () => {
    const reiter = render(<MemoryRouter initialEntries={['/teamer/profile/material']}><TeamerMaterialPage /></MemoryRouter>);
    await waitFor(() => expect(reiter.getByText('Freizeit-Ablauf')).toBeTruthy());

    await act(async () => { fireEvent.click(reiter.getByText('Freizeit-Ablauf')); });
    await waitFor(() => expect(reiter.getByText('plan.pdf')).toBeTruthy());
    await antippen(reiter, 'plan.pdf');
    await antippen(reiter, 'plan.pdf');
    await waitFor(() => expect(betrachterZeigen).toHaveBeenCalledTimes(2));
    expect(dateiAufrufe()).toBe(1);
    // Vorher bekam der Betrachter hier nur die eine Datei.
    expect(betrachter!.files).toHaveLength(2);
    reiter.unmount();

    // Ohne Netz: vorher "Fehler beim Laden des Materials".
    online = false;
    const offline = render(<MemoryRouter initialEntries={['/teamer/profile/material']}><TeamerMaterialPage /></MemoryRouter>);
    await waitFor(() => expect(offline.getByText('Freizeit-Ablauf')).toBeTruthy());
    await act(async () => { fireEvent.click(offline.getByText('Freizeit-Ablauf')); });
    await waitFor(() => expect(offline.getByText('plan.pdf')).toBeTruthy());
    await antippen(offline, 'plan.pdf');
    await waitFor(() => expect(betrachterZeigen).toHaveBeenCalledTimes(3));

    expect(dateiAufrufe()).toBe(1);
    expect(setError).not.toHaveBeenCalled();
  });
});

// --- Hochladen (Formular der Leitung) --------------------------------------

const VERKLEINERT_BYTES = 600 * 1024;

class HandyfotoBild {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 4000;
  naturalHeight = 3000;
  set src(_wert: string) { setTimeout(() => this.onload?.(), 0); }
}

const datei = (bytes: number, name: string, typ: string) => new File([new Uint8Array(bytes)], name, { type: typ });

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

  // Die Dateiauswahl des Systems: Das Feld, das die Hülle dateiAuswaehlen
  // anlegt, meldet die Dateien. Mitgeschrieben wird, ob die App-Sperre dabei
  // abgemeldet war (Simons Befund 29.09.2026: die Auswahl sperrte bei „Sofort").
  const echterKlick = HTMLInputElement.prototype.click;
  let ausflugBeimOeffnen: boolean[] = [];
  afterEach(() => { HTMLInputElement.prototype.click = echterKlick; });

  const waehlen = async (ansicht: ReturnType<typeof render>, gewaehlt: File[]) => {
    ausflugBeimOeffnen = [];
    HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
      ausflugBeimOeffnen.push(laeuftAusflug());
      Object.defineProperty(this, 'files', { value: gewaehlt, configurable: true });
      this.onchange?.(new Event('change'));
    };
    await act(async () => { fireEvent.click(ansicht.getByText('Datei auswählen')); });
    expect(ausflugBeimOeffnen).toEqual([true]);
  };

  it('die Grenze ist die des Servers: 20 MB je Datei', () => {
    expect(UPLOAD_GRENZE.material).toBe(20 * 1024 * 1024);
  });

  it('ein 8-MB-Foto geht als 600-KB-JPEG hoch; ein 21-MB-Video bleibt draußen, mit dem Satz des Servers', async () => {
    apiPost.mockResolvedValue({ data: { id: 5 } });
    const formular = render(<MaterialFormModal material={detail() as never} onClose={vi.fn()} onSuccess={vi.fn()} />);

    await waehlen(formular, [datei(8 * 1024 * 1024, 'Plakat.png', 'image/png'), datei(21 * 1024 * 1024, 'clip.mp4', 'video/mp4')]);

    await waitFor(() => expect(setError).toHaveBeenCalledWith('Datei ist zu groß (max. 20 MB).'));
    await waitFor(() => expect(formular.getByText('Plakat.jpg')).toBeTruthy());
    expect(formular.queryByText('clip.mp4')).toBeNull();

    await act(async () => { fireEvent.click(knopf(formular.container, 'Material speichern')); });

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    const [route, formularDaten, optionen] = apiPost.mock.calls[0];
    const gesendet = (formularDaten as FormData).getAll('files') as File[];
    expect(route).toBe('/material/5/files');
    expect(gesendet.map((d) => [d.name, d.size, d.type])).toEqual([['Plakat.jpg', VERKLEINERT_BYTES, 'image/jpeg']]);
    expect(optionen).toMatchObject({ timeout: 180000 });
  });

  it('beim Speichern mit Dateien: "Wird gesendet… 40 %" mit Balken, bei 100 % "Wird verarbeitet…"', async () => {
    let fortschritt: ((e: { loaded: number; total: number }) => void) | undefined;
    let fertig: () => void = () => undefined;
    apiPost.mockImplementation((_route: string, _daten: unknown, optionen?: { onUploadProgress?: (e: { loaded: number; total: number }) => void }) => {
      fortschritt = optionen?.onUploadProgress;
      return new Promise((resolveUpload) => { fertig = () => resolveUpload({ data: [] }); });
    });
    const formular = render(<MaterialFormModal material={detail() as never} onClose={vi.fn()} onSuccess={vi.fn()} />);
    await waehlen(formular, [datei(100 * 1024, 'ablauf.pdf', 'application/pdf')]);
    await waitFor(() => expect(formular.getByText('ablauf.pdf')).toBeTruthy());

    await act(async () => { fireEvent.click(knopf(formular.container, 'Material speichern')); });
    await waitFor(() => expect(fortschritt).toBeDefined());

    await act(async () => { fortschritt!({ loaded: 40, total: 100 }); });
    expect(formular.container.textContent).toContain('Wird gesendet… 40 %');
    const balken = [...formular.container.querySelectorAll('[role="progressbar"]')]
      .find((b) => b.getAttribute('aria-label')?.startsWith('Datei wird gesendet'))!;
    expect(balken.getAttribute('aria-valuenow')).toBe('40');

    await act(async () => { fortschritt!({ loaded: 100, total: 100 }); });
    expect(formular.container.textContent).toContain('Wird verarbeitet…');

    await act(async () => { fertig(); });
  });
});
