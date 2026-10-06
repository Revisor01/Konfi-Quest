import { test, expect, type Page } from '@playwright/test';
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

    // Je Eintrag die Ueberschrift, die nur auf der Zielseite steht.
    const ziele = [
      ['Chat', '/admin/chat', 'Chats'],
      ['Mitmachen', '/admin/events', 'Events'],
      ['Konfis', '/admin/konfis', 'Konfis'],
    ] as const;
    for (const [name, pfad, ueberschrift] of ziele) {
      const link = leiste.getByRole('link', { name: new RegExp(`^${name}`) });
      await link.click();
      // Pfad als Text, nicht als Muster: alle Sonderzeichen maskiert (CodeQL).
      await expect(page).toHaveURL(new RegExp(pfad.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')));
      await expect(link).toHaveAttribute('aria-current', 'page');
      // Nicht nur die Adresse: der Inhalt der Seite ist sichtbar (keine weisse
      // Seite). Bis 06.10.2026 stand hier ion-content -- die Web-Fassung des
      // Chats hat keines (Liste und Verlauf scrollen fuer sich), deshalb die
      // Ueberschrift der Zielseite selbst.
      await expect(page.getByRole('heading', { name: ueberschrift, exact: true }).first()).toBeVisible({ timeout: 10_000 });
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

// Gemeinde-Umschalter (Simon, 03.10.2026): „In der Webansicht ist der Switcher
// für die Org unten in der Navi, das finde ich gut, aber auch aktuell noch im
// Header, das finde ich doof." Im breiten Fenster steht er nur unten in der
// Leiste, in der App und im schmalen Fenster weiter in der Kopfzeile.
//
// Die Testkonten gehoeren je einer Gemeinde an, der Umschalter erscheint erst
// ab zwei. Deshalb meldet der Test die zweite Gemeinde selbst -- die Antwort
// auf GET /auth/my-organizations wird VOR dem Anmelden ersetzt; der Rest
// laeuft gegen den echten Server. Gewechselt wird hier nicht.
test.describe('Web-Version: Gemeinde-Umschalter bei mehreren Gemeinden', () => {
  const zweiGemeinden = async (page: Page) => {
    await page.route('**/api/auth/my-organizations', (route) => route.fulfill({
      json: [
        { id: 1, name: 'Test-Gemeinde', display_name: 'Kirchengemeinde Musterdorf', slug: 'musterdorf', role_name: 'admin', is_active: true, is_primary: true },
        { id: 2, name: 'Zweite Gemeinde', display_name: 'Kirchspiel Beispielstadt', slug: 'beispielstadt', role_name: 'teamer', is_active: true, is_primary: false },
      ],
    }));
  };

  test('1280 px: Umschalter unten in der Leiste, nicht in der Kopfzeile; die Liste klappt nach oben', async ({ page }) => {
    await zweiGemeinden(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'admin1');

    const leiste = page.getByRole('navigation', LEISTE);
    const knopf = leiste.getByRole('button', { name: /^Gemeinde wechseln/ });
    await expect(knopf).toBeVisible();
    await expect(knopf).toContainText('Kirchengemeinde Musterdorf');
    await expect(knopf).toContainText('Leitung');
    // Kein Knopf mehr in der Kopfzeile, auf keiner Seite.
    await expect(page.locator('ion-header .app-org-switcher-btn')).toHaveCount(0);

    await knopf.click();
    const liste = page.getByRole('menu', { name: 'Gemeinde wechseln' });
    await expect(liste).toBeVisible();
    await expect(liste.getByRole('menuitemradio')).toHaveCount(2);
    // Die Liste steht ueber dem Knopf, nicht darunter.
    const knopfKasten = (await knopf.boundingBox())!;
    const listenKasten = (await liste.boundingBox())!;
    expect(Math.round(listenKasten.y + listenKasten.height)).toBeLessThanOrEqual(Math.round(knopfKasten.y));

    // Escape schliesst und gibt den Fokus zurueck.
    await page.keyboard.press('Escape');
    await expect(liste).toHaveCount(0);
    await expect(knopf).toBeFocused();
  });

  test('eingeklappte Leiste: nur das Symbol, die Liste oeffnet sich daneben', async ({ page }) => {
    await zweiGemeinden(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAs(page, 'admin1');
    const leiste = page.getByRole('navigation', LEISTE);
    await leiste.getByRole('button', { name: 'Leiste einklappen' }).click();
    const knopf = leiste.getByRole('button', { name: /^Gemeinde wechseln/ });
    await expect(knopf).toBeVisible();
    await expect(knopf).toHaveAttribute('title', 'Kirchengemeinde Musterdorf');
    await expect(knopf.locator('.app-leistengemeinde__texte')).toBeHidden();

    await knopf.click();
    const liste = page.getByRole('menu', { name: 'Gemeinde wechseln' });
    await expect(liste).toBeVisible();
    // Rechts neben der Leiste, nicht von ihr abgeschnitten.
    const leistenKasten = (await leiste.boundingBox())!;
    const listenKasten = (await liste.boundingBox())!;
    expect(Math.round(listenKasten.x)).toBeGreaterThanOrEqual(Math.round(leistenKasten.x + leistenKasten.width));
  });

  test('390 px: Umschalter wie in der App in der Kopfzeile, keine Leiste', async ({ page }) => {
    await zweiGemeinden(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, 'admin1');
    await expect(page.locator('ion-header .app-org-switcher-btn').first()).toBeVisible();
    await expect(page.getByRole('navigation', LEISTE)).toHaveCount(0);
    await expect(page.locator('.app-leistengemeinde')).toHaveCount(0);
  });
});
