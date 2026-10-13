// Material anlegen, bearbeiten und ansehen im Browser als eigener Dialog der
// Web-Fassung (Simon, 11.10.2026: „Web braucht eigene kompaktere Modale
// überall"), gerendert mit der echten Seite (AdminMaterialPage), dem echten
// Hook (useMaterialFormular) und dem echten Weg zum Betrachter
// (useDateiOeffnen). Gestellt sind Server, Netz, Warteschlange, Medien-Cache,
// Dateiauswahl und Ionic (useIonModal hält fest, welches Fenster aufgeht).
//
// Geprüft wird: Im breiten Layout öffnet der Dialog statt des App-Modals,
// schmal weiter das Modal; Felder benannt und vorbelegt; Prüfung mit
// konkreter Meldung; Speichern schickt genau diesen Körper an genau diese
// Route; Abbrechen schickt nichts; ohne Netz dieselbe Warteschlange wie die
// App; Dateien löschen fragt in der Zeile; der Betrachter öffnet, während der
// Dialog zur Seite tritt, und danach steht alles wieder da; die Lese-Ansicht.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, cleanup } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';
import { objectUrlAttrappe } from '../../medienAttrappen';

const h = vi.hoisted(() => ({
  breit: true,
  online: true,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  enqueue: vi.fn(),
  refresh: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  track: vi.fn(),
  linkOeffnen: vi.fn(),
  auswahl: vi.fn(),
  mediaBlob: vi.fn(),
  vergessen: vi.fn(),
}));

vi.mock('@capacitor/filesystem', async () => (await import('../../medienAttrappen')).dateisystemModul);
vi.mock('@ionic/react', async () => (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../components/shared/AppKopfzeile', () => ({
  default: ({ titel, rechts }: { titel?: string; rechts?: React.ReactNode }) => <header data-titel={titel}>{rechts}</header>,
  AppKopfzeileGross: () => null,
}));
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => h.apiGet(...a),
    post: (...a: unknown[]) => h.apiPost(...a),
    put: (...a: unknown[]) => h.apiPut(...a),
    delete: (...a: unknown[]) => h.apiDelete(...a),
  },
  DATEI_TIMEOUT_MS: 180000,
}));
vi.mock('../../../services/networkMonitor', () => ({
  networkMonitor: { get isOnline() { return h.online; }, subscribe: () => () => undefined },
}));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: (...a: unknown[]) => h.enqueue(...a) } }));
vi.mock('../../../services/materialDetail', () => ({ materialVergessen: vi.fn() }));
vi.mock('../../../services/mediaCache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/mediaCache')>()),
  getMediaBlob: (...a: unknown[]) => h.mediaBlob(...a),
  istGecacht: async () => true,
  medienVergessen: (...a: unknown[]) => h.vergessen(...a),
}));
vi.mock('../../../services/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/analytics')>()),
  trackHandlung: (...a: unknown[]) => h.track(...a),
}));
vi.mock('../../../services/systemDialoge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/systemDialoge')>()),
  linkOeffnen: (...a: unknown[]) => h.linkOeffnen(...a),
  dateiAuswaehlen: (...a: unknown[]) => h.auswahl(...a),
}));
vi.mock('../../../utils/nativeFileViewer', () => ({ openFileNatively: async () => false }));
vi.mock('../../../utils/haptics', () => ({ haptik: async () => {}, triggerPullHaptic: () => {}, ImpactStyle: { Light: 'LIGHT', Medium: 'MEDIUM' } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../../hooks/useOfflineQuery', async () => {
  const React = await import('react');
  return {
    useOfflineQuery: (schluessel: string, lader: () => Promise<unknown>) => {
      const [daten, setDaten] = React.useState<unknown>(undefined);
      React.useEffect(() => { void lader().then((d) => setDaten(d)); }, [schluessel]); // eslint-disable-line react-hooks/exhaustive-deps
      return { data: daten ?? [], loading: false, refresh: h.refresh, refreshLive: vi.fn() };
    },
  };
});

import AdminMaterialPage from '../../../components/admin/pages/AdminMaterialPage';
import MaterialFormModal from '../../../components/admin/modals/MaterialFormModal';
import FileViewerModal from '../../../components/shared/FileViewerModal';
import { erwarteWebRueckfrage } from '../web/webRueckfrageErwartung';

const LISTE = [
  { id: 1, title: 'Liederbuch Freizeit', file_count: 2, link_count: 1, link_url: 'https://beispiel.example/lieder', event_count: 1, ist_global: false, created_by: 5, created_by_name: 'Sam Muster', jahrgaenge: [{ id: 12, name: 'Jahrgang 2027' }], created_at: '2026-08-01T10:00:00Z' },
  { id: 2, title: 'Andacht Advent', file_count: 0, ist_global: true, created_by: 9, created_by_name: 'Alex Beispiel', jahrgaenge: [], created_at: '2026-09-01T10:00:00Z' },
];

// Jahrgang 99 sieht diese Person nicht (er fehlt in /admin/jahrgaenge); er muss beim Speichern bleiben.
const DETAIL = {
  id: 1, title: 'Liederbuch Freizeit', description: 'Alle Lieder für das Lagerfeuer', created_at: '2026-08-01T10:00:00Z',
  created_by: 5, created_by_name: 'Sam Muster', ist_global: false,
  events: [{ id: 4, name: 'Konfi-Wochenende', event_date: '2099-11-14T09:00:00Z' }],
  jahrgaenge: [{ id: 12, name: 'Jahrgang 2027' }, { id: 99, name: 'Jahrgang 2030' }],
  files: [
    { id: 71, original_name: 'lieder.pdf', stored_name: 'a1b2.pdf', mime_type: 'application/pdf', file_size: 2516582, created_at: '2026-08-01T10:00:00Z' },
    { id: 72, original_name: 'gruppenfoto.jpg', stored_name: 'c3d4.jpg', mime_type: 'image/jpeg', file_size: 1536, created_at: '2026-08-01T10:00:00Z' },
  ],
  links: [{ id: 1, url: 'https://beispiel.example/lieder' }],
  link_url: 'https://beispiel.example/lieder',
};

const FREMD = {
  id: 2, title: 'Andacht Advent', description: 'Für den ersten Advent', created_at: '2026-09-01T10:00:00Z',
  created_by: 9, created_by_name: 'Alex Beispiel', ist_global: true,
  events: [], jahrgaenge: [],
  files: [{ id: 81, original_name: 'andacht.pdf', stored_name: 'e5f6.pdf', mime_type: 'application/pdf', file_size: 4096, created_at: '2026-09-01T10:00:00Z' }],
  links: [{ id: 3, url: 'https://beispiel.example/advent' }],
};

const EVENTS = [
  { id: 4, name: 'Konfi-Wochenende', event_date: '2099-11-14T09:00:00Z' },
  { id: 5, name: 'Gemeindefest', event_date: '2099-12-01T09:00:00Z' },
  // Vorbei und nicht zugeordnet: steht nicht zur Wahl (wie in der App).
  { id: 6, name: 'Vorbei', event_date: '2020-01-01T09:00:00Z' },
];

const warten = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); };
const dialog = (name: string) => screen.getByRole('dialog', { name });
const feld = (d: HTMLElement, name: string) => within(d).getByRole('textbox', { name }) as HTMLInputElement;
const haken = (d: HTMLElement, gruppe: string, name: string | RegExp) => within(within(d).getByRole('group', { name: gruppe })).getByRole('checkbox', { name }) as HTMLInputElement;
const tippen = (el: HTMLElement, wert: string) => fireEvent.change(el, { target: { value: wert } });
const klick = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); await warten(); };
const absenden = async (d: HTMLElement, knopf: string) => klick(within(d).getByRole('button', { name: knopf }));
const fensterVon = (komponente: unknown) => h.stand.fenster.filter((f) => f.komponente === komponente);

