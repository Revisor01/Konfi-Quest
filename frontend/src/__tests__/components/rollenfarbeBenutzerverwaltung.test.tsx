// Benutzerverwaltung und offene Einladungen: Rollenfarbe aus EINER Stelle
// (02.10.2026, Paket 2.4.0, Punkt 6).
//
// Beide Listen zeigten die drei Farben schon richtig -- ueber Inline-Farben
// aus rollenFarbeVar, die ueber der allgemeinen Klasse app-list-item--users
// lagen. Jetzt tragen sie dieselben Klassen wie jede andere Personenliste
// (utils/rollenNamen: rollenDarstellung), damit Strich, Kreis, Eck-Marke und
// Schrift nicht mehr je Ansicht zusammengesetzt werden.
import { describe, it, vi, afterEach } from 'vitest';
import React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { karteVon, erwarteRollenfarbe } from './rollenfarbePruefen';
import type { AdminUser } from '../../types/user';

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (...a: unknown[]) => apiGet(...a), delete: vi.fn() },
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setError: vi.fn(), setSuccess: vi.fn(), isOnline: true, user: { role_name: 'org_admin' } }),
}));

import UsersView from '../../components/admin/UsersView';
import OffeneEinladungen from '../../components/admin/OffeneEinladungen';

afterEach(() => cleanup());

const person = (id: number, display_name: string, role_name: string): AdminUser => ({
  id, username: display_name.split(' ')[0].toLowerCase(), display_name, is_active: true,
  created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z',
  role_name, role_display_name: role_name, assigned_jahrgaenge_count: 1, can_edit: true,
  mitgliedschaft: 'stamm',
});

describe('Benutzer:innen: Strich, Kreis und Eck-Marke in der Rollenfarbe', () => {
  it('Gemeindeleitung Indigo, Leitung Petrol, Teamer:in Beere', () => {
    render(
      <UsersView
        users={[person(5, 'Olga Gemeindeleitung', 'org_admin'), person(4, 'Anna Leitung', 'admin'), person(3, 'Tim Teamer', 'teamer')]}
        onUpdate={() => {}} onSelectUser={() => {}} onDeleteUser={() => {}} darfVerwalten
      />,
    );
    // Die Rolle steht hier als Symbol in der Eck-Marke, nicht als Wort:
    // keine Rollenschrift auf der Karte.
    erwarteRollenfarbe(karteVon('Olga Gemeindeleitung'), 'org_admin', 'Gemeindeleitung', { schrift: false });
    erwarteRollenfarbe(karteVon('Anna Leitung'), 'admin', 'Leitung', { schrift: false });
    erwarteRollenfarbe(karteVon('Tim Teamer'), 'teamer', 'Teamer:in', { schrift: false });
  });
});

describe('Offene Einladungen: Strich, Kreis und das Rollen-Symbol in der Rollenfarbe', () => {
  it('Gemeindeleitung, Leitung und Teamer:in', async () => {
    const einladung = (id: number, display_name: string, role_name: string) => ({
      id, user_id: id, display_name, username: display_name.split(' ')[0].toLowerCase(),
      role_name, role_display_name: null,
      created_at: '2026-09-25T12:00:00Z', expires_at: '2026-10-09T12:00:00Z', eingeladen_von_name: null,
    });
    apiGet.mockResolvedValue({ data: [
      einladung(21, 'Greta Gemeindeleitung', 'org_admin'),
      einladung(22, 'Lena Leitung', 'admin'),
      einladung(23, 'Theo Teamer', 'teamer'),
    ] });
    render(<OffeneEinladungen aktualisierung={0} />);
    for (let i = 0; i < 3; i += 1) await act(async () => { await Promise.resolve(); });

    // Die Einladung hat keine Eck-Marke (der Knopf "Zurückziehen" steht unten).
    erwarteRollenfarbe(karteVon('Greta Gemeindeleitung'), 'org_admin', 'Gemeindeleitung', { marke: false });
    erwarteRollenfarbe(karteVon('Lena Leitung'), 'admin', 'Leitung', { marke: false });
    erwarteRollenfarbe(karteVon('Theo Teamer'), 'teamer', 'Teamer:in', { marke: false });
  });
});
