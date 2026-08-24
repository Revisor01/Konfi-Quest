#!/usr/bin/env node
/**
 * Erzeugt aus den Markdown-Dateien unter docs/handbuch/ das Anwenderhandbuch
 * unter frontend/public/docs/index.html.
 *
 * Aufruf:  node scripts/build-handbuch.mjs [zielverzeichnis]
 *
 * Warum public/: Vite kopiert alles aus public/ unverändert nach dist/, und
 * dist/ landet im nginx-Container. Die Seite ist damit ohne weiteren Schritt
 * Teil des Deployments — dasselbe Vorgehen wie bei der API-Referenz
 * (build-api-docs.mjs), inklusive des Grundes: Der Docker-Kontext ist
 * ./frontend, docs/ und scripts/ liegen darueber und sind im Build nicht
 * erreichbar. Deshalb wird das Ergebnis eingecheckt.
 *
 * Gestaltung folgt der App (CLAUDE.md): Bebas Neue für Ueberschriften,
 * Plus Jakarta Sans für Text, Bereichsfarben aus theme/variables.css.
 *
 * Kein Markdown-Paket: Die Quellen sind bewusst einfach gehalten (Überschrift,
 * Absatz, Liste, Tabelle, Zitat, Betonung, Code). Ein eigener kleiner Renderer
 * spart eine Abhaengigkeit, die sonst nur hier gebraucht wuerde.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const QUELLE = join(WURZEL, 'docs', 'handbuch');
// Ein Verzeichnis, nicht eine Datei: Seit dem 24.08.2026 bekommt jedes Kapitel
// eine eigene Seite. Zwoelf Kapitel in einem Dokument waren für Lesende zu
// viel — man fand nicht wieder, wo man war, und konnte sich auf nichts
// beziehen. Jetzt: nummerierte Kapitel, eine Seite pro Kapitel, unten
// vor/zurück, davor eine Übersicht (index.html).
const ZIEL_VERZ = process.argv[2]
  ? resolve(process.argv[2])
  : join(WURZEL, 'frontend', 'public', 'docs');


function e(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Inline-Auszeichnung: Code wird zuerst herausgeloest, damit darin nichts
 * weiter ersetzt wird. Der Platzhalter klammert mit einem Steuerzeichen —
 * eine blosse Ziffer wuerde echte Zahlen im Text zerstoeren ("zwischen 5
 * und 10 Punkte" hätte dort einen Code-Platzhalter gesehen).
 */
const PLATZ = String.fromCharCode(0);

function inline(text) {
  const codes = [];
  let s = String(text).replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return PLATZ + (codes.length - 1) + PLATZ;
  });
  s = e(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  s = s.replace(new RegExp(PLATZ + String.raw`(\d+)` + PLATZ, "g"),
    (_, i) => `<code>${e(codes[Number(i)])}</code>`);
  return s;
}

