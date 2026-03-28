// E2E Global Setup: Docker-Compose Stack starten + DB seeden
import { execSync } from 'child_process';
import { Pool } from 'pg';

const COMPOSE_FILE = 'docker-compose.e2e.yml';
const BACKEND_URL = 'http://localhost:5555/api/health';
const DB_URL = 'postgresql://postgres:postgres@localhost:5444/postgres';
const MAX_WAIT_MS = 90_000;

async function waitForBackend(): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    try {
      const res = await fetch(BACKEND_URL);
      if (res.ok) return;
    } catch {
      // Backend noch nicht bereit
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Backend nicht erreichbar nach ${MAX_WAIT_MS / 1000}s`);
}

async function seedDatabase(): Promise<void> {
  const { seed } = require('../backend/tests/helpers/seed.js');
  const pool = new Pool({ connectionString: DB_URL });
  try {
    await seed(pool);
    console.log('E2E: Datenbank erfolgreich geseeded');
  } finally {
    await pool.end();
  }
}

async function globalSetup(): Promise<void> {
  console.log('E2E: Starte Docker-Compose Stack...');
  execSync(`docker compose -f ${COMPOSE_FILE} up -d --build --wait`, {
    stdio: 'inherit',
    timeout: 180_000,
  });

  console.log('E2E: Warte auf Backend Health...');
  await waitForBackend();

  console.log('E2E: Seede Datenbank...');
  await seedDatabase();

  console.log('E2E: Setup abgeschlossen');
}

export default globalSetup;
