// Bearbeiten-Knopf bei Super-Admin-Konten (Befund 03.10.2026, Simon:
// „bearbeiten knopf weg bitte"). GET /users liefert je Zeile can_edit und
// (seit 08.10.2026) can_delete nach derselben Regel wie der Server beim
// Bearbeiten und Loeschen. App und Web-Fassung bieten nur an, was geht:
//   - normales Konto: Bearbeiten und Entfernen;
//   - Konto mit Super-Admin-Merkmal: nichts (can_edit und can_delete false);
//   - Support-Gast: nur Entfernen (can_edit false, can_delete true);
//   - aelterer Server ohne can_delete: Entfernen folgt can_edit.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { neuerStand } from './leitungTestHilfe';
import type { AdminUser } from '../../../types/user';
import { darfEntfernen } from '../../../utils/mitgliedschaft';

vi.mock('@ionic/react', async () => (await import('./leitungTestHilfe')).ionicFuerLeitung(neuerStand()));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => true }));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/admin/useOffeneEinladungen', () => ({
  useOffeneEinladungen: () => ({ einladungen: [], laeuft: null, zurueckziehen: vi.fn() }),
}));

import WebBenutzer from '../../../components/admin/web/leitung/WebBenutzer';

const leer = () => undefined;

const person = (id: number, display_name: string, extra: Partial<AdminUser>): AdminUser => ({
  id,
  username: display_name.toLowerCase().replace(/\s+/g, '.'),
  display_name,
  is_active: true,
  created_at: '2026-09-01T10:00:00Z',
  updated_at: '2026-09-01T10:00:00Z',
  role_name: 'org_admin',
  role_display_name: 'Gemeindeleitung',
  assigned_jahrgaenge_count: 0,
  mitgliedschaft: 'stamm',
  ...extra,
});

const normal = person(1, 'Anna Normal', { role_name: 'teamer', can_edit: true, can_delete: true });
const superKonto = person(2, 'Simon Merkmal', { can_edit: false, can_delete: false });
const supportGast = person(3, 'Support Gast', { can_edit: false, can_delete: true, mitgliedschaft: 'weitere' });

const zeile = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

describe('darfEntfernen', () => {
  it('folgt can_delete, wenn der Server es liefert', () => {
    expect(darfEntfernen({ can_edit: false, can_delete: true })).toBe(true);
    expect(darfEntfernen({ can_edit: true, can_delete: false })).toBe(false);
  });

  it('ohne can_delete (aelterer Server) gilt can_edit', () => {
    expect(darfEntfernen({ can_edit: true })).toBe(true);
    expect(darfEntfernen({ can_edit: false })).toBe(false);
    expect(darfEntfernen({})).toBe(true);
  });
});

describe('Web: Benutzer:innen bieten nur an, was der Server erlaubt', () => {
  const zeigen = () => render(
    <WebBenutzer users={[normal, superKonto, supportGast]} laedt={false} darfVerwalten einladungenStand={0}
      onBearbeiten={leer} onLoeschen={leer} onAnlegen={leer} onEinladen={leer} />,
  );

  it('erlaubt: normales Konto mit Bearbeiten und Löschen', () => {
    zeigen();
    const z = within(zeile('Anna Normal'));
    expect(z.getAllByRole('button', { name: 'Anna Normal bearbeiten' })).toHaveLength(2);
    expect(z.getByRole('button', { name: 'Anna Normal löschen' })).toBeTruthy();
  });

  it('verboten: Konto mit Super-Admin-Merkmal ohne Bearbeiten und ohne Löschen', () => {
    zeigen();
    const z = within(zeile('Simon Merkmal'));
    expect(z.queryByRole('button', { name: /bearbeiten/ })).toBeNull();
    expect(z.queryByRole('button', { name: /löschen|entfernen/ })).toBeNull();
  });

  it('Support-Gast: kein Bearbeiten, aber Entfernen aus der Gemeinde', () => {
    zeigen();
    const z = within(zeile('Support Gast'));
    expect(z.queryByRole('button', { name: /bearbeiten/ })).toBeNull();
    expect(z.getByRole('button', { name: 'Support Gast aus der Gemeinde entfernen' })).toBeTruthy();
  });
});
