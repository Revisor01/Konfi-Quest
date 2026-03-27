import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    globalSetup: ['./tests/globalSetup.js'],
    include: ['tests/**/*.test.{js,ts}'],
    env: {
      JWT_SECRET: 'test-secret-key-for-vitest',
      QR_SECRET: 'test-qr-secret-for-vitest',
      NODE_ENV: 'test',
      TEST_DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/postgres',
    },
    testTimeout: 10000,
  },
});
