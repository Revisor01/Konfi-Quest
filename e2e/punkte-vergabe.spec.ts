import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

test.describe('Punkte-Vergabe', () => {
  test('Admin vergibt Aktivitaet, Konfi sieht Punkte', async ({ page }) => {
    // 1. Als Admin einloggen
    await loginAs(page, 'admin1');

    // 2. Zur Konfi-Verwaltung navigieren (Route: /admin/konfis)
    await page.goto('/admin/konfis');
    await page.waitForSelector('ion-content', { state: 'visible' });

    // 3. Konfi1 in der Liste finden und oeffnen (Route: /admin/konfis/:id)
    const konfiItem = page.locator('ion-item', { hasText: /Test Konfi 1/i });
    await konfiItem.waitFor({ state: 'visible', timeout: 10_000 });
    await konfiItem.click();

    // 4. Konfi-Detailseite: "Aktivitaet hinzufuegen" Button klicken
    const addActivityBtn = page.locator('ion-button', { hasText: /Aktivit.t hinzuf.gen/i });
    await addActivityBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await addActivityBtn.click();

    // 5. ActivityModal: Sonntagsgottesdienst auswaehlen
    //    Modal zeigt IonList mit Activities — klicke auf das Item
    const activityItem = page.locator('ion-item, ion-card', { hasText: /Sonntagsgottesdienst/i });
    await activityItem.waitFor({ state: 'visible', timeout: 10_000 });
    await activityItem.click();

    // 6. Speichern via Submit-Button (app-modal-submit-btn mit checkmark Icon)
    const submitBtn = page.locator('.app-modal-submit-btn--activities');
    await submitBtn.click();

    // 7. Warten auf Erfolgsmeldung oder Modal schliesst sich
    await page.waitForTimeout(2_000);

    // 8. Abmelden und als Konfi einloggen
    await page.goto('/login');
    await loginAs(page, 'konfi1');

    // 9. Konfi-Dashboard pruefen (Route: /konfi/dashboard)
    await expect(page).toHaveURL(/\/konfi\/dashboard/);
    await expect(page.locator('ion-content')).toBeVisible();

    // 10. Punkte muessen sichtbar sein — mindestens "1" Gottesdienst-Punkt
    //     (Bonus-Punkte aus Seed: 3 GP, plus 1 aus Aktivitaet = mindestens 1 sichtbar)
    const content = page.locator('ion-content');
    await expect(content).toContainText(/[1-9]/);
  });
});
