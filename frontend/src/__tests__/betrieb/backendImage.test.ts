import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, resolve } from 'node:path';

// Das Backend-Image enthaelt, was zur Laufzeit gebraucht wird -- und nur das
// (29.09.2026, Audit CI BF-06 / Toolchain BF-03).
//
// Vorher: `npm install --omit=dev && npm install pg`. Das zweite `npm install`
// holte alle Dev-Abhaengigkeiten zurueck und nahm pg in der jeweils neuesten
// Fassung statt der aus dem Lockfile; ohne .dockerignore lagen tests/ samt
// Produktions-Schema-Dump im oeffentlich lesbaren Image, dazu Compiler und git.
// Gemessen am selben Commit: 1,92 GB -> 486 MB, 319 -> 251 Module, 253 -> 0
// Testdateien, g++/make/python3/git -> keins davon. Lokal nachgewiesen: Das neue
// Image startet gegen eine Test-Datenbank, spielt 49 Migrationen ein, antwortet
// auf beide Healthchecks (node und curl), bcrypt und node-fetch laden.

const wurzel = resolve(__dirname, '../../../..');
const lies = (pfad: string) => readFileSync(join(wurzel, pfad), 'utf-8');

const dockerfile = lies('backend/Dockerfile');
const dockerignore = lies('backend/.dockerignore')
  .split('\n')
  .map((z) => z.trim())
  .filter((z) => z && !z.startsWith('#'));

/** Die Befehlszeilen einer Stufe (ab ihrem FROM bis vor das naechste). */
function stufen(text: string): string[] {
  const ohneKommentare = text
    .split('\n')
    .filter((z) => !z.trim().startsWith('#'))
    .join('\n')
    .replace(/\\\n/g, ' ');
  return ohneKommentare.split(/^(?=FROM\s)/m).filter((s) => s.startsWith('FROM'));
}

const alleStufen = stufen(dockerfile);
const laufzeit = alleStufen[alleStufen.length - 1];

describe('Backend-Image: Abhaengigkeiten aus dem Lockfile', () => {
  it('installiert mit npm ci --omit=dev -- genau das Lockfile, ohne Dev-Pakete', () => {
    expect(dockerfile).toMatch(/^RUN npm ci --omit=dev\b/m);
  });

  it('kein `npm install` in irgendeiner Stufe (holte Dev-Pakete und ein ungetestetes pg herein)', () => {
    for (const stufe of alleStufen) {
      expect(stufe).not.toMatch(/\bnpm (install|i)\b/);
    }
  });

  it('pg steht in den Laufzeit-Abhaengigkeiten und im Lockfile', () => {
    const pkg = JSON.parse(lies('backend/package.json'));
    const lock = JSON.parse(lies('backend/package-lock.json'));
    expect(pkg.dependencies.pg).toBeTruthy();
    expect(lock.packages['node_modules/pg'].dev).toBeUndefined();
  });
});

/**
 * Pakete, die der Backend-Code zur Laufzeit laedt (require/import ohne
 * relativen Pfad), ohne Tests und node_modules.
 */
function geladenePakete(): Map<string, string> {
  const eingebaut = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));
  const gefunden = new Map<string, string>();
  const besuche = (verz: string) => {
    for (const name of readdirSync(join(wurzel, verz))) {
      const pfad = join(verz, name);
      if (['node_modules', 'tests', 'uploads'].includes(name)) continue;
      if (statSync(join(wurzel, pfad)).isDirectory()) { besuche(pfad); continue; }
      if (!name.endsWith('.js')) continue;
      // Die Lint-Konfiguration laedt Dev-Werkzeug und kommt nicht ins Image
      // (.dockerignore).
      if (name === 'eslint.config.js') continue;
      const text = lies(pfad)
        // JSDoc-Typen wie {import('pg').Pool} sind kein Laden.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      for (const m of text.matchAll(/\b(?:require|import)\(\s*['"]([^'"./][^'"]*)['"]\s*\)/g)) {
        const spez = m[1];
        if (eingebaut.has(spez) || eingebaut.has(spez.split('/')[0])) continue;
        const paket = spez.startsWith('@') ? spez.split('/').slice(0, 2).join('/') : spez.split('/')[0];
        if (!gefunden.has(paket)) gefunden.set(paket, pfad);
      }
    }
  };
  besuche('backend');
  return gefunden;
}

