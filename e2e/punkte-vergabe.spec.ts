import { test, expect } from '@playwright/test';
import { loginAs, abmelden, punkteStand } from './helpers/auth';

// Die Leitung verbucht eine Aktivitaet, die Konfi sieht GENAU diesen Punkt.
//
// Bis zum 29.09.2026 pruefte der Test am Ende nur `toContainText(/[1-9]/)` --
// jede Ziffer irgendwo auf dem Dashboard genuegte, etwa im Jahrgangsnamen
// "2025/2026". Er waere auch bei null vergebenen Punkten gruen gewesen (Audit
// Tests 26.09.2026, BF-09). Jetzt: Stand vorher lesen, verbuchen, Stand
// nachher lesen -- der Sonntagsgottesdienst bringt genau 1 Gottesdienst-Punkt,
// Gemeinde bleibt, wie sie war.
//
// Der Seed startet bei 0/0: Er schreibt zwar 3 Bonuspunkte in bonus_points,
// aber an den Summen in konfi_profiles vorbei, die das Dashboard liest (in
// der App fuehrt jeder Schreibweg die Summe mit). Die Annahme "3 + 1 = 4" aus
// dem Audit traf deshalb nicht zu (nachgemessen 29.09.2026).
test.describe('Punkte-Vergabe', () => {
  test('Admin vergibt Aktivitaet, Konfi sieht Punkte', async ({ page }) => {
    // Drei Anmeldungen hintereinander -- mehr als die 30 s der Voreinstellung.
    test.setTimeout(120_000);

    // 0. Stand vorher, wie ihn die Konfi sieht.
    await loginAs(page, 'konfi1');
    await expect(page).toHaveURL(/\/konfi\/dashboard/);
    const gottesdienstVorher = await punkteStand(page, 'Gottesdienst');
    const gemeindeVorher = await punkteStand(page, 'Gemeinde');
    // Frischer Seed: 0 und 0 (siehe oben).
    expect(gottesdienstVorher).toBe(0);
    expect(gemeindeVorher).toBe(0);
    await abmelden(page);

    // 1. Als Admin einloggen
    await loginAs(page, 'admin1');

    // 2. Zur Konfi-Verwaltung navigieren (Route: /admin/konfis)
    await page.goto('/admin/konfis');
    await page.waitForSelector('ion-content', { state: 'visible' });

    // 3. Konfi1 in der Liste finden und oeffnen (Route: /admin/konfis/:id)
    const konfiItem = page.getByRole('button', { name: /Test Konfi 1/i });
    await konfiItem.waitFor({ state: 'visible', timeout: 10_000 });
    await konfiItem.click();

    // 4. Konfi-Detailseite: "Aktivität hinzufuegen" Button klicken
    const addActivityBtn = page.locator('ion-button', { hasText: /Aktivit.t hinzuf.gen/i });
    await addActivityBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await addActivityBtn.click();

    // 5. ActivityModal: Sonntagsgottesdienst auswählen -- im Formular, nicht in
    //    der Liste der schon verbuchten Aktivitaeten dahinter.
    const activityItem = page.locator('ion-modal .app-list-item').filter({ hasText: /Sonntagsgottesdienst/i });
    await activityItem.waitFor({ state: 'visible', timeout: 10_000 });
    await activityItem.scrollIntoViewIfNeeded();
    await activityItem.click();

    // 6. Speichern -- und warten, bis das Formular zu ist (statt fester 2 s).
    const submitBtn = page.locator('.app-modal-submit-btn--activities');
    await submitBtn.click();
    await expect(submitBtn).toBeHidden({ timeout: 15_000 });

    // 7. Abmelden und als Konfi einloggen.
    await abmelden(page);
    await loginAs(page, 'konfi1');
    await expect(page).toHaveURL(/\/konfi\/dashboard/);

    // 8. Genau ein Gottesdienst-Punkt mehr (0 -> 1), Gemeinde unveraendert.
    await expect.poll(() => punkteStand(page, 'Gottesdienst'), { timeout: 10_000 }).toBe(gottesdienstVorher + 1);
    expect(await punkteStand(page, 'Gottesdienst')).toBe(1);
    expect(await punkteStand(page, 'Gemeinde')).toBe(gemeindeVorher);
  });
});
