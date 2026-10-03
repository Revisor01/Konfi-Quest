// Anfragen der Support-Ansicht (/admin/support/anfragen), gerendert: Liste
// mit Filter nach Status, leer, Fehler, Sprung in eine Anfrage, und nur fuer
// Super-Admin.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  push: vi.fn(),
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

import SupportAnfragenPage from '../../../components/support/SupportAnfragenPage';

const anfrage = (id: number, gemeinde: string, status: string, extra: Record<string, unknown> = {}) => ({
  id, gemeinde, status, kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche', kontakt_name: 'Anna Beispiel',
  funktion: 'Pastorin', email: 'anna@example.org', mobil: null, anzahl_konfis: 25, anzahl_teamer: 6,
  nachricht: null, notiz: null, organization_id: null, created_at: '2026-10-02T08:00:00Z', updated_at: '2026-10-02T08:00:00Z',
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
});

describe('Anfragen: Liste und Filter', () => {
  it('startet mit den neuen Anfragen und zeigt Gemeinde, Kontakt, Zuordnung und Status', async () => {
    h.apiGet.mockResolvedValue({ data: [anfrage(4, 'Kirchengemeinde Heide', 'neu')] });
    render(<SupportAnfragenPage />);
    expect(screen.getByText('Anfragen werden geladen...')).toBeInTheDocument();
    const eintrag = await screen.findByRole('button', { name: 'Anfrage Kirchengemeinde Heide, Neu' });
    expect(eintrag).toHaveTextContent('Anna Beispiel (Pastorin)');
    expect(eintrag).toHaveTextContent('Dithmarschen · Nordkirche');
    expect(h.apiGet).toHaveBeenCalledWith('/support/anfragen', { params: { status: 'neu' } });
    expect(screen.getByRole('tab', { name: 'Neu' })).toHaveAttribute('aria-selected', 'true');
  });

  it('der Filter fragt den Status ab; "Alle" ohne Status', async () => {
    h.apiGet.mockResolvedValue({ data: [] });
    render(<SupportAnfragenPage />);
    await screen.findByText('Keine neuen Anfragen.');

    h.apiGet.mockResolvedValue({ data: [anfrage(5, 'Büsum', 'abgelehnt')] });
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Abgelehnt' })); });
    expect(await screen.findByRole('button', { name: 'Anfrage Büsum, Abgelehnt' })).toBeInTheDocument();
    expect(h.apiGet).toHaveBeenLastCalledWith('/support/anfragen', { params: { status: 'abgelehnt' } });

    h.apiGet.mockResolvedValue({ data: [anfrage(5, 'Büsum', 'abgelehnt'), anfrage(4, 'Heide', 'neu')] });
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Alle' })); });
    expect(await screen.findByText('2 Anfragen')).toBeInTheDocument();
    expect(h.apiGet).toHaveBeenLastCalledWith('/support/anfragen', undefined);
  });

  it('leer: sagt, dass es nichts Neues gibt', async () => {
    h.apiGet.mockResolvedValue({ data: [] });
    render(<SupportAnfragenPage />);
    expect(await screen.findByText('Keine neuen Anfragen.')).toBeInTheDocument();
  });

  it('Fehler: Hinweis mit erneutem Versuch', async () => {
    h.apiGet.mockRejectedValueOnce(new Error('Netz weg'));
    render(<SupportAnfragenPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Anfragen konnten nicht geladen werden.');
    h.apiGet.mockResolvedValue({ data: [anfrage(4, 'Heide', 'neu')] });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Erneut versuchen/ })); });
    expect(await screen.findByRole('button', { name: 'Anfrage Heide, Neu' })).toBeInTheDocument();
  });

  it('ein Eintrag oeffnet die Anfrage', async () => {
    h.apiGet.mockResolvedValue({ data: [anfrage(4, 'Heide', 'neu')] });
    render(<SupportAnfragenPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Anfrage Heide, Neu' }));
    expect(h.push).toHaveBeenCalledWith('/admin/support/anfragen/4');
  });
});

describe('Anfragen: nur fuer Super-Admin', () => {
  it('eine Leitung ohne Merkmal sieht den Hinweis, ohne Abruf', () => {
    h.user = { id: 5, role_name: 'admin', is_super_admin: false };
    render(<SupportAnfragenPage />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
