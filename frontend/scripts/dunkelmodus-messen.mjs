#!/usr/bin/env node
/**
 * Dunkelmodus gerendert nachmessen -- flaechendeckend, als wiederholbarer Test.
 *
 * Was das Skript tut: In einem echten Chromium (Playwright) laeuft es ueber
 * 47 Seitenzustaende der App (Anmeldung, Konfi, Teamer:in, Leitung; jeweils
 * oben und nach unten gescrollt), hell UND dunkel, mit iPhone- und Android-
 * Kennung (Ionic-Modus ios / md) -- 188 Zustaende. Fuer jedes sichtbare
 * Element (auch im Shadow-DOM) liest es die berechneten Stile und findet
 *   (a) deckende helle Flaechen im Dunkeln (Luminanz > 0,5, mindestens
 *       40 x 24 px) und
 *   (b) Textknoten unter der WCAG-Grenze (4,5:1; ab 24 px oder 18,66 px fett
 *       3:1) gegen den naechsten deckenden Grund. Der Grund wird ueber die
 *       Elternkette gesucht, halbtransparente Schichten werden gemischt --
 *       auch Ionics Flaechen im Shadow-DOM (.button-native, .item-native,
 *       .toolbar-background) und flache Ueberlagerungen (ein Verlauf, dessen
 *       Stops dieselbe Farbe tragen, wie die Schicht auf den Eck-Marken).
 *       Echte Verlaeufe kann man nicht auf eine Zahl bringen; Text darauf
 *       wird uebersprungen, die Dashboard-Verlaeufe misst Teil 2.
 * Teil 2 sind die Einzelauflagen des Dunkelmodus-Audits vom 26.09.2026 als
 * Punktmessungen: BF-01 Anmeldeseite, BF-02 Dashboard-Verlaufsenden, BF-03/04
 * Kartengrund und Listenfeld gleich dem Token, BF-07 Reaktionszaehler, BF-08
 * Befoerdern-Knopf.
 *
 * Restliste: Was bewusst unter der Grenze bleibt, steht mit Grund in
 * scripts/dunkelmodus-restliste.json (Chat-Blase, Hellmodus-Befunde des
 * UI-Audits). Das Skript endet mit Exit 1, wenn eine Messstelle unter der
 * Grenze liegt, die kein Eintrag abdeckt, wenn im Dunkeln eine helle Flaeche
 * steht oder eine Auflage faellt. Eintraege ohne Treffer werden gemeldet --
 * die Liste darf nur schrumpfen.
 *
 * Warum als Skript: dunkelmodus.test.ts liest das Stylesheet als Text und
 * kann weder Spezifitaet gegen das Theme noch das Zusammenspiel von Farbe,
 * Grund und Shadow-DOM im Browser sehen (Audit BF-09: 104 Verstoesse bei
 * gruenen Tests). Kein CI-Anschluss: Die Pipeline hat keinen laufenden Stack.
 * Lokal laufen lassen, bevor eine Farbaenderung committet wird, und die Zahlen
 * in die Commit-Nachricht schreiben.
 *
 * Voraussetzungen:
 *   - Backend gegen eine Datenbank mit dem Test-Seed
 *     (backend/tests/helpers/seed.js; dazu wie im Audit Chatraum 1 mit
 *     Nachrichten und Reaktionen, ein Antrag, eine Challenge), Konten konfi1,
 *     teamer1, admin1 mit --passwort (Standard: Seed-Passwort), und
 *     CORS_ORIGINS auf die Vite-Adresse.
 *   - Vite unter --url (Standard http://localhost:5173) mit VITE_API_URL auf
 *     dieses Backend.
 *   - Playwright: aus node_modules (Repo-Root, `npm install` dort) oder
 *     global (`npm root -g`), Chromium ueber PLAYWRIGHT_BROWSERS_PATH oder
 *     CHROMIUM_PFAD.
 *
 * Aufruf (aus frontend/):
 *   npm run dunkelmodus:messen -- --url http://localhost:5240
 *   node scripts/dunkelmodus-messen.mjs --url http://localhost:5240 --out /tmp/messung.json
 *   node scripts/dunkelmodus-messen.mjs --schemes dark --only admin
 *   node scripts/dunkelmodus-messen.mjs --nur-auflagen
 *
 * Optionen: --url, --passwort, --schemes dark,light, --platforms ios,android,
 *   --only public|konfi|teamer|admin|all, --out <datei.json> (Standard:
 *   dunkelmodus-messung.json im Temp-Verzeichnis), --nur-auflagen (nur Teil 2),
 *   --ohne-auflagen (nur Teil 1).
 *
 * Ausgabe: eine Zeile je Seitenzustand, die Auflagen, danach die
 * Zusammenfassung je Modus (Messstellen unter der Grenze / davon nicht in der
 * Restliste), die Einordnung dunkelspezifisch / hellspezifisch /
 * modusunabhaengig, die Treffer je Restlisten-Eintrag und die Laufzeit. Alles
 * auch in der --out-Datei.
 *
 * Laufzeit: rund 12 Minuten fuer den vollen Lauf (188 Zustaende + Auflagen,
 * gemessen 709 s); --schemes dark halbiert sie, --only <rolle> teilt weiter.
 *
 * Stand 26.09.2026 (Paket K2, voller Lauf, 697 s): dunkel 48 Messstellen unter
 * der Grenze in 12 Zustaenden -- 16 eigene Chat-Blase, 30 Kopfbanner der
 * Termindetails (beide Modi), 2 Danger-Knopf 'Event absagen' (dunkelspezifisch,
 * 4,39:1) -- alle drei Nebenbefunde in der Restliste; 0 helle Flaechen; hell
 * 93 Messstellen, alle in der Restliste (UI-Audit BF-04); Auflagen in
 * Ordnung; Exit 0.
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const require = createRequire(import.meta.url);
const HIER = dirname(fileURLToPath(import.meta.url));

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
const SCHEMES = argWert('schemes', 'dark,light').split(',');
const PLATFORMS = argWert('platforms', 'ios,android').split(',');
const ONLY = argWert('only', 'all');
const OUT = resolve(argWert('out', join(tmpdir(), 'dunkelmodus-messung.json')));
const NUR_AUFLAGEN = args.includes('--nur-auflagen');
const OHNE_AUFLAGEN = args.includes('--ohne-auflagen');
const UA = {
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* --- Die 47 Seitenzustaende (wie im Audit vom 26.09.2026) --- */
const SEITEN = {
  public: { user: null, seiten: ['/login', '/register', '/forgot-password', '/reset-password?token=abc'] },
  konfi: { user: 'konfi1', seiten: ['/konfi/dashboard', '/konfi/chat', '/konfi/chat/room/1', '/konfi/challenges', '/konfi/events', '/konfi/events?segment=antraege', '/konfi/events/1', '/konfi/badges', '/konfi/profile'] },
  teamer: { user: 'teamer1', seiten: ['/teamer/dashboard', '/teamer/chat', '/teamer/chat/room/1', '/teamer/challenges', '/teamer/events', '/teamer/events?segment=antraege', '/teamer/events?eventId=1', '/teamer/profile/material', '/teamer/profile/badges', '/teamer/profile/konfi-stats', '/teamer/profile'] },
  admin: { user: 'admin1', seiten: ['/admin/konfis', '/admin/konfis/1', '/admin/chat', '/admin/chat/room/1', '/admin/activities', '/admin/events', '/admin/events?segment=antraege', '/admin/events/1', '/admin/challenges', '/admin/badges', '/admin/users', '/admin/material', '/admin/wrapped', '/admin/profile', '/admin/settings', '/admin/settings/categories', '/admin/settings/jahrgaenge', '/admin/settings/levels', '/admin/settings/invite', '/admin/settings/certificates', '/admin/settings/dashboard', '/admin/organizations', '/admin/metrics'] },
};

