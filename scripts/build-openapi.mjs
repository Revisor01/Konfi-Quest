#!/usr/bin/env node
/**
 * Fuehrt die OpenAPI-Dateien aus docs/api/ zu EINER Datei zusammen und legt
 * die Swagger-UI-Seite daneben.
 *
 * Aufruf:  node scripts/build-openapi.mjs
 * Ergebnis:
 *   frontend/public/docs/api/openapi.json   — zusammengefuehrte Spezifikation
 *   frontend/public/docs/api/swagger.html   — Swagger-UI-Seite dazu
 *
 * Warum eine zusammengefuehrte Datei: Die Quellen sind nach Themen getrennt
 * (chat, konfis-events, verwaltung-auth, teamer-material, stammdaten), damit
 * sie handhabbar bleiben. Swagger UI zeigt aber eine Spezifikation; die
 * Themen bleiben über tags sichtbar.
 *
 * Warum eingecheckt: wie bei den uebrigen Doku-Dateien — der Docker-Kontext
 * ist ./frontend, docs/ und scripts/ liegen darueber.
 *
 * Swagger UI liegt lokal unter docs/api/swagger/ statt per CDN: Die Doku soll
 * nicht von einem fremden Host abhaengen und auch offline funktionieren.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const QUELLE = join(WURZEL, 'docs', 'api');
const ZIEL_DIR = join(WURZEL, 'frontend', 'public', 'docs', 'api');

// Die Dateiaufteilung ist reine Quell-Organisation; die thematische
// Gliederung kommt aus den tags der einzelnen Operationen (ein Thema pro
// Tag, Swagger UI sortiert alphabetisch).
const DATEIEN = [
  { datei: 'verwaltung-auth.yaml' },
  { datei: 'konfis-events.yaml' },
  { datei: 'chat-challenges.yaml' },
  { datei: 'teamer-material.yaml' },
  { datei: 'stammdaten.yaml' },
];

async function ladeYamlParser() {
  for (const pfad of ['js-yaml', join(WURZEL, 'frontend/node_modules/js-yaml/index.js')]) {
    try {
      const mod = await import(pfad);
      return (mod.default ?? mod).load;
    } catch { /* naechsten Pfad versuchen */ }
  }
  throw new Error('js-yaml nicht gefunden. Installieren mit:  npm --prefix frontend install js-yaml');
}


