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

    const usernameInput = page.locator('ion-input[placeholder="Dein Nutzername"] input');
    const passwordInput = page.locator('ion-input[placeholder="Dein Passwort"] input');

    await usernameInput.waitFor({ state: 'visible', timeout: 10_000 });
    await usernameInput.fill('konfi1');
    await passwordInput.fill('falschespasswort');

    await page.locator('ion-button.app-auth-button').click();

    // Fehlermeldung wird angezeigt
    await expect(page.locator('.app-auth-error')).toBeVisible({ timeout: 10_000 });

    // Fehlertext enthaelt relevante Meldung
    await expect(page.locator('.app-auth-error')).toContainText(/fehlgeschlagen|falsches passwort/i);

    // Bleibt auf Login-Seite
    await expect(page).toHaveURL(/\/login/);
  });
});
