import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { BIBLE_TRANSLATIONS } from '../../components/shared/BibleTranslationModal';

// Befund M4: Das Konfi-Profil hatte eine EIGENE Kopie des Bibeluebersetzungs-
// Modals, die RVR60 (Reina-Valera 1960) anbot — das geteilte Modal (Konfi-
// Dashboard, Teamer-Dashboard, Teamer-Profil) bot RVR60 NICHT an, obwohl das
// Backend es fuer beide Rollen akzeptiert. Diese Tests sichern ab, dass die
// geteilte Liste exakt dem entspricht, was das Backend erlaubt, und dass
// keine private Kopie mehr existiert.
//
// Nachtrag 01.09.2026: Im Backend lag die Whitelist ihrerseits DOPPELT
// (routes/konfi.js und routes/teamer.js) — die RVR60-Entfernung am 27.08.2026
// musste an beiden Stellen passieren. Sie steht jetzt nur noch in
// backend/utils/konfspruch.js. Die Tests pruefen deshalb nicht mehr nur den
// Inhalt, sondern auch, dass die Liste an genau EINER Stelle steht: Kopiert
// sie jemand spaeter wieder in eine Route, schlaegt das hier an.

const lies = (datei: string) =>
  readFileSync(resolve(process.cwd(), datei), 'utf-8');

// Die gemeinsame Whitelist aus dem Backend herausziehen —
// scheitert laut, wenn die Zeile umgebaut wird.
const BACKEND_QUELLE = '../backend/utils/konfspruch.js';

const backendListe = (datei: string): string[] => {
  const treffer = lies(datei).match(/BIBEL_UEBERSETZUNGEN = \[([^\]]+)\]/);
  expect(treffer, `${datei}: BIBEL_UEBERSETZUNGEN nicht gefunden`).not.toBeNull();
  return treffer![1].split(',').map((s) => s.trim().replace(/'/g, ''));
};

// Routen, die die Whitelist frueher als eigene Kopie trugen.
const ROUTEN_OHNE_EIGENE_LISTE = [
  '../backend/routes/konfi.js',
  '../backend/routes/teamer.js',
];

describe('Bibelübersetzungen: geteiltes Modal deckt die Backend-Liste ab', () => {
  const frontendCodes = BIBLE_TRANSLATIONS.map((t) => t.code);

  it('bietet exakt die sechs erlaubten Übersetzungen an', () => {
    expect(frontendCodes).toEqual(['LUT', 'ELB', 'GNB', 'BIGS', 'NIV', 'LSG']);
  });

  it('stimmt mit der erlaubten Liste des Backends überein', () => {
    expect([...frontendCodes].sort()).toEqual(backendListe(BACKEND_QUELLE).sort());
  });

  it('die Whitelist steht nur noch an EINER Stelle im Backend', () => {
    // Der eigentliche Drift-Schutz: Frueher trug jede der beiden Routen eine
    // eigene Kopie. Wer sie zurueckkopiert, faellt hier auf.
    ROUTEN_OHNE_EIGENE_LISTE.forEach((datei) => {
      const inhalt = lies(datei);
      expect(inhalt, `${datei}: hat wieder eine eigene validTranslations-Liste`)
        .not.toMatch(/validTranslations\s*=\s*\[/);
      expect(inhalt, `${datei}: definiert BIBEL_UEBERSETZUNGEN selbst`)
        .not.toMatch(/BIBEL_UEBERSETZUNGEN\s*=\s*\[/);
      // Die Kuerzel duerfen in der Route nicht mehr als Liste auftauchen.
      expect(inhalt, `${datei}: enthaelt die Uebersetzungs-Kuerzel wieder inline`)
        .not.toContain("'LUT', 'ELB'");
    });
  });

  it('beide Routen beziehen die Whitelist aus der gemeinsamen Quelle', () => {
    ROUTEN_OHNE_EIGENE_LISTE.forEach((datei) => {
      const inhalt = lies(datei);
      expect(inhalt, `${datei}: bindet utils/konfspruch nicht ein`)
        .toContain("require('../utils/konfspruch')");
      expect(inhalt, `${datei}: nutzt BIBEL_UEBERSETZUNGEN nicht`)
        .toContain('BIBEL_UEBERSETZUNGEN');
    });
  });

  it('die entfernte Uebersetzung RVR60 taucht nirgends mehr auf', () => {
    // Entscheidung Simon 27.08.2026: RVR60 (Reina-Valera) wird nicht angeboten.
    expect(BIBLE_TRANSLATIONS.map((t) => t.code)).not.toContain('RVR60');
    expect(backendListe(BACKEND_QUELLE)).not.toContain('RVR60');
    ROUTEN_OHNE_EIGENE_LISTE.forEach((datei) => {
      expect(lies(datei), `${datei}: nennt RVR60 wieder`).not.toContain('RVR60');
    });
  });

  it('das Konfi-Profil hat keine private Modal-Kopie mehr', () => {
    const inhalt = lies('src/components/konfi/views/ProfileView.tsx');
    expect(inhalt).toContain("from '../../shared/BibleTranslationModal'");
    // Verbotener Fall: eine lokale Komponenten-Definition wuerde die geteilte
    // Liste wieder ueberdecken.
    expect(inhalt).not.toContain('const BibleTranslationModal');
    expect(inhalt).not.toContain('Reina-Valera');
  });

  it('alle vier Einbindungsstellen nutzen das geteilte Modal', () => {
    [
      'src/components/konfi/views/ProfileView.tsx',
      'src/components/konfi/views/DashboardView.tsx',
      'src/components/teamer/pages/TeamerProfilePage.tsx',
      'src/components/teamer/pages/TeamerDashboardPage.tsx',
    ].forEach((datei) => {
      expect(lies(datei)).toContain("shared/BibleTranslationModal'");
    });
  });
});
