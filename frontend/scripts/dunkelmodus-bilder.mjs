#!/usr/bin/env node
/**
 * Dunkelmodus SEHEN und vergleichen -- Bilder ausgewaehlter Seiten mit festen
 * Merkmalen, wiederholbar gegen eine lokale Vorschau (Dunkelmodus-Audit BF-12).
 *
 * WARUM NEBEN dunkelmodus-messen.mjs: Das Messskript rechnet Kontraste und
 * sucht helle Flaechen ueber 188 Zustaende -- es sagt, OB etwas unter der
 * Grenze liegt, aber niemand SIEHT den Dunkelmodus, ausser am Geraet. Dieses
 * Skript macht die Bilder und vergleicht sie mit einem frueheren Lauf:
 *
 *   1. Vor einer Farbaenderung:   --out /tmp/dunkel-vorher
 *   2. Nach der Aenderung:        --out /tmp/dunkel-nachher --vergleich /tmp/dunkel-vorher
 *
 * Der zweite Lauf nennt je Bild den Anteil geaenderter Bildpunkte und endet
 * mit Exit 1, wenn ein Bild ueber der Schwelle liegt. Dann die genannten
 * Bilder ANSEHEN -- eine gewollte Aenderung ist kein Fehler, eine
 * ungewollte schon. Die Bilder liegen ausserhalb des Repos (keine Baselines
 * im Repo: je Lauf 28 Bilder a 260-640 kB, zusammen 12 MB, und sie tragen die
 * Schriften und Uhrzeiten der jeweiligen Maschine). Gemessen 29.09.2026:
 * zwei Laeufe desselben Stands 28 von 28 Bildern 0,00 % verschieden; ein Stand
 * mit heller Karte im Dunkeln fiel mit 48 Merkmalen, Exit 1.
 *
 * Feste Merkmale je Seite und Plattform (Exit 1, wenn eines faellt):
 *   - Ionic-Modus passt zur Kennung (iPhone -> ios, Android -> md);
 *   - die Seite laeuft wirklich dunkel (prefers-color-scheme: dark);
 *   - der Seitengrund ist dunkel (relative Helligkeit unter 0,05);
 *   - eine ion-card.app-card traegt das Token --app-surface-card
 *     (die Kartenregel greift gegen das Theme, Audit BF-03/04);
 *   - keine deckende helle Flaeche ab 40 x 24 px (Luminanz ueber 0,5).
 *
 * Voraussetzungen wie bei dunkelmodus-messen.mjs: Backend mit dem Test-Seed
 * (backend/tests/helpers/seed.js; Konten konfi1, teamer1, admin1), Vite oder
 * `vite preview` unter --url mit VITE_API_URL auf dieses Backend, Playwright
 * mit Chromium. Der Weg steht in docs/wissen/dunkelmodus-pruefen.md.
 *
 * Aufruf (aus frontend/):
 *   npm run dunkelmodus:bilder -- --url http://localhost:5173 --out /tmp/dunkel-vorher
 *   npm run dunkelmodus:bilder -- --url http://localhost:5173 --out /tmp/dunkel-nachher --vergleich /tmp/dunkel-vorher
 *
 * Optionen: --url, --passwort, --out <ordner>, --vergleich <ordner>,
 *   --schwelle <Anteil, Standard 0.01>, --platforms ios,android,
 *   --only konfi|teamer|admin|public|all, --hell (zusaetzlich helle Bilder,
 *   ohne die Dunkel-Merkmale).
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);

function ladePlaywright() {
  try { return require('playwright'); } catch { /* nicht im Repo installiert */ }
  try { return require(join(execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 'playwright')); } catch { /* auch nicht global */ }
  console.error('Playwright nicht gefunden: `npm install` im Repo-Root oder `npm install -g playwright`.');
  process.exit(2);
}
const { chromium } = ladePlaywright();

