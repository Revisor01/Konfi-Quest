// Struktur in der Web-Fassung (/admin/support/struktur), gerendert
// (docs/planung/support-web.md, Phase 2): je Landeskirche eine Karte mit
// ihren Kirchenkreisen als Tabelle samt Zahl der Gemeinden; Anlegen,
// Umbenennen und Zuordnen im Dialog, Loeschen mit der Rueckfrage der App --
// eine Landeskirche mit Kirchenkreisen nicht, das sagt die Seite vorher.
// Die Logik ist die der App (useStruktur). Im schmalen Fenster bleibt die
// Seite der App.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  push: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  alert: null as null | AlertOptionen,
  breit: true,
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  presentAlert: (o) => { h.alert = o; },
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, put: h.apiPut, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));

import SupportStrukturPage from '../../../components/support/SupportStrukturPage';

const LANDESKIRCHEN = [
  { id: 1, name: 'Nordkirche', kirchenkreise: [{ id: 11, name: 'Dithmarschen' }, { id: 12, name: 'Plön-Segeberg' }] },
  { id: 2, name: 'Hannover', kirchenkreise: [] },
];
const KREISE = [
  { id: 11, name: 'Dithmarschen', landeskirche_id: 1, landeskirche: 'Nordkirche', anzahl_gemeinden: 4 },
  { id: 12, name: 'Plön-Segeberg', landeskirche_id: 1, landeskirche: 'Nordkirche', anzahl_gemeinden: 2 },
  { id: 14, name: 'Mecklenburg', landeskirche_id: null, landeskirche: null, anzahl_gemeinden: 1 },
];

let landeskirchen: unknown;
let kreise: unknown;

beforeEach(() => {
  vi.clearAllMocks();
  for (const f of [h.apiGet, h.apiPost, h.apiPut, h.apiDelete]) f.mockReset();
  h.alert = null;
  h.breit = true;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  landeskirchen = LANDESKIRCHEN;
  kreise = KREISE;
  h.apiGet.mockImplementation((pfad: string) => {
    if (pfad === '/support/landeskirchen') return Promise.resolve({ data: landeskirchen });
    if (pfad === '/support/kirchenkreise') return Promise.resolve({ data: kreise });
    return Promise.reject(new Error(`unerwartet: ${pfad}`));
  });
  for (const f of [h.apiPost, h.apiPut, h.apiDelete]) f.mockResolvedValue({ data: {} });
});

const oeffnen = async () => {
  render(<SupportStrukturPage />);
  await screen.findByRole('heading', { level: 2, name: 'Nordkirche' });
};
const karte = (name: string) => screen.getByRole('heading', { level: 2, name }).closest('section') as HTMLElement;
const dialog = (name: string) => screen.getByRole('dialog', { name });
const tabelle = (name: string) => screen.getByRole('table', { name });
const zeilen = (name: string) => within(tabelle(name)).getAllByRole('row').slice(1);

