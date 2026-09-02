import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund (27.08.2026): Die beiden Neuerungs-Karten stecken laengst in EINEM
// Bauteil (shared/NeuerungenBanner). Trotzdem stand auf der Startseite der
// Leitung nur die "Was ist neu"-Karte -- handgebaut aus UpdateHinweisKarte,
// ohne die Mitmachen-Karte. Genau die Drift, die drei getrennte
// Komponentenbaeume (siehe CLAUDE.md) immer wieder erzeugen.
//
// Warum als Dateitest und nicht als Rendertest: Der Befund ist, dass eine
// Anzeige in EINEM der drei Baeume FEHLT. Ein Rendertest der jeweils anderen
// Ansicht wuerde das nie bemerken.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

// Die drei Startseiten -- je Rolle die Seite, auf der man nach dem Login landet.
// Fuer die Leitung ist das /admin/konfis (MainTabs leitet "/" und "/admin"
// dorthin um), nicht eine Dashboard-Seite.
const startseiten: Array<[string, string]> = [
  ['Leitung', lies('src/components/admin/pages/AdminKonfisPage.tsx')],
  ['Teamer:in', lies('src/components/teamer/pages/TeamerDashboardPage.tsx')],
  ['Konfi', lies('src/components/konfi/pages/KonfiDashboardPage.tsx')]
];

// Profil bzw. "Mehr" -- dort stehen dieselben Karten dauerhaft, ohne X.
const dauerhaft: Array<[string, string]> = [
  ['Leitung ("Mehr")', lies('src/components/admin/pages/AdminSettingsPage.tsx')],
  ['Teamer:in (Profil)', lies('src/components/teamer/pages/TeamerProfilePage.tsx')],
  ['Konfi (Profil)', lies('src/components/konfi/views/ProfileView.tsx')]
];

describe('Neuerungs-Karten stehen auf ALLEN drei Startseiten', () => {
  it.each(startseiten)('%s sieht das Banner auf der Startseite', (_rolle, quelle) => {
    expect(quelle).toContain("from '../../shared/NeuerungenBanner'");
    expect(quelle).toContain('<NeuerungenBanner');
  });

  it.each(startseiten)('%s: keine handgebaute Einzelkarte mehr', (_rolle, quelle) => {
    // Wer eine der beiden Karten direkt einbindet, umgeht das gemeinsame
    // Bauteil -- und genau so ist die Mitmachen-Karte bei der Leitung
    // verlorengegangen.
    expect(quelle).not.toContain('<UpdateHinweisKarte');
    expect(quelle).not.toContain('<MitmachenHinweisKarte');
  });

  it.each(startseiten)('%s kann beide Karten wegklicken', (_rolle, quelle) => {
    // Auf der Startseite ist das Banner wegklickbar (X). Fehlen die
    // Ausblenden-Handler, steht die Karte dort fuer immer.
    expect(quelle).toContain('onUpdateAusblenden={markUpdateHinweisGesehen}');
    expect(quelle).toContain('onMitmachenAusblenden={markMitmachenHinweisGesehen}');
  });

  it.each(startseiten)('%s haengt die Sichtbarkeit an den Onboarding-Hook', (_rolle, quelle) => {
    // Ohne diese Flags stuenden die Karten bei JEDEM Start wieder da --
    // auch bei Leuten, die sie laengst weggeklickt haben.
    expect(quelle).toContain('useOnboardingWithUpdateOnce');
    expect(quelle).toContain('updateSichtbar={showUpdateHinweis}');
    expect(quelle).toContain('mitmachenSichtbar={showMitmachenHinweis}');
  });

  it.each(startseiten)('%s hat zu beiden Karten ein Ziel', (_rolle, quelle) => {
    // Eine Karte, die nichts oeffnet, ist eine Sackgasse. Jede Rolle hat einen
    // eigenen Walkthrough; die Mitmachen-Erklaerung ist fuer alle dieselbe.
    expect(quelle).toMatch(/setShowUpdateWalkthrough\(true\)/);
    // Der Walkthrough traegt seit 2.1.1 die Version im Namen
    // (KonfiUpdate211WalkthroughModal). Das Muster nimmt beide Formen mit,
    // damit die naechste Version hier nicht wieder haengen bleibt.
    expect(quelle).toMatch(/Update\d*WalkthroughModal/);
    expect(quelle).toContain('MitmachenErklaerungModal');
    expect(quelle).toMatch(/setShowMitmachenErklaerung\(true\)/);
  });
});

describe('Im Profil und unter "Mehr" stehen die Karten dauerhaft', () => {
  it.each(dauerhaft)('%s bindet dasselbe Bauteil ein', (_rolle, quelle) => {
    expect(quelle).toContain('<NeuerungenBanner');
  });

  it.each(dauerhaft)('%s zeigt sie ohne X', (_rolle, quelle) => {
    // Dort sind sie der feste Weg zu den Erklaerungen (Nutzerhinweis
    // 23.08.2026) -- ein X waere eine Sackgasse ohne Rueckweg.
    const block = quelle.slice(quelle.indexOf('<NeuerungenBanner'));
    const ende = block.indexOf('/>');
    const props = block.slice(0, ende);
    expect(props).not.toContain('Ausblenden');
    expect(props).not.toContain('Sichtbar');
  });
});
