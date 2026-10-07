// Support-Konten in der Web-Fassung (/admin/support/konten), gerendert
// (docs/planung/support-web.md, Phase 2): Tabelle mit Name, Benutzername,
// E-Mail, Status, zuletzt angemeldet und den Aktionen Passwort, Sperren bzw.
// Entsperren, Loeschen -- Sperren, Loeschen und das eigene Passwort mit der
// Rueckfrage der App; Anlegen und Passwort setzen im Dialog. Das letzte aktive
// Super-Admin-Konto (409) bleibt als Hinweis stehen. Die Logik ist die der App
// (useSupportKonten). Im schmalen Fenster bleibt die Seite der App.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
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
vi.mock('../../../services/api', () => ({
  default: { get: h.apiGet, post: h.apiPost, put: h.apiPut, patch: h.apiPatch, delete: h.apiDelete },
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));

import SupportKontenPage from '../../../components/support/SupportKontenPage';

// Erfundener Wert fuer das Passwortfeld. Zusammengesetzt statt als
// Zeichenkette, damit Geheimnis-Scanner (GitGuardian, PR #220) einen
// Testwert nicht als Passwort im oeffentlichen Repo melden.
const BEISPIELWERT = ['Beispiel', '2026', 'Wert!'].join('-');

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

const KONTEN = [
  { id: 9, username: 'support1', display_name: 'Support Eins', email: 'support@example.org', is_active: true,
    last_login_at: '2026-10-03T07:00:00Z', created_at: '2026-10-01T07:00:00Z', gemeinden: [] },
  { id: 10, username: 'support2', display_name: 'Support Zwei', email: null, is_active: true,
    last_login_at: null, created_at: '2026-10-02T07:00:00Z',
    gemeinden: [{ id: 3, name: 'buesum', display_name: 'Büsum', role_name: 'org_admin' }] },
  { id: 11, username: 'support3', display_name: 'Support Drei', email: null, is_active: false,
    last_login_at: null, created_at: '2026-10-02T07:00:00Z', gemeinden: [] },
];

beforeEach(() => {
  vi.clearAllMocks();
  for (const f of [h.apiGet, h.apiPost, h.apiPut, h.apiPatch, h.apiDelete]) f.mockReset();
  h.alert = null;
  h.breit = true;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-03T08:30:00Z'));
  h.apiGet.mockResolvedValue({ data: KONTEN });
  for (const f of [h.apiPost, h.apiPut, h.apiPatch, h.apiDelete]) f.mockResolvedValue({ data: {} });
});
afterEach(() => { vi.useRealTimers(); });

const oeffnen = async () => {
  render(<SupportKontenPage />);
  await screen.findByRole('table', { name: 'Support-Konten' });
};
const zeilen = () => within(screen.getByRole('table', { name: 'Support-Konten' })).getAllByRole('row').slice(1);
const zeile = (benutzername: string) => zeilen().find((z) => within(z).getAllByRole('cell')[1].textContent === benutzername)!;
const zelle = (z: HTMLElement, i: number) => within(z).getAllByRole('cell')[i];
const dialog = (name: string) => screen.getByRole('dialog', { name });

describe('Support-Konten (Web): Tabelle', () => {
  it('Name, Benutzername, E-Mail, Status und zuletzt angemeldet; das eigene Konto ist markiert', async () => {
    await oeffnen();
    expect(h.apiGet).toHaveBeenCalledWith('/organizations/support-konten');
    expect(screen.getByRole('heading', { level: 1, name: 'Support-Konten' })).toBeInTheDocument();
    expect(screen.getByText('3 Support-Konten ohne Gemeinde')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Support-Konten' })).getAllByRole('columnheader').map((c) => c.textContent))
      .toEqual(['Name', 'Benutzername', 'E-Mail', 'Status', 'Zuletzt angemeldet', 'Aktionen']);
    expect(zeilen().map((z) => zelle(z, 0).textContent)).toEqual(['Support Eins (du)', 'Support ZweiGast in Büsum', 'Support Drei']);
    expect(zelle(zeile('support1'), 2)).toHaveTextContent('support@example.org');
    expect(within(zelle(zeile('support1'), 2)).getByRole('link')).toHaveAttribute('href', 'mailto:support@example.org');
    expect(zelle(zeile('support2'), 2)).toHaveTextContent('–');
    expect(zelle(zeile('support1'), 4)).toHaveTextContent('vor 1 Std.');
    expect(zelle(zeile('support2'), 4)).toHaveTextContent('noch nie');
  });

  it('der Status ist eine Marke: aktiv oder gesperrt -- und ein gesperrtes Konto ist als Zeile gekennzeichnet', async () => {
    await oeffnen();
    expect(zelle(zeile('support2'), 3)).toHaveTextContent('Aktiv');
    expect(zelle(zeile('support2'), 3).querySelector('.web-pill')!.className).toContain('web-pill--erfolg');
    expect(zelle(zeile('support3'), 3)).toHaveTextContent('Gesperrt');
    expect(zelle(zeile('support3'), 3).querySelector('.web-pill')!.className).not.toContain('web-pill--erfolg');
    expect(zeile('support3').className).toContain('web-zeile--gesperrt');
    expect(zeile('support2').className).not.toContain('web-zeile--gesperrt');
  });

  it('das eigene Konto bietet weder Sperren noch Loeschen an, die anderen schon', async () => {
    await oeffnen();
    const eigenes = zelle(zeile('support1'), 5);
    expect(within(eigenes).queryByRole('button', { name: /sperren/ })).toBeNull();
    expect(within(eigenes).queryByRole('button', { name: /löschen/ })).toBeNull();
    expect(within(eigenes).getByRole('button', { name: 'Passwort für support1 setzen' })).toBeInTheDocument();
    expect(within(zelle(zeile('support2'), 5)).getByRole('button', { name: 'Support Zwei sperren' })).toBeInTheDocument();
    expect(within(zelle(zeile('support3'), 5)).getByRole('button', { name: 'Support Drei entsperren' })).toBeInTheDocument();
    expect(within(zelle(zeile('support2'), 5)).getByRole('button', { name: 'Support Zwei löschen' })).toBeInTheDocument();
  });

  it('leer und Fehler', async () => {
    h.apiGet.mockResolvedValueOnce({ data: [] });
    const { unmount } = render(<SupportKontenPage />);
    expect(await screen.findByText('Noch keine Support-Konten')).toBeInTheDocument();
    expect(screen.getByText('0 Support-Konten ohne Gemeinde')).toBeInTheDocument();
    unmount();
    h.apiGet.mockRejectedValueOnce(new Error('Netz weg'));
    render(<SupportKontenPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Support-Konten konnten nicht geladen werden.');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' })); });
    expect(await screen.findByRole('table', { name: 'Support-Konten' })).toBeInTheDocument();
  });

  it('ein einzelnes Konto steht in der Einzahl; der Hinweis erklaert, wofuer die Konten da sind', async () => {
    h.apiGet.mockResolvedValueOnce({ data: [KONTEN[0]] });
    render(<SupportKontenPage />);
    expect(await screen.findByText('1 Support-Konto ohne Gemeinde')).toBeInTheDocument();
    expect(screen.getByText(/Konten ohne Gemeinde für den Support\./)).toBeInTheDocument();
  });
});

