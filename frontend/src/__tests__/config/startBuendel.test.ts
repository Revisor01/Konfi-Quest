import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { START_BUDGET_GZIP_BYTES, appBuendelPruefen, startGroesse } from '../../../scripts/app-buendel.mjs';

/**
 * Was die App beim Start lädt (29.09.2026, Toolchain-Audit BF-11).
 *
 * Der Befund sprach von einem 1,39-MB-"Icon-Chunk", der sofort lädt.
 * Nachgemessen (Sourcemap): Der Chunk heißt heute dateUtils-*.js, weil
 * rolldown ihn nach einem seiner Module benennt, und ist zu 1,02 MB die
 * Komponenten-Bibliothek von Ionic (@ionic/react lädt sie beim Start ganz),
 * die Symbole sind 0,16 MB. Ihn zu teilen spart beim Start nichts.
 *
 * Ohne Risiko ging: die unbenutzte float-elements.css weglassen (einzige
 * Quelle der lightningcss-Warnung) und den wirkungslosen dynamischen Import
 * des iOS-Themes in MainTabs statisch machen. Start vorher 37 Dateien,
 * 2.362.006 Bytes, gzip 538.260; nachher 36 Dateien, 2.348.605, gzip
 * 535.707. Die Build-Ausgabe hat keine Warnung mehr. Über die Summe wacht
 * START_BUDGET_GZIP_BYTES (der Build bricht ab).
 */

const FRONTEND = process.cwd();

function quelldateien(): string[] {
  const liste: string[] = [];
  const lauf = (ordner: string) => {
    for (const e of readdirSync(ordner, { withFileTypes: true })) {
      const voll = join(ordner, e.name);
      if (e.isDirectory()) {
        if (e.name === '__tests__' || e.name === '__mocks__') continue;
        lauf(voll);
      } else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        liste.push(voll);
      }
    }
  };
  lauf(join(FRONTEND, 'src'));
  return liste;
}

/** Relativen Pfad auf die Datei auflösen; Paketnamen bleiben, wie sie sind. */
function ziel(von: string, angabe: string): string {
  if (!angabe.startsWith('.')) return angabe;
  const basis = resolve(dirname(von), angabe);
  for (const endung of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (existsSync(basis + endung) && !(endung === '' && !/\.[a-z]+$/.test(basis))) return basis + endung;
  }
  return basis;
}

