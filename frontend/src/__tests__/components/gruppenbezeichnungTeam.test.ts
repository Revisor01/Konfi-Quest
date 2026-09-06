import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Die GRUPPE heisst in der Oberflaeche "Team", die EINZELPERSON bleibt
// "Teamer:in". Frueher stand an denselben Stellen mal das eine, mal das
// andere: das Segment in UsersView sagte schon "Team", die Kachel daneben
// noch "Teamer:in"; dieselbe Spaltung gab es im Dashboard-Einstellungen-
// Reiter und bei den Event-Zielgruppen.
//
// Komposita sind davon ausgenommen und bleiben mit "Teamer-": Teamer-Jahr,
// Teamer-Card, Teamer-Badges, Teamer-Schulung.

const lies = (pfad: string): string =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

describe('Gruppenbezeichnung: die Gruppe heisst "Team"', () => {
  it('UsersView nennt Kachel und Segment gleich', () => {
    const quelle = lies('src/components/admin/UsersView.tsx');
    expect(quelle).toContain("label: 'Team'");
    expect(quelle).toContain('subtitle="Admins, Team und Rollen"');
    expect(quelle).not.toContain("label: 'Teamer:in'");
  });

  it('KonfisView nennt Segment, Liste und Leerzustand "Team"', () => {
    const quelle = lies('src/components/admin/KonfisView.tsx');
    expect(quelle).toContain("viewMode === 'teamer' ? 'Team' : 'Konfis'");
    expect(quelle).toContain('title="Team"');
    expect(quelle).toContain("'Noch niemand im Team'");
    expect(quelle).toContain("'Im Team suchen...'");
    // Die Einzelperson bleibt: Loeschen betrifft genau eine Person.
    expect(quelle).toContain('aria-label="Teamer:in löschen"');
  });

  it('Dashboard-Einstellungen nennen Kachel und Reiter gleich', () => {
    const quelle = lies('src/components/admin/pages/AdminDashboardSettingsPage.tsx');
    expect(quelle).toContain("label: 'Team'");
    expect(quelle).toContain('<IonLabel>Team</IonLabel>');
    expect(quelle).toContain('<IonLabel>Team-Dashboard</IonLabel>');
    expect(quelle).not.toContain('<IonLabel>Teamer:innen</IonLabel>');
  });

  it('Komposita behalten "Teamer-"', () => {
    expect(lies('src/components/teamer/pages/TeamerBadgesPage.tsx'))
      .toContain('<IonTitle>Teamer-Badges</IonTitle>');
    expect(lies('src/components/admin/BadgesView.tsx'))
      .toContain("'Teamer-Jahre'");
    expect(lies('src/components/admin/pages/AdminCertificatesPage.tsx'))
      .toContain('Teamer-Card');
  });

  it('Event-Zielgruppen heissen ueberall gleich', () => {
    // Die Ecken-Marke sagte schon "Team gesucht"/"Nur Team", das Formular
    // daneben noch "Teamer:innen gesucht". Jetzt sagen beide dasselbe.
    const form = lies('src/components/admin/modals/EventFormSections.tsx');
    expect(form).toContain('>Konfis, Team gesucht<');
    expect(form).toContain('>Nur Team<');
    expect(form).toContain('<IonLabel>Team unbegrenzt</IonLabel>');

    const marke = lies('src/components/shared/EventCornerBadges.tsx');
    expect(marke).toContain("'Nur Team' : 'Team gesucht'");

    for (const pfad of [
      'src/components/admin/views/EventDetailSections.tsx',
      'src/components/teamer/pages/TeamerEventsPage.tsx',
    ]) {
      const quelle = lies(pfad);
      expect(quelle).toContain('__label">Team-Zugang<');
      expect(quelle).toContain("'Nur Team' : 'Team gesucht'");
    }
  });
});