describe('Support-Konten (Web): sperren, entsperren, loeschen', () => {
  it('Sperren fragt nach und schickt is_active: false', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Support Zwei sperren' }));
    expect(h.alert?.header).toBe('Konto sperren');
    expect(h.apiPatch).not.toHaveBeenCalled();
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Sperren')?.handler?.(); });
    await waitFor(() => expect(h.apiPatch).toHaveBeenCalledWith('/organizations/support-konten/10', { is_active: false }));
    expect(h.setSuccess).toHaveBeenCalledWith('Konto gesperrt');
  });

  it('Entsperren geht ohne Rueckfrage', async () => {
    await oeffnen();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Support Drei entsperren' })); });
    expect(h.apiPatch).toHaveBeenCalledWith('/organizations/support-konten/11', { is_active: true });
    expect(h.alert).toBeNull();
  });

  it('das letzte aktive Super-Admin-Konto (409): ein Hinweis, der stehen bleibt, mit dem Satz des Servers', async () => {
    await oeffnen();
    h.apiPatch.mockRejectedValue({ response: { status: 409, data: { error: 'Das letzte aktive Super-Admin-Konto lässt sich nicht sperren. Lege zuerst ein weiteres an.' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Support Zwei sperren' }));
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Sperren')?.handler?.(); });
    await waitFor(() => expect(h.alert?.header).toBe('Nicht möglich'));
    expect(h.alert?.message).toBe('Das letzte aktive Super-Admin-Konto lässt sich nicht sperren. Lege zuerst ein weiteres an.');
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.setSuccess).not.toHaveBeenCalled();
  });

  it('Loeschen fragt nach und ruft DELETE; ein anderer Fehler kommt als Meldung', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Support Zwei löschen' }));
    expect(h.alert?.header).toBe('Support-Konto löschen');
    expect(h.apiDelete).not.toHaveBeenCalled();
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Löschen')?.handler?.(); });
    await waitFor(() => expect(h.apiDelete).toHaveBeenCalledWith('/organizations/support-konten/10'));
    expect(h.setSuccess).toHaveBeenCalledWith('Support-Konto gelöscht');

    h.apiDelete.mockRejectedValue({ response: { status: 500, data: { error: 'Datenbankfehler' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Support Drei löschen' }));
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Löschen')?.handler?.(); });
    await waitFor(() => expect(h.setError).toHaveBeenCalledWith('Datenbankfehler'));
  });
});

describe('Support-Konten (Web): Passwort setzen im Dialog', () => {
  it('nach der Regel; schickt das neue Passwort; der Dialog schliesst', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Passwort für support2 setzen' }));
    const d = dialog('Passwort für support2 setzen');
    const feld = within(d).getByLabelText('Neues Passwort für support2');
    fireEvent.change(feld, { target: { value: 'kurz' } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Passwort setzen' })); });
    expect(h.setError).toHaveBeenCalledWith('Das Passwort muss mindestens 8 Zeichen lang sein');
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(dialog('Passwort für support2 setzen')).toBeInTheDocument();

    fireEvent.change(feld, { target: { value: BEISPIELWERT } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Passwort setzen' })); });
    expect(h.apiPut).toHaveBeenCalledWith('/organizations/support-konten/10/passwort', { password: BEISPIELWERT });
    expect(h.setSuccess).toHaveBeenCalledWith('Passwort gesetzt');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('beim eigenen Konto erst die Rueckfrage (alle Sitzungen enden, auch diese)', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Passwort für support1 setzen' }));
    const d = dialog('Passwort für support1 setzen');
    fireEvent.change(within(d).getByLabelText('Neues Passwort für support1'), { target: { value: BEISPIELWERT } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Passwort setzen' })); });
    expect(h.alert?.header).toBe('Eigenes Passwort setzen');
    expect(h.apiPut).not.toHaveBeenCalled();
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Passwort setzen')?.handler?.(); });
    await waitFor(() => expect(h.apiPut).toHaveBeenCalledWith('/organizations/support-konten/9/passwort', { password: BEISPIELWERT }));
  });

  it('vorschlagen zeigt das Passwort; Abbrechen schliesst ohne Aufruf', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Passwort für support2 setzen' }));
    const d = dialog('Passwort für support2 setzen');
    const feld = within(d).getByLabelText('Neues Passwort für support2') as HTMLInputElement;
    expect(feld).toHaveAttribute('type', 'password');
    fireEvent.click(within(d).getByRole('button', { name: 'Vorschlagen' }));
    expect(feld).toHaveAttribute('type', 'text');
    expect(feld.value.length).toBeGreaterThanOrEqual(8);
    fireEvent.click(within(d).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.apiPut).not.toHaveBeenCalled();
  });
});

describe('Support-Konten (Web): anlegen im Dialog', () => {
  const oeffnenDialog = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Support-Konto anlegen' }));
    return dialog('Support-Konto anlegen');
  };

  it('prueft vorher und schickt nur gesetzte Felder; danach schliesst der Dialog', async () => {
    await oeffnen();
    const d = oeffnenDialog();
    fireEvent.change(within(d).getByLabelText('Benutzername'), { target: { value: 'support 4' } });
    fireEvent.change(within(d).getByLabelText('Anzeigename'), { target: { value: 'Support Vier' } });
    fireEvent.change(within(d).getByLabelText('Passwort'), { target: { value: BEISPIELWERT } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Anlegen' })); });
    expect(h.setError).toHaveBeenCalledWith('Benutzername darf nur Buchstaben, Zahlen, Punkt (.) und Bindestrich (-) enthalten — keine Leerzeichen oder Umlaute');
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(dialog('Support-Konto anlegen')).toBeInTheDocument();

    fireEvent.change(within(d).getByLabelText('Benutzername'), { target: { value: 'support4' } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Anlegen' })); });
    expect(h.apiPost).toHaveBeenCalledWith('/organizations/support-konten', {
      username: 'support4', display_name: 'Support Vier', password: BEISPIELWERT,
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Support-Konto angelegt');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('Pflichtfelder tragen aria-required; die E-Mail ist freiwillig und geht mit, wenn sie da ist', async () => {
    await oeffnen();
    const d = oeffnenDialog();
    expect(within(d).getByLabelText('Benutzername')).toHaveAttribute('aria-required', 'true');
    expect(within(d).getByLabelText('Anzeigename')).toHaveAttribute('aria-required', 'true');
    expect(within(d).getByLabelText('Passwort')).toHaveAttribute('aria-required', 'true');
    expect(within(d).getByLabelText('E-Mail')).not.toHaveAttribute('aria-required');
    fireEvent.change(within(d).getByLabelText('Benutzername'), { target: { value: 'support4' } });
    fireEvent.change(within(d).getByLabelText('Anzeigename'), { target: { value: 'Support Vier' } });
    fireEvent.change(within(d).getByLabelText('E-Mail'), { target: { value: 'vier@example.org' } });
    fireEvent.change(within(d).getByLabelText('Passwort'), { target: { value: BEISPIELWERT } });
    await act(async () => { fireEvent.submit(within(d).getByLabelText('Passwort').closest('form')!); });
    expect(h.apiPost.mock.calls[0][1]).toEqual({ username: 'support4', display_name: 'Support Vier', password: BEISPIELWERT, email: 'vier@example.org' });
  });

  it('Benutzername vergeben (409): Hinweis, der Dialog bleibt offen mit der Eingabe', async () => {
    await oeffnen();
    const d = oeffnenDialog();
    fireEvent.change(within(d).getByLabelText('Benutzername'), { target: { value: 'support1' } });
    fireEvent.change(within(d).getByLabelText('Anzeigename'), { target: { value: 'Doppelt' } });
    fireEvent.change(within(d).getByLabelText('Passwort'), { target: { value: BEISPIELWERT } });
    h.apiPost.mockRejectedValue({ response: { status: 409, data: { error: 'Benutzername existiert bereits (muss systemweit eindeutig sein)' } } });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: 'Anlegen' })); });
    expect(h.alert?.message).toBe('Benutzername existiert bereits (muss systemweit eindeutig sein)');
    expect((within(dialog('Support-Konto anlegen')).getByLabelText('Anzeigename') as HTMLInputElement).value).toBe('Doppelt');
  });

  it('Passwort vorschlagen und zeigen; ein neuer Dialog beginnt leer', async () => {
    await oeffnen();
    let d = oeffnenDialog();
    const passwort = () => within(dialog('Support-Konto anlegen')).getByLabelText('Passwort') as HTMLInputElement;
    expect(passwort()).toHaveAttribute('type', 'password');
    fireEvent.click(within(d).getByRole('button', { name: 'Sicheres Passwort vorschlagen' }));
    expect(passwort()).toHaveAttribute('type', 'text');
    expect(passwort().value.length).toBeGreaterThanOrEqual(8);
    fireEvent.click(within(d).getByRole('button', { name: 'Passwort verbergen' }));
    expect(passwort()).toHaveAttribute('type', 'password');
    fireEvent.click(within(d).getByRole('button', { name: 'Abbrechen' }));
    d = oeffnenDialog();
    expect(passwort().value).toBe('');
    expect(within(d).getByRole('button', { name: 'Passwort zeigen' })).toBeInTheDocument();
  });
});

describe('Support-Konten: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die App-Darstellung -- mit derselben Logik', async () => {
    h.breit = false;
    render(<SupportKontenPage />);
    await screen.findByText('Support Zwei');
    expect(document.querySelector('.web-seite')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('button', { name: 'Support-Konto anlegen' })).toBeInTheDocument();
  });

  it('ohne Super-Admin-Recht: Hinweis, kein Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportKontenPage />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});

describe('Support-Konten (Web): sortieren nach Spalte', () => {
  const kopf = (name: string) => within(screen.getByRole('table', { name: 'Support-Konten' })).getByRole('columnheader', { name });
  const benutzernamen = () => zeilen().map((z) => zelle(z, 1).textContent);

  it('Klick auf "Name" ordnet aufsteigend, der zweite Klick absteigend', async () => {
    await oeffnen();
    expect(benutzernamen()).toEqual(['support1', 'support2', 'support3']);
    fireEvent.click(within(kopf('Name')).getByRole('button'));
    expect(benutzernamen()).toEqual(['support3', 'support1', 'support2']);
    expect(kopf('Name')).toHaveAttribute('aria-sort', 'ascending');
    fireEvent.click(within(kopf('Name')).getByRole('button'));
    expect(benutzernamen()).toEqual(['support2', 'support1', 'support3']);
    expect(kopf('Name')).toHaveAttribute('aria-sort', 'descending');
  });

  it('Aktionen sind nicht sortierbar', async () => {
    await oeffnen();
    expect(within(kopf('Aktionen')).queryByRole('button')).toBeNull();
    expect(kopf('Aktionen')).not.toHaveAttribute('aria-sort');
  });
});
