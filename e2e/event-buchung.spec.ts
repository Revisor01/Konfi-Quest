import { test, expect } from '@playwright/test';
import { loginAs, abmelden } from './helpers/auth';

test.describe('Event-Buchung', () => {
  test('Konfi bucht Event, Buchung wird bestaetigt', async ({ page }) => {
    // Zwei Anmeldungen hintereinander.
    test.setTimeout(90_000);
    // 1. Als Konfi einloggen
    await loginAs(page, 'konfi1');

    // 2. Zur Event-Seite navigieren (Route: /konfi/events)
    await page.goto('/konfi/events');
    await page.waitForSelector('ion-content', { state: 'visible' });

    // 2b. Auf den Reiter "Alle" wechseln. Die Seite startet auf "Meine", und
    //     der zeigt NUR Termine, fuer die man schon angemeldet ist. Der
    //     Weihnachtsgottesdienst ist hier noch nicht gebucht — auf "Meine"
    //     ist die Liste also zu Recht leer. (Ursache der drei E2E-Fehler,
    //     geklaert 31.08.2026: Der Test suchte im falschen Reiter, die App
    //     war die ganze Zeit korrekt.)
    const reiterAlle = page.locator('ion-segment-button').filter({ hasText: 'Alle' });
    await reiterAlle.waitFor({ state: 'visible', timeout: 10_000 });
    await reiterAlle.click();

    // 3. Weihnachtsgottesdienst finden und oeffnen (Route: /konfi/events/:id)
    const eventItem = page.getByRole('button', { name: /Weihnachtsgottesdienst/i });
    await eventItem.waitFor({ state: 'visible', timeout: 10_000 });
    await eventItem.click();

    // 4. Event-Detailseite: Anmelden-Button klicken
    //    Button-Text: "Anmelden (X/50)" — app-action-button Klasse
    const registerBtn = page.locator('.app-action-button', { hasText: /Anmelden/i });
    await registerBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await registerBtn.click();

    // 5. Buchungsbestaetigung prüfen
    //    Nach erfolgreicher Anmeldung ändert sich der Status auf der Seite
    //    Entweder Toast oder Button wechselt zu "Abmelden"
    await expect(
      page.locator('ion-button, ion-toast, .app-action-button', { hasText: /Abmelden|Gebucht|Angemeldet/i })
    ).toBeVisible({ timeout: 10_000 });

    // 6. Zurück zur Event-Liste — der Termin steht jetzt auf "Meine".
    //    Bewusst NICHT auf "Alle" geprueft: Dass er dort steht, galt schon
    //    vor der Buchung. Nur "Meine" belegt, dass die Anmeldung ankam.
    await page.goto('/konfi/events');
    await page.waitForSelector('ion-content', { state: 'visible' });
    const eventEntry = page.getByRole('button', { name: /Weihnachtsgottesdienst/i });
    await expect(eventEntry).toBeVisible({ timeout: 10_000 });

    // 7. Die Buchung kommt bei der Leitung an (Audit Tests BF-09): In der
    //    Teilnehmerliste des Termins steht Test Konfi 1 als gebucht --
    //    nicht nur ein geaenderter Knopf in der eigenen Ansicht.
    await abmelden(page);
    await loginAs(page, 'admin1');
    await page.goto('/admin/events/1');
    const teilnahme = page.locator('.app-list-item').filter({ hasText: 'Test Konfi 1' });
    await expect(teilnahme).toHaveCount(1, { timeout: 15_000 });
    await expect(teilnahme.getByRole('img', { name: 'Gebucht' })).toBeVisible();
  });
});
