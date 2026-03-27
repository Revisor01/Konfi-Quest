// backend/tests/globalTeardown.js — Test-DB droppen (standalone, fuer manuelle Nutzung)
// Vitest nutzt die Teardown-Funktion aus globalSetup.js (Return-Value).
// Diese Datei ist fuer manuelles Aufraeumen: node tests/globalTeardown.js
const { Pool } = require('pg');

const TEST_DB_NAME = 'konfi_test';
const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';

async function globalTeardown() {
  const adminPool = new Pool({ connectionString: ADMIN_URL });
  // Aktive Connections terminieren
  await adminPool.query(`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '${TEST_DB_NAME}' AND pid <> pg_backend_pid()
  `);
  await adminPool.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
  await adminPool.end();
  console.log(`[globalTeardown] Test-DB "${TEST_DB_NAME}" gedroppt`);
}

// Direkt aufrufbar oder als Modul
if (require.main === module) {
  globalTeardown().catch(err => {
    console.error('Teardown fehlgeschlagen:', err);
    process.exit(1);
  });
}

module.exports = globalTeardown;
