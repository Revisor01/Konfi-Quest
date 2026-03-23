---
phase: 67-performance-optimierung
plan: 02
subsystem: frontend, database
tags: [react, component-splitting, react-memo, sql-optimization, select-star]

requires:
  - phase: 67-performance-optimierung-01
    provides: "Erste Mega-Komponenten aufgeteilt"
provides:
  - "DashboardView in Haupt-Datei + DashboardSections aufgeteilt"
  - "ChatRoom in Haupt-Datei + ChatRoomSections aufgeteilt"
  - "16 SELECT * durch explizite Spalten in konfi.js, events.js, auth.js, badges.js"
affects: [frontend-components, backend-routes]

tech-stack:
  added: []
  patterns: ["React.memo fuer extrahierte Sektionen", "Explizite SQL-Spalten statt SELECT *"]

key-files:
  created:
    - frontend/src/components/konfi/views/DashboardSections.tsx
    - frontend/src/components/chat/ChatRoomSections.tsx
  modified:
    - frontend/src/components/konfi/views/DashboardView.tsx
    - frontend/src/components/chat/ChatRoom.tsx
    - backend/routes/konfi.js
    - backend/routes/events.js
    - backend/routes/auth.js
    - backend/routes/badges.js

key-decisions:
  - "DashboardView Sektionen-Datei mit 16 Exports (BADGE_ICONS, Popovers, EventCard, RankingSection, Utility-Helpers)"
  - "ChatRoom Sektionen-Datei mit ChatHeader, MessageInput, FilePreviewBar, Camera-Helpers, autoCapitalize, MIME_EXT_MAP"
  - "ChatRoom bleibt bei ~1124 Zeilen - weitere Reduktion erfordert Custom-Hooks (architekturelle Aenderung)"

patterns-established:
  - "Sektionen-Datei Pattern: Haupt-Komponente behaelt State/Effects, Sektionen-Datei bekommt UI-Sektionen + Helpers"

requirements-completed: [PERF-04, PERF-05, PERF-06]

duration: 15min
completed: 2026-03-21
---

# Phase 67 Plan 02: Mega-Komponenten + SELECT * Summary

**DashboardView von 1491 auf 565 Zeilen, ChatRoom von 1413 auf 1124 Zeilen aufgeteilt, 16 SELECT * in 4 Backend-Routes durch explizite Spalten ersetzt**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-21T13:33:25Z
- **Completed:** 2026-03-21T13:49:06Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- DashboardView auf 565 Zeilen reduziert (BADGE_ICONS Map, LevelPopoverContent, DashboardBadgePopoverContent, EventCard, RankingSection, LevelIconsRow, LevelProgress, 7 Utility-Funktionen nach DashboardSections.tsx extrahiert)
- ChatRoom auf 1124 Zeilen reduziert (ChatHeader, MessageInput, FilePreviewBar, ReplyPreview, Camera-Helpers, autoCapitalize, MIME_EXT_MAP nach ChatRoomSections.tsx extrahiert)
- Alle 16 SELECT * in konfi.js (7), events.js (4), auth.js (3), badges.js (2) durch explizite Spalten ersetzt

## Task Commits

1. **Task 1: DashboardView + ChatRoom aufteilen** - `decf6fc` (refactor)
2. **Task 2: SELECT * durch explizite Spalten ersetzen** - `2a60082` (perf)

## Files Created/Modified
- `frontend/src/components/konfi/views/DashboardSections.tsx` - 792 Zeilen, 16 Exports (BADGE_ICONS, getIconFromString, LevelPopoverContent, DashboardBadgePopoverContent, getGreeting, getInitials, getFirstName, formatTimeUntil, formatEventTime, formatEventDate, getBadgeColor, EventCard, RankingSection, LevelIconsRow, LevelProgress, LevelPopoverData Interface)
- `frontend/src/components/chat/ChatRoomSections.tsx` - 423 Zeilen, 9 Exports (getSafePreviewUrl, ChatHeader, ReplyPreview, FilePreviewBar, MessageInput, takePicture, selectFromGallery, autoCapitalize, MIME_EXT_MAP)
- `frontend/src/components/konfi/views/DashboardView.tsx` - 1491 -> 565 Zeilen
- `frontend/src/components/chat/ChatRoom.tsx` - 1413 -> 1124 Zeilen
- `backend/routes/konfi.js` - 7 SELECT * ersetzt (levels, activity_requests x3, event_bookings x2, event_timeslots)
- `backend/routes/events.js` - 4 SELECT * ersetzt (events x3, event_timeslots)
- `backend/routes/auth.js` - 3 SELECT * ersetzt (users, invite_codes, password_resets)
- `backend/routes/badges.js` - 2 SELECT * ersetzt (custom_badges konfi + teamer)

## Decisions Made
- DashboardView aggressiv aufgeteilt: Utility-Funktionen, Popover-Komponenten, EventCard, RankingSection und Level-UI als eigene Exports
- ChatRoom: Header und Footer/Input extrahiert, Camera-Helpers und Auto-Capitalize als reine Funktionen. Weitere Reduktion haette Custom-Hooks (useChatMessages, useChatActions) erfordert, was eine architekturelle Aenderung waere (Rule 4)
- Bei events.js FOR UPDATE Queries: Alle genutzten Spalten explizit gelistet (nicht nur die direkt im Code verwendeten, sondern auch die fuer spread-Operator an Frontend benoetigten)

## Deviations from Plan

**ChatRoom unter 750 Zeilen nicht erreicht (1124 statt <750)**
- Die restlichen ~370 Zeilen ueber dem Ziel sind WebSocket-Handler, Offline-Queue-Logik, sendMessage, toggleReaction, voteInPoll - alles eng an React State gekoppelt
- Weitere Reduktion erfordert Custom-Hooks-Pattern (architekturelle Aenderung), nicht im Scope dieses Plans
- DashboardView-Ziel dagegen deutlich uebertroffen: 565 statt <700

## Issues Encountered
- TypeScript-Fehler bei RefObject-Typen (HTMLIonTextareaElement | null vs HTMLIonTextareaElement) beim Extrahieren von MessageInput -- behoben durch Anpassung der Ref-Typen auf nullable

## User Setup Required
None - keine externe Konfiguration erforderlich.

## Next Phase Readiness
- Alle Frontend-Mega-Komponenten sind jetzt aufgeteilt oder dokumentiert warum nicht weiter reduzierbar
- Backend-Queries praeziser: weniger Daten ueber die Leitung, explizit dokumentiert welche Spalten existieren
- Bereit fuer Phase 68 (Token-Refresh) oder weitere Performance-Arbeit

---
*Phase: 67-performance-optimierung*
*Completed: 2026-03-21*
