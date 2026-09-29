import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Rotes main meldet sich als Issue (29.09.2026, Audit CI BF-07; Simon: "Wenn
// die CI auf main rot wird -> GitHub-Issue automatisch").
//
// Geprueft wird .github/scripts/ci-meldung.py gegen ein gefaelschtes `gh` im
// PATH: Es liefert Laeufe, Jobs und Issues aus einer JSON-Datei und schreibt
// jede Aenderung (Issue, Kommentar, Schliessen, Label) dorthin zurueck -- so
// laesst sich der Ablauf ueber mehrere Laeufe hinweg verfolgen. Dazu die
// Workflow-Datei: Ausloeser, Rechte, und dass ci.yml davon nichts weiss.

const wurzel = resolve(__dirname, '../../../..');
const SKRIPT = join(wurzel, '.github/scripts/ci-meldung.py');
const REPO = 'Revisor01/Konfi-Quest';

type Lauf = { databaseId: number; number: number; attempt: number; conclusion: string; createdAt: string; headSha: string; url: string; displayTitle: string };
type Issue = { number: number; title: string; body: string; labels: string[]; state: 'open' | 'closed'; comments: string[] };
type Zustand = { runs: Lauf[]; jobs: Record<string, Array<{ name: string; conclusion: string; html_url: string }>>; issues: Issue[]; labels: string[]; aufrufe: string[][] };

// Das gefaelschte gh: nur die Aufrufe, die das Skript macht; alles andere
// endet mit Exit 1, damit ein neuer Aufruf im Skript hier auffaellt.
const FAKE_GH = `#!/usr/bin/env node
const fs = require('fs');
const datei = process.env.FAKE_GH_STATE;
const z = JSON.parse(fs.readFileSync(datei, 'utf-8'));
const a = process.argv.slice(2);
z.aufrufe.push(a);
const opt = (n) => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : undefined; };
const speichern = () => fs.writeFileSync(datei, JSON.stringify(z));
let aus = '';
if (a[0] === 'run' && a[1] === 'list') {
  if (opt('--branch') !== 'main' || opt('--event') !== 'push' || opt('--status') !== 'completed' || opt('--workflow') !== 'ci.yml') { process.stderr.write('falsche Filter'); process.exit(1); }
  aus = JSON.stringify(z.runs);
} else if (a[0] === 'api') {
  const m = a[1].match(/^repos\\/[^/]+\\/[^/]+\\/actions\\/runs\\/(\\d+)\\/jobs/);
  if (!m) { process.stderr.write('unbekannte api ' + a[1]); process.exit(1); }
  aus = JSON.stringify({ jobs: z.jobs[m[1]] || [] });
} else if (a[0] === 'issue' && a[1] === 'list') {
  aus = JSON.stringify(z.issues.filter((i) => i.state === 'open' && i.labels.includes(opt('--label'))).map((i) => ({ number: i.number, title: i.title, url: 'https://github.com/x/issues/' + i.number })));
} else if (a[0] === 'label' && a[1] === 'create') {
  if (!z.labels.includes(a[2])) z.labels.push(a[2]);
} else if (a[0] === 'issue' && a[1] === 'create') {
  if (!z.labels.includes(opt('--label'))) { process.stderr.write("could not add label: '" + opt('--label') + "' not found"); process.exit(1); }
  const nummer = 100 + z.issues.length;
  z.issues.push({ number: nummer, title: opt('--title'), body: opt('--body'), labels: [opt('--label')], state: 'open', comments: [] });
  aus = 'https://github.com/x/issues/' + nummer + '\\n';
} else if (a[0] === 'issue' && a[1] === 'view') {
  const i = z.issues.find((x) => x.number === Number(a[2]));
  aus = JSON.stringify({ body: i.body, comments: i.comments.map((c) => ({ body: c })) });
} else if (a[0] === 'issue' && a[1] === 'comment') {
  z.issues.find((x) => x.number === Number(a[2])).comments.push(opt('--body'));
} else if (a[0] === 'issue' && a[1] === 'close') {
  const i = z.issues.find((x) => x.number === Number(a[2]));
  if (opt('--comment')) i.comments.push(opt('--comment'));
  i.state = 'closed';
} else { process.stderr.write('unbekannter Aufruf ' + a.join(' ')); process.exit(1); }
speichern();
process.stdout.write(aus);
`;

let verz: string;
let zustandDatei: string;

function lauf(nr: number, conclusion: string, sha = `${nr}`.padStart(40, 'a')): Lauf {
  return { databaseId: 9000 + nr, number: nr, attempt: 1, conclusion, createdAt: `2026-09-29T10:${String(nr).padStart(2, '0')}:00Z`, headSha: sha, url: `https://github.com/${REPO}/actions/runs/${9000 + nr}`, displayTitle: `fix: Commit ${nr}` };
}

function setze(z: Partial<Zustand>) {
  const voll: Zustand = { runs: [], jobs: {}, issues: [], labels: [], aufrufe: [], ...z };
  writeFileSync(zustandDatei, JSON.stringify(voll));
}
const lies = (): Zustand => JSON.parse(readFileSync(zustandDatei, 'utf-8'));

function melde(env: Record<string, string> = {}) {
  const r = spawnSync('python3', [SKRIPT], {
    encoding: 'utf-8',
    env: { PATH: `${verz}:${process.env.PATH}`, FAKE_GH_STATE: zustandDatei, GH_REPO: REPO, GH_TOKEN: 'x', ...env },
  });
  return { code: r.status, aus: r.stdout + r.stderr };
}

beforeEach(() => {
  verz = mkdtempSync(join(tmpdir(), 'ci-meldung-'));
  zustandDatei = join(verz, 'zustand.json');
  writeFileSync(join(verz, 'gh'), FAKE_GH);
  chmodSync(join(verz, 'gh'), 0o755);
});
afterEach(() => rmSync(verz, { recursive: true, force: true }));

describe('CI-Meldung: rotes main', () => {
  it('legt beim ersten roten Lauf ein Issue mit Label an: Commit, roter Job, Link zum Lauf', () => {
    setze({
      runs: [lauf(12, 'failure'), lauf(11, 'success')],
      jobs: { 9012: [
        { name: 'backend-test', conclusion: 'success', html_url: 'u1' },
        { name: 'frontend-test', conclusion: 'failure', html_url: `https://github.com/${REPO}/actions/runs/9012/job/77` },
        { name: 'build-and-push', conclusion: 'skipped', html_url: 'u3' },
        { name: 'deploy', conclusion: 'skipped', html_url: 'u4' },
      ] },
    });
    const { code } = melde();
    expect(code).toBe(0);
    const z = lies();
    expect(z.labels).toEqual(['ci-rot-main']);
    expect(z.issues).toHaveLength(1);
    const [issue] = z.issues;
    expect(issue.state).toBe('open');
    expect(issue.labels).toEqual(['ci-rot-main']);
    expect(issue.title).toBe(`CI auf main ist rot (seit ${'12'.padStart(40, 'a').slice(0, 7)})`);
    expect(issue.body).toContain(`https://github.com/${REPO}/commit/${'12'.padStart(40, 'a')}`);
    expect(issue.body).toContain('fix: Commit 12');
    expect(issue.body).toContain('`frontend-test` — failure');
    expect(issue.body).toContain(`https://github.com/${REPO}/actions/runs/9012/job/77`);
    expect(issue.body).toContain(`https://github.com/${REPO}/actions/runs/9012`);
    expect(issue.body).toContain('Übersprungen: `build-and-push`, `deploy`');
    expect(issue.body).not.toContain('`backend-test`');
    expect(issue.body).toContain('<!-- ci-lauf:9012:1 -->');
  });

  it('ein weiterer roter Lauf ergaenzt das offene Issue, statt ein neues zu oeffnen', () => {
    setze({
      runs: [lauf(13, 'timed_out'), lauf(12, 'failure')],
      jobs: { 9013: [{ name: 'backend-test', conclusion: 'failure', html_url: 'j' }] },
      labels: ['ci-rot-main'],
      issues: [{ number: 100, title: 'CI auf main ist rot (seit aaaaaaa)', body: 'x <!-- ci-lauf:9012:1 -->', labels: ['ci-rot-main'], state: 'open', comments: [] }],
    });
    expect(melde().code).toBe(0);
    const z = lies();
    expect(z.issues).toHaveLength(1);
    expect(z.issues[0].comments).toHaveLength(1);
    expect(z.issues[0].comments[0]).toContain('Weiterer roter Lauf');
    expect(z.issues[0].comments[0]).toContain('`backend-test` — failure');
    expect(z.issues[0].comments[0]).toContain('<!-- ci-lauf:9013:1 -->');
  });

  it('derselbe Lauf wird nur einmal gemeldet (erneuter Meldungslauf)', () => {
    setze({
      runs: [lauf(13, 'failure')],
      labels: ['ci-rot-main'],
      issues: [{ number: 100, title: 't', body: 'b', labels: ['ci-rot-main'], state: 'open', comments: ['x <!-- ci-lauf:9013:1 -->'] }],
    });
    expect(melde().code).toBe(0);
    expect(lies().issues[0].comments).toHaveLength(1);
    expect(lies().aufrufe.some((a) => a[0] === 'issue' && a[1] === 'comment')).toBe(false);
  });

  it('ein neuer Versuch desselben Laufs (Re-run) zaehlt als neuer Lauf', () => {
    setze({
      runs: [{ ...lauf(13, 'failure'), attempt: 2 }],
      labels: ['ci-rot-main'],
      issues: [{ number: 100, title: 't', body: 'x <!-- ci-lauf:9013:1 -->', labels: ['ci-rot-main'], state: 'open', comments: [] }],
    });
    expect(melde().code).toBe(0);
    expect(lies().issues[0].comments[0]).toContain('<!-- ci-lauf:9013:2 -->');
  });
});

describe('CI-Meldung: wieder gruen', () => {
  it('schliesst das offene Issue mit Kommentar', () => {
    setze({
      runs: [lauf(14, 'success'), lauf(13, 'failure')],
      labels: ['ci-rot-main'],
      issues: [{ number: 100, title: 't', body: 'b', labels: ['ci-rot-main'], state: 'open', comments: [] }],
    });
    expect(melde().code).toBe(0);
    const [issue] = lies().issues;
    expect(issue.state).toBe('closed');
    expect(issue.comments[0]).toContain('Wieder grün');
    expect(issue.comments[0]).toContain(`https://github.com/${REPO}/actions/runs/9014`);
    const schliessen = lies().aufrufe.find((a) => a[0] === 'issue' && a[1] === 'close')!;
    expect(schliessen).toContain('completed');
  });

  it('ohne offenes Issue passiert nichts', () => {
    setze({ runs: [lauf(14, 'success')] });
    expect(melde().code).toBe(0);
    const z = lies();
    expect(z.issues).toEqual([]);
    expect(z.aufrufe.map((a) => a.slice(0, 2).join(' '))).toEqual(['run list', 'issue list']);
  });

  it('ein Issue ohne das Label bleibt unberuehrt', () => {
    setze({
      runs: [lauf(14, 'success')],
      issues: [{ number: 7, title: 'Anderes Thema', body: 'b', labels: ['bug'], state: 'open', comments: [] }],
    });
    expect(melde().code).toBe(0);
    expect(lies().issues[0]).toMatchObject({ state: 'open', comments: [] });
  });
});

describe('CI-Meldung: Reihenfolge und Sonderfaelle', () => {
  it('ein aelterer roter Lauf, der NACH einem neueren gruenen fertig wird, oeffnet kein Issue', () => {
    // Ausloeser ist Lauf 9012 (rot, aelter); main steht mit 9013 auf gruen.
    setze({ runs: [lauf(12, 'failure'), lauf(13, 'success')] });
    const { code, aus } = melde({ AUSLOESER: '9012' });
    expect(code).toBe(0);
    expect(lies().issues).toEqual([]);
    expect(aus).toContain('ausgeloest von Lauf 9012');
  });

  it('ein aelterer gruener Lauf, der NACH einem neueren roten fertig wird, schliesst das Issue nicht', () => {
    setze({
      runs: [lauf(12, 'success'), lauf(13, 'failure')],
      labels: ['ci-rot-main'],
      issues: [{ number: 100, title: 't', body: 'x <!-- ci-lauf:9013:1 -->', labels: ['ci-rot-main'], state: 'open', comments: [] }],
    });
    expect(melde({ AUSLOESER: '9012' }).code).toBe(0);
    expect(lies().issues[0].state).toBe('open');
  });

  it('abgebrochene Laeufe (ersetzter Deploy) entscheiden nichts -- es gilt der naechstaeltere', () => {
    setze({
      runs: [lauf(15, 'cancelled'), lauf(14, 'success')],
      labels: ['ci-rot-main'],
      issues: [{ number: 100, title: 't', body: 'b', labels: ['ci-rot-main'], state: 'open', comments: [] }],
    });
    expect(melde().code).toBe(0);
    expect(lies().issues[0].state).toBe('closed');
  });

  it('ohne entscheidenden Lauf passiert nichts', () => {
    setze({ runs: [lauf(15, 'cancelled')] });
    expect(melde().code).toBe(0);
    expect(lies().aufrufe.map((a) => a.slice(0, 2).join(' '))).toEqual(['run list']);
  });

  it('ein Fehler von gh macht den Meldungslauf rot (sichtbar), statt ihn zu verschlucken', () => {
    setze({ runs: [lauf(12, 'failure')] });
    // Ohne Label-Anlage scheitert "issue create" wie bei GitHub am fehlenden Label.
    const kaputt = FAKE_GH.replace("if (!z.labels.includes(a[2])) z.labels.push(a[2]);", '');
    writeFileSync(join(verz, 'gh'), kaputt);
    const { code, aus } = melde();
    expect(code).toBe(1);
    expect(aus).toContain('::error::');
  });
});

describe('CI-Meldung: Workflow', () => {
  const wf = readFileSync(join(wurzel, '.github/workflows/ci-meldung.yml'), 'utf-8');
  const ci = readFileSync(join(wurzel, '.github/workflows/ci.yml'), 'utf-8');

  it('loest auf fertige Laeufe von ci.yml auf main aus -- ueber deren Namen', () => {
    const name = ci.match(/^name: (.+)$/m)![1];
    expect(wf).toContain(`workflows: ["${name}"]`);
    expect(wf).toMatch(/workflow_run:\n\s+workflows: .*\n\s+types: \[completed\]\n\s+branches: \[main\]/);
  });

  it('nur push-Laeufe dieses Repos (kein Pull Request, kein Fork)', () => {
    expect(wf).toMatch(/if: github\.event\.workflow_run\.event == 'push' && github\.event\.workflow_run\.head_repository\.full_name == github\.repository/);
  });

  it('Rechte: auf Workflow-Ebene keine, am Job nur Lesen plus Issues schreiben', () => {
    expect(wf).toMatch(/^permissions: \{\}$/m);
    const rechte = [...wf.matchAll(/^ {6}([a-z-]+): (read|write)/gm)].map((m) => `${m[1]}: ${m[2]}`);
    expect(rechte).toEqual(['contents: read', 'actions: read', 'issues: write']);
    expect(wf).not.toMatch(/secrets\./);
  });

  it('checkt keinen Code des ausloesenden Commits aus', () => {
    // Ohne ref: nimmt checkout bei workflow_run den Kopf des Standard-Branch.
    const ohneKommentare = wf.split('\n').filter((z) => !z.trim().startsWith('#')).join('\n');
    expect(ohneKommentare).not.toMatch(/head_sha|head_branch|ref:/);
    expect(ohneKommentare).toContain('persist-credentials: false');
  });

  it('ci.yml haengt nicht davon ab -- der Deploy kann daran nicht scheitern', () => {
    expect(ci).not.toMatch(/ci-meldung/);
    expect(ci).not.toMatch(/issues: write/);
  });
});
