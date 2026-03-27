import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    globals: true,
    globalSetup: ['./tests/globalSetup.js'],
    include: ['tests/**/*.test.{js,ts}'],
    env: {
      JWT_SECRET: 'test-secret-key-for-vitest',
      QR_SECRET: 'test-qr-secret-for-vitest',
      NODE_ENV: 'test',
      TEST_DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
    },
    testTimeout: 10000,
  },
});