describe('Backend-Image: was der Code laedt, installiert `npm ci --omit=dev`', () => {
  const lock = JSON.parse(lies('backend/package-lock.json'));
  const pakete = geladenePakete();

  it('der Suchlauf findet die bekannten Pakete (sonst prueft der naechste Test nichts)', () => {
    // node-fetch stand hier bis zum 29.09.2026; die Tageslosung nutzt seither
    // das eingebaute fetch (Toolchain BF-05).
    for (const p of ['express', 'pg', 'bcrypt', 'firebase-admin', 'nodemailer']) {
      expect([...pakete.keys()]).toContain(p);
    }
  });

  it('jedes geladene Paket liegt im Lockfile und ist KEINE Dev-Abhaengigkeit', () => {
    // Faengt auch Pakete, die nur transitiv hereinkommen (node-fetch ueber
    // firebase-admin, validator ueber express-validator): Waeren sie nur ueber
    // eine Dev-Abhaengigkeit installiert, fehlten sie im Image -- das alte
    // `npm install pg` hatte genau das verdeckt.
    const fehlend = [...pakete.entries()]
      .filter(([p]) => {
        const eintrag = lock.packages[`node_modules/${p}`];
        return !eintrag || eintrag.dev === true;
      })
      .map(([p, datei]) => `${p} (geladen in ${datei})`);
    expect(fehlend).toEqual([]);
  });
});

describe('Backend-Image: Laufzeit-Stufe ohne Werkzeug und ohne Tests', () => {
  it('zwei Stufen; die Laufzeit steht auf einem -slim-Image', () => {
    expect(alleStufen.length).toBe(2);
    expect(laufzeit).toMatch(/^FROM node:\d+-bookworm-slim\s*$/m);
  });

  it('die Laufzeit-Stufe installiert keinen Compiler, kein python, kein git', () => {
    expect(laufzeit).not.toMatch(/\b(g\+\+|gcc|make|python3?|git|build-essential)\b/);
  });

  it('node_modules kommen fertig aus der Abhaengigkeits-Stufe', () => {
    expect(laufzeit).toMatch(/COPY --from=abhaengigkeiten \/app\/node_modules \.\/node_modules/);
  });

  it('.dockerignore haelt Tests, Schema-Dump, Geheimnisse und lokale Module heraus', () => {
    for (const muster of ['node_modules', 'tests', 'docker-compose.test.yml', '*.md', '.env', '.env.*', 'uploads', 'push/*.json']) {
      expect(dockerignore).toContain(muster);
    }
  });

  it('der Healthcheck des Stacks findet sein Werkzeug im Image', () => {
    // Seit dem 01.10.2026 pruefen alle drei Backends im Stack wie das Image
    // selbst mit `node healthcheck.js` -- curl wird nicht mehr nachinstalliert.
    // Fehlte das Werkzeug, waere jeder neue Container "unhealthy", und
    // deploy/rollend.sh wartet genau auf "healthy".
    const compose = lies('deploy/compose.konfi_quest.yml');
    const backendBloecke = ['backend', 'backend2', 'backend-test'].map((d) => {
      const start = compose.indexOf(`\n  ${d}:\n`);
      expect(start, `Dienst ${d}`).toBeGreaterThan(-1);
      const rest = compose.slice(start + 1);
      const ende = rest.slice(3).search(/\n {2}[a-z0-9-]+:\n/);
      return ende < 0 ? rest : rest.slice(0, ende + 3);
    });
    for (const block of backendBloecke) {
      expect(block).toContain('test: ["CMD", "node", "healthcheck.js"]');
    }
    // Die Datei liegt im Image (nicht in .dockerignore) und prueft /api/health.
    expect(dockerignore).not.toContain('healthcheck.js');
    expect(lies('backend/healthcheck.js')).toContain("path: '/api/health'");
    // Wer den Stack wieder auf curl stellt, muss es auch wieder installieren.
    const mitCurl = backendBloecke.filter((b) => /test: \[[^\]]*"curl"/.test(b));
    expect(mitCurl).toEqual([]);
    expect(laufzeit).not.toMatch(/\bcurl\b/);
  });

  it('der Stack laesst die Backends als uid 1000 laufen, nicht als root (CI BF-06)', () => {
    const compose = lies('deploy/compose.konfi_quest.yml');
    const nutzer = [...compose.matchAll(/^ {4}user: "(\d+):(\d+)"$/gm)].map((m) => `${m[1]}:${m[2]}`);
    expect(nutzer).toEqual(['1000:1000', '1000:1000', '1000:1000']);
    // uid 1000 ist `node` im Basis-Image; ihm gehoert das Upload-Verzeichnis.
    expect(laufzeit).toMatch(/chown node:node \/app\/uploads/);
  });
});
