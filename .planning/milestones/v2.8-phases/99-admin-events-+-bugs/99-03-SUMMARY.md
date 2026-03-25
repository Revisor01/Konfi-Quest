---
phase: 99-admin-events-+-bugs
plan: 03
subsystem: api
tags: [events, waitlist, booking, navigation, ionic]

requires:
  - phase: 99-admin-events-+-bugs
    provides: "bookingUtils mit promoteFromWaitlist"
provides:
  - "Kapazitaetspruefung vor Wartelisten-Nachruecken in events.js und konfi.js"
  - "Chat-Navigation ohne schwarzen Screen aus EventDetailView"
affects: []

tech-stack:
  added: []
  patterns: ["Kapazitaetspruefung in Callern statt in Utility-Funktion"]

key-files:
  created: []
  modified:
    - backend/routes/events.js
    - backend/routes/konfi.js
    - frontend/src/components/admin/views/EventDetailView.tsx

key-decisions:
  - "Kapazitaetspruefung in den Callern (events.js, konfi.js) statt in promoteFromWaitlist selbst"
  - "routerDirection root statt forward fuer Tab-Wechsel-Navigation"

patterns-established:
  - "Caller-seitige Kapazitaetspruefung: maxCapacity === 0 || confirmedCount < maxCapacity"

requirements-completed: [ABG-01, ABG-02]

duration: 2min
completed: 2026-03-25
---

# Phase 99 Plan 03: Backend-Bugfixes Warteliste + Chat-Navigation Summary

**Wartelisten-Nachruecken mit Kapazitaetspruefung und Chat-Navigation schwarzer Screen behoben**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-25T08:17:39Z
- **Completed:** 2026-03-25T08:19:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Wartelisten-Nachruecken prueft jetzt confirmedCount < maxCapacity vor dem Promote
- Bei Ueberbuchung (z.B. 3/2 durch Admin-Hinzufuegen) wird erst bei Unterschreitung nachgerueckt
- Chat-Navigation aus Event-Details nutzt routerDirection 'root' statt 'forward'

## Task Commits

Each task was committed atomically:

1. **Task 1: Wartelisten-Nachruecken nur bei Unterschreitung der Kapazitaet** - `b48acf9` (fix)
2. **Task 2: Chat-Navigation schwarzer Screen Fix** - `2baaa51` (fix)

## Files Created/Modified
- `backend/routes/events.js` - Kapazitaetspruefung vor promoteFromWaitlist in DELETE-Booking-Route
- `backend/routes/konfi.js` - Kapazitaetspruefung vor promoteFromWaitlist in Abmelde-Route
- `frontend/src/components/admin/views/EventDetailView.tsx` - routerDirection 'root' + Null-Check

## Decisions Made
- Kapazitaetspruefung in den Callern statt in promoteFromWaitlist: Die Funktion bleibt generisch, Caller haben den Kontext (max_participants)
- routerDirection 'root' statt 'forward': Verhindert Forward-Transition-Overlay beim Tab-Wechsel

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wartelisten-Logik korrekt, Chat-Navigation funktional
- Keine Blocker fuer weitere Phasen

---
*Phase: 99-admin-events-+-bugs*
*Completed: 2026-03-25*
