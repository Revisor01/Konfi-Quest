---
phase: 23-user-rechte-institutionen-debug
plan: 02
subsystem: api
tags: [rbac, jahrgang, teamer, organizations, cascade-delete, postgresql]

requires:
  - phase: 22-punkte-vergabe-debug
    provides: client.connect() Transaktions-Pattern
provides:
  - Jahrgang-gefilterte Aktivitäts-Zuweisung für Teamer
  - Jahrgang-gefilterte Events-Liste für Teamer
  - Transaktionssichere Org-Löschkette mit 33 DELETE-Queries
affects: [organizations, activities, events]

tech-stack:
  added: []
  patterns: [Teamer-Jahrgang-Filterung in assign-Endpunkten, explizite CASCADE-Löschkette in Transaktion]

key-files:
  created: []
  modified:
    - backend/routes/activities.js
    - backend/routes/events.js
    - backend/routes/organizations.js

key-decisions:
  - "Teamer-Jahrgang-Prüfung vor Aktivitäts-Zuweisung per konfi_profiles.jahrgang_id"
  - "Events ohne Jahrgang-Zuweisung bleiben für alle Teamer sichtbar"
  - "Org-Löschung entfernt alle 30+ Tabellen explizit statt CASCADE-Annahme"

patterns-established:
  - "Teamer-Assign-Guard: Vor jeder Konfi-Zuweisung Jahrgang-Berechtigung prüfen"
  - "Events-Teamer-Filter: Post-Query-Filter auf geladene Rows statt SQL-Subquery"

requirements-completed: [USR-02, USR-03]

duration: 2min
completed: 2026-03-05
---

# Phase 23 Plan 02: Jahrgang-Filter und Org-Löschkette Summary

**Teamer-Jahrgang-Filterung in Activities/Events und transaktionssichere Org-Löschung mit 33 DELETE-Queries**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-05T21:10:45Z
- **Completed:** 2026-03-05T21:12:26Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Teamer können bei Aktivitäts-Zuweisungen nur noch Konfis ihrer zugewiesenen Jahrgänge erreichen
- Events-Liste für Teamer auf zugewiesene Jahrgänge gefiltert (allgemeine Events bleiben sichtbar)
- Org-Löschung löscht alle abhängigen Daten (Chat, Events, Konfis, Badges, Notifications, Users, Rollen, Settings) transaktionssicher

## Task Commits

Each task was committed atomically:

1. **Task 1: Jahrgang-Filterung in Activities und Events absichern** - `f78b220` (feat)
2. **Task 2: Org-Löschung mit vollständiger CASCADE-Kette absichern** - `4df18e0` (feat)

## Files Created/Modified
- `backend/routes/activities.js` - Jahrgang-Zugriffsprüfung bei POST /assign-activity für Teamer
- `backend/routes/events.js` - Teamer sehen nur Events ihrer zugewiesenen Jahrgänge + allgemeine Events
- `backend/routes/organizations.js` - DELETE-Route mit 33 expliziten DELETE-Queries in Transaktion

## Decisions Made
- Teamer-Jahrgang-Prüfung bei Aktivitäts-Zuweisung: konfi_profiles.jahrgang_id gegen assigned_jahrgaenge.can_view prüfen
- Events-Filterung als Post-Query-Filter auf bereits geladene Rows (einfacher als SQL-Subquery bei STRING_AGG-Spalten)
- Allgemeine Events (ohne Jahrgang-Zuweisung) bleiben für alle Teamer sichtbar
- Org-Löschung entfernt explizit alle 30+ abhängigen Tabellen statt auf CASCADE zu vertrauen (da FK ohne CASCADE definiert)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Alle Jahrgang-bezogenen Berechtigungen in Activities und Events abgesichert
- Org-Löschung vollständig und sicher implementiert

---
*Phase: 23-user-rechte-institutionen-debug*
*Completed: 2026-03-05*
