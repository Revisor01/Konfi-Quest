---
phase: 40-badges-aktivitaeten
plan: 02
subsystem: api, badges
tags: [badges, teamer, criteria, postgresql, express]

requires:
  - phase: 40-badges-aktivitaeten
    provides: user_badges/user_activities Tabellen, target_role Spalte
provides:
  - checkAndAwardBadges mit Teamer-Branch (5 Kriterien-Typen)
  - teamer_year Kriterium fuer aktive Teamer-Jahre
  - Teamer-Badge-API (GET badges, unseen, mark-seen)
  - Badge-Check-Trigger bei Teamer-Aktivitaeten und Event-Attendance
affects: [40-03, frontend-teamer-badges, teamer-dashboard]

tech-stack:
  added: []
  patterns: [teamer-branch-pattern, shared-helper-functions, fallback-chain]

key-files:
  created: []
  modified:
    - backend/routes/badges.js
    - backend/routes/teamer.js
    - backend/routes/activities.js
    - backend/routes/events.js

key-decisions:
  - "Streak-Logik und Badge-Insert als shared Funktionen extrahiert (DRY)"
  - "teamer_year Fallback-Kette: user_role_history -> aelteste Teamer-Aktivitaet -> 0 Jahre"
  - "activity_combination fuer Teamer unterstuetzt required_activities UND required_events"

patterns-established:
  - "Teamer-Branch: checkAndAwardBadges prueft Rolle und delegiert an checkAndAwardTeamerBadges"
  - "Teamer-Aktivitaets-Queries filtern immer mit a.target_role = 'teamer'"

requirements-completed: [BDG-02, BDG-03, BDG-04, BDG-05, BDG-06]

duration: 5min
completed: 2026-03-10
---

# Phase 40 Plan 02: Teamer-Badge-Engine und Badge-API Summary

**checkAndAwardBadges mit Teamer-Branch fuer 5 Kriterien-Typen, Teamer-Badge-API mit earned/unseen/mark-seen Endpoints, Badge-Check-Trigger bei Aktivitaets-Zuweisung und Event-Attendance**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-10T21:57:03Z
- **Completed:** 2026-03-10T22:02:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- checkAndAwardBadges verarbeitet Teamer mit activity_count, event_count, streak, activity_combination, teamer_year
- Punkte-basierte Kriterien werden fuer Teamer automatisch uebersprungen
- Teamer-Badge-API mit 3 Endpoints in teamer.js
- Badge-Check wird nach Aktivitaets-Zuweisung, QR-Check-in und manuellem Attendance-Update ausgeloest

## Task Commits

Each task was committed atomically:

1. **Task 1: checkAndAwardBadges Teamer-Branch implementieren** - `3a863c6` (feat)
2. **Task 2: Teamer-Badge-API und Badge-Check-Trigger** - `b0d14f8` (feat)

## Files Created/Modified
- `backend/routes/badges.js` - Teamer-Branch in checkAndAwardBadges, teamer_year Kriterium, shared Funktionen
- `backend/routes/teamer.js` - GET /teamer/badges, GET /teamer/badges/unseen, PUT /teamer/badges/mark-seen
- `backend/routes/activities.js` - Badge-Check jetzt auch fuer Teamer-Aktivitaeten
- `backend/routes/events.js` - Badge-Check nach QR-Check-in und manuellem Attendance-Update fuer Teamer

## Decisions Made
- Streak-Logik und Badge-Insert/Notification als shared Funktionen extrahiert um Duplikation zu vermeiden
- teamer_year nutzt Fallback-Kette: user_role_history (falls existent) -> aelteste Teamer-Aktivitaet -> 0 Jahre (Badge nicht verdienbar)
- activity_combination fuer Teamer unterstuetzt sowohl required_activities als auch required_events (z.B. Freizeit-Experte Badge)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Badge-Check nach Event-Attendance-Update in events.js**
- **Found during:** Task 2
- **Issue:** Plan erwahnt Badge-Check nach Event-Attendance, aber events.js hatte keinen Badge-Check fuer manuelle Attendance-Updates
- **Fix:** Badge-Check nach COMMIT bei attendance_status='present' in PUT /events/:id/participants/:id/attendance
- **Files modified:** backend/routes/events.js
- **Committed in:** b0d14f8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Notwendig damit Teamer-Badges auch bei manueller Attendance-Aenderung geprueft werden.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend vollstaendig bereit fuer Frontend-Integration (Plan 40-03)
- Teamer-Badge-API kann vom TeamerDashboard/Profil konsumiert werden
- Alle Badge-Trigger aktiv (Aktivitaeten + Events)

---
*Phase: 40-badges-aktivitaeten*
*Completed: 2026-03-10*