const oeffnen = async () => {
  const r = render(<AdminMaterialPage />);
  await warten();
  return r;
};
const neuOeffnen = async () => {
  await oeffnen();
  await klick(screen.getByRole('button', { name: 'Neues Material' }));
  return dialog('Neues Material');
};
const bearbeitenOeffnen = async () => {
  await oeffnen();
  await klick(screen.getAllByRole('button', { name: 'Liederbuch Freizeit bearbeiten' })[0]);
  return dialog('Material bearbeiten');
};

let urls: ReturnType<typeof objectUrlAttrappe>;

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.online = true;
  h.user = konto('org_admin');
  urls = objectUrlAttrappe();
  h.apiGet.mockImplementation(async (url: string) => {
    if (url === '/material') return { data: LISTE, headers: {} };
    if (url === '/admin/jahrgaenge') return { data: [{ id: 11, name: 'Jahrgang 2026' }, { id: 12, name: 'Jahrgang 2027' }], headers: {} };
    if (url === '/events') return { data: EVENTS, headers: {} };
    if (url === '/material/1') return { data: DETAIL, headers: {} };
    if (url === '/material/2') return { data: FREMD, headers: {} };
    throw new Error(`unerwartet: ${url}`);
  });
  h.apiPost.mockImplementation(async (url: string) => (url === '/material' ? { data: { id: 33 } } : { data: {} }));
  h.apiPut.mockResolvedValue({ data: {} });
  h.apiDelete.mockResolvedValue({ data: {} });
  h.enqueue.mockResolvedValue(undefined);
  h.mediaBlob.mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }));
  h.auswahl.mockResolvedValue(null);
});
afterEach(() => cleanup());