describe('Struktur (Web): Anzeige', () => {
  it('je Landeskirche eine Karte mit Zahl der Kirchenkreise und Gemeinden; dazu die Kirchenkreise ohne Landeskirche', async () => {
    await oeffnen();
    expect(screen.getByRole('heading', { level: 1, name: 'Struktur' })).toBeInTheDocument();
    expect(karte('Nordkirche')).toHaveTextContent('2 Kirchenkreise · 6 Gemeinden');
    expect(karte('Hannover')).toHaveTextContent('0 Kirchenkreise · 0 Gemeinden');
    expect(karte('Kirchenkreise ohne Landeskirche')).toHaveTextContent('1 Kirchenkreis — ordne sie einer Landeskirche zu');
    expect([...document.querySelectorAll('h2.web-karte__titel')].map((t) => t.textContent)).toEqual(['Nordkirche', 'Hannover', 'Kirchenkreise ohne Landeskirche']);
  });

  it('die Kirchenkreise einer Landeskirche als Tabelle: Name und Zahl der Gemeinden', async () => {
    await oeffnen();
    const rows = zeilen('Kirchenkreise von Nordkirche').map((r) => within(r).getAllByRole('cell').map((c) => c.textContent?.replace(/\s+/g, ' ').trim()));
    expect(rows.map((r) => r.slice(0, 2))).toEqual([['Dithmarschen', '4'], ['Plön-Segeberg', '2']]);
    expect(zeilen('Kirchenkreise ohne Landeskirche').map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['Mecklenburg']);
    expect(within(tabelle('Kirchenkreise von Nordkirche')).getByRole('columnheader', { name: 'Gemeinden' })).toBeInTheDocument();
  });

  it('eine Landeskirche ohne Kirchenkreise sagt es', async () => {
    await oeffnen();
    expect(within(karte('Hannover')).getByText('Noch keine Kirchenkreise.')).toBeInTheDocument();
    expect(within(karte('Hannover')).queryByRole('table')).toBeNull();
  });

  it('ein aelterer Server liefert keine Zahl: Striche statt falscher Nullen, und die Summe wird nicht geraten', async () => {
    kreise = KREISE.map(({ anzahl_gemeinden: _weg, ...rest }) => rest);
    await oeffnen();
    expect(karte('Nordkirche').querySelector('.web-karte__untertitel')!.textContent).toBe('2 Kirchenkreise');
    expect(zeilen('Kirchenkreise von Nordkirche').map((r) => within(r).getAllByRole('cell')[1].textContent)).toEqual(['–', '–']);
  });

  it('ein Kirchenkreis ohne Gemeinden zeigt 0 -- das ist eine Zahl, kein fehlender Wert', async () => {
    kreise = KREISE.map((k) => (k.id === 12 ? { ...k, anzahl_gemeinden: 0 } : k));
    await oeffnen();
    expect(zeilen('Kirchenkreise von Nordkirche').map((r) => within(r).getAllByRole('cell')[1].textContent)).toEqual(['4', '0']);
    expect(karte('Nordkirche')).toHaveTextContent('2 Kirchenkreise · 4 Gemeinden');
  });

  it('nichts angelegt: Hinweis mit Weg zum Anlegen', async () => {
    landeskirchen = [];
    kreise = [];
    render(<SupportStrukturPage />);
    expect(await screen.findByText('Noch keine Landeskirchen und Kirchenkreise')).toBeInTheDocument();
    fireEvent.click(within(document.querySelector('.web-leer') as HTMLElement).getByRole('button', { name: 'Landeskirche anlegen' }));
    expect(dialog('Landeskirche anlegen')).toBeInTheDocument();
  });

  it('Fehler beim Laden: Hinweis mit erneutem Versuch', async () => {
    h.apiGet.mockImplementationOnce(() => Promise.reject(new Error('Netz weg')));
    render(<SupportStrukturPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Landeskirchen und Kirchenkreise konnten nicht geladen werden.');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    expect(await screen.findByRole('heading', { level: 2, name: 'Nordkirche' })).toBeInTheDocument();
  });
});

describe('Struktur (Web): anlegen im Dialog', () => {
  it('Landeskirche anlegen: Dialog, Name, schickt den Namen, laedt neu, schliesst', async () => {
    await oeffnen();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Landeskirche anlegen' }));
    const d = dialog('Landeskirche anlegen');
    expect(within(d).getByRole('button', { name: 'Anlegen' })).toBeDisabled();
    fireEvent.change(within(d).getByLabelText('Name der Landeskirche'), { target: { value: '  Bayern ' } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Anlegen' })); });
    expect(h.apiPost).toHaveBeenCalledWith('/support/landeskirchen', { name: 'Bayern' });
    expect(h.setSuccess).toHaveBeenCalledWith('Landeskirche angelegt');
    expect(h.apiGet.mock.calls.filter(([p]) => p === '/support/landeskirchen')).toHaveLength(2);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Enter im Feld legt an, wie der Knopf', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Landeskirche anlegen' }));
    const feld = within(dialog('Landeskirche anlegen')).getByLabelText('Name der Landeskirche');
    fireEvent.change(feld, { target: { value: 'Bayern' } });
    await act(async () => { fireEvent.submit(feld.closest('form')!); });
    expect(h.apiPost).toHaveBeenCalledWith('/support/landeskirchen', { name: 'Bayern' });
  });

  it('ein Fehler des Servers kommt als Meldung; der Dialog bleibt mit der Eingabe offen', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Landeskirche anlegen' }));
    h.apiPost.mockRejectedValue({ response: { status: 409, data: { error: 'Diese Landeskirche gibt es schon' } } });
    fireEvent.change(within(dialog('Landeskirche anlegen')).getByLabelText('Name der Landeskirche'), { target: { value: 'Nordkirche' } });
    await act(async () => { fireEvent.click(within(dialog('Landeskirche anlegen')).getByRole('button', { name: 'Anlegen' })); });
    expect(h.setError).toHaveBeenCalledWith('Diese Landeskirche gibt es schon');
    expect(h.setSuccess).not.toHaveBeenCalled();
    expect((within(dialog('Landeskirche anlegen')).getByLabelText('Name der Landeskirche') as HTMLInputElement).value).toBe('Nordkirche');
  });

  it('Kirchenkreis anlegen mit Landeskirche; ohne Wahl geht null an den Server', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Kirchenkreis anlegen' }));
    let d = dialog('Kirchenkreis anlegen');
    fireEvent.change(within(d).getByLabelText('Name des Kirchenkreises'), { target: { value: 'Steinburg' } });
    fireEvent.change(within(d).getByLabelText('Landeskirche'), { target: { value: '1' } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Anlegen' })); });
    expect(h.apiPost).toHaveBeenCalledWith('/support/kirchenkreise', { name: 'Steinburg', landeskirche_id: 1 });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Kirchenkreis anlegen' }));
    d = dialog('Kirchenkreis anlegen');
    // Der vorige Name ist weg; die Landeskirche steht wieder auf "ohne".
    expect((within(d).getByLabelText('Name des Kirchenkreises') as HTMLInputElement).value).toBe('');
    expect((within(d).getByLabelText('Landeskirche') as HTMLSelectElement).value).toBe('ohne');
    fireEvent.change(within(d).getByLabelText('Name des Kirchenkreises'), { target: { value: 'Rendsburg' } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Anlegen' })); });
    expect(h.apiPost).toHaveBeenLastCalledWith('/support/kirchenkreise', { name: 'Rendsburg', landeskirche_id: null });
  });

  it('Abbrechen und Escape schliessen ohne Aufruf und verwerfen die Eingabe', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Landeskirche anlegen' }));
    fireEvent.change(within(dialog('Landeskirche anlegen')).getByLabelText('Name der Landeskirche'), { target: { value: 'Halb' } });
    fireEvent.click(within(dialog('Landeskirche anlegen')).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Landeskirche anlegen' }));
    expect((within(dialog('Landeskirche anlegen')).getByLabelText('Name der Landeskirche') as HTMLInputElement).value).toBe('');
    fireEvent.keyDown(dialog('Landeskirche anlegen'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.apiPost).not.toHaveBeenCalled();
  });
});

describe('Struktur (Web): umbenennen und zuordnen im Dialog', () => {
  it('Landeskirche umbenennen: Name vorbelegt, PUT, Dialog schliesst', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Nordkirche umbenennen' }));
    const d = dialog('Landeskirche umbenennen');
    expect((within(d).getByLabelText('Name der Landeskirche') as HTMLInputElement).value).toBe('Nordkirche');
    fireEvent.change(within(d).getByLabelText('Name der Landeskirche'), { target: { value: 'Ev.-Luth. Kirche in Norddeutschland' } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Speichern' })); });
    expect(h.apiPut).toHaveBeenCalledWith('/support/landeskirchen/1', { name: 'Ev.-Luth. Kirche in Norddeutschland' });
    expect(h.setSuccess).toHaveBeenCalledWith('Landeskirche gespeichert');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('einen Kirchenkreis ohne Landeskirche einer Landeskirche zuordnen', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Mecklenburg bearbeiten' }));
    const d = dialog('Kirchenkreis bearbeiten');
    expect((within(d).getByLabelText('Landeskirche') as HTMLSelectElement).value).toBe('ohne');
    expect([...(within(d).getByLabelText('Landeskirche') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Ohne Landeskirche', 'Nordkirche', 'Hannover']);
    fireEvent.change(within(d).getByLabelText('Landeskirche'), { target: { value: '1' } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Speichern' })); });
    expect(h.apiPut).toHaveBeenCalledWith('/support/kirchenkreise/14', { name: 'Mecklenburg', landeskirche_id: 1 });
    expect(h.setSuccess).toHaveBeenCalledWith('Kirchenkreis gespeichert');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('einen Kirchenkreis von seiner Landeskirche loesen', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Dithmarschen bearbeiten' }));
    const d = dialog('Kirchenkreis bearbeiten');
    expect((within(d).getByLabelText('Landeskirche') as HTMLSelectElement).value).toBe('1');
    fireEvent.change(within(d).getByLabelText('Landeskirche'), { target: { value: 'ohne' } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Speichern' })); });
    expect(h.apiPut).toHaveBeenCalledWith('/support/kirchenkreise/11', { name: 'Dithmarschen', landeskirche_id: null });
  });

  it('leerer Name wird nicht gespeichert; der Dialog bleibt offen', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Dithmarschen bearbeiten' }));
    const d = dialog('Kirchenkreis bearbeiten');
    fireEvent.change(within(d).getByLabelText('Name des Kirchenkreises'), { target: { value: '  ' } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Speichern' })); });
    expect(h.setError).toHaveBeenCalledWith('Bitte einen Namen eingeben');
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(dialog('Kirchenkreis bearbeiten')).toBeInTheDocument();
  });
});

describe('Struktur (Web): loeschen', () => {
  it('eine Landeskirche mit Kirchenkreisen: Erklaerung statt Loeschen', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Nordkirche löschen' }));
    expect(h.alert?.header).toBe('Landeskirche nicht löschbar');
    expect(h.alert?.message).toBe('An „Nordkirche“ hängen noch 2 Kirchenkreise. Ordne sie zuerst einer anderen Landeskirche zu oder lösche sie.');
    expect(h.alert?.buttons?.map((b) => b.text)).toEqual(['Verstanden']);
    expect(h.apiDelete).not.toHaveBeenCalled();
  });

  it('eine leere Landeskirche: Rueckfrage, dann DELETE', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Hannover löschen' }));
    expect(h.alert?.header).toBe('Landeskirche löschen');
    expect(h.apiDelete).not.toHaveBeenCalled();
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Löschen')?.handler?.(); });
    await waitFor(() => expect(h.apiDelete).toHaveBeenCalledWith('/support/landeskirchen/2'));
  });

  it('einen Kirchenkreis: die Rueckfrage sagt, dass Gemeinden nur die Zuordnung verlieren', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Dithmarschen löschen' }));
    expect(h.alert?.message).toContain('Gemeinden in diesem Kirchenkreis verlieren nur die Zuordnung');
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Löschen')?.handler?.(); });
    await waitFor(() => expect(h.apiDelete).toHaveBeenCalledWith('/support/kirchenkreise/11'));
    expect(h.setSuccess).toHaveBeenCalledWith('Kirchenkreis gelöscht');
  });
});

describe('Struktur: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die App-Darstellung -- mit derselben Logik', async () => {
    h.breit = false;
    render(<SupportStrukturPage />);
    await screen.findByText('Dithmarschen');
    expect(document.querySelector('.web-seite')).toBeNull();
    expect(screen.getByLabelText('Neue Landeskirche')).toBeInTheDocument();
  });

  it('ohne Super-Admin-Recht: Hinweis, kein Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportStrukturPage />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});

describe('Struktur (Web): sortieren nach Spalte', () => {
  it('Klick auf "Gemeinden" ordnet die Kirchenkreise einer Landeskirche nach Zahl, der zweite Klick dreht', async () => {
    await oeffnen();
    const namen = () => zeilen('Kirchenkreise von Nordkirche').map((r) => within(r).getAllByRole('cell')[0].textContent);
    const kopf = () => within(tabelle('Kirchenkreise von Nordkirche')).getByRole('columnheader', { name: 'Gemeinden' });
    expect(namen()).toEqual(['Dithmarschen', 'Plön-Segeberg']);
    fireEvent.click(within(kopf()).getByRole('button'));
    expect(namen()).toEqual(['Plön-Segeberg', 'Dithmarschen']);
    expect(kopf()).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(within(kopf()).getByRole('button'));
    expect(namen()).toEqual(['Dithmarschen', 'Plön-Segeberg']);
    expect(kopf()).toHaveAttribute('aria-sort', 'descending');
    // Jede Tabelle sortiert für sich: die andere bleibt unberührt.
    expect(within(tabelle('Kirchenkreise ohne Landeskirche')).getByRole('columnheader', { name: 'Gemeinden' })).toHaveAttribute('aria-sort', 'none');
  });
});
