import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

/**
 * Apples Privacy Manifest der iOS-App (ios/App/App/PrivacyInfo.xcprivacy).
 *
 * Simon (26.09.2026): "Muessen wir nicht auch noch ne privacyinfo schreiben
 * wegen umami?" -- Die Datei gab es schon, sie nannte aber nur den
 * Dateizeitstempel. Was die App selbst erhebt, stand nirgends:
 *
 *  - Umami (services/analytics.ts) misst Seitenaufrufe, Bereichswechsel,
 *    Handlungen und Fehlerstellen. Ohne Nutzer-ID, ohne Cookie, an eine
 *    selbst gehostete Instanz, keine Weitergabe -> "Product Interaction"
 *    und "Other Diagnostic Data", nicht verknuepft, kein Tracking.
 *  - Der Push-Token geht an /notifications/device-token und haengt am
 *    Konto -> "Device ID", verknuepft, nur fuer die App-Funktion.
 *  - @capacitor/preferences (UserDefaults) und @capacitor/filesystem
 *    (Dateizeitstempel) bringen kein eigenes Manifest mit; die App muss
 *    deren Required-Reason-APIs selbst begruenden (CA92.1, C617.1).
 *
 * Firebase-Pods (Crashlytics, Messaging, Installations) liefern eigene
 * Manifeste mit; die werden hier absichtlich nicht doppelt gefuehrt.
 *
 * Gelesen wird ueber plutil -> JSON, damit ein kaputtes Plist als solches
 * faellt und nicht als "Schluessel fehlt".
 */
const MANIFEST = join(process.cwd(), 'ios/App/App/PrivacyInfo.xcprivacy');

type Manifest = {
  NSPrivacyTracking?: boolean;
  NSPrivacyTrackingDomains?: string[];
  NSPrivacyCollectedDataTypes?: Array<{
    NSPrivacyCollectedDataType: string;
    NSPrivacyCollectedDataTypeLinked: boolean;
    NSPrivacyCollectedDataTypeTracking: boolean;
    NSPrivacyCollectedDataTypePurposes: string[];
  }>;
  NSPrivacyAccessedAPITypes?: Array<{
    NSPrivacyAccessedAPIType: string;
    NSPrivacyAccessedAPITypeReasons: string[];
  }>;
};

function lesen(): Manifest {
  const json = execFileSync('plutil', ['-convert', 'json', '-o', '-', MANIFEST], { encoding: 'utf8' });
  return JSON.parse(json);
}

const datentyp = (m: Manifest, typ: string) =>
  m.NSPrivacyCollectedDataTypes?.find((d) => d.NSPrivacyCollectedDataType === typ);
const api = (m: Manifest, typ: string) =>
  m.NSPrivacyAccessedAPITypes?.find((a) => a.NSPrivacyAccessedAPIType === typ);

describe('Privacy Manifest der iOS-App (PrivacyInfo.xcprivacy)', () => {
  it('ist ein gueltiges Plist und liegt im Xcode-Projekt als Ressource', () => {
    expect(() => execFileSync('plutil', ['-lint', MANIFEST])).not.toThrow();
    const pbxproj = readFileSync(join(process.cwd(), 'ios/App/App.xcodeproj/project.pbxproj'), 'utf8');
    expect(pbxproj).toContain('PrivacyInfo.xcprivacy in Resources');
  });

  it('erklaert ausdruecklich: kein Tracking, keine Tracking-Domains', () => {
    const m = lesen();
    expect(m.NSPrivacyTracking).toBe(false);
    expect(m.NSPrivacyTrackingDomains).toEqual([]);
  });

  it('Umami: Bedienung und Fehlerstellen als Analyse, nicht verknuepft, kein Tracking', () => {
    const m = lesen();
    for (const typ of ['NSPrivacyCollectedDataTypeProductInteraction', 'NSPrivacyCollectedDataTypeOtherDiagnosticData']) {
      const d = datentyp(m, typ);
      expect(d, typ).toBeDefined();
      expect(d!.NSPrivacyCollectedDataTypeLinked).toBe(false);
      expect(d!.NSPrivacyCollectedDataTypeTracking).toBe(false);
      expect(d!.NSPrivacyCollectedDataTypePurposes).toEqual(['NSPrivacyCollectedDataTypePurposeAnalytics']);
    }
  });

  it('Push-Token: Geraete-Kennung am Konto, nur fuer die App-Funktion, kein Tracking', () => {
    const d = datentyp(lesen(), 'NSPrivacyCollectedDataTypeDeviceID');
    expect(d).toBeDefined();
    expect(d!.NSPrivacyCollectedDataTypeLinked).toBe(true);
    expect(d!.NSPrivacyCollectedDataTypeTracking).toBe(false);
    expect(d!.NSPrivacyCollectedDataTypePurposes).toEqual(['NSPrivacyCollectedDataTypePurposeAppFunctionality']);
  });

  it('nichts im Manifest ist als Tracking markiert -- sonst muesste NSPrivacyTracking true sein', () => {
    const m = lesen();
    expect(m.NSPrivacyCollectedDataTypes!.filter((d) => d.NSPrivacyCollectedDataTypeTracking)).toHaveLength(0);
    expect(m.NSPrivacyCollectedDataTypes).toHaveLength(3);
  });

  it('begruendet die Required-Reason-APIs der Plugins ohne eigenes Manifest', () => {
    const m = lesen();
    expect(api(m, 'NSPrivacyAccessedAPICategoryUserDefaults')?.NSPrivacyAccessedAPITypeReasons).toEqual(['CA92.1']);
    expect(api(m, 'NSPrivacyAccessedAPICategoryFileTimestamp')?.NSPrivacyAccessedAPITypeReasons).toEqual(['C617.1']);
    expect(m.NSPrivacyAccessedAPITypes).toHaveLength(2);
  });
});
