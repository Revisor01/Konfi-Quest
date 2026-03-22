---
phase: 84-schema-hygiene
plan: 01
subsystem: database
tags: [postgres, migrations, node.js, express]

# Dependency graph
requires: []
provides:
  - Migration-Runner in database.js (liest alle .sql aus migrations/ beim Server-Start)
  - 076_badges_rename_migrations.sql mit vollstaendiger idempotenter badges/activities Rename-Logik
  - 064_consolidate_inline_schemas.sql bereinigt (HINWEIS-Block ersetzt durch Verweis auf 076)
affects: [badges-routes, database-startup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Migration-Runner-Pattern: database.js laedt alle .sql-Dateien aus migrations/ alphabetisch sortiert bei Server-Start
    - DO-Block-Pattern fuer idempotente Tabellen- und Spalten-Renames mit information_schema Checks

key-files:
  created:
    - backend/migrations/076_badges_rename_migrations.sql
  modified:
    - backend/database.js
    - backend/migrations/064_consolidate_inline_schemas.sql

key-decisions:
  - "Migration-Runner ohne State-Tracking: SQL-Dateien sind idempotent, koennen bei jedem Start ausgefuehrt werden"
  - "Fehler in einzelner Migration-Datei wirft Error und stoppt Server-Start (fail-fast)"

patterns-established:
  - "Migration-Runner: fs.readdirSync + .sort() garantiert numerisch korrekte Reihenfolge durch Dateinamen-Praefix"
  - "Idempotente Renames: DO-Block mit information_schema Existenz-Check statt direkter ALTER TABLE"

requirements-completed: [MIG-01, MIG-02]

# Metrics
duration: 10min
completed: 2026-03-22
---

# Phase 84 Plan 01: Schema-Hygiene Migration-Runner Summary

**Migration-Runner in database.js eingebaut, der alle .sql-Dateien aus migrations/ beim Server-Start ausfuehrt, und badges.js Inline-Migrationen als idempotentes 076_badges_rename_migrations.sql ausgelagert**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-22T22:35:00Z
- **Completed:** 2026-03-22T22:45:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Migration-Runner in database.js integriert: liest alle .sql-Dateien aus backend/migrations/ alphabetisch, fuehrt jede aus, loggt Fehler und stoppt bei Fehlschlag
- Neue Datei 076_badges_rename_migrations.sql mit 6 DO-Bloecken: konfi_badges→user_badges, konfi_activities→user_activities, konfi_id→user_id (2x), earned_at→awarded_date, UNIQUE-Constraint-Drop
- 064_consolidate_inline_schemas.sql bereinigt: HINWEIS-Kommentar und doppelte target_role ALTER TABLE Statements entfernt, Verweis auf 076

## Task Commits

Jeder Task wurde atomar committed:

1. **Task 1: Migration-Runner in database.js einbauen** - `eab45eb` (feat)
2. **Task 2: badges.js runMigrations als neue SQL-Datei 076 anlegen** - `88a8d59` (feat)

## Files Created/Modified

- `backend/database.js` - path/fs imports + runMigrations() Funktion + pool.query().then(runMigrations) Kette
- `backend/migrations/076_badges_rename_migrations.sql` - Neue Datei: vollstaendige idempotente badges/activities Rename-Logik als DO-Bloecke
- `backend/migrations/064_consolidate_inline_schemas.sql` - HINWEIS-Block und doppelte target_role Statements entfernt, Verweis auf 076

## Decisions Made

- Migration-Runner ohne State-Tracking: Da alle SQL-Dateien bereits idempotent sind (IF NOT EXISTS, DO-Bloecke), kein Tracking-Mechanismus noetig
- Fail-fast bei Migration-Fehler: Server startet nicht wenn eine .sql-Datei fehlschlaegt (verhindert inkonsistenten DB-Zustand)

## Deviations from Plan

Keine - Plan exakt wie beschrieben ausgefuehrt.

## Issues Encountered

Keine.

## User Setup Required

Keine - keine externe Konfiguration erforderlich.

## Next Phase Readiness

- Migration-Runner ist bereit; naechster Plan (84-02) kann badges.js runMigrations() entfernen und auf den Runner vertrauen
- Alle 9 .sql-Dateien aus migrations/ werden beim Server-Start ausgefuehrt

---
*Phase: 84-schema-hygiene*
*Completed: 2026-03-22*
