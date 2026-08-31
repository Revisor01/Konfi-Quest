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

  // Die Willkommens-Tour legt sich beim ERSTEN Start eines Accounts als
  // Overlay ueber die Seite und faengt alle Klicks ab ("... subtree intercepts
  // pointer events", Befund 31.08.2026 im punkte-vergabe-Test). Sie merkt sich
  // ihren Marker ueber Capacitor Preferences, im Browser also localStorage.
  //
  // Der Nutzerdatensatz liegt unter CapacitorStorage.konfi_user — fuer ALLE
  // Rollen, historisch gewachsen (nachgemessen).
  //
  // Der Marker wird hier NACH dem Login gesetzt: Er traegt die Nutzer-ID im
  // Schluessel, die vorher nicht feststeht. Damit stolpert kein Test mehr
  // ueber die Tour — wer sie PRUEFEN will, setzt den Marker vorher wieder
  // zurueck.
  await page.evaluate(() => {
    const roh = window.localStorage.getItem('CapacitorStorage.konfi_user');
    let id: string | number = 'x';
    try { id = roh ? JSON.parse(roh).id ?? 'x' : 'x'; } catch { /* Marker faellt auf 'x' zurueck */ }
    for (const rolle of ['admin_onboarding_seen', 'konfi_onboarding_seen', 'teamer_onboarding_seen']) {
      window.localStorage.setItem(`CapacitorStorage.${rolle}_${id}`, '1');
    }
  });
  await page.reload();
  await page.waitForSelector('ion-content', { state: 'visible', timeout: 10_000 });
}
