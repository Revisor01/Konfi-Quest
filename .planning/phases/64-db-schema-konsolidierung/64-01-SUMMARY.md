---
phase: 64-db-schema-konsolidierung
plan: 01
subsystem: database
tags: [postgresql, indexes, foreign-keys, migrations, schema]

requires:
  - phase: none
    provides: existing DB schema with ~30 tables
provides:
  - 73 fehlende Indizes fuer alle haeufig abgefragten Spalten
  - 23 fehlende Foreign Key Constraints mit ON DELETE CASCADE
  - 2 idempotente SQL-Migrationsdateien
affects: [64-02, backend-performance, database-integrity]

tech-stack:
  added: []
  patterns: ["CREATE INDEX IF NOT EXISTS fuer idempotente Index-Migration", "DO-Block mit information_schema Check fuer idempotente FK-Migration"]

key-files:
  created:
    - backend/migrations/064_add_missing_indexes.sql
    - backend/migrations/064_add_missing_fks.sql
  modified: []

key-decisions:
  - "73 Indizes basierend auf tatsaechlichen WHERE/JOIN-Patterns in allen 17 Route-Dateien"
  - "Composite-Indizes fuer haeufige Multi-Column-Queries (event_status, room_created, user_org)"
  - "Alle FKs mit ON DELETE CASCADE passend zur bestehenden Organization-Delete-Kaskade"

patterns-established:
  - "Index-Namenskonvention: idx_{tabelle}_{spalte} bzw. idx_{tabelle}_{spalte1}_{spalte2}"
  - "FK-Namenskonvention: fk_{tabelle}_{referenz}"
  - "Idempotente FK-Migration via DO-Block mit information_schema.table_constraints Check"

requirements-completed: [SCHEMA-IDX, SCHEMA-FK]

duration: 3min
completed: 2026-03-21
---

# Phase 64 Plan 01: Fehlende Indizes und Foreign Keys Summary

**73 CREATE INDEX IF NOT EXISTS und 23 ADD CONSTRAINT FK-Statements fuer alle ~30 Tabellen basierend auf WHERE/JOIN-Analyse aller 17 Route-Dateien**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T13:02:30Z
- **Completed:** 2026-03-21T13:05:33Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- 73 fehlende Indizes identifiziert und als idempotente CREATE INDEX IF NOT EXISTS Statements erstellt
- 23 fehlende Foreign Key Constraints mit DO-Block IF NOT EXISTS Check und ON DELETE CASCADE erstellt
- Alle Indizes und FKs durch tatsaechliche Queries in den 17 Route-Dateien verifiziert

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration fuer fehlende Indizes erstellen** - `e5ff158` (feat)
2. **Task 2: Migration fuer fehlende Foreign Keys erstellen** - `99106b4` (feat)

## Files Created/Modified
- `backend/migrations/064_add_missing_indexes.sql` - 73 Indizes fuer users, konfi_profiles, event_bookings, events, chat_rooms/messages/participants, activities, badges, settings, material-Tabellen und Join-Tabellen
- `backend/migrations/064_add_missing_fks.sql` - 23 Foreign Keys fuer push_tokens, notifications, password_resets, event_points, chat_read_status, chat_polls, chat_poll_votes, bonus_points, activity_requests, event_bookings, user_activities, user_badges

## Decisions Made
- 73 Indizes statt der geplanten 20+ — mehr Tabellen als erwartet haben fehlende Indizes (material_*, certificate_types, user_certificates, categories, activity_category_assignments)
- Composite-Indizes nur wo tatsaechlich Multi-Column-WHERE in Routes vorkommt (z.B. event_bookings(event_id, status), chat_messages(room_id, created_at DESC), users(organization_id, role_id))
- Alle FKs mit ON DELETE CASCADE, da die bestehende Organization-Delete-Logik in organizations.js bereits manuell kaskadierend loescht

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

Migration muss auf dem Server ausgefuehrt werden:
```bash
ssh root@server.godsapp.de "docker exec -i konfi-quest-db-1 psql -U konfi_user -d konfi_db" < backend/migrations/064_add_missing_indexes.sql
ssh root@server.godsapp.de "docker exec -i konfi-quest-db-1 psql -U konfi_user -d konfi_db" < backend/migrations/064_add_missing_fks.sql
```

## Next Phase Readiness
- Index- und FK-Migration bereit zur Ausfuehrung auf Produktion
- Plan 64-02 (Schema-Konsolidierung/Altlasten) kann unabhaengig gestartet werden

---
*Phase: 64-db-schema-konsolidierung*
*Completed: 2026-03-21*

## Self-Check: PASSED
