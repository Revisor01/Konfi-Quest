---
phase: 64-db-schema-konsolidierung
plan: 02
subsystem: database
tags: [postgresql, migrations, schema, cleanup]

requires:
  - phase: none
    provides: none
provides:
  - Zentrale Migration 064_consolidate_inline_schemas.sql mit allen inline Schema-Statements
  - Bereinigte material.js und teamer.js ohne Schema-Init bei Server-Start
affects: [backend-startup, deployment]

tech-stack:
  added: []
  patterns: [Schema in Migrations statt inline in Routes]

key-files:
  created:
    - backend/migrations/064_consolidate_inline_schemas.sql
  modified:
    - backend/routes/material.js
    - backend/routes/teamer.js

key-decisions:
  - "badges.js/jahrgaenge.js/settings.js Inline-Migrations vorerst beibehalten — defensivere ADD COLUMN IF NOT EXISTS Pattern"
  - "badges.js Rename-Migrations nur dokumentiert, nicht extrahiert — komplexe Existenz-Checks nicht als einfache SQL abbildbar"

patterns-established:
  - "Schema-Definition in backend/migrations/ statt inline in Route-Dateien"

requirements-completed: [SCHEMA-CONSOLIDATE, SCHEMA-CLEANUP]

duration: 2min
completed: 2026-03-21
---

# Phase 64 Plan 02: Inline Schema Konsolidierung Summary

**Inline CREATE TABLE Statements aus material.js und teamer.js in zentrale Migration 064 extrahiert, 145 Zeilen Schema-Code aus Routes entfernt**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T13:02:36Z
- **Completed:** 2026-03-21T13:04:08Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Zentrale Migration mit 8 CREATE TABLE + 6 ALTER TABLE Statements aus 5 Route-Dateien
- material.js um 97 Zeilen Schema-Init bereinigt (6 Tabellen + 2 Daten-Migrations)
- teamer.js um 40 Zeilen Schema-Init bereinigt (2 Tabellen + 1 ALTER)
- Alle Statements idempotent (IF NOT EXISTS), Migration kann beliebig oft ausgefuehrt werden

## Task Commits

Each task was committed atomically:

1. **Task 1: Zentrale Migration aus Inline-Schemas erstellen** - `bb6dace` (chore)
2. **Task 2: Inline Schema-Erstellung aus Routes entfernen** - `c01952e` (refactor)

## Files Created/Modified
- `backend/migrations/064_consolidate_inline_schemas.sql` - Zentrale Migration mit allen inline Schema-Statements
- `backend/routes/material.js` - Schema-Init entfernt, Referenz-Kommentar hinzugefuegt
- `backend/routes/teamer.js` - Schema-Init entfernt, Referenz-Kommentar hinzugefuegt

## Decisions Made
- badges.js Rename-Migrations (konfi_badges -> user_badges etc.) bleiben inline, da sie komplexe information_schema-Checks erfordern die nicht als einfache IF NOT EXISTS Statements abbildbar sind
- jahrgaenge.js und settings.js Inline-Migrations vorerst beibehalten — defensivere Pattern (ADD COLUMN IF NOT EXISTS mit Daten-Migration) und weniger problematisch als CREATE TABLE bei jedem Start

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Migration 064 kann auf dem Server ausgefuehrt werden bevor oder nachdem die bereinigten Routes deployt werden (IF NOT EXISTS)
- badges.js, jahrgaenge.js, settings.js Inline-Migrations sind als naechster Schritt dokumentiert

---
*Phase: 64-db-schema-konsolidierung*
*Completed: 2026-03-21*
