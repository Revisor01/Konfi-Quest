#!/usr/bin/env node
/**
 * Erzeugt aus den OpenAPI-Dateien unter docs/api/ eine lesbare HTML-Referenz.
 *
 * Aufruf:  node scripts/build-api-docs.mjs [zielverzeichnis]
 * Standard-Ziel: frontend/public/docs/api/index.html
 *
 * Warum public/: Vite kopiert alles aus public/ unveraendert nach dist/, und
 * dist/ landet im nginx-Container (frontend/Dockerfile). Die Seite ist damit
 * ohne weiteren Schritt Teil des Deployments.
 *
 * Gestaltung folgt der App (CLAUDE.md): Bebas Neue fuer Ueberschriften,
 * Plus Jakarta Sans fuer Text, Bereichsfarben aus theme/variables.css.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const QUELLE = join(WURZEL, 'docs', 'api');
const ZIEL = process.argv[2]
  ? resolve(process.argv[2])
  : join(WURZEL, 'frontend', 'public', 'docs', 'api', 'index.html');

// Reihenfolge und Farbe je Datei. Farben aus theme/variables.css:
// chat #06b6d4, konfis #5b21b6, activities #047857.
const BEREICHE = [
  { datei: 'chat-challenges.yaml', titel: 'Chat & Challenges', farbe: '#06b6d4' },
  { datei: 'konfis-events.yaml', titel: 'Konfis & Termine', farbe: '#5b21b6' },
  { datei: 'verwaltung-auth.yaml', titel: 'Verwaltung & Anmeldung', farbe: '#047857' },
];

const METHODEN = {
  GET: '#0369a1', POST: '#047857', PUT: '#b45309', PATCH: '#b45309', DELETE: '#b91c1c',
};

const ROLLEN_LABEL = {
  super_admin: 'Super-Admin', org_admin: 'Leitung', admin: 'Admin',
  teamer: 'Teamer:in', konfi: 'Konfi',
  'alle authentifizierten': 'alle Angemeldeten', oeffentlich: 'öffentlich',
};

const ROLLEN_KLASSE = {
  super_admin: 'r-super', org_admin: 'r-leitung', admin: 'r-admin',
  teamer: 'r-teamer', konfi: 'r-konfi',
  'alle authentifizierten': 'r-alle', oeffentlich: 'r-offen',
};

function e(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * YAML einlesen. js-yaml liegt transitiv in frontend/node_modules, steht aber
 * in keiner package.json — deshalb wird es dynamisch geladen und ein
 * verstaendlicher Hinweis ausgegeben, falls es fehlt, statt mit einem
 * Modul-Fehler abzubrechen.
 */
async function ladeYamlParser() {
  for (const pfad of ['js-yaml', join(WURZEL, 'frontend/node_modules/js-yaml/index.js')]) {
    try {
      const mod = await import(pfad);
      return (mod.default ?? mod).load;
    } catch { /* naechsten Pfad versuchen */ }
  }
  throw new Error(
    'js-yaml nicht gefunden. Installieren mit:  npm --prefix frontend install js-yaml'
  );
}

function rollenChips(rollen) {
  if (!rollen?.length) return '<span class="chip r-unbekannt">nicht dokumentiert</span>';
  return rollen.map((r) => {
    const key = String(r);
    return `<span class="chip ${ROLLEN_KLASSE[key] ?? 'r-sonst'}">${e(ROLLEN_LABEL[key] ?? key)}</span>`;
  }).join('');
}

function routeHtml(r) {
  const farbe = METHODEN[r.methode] ?? '#57534e';
  const org = r.orgscope ? '<span class="chip org-ja">org-getrennt</span>' : '';
  const mw = r.middleware?.length
    ? `<div class="mw">${r.middleware.map((m) => `<code>${e(m)}</code>`).join(' · ')}</div>`
    : '';
  const objekt = r.objekt
    ? `<div class="objekt"><span class="objekt-label">Objektprüfung</span>${e(r.objekt)}</div>`
    : '';
  let hinweis = '';
  if (r.hinweis) {
    const behoben = r.hinweis.includes('BEHOBEN');
    hinweis = `<div class="hinweis${behoben ? ' behoben' : ''}">${e(r.hinweis)}</div>`;
  }
  return `<article class="route">
        <div class="route-kopf"><span class="verb" style="--verb:${farbe}">${e(r.methode)}</span><code class="pfad">${e(r.pfad)}</code></div>
        <p class="summary">${r.summary ? e(r.summary) : '<span class="leer">ohne Beschreibung</span>'}</p>
        <div class="zugriff">${rollenChips(r.rollen)}${org}</div>${mw}${objekt}${hinweis}
      </article>`;
}