/* --- Restliste: aus der JSON-Datei, /RegExp/-Strings werden zu RegExp --- */
const RESTLISTE_DATEI = join(HIER, 'dunkelmodus-restliste.json');
const alsMuster = (wert) => {
  if (typeof wert !== 'string') return wert;
  const m = /^\/(.*)\/([a-z]*)$/s.exec(wert);
  return m ? new RegExp(m[1], m[2]) : wert;
};
const RESTLISTE = JSON.parse(readFileSync(RESTLISTE_DATEI, 'utf8')).eintraege.map((e) => {
  if (!e.grund || typeof e.grund !== 'string') throw new Error(`Restliste: Eintrag ohne Grund: ${JSON.stringify(e)}`);
  return { ...e, vorder: alsMuster(e.vorder), hinter: alsMuster(e.hinter), text: alsMuster(e.text), pfad: alsMuster(e.pfad) };
});
const passt = (eintrag, v) => {
  const feld = (soll, ist) => soll === undefined || (soll instanceof RegExp ? soll.test(ist ?? '') : soll === ist);
  return feld(eintrag.scheme, v.scheme) && feld(eintrag.platform, v.platform)
    && (eintrag.seite === undefined || (v.seite ?? '').includes(eintrag.seite))
    && feld(eintrag.vorder, v.vorder) && feld(eintrag.hinter, v.hinter)
    && feld(eintrag.text, v.text) && feld(eintrag.pfad, v.pfad);
};

