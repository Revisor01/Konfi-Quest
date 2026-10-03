// Support-Konten (/admin/support/konten), gerendert: Liste, anlegen,
// sperren/entsperren, Passwort setzen, loeschen ueber
// /api/organizations/support-konten -- und der Schutz des letzten
// Super-Admin-Kontos (409) als Hinweis, der stehen bleibt.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  alert: null as null | AlertOptionen,
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  presentAlert: (o) => { h.alert = o; },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({
  default: { get: h.apiGet, post: h.apiPost, put: h.apiPut, patch: h.apiPatch, delete: h.apiDelete },
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

import SupportKontenPage from '../../../components/support/SupportKontenPage';

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
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  h.apiGet.mockResolvedValue({ data: KONTEN });
  for (const f of [h.apiPost, h.apiPut, h.apiPatch, h.apiDelete]) f.mockResolvedValue({ data: {} });
});

const zeile = (name: string) => screen.getByText(name, { exact: false, selector: '.app-list-item__title' }).closest('.app-list-item') as HTMLElement;
const oeffnen = async () => {
  render(<SupportKontenPage />);
  await screen.findByText('Support Zwei');
};

describe('Support-Konten: Liste', () => {
  it('zeigt Konten mit Status, letzter Anmeldung und Gast-Gemeinden; das eigene ist markiert', async () => {
    await oeffnen();
    expect(h.apiGet).toHaveBeenCalledWith('/organizations/support-konten');
    expect(screen.getByText('Support Eins (du)')).toBeInTheDocument();
    expect(within(zeile('Support Zwei')).getByText('Gast in Büsum')).toBeInTheDocument();
    expect(within(zeile('Support Zwei')).getByText('noch nie angemeldet')).toBeInTheDocument();
    expect(within(zeile('Support Drei')).getByText('Gesperrt')).toBeInTheDocument();
    expect(within(zeile('Support Zwei')).getByText('Aktiv')).toBeInTheDocument();
  });

  it('das eigene Konto bietet weder Sperren noch Loeschen an, die anderen schon', async () => {
    await oeffnen();
    const eigenes = zeile('Support Eins');
    expect(within(eigenes).queryByRole('button', { name: 'Sperren' })).toBeNull();
    expect(within(eigenes).queryByRole('button', { name: 'Löschen' })).toBeNull();
    expect(within(eigenes).getByRole('button', { name: 'Passwort setzen' })).toBeInTheDocument();
    expect(within(zeile('Support Zwei')).getByRole('button', { name: 'Sperren' })).toBeInTheDocument();
    expect(within(zeile('Support Drei')).getByRole('button', { name: 'Entsperren' })).toBeInTheDocument();
  });

  it('leer und Fehler', async () => {
    h.apiGet.mockResolvedValueOnce({ data: [] });
    const { unmount } = render(<SupportKontenPage />);
    expect(await screen.findByText('Noch keine Support-Konten')).toBeInTheDocument();
    unmount();

    h.apiGet.mockRejectedValueOnce(new Error('Netz weg'));
    render(<SupportKontenPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Support-Konten konnten nicht geladen werden.');
  });
});

describe('Support-Konten: sperren, entsperren, loeschen', () => {
  it('Sperren fragt nach und schickt is_active: false', async () => {
    await oeffnen();
    fireEvent.click(within(zeile('Support Zwei')).getByRole('button', { name: 'Sperren' }));
    expect(h.alert?.header).toBe('Konto sperren');
    expect(h.apiPatch).not.toHaveBeenCalled();
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Sperren')?.handler?.(); });
    await waitFor(() => expect(h.apiPatch).toHaveBeenCalledWith('/organizations/support-konten/10', { is_active: false }));
    expect(h.setSuccess).toHaveBeenCalledWith('Konto gesperrt');
  });

  it('Entsperren geht ohne Rueckfrage', async () => {
    await oeffnen();
    await act(async () => { fireEvent.click(within(zeile('Support Drei')).getByRole('button', { name: 'Entsperren' })); });
    expect(h.apiPatch).toHaveBeenCalledWith('/organizations/support-konten/11', { is_active: true });
    expect(h.alert).toBeNull();
  });

  it('das letzte aktive Super-Admin-Konto (409): ein Hinweis, der stehen bleibt, mit dem Satz des Servers', async () => {
    await oeffnen();
    h.apiPatch.mockRejectedValue({ response: { status: 409, data: { error: 'Das letzte aktive Super-Admin-Konto lässt sich nicht sperren. Lege zuerst ein weiteres an.' } } });
    fireEvent.click(within(zeile('Support Zwei')).getByRole('button', { name: 'Sperren' }));
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Sperren')?.handler?.(); });
    await waitFor(() => expect(h.alert?.header).toBe('Nicht möglich'));
    expect(h.alert?.message).toBe('Das letzte aktive Super-Admin-Konto lässt sich nicht sperren. Lege zuerst ein weiteres an.');
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.setSuccess).not.toHaveBeenCalled();
  });

  it('Loeschen fragt nach und ruft DELETE; ein anderer Fehler kommt als Meldung', async () => {
    await oeffnen();
    fireEvent.click(within(zeile('Support Zwei')).getByRole('button', { name: 'Löschen' }));
    expect(h.alert?.header).toBe('Support-Konto löschen');
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Löschen')?.handler?.(); });
    await waitFor(() => expect(h.apiDelete).toHaveBeenCalledWith('/organizations/support-konten/10'));
    expect(h.setSuccess).toHaveBeenCalledWith('Support-Konto gelöscht');

    h.apiDelete.mockRejectedValue({ response: { status: 500, data: { error: 'Datenbankfehler' } } });
    fireEvent.click(within(zeile('Support Drei')).getByRole('button', { name: 'Löschen' }));
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Löschen')?.handler?.(); });
    await waitFor(() => expect(h.setError).toHaveBeenCalledWith('Datenbankfehler'));
  });
});

