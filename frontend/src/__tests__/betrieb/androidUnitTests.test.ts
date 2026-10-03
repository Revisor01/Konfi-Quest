import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Die JVM-Unit-Tests der Android-App laufen in der CI (02.10.2026).
//
// AppSymbolNullTest und DateiKopieTest lagen unter
// frontend/android/app/src/test/, aber kein Workflow fuehrte sie aus:
// android-release.yml ruft nur bundleRelease. Seitdem gibt es in ci.yml den
// Job android-test. Hier steht fest, dass er da ist, vor Gradle alles
// bereitlegt, was das Projekt zum Konfigurieren braucht, und den Web-Deploy
// nicht anhaelt.

const wurzel = resolve(__dirname, '../../../..');
const ci = readFileSync(join(wurzel, '.github/workflows/ci.yml'), 'utf-8');
const ohneKommentare = (t: string) => t.split('\n').filter((z) => !z.trim().startsWith('#')).join('\n');

/** Die Jobs von ci.yml: Name und Text bis zum naechsten Job. */
function jobs(text: string): Record<string, string> {
  const teil = text.slice(text.indexOf('\njobs:\n') + '\njobs:\n'.length);
  const koepfe = [...teil.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)];
  return Object.fromEntries(koepfe.map((k, i) => [k[1], teil.slice(k.index!, i + 1 < koepfe.length ? koepfe[i + 1].index : undefined)]));
}

const TESTS = join(wurzel, 'frontend/android/app/src/test/java');

describe('CI: Android-Unit-Tests', () => {
  const job = ohneKommentare(jobs(ci)['android-test'] ?? '');

  it('ci.yml hat den Job android-test', () => {
    expect(job).not.toBe('');
  });

  it('fuehrt testDebugUnitTest im Android-Projekt aus', () => {
    expect(job).toMatch(/working-directory: frontend\/android\n\s+run: \.\/gradlew testDebugUnitTest\n/);
  });

  it('legt vorher an, was Gradle zum Konfigurieren braucht -- in dieser Reihenfolge', () => {
    // node_modules (capacitor.settings.gradle), dist-app (verlangt cap sync),
    // capacitor-cordova-android-plugins/ (legt cap sync an),
    // google-services.json (dieselbe Konfiguration wie der Release-Bau).
    const schritte = ['npm ci', 'npx vite build', 'npx cap sync android', './scripts/prepare-android.sh', './gradlew testDebugUnitTest'];
    const stellen = schritte.map((s) => job.indexOf(s));
    expect(stellen.every((s) => s >= 0), String(stellen)).toBe(true);
    expect([...stellen].sort((a, b) => a - b)).toEqual(stellen);
  });

  it('JDK 21 wie im Release-Bau', () => {
    const release = readFileSync(join(wurzel, '.github/workflows/android-release.yml'), 'utf-8');
    const java = (t: string) => t.match(/uses: actions\/setup-java@\S+ # v[\d.]+\n\s+with:\n\s+distribution: (\S+)\n\s+java-version: (\S+)/)?.slice(1);
    expect(java(job)).toEqual(['temurin', '21']);
    expect(java(job)).toEqual(java(release));
  });

  it('haelt den Web-Deploy nicht an: nicht in den needs von build-and-push', () => {
    const needs = ohneKommentare(jobs(ci)['build-and-push']).match(/needs: \[([^\]]*)\]/)?.[1].split(',').map((n) => n.trim());
    expect(needs).toEqual(['backend-test', 'frontend-test', 'e2e-test']);
  });

  it('die Tests sind die der App, keine Reste der Capacitor-Vorlage', () => {
    expect(existsSync(join(TESTS, 'com/getcapacitor'))).toBe(false);
    const eigene = readdirSync(join(TESTS, 'de/godsapp/konfiquest')).filter((d) => d.endsWith('Test.java'));
    expect(eigene).toEqual(expect.arrayContaining(['AppSymbolNullTest.java', 'DateiKopieTest.java']));
  });
});
