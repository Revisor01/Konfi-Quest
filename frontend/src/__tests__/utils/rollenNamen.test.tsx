import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { rollenName, ROLLEN_NAMEN, selbstbezeichnung } from '../../utils/rollenNamen';

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 5, organization_id: 1, role_name: 'org_admin' },
    setError: vi.fn(), setSuccess: vi.fn(), isOnline: true,
  }),
}));

import OffeneEinladungen from '../../components/admin/OffeneEinladungen';
import EinladungenKarte from '../../components/shared/EinladungenKarte';
import UserManagementModal from '../../components/admin/modals/UserManagementModal';
import { buildGalleryAuthorLabel } from '../../components/konfi/pages/useKonfiChallengeAnsicht';
import type { ChallengeSubmission } from '../../types/challenges';

// Simon, 28.09.2026: Die Rolle `admin` heißt „Leitung", `org_admin`
// „Org-Leitung" -- auch Ehrenamtliche haben diese Rollen. Jede Ansicht, die
// eine Rolle beschriftet, holt das Wort aus utils/rollenNamen, und zwar nach
// dem technischen Rollennamen: Bestehende Gemeinden tragen in der Datenbank
// weiter „Hauptamt" und „Organisations-Admin" (keine Migration).


describe('rollenName', () => {
  it('admin heißt „Leitung", org_admin „Org-Leitung"', () => {
    expect(rollenName('admin')).toBe('Leitung');
    expect(rollenName('org_admin')).toBe('Gemeindeleitung');
  });

  it('teamer bleibt „Teamer:in"', () => {
    expect(rollenName('teamer')).toBe('Teamer:in');
  });

  it('der Name aus der Datenbank verliert gegen den festen Namen', () => {
    // Rückfall greift nur bei unbekannten Rollen.
    expect(rollenName('admin', 'Hauptamt')).toBe('Leitung');
    expect(rollenName('org_admin', 'Organisations-Admin')).toBe('Gemeindeleitung');
  });

  it('unbekannte Rolle: Rückfall, sonst der Name unverändert', () => {
    expect(rollenName('konfi', 'Konfirmand:in')).toBe('Konfirmand:in');
    expect(rollenName('konfi')).toBe('konfi');
    expect(rollenName(undefined, 'Team')).toBe('Team');
    expect(rollenName(null)).toBe('');
  });

  it('weder „Hauptamt" noch „Admin" unter den Namen', () => {
    const namen = Object.values(ROLLEN_NAMEN);
    expect(namen).toEqual(['Gemeindeleitung', 'Leitung', 'Teamer:in']);
  });
});

