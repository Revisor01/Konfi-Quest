---
phase: 35-opt-out-flow
plan: 01
subsystem: api
tags: [express, postgres, push-notifications, event-booking]

requires:
  - phase: 34-pflicht-event-grundlagen
    provides: "mandatory-Feld auf events, opted_out im CHECK-Constraint, Auto-Enrollment"
provides:
  - "POST /konfi/events/:id/opt-out Endpoint mit reason-Validierung"
  - "POST /konfi/events/:id/opt-in Endpoint"
  - "DELETE-Guard fuer Pflicht-Events"
  - "Push-Methoden sendEventOptOutToAdmins und sendEventOptInToAdmins"
  - "opt_out_reason und opt_out_date Spalten auf event_bookings"
  - "is_opted_out Feld in Konfi-Events-Query"
affects: [35-02-opt-out-flow, frontend-events]

tech-stack:
  added: []
  patterns: ["Opt-out als Status-Wechsel statt Booking-Loeschung"]

key-files:
  created: []
  modified:
    - init-scripts/01-create-schema.sql
    - backend/routes/konfi.js
    - backend/routes/events.js
    - backend/services/pushService.js

key-decisions:
  - "Opt-out als Status-Wechsel (confirmed -> opted_out) statt Booking loeschen"
  - "opt_out_reason bleibt bei Opt-in erhalten (per User-Decision)"
  - "DELETE-Guard verhindert Abmeldung von Pflicht-Events ueber alten Endpoint"

patterns-established:
  - "Opt-out/Opt-in als eigene Endpoints statt DELETE-Endpoint-Erweiterung"
  - "Fire-and-forget Push nach res.json() fuer non-blocking Response"

requirements-completed: [OPT-01, OPT-03]

duration: 2min
completed: 2026-03-09
---

# Phase 35 Plan 01: Opt-out Backend API Summary

**Opt-out/Opt-in Endpoints fuer Pflicht-Events mit reason-Validierung, DELETE-Guard und Push an Admins**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T17:23:33Z
- **Completed:** 2026-03-09T17:25:43Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- POST /konfi/events/:id/opt-out mit Begruendung (>=5 Zeichen), mandatory-Guard und event-vorbei-Guard
- POST /konfi/events/:id/opt-in setzt Status zurueck auf confirmed, opt_out_reason bleibt erhalten
- DELETE /konfi/events/:id/register lehnt Pflicht-Events mit 400 ab
- Push-Benachrichtigungen an Org-Admins bei Opt-out (mit Grund) und Opt-in
- Participants-Query liefert opt_out_reason und opt_out_date
- Konfi-Events-Query liefert korrektes is_registered und is_opted_out

## Task Commits

Each task was committed atomically:

1. **Task 1: DB-Schema + Opt-out/Opt-in Endpoints + DELETE-Guard** - `4d9acad` (feat)
2. **Task 2: Push-Methoden + Participants-Query erweitern** - `cfd1de2` (feat)

## Files Created/Modified
- `init-scripts/01-create-schema.sql` - opt_out_reason TEXT und opt_out_date TIMESTAMP Spalten + Migration
- `backend/routes/konfi.js` - Opt-out/Opt-in Endpoints, DELETE-Guard, is_opted_out in Events-Query
- `backend/routes/events.js` - Participants-Query mit opt_out_reason und opt_out_date
- `backend/services/pushService.js` - sendEventOptOutToAdmins und sendEventOptInToAdmins Methoden

## Decisions Made
- Opt-out als Status-Wechsel (confirmed -> opted_out) statt Booking loeschen - konsistent mit bestehendem Status-System
- opt_out_reason bleibt bei Opt-in erhalten (per User-Decision aus Research)
- DELETE-Guard verhindert Abmeldung von Pflicht-Events ueber alten Endpoint

## Deviations from Plan

None - Plan exakt wie geschrieben ausgefuehrt.

## Issues Encountered
None

## User Setup Required
None - keine externe Service-Konfiguration erforderlich.

Migration auf Live-DB:
```sql
ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS opt_out_reason TEXT;
ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS opt_out_date TIMESTAMP;
```

## Next Phase Readiness
- Backend-API komplett, bereit fuer Frontend-Integration (Plan 35-02)
- Alle Endpoints getestet ueber Verifikation (grep-basiert)

---
*Phase: 35-opt-out-flow*
*Completed: 2026-03-09*
