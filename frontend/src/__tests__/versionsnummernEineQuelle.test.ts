import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
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
  const { quelle, staende, abweichungen } = pruefen(wurzel);

  it('die Quelle ist eine Semantic-Versioning-Nummer mit Store-Build-Nummern', () => {
    expect(quelle.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(Number.isInteger(quelle.androidVersionCode)).toBe(true);
    expect(Number.isInteger(quelle.iosBuildNumber)).toBe(true);
  });

  it('alle zwölf Stellen tragen die Version der Quelle', () => {
    // Zwölf: version.json, drei package.json, drei Lockfiles je zweimal
    // (version und packages[""]), CHANGELOG-Überschrift, iOS-Projekt.
    expect(staende.map((s) => s.stelle).length).toBe(12);
    expect(abweichungen.map((s) => `${s.stelle}: ${s.wert}`)).toEqual([]);
  });

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
