// Material in der Web-Fassung, gerendert (docs/planung/web-alle-bereiche.md,
// Entscheidung 6): die Verwaltung der Leitung (Tabelle, Suche, Jahrgangs-Filter,
// Rechte "nur die erstellende Person oder die Gemeindeleitung"), die Liste des
// Teams mit dem Material daneben und das Fenster "Material ansehen". Die Seiten
// halten Daten, Filter und das Oeffnen von Dateien und Links; geprueft wird,
// dass die Web-Fassung dieselben Routen, Fenster und Wege mit den richtigen
// Werten nutzt und dass die Darstellung der App bleibt.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';
import { dateiGroesse, dateiSymbol } from '../../../components/teamer/web/material/materialAnzeige';
import { ICON_BILD, ICON_DATEI, ICON_MUSIK, ICON_VIDEO } from '../../../components/shared/icons';

const h = vi.hoisted(() => ({
  breit: true,
  daten: {} as Record<string, unknown>,
  kopf: {} as Record<string, string>,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
  refresh: vi.fn(),
  setError: vi.fn(),
  detail: vi.fn(),
  vergessen: vi.fn(),
  dateiOeffnen: vi.fn(),
  ladend: null as { pfad: string; prozent: number | null } | null,
  track: vi.fn(),
  linkOeffnen: vi.fn(),
}));

