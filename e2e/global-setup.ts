// E2E Global Setup: Docker-Compose Stack starten + DB seeden
import { execSync } from 'child_process';
import { Pool } from 'pg';
import { chromium } from '@playwright/test';

const COMPOSE_FILE = 'docker-compose.e2e.yml';
const BACKEND_URL = 'http://localhost:5555/api/health';
const DB_URL = 'postgresql://postgres:postgres@localhost:5444/postgres';
const MAX_WAIT_MS = 90_000;
const FRONTEND_LOGIN_URL = 'http://localhost:5556/login';

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

// Aufwaermen (09.10.2026): Der erste Test nach dem Start des Stacks sah
// mehrfach eine weisse Seite und fand die Anmeldung nicht (CI 37849897713,
// 37938814113 zweimal hintereinander) -- Backend gesund, Frontend noch nicht
// soweit. Deshalb einmal im Browser die Anmeldeseite laden, bis das Feld
// steht, bevor der erste Test laeuft. Kein retries im Test: Das hier misst die
// Umgebung, nicht die App.
async function waitForFrontend(): Promise<void> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const start = Date.now();
    let letzterFehler: unknown = null;
    while (Date.now() - start < MAX_WAIT_MS) {
      try {
        await page.goto(FRONTEND_LOGIN_URL, { waitUntil: 'load', timeout: 15_000 });
        await page.locator('input[placeholder="Dein Nutzername"]').waitFor({ state: 'visible', timeout: 10_000 });
        console.log(`E2E: Anmeldeseite nach ${Math.round((Date.now() - start) / 1000)} s bereit`);
        return;
      } catch (e) {
        letzterFehler = e;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
    throw new Error(`Anmeldeseite nicht bereit nach ${MAX_WAIT_MS / 1000}s: ${String(letzterFehler)}`);
  } finally {
    await browser.close();
  }
}

async function seedDatabase(): Promise<void> {
  const { seed } = require('../backend/tests/helpers/seed.js');
  const pool = new Pool({ connectionString: DB_URL });
  try {
    await seed(pool);

    // Die Admins brauchen fuer die Oberflaeche eine Jahrgangs-Zuweisung:
    // GET /admin/konfis verengt ueber die einsehbaren Jahrgaenge und liefert
    // einem Admin OHNE Zuweisung bewusst eine leere Liste (Simons
    // Entscheidung 26.08.2026, erkennbar am Header
    // X-Kein-Jahrgang-Zugewiesen). Ohne diese Zeilen sah der E2E-Test eine
    // leere Konfi-Verwaltung und meldete einen Fehler, den es in der App
    // nicht gibt (geklaert 31.08.2026).
    //
    // BEWUSST HIER und nicht im gemeinsamen Seed: Die Backend-Tests pruefen
    // genau den Fall "Admin ohne Zuweisung" und wuerden reihenweise
    // fehlschlagen (nachgemessen: 92 gruen ohne, 140 rot mit der Aenderung
    // im Seed).
    await pool.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id)
       VALUES (4, 1), (8, 2)
       ON CONFLICT DO NOTHING`
    );

    console.log('E2E: Datenbank erfolgreich geseeded');
  } finally {
    await pool.end();
  }
}

async function globalSetup(): Promise<void> {
  console.log('E2E: Starte Docker-Compose Stack...');
  // 180 s reichten nicht: Der Frontend-Container baut die komplette App
  // (npm ci + vite build), und allein das dauert auf einem kalten Cache
  // laenger. Gemessen am 30.08.2026 — der Lauf brach mit ETIMEDOUT ab, BEVOR
  // je ein Test lief. Zusammen mit der fehlenden Schema-Einspielung war das
  // der Grund, warum die E2E-Specs faktisch nie durchliefen.
  execSync(`docker compose -f ${COMPOSE_FILE} up -d --build --wait`, {
    stdio: 'inherit',
    timeout: 900_000,
  });

  console.log('E2E: Warte auf Backend Health...');
  await waitForBackend();

  console.log('E2E: Seede Datenbank...');
  await seedDatabase();

  console.log('E2E: Waerme die Anmeldeseite auf...');
  await waitForFrontend();

  console.log('E2E: Setup abgeschlossen');
}

export default globalSetup;
