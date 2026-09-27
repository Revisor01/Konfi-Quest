/**
 * „Material hinterlegt, abgerufen auch bitte" (Simon, 27.09.2026).
 *
 * Hinterlegt zählt `material-bereitgestellt` schon. Neu, gerendert geprüft:
 *
 *   - `material-angesehen` — die Detailansicht ist geöffnet. EINMAL je
 *     Öffnen, erst nach der erfolgreichen Antwort; ein erneutes Laden
 *     (Wiederverbinden, Aktualisieren) meldet nicht noch einmal. Merkmal
 *     `inhalt` wie beim Bereitstellen: datei | link | beides | nur-text.
 *   - `material-abgerufen` — eine Datei (nach erfolgreichem Laden) oder ein
 *     Link daraus ist geöffnet. Merkmal `inhalt`: datei | link.
 *
 * Beide Wege, auf denen das Team Material öffnet: der Material-Reiter
 * (TeamerMaterialPage, Liste + Detail) und das Material an einem Event
 * (TeamerMaterialDetailPage, auch für die Leitung).
 *
 * Nie dabei: Titel, Kennung, Dateiname, Dateityp, Adresse des Links.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockApiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  DATEI_TIMEOUT_MS: 180000,
}));

const mockTrackHandlung = vi.fn();
// Echte Hilfen (materialInhalt), nur der Versand wird beobachtet.
vi.mock('../../services/analytics', async () => ({
  ...(await vi.importActual<typeof import('../../services/analytics')>('../../services/analytics')),
  trackHandlung: (...args: unknown[]) => mockTrackHandlung(...args),
}));

const mockSetError = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 9, organization_id: 1, role_name: 'teamer' },
    setError: mockSetError,
    setSuccess: vi.fn(),
    isOnline: true,
  }),
}));

// Echter useOfflineQuery, Zwischenspeicher steuerbar.
let mockCache: { data: unknown } | null = null;
vi.mock('../../services/offlineCache', () => ({
  CACHE_TTL: { PROFILE: 1000, STAMMDATEN: 1000 },
  offlineCache: {
    get: vi.fn(async () => mockCache),
    set: vi.fn(async () => undefined),
    isStale: () => false,
  },
}));
let mockOnline = true;
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: {
    get isOnline() { return mockOnline; },
    subscribe: () => () => undefined,
  },
}));

vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: () => null,
  AppKopfzeileGross: () => null,
}));
vi.mock('../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveRefresh: () => {},
  useLiveUpdate: () => ({ triggerRefresh: vi.fn() }),
}));

const mockOpenNatively = vi.fn();
vi.mock('../../utils/nativeFileViewer', () => ({
  openFileNatively: (...args: unknown[]) => mockOpenNatively(...args),
}));
vi.mock('../../utils/haptics', () => ({
  haptik: vi.fn(async () => undefined),
  triggerPullHaptic: vi.fn(),
  ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM', Heavy: 'HEAVY' },
}));

import TeamerMaterialDetailPage from '../../components/teamer/pages/TeamerMaterialDetailPage';
import TeamerMaterialPage from '../../components/teamer/pages/TeamerMaterialPage';

const DATEI = {
  id: 1,
  original_name: 'Liedblatt-Konfifreizeit.pdf',
  stored_name: 'a1b2c3.pdf',
  mime_type: 'application/pdf',
  file_size: 2048,
  created_at: '2026-09-01T10:00:00Z',
};

const material = (ueber: Record<string, unknown> = {}) => ({
  id: 7,
  title: 'Andacht in der Dorfkirche',
  description: 'Ablauf und Lieder',
  files: [DATEI],
  links: [{ id: 1, url: 'https://example.org/liederheft' }],
  created_at: '2026-09-01T10:00:00Z',
  ...ueber,
});

/** Eine Antwort, die der Test selbst freigibt. */
const offen = () => {
  let ok: (v: unknown) => void = () => {};
  let nein: (e: unknown) => void = () => {};
  const promise = new Promise((a, b) => { ok = a; nein = b; });
  return { promise, antworten: (v: unknown) => ok(v), scheitern: (e: unknown) => nein(e) };
};

/** Erst finden, dann klicken — ein findBy innerhalb von act wartet ins Leere. */
const klicken = async (text: string) => {
  const ziel = await screen.findByText(text);
  await act(async () => { fireEvent.click(ziel); });
};

