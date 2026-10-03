import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

// Web-Version mit der Leiste links (Simon, 02.10.2026; planung/web-version.md,
// Entscheidungen 1 und 9): im Browser ab 992 px eine ein- und ausklappbare
// Leiste statt der Reiterleiste unten; darunter bleibt alles wie in den Apps.
//
// Die Unit-Tests (frontend/src/__tests__/navigation/seitenleiste.test.tsx)
// pruefen Aufbau und Verhalten in jsdom. Was jsdom nicht kann, steht hier:
// ob Ionics Split-Pane den Inhalt wirklich neben die Leiste legt, ob die
// Seite dabei sichtbar bleibt (keine weisse Seite beim Wechsel) und ob die
// Breite des Fensters umschaltet.
//
// Die Fensterbreite setzt jeder Test selbst -- die Vorgabe der anderen Specs
// (playwright.config.ts) liegt bewusst unter 992 px.

const LEISTE = { name: 'Hauptnavigation' } as const;

test.describe('Web-Version: Leiste links ab 992 px', () => {
  test('1280 px: Leiste links, keine Reiterleiste, Inhalt daneben', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'admin1');

    const leiste = page.getByRole('navigation', LEISTE);
    await expect(leiste).toBeVisible();
    await expect(page.locator('ion-tab-bar')).toHaveCount(0);

    // Der Inhalt steht rechts NEBEN der Leiste, nicht darunter.
    const leisteKasten = await leiste.boundingBox();
    const inhalt = page.locator('ion-content:visible').first();
    await expect(inhalt).toBeVisible();
    const inhaltKasten = await inhalt.boundingBox();
    expect(leisteKasten && inhaltKasten).toBeTruthy();
    expect(Math.round(inhaltKasten!.x)).toBeGreaterThanOrEqual(Math.round(leisteKasten!.x + leisteKasten!.width));
  });

  test('ein Klick in der Leiste wechselt die Seite, der Eintrag ist danach aktiv', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'admin1');
    const leiste = page.getByRole('navigation', LEISTE);

    for (const [name, pfad] of [['Chat', '/admin/chat'], ['Mitmachen', '/admin/events'], ['Konfis', '/admin/konfis']] as const) {
      const link = leiste.getByRole('link', { name: new RegExp(`^${name}`) });
      await link.click();
      // Pfad als Text, nicht als Muster: alle Sonderzeichen maskiert (CodeQL).
      await expect(page).toHaveURL(new RegExp(pfad.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')));
      await expect(link).toHaveAttribute('aria-current', 'page');
      // Nicht nur die Adresse: die Seite ist sichtbar (keine weisse Seite).
      await expect(page.locator('ion-content:visible').first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('einklappen und nach dem Neuladen eingeklappt', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'admin1');
    const leiste = page.getByRole('navigation', LEISTE);
    const breitAusgeklappt = (await leiste.boundingBox())!.width;

    await leiste.getByRole('button', { name: 'Leiste einklappen' }).click();
    await expect(leiste.getByRole('button', { name: 'Leiste ausklappen' })).toBeVisible();
    await expect.poll(async () => (await leiste.boundingBox())!.width).toBeLessThan(breitAusgeklappt);

    await page.reload();
    await expect(page.getByRole('navigation', LEISTE).getByRole('button', { name: 'Leiste ausklappen' })).toBeVisible();
  });

  test('Abmelden ueber die Leiste fuehrt zur Anmeldung', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'admin1');
    await page.getByRole('navigation', LEISTE).getByRole('button', { name: 'Abmelden' }).click();
    // Rueckfrage (ion-alert) bestaetigen.
    await page.locator('ion-alert button', { hasText: 'Abmelden' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Web-Version: Reiterleiste unter 992 px', () => {
  test('390 px: Reiterleiste unten wie in der App, keine Leiste', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, 'admin1');
    await expect(page.locator('ion-tab-bar')).toBeVisible();
    await expect(page.getByRole('navigation', LEISTE)).toHaveCount(0);
  });

  test('Fenster schmal ziehen: Reiterleiste statt Leiste, die Seite bleibt sichtbar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'teamer1');
    await expect(page.getByRole('navigation', LEISTE)).toBeVisible();

    await page.setViewportSize({ width: 800, height: 800 });
    await expect(page.locator('ion-tab-bar')).toBeVisible();
    await expect(page.getByRole('navigation', LEISTE)).toHaveCount(0);
    await expect(page.locator('ion-content:visible').first()).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole('navigation', LEISTE)).toBeVisible();
    await expect(page.locator('ion-tab-bar')).toHaveCount(0);
    await expect(page.locator('ion-content:visible').first()).toBeVisible();
  });
});
