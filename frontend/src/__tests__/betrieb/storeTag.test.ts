import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Git-Tag je Store-Upload (29.09.2026, Audit CI BF-09; Simon: "Store-Tag
// automatisch"). Geprueft wird .github/scripts/store-tag.py an einem echten
// Git-Repo mit einem leeren Gegenstueck als origin -- also mit git selbst,
// auch was "+" im Tag-Namen angeht. Dazu die beiden Release-Workflows:
// eigener Tag-Job nach dem Upload, Schreibrecht nur dort, nie beim Dry-Run.

const wurzel = resolve(__dirname, '../../../..');
const SKRIPT = join(wurzel, '.github/scripts/store-tag.py');
const ID = ['-c', 'user.name=Test', '-c', 'user.email=test@example.org', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false'];

let verz: string;
let arbeit: string;
let origin: string;

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync('git', [...ID, ...args], { cwd, encoding: 'utf-8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}

function commitMitVersion(stand: object, nachricht: string): string {
  writeFileSync(join(arbeit, 'frontend/version.json'), JSON.stringify(stand, null, 2) + '\n');
  git(arbeit, 'add', 'frontend/version.json');
  git(arbeit, 'commit', '-q', '-m', nachricht);
  git(arbeit, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
  return git(arbeit, 'rev-parse', 'HEAD');
}

function tagge(env: Record<string, string>) {
  const r = spawnSync('python3', [SKRIPT], {
    cwd: arbeit,
    encoding: 'utf-8',
    // Keine globale git-Konfiguration: Das Skript muss seine Identitaet selbst mitbringen.
    env: { PATH: process.env.PATH!, HOME: verz, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: join(verz, 'leer.gitconfig'), ...env },
  });
  return { code: r.status, aus: r.stdout + r.stderr };
}

/** Tags im origin: Name -> Commit (annotierte aufgeloest). */
function tagsImOrigin(): Record<string, string> {
  const aus = git(origin, 'for-each-ref', '--format=%(refname:strip=2) %(*objectname) %(objectname) %(objecttype)', 'refs/tags');
  return Object.fromEntries(aus.split('\n').filter(Boolean).map((z) => {
    const [name, aufgeloest, obj, typ] = z.split(' ');
    return [name, typ === 'tag' ? aufgeloest : obj];
  }));
}

beforeEach(() => {
  verz = mkdtempSync(join(tmpdir(), 'store-tag-'));
  writeFileSync(join(verz, 'leer.gitconfig'), '');
  origin = join(verz, 'origin.git');
  arbeit = join(verz, 'arbeit');
  mkdirSync(arbeit);
  spawnSync('git', ['init', '-q', '--bare', origin]);
  git(arbeit, 'init', '-q');
  git(arbeit, 'remote', 'add', 'origin', origin);
  mkdirSync(join(arbeit, 'frontend'));
});
afterEach(() => rmSync(verz, { recursive: true, force: true }));

const STAND = { version: '2.3.0', androidVersionCode: 128, iosBuildNumber: 234 };

describe('Store-Tag: setzen', () => {
  it('iOS: 2.3.0+ios.234 als annotierter Tag auf dem gebauten Commit, im origin', () => {
    const sha = commitMitVersion(STAND, 'chore(release): 2.3.0');
    const { code, aus } = tagge({ PLATTFORM: 'ios', SHA: sha, RUN_URL: 'https://github.com/x/actions/runs/1' });
    expect(code, aus).toBe(0);
    expect(tagsImOrigin()).toEqual({ '2.3.0+ios.234': sha });
    expect(git(origin, 'cat-file', '-t', 'refs/tags/2.3.0+ios.234')).toBe('tag');
    const text = git(origin, 'cat-file', '-p', 'refs/tags/2.3.0+ios.234');
    expect(text).toContain('tagger github-actions[bot]');
    expect(text).toContain('iOS-Build 234 (2.3.0) hochgeladen');
    expect(text).toContain('Lauf: https://github.com/x/actions/runs/1');
  });

  it('Android: 2.3.0+android.128', () => {
    const sha = commitMitVersion(STAND, 'release');
    expect(tagge({ PLATTFORM: 'android', SHA: sha }).code).toBe(0);
    expect(tagsImOrigin()).toEqual({ '2.3.0+android.128': sha });
  });

  it('Version und Build-Nummer kommen aus dem gebauten Commit, nicht aus dem Arbeitsverzeichnis', () => {
    const sha = commitMitVersion(STAND, 'release');
    // Wie der Android-Dry-Run: versionCode im Arbeitsverzeichnis +10000.
    writeFileSync(join(arbeit, 'frontend/version.json'), JSON.stringify({ ...STAND, androidVersionCode: 10128 }));
    expect(tagge({ PLATTFORM: 'android', SHA: sha }).code).toBe(0);
    expect(Object.keys(tagsImOrigin())).toEqual(['2.3.0+android.128']);
  });

  it('ein aelterer Commit bekommt seinen eigenen Stand', () => {
    const alt = commitMitVersion({ ...STAND, iosBuildNumber: 233 }, 'alt');
    commitMitVersion(STAND, 'neu');
    expect(tagge({ PLATTFORM: 'ios', SHA: alt }).code).toBe(0);
    expect(tagsImOrigin()).toEqual({ '2.3.0+ios.233': alt });
  });
});

describe('Store-Tag: nicht setzen', () => {
  it('Dry-Run: kein Tag', () => {
    const sha = commitMitVersion(STAND, 'release');
    const { code, aus } = tagge({ PLATTFORM: 'android', SHA: sha, DRY_RUN: 'true' });
    expect(code).toBe(0);
    expect(aus).toContain('Dry-Run');
    expect(tagsImOrigin()).toEqual({});
  });

  it('Tag zeigt schon auf denselben Commit: nichts zu tun, der Tag bleibt unveraendert', () => {
    const sha = commitMitVersion(STAND, 'release');
    expect(tagge({ PLATTFORM: 'ios', SHA: sha }).code).toBe(0);
    const vorher = git(origin, 'rev-parse', 'refs/tags/2.3.0+ios.234');
    git(arbeit, 'tag', '-d', '2.3.0+ios.234');
    const { code, aus } = tagge({ PLATTFORM: 'ios', SHA: sha });
    expect(code).toBe(0);
    expect(aus).toContain('nichts zu tun');
    expect(git(origin, 'rev-parse', 'refs/tags/2.3.0+ios.234')).toBe(vorher);
  });

  it('Tag zeigt auf einen anderen Commit: Warnung, nicht ueberschrieben', () => {
    const erster = commitMitVersion(STAND, 'erster');
    git(arbeit, 'tag', '2.3.0+ios.234', erster);
    git(arbeit, 'push', '-q', 'origin', 'refs/tags/2.3.0+ios.234');
    git(arbeit, 'tag', '-d', '2.3.0+ios.234');
    const zweiter = commitMitVersion({ ...STAND, androidVersionCode: 129 }, 'zweiter, iOS-Nummer nicht angehoben');
    const { code, aus } = tagge({ PLATTFORM: 'ios', SHA: zweiter });
    expect(code).toBe(0);
    expect(aus).toContain('::warning::');
    expect(aus).toContain('Nicht ueberschrieben');
    expect(tagsImOrigin()).toEqual({ '2.3.0+ios.234': erster });
  });

  it.each([
    [{ PLATTFORM: 'web' }, 'PLATTFORM'],
    [{ PLATTFORM: 'ios', SHA: 'abc' }, 'SHA'],
  ])('ungueltige Eingabe %j bricht ab', (env, text) => {
    commitMitVersion(STAND, 'release');
    const { code, aus } = tagge({ SHA: git(arbeit, 'rev-parse', 'HEAD'), ...env } as Record<string, string>);
    expect(code).toBe(2);
    expect(aus).toContain(text);
    expect(tagsImOrigin()).toEqual({});
  });

  it('kaputte version.json im Commit: Fehler, kein Tag', () => {
    const sha = commitMitVersion({ version: '2.3', iosBuildNumber: 'x' }, 'kaputt');
    const { code, aus } = tagge({ PLATTFORM: 'ios', SHA: sha });
    expect(code).toBe(1);
    expect(aus).toContain('::error::');
    expect(tagsImOrigin()).toEqual({});
  });
});

describe('Store-Tag: Release-Workflows', () => {
  /** Die Jobs eines Workflows: Name und Text bis zum naechsten Job. */
  function jobs(text: string): Record<string, string> {
    const teil = text.slice(text.indexOf('\njobs:\n') + '\njobs:\n'.length);
    const koepfe = [...teil.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)];
    return Object.fromEntries(koepfe.map((k, i) => [k[1], teil.slice(k.index!, i + 1 < koepfe.length ? koepfe[i + 1].index : undefined)]));
  }
  const ohneKommentare = (t: string) => t.split('\n').filter((z) => !z.trim().startsWith('#')).join('\n');

  it.each([
    ['ios-release.yml', 'ios'],
    ['android-release.yml', 'android'],
  ])('%s: eigener Tag-Job nach dem Upload, Schreibrecht nur dort', (datei, plattform) => {
    const wf = readFileSync(join(wurzel, '.github/workflows', datei), 'utf-8');
    const j = jobs(wf);
    expect(Object.keys(j)).toEqual(['ci-gate', 'build-upload', 'store-tag']);
    const tag = ohneKommentare(j['store-tag']);
    expect(tag).toMatch(/needs: \[build-upload\]/);
    expect(tag).toMatch(/permissions:\n\s+contents: write\n/);
    expect(tag).toContain(`PLATTFORM: ${plattform}`);
    expect(tag).toContain('SHA: ${{ github.sha }}');
    expect(tag).toContain('run: python3 .github/scripts/store-tag.py');
    // Kein anderer Job und nicht die Workflow-Ebene darf schreiben.
    expect(ohneKommentare(wf).match(/contents: write/g)).toHaveLength(1);
    expect(wf).toMatch(/^permissions:\n {2}contents: read$/m);
    // Kein always()/failure(): Der Tag-Job laeuft nur nach erfolgreichem Upload.
    expect(tag).not.toMatch(/always\(\)|failure\(\)|cancelled\(\)/);
  });

  it('Android: kein Tag beim Dry-Run (Bedingung am Job und Weitergabe ans Skript)', () => {
    const tag = ohneKommentare(jobs(readFileSync(join(wurzel, '.github/workflows/android-release.yml'), 'utf-8'))['store-tag']);
    expect(tag).toMatch(/if: \$\{\{ !inputs\.dry_run \}\}/);
    expect(tag).toContain('DRY_RUN: ${{ inputs.dry_run }}');
  });

  it('der Upload ist der letzte Schritt von build-upload -- dessen Erfolg heisst: hochgeladen', () => {
    for (const [datei, schritt] of [['ios-release.yml', 'Zu App Store Connect hochladen'], ['android-release.yml', 'Zu Google Play hochladen']]) {
      const bu = jobs(readFileSync(join(wurzel, '.github/workflows', datei), 'utf-8'))['build-upload'];
      const namen = [...bu.matchAll(/^ {6}- name: (.+)$/gm)].map((m) => m[1]);
      expect(namen.at(-1), datei).toBe(schritt);
    }
  });
});
