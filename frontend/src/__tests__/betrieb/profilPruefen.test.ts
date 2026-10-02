import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Passt das App-Store-Profil zu den Berechtigungen der App? (02.10.2026)
//
// Mit den Universal Links traegt AppRelease.entitlements
// com.apple.developer.associated-domains. Erlaubt das Profil "Konfi Quest
// AppStore CI" das nicht (Faehigkeit fuer die App-ID nicht eingeschaltet oder
// Profil danach nicht neu erzeugt), bricht xcodebuild erst beim Signieren ab.
// .github/scripts/profil-pruefen.py sagt es vor dem Bau, mit der Abhilfe.
//
// Geprueft am Skript selbst, mit nachgebauten Profilen: eine XML-Plist in
// Binaerbytes eingebettet wie in der CMS-Huelle eines .mobileprovision.

const wurzel = resolve(__dirname, '../../../..');
const SKRIPT = join(wurzel, '.github/scripts/profil-pruefen.py');
const APP_RELEASE = join(wurzel, 'frontend/ios/App/App/AppRelease.entitlements');
const WORKFLOW = readFileSync(join(wurzel, '.github/workflows/ios-release.yml'), 'utf8');

let verz: string;
beforeEach(() => { verz = mkdtempSync(join(tmpdir(), 'profil-')); });
afterEach(() => { rmSync(verz, { recursive: true, force: true }); });

/** Ein Profil, das genau diese Berechtigungen erlaubt. */
function profil(berechtigungen: Record<string, string>): string {
  const eintraege = Object.entries(berechtigungen)
    .map(([k, v]) => `\t\t<key>${k}</key>\n\t\t<string>${v}</string>`)
    .join('\n');
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>Name</key>
\t<string>Konfi Quest AppStore CI</string>
\t<key>Entitlements</key>
\t<dict>
\t\t<key>application-identifier</key>
\t\t<string>J459G9CJT5.de.godsapp.konfiquest</string>
${eintraege}
\t</dict>
</dict>
</plist>`;
  const pfad = join(verz, 'Konfi Quest AppStore CI.mobileprovision');
  // Binaere Huelle davor und dahinter, wie die CMS-Signatur.
  writeFileSync(pfad, Buffer.concat([Buffer.from([0x30, 0x82, 0x2a, 0x00, 0x06, 0x09]), Buffer.from(plist), Buffer.from([0xa0, 0x82, 0x0d, 0xff])]));
  return pfad;
}

function pruefe(profilPfad: string) {
  const lauf = spawnSync('python3', [SKRIPT, profilPfad, APP_RELEASE], { encoding: 'utf-8' });
  return { code: lauf.status, aus: lauf.stdout, fehler: lauf.stderr };
}

describe('profil-pruefen.py', () => {
  it('Profil mit Push und Associated Domains: gruen', () => {
    const { code, aus } = pruefe(profil({
      'aps-environment': 'production',
      'com.apple.developer.associated-domains': '*',
    }));
    expect(code).toBe(0);
    expect(aus).toContain('erlaubt alle 2 Berechtigungen');
  });

  it('Profil von vor dem Einschalten (nur Push): rot, mit Abhilfe', () => {
    const { code, fehler } = pruefe(profil({ 'aps-environment': 'production' }));
    expect(code).toBe(1);
    expect(fehler).toContain('com.apple.developer.associated-domains (Associated Domains)');
    expect(fehler).toContain('Identifiers -> de.godsapp.konfiquest -> Associated Domains ankreuzen');
    expect(fehler).toContain('Profiles -> "Konfi Quest AppStore CI" -> Edit -> Save');
    expect(fehler).not.toContain('aps-environment');
  });

  it('kein Profil, sondern etwas anderes: rot', () => {
    const pfad = join(verz, 'kaputt.mobileprovision');
    writeFileSync(pfad, 'keine plist');
    const { code, fehler } = pruefe(pfad);
    expect(code).toBe(1);
    expect(fehler).toContain('nicht lesbar');
  });
});

describe('ios-release.yml', () => {
  it('prueft das geholte Profil gegen AppRelease.entitlements, bevor gebaut wird', () => {
    const pruefung = WORKFLOW.indexOf('python3 .github/scripts/profil-pruefen.py');
    expect(pruefung).toBeGreaterThan(WORKFLOW.indexOf('- name: Provisioning-Profil laden und installieren'));
    expect(pruefung).toBeLessThan(WORKFLOW.indexOf('- name: Archiv bauen'));
    expect(WORKFLOW).toContain(
      '"$HOME/Library/MobileDevice/Provisioning Profiles/Konfi Quest AppStore CI.mobileprovision" frontend/ios/App/App/AppRelease.entitlements',
    );
  });
});
