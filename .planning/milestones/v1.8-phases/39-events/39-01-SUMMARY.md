---
phase: 39-events
plan: 01
subsystem: api, database
tags: [express, postgres, events, teamer, booking, rbac]

requires:
  - phase: 38-rolle-app-shell
    provides: Teamer-Rolle mit user.type='teamer' und role_name='teamer'
provides:
  - teamer_needed und teamer_only DB-Spalten in events-Tabelle
  - Teamer-Booking/Cancel-Logik in POST/DELETE /:id/book
  - Teamer-Filter im GET / (teamer_only fuer Konfis ausgeblendet)
  - teamer_count im GET / Response
  - role_name im GET /:id Participants-Query
  - Punkte-Guard im QR-Check-in (nur Konfis)
affects: [39-02-frontend-events, teamer-ui, event-management]

tech-stack:
  added: []
  patterns: [isKonfi/isTeamer Guard-Pattern, Teamer-Bookings zaehlen nicht gegen Kapazitaet]

key-files:
  modified:
    - init-scripts/01-create-schema.sql
    - backend/routes/events.js

key-decisions:
  - "Teamer-Bookings vereinfacht ohne Timeslot/Warteliste/Zeitfenster-Check"
  - "Teamer-Bookings zaehlen nicht gegen max_participants (Kapazitaet nur fuer Konfis)"
  - "QR-Check-in funktioniert fuer Teamer aber ohne Punkte-Vergabe"
  - "Push-Notifications an Org-Admins bei Teamer-Booking/Storno"

patterns-established:
  - "isKonfi/isTeamer Pattern: Beide Rollen in Booking-Endpoints mit fruehem Return fuer Teamer-Pfad"
  - "Teamer-Count als separate SQL-Zaehlung mit JOIN auf users/roles"

requirements-completed: [EVT-01, EVT-02, EVT-03, EVT-04, EVT-05]

duration: 5min
completed: 2026-03-10
---

# Phase 39 Plan 01: Backend Teamer-Events Summary

**Teamer-Booking/Cancel/Filter/Check-in in events.js mit teamer_needed/teamer_only DB-Spalten und exklusivem Constraint**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-10T01:35:16Z
- **Completed:** 2026-03-10T01:40:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Events-Tabelle um teamer_needed/teamer_only Spalten mit gegenseitigem Ausschluss-Constraint erweitert
- Teamer:innen koennen sich fuer Events einbuchen (vereinfacht) und wieder abmelden
- Konfis sehen keine teamer_only Events, QR-Check-in vergibt keine Punkte an Teamer
- Participants-Query liefert role_name fuer Frontend-Trennung Konfis/Teamer

## Task Commits

1. **Task 1: DB-Schema und Backend Event-Erstellung/-Bearbeitung erweitern** - `d06eeb3` (feat)
2. **Task 2: Booking, Filter, Check-in und Participants fuer Teamer erweitern** - `bb920db` (feat)

## Files Created/Modified
- `init-scripts/01-create-schema.sql` - teamer_needed/teamer_only Spalten, Constraint, Index, Migration-Kommentar
- `backend/routes/events.js` - Teamer-Booking/Cancel, Filter, Check-in-Guard, Participants role_name, teamer_count

## Decisions Made
- Teamer-Bookings vereinfacht: Kein Timeslot, keine Warteliste, kein Registration-Zeitfenster-Check
- Teamer-Bookings zaehlen nicht gegen max_participants (Kapazitaet gilt nur fuer Konfis)
- QR-Check-in funktioniert fuer Teamer, aber Punkte werden nur an Konfis vergeben
- Push-Notifications an Org-Admins bei Teamer-Booking und Teamer-Storno

## Deviations from Plan

None - Plan exakt wie beschrieben ausgefuehrt.

## Issues Encountered

None

## User Setup Required

**Live-DB Migration erforderlich.** Folgende SQL-Befehle muessen auf der Produktions-Datenbank ausgefuehrt werden:
```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS teamer_needed BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS teamer_only BOOLEAN DEFAULT false;
ALTER TABLE events ADD CONSTRAINT events_teamer_exclusive CHECK (NOT (teamer_needed = true AND teamer_only = true));
CREATE INDEX IF NOT EXISTS idx_events_teamer ON events (teamer_needed, teamer_only) WHERE teamer_needed = true OR teamer_only = true;
```

## Next Phase Readiness
- Backend vollstaendig vorbereitet fuer Frontend-Integration (Plan 39-02)
- GET / liefert teamer_needed, teamer_only und teamer_count
- GET /:id Participants liefert role_name
- Booking/Cancel-Endpoints akzeptieren Teamer-Requests

---
*Phase: 39-events*
*Completed: 2026-03-10*
