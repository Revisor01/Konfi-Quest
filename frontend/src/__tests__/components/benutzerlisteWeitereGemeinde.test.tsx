// Mitglieder aus weiteren Gemeinden in „Benutzer:innen" (Audit 26.09.2026,
// Leitung BF-01, HOCH).
//
// Wer ueber eine Gemeinde-Einladung mitarbeitet, fehlte in der Liste; die
// Detailansicht und die Jahrgangszuweisung kannten die Person laengst. Jetzt
// liefert GET /users sie mit dem Kennzeichen mitgliedschaft='weitere'. Die
// Liste muss das zeigen, der Bearbeiten-Dialog darf dann nur die Rolle
// speichern (alles andere weist das Backend mit 400 ab), und der Loesch-Dialog
// muss sagen, dass nur die Mitgliedschaft endet.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import UsersView from '../../components/admin/UsersView';
import type { AdminUser } from '../../types/user';

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setError: vi.fn(), setSuccess: vi.fn(), isOnline: true, user: { role_name: 'org_admin' } }),
}));

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const person = (extra: Partial<AdminUser>): AdminUser => ({
  id: 7,
  username: 'teamer2',
  display_name: 'Test Teamer 2',
  is_active: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
  role_name: 'teamer',
  role_display_name: 'Teamer:in',
  assigned_jahrgaenge_count: 0,
  can_edit: true,
  ...extra,
});

describe('Benutzerliste: Mitglieder aus weiteren Gemeinden', () => {
  it('zeigt bei mitgliedschaft="weitere" den Vermerk zur anderen Gemeinde', () => {
    render(
      <UsersView
        users={[person({ mitgliedschaft: 'weitere' })]}
        onUpdate={() => {}}
        onSelectUser={() => {}}
        onDeleteUser={() => {}}
        darfVerwalten={true}
      />
    );

    expect(screen.getByText('zuhause in einer anderen Gemeinde')).toBeTruthy();
  });

  it('zeigt den Vermerk NICHT bei Mitgliedern der Stamm-Gemeinde', () => {
    render(
      <UsersView
        users={[person({ id: 4, username: 'admin1', display_name: 'Test Admin 1', mitgliedschaft: 'stamm' })]}
        onUpdate={() => {}}
        onSelectUser={() => {}}
        onDeleteUser={() => {}}
        darfVerwalten={true}
      />
    );

    expect(screen.queryByText('zuhause in einer anderen Gemeinde')).toBeNull();
  });
});

describe('Bearbeiten-Dialog: in einer weiteren Gemeinde nur die Rolle', () => {
  const modal = lies('src/components/admin/modals/UserManagementModal.tsx');

  it('leitet nurRolle aus dem Kennzeichen ab und speichert dann nur role_id', () => {
    expect(modal).toContain("const nurRolle = !!userId && user?.mitgliedschaft === 'weitere';");
    expect(modal).toContain('nurRolle ? { role_id: formData.role_id } : userData');
  });

  it('sperrt Anzeigename, Benutzername, Funktion, E-Mail, Passwort und den Aktiv-Schalter', () => {
    // Fuenf Eingabefelder plus der Aktiv-Schalter; die Rollenauswahl bleibt frei.
    const gesperrt = modal.match(/disabled=\{isSubmitting \|\| nurRolle\}/g) ?? [];
    expect(gesperrt).toHaveLength(6);
    expect(modal).toContain('Diese Person ist in einer anderen Gemeinde zuhause.');
  });
});

describe('Loesch-Dialog: Mitgliedschaft beenden statt Konto loeschen', () => {
  it('unterscheidet den Text nach dem Kennzeichen', () => {
    const seite = lies('src/components/admin/pages/AdminUsersPage.tsx');
    expect(seite).toContain("userToDelete.mitgliedschaft === 'weitere' ? 'Mitgliedschaft beenden' : 'Benutzer löschen'");
    expect(seite).toContain('Das Konto und die Stamm-Gemeinde bleiben bestehen.');
  });
});
