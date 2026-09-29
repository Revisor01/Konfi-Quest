import { test, expect } from '@playwright/test';
import { loginAs, abmelden, punkteStand } from './helpers/auth';

// Der ganze Weg eines Antrags (Audit Tests 26.09.2026, BF-09): Eine Konfi
// meldet eine Aktivitaet, die Leitung genehmigt sie, die Konfi sieht genau
// deren Punkte auf dem Dashboard.
//
// Mit konfi2 statt konfi1, damit die Punkte-Specs sich nicht gegenseitig die
// Ausgangszahlen verschieben (alle Specs teilen eine Datenbank).
test.describe('Antrag stellen und freigeben', () => {
  test('Konfi meldet das Gemeindefest, Leitung genehmigt, Konfi hat 2 Gemeinde-Punkte mehr', async ({ page }) => {
    // Drei Anmeldungen hintereinander.
    test.setTimeout(150_000);

    // 1. Konfi: Stand vorher, dann die Aktivitaet melden.
    await loginAs(page, 'konfi2');
    await expect(page).toHaveURL(/\/konfi\/dashboard/);
    const gemeindeVorher = await punkteStand(page, 'Gemeinde');
    const gottesdienstVorher = await punkteStand(page, 'Gottesdienst');

    await page.goto('/konfi/events?segment=antraege');
    await page.getByRole('button', { name: 'Neue Aktivität melden' }).click();
    await page.getByText('Aktivität auswählen').click();
    const gemeindefest = page.locator('.app-list-item').filter({ hasText: 'Gemeindefest' });
    await gemeindefest.waitFor({ state: 'visible', timeout: 10_000 });
    await gemeindefest.click();
    await page.getByRole('button', { name: 'Aktivität absenden' }).click();

    // Ohne Foto fragt die App nach -- bewusst weiter ohne.
    const ohneFoto = page.locator('ion-alert button', { hasText: 'Ohne Foto fortfahren' });
    await ohneFoto.waitFor({ state: 'visible', timeout: 10_000 });
    await ohneFoto.click();

    // Das Formular ist zu, der Antrag steht in der eigenen Liste (Reiter "Offen").
    await expect(page.getByRole('button', { name: 'Aktivität absenden' })).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('.app-list-item').filter({ hasText: 'Gemeindefest' })).toHaveCount(1, { timeout: 10_000 });
    // Noch keine Punkte, solange niemand entschieden hat.
    await abmelden(page);

    // 2. Leitung: Antrag oeffnen und genehmigen.
    await loginAs(page, 'admin1');
    await page.goto('/admin/events?segment=antraege');
    const antrag = page.locator('.app-list-item').filter({ hasText: 'Test Konfi 2' }).filter({ hasText: 'Gemeindefest' });
    await antrag.waitFor({ state: 'visible', timeout: 15_000 });
    await antrag.click();
    await page.locator('ion-button', { hasText: 'Genehmigen' }).click();
    const speichern = page.getByRole('button', { name: 'Entscheidung speichern' });
    await speichern.click();
    await expect(speichern).toBeHidden({ timeout: 15_000 });
    await abmelden(page);

    // 3. Konfi: genau die 2 Punkte des Gemeindefests, Gottesdienst unveraendert.
    await loginAs(page, 'konfi2');
    await expect(page).toHaveURL(/\/konfi\/dashboard/);
    await expect.poll(() => punkteStand(page, 'Gemeinde'), { timeout: 10_000 }).toBe(gemeindeVorher + 2);
    expect(await punkteStand(page, 'Gottesdienst')).toBe(gottesdienstVorher);

    // Und der Antrag steht bei ihr unter "Angerechnet", nicht mehr unter "Offen".
    await page.goto('/konfi/events?segment=antraege');
    await page.locator('ion-segment-button', { hasText: 'Angerechnet' }).click();
    await expect(page.locator('.app-list-item').filter({ hasText: 'Gemeindefest' })).toHaveCount(1, { timeout: 10_000 });
    await page.locator('ion-segment-button', { hasText: 'Offen' }).click();
    await expect(page.locator('.app-list-item').filter({ hasText: 'Gemeindefest' })).toHaveCount(0, { timeout: 10_000 });
  });
});
