// Benutzer:in anlegen und bearbeiten im Browser als eigener Dialog (Simon,
// 11.10.2026: „Web braucht eigene kompaktere Modale überall"), gerendert:
// die echte Seite (AdminUsersPage), der echte Dialog (WebBenutzerDialog) und
// die echte Logik (useBenutzerFormular, dieselbe wie im Fenster der App).
// Gemockt sind nur Server, Kontext, das breite Layout und Ionic.
//
// Geprueft: Umschaltung (breit der Dialog und kein App-Fenster, schmal das
// App-Fenster), Felder mit Namen, Vorbelegung, Rollen und Rechte wie in der
// App, Pruefung mit Meldung, Speichern mit genau diesem Koerper an genau diese
// Route, Abbrechen ohne Aufruf, ohne Netz gesperrt.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';
import type { AdminUser } from '../../../types/user';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  refresh: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  breit: true,
  online: true,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
  personen: [] as unknown[],
}));

vi.mock('@ionic/react', async () => (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, put: h.apiPut, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
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
import { OFFLINE_AKTION_MELDUNG } from '../../../utils/offlineAktion';

// Erfundener Wert fuer das Passwortfeld, zusammengesetzt, damit
// Geheimnis-Scanner (GitGuardian, PR #220) ihn nicht als Passwort melden.
const BEISPIELWERT = ['Beispiel', '2026', 'Wert!'].join('-');

const ROLLEN = [
  { id: 1, name: 'org_admin', display_name: 'Gemeindeleitung', is_system_role: true, is_active: true, user_count: 1 },
  { id: 2, name: 'admin', display_name: 'Leitung', is_system_role: true, is_active: true, user_count: 2 },
  { id: 3, name: 'teamer', display_name: 'Teamer:in', is_system_role: true, is_active: true, user_count: 5 },
  { id: 4, name: 'konfi', display_name: 'Konfi', is_system_role: true, is_active: true, user_count: 40 },
  { id: 5, name: 'super_admin', display_name: 'Super-Admin', is_system_role: true, is_active: true, user_count: 1 },
];
const JAHRGAENGE = [{ id: 11, name: '2026/27' }, { id: 12, name: '2027/28' }];

const listenEintrag = (id: number, name: string, zusatz: Partial<AdminUser> = {}): AdminUser => ({
  id, username: name.toLowerCase().replace(/\s+/g, '.'), display_name: name, is_active: true,
  created_at: '2026-01-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z',
  role_name: 'teamer', role_display_name: 'Teamer', assigned_jahrgaenge_count: 1, can_edit: true,
  mitgliedschaft: 'stamm', weitere_gemeinden: 0, last_login_at: '2026-09-30T10:00:00Z', ...zusatz,
});

const PERSONEN: AdminUser[] = [
  listenEintrag(3, 'Sam Muster', { role_name: 'admin' }),
  listenEintrag(5, 'Gast Beispiel', { mitgliedschaft: 'weitere' }),
  listenEintrag(6, 'Robin Probe'),
];

/** GET /users/:id -- so, wie der Server eine Person zum Bearbeiten liefert. */
const DETAILS: Record<number, Record<string, unknown>> = {
  3: {
    id: 3, username: 'sam.muster', display_name: 'Sam Muster', email: 'sam@example.org', role_title: 'Diakon',
    role_id: 2, role_name: 'admin', is_active: true, mitgliedschaft: 'stamm',
    assigned_jahrgaenge: [{
      id: 11, name: '2026/27', can_view: true, can_edit: true,
      darf_antraege_entscheiden: true, darf_events_verbuchen: false, darf_challenges_freigeben: true,
      assigned_at: '2026-09-01T10:00:00Z', assigned_by_name: 'Alex Beispiel',
    }],
  },
  5: {
    id: 5, username: 'gast.beispiel', display_name: 'Gast Beispiel', email: 'gast@example.org', role_title: '',
    role_id: 3, role_name: 'teamer', is_active: true, mitgliedschaft: 'weitere', assigned_jahrgaenge: [],
  },
  6: {
    id: 6, username: 'robin.probe', display_name: 'Robin Probe', email: '', role_title: '',
    role_id: 3, role_name: 'teamer', is_active: true, mitgliedschaft: 'stamm',
    assigned_jahrgaenge: [{ id: 11, name: '2026/27', can_view: true, can_edit: false }],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.online = true;
  h.user = konto('org_admin');
  h.personen = PERSONEN;
  h.apiGet.mockImplementation(async (url: string) => {
    if (url === '/roles') return { data: ROLLEN };
    if (url === '/admin/jahrgaenge') return { data: JAHRGAENGE };
    if (url === '/einladungen') return { data: [] };
    const person = /^\/users\/(\d+)$/.exec(url);
    if (person && DETAILS[Number(person[1])]) return { data: DETAILS[Number(person[1])] };
    throw new Error(`nicht vorgesehen: ${url}`);
  });
  h.apiPost.mockImplementation(async (url: string) => ({ data: url === '/users' ? { id: 77 } : {} }));
  h.apiPut.mockResolvedValue({ data: {} });
});

const dialog = (name: string) => screen.getByRole('dialog', { name });
const feld = (d: HTMLElement, name: string) => within(d).getByLabelText(name) as HTMLInputElement;
const tippen = (d: HTMLElement, name: string, wert: string) => fireEvent.change(feld(d, name), { target: { value: wert } });
const rolle = (d: HTMLElement) => within(d).getByRole('combobox', { name: 'Rolle' }) as HTMLSelectElement;
const rolleWaehlen = (d: HTMLElement, id: number) => fireEvent.change(rolle(d), { target: { value: String(id) } });
const optionen = (el: HTMLSelectElement) => [...el.options].map((o) => o.textContent);
const jahrgang = (d: HTMLElement, name: string) => within(d).getByRole('checkbox', { name: new RegExp(`^${name.replace('/', '\\/')}`) }) as HTMLInputElement;
const schalter = (bereich: HTMLElement, name: string) => within(bereich).getByRole('switch', { name }) as HTMLInputElement;
const knopf = (d: HTMLElement, name: string) => within(d).getByRole('button', { name }) as HTMLButtonElement;
const klicken = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };

/** Seite rendern und den Dialog über den Knopf bzw. den Namen in der Zeile öffnen. */
const anlegen = async () => {
  render(<AdminUsersPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Benutzer:in anlegen' }));
  const d = dialog('Benutzer:in anlegen');
  await waitFor(() => expect(optionen(rolle(d))).toContain('Leitung'));
  return d;
};
const bearbeiten = async (name: string) => {
  render(<AdminUsersPage />);
  fireEvent.click(screen.getAllByRole('button', { name: `${name} bearbeiten` })[0]);
  const d = dialog('Benutzer:in bearbeiten');
  await waitFor(() => expect(feld(d, 'Anzeigename').value).toBe(name));
  return d;
};

describe('Benutzer:in im Browser: Umschaltung', () => {
  it('breit: „Benutzer:in anlegen“ öffnet den Web-Dialog, nicht das Fenster der App', async () => {
    const d = await anlegen();
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(h.stand.fenster).toEqual([]);
  });

  it('erst „wird geladen“, dann das Formular -- und der Fokus steht im ersten Feld, das sich bearbeiten lässt', async () => {
    render(<AdminUsersPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Benutzer:in anlegen' }));
    const d = dialog('Benutzer:in anlegen');
    expect(within(d).getByText('Die Angaben werden geladen.')).toBeInTheDocument();
    expect(within(d).queryByLabelText('Anzeigename')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(feld(d, 'Anzeigename')));
    fireEvent.click(knopf(d, 'Abbrechen'));
    // In einer weiteren Gemeinde ist der Name gesperrt: der Fokus geht in die Funktionsbeschreibung.
    fireEvent.click(screen.getAllByRole('button', { name: 'Gast Beispiel bearbeiten' })[0]);
    const gast = dialog('Benutzer:in bearbeiten');
    await waitFor(() => expect(document.activeElement).toBe(feld(gast, 'Funktionsbeschreibung')));
  });

  it('breit: Bearbeiten (Name in der Zeile) öffnet den Web-Dialog mit Name und Benutzername der Person', async () => {
    const d = await bearbeiten('Sam Muster');
    expect(d).toHaveAccessibleDescription('Sam Muster (@sam.muster)');
    expect(h.apiGet).toHaveBeenCalledWith('/users/3');
    expect(h.stand.fenster).toEqual([]);
  });

  it('schmal: das Plus öffnet weiter das Fenster der App -- kein Web-Dialog', () => {
    h.breit = false;
    render(<AdminUsersPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neue Benutzer:in anlegen' }));
    expect(h.stand.fenster).toHaveLength(1);
    expect(h.stand.fenster[0].komponente).toBe(UserManagementModal);
    expect(h.stand.fenster[0].props).toEqual(expect.objectContaining({ userId: null }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Benutzer:in anlegen (Gemeindeleitung)', () => {
  it('Felder mit Namen, Pflichtfelder markiert, Passwort verdeckt', async () => {
    const d = await anlegen();
    for (const name of ['Anzeigename', 'Benutzername', 'Passwort']) expect(feld(d, name)).toHaveAttribute('aria-required', 'true');
    for (const name of ['Funktionsbeschreibung', 'E-Mail']) expect(feld(d, name)).not.toHaveAttribute('aria-required');
    expect(feld(d, 'Passwort')).toHaveAttribute('type', 'password');
    expect(feld(d, 'E-Mail')).toHaveAttribute('type', 'email');
    // Beim Anlegen kein Schalter "Konto aktiv" (neue Konten sind aktiv, wie in der App).
    expect(within(d).queryByRole('switch', { name: 'Konto aktiv' })).toBeNull();
  });

  it('Rollen wie in der App: Gemeindeleitung, Leitung, Teamer:in -- nie Konfi oder Super-Admin; keine vorgewählt; darunter, was die Rolle darf', async () => {
    const d = await anlegen();
    expect(optionen(rolle(d))).toEqual(['Bitte wählen', 'Gemeindeleitung', 'Leitung', 'Teamer:in']);
    expect(rolle(d).value).toBe('0');
    expect(rolle(d)).toHaveAttribute('aria-required', 'true');
    expect(rolle(d)).not.toHaveAccessibleDescription();
    rolleWaehlen(d, 2);
    expect(rolle(d).value).toBe('2');
    expect(rolle(d)).toHaveAccessibleDescription('Voller Zugriff auf Konfis, Aktivitäten, Badges und Events – nur für die zugewiesenen Jahrgänge.');
    // Gewaehlt: "Bitte wählen" verschwindet.
    expect(optionen(rolle(d))).toEqual(['Gemeindeleitung', 'Leitung', 'Teamer:in']);
  });

  it('Prüfung mit Meldung: ohne Benutzername, ohne Anzeigename, ohne Passwort wird nichts gesendet', async () => {
    const d = await anlegen();
    await klicken(knopf(d, 'Anlegen'));
    expect(h.setError).toHaveBeenLastCalledWith('Benutzername ist erforderlich');
    tippen(d, 'Benutzername', 'kim.neu');
    await klicken(knopf(d, 'Anlegen'));
    expect(h.setError).toHaveBeenLastCalledWith('Anzeigename und Rolle sind erforderlich');
    tippen(d, 'Anzeigename', 'Kim Neu');
    rolleWaehlen(d, 3);
    await klicken(knopf(d, 'Anlegen'));
    expect(h.setError).toHaveBeenLastCalledWith('Passwort ist für neue Benutzer erforderlich');
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(dialog('Benutzer:in anlegen')).toBeInTheDocument();
  });

  it('Speichern: POST /users mit genau diesem Körper, dann die Jahrgänge mit den Rechten; Dialog zu, Liste neu', async () => {
    const d = await anlegen();
    tippen(d, 'Anzeigename', ' Kim Neu ');
    tippen(d, 'Benutzername', 'kim.neu');
    tippen(d, 'Funktionsbeschreibung', 'Diakonin');
    tippen(d, 'E-Mail', 'kim@example.org');
    tippen(d, 'Passwort', BEISPIELWERT);
    rolleWaehlen(d, 2);
    // Ein Jahrgang gewählt: seine Rechte stehen da, alle an (Vorgabe des Servers).
    fireEvent.click(jahrgang(d, '2027/28'));
    const rechte = within(d).getByRole('group', { name: 'Rechte für 2027/28' });
    expect(within(rechte).getAllByRole('switch').map((s) => [s.getAttribute('aria-checked'), (s as HTMLInputElement).labels![0].textContent]))
      .toEqual([['true', 'Anträge entscheiden'], ['true', 'Events verbuchen'], ['true', 'Challenge-Beiträge freigeben']]);
    fireEvent.click(schalter(rechte, 'Events verbuchen'));

    await klicken(knopf(d, 'Anlegen'));

    expect(h.apiPost).toHaveBeenNthCalledWith(1, '/users', {
      username: 'kim.neu', email: 'kim@example.org', display_name: 'Kim Neu', role_title: 'Diakonin', role_id: 2, is_active: true, password: BEISPIELWERT,
    });
    expect(h.apiPost).toHaveBeenNthCalledWith(2, '/users/77/jahrgaenge', {
      jahrgang_assignments: [{ jahrgang_id: 12, can_view: true, darf_antraege_entscheiden: true, darf_events_verbuchen: false, darf_challenges_freigeben: true }],
    });
    expect(h.apiPost).toHaveBeenCalledTimes(2);
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(h.setError).not.toHaveBeenCalled();
  });

  it('ein Fehler des Servers bleibt im Dialog und meldet sich mit dem Text des Servers', async () => {
    h.apiPost.mockRejectedValueOnce({ response: { status: 409, data: { error: 'Benutzername bereits vergeben' } } });
    const d = await anlegen();
    tippen(d, 'Anzeigename', 'Kim Neu');
    tippen(d, 'Benutzername', 'kim.neu');
    tippen(d, 'Passwort', BEISPIELWERT);
    rolleWaehlen(d, 3);
    await klicken(knopf(d, 'Anlegen'));
    expect(h.setError).toHaveBeenCalledWith('Benutzername bereits vergeben');
    expect(dialog('Benutzer:in anlegen')).toBeInTheDocument();
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('Abbrechen, Schließen und Escape senden nichts', async () => {
    const d = await anlegen();
    tippen(d, 'Anzeigename', 'Kim Neu');
    fireEvent.click(knopf(d, 'Abbrechen'));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Benutzer:in anlegen' }));
    fireEvent.keyDown(dialog('Benutzer:in anlegen'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('ohne Netz: Hinweis, „Anlegen“ gesperrt, und auch Enter im Feld sendet nichts', async () => {
    h.online = false;
    const d = await anlegen();
    expect(within(d).getByText('Du bist offline. Speichern geht erst wieder mit Internetverbindung.')).toBeInTheDocument();
    tippen(d, 'Anzeigename', 'Kim Neu');
    tippen(d, 'Benutzername', 'kim.neu');
    tippen(d, 'Passwort', BEISPIELWERT);
    rolleWaehlen(d, 3);
    expect(knopf(d, 'Anlegen')).toBeDisabled();
    await act(async () => { fireEvent.submit(d.querySelector('form')!); });
    expect(h.setError).toHaveBeenCalledWith(OFFLINE_AKTION_MELDUNG);
    expect(h.apiPost).not.toHaveBeenCalled();
  });
});

describe('Benutzer:in bearbeiten', () => {
  it('Vorbelegung: Daten, Rolle, Konto aktiv, Jahrgang mit Zuweisung (wann, von wem) und den Rechten der Zuweisung', async () => {
    const d = await bearbeiten('Sam Muster');
    expect(feld(d, 'Benutzername').value).toBe('sam.muster');
    expect(feld(d, 'Funktionsbeschreibung').value).toBe('Diakon');
    expect(feld(d, 'E-Mail').value).toBe('sam@example.org');
    expect(feld(d, 'Passwort').value).toBe('');
    expect(feld(d, 'Passwort')).not.toHaveAttribute('aria-required');
    expect(feld(d, 'Passwort')).toHaveAccessibleDescription('Leer lassen, um es nicht zu ändern.');
    expect(rolle(d).value).toBe('2');
    expect(optionen(rolle(d))).toEqual(['Gemeindeleitung', 'Leitung', 'Teamer:in']);
    expect(schalter(d, 'Konto aktiv').checked).toBe(true);
    expect(schalter(d, 'Konto aktiv')).toHaveAccessibleDescription('Benutzer kann sich anmelden');
    expect(jahrgang(d, '2026/27').checked).toBe(true);
    expect(jahrgang(d, '2026/27').closest('label')).toHaveTextContent('Zugewiesen am 01.09.2026 von Alex Beispiel');
    expect(jahrgang(d, '2027/28').checked).toBe(false);
    const rechte = within(d).getByRole('group', { name: 'Rechte für 2026/27' });
    expect(schalter(rechte, 'Anträge entscheiden').checked).toBe(true);
    expect(schalter(rechte, 'Events verbuchen').checked).toBe(false);
    expect(schalter(rechte, 'Challenge-Beiträge freigeben').checked).toBe(true);
    expect(within(d).queryByRole('group', { name: 'Rechte für 2027/28' })).toBeNull();
  });

  it('Speichern: PUT /users/3 ohne Passwort, dann die Jahrgänge -- ein abgewählter fehlt', async () => {
    const d = await bearbeiten('Sam Muster');
    tippen(d, 'Anzeigename', 'Sam Muster-Neu');
    fireEvent.click(schalter(d, 'Konto aktiv'));
    fireEvent.click(jahrgang(d, '2026/27'));
    fireEvent.click(jahrgang(d, '2027/28'));
    await klicken(knopf(d, 'Speichern'));
    expect(h.apiPut).toHaveBeenCalledWith('/users/3', {
      username: 'sam.muster', email: 'sam@example.org', display_name: 'Sam Muster-Neu', role_title: 'Diakon', role_id: 2, is_active: false,
    });
    expect(h.apiPost).toHaveBeenCalledWith('/users/3/jahrgaenge', {
      jahrgang_assignments: [{ jahrgang_id: 12, can_view: true, darf_antraege_entscheiden: true, darf_events_verbuchen: true, darf_challenges_freigeben: true }],
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it('weitere Gemeinde: Name, Benutzername und E-Mail gesperrt; gespeichert werden nur Rolle, Funktion, Sperre und das Passwort', async () => {
    const d = await bearbeiten('Gast Beispiel');
    expect(within(d).getByText(/Diese Person ist in einer anderen Gemeinde zuhause\./)).toBeInTheDocument();
    for (const name of ['Anzeigename', 'Benutzername', 'E-Mail']) expect(feld(d, name)).toBeDisabled();
    for (const name of ['Funktionsbeschreibung', 'Passwort']) expect(feld(d, name)).toBeEnabled();
    expect(schalter(d, 'Konto aktiv')).toHaveAccessibleDescription('Gilt nur für diese Gemeinde');
    tippen(d, 'Funktionsbeschreibung', 'Jugendleiterin');
    tippen(d, 'Passwort', BEISPIELWERT);
    await klicken(knopf(d, 'Speichern'));
    expect(h.apiPut).toHaveBeenCalledWith('/users/5', { role_id: 3, role_title: 'Jugendleiterin', is_active: true, password: BEISPIELWERT });
  });
});

describe('Benutzer:in: Rechte wie in der App', () => {
  it('die Leitung vergibt nur „Teamer:in“, sieht nur ihre Jahrgänge und keine Rechte-Schalter', async () => {
    h.user = konto('admin', [11]);
    const d = await bearbeiten('Robin Probe');
    expect(optionen(rolle(d))).toEqual(['Teamer:in']);
    expect(rolle(d).value).toBe('3');
    expect(within(d).getAllByRole('checkbox').map((c) => (c as HTMLInputElement).value)).toEqual(['11']);
    expect(within(d).queryByRole('group', { name: /^Rechte für/ })).toBeNull();
    await klicken(knopf(d, 'Speichern'));
    // Ohne die Rechte-Felder: der Server behält ihre Werte (er weist sie von der Leitung mit 403 ab).
    expect(h.apiPost).toHaveBeenCalledWith('/users/6/jahrgaenge', { jahrgang_assignments: [{ jahrgang_id: 11, can_view: true }] });
  });

  it('eine Leitung ohne eigenen Jahrgang liest, warum die Liste leer ist', async () => {
    h.user = konto('admin', []);
    const d = await bearbeiten('Robin Probe');
    expect(within(d).getByRole('group', { name: 'Zugewiesene Jahrgänge' }))
      .toHaveTextContent('Dir ist kein Jahrgang zugewiesen. Zuweisen kann nur die Gemeindeleitung.');
    // Die bestehende Zuweisung steht trotzdem da -- sie bleibt, wie sie ist.
    expect(within(d).getByText('Außerdem zugewiesen: 2026/27')).toBeInTheDocument();
  });

  it('die Gemeindeleitung vergibt an eine Teamer:in nur „Challenge-Beiträge freigeben“', async () => {
    const d = await bearbeiten('Robin Probe');
    const rechte = within(d).getByRole('group', { name: 'Rechte für 2026/27' });
    expect(within(rechte).getAllByRole('switch').map((s) => (s as HTMLInputElement).labels![0].textContent)).toEqual(['Challenge-Beiträge freigeben']);
    fireEvent.click(schalter(rechte, 'Challenge-Beiträge freigeben'));
    await klicken(knopf(d, 'Speichern'));
    expect(h.apiPost).toHaveBeenCalledWith('/users/6/jahrgaenge', { jahrgang_assignments: [{ jahrgang_id: 11, can_view: true, darf_challenges_freigeben: false }] });
  });
});
