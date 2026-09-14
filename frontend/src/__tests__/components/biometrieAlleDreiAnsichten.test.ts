import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Der ANMELDE-Schalter (Biometrie statt Passwort auf der Anmeldeseite) ist am
// 27.08.2026 aus allen drei Profil-Ansichten entfernt worden und bleibt draussen.
//
// Warum er rausgeflogen ist (Nutzerbefund beim Testen von 2.0.0):
// Der Schalter hatte keine sichtbare Wirkung. Beim Wiederöffnen der App wurde
// keine Biometrie verlangt — er greift naemlich nur auf der Anmeldeseite, und
// wer angemeldet bleibt (der Normalfall, 90 Tage), kommt dort nie vorbei.
//
// GENAU DIESE LUECKE schliesst seitdem die APP-SPERRE (shared/AppSperreSchalter,
// services/appSperre): ein Schloss vor der bereits angemeldeten App. Sie ist
// etwas anderes als der Anmelde-Weg hier und steht in allen drei Ansichten —
// festgehalten in appSperreSchalter.test.tsx.
//
// Die Komponente (shared/BiometrieSchalter.tsx) und der Dienst
// (services/biometrics.ts) BLEIBEN bestehen: die App-Sperre nutzt aus dem
// Dienst die Verfuegbarkeitspruefung. Dieser Test haelt beides fest — keine
// Einbindung des Anmelde-Schalters, aber die Bausteine sind da.

const profilSeiten: { rolle: string; datei: string }[] = [
  { rolle: 'Leitung', datei: 'src/components/admin/pages/AdminProfilePage.tsx' },
  { rolle: 'Teamer:innen', datei: 'src/components/teamer/pages/TeamerProfilePage.tsx' },
  { rolle: 'Konfis', datei: 'src/components/konfi/views/ProfileView.tsx' },
];

describe('Der Anmelde-Schalter bleibt ueberall ausgebaut', () => {
  for (const { rolle, datei } of profilSeiten) {
    it(`${rolle}: keine Einbindung mehr in ${datei.split('/').pop()}`, () => {
      const inhalt = readFileSync(resolve(__dirname, '../../..', datei), 'utf-8');
      // Gezielt der Anmelde-Schalter: AppSperreSchalter steht dort sehr wohl
      // und darf hier nicht mitgefangen werden.
      expect(inhalt).not.toMatch(/(?<!App)(?<!AppSperre)\bBiometrieSchalter\b/);
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
