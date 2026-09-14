import { test, expect } from '@playwright/test';
import { loginOhneMarker, GESEHENE_MINOR } from './helpers/auth';

// Die Aenderungsanzeige ("Was ist neu?") meldet sich nach einem Update von
// selbst. Sie ist ein Vollbild-Overlay ueber der ganzen Seite und faengt
// jeden Klick ab -- wer sie nicht wieder loswird, kann die App nicht mehr
// bedienen.
//
// Alle anderen Specs raeumen sie im Login-Helper weg (setzeAnzeigeMarker).
// Hier wird sie ABSICHTLICH herbeigefuehrt: Das ist der Beleg, dass der
// Aufraeum-Schritt dort keine kaputte Anzeige verdeckt.
//
// Geprueft wird der Weg einer echten Bestandsnutzerin nach dem Update:
// Sie hat die App schon benutzt (Onboarding-Marker steht), aber noch keinen
// Versionsvermerk -- genau der Fall, fuer den die Anzeige gebaut ist.

// Die App merkt sich beides geraetelokal ueber Capacitor Preferences, im
// Browser also localStorage. Die Schluessel tragen die Nutzer-ID, die erst
// nach dem Login feststeht.
async function alsBestandsgeraetMarkieren(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const roh = window.localStorage.getItem('CapacitorStorage.konfi_user');
    let id: string | number = 'x';
    try { id = roh ? JSON.parse(roh).id ?? 'x' : 'x'; } catch { /* faellt auf 'x' zurueck */ }
    for (const rolle of ['admin_onboarding_seen', 'konfi_onboarding_seen', 'teamer_onboarding_seen']) {
      window.localStorage.setItem(`CapacitorStorage.${rolle}_${id}`, '1');
    }
    // KEIN Versionsvermerk: Das ist ein Geraet, das die App vor diesem
    // Release benutzt hat.
    window.localStorage.removeItem(`CapacitorStorage.neuerungen_zuletzt_gesehen_${id}`);
  });
}

function vermerkLesen(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const roh = window.localStorage.getItem('CapacitorStorage.konfi_user');
    let id: string | number = 'x';
    try { id = roh ? JSON.parse(roh).id ?? 'x' : 'x'; } catch { /* faellt auf 'x' zurueck */ }
    return window.localStorage.getItem(`CapacitorStorage.neuerungen_zuletzt_gesehen_${id}`);
  });
}

const OVERLAY = '.konfi-onboarding-content';

test.describe('Aenderungsanzeige nach einem Update', () => {
  test('meldet sich von selbst und laesst sich durchklicken und schliessen', async ({ page }) => {
    await loginOhneMarker(page, 'konfi1');
    await alsBestandsgeraetMarkieren(page);
    await page.reload();

    // 1. Sie kommt von selbst (mit 400 ms Versatz, damit die Seite erst rendert).
    const overlay = page.locator(OVERLAY);
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    // 2. Sie laesst sich durchklicken: Der Knopf heisst bis zur letzten Karte
    //    "Weiter" und dort "Los geht's!". Mehr als zehn Karten hat keine
    //    Fassung -- die Schleife darf also nicht endlos laufen.
    let klicks = 0;
    while (klicks < 10) {
      const weiter = overlay.locator('ion-button', { hasText: 'Weiter' });
      if (await weiter.count() === 0) break;
      await weiter.click();
      klicks++;
    }
    expect(klicks).toBeGreaterThan(0);

    // 3. Die letzte Karte traegt den Abschluss-Knopf.
    const losGehts = overlay.locator('ion-button', { hasText: /Los geht/ });
    await expect(losGehts).toBeVisible({ timeout: 5_000 });
    await losGehts.click();

    // 4. Danach ist sie weg -- und die Seite wieder bedienbar.
    await expect(overlay).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator('ion-content:visible').first()).toBeVisible();

    // 5. Die laufende Version ist als gesehen vermerkt.
    await expect.poll(() => vermerkLesen(page), { timeout: 5_000 }).toBe(GESEHENE_MINOR);
  });

  test('bleibt nach dem Schliessen weg -- auch beim Tab-Wechsel hin und zurueck', async ({ page }) => {
    // Der Fehler, der die Suite lahmlegte, hatte eine zweite Haelfte: Der
    // Vermerk wird ASYNCHRON geschrieben, das Betreten der Seite feuert aber
    // bei JEDEM Tab-Wechsel. Wer die Anzeige wegklickte und sofort weiter- und
    // zuruecktippte, bekam sie wieder -- beliebig oft.
    await loginOhneMarker(page, 'konfi1');
    await alsBestandsgeraetMarkieren(page);
    await page.reload();

    const overlay = page.locator(OVERLAY);
    await expect(overlay).toBeVisible({ timeout: 10_000 });

    // Ueberspringen ist der kurze Weg raus (steht auf jeder Karte ausser der
    // letzten) -- und der Weg, den die meisten nehmen.
    await overlay.locator('ion-button', { hasText: 'Überspringen' }).click();
    await expect(overlay).toHaveCount(0, { timeout: 5_000 });

    // SOFORT weiter und zurueck, ohne Wartezeit: Der Vermerk steht womoeglich
    // noch nicht.
    await page.locator('ion-tab-button[tab="chat"]').click();
    await expect(page).toHaveURL(/\/konfi\/chat/);
    await page.locator('ion-tab-button[tab="dashboard"]').click();
    await expect(page).toHaveURL(/\/konfi\/dashboard/);

    // Lange genug warten, dass sie sich gemeldet HAETTE (400 ms Versatz).
    await page.waitForTimeout(2_000);
    await expect(overlay).toHaveCount(0);

    // Und die Seite nimmt wieder Klicks an -- der eigentliche Punkt.
    await expect(page.locator('ion-tab-button[tab="badges"]')).toBeEnabled();
    await page.locator('ion-tab-button[tab="badges"]').click();
    await expect(page).toHaveURL(/\/konfi\/badges/);
  });
});