// Gerendert: Bestehende Gemeinden tragen in der Datenbank weiter „Hauptamt"
// und „Organisations-Admin" -- die Ansichten zeigen trotzdem das feste Wort.
// Weitere Ansichten pruefen das Wort gerendert in ihren eigenen Tests:
// Benutzerliste und offene Einladungen (rollenfarbeBenutzerverwaltung),
// Chat-Mitglieder (rollenfarbeChatMitglieder), Jahrgangs-Zuweisung
// (rollenfarbeJahrgangZugriff), Einladen (gemeindeEinladungGerendert).
describe('Alle Rollen-Beschriftungen lesen rollenName', () => {
  beforeEach(() => apiGet.mockReset());
  afterEach(() => cleanup());

  it('Offene Einladungen: das feste Wort nach role_name, nicht role_display_name aus der Datenbank', async () => {
    const einladung = (id: number, display_name: string, role_name: string, role_display_name: string) => ({
      id, user_id: id, display_name, username: `u${id}`, role_name, role_display_name,
      created_at: '2026-09-25T12:00:00Z', expires_at: '2026-10-09T12:00:00Z', eingeladen_von_name: null,
    });
    apiGet.mockResolvedValue({ data: [
      einladung(21, 'Greta G', 'org_admin', 'Organisations-Admin'),
      einladung(22, 'Lena L', 'admin', 'Hauptamt'),
    ] });
    const { container } = render(<OffeneEinladungen aktualisierung={0} />);
    await screen.findByText('Greta G');
    expect(container.textContent).toContain('Gemeindeleitung');
    expect(container.textContent).toContain('Leitung');
    expect(container.textContent).not.toContain('Hauptamt');
    expect(container.textContent).not.toContain('Organisations-Admin');
  });

  it('Einladungen-Karte der eingeladenen Person: „als Gemeindeleitung", nicht der Datenbank-Name', async () => {
    apiGet.mockResolvedValue({ data: [{
      id: 5, organization_display_name: 'St. Petri', organization_name: 'st-petri',
      role_display_name: 'Organisations-Admin', role_name: 'org_admin',
      eingeladen_von_name: null, expires_at: '2026-10-13T00:00:00Z',
    }] });
    render(<EinladungenKarte variante="users" />);
    expect(await screen.findByText('als Gemeindeleitung')).toBeInTheDocument();
    expect(screen.queryByText(/Organisations-Admin/)).toBeNull();
  });

  it('Benutzer anlegen: die Rollenauswahl beschriftet nach dem Rollennamen', async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (url === '/roles') return { data: [
        { id: 2, name: 'teamer', display_name: 'Teamer' },
        { id: 3, name: 'admin', display_name: 'Hauptamt' },
        { id: 4, name: 'org_admin', display_name: 'Organisations-Admin' },
      ] };
      return { data: [] };
    });
    const { container } = render(<UserManagementModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText('Leitung').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Gemeindeleitung').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Teamer:in').length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain('Hauptamt');
    expect(container.textContent).not.toContain('Organisations-Admin');
  });

  it('Challenge-Galerie: „Name · Leitung" bzw. „Name · Gemeindeleitung", Konfis mit Jahrgang', () => {
    const beitrag = (role_name: string | null, jahrgang_name: string | null) =>
      ({ konfi_name: 'Pia', role_name, jahrgang_name } as unknown as ChallengeSubmission);
    expect(buildGalleryAuthorLabel(beitrag('admin', null))).toBe('Pia · Leitung');
    expect(buildGalleryAuthorLabel(beitrag('org_admin', null))).toBe('Pia · Gemeindeleitung');
    expect(buildGalleryAuthorLabel(beitrag('teamer', null))).toBe('Pia · Teamer:in');
    expect(buildGalleryAuthorLabel(beitrag('konfi', 'Jahrgang 2026'))).toBe('Pia · Jahrgang 2026');
  });

  // WAECHTER (bewusst Quelltext, Abwesenheit): Die alten Eigenbau-Woerter
  // kommen in keiner der Ansichten zurueck, die Rollen beschriften -- auch
  // in denen, die hier nicht gerendert werden (Gemeinde-Verwaltung).
  const ansichten = [
    'src/components/admin/UsersView.tsx',
    'src/components/admin/OffeneEinladungen.tsx',
    'src/components/admin/modals/EinladungModal.tsx',
    'src/components/admin/modals/UserManagementModal.tsx',
    'src/components/admin/pages/AdminJahrgaengeePage.tsx',
    'src/components/admin/modals/OrganizationManagementModal.tsx',
    'src/components/chat/modals/MembersModal.tsx',
    'src/components/shared/EinladungenKarte.tsx',
    'src/components/konfi/pages/useKonfiChallengeAnsicht.ts',
  ];
  for (const pfad of ansichten) {
    it(`${pfad} kennt die alten Eigenbau-Woerter nicht`, () => {
      const quelle = readFileSync(resolve(process.cwd(), pfad), 'utf8');
      expect(quelle).not.toMatch(/'admin' \? 'Admin'/);
      expect(quelle).not.toMatch(/'org_admin' \? 'Org-Admin'/);
      expect(quelle).not.toMatch(/case 'admin': return 'Admin'/);
      expect(quelle).not.toMatch(/case 'org_admin': return 'Org-Admin'/);
      expect(quelle).not.toMatch(/label: 'Admin'/);
      expect(quelle).not.toMatch(/label: 'Org-Admin'/);
      expect(quelle).not.toContain('Hauptamt');
    });
  }
});

// Simon, 01.10.2026: Unter dem Namen steht die Selbstbezeichnung
// (users.role_title), sonst der Rollenname. Leerzeichen allein zaehlen nicht.
describe('selbstbezeichnung', () => {
  it('nimmt die eigene Bezeichnung, getrimmt', () => {
    expect(selbstbezeichnung('Teamerin', 'Teamer:in')).toBe('Teamerin');
    expect(selbstbezeichnung('  Jugendleiterin ', 'Teamer:in')).toBe('Jugendleiterin');
  });

  it('faellt ohne Bezeichnung auf den Rueckfall zurueck', () => {
    expect(selbstbezeichnung('', 'Teamer:in')).toBe('Teamer:in');
    expect(selbstbezeichnung(null, 'Teamer:in')).toBe('Teamer:in');
    expect(selbstbezeichnung(undefined, 'Teamer:in')).toBe('Teamer:in');
  });

  it('faellt bei lauter Leerzeichen auf den Rueckfall zurueck', () => {
    expect(selbstbezeichnung('   ', 'Teamer:in')).toBe('Teamer:in');
  });

  it('liefert ohne Rueckfall einen leeren Text statt Leerzeichen', () => {
    expect(selbstbezeichnung('  ')).toBe('');
  });
});
