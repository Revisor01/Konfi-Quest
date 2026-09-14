import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Page } from '@playwright/test';

/**
 * Die Version, die der Browser-Build als laufende Version meldet.
 *
 * Gelesen aus derselben Datei, die vite.config.ts zur Bauzeit in
 * `__APP_VERSION__` einsetzt und die `scripts/apply-version.sh` pflegt --
 * NICHT hier noch einmal als Zahl hingeschrieben. Sonst zeigte die
 * Aenderungsanzeige beim naechsten Release wieder in jedem Test, und
 * irgendjemand muesste raten, warum.
 *
 * Ueber __dirname, NICHT ueber import.meta.url: Playwright uebersetzt die
 * Specs nach CommonJS, dort gibt es kein import.meta ("Cannot use
 * 'import.meta' outside a module" -- und zwar in JEDER Spec, die diesen
 * Helfer laedt).
 */
export const LAUFENDE_VERSION: string = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'frontend', 'version.json'), 'utf8')
).version;

// Auf 'major.minor' gekuerzt -- so vermerkt die App die zuletzt gesehene
// Version (utils/neuerungenGate.ts).
export const GESEHENE_MINOR: string = LAUFENDE_VERSION.split('.').slice(0, 2).join('.');

/**
 * Login-Helper für E2E Tests.
 *
 * Meldet an und bringt das Geraet danach in den Zustand "kennt die App
 * schon": Willkommens-Tour gesehen, laufende Version als gesehen vermerkt.
 * Beides sind Overlays, die sich ueber die ganze Seite legen -- ein Test, der
 * sie nicht wegraeumt, prueft nichts als sie selbst.
 *
 * Wer die Anzeigen SELBST pruefen will, nimmt `loginOhneMarker` (siehe unten)
 * und setzt danach gezielt, was stehen soll.
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

  await setzeAnzeigeMarker(page);
  await page.reload();
  await page.waitForSelector('ion-content', { state: 'visible', timeout: 10_000 });
}

/**
 * Meldet an, OHNE die Marker zu setzen -- das Geraet sieht danach aus wie
 * eines, das die App noch nie benutzt hat. Fuer Tests, die die Willkommens-
 * Tour oder die Aenderungsanzeige selbst pruefen.
 */
export async function loginOhneMarker(page: Page, username: string, password = 'testpasswort123') {
  await page.goto('/login');
  const usernameInput = page.locator('input[placeholder="Dein Nutzername"]');
  const passwordInput = page.locator('input[placeholder="Dein Passwort"]');
  await usernameInput.waitFor({ state: 'visible', timeout: 10_000 });
  await usernameInput.fill(username);
  await passwordInput.fill(password);
  await page.locator('ion-button.app-auth-button').click();
  await page.waitForURL(/\/(?:konfi|admin|teamer)\//, { timeout: 15_000 });
}

/**
 * Setzt die geraetelokalen Marker, die die beiden Vollbild-Overlays
 * unterdruecken. Beide legen sich ueber die ganze Seite und fangen jeden
 * Klick ab ("... subtree intercepts pointer events"):
 *
 * 1. Die WILLKOMMENS-TOUR beim ersten Start eines Accounts (Befund
 *    31.08.2026 im punkte-vergabe-Test).
 * 2. Die AENDERUNGSANZEIGE ("Was ist neu?") nach einem Update. Sie meldet
 *    sich seit 2.2.0 von selbst, sobald die laufende Minor-Version neuer ist
 *    als die vermerkte -- und ein Geraet ohne Vermerk gilt als
 *    Bestandsgeraet, also zeigt sie. Genau das legte am 14.09.2026 die
 *    E2E-Suite lahm.
 *
 * BEWUSST HIER und nicht im Produktionscode: Die Anzeige SOLL in Produktion
 * erscheinen. Eine Abfrage "wenn Test, dann nicht zeigen" im Hook waere eine
 * Sonderlogik, die man spaeter vergisst -- und die dann auch echte
 * Nutzer:innen trifft. Hier wird nur der Speicher so vorbelegt, wie er bei
 * jemandem aussieht, der die Anzeige schon gelesen hat.
 *
 * Der Nutzerdatensatz liegt unter CapacitorStorage.konfi_user — fuer ALLE
 * Rollen, historisch gewachsen (nachgemessen). Die Marker tragen die
 * Nutzer-ID im Schluessel, die vor dem Login nicht feststeht; deshalb erst
 * hinterher.
 */
export async function setzeAnzeigeMarker(page: Page) {
  await page.evaluate((minor) => {
    const roh = window.localStorage.getItem('CapacitorStorage.konfi_user');
    let id: string | number = 'x';
    try { id = roh ? JSON.parse(roh).id ?? 'x' : 'x'; } catch { /* Marker faellt auf 'x' zurueck */ }
    for (const rolle of ['admin_onboarding_seen', 'konfi_onboarding_seen', 'teamer_onboarding_seen']) {
      window.localStorage.setItem(`CapacitorStorage.${rolle}_${id}`, '1');
    }
    // Laufende Version gilt als gesehen -> die Aenderungsanzeige bleibt weg.
    window.localStorage.setItem(`CapacitorStorage.neuerungen_zuletzt_gesehen_${id}`, minor);
  }, GESEHENE_MINOR);
}
