---
phase: 40-badges-aktivitaeten
plan: 01
subsystem: database, api
tags: [postgresql, migration, rbac, target_role]

requires:
  - phase: 38-teamer-grundgeruest
    provides: Teamer-Rolle und RBAC-System
provides:
  - user_badges und user_activities Tabellen (umbenannt von konfi_badges/konfi_activities)
  - target_role Spalte in activities und custom_badges
  - Teamer-Aktivitaeten ohne Punkte-Pflicht
  - Mehrfachvergabe von Aktivitaeten (UNIQUE Constraint entfernt)
affects: [40-02, 40-03, frontend-badges, frontend-activities]

tech-stack:
  added: []
  patterns: [idempotent-migration, target-role-filter]

key-files:
  created: []
  modified:
    - backend/routes/badges.js
    - backend/routes/activities.js
    - backend/routes/konfi-managment.js
    - backend/routes/konfi.js
    - backend/routes/organizations.js
    - backend/routes/teamer.js

key-decisions:
  - "Migration als idempotente Funktion in badges.js, nicht als separate Migrationsdatei"
  - "target_role Default 'konfi' damit alle bestehenden Daten weiter funktionieren"
  - "Teamer-Aktivitaeten: points=0 und type=null als Default statt Pflichtfelder"

patterns-established:
  - "target_role Pattern: Filtern via Query-Parameter, Default bei GET ist alle Rollen"
  - "Teamer-Aktivitaeten: Kein pointTypeGuard-Check, keine Punkte-Vergabe"

requirements-completed: [BDG-01, BDG-07]

duration: 6min
completed: 2026-03-10
---

# Phase 40 Plan 01: DB-Migration und Backend-Route-Anpassung Summary

**Tabellen konfi_badges/konfi_activities zu user_badges/user_activities umbenannt, target_role Spalte eingefuegt, Mehrfachvergabe von Aktivitaeten ermoeglicht**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-10T21:48:30Z
- **Completed:** 2026-03-10T21:54:31Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Idempotente DB-Migration fuer Tabellen- und Spaltenumbenennung
- Alle 6 Backend-Route-Dateien auf neue Tabellennamen migriert
- target_role Filter in GET /badges und GET /activities
- Teamer-Aktivitaeten ohne Punkte-Pflicht erstell- und zuweisbar

## Task Commits

Each task was committed atomically:

1. **Task 1: DB-Migration -- Tabellen umbenennen und Spalten hinzufuegen** - `d85bf10` (feat)
2. **Task 2: Alle Backend-Routes auf neue Tabellennamen migrieren** - `1a8d8ce` (feat)

## Files Created/Modified
- `backend/routes/badges.js` - Migration-Funktion, user_badges/user_activities, target_role Filter/POST
- `backend/routes/activities.js` - user_activities, target_role Filter/POST/PUT, Teamer-Aktivitaeten
- `backend/routes/konfi-managment.js` - user_badges/user_activities, Teamer-Aktivitaeten ohne Punkte
- `backend/routes/konfi.js` - user_badges/user_activities mit user_id Spalte
- `backend/routes/organizations.js` - user_badges/user_activities in CASCADE-Loeschkette
- `backend/routes/teamer.js` - user_badges mit user_id Spalte

## Decisions Made
- Migration als idempotente Funktion in badges.js statt separate Migrationsdatei -- einfacher, keine zusaetzliche Infrastruktur noetig
- target_role Default 'konfi' fuer volle Rueckwaertskompatibilitaet
- Teamer-Aktivitaeten mit points=0 und type=null als Default

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend bereit fuer Frontend-Anpassungen (Plan 40-02)
- target_role API-Parameter koennen vom Frontend genutzt werden
- Teamer-Badge-System kann in Plan 40-03 aufgebaut werden

---
*Phase: 40-badges-aktivitaeten*
*Completed: 2026-03-10*
