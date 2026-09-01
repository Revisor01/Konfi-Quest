import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

// Etappe 1 des Ionic-9-Umbaus (30.08.2026).
//
// Push-Nachrichten navigieren per window.location.href (AppContext.tsx:765,
// "Hard navigation (intentional)") — also durch einen echten URL-Aufruf, genau
// wie hier. Bricht eine dieser URLs beim Router-Umbau, laufen BEREITS
// VERSCHICKTE Push-Nachrichten ins Leere. Die lassen sich nicht zurueckrufen.
//
// Besonders die drei /requests-Umleitungen: Sie stammen aus der Zeit vor dem
// Umbau auf Segmente und existieren nur noch, weil alte Push-Nachrichten sie
// ansprechen.

const ZIELE = {
  konfi1: ['/konfi/dashboard', '/konfi/events', '/konfi/badges', '/konfi/chat', '/konfi/profile'],
  teamer1: ['/teamer/dashboard', '/teamer/events', '/teamer/badges', '/teamer/chat', '/teamer/material'],
  admin1: ['/admin/konfis', '/admin/events', '/admin/chat', '/admin/challenges', '/admin/settings'],
} as const;

for (const [nutzer, pfade] of Object.entries(ZIELE)) {
  test.describe(`Direktaufruf tiefer URLs: ${nutzer}`, () => {
    for (const pfad of pfade) {
      test(`${pfad} laedt direkt`, async ({ page }) => {
        await loginAs(page, nutzer);
        await page.goto(pfad);
        await expect(page).toHaveURL(new RegExp(pfad.replace(/\//g, '\\/')));
        await expect(page.locator('ion-content').first()).toBeVisible({ timeout: 10_000 });
      });
    }
  });
}

test.describe('Alte Push-Ziele leiten weiter', () => {
  const UMLEITUNGEN = [
    ['konfi1', '/konfi/requests', /\/konfi\/events/],
    ['teamer1', '/teamer/requests', /\/teamer\/events/],
    ['admin1', '/admin/requests', /\/admin\/events/],
  ] as const;

  for (const [nutzer, von, nach] of UMLEITUNGEN) {
    test(`${von} landet auf der Mitmachen-Seite`, async ({ page }) => {
      await loginAs(page, nutzer);
      await page.goto(von);
      await expect(page).toHaveURL(nach, { timeout: 10_000 });
    });
  }
});

test.describe('Unbekannte URL fuehrt nicht auf eine weisse Seite', () => {
  test('abgemeldet landet man auf der Anmeldung', async ({ page }) => {
    // Nach dem Abmelden steht die URL noch auf einer Rollen-Route. Ohne den
    // Catch-all in App.tsx matcht im Login-Outlet keine Route -> weisse Seite.
    await page.goto('/admin/organizations');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
