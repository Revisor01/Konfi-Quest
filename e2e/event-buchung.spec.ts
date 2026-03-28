import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Event-Buchung', () => {
  test('Konfi bucht Event, Buchung wird bestaetigt', async ({ page }) => {
    // 1. Als Konfi einloggen
    await loginAs(page, 'konfi1');

    // 2. Zur Event-Seite navigieren (Route: /konfi/events)
    await page.goto('/konfi/events');
    await page.waitForSelector('ion-content', { state: 'visible' });

    // 3. Weihnachtsgottesdienst finden und oeffnen (Route: /konfi/events/:id)
    const eventItem = page.locator('ion-item, ion-card', { hasText: /Weihnachtsgottesdienst/i });
    await eventItem.waitFor({ state: 'visible', timeout: 10_000 });
    await eventItem.click();

    // 4. Event-Detailseite: Anmelden-Button klicken
    //    Button-Text: "Anmelden (X/50)" — app-action-button Klasse
    const registerBtn = page.locator('.app-action-button', { hasText: /Anmelden/i });
    await registerBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await registerBtn.click();

    // 5. Buchungsbestaetigung pruefen
    //    Nach erfolgreicher Anmeldung aendert sich der Status auf der Seite
    //    Entweder Toast oder Button wechselt zu "Abmelden"
    await expect(
      page.locator('ion-button, ion-toast, .app-action-button', { hasText: /Abmelden|Gebucht|Angemeldet/i })
    ).toBeVisible({ timeout: 10_000 });

    // 6. Zurueck zur Event-Liste — Event sichtbar
    await page.goto('/konfi/events');
    const eventEntry = page.locator('ion-item, ion-card', { hasText: /Weihnachtsgottesdienst/i });
    await expect(eventEntry).toBeVisible({ timeout: 10_000 });
  });
});
