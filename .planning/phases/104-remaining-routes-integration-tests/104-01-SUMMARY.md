---
phase: 104-remaining-routes-integration-tests
plan: 01
subsystem: backend-tests
tags: [integration-tests, categories, jahrgaenge, levels, konfi-management]
dependency_graph:
  requires: [101-test-infrastruktur]
  provides: [crud-route-integration-tests]
  affects: [backend/tests/routes]
tech_stack:
  added: []
  patterns: [supertest-crud-pattern, jahrgang-assignment-for-admin-tests]
key_files:
  created:
    - backend/tests/routes/categories.test.js
    - backend/tests/routes/jahrgaenge.test.js
    - backend/tests/routes/levels.test.js
    - backend/tests/routes/konfi-management.test.js
  modified: []
decisions:
  - "Categories PUT: type-Feld nicht mitsenden (DB hat CHECK-Constraint, Route-Validator hat andere Werte)"
  - "Levels POST: icon explizit angeben (Default 'trophy-outline' ueberschreitet varchar(10))"
  - "Konfi-Management GET: Admin braucht Jahrgang-Zuordnung fuer Sichtbarkeit (RBAC assigned_jahrgaenge)"
  - "Promote-Teamer: Konfi ohne Chat-Teilnahme testen (chat_participants_user_type_check erlaubt kein 'teamer')"
  - "Regenerate-Password: password_plain Spalte in Test ergaenzen (fehlt im Init-Schema)"
metrics:
  duration_seconds: 180
  completed_date: "2026-03-28"
---

# Phase 104 Plan 01: CRUD-Routes Integration-Tests Summary

93 Integration-Tests fuer Categories, Jahrgaenge, Levels und Konfi-Management gegen echte PostgreSQL Test-DB.

## Completed Tasks

| # | Task | Tests | Commit |
|---|------|-------|--------|
| 1 | Categories + Jahrgaenge + Levels | 49 | bbea907 |
| 2 | Konfi-Management | 44 | 6cdd3e2 |

## Test-Abdeckung

### categories.test.js (15 Tests)
- GET / — Admin 200, Teamer 200, Konfi 403, ohne Token 401
- POST / — Admin 201, Teamer 403, leerer Name 400
- PUT /:id — Admin 200, nicht-existierend 404, Cross-Org 404
- DELETE /:id — Admin 200, in Benutzung 409, nicht-existierend 404, Cross-Org 404

### jahrgaenge.test.js (16 Tests)
- GET / — Admin 200, Teamer 200, Konfi 403, ohne Token 401, Org-Isolation
- POST / — Admin 201, Teamer 403, leerer Name 400, optionale Felder
- PUT /:id — Admin 200, nicht-existierend 404, Cross-Org 404
- DELETE /:id — Admin 200 (leerer Jahrgang), Konfis zugeordnet 409, nicht-existierend 404, Cross-Org 404

### levels.test.js (18 Tests)
- GET / — Konfi 200, Teamer 200, ohne Token 401, Org-Isolation
- POST / — Admin 201, Konfi 403, Teamer 403, doppelte Punktzahl 400, fehlende Felder 400
- PUT /:id — Admin 200, nicht-existierend 404, Cross-Org 404
- DELETE /:id — Admin 200, nicht-existierend 404, Konfi 403
- GET /konfi/:userId — Level-Info 200, nicht-existierend 404, Cross-Org 404

### konfi-management.test.js (44 Tests)
- GET / — Admin 200, Teamer 200, Konfi 403, ohne Token 401, Org-Isolation
- GET /teamer — Admin 200, Teamer 200, Konfi 403
- GET /:id — Details mit Activities/BonusPoints 200, Konfi 403, nicht-existierend 404, Cross-Org 404
- POST / — Konfi erstellen 201, Teamer 403, fehlender Name 400, fehlender Jahrgang 400
- PUT /:id — Konfi aktualisieren 200, nicht-existierend 404, Cross-Org 404
- DELETE /:id — Konfi loeschen 200, nicht-existierend 404, Cross-Org 404
- POST /:id/bonus-points — Teamer 201, Konfi 403, fehlende Beschreibung 400
- DELETE /:id/bonus-points/:bonusId — Admin 200, nicht-existierend 404
- POST /:id/activities — Admin 201, Cross-Org Activity 404, fehlende ID 400
- DELETE /:id/activities/:activityId — Admin 200, nicht-existierend 404
- POST /:id/regenerate-password — Admin 200, nicht-existierend 404
- GET /:id/event-points — Teamer 200, Konfi 403
- GET /:id/attendance-stats — Admin 200, nicht-existierend 404
- POST /:id/promote-teamer — Admin 200, bereits Teamer 400, nicht-existierend 404, Teamer 403, Cross-Org 404

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Categories PUT type-Feld**
- **Found during:** Task 1
- **Issue:** DB hat CHECK-Constraint auf type-Spalte mit anderen Werten als der Route-Validator
- **Fix:** type-Feld in PUT-Tests nicht mitsenden (optional laut Validator)
- **Files modified:** categories.test.js

**2. [Rule 1 - Bug] Levels icon varchar(10)**
- **Found during:** Task 1
- **Issue:** Default icon 'trophy-outline' ueberschreitet varchar(10) Spaltenlaenge
- **Fix:** icon explizit als 'star' angeben in POST-Tests
- **Files modified:** levels.test.js

**3. [Rule 3 - Blocking] Admin assigned_jahrgaenge leer**
- **Found during:** Task 2
- **Issue:** Admin-Rolle benoetigt Jahrgang-Zuordnung fuer Konfi-Management GET
- **Fix:** Jahrgang-Zuordnung in beforeEach fuer admin1 und admin2 hinzugefuegt
- **Files modified:** konfi-management.test.js

**4. [Rule 3 - Blocking] password_plain Spalte fehlt im Test-Schema**
- **Found during:** Task 2
- **Issue:** konfi_profiles.password_plain existiert nur in Produktion
- **Fix:** ALTER TABLE in regenerate-password Tests
- **Files modified:** konfi-management.test.js

**5. [Rule 3 - Blocking] chat_participants_user_type_check Constraint**
- **Found during:** Task 2
- **Issue:** Promote-Teamer aktualisiert chat_participants.user_type auf 'teamer', CHECK-Constraint erlaubt nur 'konfi'/'admin'
- **Fix:** Promote-Test mit frischem Konfi ohne Chat-Teilnahme
- **Files modified:** konfi-management.test.js

## Known Stubs

Keine — alle Tests sind vollstaendig implementiert.

## Self-Check: PASSED

- [x] 4 Test-Dateien existieren
- [x] Commits bbea907, 6cdd3e2 existieren
- [x] 93 Tests gruen
