---
phase: 101-test-infrastruktur-server-js-refactoring
plan: 02
subsystem: testing, infra
tags: [vitest, supertest, postgres, seed, jwt, rbac, globalSetup]

requires:
  - phase: 101-01
    provides: createApp(db, options) Factory, Vitest-Config, docker-compose.test.yml
provides:
  - globalSetup/Teardown fuer Test-DB Lifecycle (erstellen, migrieren, droppen)
  - getTestPool() Singleton mit query/getClient/end Interface
  - truncateAll() mit TRUNCATE CASCADE RESTART IDENTITY
  - getTestApp(db) Wrapper fuer supertest-faehige Express-App
  - seed() mit 2 Orgs, 10 Users, Events, Activities, Badges, Levels, Chat
  - generateToken()/getAllTokens() fuer echte JWTs aller 5 RBAC-Rollen
affects: [101-03, alle zukuenftigen Integration-Test-Plans]

tech-stack:
  added: [bcrypt (Seed), jsonwebtoken (Auth-Helper)]
  patterns: [globalSetup Return-Value Teardown (Vitest-Pattern), Singleton Test-Pool, FK-respektierender Seed]

key-files:
  created:
    - backend/tests/globalSetup.js
    - backend/tests/globalTeardown.js
    - backend/tests/helpers/db.js
    - backend/tests/helpers/testApp.js
    - backend/tests/helpers/seed.js
    - backend/tests/helpers/auth.js
  modified: []

key-decisions:
  - "Repo-Root init-scripts vor Backend-Migrations ausfuehren (01-create-schema.sql als Basis)"
  - "Fehlende Produktions-Tabellen im globalSetup ergaenzt statt separate SQL-Datei"
  - "custom_badges statt badges Tabelle fuer Seed (Routes nutzen custom_badges)"
  - "SuperAdmin mit is_super_admin=true + org_id=1 (organization_id NOT NULL Constraint)"
  - "Rollen pro Organisation dupliziert (Org 1: id 1-5, Org 2: id 6-9) wegen UNIQUE(name, organization_id)"

patterns-established:
  - "Test-DB Pattern: globalSetup erstellt DB, Teardown droppt, truncateAll zwischen Tests"
  - "Auth-Helper Pattern: generateToken(userKey) mit SEED_USERS Referenz"
  - "Seed-als-JS Pattern: Konstanten exportiert fuer ID-Referenzierung in Tests"

requirements-completed: [INF-02, INF-03, INF-04, INF-05]

duration: 5min
completed: 2026-03-27
---

# Phase 101 Plan 02: Test-DB Lifecycle + Seed + Auth-Helpers Summary

**globalSetup mit vollstaendigem Schema + Migrations, Seed mit 2 Orgs/10 Users/4 Badge-Typen, JWT Auth-Helper fuer alle 5 RBAC-Rollen**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-27T12:29:34Z
- **Completed:** 2026-03-27T12:35:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- globalSetup erstellt konfi_test DB mit vollstaendigem Schema (repo-root + fehlende Tabellen + backend init-scripts + migrations)
- Seed mit ~80 Datensaetzen: 2 Organisationen, 10 Users (alle 5 RBAC-Rollen), 4 Badge-Typen, Events, Chat
- Auth-Helper generiert echte JWTs die rbac.js Middleware akzeptiert (per D-10: RBAC nie gemockt)
- truncateAll() leert alle Tabellen mit CASCADE + RESTART IDENTITY fuer saubere Test-Isolation

## Task Commits

1. **Task 1: globalSetup/Teardown + DB-Helper + testApp-Helper** - `ef76c83` (feat)
2. **Task 2: Seed-Fixtures + Auth-Helper** - `89bfb28` (feat)

