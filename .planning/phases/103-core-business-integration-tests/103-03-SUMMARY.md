---
phase: 103-core-business-integration-tests
plan: 03
subsystem: testing
tags: [vitest, supertest, postgres, badges, integration-tests]

requires:
  - phase: 101-test-infrastruktur-server-js-refactoring
    provides: Test-Infrastruktur (getTestApp, getTestPool, truncateAll, seed, generateToken)
provides:
  - Badge-CRUD Integration-Tests (24 Tests)
  - Auto-Award-Trigger Verifizierung
  - Progress-Berechnung Verifizierung
  - Level-Zuordnung Verifizierung
affects: []

tech-stack:
  added: []
  patterns: [checkAndAwardBadges direkt-aufruf fuer Auto-Award-Tests]

key-files:
  created: [backend/tests/routes/badges.test.js]
  modified: [backend/tests/globalSetup.js, backend/tests/helpers/db.js, backend/routes/badges.js, backend/routes/konfi.js]

key-decisions:
  - "user_badges FK auf custom_badges statt badges (alte Tabelle)"
  - "criteria_extra JSONB-Objekt-Handling statt JSON.parse-only"
  - "Auto-Award Tests nutzen checkAndAwardBadges direkt statt ueber Activities-Endpoint"

patterns-established:
  - "JSONB-Spalten immer mit typeof-Check vor JSON.parse verarbeiten"

requirements-completed: [BIT-07]

duration: 8min
completed: 2026-03-28
---

# Phase 103 Plan 03: Badge-Integration-Tests Summary

**24 Badge-Integration-Tests gegen echte PostgreSQL: CRUD, Cross-Org-Isolation, Level-Zuordnung, Auto-Award-Trigger, Progress-Berechnung**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-28T02:08:56Z
- **Completed:** 2026-03-28T02:16:39Z
- **Tasks:** 1/1
- **Files modified:** 5

## Accomplishments

### Task 1: Badge CRUD + manuelle Vergabe Tests (25eb2d8)

24 Tests in 9 describe-Bloecken:

1. **GET /api/admin/badges** (5 Tests): Admin/Teamer 200, Konfi 403, Cross-Org-Isolation, ohne Token 401
2. **GET /api/admin/badges/:id** (3 Tests): Detail-Abruf, 404 bei nicht-existierend, 404 bei fremder Org
3. **GET /api/admin/badges/criteria-types** (1 Test): Alle criteria_types als Objekt
4. **POST /api/admin/badges** (3 Tests): Erstellen 201, Teamer 403, fehlende Felder 400
5. **PUT /api/admin/badges/:id** (2 Tests): Update 200, fremde Org 404
6. **DELETE /api/admin/badges/:id** (3 Tests): Loeschen 200 + user_badges CASCADE, fremde Org 404
7. **Level-Zuordnung** (2 Tests): Novize bei 0 Punkten, Gehilfe bei 10 Punkten (on-the-fly)
8. **Progress-Berechnung** (3 Tests): Badge-Progress-Feld, total_points 25% korrekt, Admin 403
9. **Auto-Award-Trigger** (2 Tests): Badge-Vergabe bei Kriterien-Erfuellung, kein Duplikat

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] JSON.parse criteria_extra JSONB-Handling**
- **Found during:** Task 1
- **Issue:** criteria_extra ist JSONB-Spalte, PostgreSQL gibt Objekte zurueck statt Strings. JSON.parse("[object Object]") wirft SyntaxError.
- **Fix:** typeof-Check vor JSON.parse in badges.js (2 Stellen) und konfi.js (4 Stellen)
- **Files modified:** backend/routes/badges.js, backend/routes/konfi.js
- **Commit:** 25eb2d8

**2. [Rule 3 - Blocking] globalSetup user_badges FK + fehlende Spalte**
- **Found during:** Task 1
- **Issue:** user_badges referenzierte badges(id) statt custom_badges(id), und seen-Spalte fehlte
- **Fix:** user_badges-Definition nach custom_badges verschoben, FK korrigiert, seen-Spalte ergaenzt
- **Files modified:** backend/tests/globalSetup.js
- **Commit:** 25eb2d8

**3. [Rule 3 - Blocking] truncateAll fehlte custom_badges**
- **Found during:** Task 1
- **Issue:** TRUNCATE-Liste in db.js enthielt custom_badges nicht
- **Fix:** custom_badges zur TRUNCATE-Liste hinzugefuegt
- **Files modified:** backend/tests/helpers/db.js
- **Commit:** 25eb2d8

## Known Stubs

Keine Stubs.
