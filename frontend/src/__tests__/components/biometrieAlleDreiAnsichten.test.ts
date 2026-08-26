import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Die App hat drei getrennte Komponentenbaeume (Leitung, Teamer:innen, Konfis).
// Die haeufigste Falle im Projekt ist, eine Aenderung nur in einem davon zu
// machen — dann fehlt die Funktion fuer zwei Drittel der Nutzer:innen.
//
// Dieser Test prueft nicht die Darstellung (das macht biometrieSchalter.test),
// sondern nur, dass der Schalter in ALLEN DREI Profil-Ansichten eingebunden
// ist. Er schlaegt fehl, sobald jemand eine der drei Stellen entfernt oder
// eine vierte Profil-Ansicht ohne den Schalter hinzufuegt.

const profilSeiten: { rolle: string; datei: string; variante: string }[] = [
  {
    rolle: 'Leitung',
    datei: 'src/components/admin/pages/AdminProfilePage.tsx',
    variante: 'users',
  },
  {
    rolle: 'Teamer:innen',
    datei: 'src/components/teamer/pages/TeamerProfilePage.tsx',
    variante: 'teamer',
  },
  {
    rolle: 'Konfis',
    datei: 'src/components/konfi/views/ProfileView.tsx',
    variante: 'purple',
  },
];

const lies = (datei: string) =>
  readFileSync(resolve(process.cwd(), datei), 'utf-8');

describe('Biometrie-Schalter in allen drei Ansichten', () => {
  profilSeiten.forEach(({ rolle, datei, variante }) => {
    it(`ist in der Ansicht der ${rolle} eingebunden`, () => {
      const inhalt = lies(datei);
      expect(inhalt).toContain("import BiometrieSchalter from");
      expect(inhalt).toContain(`<BiometrieSchalter variante="${variante}" />`);
    });
  });

  it('nutzt in allen drei Ansichten dieselbe gemeinsame Komponente', () => {
    const pfade = profilSeiten.map(({ datei }) => {
      const treffer = lies(datei).match(
        /import BiometrieSchalter from '([^']+)'/
      );
      expect(treffer).not.toBeNull();
      // Auf den gemeinsamen Ordner normalisieren: die drei Seiten liegen
      // unterschiedlich tief, der Zielpfad muss aber derselbe sein.
      return treffer![1].replace(/^(\.\.\/)+/, '');
    });
    expect(new Set(pfade).size).toBe(1);
    expect(pfade[0]).toBe('shared/BiometrieSchalter');
  });
});