/** Sehr kleiner Markdown-Renderer für die hier genutzten Konstrukte. */
function markdown(quelle) {
  const zeilen = quelle.split('\n');
  const teile = [];
  let i = 0;

  const istTabelle = (n) =>
    zeilen[n]?.startsWith('|') && /^\|[\s:|-]+\|$/.test(zeilen[n + 1] ?? '');

  while (i < zeilen.length) {
    const z = zeilen[i];

    if (!z.trim()) { i++; continue; }

    // Ueberschriften
    const h = z.match(/^(#{2,4})\s+(.*)$/);
    if (h) {
      const stufe = h[1].length;
      teile.push(`<h${stufe}>${inline(h[2])}</h${stufe}>`);
      i++;
      continue;
    }

    // Tabelle
    if (istTabelle(i)) {
      const kopf = zeilen[i].split('|').slice(1, -1).map((c) => c.trim());
      i += 2;
      const reihen = [];
      while (zeilen[i]?.startsWith('|')) {
        reihen.push(zeilen[i].split('|').slice(1, -1).map((c) => c.trim()));
        i++;
      }
      teile.push(
        `<div class="tabelle-huelle"><table><thead><tr>${
          kopf.map((c) => `<th>${inline(c)}</th>`).join('')
        }</tr></thead><tbody>${
          reihen.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')
        }</tbody></table></div>`
      );
      continue;
    }

    // Codeblock (```): für Ablauf-Schemata. Ohne diesen Zweig landeten die
    // Zeilen als Absatz im HTML — mitsamt sichtbarer Backticks.
    if (z.trim().startsWith('```')) {
      i++;
      const zeilenImBlock = [];
      while (i < zeilen.length && !zeilen[i].trim().startsWith('```')) {
        zeilenImBlock.push(zeilen[i]);
        i++;
      }
      i++; // schliessende Zeile ueberspringen
      teile.push(`<pre><code>${e(zeilenImBlock.join('\n'))}</code></pre>`);
      continue;
    }

    // Zitat / Hinweis
    if (z.startsWith('> ')) {
      const text = [];
      while (zeilen[i]?.startsWith('>')) {
        text.push(zeilen[i].replace(/^>\s?/, ''));
        i++;
      }
      teile.push(`<blockquote>${inline(text.join(' ').trim())}</blockquote>`);
      continue;
    }

    // Liste (nur eine Ebene, Fortsetzungszeilen eingerueckt)
    if (/^[-*]\s+/.test(z)) {
      const punkte = [];
      while (i < zeilen.length && (/^[-*]\s+/.test(zeilen[i]) || /^\s{2,}\S/.test(zeilen[i]))) {
        if (/^[-*]\s+/.test(zeilen[i])) {
          punkte.push(zeilen[i].replace(/^[-*]\s+/, ''));
        } else {
          punkte[punkte.length - 1] += ' ' + zeilen[i].trim();
        }
        i++;
      }
      teile.push(`<ul>${punkte.map((p) => `<li>${inline(p)}</li>`).join('')}</ul>`);
      continue;
    }

    // Absatz
    const absatz = [];
    while (i < zeilen.length && zeilen[i].trim() && !/^([-*]\s|>|#{2,4}\s|\||```)/.test(zeilen[i].trim())) {
      absatz.push(zeilen[i].trim());
      i++;
    }
    if (absatz.length) teile.push(`<p>${inline(absatz.join(' '))}</p>`);
  }

  return teile.join('\n      ');
}

/** Frontmatter (titel, untertitel, farbe) vom Rumpf trennen. */
function lesen(datei) {
  const roh = readFileSync(join(QUELLE, datei), 'utf8');
  const m = roh.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`Frontmatter fehlt in docs/handbuch/${datei}`);

  const kopf = {};
  for (const zeile of m[1].split('\n')) {
    const t = zeile.match(/^(\w+):\s*(.*)$/);
    if (t) kopf[t[1]] = t[2].replace(/^"(.*)"$/, '$1').trim();
  }
  for (const pflicht of ['titel', 'untertitel', 'farbe']) {
    if (!kopf[pflicht]) throw new Error(`"${pflicht}" fehlt im Frontmatter von ${datei}`);
  }
  // "gruppe" ist optional; ohne Angabe steht das Kapitel im Hauptteil.
  kopf.gruppe = kopf.gruppe || '';

  return {
    id: datei.replace(/^\d+-/, '').replace(/\.md$/, ''),
    ...kopf,
    rumpf: m[2],
  };
}

const STIL = `:root { --ground:#fbfaf9; --flaeche:#fff; --flaeche-2:#f4f1f6; --rand:#e7e3e8; --text:#1c1a1f; --text-leise:#6b6470; --akzent:#5b21b6; --akzent-weich:#f3eefc; --code-grund:#f5f2f7; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --ground:#161419; --flaeche:#1e1b22; --flaeche-2:#241f2a; --rand:#322c38; --text:#ece9ef; --text-leise:#a49cab; --akzent:#c4a8f5; --akzent-weich:#2a1f3d; --code-grund:#241f2a; } }
:root[data-theme="dark"] { --ground:#161419; --flaeche:#1e1b22; --flaeche-2:#241f2a; --rand:#322c38; --text:#ece9ef; --text-leise:#a49cab; --akzent:#c4a8f5; --akzent-weich:#2a1f3d; --code-grund:#241f2a; }
* { box-sizing:border-box; }
body { margin:0; background:var(--ground); color:var(--text); font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif; font-size:15px; line-height:1.65; -webkit-font-smoothing:antialiased; }
.huelle { display:grid; grid-template-columns:264px minmax(0,1fr); max-width:1180px; margin:0 auto; }
.seitenleiste { position:sticky; top:0; align-self:start; height:100vh; overflow-y:auto; padding:32px 24px 40px; border-right:1px solid var(--rand); }
.marke { font-family:'Bebas Neue',Impact,sans-serif; font-size:1.5rem; letter-spacing:3px; margin:0 0 2px; }
.marke-unter { font-size:.78rem; color:var(--text-leise); margin:0 0 28px; }
.nav-titel { font-size:.68rem; text-transform:uppercase; letter-spacing:.09em; color:var(--text-leise); margin:0 0 10px; font-weight:600; }
.seitenleiste ul { list-style:none; margin:0 0 26px; padding:0; display:flex; flex-direction:column; gap:2px; }
.seitenleiste ul a { display:flex; align-items:center; gap:9px; padding:7px 9px; border-radius:7px; text-decoration:none; color:var(--text); font-size:.87rem; }
.seitenleiste ul a:hover { background:var(--akzent-weich); }
.seitenleiste ul a:focus-visible { outline:2px solid var(--akzent); outline-offset:1px; }
.nav-punkt { width:8px; height:8px; border-radius:50%; flex:none; }
.nav-gruppe { font-size:.66rem; text-transform:uppercase; letter-spacing:.1em; color:var(--text-leise); font-weight:700; margin:18px 0 6px; padding-left:9px; }
.seitenleiste .fuss { border-top:1px solid var(--rand); padding-top:18px; font-size:.75rem; color:var(--text-leise); }
.seitenleiste .fuss a { color:var(--akzent); }
.inhalt { padding:40px 44px 96px; min-width:0; }
.kopf { margin-bottom:40px; padding-bottom:26px; border-bottom:1px solid var(--rand); }
.kopf h1 { font-family:'Bebas Neue',Impact,sans-serif; font-weight:400; font-size:3.1rem; line-height:1; letter-spacing:4px; margin:0 0 14px; text-wrap:balance; }
.kopf p { margin:0; color:var(--text-leise); max-width:64ch; }
.kapitel { margin-bottom:40px; }
.kapitel-kopf { margin-bottom:20px; padding-left:13px; border-left:3px solid var(--kapitel); }
.kapitel-kopf h1 { font-family:'Bebas Neue',Impact,sans-serif; font-weight:400; font-size:2.3rem; margin:0; letter-spacing:2.5px; line-height:1.05; display:flex; align-items:baseline; gap:11px; }
.kapitel-meta { margin:2px 0 0; font-size:.78rem; color:var(--text-leise); }
.kapitel h3 { font-size:1.06rem; margin:30px 0 10px; letter-spacing:-.01em; }
.kapitel h4 { font-size:.95rem; margin:22px 0 8px; color:var(--text-leise); }
.kapitel p { margin:0 0 13px; max-width:66ch; }
.kapitel ul { margin:0 0 15px; padding-left:20px; max-width:66ch; display:flex; flex-direction:column; gap:6px; }
.kapitel li { margin:0; }
blockquote { margin:0 0 15px; padding:13px 17px; background:var(--flaeche); border:1px solid var(--rand); border-left:3px solid var(--kapitel); border-radius:8px; color:var(--text-leise); font-size:.92rem; max-width:66ch; }
code { font-family:'JetBrains Mono',monospace; font-size:.85em; background:var(--code-grund); padding:1px 5px; border-radius:4px; }
pre { background:var(--flaeche); border:1px solid var(--rand); border-radius:10px; padding:14px 16px; overflow-x:auto; margin:0 0 16px; max-width:66ch; }
pre code { background:none; padding:0; font-size:.82rem; line-height:1.6; white-space:pre; }
.tabelle-huelle { overflow-x:auto; border:1px solid var(--rand); border-radius:10px; background:var(--flaeche); margin:0 0 18px; }
table { border-collapse:collapse; width:100%; font-size:.88rem; }
th,td { padding:11px 14px; text-align:left; border-bottom:1px solid var(--rand); vertical-align:top; }
thead th { background:var(--flaeche-2); font-size:.7rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--text-leise); white-space:nowrap; }
tbody tr:last-child td { border-bottom:none; }
@media (max-width:860px) {
  /* Auf dem Handy nahm das Inhaltsverzeichnis untereinander fast den ganzen
     ersten Bildschirm ein — man musste scrollen, bevor Inhalt kam. Die Punkte
     stehen deshalb nebeneinander und umbrechen bei Bedarf. Bewusst kein
     Ausklapp-Element: <details> ohne open-Attribut versteckt den Inhalt auch
     auf dem Desktop, und das per CSS zurueckzuholen ist unzuverlaessig. */
  .huelle { grid-template-columns:1fr; }
  .seitenleiste { position:static; height:auto; border-right:none; border-bottom:1px solid var(--rand); padding:20px 20px 14px; }
  .marke-unter { margin-bottom:14px; }
  .nav-titel { margin-bottom:7px; }
  /* Gruppen-Ueberschriften kosten mobil zu viel Hoehe — die Chips stehen
     ohnehin in derselben Reihenfolge beieinander. */
  .nav-gruppe { display:none; }
  .seitenleiste ul + ul { margin-top:0; }
  .seitenleiste ul { flex-direction:row; flex-wrap:wrap; gap:6px; margin-bottom:14px; }
  .seitenleiste ul a { padding:5px 10px; border:1px solid var(--rand); border-radius:999px; font-size:.82rem; }
  .seitenleiste .fuss { border-top:none; padding-top:0; display:flex; gap:16px; }
  .seitenleiste .fuss p { margin:0; }
  .inhalt { padding:28px 20px 72px; }
  .kopf h1 { font-size:2.4rem; }
}

/* --- Seit 24.08.2026: eine Seite je Kapitel --- */
.marke a { color:inherit; text-decoration:none; }
.marke a:hover { color:var(--akzent); }

/* Nummer in der Navigation: gibt jedem Kapitel eine feste Kennung, auf die
   man sich beziehen kann ("steht in Kapitel 7"). */
.nav-nr { flex:none; width:20px; font-size:.74rem; font-variant-numeric:tabular-nums; color:var(--text-leise); text-align:right; }
.seitenleiste ul a.ist-hier { background:var(--akzent-weich); font-weight:600; }
.seitenleiste ul a.ist-hier .nav-nr { color:var(--akzent); }

.kapitel-zaehler { font-size:.7rem; text-transform:uppercase; letter-spacing:.1em; color:var(--text-leise); font-weight:700; margin:0 0 6px; }
.kapitel-nr { font-size:1.5rem; color:var(--kapitel); }

/* Blättern unten: die eigentliche Neuerung. Wer ein Kapitel gelesen hat,
   soll nicht in die Navigation zurueckmuessen. */
.blaettern { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:44px; padding-top:26px; border-top:1px solid var(--rand); }
.blatt { display:flex; flex-direction:column; gap:3px; padding:14px 16px; border:1px solid var(--rand); border-radius:11px; background:var(--flaeche); text-decoration:none; color:var(--text); }
.blatt:hover { border-color:var(--akzent); background:var(--akzent-weich); }
.blatt:focus-visible { outline:2px solid var(--akzent); outline-offset:2px; }
.blatt--weiter { text-align:right; }
.blatt--leer { border:none; background:none; }
.blatt-hin { font-size:.7rem; text-transform:uppercase; letter-spacing:.09em; color:var(--text-leise); font-weight:700; }
.blatt-titel { font-weight:600; font-size:.95rem; }

/* Uebersichtsseite */
.karten { list-style:none; margin:0; padding:0; display:grid; gap:10px; }
.karte { display:flex; align-items:flex-start; gap:14px; padding:15px 17px; border:1px solid var(--rand); border-left:3px solid var(--kapitel); border-radius:11px; background:var(--flaeche); text-decoration:none; color:var(--text); }
.karte:hover { border-color:var(--akzent); border-left-color:var(--kapitel); background:var(--akzent-weich); }
.karte:focus-visible { outline:2px solid var(--akzent); outline-offset:2px; }
.karte-nr { font-family:'Bebas Neue',Impact,sans-serif; font-size:1.5rem; line-height:1; color:var(--kapitel); min-width:26px; font-variant-numeric:tabular-nums; }
.karte-text { display:flex; flex-direction:column; gap:2px; min-width:0; }
.karte-text strong { font-size:1rem; }
.karte-text span { font-size:.84rem; color:var(--text-leise); }

@media (max-width:860px) {
  .blaettern { grid-template-columns:1fr; }
  .blatt--weiter { text-align:left; }
  .blatt--leer { display:none; }
  .kapitel-kopf h1 { font-size:1.9rem; }
}`;

function main() {
  const dateien = readdirSync(QUELLE).filter((f) => f.endsWith('.md')).sort();
  if (!dateien.length) throw new Error('Keine Markdown-Dateien in docs/handbuch/');

  // Durchnummerieren in Dateireihenfolge. Die Nummer ist das, worauf sich
  // Lesende untereinander beziehen ("steht in Kapitel 7") — sie steht deshalb
  // in der Navigation, in der Überschrift und im Seitentitel.
  const seiten = dateien.map((d, i) => ({ ...lesen(d), nr: i + 1, datei: `${lesen(d).id}.html` }));

  const gruppen = [];
  for (const s of seiten) {
    let g = gruppen.find((x) => x.name === s.gruppe);
    if (!g) { g = { name: s.gruppe, seiten: [] }; gruppen.push(g); }
    g.seiten.push(s);
  }

  /** Navigation, in jeder Seite gleich; die aktuelle Seite ist markiert. */
  const navFuer = (aktuell) => gruppen.map((g) =>
    (g.name ? `<p class="nav-gruppe">${e(g.name)}</p>` : '')
    + `<ul>${g.seiten.map((s) => {
        const hier = aktuell && s.id === aktuell.id;
        return `<li><a href="./${e(s.datei)}"${hier ? ' aria-current="page" class="ist-hier"' : ''}>`
          + `<span class="nav-nr">${s.nr}</span>${e(s.titel)}</a></li>`;
      }).join('')}</ul>`
  ).join('');

  /** Gemeinsame Huelle. `stand` bleibt bewusst leer (siehe Commit vom 24.08.). */
  const huelle = ({ titel, beschreibung, aktuell, inhalt }) => `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${e(titel)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${e(beschreibung)}">
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Bebas+Neue&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
${STIL}
</style>
</head>
<body>
<div class="huelle">
  <nav class="seitenleiste">
    <p class="marke"><a href="./">Konfi Quest</a></p>
    <p class="marke-unter">Handbuch</p>
    <p class="nav-titel">Inhalt</p>
    ${navFuer(aktuell)}
    <div class="fuss">
      <p><a href="/">Zur Startseite</a></p>
    </div>
  </nav>
  <main class="inhalt">
${inhalt}
  </main>
</div>
</body>
</html>
`;

  mkdirSync(ZIEL_VERZ, { recursive: true });

  // --- Kapitelseiten ---
  for (let i = 0; i < seiten.length; i++) {
    const s = seiten[i];
    const vor = seiten[i - 1];
    const zurueck = seiten[i + 1];

    const blaettern = `
    <nav class="blaettern" aria-label="Weitere Kapitel">
      ${vor
        ? `<a class="blatt blatt--vor" href="./${e(vor.datei)}">
             <span class="blatt-hin">Vorheriges Kapitel</span>
             <span class="blatt-titel">${vor.nr}. ${e(vor.titel)}</span>
           </a>`
        : '<span class="blatt blatt--leer"></span>'}
      ${zurueck
        ? `<a class="blatt blatt--weiter" href="./${e(zurueck.datei)}">
             <span class="blatt-hin">Nächstes Kapitel</span>
             <span class="blatt-titel">${zurueck.nr}. ${e(zurueck.titel)}</span>
           </a>`
        : '<span class="blatt blatt--leer"></span>'}
    </nav>`;

    const inhalt = `    <article class="kapitel" style="--kapitel:${e(s.farbe)}">
      <header class="kapitel-kopf">
        <p class="kapitel-zaehler">Kapitel ${s.nr} von ${seiten.length}</p>
        <h1><span class="kapitel-nr">${s.nr}</span>${e(s.titel)}</h1>
        <p class="kapitel-meta">${e(s.untertitel)}</p>
      </header>
      ${markdown(s.rumpf)}
    </article>
${blaettern}`;

    writeFileSync(join(ZIEL_VERZ, s.datei), huelle({
      titel: `${s.nr}. ${s.titel} — Konfi Quest Handbuch`,
      beschreibung: s.untertitel,
      aktuell: s,
      inhalt,
    }), 'utf8');
  }

  // --- Übersicht ---
  const karten = seiten.map((s) => `      <li>
        <a class="karte" href="./${e(s.datei)}" style="--kapitel:${e(s.farbe)}">
          <span class="karte-nr">${s.nr}</span>
          <span class="karte-text">
            <strong>${e(s.titel)}</strong>
            <span>${e(s.untertitel)}</span>
          </span>
        </a>
      </li>`).join('\n');

  const uebersicht = `    <header class="kopf">
      <h1>Handbuch</h1>
      <p>Was ihr mit Konfi Quest tun könnt — nach Rollen sortiert. Jede Rolle
      sieht eine eigene Ansicht, deshalb steht hier für jede ein eigener Teil.
      Die Kapitel sind nummeriert, damit ihr euch darauf beziehen könnt.</p>
    </header>
    <ol class="karten">
${karten}
    </ol>`;

  writeFileSync(join(ZIEL_VERZ, 'index.html'), huelle({
    titel: 'Konfi Quest — Handbuch',
    beschreibung: 'Handbuch für Konfi Quest: was Konfis, Teamer:innen und die Leitung in der App tun können.',
    aktuell: null,
    inhalt: uebersicht,
  }), 'utf8');

  console.log(`Handbuch geschrieben: ${ZIEL_VERZ} (${seiten.length} Kapitel + Übersicht)`);
}

main();
