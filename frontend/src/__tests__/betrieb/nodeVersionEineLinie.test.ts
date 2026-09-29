import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// EINE Node-Linie fuer CI, Images, engines und E2E (29.09.2026, Audit CI
// BF-11, Toolchain BF-04, Tests BF-12).
//
// Bis dahin liefen vier Staende nebeneinander: 20 im E2E-Job (seit dem
// 30.04.2026 ohne Sicherheitsupdates), 22 lokal und in engines, 26 in CI,
// Release-Builds und Produktion -- 26 ist "Current" und wird erst am
// 28.10.2026 LTS (nodejs/Release, schedule.json). Seit dem 29.09.2026 gilt
// die Fassung aus .nvmrc: 24, Active LTS bis 20.10.2026, danach Maintenance
// bis 30.04.2028. Beide Test-Suiten liefen vor der Umstellung auf 24 gruen.
//
// Wer die Linie hebt, aendert .nvmrc, beide Dockerfiles und engines im selben
// Commit -- dieser Test schlaegt sonst an.

const wurzel = resolve(__dirname, '../../../..');
const lies = (pfad: string) => readFileSync(join(wurzel, pfad), 'utf-8');

const linie = lies('.nvmrc').trim();

const workflows = readdirSync(join(wurzel, '.github/workflows'))
  .filter((d) => d.endsWith('.yml') || d.endsWith('.yaml'))
  .map((d) => ({ datei: d, text: lies(join('.github/workflows', d)) }));

describe('Node-Linie aus .nvmrc', () => {
  it('.nvmrc nennt genau eine Hauptversion', () => {
    expect(linie).toMatch(/^\d+$/);
  });

  it('jede Node-Einrichtung in den Workflows liest .nvmrc', () => {
    let einrichtungen = 0;
    for (const { datei, text } of workflows) {
      const setupNode = (text.match(/uses:\s*actions\/setup-node@/g) || []).length;
      const ausNvmrc = (text.match(/node-version-file:\s*\.nvmrc\s*$/gm) || []).length;
      expect(ausNvmrc, datei).toBe(setupNode);
      // Keine feste Fassung daneben (node-version: 20/26 ...).
      expect(text, datei).not.toMatch(/^\s*node-version:\s/m);
      einrichtungen += setupNode;
    }
    // ci.yml (drei Test-Jobs), Android- und iOS-Release
    expect(einrichtungen).toBe(5);
  });

  it('beide Images bauen auf derselben Hauptversion', () => {
    const basen = [
      ...lies('backend/Dockerfile').matchAll(/^FROM node:(\d+)-/gm),
      ...lies('frontend/Dockerfile').matchAll(/^FROM node:(\d+)-/gm),
    ].map((m) => m[1]);
    expect(basen.length).toBe(3);
    expect(new Set(basen)).toEqual(new Set([linie]));
  });

  it('engines des Backends verlangt die Linie, package.json und Lockfile gleich', () => {
    const pkg = JSON.parse(lies('backend/package.json'));
    const lock = JSON.parse(lies('backend/package-lock.json'));
    expect(pkg.engines.node).toBe(`>=${linie}`);
    expect(lock.packages[''].engines.node).toBe(`>=${linie}`);
  });

  it('der E2E-Job nutzt dieselben Action-Fassungen wie die anderen Jobs', () => {
    const ci = lies('.github/workflows/ci.yml');
    const fassungen = (aktion: string) =>
      new Set([...ci.matchAll(new RegExp(`uses:\\s*${aktion}@(\\S+)`, 'g'))].map((m) => m[1]));
    expect(fassungen('actions/checkout').size).toBe(1);
    expect(fassungen('actions/setup-node').size).toBe(1);
  });
});
