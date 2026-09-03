import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Simons Vorgaben 03.09.2026 fuer die Profile von Konfi und Team:
//   Stats, Info-Hinweise (optional), Konfirmation (optional), Rueckblick,
//   Einstellungen.
// Dazu: Die Konfirmations-Karte verschwindet ganz, wenn kein Termin gebucht
// ist -- vorher stand dort eine graue Karte, die nur "Noch kein Termin
// gebucht" sagte.
// Und: "Wrapped" heisst in der Oberflaeche "Jahresrueckblick"; eine Ausgabe
// traegt den Namen, den die Leitung vergeben hat.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const konfiProfil = lies('src/components/konfi/views/ProfileView.tsx');
const teamerProfil = lies('src/components/teamer/pages/TeamerProfilePage.tsx');
const konfiDashboard = lies('src/components/konfi/pages/KonfiDashboardPage.tsx');

const pos = (quelle: string, marke: string): number => {
  const i = quelle.indexOf(marke);
  expect(i, `nicht gefunden: ${marke}`).toBeGreaterThan(-1);
  return i;
};

describe('Rueckblick steht vor den Einstellungen', () => {
  it('Konfi: nach den Neuerungs-Bannern, vor den Konto-Einstellungen', () => {
    const banner = pos(konfiProfil, '<NeuerungenBanner');
    const wrapped = pos(konfiProfil, '{/* Meine Wrappeds');
    const settings = pos(konfiProfil, '{/* Konto-Einstellungen');
    expect(wrapped).toBeGreaterThan(banner);
    expect(wrapped).toBeLessThan(settings);
  });

  it('Team: nach den Neuerungs-Bannern, vor den Konto-Einstellungen', () => {
    const banner = pos(teamerProfil, '<NeuerungenBanner');
    const wrapped = pos(teamerProfil, '{/* Meine Wrappeds');
    const settings = pos(teamerProfil, '{/* B. Konto-Einstellungen');
    expect(wrapped).toBeGreaterThan(banner);
    expect(wrapped).toBeLessThan(settings);
  });
});

describe('Konfirmations-Karte nur mit gebuchtem Termin', () => {
  it('die Karte haengt an confirmation_date', () => {
    expect(konfiProfil).toContain('{profile.confirmation_date && (');
  });

  it('sie steht vor dem Rueckblick', () => {
    expect(pos(konfiProfil, '{profile.confirmation_date && ('))
      .toBeLessThan(pos(konfiProfil, '{/* Meine Wrappeds'));
  });
});

describe('Wortwahl: Jahresrueckblick statt Wrapped', () => {
  it('die Startseite nennt nicht mehr "Dein Wrapped ist da"', () => {
    expect(konfiDashboard).not.toContain('Dein Wrapped ist da');
  });

  it('die Startseite nutzt den Namen der Ausgabe, wenn es einen gibt', () => {
    expect(konfiDashboard).toContain('dashboardData.wrapped_titel');
    expect(konfiDashboard).toContain('Dein Jahresrückblick ist da!');
  });

  it.each([
    ['Konfi', konfiProfil],
    ['Team', teamerProfil],
  ])('%s-Profil ueberschreibt den Abschnitt mit "Meine Rückblicke"', (_r, quelle) => {
    expect(quelle).toContain('Meine Rückblicke');
    expect(quelle).not.toContain('<IonLabel>Meine Wrappeds</IonLabel>');
  });

  it.each([
    ['Konfi', konfiProfil],
    ['Team', teamerProfil],
  ])('%s-Profil zeigt den Titel der Ausgabe statt "Konfi-Wrapped 2026"', (_r, quelle) => {
    expect(quelle).toContain('entry.titel');
    expect(quelle).not.toContain("'Konfi-Wrapped' : 'Teamer-Wrapped'");
  });
});

describe('Der Hinweis auf der Startseite laesst sich wegklicken', () => {
  it('es gibt einen Ausblenden-Knopf', () => {
    expect(konfiDashboard).toContain('aria-label="Hinweis ausblenden"');
    expect(konfiDashboard).toContain('wrappedHinweisAusblenden');
  });

  it('das Wegklicken wird pro AUSGABE gemerkt, nicht ein fuer alle Mal', () => {
    // Sonst bliebe auch der naechste Rueckblick fuer immer verborgen.
    expect(konfiDashboard).toContain('wrapped_ausgabe_id');
    expect(konfiDashboard).toMatch(/wrapped_hinweis_.*wrapped_ausgabe_id/s);
  });

  it('der Knopf oeffnet nicht versehentlich den Rueckblick', () => {
    // stopPropagation, sonst zieht der Klick die Karte mit.
    const block = konfiDashboard.slice(
      pos(konfiDashboard, 'aria-label="Hinweis ausblenden"'),
      pos(konfiDashboard, 'aria-label="Hinweis ausblenden"') + 300
    );
    expect(block).toContain('e.stopPropagation()');
  });
});
