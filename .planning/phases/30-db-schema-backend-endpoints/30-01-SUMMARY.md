---
phase: 30-db-schema-backend-endpoints
plan: 01
subsystem: api, database
tags: [postgres, express, migration, settings, dashboard]

# Dependency graph
requires: []
provides:
  - "Punkte-Typ-Konfiguration pro Jahrgang (gottesdienst_enabled, gemeinde_enabled, target_*)"
  - "Dashboard-Widget-Toggles in Settings (dashboard_show_*)"
  - "Dashboard-Endpoint liefert point_config und dashboard_config"
affects: [30-02, frontend-dashboard, frontend-settings]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Idempotente Spalten-Migration via information_schema.columns", "Dashboard-Config aus Settings-KV-Store"]

key-files:
  created: []
  modified:
    - backend/routes/jahrgaenge.js
    - backend/routes/settings.js
    - backend/routes/konfi.js

key-decisions:
  - "Punkte-Typ-Config als Spalten auf jahrgaenge-Tabelle statt eigener Konfig-Tabelle"
  - "Bestehende org-weite target-Werte automatisch in Jahrgaenge migriert"
  - "Dashboard-Widget-Toggles als Key-Value in settings mit Default true"
  - "target_gottesdienst/target_gemeinde komplett aus Settings-Endpoint entfernt"

patterns-established:
  - "ensurePointConfigColumns: Idempotente ALTER TABLE Migration beim Route-Laden"
  - "Dashboard-Config: Settings-KV-Store mit dashboard_show_* Prefix und Boolean-Parsing"

requirements-completed: [PKT-01, PKT-02, PKT-03, DSH-01]

# Metrics
duration: 5min
completed: 2026-03-07
---

# Phase 30 Plan 01: DB-Schema + Backend-Endpoints Summary

**Jahrgaenge-Tabelle um Punkte-Typ-Config erweitert, Settings um Dashboard-Widget-Toggles, Dashboard-Endpoint liefert point_config und dashboard_config**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-07T13:20:42Z
- **Completed:** 2026-03-07T13:25:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Jahrgaenge-Tabelle hat 4 neue Spalten mit idempotenter Migration und Datenmigration aus Settings
- Settings-Endpoint: target_gottesdienst/target_gemeinde entfernt, 5 neue dashboard_show_* Toggles
- Dashboard-Endpoint liefert point_config aus Jahrgang und dashboard_config aus Settings

## Task Commits

Each task was committed atomically:

1. **Task 1: Jahrgaenge-Tabelle erweitern + CRUD anpassen** - `a5f6b60` (feat)
2. **Task 2: Settings Dashboard-Keys + Dashboard-Endpoint point_config** - `654775c` (feat)

## Files Created/Modified
- `backend/routes/jahrgaenge.js` - Idempotente Migration, POST/PUT mit 4 neuen Spalten, Validierung
- `backend/routes/settings.js` - target_* entfernt, dashboard_show_* Toggles hinzugefuegt
- `backend/routes/konfi.js` - konfiQuery erweitert, point_config und dashboard_config im Response

## Decisions Made
- Punkte-Typ-Config direkt als Spalten auf jahrgaenge-Tabelle (keine extra Konfig-Tabelle)
- Bestehende org-weite target-Werte werden bei Migration automatisch in alle Jahrgaenge uebertragen
- Dashboard-Widget-Toggles als Key-Value-Paare in settings-Tabelle mit Default true
- target_gottesdienst/target_gemeinde komplett aus Settings-Endpoint entfernt (Breaking Change fuer altes Settings-UI)

## Deviations from Plan

None - Plan exakt wie geschrieben ausgefuehrt.

## Issues Encountered
None

## User Setup Required
None - keine externe Service-Konfiguration erforderlich.

## Next Phase Readiness
- Backend-Endpoints bereit fuer Frontend-Integration (Plan 30-02)
- point_config und dashboard_config werden vom Dashboard-Endpoint geliefert
- Settings-UI muss aktualisiert werden (target_* Keys nicht mehr verfuegbar)

---
*Phase: 30-db-schema-backend-endpoints*
*Completed: 2026-03-07*
