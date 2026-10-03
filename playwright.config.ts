import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // Keine Wiederholung (Audit Tests 26.09.2026, BF-09): Ein zweiter Versuch
  // verdeckt Flattern, statt es zu zeigen -- und die Suite ist Deploy-Gate.
  // Ein flatternder Test wird repariert, nicht wiederholt.
  retries: 0,
  workers: 1, // Sequentiell -- gleiche DB
  use: {
    baseURL: 'http://localhost:5556',
    // Unter 992 px (03.10.2026): Ab dieser Breite zeigt die Web-Version die
    // Leiste links statt der Reiterleiste unten. Die Specs bedienen die
    // Reiterleiste wie in den Apps; Playwrights Vorgabe (1280 x 720) laege
    // darueber. 960 statt Telefonbreite, damit sich sonst nichts aendert
    // (Ionics Dialog-Modale ab 768 px bleiben, wie sie waren). Die Leiste
    // selbst prueft seitenleiste.spec.ts mit eigener Fensterbreite.
    viewport: { width: 960, height: 720 },
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
});
