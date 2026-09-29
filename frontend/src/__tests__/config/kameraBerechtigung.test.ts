import { join } from 'node:path';
import { readFileSync } from 'node:fs';
// @ts-expect-error -- 'plist' bringt keine eigenen Typen mit (kommt ueber
// Capacitor als Abhaengigkeit).
import plist from 'plist';
import { describe, it, expect } from 'vitest';

/**
 * Kamera-Berechtigung: der Text nennt, wofuer die App die Kamera braucht
 * (Audit 26.09.2026, CI/Deployment/Store BF-18).
 *
 * iOS zeigt NSCameraUsageDescription in der Rueckfrage beim ersten Zugriff.
 * Der Text nannte nur "Fotos fuer Chat-Nachrichten und Challenge-Beitraege" --
 * wer beim Einchecken zum ersten Mal den QR-Scanner oeffnet
 * (QRScannerModal, qr-scanner), las also etwas, das nicht zur Lage passt.
 * Apple verlangt einen vollstaendigen Zweck (Guideline 5.1.1).
 *
 * Android zeigt bei der Kamera nur den Systemtext ("... erlauben, Bilder und
 * Videos aufzunehmen?"); eine eigene Begruendung gibt es dort nicht. Geprueft
 * wird, dass die Berechtigung deklariert und die Kamera kein Muss ist.
 *
 * Der Waechter koppelt den Text an den Code: Nutzt die App die Kamera fuer
 * den QR-Scanner und fuer Fotos (verstecktes Dateifeld mit image/*, iOS bietet
 * dort "Foto aufnehmen" an), muss der Text beides nennen.
 */
const wurzel = process.cwd();
const lies = (pfad: string) => readFileSync(join(wurzel, pfad), 'utf8');

const infoPlist = plist.parse(lies('ios/App/App/Info.plist')) as Record<string, string>;
const kameraText = infoPlist.NSCameraUsageDescription;

describe('Kamera-Berechtigung', () => {
  it('iOS: der Text nennt den QR-Scanner beim Einchecken', () => {
    expect(lies('src/components/konfi/modals/QRScannerModal.tsx')).toContain("from 'qr-scanner'");
    expect(kameraText).toMatch(/QR-Codes/);
    expect(kameraText).toMatch(/Einchecken/);
  });

  it('iOS: der Text nennt die Fotos fuer Chat, Challenges und Aktivitaeten', () => {
    expect(kameraText).toMatch(/Fotos/);
    expect(kameraText).toMatch(/Chat/);
    expect(kameraText).toMatch(/Challenge/);
    expect(kameraText).toMatch(/Aktivitäten/);
  });

  it('iOS: der Text ist Deutsch mit echten Umlauten und endet mit einem Punkt', () => {
    expect(kameraText).toMatch(/benötigt/);
    expect(kameraText).not.toMatch(/oe|ae|ue/);
    expect(kameraText.trim().endsWith('.')).toBe(true);
  });

  it('Android: Kamera deklariert, aber kein Muss fuer die Installation', () => {
    const manifest = lies('android/app/src/main/AndroidManifest.xml');
    expect(manifest).toContain('<uses-permission android:name="android.permission.CAMERA" />');
    expect(manifest).toContain('<uses-feature android:name="android.hardware.camera" android:required="false" />');
  });
});
