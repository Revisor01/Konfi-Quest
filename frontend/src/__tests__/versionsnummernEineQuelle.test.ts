import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, cpSync, rmSync } from 'fs';
import { resolve, join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { pruefen } from '../../../scripts/version-setzen.mjs';

// Versionsnummern kommen aus EINER Quelle (CLAUDE.md, „Versionsnummern").
//
// Bis zum 27.09.2026 trug das Repo vier verschiedene App-Versionen: die Wurzel
// 2.9.0, frontend/ 0.0.1, backend/ 1.0.1 (und damit GET /api/status) und
// frontend/version.json 2.3.0 — nur die letzte stimmte (Audit 26.09.2026,
// Sammelbefund S-13). Seitdem zieht `npm run version:setzen` alle Stellen
// gleich, und dieser Test hält den Gleichlauf fest: Wer eine Stelle von Hand
// anfasst, sieht ihn rot.

const wurzel = resolve(__dirname, '../../..');

describe('Versionsnummern folgen frontend/version.json', () => {
  const { quelle, staende: roheStaende, abweichungen } = pruefen(wurzel);
  // version-setzen.mjs ist JavaScript; `soll` kommt erst nach dem Anlegen dazu.
  const staende = roheStaende as Array<{ stelle: string; wert: unknown; soll?: string }>;

  it('die Quelle ist eine Semantic-Versioning-Nummer mit Store-Build-Nummern', () => {
    expect(quelle.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Number.isInteger(quelle.androidVersionCode)).toBe(true);
    expect(Number.isInteger(quelle.iosBuildNumber)).toBe(true);
  });

  it('alle fünfzehn Stellen tragen den Stand der Quelle', () => {
    // Dreizehn mit der App-Version: version.json, drei package.json, drei
    // Lockfiles je zweimal (version und packages[""]), CHANGELOG-Überschrift,
    // MARKETING_VERSION im iOS-Projekt, CFBundleShortVersionString in der
    // Info.plist. Zwei mit der iOS-Build-Nummer (seit 29.09.2026, Audit CI
    // BF-09): CFBundleVersion und CURRENT_PROJECT_VERSION -- dort stand im
    // Repo 220 bzw. 218, während version.json 234 nannte.
    expect(staende.filter((s) => s.soll === quelle.version).length).toBe(13);
    expect(staende.filter((s) => s.soll === String(quelle.iosBuildNumber)).map((s) => s.stelle)).toEqual([
      'ios Info.plist (CFBundleVersion)',
      'ios project.pbxproj (CURRENT_PROJECT_VERSION)',
    ]);
    expect(abweichungen.map((s) => `${s.stelle}: ${s.wert}`)).toEqual([]);
  });

  it('version:setzen zieht auch Info.plist und Build-Nummer im iOS-Projekt nach', () => {
    // An einer Kopie: nur die Dateien, die das Skript liest und schreibt.
    const kopie = mkdtempSync(join(tmpdir(), 'version-'));
    try {
      for (const d of [
        'scripts/version-setzen.mjs', 'frontend/version.json', 'CHANGELOG.md',
        'package.json', 'package-lock.json', 'frontend/package.json', 'frontend/package-lock.json',
        'backend/package.json', 'backend/package-lock.json',
        'frontend/ios/App/App.xcodeproj/project.pbxproj', 'frontend/ios/App/App/Info.plist',
      ]) {
        cpSync(resolve(wurzel, d), join(kopie, d), { recursive: true });
      }
      execFileSync(process.execPath, [join(kopie, 'scripts/version-setzen.mjs'), quelle.version, '--ios', '9999'], { cwd: kopie, stdio: 'pipe' });
      const plist = readFileSync(join(kopie, 'frontend/ios/App/App/Info.plist'), 'utf-8');
      const pbx = readFileSync(join(kopie, 'frontend/ios/App/App.xcodeproj/project.pbxproj'), 'utf-8');
      expect(plist).toMatch(/<key>CFBundleVersion<\/key>\s*<string>9999<\/string>/);
      expect(plist).toMatch(new RegExp(`<key>CFBundleShortVersionString</key>\\s*<string>${quelle.version}</string>`));
      expect([...new Set([...pbx.matchAll(/CURRENT_PROJECT_VERSION = ([^;]+);/g)].map((m) => m[1]))]).toEqual(['9999']);
      expect(pruefen(kopie).abweichungen).toEqual([]);
    } finally {
      rmSync(kopie, { recursive: true, force: true });
    }
    // Drei `npm version`-Aufrufe: gemessen rund 3 s, auf einem vollen Rechner mehr.
  }, 30_000);

  it('GET /api/status kann damit die App-Version melden (backend/package.json)', () => {
    const backend = JSON.parse(readFileSync(resolve(wurzel, 'backend/package.json'), 'utf-8'));
    expect(backend.version).toBe(quelle.version);
  });

  it('die npm-Skripte zum Setzen und Prüfen stehen in der Wurzel', () => {
    const root = JSON.parse(readFileSync(resolve(wurzel, 'package.json'), 'utf-8'));
    expect(root.scripts['version:setzen']).toBe('node scripts/version-setzen.mjs');
    expect(root.scripts['version:pruefen']).toBe('node scripts/version-setzen.mjs --pruefen');
  });
});