/* --- Farbrechnung (WCAG 2.x), Node-Seite --- */
const parse = (s) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s || ''); return m ? { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] } : null; };
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const blend = (top, a, unten) => top.map((c, i) => Math.round(c * a + unten[i] * (1 - a)));
const hex = ([r, g, b]) => '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
const kontrast = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return +((l1 + 0.05) / (l2 + 0.05)).toFixed(2); };
const aufGrund = (farbe, grund) => { const f = parse(farbe); const g = parse(grund); if (!f || !g) return null; return f.a < 1 ? blend(f.rgb, f.a, g.rgb) : f.rgb; };
const WEISS = [255, 255, 255];
const letzterStop = (bgImage) => { const stops = [...(bgImage || '').matchAll(/rgba?\([^)]*\)/g)].map((m) => m[0]); return stops[stops.length - 1] || null; };

/* --- Im Browser: alle sichtbaren Elemente durchgehen (Teil 1) --- */
const MESSUNG = () => {
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const parse = (s) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s || ''); if (!m) return null; return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] }; };
  const blend = (top, a, unten) => top.map((c, i) => Math.round(c * a + unten[i] * (1 - a)));
  const hex = ([r, g, b]) => '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
  const kontrast = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  const eltern = (e) => e.parentElement || (e.getRootNode() instanceof ShadowRoot ? e.getRootNode().host : null);
  const pfad = (el) => {
    const teile = []; let e = el; let tiefe = 0;
    while (e && e.nodeType === 1 && tiefe < 5) {
      let t = e.tagName.toLowerCase();
      if (e.id) t += '#' + e.id; else if (e.classList.length) t += '.' + [...e.classList].slice(0, 2).join('.');
      teile.unshift(t); e = eltern(e); tiefe++;
    }
    return teile.join(' > ');
  };
  // Ionic-Elemente malen ihre Flaeche im Shadow-DOM (.button-native,
  // .item-native, .toolbar-background, #background-content der ion-content);
  // der Host selbst ist durchsichtig. Text im Licht-DOM eines ion-button liegt
  // also auf .button-native, nicht auf der Karte dahinter. Das Audit-Skript
  // vom 26.09.2026 sah das nicht und rechnete "Anmelden (0/50)" gegen die
  // Karte: 1,36:1 statt der echten 10,78:1 (Schwarz auf Ionics Erfolgsgruen).
  const schattenFlaeche = (e) => e.shadowRoot ? e.shadowRoot.querySelector('.button-native, .item-native, .toolbar-background, .chip-native, #background-content') : null;
  // Ein Verlauf, dessen Stops alle dieselbe Farbe tragen, ist eine flache
  // Schicht -- so liegt im Dunkeln Schwarz mit 40 % Deckkraft auf den
  // Eck-Marken. Er wird wie eine halbtransparente Farbe gemischt.
  const flacheSchicht = (bgImage) => {
    if (!/^linear-gradient\(/.test(bgImage) || (bgImage.match(/gradient\(/g) || []).length !== 1) return null;
    const stops = [...bgImage.matchAll(/rgba?\([^)]*\)/g)].map((m) => m[0]);
    if (!stops.length || new Set(stops).size !== 1) return null;
    return parse(stops[0]);
  };
  // Rueckfallgrund, wenn keine deckende Schicht gefunden wird: Ionics
  // Seitengrund (hell #fff, dunkel #000 bzw. #121212) -- nicht Schwarz, sonst
  // liest der helle Modus Kopfzeile und Tab-Leiste als Schwarz auf Schwarz.
  const rueckfall = () => {
    const wurzel = parse(getComputedStyle(document.body).backgroundColor);
    if (wurzel && wurzel.a >= 0.99) return wurzel.rgb;
    const ion = getComputedStyle(document.documentElement).getPropertyValue('--ion-background-color').trim();
    const m = /^#([0-9a-f]{6})$/i.exec(ion);
    if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
    return matchMedia('(prefers-color-scheme: dark)').matches ? [0, 0, 0] : [255, 255, 255];
  };
  const hintergrund = (el) => {
    let e = el; const schichten = [];
    const nimm = (node) => {
      const cs = getComputedStyle(node);
      let deckend = false;
      if (cs.backgroundImage && cs.backgroundImage !== 'none') {
        const schicht = flacheSchicht(cs.backgroundImage);
        if (!schicht) return 'verlauf';
        if (schicht.a > 0) { schichten.push(schicht); if (schicht.a >= 0.99) deckend = true; }
      }
      const bg = parse(cs.backgroundColor);
      if (!deckend && bg && bg.a > 0) { schichten.push(bg); if (bg.a >= 0.99) deckend = true; }
      return deckend ? 'deckend' : null;
    };
    while (e && e.nodeType === 1) {
      const sf = schattenFlaeche(e);
      if (sf) { const r = nimm(sf); if (r === 'verlauf') return { verlauf: true }; if (r === 'deckend') break; }
      const r = nimm(e);
      if (r === 'verlauf') return { verlauf: true };
      if (r === 'deckend') break;
      e = eltern(e);
    }
    if (!schichten.length) return { rgb: rueckfall() };
    const unterste = schichten[schichten.length - 1];
    let ergebnis = unterste.a >= 0.99 ? unterste.rgb : blend(unterste.rgb, unterste.a, rueckfall());
    for (let i = schichten.length - 2; i >= 0; i--) ergebnis = blend(schichten[i].rgb, schichten[i].a, ergebnis);
    return { rgb: ergebnis };
  };
  const sichtbar = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05;
  };
  const alle = [];
  const sammle = (root) => { for (const el of root.querySelectorAll('*')) { alle.push(el); if (el.shadowRoot) sammle(el.shadowRoot); } };
  sammle(document);
  const helleFlaechen = []; const kontraste = []; const gesehen = new Set();
  for (const el of alle) {
    if (!sichtbar(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const bg = parse(cs.backgroundColor);
    const istHellFlaeche = bg && bg.a >= 0.9 && lum(bg.rgb) > 0.5 && r.width >= 40 && r.height >= 24;
    const istHellBild = cs.backgroundImage && /gradient/.test(cs.backgroundImage) && /rgb\(2[3-5]\d, 2[3-5]\d, 2[3-5]\d\)|#f[0-9a-f]{5}|white/i.test(cs.backgroundImage) && r.width >= 40 && r.height >= 24;
    if (istHellFlaeche || istHellBild) {
      const p = pfad(el);
      if (!gesehen.has(p)) { gesehen.add(p); helleFlaechen.push({ pfad: p, farbe: istHellFlaeche ? hex(bg.rgb) : cs.backgroundImage.slice(0, 80), groesse: `${Math.round(r.width)}x${Math.round(r.height)}`, text: (el.textContent || '').trim().slice(0, 40) }); }
    }
    const eigenerText = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ').trim();
    if (eigenerText.length >= 2) {
      // Text im Licht-DOM eines Ionic-Elements wird in dessen Shadow-Flaeche
      // gerendert und erbt DEREN Farbe (ion-button: .button-native mit Ionics
      // .ion-color-Kontrastfarbe), nicht die des Hosts. Der Host von
      // "Anmelden (0/50)" meldet hell #fff, gerendert wird #000 auf Gruen.
      const schrift = schattenFlaeche(el);
      const fg = parse((schrift ? getComputedStyle(schrift) : cs).color);
      if (!fg) continue;
      const hg = hintergrund(el);
      if (hg.verlauf) continue;
      const fgRgb = fg.a < 0.99 ? blend(fg.rgb, fg.a, hg.rgb) : fg.rgb;
      const k = kontrast(fgRgb, hg.rgb);
      const gross = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
      const grenze = gross ? 3 : 4.5;
      if (k < grenze) kontraste.push({ pfad: pfad(el), text: eigenerText.slice(0, 50), vorder: hex(fgRgb), hinter: hex(hg.rgb), kontrast: +k.toFixed(2), schrift: cs.fontSize, grenze });
    }
  }
  return { helleFlaechen, kontraste, ionMode: document.documentElement.classList.contains('md') ? 'md' : (document.documentElement.classList.contains('ios') ? 'ios' : '?') };
};

/* --- Browser-Hilfen --- */
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
  await page.reload();
  await page.waitForSelector('ion-content', { state: 'visible', timeout: 15000 });
}
async function seite(page, pfad, warte = 1500) {
  await page.goto(`${BASE}${pfad}`);
  try { await page.waitForSelector('ion-content', { state: 'visible', timeout: 15000 }); } catch { /* Seite ohne ion-content (Fehlerzustand) wird trotzdem gemessen */ }
  await sleep(warte);
}
async function nachUnten(page) {
  await page.evaluate(async () => { const c = [...document.querySelectorAll('ion-content')].filter((c) => c.offsetParent !== null).pop(); if (c) await c.scrollToBottom(0); });
  await sleep(500);
}
const dedupe = (arr, k) => { const s = new Set(); return arr.filter((x) => { const id = k(x); if (s.has(id)) return false; s.add(id); return true; }); };
const neuerKontext = (browser, scheme, platform) => browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, userAgent: UA[platform], locale: 'de-DE' });

