import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

// Etappe 1 des Ionic-9-Umbaus (30.08.2026): Absicherung VOR dem Umbau.
//
// Bis hierhin fasste kein Test das Routing an — bei 68 Routen ueber drei
// Rollenbaeume. Und Teamer:innen kamen in keiner einzigen E2E-Spec vor: Ein
// Drittel der Oberflaeche war ungetestet. Genau dort schlug am 29.08.2026 ein
// Fehler zu, der Teamer nach dem Login aussperrte.
//
// Diese Specs laufen gegen den heutigen Ionic-8-Stand und muessen nach dem
// Umstieg auf Ionic 9 unveraendert gruen bleiben. Sie pruefen Verhalten
// (welche URL, welcher Inhalt), nicht Schreibweise.

const TABS = {
  teamer: [
    ['teamer-dashboard', '/teamer/dashboard'],
    ['teamer-chat', '/teamer/chat'],
    // Reihenfolge und Inhalt wie in rollenBaeume.ts (04.09.2026): Challenges
    // vor Mitmachen, und Material statt Badges -- Badges liegen jetzt im
    // Profil, nicht mehr in der Tab-Leiste.
    ['teamer-challenges', '/teamer/challenges'],
    ['teamer-events', '/teamer/events'],
    ['teamer-material', '/teamer/profile/material'],
  ],
  konfi: [
    ['dashboard', '/konfi/dashboard'],
    ['chat', '/konfi/chat'],
    ['challenges', '/konfi/challenges'],
    ['events', '/konfi/events'],
    ['badges', '/konfi/badges'],
  ],
  admin: [
    ['admin-konfis', '/admin/konfis'],
    ['admin-chat', '/admin/chat'],
    ['admin-events', '/admin/events'],
    ['admin-challenges', '/admin/challenges'],
    ['admin-settings', '/admin/settings'],
  ],
} as const;

const NUTZER = { teamer: 'teamer1', konfi: 'konfi1', admin: 'admin1' } as const;

for (const [rolle, tabs] of Object.entries(TABS)) {
  test.describe(`Tab-Navigation: ${rolle}`, () => {
    test(`alle ${tabs.length} Tabs sind erreichbar und laden Inhalt`, async ({ page }) => {
      await loginAs(page, NUTZER[rolle as keyof typeof NUTZER]);

      for (const [tab, pfad] of tabs) {
        await page.locator(`ion-tab-button[tab="${tab}"]`).click();
        await expect(page).toHaveURL(new RegExp(pfad.replace(/\//g, '\\/')));
        // Nicht nur die URL: die Seite muss auch wirklich etwas rendern.
        //
        // NICHT .first(): Ionic haelt beim Tab-Wechsel mehrere Seiten im Stack,
        // die alten bleiben als verstecktes ion-content liegen. Das erste im
        // DOM ist deshalb oft ein altes. Gesucht ist das sichtbare — Playwright
        // wartet mit :visible darauf, dass die neue Seite oben liegt.
        await expect(page.locator('ion-content:visible').first()).toBeVisible({ timeout: 10_000 });
      }
    });

    test('die Tab-Leiste ist auf Tab-Seiten sichtbar', async ({ page }) => {
      await loginAs(page, NUTZER[rolle as keyof typeof NUTZER]);
      await expect(page.locator('ion-tab-bar')).toBeVisible();
    });
  });
}

test.describe('Zurueck-Navigation', () => {
  test('Konfi: Termin oeffnen und zurueck landet wieder in der Liste', async ({ page }) => {
    await loginAs(page, 'konfi1');
    await page.locator('ion-tab-button[tab="events"]').click();
    await expect(page).toHaveURL(/\/konfi\/events/);

    const reiterAlle = page.locator('ion-segment-button').filter({ hasText: 'Alle' });
    await reiterAlle.waitFor({ state: 'visible', timeout: 10_000 });
    await reiterAlle.click();

    const ersterTermin = page.getByRole('button', { name: /Weihnachtsgottesdienst/i });
    await ersterTermin.waitFor({ state: 'visible', timeout: 10_000 });
    await ersterTermin.click();
    await expect(page).toHaveURL(/\/konfi\/events\/\d+/, { timeout: 10_000 });

    await page.goBack();
    await expect(page).toHaveURL(/\/konfi\/events(?!\/\d)/);
  });
});
