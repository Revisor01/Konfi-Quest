import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// deploy/rollend.sh gegen eine nachgebaute Portainer-API (29.09.2026).
//
// Das Skript ist der Produktions-Deploy jedes Pushs auf main und hatte bis
// hierher keinen einzigen Test (Audit CI, Stand 27.09.2026). Nachgebaut ist,
// was das Skript von Portainer liest und schreibt: Stack-Datei und -Variablen,
// update_stack, die Container-Liste mit Healthcheck und /api/status. Die
// Stack-Datei ist die Referenz aus deploy/compose.konfi_quest.yml -- also die
// echte Struktur mit Ankern, Kommentaren und backend-test.
//
// Geprueft wird vor allem die Vorwaerts-Pruefung (NUR_VORWAERTS, Audit CI
// BF-04): Sie darf einen Deploy NUR ueberspringen, wenn Produktion belegbar
// schon einen neueren Stand faehrt, der diesen enthaelt -- in jedem
// Zweifelsfall wird ausgerollt.

// Jeder Lauf startet bash mit rund zwanzig curl- und python-Aufrufen; auf
// einem ausgelasteten Rechner dauert das laenger als die 5 s Vorgabe.
vi.setConfig({ testTimeout: 30_000 });

const wurzel = resolve(__dirname, '../../../..');
const SKRIPT = join(wurzel, 'deploy/rollend.sh');
const REFERENZ = readFileSync(join(wurzel, 'deploy/compose.konfi_quest.yml'), 'utf-8');
const SCHLUESSEL = 'test-schluessel';

/** image-Zeile je Dienst, so wie das Skript Dienstbloecke abgrenzt. */
function imagesAus(text: string): Record<string, string> {
  const bilder: Record<string, string> = {};
  let dienst: string | null = null;
  for (const zeile of text.split('\n')) {
    if (/^\S/.test(zeile)) dienst = null;
    const kopf = zeile.match(/^ {2}([A-Za-z0-9_.-]+):\s*(#.*)?$/);
    if (kopf) { dienst = kopf[1]; continue; }
    const bild = zeile.match(/^\s+image:\s*(\S+)/);
    if (dienst && bild && !bilder[dienst]) bilder[dienst] = bild[1];
  }
  return bilder;
}

type Container = { id: string; image: string; created: number };

/** Nachgebaute Portainer-API samt /api/status der Backends. */
class Portainer {
  stack = '';
  env = [{ name: 'SMTP_HOST', value: 'mail.example' }];
  puts: Array<{ compose: string; env: unknown; pullImage: unknown }> = [];
  container = new Map<string, Container>();
  /** Kurz-Tag -> voller Commit, fuer die Antwort von /api/status. */
  commits = new Map<string, string>();
  /** Erzwungene Antworten fuer die ersten Status-Abfragen (null = 502). */
  statusVorgabe: Array<string | null> = [];
  statusAbfragen = 0;
  private naechsteId = 1;
  private reihum = 0;

  anfang(tagAlt: string) {
    this.stack = REFERENZ.split('<TAG>').join(tagAlt);
    this.puts = [];
    this.container.clear();
    this.statusVorgabe = [];
    this.statusAbfragen = 0;
    this.uebernehme(this.stack);
  }

  private uebernehme(text: string) {
    for (const [dienst, image] of Object.entries(imagesAus(text))) {
      const alt = this.container.get(dienst);
      if (!alt || alt.image !== image) {
        this.container.set(dienst, { id: `c${this.naechsteId++}`, image, created: this.naechsteId });
      }
    }
  }

  private commitVon(dienst: string): string {
    const image = this.container.get(dienst)?.image ?? '';
    return this.commits.get(image.split(':').pop() ?? '') ?? '';
  }

  behandle(req: IncomingMessage, res: ServerResponse, koerper: string) {
    const url = new URL(req.url ?? '/', 'http://x');
    const json = (status: number, daten: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(daten));
    };
    if (url.pathname === '/api/status') {
      const i = this.statusAbfragen++;
      if (i < this.statusVorgabe.length) {
        const vorgabe = this.statusVorgabe[i];
        if (vorgabe === null) { res.writeHead(502); res.end('Bad Gateway'); return; }
        return json(200, { status: 'OK', commit: vorgabe, checks: { database: 'ok', migrations: 'ok' } });
      }
      // Traefik verteilt reihum auf beide Replicas.
      const dienst = this.reihum++ % 2 === 0 ? 'backend' : 'backend2';
      return json(200, { status: 'OK', commit: this.commitVon(dienst), checks: { database: 'ok', migrations: 'ok' } });
    }
    if (req.headers['x-api-key'] !== SCHLUESSEL) return json(401, { message: 'Unauthorized' });
    if (url.pathname === '/api/stacks/249/file') return json(200, { StackFileContent: this.stack });
    if (url.pathname === '/api/stacks/249' && req.method === 'GET') return json(200, { Id: 249, Env: this.env });
    if (url.pathname === '/api/stacks/249' && req.method === 'PUT') {
      const daten = JSON.parse(koerper);
      this.puts.push({ compose: daten.stackFileContent, env: daten.env, pullImage: daten.pullImage });
      this.stack = daten.stackFileContent;
      this.uebernehme(this.stack);
      return json(200, { Id: 249 });
    }
    if (url.pathname === '/api/endpoints/1/docker/containers/json') {
      return json(200, [...this.container.entries()].map(([dienst, c]) => ({
        Id: c.id, Created: c.created,
        Labels: { 'com.docker.compose.service': dienst, 'com.docker.compose.project': 'konfi_quest' },
      })));
    }
    const inspiziere = url.pathname.match(/^\/api\/endpoints\/1\/docker\/containers\/([^/]+)\/json$/);
    if (inspiziere) {
      const eintrag = [...this.container.values()].find((c) => c.id === inspiziere[1]);
      if (!eintrag) return json(404, {});
      return json(200, { Id: eintrag.id, Config: { Image: eintrag.image }, State: { Status: 'running', Health: { Status: 'healthy' } } });
    }
    return json(404, { message: `unbekannt: ${req.method} ${url.pathname}` });
  }
}

let server: Server;
let basis = '';
const portainer = new Portainer();
let repo = '';
let A = '', B = '', C = '';

const git = (...args: string[]) =>
  execFileSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd: repo,
    env: {
      PATH: process.env.PATH ?? '', HOME: repo, GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.org',
      GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.org',
    },
  }).toString().trim();

