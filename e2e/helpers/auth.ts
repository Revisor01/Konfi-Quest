import { Page } from '@playwright/test';

/**
 * Login-Helper für E2E Tests.
 * Navigiert zur Login-Seite, füllt Credentials aus und wartet auf Navigation.
 */
export async function loginAs(page: Page, username: string, password = 'testpasswort123') {
  await page.goto('/login');

  // Ionic ion-input: Placeholder-Text für Selektion nutzen
  const usernameInput = page.locator('ion-input[placeholder="Dein Nutzername"] input');
  const passwordInput = page.locator('ion-input[placeholder="Dein Passwort"] input');

  await usernameInput.waitFor({ state: 'visible', timeout: 10_000 });
  await usernameInput.fill(username);
  await passwordInput.fill(password);

  // Button "Quest starten" klicken
  await page.locator('ion-button.app-auth-button').click();

  // Warten bis Login abgeschlossen (URL wechselt weg von /login)
  await page.waitForURL(/\/(?:konfi|admin|teamer)\//, { timeout: 15_000 });
}
