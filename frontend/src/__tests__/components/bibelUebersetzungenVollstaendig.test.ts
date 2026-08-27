import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { BIBLE_TRANSLATIONS, getTranslationName } from '../../components/shared/BibleTranslationModal';

// Befund M4: Das Konfi-Profil hatte eine EIGENE Kopie des Bibeluebersetzungs-
// Modals, die RVR60 (Reina-Valera 1960) anbot — das geteilte Modal (Konfi-
// Dashboard, Teamer-Dashboard, Teamer-Profil) bot RVR60 NICHT an, obwohl das
// Backend es fuer beide Rollen akzeptiert. Diese Tests sichern ab, dass die
// geteilte Liste exakt dem entspricht, was das Backend erlaubt, und dass
// keine private Kopie mehr existiert.

const lies = (datei: string) =>
  readFileSync(resolve(process.cwd(), datei), 'utf-8');

// Die validTranslations-Liste aus einer Backend-Route herausziehen —
// scheitert laut, wenn die Zeile umgebaut wird.
const backendListe = (datei: string): string[] => {
  const treffer = lies(datei).match(/validTranslations = \[([^\]]+)\]/);
  expect(treffer, `${datei}: validTranslations nicht gefunden`).not.toBeNull();
  return treffer![1].split(',').map((s) => s.trim().replace(/'/g, ''));
};

describe('Bibelübersetzungen: geteiltes Modal deckt die Backend-Liste ab', () => {
  const frontendCodes = BIBLE_TRANSLATIONS.map((t) => t.code);

  it('bietet exakt die sechs erlaubten Übersetzungen an', () => {
    expect(frontendCodes).toEqual(['LUT', 'ELB', 'GNB', 'BIGS', 'NIV', 'LSG']);
  });

  it('stimmt mit den erlaubten Übersetzungen der Konfi-Route überein', () => {
    expect([...frontendCodes].sort()).toEqual(
      backendListe('../backend/routes/konfi.js').sort()
    );
  });

  it('stimmt mit den erlaubten Übersetzungen der Teamer-Route überein', () => {
    expect([...frontendCodes].sort()).toEqual(
      backendListe('../backend/routes/teamer.js').sort()
    );
  });

it('die entfernte Uebersetzung RVR60 taucht nirgends mehr auf', () => {
    // Entscheidung Simon 27.08.2026: RVR60 (Reina-Valera) wird nicht angeboten.
    expect(BIBLE_TRANSLATIONS.map((t) => t.code)).not.toContain('RVR60');
    expect(backendListe('../backend/routes/konfi.js')).not.toContain('RVR60');
    expect(backendListe('../backend/routes/teamer.js')).not.toContain('RVR60');
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
