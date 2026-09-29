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
