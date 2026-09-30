import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// deploy/notfall-tag.sh: Welchen Stand rollt der Notfall-Deploy aus?
// (30.09.2026, Probelauf Auftrag 05)
//
// Der Probelauf mit leerem Tag brach auf GitHub ab, weil der letzte Commit auf
// main nur Doku war und dafuer keine Images gebaut werden. "Leer" sucht jetzt
// rueckwaerts den juengsten Commit, zu dem BEIDE Images liegen. Geprueft in
// einem Wegwerf-Repo mit einem nachgebauten `docker`, das nur die Tags aus
// VORHANDEN kennt.

vi.setConfig({ testTimeout: 30_000 });

const wurzel = resolve(__dirname, '../../../..');
const SKRIPT = join(wurzel, 'deploy/notfall-tag.sh');
const PREFIX = 'ghcr.test/konfi-quest';

let ordner = '';
let repo = '';
let bin = '';
/** Commits im Wegwerf-Repo, aeltester zuerst (voller SHA). */
const commits: string[] = [];

function git(...args: string[]): string {
  return execFileSync('git', ['-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t.invalid',
    '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf-8' }).trim();
}

beforeAll(() => {
  ordner = mkdtempSync(join(tmpdir(), 'notfall-tag-'));
  repo = join(ordner, 'repo');
  bin = join(ordner, 'bin');
  execFileSync('mkdir', ['-p', repo, bin]);
  execFileSync('git', ['init', '-q', repo]);
  for (const name of ['code', 'doku-1', 'doku-2']) {
    writeFileSync(join(repo, `${name}.txt`), name);
    git('add', '.');
    git('commit', '-q', '-m', name);
    commits.push(git('rev-parse', 'HEAD'));
  }
  // Nachgebautes docker: `docker manifest inspect <bild>` gelingt nur fuer
  // Bilder, die in VORHANDEN (durch Leerzeichen getrennt) stehen.
  const docker = join(bin, 'docker');
  writeFileSync(docker, [
    '#!/usr/bin/env bash',
    '[ "$1" = manifest ] && [ "$2" = inspect ] || exit 2',
    'for b in $VORHANDEN; do [ "$b" = "$3" ] && exit 0; done',
    'exit 1',
    '',
  ].join('\n'));
  chmodSync(docker, 0o755);
});

afterAll(() => {
  if (ordner) rmSync(ordner, { recursive: true, force: true });
});

const kurz = (voll: string) => voll.slice(0, 7);
const bilder = (voll: string, welche = ['backend', 'frontend']) =>
  welche.map((w) => `${PREFIX}-${w}:${kurz(voll)}`);

function lauf(eingabeTag: string, vorhanden: string[], extra: Record<string, string> = {}) {
  const ausgabeDatei = join(ordner, `ausgabe-${Math.random().toString(36).slice(2)}`);
  writeFileSync(ausgabeDatei, '');
  const r = spawnSync('bash', [SKRIPT], {
    cwd: repo,
    encoding: 'utf-8',
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      HOME: ordner,
      EINGABE_TAG: eingabeTag,
      IMAGE_PREFIX: PREFIX,
      VORHANDEN: vorhanden.join(' '),
      GITHUB_OUTPUT: ausgabeDatei,
      ...extra,
    },
  });
  const ausgabe = existsSync(ausgabeDatei) ? readFileSync(ausgabeDatei, 'utf-8') : '';
  const felder = Object.fromEntries(
    ausgabe.split('\n').filter(Boolean).map((z) => z.split('=') as [string, string]),
  );
  return { code: r.status, log: `${r.stdout}${r.stderr}`, felder };
}

describe('Notfall-Deploy: Tag leer', () => {
  it('nimmt den juengsten Commit mit Images, wenn die letzten nur Doku waren', () => {
    const [code] = commits;
    const r = lauf('', bilder(code));
    expect(r.code).toBe(0);
    expect(r.felder).toEqual({ tag: kurz(code), voll: code });
    // Die zwei Doku-Commits wurden gesehen und uebersprungen.
    expect(r.log).toContain(`${kurz(commits[2])}: keine Images`);
    expect(r.log).toContain(`${kurz(commits[1])}: keine Images`);
  });

  it('nimmt HEAD, wenn es dafuer Images gibt', () => {
    const head = commits[2];
    const r = lauf('', [...bilder(commits[0]), ...bilder(head)]);
    expect(r.code).toBe(0);
    expect(r.felder).toEqual({ tag: kurz(head), voll: head });
  });

  it('verlangt BEIDE Images: nur das Backend reicht nicht', () => {
    const r = lauf('', [...bilder(commits[2], ['backend']), ...bilder(commits[1])]);
    expect(r.code).toBe(0);
    expect(r.felder.tag).toBe(kurz(commits[1]));
  });

  it('bricht ohne Ausgabe ab, wenn es in der Suchtiefe keinen Stand gibt', () => {
    const r = lauf('', bilder(commits[0]), { SUCHTIEFE: '2' });
    expect(r.code).toBe(1);
    expect(r.felder).toEqual({});
    expect(r.log).toContain('Produktion bleibt unveraendert');
  });
});

describe('Notfall-Deploy: Tag angegeben', () => {
  it('rollt genau den angegebenen Stand aus, auch wenn es neuere gibt', () => {
    const [alt, , head] = commits;
    const r = lauf(kurz(alt), [...bilder(alt), ...bilder(head)]);
    expect(r.code).toBe(0);
    expect(r.felder).toEqual({ tag: kurz(alt), voll: alt });
  });

  it('bricht ab, wenn zum angegebenen Stand ein Image fehlt -- ohne Ersatz zu suchen', () => {
    const [alt, , head] = commits;
    const r = lauf(kurz(head), [...bilder(alt), ...bilder(head, ['backend'])]);
    expect(r.code).toBe(1);
    expect(r.felder).toEqual({});
    expect(r.log).toContain(`Image konfi-quest-frontend:${kurz(head)} existiert nicht`);
  });

  it('lehnt einen Tag ab, der kein 7-stelliger Commit-Tag ist', () => {
    const r = lauf('latest', bilder(commits[0]));
    expect(r.code).toBe(1);
    expect(r.felder).toEqual({});
    expect(r.log).toContain("'latest' ist kein 7-stelliger Commit-Tag");
  });

  it('lehnt einen Tag ab, zu dem es keinen Commit gibt', () => {
    const r = lauf('abcdef0', [`${PREFIX}-backend:abcdef0`, `${PREFIX}-frontend:abcdef0`]);
    expect(r.code).toBe(1);
    expect(r.felder).toEqual({});
    expect(r.log).toContain('keinen (eindeutigen) Commit');
  });
});
