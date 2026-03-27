---
phase: 101-test-infrastruktur-server-js-refactoring
plan: 03
subsystem: testing, infra
tags: [vitest, supertest, smoke-test, postgres, integration-test]

requires:
  - phase: 101-01
    provides: createApp(db, options) Factory, Vitest-Config
  - phase: 101-02
    provides: globalSetup, Seed, Auth-Helpers, DB-Helpers
provides:
  - 6 Smoke-Tests die gesamte Test-Infrastruktur Ende-zu-Ende validieren
  - Beweis dass alle 6 INF-Requirements erfuellt sind
affects: [alle zukuenftigen Integration-Test-Plans]

tech-stack:
  added: []
  patterns: [Vitest globals statt require, PostgreSQL-Homebrew fuer lokale Tests]

key-files:
  created:
    - backend/tests/routes/smoke.test.js
  modified:
    - backend/tests/globalSetup.js
    - backend/tests/vitest.config.ts

key-decisions:
  - "Vitest 4 globals:true statt require('vitest') — CommonJS-Import nicht mehr unterstuetzt"
  - "poolOptions durch maxWorkers/minWorkers ersetzt (Vitest 4 Migration)"
  - "Auth-Response prueft refresh_token statt refreshToken (snake_case Backend-Konvention)"
  - "PostgreSQL via Homebrew lokal statt Docker (Docker nicht verfuegbar)"

requirements-completed: [INF-01, INF-02, INF-03, INF-04, INF-05, INF-06]

duration: 6min
completed: 2026-03-27
---

# Phase 101 Plan 03: Smoke-Test Ende-zu-Ende Summary

**6 Smoke-Tests gegen echte PostgreSQL validieren Health, Login, Auth-Guard und RBAC-Tokens fuer alle 5 Rollen**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-27T12:44:12Z
- **Completed:** 2026-03-27T12:50:35Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Smoke-Test mit 6 Tests: Health-Endpoint, Login (gueltig + falsch), Auth-Guard (mit + ohne Token), RBAC-Tokens fuer alle 5 Rollen
- Alle Tests laufen gegen echte PostgreSQL Test-DB (Port 5433)
- globalSetup um fehlende Tabellen/Spalten erweitert (refresh_tokens, push_tokens, user_badges.awarded_date, levels.sort_order, jahrgaenge-Punkte-Config)
- vitest.config.ts auf Vitest 4 migriert (globals, maxWorkers statt poolOptions)
- Phase 101 komplett: Backend ist testbar

## Task Commits

1. **Task 1: Smoke-Test schreiben und mit npm test ausfuehren** - `94266ec` (test)

## Files Created/Modified
- `backend/tests/routes/smoke.test.js` - 6 Integration-Tests: Health, Login, Auth-Guard, RBAC-Tokens
- `backend/tests/globalSetup.js` - Fehlende Tabellen/Spalten fuer vollstaendiges Schema
- `backend/tests/vitest.config.ts` - Vitest 4 Migration (globals, poolOptions entfernt)

## Decisions Made
- Vitest 4 erfordert `globals: true` statt `require('vitest')` — CommonJS-Import wirft Error
- `poolOptions.forks.singleFork` ersetzt durch `maxWorkers: 1, minWorkers: 1` (Vitest 4 Breaking Change)
- Auth-Response nutzt `refresh_token` (snake_case) nicht `refreshToken` (camelCase) — Backend-Konvention
- PostgreSQL 16 via Homebrew lokal installiert (Docker nicht auf dieser Maschine verfuegbar)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Init-Script IMMUTABLE-Error in Partial Index**
- **Found during:** Task 1 (erster Testlauf)
- **Issue:** `CREATE INDEX idx_events_active ... WHERE event_date > CURRENT_TIMESTAMP` scheitert — CURRENT_TIMESTAMP ist nicht IMMUTABLE
- **Fix:** globalSetup entfernt problematische Partial Indexes via Regex vor Ausfuehrung
- **Files modified:** backend/tests/globalSetup.js

**2. [Rule 3 - Blocking] Vitest 4 CommonJS-Import**
- **Found during:** Task 1 (erster Testlauf)
- **Issue:** `require('vitest')` wirft Error in Vitest 4 — nur ESM-Import oder globals erlaubt
- **Fix:** `globals: true` in vitest.config.ts, require-Zeile aus smoke.test.js entfernt
- **Files modified:** backend/tests/vitest.config.ts, backend/tests/routes/smoke.test.js

**3. [Rule 3 - Blocking] Fehlende DB-Spalten fuer Auth und Dashboard**
- **Found during:** Task 1 (Tests 2 + 4 failed)
- **Issue:** users.last_login_at, jahrgaenge.confirmation_date/gottesdienst_enabled/etc., user_badges.awarded_date, levels.sort_order fehlten
- **Fix:** globalSetup um ALTER TABLE Statements erweitert, refresh_tokens/push_tokens Tabellen ergaenzt
- **Files modified:** backend/tests/globalSetup.js

**4. [Rule 1 - Bug] Auth-Response-Feld refresh_token statt refreshToken**
- **Found during:** Task 1 (Test 2 failed nach DB-Fix)
- **Issue:** Plan spezifizierte `refreshToken`, Backend sendet `refresh_token`
- **Fix:** Test-Assertion auf korrekten snake_case Feldnamen angepasst
- **Files modified:** backend/tests/routes/smoke.test.js

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug)
**Impact on plan:** Alle Fixes noetig fuer korrekte Test-Ausfuehrung. Kein Scope-Creep.

## Issues Encountered
- Docker nicht verfuegbar auf lokaler Maschine — PostgreSQL 16 via Homebrew installiert
- 7 Iterationen bis alle 6 Tests gruen (Schema-Luecken iterativ geschlossen)
- Migration-Warnungen (push_tokens, event_id Index, activity_requests rename) sind harmlos

## Known Stubs
None - alle Tests sind vollstaendig implementiert und gruen.

## User Setup Required
- PostgreSQL muss auf Port 5433 laufen fuer lokale Tests
- Alternativ: Docker mit `docker compose -f docker-compose.test.yml up -d`

## Phase 101 Success Criteria Check
1. `npx vitest run --config tests/vitest.config.ts` zeigt "6 passed, 0 failed" -- ERFUELLT
2. Health, Login, Auth-Guard und RBAC-Token-Validierung funktionieren gegen echte Test-DB -- ERFUELLT
3. Phase 101 ist komplett — Backend ist testbar -- ERFUELLT

---
*Phase: 101-test-infrastruktur-server-js-refactoring*
*Completed: 2026-03-27*