beforeAll(async () => {
  server = createServer((req, res) => {
    let koerper = '';
    req.on('data', (d) => { koerper += d; });
    req.on('end', () => portainer.behandle(req, res, koerper));
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
  const adresse = server.address();
  basis = `http://127.0.0.1:${typeof adresse === 'object' && adresse ? adresse.port : 0}`;

  // Verlauf wie auf main: A (aelter) -> B (wird deployt) -> C (neuer).
  repo = mkdtempSync(join(tmpdir(), 'rollend-'));
  git('init', '-q');
  for (const n of ['A', 'B', 'C']) git('commit', '-q', '--allow-empty', '-m', n);
  C = git('rev-parse', 'HEAD');
  B = git('rev-parse', 'HEAD~1');
  A = git('rev-parse', 'HEAD~2');
  for (const sha of [A, B, C]) portainer.commits.set(sha.slice(0, 7), sha);
});

afterAll(async () => {
  await new Promise<void>((ok) => server.close(() => ok()));
  rmSync(repo, { recursive: true, force: true });
});

beforeEach(() => {
  rmSync(join(repo, 'compose.yml'), { force: true });
  rmSync(join(repo, 'zusammenfassung.md'), { force: true });
});

function rolle(gitSha: string, extra: Record<string, string> = {}): Promise<{ code: number; aus: string }> {
  return new Promise((ok) => {
    execFile('bash', [SKRIPT], {
      cwd: repo,
      env: {
        PATH: process.env.PATH ?? '', HOME: repo,
        P_URL: basis, P_KEY: SCHLUESSEL, STACK_ID: '249', ENDPOINT_ID: '1',
        GIT_SHA: gitSha, BACKEND_CHANGED: '1', STATUS_URL: `${basis}/api/status`,
        WARTE_S: '0', WARTE_MAX: '5', VERIFY_ABFRAGEN: '3', VERIFY_PAUSE_S: '0', FEHLER_PAUSE_S: '0',
        GITHUB_STEP_SUMMARY: join(repo, 'zusammenfassung.md'),
        ...extra,
      },
      timeout: 30_000,
    }, (fehler, stdout, stderr) => {
      const code = fehler ? (typeof fehler.code === 'number' ? fehler.code : 1) : 0;
      ok({ code, aus: `${stdout}${stderr}` });
    });
  });
}

const kurz = (sha: string) => sha.slice(0, 7);

describe('rollender Deploy: der Normalfall', () => {
  it('erst backend und frontend, dann backend2 -- backend-test bleibt unberuehrt', async () => {
    portainer.anfang(kurz(A));
    const { code, aus } = await rolle(B, { NUR_VORWAERTS: '1' });
    expect(code, aus).toBe(0);
    expect(aus).toContain('OK Rollender Deploy verifiziert');
    expect(portainer.puts).toHaveLength(2);

    const stufe1 = imagesAus(portainer.puts[0].compose);
    expect(stufe1.backend).toBe(`ghcr.io/revisor01/konfi-quest-backend:${kurz(B)}`);
    expect(stufe1.frontend).toBe(`ghcr.io/revisor01/konfi-quest-frontend:${kurz(B)}`);
    expect(stufe1.backend2).toBe(`ghcr.io/revisor01/konfi-quest-backend:${kurz(A)}`);

    const stufe2 = imagesAus(portainer.puts[1].compose);
    expect(stufe2.backend2).toBe(`ghcr.io/revisor01/konfi-quest-backend:${kurz(B)}`);
    for (const put of portainer.puts) {
      expect(imagesAus(put.compose)['backend-test']).toBe('ghcr.io/revisor01/konfi-quest-backend:test-latest');
      expect(imagesAus(put.compose).postgres).toBe('postgres:15-alpine');
      // Stack-Variablen gehen unveraendert zurueck ("env": [] loeschte sie).
      expect(put.env).toEqual([{ name: 'SMTP_HOST', value: 'mail.example' }]);
      expect(put.pullImage).toBe(true);
    }
  });

  it('derselbe Stand noch einmal (Wiederholung eines Laufs) rollt erneut aus', async () => {
    portainer.anfang(kurz(B));
    const { code, aus } = await rolle(B, { NUR_VORWAERTS: '1' });
    expect(code, aus).toBe(0);
    expect(aus).toContain('ist schon live -> erneut ausrollen');
    expect(portainer.puts).toHaveLength(2);
  });
});

describe('rollender Deploy: nur vorwaerts (NUR_VORWAERTS=1)', () => {
  it('ein neuerer Stand ist live, der diesen enthaelt: kein update_stack, Lauf endet gruen mit Hinweis', async () => {
    portainer.anfang(kurz(C));
    const { code, aus } = await rolle(B, { NUR_VORWAERTS: '1' });
    expect(code, aus).toBe(0);
    expect(aus).toContain('::notice::Deploy uebersprungen');
    expect(portainer.puts).toHaveLength(0);
    expect(existsSync(join(repo, 'zusammenfassung.md'))).toBe(true);
    expect(readFileSync(join(repo, 'zusammenfassung.md'), 'utf-8')).toContain(kurz(C));
  });

  it('Gegenprobe: OHNE den Schalter (Notfall-Deploy) rollt derselbe Fall zurueck', async () => {
    portainer.anfang(kurz(C));
    const { code, aus } = await rolle(B);
    expect(code, aus).toBe(0);
    expect(portainer.puts).toHaveLength(2);
    expect(imagesAus(portainer.stack).backend2).toBe(`ghcr.io/revisor01/konfi-quest-backend:${kurz(B)}`);
  });

  it('Status nicht erreichbar: im Zweifel ausrollen', async () => {
    portainer.anfang(kurz(C));
    portainer.statusVorgabe = [null];
    const { code, aus } = await rolle(B, { NUR_VORWAERTS: '1' });
    expect(code, aus).toBe(0);
    expect(aus).toContain('ohne Commit -> ausrollen');
    expect(portainer.puts).toHaveLength(2);
  });

  it('uneinheitliche Antworten (Tausch mittendrin abgebrochen): ausrollen', async () => {
    portainer.anfang(kurz(C));
    portainer.statusVorgabe = [C, A];
    const { code, aus } = await rolle(B, { NUR_VORWAERTS: '1' });
    expect(code, aus).toBe(0);
    expect(aus).toContain('uneinheitlich');
    expect(portainer.puts).toHaveLength(2);
  });

  it('live-Commit nicht im Verlauf: ausrollen', async () => {
    portainer.anfang(kurz(C));
    const fremd = 'f'.repeat(40);
    portainer.statusVorgabe = [fremd, fremd, fremd];
    const { code, aus } = await rolle(B, { NUR_VORWAERTS: '1' });
    expect(code, aus).toBe(0);
    expect(aus).toContain('nicht im Verlauf -> ausrollen');
    expect(portainer.puts).toHaveLength(2);
  });

  it('live ist aelter: ausrollen', async () => {
    portainer.anfang(kurz(A));
    const { code, aus } = await rolle(C, { NUR_VORWAERTS: '1' });
    expect(code, aus).toBe(0);
    expect(aus).toContain('aelter oder abgezweigt -> ausrollen');
    expect(portainer.puts).toHaveLength(2);
  });
});

describe('Probelauf (Notfall-Deploy proben, Audit CI BF-10)', () => {
  it('liest alles, schreibt die Tags auf einer Kopie um -- und ruft update_stack NICHT', async () => {
    portainer.anfang(kurz(C));
    const stackVorher = portainer.stack;
    const { code, aus } = await rolle(A, { PROBELAUF: '1' });
    expect(code, aus).toBe(0);
    expect(aus).toContain('OK Probelauf');
    expect(portainer.puts).toHaveLength(0);
    expect(portainer.stack).toBe(stackVorher);
    // Der Plan nennt alle drei Dienste auf dem Zielstand, backend-test bleibt.
    for (const d of ['backend', 'backend2', 'frontend']) {
      expect(aus).toMatch(new RegExp(`${d}: \\S+:${kurz(C)} -> \\S+:${kurz(A)}`));
    }
    expect(aus).toMatch(/backend-test: \S+:test-latest -> \S+:test-latest/);
    expect(aus).toContain('Stack-Variablen, die mitgeschickt wuerden: 1');
  });

  it('meldet einen falschen Schluessel, statt still durchzulaufen', async () => {
    portainer.anfang(kurz(C));
    const { code } = await rolle(A, { PROBELAUF: '1', P_KEY: 'falsch' });
    expect(code).not.toBe(0);
    expect(portainer.puts).toHaveLength(0);
  });
});

describe('Notfall-Deploy-Workflow', () => {
  const nf = readFileSync(join(wurzel, '.github/workflows/notfall-deploy.yml'), 'utf-8');

  it('rollt ueber deploy/rollend.sh aus -- denselben Weg wie der CI-Deploy', () => {
    expect(nf).toMatch(/run: \|\n(?:.*\n)*? {10}bash deploy\/rollend\.sh/);
    expect(nf).not.toMatch(/api\/stacks\/\$STACK_ID\?endpointId/);
  });

  it('darf zurueckrollen: kein NUR_VORWAERTS', () => {
    expect(nf).not.toMatch(/^\s+NUR_VORWAERTS:/m);
  });

  it('hat einen Probelauf, der als Eingabe beim Auslosen waehlbar ist', () => {
    expect(nf).toMatch(/probelauf:\n {8}description: [^\n]+\n {8}type: boolean\n {8}default: false/);
    expect(nf).toMatch(/PROBELAUF: \$\{\{ inputs\.probelauf && '1' \|\| '0' \}\}/);
  });

  it('darf die Images auf ghcr lesen und laeuft nie neben einem CI-Deploy', () => {
    expect(nf).toMatch(/permissions:\n {2}contents: read\n {2}packages: read/);
    expect(nf).toMatch(/concurrency:\n {6}group: deploy-production\n {6}cancel-in-progress: false/);
  });

  it('prueft gegen den vollen Commit (wie /api/status ihn meldet)', () => {
    expect(nf).toMatch(/GIT_SHA: \$\{\{ steps\.tag\.outputs\.voll \}\}/);
    expect(nf).toMatch(/BACKEND_CHANGED: "1"/);
  });

  it('bestimmt den Stand ueber deploy/notfall-tag.sh, nach dem Login auf ghcr (30.09.2026)', () => {
    // Das Verhalten des Skripts pruefen notfallTag.test.ts; hier nur, dass
    // der Workflow es aufruft und nicht wieder eine eigene Kopie der Logik traegt.
    expect(nf).toMatch(/docker login ghcr\.io[^\n]*\n {10}bash deploy\/notfall-tag\.sh\n/);
    expect(nf).not.toMatch(/git rev-parse --short=7 HEAD/);
  });
});

describe('Deploy-Job in ci.yml', () => {
  const ci = readFileSync(join(wurzel, '.github/workflows/ci.yml'), 'utf-8');

  it('ruft deploy/rollend.sh mit NUR_VORWAERTS=1', () => {
    const schritt = ci.slice(ci.indexOf('Rollender Deploy via Portainer-API'));
    expect(schritt).toMatch(/NUR_VORWAERTS: "1"/);
    expect(schritt).toMatch(/run: bash deploy\/rollend\.sh/);
  });

  it('holt den vollen Verlauf -- ohne ihn kennt die Vorwaerts-Pruefung den live-Commit nicht', () => {
    const job = ci.slice(ci.indexOf('\n  deploy:'));
    expect(job).toMatch(/fetch-depth: 0/);
  });

  it('bricht Laeufe nur ausserhalb von main ab; auf main hat jeder Commit seine eigene Gruppe', () => {
    expect(ci).toMatch(/^concurrency:\n {2}group: ci-\$\{\{ github\.ref == 'refs\/heads\/main' && github\.sha \|\| github\.ref \}\}\n {2}cancel-in-progress: \$\{\{ github\.ref != 'refs\/heads\/main' \}\}$/m);
  });
});
