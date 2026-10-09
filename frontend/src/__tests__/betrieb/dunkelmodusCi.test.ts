import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

// Die Dunkelmodus-Messung laeuft in der CI (09.10.2026, offene Befunde
// "Dunkelmodus-Messung nicht in der CI"). Eigener Job "dunkelmodus" in
// ci.yml: misst gegen den E2E-Stack, aber nur, wenn Stylesheets, das Theme
// oder die Messung selbst sich aendern (voller Lauf rund 12 Minuten). Hier
// steht fest, dass der Filter die richtigen Commits trifft -- ausgefuehrt in
// einem Wegwerf-Repo, nicht als Text verglichen --, dass die Messung danach
// wirklich laeuft und dass der Job den Web-Deploy nicht anhaelt.

const wurzel = resolve(__dirname, '../../../..');
const ci = readFileSync(join(wurzel, '.github/workflows/ci.yml'), 'utf-8');
const ohneKommentare = (t: string) => t.split('\n').filter((z) => !z.trim().startsWith('#')).join('\n');

function jobs(text: string): Record<string, string> {
  const teil = text.slice(text.indexOf('\njobs:\n') + '\njobs:\n'.length);
  const koepfe = [...teil.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)];
  return Object.fromEntries(koepfe.map((k, i) => [k[1], teil.slice(k.index!, i + 1 < koepfe.length ? koepfe[i + 1].index : undefined)]));
}

const job = ohneKommentare(jobs(ci).dunkelmodus ?? '');

/** Der run-Block des Filter-Schritts, ohne die YAML-Einrueckung. */
function filterSkript(): string {
  const start = job.indexOf('id: filter');
  const run = job.indexOf('run: |', start);
  const zeilen = job.slice(run + 'run: |'.length + 1).split('\n');
  const block: string[] = [];
  for (const z of zeilen) {
    if (z.trim() && !z.startsWith('          ')) break;
    block.push(z.slice(10));
  }
  return block.join('\n');
}

const git = (repo: string, ...args: string[]) =>
  execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf-8' }).trim();

/** Wegwerf-Repo: ein Basis-Commit, dann ein Commit mit `dateien`; Ergebnis des Filters. */
function filterFuer(dateien: string[], ereignis = 'push'): { betroffen: string | undefined } {
  const repo = mkdtempSync(join(tmpdir(), 'dunkelmodus-filter-'));
  try {
    git(repo, 'init', '-q');
    writeFileSync(join(repo, 'README'), 'basis');
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'basis');
    const vorher = git(repo, 'rev-parse', 'HEAD');
    for (const d of dateien) {
      mkdirSync(dirname(join(repo, d)), { recursive: true });
      writeFileSync(join(repo, d), 'geaendert');
    }
    git(repo, 'add', '.');
    git(repo, 'commit', '-q', '-m', 'aenderung');
    const ausgabe = join(repo, '.ausgabe');
    writeFileSync(ausgabe, '');
    execFileSync('bash', ['-e', '-c', filterSkript()], {
      cwd: repo,
      env: { ...process.env, EREIGNIS: ereignis, VORHER: vorher, GITHUB_OUTPUT: ausgabe },
      stdio: 'pipe',
    });
    return { betroffen: readFileSync(ausgabe, 'utf-8').match(/^betroffen=(\d)$/m)?.[1] };
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

describe('CI: Dunkelmodus-Messung', () => {
  it('ci.yml hat den Job dunkelmodus mit Zeitgrenze', () => {
    expect(job).not.toBe('');
    expect(job).toMatch(/timeout-minutes: \d+/);
  });

  it.each([
    'frontend/src/theme/variables.css',
    'frontend/src/theme/barrierefreiheit.css',
    'frontend/src/components/wrapped/WrappedModal.css',
    'frontend/scripts/dunkelmodus-restliste.json',
    'frontend/scripts/dunkelmodus-messen.mjs',
  ])('misst, wenn %s sich aendert', (datei) => {
    expect(filterFuer([datei]).betroffen).toBe('1');
  });

  it.each([
    'frontend/src/App.tsx',
    'backend/server.js',
    'docs/handbuch/03-bedienung.md',
    'frontend/public/docs/bedienung.html',
  ])('misst nicht, wenn nur %s sich aendert', (datei) => {
    expect(filterFuer([datei]).betroffen).toBe('0');
  });

  it('der Handstart misst immer', () => {
    expect(filterFuer(['backend/server.js'], 'workflow_dispatch').betroffen).toBe('1');
  });

  it('nach dem Filter: Stack, Testdaten, Messung gegen die gebaute Oberflaeche -- in dieser Reihenfolge, alle am Filter', () => {
    const schritte = [
      'id: filter',
      'docker compose -f docker-compose.e2e.yml up -d --build --wait',
      'node frontend/scripts/dunkelmodus-daten.mjs',
      'node scripts/dunkelmodus-messen.mjs --url http://localhost:5556',
    ];
    const stellen = schritte.map((s) => job.indexOf(s));
    expect(stellen.every((s) => s >= 0), String(stellen)).toBe(true);
    expect([...stellen].sort((a, b) => a - b)).toEqual(stellen);
    // Jeder Schritt nach dem Filter haengt an ihm; der Filter selbst nicht.
    const namen = [...job.matchAll(/- name: (.+)\n((?: {8}.*\n?)*)/g)];
    const nachFilter = namen.slice(namen.findIndex((n) => n[2].includes('id: filter')) + 1);
    expect(nachFilter.length).toBeGreaterThanOrEqual(6);
    for (const [, name, rumpf] of nachFilter) expect(rumpf, name).toMatch(/if: .*steps\.filter\.outputs\.betroffen == '1'/);
  });

  it('die Testdaten-Datei und die Messung gibt es', () => {
    for (const d of ['frontend/scripts/dunkelmodus-daten.mjs', 'frontend/scripts/dunkelmodus-messen.mjs']) {
      expect(() => readFileSync(join(wurzel, d))).not.toThrow();
    }
  });

  it('haelt den Web-Deploy nicht an: nicht in den needs von build-and-push', () => {
    const needs = ohneKommentare(jobs(ci)['build-and-push']).match(/needs: \[([^\]]*)\]/)?.[1].split(',').map((n) => n.trim());
    expect(needs).toEqual(['backend-test', 'frontend-test', 'e2e-test']);
  });
});
