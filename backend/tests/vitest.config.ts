import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    // maxWorkers MUSS 1 bleiben: alle 24 Suites teilen sich EINE Test-DB
    // (globalSetup) und seed.js nutzt FESTE IDs (organizations id=1/2, roles
    // id=1..). Parallele Worker wuerden sich per truncate+seed gegenseitig die
    // Daten ueberschreiben -> "duplicate key" / "FK not present". Echte
    // Parallelitaet braeuchte eine DB pro Worker (groesserer globalSetup-Umbau).
    // Der pg_advisory_xact_lock in truncateAll bleibt als Haertung (schadet nie).
    maxWorkers: 1,
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
