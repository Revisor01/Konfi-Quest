import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SWAGGER_DATEIEN,
  SWAGGER_LIZENZEN,
  SWAGGER_PAKET,
  SWAGGER_ZIEL,
  swaggerDateien,
  swaggerPaketVerzeichnis,
  swaggerUiPlugin,
} from '../../../scripts/swagger-ui.mjs';

/**
 * Swagger UI der API-Referenz kommt aus dem npm-Paket swagger-ui-dist
 * (02.10.2026). Vorher lag eine Handkopie (5.17.14, 1,8 MB) in
 * public/docs/api/swagger/, die Dependabot nicht sah.
 *
 * Geprueft wird die ganze Kette:
 *  - swagger.html laedt genau die Dateien, die der Build liefert,
 *  - das Paket steht mit fester Version in package.json und Lockfile,
 *  - der Build legt die Dateien an und bricht ab, wenn eine fehlt,
 *  - der Entwicklungsserver liefert sie und sonst nichts aus node_modules,
 *  - es gibt keine Handkopie mehr, die still veralten koennte.
 */

const FRONTEND = process.cwd();
const pkg = JSON.parse(readFileSync(join(FRONTEND, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(join(FRONTEND, 'package-lock.json'), 'utf8'));
const swaggerHtml = readFileSync(join(FRONTEND, 'public', 'docs', 'api', 'swagger.html'), 'utf8');

describe('Swagger UI: Seite und Paket passen zusammen', () => {
  it('swagger.html laedt genau die Dateien, die der Build liefert', () => {
    const geladen = [...swaggerHtml.matchAll(/(?:src|href)="\.\/swagger\/([^"]+)"/g)].map((m) => m[1]);
    expect(geladen.sort()).toEqual([...SWAGGER_DATEIEN].sort());
    expect(SWAGGER_ZIEL).toBe('docs/api/swagger');
  });

  it('swagger.html laedt nichts von einem fremden Host', () => {
    expect(swaggerHtml).not.toMatch(/(?:src|href)="(?:https?:)?\/\//);
  });

  it('das Paket steht mit fester Version in package.json, im Lockfile und in node_modules', () => {
    const version = pkg.devDependencies[SWAGGER_PAKET];
    // Fest, nicht ^: Die Version wechselt nur mit einem sichtbaren Commit
    // (Dependabot), nicht still bei einem npm install.
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.dependencies[SWAGGER_PAKET]).toBeUndefined();
    expect(lock.packages[`node_modules/${SWAGGER_PAKET}`].version).toBe(version);
    const installiert = JSON.parse(readFileSync(join(swaggerPaketVerzeichnis(), 'package.json'), 'utf8'));
    expect(installiert.version).toBe(version);
  });

  it('das Paket stellt die beiden Namen bereit, die swagger.html aufruft', () => {
    // Faellt bei einem Update mit umbenannten Globalen auf, bevor die Seite
    // leer bleibt.
    expect(swaggerHtml).toContain('SwaggerUIBundle(');
    expect(swaggerHtml).toContain('SwaggerUIStandalonePreset');
    const paket = swaggerPaketVerzeichnis();
    expect(readFileSync(join(paket, 'swagger-ui-bundle.js'), 'utf8')).toContain('SwaggerUIBundle');
    expect(readFileSync(join(paket, 'swagger-ui-standalone-preset.js'), 'utf8')).toContain('SwaggerUIStandalonePreset');
  });

  it('die Meldung von @scarf/scarf beim Installieren ist abgeschaltet', () => {
    // swagger-ui-dist zieht @scarf/scarf nach, das bei npm ci Nutzungszahlen
    // an scarf.sh melden will.
    expect(lock.packages['node_modules/@scarf/scarf']).toMatchObject({ hasInstallScript: true });
    expect(pkg.scarfSettings).toEqual({ enabled: false });
  });

  it('es gibt keine Handkopie mehr in public/', () => {
    expect(existsSync(join(FRONTEND, 'public', 'docs', 'api', 'swagger'))).toBe(false);
  });

  it('der Build traegt das Plugin ein', () => {
    // vite.config.ts laesst sich unter jsdom nicht importieren -- wie in
    // appBuendel.test.ts der Blick in die Datei; das Verhalten pruefen die
    // Faelle unten.
    const vite = readFileSync(join(FRONTEND, 'vite.config.ts'), 'utf8');
    expect(vite).toMatch(/^import \{ swaggerUiPlugin \} from '\.\/scripts\/swagger-ui\.mjs'$/m);
    const plugins = vite.match(/plugins:\s*\[([\s\S]*?)\n\s*\],/)?.[1] ?? '';
    expect(plugins.split('\n').filter((z) => !z.trim().startsWith('//')).join('\n')).toMatch(/\bswaggerUiPlugin\(\)/);
  });
});

describe('Swagger UI: Build und Entwicklungsserver', () => {
  let paket: string;
  const ALLE = [...SWAGGER_DATEIEN, ...SWAGGER_LIZENZEN];

  beforeEach(() => {
    paket = mkdtempSync(join(tmpdir(), 'swagger-ui-'));
    for (const datei of ALLE) writeFileSync(join(paket, datei), `inhalt von ${datei}`);
  });
  afterEach(() => rmSync(paket, { recursive: true, force: true }));

  it('das installierte Paket hat alle Dateien', () => {
    const dateien = swaggerDateien(swaggerPaketVerzeichnis());
    expect(dateien.map((d: { datei: string }) => d.datei)).toEqual(ALLE);
  });

  it('der Build legt jede Datei unter docs/api/swagger/ ab', () => {
    const emitFile = vi.fn();
    swaggerUiPlugin({ paketVerzeichnis: paket }).generateBundle.call({ emitFile });
    expect(emitFile).toHaveBeenCalledTimes(ALLE.length);
    for (const datei of ALLE) {
      expect(emitFile).toHaveBeenCalledWith({
        type: 'asset',
        fileName: `docs/api/swagger/${datei}`,
        source: Buffer.from(`inhalt von ${datei}`),
      });
    }
  });

  it('fehlt eine Datei im Paket, bricht der Build ab', () => {
    rmSync(join(paket, 'swagger-ui-bundle.js'));
    const emitFile = vi.fn();
    expect(() => swaggerUiPlugin({ paketVerzeichnis: paket }).generateBundle.call({ emitFile }))
      .toThrow(/fehlt swagger-ui-bundle\.js/);
    expect(emitFile).not.toHaveBeenCalled();
  });

  /** Ruft die Middleware des Entwicklungsservers mit einer Adresse auf. */
  function anfrage(url: string) {
    let middleware: ((req: unknown, res: unknown, next: () => void) => void) | undefined;
    let pfad = '';
    swaggerUiPlugin({ paketVerzeichnis: paket }).configureServer({
      middlewares: { use: (p: string, fn: typeof middleware) => { pfad = p; middleware = fn; } },
    });
    const res = { setHeader: vi.fn(), end: vi.fn() };
    const next = vi.fn();
    middleware!({ url }, res, next);
    return { pfad, res, next };
  }

  it('der Entwicklungsserver liefert die Dateien aus dem Paket', () => {
    const { pfad, res, next } = anfrage('/swagger-ui-bundle.js?v=1');
    expect(pfad).toBe('/docs/api/swagger/');
    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/javascript; charset=utf-8');
    expect(res.end).toHaveBeenCalledWith(Buffer.from('inhalt von swagger-ui-bundle.js'));
    expect(anfrage('/swagger-ui.css').res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/css; charset=utf-8');
  });

  it('der Entwicklungsserver liefert sonst nichts aus node_modules', () => {
    writeFileSync(join(paket, 'package.json'), '{}');
    for (const url of ['/package.json', '/../package.json', '/..%2Fpackage.json', '/index.js']) {
      const { res, next } = anfrage(url);
      expect(next, url).toHaveBeenCalledTimes(1);
      expect(res.end, url).not.toHaveBeenCalled();
    }
  });
});
