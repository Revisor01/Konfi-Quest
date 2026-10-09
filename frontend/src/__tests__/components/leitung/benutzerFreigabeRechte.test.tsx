// "Darf freigeben" im Benutzerfenster (09.10.2026, docs/planung/darf-freigeben.md):
// Je zugewiesenem Jahrgang drei Rechte -- Anträge entscheiden, Events
// verbuchen, Challenge-Beiträge freigeben. Vergeben darf sie NUR die
// Gemeindeleitung, und nur an Personen mit der Rolle Admin (Leitung); das
// Backend weist jeden anderen, der die Felder mitschickt, mit 403 ab. Deshalb
// hängen Schalter UND Mitschicken an derselben Bedingung.
//
// Dasselbe Fenster nutzt die Web-Fassung (AdminUsersPage öffnet
// UserManagementModal), deshalb gilt der Test für App und Web.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  setError: vi.fn(),
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
  person: {} as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, put: h.apiPut } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, isOnline: true }),
}));

import UserManagementModal from '../../../components/admin/modals/UserManagementModal';

const ROLLEN = [
  { id: 1, name: 'org_admin', display_name: 'Gemeindeleitung', is_system_role: true, is_active: true, user_count: 1 },
  { id: 2, name: 'admin', display_name: 'Leitung', is_system_role: true, is_active: true, user_count: 2 },
  { id: 3, name: 'teamer', display_name: 'Teamer:in', is_system_role: true, is_active: true, user_count: 5 },
];
const JAHRGAENGE = [{ id: 11, name: '2026/27' }, { id: 12, name: '2027/28' }];

const leitungsPerson = (zuweisungen: Record<string, unknown>[]) => ({
  id: 40, username: 'sam.muster', display_name: 'Sam Muster', email: '', role_title: '',
  role_id: 2, role_name: 'admin', is_active: true, mitgliedschaft: 'stamm',
  assigned_jahrgaenge: zuweisungen,
});

const RECHTE = ['Anträge entscheiden', 'Events verbuchen', 'Challenge-Beiträge freigeben'];
const schalter = (recht: string, jahrgang: string) => screen.queryByRole('checkbox', { name: `${recht} (${jahrgang})` }) as HTMLInputElement | null;
/** Der Eintrag des Jahrgangs in der Auswahl (nicht der unter "Aktuelle Zuweisungen"). */
const jahrgangKnopf = (name: string) => screen.getAllByRole('button').find((b) => b.textContent === name)!;
const alleSchalter = () => screen.queryAllByRole('checkbox', { name: /\((2026\/27|2027\/28)\)$/ });
const HINWEIS = 'Wer ein Recht nicht hat, sieht die Vorgänge weiter, kann sie aber nicht entscheiden. Die Gemeindeleitung hat alle Rechte immer.';

const oeffne = async (userId: number | null = 40) => {
  render(<UserManagementModal userId={userId} onClose={vi.fn()} onSuccess={vi.fn()} />);
  await screen.findByRole('button', { name: 'Benutzer:in speichern' });
  await act(async () => { await Promise.resolve(); });
};
const speichern = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Benutzer:in speichern' })); });
  await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith('/users/40/jahrgaenge', expect.anything()));
  return h.apiPost.mock.calls.find(([url]) => url === '/users/40/jahrgaenge')![1] as { jahrgang_assignments: Record<string, unknown>[] };
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.user = konto('org_admin');
  h.person = leitungsPerson([
    { id: 11, name: '2026/27', can_view: true, can_edit: true, darf_antraege_entscheiden: true, darf_events_verbuchen: false, darf_challenges_freigeben: true },
  ]);
  h.apiGet.mockImplementation(async (url: string) => {
    if (url === '/roles') return { data: ROLLEN };
    if (url === '/admin/jahrgaenge') return { data: JAHRGAENGE };
    if (url === '/users/40') return { data: h.person };
    throw new Error(`nicht vorgesehen: ${url}`);
  });
  h.apiPost.mockResolvedValue({ data: {} });
  h.apiPut.mockResolvedValue({ data: {} });
});