/* --- Teil 1: flaechendeckend --- */
async function flaechendeckend(browser, ergebnis) {
  for (const scheme of SCHEMES) for (const platform of PLATFORMS) {
    const ctx = await neuerKontext(browser, scheme, platform);
    const page = await ctx.newPage();
    for (const [rolle, cfg] of Object.entries(SEITEN)) {
      if (!(ONLY === 'all' || ONLY === rolle)) continue;
      if (cfg.user) await login(page, ctx, cfg.user);
      for (const pfad of cfg.seiten) {
        await seite(page, pfad, 1800);
        const oben = await page.evaluate(MESSUNG);
        await nachUnten(page);
        const unten = await page.evaluate(MESSUNG);
        const eintrag = {
          scheme, platform, seite: pfad, ionMode: oben.ionMode,
          helleFlaechen: dedupe([...oben.helleFlaechen, ...unten.helleFlaechen], (x) => x.pfad),
          kontraste: dedupe([...oben.kontraste, ...unten.kontraste], (x) => x.pfad + x.text),
        };
        ergebnis.zustaende.push(eintrag);
        console.log(`${scheme.padEnd(5)} ${platform.padEnd(7)} ${pfad.padEnd(34)} [${oben.ionMode}] helle Flaechen: ${eintrag.helleFlaechen.length}, Kontrast<Grenze: ${eintrag.kontraste.length}`);
      }
    }
    await ctx.close();
  }
}

