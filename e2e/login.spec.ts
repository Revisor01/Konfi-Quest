import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Login-Flow', () => {
  test('Konfi kann sich einloggen und sieht Dashboard', async ({ page }) => {
    await loginAs(page, 'konfi1');

    // Konfi wird zu /konfi/dashboard weitergeleitet
    await expect(page).toHaveURL(/\/konfi\/dashboard/);

    // Dashboard-Inhalt sichtbar (ion-content geladen)
    await expect(page.locator('ion-content')).toBeVisible();
  });

  test('Admin kann sich einloggen und sieht Admin-Bereich', async ({ page }) => {
    await loginAs(page, 'admin1');

    // Admin wird zu /admin/konfis weitergeleitet
    await expect(page).toHaveURL(/\/admin\//);

    // Admin-Inhalt sichtbar
    await expect(page.locator('ion-content')).toBeVisible();
  });

  test('Falsches Passwort zeigt Fehlermeldung', async ({ page }) => {
    await page.goto('/login');

    // Ionic 9 reicht `placeholder` nicht mehr an das ion-input-Element durch,
  // sondern nur noch an das innere <input> (DOM-Umstrukturierung, im
  // Migrationsguide fuer Input/Select/Textarea beschrieben). Der alte Selektor
  // `ion-input[placeholder="..."] input` fand deshalb nichts, und JEDER E2E-Test
  // scheiterte am Anmelden — die Seite selbst rendert einwandfrei, nachgemessen
  // am 30.08.2026 im Browser.
  //
  // Direkt auf dem inneren input gesucht: das funktioniert in Ionic 8 wie in 9.
  const usernameInput = page.locator('input[placeholder="Dein Nutzername"]');
    const passwordInput = page.locator('input[placeholder="Dein Passwort"]');

    await usernameInput.waitFor({ state: 'visible', timeout: 10_000 });
    await usernameInput.fill('konfi1');
    await passwordInput.fill('falschespasswort');

    await page.locator('ion-button.app-auth-button').click();

    // Fehlermeldung wird angezeigt
    await expect(page.locator('.app-auth-error')).toBeVisible({ timeout: 10_000 });

    // Fehlertext enthält relevante Meldung
    await expect(page.locator('.app-auth-error')).toContainText(/fehlgeschlagen|falsches passwort/i);

    // Bleibt auf Login-Seite
    await expect(page).toHaveURL(/\/login/);
  });
});
