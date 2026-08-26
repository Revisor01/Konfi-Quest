import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Die Konfi-Onboarding-Tour war bis zur Vereinheitlichung eine 279-Zeilen-
// Vollkopie der geteilten OnboardingTour (Swiper, Rose-Positionen, Bubbles,
// Gradient — alles doppelt). Eine Korrektur an der Darstellung wirkte damit
// nur fuer zwei der drei Rollen. Diese Tests sichern ab, dass ALLE Tour- und
// Walkthrough-Modale die geteilte Komponente nutzen und keine eigene
// Swiper-Implementierung mitbringen.

const tourModale = [
  'src/components/admin/modals/AdminOnboardingModal.tsx',
  'src/components/teamer/modals/TeamerOnboardingModal.tsx',
  'src/components/konfi/modals/KonfiOnboardingModal.tsx',
  'src/components/admin/modals/AdminUpdateWalkthroughModal.tsx',
  'src/components/teamer/modals/TeamerUpdateWalkthroughModal.tsx',
  'src/components/konfi/modals/KonfiUpdateWalkthroughModal.tsx',
];

const lies = (datei: string) =>
  readFileSync(resolve(process.cwd(), datei), 'utf-8');

describe('Onboarding-Touren nutzen die geteilte OnboardingTour', () => {
  tourModale.forEach((datei) => {
    it(`${datei.split('/').pop()} rendert über die geteilte Komponente`, () => {
      const inhalt = lies(datei);
      expect(inhalt).toContain("from '../../shared/OnboardingTour'");
      // Verbotener Fall: eine eigene Render-Kopie brächte Swiper und
      // createPortal wieder in die Datei — die gehören NUR in die geteilte
      // OnboardingTour.
      expect(inhalt).not.toContain('createPortal');
      expect(inhalt).not.toContain("from 'swiper/react'");
      expect(inhalt).not.toContain('ROSE_POSITIONS');
    });
  });

  it('die Konfi-Tour behält ihre sieben eigenen Slides', () => {
    const inhalt = lies('src/components/konfi/modals/KonfiOnboardingModal.tsx');
    const titel = [...inhalt.matchAll(/title: '([^']+)'/g)].map((m) => m[1]);
    expect(titel).toEqual([
      'Konfi Quest',
      'Dein Start',
      'Dein Chat',
      'Mitmachen: Events',
      'Mitmachen: Aktivitäten',
      'Deine Badges',
      'Deine Challenges',
    ]);
  });
});
