---
phase: 32-punkte-ui-frontend
plan: 01
subsystem: ui
tags: [react, ionic, activity-rings, dashboard, point-config]

requires:
  - phase: 31-punkte-logik-backend
    provides: "Backend point_config im Dashboard-Endpoint"
  - phase: 30-db-frontend-config
    provides: "Punkte-Typ-Config Spalten auf jahrgaenge-Tabelle"
provides:
  - "Dynamische ActivityRings (1 oder 3 Ringe basierend auf aktiven Punkte-Typen)"
  - "KonfiDashboardPage nutzt point_config aus Dashboard-Response"
  - "PointsHistoryModal filtert deaktivierte Typen"
affects: [32-02, admin-konfi-detail]

tech-stack:
  added: []
  patterns: ["point_config Props-Durchreichung", "useMemo-Filter fuer deaktivierte Typen"]

key-files:
  created: []
  modified:
    - frontend/src/components/admin/views/ActivityRings.tsx
    - frontend/src/components/konfi/pages/KonfiDashboardPage.tsx
    - frontend/src/components/konfi/views/DashboardView.tsx
    - frontend/src/components/konfi/modals/PointsHistoryModal.tsx

key-decisions:
  - "ActivityRings enabled-Props default true via !== false Check fuer Abwaertskompatibilitaet"
  - "Bei 1 aktivem Typ: einzelner Ring auf aeusserem Radius statt mittlerem"
  - "Settings-API-Aufruf komplett entfernt, point_config aus Dashboard-Response"

patterns-established:
  - "point_config Durchreichung: KonfiDashboardPage -> DashboardView -> ActivityRings/PointsHistoryModal"
  - "Enabled-Flag Pattern: Prop !== false als Default-Check"

requirements-completed: [PUI-01, PUI-03, PUI-05]

duration: 5min
completed: 2026-03-08
---

# Phase 32 Plan 01: Konfi-Dashboard Punkte-UI Summary

**Dynamische ActivityRings mit 1/3-Ring-Modus, point_config-Durchreichung und PointsHistoryModal-Filter fuer deaktivierte Punkte-Typen**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-08T07:08:47Z
- **Completed:** 2026-03-08T07:14:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- ActivityRings zeigt dynamisch 1 oder 3 Ringe basierend auf aktiven Punkte-Typen
- KonfiDashboardPage nutzt point_config aus Dashboard-Response statt separatem /settings Aufruf
- PointsHistoryModal filtert Eintraege und Stats deaktivierter Punkte-Typen aus
- DashboardView reicht enabled-Flags an ActivityRings und berechnet totalCurrentPoints nur fuer aktive Typen

## Task Commits

Each task was committed atomically:

1. **Task 1: ActivityRings dynamische Ring-Anzahl + KonfiDashboardPage point_config** - `a0e67d8` (feat)
2. **Task 2: DashboardView bedingte Anzeige + PointsHistoryModal Filter** - `d05540a` (feat)

## Files Created/Modified
- `frontend/src/components/admin/views/ActivityRings.tsx` - Dynamische Ring-Anzahl mit gottesdienstEnabled/gemeindeEnabled Props
- `frontend/src/components/konfi/pages/KonfiDashboardPage.tsx` - point_config statt /settings, Props-Durchreichung
- `frontend/src/components/konfi/views/DashboardView.tsx` - Bedingte Stats-Berechnung, enabled-Props an ActivityRings
- `frontend/src/components/konfi/modals/PointsHistoryModal.tsx` - Filter nach aktiven Typen, bedingte Header-Stats

## Decisions Made
- ActivityRings enabled-Props haben Default `true` via `!== false` Check -- bestehende Aufrufe ohne diese Props zeigen weiterhin 3 Ringe
- Bei 1 aktivem Typ wird der einzelne Ring auf dem aeusseren Radius (ringRadii[0]) gerendert statt auf mittlerem
- Settings-Interface und separater /settings API-Aufruf komplett entfernt -- alles aus point_config

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- point_config Durchreichung ist etabliert und kann fuer Admin-Konfi-Detail (Plan 32-02) wiederverwendet werden
- Build und TypeScript kompilieren fehlerfrei

---
*Phase: 32-punkte-ui-frontend*
*Completed: 2026-03-08*
