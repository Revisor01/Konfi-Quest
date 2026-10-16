// Benutzer:innen der Gemeinde in der Web-Fassung (/admin/users), gerendert
// (docs/planung/web-alle-bereiche.md, Entscheidung 6): Tabelle mit Rolle,
// Jahrgaengen, Status und Aktionen, Filter und Suche, dazu die
// offenen Einladungen. Die Rechte sind die der App: Anlegen, Einladen, Entfernen
// und die offenen Einladungen nur fuer die Gemeindeleitung, Bearbeiten nur bei
// can_edit. Die Seite stellt dieselben Rueckfragen wie in der App; das
// Benutzerformular ist seit 11.10.2026 ein eigener Dialog (WebBenutzerDialog).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';
import type { AdminUser } from '../../../types/user';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
  refresh: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
  personen: [] as unknown[],
  einladungen: [] as unknown[],
}));

vi.mock('@ionic/react', async () => (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => true }));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({ data: h.personen, loading: false, refresh: h.refresh, refreshLive: vi.fn() }),
}));
vi.mock('../../../components/admin/modals/EinladungModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/UserManagementModal', () => ({ default: () => null }));

import AdminUsersPage from '../../../components/admin/pages/AdminUsersPage';
import UserManagementModal from '../../../components/admin/modals/UserManagementModal';
import EinladungModal from '../../../components/admin/modals/EinladungModal';

const person = (id: number, name: string, zusatz: Partial<AdminUser> = {}): AdminUser => ({
  id, username: name.toLowerCase().replace(/\s+/g, '.'), display_name: name, is_active: true,
  created_at: '2026-01-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z',
  role_name: 'teamer', role_display_name: 'Teamer', assigned_jahrgaenge_count: 1, can_edit: true,
  mitgliedschaft: 'stamm', weitere_gemeinden: 0, last_login_at: '2026-09-30T10:00:00Z', ...zusatz,
});

const PERSONEN: AdminUser[] = [
  person(1, 'Robin Probe'),
  person(2, 'Alex Beispiel', { role_name: 'org_admin', role_title: 'Pastor:in', assigned_jahrgaenge_count: 0 }),
  person(3, 'Sam Muster', { role_name: 'admin', assigned_jahrgaenge_count: 2, last_login_at: undefined }),
  person(4, 'Charlie Demo', { is_active: false }),
  person(5, 'Gast Beispiel', { mitgliedschaft: 'weitere', weitere_gemeinden: 1 }),
  person(6, 'Lou Exempel', { role_name: 'admin', assigned_jahrgaenge_count: 0 }),
  person(7, 'Geschützt Person', { can_edit: false }),
];

const EINLADUNGEN = [
  { id: 31, user_id: 301, display_name: 'Nico Entwurf', username: 'nico.entwurf', role_name: 'teamer', role_display_name: 'Teamer', created_at: '2026-10-01T09:00:00Z', expires_at: '2026-10-08T09:00:00Z', eingeladen_von_name: 'Alex Beispiel' },
  { id: 32, user_id: 302, display_name: 'Eli Beispielmann', username: 'eli.beispielmann', role_name: 'admin', role_display_name: 'Hauptamt', created_at: '2026-09-29T09:00:00Z', expires_at: '2026-10-06T09:00:00Z', eingeladen_von_name: null },
];

const tabelle = (name = 'Benutzer:innen') => screen.getByRole('table', { name });
const zeilen = (name = 'Benutzer:innen') => within(tabelle(name)).getAllByRole('row').slice(1);
const zelle = (z: HTMLElement, i: number) => within(z).getAllByRole('cell')[i];
// Der Name steht als Knopf (darf bearbeiten) oder als Text in der Namenszelle (WebNameZelle).
const NAME = '.web-link--zeile, .web-zelle-titel';
const namen = () => zeilen().map((z) => zelle(z, 0).querySelector(NAME)!.textContent);
const zeileVon = (name: string) => zeilen().find((z) => zelle(z, 0).querySelector(NAME)!.textContent === name)!;

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.user = konto('org_admin');
  h.personen = PERSONEN;
  h.einladungen = EINLADUNGEN;
  h.apiGet.mockImplementation(async (url: string) => {
    // Der Dialog zum Bearbeiten laedt die Person (GET /users/:id).
    const id = /^\/users\/(\d+)$/.exec(url)?.[1];
    const p = id ? PERSONEN.find((x) => x.id === Number(id)) : undefined;
    if (p) return { data: { ...p, email: '', role_title: '', role_id: 2, assigned_jahrgaenge: [] } };
    return { data: url === '/einladungen' ? h.einladungen : [] };
  });
  h.apiDelete.mockResolvedValue({ data: { message: 'Die Person wurde entfernt.' } });
});