vi.mock('@ionic/react', async () => (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../components/shared/AppKopfzeile', () => ({
  default: ({ titel, links }: { titel?: string; links?: React.ReactNode }) => <header data-testid="kopfzeile" data-titel={titel}>{links}</header>,
  AppKopfzeileGross: () => null,
}));
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/teamer/profile/material' }) }));
vi.mock('../../../services/api', () => ({ default: { get: (...a: unknown[]) => h.apiGet(...a), delete: (...a: unknown[]) => h.apiDelete(...a) } }));
vi.mock('../../../services/materialDetail', () => ({
  materialDetailLaden: (...a: unknown[]) => h.detail(...a),
  materialVergessen: (...a: unknown[]) => h.vergessen(...a),
}));
vi.mock('../../../services/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/analytics')>()),
  trackHandlung: (...a: unknown[]) => h.track(...a),
}));
vi.mock('../../../services/systemDialoge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/systemDialoge')>()),
  linkOeffnen: (...a: unknown[]) => h.linkOeffnen(...a),
}));
vi.mock('../../../utils/haptics', () => ({ haptik: async () => {}, triggerPullHaptic: () => {}, ImpactStyle: { Medium: 'MEDIUM' } }));
vi.mock('../../../hooks/useDateiOeffnen', () => ({
  useDateiOeffnen: () => ({ dateiOeffnen: h.dateiOeffnen, ladendeDatei: h.ladend }),
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../../components/admin/modals/MaterialFormModal', () => ({ default: () => null }));
vi.mock('../../../hooks/useOfflineQuery', async () => {
  const React = await import('react');
  return {
    // Der Schluessel heisst "<admin|teamer>:<was>:<org>...": die Daten stehen unter <was>; der
    // Lader laeuft bei jedem neuen Schluessel, damit die Seite ihre Abfrage (Suche, Jahrgang) stellt.
    useOfflineQuery: (schluessel: string, lader: () => Promise<unknown>) => {
      const art = schluessel.split(':')[1];
      const [daten, setDaten] = React.useState<unknown>(h.daten[art]);
      React.useEffect(() => { void lader().then((d) => setDaten(d)); }, [schluessel]); // eslint-disable-line react-hooks/exhaustive-deps
      return { data: daten ?? [], loading: false, refresh: h.refresh, refreshLive: vi.fn() };
    },
  };
});

import AdminMaterialPage from '../../../components/admin/pages/AdminMaterialPage';
import TeamerMaterialPage from '../../../components/teamer/pages/TeamerMaterialPage';
import TeamerMaterialDetailPage from '../../../components/teamer/pages/TeamerMaterialDetailPage';
import MaterialFormModal from '../../../components/admin/modals/MaterialFormModal';

const MATERIAL = [
  { id: 1, title: 'Liederbuch Freizeit', description: 'Alle Lieder für das Lagerfeuer', file_count: 2, link_count: 1, link_url: 'https://beispiel.example/lieder', event_count: 1, ist_global: true, created_by: 5, created_by_name: 'Sam Muster', jahrgaenge: [], created_at: '2026-08-01T10:00:00Z' },
  { id: 2, title: 'Andacht Advent', file_count: 1, ist_global: false, created_by: 9, created_by_name: 'Alex Beispiel', jahrgaenge: [{ id: 12, name: 'Jahrgang 2027' }], created_at: '2026-09-01T10:00:00Z' },
  { id: 3, title: 'Spielesammlung', description: 'Kennenlernspiele', file_count: 3, ist_global: false, created_by: 5, created_by_name: 'Sam Muster', jahrgaenge: [{ id: 11, name: 'Jahrgang 2026' }, { id: 12, name: 'Jahrgang 2027' }], created_at: '2026-09-15T10:00:00Z' },
];

const DETAIL = {
  id: 1, title: 'Liederbuch Freizeit', description: 'Alle Lieder für das Lagerfeuer\nmit Akkorden', ist_global: true, admin_name: 'Sam Muster', created_at: '2026-08-01T10:00:00Z',
  events: [{ id: 4, name: 'Konfi-Wochenende' }], jahrgaenge: [{ id: 12, name: 'Jahrgang 2027' }],
  files: [
    { id: 71, original_name: 'lieder.pdf', stored_name: 'a1b2.pdf', mime_type: 'application/pdf', file_size: 2516582, created_at: '2026-08-01T10:00:00Z' },
    { id: 72, original_name: 'gruppenfoto.jpg', stored_name: 'c3d4.jpg', mime_type: 'image/jpeg', file_size: 1536, created_at: '2026-08-01T10:00:00Z' },
  ],
  links: [{ id: 1, url: 'https://beispiel.example/lieder' }],
};

const tabelle = (name: string) => screen.getByRole('table', { name });
const zeilen = (name: string) => within(tabelle(name)).getAllByRole('row').slice(1);
const zelle = (z: HTMLElement, i: number) => within(z).getAllByRole('cell')[i];
const spaltenkoepfe = (name: string) => within(tabelle(name)).getAllByRole('columnheader').map((c) => c.textContent);
const warten = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); };
const bestaetigen = async (text: string) => {
  await act(async () => { await h.stand.alert?.buttons?.find((b) => b.text === text)?.handler?.(); });
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.kopf = {};
  h.ladend = null;
  h.user = konto('org_admin');
  h.daten = { material: MATERIAL, jahrgaenge: [{ id: 11, name: 'Jahrgang 2026' }, { id: 12, name: 'Jahrgang 2027' }] };
  h.apiGet.mockImplementation(async (url: string) => {
    if (url === '/material') return { data: MATERIAL, headers: h.kopf };
    if (url === '/admin/jahrgaenge') return { data: h.daten.jahrgaenge, headers: {} };
    if (url.startsWith('/material/')) return { data: DETAIL, headers: {} };
    return { data: [], headers: {} };
  });
  h.apiDelete.mockResolvedValue({ data: {} });
  h.detail.mockResolvedValue({ daten: DETAIL, ausSpeicher: false });
});

// ---------------------------------------------------------------------------
describe('Darstellung von Dateien', () => {
  it('Groesse in B, KB und MB mit einer Nachkommastelle', () => {
    expect(dateiGroesse(512)).toBe('512 B');
    expect(dateiGroesse(1536)).toBe('1.5 KB');
    expect(dateiGroesse(2516582)).toBe('2.4 MB');
  });

  it('das Symbol richtet sich nach dem Typ der Datei', () => {
    expect(dateiSymbol('image/png')).toBe(ICON_BILD);
    expect(dateiSymbol('video/mp4')).toBe(ICON_VIDEO);
    expect(dateiSymbol('audio/mpeg')).toBe(ICON_MUSIK);
    expect(dateiSymbol('application/pdf')).toBe(ICON_DATEI);
  });
});

