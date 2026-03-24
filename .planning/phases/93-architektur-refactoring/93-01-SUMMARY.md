---
phase: 93-architektur-refactoring
plan: 01
subsystem: backend, frontend
tags: [bookingUtils, chatUtils, useOfflineQuery, refactoring, RBAC]

requires:
  - phase: 92-sicherheit-performance
    provides: "verifyTokenRBAC Migration, Upload-Validierung"
provides:
  - "chatUtils dynamischer Admin-Lookup pro Organisation"
  - "bookingUtils als shared Booking-Logik (5 Funktionen)"
  - "useOfflineQuery stabiler Fetcher via fetcherRef"
affects: [events, konfi, booking, offline-cache]

tech-stack:
  added: []
  patterns: [bookingUtils shared extraction, fetcherRef stability pattern]

key-files:
  created:
    - backend/utils/bookingUtils.js
  modified:
    - backend/utils/chatUtils.js
    - backend/routes/konfi.js
    - backend/routes/events.js
    - frontend/src/hooks/useOfflineQuery.ts

key-decisions:
  - "bookingUtils als pure DB-Logik ohne Push/liveUpdate"
  - "Teamer-Pfad in events.js bleibt separat (kein shared Booking)"
  - "fetcherRef analog zu bestehenden onSuccessRef/onErrorRef/selectRef"

patterns-established:
  - "bookingUtils: Shared Booking-Funktionen mit client/db als Parameter"
  - "fetcherRef: Ref-Pattern fuer instabile Callback-Dependencies in useCallback"

requirements-completed: [ARCH-06, ARCH-07, ARCH-08]

duration: 2min
completed: 2026-03-24
---

# Phase 93 Plan 01: Architektur-Refactoring Summary

**chatUtils dynamischer Admin-Lookup, bookingUtils mit 5 Shared-Funktionen, useOfflineQuery fetcherRef-Stabilisierung**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T00:08:49Z
- **Completed:** 2026-03-24T00:10:49Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- chatUtils.js nutzt dynamischen Admin-Lookup pro Organisation statt hardcodierter ID 1
- bookingUtils.js mit 5 exportierten Funktionen (checkExistingBooking, getEventWithCounts, determineBookingStatus, promoteFromWaitlist, validateRegistrationWindow)
- konfi.js und events.js delegieren Booking-Logik an bookingUtils (-96 Zeilen Duplikat-Code)
- useOfflineQuery revalidiert nur bei echtem cacheKey/ttl-Wechsel, nicht bei jedem Re-Render

## Task Commits

Each task was committed atomically:

1. **Task 1: chatUtils dynamischer Admin + bookingUtils Extraktion** - `a76ee9a` (feat)
2. **Task 2: konfi.js + events.js an bookingUtils delegieren** - `cbe96b7` (refactor)
3. **Task 3: useOfflineQuery Fetcher-Referenz stabilisieren** - `8854619` (fix)

## Files Created/Modified
- `backend/utils/bookingUtils.js` - 5 Shared-Funktionen fuer Event-Buchungslogik
- `backend/utils/chatUtils.js` - getFirstActiveAdmin() mit Organisation-Caching
- `backend/routes/konfi.js` - Nutzt getEventWithCounts + bestehende bookingUtils-Funktionen
- `backend/routes/events.js` - Import + Nutzung von 4 bookingUtils-Funktionen
- `frontend/src/hooks/useOfflineQuery.ts` - fetcherRef Pattern, fetcher aus deps entfernt

## Decisions Made
- bookingUtils als pure DB-Logik ohne Push/liveUpdate-Aufrufe (bleiben in Route-Handlern)
- Teamer-Pfad in events.js bleibt separater Block (einfaches INSERT, keine shared Logik noetig)
- fetcherRef analog zu bestehenden Ref-Patterns (onSuccessRef, onErrorRef, selectRef)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Alle 3 Architektur-Refactorings abgeschlossen
- Keine offenen Blocker
- Ready fuer naechste Phase oder v3.0 Onboarding

---
*Phase: 93-architektur-refactoring*
*Completed: 2026-03-24*
