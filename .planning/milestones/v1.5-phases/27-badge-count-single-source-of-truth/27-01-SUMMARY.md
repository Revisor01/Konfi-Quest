---
phase: 27-badge-count-single-source-of-truth
plan: 01
subsystem: ui
tags: [react-context, badge, websocket, polling, single-source-of-truth]

requires:
  - phase: 26-token-lifecycle
    provides: Push-Token Lifecycle und Badge-Grundstruktur
provides:
  - BadgeContext als zentrale Quelle fuer chatUnreadByRoom, chatUnreadTotal, pendingRequestsCount, pendingEventsCount
  - Bereinigter AppContext ohne chatNotifications
  - Schlanke MainTabs ohne eigenes Polling
affects: [27-02, chat, badges, notifications]

tech-stack:
  added: []
  patterns: [single-source-of-truth-context, promise-all-parallel-fetch, optimistic-state-update]

key-files:
  created: []
  modified:
    - frontend/src/contexts/BadgeContext.tsx
    - frontend/src/contexts/AppContext.tsx
    - frontend/src/components/layout/MainTabs.tsx
    - frontend/src/components/chat/ChatRoom.tsx
    - frontend/src/components/chat/ChatOverview.tsx
    - frontend/src/App.tsx

key-decisions:
  - "BadgeContext refreshAllCounts nutzt Promise.all fuer parallele API-Calls"
  - "markRoomAsRead macht optimistisches Update + API Call im Hintergrund"
  - "Polling 30s nur fuer Admin-Counts, Chat via WebSocket"
  - "totalBadgeCount als useMemo role-abhaengig: Admin = chat+requests+events, Konfi = nur chat"

patterns-established:
  - "Single Source of Truth: Alle Badge-Counts aus useBadge() Hook, nie lokaler State"
  - "Optimistic Update: markRoomAsRead setzt sofort State, API im Hintergrund"

requirements-completed: [BDG-01, BDG-03, BDG-04]

duration: 5min
completed: 2026-03-06
---

# Phase 27 Plan 01: Badge-Count Single Source of Truth Summary

**BadgeContext konsolidiert alle Badge-Counts (Chat, Antraege, Events) mit Promise.all Parallel-Fetch und optimistischem markRoomAsRead**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T09:50:04Z
- **Completed:** 2026-03-06T09:55:07Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- BadgeContext erweitert: chatUnreadByRoom, chatUnreadTotal, pendingRequestsCount, pendingEventsCount, totalBadgeCount
- AppContext komplett von chatNotifications befreit (State, Funktionen, useEffects)
- MainTabs liest alle Badge-Zahlen aus useBadge(), kein eigenes Polling mehr
- ChatOverview zeigt Unread-Counts aus BadgeContext mit API-Fallback

## Task Commits

Each task was committed atomically:

1. **Task 1: BadgeContext erweitern und AppContext/MainTabs bereinigen** - `9d130bd` (feat)
2. **Task 2: ChatOverview auf BadgeContext umstellen** - `a39ce46` (feat)

## Files Created/Modified
- `frontend/src/contexts/BadgeContext.tsx` - Zentraler Badge-Count Service mit refreshAllCounts, markRoomAsRead, chatUnreadByRoom
- `frontend/src/contexts/AppContext.tsx` - Bereinigt: chatNotifications State und 5 Funktionen entfernt
- `frontend/src/components/layout/MainTabs.tsx` - Schlank: kein eigenes Polling, liest aus useBadge()
- `frontend/src/components/chat/ChatRoom.tsx` - markRoomAsRead aus BadgeContext statt AppContext
- `frontend/src/components/chat/ChatOverview.tsx` - Unread-Counts aus chatUnreadByRoom, kein setBadgeCount
- `frontend/src/App.tsx` - Push-Listener nutzt refreshAllCounts statt setBadgeCount

## Decisions Made
- Promise.all fuer parallele API-Calls in refreshAllCounts (Chat-Rooms immer, Requests+Events nur fuer Admin)
- markRoomAsRead mit optimistischem State-Update + API POST im Hintergrund
- 30s Polling nur fuer Admin-Counts (Requests/Events haben kein WebSocket)
- totalBadgeCount role-abhaengig: Admin = chat+requests+events, Konfi = nur chat
- Badge.set() nutzt totalBadgeCount statt nur chatUnreadTotal

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] App.tsx setBadgeCount Referenz korrigiert**
- **Found during:** Task 1
- **Issue:** App.tsx nutzte setBadgeCount und PushNotificationSchema die nicht mehr im Interface existieren
- **Fix:** Push-Listener auf refreshAllCounts umgestellt, PushNotificationSchema Import entfernt
- **Files modified:** frontend/src/App.tsx
- **Verification:** TypeScript kompiliert fehlerfrei
- **Committed in:** 9d130bd

**2. [Rule 1 - Bug] markRoomAsRead API-Endpunkt korrigiert**
- **Found during:** Task 1
- **Issue:** BadgeContext nutzte PUT /chat/rooms/{id}/read, Backend erwartet POST /chat/rooms/{id}/mark-read
- **Fix:** API-Call auf api.post mit korrektem Pfad geaendert
- **Files modified:** frontend/src/contexts/BadgeContext.tsx
- **Verification:** Endpunkt-Check gegen backend/routes/chat.js bestaetigt POST
- **Committed in:** 9d130bd

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Beide Fixes notwendig fuer korrekte Funktion. Kein Scope Creep.

## Issues Encountered
- ChatRoom.tsx hatte lokale Funktion `markRoomAsRead` die mit dem gleichnamigen Import aus useBadge() kollidierte - geloest durch Alias `badgeMarkRoomAsRead`

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BadgeContext ist bereit als Single Source of Truth
- Plan 27-02 kann ChatOverview-UI und weitere Konsumenten anpassen
- TypeScript kompiliert fehlerfrei

---
*Phase: 27-badge-count-single-source-of-truth*
*Completed: 2026-03-06*
