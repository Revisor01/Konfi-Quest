/**
 * Swagger UI für die API-Referenz (/docs/api/swagger.html) — aus dem
 * npm-Paket swagger-ui-dist statt als Handkopie im Repo (02.10.2026).
 *
 * WARUM
 *
 * Bis zum 02.10.2026 lagen die drei Dateien (Version 5.17.14, 1,8 MB) von
 * Hand kopiert unter public/docs/api/swagger/. Dependabot sah sie nicht: Ein
 * Sicherheitsupdate von Swagger UI wäre nie angekommen, und welche Version
 * dort lag, stand nirgends. Jetzt steht swagger-ui-dist mit fester Version in
 * package.json (devDependencies) und Lockfile. Dependabot hebt es an, der
 * nächste Build liefert die neue Fassung aus — ohne Kopierschritt.
 *
 * WIE
 *
 * - `vite build`: Das Plugin legt die Dateien als Assets ins Build-Ergebnis
 *   (dist/docs/api/swagger/), neben die swagger.html, die
 *   scripts/build-openapi.mjs erzeugt und Vite aus public/ mitnimmt. Fehlt
 *   eine Datei im Paket, bricht der Build ab, statt eine leere Seite
 *   auszuliefern.
 * - `vite` (Entwicklung): Dieselben Adressen bedient eine Middleware direkt
 *   aus node_modules.
 * - Ins App-Bündel kommen sie nicht: docs/ ist reine Web-Auslieferung
 *   (app-buendel.mjs, istNurWeb).
 *
 * Mit dabei sind LICENSE und NOTICE des Pakets und die beiden
 * *.LICENSE.txt, auf die die Skripte in ihrer ersten Zeile verweisen —
 * Swagger UI steht unter Apache-2.0, und wer es ausliefert, liefert die
 * Lizenz mit.
 *
 * Kein CDN: Die Doku soll nicht von einem fremden Host abhängen und auch
 * offline funktionieren (scripts/build-openapi.mjs).
 *
 * Der Docker-Build (frontend/Dockerfile) installiert mit `npm ci` ohne
 * --omit=dev; die devDependencies sind dort also da — wie vite und
 * typescript, ohne die gar nicht gebaut würde.
 *
 * TELEMETRIE: swagger-ui-dist hängt an @scarf/scarf, das beim Installieren
 * Nutzungszahlen an scarf.sh melden will. package.json schaltet das mit
 * "scarfSettings": { "enabled": false } ab.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Das npm-Paket, aus dem die Dateien kommen. */
export const SWAGGER_PAKET = 'swagger-ui-dist';

/** Wo die Dateien im Build-Ergebnis liegen — relativ zur Web-Wurzel. */
export const SWAGGER_ZIEL = 'docs/api/swagger';

/** Was swagger.html lädt (`./swagger/<datei>`). */
export const SWAGGER_DATEIEN = [
  'swagger-ui-bundle.js',
  'swagger-ui-standalone-preset.js',
  'swagger-ui.css',
];

/** Lizenztexte, die mit ausgeliefert werden. */
export const SWAGGER_LIZENZEN = [
  'LICENSE',
  'NOTICE',
  'swagger-ui-bundle.js.LICENSE.txt',
  'swagger-ui-standalone-preset.js.LICENSE.txt',
];

const ALLE = [...SWAGGER_DATEIEN, ...SWAGGER_LIZENZEN];

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Verzeichnis des installierten Pakets, aufgelöst wie ein import aus frontend/. */
export function swaggerPaketVerzeichnis(von = FRONTEND) {
  try {
    return dirname(createRequire(join(von, 'package.json')).resolve(`${SWAGGER_PAKET}/package.json`));
  } catch {
    throw new Error(`Swagger UI: Paket ${SWAGGER_PAKET} nicht gefunden. Installieren mit:  npm --prefix frontend ci`);
  }
}

/**
 * Die auszuliefernden Dateien mit ihrem Pfad im Paket. Wirft, wenn eine
 * fehlt — eine Swagger-Seite ohne Skript wäre eine leere Seite, und das soll
 * beim Bauen auffallen, nicht erst im Browser.
 */
export function swaggerDateien(paketVerzeichnis) {
  const fehlt = ALLE.filter((datei) => !existsSync(join(paketVerzeichnis, datei)));
  if (fehlt.length) {
    throw new Error(`Swagger UI: Im Paket ${SWAGGER_PAKET} (${paketVerzeichnis}) fehlt ${fehlt.join(', ')}.`);
  }
  return ALLE.map((datei) => ({ datei, pfad: join(paketVerzeichnis, datei) }));
}

const TYP = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

/**
 * Vite-Plugin: Swagger UI im Build-Ergebnis und im Entwicklungsserver.
 * `paketVerzeichnis` nur für Tests; sonst gilt das installierte Paket.
 */
export function swaggerUiPlugin({ paketVerzeichnis } = {}) {
  let verzeichnis = paketVerzeichnis;
  const paket = () => (verzeichnis ??= swaggerPaketVerzeichnis());
  return {
    name: 'konfi-swagger-ui',
    generateBundle() {
      for (const { datei, pfad } of swaggerDateien(paket())) {
        this.emitFile({ type: 'asset', fileName: `${SWAGGER_ZIEL}/${datei}`, source: readFileSync(pfad) });
      }
    },
    configureServer(server) {
      server.middlewares.use(`/${SWAGGER_ZIEL}/`, (req, res, next) => {
        // Nur die bekannten Namen, nie ein Pfad aus der Anfrage: Sonst
        // liesse sich über ../ jede Datei aus node_modules abrufen.
        const datei = (req.url ?? '').split('?')[0].replace(/^\//, '');
        if (!ALLE.includes(datei)) return next();
        const endung = datei.slice(datei.lastIndexOf('.'));
        res.setHeader('Content-Type', TYP[endung] ?? 'text/plain; charset=utf-8');
        res.end(readFileSync(join(paket(), datei)));
      });
    },
  };
}
