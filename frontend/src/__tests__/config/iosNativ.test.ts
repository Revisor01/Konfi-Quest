import { join } from 'node:path';
import { readFileSync } from 'node:fs';
// @ts-expect-error -- 'plist' bringt keine eigenen Typen mit (kommt ueber
// Capacitor als Abhaengigkeit), wie in privacyManifest.test.ts.
import plist from 'plist';
import { describe, it, expect } from 'vitest';

/**
 * Native iOS-Einstellungen (29.09.2026, CI-Audit, Abschnitt „Unklar").
 *
 * 1. App-Symbol ohne Alphakanal. kq.png war 1024×1024 RGBA — App Store
 *    Connect verlangt das Marketing-Symbol ohne Transparenz (ITMS-90717). Der
 *    Kanal war überall 255, das Symbol also schon deckend: jetzt RGB,
 *    Pixel gleich (dekodiert gegen den alten Stand verglichen), sRGB-Angabe
 *    erhalten, 1.605.317 → 1.097.006 Bytes.
 * 2. aps-environment. App.entitlements trug nur „development“; im Export
 *    ersetzt Xcode den Wert nach dem App-Store-Profil. Jetzt steht der
 *    ausgelieferte Stand im Repo: Release (App-Store-Profil) liest
 *    AppRelease.entitlements mit „production“, Debug weiter App.entitlements.
 * 3. UIBackgroundModes: „fetch“ nutzte nichts (kein performFetch, kein
 *    BGTaskScheduler; background-task braucht keinen Modus). Es bleibt
 *    „remote-notification“ — der Server schickt content-available.
 * 4. Dateifreigabe. Mit UIFileSharingEnabled, LSSupportsOpeningDocumentsInPlace
 *    und UISupportsDocumentBrowser lag der Documents-Ordner der App offen in
 *    der Dateien-App und im Finder — auch bei aktiver App-Sperre. Dort liegen
 *    auf iOS die wartenden Uploads (Directory.Data = Documents:
 *    queue-uploads/ mit Fotos aus Anträgen und Chat-Anhängen). Keine Funktion
 *    braucht die Freigabe: Sichern läuft über das Teilen-Blatt.
 */
const IOS = join(process.cwd(), 'ios/App');
const lies = (pfad: string) => readFileSync(join(IOS, pfad));
const plistLesen = (pfad: string) => plist.parse(lies(pfad).toString('utf8')) as Record<string, unknown>;

/** Die Build-Einstellungen einer XCBuildConfiguration des Ziels App. */
function einstellungen(name: 'Debug' | 'Release'): string {
  const pbx = lies('App.xcodeproj/project.pbxproj').toString('utf8');
  const bloecke = [...pbx.matchAll(/\/\* (Debug|Release) \*\/ = \{\s*isa = XCBuildConfiguration;[\s\S]*?\n\t\t\};/g)]
    .map((m) => m[0])
    // Nur das Ziel App (traegt INFOPLIST_FILE), nicht die Projekt-Ebene.
    .filter((b) => b.includes('INFOPLIST_FILE = App/Info.plist;') && b.includes(`name = ${name};`));
  expect(bloecke.length).toBe(1);
  return bloecke[0];
}

describe('iOS: App-Symbol', () => {
  it('kq.png ist 1024×1024, 8 Bit, RGB ohne Alphakanal', () => {
    const png = lies('App/Assets.xcassets/AppIcon.appiconset/kq.png');
    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(1024);
    expect(png.readUInt32BE(20)).toBe(1024);
    expect(png[24]).toBe(8); // Bittiefe
    expect(png[25]).toBe(2); // Farbtyp 2 = RGB (6 wäre RGBA)
    // Und kein tRNS-Block, der über die Hintertür Transparenz einführt.
    expect(png.includes(Buffer.from('tRNS'))).toBe(false);
  });

  it('das Asset verweist auf genau dieses Bild', () => {
    const inhalt = JSON.parse(lies('App/Assets.xcassets/AppIcon.appiconset/Contents.json').toString('utf8'));
    expect(inhalt.images).toEqual([expect.objectContaining({ filename: 'kq.png', size: '1024x1024' })]);
  });
});

describe('iOS: aps-environment je Konfiguration', () => {
  it('Release (App-Store-Profil) signiert mit production', () => {
    const release = einstellungen('Release');
    expect(release).toContain('PROVISIONING_PROFILE_SPECIFIER = "Konfi Quest AppStore CI";');
    expect(release).toContain('CODE_SIGN_ENTITLEMENTS = App/AppRelease.entitlements;');
    expect(plistLesen('App/AppRelease.entitlements')['aps-environment']).toBe('production');
  });

  it('Debug (Xcode am Gerät) bleibt bei development', () => {
    expect(einstellungen('Debug')).toContain('CODE_SIGN_ENTITLEMENTS = App/App.entitlements;');
    expect(plistLesen('App/App.entitlements')['aps-environment']).toBe('development');
  });

  it('beide Dateien tragen dieselben Berechtigungen — nur der Push-Wert unterscheidet sich', () => {
    // Wer eine Fähigkeit ergänzt (etwa Associated Domains), muss sie in
    // BEIDE Dateien schreiben, sonst fehlt sie im Store-Build.
    const debug = plistLesen('App/App.entitlements');
    const release = plistLesen('App/AppRelease.entitlements');
    expect(Object.keys(release).sort()).toEqual(Object.keys(debug).sort());
    for (const k of Object.keys(debug).filter((k) => k !== 'aps-environment')) {
      expect(release[k], k).toEqual(debug[k]);
    }
  });
});

describe('iOS: Info.plist', () => {
  const info = plistLesen('App/Info.plist');

  it('Hintergrund nur für Push-Mitteilungen, kein ungenutztes fetch', () => {
    expect(info.UIBackgroundModes).toEqual(['remote-notification']);
    // remote-notification wird gebraucht: Der Server schickt content-available.
    const server = readFileSync(join(process.cwd(), '../backend/push/firebase.js'), 'utf8');
    expect(server).toContain("'content-available': 1");
  });

  it('der Documents-Ordner ist nicht in der Dateien-App freigegeben', () => {
    expect(info.UIFileSharingEnabled ?? false).toBe(false);
    expect(info.LSSupportsOpeningDocumentsInPlace ?? false).toBe(false);
    expect(info.UISupportsDocumentBrowser ?? false).toBe(false);
  });
});