describe('Benutzer:innen (Web): Tabelle', () => {
  it('Spalten und Reihenfolge: Gemeindeleitung, Leitung, dann Team -- darin nach Name', async () => {
    render(<AdminUsersPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Benutzer:innen' })).toBeInTheDocument();
    expect(within(tabelle()).getAllByRole('columnheader').map((c) => c.textContent))
      .toEqual(['Name', 'Rolle', 'Jahrgänge', 'Status', 'Zuletzt angemeldet', 'Aktionen']);
    expect(namen()).toEqual(['Alex Beispiel', 'Lou Exempel', 'Sam Muster', 'Charlie Demo', 'Gast Beispiel', 'Geschützt Person', 'Robin Probe']);
    await screen.findByRole('table', { name: 'Offene Einladungen' });
  });

  it('die Rolle steht als Wort: Gemeindeleitung, Leitung, Teamer:in', async () => {
    render(<AdminUsersPage />);
    const marke = (name: string) => zelle(zeileVon(name), 1).querySelector('.web-rollenmarke')!;
    expect(marke('Alex Beispiel')).toHaveTextContent('Gemeindeleitung');
    expect(marke('Sam Muster')).toHaveTextContent('Leitung');
    expect(marke('Robin Probe')).toHaveTextContent('Teamer:in');
    await screen.findByRole('table', { name: 'Offene Einladungen' });
  });

  it('Jahrgaenge: die Gemeindeleitung sieht alle, sonst die Zahl der Zuweisungen oder "Kein Jahrgang"', async () => {
    render(<AdminUsersPage />);
    expect(zelle(zeileVon('Alex Beispiel'), 2)).toHaveTextContent('Alle Jahrgänge');
    expect(zelle(zeileVon('Sam Muster'), 2)).toHaveTextContent('2 Jahrgänge');
    expect(zelle(zeileVon('Robin Probe'), 2)).toHaveTextContent('1 Jahrgang');
    expect(zelle(zeileVon('Lou Exempel'), 2)).toHaveTextContent('Kein Jahrgang');
    await screen.findByRole('table', { name: 'Offene Einladungen' });
  });

  it('Status, Gast und letzte Anmeldung; gesperrte Zeilen sagen "Gesperrt"', async () => {
    render(<AdminUsersPage />);
    expect(zelle(zeileVon('Robin Probe'), 3)).toHaveTextContent('Aktiv');
    expect(zelle(zeileVon('Robin Probe'), 3)).not.toHaveTextContent('Gesperrt');
    expect(zelle(zeileVon('Charlie Demo'), 3)).toHaveTextContent('Gesperrt');
    expect(zelle(zeileVon('Gast Beispiel'), 3)).toHaveTextContent('Gast');
    expect(zelle(zeileVon('Robin Probe'), 3)).not.toHaveTextContent('Gast');
    expect(zelle(zeileVon('Robin Probe'), 4)).toHaveTextContent('30.09.2026');
    expect(zelle(zeileVon('Sam Muster'), 4)).toHaveTextContent('noch nie');
    expect(zelle(zeileVon('Alex Beispiel'), 0)).toHaveTextContent('@alex.beispiel · Pastor:in');
    await screen.findByRole('table', { name: 'Offene Einladungen' });
  });

  it('Kennzahlen und Filter mit Zahlen: Alle 7, Aktiv 6, Leitung 3, Team 4', async () => {
    render(<AdminUsersPage />);
    expect(screen.getByRole('group', { name: 'Gesamt: 7' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Leitung: 3' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Team: 4' })).toBeInTheDocument();
    for (const [name, anzahl] of [['Alle', 7], ['Aktiv', 6], ['Leitung', 3], ['Team', 4]] as const) {
      expect(screen.getByRole('button', { name: new RegExp(`^${name}\\s*${anzahl}$`) })).toBeInTheDocument();
    }
    await screen.findByRole('table', { name: 'Offene Einladungen' });
  });
});

describe('Benutzer:innen (Web): Filter und Suche', () => {
  it('Leitung zeigt Gemeindeleitung und Leitung; Team nur das Team; Aktiv ohne Gesperrte', async () => {
    render(<AdminUsersPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Leitung\s*3$/ }));
    expect(namen()).toEqual(['Alex Beispiel', 'Lou Exempel', 'Sam Muster']);
    fireEvent.click(screen.getByRole('button', { name: /^Team\s*4$/ }));
    expect(namen()).toEqual(['Charlie Demo', 'Gast Beispiel', 'Geschützt Person', 'Robin Probe']);
    fireEvent.click(screen.getByRole('button', { name: /^Aktiv\s*6$/ }));
    expect(namen()).not.toContain('Charlie Demo');
    expect(namen()).toHaveLength(6);
    await screen.findByRole('table', { name: 'Offene Einladungen' });
  });

  it('die Suche findet Namen, Benutzernamen, die Selbstbezeichnung und das Rollenwort', async () => {
    render(<AdminUsersPage />);
    const feld = screen.getByRole('searchbox', { name: 'Benutzer:in suchen' });
    fireEvent.change(feld, { target: { value: 'pastor' } });
    expect(namen()).toEqual(['Alex Beispiel']);
    fireEvent.change(feld, { target: { value: 'geschuetzt' } });
    expect(namen()).toEqual(['Geschützt Person']);
    fireEvent.change(feld, { target: { value: 'gemeindeleitung' } });
    expect(namen()).toEqual(['Alex Beispiel']);
    expect(screen.getByText('1 von 7')).toBeInTheDocument();
    fireEvent.change(feld, { target: { value: 'gibtesnicht' } });
    expect(screen.getByText('Keine Benutzer:innen gefunden')).toBeInTheDocument();
    await screen.findByRole('table', { name: 'Offene Einladungen' });
  });
});