async function main() {
  const ladeYaml = await ladeYamlParser();

  const vorhanden = new Set(readdirSync(QUELLE).filter((f) => f.endsWith('.yaml')));
  for (const b of BEREICHE) {
    if (!vorhanden.has(b.datei)) {
      throw new Error(`Erwartete Datei fehlt: docs/api/${b.datei}`);
    }
  }
  // Nicht gelistete Dateien sollen auffallen, statt still zu fehlen.
  const unbekannt = [...vorhanden].filter((f) => !BEREICHE.some((b) => b.datei === f));
  if (unbekannt.length) {
    console.warn(`Hinweis: nicht in BEREICHE gelistet und daher NICHT in der Seite: ${unbekannt.join(', ')}`);
  }

  const bereiche = BEREICHE.map(({ datei, titel, farbe }) => {
    const spec = ladeYaml(readFileSync(join(QUELLE, datei), 'utf8'));
    const routen = [];
    for (const [pfad, methoden] of Object.entries(spec.paths ?? {})) {
      for (const [methode, op] of Object.entries(methoden ?? {})) {
        if (!METHODEN[methode.toUpperCase()]) continue;
        const b = op['x-berechtigung'] ?? {};
        routen.push({
          methode: methode.toUpperCase(),
          pfad,
          summary: (op.summary ?? '').trim(),
          rollen: b.rollen ?? [],
          middleware: b.middleware ?? [],
          orgscope: b['org-scope'],
          objekt: (b['objekt-pruefung'] ?? '').trim(),
          hinweis: (b.hinweis ?? '').trim(),
        });
      }
    }
    return { id: datei.replace(/\.yaml$/, ''), titel, farbe, routen };
  });

  const gesamt = bereiche.reduce((n, b) => n + b.routen.length, 0);
  const stand = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const nav = bereiche.map((b) =>
    `<li class="nav-gruppe"><a href="#${b.id}"><span class="nav-punkt" style="background:${b.farbe}"></span>${e(b.titel)}<span class="nav-zahl">${b.routen.length}</span></a></li>`
  ).join('');

  const abschnitte = bereiche.map((b) => `<section id="${b.id}" class="service" style="--service:${b.farbe}">
      <header class="service-kopf"><h2>${e(b.titel)}</h2><p class="service-meta">${b.routen.length} Operationen</p></header>
      <div class="routen">${b.routen.map(routeHtml).join('')}</div>
    </section>`).join('');

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Konfi Quest API-Referenz</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Bebas+Neue&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
:root { --ground:#fbfaf9; --flaeche:#fff; --rand:#e7e3e8; --text:#1c1a1f; --text-leise:#6b6470; --akzent:#5b21b6; --akzent-weich:#f3eefc; --code-grund:#f5f2f7; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --ground:#161419; --flaeche:#1e1b22; --rand:#322c38; --text:#ece9ef; --text-leise:#a49cab; --akzent:#c4a8f5; --akzent-weich:#2a1f3d; --code-grund:#241f2a; } }
:root[data-theme="dark"] { --ground:#161419; --flaeche:#1e1b22; --rand:#322c38; --text:#ece9ef; --text-leise:#a49cab; --akzent:#c4a8f5; --akzent-weich:#2a1f3d; --code-grund:#241f2a; }
* { box-sizing:border-box; }
body { margin:0; background:var(--ground); color:var(--text); font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif; font-size:15px; line-height:1.6; -webkit-font-smoothing:antialiased; }
.huelle { display:grid; grid-template-columns:264px minmax(0,1fr); max-width:1280px; margin:0 auto; }
.seitenleiste { position:sticky; top:0; align-self:start; height:100vh; overflow-y:auto; padding:32px 24px 40px; border-right:1px solid var(--rand); }
.marke { font-family:'Bebas Neue',Impact,sans-serif; font-size:1.5rem; letter-spacing:3px; margin:0 0 2px; }
.marke-unter { font-size:.78rem; color:var(--text-leise); margin:0 0 28px; }
.nav-titel { font-size:.68rem; text-transform:uppercase; letter-spacing:.09em; color:var(--text-leise); margin:0 0 10px; font-weight:600; }
.seitenleiste ul { list-style:none; margin:0 0 26px; padding:0; display:flex; flex-direction:column; gap:2px; }
.nav-gruppe a { display:flex; align-items:center; gap:9px; padding:7px 9px; border-radius:7px; text-decoration:none; color:var(--text); font-size:.87rem; }
.nav-gruppe a:hover { background:var(--akzent-weich); }
.nav-gruppe a:focus-visible { outline:2px solid var(--akzent); outline-offset:1px; }
.nav-punkt { width:8px; height:8px; border-radius:50%; flex:none; }
.nav-zahl { margin-left:auto; font-size:.74rem; color:var(--text-leise); font-variant-numeric:tabular-nums; }
.legende { border-top:1px solid var(--rand); padding-top:18px; }
.legende dl { margin:0; display:flex; flex-direction:column; gap:7px; }
.legende div { display:flex; align-items:baseline; gap:8px; }
.legende dt { font-family:'JetBrains Mono',monospace; font-size:.68rem; font-weight:500; }
.legende dd { margin:0; font-size:.75rem; color:var(--text-leise); }
.inhalt { padding:40px 44px 96px; min-width:0; }
.kopf { margin-bottom:44px; padding-bottom:28px; border-bottom:1px solid var(--rand); }
.kopf h1 { font-family:'Bebas Neue',Impact,sans-serif; font-weight:400; font-size:3.1rem; line-height:1; letter-spacing:4px; margin:0 0 14px; text-wrap:balance; }
.kopf p { margin:0; color:var(--text-leise); max-width:62ch; }
.kennzahlen { display:flex; gap:28px; margin-top:22px; flex-wrap:wrap; }
.kennzahl b { display:block; font-family:'Bebas Neue',Impact,sans-serif; font-size:2rem; letter-spacing:1px; font-variant-numeric:tabular-nums; line-height:1; }
.kennzahl span { font-size:.72rem; text-transform:uppercase; letter-spacing:.07em; color:var(--text-leise); }
.service { margin-bottom:56px; scroll-margin-top:20px; }
.service-kopf { display:flex; align-items:baseline; gap:12px; margin-bottom:18px; padding-left:13px; border-left:3px solid var(--service); }
.service-kopf h2 { font-family:'Bebas Neue',Impact,sans-serif; font-weight:400; font-size:1.75rem; margin:0; letter-spacing:2.5px; }
.service-meta { margin:0; font-size:.78rem; color:var(--text-leise); font-variant-numeric:tabular-nums; }
.routen { display:flex; flex-direction:column; gap:10px; }
.route { background:var(--flaeche); border:1px solid var(--rand); border-radius:10px; padding:15px 17px; }
.route-kopf { display:flex; align-items:center; gap:11px; flex-wrap:wrap; }
.verb { font-family:'JetBrains Mono',monospace; font-size:.67rem; font-weight:500; letter-spacing:.05em; color:var(--verb); border:1px solid var(--verb); border-radius:4px; padding:2px 6px; flex:none; }
.pfad { font-family:'JetBrains Mono',monospace; font-size:.85rem; word-break:break-all; }
.summary { margin:9px 0 0; color:var(--text-leise); font-size:.88rem; }
.leer { font-style:italic; opacity:.7; }
.zugriff { display:flex; gap:5px; flex-wrap:wrap; margin-top:11px; }
.chip { font-size:.7rem; padding:2px 8px; border-radius:20px; border:1px solid var(--rand); white-space:nowrap; }
.r-super { border-color:#b45309; color:#b45309; }
.r-leitung { border-color:#5b21b6; color:#5b21b6; }
.r-admin { border-color:#0369a1; color:#0369a1; }
.r-teamer { border-color:#be185d; color:#be185d; }
.r-konfi { border-color:#047857; color:#047857; }
.r-alle, .r-sonst { color:var(--text-leise); }
.r-offen { border-color:#b91c1c; color:#b91c1c; }
.r-unbekannt { border-style:dashed; color:var(--text-leise); }
.org-ja { background:var(--akzent-weich); border-color:transparent; color:var(--akzent); }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .r-leitung{border-color:#c4a8f5;color:#c4a8f5}:root:not([data-theme="light"]) .r-admin{border-color:#7dd3fc;color:#7dd3fc}:root:not([data-theme="light"]) .r-teamer{border-color:#f9a8d4;color:#f9a8d4}:root:not([data-theme="light"]) .r-konfi{border-color:#6ee7b7;color:#6ee7b7}:root:not([data-theme="light"]) .r-super{border-color:#fcd34d;color:#fcd34d}:root:not([data-theme="light"]) .r-offen{border-color:#fca5a5;color:#fca5a5} }
:root[data-theme="dark"] .r-leitung{border-color:#c4a8f5;color:#c4a8f5}:root[data-theme="dark"] .r-admin{border-color:#7dd3fc;color:#7dd3fc}:root[data-theme="dark"] .r-teamer{border-color:#f9a8d4;color:#f9a8d4}:root[data-theme="dark"] .r-konfi{border-color:#6ee7b7;color:#6ee7b7}:root[data-theme="dark"] .r-super{border-color:#fcd34d;color:#fcd34d}:root[data-theme="dark"] .r-offen{border-color:#fca5a5;color:#fca5a5}
.mw { margin-top:9px; font-size:.74rem; color:var(--text-leise); }
.mw code { font-family:'JetBrains Mono',monospace; background:var(--code-grund); padding:1px 5px; border-radius:3px; font-size:.94em; }
.objekt { margin-top:9px; font-size:.79rem; color:var(--text-leise); }
.objekt-label { display:block; font-size:.66rem; text-transform:uppercase; letter-spacing:.07em; margin-bottom:1px; }
.hinweis { margin-top:11px; padding:9px 12px; border-radius:7px; background:var(--code-grund); border-left:2px solid var(--text-leise); font-size:.79rem; color:var(--text-leise); white-space:pre-wrap; }
.hinweis.behoben { border-left-color:#047857; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .hinweis.behoben { border-left-color:#6ee7b7; } }
:root[data-theme="dark"] .hinweis.behoben { border-left-color:#6ee7b7; }
@media (max-width:900px) { .huelle{grid-template-columns:1fr} .seitenleiste{position:static;height:auto;border-right:0;border-bottom:1px solid var(--rand)} .inhalt{padding:28px 20px 72px} .kopf h1{font-size:2.3rem;letter-spacing:3px} }
</style>
</head>
<body>
<div class="huelle">
  <nav class="seitenleiste">
    <p class="marke">Konfi Quest</p>
    <p class="marke-unter">API-Referenz · Stand ${stand}</p>
    <p class="nav-titel">Bereiche</p>
    <ul>${nav}</ul>
    <div class="legende">
      <p class="nav-titel">Methoden</p>
      <dl>
        <div><dt style="color:#0369a1">GET</dt><dd>Daten lesen</dd></div>
        <div><dt style="color:#047857">POST</dt><dd>Anlegen oder auslösen</dd></div>
        <div><dt style="color:#b45309">PUT</dt><dd>Ändern</dd></div>
        <div><dt style="color:#b91c1c">DELETE</dt><dd>Löschen</dd></div>
      </dl>
    </div>
  </nav>
  <main class="inhalt">
    <header class="kopf">
      <h1>API-Referenz</h1>
      <p>Alle dokumentierten Endpunkte von Konfi Quest mit den Rollen, die sie
      aufrufen dürfen. Wo Hinweise stehen, sind grün markierte Punkte behobene
      Befunde aus dem Berechtigungs-Audit, graue noch offene.</p>
      <div class="kennzahlen">
        <div class="kennzahl"><b>${gesamt}</b><span>Operationen</span></div>
        <div class="kennzahl"><b>${bereiche.length}</b><span>Bereiche</span></div>
        <div class="kennzahl"><b>5</b><span>Rollen</span></div>
      </div>
    </header>
    ${abschnitte}
  </main>
</div>
</body>
</html>
`;

  mkdirSync(dirname(ZIEL), { recursive: true });
  writeFileSync(ZIEL, html, 'utf8');
  console.log(`API-Referenz geschrieben: ${ZIEL} (${gesamt} Operationen)`);
}

main().catch((err) => {
  console.error('Fehler beim Erzeugen der API-Referenz:', err.message);
  process.exit(1);
});
