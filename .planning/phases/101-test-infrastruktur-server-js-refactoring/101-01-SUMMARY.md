---
phase: 101-test-infrastruktur-server-js-refactoring
plan: 01
subsystem: infra, testing
tags: [vitest, supertest, express, createApp, docker, postgres]

requires:
  - phase: none
    provides: bestehende server.js mit 591 Zeilen monolithischem Server-Setup
provides:
  - createApp(db, options) Factory fuer seiteneffektfreie Express-App
  - Vitest Backend-Config mit sequentieller Ausfuehrung (singleFork)
  - docker-compose.test.yml fuer Test-DB (postgres:16-alpine, Port 5433)
  - npm test/test:ci/test:watch Scripts
affects: [101-02, 101-03, alle zukuenftigen Test-Plans]

tech-stack:
  added: [vitest 4.1.2, supertest 7.2.2]
  patterns: [createApp Factory Pattern, Dummy-Objekte fuer io/transporter in Tests]

key-files:
  created:
    - backend/createApp.js
    - backend/tests/vitest.config.ts
    - backend/docker-compose.test.yml
    - backend/tests/globalSetup.js
  modified:
    - backend/server.js
    - backend/package.json

key-decisions:
  - "createApp Factory: Express-App ohne Seiteneffekte, server.js als Wrapper"
  - "http.createServer() ohne Argument, dann server.on('request', app) nach createApp"
  - "Rate-Limiters nur wenn uebergeben (if-Guards statt Pflicht)"
  - "QR_SECRET in Vitest env (Top-Level Guard in Routes)"

patterns-established:
  - "createApp(db, options) Pattern: Tests rufen createApp(testDb) fuer supertest"
  - "Dummy-Objekte: io und transporter defaults in createApp fuer Tests"

requirements-completed: [INF-01, INF-06, INF-03]

duration: 6min
completed: 2026-03-27
---

# Phase 101 Plan 01: createApp Factory + Vitest-Infrastruktur Summary

**server.js in createApp-Factory refactored (364 neue Zeilen) + Vitest/supertest/docker-compose.test.yml aufgesetzt**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-27T12:15:49Z
- **Completed:** 2026-03-27T12:22:18Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- createApp(db, options) exportiert seiteneffektfreie Express-App mit allen 19+ Route-Mounts
- server.js wurde zum schlanken Wrapper (Socket.IO, SMTP, Firebase, Cron, Graceful Shutdown)
- Vitest Backend-Config mit singleFork fuer sequentielle Tests gegen echte Postgres
- docker-compose.test.yml bereit fuer lokale und CI Test-Ausfuehrung

## Task Commits

1. **Task 1: createApp.js Factory aus server.js extrahieren** - `9fa4e3f` (feat)
2. **Task 2: Vitest-Config + docker-compose.test.yml + npm Scripts** - `c226db8` (chore)

## Files Created/Modified
- `backend/createApp.js` - Express-App Factory ohne Seiteneffekte (Kern des Refactorings)
- `backend/server.js` - Schlanker Produktions-Wrapper der createApp aufruft
- `backend/tests/vitest.config.ts` - Vitest-Config mit singleFork und ENV-Variablen
- `backend/docker-compose.test.yml` - Test-DB postgres:16-alpine auf Port 5433
- `backend/tests/globalSetup.js` - Placeholder fuer Plan 02
- `backend/package.json` - vitest/supertest devDeps + test/test:ci/test:watch Scripts

## Decisions Made
- http.createServer() ohne Argument, dann server.on('request', app) — Socket.IO bekommt server BEVOR createApp laeuft
- Rate-Limiters nur anwenden wenn uebergeben (if-Guards) — Tests laufen ohne Rate-Limiting
- QR_SECRET in vitest env aufgenommen — mehrere Routes werfen Top-Level Error ohne QR_SECRET
- Dummy-Objekte fuer io und transporter als Default in createApp — Tests brauchen weder Socket.IO noch SMTP

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] QR_SECRET in Vitest env aufgenommen**
- **Found during:** Task 1 (createApp Verifikation)
- **Issue:** Routes werfen Top-Level Error ohne QR_SECRET ENV
- **Fix:** QR_SECRET in vitest.config.ts env und Verifikations-Befehle aufgenommen
- **Files modified:** backend/tests/vitest.config.ts
- **Verification:** node -e require createApp funktioniert mit QR_SECRET
- **Committed in:** c226db8 (Task 2 Commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** QR_SECRET war nicht im Plan spezifiziert, ist aber zwingend fuer Route-Imports. Kein Scope-Creep.

## Issues Encountered
- node_modules fehlten im Worktree, npm install war noetig vor Verifikation

## Known Stubs
- `backend/tests/globalSetup.js` — Placeholder, wird in Plan 02 vollstaendig implementiert (intentional)

## User Setup Required
None - keine externe Service-Konfiguration noetig.

## Next Phase Readiness
- createApp Factory bereit fuer createTestApp Helper (Plan 02)
- Vitest/supertest installiert und konfiguriert
- docker-compose.test.yml bereit fuer Test-DB Lifecycle (Plan 02)
- globalSetup.js muss in Plan 02 implementiert werden (DB-Connect, Migrationen, Seed)

---
*Phase: 101-test-infrastruktur-server-js-refactoring*
*Completed: 2026-03-27*
