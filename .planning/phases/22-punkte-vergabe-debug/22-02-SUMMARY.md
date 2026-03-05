---
phase: 22-punkte-vergabe-debug
plan: 02
subsystem: api
tags: [express, postgresql, react, ionic, points]

requires:
  - phase: 22-punkte-vergabe-debug/01
    provides: Transaktionssichere Punktevergabe mit client.connect() Pattern
provides:
  - Einziger Bonus-Endpunkt POST /konfis/:id/bonus-points mit Teamer-Berechtigung
  - Konsistente Points-History-Totals aus konfi_profiles (Single Source of Truth)
affects: [konfi-dashboard, admin-konfi-management]

tech-stack:
  added: []
  patterns: [Single Source of Truth fuer Punkte-Totals aus konfi_profiles]

key-files:
  created: []
  modified:
    - backend/routes/activities.js
    - backend/routes/konfi-managment.js
    - backend/routes/konfi.js
    - frontend/src/components/konfi/modals/PointsHistoryModal.tsx

key-decisions:
  - "konfi_profiles als Single Source of Truth fuer Punkte-Totals"
  - "Bonus-Endpunkt in konfi-managment.js konsolidiert mit Teamer-Berechtigung"

patterns-established:
  - "Totals immer aus konfi_profiles lesen, nie im Frontend berechnen"

requirements-completed: [PNK-04, PNK-05]

duration: 3min
completed: 2026-03-05
---

# Phase 22 Plan 02: Bonus-Konsolidierung und Points-History Summary

**Doppelte Bonus-Route entfernt, Points-History-Totals auf konfi_profiles Single Source of Truth umgestellt**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T20:57:29Z
- **Completed:** 2026-03-05T21:00:29Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Doppelten assign-bonus Endpunkt aus activities.js entfernt, nur noch POST /konfis/:id/bonus-points
- Bonus-Route Berechtigung von requireAdmin auf requireTeamer geaendert
- Push-Notification in konfi-managment.js bonus-points hinzugefuegt
- Backend Points-History sendet konfi_profiles-Werte direkt als Totals
- Frontend calculateTotals() entfernt, nutzt Backend-Totals direkt

## Task Commits

Each task was committed atomically:

1. **Task 1: Doppelte Bonus-Route konsolidieren** - `28ea1b2` (fix)
2. **Task 2: Points-History Berechnung konsistent machen** - `0726bd7` (fix)

## Files Created/Modified
- `backend/routes/activities.js` - assign-bonus Route und validateAssignBonus entfernt
- `backend/routes/konfi-managment.js` - PushService Import, requireTeamer, Push-Notification hinzugefuegt
- `backend/routes/konfi.js` - Totals-Berechnung vereinfacht auf konfi_profiles-Werte
- `frontend/src/components/konfi/modals/PointsHistoryModal.tsx` - calculateTotals entfernt, Backend-Totals direkt genutzt

## Decisions Made
- konfi_profiles als Single Source of Truth fuer Punkte-Totals (statt Frontend-eigene Berechnung)
- Bonus-Endpunkt in konfi-managment.js konsolidiert mit Teamer-Berechtigung (RESTful Ansatz mit :id Parameter)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Punkte-Vergabe komplett debuggt und konsistent
- Alle Punkte-Totals kommen aus konfi_profiles
- Bereit fuer naechste Phase

---
*Phase: 22-punkte-vergabe-debug*
*Completed: 2026-03-05*
