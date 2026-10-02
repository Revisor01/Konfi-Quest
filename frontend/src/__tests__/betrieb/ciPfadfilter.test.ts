import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Der paths-Filter der CI (push auf main) muss alles nennen, was die Jobs
// lesen (29.09.2026, Audit CI BF-17). Fehlt eine Stelle, loest eine Aenderung
// NUR dort keinen Lauf aus -- kein Test, kein Image, kein Deploy, und nichts
// meldet es. Der Kommentar im Filter nennt zwei solche Faelle (scripts/ am
// 24.08., e2e/ am 05.09.2026); die Wurzel-package.json fuer den E2E-Job war
// der dritte, docs/screenshots/ fuer die Handbuch-Pruefung der vierte
// (02.10.2026).

const wurzel = resolve(__dirname, '../../../..');
const ci = readFileSync(join(wurzel, '.github/workflows/ci.yml'), 'utf-8');

/** Die Muster unter on.push.paths. */
function pushPfade(): string[] {
  const block = ci.slice(ci.indexOf('\n  push:'), ci.indexOf('\n  pull_request:'));
  return [...block.matchAll(/^\s+- '([^']+)'\s*$/gm)].map((m) => m[1]).filter((p) => p !== 'main');
}

/** GitHub-Glob (nur * und **) als regulaerer Ausdruck. */
const alsRegex = (muster: string) =>
  new RegExp(`^${muster.split('**').map((t) => t.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*')}$`);

const erfasst = (datei: string) => pushPfade().some((m) => alsRegex(m).test(datei));

describe('CI: paths-Filter fuer push auf main', () => {
  it('der Filter wird gefunden (sonst prueft der Rest nichts)', () => {
    expect(pushPfade().length).toBeGreaterThanOrEqual(15);
  });

  it.each([
    'backend/server.js',
    'frontend/src/App.tsx',
    'init-scripts/01-create-schema.sql',
    '.github/workflows/ci.yml',
    '.github/workflows/android-release.yml',
    '.github/workflows/ci-meldung.yml',
    'scripts/build-handbuch.mjs',
    'docs/api/konfis-events.yaml',
    'docs/handbuch/00-start.md',
    // build-handbuch.mjs spiegelt die Bilder nach frontend/public/docs/bilder/,
    // "Handbuch aktuell?" vergleicht das Ergebnis
    'docs/screenshots/iphone/konfi-startseite.png',
    // der Android-Job (Unit-Tests und ihre Abhaengigkeiten)
    'frontend/android/app/src/test/java/de/godsapp/konfiquest/DateiKopieTest.java',
    'frontend/android/app/build.gradle',
    'frontend/package-lock.json',
    'e2e/login.spec.ts',
    'playwright.config.ts',
    // E2E-Abhaengigkeiten (npm ci in der Wurzel)
    'package.json',
    'package-lock.json',
    // Node-Fassung aller Jobs
    '.nvmrc',
    // E2E-Stack
    'docker-compose.e2e.yml',
    // der Deploy selbst und die von frontend-test geprueften Skripte
    'deploy/rollend.sh',
    '.github/scripts/upload-play.py',
    // dateiverweiseImCode prueft die Ausnahmen gegen die .gitignore der Wurzel
    '.gitignore',
  ])('%s loest einen Lauf aus', (datei) => {
    expect(erfasst(datei)).toBe(true);
  });

  // Die Beispiel-Doku muss es geben: dateiverweiseImCode.test.ts prueft jeden
  // Pfad, der hier steht. docs/bildnachweise.md bleibt, solange der Code sie
  // nennt (components/wrapped/hintergrundbilder.ts).
  it.each(['docs/bildnachweise.md', 'README.md', 'CHANGELOG.md'])(
    '%s allein loest keinen Lauf aus (reine Doku braucht keinen Deploy)',
    (datei) => {
      expect(erfasst(datei)).toBe(false);
    },
  );
});
