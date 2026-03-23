---
phase: 84-schema-hygiene
plan: 02
subsystem: database
tags: [postgres, migration, backend, cleanup]

# Dependency graph
requires:
  - phase: 84-01
    provides: Migration-Runner in database.js, alle idempotenten SQL-Dateien unter backend/migrations/
provides:
  - badges.js ohne runMigrations()-Funktion
  - jahrgaenge.js ohne ensurePointConfigColumns()-Funktion
  - wrapped.js ohne ensureWrappedSchema()-Funktion
  - Klare Trennung: SQL-Dateien sind alleinige Quelle der Schema-Migrationen
affects: [backend-routes, schema-hygiene]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Schema-Kommentar-Verweis: Route-Dateien enthalten nur noch Hinweis auf SQL-Datei statt Inline-Code"

key-files:
  created: []
  modified:
    - backend/routes/badges.js
    - backend/routes/jahrgaenge.js
    - backend/routes/wrapped.js

key-decisions:
  - "Inline-Migrations-Funktionen vollstaendig loeschen statt auskommentieren: sauberer Schnitt, kein totes Code-Rauschen"

patterns-established:
  - "Schema-Kommentar-Verweis: // Schema-Migrationen: siehe backend/migrations/XXX_name.sql als einzeiliger Platzhalter in Route-Dateien"

requirements-completed: [MIG-01, MIG-03]

# Metrics
duration: 10min
completed: 2026-03-22
---

# Phase 84 Plan 02: Inline-Migrationen entfernen Summary

**Drei Inline-Migrations-Funktionen (runMigrations, ensurePointConfigColumns, ensureWrappedSchema) aus Route-Dateien geloescht — SQL-Dateien unter backend/migrations/ sind jetzt alleinige Schema-Quelle**

## Performance

- **Duration:** ca. 10 min
- **Started:** 2026-03-22T22:40:00Z
- **Completed:** 2026-03-22T22:50:00Z
- **Tasks:** 2 (+ 1 Checkpoint)
- **Files modified:** 3

## Accomplishments

- badges.js: runMigrations()-Funktion (80 Zeilen) und deren Aufruf entfernt, Kommentar-Verweis auf 076_badges_rename_migrations.sql eingefuegt
- jahrgaenge.js: ensurePointConfigColumns()-Funktion (35 Zeilen) und deren Aufruf entfernt, Kommentar-Verweis auf 064_consolidate_inline_schemas.sql eingefuegt
- wrapped.js: ensureWrappedSchema()-Funktion (24 Zeilen) und deren Aufruf entfernt, Kommentar-Verweis auf 075_wrapped.sql eingefuegt

## Task Commits

Jede Aufgabe wurde atomar committed:

1. **Task 1: runMigrations aus badges.js entfernen** - `4a7daf6` (fix)
2. **Task 2: ensurePointConfigColumns und ensureWrappedSchema entfernen** - `6819fa8` (fix)

## Files Created/Modified

- `backend/routes/badges.js` - runMigrations-Funktion und Aufruf entfernt (-85 Zeilen netto)
- `backend/routes/jahrgaenge.js` - ensurePointConfigColumns-Funktion und Aufruf entfernt (-35 Zeilen netto)
- `backend/routes/wrapped.js` - ensureWrappedSchema-Funktion und Aufruf entfernt (-24 Zeilen netto)

## Decisions Made

Inline-Migrations-Funktionen vollstaendig loeschen statt auskommentieren: sauberer Schnitt, kein totes Code-Rauschen. Der Migration-Runner aus Plan 84-01 uebernimmt alle Schema-Aenderungen beim Server-Start.

## Deviations from Plan

Keine — Plan exakt wie geschrieben ausgefuehrt.

## Issues Encountered

Keine.

## User Setup Required

Keine externe Konfiguration erforderlich.

## Next Phase Readiness

- Alle Inline-Migrations-Funktionen entfernt
- Migration-Runner (database.js) ist alleinige Schema-Quelle
- Server-Start-Verifikation (Schritt 3 des Checkpoints) liegt beim naechsten Deployment auf dem Server

---
*Phase: 84-schema-hygiene*
*Completed: 2026-03-22*
