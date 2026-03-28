---
phase: 103-core-business-integration-tests
plan: 01
subsystem: backend-tests
tags: [integration-tests, activities, events, postgresql]
dependency_graph:
  requires: [101-01, 101-02, 101-03, 102-01]
  provides: [activities-tests, events-tests]
  affects: [backend/tests/routes]
tech_stack:
  added: []
  patterns: [supertest, vitest, seed-per-test]
key_files:
  created:
    - backend/tests/routes/activities.test.js
    - backend/tests/routes/events.test.js
  modified:
    - backend/tests/helpers/seed.js
    - backend/routes/badges.js
decisions:
  - "Seed Activities brauchen type + points Spalten fuer assign-activity Route"
  - "badges.js criteria_extra JSON.parse muss typeof-Check haben fuer JSONB"
metrics:
  duration: 432s
  completed: "2026-03-28"
  tasks: 2
  tests_added: 40
  files_modified: 4
---

# Phase 103 Plan 01: Activities + Events Integration-Tests Summary

Activities CRUD + Punkte-Vergabe + Events CRUD + Buchung + Warteliste + Pflicht-Events mit 40 Integration-Tests gegen echte PostgreSQL Test-DB abgesichert.

## Tasks Completed

### Task 1: Activities Integration-Tests (BIT-03)
**Commit:** 46bdd1d

19 Tests in 6 describe-Bloecken:
- GET /api/admin/activities: Admin/Teamer 200, Konfi 403, Org-Isolation, category_data STRING_AGG
- POST /api/admin/activities: Erstellen mit Kategorien, Validation (leerer Name 400), Teamer 403
- PUT /api/admin/activities/:id: Update 200, nicht-existierend 404, Cross-Org 404
- DELETE /api/admin/activities/:id: Loeschen 200, Cross-Org 404
- POST assign-activity: Gottesdienst-Punkte, Gemeinde-Punkte, Konfi 403, Cross-Org Activity 404
- Kategorie-Filter: target_role Query-Parameter

### Task 2: Events Integration-Tests (BIT-04)
**Commit:** 76e0db0

21 Tests in 7 describe-Bloecken:
- GET /api/events: Admin/Konfi 200, Org-Isolation, registration_status + categories/jahrgaenge Arrays
- POST /api/events: Erstellen 201, leerer Name 400, Konfi 403, Pflicht ohne Jahrgang 400
- POST /api/events/:id/book: Konfi confirmed 201, Doppelbuchung 409, Cross-Org 404, Admin 403
- GET /api/events/:id/timeslots: Timeslot-Daten, leeres Array, Cross-Org 404
- Warteliste-Nachruecken: max_participants=1, waitlist, Stornierung -> promoteFromWaitlist
- DELETE /api/events/:id/book: Stornierung 200, ohne Buchung 404
- Pflicht-Event: mandatory Flag in GET, Auto-Enrollment bei Erstellung
- Kapazitaetsgrenze: Volles Event ohne Warteliste 400

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] badges.js criteria_extra JSON.parse fuer JSONB-Objekte**
- **Found during:** Task 1
- **Issue:** `JSON.parse(badge.criteria_extra)` crashed weil PostgreSQL JSONB bereits als Object zurueckgibt
- **Fix:** typeof-Check vor JSON.parse hinzugefuegt
- **Files modified:** backend/routes/badges.js
- **Commit:** 46bdd1d

**2. [Rule 3 - Blocking] Seed Activities ohne type + points Spalten**
- **Found during:** Task 1
- **Issue:** assign-activity Route braucht `activity.points` und `activity.type` Spalten, Seed setzte nur `gottesdienst_points`/`gemeinde_points`
- **Fix:** Seed erweitert um type + points basierend auf gp/gep Werten
- **Files modified:** backend/tests/helpers/seed.js
- **Commit:** 46bdd1d

## Known Stubs

None.

## Self-Check: PASSED
