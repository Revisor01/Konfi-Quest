---
phase: 56-lese-cache
plan: 02
subsystem: ui
tags: [react, ionic, offline, cache, swr, useOfflineQuery, chat, websocket]

requires:
  - phase: 56-01
    provides: useOfflineQuery Hook und offlineCache Service

provides:
  - Alle 5 Konfi-Pages nutzen useOfflineQuery (Dashboard, Events, Badges, Requests, Profil)
  - ChatOverview und ChatRoom nutzen useOfflineQuery fuer initialen Load
  - SWR-Pattern auf allen migrierten Pages (Cache sofort, Hintergrund-Revalidierung)

affects: [56-03, 56-04]

tech-stack:
  added: []
  patterns:
    - "useOfflineQuery Migration-Pattern: Import hinzufuegen, useState+loadData+useEffect ersetzen, refresh() statt loadData()"
    - "Chat Hybrid-Pattern: useOfflineQuery fuer Initial-Load, lokaler State fuer WebSocket Live-Updates"
    - "Dashboard Multi-Query: 4 separate useOfflineQuery Calls mit unterschiedlichen TTLs"

key-files:
  created: []
  modified:
    - frontend/src/components/konfi/pages/KonfiDashboardPage.tsx
    - frontend/src/components/konfi/pages/KonfiEventsPage.tsx
    - frontend/src/components/konfi/pages/KonfiBadgesPage.tsx
    - frontend/src/components/konfi/pages/KonfiRequestsPage.tsx
    - frontend/src/components/konfi/pages/KonfiProfilePage.tsx
    - frontend/src/components/chat/ChatOverview.tsx
    - frontend/src/components/chat/ChatRoom.tsx

key-decisions:
  - "KonfiEventDetailPage nicht migriert - delegiert komplett an EventDetailView (shared View-Component)"
  - "ChatRoom Hybrid-Pattern: useOfflineQuery nur fuer Initial-Load, WebSocket-Listener manipulieren lokalen State direkt"
  - "ChatOverview useImperativeHandle bleibt backward-kompatibel (loadChatRooms -> refresh)"

patterns-established:
  - "Multi-Query Dashboard: Separate useOfflineQuery Calls mit eigenen TTLs statt einem grossen Promise.all"
  - "Chat Hybrid: useOfflineQuery Initial + lokaler State + WebSocket = Offline + Echtzeit"

requirements-completed: [CAC-02, CAC-03, CAC-04, CAC-05, CAC-06, CAC-09]

duration: 6min
completed: 2026-03-21
---

# Phase 56 Plan 02: Konfi-Pages und Chat-Komponenten auf useOfflineQuery migriert

**5 Konfi-Pages (Dashboard, Events, Badges, Requests, Profil) und 2 Chat-Komponenten (Overview, Room) nutzen SWR-Cache via useOfflineQuery -- Konfis sehen alle Daten auch offline**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-21T07:11:57Z
- **Completed:** 2026-03-21T07:18:24Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Alle Konfi-Pages (5 von 6, KonfiEventDetailPage hat keinen eigenen API-Call) nutzen useOfflineQuery mit passenden TTLs
- KonfiDashboardPage mit 4 separaten useOfflineQuery Calls (Dashboard 5min, Tageslosung 24h, Events 10min, Badges 30min)
- Chat-Raumliste offline lesbar, Chat-Nachrichten aus Cache beim Mount
- WebSocket-Live-Updates bleiben vollstaendig erhalten (kein Flackern, keine Regression)
- Netto -104 Zeilen (277 Insertions, 381 Deletions) durch Wegfall von manuellen Loading-Patterns

## Task Commits

Each task was committed atomically:

1. **Task 1: Konfi-Pages migrieren (6 Pages)** - `a18992e` (feat)
2. **Task 2: Chat-Komponenten migrieren (ChatOverview + ChatRoom)** - `0208aa6` (feat)

## Files Created/Modified
- `frontend/src/components/konfi/pages/KonfiDashboardPage.tsx` - 4 useOfflineQuery (Dashboard, Tageslosung, Events, Badges)
- `frontend/src/components/konfi/pages/KonfiEventsPage.tsx` - 1 useOfflineQuery, events-updated Listener erhalten
- `frontend/src/components/konfi/pages/KonfiBadgesPage.tsx` - 2 useOfflineQuery (Badges + Profile), mark-seen bleibt als POST
- `frontend/src/components/konfi/pages/KonfiRequestsPage.tsx` - 1 useOfflineQuery, DELETE bleibt als api.delete()
- `frontend/src/components/konfi/pages/KonfiProfilePage.tsx` - 1 useOfflineQuery
- `frontend/src/components/chat/ChatOverview.tsx` - 1 useOfflineQuery, WebSocket refresh() statt loadChatRooms()
- `frontend/src/components/chat/ChatRoom.tsx` - 1 useOfflineQuery fuer Initial-Load, lokaler State fuer Live-Updates

## Decisions Made
- KonfiEventDetailPage nicht migriert: Hat keinen eigenen API-Call, delegiert komplett an EventDetailView (shared View-Component ueber mehrere Rollen). EventDetailView-Migration waere separater Scope.
- ChatRoom Hybrid-Pattern gewaehlt: useOfflineQuery liefert nur initialen Load aus Cache, danach verwaltet lokaler messages-State die WebSocket-Live-Updates. 30s-Polling bleibt als Fallback.
- ChatOverview useImperativeHandle bleibt backward-kompatibel: Exposed `loadChatRooms` ruft intern `refresh()` auf.

## Deviations from Plan

### KonfiEventDetailPage uebersprungen

**Found during:** Task 1
**Issue:** KonfiEventDetailPage ist ein 24-Zeilen Router-Wrapper ohne eigenen API-Call. Die Datenfetching-Logik liegt komplett in EventDetailView (shared View-Component).
**Decision:** Nicht migriert, da kein useOfflineQuery-Ziel vorhanden. EventDetailView als shared Component hat eigenen Migrations-Scope.
**Impact:** Kein funktionaler Impact -- EventDetailView Migration kann in Plan 03 oder 04 erfolgen falls noetig.

---

**Total deviations:** 1 (scope-skip, nicht auto-fix)
**Impact on plan:** Minimal -- 5 von 6 Konfi-Pages migriert, die 6. hat keinen eigenen API-Call.

## Issues Encountered
None

## Known Stubs
None -- alle useOfflineQuery Calls sind vollstaendig verdrahtet mit echten API-Endpoints und passenden Cache-TTLs.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Konfi-Pages und Chat sind offline-faehig (Lese-Cache)
- Plan 03 (Admin-Pages) und Plan 04 (Teamer-Pages) koennen parallel starten
- EventDetailView (shared Component) koennte in einem separaten Plan migriert werden

## Self-Check: PASSED

All 7 modified files verified present. Both task commits (a18992e, 0208aa6) verified in git log.

---
*Phase: 56-lese-cache*
*Completed: 2026-03-21*
