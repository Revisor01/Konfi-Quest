---
phase: 75-backend-aggregation-db-schema
plan: 01
subsystem: api, database
tags: [postgresql, jsonb, aggregation, wrapped, express, rbac]

requires:
  - phase: none
    provides: bestehendes RBAC-System mit konfi_profiles, user_activities, event_bookings, user_badges, chat_messages
provides:
  - wrapped_snapshots Tabelle mit UNIQUE(user_id, wrapped_type, year)
  - jahrgaenge.wrapped_released_at Spalte
  - GET /api/wrapped/me Endpoint
  - GET /api/wrapped/status Endpoint
  - POST /api/wrapped/generate/:jahrgangId Endpoint
  - POST /api/wrapped/generate-teamer Endpoint
  - DELETE /api/wrapped/:jahrgangId Endpoint
  - generateKonfiSnapshot Aggregations-Funktion (7 Slide-Datenbloecke)
  - generateTeamerSnapshot Aggregations-Funktion (6 Slide-Datenbloecke)
affects: [75-02-frontend-wrapped-slides, 76-frontend-swiper-slides, 77-share-cards]

tech-stack:
  added: []
  patterns: [JSONB-Snapshots mit versionierter Slide-Struktur, Inline-Migration-Pattern, UPSERT mit ON CONFLICT]

key-files:
  created:
    - backend/migrations/075_wrapped.sql
    - backend/routes/wrapped.js
  modified:
    - backend/server.js

key-decisions:
  - "Konfi-Snapshot mit 7 Slides: punkte, events, badges, aktivster_monat, chat, endspurt, zeitraum"
  - "Teamer-Snapshot mit 6 Slides: events_geleitet, konfis_betreut, badges, zertifikate, engagement, zeitraum"
  - "UPSERT erlaubt Admin-Override bei erneutem Generieren"
  - "Zeitraum fuer Konfis automatisch aus confirmation_date abgeleitet"

patterns-established:
  - "Wrapped JSONB version: 1 Schema fuer Forward-Kompatibilitaet"
  - "Transaktionale Batch-Generierung mit einzelnem Error-Logging statt Abbruch"

requirements-completed: [DAT-01, DAT-02, DAT-03, DAT-04, DAT-08]

duration: 3min
completed: 2026-03-22
---

# Phase 75 Plan 01: Backend-Aggregation + DB-Schema Summary

**wrapped_snapshots Tabelle + 5 API-Endpoints mit Konfi/Teamer-Aggregation (Punkte, Events, Badges, Chat, Endspurt-Flag)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T13:33:34Z
- **Completed:** 2026-03-22T13:36:42Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- wrapped_snapshots Tabelle mit UNIQUE-Constraint und Indizes angelegt
- Konfi-Aggregation: Punkte (Gottesdienst+Gemeinde+Bonus), Events, Badges, Chat, aktivster Monat, Endspurt-Flag
- Teamer-Aggregation: Events geleitet, Konfis betreut, Badges, Zertifikate, Jahre aktiv
- 5 Endpoints: GET /me, GET /status, POST /generate/:jahrgangId, POST /generate-teamer, DELETE /:jahrgangId
- Endspurt-Flag berechnet aus Punkte-Vergleich mit Jahrgangs-Zielwerten (DAT-08)

## Task Commits

Each task was committed atomically:

1. **Task 1: DB-Migration + Route-Grundgeruest + Server-Mounting** - `98c3eab` (feat)
2. **Task 2: Konfi-Aggregation + Teamer-Aggregation + alle Endpoints** - `5b754f4` (feat)

## Files Created/Modified
- `backend/migrations/075_wrapped.sql` - DB-Schema mit wrapped_snapshots Tabelle + jahrgaenge.wrapped_released_at
- `backend/routes/wrapped.js` - Vollstaendige Wrapped-Route mit Aggregation und 5 Endpoints (555 Zeilen)
- `backend/server.js` - Route-Mounting fuer /api/wrapped

## Decisions Made
- Konfi-Snapshot Zeitraum wird aus confirmation_date abgeleitet (September Vorjahr bis Konfirmation)
- Lieblings-Event = letztes besuchtes Event (chronologisch)
- Teamer-Events basieren auf event_bookings (Teamer bucht sich fuer Events ein)
- Konfis betreut wird ueber teamer_jahrgang_assignments ermittelt
- Error pro einzelnem User wird geloggt, bricht nicht die Batch-Generierung ab

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend-Endpoints bereit fuer Frontend-Integration (Phase 76+)
- Migration muss auf dem Server ausgefuehrt werden (automatisch beim naechsten Deployment via Inline-Migration)
- wrapped_snapshots Tabelle wird bei erstem Route-Load automatisch erstellt

---
*Phase: 75-backend-aggregation-db-schema*
*Completed: 2026-03-22*