const angesehen = () => mockTrackHandlung.mock.calls.filter(([h]) => h === 'material-angesehen');
const abgerufen = () => mockTrackHandlung.mock.calls.filter(([h]) => h === 'material-abgerufen');

let fensterOeffnen: ReturnType<typeof vi.fn>;

beforeEach(() => {
  cleanup();
  mockApiGet.mockReset();
  mockTrackHandlung.mockReset();
  mockSetError.mockReset();
  mockOpenNatively.mockReset().mockResolvedValue(true);
  mockCache = null;
  mockOnline = true;
  fensterOeffnen = vi.fn();
  vi.stubGlobal('open', fensterOeffnen);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Material an einem Event (TeamerMaterialDetailPage)', () => {
  const mitDetail = (daten: unknown) => {
    mockApiGet.mockImplementation((url: string) =>
      url === '/material/7' ? Promise.resolve({ data: daten }) : Promise.reject(new Error(url))
    );
  };

  it('angesehen: einmal, nach der Antwort, mit der Inhaltsart', async () => {
    const antwort = offen();
    mockApiGet.mockImplementation((url: string) =>
      url === '/material/7' ? antwort.promise : Promise.reject(new Error(url))
    );
    render(<TeamerMaterialDetailPage materialId={7} onClose={vi.fn()} />);

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/material/7'));
    expect(angesehen()).toEqual([]);

    await act(async () => { antwort.antworten({ data: material() }); });
    await screen.findByText(DATEI.original_name);

    expect(mockTrackHandlung.mock.calls).toEqual([
      ['material-angesehen', { inhalt: 'beides' }],
    ]);
  });

  it('ein erneutes Laden meldet nicht noch einmal', async () => {
    mitDetail(material());
    render(<TeamerMaterialDetailPage materialId={7} onClose={vi.fn()} />);
    await screen.findByText(DATEI.original_name);

    // Wiederverbinden lädt die Ansicht frisch (useOfflineQuery, sync:reconnect).
    await act(async () => { window.dispatchEvent(new Event('sync:reconnect')); });
    await waitFor(() =>
      expect(mockApiGet.mock.calls.filter(([u]) => u === '/material/7').length).toBe(2)
    );

    expect(angesehen().length).toBe(1);
  });

  it.each([
    [{ files: [], links: [] }, 'nur-text'],
    [{ links: [] }, 'datei'],
    [{ files: [], links: undefined, link_url: 'https://example.org/alt' }, 'link'],
  ])('Inhaltsart %j -> %s', async (ueber, erwartet) => {
    mitDetail(material(ueber));
    render(<TeamerMaterialDetailPage materialId={7} onClose={vi.fn()} />);
    await screen.findAllByText('Andacht in der Dorfkirche');
    await waitFor(() => expect(angesehen().length).toBe(1));
    expect(angesehen()[0]).toEqual(['material-angesehen', { inhalt: erwartet }]);
  });

  it('scheitert das Laden, wird nichts gemeldet', async () => {
    mockApiGet.mockRejectedValue(new Error('Netz weg'));
    render(<TeamerMaterialDetailPage materialId={7} onClose={vi.fn()} />);
    await screen.findByText('Nicht gefunden');
    expect(mockTrackHandlung).not.toHaveBeenCalled();
  });

  it('nur aus dem Zwischenspeicher (offline) wird nichts gemeldet', async () => {
    mockCache = { data: material() };
    mockOnline = false;
    render(<TeamerMaterialDetailPage materialId={7} onClose={vi.fn()} />);
    await screen.findByText(DATEI.original_name);
    expect(mockApiGet).not.toHaveBeenCalled();
    expect(mockTrackHandlung).not.toHaveBeenCalled();
  });

  it('Datei: abgerufen erst nach dem Laden der Datei', async () => {
    const datei = offen();
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/material/7') return Promise.resolve({ data: material() });
      if (url === '/material/files/a1b2c3.pdf') return datei.promise;
      return Promise.reject(new Error(url));
    });
    render(<TeamerMaterialDetailPage materialId={7} onClose={vi.fn()} />);
    await klicken(DATEI.original_name);

    await waitFor(() =>
      expect(mockApiGet.mock.calls.some(([u]) => u === '/material/files/a1b2c3.pdf')).toBe(true)
    );
    expect(abgerufen()).toEqual([]);

    await act(async () => { datei.antworten({ data: new Blob(['%PDF']), headers: {} }); });

    expect(abgerufen()).toEqual([['material-abgerufen', { inhalt: 'datei' }]]);
    expect(JSON.stringify(mockTrackHandlung.mock.calls)).not.toMatch(/Liedblatt|a1b2c3|pdf|Dorfkirche/);
  });

  it('Datei: scheitert das Laden, wird nichts gemeldet', async () => {
    mockApiGet.mockImplementation((url: string) =>
      url === '/material/7'
        ? Promise.resolve({ data: material() })
        : Promise.reject({ response: { status: 404 } })
    );
    render(<TeamerMaterialDetailPage materialId={7} onClose={vi.fn()} />);
    await klicken(DATEI.original_name);

    await waitFor(() => expect(mockSetError).toHaveBeenCalledTimes(1));
    expect(mockSetError.mock.calls[0][0]).toBe('Fehler beim Öffnen der Datei');
    expect(abgerufen()).toEqual([]);
  });

  it('Link: abgerufen, wenn er geöffnet wird — ohne Adresse', async () => {
    mitDetail(material());
    render(<TeamerMaterialDetailPage materialId={7} onClose={vi.fn()} />);
    await klicken('example.org');

    await waitFor(() => expect(fensterOeffnen).toHaveBeenCalledWith('https://example.org/liederheft', '_blank'));
    expect(abgerufen()).toEqual([['material-abgerufen', { inhalt: 'link' }]]);
    expect(JSON.stringify(mockTrackHandlung.mock.calls)).not.toContain('example.org');
  });
});

