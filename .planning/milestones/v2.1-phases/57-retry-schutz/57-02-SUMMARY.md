---
phase: 57-retry-schutz
plan: 02
subsystem: api
tags: [idempotency, uuid, postgresql, deduplication, retry-safety]

requires:
  - phase: 57-retry-schutz
    provides: "axios-retry mit Exponential Backoff (Plan 01)"
provides:
  - "client_id UUID Spalten auf chat_messages und activity_requests"
  - "Deduplizierungs-Logik in POST /rooms/:roomId/messages und POST /konfi/requests"
  - "Race-Condition-Handling via UNIQUE Constraint + 23505 Error Code"
affects: [60-queue, 62-sync]

tech-stack:
  added: []
  patterns: [idempotency-key-pattern, check-then-insert-with-unique-fallback]

key-files:
  created:
    - backend/migrations/add_idempotency_keys.sql
  modified:
    - backend/routes/chat.js
    - backend/routes/konfi.js

key-decisions:
  - "Check-then-Insert statt ON CONFLICT: Einfacher mit bestehendem RETURNING + SELECT Pattern"
  - "Partieller UNIQUE Index (WHERE client_id IS NOT NULL) fuer Abwaertskompatibilitaet"

patterns-established:
  - "Idempotency-Key Pattern: client_id UUID optional im Body, Vorab-Check + UNIQUE Index als Fallback"
  - "Race-Condition-Handling: PostgreSQL Error Code 23505 abfangen und bestehende Ressource zurueckgeben"

requirements-completed: [RET-03]

duration: 2min
completed: 2026-03-21
---

# Phase 57 Plan 02: Backend-Idempotency-Keys Summary

**client_id UUID Deduplizierung fuer Chat-Nachrichten und Aktivitaets-Antraege mit Check-then-Insert + UNIQUE-Index-Fallback**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T08:38:01Z
- **Completed:** 2026-03-21T08:39:43Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- DB-Migration mit client_id UUID Spalten und partiellen UNIQUE Indizes fuer chat_messages und activity_requests
- Deduplizierungslogik in POST /rooms/:roomId/messages: Vorab-Check + Insert + Race-Condition-Handling
- Deduplizierungslogik in POST /konfi/requests: Vorab-Check + Insert + Race-Condition-Handling
- UUID-Validierung in beiden Validierungsarrays (express-validator)
- Vollstaendige Abwaertskompatibilitaet: client_id ist optional, bestehende Clients funktionieren weiterhin

## Task Commits

Each task was committed atomically:

1. **Task 1: DB-Migration + Idempotency-Logik in chat.js und konfi.js** - `014ef96` (feat)

## Files Created/Modified
- `backend/migrations/add_idempotency_keys.sql` - Migration: client_id UUID Spalten + partielle UNIQUE Indizes
- `backend/routes/chat.js` - Idempotency-Check, erweiterter INSERT, Race-Condition-Handling, UUID-Validierung
- `backend/routes/konfi.js` - Idempotency-Check, erweiterter INSERT, Race-Condition-Handling, UUID-Validierung

## Decisions Made
- Check-then-Insert statt ON CONFLICT: Einfacher mit bestehendem RETURNING + nachfolgendem SELECT Pattern. Bei Race Condition faengt der UNIQUE Index den Fehler.
- Partieller UNIQUE Index (WHERE client_id IS NOT NULL): Bestehende Zeilen ohne client_id verursachen keine Konflikte.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

Migration muss auf der Produktions-DB ausgefuehrt werden:
```bash
ssh root@server.godsapp.de "docker exec -i konfi-quest-db-1 psql -U konfi_user -d konfi_db" < backend/migrations/add_idempotency_keys.sql
```

## Next Phase Readiness
- Backend akzeptiert jetzt client_id UUIDs fuer Deduplizierung
- Frontend (Phase 60 Queue) kann client_id bei Chat-Nachrichten und Aktivitaets-Antraegen mitsenden
- Socket.io + HTTP-Idempotency-Interaktion fuer Queue-Phase (60) vorbereitet

---
*Phase: 57-retry-schutz*
*Completed: 2026-03-21*
