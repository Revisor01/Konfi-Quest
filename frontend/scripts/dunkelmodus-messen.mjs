#!/usr/bin/env node
/**
 * Dunkelmodus gerendert nachmessen: die fünf Auflagen des Audits vom
 * 26.09.2026 (BF-01 Anmeldeseite, BF-02 Dashboard-Verläufe, BF-03 Kartengrund
 * auf iOS, BF-07 Reaktionszähler im Chat, BF-08 Befördern-Knopf), jeweils
 * hell und dunkel, mit iPhone- und Android-Kennung (Ionic-Modus ios / md).
 *
 * Warum als Skript: Die Dunkelmodus-Tests lesen das Stylesheet als Text und
 * können weder Spezifität gegen das Theme noch Kontraste im Browser sehen.
 * Dieses Skript liest die berechneten Stile aus einem echten Chromium und
 * rechnet WCAG-Kontraste — es ist die Messung, mit der die Fixes belegt
 * wurden. Kein CI-Anschluss; der gehört zum systematischen Umbau.
 *
 * Voraussetzungen: laufender Stack mit Test-Daten (Chatraum 1 mit
 * Reaktionen, Konfi 1), Vite unter --url (Standard http://localhost:5173),
 * Backend mit CORS_ORIGINS auf diese Vite-Adresse; die Konten konfi1,
 * teamer1, admin1 mit Passwort aus --passwort (Standard: Seed-Passwort).
 * Playwright kommt aus den Wurzel-Abhängigkeiten (`npm install` im
 * Repo-Root, wie scripts/screenshots.mjs); ein anderes Chromium lässt
 * sich über CHROMIUM_PFAD vorgeben.
 *
 * Aufruf:
 *   node frontend/scripts/dunkelmodus-messen.mjs --url http://localhost:5240
 *   node frontend/scripts/dunkelmodus-messen.mjs --schemes dark --platforms ios
 *
 * Ausgabe: eine Zeile je Messstelle (Schema, Plattform, Befund, Stelle,
 * Farben und Kontrast). Exit-Code 1, wenn eine Messstelle unter 4,5:1 liegt
 * oder der Kartengrund nicht dem Token entspricht.
 *
 * Stand 26.09.2026: dunkel alle Messstellen in Ordnung; HELL meldet der
 * gedämpfte Link „Passwort vergessen?" 4,37:1 (Konfi-Lila mit 0,7 Deckkraft
 * auf der weißen Karte) — ein Nebenbefund außerhalb der Auflagen, bewusst
 * nicht kaschiert.
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const argWert = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
const BASE = argWert('url', 'http://localhost:5173');
const PASSWORT = argWert('passwort', 'testpasswort123');
const SCHEMES = argWert('schemes', 'dark,light').split(',');
const PLATFORMS = argWert('platforms', 'ios,android').split(',');
const UA = {
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* --- Farbrechnung (WCAG 2.x) --- */
const parse = (s) => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(s || ''); return m ? { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] } : null; };
const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const blend = (top, a, unten) => top.map((c, i) => Math.round(c * a + unten[i] * (1 - a)));
const hex = ([r, g, b]) => '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
const kontrast = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return +((l1 + 0.05) / (l2 + 0.05)).toFixed(2); };
/** Eine (ggf. halbtransparente) Farbe auf einen deckenden Grund gelegt. */
const aufGrund = (farbe, grund) => { const f = parse(farbe); const g = parse(grund); if (!f || !g) return null; return f.a < 1 ? blend(f.rgb, f.a, g.rgb) : f.rgb; };
const WEISS = [255, 255, 255];
const letzterStop = (bgImage) => { const stops = [...(bgImage || '').matchAll(/rgba?\([^)]*\)/g)].map((m) => m[0]); return stops[stops.length - 1] || null; };

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
  // Einführung und Änderungsanzeige als gesehen markieren, sonst liegen sie über der Seite.
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
  await page.waitForSelector('ion-content', { state: 'visible', timeout: 15000 });
  await sleep(warte);
}
async function nachUnten(page) {
  await page.evaluate(async () => { const c = [...document.querySelectorAll('ion-content')].filter((c) => c.offsetParent !== null).pop(); if (c) await c.scrollToBottom(0); });
  await sleep(500);
}

