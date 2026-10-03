// Formular "Gemeinde": Kirchenkreis aus der Struktur (Support-Ansicht,
// Web-Version, 03.10.2026), gerendert.
//
// Fuer Super-Admins waehlt das Formular den Kirchenkreis aus der Liste
// (GET /support/kirchenkreise) und zeigt die Landeskirche dazu; gespeichert
// wird kirchenkreis_id und derselbe Name in der alten Textspalte, die aeltere
// Apps lesen. Laedt die Liste nicht, bleibt das Freitextfeld wie bisher. Ein
// Freitext ohne passenden Kirchenkreis geht beim Speichern nicht verloren.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  user: { id: 1, role_name: 'org_admin', is_super_admin: true } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe());
vi.mock('../../../services/api', () => ({
  default: { get: h.apiGet, put: h.apiPut, patch: h.apiPatch, post: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: <T,>(fn: () => Promise<T>) => fn() }),
}));
vi.mock('../../../components/admin/modals/AdminPasswordResetModal', () => ({ default: () => null }));

import OrganizationManagementModal from '../../../components/admin/modals/OrganizationManagementModal';

const KREISE = [
  { id: 11, name: 'Kirchenkreis Dithmarschen', landeskirche_id: 1, landeskirche: 'Nordkirche' },
  { id: 12, name: 'Plön-Segeberg', landeskirche_id: 1, landeskirche: 'Nordkirche' },
];
const GEMEINDE = {
  id: 7, name: 'buesum', slug: 'buesum', display_name: 'Büsum', is_active: true, max_konfis: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  konfi_count: 10, teamer_count: 2, admin_count: 1, user_count: 3, event_count: 4,
};

let gemeinde: Record<string, unknown> = GEMEINDE;
let kreiseAntwort: () => Promise<unknown> = () => Promise.resolve({ data: KREISE });

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.apiPut.mockReset().mockResolvedValue({ data: {} });
  h.apiPatch.mockReset().mockResolvedValue({ data: {} });
  h.user = { id: 1, role_name: 'org_admin', is_super_admin: true };
  gemeinde = GEMEINDE;
  kreiseAntwort = () => Promise.resolve({ data: KREISE });
  h.apiGet.mockImplementation((pfad: string) => {
    if (pfad === '/organizations/7') return Promise.resolve({ data: gemeinde });
    if (pfad === '/support/kirchenkreise') return kreiseAntwort();
    return Promise.resolve({ data: [] });
  });
});

const oeffnen = async () => {
  render(<OrganizationManagementModal organizationId={7} onClose={vi.fn()} onSuccess={vi.fn()} />);
  await screen.findByRole('button', { name: 'Gemeinde bearbeiten' });
};

const speichern = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Gemeinde bearbeiten' }));
  return {
    weiter: async () => {
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Gemeinde speichern' })); });
      await waitFor(() => expect(h.apiPut).toHaveBeenCalledTimes(1));
      return h.apiPut.mock.calls[0][1] as Record<string, unknown>;
    },
  };
};

