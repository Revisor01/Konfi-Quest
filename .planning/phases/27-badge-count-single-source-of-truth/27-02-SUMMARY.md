---
phase: 27-badge-count-single-source-of-truth
plan: 02
subsystem: api
tags: [postgresql, push-notifications, badge-count, background-service]

requires:
  - phase: 27-01
    provides: BadgeContext Single Source of Truth im Frontend
provides:
  - Erweiterte Badge-Query mit Chat + Antraege + Events fuer App-Icon Badge
affects: []

tech-stack:
  added: []
  patterns:
    - "Badge-Count als Summe von 3 Subqueries (chat_unread, pending_requests, pending_events)"
    - "CASE WHEN admin fuer role-spezifische Badge-Kategorien"

key-files:
  created: []
  modified:
    - backend/services/backgroundService.js

key-decisions:
  - "chat_read_status statt chat_participants.last_read_at fuer konsistente Unread-Berechnung"
  - "activities.organization_id statt konfi_profiles.organization_id fuer Antrags-Filterung (konsistent mit activities.js)"

patterns-established:
  - "Badge-Count Query: 3 Subqueries mit CASE WHEN fuer role-abhaengige Kategorien"

requirements-completed: [BDG-02]

duration: 1min
completed: 2026-03-06
---

# Phase 27 Plan 02: backgroundService Badge-Query Summary

**backgroundService Badge-Query erweitert um pending_requests und pending_events fuer Admin-User, Chat-Unread auf chat_read_status migriert**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-06T09:57:34Z
- **Completed:** 2026-03-06T09:58:42Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Badge-Query berechnet jetzt chat_unread + pending_requests + pending_events
- Admin-User bekommen Gesamt-Count (Chat + offene Antraege + unverbuchte Events) als App-Icon Badge
- Konfi-User bekommen weiterhin nur Chat-Unreads (CASE WHEN admin = 0 fuer non-admin)
- Chat-Unread Query auf chat_read_status Tabelle migriert (konsistent mit chat.js)

## Task Commits

Each task was committed atomically:

1. **Task 1: backgroundService Badge-Query um Antraege und Events erweitern** - `bd9d276` (feat)

## Files Created/Modified
- `backend/services/backgroundService.js` - Badge-Query erweitert mit 3 Subqueries (chat_unread, pending_requests, pending_events)

## Decisions Made
- chat_read_status statt chat_participants.last_read_at verwendet -- die aktuelle Query nutzte die alte cp.last_read_at, der Rest des Codebase (chat.js) nutzt chat_read_status. Migration fuer Konsistenz.
- activities.organization_id statt konfi_profiles.organization_id fuer pending_requests Filterung -- konsistent mit dem Pattern in activities.js routes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Chat-Unread Query auf chat_read_status migriert**
- **Found during:** Task 1
- **Issue:** Plan-Query nutzte konfi_profiles.organization_id fuer pending_requests, aber Codebase nutzt activities.organization_id. Zusaetzlich: backgroundService nutzte cp.last_read_at (veraltet), chat.js nutzt chat_read_status.
- **Fix:** Query angepasst auf chat_read_status und activities.organization_id
- **Files modified:** backend/services/backgroundService.js
- **Verification:** Service laedt fehlerfrei
- **Committed in:** bd9d276

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Fix war notwendig fuer Konsistenz mit dem restlichen Codebase. Kein Scope Creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Badge-Count Single Source of Truth komplett: Frontend (27-01) und Backend (27-02) berechnen jetzt identische Werte
- App-Icon Badge via Silent Push stimmt mit Frontend-BadgeContext ueberein

---
*Phase: 27-badge-count-single-source-of-truth*
*Completed: 2026-03-06*