let verstoesse = 0;
const zeile = (scheme, platform, befund, stelle, wert, ok) => {
  if (ok === false) verstoesse++;
  console.log(`${scheme.padEnd(5)} ${platform.padEnd(7)} ${befund} ${stelle.padEnd(40)} ${wert}${ok === false ? '   <- VERSTOSS' : ''}`);
};

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const scheme of SCHEMES) for (const platform of PLATFORMS) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: scheme, userAgent: UA[platform], locale: 'de-DE' });
    const page = await ctx.newPage();

    // BF-01: Anmeldeseite — Überschrift und Links auf der Karte
    await page.goto(`${BASE}/login`); await page.waitForSelector('.app-auth-card', { timeout: 15000 }); await sleep(800);
    const auth = await page.evaluate(() => {
      const cs = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el) : null; };
      return { karte: cs('.app-auth-card')?.backgroundColor, h2: cs('.app-auth-card__heading h2')?.color, link: cs('.app-auth-link:not(.app-auth-link--muted)')?.color, muted: cs('.app-auth-link--muted')?.color, mutedpx: cs('.app-auth-link--muted')?.fontSize };
    });
    const karte = parse(auth.karte).rgb;
    for (const [name, farbe] of [['"Anmelden" (h2)', auth.h2], ['Link "Noch keinen Account?"', auth.link], [`Link "Passwort vergessen?" (${auth.mutedpx})`, auth.muted]]) {
      const text = aufGrund(farbe, auth.karte); const k = kontrast(text, karte);
      zeile(scheme, platform, 'BF-01', name, `${hex(text)} auf Karte ${hex(karte)} = ${k}:1`, k >= 4.5);
    }

    // BF-02 + BF-07 als Konfi
    await login(page, ctx, 'konfi1');
    await seite(page, '/konfi/dashboard', 2000);
    const dash = await page.evaluate(() => ({ ranking: getComputedStyle(document.querySelector('.app-dashboard-section--ranking')).backgroundImage, events: getComputedStyle(document.querySelector('.app-dashboard-section--events')).backgroundImage }));
    for (const [name, img] of Object.entries(dash)) {
      const ende = letzterStop(img);
      if (!ende) { zeile(scheme, platform, 'BF-02', `Konfi-Dashboard ${name}`, `KEIN VERLAUF: ${img}`, false); continue; }
      const k = kontrast(WEISS, parse(ende).rgb);
      zeile(scheme, platform, 'BF-02', `Konfi-Dashboard ${name}: Verlaufsende`, `${hex(parse(ende).rgb)}, Weiss darauf ${k}:1`, k >= 4.5);
    }
    await seite(page, '/konfi/chat/room/1', 2000);
    const chips = await page.evaluate(() => [...document.querySelectorAll('div[title] > span')].map((s) => { const chip = s.parentElement; const blase = chip.parentElement.parentElement; return { text: s.textContent, color: getComputedStyle(s).color, chipBg: getComputedStyle(chip).backgroundColor, blaseBg: getComputedStyle(blase).backgroundColor }; }));
    const fremde = chips.filter((c) => !/rgb\(6, 182, 212\)/.test(c.blaseBg));
    if (!fremde.length) zeile(scheme, platform, 'BF-07', 'Reaktionszaehler', 'KEIN CHIP an fremder Nachricht (Seed?)', false);
    for (const c of fremde.slice(0, 2)) {
      const chipBg = aufGrund(c.chipBg, c.blaseBg); const text = aufGrund(c.color, `rgb(${chipBg.join(', ')})`); const k = kontrast(text, chipBg);
      zeile(scheme, platform, 'BF-07', `Reaktionszaehler "${c.text}" (fremde Blase ${hex(parse(c.blaseBg).rgb)})`, `Text ${hex(text)} auf Chip ${hex(chipBg)} = ${k}:1`, k >= 4.5);
    }

    // BF-03 als Teamer:in — Karte auf der Material-Seite; BF-02 Teamer-Dashboard
    await login(page, ctx, 'teamer1');
    await seite(page, '/teamer/profile/material', 1200);
    const k3 = await page.evaluate(() => { const c = document.querySelector('ion-card.app-card'); const root = getComputedStyle(document.documentElement); return { gerendert: getComputedStyle(c).backgroundColor, token: root.getPropertyValue('--app-surface-card').trim(), modus: document.documentElement.classList.contains('ios') ? 'ios' : 'md' }; });
    const gerendert = hex(parse(k3.gerendert).rgb); const token = k3.token.length === 4 ? '#' + [...k3.token.slice(1)].map((c) => c + c).join('') : k3.token.toLowerCase();
    zeile(scheme, platform, 'BF-03', `ion-card.app-card gerendert (html.${k3.modus})`, `${gerendert}; Token --app-surface-card ${k3.token} -> ${gerendert === token ? 'greift' : 'GREIFT NICHT'}`, gerendert === token);
    await seite(page, '/teamer/dashboard', 2000);
    const tEnde = letzterStop(await page.evaluate(() => { const el = document.querySelector('.app-dashboard-section--events'); return el ? getComputedStyle(el).backgroundImage : null; }));
    if (tEnde) { const k = kontrast(WEISS, parse(tEnde).rgb); zeile(scheme, platform, 'BF-02', 'Teamer-Dashboard events: Verlaufsende', `${hex(parse(tEnde).rgb)}, Weiss darauf ${k}:1`, k >= 4.5); }
    else zeile(scheme, platform, 'BF-02', 'Teamer-Dashboard events', 'KEINE EVENTS-KARTE (Seed?)', false);

    // BF-08 als Leitung — Knopf unten auf der Konfi-Detailseite
    await login(page, ctx, 'admin1');
    await seite(page, '/admin/konfis/1', 1800); await nachUnten(page);
    const knopf = await page.evaluate(() => { const b = [...document.querySelectorAll('ion-button')].find((b) => /bef.rdern/i.test(b.textContent)); const n = b?.shadowRoot?.querySelector('.button-native'); return n ? { text: getComputedStyle(n).color, bg: getComputedStyle(n).backgroundColor } : null; });
    if (knopf) { const k = kontrast(parse(knopf.text).rgb, parse(knopf.bg).rgb); zeile(scheme, platform, 'BF-08', '"Zur Teamer:in befoerdern"', `Text ${hex(parse(knopf.text).rgb)} auf ${hex(parse(knopf.bg).rgb)} = ${k}:1`, k >= 4.5); }
    else zeile(scheme, platform, 'BF-08', '"Zur Teamer:in befoerdern"', 'KNOPF NICHT GEFUNDEN', false);
    await ctx.close();
  }
  await browser.close();
  console.log(verstoesse ? `\n${verstoesse} Messstelle(n) unter der Grenze.` : '\nAlle Messstellen in Ordnung.');
  process.exit(verstoesse ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