/* --- Teil 2: die Einzelauflagen des Audits --- */
async function auflagen(browser, ergebnis) {
  const zeile = (scheme, platform, befund, stelle, wert, ok, farben = {}) => {
    ergebnis.auflagen.push({ scheme, platform, befund, stelle, wert, ok, ...farben });
    console.log(`${scheme.padEnd(5)} ${platform.padEnd(7)} ${befund} ${stelle.padEnd(44)} ${wert}${ok === false ? '   <- VERSTOSS' : ''}`);
  };
  for (const scheme of SCHEMES) for (const platform of PLATFORMS) {
    const ctx = await neuerKontext(browser, scheme, platform);
    const page = await ctx.newPage();

    // BF-01: Anmeldeseite -- Ueberschrift und Links auf der Karte
    await page.goto(`${BASE}/login`); await page.waitForSelector('.app-auth-card', { timeout: 15000 }); await sleep(800);
    const auth = await page.evaluate(() => {
      const cs = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el) : null; };
      return { karte: cs('.app-auth-card')?.backgroundColor, h2: cs('.app-auth-card__heading h2')?.color, link: cs('.app-auth-link:not(.app-auth-link--muted)')?.color, muted: cs('.app-auth-link--muted')?.color, mutedpx: cs('.app-auth-link--muted')?.fontSize };
    });
    const karte = parse(auth.karte).rgb;
    for (const [name, farbe] of [['"Anmelden" (h2)', auth.h2], ['Link "Noch keinen Account?"', auth.link], [`Link "Passwort vergessen?" (${auth.mutedpx})`, auth.muted]]) {
      const text = aufGrund(farbe, auth.karte); const k = kontrast(text, karte);
      zeile(scheme, platform, 'BF-01', name, `${hex(text)} auf Karte ${hex(karte)} = ${k}:1`, k >= 4.5, { vorder: hex(text), hinter: hex(karte), seite: '/login' });
    }

    // BF-02 + BF-07 als Konfi
    await login(page, ctx, 'konfi1');
    await seite(page, '/konfi/dashboard', 2000);
    const dash = await page.evaluate(() => ({ ranking: getComputedStyle(document.querySelector('.app-dashboard-section--ranking')).backgroundImage, events: getComputedStyle(document.querySelector('.app-dashboard-section--events')).backgroundImage }));
    for (const [name, img] of Object.entries(dash)) {
      const ende = letzterStop(img);
      if (!ende) { zeile(scheme, platform, 'BF-02', `Konfi-Dashboard ${name}`, `KEIN VERLAUF: ${img}`, false); continue; }
      const k = kontrast(WEISS, parse(ende).rgb);
      zeile(scheme, platform, 'BF-02', `Konfi-Dashboard ${name}: Verlaufsende`, `${hex(parse(ende).rgb)}, Weiss darauf ${k}:1`, k >= 4.5, { vorder: '#ffffff', hinter: hex(parse(ende).rgb), seite: '/konfi/dashboard' });
    }
    await seite(page, '/konfi/chat/room/1', 2000);
    const chips = await page.evaluate(() => [...document.querySelectorAll('div[title] > span')].map((s) => { const chip = s.parentElement; const blase = chip.parentElement.parentElement; return { text: s.textContent, color: getComputedStyle(s).color, chipBg: getComputedStyle(chip).backgroundColor, blaseBg: getComputedStyle(blase).backgroundColor }; }));
    const fremde = chips.filter((c) => !/rgb\(6, 182, 212\)/.test(c.blaseBg));
    if (!fremde.length) zeile(scheme, platform, 'BF-07', 'Reaktionszaehler', 'KEIN CHIP an fremder Nachricht (Seed?)', false);
    for (const c of fremde.slice(0, 2)) {
      const chipBg = aufGrund(c.chipBg, c.blaseBg); const text = aufGrund(c.color, `rgb(${chipBg.join(', ')})`); const k = kontrast(text, chipBg);
      zeile(scheme, platform, 'BF-07', `Reaktionszaehler "${c.text}" (fremde Blase ${hex(parse(c.blaseBg).rgb)})`, `Text ${hex(text)} auf Chip ${hex(chipBg)} = ${k}:1`, k >= 4.5, { vorder: hex(text), hinter: hex(chipBg), seite: '/konfi/chat/room/1' });
    }

    // BF-03/BF-04 als Teamer:in -- Karte UND Listenfeld auf der Material-Seite; BF-02 Teamer-Dashboard
    await login(page, ctx, 'teamer1');
    await seite(page, '/teamer/profile/material', 1200);
    const k3 = await page.evaluate(() => {
      const c = document.querySelector('ion-card.app-card'); const root = getComputedStyle(document.documentElement);
      const item = [...document.querySelectorAll('ion-list[inset] ion-item, ion-list ion-item')].find((i) => i.shadowRoot?.querySelector('.item-native'));
      return { gerendert: c ? getComputedStyle(c).backgroundColor : null, token: root.getPropertyValue('--app-surface-card').trim(), modus: document.documentElement.classList.contains('ios') ? 'ios' : 'md', item: item ? getComputedStyle(item.shadowRoot.querySelector('.item-native')).backgroundColor : null };
    });
    const token = k3.token.length === 4 ? '#' + [...k3.token.slice(1)].map((c) => c + c).join('') : k3.token.toLowerCase();
    if (k3.gerendert) {
      const gerendert = hex(parse(k3.gerendert).rgb);
      zeile(scheme, platform, 'BF-03', `ion-card.app-card gerendert (html.${k3.modus})`, `${gerendert}; Token --app-surface-card ${k3.token} -> ${gerendert === token ? 'greift' : 'GREIFT NICHT'}`, gerendert === token);
    } else zeile(scheme, platform, 'BF-03', 'ion-card.app-card', 'KEINE KARTE (Seed?)', false);
    if (k3.item) {
      // Listenfeld (ion-item) im Dunkeln im Kartenton, nicht Ionics Plattformwert (iOS #000000, md #1e1e1e).
      const itemHex = parse(k3.item).a === 0 ? 'transparent' : hex(parse(k3.item).rgb);
      const ok = scheme === 'light' || itemHex === token || itemHex === 'transparent';
      zeile(scheme, platform, 'BF-04', `ion-item .item-native gerendert (html.${k3.modus})`, `${itemHex}; Kartenton ${token} -> ${ok ? 'gleich' : 'ABWEICHEND'}`, ok);
    }
    await seite(page, '/teamer/dashboard', 2000);
    const tEnde = letzterStop(await page.evaluate(() => { const el = document.querySelector('.app-dashboard-section--events'); return el ? getComputedStyle(el).backgroundImage : null; }));
    if (tEnde) { const k = kontrast(WEISS, parse(tEnde).rgb); zeile(scheme, platform, 'BF-02', 'Teamer-Dashboard events: Verlaufsende', `${hex(parse(tEnde).rgb)}, Weiss darauf ${k}:1`, k >= 4.5, { vorder: '#ffffff', hinter: hex(parse(tEnde).rgb), seite: '/teamer/dashboard' }); }
    else zeile(scheme, platform, 'BF-02', 'Teamer-Dashboard events', 'KEINE EVENTS-KARTE (Seed?)', false);

    // BF-08 als Leitung -- Knopf unten auf der Konfi-Detailseite
    await login(page, ctx, 'admin1');
    await seite(page, '/admin/konfis/1', 1800); await nachUnten(page);
    const knopf = await page.evaluate(() => { const b = [...document.querySelectorAll('ion-button')].find((b) => /bef.rdern/i.test(b.textContent)); const n = b?.shadowRoot?.querySelector('.button-native'); return n ? { text: getComputedStyle(n).color, bg: getComputedStyle(n).backgroundColor } : null; });
    if (knopf) { const k = kontrast(parse(knopf.text).rgb, parse(knopf.bg).rgb); zeile(scheme, platform, 'BF-08', '"Zur Teamer:in befoerdern"', `Text ${hex(parse(knopf.text).rgb)} auf ${hex(parse(knopf.bg).rgb)} = ${k}:1`, k >= 4.5, { vorder: hex(parse(knopf.text).rgb), hinter: hex(parse(knopf.bg).rgb), seite: '/admin/konfis/1' }); }
    else zeile(scheme, platform, 'BF-08', '"Zur Teamer:in befoerdern"', 'KNOPF NICHT GEFUNDEN', false);
    await ctx.close();
  }
}