describe('ERLAUBT: die Gemeindeleitung vergibt die Rechte an eine Leitung', () => {
  it('je zugewiesenem Jahrgang drei Schalter, vorbelegt aus der Zuweisung; dazu der Hinweis', async () => {
    await oeffne();
    expect(screen.getByText(HINWEIS)).toBeInTheDocument();
    expect(schalter('Anträge entscheiden', '2026/27')!.checked).toBe(true);
    expect(schalter('Events verbuchen', '2026/27')!.checked).toBe(false);
    expect(schalter('Challenge-Beiträge freigeben', '2026/27')!.checked).toBe(true);
    // Nicht zugewiesen: keine Schalter.
    for (const r of RECHTE) expect(schalter(r, '2027/28')).toBeNull();
    expect(alleSchalter()).toHaveLength(3);
  });

  it('fehlt ein Feld (älterer Server), gilt es als an', async () => {
    h.person = leitungsPerson([{ id: 11, name: '2026/27', can_view: true, can_edit: true }]);
    await oeffne();
    for (const r of RECHTE) expect(schalter(r, '2026/27')!.checked).toBe(true);
  });

  it('ein neu gewählter Jahrgang bekommt alle drei an; gespeichert werden die Felder je Zuweisung', async () => {
    await oeffne();
    fireEvent.click(jahrgangKnopf('2027/28'));
    for (const r of RECHTE) expect(schalter(r, '2027/28')!.checked).toBe(true);
    fireEvent.click(schalter('Anträge entscheiden', '2026/27')!);
    fireEvent.click(schalter('Challenge-Beiträge freigeben', '2027/28')!);

    const body = await speichern();
    expect(body).toEqual({
      jahrgang_assignments: [
        { jahrgang_id: 11, can_view: true, can_edit: true, darf_antraege_entscheiden: false, darf_events_verbuchen: false, darf_challenges_freigeben: true },
        { jahrgang_id: 12, can_view: true, can_edit: true, darf_antraege_entscheiden: true, darf_events_verbuchen: true, darf_challenges_freigeben: false },
      ],
    });
  });

  it('ein abgewählter Jahrgang verliert seine Schalter und fehlt im Speichern', async () => {
    await oeffne();
    fireEvent.click(jahrgangKnopf('2026/27'));
    expect(alleSchalter()).toHaveLength(0);
    const body = await speichern();
    expect(body).toEqual({ jahrgang_assignments: [] });
  });

  it('wer beim Bearbeiten zur Leitung gemacht wird, bekommt die Schalter sofort', async () => {
    h.person = { ...leitungsPerson([{ id: 11, name: '2026/27', can_view: true, can_edit: true }]), role_id: 3, role_name: 'teamer' };
    await oeffne();
    expect(alleSchalter()).toHaveLength(0);
    fireEvent.click(screen.getByText('Leitung'));
    expect(alleSchalter()).toHaveLength(3);
  });
});

describe('VERBOTEN: keine Schalter und keine Felder im Speichern', () => {
  it('Gemeindeleitung bearbeitet eine Teamer:in: keine Schalter, die Zuweisung ohne die Felder', async () => {
    h.person = { ...leitungsPerson([{ id: 11, name: '2026/27', can_view: true, can_edit: true }]), role_id: 3, role_name: 'teamer' };
    await oeffne();
    expect(alleSchalter()).toHaveLength(0);
    expect(screen.queryByText(HINWEIS)).toBeNull();
    const body = await speichern();
    expect(body).toEqual({ jahrgang_assignments: [{ jahrgang_id: 11, can_view: true, can_edit: true }] });
  });

  it('Gemeindeleitung bearbeitet eine Gemeindeleitung: keine Schalter (sie hat alle Rechte immer)', async () => {
    h.person = { ...leitungsPerson([{ id: 11, name: '2026/27', can_view: true, can_edit: true }]), role_id: 1, role_name: 'org_admin' };
    await oeffne();
    expect(alleSchalter()).toHaveLength(0);
    const body = await speichern();
    expect(body).toEqual({ jahrgang_assignments: [{ jahrgang_id: 11, can_view: true, can_edit: true }] });
  });

  it('eine Leitung (admin) öffnet eine andere Leitung: keine Schalter, und die Felder gehen NICHT mit (sonst 403)', async () => {
    h.user = konto('admin', [11, 12]);
    await oeffne();
    expect(alleSchalter()).toHaveLength(0);
    expect(screen.queryByText(HINWEIS)).toBeNull();
    const body = await speichern();
    expect(body).toEqual({ jahrgang_assignments: [{ jahrgang_id: 11, can_view: true, can_edit: true }] });
  });
});
