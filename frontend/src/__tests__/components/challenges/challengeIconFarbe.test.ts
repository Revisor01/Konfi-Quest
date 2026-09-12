import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund (Simon, 12.09.2026): In einer Challenge trugen die Icons unter den
// Reitern "Meins" und "Abgelehnt" nicht die Challenge-Farbe. Der Leerzustand
// der Beitragsliste in der Leitungs-Ansicht zog sein Icon aus
// --app-color-teamer (#be185d, Pink) statt aus --app-color-challenges
// (#4f46e5, Indigo). Sichtbar wurde es in jedem leeren Reiter -- "Meins" und
// "Abgelehnt" sind die, die am haeufigsten leer sind.
//
// Die Konfi-Ansicht derselben Challenge war schon richtig verdrahtet; nur die
// Leitungs-Ansicht wich ab. Genau diese stille Abweichung haelt der Test fest.
//
// Geprueft wird an der Quelldatei: Die Farbe steht als Prop im JSX eines
// Modals, das Kontexte, Router und einen geladenen Challenge-Datensatz
// braucht. Es zu rendern fuehrte mehr Annahmen ein, als der Test absichert --
// dieselbe Begruendung wie in eingereichtBadgeGleich.test.ts.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

/**
 * Quelltext ohne Kommentare. Kommentare duerfen alte Tokens nennen, sie
 * erklaeren die Historie -- sonst schlaegt der Test auf seine eigene
 * Dokumentation an (das ist am 05.09.2026 schon einmal passiert).
 */
const ohneKommentare = (quelle: string): string =>
  quelle
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((zeile) => {
      const m = zeile.match(/(?<!:)\/\/(?!\/)/);
      return m && m.index !== undefined ? zeile.slice(0, m.index) : zeile;
    })
    .join('\n');

const leitungModal = ohneKommentare(
  lies('src/components/admin/modals/ChallengeLeitungModal.tsx')
);
const konfiModal = ohneKommentare(
  lies('src/components/konfi/modals/ChallengeDetailModal.tsx')
);

/** Alle Werte von iconColor= / emptyIconColor= in einer Quelldatei. */
const iconFarben = (quelle: string): string[] =>
  [...quelle.matchAll(/(?:empty)?[iI]conColor="([^"]+)"/g)].map((m) => m[1]);

describe('Challenge-Icons tragen die Challenge-Farbe', () => {
  it('die Leitungs-Ansicht faerbt ihr Leerzustands-Icon mit dem Challenge-Token', () => {
    // Der eigentliche Befund. Diese Stelle bedient alle vier Reiter
    // ("Feed", "Wartet", "Abgelehnt", "Meins") -- sie stand auf
    // var(--app-color-teamer).
    expect(iconFarben(leitungModal)).toEqual(['var(--app-color-challenges)']);
  });

  it('die Leitungs-Ansicht nutzt kein fremdes Rollen-Token mehr', () => {
    // Gegenprobe zum Befund: Wer das Token zurueckdreht, faellt hier.
    expect(leitungModal).not.toContain('--app-color-teamer');
    expect(leitungModal).not.toContain('--app-color-konfis');
  });

  it('die Konfi-Ansicht bleibt beim Challenge-Token', () => {
    // Diese Seite war richtig und darf nicht mitwandern. Beide Leerzustaende
    // ("Meins" und Galerie) ziehen dieselbe Farbe.
    expect(iconFarben(konfiModal)).toEqual([
      'var(--app-color-challenges)',
      'var(--app-color-challenges)',
    ]);
  });

  it('beide Ansichten setzen ihre Abschnitts-Icons auf die Challenge-Klasse', () => {
    expect(leitungModal).toContain('app-section-icon--challenges');
    expect(konfiModal).toContain('app-section-icon--challenges');
  });

  it('das Challenge-Token traegt genau eine Farbe, und zwar Indigo', () => {
    // Damit der Test nicht bloss "irgendein Token" festhaelt: Die Farbe
    // selbst steht in variables.css und wird von theme/colors.ts gespiegelt.
    expect(lies('src/theme/variables.css')).toContain('--app-color-challenges: #4f46e5;');
  });
});
