// Googles In-App-Updates: das Plugin ist NUR auf Android eingebunden
// (capacitor.config.ts, 09.10.2026). iOS bleibt beim bisherigen Hinweis und
// soll keinen neuen Pod bekommen.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import config from '../../../capacitor.config';

const PLUGIN = '@capawesome/capacitor-app-update';
const lies = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8');

describe('In-App-Updates nur auf Android', () => {
  it('Android bindet alle gemeinsamen Plugins (ohne status-bar) und zusaetzlich das Update-Plugin ein', () => {
    // status-bar fehlt auf Android bewusst (androidOhneStatusBar.test.ts).
    expect(config.android?.includePlugins).toEqual([
      ...(config.includePlugins ?? []).filter((p) => p !== '@capacitor/status-bar'),
      PLUGIN,
    ]);
  });

  it('die gemeinsame Liste (gilt fuer iOS) enthaelt das Plugin nicht, iOS hat keine eigene Liste', () => {
    expect(config.includePlugins).not.toContain(PLUGIN);
    expect(config.ios?.includePlugins).toBeUndefined();
  });

  it('cap sync android hat das Plugin in Gradle eingetragen', () => {
    expect(lies('android/capacitor.settings.gradle')).toContain(
      "project(':capawesome-capacitor-app-update').projectDir = new File('../node_modules/@capawesome/capacitor-app-update/android')",
    );
    expect(lies('android/app/capacitor.build.gradle')).toContain(
      "implementation project(':capawesome-capacitor-app-update')",
    );
  });

  it('iOS hat keinen Pod dafuer', () => {
    expect(lies('ios/App/Podfile')).not.toContain('CapawesomeCapacitorAppUpdate');
    expect(lies('ios/App/Podfile.lock')).not.toContain('CapawesomeCapacitorAppUpdate');
  });
});
