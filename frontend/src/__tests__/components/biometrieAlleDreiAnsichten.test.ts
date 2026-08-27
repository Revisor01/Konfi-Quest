import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Der Biometrie-Schalter ist am 27.08.2026 aus ALLEN DREI Profil-Ansichten
// entfernt worden — er kommt in 2.1.0 wieder.
//
// Warum er rausgeflogen ist (Nutzerbefund beim Testen von 2.0.0):
// Der Schalter hatte keine Wirkung. Beim Wiederöffnen der App wurde keine
// Biometrie verlangt, und der Hinweis darunter versprach etwas anderes als
// der Schalter — "Angemeldet bleiben für 90 Tage" beschreibt die Laufzeit
// des gespeicherten Zugangs, nicht das, wofür ein Face-ID-Schalter da ist.
// Ein Schalter, der nichts tut, ist schlimmer als keiner.
//
// Die Komponente selbst (shared/BiometrieSchalter.tsx) und der Dienst
// (services/biometrics.ts) BLEIBEN bestehen — nur die Einbindung ist raus.
// Dieser Test haelt beides fest: keine Einbindung, aber die Bausteine sind
// noch da, damit 2.1.0 nicht bei null anfaengt.

const profilSeiten: { rolle: string; datei: string }[] = [
  { rolle: 'Leitung', datei: 'src/components/admin/pages/AdminProfilePage.tsx' },
  { rolle: 'Teamer:innen', datei: 'src/components/teamer/pages/TeamerProfilePage.tsx' },
  { rolle: 'Konfis', datei: 'src/components/konfi/views/ProfileView.tsx' },
];

describe('Biometrie-Schalter ist in 2.0.0 ueberall ausgebaut', () => {
  for (const { rolle, datei } of profilSeiten) {
    it(`${rolle}: keine Einbindung mehr in ${datei.split('/').pop()}`, () => {
      const inhalt = readFileSync(resolve(__dirname, '../../..', datei), 'utf-8');
      expect(inhalt).not.toContain('BiometrieSchalter');
    });
  }

  it('die Bausteine bleiben fuer 2.1.0 erhalten', () => {
    // Gegenprobe: Der Test darf nicht auch dann gruen sein, wenn jemand
    // Komponente und Dienst gleich mitgeloescht hat.
    for (const pfad of [
      'src/components/shared/BiometrieSchalter.tsx',
      'src/services/biometrics.ts',
    ]) {
      expect(existsSync(resolve(__dirname, '../../..', pfad))).toBe(true);
    }
  });
});
