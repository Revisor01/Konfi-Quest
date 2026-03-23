---
phase: 56-lese-cache
plan: 01
subsystem: ui
tags: [capacitor-preferences, swr, offline-cache, react-hooks]

requires:
  - phase: 55-netz-token
    provides: networkMonitor Service und tokenStore Pattern
provides:
  - offlineCache Service mit get/set/isStale/remove/clearAll via Capacitor Preferences
  - useOfflineQuery SWR-Hook fuer offline-faehige API-Queries
  - CACHE_TTL Konstanten fuer 11 Datentypen
  - Logout Cache-Clearing
affects: [56-02, 56-03, 56-04, 57-retry, 59-offline-ui]

tech-stack:
  added: []
  patterns: [SWR stale-while-revalidate, offlineCache Singleton, cache-prefix Isolation]

key-files:
  created:
    - frontend/src/services/offlineCache.ts
    - frontend/src/hooks/useOfflineQuery.ts
  modified:
    - frontend/src/services/auth.ts

key-decisions:
  - "CacheEntry speichert raw data (vor select) — select wird nur beim Setzen von state angewandt"
  - "cache: Praefix fuer Key-Isolation gegenueber tokenStore/anderen Preferences-Keys"
  - "clearAll loescht nur cache:-prefixed Keys, nicht Auth-Daten"

patterns-established:
  - "offlineCache.set/get Pattern: alle Cache-Zugriffe ueber offlineCache Singleton"
  - "useOfflineQuery als Standard-Hook fuer alle API-Queries mit Offline-Support"

requirements-completed: [CAC-01, CAC-10, CAC-11]

duration: 2min
completed: 2026-03-21
---

# Phase 56 Plan 01: Lese-Cache Grundlagen Summary

**offlineCache Service mit Capacitor Preferences und useOfflineQuery SWR-Hook fuer offline-faehige API-Queries**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T07:08:00Z
- **Completed:** 2026-03-21T07:09:51Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- offlineCache Service mit get/set/isStale/remove/clearAll und 11 TTL-Konstanten
- useOfflineQuery Hook mit SWR-Pattern, Race-Condition-Schutz, Network-Listener
- Logout loescht automatisch alle gecachten API-Daten

## Task Commits

Each task was committed atomically:

1. **Task 1: offlineCache Service erstellen** - `deb5571` (feat)
2. **Task 2: useOfflineQuery Hook erstellen** - `9bdb526` (feat)
3. **Task 3: Logout Cache-Clearing integrieren** - `1e05b2d` (feat)

## Files Created/Modified
- `frontend/src/services/offlineCache.ts` - Cache-Service mit Capacitor Preferences, TTL-Konstanten
- `frontend/src/hooks/useOfflineQuery.ts` - SWR-Hook mit offline-Support, Race-Condition-Schutz
- `frontend/src/services/auth.ts` - offlineCache.clearAll() bei Logout

## Decisions Made
- CacheEntry speichert raw data vor select-Transformation, select wird nur beim state-Update angewandt
- cache: Praefix fuer Key-Isolation — tokenStore-Keys bleiben unberuehrt von clearAll()
- Reihenfolge bei Logout: erst clearAuth() (Token weg), dann offlineCache.clearAll() (Daten weg)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- offlineCache und useOfflineQuery sind bereit fuer Plans 02-04 (Page-Migration)
- Alle Interfaces exportiert und typisiert
- TypeScript kompiliert fehlerfrei

---
*Phase: 56-lese-cache*
*Completed: 2026-03-21*