describe('Support-Konten: Passwort setzen', () => {
  it('nach der Regel; schickt das neue Passwort', async () => {
    await oeffnen();
    fireEvent.click(within(zeile('Support Zwei')).getByRole('button', { name: 'Passwort setzen' }));
    const feld = screen.getByLabelText('Neues Passwort für support2');
    fireEvent.change(feld, { target: { value: 'kurz' } });
    await act(async () => { fireEvent.click(within(zeile('Support Zwei')).getByRole('button', { name: 'Passwort setzen' })); });
    expect(h.setError).toHaveBeenCalledWith('Das Passwort muss mindestens 8 Zeichen lang sein');
    expect(h.apiPut).not.toHaveBeenCalled();

    fireEvent.change(feld, { target: { value: 'Neu-Start2026!' } });
    await act(async () => { fireEvent.click(within(zeile('Support Zwei')).getByRole('button', { name: 'Passwort setzen' })); });
    expect(h.apiPut).toHaveBeenCalledWith('/organizations/support-konten/10/passwort', { password: 'Neu-Start2026!' });
    expect(h.setSuccess).toHaveBeenCalledWith('Passwort gesetzt');
  });

  it('beim eigenen Konto erst die Rueckfrage (alle Sitzungen enden, auch diese)', async () => {
    await oeffnen();
    fireEvent.click(within(zeile('Support Eins')).getByRole('button', { name: 'Passwort setzen' }));
    fireEvent.change(screen.getByLabelText('Neues Passwort für support1'), { target: { value: 'Neu-Start2026!' } });
    await act(async () => { fireEvent.click(within(zeile('Support Eins')).getByRole('button', { name: 'Passwort setzen' })); });
    expect(h.alert?.header).toBe('Eigenes Passwort setzen');
    expect(h.apiPut).not.toHaveBeenCalled();
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Passwort setzen')?.handler?.(); });
    await waitFor(() => expect(h.apiPut).toHaveBeenCalledWith('/organizations/support-konten/9/passwort', { password: 'Neu-Start2026!' }));
  });
});

describe('Support-Konten: anlegen', () => {
  it('prueft vorher und schickt nur gesetzte Felder', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Support-Konto anlegen' }));
    fireEvent.change(screen.getByLabelText('Benutzername'), { target: { value: 'support 4' } });
    fireEvent.change(screen.getByLabelText('Anzeigename'), { target: { value: 'Support Vier' } });
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'Neu-Start2026!' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Anlegen' })); });
    expect(h.setError).toHaveBeenCalledWith('Benutzername darf nur Buchstaben, Zahlen, Punkt (.) und Bindestrich (-) enthalten — keine Leerzeichen oder Umlaute');
    expect(h.apiPost).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Benutzername'), { target: { value: 'support4' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Anlegen' })); });
    expect(h.apiPost).toHaveBeenCalledWith('/organizations/support-konten', {
      username: 'support4', display_name: 'Support Vier', password: 'Neu-Start2026!',
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Support-Konto angelegt');
    expect(screen.queryByLabelText('Anzeigename')).toBeNull();
  });

  it('Benutzername vergeben (409): Hinweis, Formular bleibt offen', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Support-Konto anlegen' }));
    fireEvent.change(screen.getByLabelText('Benutzername'), { target: { value: 'support1' } });
    fireEvent.change(screen.getByLabelText('Anzeigename'), { target: { value: 'Doppelt' } });
    fireEvent.change(screen.getByLabelText('E-Mail'), { target: { value: 'doppelt@example.org' } });
    fireEvent.change(screen.getByLabelText('Passwort'), { target: { value: 'Neu-Start2026!' } });
    h.apiPost.mockRejectedValue({ response: { status: 409, data: { error: 'Benutzername existiert bereits (muss systemweit eindeutig sein)' } } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Anlegen' })); });
    expect(h.apiPost.mock.calls[0][1]).toEqual({ username: 'support1', display_name: 'Doppelt', password: 'Neu-Start2026!', email: 'doppelt@example.org' });
    expect(h.alert?.message).toBe('Benutzername existiert bereits (muss systemweit eindeutig sein)');
    expect(screen.getByLabelText('Anzeigename')).toBeInTheDocument();
  });
});

describe('Support-Konten: nur fuer Super-Admin', () => {
  it('ohne Merkmal: Hinweis, kein Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportKontenPage />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
