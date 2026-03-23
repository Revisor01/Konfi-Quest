---
phase: 62-sync
plan: 01
subsystem: sync
tags: [websocket, cache, reconnect, stale-while-revalidate, custom-events]

# Dependency graph
requires:
  - phase: 56-cache
    provides: offlineCache Service + useOfflineQuery Hook
  - phase: 60-queue
    provides: writeQueue mit flush() + flushTextOnly()
  - phase: 55-network
    provides: networkMonitor + Socket.io Reconnect-Callbacks
provides:
  - offlineCache.invalidateAll() zum Stale-Markieren aller Cache-Eintraege
  - Koordinierte Reconnect-Sequenz (flush -> invalidate -> badges -> callbacks)
  - Koordinierte Resume-Sequenz (flush -> invalidate -> badges)
  - sync:reconnect CustomEvent als Bruecke zwischen Service-Schicht und React-Tree
affects: [63-cleanup, 65-navigation]

# Tech tracking
tech-stack:
  added: []
  patterns: [CustomEvent-Bridge fuer Service-to-Context Kommunikation, invalidateAll statt clearAll fuer SWR-kompatible Cache-Invalidierung]

key-files:
  created: []
  modified:
    - frontend/src/services/offlineCache.ts
    - frontend/src/services/websocket.ts
    - frontend/src/contexts/AppContext.tsx
    - frontend/src/contexts/BadgeContext.tsx

key-decisions:
  - "CustomEvent sync:reconnect statt direktem Import — websocket.ts hat keinen React-Kontext-Zugang"
  - "invalidateAll setzt timestamp=0 statt clearAll — Daten bleiben fuer SWR-Anzeige erhalten"
  - "Kein extra Debounce fuer Resume — writeQueue.flush hat internen Guard, invalidateAll ist idempotent"

patterns-established:
  - "CustomEvent-Bridge: Service-Schicht dispatcht Events, React-Kontexte hoeren darauf"
  - "Cache-Invalidierung per Timestamp-Reset statt Loeschung (SWR-kompatibel)"

requirements-completed: [SYN-01, SYN-02, SYN-03, SYN-04]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 62 Plan 01: Sync Summary

**Koordinierte Sync-Sequenz bei Socket.io Reconnect und App-Resume: flush -> invalidateAll -> badge-refresh in fester Reihenfolge**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T11:39:38Z
- **Completed:** 2026-03-21T11:41:09Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- offlineCache.invalidateAll() setzt alle Cache-Timestamps auf 0, sodass useOfflineQuery bei naechstem Render revalidiert
- websocket.ts fuehrt bei Reconnect die koordinierte Sequenz flush -> invalidate -> badge-event -> callbacks aus
- AppContext Resume-Handler fuehrt gleiche Sequenz aus (flush -> invalidate -> badge-refresh)
- BadgeContext hoert auf sync:reconnect CustomEvent und aktualisiert alle Badge-Counts

## Task Commits

Each task was committed atomically:

1. **Task 1: offlineCache.invalidateAll + koordinierte Reconnect-Sequenz** - `75d3329` (feat)
2. **Task 2: App-Resume Cache-Invalidierung + BadgeContext Listener** - `d878d42` (feat)

## Files Created/Modified
- `frontend/src/services/offlineCache.ts` - invalidateAll() Methode hinzugefuegt
- `frontend/src/services/websocket.ts` - Koordinierte Reconnect-Sequenz mit flush/invalidate/badges
- `frontend/src/contexts/AppContext.tsx` - Resume-Handler mit Cache-Invalidierung + Badge-Refresh
- `frontend/src/contexts/BadgeContext.tsx` - sync:reconnect Event Listener fuer refreshAllCounts

## Decisions Made
- CustomEvent sync:reconnect als Bruecke zwischen websocket.ts (Service) und BadgeContext (React) — direkter Import nicht moeglich da kein React-Kontext-Zugang
- invalidateAll setzt timestamp=0 statt Eintraege zu loeschen — Daten bleiben fuer SWR-Anzeige erhalten, werden bei naechstem Render revalidiert
- Kein extra Debounce noetig — writeQueue.flush() hat internen _flushing Guard, invalidateAll ist idempotent

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sync-Sequenz komplett, alle v2.1 App-Resilienz Phasen (55-62) abgeschlossen
- TypeScript Build kompiliert ohne Fehler

---
*Phase: 62-sync*
*Completed: 2026-03-21*