/* --- Auswertung --- */
function auswerten(ergebnis) {
  const verstoesse = [];
  for (const z of ergebnis.zustaende) for (const k of z.kontraste) verstoesse.push({ scheme: z.scheme, platform: z.platform, seite: z.seite, ...k });
  const treffer = new Map(RESTLISTE.map((e) => [e, 0]));
  const decke = (v) => { const e = RESTLISTE.find((r) => passt(r, v)); if (e) treffer.set(e, treffer.get(e) + 1); return !!e; };
  const offen = verstoesse.filter((v) => !decke(v));
  // Auflagen unter der Grenze laufen durch dieselbe Restliste (Feld `text` trifft die Stelle).
  const auflagenOffen = ergebnis.auflagen.filter((a) => a.ok === false && !decke({ scheme: a.scheme, platform: a.platform, seite: a.seite ?? `(Auflage ${a.befund})`, text: a.stelle, vorder: a.vorder, hinter: a.hinter, pfad: `auflage ${a.befund}` }));

  // Einordnung: liegt dieselbe Stelle (Plattform, Seite, Pfad, Text) auch im anderen Modus unter der Grenze?
  const schluessel = (v) => `${v.platform}|${v.seite}|${v.pfad}|${v.text}`;
  const hellMenge = new Set(verstoesse.filter((v) => v.scheme === 'light').map(schluessel));
  const dunkelMenge = new Set(verstoesse.filter((v) => v.scheme === 'dark').map(schluessel));
  const beideModi = SCHEMES.includes('dark') && SCHEMES.includes('light');
  const einordnung = { dunkelspezifisch: 0, hellspezifisch: 0, modusunabhaengig: 0 };
  if (beideModi) for (const v of verstoesse) {
    if (v.scheme === 'dark') einordnung[hellMenge.has(schluessel(v)) ? 'modusunabhaengig' : 'dunkelspezifisch']++;
    else if (!dunkelMenge.has(schluessel(v))) einordnung.hellspezifisch++;
  }
  const helleFlaechenDunkel = ergebnis.zustaende.filter((z) => z.scheme === 'dark').reduce((n, z) => n + z.helleFlaechen.length, 0);

  console.log('\n=== Zusammenfassung ===');
  const jeModus = {};
  for (const scheme of SCHEMES) {
    const zs = ergebnis.zustaende.filter((z) => z.scheme === scheme);
    const vs = verstoesse.filter((v) => v.scheme === scheme);
    const os = offen.filter((v) => v.scheme === scheme);
    jeModus[scheme] = { zustaende: zs.length, verstoesse: vs.length, offen: os.length, zustaendeMitVerstoss: zs.filter((z) => z.kontraste.length).length };
    console.log(`${scheme.padEnd(5)} ${zs.length} Zustaende, ${vs.length} Messstellen unter der Grenze in ${jeModus[scheme].zustaendeMitVerstoss} Zustaenden, davon ${os.length} NICHT in der Restliste`);
  }
  if (beideModi) console.log(`Einordnung (dunkle Messstellen): ${einordnung.dunkelspezifisch} dunkelspezifisch, ${einordnung.modusunabhaengig} modusunabhaengig (auch hell unter der Grenze); hellspezifisch: ${einordnung.hellspezifisch}`);
  console.log(`helle Flaechen im Dunkeln: ${helleFlaechenDunkel}`);
  if (ergebnis.auflagen.length) console.log(`Auflagen BF-01/02/03/04/07/08: ${ergebnis.auflagen.length} Messstellen, ${ergebnis.auflagen.filter((a) => a.ok === false).length} unter der Grenze, davon ${auflagenOffen.length} NICHT in der Restliste`);
  console.log('Restliste:');
  for (const [e, n] of treffer) console.log(`  ${String(n).padStart(3)} Treffer  ${e.grund.slice(0, 100)}${e.grund.length > 100 ? '...' : ''}${n === 0 && ergebnis.zustaende.length ? '   <- OHNE TREFFER (streichen?)' : ''}`);
  if (offen.length) {
    console.log('\nNICHT in der Restliste:');
    for (const v of offen) console.log(`  ${v.scheme} ${v.platform} ${v.seite} | "${v.text}" | ${v.vorder} auf ${v.hinter} = ${v.kontrast}:1 (Grenze ${v.grenze}, ${v.schrift}) | ${v.pfad.slice(-80)}`);
  }
  if (auflagenOffen.length) {
    console.log('\nAuflagen NICHT in der Restliste:');
    for (const a of auflagenOffen) console.log(`  ${a.scheme} ${a.platform} ${a.befund} ${a.stelle}: ${a.wert}`);
  }
  ergebnis.zusammenfassung = { jeModus, verstoesse: verstoesse.length, offen: offen.length, einordnung, helleFlaechenDunkel, auflagenOffen: auflagenOffen.length, restlisteTreffer: [...treffer].map(([e, n]) => ({ grund: e.grund, treffer: n })) };
  return offen.length === 0 && helleFlaechenDunkel === 0 && auflagenOffen.length === 0;
}

async function main() {
  const start = Date.now();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const ergebnis = { stand: new Date().toISOString(), url: BASE, schemes: SCHEMES, platforms: PLATFORMS, only: ONLY, restliste: RESTLISTE_DATEI, zustaende: [], auflagen: [] };
  try {
    if (!NUR_AUFLAGEN) await flaechendeckend(browser, ergebnis);
    if (!OHNE_AUFLAGEN) await auflagen(browser, ergebnis);
  } finally {
    await browser.close();
  }
  const ok = auswerten(ergebnis);
  ergebnis.laufzeitSekunden = Math.round((Date.now() - start) / 1000);
  ergebnis.ok = ok;
  writeFileSync(OUT, JSON.stringify(ergebnis, null, 2));
  console.log(`\nErgebnis: ${OUT} (Laufzeit ${ergebnis.laufzeitSekunden} s)`);
  console.log(ok ? 'Alle Messstellen in Ordnung oder in der Restliste begruendet. Exit 0.' : 'Messstellen offen -- siehe oben. Exit 1.');
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