describe('Benutzer:innen (Web): Rechte', () => {
  it('Gemeindeleitung: Anlegen, Einladen, Entfernen und offene Einladungen', async () => {
    render(<AdminUsersPage />);
    expect(screen.getByRole('button', { name: 'Benutzer:in anlegen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Person einladen' })).toBeInTheDocument();
    expect(within(zeileVon('Robin Probe')).getByRole('button', { name: 'Robin Probe löschen' })).toBeInTheDocument();
    await screen.findByRole('table', { name: 'Offene Einladungen' });
    expect(h.apiGet).toHaveBeenCalledWith('/einladungen');
  });

  it('Leitung: sieht die Liste, aber weder Anlegen noch Einladen noch Entfernen -- und die Einladungen werden gar nicht erst abgerufen', () => {
    h.user = konto('admin', [12]);
    render(<AdminUsersPage />);
    expect(namen()).toHaveLength(7);
    expect(screen.queryByRole('button', { name: 'Benutzer:in anlegen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Person einladen' })).toBeNull();
    expect(screen.queryByRole('button', { name: /löschen|entfernen/ })).toBeNull();
    expect(screen.queryByRole('table', { name: 'Offene Einladungen' })).toBeNull();
    expect(h.apiGet).not.toHaveBeenCalled();
    // Bearbeiten bleibt (die Seite prueft can_edit wie in der App).
    expect(within(zeileVon('Robin Probe')).getAllByRole('button', { name: 'Robin Probe bearbeiten' })).toHaveLength(2);
  });

  it('can_edit = false schuetzt die Zeile auch vor der Gemeindeleitung: weder Bearbeiten noch Entfernen, der Name ist kein Knopf', async () => {
    render(<AdminUsersPage />);
    const z = zeileVon('Geschützt Person');
    expect(within(z).queryByRole('button')).toBeNull();
    await screen.findByRole('table', { name: 'Offene Einladungen' });
  });

  it('wer in einer anderen Gemeinde zuhause ist, wird "aus der Gemeinde entfernt" -- nicht geloescht', async () => {
    render(<AdminUsersPage />);
    expect(within(zeileVon('Gast Beispiel')).getByRole('button', { name: 'Gast Beispiel aus der Gemeinde entfernen' })).toBeInTheDocument();
    await screen.findByRole('table', { name: 'Offene Einladungen' });
  });
});

