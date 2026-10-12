// Jahrgang anlegen und bearbeiten im Browser als eigener Dialog (Simon,
// 11.10.2026: „Web braucht eigene kompaktere Modale überall"), gerendert:
// die echte Seite (AdminJahrgaengeePage), der echte Dialog (WebJahrgangDialog)
// und die echte Logik (useJahrgangFormular, dieselbe wie im Fenster der App).
// Gemockt sind nur Server, Netzstand, Warteschlange, Kontext, das breite
// Layout und Ionic.
//
// Meldungen stehen im Browser IM Dialog (role="alert"): Die Meldung oben (ein
// IonToast in <ion-app>) laege unter dem abgedunkelten Grund des Dialogs
// (Gegenpruefung 11.10.2026). Das Fenster der App meldet weiter oben.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  enqueue: vi.fn(),
  refresh: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  breit: true,
  online: true,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => ({
  ...(await (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand)),
  // Das Fenster der App (JahrgangModal) zeigt die Punkteziele als Regler.
  IonRange: () => null,
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, put: h.apiPut, delete: h.apiDelete } }));
vi.mock('../../../services/networkMonitor', () => ({ networkMonitor: { get isOnline() { return h.online; } } }));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: h.enqueue } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({ data: JAHRGAENGE, loading: false, refresh: h.refresh, refreshLive: vi.fn() }),
}));

import AdminJahrgaengeePage from '../../../components/admin/pages/AdminJahrgaengeePage';

const JAHRGAENGE = [
  { id: 12, name: 'Jahrgang 2027', created_at: '2026-01-01T10:00:00Z', gottesdienst_enabled: true, gemeinde_enabled: true, target_gottesdienst: 10, target_gemeinde: 8, konfspruch_enabled: true, konfi_count: 18 },
  { id: 11, name: 'Jahrgang 2026', created_at: '2025-01-01T10:00:00Z', gottesdienst_enabled: true, gemeinde_enabled: false, target_gottesdienst: 12, konfspruch_enabled: false, konfi_count: 21 },
];

const PERSONEN = [
  { id: 21, display_name: 'Anna Admin', role_name: 'admin' },
  { id: 22, display_name: 'Tom Teamer', role_name: 'teamer' },
  { id: 23, display_name: 'Kim Konfi', role_name: 'konfi' },
  { id: 24, display_name: 'Olga Org', role_name: 'org_admin' },
];

beforeEach(() => {
  vi.clearAllMocks();
  // Auch die Einmal-Antworten (mockRejectedValueOnce) eines vorigen Tests weg.
  h.apiPost.mockReset();
  h.apiPut.mockReset();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.online = true;
  h.user = konto('org_admin');
  h.apiGet.mockImplementation(async (url: string) => {
    if (url === '/users') return { data: PERSONEN };
    throw new Error(`nicht vorgesehen: ${url}`);
  });
  h.apiPost.mockResolvedValue({ data: { id: 30 } });
  h.apiPut.mockResolvedValue({ data: {} });
  h.enqueue.mockResolvedValue(undefined);
});

const dialog = (name: string) => screen.getByRole('dialog', { name });
const feld = (d: HTMLElement, name: string) => within(d).getByLabelText(name) as HTMLInputElement;
const auswahl = (d: HTMLElement, name: string) => within(d).getByRole('combobox', { name }) as HTMLSelectElement;
const schalter = (d: HTMLElement, name: string) => within(d).getByRole('switch', { name }) as HTMLInputElement;
const knopf = (d: HTMLElement, name: string) => within(d).getByRole('button', { name }) as HTMLButtonElement;
const klicken = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };
/** Der Text der Meldung im Dialog (role="alert"). */
const meldung = (d: HTMLElement) => within(d).getByRole('alert').textContent;

const neuerJahrgang = async () => {
  render(<AdminJahrgaengeePage />);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Neuer Jahrgang' })); });
  return dialog('Neuer Jahrgang');
};
const bearbeiten = (name: string) => {
  render(<AdminJahrgaengeePage />);
  fireEvent.click(screen.getAllByRole('button', { name: `${name} bearbeiten` })[0]);
  return dialog('Jahrgang bearbeiten');
};

