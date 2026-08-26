#!/usr/bin/env node
/**
 * Öffnet drei Browserfenster nebeneinander — Leitung, Teamer:in, Konfi —
 * jeweils schon angemeldet.
 *
 * Warum: Fast jede Funktion existiert in DREI Komponentenbäumen
 * (components/admin, components/teamer, components/konfi). Wer eine Änderung
 * nur in einem prüft, hat sie für zwei Drittel der Nutzer:innen nicht geprüft.
 * Nebeneinander sieht man Unterschiede sofort.
 *
 * Aufruf:
 *   node scripts/drei-ansichten.mjs                      (lokaler Dev-Server)
 *   node scripts/drei-ansichten.mjs --url https://konfi-quest.de
 *
 * Das Passwort kommt aus KONFI_DEMO_PASSWORT (nie im Code, das Repo ist
 * öffentlich). Die Fenster bleiben offen, bis man das Skript mit Strg-C
 * beendet.
 */

import { chromium } from '@playwright/test';

const args = process.argv.slice(2);
const argWert = (name, standard) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : standard;
};

const BASIS = argWert('url', 'http://localhost:3000').replace(/\/$/, '');
const PASSWORT = process.env.KONFI_DEMO_PASSWORT;
if (!PASSWORT) {
  console.error('KONFI_DEMO_PASSWORT ist nicht gesetzt. Vorher:');
  console.error('  source ~/.claude/secrets.env');
  process.exit(1);
}

// Fenstergrösse und -position. Schmal wie ein Handy, damit man sieht, was
// Konfis tatsächlich vor sich haben — drei davon passen nebeneinander.
const BREITE = 480;
const HOEHE = 900;
const ABSTAND = 30;

const ROLLEN = [
  { name: 'Leitung',   benutzer: 'demo.leitung', start: '/admin/konfis',      x: ABSTAND },
  { name: 'Teamer:in', benutzer: 'demo.teamer',  start: '/teamer/dashboard',  x: ABSTAND + BREITE + ABSTAND },
  { name: 'Konfi',     benutzer: 'demo.emilia',  start: '/konfi/dashboard',   x: ABSTAND + 2 * (BREITE + ABSTAND) },
];

async function fensterOeffnen({ name, benutzer, start, x }) {
  // Ein eigener Browser je Rolle, nicht nur ein eigener Kontext: Nur so
  // lässt sich das Fenster einzeln positionieren.
  const browser = await chromium.launch({
    headless: false,
    args: [`--window-position=${x},40`, `--window-size=${BREITE},${HOEHE}`],
  });
  const context = await browser.newContext({
    viewport: { width: BREITE - 20, height: HOEHE - 120 },
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  });
  const page = await context.newPage();

  await page.goto(`${BASIS}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('ion-input[placeholder="Dein Nutzername"] input').fill(benutzer);
  await page.locator('ion-input[placeholder="Dein Passwort"] input').fill(PASSWORT);
  await page.locator('ion-button.app-auth-button').click();
  await page.waitForURL(/\/(?:konfi|admin|teamer)\//, { timeout: 30_000 });
  await page.waitForTimeout(2000);

  // Onboarding-Overlay wegklicken, sonst verdeckt es die Ansicht.
  const ueberspringen = page.getByText('Überspringen').first();
  if (await ueberspringen.isVisible().catch(() => false)) {
    await ueberspringen.click().catch(() => {});
    await page.waitForTimeout(1200);
  }

  await page.goto(`${BASIS}${start}`, { waitUntil: 'domcontentloaded' });
  console.log(`  ${name.padEnd(10)} ${benutzer.padEnd(14)} ${BASIS}${start}`);
  return browser;
}

const browser = [];
console.log(`Drei Ansichten gegen ${BASIS}:\n`);
for (const rolle of ROLLEN) {
  try {
    browser.push(await fensterOeffnen(rolle));
  } catch (fehler) {
    console.error(`  ${rolle.name}: ${fehler.message.split('\n')[0]}`);
  }
}

console.log('\nFenster bleiben offen. Beenden mit Strg-C.');

// Offen halten, bis der Prozess beendet wird.
const zumachen = async () => {
  for (const b of browser) await b.close().catch(() => {});
  process.exit(0);
};
process.on('SIGINT', zumachen);
process.on('SIGTERM', zumachen);
await new Promise(() => {});
