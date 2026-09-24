import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
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
 * `AbsturzTest` bleibt: Er blendet sich SELBST aus (nur super_admin, nur in
 * der App, siehe AbsturzTest.tsx) und wird zum Pruefen der Absturzmeldung
 * gebraucht.
 *
 * Geprueft wird am Quelltext statt durch Rendern: Die Konfi-Profilansicht
 * haengt an einem Dutzend Kontexten, ein Rendertest waere schwer und wuerde
 * bei jeder fremden Aenderung wackeln. Dasselbe Muster nutzt schon
 * pushNavigationZiele.test.ts.
 */

const lies = (pfad: string) =>
  readFileSync(resolve(__dirname, pfad), 'utf-8');

describe('Diagnose-Anzeigen: wer sie zu sehen bekommt', () => {
  it('die Push-Diagnose gibt es nirgends mehr', () => {
    for (const datei of [
      '../../components/konfi/views/ProfileView.tsx',
      '../../components/admin/pages/AdminSettingsPage.tsx',
      '../../components/teamer/pages/TeamerProfilePage.tsx',
    ]) {
      let quelle: string;
      try {
        quelle = lies(datei);
      } catch {
        continue; // Seite gibt es (noch) nicht — kein Grund zu scheitern.
      }
      expect(quelle, `${datei} bindet PushDiagnose ein`).not.toContain('PushDiagnose');
    }
  });

  it('der Absturz-Test steht nur in den Leitungs-Einstellungen', () => {
    const leitung = lies('../../components/admin/pages/AdminSettingsPage.tsx');
    expect(leitung).toContain('<AbsturzTest');

    const konfi = lies('../../components/konfi/views/ProfileView.tsx');
    expect(konfi).not.toContain('AbsturzTest');
  });

  it('der Absturz-Test sperrt sich selbst auf super_admin', () => {
    // Die Einbaustelle allein genuegt nicht: Ein Knopf, der die App abschiesst,
    // braucht seine eigene Sperre. Faellt das hier, ist die Sperre weg.
    const quelle = lies('../../components/shared/AbsturzTest.tsx');
    expect(quelle).toContain('is_super_admin');
    expect(quelle).toContain('isNativePlatform');
  });
});
