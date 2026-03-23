---
phase: 31-punkte-logik-backend
plan: 02
subsystem: api
tags: [postgres, badges, ranking, case-when, punkte-logik]

requires:
  - phase: 30-db-schema-backend-endpoints
    provides: "gottesdienst_enabled/gemeinde_enabled Spalten auf jahrgaenge-Tabelle"
provides:
  - "checkAndAwardBadges mit Jahrgang-Config-Pruefung"
  - "Ranking-Queries mit CASE WHEN fuer aktive Punkte-Typen"
  - "Badge-Progress-Queries beruecksichtigen deaktivierte Typen"
affects: [32-punkte-logik-frontend]

tech-stack:
  added: []
  patterns: ["CASE WHEN j.gottesdienst_enabled THEN ... ELSE 0 END fuer bedingte Punkte-Summierung"]

key-files:
  created: []
  modified:
    - backend/routes/badges.js
    - backend/routes/konfi.js

key-decisions:
  - "Jahrgang-Config wird pro checkAndAwardBadges-Aufruf geladen (kein Cache)"
  - "Badge-Progress-Queries ebenfalls an aktive Typen angepasst (Deviation Rule 2)"
  - "totalPoints-Berechnung im JS-Code beruecksichtigt auch enabled-Flags"

patterns-established:
  - "Punkte-Aggregation: CASE WHEN j.gottesdienst_enabled THEN kp.gottesdienst_points ELSE 0 END"
  - "Jahrgang-Config-Check in Badge-Logik: jahrgangConfig?.gottesdienst_enabled"

requirements-completed: [PUI-04]

duration: 4min
completed: 2026-03-07
---

# Phase 31 Plan 02: Badge-Logik + Ranking-Queries Summary

**Badge-Vergabe und Ranking beruecksichtigen deaktivierte Punkte-Typen via Jahrgang-Config und CASE WHEN SQL**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-07T20:07:08Z
- **Completed:** 2026-03-07T20:11:08Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- checkAndAwardBadges laedt Jahrgang-Config und ueberspringt Punkte-Kriterien wenn Typ deaktiviert
- 3 Ranking-Queries (Dashboard Top-3, Dashboard RANK(), Profil) summieren nur aktive Punkte-Typen via CASE WHEN
- Badge-Progress-Queries fuer total_points, gottesdienst_points, gemeinde_points, both_categories angepasst

## Task Commits

Each task was committed atomically:

1. **Task 1: Badge-Logik fuer deaktivierte Punkte-Typen anpassen** - `ec1d8de` (feat)
2. **Task 2: Ranking-Queries auf aktive Punkte-Typen umstellen** - `0916a57` (feat)

## Files Created/Modified
- `backend/routes/badges.js` - Jahrgang-Config laden, 4 Kriterien-Typen pruefen gottesdienst_enabled/gemeinde_enabled
- `backend/routes/konfi.js` - 3 Ranking-Queries mit CASE WHEN, Badge-Progress-Queries angepasst, Profil-Query laedt enabled-Flags

## Decisions Made
- Jahrgang-Config wird pro checkAndAwardBadges-Aufruf geladen (einfach, kein Caching noetig da Badge-Check selten)
- totalPoints-Berechnung im JS-Code (Dashboard + Profil) beruecksichtigt auch enabled-Flags fuer korrekte $2-Parameter-Uebergabe an SQL

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Badge-Progress-Queries an deaktivierte Typen angepasst**
- **Found during:** Task 2 (Ranking-Queries)
- **Issue:** Badge-Progress-Queries (total_points, gottesdienst_points, gemeinde_points, both_categories) in konfi.js nutzten noch direkte Punkte-Summe ohne Jahrgang-Config
- **Fix:** CASE WHEN Logik in Badge-Progress-Queries, both_categories prueft ob beide Typen aktiv
- **Files modified:** backend/routes/konfi.js
- **Verification:** grep zeigt CASE WHEN in allen relevanten Queries
- **Committed in:** 0916a57 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Auto-Fix noetig fuer Konsistenz - Badge-Progress muss gleiche Logik wie Badge-Vergabe verwenden.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend-Logik fuer Punkte-Typen vollstaendig
- Frontend (Phase 32) kann Ranking/Badge-Progress korrekt anzeigen
- Keine Blocker

---
*Phase: 31-punkte-logik-backend*
*Completed: 2026-03-07*

## Self-Check: PASSED
