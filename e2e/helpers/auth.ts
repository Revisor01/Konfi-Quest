import { Page } from '@playwright/test';

/**
 * Login-Helper für E2E Tests.
 * Navigiert zur Login-Seite, füllt Credentials aus und wartet auf Navigation.
 */
export async function loginAs(page: Page, username: string, password = 'testpasswort123') {
  await page.goto('/login');

  // Ionic ion-input: Placeholder-Text für Selektion nutzen
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
  await usernameInput.fill(username);
  await passwordInput.fill(password);

  // Button "Quest starten" klicken
  await page.locator('ion-button.app-auth-button').click();

  // Warten bis Login abgeschlossen (URL wechselt weg von /login)
  await page.waitForURL(/\/(?:konfi|admin|teamer)\//, { timeout: 15_000 });
}
