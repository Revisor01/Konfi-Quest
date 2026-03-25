---
phase: 99-admin-events-+-bugs
plan: 02
subsystem: ui, api
tags: [ionic, actionsheet, push-notifications, events]

requires:
  - phase: 98-admin-teil-1
    provides: Admin Events Grundstruktur
provides:
  - Event-Absagen ActionSheet mit Datum und Konfi-Anzahl
  - Push-Benachrichtigung beim Loeschen abgesagter Events
  - Backend erlaubt Loeschung abgesagter Events trotz Buchungen
affects: [admin-events]

tech-stack:
  added: []
  patterns:
    - IonActionSheet fuer destruktive Aktionen mit Kontext-Info

key-files:
  created: []
  modified:
    - frontend/src/components/admin/pages/AdminEventsPage.tsx
    - frontend/src/components/admin/views/EventDetailView.tsx
    - backend/routes/events.js

key-decisions:
  - "ActionSheet statt prompt()/Alert fuer Event-Absagen (bessere UX mit Datum und Konfi-Anzahl)"
  - "Abgesagte Events duerfen trotz bestehender Buchungen geloescht werden (Booking-Check nur fuer aktive Events)"

patterns-established:
  - "ActionSheet mit subHeader fuer destruktive Aktionen die Kontext zeigen"

requirements-completed: [AEV-06, AEV-07, AEV-08]

duration: 4min
completed: 2026-03-25
---

# Phase 99 Plan 02: Event-Absagen-Flow und Loesch-Push Summary

**Event-Absagen nutzt ActionSheet mit Datum/Konfi-Anzahl, Loeschen abgesagter Events sendet Push an Konfis**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T08:23:29Z
- **Completed:** 2026-03-25T08:27:25Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Event-Absagen in AdminEventsPage und EventDetailView durch ActionSheet mit Event-Details ersetzt (kein prompt() mehr)
- Loesch-Dialog zeigt Konfi-Anzahl und Push-Hinweis bei abgesagten Events
- Backend DELETE-Route erlaubt Loeschung abgesagter Events und sendet Push an angemeldete Konfis

## Task Commits

Each task was committed atomically:

1. **Task 1: Event-Absagen ActionSheet in AdminEventsPage + EventDetailView** - `0e619c6` (feat)
2. **Task 2: Push-Benachrichtigung beim Loeschen abgesagter Events** - `246e3c9` (feat)

## Files Created/Modified
- `frontend/src/components/admin/pages/AdminEventsPage.tsx` - handleCancelEvent mit ActionSheet, deleteSingleEvent mit Konfi-Info
- `frontend/src/components/admin/views/EventDetailView.tsx` - handleCancelEvent mit ActionSheet, ban Icon Import, onBack() nach Absage
- `backend/routes/events.js` - DELETE-Route: abgesagte Events loeschbar, Push via sendEventCancellationToKonfis

## Decisions Made
- ActionSheet statt prompt()/Alert fuer Event-Absagen: Zeigt Datum und Konfi-Anzahl direkt im Dialog
- Abgesagte Events duerfen trotz bestehender Buchungen geloescht werden: Booking-Check wird nur fuer aktive Events angewendet

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Backend DELETE-Route blockiert Loeschung abgesagter Events**
- **Found during:** Task 2
- **Issue:** DELETE-Route prueft auf confirmed/waitlist Buchungen und gibt 409 zurueck - auch fuer abgesagte Events
- **Fix:** Booking-Check in if(!event.cancelled) gewrappt, damit abgesagte Events trotz Buchungen loeschbar sind
- **Files modified:** backend/routes/events.js
- **Verification:** Code-Review der Logik
- **Committed in:** 246e3c9

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Notwendig damit abgesagte Events ueberhaupt geloescht werden koennen. Ohne Fix waere die Push-Funktion nie erreichbar.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Event-Absagen und Loesch-Flows sind komplett
- Alle 3 Requirements (AEV-06, AEV-07, AEV-08) implementiert

---
*Phase: 99-admin-events-+-bugs*
*Completed: 2026-03-25*
