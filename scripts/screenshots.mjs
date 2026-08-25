#!/usr/bin/env node
/**
 * Bildschirmfotos aus der Demo-Gemeinde (Organisation 4).
 *
 * Warum als Skript: Von Hand geschossene Bilder veralten mit jeder Änderung
 * an der Oberfläche, und niemand weiss hinterher, welcher Stand darauf zu
 * sehen war. Dieses Skript lässt sich jederzeit erneut laufen.
 *
 * Aufruf:
 *   node scripts/screenshots.mjs                    (gegen die Produktion)
 *   node scripts/screenshots.mjs --url http://localhost:5173
 *   node scripts/screenshots.mjs --rolle konfi      (nur eine Rolle)
 *   node scripts/screenshots.mjs --geraet ipad
 *
 * Ergebnis liegt in docs/screenshots/<geraet>/<rolle>-<name>.png
 *
 * Die Demo-Konten gehören zur Organisation 4. Organisation 1 ist eine echte
 * Gemeinde und wird hier bewusst nicht angefasst.
 */

import { chromium } from 'playwright';
import { mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const argWert = (name, standard) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : standard;
};

const BASIS = argWert('url', 'https://konfi-quest.de').replace(/\/$/, '');
const NUR_ROLLE = argWert('rolle', null);
const GERAET = argWert('geraet', 'iphone');
const PASSWORT = 'KonfiDemo2026!';

/** Bildschirmgrössen. Die iPhone-Grösse entspricht dem, was die Stores erwarten. */
const GERAETE = {
  iphone: { width: 393, height: 852, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  ipad: { width: 1024, height: 1366, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
};

/**
 * Was fotografiert wird. Bewusst je Rolle getrennt, weil jede Rolle einen
 * eigenen Komponentenbaum hat — ein Bild aus der Leitungsansicht sagt nichts
 * darüber, wie dieselbe Sache bei Konfis aussieht.
 */
const AUFNAHMEN = {
  leitung: {
    benutzer: 'demo.leitung',
    seiten: [
      { name: 'konfis', pfad: '/admin/konfis' },
      { name: 'mitmachen', pfad: '/admin/events' },
      { name: 'challenges', pfad: '/admin/challenges' },
      { name: 'abzeichen', pfad: '/admin/badges' },
      { name: 'chat', pfad: '/admin/chat' },
      { name: 'jahrgaenge', pfad: '/admin/settings/jahrgaenge' },
      { name: 'einstellungen', pfad: '/admin/settings' },
    ],
  },
  teamer: {
    benutzer: 'demo.teamer',
    seiten: [
      { name: 'startseite', pfad: '/teamer/dashboard' },
      { name: 'mitmachen', pfad: '/teamer/events' },
      { name: 'challenges', pfad: '/teamer/challenges' },
      { name: 'abzeichen', pfad: '/teamer/badges' },
      { name: 'chat', pfad: '/teamer/chat' },
      { name: 'profil', pfad: '/teamer/profile' },
    ],
  },
  konfi: {
    benutzer: 'demo.emilia',
    seiten: [
      { name: 'startseite', pfad: '/konfi/dashboard' },
      { name: 'mitmachen', pfad: '/konfi/events' },
      { name: 'challenges', pfad: '/konfi/challenges' },
      { name: 'abzeichen', pfad: '/konfi/badges' },
      { name: 'chat', pfad: '/konfi/chat' },
      { name: 'profil', pfad: '/konfi/profile' },
    ],
  },
};

async function anmelden(page, benutzer) {
  await page.goto(`${BASIS}/login`, { waitUntil: 'networkidle' });

  const nutzerfeld = page.locator('ion-input[placeholder="Dein Nutzername"] input');
  const passwortfeld = page.locator('ion-input[placeholder="Dein Passwort"] input');

  await nutzerfeld.waitFor({ state: 'visible', timeout: 20_000 });
  await nutzerfeld.fill(benutzer);
  await passwortfeld.fill(PASSWORT);
  await page.locator('ion-button.app-auth-button').click();

  await page.waitForURL(/\/(?:konfi|admin|teamer)\//, { timeout: 25_000 });
  await beruhigen(page);
}

/**
 * Warten, bis nichts mehr wackelt: Netz still, Ladebalken weg, Animationen
 * durch. Ohne das landen halb aufgebaute Listen auf den Bildern.
 */
async function beruhigen(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page
    .locator('ion-spinner, ion-skeleton-text')
    .first()
    .waitFor({ state: 'hidden', timeout: 8_000 })
    .catch(() => {});
  await page.waitForTimeout(900);
}

/** Overlays, die auf einem Bildschirmfoto nur stören. */
async function stoererSchliessen(page) {
  const knoepfe = [
    'ion-button:has-text("Schliessen")',
    'ion-button:has-text("Schließen")',
    'ion-button:has-text("Später")',
    'ion-button:has-text("Verstanden")',
  ];
  for (const auswahl of knoepfe) {
    const k = page.locator(auswahl).first();
    if (await k.isVisible().catch(() => false)) {
      await k.click().catch(() => {});
      await page.waitForTimeout(400);
    }
  }
}

async function main() {
  const geraet = GERAETE[GERAET];
  if (!geraet) {
    console.error(`Unbekanntes Geraet "${GERAET}". Moeglich: ${Object.keys(GERAETE).join(', ')}`);
    process.exit(1);
  }

  const rollen = NUR_ROLLE ? [NUR_ROLLE] : Object.keys(AUFNAHMEN);
  for (const r of rollen) {
    if (!AUFNAHMEN[r]) {
      console.error(`Unbekannte Rolle "${r}". Moeglich: ${Object.keys(AUFNAHMEN).join(', ')}`);
      process.exit(1);
    }
  }

  const ziel = join(WURZEL, 'docs', 'screenshots', GERAET);
  await rm(ziel, { recursive: true, force: true });
  await mkdir(ziel, { recursive: true });

  const browser = await chromium.launch();
  let geschossen = 0;
  let fehlend = 0;

  try {
    for (const rolle of rollen) {
      const { benutzer, seiten } = AUFNAHMEN[rolle];
      const context = await browser.newContext({
        viewport: { width: geraet.width, height: geraet.height },
        deviceScaleFactor: geraet.deviceScaleFactor,
        isMobile: geraet.isMobile,
        hasTouch: geraet.hasTouch,
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin',
      });
      const page = await context.newPage();

      try {
        console.log(`\n${rolle} (${benutzer}) anmelden ...`);
        await anmelden(page, benutzer);
        await stoererSchliessen(page);

        for (const seite of seiten) {
          const datei = join(ziel, `${rolle}-${seite.name}.png`);
          try {
            await page.goto(`${BASIS}${seite.pfad}`, { waitUntil: 'networkidle' });
            await beruhigen(page);
            await stoererSchliessen(page);
            await page.screenshot({ path: datei });
            console.log(`  ${rolle}-${seite.name}.png`);
            geschossen++;
          } catch (fehler) {
            console.error(`  FEHLT ${rolle}-${seite.name}: ${fehler.message.split('\n')[0]}`);
            fehlend++;
          }
        }
      } catch (fehler) {
        console.error(`  ${rolle} uebersprungen: ${fehler.message.split('\n')[0]}`);
        fehlend += seiten.length;
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n${geschossen} Bildschirmfotos in docs/screenshots/${GERAET}/`);
  if (fehlend > 0) {
    console.error(`${fehlend} nicht erstellt.`);
    process.exit(1);
  }
}

main().catch((fehler) => {
  console.error(fehler);
  process.exit(1);
});
