// App-Fassung der Benutzerliste: Tippen = bearbeiten (nur bei can_edit),
// Wischen = entfernen (nach can_delete, sonst can_edit). Befund 03.10.2026:
// Bei Konten mit Super-Admin-Merkmal bot die App Wege an, die mit 403
// endeten. Die Web-Fassung pruefen leitung/benutzerKnoepfeSuperAdmin.test.tsx.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import UsersView from '../../components/admin/UsersView';
import type { AdminUser } from '../../types/user';

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setError: vi.fn(), setSuccess: vi.fn(), isOnline: true, user: { role_name: 'org_admin' } }),
}));

const person = (id: number, display_name: string, extra: Partial<AdminUser>): AdminUser => ({
  id,
  username: `konto${id}`,
  display_name,
  is_active: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
  role_name: 'org_admin',
  role_display_name: 'Gemeindeleitung',
  assigned_jahrgaenge_count: 0,
  ...extra,
});

const zeigen = (users: AdminUser[], onSelectUser = vi.fn()) => {
  render(
    <UsersView users={users} onUpdate={() => {}} onSelectUser={onSelectUser} onDeleteUser={() => {}} darfVerwalten />
  );
  return onSelectUser;
};

describe('App: Benutzerliste bei Super-Admin-Konten', () => {
  it('erlaubt: normales Konto -- Tippen oeffnet, Wischen zum Loeschen da', () => {
    const auswahl = zeigen([person(1, 'Anna Normal', { can_edit: true, can_delete: true })]);
    fireEvent.click(screen.getByText('Anna Normal'));
    expect(auswahl).toHaveBeenCalledTimes(1);
    expect(screen.getAllByLabelText('Benutzer:in löschen')).toHaveLength(1);
  });

  it('verboten: Konto mit Merkmal -- Tippen oeffnet nichts, kein Loeschen', () => {
    const auswahl = zeigen([person(2, 'Simon Merkmal', { can_edit: false, can_delete: false })]);
    fireEvent.click(screen.getByText('Simon Merkmal'));
    expect(auswahl).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Benutzer:in löschen')).toBeNull();
  });

  it('Support-Gast: Tippen oeffnet nichts, Entfernen per Wischen bleibt', () => {
    const auswahl = zeigen([person(3, 'Support Gast', { can_edit: false, can_delete: true, mitgliedschaft: 'weitere' })]);
    fireEvent.click(screen.getByText('Support Gast'));
    expect(auswahl).not.toHaveBeenCalled();
    expect(screen.getAllByLabelText('Benutzer:in löschen')).toHaveLength(1);
  });
});
