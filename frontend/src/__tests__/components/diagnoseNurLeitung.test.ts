import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/*
 * Diagnose-Anzeigen gehoeren nicht in die Konfi-Ansicht (24.09.2026).
 *
 * Simons Befund am Geraet: "Mitteilung pruefen ist im Konfi Profil, das muss
 * raus!" — und auf Rueckfrage: "Du kannst sie ganz weg. Bei Teamer Admin Konfi
 * einfach bei allen."
 *
 * `PushDiagnose` zeigte Push-Zustand und Token-Auszuege zum Vorlesen bei der
 * Fehlersuche. Sie hatte KEINE Rollenpruefung und erschien damit jedem Konfi.
 * Die Komponente ist geloescht.
 *
 * `AbsturzTest` (25.09.2026) ist ebenfalls weg. Der Knopf loeste absichtlich
 * einen Absturz aus, damit Crashlytics die App erstmals sieht. Das ist
 * erledigt: Android-Crashlytics ist am 25.09.2026 nachgewiesen. Simon:
 * "Button fuer Absturz kann komplett weg." Der Dienst absturzdiagnose.ts
 * bleibt -- er meldet die echten Abstuerze.
 *
 * Geprueft wird am Quelltext statt durch Rendern: Die Konfi-Profilansicht
 * haengt an einem Dutzend Kontexten, ein Rendertest waere schwer und wuerde
 * bei jeder fremden Aenderung wackeln. Dasselbe Muster nutzt schon
 * pushNavigationZiele.test.ts.
 */

const pfad = (p: string) => resolve(__dirname, p);
const lies = (p: string) => readFileSync(pfad(p), 'utf-8');

const PROFILSEITEN = [
  '../../components/konfi/views/ProfileView.tsx',
  '../../components/admin/pages/AdminSettingsPage.tsx',
  '../../components/teamer/pages/TeamerProfilePage.tsx',
];

describe('Diagnose-Anzeigen: wer sie zu sehen bekommt', () => {
  it('die Push-Diagnose gibt es nirgends mehr', () => {
    for (const datei of PROFILSEITEN) {
      if (!existsSync(pfad(datei))) continue; // Seite gibt es (noch) nicht — kein Grund zu scheitern.
      expect(lies(datei), `${datei} bindet PushDiagnose ein`).not.toContain('PushDiagnose');
    }
  });

  it('den Absturz-Test gibt es nirgends mehr', () => {
    expect(existsSync(pfad('../../components/shared/AbsturzTest.tsx'))).toBe(false);
    for (const datei of PROFILSEITEN) {
      if (!existsSync(pfad(datei))) continue;
      expect(lies(datei), `${datei} bindet AbsturzTest ein`).not.toContain('AbsturzTest');
    }
  });

  it('die Absturzdiagnose selbst bleibt', () => {
    // Weg ist nur der Knopf, der einen Absturz erzeugt -- nicht der Dienst,
    // der echte Abstuerze meldet.
    expect(existsSync(pfad('../../services/absturzdiagnose.ts'))).toBe(true);
  });
});
