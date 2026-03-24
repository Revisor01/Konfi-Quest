---
phase: 92-sicherheit-performance
plan: 02
subsystem: api
tags: [postgresql, caching, lru, performance, n-plus-one]

requires:
  - phase: 92-sicherheit-performance
    provides: "Basis-Sicherheit und Performance-Fixes"
provides:
  - "Badge-Cron mit Bulk Chat-Unread-Query statt N+1"
  - "verifyTokenRBAC LRU-Cache mit 30s TTL"
affects: [backend-performance, auth-middleware]

tech-stack:
  added: []
  patterns: ["LRU-Cache mit Map + TTL fuer Middleware-Caching", "Bulk-Query mit Map-Lookup statt N+1"]

key-files:
  created: []
  modified:
    - backend/services/backgroundService.js
    - backend/middleware/rbac.js

key-decisions:
  - "Kein externes LRU-Paket: Map + timestamp reicht fuer 500 Eintraege"
  - "30s Cache-TTL akzeptabler Kompromiss: gesperrte User max 30s Zugriff"
  - "checkAndAwardBadges bleibt pro User: zu komplexe Badge-Logik fuer Bulk"
  - "invalidateUserCache exportiert fuer zukuenftige Nutzung bei User-Mutationen"

patterns-established:
  - "LRU-Cache Pattern: Map mit {data, timestamp}, TTL-Check bei get, FIFO-Eviction bei max"
  - "Bulk-Query-Map Pattern: Eine Query, Ergebnis in Map, O(1) Lookup in Loop"

requirements-completed: [PERF-08, PERF-09]

duration: 2min
completed: 2026-03-23
---

# Phase 92 Plan 02: Backend-Performance Summary

**Badge-Cron N+1 durch Bulk Chat-Unread-Query eliminiert und verifyTokenRBAC mit LRU-Cache (30s TTL, 500 Eintraege) versehen**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T20:25:58Z
- **Completed:** 2026-03-23T20:27:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Chat-Unread-Berechnung im Badge-Cron von N einzelnen Queries auf 1 Bulk-Query umgestellt
- verifyTokenRBAC spart bei wiederholten Requests desselben Users 2 DB-Queries pro Request
- invalidateUserCache als Export fuer zukuenftige Cache-Invalidierung bei User-Mutationen

## Task Commits

Each task was committed atomically:

1. **Task 1: Badge-Cron Chat-Unread Bulk-Query** - `92ef90b` (perf)
2. **Task 2: verifyTokenRBAC LRU-Cache mit 30s TTL** - `bbbcbba` (perf)

## Files Created/Modified
- `backend/services/backgroundService.js` - Bulk chatUnreadMap statt per-User badgeQuery
- `backend/middleware/rbac.js` - LRU-Cache (userCache, getCachedUser, setCachedUser, invalidateUserCache)

## Decisions Made
- Kein externes LRU-Paket (lru-cache etc.) -- native Map mit timestamp-basiertem TTL reicht fuer den Use-Case
- 30s TTL als Kompromiss zwischen Performance und Sicherheit (gesperrte User haben max 30s Restzeit)
- checkAndAwardBadges bleibt pro User, da die Badge-Kriterien-Logik zu komplex fuer eine einzelne Bulk-Query ist
- invalidateUserCache exportiert, aber noch nicht in Routes eingebunden (kann spaeter bei User-Mutations-Routes genutzt werden)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend skaliert besser bei steigender User-Zahl (EKD-Verkauf Szenario)
- invalidateUserCache kann in auth.js/users.js Routes eingebunden werden wenn User-Daten geaendert werden

---
*Phase: 92-sicherheit-performance*
*Completed: 2026-03-23*
