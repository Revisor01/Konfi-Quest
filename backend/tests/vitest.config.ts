import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    // Parallel moeglich, weil truncateAll per pg_advisory_xact_lock serialisiert
    // (kein "deadlock detected" mehr). 4 Forks bleiben unter dem Test-Pool max:5.
    maxWorkers: 4,
    minWorkers: 1,
    globals: true,
    globalSetup: ['./tests/globalSetup.js'],
    include: ['tests/**/*.test.{js,ts}'],
    env: {
      JWT_SECRET: 'test-secret-key-for-vitest',
      QR_SECRET: 'test-qr-secret-for-vitest',
      NODE_ENV: 'test',
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres',
    },
    testTimeout: 10000,
  },
});