describe('Gemeinde: Kirchenkreis aus der Struktur (Super-Admin)', () => {
  it('Ansicht: Kirchenkreis und Landeskirche der gespeicherten Zuordnung', async () => {
    gemeinde = { ...GEMEINDE, kirchenkreis: 'Kirchenkreis Dithmarschen', kirchenkreis_id: 11 };
    await oeffnen();
    await screen.findByText('Nordkirche');
    const werte = Array.from(document.querySelectorAll('.app-info-row')).map((z) => z.textContent);
    expect(werte).toContain('KirchenkreisKirchenkreis Dithmarschen');
    expect(werte).toContain('LandeskircheNordkirche');
  });

  it('Bearbeiten: Auswahl statt Freitext; ein anderer Kirchenkreis geht als Kennung und Name hinaus', async () => {
    gemeinde = { ...GEMEINDE, kirchenkreis: 'Kirchenkreis Dithmarschen', kirchenkreis_id: 11 };
    await oeffnen();
    await screen.findByText('Nordkirche');
    const s = await speichern();
    const auswahl = screen.getByLabelText('Kirchenkreis (optional)') as HTMLSelectElement;
    expect(auswahl.tagName).toBe('SELECT');
    expect(auswahl.value).toBe('11');
    fireEvent.change(auswahl, { target: { value: '12' } });
    expect(screen.getByText('Landeskirche: Nordkirche')).toBeInTheDocument();
    const koerper = await s.weiter();
    expect(koerper.kirchenkreis_id).toBe(12);
    expect(koerper.kirchenkreis).toBe('Plön-Segeberg');
  });

  it('"Ohne Kirchenkreis" nimmt die Zuordnung und den Text weg', async () => {
    gemeinde = { ...GEMEINDE, kirchenkreis: 'Kirchenkreis Dithmarschen', kirchenkreis_id: 11 };
    await oeffnen();
    await screen.findByText('Nordkirche');
    const s = await speichern();
    fireEvent.change(screen.getByLabelText('Kirchenkreis (optional)'), { target: { value: 'ohne' } });
    const koerper = await s.weiter();
    expect(koerper.kirchenkreis_id).toBeNull();
    expect(koerper.kirchenkreis).toBeNull();
  });

  it('Gemeinde von vor der Struktur: der Freitext findet seinen Kirchenkreis und wird verknuepft', async () => {
    gemeinde = { ...GEMEINDE, kirchenkreis: 'Dithmarschen' };
    await oeffnen();
    const s = await speichern();
    await waitFor(() => expect((screen.getByLabelText('Kirchenkreis (optional)') as HTMLSelectElement).value).toBe('11'));
    const koerper = await s.weiter();
    expect(koerper.kirchenkreis_id).toBe(11);
    expect(koerper.kirchenkreis).toBe('Kirchenkreis Dithmarschen');
  });

  it('ein Freitext ohne passenden Kirchenkreis bleibt beim Speichern stehen', async () => {
    gemeinde = { ...GEMEINDE, kirchenkreis: 'Irgendwo' };
    await oeffnen();
    const s = await speichern();
    await waitFor(() => expect(screen.getByLabelText('Kirchenkreis (optional)').tagName).toBe('SELECT'));
    const koerper = await s.weiter();
    expect('kirchenkreis_id' in koerper).toBe(false);
    expect(koerper.kirchenkreis).toBe('Irgendwo');
  });
});

describe('Gemeinde: ohne Struktur bleibt der Freitext', () => {
  it('Liste laedt nicht (aelterer Server): Freitextfeld, ohne kirchenkreis_id', async () => {
    kreiseAntwort = () => Promise.reject({ response: { status: 404 } });
    gemeinde = { ...GEMEINDE, kirchenkreis: 'Dithmarschen' };
    await oeffnen();
    const s = await speichern();
    const feld = screen.getByLabelText('Kirchenkreis (optional)') as HTMLInputElement;
    expect(feld.tagName).toBe('INPUT');
    expect(feld.value).toBe('Dithmarschen');
    const koerper = await s.weiter();
    expect('kirchenkreis_id' in koerper).toBe(false);
    expect(koerper.kirchenkreis).toBe('Dithmarschen');
  });

  it('ohne Super-Admin-Recht wird die Struktur gar nicht abgefragt', async () => {
    h.user = { id: 2, role_name: 'org_admin', is_super_admin: false };
    gemeinde = { ...GEMEINDE, kirchenkreis: 'Dithmarschen' };
    await oeffnen();
    expect(h.apiGet).not.toHaveBeenCalledWith('/support/kirchenkreise');
    fireEvent.click(screen.getByRole('button', { name: 'Gemeinde bearbeiten' }));
    expect(screen.getByLabelText('Kirchenkreis (optional)').tagName).toBe('INPUT');
  });
});