describe('Jahrgang im Browser: Umschaltung', () => {
  it('breit: „Neuer Jahrgang“ und Bearbeiten öffnen den Web-Dialog, nicht das Fenster der App', async () => {
    const d = await neuerJahrgang();
    expect(d).toHaveAttribute('aria-modal', 'true');
    fireEvent.click(knopf(d, 'Abbrechen'));
    bearbeiten('Jahrgang 2026');
    expect(h.stand.fenster).toEqual([]);
  });

  it('schmal: das Plus öffnet weiter das Fenster der App (JahrgangModal) -- kein Web-Dialog', () => {
    h.breit = false;
    render(<AdminJahrgaengeePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neuen Jahrgang anlegen' }));
    expect(h.stand.fenster).toHaveLength(1);
    expect((h.stand.fenster[0].komponente as { name: string }).name).toBe('JahrgangModal');
    expect(h.stand.fenster[0].props.jahrgang).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('das Fenster der App meldet einen Fehler weiter oben (setError), nicht im Fenster', async () => {
    h.breit = false;
    h.apiPost.mockRejectedValueOnce(new Error('Network Error'));
    render(<AdminJahrgaengeePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neuen Jahrgang anlegen' }));
    const { komponente, props } = h.stand.fenster[0];
    await act(async () => { render(React.createElement(komponente as React.FC<Record<string, unknown>>, props)); });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jahrgang 2028' } });
    await klicken(screen.getByRole('button', { name: 'Jahrgang speichern' }));
    expect(h.apiPost).toHaveBeenCalledWith('/admin/jahrgaenge', expect.objectContaining({ name: 'Jahrgang 2028' }));
    expect(h.setError).toHaveBeenCalledWith('Fehler beim Speichern des Jahrgangs');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Neuer Jahrgang (Gemeindeleitung)', () => {
  it('Felder mit Namen und Vorgaben: Name leer, beide Punktearten an mit Ziel 10 (1 bis 20), Konfispruch frei', async () => {
    const d = await neuerJahrgang();
    expect(feld(d, 'Name').value).toBe('');
    expect(feld(d, 'Name')).toHaveAttribute('aria-required', 'true');
    expect(d).toHaveAccessibleDescription('Hier steuerst du diesen Jahrgang zentral: Punkteziele und die Freischaltung der Konfispruch-Auswahl.');
    expect(schalter(d, 'Gottesdienst-Punkte aktiviert').checked).toBe(true);
    expect(schalter(d, 'Gemeinde-Punkte aktiviert').checked).toBe(true);
    expect(auswahl(d, 'Ziel Gottesdienst').value).toBe('10');
    expect(auswahl(d, 'Ziel Gemeinde').value).toBe('10');
    expect([...auswahl(d, 'Ziel Gemeinde').options].map((o) => o.value)).toEqual(Array.from({ length: 20 }, (_, i) => String(i + 1)));
    expect(schalter(d, 'Konfispruch-Auswahl').checked).toBe(true);
    expect(schalter(d, 'Konfispruch-Auswahl')).toHaveAccessibleDescription('Konfis dieses Jahrgangs können ihren Konfispruch wählen.');
  });

  it('Zugriff für Leitung & Team: nur Leitung und Team stehen zur Wahl, mit ihrer Rolle', async () => {
    const d = await neuerJahrgang();
    const gruppe = within(d).getByRole('group', { name: 'Personen mit Zugriff' });
    expect(within(gruppe).getAllByRole('checkbox').map((c) => c.closest('label')!.textContent)).toEqual(['Anna AdminLeitung', 'Tom TeamerTeamer:in']);
    expect(h.apiGet).toHaveBeenCalledWith('/users');
  });

  it('Prüfung mit Meldung im Dialog: ohne Namen wird nichts gesendet; die nächste Eingabe räumt sie weg', async () => {
    const d = await neuerJahrgang();
    expect(within(d).queryByRole('alert')).toBeNull();
    tippenName(d, '   ');
    await klicken(knopf(d, 'Anlegen'));
    expect(meldung(d)).toBe('Name ist erforderlich');
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(dialog('Neuer Jahrgang')).toBeInTheDocument();
    tippenName(d, 'Jahrgang 2028');
    expect(within(d).queryByRole('alert')).toBeNull();
  });

  it('ein Fehler des Servers bleibt im Dialog, mit dem Text des Servers bzw. dem Ersatztext', async () => {
    h.apiPost
      .mockRejectedValueOnce({ response: { status: 409, data: { error: 'Ein Jahrgang mit diesem Namen existiert bereits' } } })
      .mockRejectedValueOnce(new Error('Network Error'));
    const d = await neuerJahrgang();
    tippenName(d, 'Jahrgang 2026');
    await klicken(knopf(d, 'Anlegen'));
    expect(meldung(d)).toBe('Ein Jahrgang mit diesem Namen existiert bereits');
    await klicken(knopf(d, 'Anlegen'));
    expect(meldung(d)).toBe('Fehler beim Speichern des Jahrgangs');
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.apiPost).toHaveBeenCalledTimes(2);
    // Anlegen reiht nach einem Abbruch nicht ein (sonst entstuende er womöglich doppelt).
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(dialog('Neuer Jahrgang')).toBeInTheDocument();
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('mindestens eine Punkteart bleibt an: Gemeinde aus sperrt den Gottesdienst-Schalter und sagt warum', async () => {
    const d = await neuerJahrgang();
    fireEvent.click(schalter(d, 'Gemeinde-Punkte aktiviert'));
    expect(within(d).queryByRole('combobox', { name: 'Ziel Gemeinde' })).toBeNull();
    expect(schalter(d, 'Gottesdienst-Punkte aktiviert')).toBeDisabled();
    expect(schalter(d, 'Gottesdienst-Punkte aktiviert')).toHaveAccessibleDescription('Mindestens ein Punkt-Typ muss aktiv bleiben.');
  });

  it('Speichern: POST /admin/jahrgaenge mit genau diesem Körper; Dialog zu, Liste neu', async () => {
    const d = await neuerJahrgang();
    tippenName(d, ' Jahrgang 2028 ');
    fireEvent.change(auswahl(d, 'Ziel Gottesdienst'), { target: { value: '12' } });
    fireEvent.click(schalter(d, 'Gemeinde-Punkte aktiviert'));
    fireEvent.click(schalter(d, 'Konfispruch-Auswahl'));
    fireEvent.click(within(d).getByRole('checkbox', { name: /^Tom Teamer/ }));
    await klicken(knopf(d, 'Anlegen'));
    expect(h.apiPost).toHaveBeenCalledTimes(1);
    expect(h.apiPost).toHaveBeenCalledWith('/admin/jahrgaenge', {
      name: 'Jahrgang 2028',
      gottesdienst_enabled: true,
      gemeinde_enabled: false,
      target_gottesdienst: 12,
      target_gemeinde: 10,
      konfspruch_enabled: false,
      user_assignments: [{ user_id: 22, can_view: true }],
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it('solange gespeichert wird, schließt nichts den Dialog (wie „Schließen“ in der App); lehnt der Server dann ab, steht seine Meldung im Dialog', async () => {
    // Vorher ließ sich der Dialog beim Speichern schließen: Der Jahrgang
    // entstand trotzdem, und eine Ablehnung des Servers ging ins Leere.
    let ablehnen: (grund: unknown) => void = () => {};
    h.apiPost.mockReturnValueOnce(new Promise((_ok, nein) => { ablehnen = nein; }));
    const d = await neuerJahrgang();
    tippenName(d, 'Jahrgang 2028');
    await klicken(knopf(d, 'Anlegen'));
    expect(h.apiPost).toHaveBeenCalledTimes(1);

    expect([knopf(d, 'Abbrechen'), knopf(d, 'Schließen'), knopf(d, 'Anlegen')].map((k) => k.disabled)).toEqual([true, true, true]);
    fireEvent.click(knopf(d, 'Abbrechen'));
    fireEvent.click(knopf(d, 'Schließen'));
    fireEvent.keyDown(d, { key: 'Escape' });
    fireEvent.mouseDown(d.parentElement as HTMLElement);
    expect(dialog('Neuer Jahrgang')).toBe(d);

    await act(async () => { ablehnen({ response: { status: 409, data: { error: 'Ein Jahrgang mit diesem Namen existiert bereits' } } }); });
    expect(meldung(d)).toBe('Ein Jahrgang mit diesem Namen existiert bereits');
    expect(h.refresh).not.toHaveBeenCalled();
    // Danach lässt er sich wieder schließen.
    expect(knopf(d, 'Abbrechen')).toBeEnabled();
    fireEvent.keyDown(d, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Abbrechen und Escape senden nichts', async () => {
    const d = await neuerJahrgang();
    tippenName(d, 'Jahrgang 2028');
    fireEvent.click(knopf(d, 'Abbrechen'));
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Neuer Jahrgang' })); });
    fireEvent.keyDown(dialog('Neuer Jahrgang'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.refresh).not.toHaveBeenCalled();
  });
});

describe('Jahrgang bearbeiten', () => {
  it('Vorbelegung aus dem Jahrgang; ohne Gemeinde-Punkte kein Ziel Gemeinde; keine Personenwahl, keine Personenabfrage', () => {
    const d = bearbeiten('Jahrgang 2026');
    expect(feld(d, 'Name').value).toBe('Jahrgang 2026');
    expect(schalter(d, 'Gottesdienst-Punkte aktiviert').checked).toBe(true);
    expect(schalter(d, 'Gottesdienst-Punkte aktiviert')).toBeDisabled();
    expect(schalter(d, 'Gottesdienst-Punkte aktiviert'))
      .toHaveAccessibleDescription('Mindestens ein Punkt-Typ muss aktiv bleiben. 21 Konfis haben bereits Gottesdienst-Punkte.');
    expect(auswahl(d, 'Ziel Gottesdienst').value).toBe('12');
    expect(schalter(d, 'Gemeinde-Punkte aktiviert').checked).toBe(false);
    expect(within(d).queryByRole('combobox', { name: 'Ziel Gemeinde' })).toBeNull();
    expect(schalter(d, 'Konfispruch-Auswahl').checked).toBe(false);
    expect(within(d).queryByRole('group', { name: 'Personen mit Zugriff' })).toBeNull();
    expect(h.apiGet).not.toHaveBeenCalledWith('/users');
  });

  it('Speichern: PUT /admin/jahrgaenge/11 mit genau diesem Körper, ohne Zuweisung', async () => {
    const d = bearbeiten('Jahrgang 2026');
    tippenName(d, 'Jahrgang 2026/27');
    fireEvent.click(schalter(d, 'Gemeinde-Punkte aktiviert'));
    fireEvent.change(auswahl(d, 'Ziel Gemeinde'), { target: { value: '5' } });
    fireEvent.click(schalter(d, 'Konfispruch-Auswahl'));
    await klicken(knopf(d, 'Speichern'));
    expect(h.apiPut).toHaveBeenCalledWith('/admin/jahrgaenge/11', {
      name: 'Jahrgang 2026/27',
      gottesdienst_enabled: true,
      gemeinde_enabled: true,
      target_gottesdienst: 12,
      target_gemeinde: 5,
      konfspruch_enabled: true,
    });
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });

  it('ohne Netz wie in der App: Hinweis, Speichern reiht in die Warteschlange ein und meldet das', async () => {
    h.online = false;
    const d = bearbeiten('Jahrgang 2027');
    expect(within(d).getByText('Du bist offline. Der Jahrgang wird gespeichert, sobald du wieder online bist.')).toBeInTheDocument();
    expect(knopf(d, 'Speichern')).toBeEnabled();
    fireEvent.change(auswahl(d, 'Ziel Gemeinde'), { target: { value: '9' } });
    await klicken(knopf(d, 'Speichern'));
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(h.enqueue).toHaveBeenCalledWith({
      method: 'PUT',
      url: '/admin/jahrgaenge/12',
      body: { name: 'Jahrgang 2027', gottesdienst_enabled: true, gemeinde_enabled: true, target_gottesdienst: 10, target_gemeinde: 9, konfspruch_enabled: true },
      maxRetries: 5,
      hasFileUpload: false,
      metadata: { type: 'admin', clientId: expect.any(String), label: 'Jahrgang bearbeiten' },
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Wird gespeichert sobald du wieder online bist');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('die Leitung legt nicht an, bearbeitet ihre Jahrgänge aber im Web-Dialog', () => {
    h.user = konto('admin', [11]);
    render(<AdminJahrgaengeePage />);
    expect(screen.queryByRole('button', { name: 'Neuer Jahrgang' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Jahrgang 2026 bearbeiten' })[0]);
    expect(feld(dialog('Jahrgang bearbeiten'), 'Name').value).toBe('Jahrgang 2026');
    expect(h.stand.fenster).toEqual([]);
  });
});

function tippenName(d: HTMLElement, wert: string) {
  fireEvent.change(feld(d, 'Name'), { target: { value: wert } });
}
