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
    setupFiles: ['./tests/setupTests.js'],
    include: ['tests/**/*.test.{js,ts}'],
    env: {
      // Europe/Berlin wie in den Prod-Containern (portainer-stack.yml,
      // deploy/compose.konfi_quest.yml). Bis zum 01.09.2026 stand hier 'UTC'
      // und traf damit die Produktion nur ZUFAELLIG: Die Container liefen
      // entgegen der Absicht ebenfalls in UTC, weil die Variable TZ im Stack
      // nur beim Datenbank-Dienst stand. Die Tests konnten die zwei Stunden
      // Versatz in Push- und E-Mail-Uhrzeiten deshalb nicht sehen.
      //
      // Der fruehere Kommentar begruendete UTC damit, event_date sei eine
      // naive TIMESTAMP-Spalte — das stimmt nicht: In Produktion ist sie
      // nachgemessen `timestamp with time zone`, und ein timestamptz kommt
      // durch jeden Roundtrip unabhaengig von der Prozess-Zeitzone unveraendert
      // zurueck.
      TZ: 'Europe/Berlin',
      JWT_SECRET: 'test-secret-key-for-vitest',
      QR_SECRET: 'test-qr-secret-for-vitest',
      // 64 Hex-Zeichen (32 Byte) — fester Testschluessel für Medien-Verschluesselung
      ACTIVITY_PHOTO_ENCRYPTION_KEY: '0000000000000000000000000000000000000000000000000000000000000000',
      // Passwort der API-Doku. Ohne die Variable bleibt die Doku bewusst
      // gesperrt — dann koennte der Test den erlaubten Fall nicht pruefen.
      DOCS_PASSWORD: 'test-docs-passwort',
      NODE_ENV: 'test',
      TEST_DATABASE_URL: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres',
    },
    testTimeout: 10000,
  },
});
