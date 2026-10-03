// Kategorien, Level, Zertifikate und Jahrgaenge in der Web-Fassung, gerendert
// (docs/planung/web-alle-bereiche.md, Entscheidung 6): Tabellen bzw. Kacheln mit
// Anlegen, Bearbeiten und Loeschen in der Zeile. Die Seiten halten Daten,
// Rechte und Fenster; geprueft wird, dass die Web-Fassung dieselben Fenster
// mit den richtigen Werten oeffnet, dieselben Rueckfragen stellt, die Rechte
// einhaelt (Anlegen von Jahrgaengen nur die Gemeindeleitung) und dass die
// schmale Darstellung der App bleibt.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';

const h = vi.hoisted(() => ({
  breit: true,
  laedt: false,
  daten: {} as Record<string, unknown>,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
  refresh: vi.fn(),
  setError: vi.fn(),
}));

vi.mock('@ionic/react', async () => (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../../services/api', () => ({ default: { get: (...a: unknown[]) => h.apiGet(...a), delete: (...a: unknown[]) => h.apiDelete(...a) } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  // Der Schluessel beginnt mit "admin:<was>:" -- die Daten stehen unter <was>.
  useOfflineQuery: (schluessel: string) => ({
    data: h.daten[schluessel.split(':')[1]] ?? [],
    loading: h.laedt,
    refresh: h.refresh,
    refreshLive: vi.fn(),
  }),
}));
vi.mock('../../../components/admin/modals/LevelManagementModal', () => ({ default: () => null }));

import AdminCategoriesPage from '../../../components/admin/pages/AdminCategoriesPage';
import AdminLevelsPage from '../../../components/admin/pages/AdminLevelsPage';
import AdminCertificatesPage from '../../../components/admin/pages/AdminCertificatesPage';
import AdminJahrgaengeePage from '../../../components/admin/pages/AdminJahrgaengeePage';
import LevelManagementModal from '../../../components/admin/modals/LevelManagementModal';

const KATEGORIEN = [
  { id: 1, name: 'Gottesdienst', description: 'Alles rund um Feiern und Beten', created_at: '2026-01-05T10:00:00Z' },
  { id: 2, name: 'Ausflug', created_at: '2026-02-05T10:00:00Z' },
  { id: 3, name: 'Gemeindefest', description: 'Aufbauen, Backen, Helfen', created_at: '2026-03-05T10:00:00Z' },
];

const LEVELS = [
  { id: 1, name: 'anfang', title: 'Neu dabei', description: 'Die ersten Schritte', points_required: 0, icon: 'footsteps', color: 'rgb(16, 185, 129)', is_active: true, created_at: '2026-01-01T10:00:00Z', updated_at: '2026-01-01T10:00:00Z' },
  { id: 2, name: 'fleissig', title: 'Fleißig', points_required: 12, icon: 'trophy', color: 'rgb(59, 130, 246)', is_active: true, created_at: '2026-01-01T10:00:00Z', updated_at: '2026-01-01T10:00:00Z' },
  { id: 3, name: 'profi', title: 'Konfi-Profi', description: 'Fast geschafft', points_required: 20, is_active: true, created_at: '2026-01-01T10:00:00Z', updated_at: '2026-01-01T10:00:00Z' },
];

const ZERTIFIKATE = [
  { id: 1, name: 'JuLeiCa', icon: 'ribbon', is_active: true, created_at: '2026-01-01T10:00:00Z' },
  { id: 2, name: 'Erste-Hilfe-Kurs', icon: 'medkit', is_active: true, created_at: '2026-01-02T10:00:00Z' },
];

const JAHRGAENGE = [
  { id: 12, name: 'Jahrgang 2027', created_at: '2026-01-01T10:00:00Z', gottesdienst_enabled: true, gemeinde_enabled: true, target_gottesdienst: 10, target_gemeinde: 8, konfspruch_enabled: true, wrapped_released_at: '2026-09-12T10:00:00Z', konfi_count: 18 },
  { id: 11, name: 'Jahrgang 2026', created_at: '2025-01-01T10:00:00Z', gottesdienst_enabled: true, gemeinde_enabled: false, target_gottesdienst: 12, konfspruch_enabled: false, wrapped_released_at: null, konfi_count: 21 },
  { id: 10, name: 'Jahrgang 2025', created_at: '2024-01-01T10:00:00Z', gottesdienst_enabled: false, gemeinde_enabled: false, konfspruch_enabled: true, konfi_count: 0 },
];

