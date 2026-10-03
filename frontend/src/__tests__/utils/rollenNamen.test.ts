import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { rollenName, ROLLEN_NAMEN, selbstbezeichnung } from '../../utils/rollenNamen';

// Simon, 28.09.2026: Die Rolle `admin` heißt „Leitung", `org_admin`
// „Org-Leitung" -- auch Ehrenamtliche haben diese Rollen. Jede Ansicht, die
// eine Rolle beschriftet, holt das Wort aus utils/rollenNamen, und zwar nach
// dem technischen Rollennamen: Bestehende Gemeinden tragen in der Datenbank
// weiter „Hauptamt" und „Organisations-Admin" (keine Migration).

const lies = (pfad: string): string =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

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

describe('Alle Rollen-Beschriftungen lesen rollenName', () => {
  // Benutzer anlegen, Einladen, offene Einladungen, die eigene Einladung,
  // Benutzerliste, Jahrgangs-Zuweisung, Gemeinde-Verwaltung, Chat-Mitglieder,
  // Challenge-Galerie.
  const ansichten = [
    'src/components/admin/UsersView.tsx',
    'src/components/admin/OffeneEinladungen.tsx',
    'src/components/admin/modals/EinladungModal.tsx',
    'src/components/admin/modals/UserManagementModal.tsx',
    'src/components/admin/pages/AdminJahrgaengeePage.tsx',
    'src/components/admin/modals/OrganizationManagementModal.tsx',
    'src/components/chat/modals/MembersModal.tsx',
    'src/components/shared/EinladungenKarte.tsx',
    'src/components/konfi/pages/KonfiChallengeDetailPage.tsx',
  ];

  for (const pfad of ansichten) {
    it(`${pfad} beschriftet Rollen nicht mehr selbst`, () => {
      const quelle = lies(pfad);
      expect(quelle).toMatch(/import \{[^}]*\brollenName\b[^}]*\} from '(\.\.\/)+utils\/rollenNamen'/);
      // Die alten Eigenbau-Wörter.
      expect(quelle).not.toMatch(/'admin' \? 'Admin'/);
      expect(quelle).not.toMatch(/'org_admin' \? 'Org-Admin'/);
      expect(quelle).not.toMatch(/case 'admin': return 'Admin'/);
      expect(quelle).not.toMatch(/case 'org_admin': return 'Org-Admin'/);
      expect(quelle).not.toMatch(/label: 'Admin'/);
      expect(quelle).not.toMatch(/label: 'Org-Admin'/);
      expect(quelle).not.toContain('Hauptamt');
    });
  }

  it('Einladungen zeigen die Rolle nach role_name, nicht nach role_display_name', () => {
    expect(lies('src/components/admin/OffeneEinladungen.tsx'))
      .toContain('rollenName(einladung.role_name, einladung.role_display_name ?? undefined)');
    expect(lies('src/components/shared/EinladungenKarte.tsx'))
      .toContain('rollenName(e.role_name, e.role_display_name)');
  });
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