function e(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function main() {
  const ladeYaml = await ladeYamlParser();

  const vorhanden = new Set(readdirSync(QUELLE).filter((f) => f.endsWith('.yaml')));
  for (const { datei } of DATEIEN) {
    if (!vorhanden.has(datei)) throw new Error(`Erwartete Datei fehlt: docs/api/${datei}`);
  }
  const unbekannt = [...vorhanden].filter((f) => !DATEIEN.some((d) => d.datei === f));
  if (unbekannt.length) {
    console.warn(`Hinweis: nicht gelistet und daher NICHT in openapi.json: ${unbekannt.join(', ')}`);
  }

  const zusammen = {
    openapi: '3.1.0',
    info: {
      title: 'Konfi Quest API',
      version: '1.0.0',
      description:
        'Vollstaendige Schnittstellenbeschreibung. Die Berechtigungen stehen je '
        + 'Operation in der Erweiterung x-berechtigung: welche Rollen zugreifen '
        + 'duerfen, welche Middleware greift, ob nach Organisation gefiltert wird '
        + 'und welche zusaetzlichen Objektpruefungen es gibt.',
    },
    servers: [{ url: 'https://konfi-quest.de' }],
    security: [{ bearerAuth: [] }],
    tags: [],
    paths: {},
    components: {},
  };

  const tagNamen = new Set();
  const kollisionen = [];
  const ohneTag = [];

  for (const { datei } of DATEIEN) {
    const spec = ladeYaml(readFileSync(join(QUELLE, datei), 'utf8'));

    for (const t of spec.tags ?? []) {
      if (!tagNamen.has(t.name)) {
        tagNamen.add(t.name);
        zusammen.tags.push(t);
      }
    }

    // Jede Operation MUSS ein Tag tragen — sonst landet sie in Swagger UI
    // im Sammelblock "default" und die thematische Gliederung bekommt
    // still ein Loch. Deshalb harter Fehler statt Datei-Fallback.
    for (const [pfad, ops] of Object.entries(spec.paths ?? {})) {
      for (const [methode, op] of Object.entries(ops)) {
        if (!['get', 'post', 'put', 'patch', 'delete'].includes(methode)) continue;
        if (!op.tags || op.tags.length === 0) {
          ohneTag.push(`${methode.toUpperCase()} ${pfad} (${datei})`);
        }
      }
    }

    for (const [pfad, ops] of Object.entries(spec.paths ?? {})) {
      if (zusammen.paths[pfad]) {
        // Gleicher Pfad in zwei Dateien: Operationen zusammenlegen, aber
        // dieselbe Methode doppelt wäre ein echter Widerspruch.
        for (const [methode, op] of Object.entries(ops)) {
          if (zusammen.paths[pfad][methode]) {
            kollisionen.push(`${methode.toUpperCase()} ${pfad}`);
          }
          zusammen.paths[pfad][methode] = op;
        }
      } else {
        zusammen.paths[pfad] = ops;
      }
    }

    // Gleichnamige Komponenten aus mehreren Dateien: die letzte gewinnt.
    // Bei abweichendem Inhalt (mehr als nur Beschreibungstext waere riskant)
    // wenigstens sichtbar warnen statt still zu ueberschreiben.
    for (const [komponentenArt, inhalt] of Object.entries(spec.components ?? {})) {
      const ziel = zusammen.components[komponentenArt] ?? {};
      for (const [name, def] of Object.entries(inhalt)) {
        if (ziel[name] && JSON.stringify(ziel[name]) !== JSON.stringify(def)) {
          console.warn(`Hinweis: components.${komponentenArt}.${name} weicht zwischen den Dateien ab — ${datei} ueberschreibt.`);
        }
        ziel[name] = def;
      }
      zusammen.components[komponentenArt] = ziel;
    }
  }

  if (ohneTag.length) {
    throw new Error(
      'Operationen ohne tags (bitte thematisches Tag vergeben):\n  ' + ohneTag.join('\n  ')
    );
  }

  if (kollisionen.length) {
    throw new Error(
      'Dieselbe Operation ist in mehreren Dateien dokumentiert:\n  '
      + kollisionen.join('\n  ')
      + '\nBitte in genau einer Datei belassen.'
    );
  }

  const anzahl = Object.values(zusammen.paths).reduce(
    (n, p) => n + Object.keys(p).filter((k) =>
      ['get', 'post', 'put', 'patch', 'delete'].includes(k)).length,
    0
  );

  // Bewusst OHNE Datum: Es kam aus dem letzten Commit der Quellen und konnte
  // damit nie den Commit kennen, der es gerade erzeugt — der Frischecheck der
  // CI wurde nach jeder Doku-Änderung einmal grundlos rot (24.08.2026).
  // Wie alt die Doku ist, sagt die git-Historie genauer.
  zusammen.info.description += `\n\n${anzahl} Operationen.`;

  mkdirSync(ZIEL_DIR, { recursive: true });
  writeFileSync(join(ZIEL_DIR, 'openapi.json'), JSON.stringify(zusammen, null, 2), 'utf8');

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Konfi Quest API</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="stylesheet" href="./swagger/swagger-ui.css">
<style>
  body { margin: 0; background: #fafafa; }
  .kopf {
    padding: 18px 22px;
    background: #1c1a1f;
    color: #fff;
    font-family: system-ui, -apple-system, sans-serif;
    display: flex;
    align-items: baseline;
    gap: 16px;
    flex-wrap: wrap;
  }
  .kopf b { font-size: 1.05rem; letter-spacing: .02em; }
  .kopf span { font-size: .82rem; color: #a49cab; }
  .kopf a { color: #c4a8f5; font-size: .82rem; text-decoration: none; }
  .kopf a:hover { text-decoration: underline; }
  .swagger-ui .topbar { display: none; }
</style>
</head>
<body>
<div class="kopf">
  <b>Konfi Quest API</b>
  <span>${anzahl} Operationen</span>
  <a href="./index.html">Kompakte Uebersicht</a>
  <a href="/docs/">Handbuch</a>
  <a href="./openapi.json">openapi.json</a>
</div>
<div id="swagger"></div>
<script src="./swagger/swagger-ui-bundle.js"></script>
<script src="./swagger/swagger-ui-standalone-preset.js"></script>
<script>
  window.ui = SwaggerUIBundle({
    url: './openapi.json',
    dom_id: '#swagger',
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: 'BaseLayout',
    docExpansion: 'none',
    defaultModelsExpandDepth: 0,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
    // Ausprobieren gegen die Produktion wäre aus der Doku heraus zu
    // gefaehrlich — es sind echte Daten. Die Beschreibung bleibt lesbar.
    supportedSubmitMethods: [],
  });
</script>
</body>
</html>
`;

  writeFileSync(join(ZIEL_DIR, 'swagger.html'), html, 'utf8');
  console.log(`OpenAPI geschrieben: ${anzahl} Operationen aus ${DATEIEN.length} Dateien`);
}

main();