describe('Material-Reiter des Teams (TeamerMaterialPage)', () => {
  const zeigen = () =>
    render(
      <MemoryRouter initialEntries={['/teamer/profile/material']}>
        <TeamerMaterialPage />
      </MemoryRouter>
    );

  const mitDetail = (detail: () => Promise<unknown>) => {
    mockApiGet.mockImplementation((url: string) => {
      if (url === '/admin/jahrgaenge') return Promise.resolve({ data: [] });
      if (url === '/material') {
        return Promise.resolve({
          data: [{ id: 7, title: 'Andacht in der Dorfkirche', file_count: 1, created_at: '2026-09-01T10:00:00Z' }],
        });
      }
      if (url === '/material/7') return detail();
      if (url === '/material/files/a1b2c3.pdf') {
        return Promise.resolve({ data: new Blob(['%PDF']), headers: {} });
      }
      return Promise.reject(new Error(url));
    });
  };

  it('Liste -> Detail: angesehen nach der Antwort, einmal', async () => {
    const antwort = offen();
    mitDetail(() => antwort.promise);
    zeigen();
    await klicken('Andacht in der Dorfkirche');

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/material/7'));
    expect(angesehen()).toEqual([]);

    await act(async () => { antwort.antworten({ data: material({ links: [] }) }); });
    await screen.findByText(DATEI.original_name);

    expect(mockTrackHandlung.mock.calls).toEqual([
      ['material-angesehen', { inhalt: 'datei' }],
    ]);
  });

  it('scheitert das Laden des Details, wird nichts gemeldet', async () => {
    mitDetail(() => Promise.reject(new Error('Netz weg')));
    zeigen();
    await klicken('Andacht in der Dorfkirche');

    await waitFor(() => expect(mockSetError).toHaveBeenCalledWith('Fehler beim Laden des Materials'));
    expect(mockTrackHandlung).not.toHaveBeenCalled();
  });

  it('Datei und Link aus dem Detail: je einmal abgerufen', async () => {
    mitDetail(() => Promise.resolve({ data: material() }));
    zeigen();
    await klicken('Andacht in der Dorfkirche');

    await klicken(DATEI.original_name);
    await waitFor(() => expect(abgerufen().length).toBe(1));
    await act(async () => { fireEvent.click(screen.getByText('example.org')); });
    await waitFor(() => expect(abgerufen().length).toBe(2));

    expect(abgerufen()).toEqual([
      ['material-abgerufen', { inhalt: 'datei' }],
      ['material-abgerufen', { inhalt: 'link' }],
    ]);
    expect(angesehen()).toEqual([['material-angesehen', { inhalt: 'beides' }]]);
  });
});