## Files Created/Modified
- `backend/tests/globalSetup.js` - Test-DB Lifecycle: erstellen, Schema, Migrations, Teardown
- `backend/tests/globalTeardown.js` - Standalone Teardown fuer manuelles Aufraeumen
- `backend/tests/helpers/db.js` - getTestPool (Singleton), truncateAll, closePool
- `backend/tests/helpers/testApp.js` - getTestApp(db) mit createApp Factory
- `backend/tests/helpers/seed.js` - 2 Orgs, 10 Users, Jahrgaenge, Activities, Badges, Events, Chat
- `backend/tests/helpers/auth.js` - generateToken, getAllTokens, SEED_USERS

## Decisions Made
- Repo-Root `init-scripts/01-create-schema.sql` als Schema-Basis statt eigenes Test-Schema — konsistent mit Produktion
- Fehlende Tabellen (user_activities, activity_requests, custom_badges, etc.) inline in globalSetup erstellt — historisch durch Route-Dateien erstellt, nicht in Init-Scripts
- `custom_badges` statt `badges` Tabelle fuer Seed — Routes nutzen custom_badges mit criteria_type
- SuperAdmin bekommt `org_id=1` + `is_super_admin=true` — organization_id ist NOT NULL in Schema
- Rollen pro Org dupliziert (9 Rollen statt 5) — `UNIQUE(name, organization_id)` Constraint erfordert eigene Rollen-Eintraege pro Organisation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fehlende Produktions-Tabellen im Schema ergaenzt**
- **Found during:** Task 1 (globalSetup)
- **Issue:** 01-create-schema.sql enthaelt nicht alle Tabellen die in Produktion existieren (user_activities, activity_requests, custom_badges, chat_polls, etc.)
- **Fix:** globalSetup erstellt fehlende Tabellen inline nach dem Basis-Schema
- **Files modified:** backend/tests/globalSetup.js
- **Verification:** Schema-Analyse aller Route-Dateien und Migrations

**2. [Rule 3 - Blocking] users-Spalten fuer rbac.js ergaenzt**
- **Found during:** Task 1 (globalSetup)
- **Issue:** rbac.js erwartet is_super_admin, role_title, token_invalidated_at auf users
- **Fix:** ALTER TABLE ADD COLUMN Statements in globalSetup
- **Files modified:** backend/tests/globalSetup.js

**3. [Rule 1 - Bug] Rollen pro Organisation dupliziert**
- **Found during:** Task 2 (Seed)
- **Issue:** Plan spezifizierte 5 Rollen, aber UNIQUE(name, organization_id) erfordert eigene Rollen pro Org
- **Fix:** 9 Rollen statt 5 (5 fuer Org 1, 4 fuer Org 2), Users referenzieren org-spezifische role_id
- **Files modified:** backend/tests/helpers/seed.js

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** Alle Fixes noetig fuer korrekte Schema-Kompatibilitaet. Kein Scope-Creep.

## Issues Encountered
- node_modules fehlten im Worktree, npm install noetig vor Verifikation
- 01-create-schema.sql deckt nur ~60% der Produktions-Tabellen ab (historisch gewachsen)

## Known Stubs
None - alle Helper sind vollstaendig implementiert.

## User Setup Required
None - keine externe Service-Konfiguration noetig.

## Next Phase Readiness
- Alle Test-Helpers bereit fuer Smoke-Test in Plan 03
- docker-compose.test.yml (Port 5433) muss laufen fuer echte DB-Tests
- globalSetup/Seed noch nicht gegen echte DB getestet (Plan 03 Aufgabe)

## Self-Check: PASSED

- All 6 created files exist on disk
- Commit ef76c83 (Task 1) found in git log
- Commit 89bfb28 (Task 2) found in git log
- db.js exports verified: getTestPool, truncateAll, closePool
- testApp.js exports verified: getTestApp returns Express function
- seed.js exports verified: 2+ Orgs, 10+ Users, 4 Badge-Typen
- auth.js exports verified: generateToken returns valid JWT, getAllTokens 10+ keys

---
*Phase: 101-test-infrastruktur-server-js-refactoring*
*Completed: 2026-03-27*
