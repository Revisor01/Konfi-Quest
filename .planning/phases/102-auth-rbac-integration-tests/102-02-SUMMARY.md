---
phase: 102-auth-rbac-integration-tests
plan: 02
subsystem: backend-tests
tags: [rbac, integration-tests, cross-org-isolation, vitest]
dependency_graph:
  requires: [101-02, 101-03]
  provides: [rbac-matrix-tests, cross-org-isolation-tests]
  affects: [backend/tests]
tech_stack:
  added: []
  patterns: [rbac-matrix-testing, cross-org-isolation-verification]
key_files:
  created:
    - backend/tests/routes/rbac.test.js
  modified:
    - backend/tests/globalSetup.js
    - backend/tests/vitest.config.ts
decisions:
  - "Teamer-Dashboard hat eigenen role_name-Check (nur teamer), daher GET /api/teamer/konfis als requireTeamer-Repraesentant genutzt"
  - "Activities-Response enthaelt kein organization_id Feld, Cross-Org-Pruefung ueber Activity-IDs statt Org-IDs"
  - "SuperAdmin bekommt 403 auf alle Admin/Teamer-Routes (nicht in requireTeamer/requireAdmin/requireOrgAdmin enthalten)"
metrics:
  duration_seconds: 733
  completed: "2026-03-27T13:42:27Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
  test_count: 48
---

# Phase 102 Plan 02: RBAC-Matrix + Cross-Org-Isolation Tests Summary

48 Integration-Tests verifizieren alle 5 RBAC-Rollen gegen repraesentative Endpoints plus Cross-Org-Daten-Isolation zwischen zwei Organisationen.

## Tasks Completed

### Task 1: RBAC-Matrix Tests (aea4aa5)

Erstellt `backend/tests/routes/rbac.test.js` mit 37 RBAC-Matrix-Tests:

- **Konfi-Routes (6 Tests):** Konfi erhaelt 200, alle anderen Rollen 403 (Konfi-Dashboard prueft `req.user.type === 'konfi'`)
- **Admin-Routes requireTeamer (6 Tests):** Teamer/Admin/OrgAdmin 200, Konfi/SuperAdmin 403
- **Admin-Routes requireAdmin (5 Tests):** Admin/OrgAdmin erlaubt, Konfi/Teamer/SuperAdmin 403
- **Admin-Routes requireOrgAdmin (6 Tests):** Nur OrgAdmin 200, alle anderen 403
- **Teamer-Routes (9 Tests):** Dashboard nur fuer Teamer (role_name-Check), /konfis fuer Teamer/Admin/OrgAdmin
- **Unauthentifizierte Zugriffe (5 Tests):** Alle geschuetzten Endpoints geben 401 ohne Token

### Task 2: Cross-Org-Isolation Tests (aea4aa5)

11 Cross-Org-Tests im selben File:

- **Admin-Sichtbarkeit (4 Tests):** admin1 sieht nur Org-1-Activities/Jahrgaenge, admin2 nur Org-2
- **Konfi-Sichtbarkeit (4 Tests):** konfi1 Dashboard/Events nur Org-1, konfi3 nur Org-2
- **Schreibende Zugriffe (3 Tests):** admin1 DELETE/PUT auf Org-2-Activity erhaelt 404 (Org-Filter)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fehlende Spalten in Test-DB Schema**
- **Found during:** Task 1
- **Issue:** `activities.type`, `activities.points`, `events.cancelled` existieren nicht in Test-DB (weder in init-scripts noch in migrations)
- **Fix:** globalSetup.js erweitert um einzelne ALTER TABLE Statements (Batch-Query scheiterte an nicht-existierender `certificate_types` Tabelle)
- **Files modified:** backend/tests/globalSetup.js
- **Commit:** aea4aa5

**2. [Rule 3 - Blocking] vitest.config.ts Port-Anpassung**
- **Found during:** Task 1
- **Issue:** Docker nicht verfuegbar auf lokalem System, Test-DB laeuft auf nativem PostgreSQL Port 5432 statt Docker Port 5433
- **Fix:** TEST_DATABASE_URL in vitest.config.ts auf Port 5432 geaendert
- **Files modified:** backend/tests/vitest.config.ts
- **Commit:** aea4aa5

## Known Stubs

Keine - alle Tests funktional und gegen echte DB.

## Decisions Made

1. **Teamer-Dashboard Route-spezifischer Check:** GET /api/teamer/dashboard hat `req.user.role_name !== 'teamer'` Check, daher bekommen Admin/OrgAdmin dort 403 obwohl sie requireTeamer passieren. GET /api/teamer/konfis als besserer requireTeamer-Repraesentant gewaehlt.
2. **Activity-Response ohne organization_id:** Cross-Org-Pruefung ueber Activity-IDs (Seed-Daten: IDs 1-4 = Org 1, IDs 5-6 = Org 2) statt organization_id im Response-Objekt.
3. **SuperAdmin hat keinen Zugriff auf Admin/Teamer-Routes:** super_admin ist NICHT in requireTeamer/requireAdmin/requireOrgAdmin enthalten, bekommt ueberall 403. Nur /api/organizations ist fuer SuperAdmin.

## Self-Check: PASSED
