import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// backend-test laeuft in Teilen (15.10.2026, Simon: „die schiere Masse an
// Tests“): eine Matrix, je Teil ein Runner mit eigener Datenbank, und
// `vitest run --shard=<teil>/<anzahl>`.
//
// Die eine Gefahr dabei ist still: Passen Matrix und Nenner nicht zusammen
// (drei Teile, aber --shard=x/4), laeuft ein Viertel der Dateien nie -- und
// die CI ist trotzdem gruen. Genau das steht hier fest.

const wurzel = resolve(__dirname, '../../../..');
const ci = readFileSync(join(wurzel, '.github/workflows/ci.yml'), 'utf-8');
const ohneKommentare = (t: string) => t.split('\n').filter((z) => !z.trim().startsWith('#')).join('\n');

/** Die Jobs von ci.yml: Name und Text bis zum naechsten Job. */
function jobs(text: string): Record<string, string> {
  const teil = text.slice(text.indexOf('\njobs:\n') + '\njobs:\n'.length);
  const koepfe = [...teil.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)];
  return Object.fromEntries(koepfe.map((k, i) => [k[1], teil.slice(k.index!, i + 1 < koepfe.length ? koepfe[i + 1].index : undefined)]));
}

describe('CI: backend-test in Teilen', () => {
  const job = ohneKommentare(jobs(ci)['backend-test'] ?? '');
  const teile = job.match(/^ {6}matrix:\n {8}teil: \[([^\]]*)\]/m)?.[1].split(',').map((t) => Number(t.trim()));
  const shard = job.match(/vitest run --config tests\/vitest\.config\.ts --shard=\$\{\{ matrix\.teil \}\}\/(\d+)\s*$/m);
  const nenner = shard ? Number(shard[1]) : undefined;

  it('die Matrix zaehlt 1 bis N lueckenlos, und --shard teilt durch genau N', () => {
    expect(teile?.length).toBeGreaterThan(1);
    expect(teile).toEqual(Array.from({ length: teile!.length }, (_, i) => i + 1));
    expect(nenner).toBe(teile!.length);
  });

  it('der Jobname nennt Teil und Anzahl wie --shard', () => {
    expect(job).toMatch(new RegExp(`^ {4}name: backend-test \\(\\$\\{\\{ matrix\\.teil \\}\\}/${nenner}\\)$`, 'm'));
  });

  it('ein roter Teil bricht die anderen nicht ab', () => {
    expect(job).toMatch(/^ {6}fail-fast: false$/m);
  });

  it('jeder Teil hat seine eigene Datenbank als Dienst des Jobs', () => {
    expect(job).toMatch(/^ {4}services:\n {6}postgres:\n/m);
  });

  it('Lint und Audit laufen einmal, im ersten Teil', () => {
    expect(job).toMatch(/- name: Lint\n {8}if: matrix\.teil == 1\n/);
    expect(job).toMatch(/- name: Security audit\n {8}if: matrix\.teil == 1\n/);
  });

  it('build-and-push wartet weiter auf backend-test, also auf alle Teile', () => {
    const needs = ohneKommentare(jobs(ci)['build-and-push']).match(/needs: \[([^\]]*)\]/)?.[1].split(',').map((n) => n.trim());
    expect(needs).toContain('backend-test');
  });
});
