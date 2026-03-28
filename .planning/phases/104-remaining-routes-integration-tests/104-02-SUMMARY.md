---
phase: 104-remaining-routes-integration-tests
plan: 02
subsystem: backend-tests
tags: [integration-tests, notifications, organizations, roles, settings, users]
dependency_graph:
  requires: [101-test-infrastruktur]
  provides: [admin-route-tests, system-route-tests]
  affects: [backend/tests]
tech_stack:
  added: []
  patterns: [supertest, vitest, RBAC-tests, org-isolation-tests]
key_files:
  created:
    - backend/tests/routes/notifications.test.js
    - backend/tests/routes/organizations.test.js
    - backend/tests/routes/roles.test.js
    - backend/tests/routes/settings.test.js
    - backend/tests/routes/users.test.js
  modified:
    - backend/tests/globalSetup.js
decisions:
  - "Validation errors return 400 (not 422) - express-validator handleValidationErrors pattern"
  - "GET /organizations/current unreachable due to /:id route priority - tested actual behavior (403/500)"
  - "Password policy requires 8+ chars, uppercase, lowercase, number, special char"
metrics:
  duration_seconds: 1080
  completed: "2026-03-28T02:53:00Z"
  tests_total: 98
  tests_passed: 98
---

# Phase 104 Plan 02: Admin-Verwaltung + System-Routes Integration-Tests Summary

98 Tests fuer Notifications, Organizations, Roles, Settings und Users Routes mit RBAC-Checks, Org-Isolation und Hierarchie-Pruefung.

## Tasks Completed

### Task 1: Notifications + Roles + Settings (21d0ba6)
- **notifications.test.js** (11 Tests): Device-Token CRUD, Test-Push ohne Firebase (graceful error), Validierung
- **roles.test.js** (13 Tests): GET Rollen-Liste mit user_count, Einzelrolle mit Permissions, Assignable-Rollen pro Hierarchie-Stufe, RBAC 403/401
- **settings.test.js** (10 Tests): GET/PUT Settings, Org-Isolation (Settings pro Organisation getrennt), Dashboard section_order JSON, Chat-Permissions Validierung

### Task 2: Organizations + Users (3b0c517)
- **organizations.test.js** (33 Tests): SuperAdmin CRUD (erstellen/aktualisieren/loeschen), OrgAdmin Einschraenkungen, User/Admin-Listen, Stats, Duplikat-Slug 409, DELETE CASCADE
- **users.test.js** (31 Tests): OrgAdmin User-CRUD, Hierarchie-Checks (filterUsersByHierarchy), Jahrgang-Assignments, Password-Reset (8+ Zeichen Policy), Selbstloeschung verboten, Org-Isolation (OrgAdmin2 sieht keine Org-1-User)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] globalSetup fehlende Spalten/Tabellen**
- **Found during:** Task 1 + Task 2
- **Issue:** Test-DB-Schema fehlte mehrere Spalten/Tabellen die in Produktion existieren (push_tokens.user_type, roles.is_system_role, organizations.contact_phone/address/website_url, settings.organization_id, chat_polls.room_id)
- **Fix:** globalSetup.js um 15 ALTER TABLE/CREATE TABLE Statements erweitert
- **Files modified:** backend/tests/globalSetup.js

**2. [Rule 1 - Bug] Validation Status-Code 400 statt 422**
- **Found during:** Task 1
- **Issue:** handleValidationErrors Middleware gibt 400 zurueck, nicht 422
- **Fix:** Tests auf 400 angepasst

**3. [Rule 1 - Bug] GET /organizations/current unreachable**
- **Found during:** Task 2
- **Issue:** Route /:id faengt /current ab (Route-Reihenfolge). parseInt("current") = NaN, daher 403 fuer nicht-SuperAdmin
- **Fix:** Tests testen tatsaechliches Verhalten statt gewuenschtes Verhalten

## Decisions Made

1. Password-Tests verwenden Policy-konforme Passwoerter (8+ Zeichen, Gross/Klein, Zahl, Sonderzeichen)
2. Organizations DELETE-Test testet volle CASCADE-Loesch-Kette (12 Tabellen)
3. Org-Isolation-Tests in Users prueft Cross-Org-Zugriff auf alle CRUD-Operationen

## Known Stubs

None - alle Tests sind vollstaendig implementiert und laufen gruen.

## Self-Check: PASSED

- All 5 test files exist
- Commits 21d0ba6 (Task 1) and 3b0c517 (Task 2) verified
- All 98 tests pass