const args = process.argv.slice(2);
const argWert = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
const BASE = argWert('url', 'http://localhost:5173').replace(/\/$/, '');
const PASSWORT = argWert('passwort', 'testpasswort123');
const OUT = resolve(argWert('out', join(tmpdir(), 'dunkelmodus-bilder')));
const VERGLEICH = argWert('vergleich', null) ? resolve(argWert('vergleich', '')) : null;
const SCHWELLE = Number(argWert('schwelle', '0.01'));
const PLATFORMS = argWert('platforms', 'ios,android').split(',');
const ONLY = argWert('only', 'all');
const AUCH_HELL = args.includes('--hell');
const UA = {
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Ausgewaehlte Seiten: je Rolle die Startseite, eine Liste, eine Detailseite,
   das Profil -- dort, wo der Dunkelmodus schon einmal zurueckfiel. */
const SEITEN = {
  public: { user: null, seiten: [['login', '/login']] },
  konfi: { user: 'konfi1', seiten: [['start', '/konfi/dashboard'], ['chat-raum', '/konfi/chat/room/1'], ['mitmachen', '/konfi/events'], ['badges', '/konfi/badges'], ['profil', '/konfi/profile']] },
  teamer: { user: 'teamer1', seiten: [['start', '/teamer/dashboard'], ['mitmachen', '/teamer/events'], ['profil', '/teamer/profile']] },
  admin: { user: 'admin1', seiten: [['konfis', '/admin/konfis'], ['konfi-detail', '/admin/konfis/1'], ['events', '/admin/events'], ['aktivitaeten', '/admin/events?segment=antraege'], ['mehr', '/admin/settings']] },
};

/* --- Im Browser: feste Merkmale --- */
const MERKMALE = () => {
  const parse = (s) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s || ''); return m ? { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] } : null; };
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const hex = ([r, g, b]) => '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
  const html = document.documentElement;
  const modus = html.classList.contains('md') ? 'md' : (html.classList.contains('ios') ? 'ios' : '?');
  // Seitengrund: die sichtbare ion-content malt ihn im Schatten-DOM.
  const inhalte = [...document.querySelectorAll('ion-content')].filter((c) => c.offsetParent !== null);
  const inhalt = inhalte[inhalte.length - 1];
  const grundEl = inhalt?.shadowRoot?.querySelector('#background-content');
  let grund = grundEl ? parse(getComputedStyle(grundEl).backgroundColor) : null;
  if (!grund || grund.a < 0.99) grund = parse(getComputedStyle(document.body).backgroundColor);
  const karte = document.querySelector('ion-card.app-card');
  const token = getComputedStyle(html).getPropertyValue('--app-surface-card').trim().toLowerCase();
  const tokenHex = token.length === 4 ? '#' + [...token.slice(1)].map((c) => c + c).join('') : token;
  const karteBg = karte ? parse(getComputedStyle(karte).backgroundColor) : null;
  // Helle deckende Flaechen, auch im Schatten-DOM
  const alle = []; const sammle = (root) => { for (const el of root.querySelectorAll('*')) { alle.push(el); if (el.shadowRoot) sammle(el.shadowRoot); } }; sammle(document);
  const hell = [];
  for (const el of alle) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 24 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity <= 0.05) continue;
    const bg = parse(cs.backgroundColor);
    if (bg && bg.a >= 0.9 && lum(bg.rgb) > 0.5) hell.push(`${el.tagName.toLowerCase()}${el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : ''} ${hex(bg.rgb)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return {
    modus,
    dunkel: matchMedia('(prefers-color-scheme: dark)').matches,
    grund: grund ? { hex: hex(grund.rgb), lum: +lum(grund.rgb).toFixed(4) } : null,
    karte: karte && karteBg ? { hex: hex(karteBg.rgb), token: tokenHex } : null,
    hell: [...new Set(hell)].slice(0, 5),
    hellAnzahl: new Set(hell).size,
  };
};

/* --- Bildvergleich im Browser (Canvas), ohne weitere Abhaengigkeit --- */
async function vergleiche(page, a, b) {
  const url = (p) => 'data:image/png;base64,' + readFileSync(p).toString('base64');
  return page.evaluate(async ([ua, ub]) => {
    const lade = (src) => new Promise((ok, fehler) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fehler; i.src = src; });
    const [ia, ib] = await Promise.all([lade(ua), lade(ub)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { anteil: 1, grund: `Groesse ${ia.width}x${ia.height} gegen ${ib.width}x${ib.height}` };
    const pixel = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const pa = pixel(ia); const pb = pixel(ib);
    let anders = 0;
    for (let i = 0; i < pa.length; i += 4) {
      if (Math.abs(pa[i] - pb[i]) > 24 || Math.abs(pa[i + 1] - pb[i + 1]) > 24 || Math.abs(pa[i + 2] - pb[i + 2]) > 24) anders++;
    }
    return { anteil: anders / (pa.length / 4) };
  }, [url(a), url(b)]);
}

async function login(page, ctx, user) {
  await ctx.clearCookies();
  await page.goto(`${BASE}/login`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const u = page.locator('input[placeholder="Dein Nutzername"]');
  await u.waitFor({ state: 'visible', timeout: 15000 });
  await u.fill(user);
  await page.locator('input[placeholder="Dein Passwort"]').fill(PASSWORT);
  await page.locator('ion-button.app-auth-button').click();
  await page.waitForURL(/\/(?:konfi|admin|teamer)\//, { timeout: 30000 });
  // Einfuehrung und Aenderungsanzeige als gesehen markieren, sonst liegen sie ueber der Seite.
  await page.evaluate(() => {
    const roh = localStorage.getItem('CapacitorStorage.konfi_user'); let id = 'x';
    try { id = roh ? JSON.parse(roh).id ?? 'x' : 'x'; } catch { /* ohne Nutzer bleibt 'x' */ }
    for (const r of ['admin_onboarding_seen', 'konfi_onboarding_seen', 'teamer_onboarding_seen']) localStorage.setItem(`CapacitorStorage.${r}_${id}`, '1');
    localStorage.setItem(`CapacitorStorage.neuerungen_zuletzt_gesehen_${id}`, '9.9');
  });
}

const ergebnisse = [];
const fehler = [];
const pruefe = (bild, ok, text) => { if (!ok) fehler.push(`${bild}: ${text}`); };

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const schemata = AUCH_HELL ? ['dark', 'light'] : ['dark'];
  for (const scheme of schemata) for (const platform of PLATFORMS) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, userAgent: UA[platform], locale: 'de-DE', reducedMotion: 'reduce' });
    // Zufall festlegen: Die Startseiten waehlen per Math.random zwischen
    // Losung und Lehrtext (u. a.). Ohne feste Folge unterschieden sich zwei
    // Laeufe desselben Stands um 10-17 % der Bildpunkte (gemessen 29.09.2026).
    await ctx.addInitScript(() => {
      let s = 42;
      Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    });
    const page = await ctx.newPage();
    for (const [rolle, cfg] of Object.entries(SEITEN)) {
      if (ONLY !== 'all' && ONLY !== rolle) continue;
      if (cfg.user) await login(page, ctx, cfg.user);
      for (const [name, pfad] of cfg.seiten) {
        await page.goto(`${BASE}${pfad}`);
        try { await page.waitForSelector('ion-content', { state: 'visible', timeout: 15000 }); } catch { /* Seite ohne ion-content wird trotzdem aufgenommen */ }
        await sleep(1800);
        const bild = `${scheme === 'dark' ? 'dunkel' : 'hell'}-${platform}-${rolle}-${name}.png`;
        await page.screenshot({ path: join(OUT, bild), animations: 'disabled', caret: 'hide' });
        const m = await page.evaluate(MERKMALE);
        const zeile = { bild, pfad, ...m };
        pruefe(bild, m.modus === (platform === 'ios' ? 'ios' : 'md'), `Ionic-Modus ${m.modus} statt ${platform === 'ios' ? 'ios' : 'md'}`);
        if (scheme === 'dark') {
          pruefe(bild, m.dunkel, 'prefers-color-scheme: dark greift nicht');
          pruefe(bild, m.grund && m.grund.lum < 0.05, `Seitengrund ${m.grund?.hex} nicht dunkel (Helligkeit ${m.grund?.lum})`);
          if (m.karte) pruefe(bild, m.karte.hex === m.karte.token, `Karte ${m.karte.hex} statt Token --app-surface-card ${m.karte.token}`);
          pruefe(bild, m.hellAnzahl === 0, `${m.hellAnzahl} helle Flaeche(n): ${m.hell.join('; ')}`);
        }
        if (VERGLEICH && existsSync(join(VERGLEICH, bild))) {
          const v = await vergleiche(page, join(VERGLEICH, bild), join(OUT, bild));
          zeile.geaendert = v.anteil;
          pruefe(bild, v.anteil <= SCHWELLE, `${(v.anteil * 100).toFixed(2)} % der Bildpunkte geaendert${v.grund ? ` (${v.grund})` : ''} -- Bild ansehen`);
        } else if (VERGLEICH) {
          zeile.geaendert = null;
        }
        ergebnisse.push(zeile);
        const vgl = zeile.geaendert === undefined ? '' : zeile.geaendert === null ? '  (kein Vorher-Bild)' : `  geaendert ${(zeile.geaendert * 100).toFixed(2)} %`;
        console.log(`${bild.padEnd(44)} Modus ${m.modus}  Grund ${m.grund?.hex ?? '?'}  Karte ${m.karte ? m.karte.hex : '-'}  helle Flaechen ${m.hellAnzahl}${vgl}`);
      }
    }
    await ctx.close();
  }
  await browser.close();
  writeFileSync(join(OUT, 'ergebnis.json'), JSON.stringify({ basis: BASE, zeit: new Date().toISOString(), vergleich: VERGLEICH, schwelle: SCHWELLE, ergebnisse, fehler }, null, 2));
  console.log(`\n${ergebnisse.length} Bilder in ${OUT}`);
  if (fehler.length) {
    console.log(`\n${fehler.length} Merkmal(e) gefallen:`);
    for (const f of fehler) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log('Alle festen Merkmale erfuellt.');
}

main().catch((e) => { console.error(e); process.exit(2); });