describe('Start: dynamische Importe, die wirklich trennen', () => {
  /** Statische Importe je Datei (aufgelöst), ohne reine Typ-Importe. */
  const kanten = new Map<string, string[]>();
  const dynamisch: Array<{ datei: string; angabe: string; ziel: string }> = [];

  for (const datei of quelldateien()) {
    const text = readFileSync(datei, 'utf8');
    const ziele: string[] = [];
    // import … from '…' und export … from '…' (auch mehrzeilig), ohne reine
    // Typ-Importe — die verschwinden beim Bauen.
    for (const m of text.matchAll(/^\s*(?:import|export)\s+(?!type\s)[^;'"]*?\bfrom\s+['"]([^'"]+)['"]/gms)) {
      ziele.push(ziel(datei, m[1]));
    }
    for (const m of text.matchAll(/^\s*import\s+['"]([^'"]+)['"]/gm)) ziele.push(ziel(datei, m[1]));
    kanten.set(datei, ziele);
    for (const zeile of text.split('\n')) {
      const t = zeile.trim();
      if (t.startsWith('//') || t.startsWith('*') || /^(export\s+)?type\s/.test(t)) continue;
      for (const m of zeile.matchAll(/(?<![\w.])import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        dynamisch.push({ datei, angabe: m[1], ziel: ziel(datei, m[1]) });
      }
    }
  }

  /** Alles, was main.tsx über statische Importe erreicht: der Start. */
  const imStart = new Set<string>();
  const offen = [join(FRONTEND, 'src/main.tsx')];
  while (offen.length) {
    const datei = offen.pop()!;
    if (imStart.has(datei)) continue;
    imStart.add(datei);
    for (const z of kanten.get(datei) ?? []) {
      if (kanten.has(z)) offen.push(z);
      else imStart.add(z);
    }
  }

  it('findet die dynamischen Importe und den Start (Suche greift)', () => {
    expect(dynamisch.some((d) => d.angabe === './PdfSeiten')).toBe(true);
    expect(dynamisch.filter((d) => d.datei.endsWith('rollenBaeume.ts')).length).toBeGreaterThanOrEqual(30);
    expect(imStart.has('@ionic/react')).toBe(true);
    expect(imStart.has(join(FRONTEND, 'src/App.tsx'))).toBe(true);
    // Die Seiten laden nach, sie gehören nicht zum Start.
    expect(imStart.has(join(FRONTEND, 'src/components/admin/pages/AdminSettingsPage.tsx'))).toBe(false);
  });

  it('kein Modul wird dynamisch geladen, das der Start schon statisch enthält', () => {
    // Sonst trennt Vite nichts ab (INEFFECTIVE_DYNAMIC_IMPORT) — das
    // import() verzögert dann nur, ohne etwas zu sparen. So stand es bis
    // 29.09.2026 in MainTabs für @rdlabo/ionic-theme-ios27.
    const wirkungslos = dynamisch
      .filter((d) => imStart.has(d.ziel))
      .map((d) => `${d.datei.slice(FRONTEND.length + 1)}: import('${d.angabe}')`);
    expect(wirkungslos).toEqual([]);
  });
});

describe('Start: Ionic-Hilfsklassen', () => {
  it('float-elements.css ist nicht eingebunden, und keine Stelle nutzt ion-float-*', () => {
    const app = readFileSync(join(FRONTEND, 'src/App.tsx'), 'utf8');
    expect(app).not.toMatch(/^import '@ionic\/react\/css\/float-elements\.css';$/m);
    const css = readdirSync(join(FRONTEND, 'src/theme')).map((d) => join(FRONTEND, 'src/theme', d));
    const nutzer = [...quelldateien(), ...css].filter((d) => /\bion-float-/.test(readFileSync(d, 'utf8')));
    expect(nutzer).toEqual([]);
  });
});

describe('Start: Grenze für das, was beim Start lädt', () => {
  let wurzel: string;
  beforeEach(() => {
    wurzel = mkdtempSync(join(tmpdir(), 'start-buendel-'));
    mkdirSync(join(wurzel, 'assets'));
  });
  afterEach(() => rmSync(wurzel, { recursive: true, force: true }));

  const seite = (kopf: string) => writeFileSync(join(wurzel, 'index.html'), `<!doctype html><html><head>${kopf}</head><body></body></html>`);

  it('zählt Einstiegsskript, modulepreload und Stile — keine nachgeladenen Chunks', () => {
    writeFileSync(join(wurzel, 'assets/index-a.js'), 'a'.repeat(1000));
    writeFileSync(join(wurzel, 'assets/vendor-b.js'), 'b'.repeat(2000));
    writeFileSync(join(wurzel, 'assets/index-c.css'), 'c'.repeat(3000));
    writeFileSync(join(wurzel, 'assets/spaeter-d.js'), 'd'.repeat(4000));
    seite('<script type="module" crossorigin src="/assets/index-a.js"></script>'
      + '<link rel="modulepreload" crossorigin href="/assets/vendor-b.js">'
      + '<link rel="stylesheet" crossorigin href="/assets/index-c.css">'
      + '<link rel="icon" href="/assets/icon/favicon-32x32.png">');
    const { dateien, roh, gzip } = startGroesse(wurzel);
    expect(dateien).toEqual(['assets/index-a.js', 'assets/vendor-b.js', 'assets/index-c.css']);
    expect(roh).toBe(6000);
    expect(gzip).toBeGreaterThan(0);
    expect(gzip).toBeLessThan(200);
    expect(appBuendelPruefen(wurzel)).toEqual([]);
  });

  it('über der Grenze ist ein Befund', () => {
    // Zufallsbytes lassen sich nicht packen: gzip ~ roh.
    writeFileSync(join(wurzel, 'assets/index-a.js'), randomBytes(START_BUDGET_GZIP_BYTES + 1000));
    seite('<script type="module" crossorigin src="/assets/index-a.js"></script>');
    const { gzip } = startGroesse(wurzel);
    expect(gzip).toBeGreaterThan(START_BUDGET_GZIP_BYTES);
    expect(appBuendelPruefen(wurzel)).toEqual([
      `Start lädt 1 Dateien, ${gzip} Bytes gzip, erlaubt sind ${START_BUDGET_GZIP_BYTES} (START_BUDGET_GZIP_BYTES in scripts/app-buendel.mjs)`,
    ]);
  });
});
