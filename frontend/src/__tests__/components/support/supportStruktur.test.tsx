// Struktur der Support-Ansicht (/admin/support/struktur), gerendert:
// Landeskirchen und Kirchenkreise anlegen, umbenennen, zuordnen, loeschen --
// eine Landeskirche mit Kirchenkreisen nicht, das sagt die Seite vorher.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
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
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, put: h.apiPut, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

import SupportStrukturPage from '../../../components/support/SupportStrukturPage';

const LANDESKIRCHEN = [
  { id: 1, name: 'Nordkirche', kirchenkreise: [{ id: 11, name: 'Dithmarschen' }] },
  { id: 2, name: 'Hannover', kirchenkreise: [] },
];
const KREISE = [
  { id: 11, name: 'Dithmarschen', landeskirche_id: 1, landeskirche: 'Nordkirche' },
  { id: 14, name: 'Mecklenburg', landeskirche_id: null, landeskirche: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  for (const f of [h.apiGet, h.apiPost, h.apiPut, h.apiDelete]) f.mockReset();
  h.alert = null;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  h.apiGet.mockImplementation((pfad: string) => {
    if (pfad === '/support/landeskirchen') return Promise.resolve({ data: LANDESKIRCHEN });
    if (pfad === '/support/kirchenkreise') return Promise.resolve({ data: KREISE });
    return Promise.reject(new Error(`unerwartet: ${pfad}`));
  });
  for (const f of [h.apiPost, h.apiPut, h.apiDelete]) f.mockResolvedValue({ data: {} });
});

const oeffnen = async () => {
  render(<SupportStrukturPage />);
  await screen.findByText('Dithmarschen');
};

describe('Struktur: Anzeige', () => {
  it('Landeskirchen mit ihren Kirchenkreisen, leere Landeskirche, Kirchenkreise ohne Landeskirche', async () => {
    await oeffnen();
    // Ueberschriften der Abschnitte (die Namen stehen auch in den Auswahllisten).
    expect(screen.getByText('Nordkirche', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Hannover', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Noch keine Kirchenkreise.')).toBeInTheDocument();
    expect(screen.getByText('Kirchenkreise ohne Landeskirche')).toBeInTheDocument();
    expect(screen.getByText('Mecklenburg')).toBeInTheDocument();
  });

  it('Fehler beim Laden: Hinweis mit erneutem Versuch', async () => {
    h.apiGet.mockImplementationOnce(() => Promise.reject(new Error('Netz weg')));
    render(<SupportStrukturPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Landeskirchen und Kirchenkreise konnten nicht geladen werden.');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Erneut versuchen/ })); });
    expect(await screen.findByText('Dithmarschen')).toBeInTheDocument();
  });
});

describe('Struktur: anlegen', () => {
  it('Landeskirche anlegen schickt den Namen und laedt neu', async () => {
    await oeffnen();
    expect(screen.getByRole('button', { name: 'Landeskirche anlegen' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Neue Landeskirche'), { target: { value: '  Bayern ' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Landeskirche anlegen' })); });
    expect(h.apiPost).toHaveBeenCalledWith('/support/landeskirchen', { name: 'Bayern' });
    expect(h.setSuccess).toHaveBeenCalledWith('Landeskirche angelegt');
    expect(h.apiGet.mock.calls.filter(([p]) => p === '/support/landeskirchen')).toHaveLength(2);
    expect((screen.getByLabelText('Neue Landeskirche') as HTMLInputElement).value).toBe('');
  });

  it('Kirchenkreis anlegen mit Landeskirche', async () => {
    await oeffnen();
    fireEvent.change(screen.getByLabelText('Neuer Kirchenkreis'), { target: { value: 'Steinburg' } });
    fireEvent.change(screen.getByLabelText('Landeskirche des neuen Kirchenkreises'), { target: { value: '1' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Kirchenkreis anlegen' })); });
    expect(h.apiPost).toHaveBeenCalledWith('/support/kirchenkreise', { name: 'Steinburg', landeskirche_id: 1 });
  });

  it('ein Fehler des Servers kommt als Meldung', async () => {
    await oeffnen();
    h.apiPost.mockRejectedValue({ response: { status: 409, data: { error: 'Diese Landeskirche gibt es schon' } } });
    fireEvent.change(screen.getByLabelText('Neue Landeskirche'), { target: { value: 'Nordkirche' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Landeskirche anlegen' })); });
    expect(h.setError).toHaveBeenCalledWith('Diese Landeskirche gibt es schon');
    expect(h.setSuccess).not.toHaveBeenCalled();
  });
});

describe('Struktur: bearbeiten und zuordnen', () => {
  it('Landeskirche umbenennen', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Nordkirche bearbeiten' }));
    fireEvent.change(screen.getByLabelText('Name der Landeskirche'), { target: { value: 'Ev.-Luth. Kirche in Norddeutschland' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speichern' })); });
    expect(h.apiPut).toHaveBeenCalledWith('/support/landeskirchen/1', { name: 'Ev.-Luth. Kirche in Norddeutschland' });
  });

  it('Kirchenkreis ohne Landeskirche einer Landeskirche zuordnen', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Mecklenburg bearbeiten' }));
    expect((screen.getByLabelText('Landeskirche') as HTMLSelectElement).value).toBe('ohne');
    fireEvent.change(screen.getByLabelText('Landeskirche'), { target: { value: '1' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speichern' })); });
    expect(h.apiPut).toHaveBeenCalledWith('/support/kirchenkreise/14', { name: 'Mecklenburg', landeskirche_id: 1 });
    expect(h.setSuccess).toHaveBeenCalledWith('Kirchenkreis gespeichert');
  });

  it('leerer Name wird nicht gespeichert', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Dithmarschen bearbeiten' }));
    fireEvent.change(screen.getByLabelText('Name des Kirchenkreises'), { target: { value: '  ' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speichern' })); });
    expect(h.setError).toHaveBeenCalledWith('Bitte einen Namen eingeben');
    expect(h.apiPut).not.toHaveBeenCalled();
  });
});

describe('Struktur: loeschen', () => {
  it('eine Landeskirche mit Kirchenkreisen: Erklaerung statt Loeschen', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Nordkirche löschen' }));
    expect(h.alert?.header).toBe('Landeskirche nicht löschbar');
    expect(h.alert?.message).toBe('An „Nordkirche“ hängt noch ein Kirchenkreis. Ordne ihn zuerst einer anderen Landeskirche zu oder lösche ihn.');
    expect(h.alert?.buttons?.map((b) => b.text)).toEqual(['Verstanden']);
    expect(h.apiDelete).not.toHaveBeenCalled();
  });

  it('eine leere Landeskirche: Rueckfrage, dann DELETE', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Hannover löschen' }));
    expect(h.alert?.header).toBe('Landeskirche löschen');
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

describe('Struktur: nur fuer Super-Admin', () => {
  it('ohne Merkmal: Hinweis, kein Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportStrukturPage />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
