---
phase: 45-event-sichtbarkeit-filterung
plan: 01
subsystem: events, ui
tags: [postgresql, ionic, react, events, jahrgang-filter, auto-enrollment]

requires:
  - phase: 39-events
    provides: Event-System mit Bookings, Timeslots, Waitlist
provides:
  - Jahrgangs-gefilterter Konfi-Event-Query
  - Abgesagte-Events-Filterung nach Anmeldung
  - Auto-Enrollment bei Admin-Konfi-Erstellung
  - Segment-Reihenfolge Meine/Alle/Konfi
  - Opt-out-Button nur bei angemeldeten Pflicht-Events
affects: [45-02, events, konfi-management]

tech-stack:
  added: []
  patterns:
    - "INNER JOIN event_jahrgang_assignments fuer Jahrgangs-Filterung"
    - "Auto-Enrollment Pattern nach COMMIT fuer neue Konfis"

key-files:
  created: []
  modified:
    - backend/routes/konfi.js
    - backend/routes/konfi-managment.js
    - frontend/src/components/konfi/pages/KonfiEventsPage.tsx
    - frontend/src/components/konfi/views/EventsView.tsx
    - frontend/src/components/konfi/views/EventDetailView.tsx

key-decisions:
  - "Jahrgangs-Filter via INNER JOIN statt LEFT JOIN -- Konfi ohne Jahrgang sieht keine Events"
  - "Segment Meine als Default statt Alle -- persoenliche Relevanz zuerst"

patterns-established:
  - "Konfi-Event-Query filtert immer nach Jahrgang und blendet teamer_only aus"

requirements-completed: [EVT-v19-01, EVT-v19-02, EVT-v19-03, EVT-v19-04, EVT-v19-08]

duration: 3min
completed: 2026-03-18
---

# Phase 45 Plan 01: Event-Sichtbarkeit + Filterung Summary

**Konfi-Events nach Jahrgang gefiltert, Segment-Reihenfolge Meine/Alle/Konfi, Opt-out nur bei Anmeldung, Auto-Enrollment bei Konfi-Erstellung**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T20:53:52Z
- **Completed:** 2026-03-18T20:57:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Backend: Konfi-Event-Query filtert nach Jahrgang via INNER JOIN event_jahrgang_assignments
- Backend: Abgesagte Events ohne Anmeldung werden ausgeblendet, Teamer-Events ausgeschlossen
- Backend: Neue Konfis (Admin-Erstellung) werden automatisch zu Pflicht-Events enrollt
- Frontend: Segment-Reihenfolge Meine (Default) / Alle / Konfi
- Frontend: Opt-out-Button bei Pflicht-Events nur sichtbar wenn tatsaechlich angemeldet

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend -- Konfi-Event-Query Jahrgangs-Filter + Abgesagte-Events-Logik + Auto-Enrollment** - `64e8474` (feat)
2. **Task 2: Frontend -- Segment-Reihenfolge Meine/Alle/Konfi + Opt-out-Button-Fix** - `f7ff069` (feat)

## Files Created/Modified
- `backend/routes/konfi.js` - Jahrgangs-Filter, teamer_only-Ausschluss, abgesagte Events Logik
- `backend/routes/konfi-managment.js` - Auto-Enrollment bei Konfi-Erstellung
- `frontend/src/components/konfi/pages/KonfiEventsPage.tsx` - Segment-State meine/alle/konfirmation, Filter-Logik
- `frontend/src/components/konfi/views/EventsView.tsx` - Props-Typen, Segment-Buttons, Stats-Counts
- `frontend/src/components/konfi/views/EventDetailView.tsx` - Opt-out nur bei is_registered

## Decisions Made
- Jahrgangs-Filter via INNER JOIN statt LEFT JOIN -- Konfi ohne Jahrgang sieht keine Events (leeres Array)
- Segment "Meine" als Default statt "Alle" -- persoenliche Relevanz zuerst

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript-Fehler durch veraltete Tab-Namen in EventsView.tsx**
- **Found during:** Task 2 (Frontend Segment-Reihenfolge)
- **Issue:** EventsView.tsx hatte noch interne getFilteredEvents() und emptyMessage mit alten Tab-Namen 'upcoming'/'registered'
- **Fix:** Alle Referenzen auf 'meine'/'alle' umgestellt
- **Files modified:** frontend/src/components/konfi/views/EventsView.tsx
- **Verification:** TypeScript-Build fehlerfrei
- **Committed in:** f7ff069 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Notwendig fuer TypeScript-Kompilierung. Kein Scope-Creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 kann Admin-Event-Sichtbarkeit und Zuweisungs-UI umsetzen
- Backend-Filterung ist live, Frontend-Segmente sind aktiv

---
*Phase: 45-event-sichtbarkeit-filterung*
*Completed: 2026-03-18*