// ---------------------------------------------------------------------------
describe('Umschaltung: breit der Dialog, schmal das Modal der App', () => {
  it('breit: „Neues Material“ öffnet den Dialog, kein Modal der App', async () => {
    const d = await neuOeffnen();
    expect(d).toBeInTheDocument();
    expect(fensterVon(MaterialFormModal)).toHaveLength(0);
    expect(h.stand.fenster).toHaveLength(0);
  });

  it('breit: „Bearbeiten“ lädt das Material und öffnet es im Dialog, nicht als Modal', async () => {
    const d = await bearbeitenOeffnen();
    expect(h.apiGet).toHaveBeenCalledWith('/material/1');
    expect(feld(d, 'Titel').value).toBe('Liederbuch Freizeit');
    expect(h.stand.fenster).toHaveLength(0);
  });

  it('breit: lässt sich das Material nicht laden, kein Dialog und die Meldung der Seite', async () => {
    h.apiGet.mockImplementation(async (url: string) => {
      if (url === '/material') return { data: LISTE, headers: {} };
      if (url === '/material/1') throw new Error('weg');
      return { data: [], headers: {} };
    });
    await oeffnen();
    await klick(screen.getAllByRole('button', { name: 'Liederbuch Freizeit bearbeiten' })[0]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.setError).toHaveBeenCalledWith('Fehler beim Laden des Materials');
  });

  it('schmal: „Neues Material anlegen“ öffnet weiter das Modal der App, kein Dialog', async () => {
    h.breit = false;
    await oeffnen();
    await klick(screen.getByRole('button', { name: 'Neues Material anlegen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fensterVon(MaterialFormModal)).toHaveLength(1);
    expect(fensterVon(MaterialFormModal)[0].props.material).toBeNull();
    expect(fensterVon(MaterialFormModal)[0].props.nurLesen).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe('Aufbau und Vorbelegung', () => {
  it('neu: leere, benannte Felder; Events nur anstehende; Jahrgänge alle; Knöpfe Abbrechen und Material anlegen', async () => {
    const d = await neuOeffnen();
    expect(feld(d, 'Titel').value).toBe('');
    expect(feld(d, 'Titel')).toHaveAttribute('aria-required', 'true');
    expect(feld(d, 'Beschreibung').value).toBe('');
    const events = within(within(d).getByRole('group', { name: 'Events' })).getAllByRole('checkbox');
    expect(events.map((e) => (e.closest('label') as HTMLElement).querySelector('.web-wahl__titel')!.textContent)).toEqual(['Konfi-Wochenende', 'Gemeindefest']);
    expect(events.every((e) => !(e as HTMLInputElement).checked)).toBe(true);
    const jahrgaenge = within(within(d).getByRole('group', { name: 'Jahrgänge' })).getAllByRole('checkbox');
    expect(jahrgaenge).toHaveLength(2);
    expect(within(d).getByText('Ohne Zuordnung sieht das ganze Team das Material')).toBeInTheDocument();
    expect(within(d).queryByRole('textbox', { name: /^Adresse/ })).toBeNull();
    expect(within(d).queryByRole('list', { name: 'Dateien' })).toBeNull();
    expect([...d.querySelectorAll('footer button')].map((b) => b.textContent)).toEqual(['Abbrechen', 'Material anlegen']);
  });

  it('bearbeiten: Titel, Beschreibung, Zuordnung, Links und Dateien aus dem Material', async () => {
    const d = await bearbeitenOeffnen();
    expect(feld(d, 'Titel').value).toBe('Liederbuch Freizeit');
    expect(feld(d, 'Beschreibung').value).toBe('Alle Lieder für das Lagerfeuer');
    expect(haken(d, 'Events', /Konfi-Wochenende/).checked).toBe(true);
    expect(haken(d, 'Events', /Gemeindefest/).checked).toBe(false);
    expect(haken(d, 'Jahrgänge', 'Jahrgang 2027').checked).toBe(true);
    expect(haken(d, 'Jahrgänge', 'Jahrgang 2026').checked).toBe(false);
    expect(within(d).getByText('1 Event ausgewählt')).toBeInTheDocument();
    expect(within(d).getByText('Nur das Team dieser Jahrgänge sieht das Material')).toBeInTheDocument();
    expect(feld(d, 'Adresse').value).toBe('https://beispiel.example/lieder');
    const dateien = within(within(d).getByRole('list', { name: 'Dateien' }));
    expect(dateien.getByRole('button', { name: 'lieder.pdf ansehen' })).toHaveTextContent('2.4 MB');
    expect(dateien.getByRole('button', { name: 'gruppenfoto.jpg ansehen' })).toHaveTextContent('1.5 KB');
    expect(dateien.getByRole('button', { name: 'lieder.pdf löschen' })).toBeInTheDocument();
    expect([...d.querySelectorAll('footer button')].map((b) => b.textContent)).toEqual(['Abbrechen', 'Speichern']);
  });

  it('mehrere Links heißen „Adresse 1“, „Adresse 2“; Entfernen nimmt genau diesen', async () => {
    const d = await bearbeitenOeffnen();
    await klick(within(d).getByRole('button', { name: 'Link hinzufügen' }));
    tippen(feld(d, 'Adresse 2'), 'https://beispiel.example/zwei');
    expect(feld(d, 'Adresse 1').value).toBe('https://beispiel.example/lieder');
    await klick(within(d).getByRole('button', { name: 'Adresse 1 entfernen' }));
    expect(feld(d, 'Adresse').value).toBe('https://beispiel.example/zwei');
  });
});

// ---------------------------------------------------------------------------
describe('Prüfen', () => {
  it('ohne Titel: die Meldung steht im Dialog, nichts geht an den Server', async () => {
    const d = await neuOeffnen();
    await absenden(d, 'Material anlegen');
    expect(within(d).getByRole('alert')).toHaveTextContent('Bitte einen Titel eingeben');
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.setError).not.toHaveBeenCalled();
    // Tippen nimmt die Meldung weg.
    tippen(feld(d, 'Titel'), 'Elternbrief');
    expect(within(d).queryByRole('alert')).toBeNull();
  });

  it('ein Link ohne http/https: die Meldung steht im Dialog, nichts geht an den Server', async () => {
    const d = await neuOeffnen();
    tippen(feld(d, 'Titel'), 'Elternbrief');
    await klick(within(d).getByRole('button', { name: 'Link hinzufügen' }));
    tippen(feld(d, 'Adresse'), 'ftp://beispiel.example/datei');
    await absenden(d, 'Material anlegen');
    expect(within(d).getByRole('alert')).toHaveTextContent('Der Link muss mit http:// oder https:// beginnen');
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('eine Datei über 20 MB kommt nicht in die Liste; der Satz des Servers steht im Dialog', async () => {
    h.auswahl.mockResolvedValue([
      new File([new Uint8Array(21 * 1024 * 1024)], 'riesig.pdf', { type: 'application/pdf' }),
      new File(['%PDF klein'], 'klein.pdf', { type: 'application/pdf' }),
    ]);
    const d = await neuOeffnen();
    await absenden(d, 'Dateien auswählen');
    expect(within(d).getByRole('alert')).toHaveTextContent('Datei ist zu groß (max. 20 MB).');
    const dateien = within(within(d).getByRole('list', { name: 'Dateien' }));
    expect(dateien.getByRole('button', { name: 'klein.pdf ansehen' })).toBeInTheDocument();
    expect(dateien.queryByRole('button', { name: 'riesig.pdf ansehen' })).toBeNull();
    expect(h.auswahl).toHaveBeenCalledWith({ accept: 'image/*,application/pdf,video/*,audio/*,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp', multiple: true });
  });
});

// ---------------------------------------------------------------------------
describe('Speichern', () => {
  it('neu: genau dieser Körper an POST /material, danach die Dateien, Dialog zu, Liste neu, gemessen', async () => {
    const brief = new File(['%PDF Brief'], 'brief.pdf', { type: 'application/pdf' });
    h.auswahl.mockResolvedValue([brief]);
    const d = await neuOeffnen();
    tippen(feld(d, 'Titel'), '  Elternbrief  ');
    tippen(feld(d, 'Beschreibung'), 'Mit Packliste');
    fireEvent.click(haken(d, 'Events', /Gemeindefest/));
    fireEvent.click(haken(d, 'Jahrgänge', 'Jahrgang 2026'));
    await klick(within(d).getByRole('button', { name: 'Link hinzufügen' }));
    tippen(feld(d, 'Adresse'), ' https://beispiel.example/brief ');
    await klick(within(d).getByRole('button', { name: 'Link hinzufügen' }));
    await absenden(d, 'Dateien auswählen');
    expect(within(d).getByRole('button', { name: 'brief.pdf ansehen' })).toHaveTextContent('Neu · 10 B · geht beim Speichern hoch');
    await absenden(d, 'Material anlegen');

    expect(h.apiPost).toHaveBeenNthCalledWith(1, '/material', {
      title: 'Elternbrief',
      description: 'Mit Packliste',
      event_ids: [5],
      jahrgang_ids: [11],
      // Das leere zweite Feld fällt still heraus.
      link_urls: ['https://beispiel.example/brief'],
    });
    expect(h.apiPost.mock.calls[1][0]).toBe('/material/33/files');
    const formular = h.apiPost.mock.calls[1][1] as FormData;
    expect(formular.getAll('files')).toEqual([brief]);
    expect(h.apiPost.mock.calls[1][2]).toMatchObject({ headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 });
    expect(h.apiPost).toHaveBeenCalledTimes(2);
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(h.track).toHaveBeenCalledWith('material-bereitgestellt', { inhalt: 'beides' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it('bearbeiten: genau dieser Körper an PUT /material/1; ein Jahrgang, den die Liste nicht anbietet, bleibt', async () => {
    const d = await bearbeitenOeffnen();
    tippen(feld(d, 'Titel'), 'Liederbuch Sommer');
    fireEvent.click(haken(d, 'Events', /Konfi-Wochenende/));
    fireEvent.click(haken(d, 'Events', /Gemeindefest/));
    fireEvent.click(haken(d, 'Jahrgänge', 'Jahrgang 2026'));
    await absenden(d, 'Speichern');
    expect(h.apiPut).toHaveBeenCalledTimes(1);
    expect(h.apiPut).toHaveBeenCalledWith('/material/1', {
      title: 'Liederbuch Sommer',
      description: 'Alle Lieder für das Lagerfeuer',
      event_ids: [5],
      // Die gezeigten in Listenfolge, der verdeckte 99 hinten (WebMehrfachAuswahl).
      jahrgang_ids: [11, 12, 99],
      link_urls: ['https://beispiel.example/lieder'],
    });
    expect(h.apiPost).not.toHaveBeenCalled();
    // Nachbessern ist kein neues Material: keine Messung.
    expect(h.track).not.toHaveBeenCalledWith('material-bereitgestellt', expect.anything());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it('der Server lehnt ab: sein Satz steht im Dialog, der Dialog bleibt offen, keine Meldung der App', async () => {
    h.apiPut.mockRejectedValue({ response: { status: 400, data: { error: 'Titel zu lang' } } });
    const d = await bearbeitenOeffnen();
    await absenden(d, 'Speichern');
    expect(within(d).getByRole('alert')).toHaveTextContent('Titel zu lang');
    expect(screen.getByRole('dialog', { name: 'Material bearbeiten' })).toBe(d);
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('Abbrechen schickt nichts und schließt', async () => {
    const d = await bearbeitenOeffnen();
    tippen(feld(d, 'Titel'), 'Geändert');
    await absenden(d, 'Abbrechen');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.apiDelete).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it('ohne Netz: Hinweis im Dialog; Speichern legt genau diesen Eintrag in die Warteschlange wie die App', async () => {
    h.online = false;
    const d = await bearbeitenOeffnen();
    expect(within(d).getByText('Ohne Verbindung wird das Material gespeichert, sobald du wieder online bist. Dateien lassen sich erst dann hochladen.')).toBeInTheDocument();
    tippen(feld(d, 'Titel'), 'Liederbuch offline');
    await absenden(d, 'Speichern');
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(h.enqueue).toHaveBeenCalledTimes(1);
    expect(h.enqueue).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/material/1',
      body: {
        title: 'Liederbuch offline',
        description: 'Alle Lieder für das Lagerfeuer',
        event_ids: [4],
        jahrgang_ids: [12, 99],
        link_urls: ['https://beispiel.example/lieder'],
      },
      maxRetries: 5,
      hasFileUpload: false,
      metadata: { type: 'admin', clientId: expect.any(String), label: 'Material bearbeiten' },
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Material wird gespeichert sobald du wieder online bist');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
describe('Dateien', () => {
  it('eine vorhandene Datei löschen fragt in der Zeile; Abbrechen lässt sie, Löschen nimmt sie vom Server und vom Gerät', async () => {
    const d = await bearbeitenOeffnen();
    await klick(within(d).getByRole('button', { name: 'lieder.pdf löschen' }));
    const rueckfrage = within(d).getByRole('group', { name: 'lieder.pdf löschen' });
    expect(rueckfrage).toHaveTextContent('„lieder.pdf“ wirklich löschen?');
    // Wie die Rückfragen der App im Browser: Mülleimer vorn, „Löschen" rot gefüllt.
    erwarteWebRueckfrage(rueckfrage, 'loeschen', 'Löschen');
    expect(h.stand.alert).toBeNull();
    expect(h.apiDelete).not.toHaveBeenCalled();
    await klick(within(rueckfrage).getByRole('button', { name: 'Abbrechen' }));
    expect(within(d).getByRole('button', { name: 'lieder.pdf ansehen' })).toBeInTheDocument();
    expect(h.apiDelete).not.toHaveBeenCalled();
    await klick(within(d).getByRole('button', { name: 'lieder.pdf löschen' }));
    await klick(within(within(d).getByRole('group', { name: 'lieder.pdf löschen' })).getByRole('button', { name: 'Löschen' }));
    expect(h.apiDelete).toHaveBeenCalledWith('/material/files/71');
    expect(h.vergessen).toHaveBeenCalledWith('a1b2.pdf', 'material');
    expect(within(d).queryByRole('button', { name: 'lieder.pdf ansehen' })).toBeNull();
    expect(within(d).getByRole('button', { name: 'gruppenfoto.jpg ansehen' })).toBeInTheDocument();
  });

  it('scheitert das Löschen, steht die Meldung im Dialog und die Datei bleibt', async () => {
    h.apiDelete.mockRejectedValue(new Error('weg'));
    const d = await bearbeitenOeffnen();
    await klick(within(d).getByRole('button', { name: 'lieder.pdf löschen' }));
    await klick(within(within(d).getByRole('group', { name: 'lieder.pdf löschen' })).getByRole('button', { name: 'Löschen' }));
    expect(within(d).getByRole('alert')).toHaveTextContent('Fehler beim Löschen der Datei');
    expect(within(d).getByRole('button', { name: 'lieder.pdf ansehen' })).toBeInTheDocument();
    expect(h.setError).not.toHaveBeenCalled();
  });

  it('eine neue Datei entfernen: sie geht nicht hoch', async () => {
    h.auswahl.mockResolvedValue([new File(['%PDF'], 'weg.pdf', { type: 'application/pdf' })]);
    const d = await bearbeitenOeffnen();
    await absenden(d, 'Dateien auswählen');
    await klick(within(d).getByRole('button', { name: 'weg.pdf entfernen' }));
    expect(within(d).queryByRole('button', { name: 'weg.pdf ansehen' })).toBeNull();
    await absenden(d, 'Speichern');
    expect(h.apiPut).toHaveBeenCalledTimes(1);
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('eine vorhandene Datei ansehen: der Dialog tritt zur Seite, der Betrachter der App geht auf; danach stehen die Eingaben wieder da', async () => {
    const d = await bearbeitenOeffnen();
    tippen(feld(d, 'Titel'), 'Noch nicht gespeichert');
    await klick(within(d).getByRole('button', { name: 'lieder.pdf ansehen' }));
    expect(h.mediaBlob).toHaveBeenCalledWith('a1b2.pdf', expect.objectContaining({ quelle: 'material' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const betrachter = fensterVon(FileViewerModal);
    expect(betrachter).toHaveLength(1);
    expect(betrachter[0].props.files).toEqual([
      { url: urls.erzeugt[0], fileName: 'lieder.pdf', mimeType: 'application/pdf' },
      { url: '/api/material/files/c3d4.jpg', fileName: 'gruppenfoto.jpg', mimeType: 'image/jpeg' },
    ]);
    expect(betrachter[0].optionen).toMatchObject({ cssClass: 'file-viewer-modal' });
    // Eigenes Material zu öffnen ist kein Abruf.
    expect(h.track).not.toHaveBeenCalledWith('material-abgerufen', expect.anything());
    await act(async () => { (betrachter[0].optionen as { onDidDismiss: () => void }).onDidDismiss(); });
    const wieder = dialog('Material bearbeiten');
    expect(feld(wieder, 'Titel').value).toBe('Noch nicht gespeichert');
  });

  it('eine neue Datei vor dem Hochladen ansehen: ebenso, mit der Datei selbst', async () => {
    h.auswahl.mockResolvedValue([new File(['%PDF neu'], 'neu.pdf', { type: 'application/pdf' })]);
    const d = await bearbeitenOeffnen();
    await absenden(d, 'Dateien auswählen');
    await klick(within(d).getByRole('button', { name: 'neu.pdf ansehen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    const betrachter = fensterVon(FileViewerModal);
    expect(betrachter).toHaveLength(1);
    expect(betrachter[0].props.blobUrl).toBe(urls.erzeugt[0]);
    expect(betrachter[0].props.fileName).toBe('neu.pdf');
    expect(betrachter[0].props.mimeType).toBe('application/pdf');
    expect(h.mediaBlob).not.toHaveBeenCalled();
    await act(async () => { (betrachter[0].optionen as { onDidDismiss: () => void }).onDidDismiss(); });
    expect(within(dialog('Material bearbeiten')).getByRole('button', { name: 'neu.pdf ansehen' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Gegenprüfung 11.10.2026: Ging der Dialog während des Hochladens zu (Escape,
// Klick daneben, das X), verschwand ein Fehler danach still -- das Material
// stand schon, die Dateien fehlten, niemand erfuhr es.
describe('Während gesendet oder gelöscht wird, bleibt der Dialog', () => {
  /** POST /material geht durch, das Hochladen hängt, bis der Test es auflöst. */
  const uploadHaengt = () => {
    const ausgang: { ablehnen: (e: unknown) => void } = { ablehnen: () => undefined };
    h.apiPost.mockImplementation((url: string) => (url === '/material'
      ? Promise.resolve({ data: { id: 33 } })
      : new Promise((_, nein) => { ausgang.ablehnen = nein; })));
    h.auswahl.mockResolvedValue([new File(['%PDF Brief'], 'brief.pdf', { type: 'application/pdf' })]);
    return ausgang;
  };
  const NUR_DATEIEN_FEHLEN = 'Das Material ist gespeichert, die Dateien noch nicht. Tippe noch einmal auf Speichern.';

  it('Upload hängt: Abbrechen und X gesperrt, Escape und Klick daneben lassen ihn offen; der Fehler steht danach im Dialog', async () => {
    const upload = uploadHaengt();
    const d = await neuOeffnen();
    tippen(feld(d, 'Titel'), 'Elternbrief');
    await absenden(d, 'Dateien auswählen');
    await absenden(d, 'Material anlegen');
    expect(h.apiPost).toHaveBeenLastCalledWith('/material/33/files', expect.any(FormData), expect.objectContaining({ timeout: 180000 }));

    expect(within(d).getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
    const x = within(d).getByRole('button', { name: 'Schließen' });
    expect(x).toBeDisabled();
    fireEvent.click(x);
    fireEvent.keyDown(d, { key: 'Escape' });
    fireEvent.mouseDown(d.parentElement!);
    await warten();
    expect(dialog('Neues Material')).toBe(d);

    const fehler = { response: { status: 500, data: {} } };
    await act(async () => { upload.ablehnen(fehler); });
    await warten();
    expect(within(d).getByRole('alert')).toHaveTextContent(NUR_DATEIEN_FEHLEN);
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.setSuccess).not.toHaveBeenCalled();
    expect(h.refresh).not.toHaveBeenCalled();
    // Danach wieder frei: Escape schließt.
    expect(x).toBeEnabled();
    fireEvent.keyDown(d, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('das Fenster wird während des Hochladens schmal: der Fehler kommt genau einmal als Meldung der App, mit Ort', async () => {
    const upload = uploadHaengt();
    const r = await oeffnen();
    await klick(screen.getByRole('button', { name: 'Neues Material' }));
    const d = dialog('Neues Material');
    tippen(feld(d, 'Titel'), 'Elternbrief');
    await absenden(d, 'Dateien auswählen');
    await absenden(d, 'Material anlegen');

    h.breit = false;
    r.rerender(<AdminMaterialPage />);
    await warten();
    expect(screen.queryByRole('dialog')).toBeNull();

    const fehler = { response: { status: 500, data: {} } };
    await act(async () => { upload.ablehnen(fehler); });
    await warten();
    expect(h.setError).toHaveBeenCalledTimes(1);
    expect(h.setError).toHaveBeenCalledWith(NUR_DATEIEN_FEHLEN, { ort: 'material-dateien-hochladen', fehler });
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('eine Datei wird gelöscht: X, Escape und Speichern gesperrt; danach wieder frei', async () => {
    const loeschen = { fertig: () => undefined as void };
    h.apiDelete.mockImplementation(() => new Promise((ja) => { loeschen.fertig = () => ja({ data: {} }); }));
    const d = await bearbeitenOeffnen();
    await klick(within(d).getByRole('button', { name: 'lieder.pdf löschen' }));
    await klick(within(within(d).getByRole('group', { name: 'lieder.pdf löschen' })).getByRole('button', { name: 'Löschen' }));
    expect(h.apiDelete).toHaveBeenCalledWith('/material/files/71');

    expect(within(d).getByRole('button', { name: 'Schließen' })).toBeDisabled();
    expect(within(d).getByRole('button', { name: 'Speichern' })).toBeDisabled();
    fireEvent.keyDown(d, { key: 'Escape' });
    fireEvent.mouseDown(d.parentElement!);
    await warten();
    expect(dialog('Material bearbeiten')).toBe(d);

    await act(async () => { loeschen.fertig(); });
    await warten();
    expect(within(d).queryByRole('button', { name: 'lieder.pdf ansehen' })).toBeNull();
    expect(within(d).getByRole('button', { name: 'Schließen' })).toBeEnabled();
    expect(within(d).getByRole('button', { name: 'Speichern' })).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Gegenprüfung 11.10.2026: Knöpfe, die sich selbst aus dem Dialog nehmen
// (Papierkorb, die Knöpfe der Rückfrage, Entfernen), ließen den Fokus auf
// <body> fallen -- Tab lief danach in die Seite hinter dem Dialog.
describe('Der Fokus bleibt im Dialog', () => {
  const aktiv = () => document.activeElement;

  it('der Papierkorb öffnet die Rückfrage mit dem Fokus auf ihrem Abbrechen; Abbrechen bringt ihn zurück auf den Papierkorb', async () => {
    const d = await bearbeitenOeffnen();
    const papierkorb = within(d).getByRole('button', { name: 'lieder.pdf löschen' });
    papierkorb.focus();
    await klick(papierkorb);
    const rueckfrage = within(d).getByRole('group', { name: 'lieder.pdf löschen' });
    expect(aktiv()).toBe(within(rueckfrage).getByRole('button', { name: 'Abbrechen' }));
    await klick(within(rueckfrage).getByRole('button', { name: 'Abbrechen' }));
    expect(aktiv()).toBe(within(d).getByRole('button', { name: 'lieder.pdf löschen' }));
  });

  it('Escape in der Rückfrage schließt nur die Rückfrage; Dialog und Eingaben bleiben, der Fokus auf dem Papierkorb', async () => {
    const d = await bearbeitenOeffnen();
    tippen(feld(d, 'Titel'), 'Noch nicht gespeichert');
    await klick(within(d).getByRole('button', { name: 'lieder.pdf löschen' }));
    const rueckfrage = within(d).getByRole('group', { name: 'lieder.pdf löschen' });
    await act(async () => { fireEvent.keyDown(within(rueckfrage).getByRole('button', { name: 'Abbrechen' }), { key: 'Escape' }); });
    await warten();
    expect(dialog('Material bearbeiten')).toBe(d);
    expect(within(d).queryByRole('group', { name: 'lieder.pdf löschen' })).toBeNull();
    expect(feld(d, 'Titel').value).toBe('Noch nicht gespeichert');
    expect(aktiv()).toBe(within(d).getByRole('button', { name: 'lieder.pdf löschen' }));
    expect(h.apiDelete).not.toHaveBeenCalled();
  });

  it('nach dem Löschen steht der Fokus auf dem Papierkorb der nächsten Datei, nach der letzten auf der davor, zuletzt auf „Dateien auswählen“', async () => {
    const d = await bearbeitenOeffnen();
    const loeschen = async (name: string) => {
      await klick(within(d).getByRole('button', { name: `${name} löschen` }));
      await klick(within(within(d).getByRole('group', { name: `${name} löschen` })).getByRole('button', { name: 'Löschen' }));
    };
    await loeschen('lieder.pdf');
    expect(aktiv()).toBe(within(d).getByRole('button', { name: 'gruppenfoto.jpg löschen' }));
    await loeschen('gruppenfoto.jpg');
    expect(within(d).queryByRole('list', { name: 'Dateien' })).toBeNull();
    expect(aktiv()).toBe(within(d).getByRole('button', { name: 'Dateien auswählen' }));
    expect(h.apiDelete).toHaveBeenCalledTimes(2);
  });

  it('scheitert das Löschen, steht der Fokus wieder auf dem Papierkorb derselben Datei', async () => {
    h.apiDelete.mockRejectedValue(new Error('weg'));
    const d = await bearbeitenOeffnen();
    await klick(within(d).getByRole('button', { name: 'gruppenfoto.jpg löschen' }));
    await klick(within(within(d).getByRole('group', { name: 'gruppenfoto.jpg löschen' })).getByRole('button', { name: 'Löschen' }));
    expect(within(d).getByRole('alert')).toHaveTextContent('Fehler beim Löschen der Datei');
    expect(aktiv()).toBe(within(d).getByRole('button', { name: 'gruppenfoto.jpg löschen' }));
  });

  it('eine neue Datei entfernen: der Fokus geht auf die Zeile, die nachrückt; nach der letzten auf die davor, auch eine vorhandene', async () => {
    h.auswahl.mockResolvedValue([
      new File(['%PDF a'], 'a.pdf', { type: 'application/pdf' }),
      new File(['%PDF b'], 'b.pdf', { type: 'application/pdf' }),
    ]);
    const d = await bearbeitenOeffnen();
    await absenden(d, 'Dateien auswählen');
    await klick(within(d).getByRole('button', { name: 'a.pdf entfernen' }));
    expect(aktiv()).toBe(within(d).getByRole('button', { name: 'b.pdf entfernen' }));
    await klick(within(d).getByRole('button', { name: 'b.pdf entfernen' }));
    expect(aktiv()).toBe(within(d).getByRole('button', { name: 'gruppenfoto.jpg löschen' }));
  });

  it('die einzige neue Datei entfernen: der Fokus geht auf „Dateien auswählen“', async () => {
    h.auswahl.mockResolvedValue([new File(['%PDF'], 'weg.pdf', { type: 'application/pdf' })]);
    const d = await neuOeffnen();
    await absenden(d, 'Dateien auswählen');
    await klick(within(d).getByRole('button', { name: 'weg.pdf entfernen' }));
    expect(aktiv()).toBe(within(d).getByRole('button', { name: 'Dateien auswählen' }));
  });

  it('eine Adresse entfernen: der Fokus geht auf das Entfernen der nächsten, sonst der davor, zuletzt auf „Link hinzufügen“', async () => {
    const d = await bearbeitenOeffnen();
    await klick(within(d).getByRole('button', { name: 'Link hinzufügen' }));
    tippen(feld(d, 'Adresse 2'), 'https://beispiel.example/zwei');
    await klick(within(d).getByRole('button', { name: 'Link hinzufügen' }));
    tippen(feld(d, 'Adresse 3'), 'https://beispiel.example/drei');

    await klick(within(d).getByRole('button', { name: 'Adresse 2 entfernen' }));
    expect(feld(d, 'Adresse 2').value).toBe('https://beispiel.example/drei');
    expect(aktiv()).toBe(within(d).getByRole('button', { name: 'Adresse 2 entfernen' }));
    await klick(within(d).getByRole('button', { name: 'Adresse 2 entfernen' }));
    expect(aktiv()).toBe(within(d).getByRole('button', { name: 'Adresse entfernen' }));
    await klick(within(d).getByRole('button', { name: 'Adresse entfernen' }));
    expect(aktiv()).toBe(within(d).getByRole('button', { name: 'Link hinzufügen' }));
  });
});

// ---------------------------------------------------------------------------
describe('Lesen: fremdes Material ohne Bearbeitungsrecht', () => {
  const ansehen = async () => {
    h.user = konto('admin', [12]);
    await oeffnen();
    await klick(screen.getAllByRole('button', { name: 'Andacht Advent ansehen' })[0]);
    return dialog('Material ansehen');
  };

  it('Hinweis, wer bearbeiten darf; die Angaben zum Lesen; kein Feld, kein Speichern, kein Löschen, keine Dateiauswahl', async () => {
    const d = await ansehen();
    expect(within(d).getByRole('status')).toHaveTextContent('Angelegt von Alex Beispiel. Bearbeiten und löschen kann nur diese Person oder die Gemeindeleitung.');
    const angaben = within(d).getByLabelText('Angaben zum Material');
    const wert = (label: string) => [...angaben.querySelectorAll('div')].find((z) => z.querySelector('dt')!.textContent === label)!.querySelector('dd')!.textContent;
    expect(wert('Titel')).toBe('Andacht Advent');
    expect(wert('Beschreibung')).toBe('Für den ersten Advent');
    expect(wert('Events')).toBe('Keine Events zugeordnet');
    expect(wert('Jahrgänge')).toBe('Ohne Zuordnung sieht das ganze Team das Material');
    expect(wert('Erstellt von')).toBe('Alex Beispiel');
    expect(wert('Erstellt am')).toBe('01.09.2026');
    expect(within(d).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(d).queryByRole('button', { name: 'Speichern' })).toBeNull();
    expect(within(d).queryByRole('button', { name: /löschen$/ })).toBeNull();
    expect(within(d).queryByRole('button', { name: 'Dateien auswählen' })).toBeNull();
    expect([...d.querySelectorAll('footer button')].map((b) => b.textContent)).toEqual(['Schließen']);
    expect(h.track).toHaveBeenCalledWith('material-angesehen', { inhalt: 'beides' });
  });

  it('der Link ist ein echter Link; die Datei öffnet im Betrachter; beides zählt als abgerufen', async () => {
    const d = await ansehen();
    const link = within(within(d).getByRole('list', { name: 'Links' })).getByRole('link', { name: /beispiel\.example/ });
    expect(link).toHaveAttribute('href', 'https://beispiel.example/advent');
    expect(link).toHaveAttribute('target', '_blank');
    await klick(link);
    expect(h.linkOeffnen).toHaveBeenCalledWith('https://beispiel.example/advent');
    expect(h.track).toHaveBeenCalledWith('material-abgerufen', { inhalt: 'link' });
    await klick(within(d).getByRole('button', { name: 'andacht.pdf ansehen' }));
    expect(fensterVon(FileViewerModal)).toHaveLength(1);
    expect(h.track).toHaveBeenCalledWith('material-abgerufen', { inhalt: 'datei' });
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(h.apiDelete).not.toHaveBeenCalled();
  });
});
