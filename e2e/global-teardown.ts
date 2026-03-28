// E2E Global Teardown: Docker-Compose Stack stoppen und aufraeumen
import { execSync } from 'child_process';

const COMPOSE_FILE = 'docker-compose.e2e.yml';

async function globalTeardown(): Promise<void> {
  console.log('E2E: Stoppe Docker-Compose Stack...');
  try {
    execSync(`docker compose -f ${COMPOSE_FILE} down -v`, {
      stdio: 'inherit',
      timeout: 60_000,
    });
    console.log('E2E: Teardown abgeschlossen');
  } catch (err) {
    console.error('E2E: Teardown fehlgeschlagen:', err);
  }
}

export default globalTeardown;