describe('Benutzer:innen (Web): Aktionen oeffnen die Fenster', () => {
  // Seit 11.10.2026 steht das Benutzerformular im Browser als eigener Dialog
  // (WebBenutzerDialog; ausfuehrlich in webBenutzerDialog.test.tsx) -- das
  // Fenster der App geht im breiten Layout nicht mehr auf. Einladen bleibt
  // das Fenster der App.
  it('Anlegen: der Dialog „Benutzer:in anlegen“ ohne Person; Einladen: das Fenster zum Einladen', async () => {
    render(<AdminUsersPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Benutzer:in anlegen' }));
    const dialog = screen.getByRole('dialog', { name: 'Benutzer:in anlegen' });
    await waitFor(() => expect(h.apiGet).toHaveBeenCalledWith('/roles'));
    expect(h.apiGet).not.toHaveBeenCalledWith(expect.stringMatching(/^\/users\/\d+$/));
    expect((within(dialog).getByLabelText('Anzeigename') as HTMLInputElement).value).toBe('');
    expect(h.stand.fenster.some((f) => f.komponente === UserManagementModal)).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Person einladen' }));
    expect(h.stand.fenster).toHaveLength(1);
    expect(h.stand.fenster[0].komponente).toBe(EinladungModal);
    await screen.findByRole('table', { name: 'Offene Einladungen' });
  });

  it('Bearbeiten (Name und Knopf): derselbe Dialog, mit der Kennung der Person', async () => {
    render(<AdminUsersPage />);
    const knoepfe = within(zeileVon('Sam Muster')).getAllByRole('button', { name: 'Sam Muster bearbeiten' });
    expect(knoepfe).toHaveLength(2);
    for (const k of knoepfe) {
      h.apiGet.mockClear();
      fireEvent.click(k);
      const dialog = screen.getByRole('dialog', { name: 'Benutzer:in bearbeiten' });
      await waitFor(() => expect(h.apiGet).toHaveBeenCalledWith('/users/3'));
      fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    }
    expect(h.stand.fenster).toEqual([]);
    await screen.findByRole('table', { name: 'Offene Einladungen' });
  });

  it('Entfernen fragt wie in der App nach (Loeschen vs. aus der Gemeinde entfernen) und ruft erst danach die Route', async () => {
    render(<AdminUsersPage />);
    fireEvent.click(within(zeileVon('Robin Probe')).getByRole('button', { name: 'Robin Probe löschen' }));
    expect(h.stand.alert?.header).toBe('Benutzer löschen');
    expect(h.apiDelete).not.toHaveBeenCalled();
    await act(async () => { h.stand.alert?.buttons?.find((b) => b.text === 'Löschen')?.handler?.(); });
    await waitFor(() => expect(h.apiDelete).toHaveBeenCalledWith('/users/1'));
    expect(h.setSuccess).toHaveBeenCalledWith('Die Person wurde entfernt.');
    expect(h.refresh).toHaveBeenCalled();
    h.stand.alert = null;
    fireEvent.click(within(zeileVon('Gast Beispiel')).getByRole('button', { name: 'Gast Beispiel aus der Gemeinde entfernen' }));
    // Nach dem Zuruecksetzen kennt TypeScript nur "null"; das Fenster setzt den Stand erneut.
    expect((h.stand as LeitungTestStand).alert?.header).toBe('Mitgliedschaft beenden');
    await screen.findByRole('table', { name: 'Offene Einladungen' });
  });
});

describe('Benutzer:innen (Web): offene Einladungen', () => {
  it('Tabelle mit Person, Rolle, eingeladen am (von wem) und gueltig bis', async () => {
    render(<AdminUsersPage />);
    const t = await screen.findByRole('table', { name: 'Offene Einladungen' });
    const reihen = within(t).getAllByRole('row').slice(1);
    expect(within(t).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Person', 'Eingeladen als', 'Eingeladen am', 'Gültig bis', 'Aktionen']);
    expect(reihen).toHaveLength(2);
    expect(zelle(reihen[0], 0)).toHaveTextContent('Nico Entwurf@nico.entwurf');
    expect(zelle(reihen[0], 1)).toHaveTextContent('Teamer:in');
    expect(zelle(reihen[0], 2)).toHaveTextContent('01.10.2026');
    expect(zelle(reihen[0], 2)).toHaveTextContent('von Alex Beispiel');
    expect(zelle(reihen[0], 3)).toHaveTextContent('08.10.2026');
    // Das Wort der Rolle, nicht das alte aus der Datenbank ("Hauptamt").
    expect(zelle(reihen[1], 1)).toHaveTextContent('Leitung');
    expect(zelle(reihen[1], 1)).not.toHaveTextContent('Hauptamt');
    expect(zelle(reihen[1], 2)).not.toHaveTextContent('von');
  });

  it('Zurueckziehen fragt nach, ruft DELETE und nimmt die Zeile aus der Tabelle', async () => {
    render(<AdminUsersPage />);
    await screen.findByRole('table', { name: 'Offene Einladungen' });
    fireEvent.click(screen.getByRole('button', { name: 'Einladung an Nico Entwurf zurückziehen' }));
    expect(h.stand.alert?.header).toBe('Einladung zurückziehen');
    expect(h.apiDelete).not.toHaveBeenCalled();
    await act(async () => { h.stand.alert?.buttons?.find((b) => b.text === 'Zurückziehen')?.handler?.(); });
    await waitFor(() => expect(h.apiDelete).toHaveBeenCalledWith('/einladungen/31'));
    expect(h.setSuccess).toHaveBeenCalledWith('Die Einladung an Nico Entwurf ist zurückgezogen.');
    expect(within(screen.getByRole('table', { name: 'Offene Einladungen' })).getAllByRole('row')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Einladung an Nico Entwurf zurückziehen' })).toBeNull();
  });

  it('keine offene Einladung: der Abschnitt steht nicht da', async () => {
    h.einladungen = [];
    render(<AdminUsersPage />);
    await waitFor(() => expect(h.apiGet).toHaveBeenCalledWith('/einladungen'));
    expect(screen.queryByRole('table', { name: 'Offene Einladungen' })).toBeNull();
    expect(screen.queryByText('Offene Einladungen')).toBeNull();
  });
});
