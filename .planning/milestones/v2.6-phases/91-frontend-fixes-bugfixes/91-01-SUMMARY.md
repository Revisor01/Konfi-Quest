---
phase: 91-frontend-fixes-bugfixes
plan: 01
subsystem: ui, api
tags: [react, ionic, useRef, useIonRouter, badge-progress, streak, navigation]

requires:
  - phase: 87-security-fixes
    provides: useOfflineQuery Stale-Closure Fix, Socket.IO Org-Isolation
provides:
  - LiveUpdateContext ohne Module-Scope Shared-State (useRef)
  - Event-Detail Navigation via useIonRouter (kein schwarzer Bildschirm)
  - Badge-Progress fuer streak und time_based Kriterien
affects: [frontend-navigation, badge-system, live-updates]

tech-stack:
  added: []
  patterns: [useRef fuer Provider-interne Maps, onNavigate Callback-Prop Pattern]

key-files:
  created: []
  modified:
    - frontend/src/contexts/LiveUpdateContext.tsx
    - frontend/src/components/admin/views/EventDetailView.tsx
    - frontend/src/components/admin/views/EventDetailSections.tsx
    - backend/routes/konfi.js

key-decisions:
  - "Streak/time_based Logik direkt in konfi.js statt shared Helper (minimal-invasiv)"
  - "onNavigate Callback-Prop statt useIonRouter in React.memo Komponente"

patterns-established:
  - "useRef fuer Provider-interne State-Maps statt Module-Scope"
  - "onNavigate Callback-Prop fuer Navigation in React.memo Sections"

requirements-completed: [ARCH-04, ARCH-05, BUG-01, BUG-02]

duration: 3min
completed: 2026-03-23
---

# Phase 91 Plan 01: Frontend-Fixes + Bugfixes Summary

**LiveUpdateContext useRef-Migration, Event-Detail useIonRouter-Navigation, streak/time_based Badge-Progress implementiert**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T18:49:38Z
- **Completed:** 2026-03-23T18:52:45Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- LiveUpdateContext listeners Map von Module-Scope in useRef verschoben (kein Shared-State zwischen Provider-Mounts)
- window.location.href in Event-Detail Chat- und Serie-Navigation durch useIonRouter ersetzt (kein schwarzer Bildschirm mehr)
- Badge-Progress fuer streak (Wochen-Streak) und time_based (Aktivitaeten im Zeitfenster) implementiert statt hardcoded 0

## Task Commits

Each task was committed atomically:

1. **Task 1: LiveUpdateContext listeners in useRef verschieben** - `b284938` (fix)
2. **Task 2: window.location.href durch useIonRouter ersetzen** - `ff33050` (fix)
3. **Task 3: Badge-Progress fuer streak und time_based implementieren** - `82dcf13` (feat)

## Files Created/Modified
- `frontend/src/contexts/LiveUpdateContext.tsx` - listeners Map in useRef statt Module-Scope
- `frontend/src/components/admin/views/EventDetailView.tsx` - useIonRouter fuer Chat + Serie Navigation
- `frontend/src/components/admin/views/EventDetailSections.tsx` - onNavigate Callback-Prop fuer Serie-Navigation
- `backend/routes/konfi.js` - streak und time_based Progress-Berechnung implementiert

## Decisions Made
- Streak/time_based Logik direkt in konfi.js implementiert statt shared Helper aus badges.js (minimal-invasiv, da module.exports-Pattern von badges.js keine einfache Funktion-Extraktion erlaubt)
- onNavigate Callback-Prop fuer SeriesEventsSection statt useIonRouter direkt in React.memo Komponente (Hooks nicht in memo-Wrapper moeglich)
- criteria_extra statt criteria_details fuer time_based Konfiguration (criteria_details existiert nicht in der DB)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] criteria_details durch criteria_extra ersetzt**
- **Found during:** Task 3 (Badge-Progress)
- **Issue:** Plan referenzierte `badge.criteria_details` das nicht existiert; die Tabelle nutzt `criteria_extra` (JSON string)
- **Fix:** `criteria_extra` parsen fuer time_based days/weeks Konfiguration
- **Files modified:** backend/routes/konfi.js
- **Verification:** node -c syntax check bestanden
- **Committed in:** 82dcf13 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Korrektur des Feldnamens war noetig fuer korrekte Funktion. Kein Scope-Creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Alle 4 Requirements (ARCH-04, ARCH-05, BUG-01, BUG-02) erledigt
- Frontend kompiliert fehlerfrei, Backend-Syntax korrekt
- Bereit fuer Deployment via git push

---
*Phase: 91-frontend-fixes-bugfixes*
*Completed: 2026-03-23*
