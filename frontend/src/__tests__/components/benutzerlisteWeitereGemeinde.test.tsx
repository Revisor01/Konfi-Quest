// Mitglieder aus weiteren Gemeinden in „Benutzer:innen" (Audit 26.09.2026,
// Leitung BF-01, HOCH).
//
// Wer ueber eine Gemeinde-Einladung mitarbeitet, fehlte in der Liste; die
// Detailansicht und die Jahrgangszuweisung kannten die Person laengst. Jetzt
// liefert GET /users sie mit dem Kennzeichen mitgliedschaft='weitere'. Die
// Liste muss das zeigen, der Bearbeiten-Dialog darf dann nur Rolle,
// Funktionsbeschreibung und Sperre speichern (alles andere weist das Backend
// mit 400 ab), und der Loesch-Dialog
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

describe('Bearbeiten-Dialog: in einer weiteren Gemeinde nur, was je Gemeinde gilt', () => {
  const modal = lies('src/components/admin/modals/UserManagementModal.tsx');

  // Seit 08.10.2026 (Migration 196) gelten Funktionsbeschreibung und Sperre
  // je Gemeinde; die weitere Gemeinde darf sie bei sich setzen.
  it('leitet nurRolle aus dem Kennzeichen ab und speichert dann Rolle, Funktion und Sperre', () => {
    expect(modal).toContain("const nurRolle = !!userId && user?.mitgliedschaft === 'weitere';");
    expect(modal).toContain('{ role_id: formData.role_id, role_title: userData.role_title, is_active: userData.is_active }');
  });

  it('sperrt Anzeigename, Benutzername, E-Mail und Passwort, nicht Funktion und Aktiv-Schalter', () => {
    // Vier Eingabefelder; Rollenauswahl, Funktion und Aktiv-Schalter bleiben frei.
    const gesperrt = modal.match(/disabled=\{isSubmitting \|\| nurRolle\}/g) ?? [];
    expect(gesperrt).toHaveLength(4);
    expect(modal).toContain('Diese Person ist in einer anderen Gemeinde zuhause.');
    expect(modal).toContain("nurRolle ? 'Gilt nur für diese Gemeinde'");
  });
});

// Der Loesch-Dialog ("Mitgliedschaft beenden" statt Kontoloeschung) wird seit
// dem 27.09.2026 gerendert geprueft, mit allen drei Faellen:
// benutzerEntfernenAbfrage.test.tsx.
