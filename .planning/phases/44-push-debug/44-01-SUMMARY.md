---
phase: 44-push-debug
plan: 01
subsystem: api
tags: [firebase, push-notifications, apns, background-service]

requires: []
provides:
  - "Silent push (sendFirebaseSilentPush) fuer badge-count-only updates"
  - "sendNewBadgeNotification fuer sichtbare Push bei neuem Badge"
  - "Admin-Ausschluss aus Badge-Sync-Loop"
  - "Change-Detection fuer neue Badges im backgroundService"
affects: []

tech-stack:
  added: []
  patterns:
    - "Silent push via apns-push-type: background + content-available: 1"
    - "Badge Change-Detection: Vorher/Nachher-Vergleich user_badges Count"

key-files:
  created: []
  modified:
    - backend/push/firebase.js
    - backend/services/pushService.js
    - backend/services/backgroundService.js

key-decisions:
  - "Silent Push statt alert fuer badge-count-only: apns-push-type background mit priority 5"
  - "Admin-Ausschluss per SQL JOIN statt App-Level Filter"
  - "Badge-Query vereinfacht: nur chat_unread fuer Konfis/Teamer (pending_requests/pending_events waren Admin-only)"

patterns-established:
  - "sendFirebaseSilentPush fuer unsichtbare Badge-Updates"
  - "sendNewBadgeNotification fuer sichtbare Badge-Pushes mit Name"

requirements-completed: [PUSH-01]

duration: 2min
completed: 2026-03-18
---

# Phase 44 Plan 01: Ghost-Push-Fix Summary

**Silent Push fuer Badge-Count-Updates, Admin-Ausschluss aus Sync-Loop, Change-Detection fuer neue Badges**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T18:50:52Z
- **Completed:** 2026-03-18T18:52:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Ghost-Push-Bug geloest: sendBadgeUpdate nutzt jetzt silent push (kein title/body, kein sichtbarer Alert)
- Admins komplett aus dem 5-Minuten Badge-Sync-Loop ausgeschlossen per SQL WHERE r.name != 'admin'
- Change-Detection: user_badges Count wird vor/nach checkAndAwardBadges verglichen, sichtbare Push nur bei NEUEN Badges
- Neue Methode sendNewBadgeNotification sendet "Neues Badge erreicht!" mit Badge-Name

## Task Commits

Each task was committed atomically:

1. **Task 1: Firebase silent push + sendBadgeUpdate fixen + sendNewBadgeNotification** - `32578bb` (fix)
2. **Task 2: backgroundService -- Admins ausschliessen + Change-Detection** - `feea07d` (fix)

## Files Created/Modified
- `backend/push/firebase.js` - Neue sendFirebaseSilentPush Funktion (background push, content-available)
- `backend/services/pushService.js` - sendBadgeUpdate auf silent push umgestellt, sendNewBadgeNotification hinzugefuegt
- `backend/services/backgroundService.js` - Admin-Ausschluss, Badge-Query vereinfacht, Change-Detection mit checkAndAwardBadges

## Decisions Made
- Silent Push via apns-push-type: background mit priority 5 (statt alert mit priority 10)
- Admin-Ausschluss per SQL JOIN auf roles-Tabelle statt App-Level Check
- Badge-Query vereinfacht: pending_requests und pending_events entfernt (waren nur fuer Admins relevant)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ghost-Push-Bug ist gefixt, Deployment via git push
- Badge-Sync laeuft weiterhin alle 5 Minuten fuer Konfis und Teamer

---
*Phase: 44-push-debug*
*Completed: 2026-03-18*
