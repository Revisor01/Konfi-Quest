---
phase: 37-dashboard-widget-anwesenheitsstatistik
plan: 01
subsystem: api
tags: [express, postgres, attendance, mandatory-events]

requires:
  - phase: 34-pflicht-events-backend
    provides: mandatory events, event_jahrgang_assignments, auto-enrollment
  - phase: 35-pflicht-events-opt-out
    provides: opt_out status and reason in event_bookings
provides:
  - GET /konfis/:id/attendance-stats endpoint for per-konfi mandatory event attendance
affects: [37-02, dashboard-widget, anwesenheitsstatistik-frontend]

tech-stack:
  added: []
  patterns: [attendance-stats-query-pattern]

key-files:
  created: []
  modified: [backend/routes/konfi-managment.js]

key-decisions:
  - "requireAdmin middleware statt manueller type-Check im Handler (konsistent mit bestehendem Pattern)"

patterns-established:
  - "Attendance-Stats: Jahrgang-basierte Pflicht-Event-Abfrage mit LEFT JOIN auf event_bookings"

requirements-completed: [ANW-01, ANW-02]

duration: 1min
completed: 2026-03-09
---

# Phase 37 Plan 01: Attendance-Stats Backend Endpoint Summary

**Pro-Konfi Anwesenheitsstatistik-Endpoint fuer vergangene Pflicht-Events mit Quote und verpassten Events**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-09T19:34:32Z
- **Completed:** 2026-03-09T19:35:11Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- GET /konfis/:id/attendance-stats Endpoint liefert total_mandatory, attended, percentage, missed_events
- Nur vergangene, nicht abgesagte Pflicht-Events des Konfi-Jahrgangs werden gezaehlt
- missed_events unterscheidet opted_out (mit Begruendung) und absent

## Task Commits

Each task was committed atomically:

1. **Task 1: Attendance-Stats Endpoint erstellen** - `01a0784` (feat)

## Files Created/Modified
- `backend/routes/konfi-managment.js` - Neuer GET /:id/attendance-stats Endpoint mit Jahrgang-Lookup, Pflicht-Event-Query und Statistik-Berechnung

## Decisions Made
- requireAdmin middleware statt manueller req.user.type Check: konsistent mit allen anderen Admin-only Endpoints in konfi-managment.js

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend-Endpoint bereit fuer Frontend-Integration (Plan 37-02)
- Response-Format: { total_mandatory, attended, percentage, missed_events[] }

---
*Phase: 37-dashboard-widget-anwesenheitsstatistik*
*Completed: 2026-03-09*