const tabelle = (name: string) => screen.getByRole('table', { name });
const zeilen = (name: string) => within(tabelle(name)).getAllByRole('row').slice(1);
const zelle = (z: HTMLElement, i: number) => within(z).getAllByRole('cell')[i];
const spaltenkoepfe = (name: string) => within(tabelle(name)).getAllByRole('columnheader').map((c) => c.textContent);
const fenster = () => h.stand.fenster;
/** Name und Knopf einer Zeile heissen gleich ("X bearbeiten"): der erste ist der Name in der Zelle. */
const erster = (name: string) => screen.getAllByRole('button', { name })[0];
const bestaetigen = async (text: string) => {
  await act(async () => { await h.stand.alert?.buttons?.find((b) => b.text === text)?.handler?.(); });
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.laedt = false;
  h.user = konto('org_admin');
  h.daten = { categories: KATEGORIEN, levels: LEVELS, certificates: ZERTIFIKATE, 'jahrgaenge-detail': JAHRGAENGE };
  h.apiGet.mockResolvedValue({ data: {} });
  h.apiDelete.mockResolvedValue({ data: {} });
});

// ---------------------------------------------------------------------------
describe('Kategorien (Web)', () => {
  it('Titel, Weg zurueck nach "Mehr", Zahl und Spalten', () => {
    render(<AdminCategoriesPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Kategorien' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mehr' })).toHaveAttribute('href', '/admin/settings');
    expect(screen.getByText('3 Kategorien', { selector: '.web-karte__untertitel' })).toBeInTheDocument();
    expect(spaltenkoepfe('Kategorien')).toEqual(['Name', 'Beschreibung', 'Aktionen']);
  });

  it('jede Zeile: Name und Beschreibung; ohne Beschreibung steht "Keine Beschreibung" da', () => {
    render(<AdminCategoriesPage />);
    const z = zeilen('Kategorien');
    expect(z).toHaveLength(3);
    expect(zelle(z[0], 0)).toHaveTextContent('Gottesdienst');
    expect(zelle(z[0], 1)).toHaveTextContent('Alles rund um Feiern und Beten');
    expect(zelle(z[1], 0)).toHaveTextContent('Ausflug');
    expect(zelle(z[1], 1)).toHaveTextContent('Keine Beschreibung');
    expect(zelle(z[2], 1)).toHaveTextContent('Aufbauen, Backen, Helfen');
  });

  it('Bearbeiten (Name und Knopf) und "Neue Kategorie" oeffnen das Fenster der App mit der Kategorie', () => {
    render(<AdminCategoriesPage />);
    fireEvent.click(erster('Ausflug bearbeiten'));
    expect(fenster()).toHaveLength(1);
    expect((fenster()[0].komponente as { name: string }).name).toBe('CategoryModal');
    expect(fenster()[0].props.category).toEqual(KATEGORIEN[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Neue Kategorie' }));
    expect(fenster()).toHaveLength(2);
    expect(fenster()[1].props.category).toBeNull();
  });

  it('Loeschen fragt wie in der App nach und ruft erst danach die Route; danach wird die Liste neu geladen', async () => {
    render(<AdminCategoriesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ausflug löschen' }));
    expect(h.stand.alert?.header).toBe('Kategorie löschen');
    expect(h.stand.alert?.message).toBe('Kategorie "Ausflug" wirklich löschen?');
    expect(h.apiDelete).not.toHaveBeenCalled();
    await bestaetigen('Löschen');
    expect(h.apiDelete).toHaveBeenCalledWith('/admin/categories/2');
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it('ein Fehler beim Loeschen steht in der Meldung des Servers', async () => {
    h.apiDelete.mockRejectedValue({ response: { status: 409, data: { error: 'Die Kategorie wird noch gebraucht.' } } });
    render(<AdminCategoriesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Gottesdienst löschen' }));
    await bestaetigen('Löschen');
    expect(h.setError).toHaveBeenCalledWith('Die Kategorie wird noch gebraucht.');
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('ohne Recht (Teamer:in): keine Knoepfe, die Namen stehen als Text', () => {
    h.user = konto('teamer');
    render(<AdminCategoriesPage />);
    expect(screen.queryByRole('button', { name: 'Neue Kategorie' })).toBeNull();
    expect(screen.queryByRole('button', { name: /bearbeiten|löschen/ })).toBeNull();
    expect(zelle(zeilen('Kategorien')[0], 0)).toHaveTextContent('Gottesdienst');
  });

  it('leer: Hinweis statt Tabelle; waehrend des Ladens ein Platzhalter', () => {
    h.daten.categories = [];
    const { unmount } = render(<AdminCategoriesPage />);
    expect(screen.getByText('Keine Kategorien gefunden')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    unmount();
    h.laedt = true;
    render(<AdminCategoriesPage />);
    expect(screen.getByText('Die Kategorien werden geladen.')).toBeInTheDocument();
  });

  it('schmal bleibt die Darstellung der App', () => {
    h.breit = false;
    const { container } = render(<AdminCategoriesPage />);
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Kategorien' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe('Level (Web)', () => {
  it('Spalten und Zeilen: Titel, Beschreibung und Punkte', () => {
    render(<AdminLevelsPage />);
    expect(screen.getByRole('link', { name: 'Mehr' })).toHaveAttribute('href', '/admin/settings');
    expect(screen.getByText('3 Level', { selector: '.web-karte__untertitel' })).toBeInTheDocument();
    expect(spaltenkoepfe('Level')).toEqual(['Level', 'Beschreibung', 'Ab Punkten', 'Aktionen']);
    const z = zeilen('Level');
    expect(zelle(z[0], 0)).toHaveTextContent('Neu dabei');
    expect(zelle(z[0], 1)).toHaveTextContent('Die ersten Schritte');
    expect(zelle(z[0], 2)).toHaveTextContent('0');
    expect(zelle(z[1], 0)).toHaveTextContent('Fleißig');
    expect(zelle(z[1], 1)).toHaveTextContent('Keine Beschreibung');
    expect(zelle(z[1], 2)).toHaveTextContent('12');
    expect(zelle(z[2], 2)).toHaveTextContent('20');
  });

  it('das Symbol traegt die Farbe des Levels aus den Daten', () => {
    render(<AdminLevelsPage />);
    const z = zeilen('Level');
    expect((zelle(z[0], 0).querySelector('.web-symbol') as HTMLElement).style.background).toBe('rgb(16, 185, 129)');
    expect((zelle(z[1], 0).querySelector('.web-symbol') as HTMLElement).style.background).toBe('rgb(59, 130, 246)');
    // Ohne Farbe in den Daten gilt die Farbe des Tons (Stylesheet).
    expect((zelle(z[2], 0).querySelector('.web-symbol') as HTMLElement).style.background).toBe('');
  });

  it('Bearbeiten und "Neues Level" oeffnen das Fenster der App; beim Anlegen ohne Level', () => {
    render(<AdminLevelsPage />);
    fireEvent.click(erster('Fleißig bearbeiten'));
    expect(fenster()[0].komponente).toBe(LevelManagementModal);
    expect(fenster()[0].props.level).toEqual(LEVELS[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Neues Level' }));
    expect(fenster()[1].komponente).toBe(LevelManagementModal);
    expect(fenster()[1].props.level).toBeUndefined();
  });

  it('Loeschen fragt nach dem Titel und ruft erst danach die Route', async () => {
    render(<AdminLevelsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Konfi-Profi löschen' }));
    expect(h.stand.alert?.header).toBe('Level löschen');
    expect(h.stand.alert?.message).toBe('Level "Konfi-Profi" wirklich löschen?');
    expect(h.apiDelete).not.toHaveBeenCalled();
    await bestaetigen('Löschen');
    expect(h.apiDelete).toHaveBeenCalledWith('/levels/3');
    expect(h.refresh).toHaveBeenCalled();
  });

  it('leer und schmal', () => {
    h.daten.levels = [];
    const { unmount } = render(<AdminLevelsPage />);
    expect(screen.getByText('Keine Level gefunden')).toBeInTheDocument();
    unmount();
    h.breit = false;
    const { container } = render(<AdminLevelsPage />);
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Level' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe('Zertifikate (Web)', () => {
  it('Kacheln mit Namen und Aktionen; die Zahl steht im Kopf der Karte', () => {
    render(<AdminCertificatesPage />);
    expect(screen.getByText('2 Zertifikate', { selector: '.web-karte__untertitel' })).toBeInTheDocument();
    const kacheln = within(screen.getByRole('list', { name: 'Zertifikate' })).getAllByRole('listitem');
    expect(kacheln).toHaveLength(2);
    expect(kacheln[0]).toHaveTextContent('JuLeiCa');
    expect(kacheln[1]).toHaveTextContent('Erste-Hilfe-Kurs');
    expect(within(kacheln[1]).getByRole('button', { name: 'Erste-Hilfe-Kurs bearbeiten' })).toBeInTheDocument();
    expect(within(kacheln[1]).getByRole('button', { name: 'Erste-Hilfe-Kurs löschen' })).toBeInTheDocument();
  });

  it('Bearbeiten und "Neues Zertifikat" oeffnen das Fenster der App mit dem Zertifikat', () => {
    render(<AdminCertificatesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'JuLeiCa bearbeiten' }));
    expect((fenster()[0].komponente as { name: string }).name).toBe('CertificateModal');
    expect(fenster()[0].props.certificateType).toEqual(ZERTIFIKATE[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Neues Zertifikat' }));
    expect(fenster()[1].props.certificateType).toBeNull();
  });

  it('Loeschen fragt nach dem Namen und ruft erst danach die Route', async () => {
    render(<AdminCertificatesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'JuLeiCa löschen' }));
    expect(h.stand.alert?.header).toBe('Zertifikat löschen');
    expect(h.stand.alert?.message).toBe('"JuLeiCa" wirklich löschen?');
    await bestaetigen('Löschen');
    expect(h.apiDelete).toHaveBeenCalledWith('/teamer/certificate-types/1');
  });

  it('ohne Recht (Teamer:in): die Kacheln zeigen nur die Namen', () => {
    h.user = konto('teamer');
    render(<AdminCertificatesPage />);
    expect(screen.queryByRole('button', { name: 'Neues Zertifikat' })).toBeNull();
    expect(screen.queryByRole('button', { name: /bearbeiten|löschen/ })).toBeNull();
    expect(within(screen.getByRole('list', { name: 'Zertifikate' })).getAllByRole('listitem')).toHaveLength(2);
  });

  it('leer und schmal', () => {
    h.daten.certificates = [];
    const { unmount } = render(<AdminCertificatesPage />);
    expect(screen.getByText('Keine Zertifikate', { selector: 'h3' })).toBeInTheDocument();
    unmount();
    h.breit = false;
    const { container } = render(<AdminCertificatesPage />);
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Zertifikate' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe('Jahrgaenge (Web)', () => {
  it('Kennzahlen, Spalten und Zeilen: Konfis, Punkteziele, Konfispruch, Rueckblick', () => {
    render(<AdminJahrgaengeePage />);
    expect(screen.getByRole('group', { name: 'Konfis: 39' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Jahrgänge: 3' })).toBeInTheDocument();
    expect(spaltenkoepfe('Jahrgänge')).toEqual(['Jahrgang', 'Konfis', 'Punkteziele', 'Konfispruch', 'Rückblick', 'Aktionen']);
    const z = zeilen('Jahrgänge');
    expect(zelle(z[0], 0)).toHaveTextContent('Jahrgang 2027');
    expect(zelle(z[0], 1)).toHaveTextContent('18');
    expect(zelle(z[0], 2)).toHaveTextContent('Gottesdienst 10');
    expect(zelle(z[0], 2)).toHaveTextContent('Gemeinde 8');
    expect(zelle(z[0], 3)).toHaveTextContent('Spruch frei');
    expect(zelle(z[0], 4)).toHaveTextContent('Gestartet am 12.09.2026');
    // Gemeindepunkte abgeschaltet: nur das Gottesdienst-Ziel; Spruch gesperrt; kein Rueckblick.
    expect(zelle(z[1], 2)).toHaveTextContent('Gottesdienst 12');
    expect(zelle(z[1], 2)).not.toHaveTextContent('Gemeinde');
    expect(zelle(z[1], 3)).toHaveTextContent('Spruch gesperrt');
    expect(zelle(z[1], 4)).toHaveTextContent('Noch kein Rückblick');
    // Beide Punkte abgeschaltet.
    expect(zelle(z[2], 2)).toHaveTextContent('Keine Punkte');
    expect(zelle(z[2], 1)).toHaveTextContent('0');
  });

  it('die Gemeindeleitung legt an und bearbeitet; die Leitung legt nicht an, bearbeitet und loescht aber', () => {
    const { unmount } = render(<AdminJahrgaengeePage />);
    expect(screen.getByRole('button', { name: 'Neuer Jahrgang' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Jahrgang 2027 bearbeiten' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Jahrgang 2027 löschen' })).toBeInTheDocument();
    unmount();
    h.user = konto('admin', [12]);
    render(<AdminJahrgaengeePage />);
    expect(screen.queryByRole('button', { name: 'Neuer Jahrgang' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Jahrgang 2027 bearbeiten' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Jahrgang 2027 löschen' })).toBeInTheDocument();
  });

  it('ohne Recht (Teamer:in): die Namen stehen als Text, keine Knoepfe', () => {
    h.user = konto('teamer');
    render(<AdminJahrgaengeePage />);
    expect(screen.queryByRole('button', { name: /Neuer Jahrgang|bearbeiten|löschen/ })).toBeNull();
    expect(zelle(zeilen('Jahrgänge')[0], 0)).toHaveTextContent('Jahrgang 2027');
  });

  it('Bearbeiten und "Neuer Jahrgang" oeffnen das Fenster der App mit dem Jahrgang', () => {
    render(<AdminJahrgaengeePage />);
    fireEvent.click(erster('Jahrgang 2026 bearbeiten'));
    expect((fenster()[0].komponente as { name: string }).name).toBe('JahrgangModal');
    expect(fenster()[0].props.jahrgang).toEqual(JAHRGAENGE[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Jahrgang' }));
    expect(fenster()[1].props.jahrgang).toBeNull();
  });

  it('Loeschen: erst die Zahlen vom Server in der Rueckfrage, dann die Route', async () => {
    h.apiGet.mockResolvedValue({
      data: {
        aktive_konfis: 0, befoerderte: 0, chat_nachrichten: 0, events_geloescht: 3, events_kuenftig: 1,
        events_behalten: 0, challenges_geloescht: 1, challenges_behalten: 0,
      },
    });
    render(<AdminJahrgaengeePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Jahrgang 2026 löschen' }));
    await waitFor(() => expect(h.stand.alert?.header).toBe('Jahrgang löschen'));
    expect(h.apiGet).toHaveBeenCalledWith('/admin/jahrgaenge/11/loeschvorschau');
    expect(h.stand.alert?.message).toContain('Jahrgang "Jahrgang 2026" wirklich löschen?');
    expect(h.stand.alert?.message).toContain('Mit dem Jahrgang werden 3 Events und 1 Challenge gelöscht');
    expect(h.stand.alert?.message).toContain('Ein Event liegt noch in der Zukunft.');
    expect(h.apiDelete).not.toHaveBeenCalled();
    await bestaetigen('Löschen');
    expect(h.apiDelete).toHaveBeenCalledWith('/admin/jahrgaenge/11');
    expect(h.refresh).toHaveBeenCalled();
  });

  it('Chat-Nachrichten im Jahrgang: zweite Rueckfrage, "Dennoch loeschen" ruft die Route mit force', async () => {
    h.apiDelete.mockRejectedValueOnce({ response: { status: 409, data: { error: 'Der Jahrgang enthält 12 Chat-Nachrichten.', canForceDelete: true } } });
    render(<AdminJahrgaengeePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Jahrgang 2027 löschen' }));
    await waitFor(() => expect(h.stand.alert?.header).toBe('Jahrgang löschen'));
    await bestaetigen('Löschen');
    expect(h.apiDelete).toHaveBeenCalledWith('/admin/jahrgaenge/12');
    await waitFor(() => expect(h.stand.alert?.header).toBe('Chat-Nachrichten vorhanden'));
    expect(h.stand.alert?.message).toContain('Der Jahrgang enthält 12 Chat-Nachrichten.');
    expect(h.refresh).not.toHaveBeenCalled();
    await bestaetigen('Dennoch löschen');
    expect(h.apiDelete).toHaveBeenLastCalledWith('/admin/jahrgaenge/12?force=true');
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it('leer und schmal', () => {
    h.daten['jahrgaenge-detail'] = [];
    const { unmount } = render(<AdminJahrgaengeePage />);
    expect(screen.getByText('Keine Jahrgänge gefunden')).toBeInTheDocument();
    unmount();
    h.breit = false;
    const { container } = render(<AdminJahrgaengeePage />);
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Jahrgänge' })).toBeInTheDocument();
  });
});