// ---------------------------------------------------------------------------
describe('Material verwalten (Web)', () => {
  const oeffnen = async () => {
    const r = render(<AdminMaterialPage />);
    await warten();
    return r;
  };

  it('Titel, Weg zurueck, Kennzahlen, Spalten und Zeilen', async () => {
    await oeffnen();
    expect(screen.getByRole('heading', { level: 1, name: 'Material verwalten' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mehr' })).toHaveAttribute('href', '/admin/settings');
    expect(screen.getByRole('group', { name: 'Material: 3' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Dateien: 6' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Links: 1' })).toBeInTheDocument();
    expect(spaltenkoepfe('Materialien')).toEqual(['Material', 'Sichtbar für', 'Inhalt', 'Erstellt von', 'Aktionen']);
    const z = zeilen('Materialien');
    expect(z).toHaveLength(3);
    expect(zelle(z[0], 0)).toHaveTextContent('Liederbuch Freizeit');
    expect(zelle(z[0], 0)).toHaveTextContent('Alle Lieder für das Lagerfeuer');
    expect(zelle(z[0], 1)).toHaveTextContent('Für alle');
    expect(zelle(z[0], 2)).toHaveTextContent('2 Dateien');
    expect(zelle(z[0], 2)).toHaveTextContent('1 Link');
    expect(zelle(z[0], 2)).toHaveTextContent('1 Event');
    expect(zelle(z[0], 3)).toHaveTextContent('Sam Muster');
    expect(zelle(z[1], 1)).toHaveTextContent('Jahrgang 2027');
    expect(zelle(z[1], 2)).toHaveTextContent('1 Datei');
    expect(zelle(z[2], 1)).toHaveTextContent('Jahrgang 2026, Jahrgang 2027');
  });

  it('die Gemeindeleitung darf jedes Material bearbeiten und loeschen', async () => {
    await oeffnen();
    for (const titel of ['Liederbuch Freizeit', 'Andacht Advent', 'Spielesammlung']) {
      expect(screen.getAllByRole('button', { name: `${titel} bearbeiten` })).toHaveLength(2);
      expect(screen.getByRole('button', { name: `${titel} löschen` })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: /ansehen/ })).toBeNull();
  });

  it('die Leitung darf nur ihr eigenes Material aendern: das uebrige steht auf "Ansehen" ohne Loeschen', async () => {
    h.user = konto('admin', [12]);
    await oeffnen();
    // Eigenes (created_by 5): Liederbuch und Spielesammlung.
    expect(screen.getByRole('button', { name: 'Liederbuch Freizeit löschen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Spielesammlung löschen' })).toBeInTheDocument();
    // Fremdes (created_by 9): nur ansehen.
    expect(screen.queryByRole('button', { name: 'Andacht Advent löschen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Andacht Advent bearbeiten' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Andacht Advent ansehen' })).toHaveLength(2);
  });

  it('Bearbeiten laedt das Material und oeffnet das Fenster der App; "Neues Material" oeffnet es leer', async () => {
    await oeffnen();
    fireEvent.click(screen.getAllByRole('button', { name: 'Liederbuch Freizeit bearbeiten' })[0]);
    await warten();
    expect(h.apiGet).toHaveBeenCalledWith('/material/1');
    expect(h.stand.fenster).toHaveLength(1);
    expect(h.stand.fenster[0].komponente).toBe(MaterialFormModal);
    expect(h.stand.fenster[0].props.material).toEqual(DETAIL);
    expect(h.stand.fenster[0].props.nurLesen).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Neues Material' }));
    expect(h.stand.fenster[1].props.material).toBeNull();
  });

  it('fremdes Material oeffnet das Fenster schreibgeschuetzt', async () => {
    h.user = konto('admin', [12]);
    await oeffnen();
    fireEvent.click(screen.getAllByRole('button', { name: 'Andacht Advent ansehen' })[0]);
    await warten();
    expect(h.stand.fenster[0].props.nurLesen).toBe(true);
  });

  it('Loeschen fragt nach, nimmt die Dateien vom Geraet und ruft die Route erst nach der Bestaetigung', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Liederbuch Freizeit löschen' }));
    expect(h.stand.alert?.header).toBe('Material löschen');
    expect(h.stand.alert?.message).toBe('"Liederbuch Freizeit" wirklich löschen? Alle zugehörigen Dateien werden ebenfalls gelöscht.');
    expect(h.apiDelete).not.toHaveBeenCalled();
    await bestaetigen('Löschen');
    expect(h.apiDelete).toHaveBeenCalledWith('/material/1');
    expect(h.vergessen).toHaveBeenCalledWith(1, DETAIL.files);
    expect(h.refresh).toHaveBeenCalled();
  });

  describe('Suche und Filter', () => {
    beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); });
    afterEach(() => { vi.useRealTimers(); });

    it('die Suche fragt den Server erst nach einer kurzen Pause im Tippen -- mit dem Suchbegriff', async () => {
      await oeffnen();
      const aufrufe = () => h.apiGet.mock.calls.filter(([u]) => u === '/material').map(([, o]) => o);
      expect(aufrufe()).toEqual([{ params: {} }]);
      fireEvent.change(screen.getByRole('searchbox', { name: 'Material durchsuchen' }), { target: { value: 'Advent' } });
      await act(async () => { vi.advanceTimersByTime(299); });
      expect(aufrufe()).toEqual([{ params: {} }]);
      await act(async () => { vi.advanceTimersByTime(1); });
      await warten();
      expect(aufrufe()).toEqual([{ params: {} }, { params: { search: 'Advent' } }]);
    });

    it('der Jahrgangs-Filter schickt die Nummer des Jahrgangs; "Nur globales Material" filtert in der Oberflaeche', async () => {
      await oeffnen();
      fireEvent.change(screen.getByRole('combobox', { name: 'Jahrgang' }), { target: { value: '12' } });
      await warten();
      expect(h.apiGet).toHaveBeenLastCalledWith('/material', { params: { jahrgang_id: 12 } });
      fireEvent.change(screen.getByRole('combobox', { name: 'Jahrgang' }), { target: { value: 'global' } });
      await warten();
      const z = zeilen('Materialien');
      expect(z).toHaveLength(1);
      expect(zelle(z[0], 0)).toHaveTextContent('Liederbuch Freizeit');
      expect(screen.getByRole('status')).toHaveTextContent('1 Treffer');
    });
  });

  it('ohne Jahrgang-Zuweisung sagt der Leerzustand den Grund', async () => {
    h.kopf = { 'x-kein-jahrgang-zugewiesen': 'true' };
    h.daten.material = [];
    h.apiGet.mockImplementation(async (url: string) => (url === '/material' ? { data: [], headers: h.kopf } : { data: [], headers: {} }));
    h.user = konto('admin', []);
    await oeffnen();
    expect(screen.getByText('Kein Jahrgang zugewiesen')).toBeInTheDocument();
    expect(screen.getByText(/du siehst nur Material, das für alle freigegeben ist/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('schmal bleibt die Darstellung der App', async () => {
    h.breit = false;
    const { container } = await oeffnen();
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('Material fuers Team (Web)', () => {
  beforeEach(() => { h.user = konto('teamer'); });

  const oeffnen = async () => {
    const r = render(<TeamerMaterialPage />);
    await warten();
    return r;
  };

  it('"Fuer alle" oben, danach das uebrige Material; Spalten, Zeilen und Kennzahlen', async () => {
    await oeffnen();
    expect(screen.getByRole('heading', { level: 1, name: 'Material fürs Team' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Material: 3' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Dateien: 6' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Links: 1' })).toBeInTheDocument();
    expect(spaltenkoepfe('Material für alle')).toEqual(['Material', 'Jahrgänge', 'Inhalt']);
    const alle = zeilen('Material für alle');
    expect(alle).toHaveLength(1);
    expect(zelle(alle[0], 0)).toHaveTextContent('Liederbuch Freizeit');
    expect(zelle(alle[0], 2)).toHaveTextContent('2 Dateien');
    expect(zelle(alle[0], 2)).toHaveTextContent('1 Link');
    const uebrige = zeilen('Materialien');
    expect(uebrige).toHaveLength(2);
    expect(zelle(uebrige[0], 0)).toHaveTextContent('Andacht Advent');
    expect(zelle(uebrige[0], 1)).toHaveTextContent('Jahrgang 2027');
    expect(zelle(uebrige[1], 1)).toHaveTextContent('Jahrgang 2026, Jahrgang 2027');
  });

  it('Suche (Titel und Beschreibung) und Jahrgangs-Filter wirken in der Liste', async () => {
    await oeffnen();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Material durchsuchen' }), { target: { value: 'kennenlern' } });
    expect(zeilen('Materialien')).toHaveLength(1);
    expect(zelle(zeilen('Materialien')[0], 0)).toHaveTextContent('Spielesammlung');
    expect(screen.queryByRole('table', { name: 'Material für alle' })).toBeNull();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Material durchsuchen' }), { target: { value: '' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Jahrgang' }), { target: { value: '11' } });
    expect(zeilen('Materialien')).toHaveLength(1);
    expect(zelle(zeilen('Materialien')[0], 0)).toHaveTextContent('Spielesammlung');
    expect(screen.getByRole('status')).toHaveTextContent('1 Treffer');
  });

  it('nichts gefunden: Hinweis statt Tabelle', async () => {
    await oeffnen();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Material durchsuchen' }), { target: { value: 'gibtesnicht' } });
    expect(screen.getByText('Keine Materialien')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('ein Material oeffnen: Titel, Beschreibung, Details, Link und Dateien -- geladen ueber den Weg der App, gemeldet als angesehen', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Liederbuch Freizeit öffnen' }));
    await warten();
    expect(h.detail).toHaveBeenCalledWith(1);
    expect(h.track).toHaveBeenCalledWith('material-angesehen', { inhalt: 'beides' });
    expect(screen.getByRole('heading', { level: 1, name: 'Liederbuch Freizeit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Alle Materialien' })).toBeInTheDocument();
    expect(screen.getByText(/Alle Lieder für das Lagerfeuer/)).toBeInTheDocument();
    const details = within(screen.getByRole('region', { name: 'Details' }));
    expect(details.getByText('Sichtbar für').nextElementSibling).toHaveTextContent('Das ganze Team der Gemeinde');
    expect(details.getByText('Event').nextElementSibling).toHaveTextContent('Konfi-Wochenende');
    expect(details.getByText('Jahrgang').nextElementSibling).toHaveTextContent('Jahrgang 2027');
    expect(details.getByText('Erstellt am').nextElementSibling).toHaveTextContent('01.08.2026');
    expect(details.getByText('Erstellt von').nextElementSibling).toHaveTextContent('Sam Muster');
    const dateien = within(screen.getByRole('region', { name: 'Dateien' }));
    expect(dateien.getByRole('button', { name: /lieder\.pdf/ })).toHaveTextContent('2.4 MB');
    expect(dateien.getByRole('button', { name: /gruppenfoto\.jpg/ })).toHaveTextContent('1.5 KB');
  });

  it('eine Datei antippen: derselbe Weg wie in der App (Speicher, Betrachter); danach die Messung "abgerufen"', async () => {
    h.dateiOeffnen.mockResolvedValue(true);
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Liederbuch Freizeit öffnen' }));
    await warten();
    fireEvent.click(within(screen.getByRole('region', { name: 'Dateien' })).getByRole('button', { name: /lieder\.pdf/ }));
    await warten();
    expect(h.dateiOeffnen).toHaveBeenCalledWith('a1b2.pdf', 'lieder.pdf', 'application/pdf');
    expect(h.track).toHaveBeenLastCalledWith('material-abgerufen', { inhalt: 'datei' });
  });

  it('wird eine Datei geladen, steht der Fortschritt an ihr', async () => {
    h.ladend = { pfad: 'c3d4.jpg', prozent: 40 };
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Liederbuch Freizeit öffnen' }));
    await warten();
    const dateien = within(screen.getByRole('region', { name: 'Dateien' }));
    expect(dateien.getByRole('button', { name: /gruppenfoto\.jpg/ })).toHaveTextContent('Wird geladen… 40 %');
    expect(dateien.getByRole('button', { name: /lieder\.pdf/ })).toHaveTextContent('2.4 MB');
  });

  it('ein Link ist ein echter Link nach draussen; ein Klick oeffnet ihn ueber den Weg der App, Mittelklick laesst es dem Browser', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Liederbuch Freizeit öffnen' }));
    await warten();
    const link = within(screen.getByRole('region', { name: 'Link' })).getByRole('link', { name: /beispiel\.example/ });
    expect(link).toHaveAttribute('href', 'https://beispiel.example/lieder');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    fireEvent.click(link, { button: 1 });
    await warten();
    expect(h.linkOeffnen).not.toHaveBeenCalled();
    fireEvent.click(link);
    await warten();
    expect(h.linkOeffnen).toHaveBeenCalledWith('https://beispiel.example/lieder');
    expect(h.track).toHaveBeenLastCalledWith('material-abgerufen', { inhalt: 'link' });
  });

  it('"Alle Materialien" fuehrt zurueck in die Liste', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Liederbuch Freizeit öffnen' }));
    await warten();
    fireEvent.click(screen.getByRole('button', { name: 'Alle Materialien' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Material fürs Team' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Materialien' })).toBeInTheDocument();
  });

  it('schmal bleibt die Darstellung der App', async () => {
    h.breit = false;
    const { container } = await oeffnen();
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('Material ansehen -- Fenster (Web)', () => {
  const oeffnen = async (onClose = vi.fn()) => {
    const r = render(<TeamerMaterialDetailPage materialId={1} onClose={onClose} />);
    await warten();
    return { ...r, onClose };
  };

  it('der Titel steht in der Kopfzeile, darunter die Angaben als Karten; Schliessen ruft onClose', async () => {
    const { onClose } = await oeffnen();
    expect(h.detail).toHaveBeenCalledWith(1);
    expect(screen.getByTestId('kopfzeile').getAttribute('data-titel')).toBe('Liederbuch Freizeit');
    expect(screen.getByRole('region', { name: 'Beschreibung' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Details' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Link' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Dateien' })).getAllByRole('button')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('eine Datei und ein Link gehen denselben Weg wie in der App', async () => {
    h.dateiOeffnen.mockResolvedValue(true);
    await oeffnen();
    fireEvent.click(within(screen.getByRole('region', { name: 'Dateien' })).getByRole('button', { name: /gruppenfoto\.jpg/ }));
    await warten();
    expect(h.dateiOeffnen).toHaveBeenCalledWith('c3d4.jpg', 'gruppenfoto.jpg', 'image/jpeg');
    fireEvent.click(within(screen.getByRole('region', { name: 'Link' })).getByRole('link', { name: /beispiel\.example/ }));
    await warten();
    expect(h.linkOeffnen).toHaveBeenCalledWith('https://beispiel.example/lieder');
  });

  it('kann das Material nicht geladen werden, steht "Nicht gefunden" da', async () => {
    h.detail.mockRejectedValue(new Error('weg'));
    await oeffnen();
    expect(screen.getByText('Nicht gefunden')).toBeInTheDocument();
    expect(screen.getByText('Das Material konnte nicht geladen werden.')).toBeInTheDocument();
  });

  it('schmal bleibt die Darstellung der App', async () => {
    h.breit = false;
    const { container } = await oeffnen();
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Details' })).toBeNull();
  });
});
