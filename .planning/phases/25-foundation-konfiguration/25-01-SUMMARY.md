---
phase: 25-foundation-konfiguration
plan: 01
subsystem: database, api
tags: [postgresql, firebase, push-notifications, migration]

requires:
  - phase: none
    provides: Bestehende push_tokens Tabelle und Firebase-Integration
provides:
  - push_tokens Tabelle mit error_count und last_error_at Spalten
  - event_reminders Tabelle mit FK-Constraints
  - Firebase Error-Code Forwarding (errorCode im Return-Objekt)
  - Push-Type Registry Dokumentation (17 Types)
affects: [26-token-lifecycle, 27-event-reminders, 28-badge-sync, 29-silent-push]

tech-stack:
  added: []
  patterns: [SQL Migration mit IF NOT EXISTS fuer Idempotenz]

key-files:
  created:
    - backend/migrations/add_push_foundation.sql
  modified:
    - backend/push/firebase.js
    - backend/routes/notifications.js
    - backend/services/pushService.js

key-decisions:
  - "Push-Type Registry als Kommentar-Block in pushService.js statt separatem Config-File"
  - "Migration idempotent mit IF NOT EXISTS fuer sichere Wiederholbarkeit"

patterns-established:
  - "SQL Migrations in backend/migrations/ mit IF NOT EXISTS Pattern"
  - "Firebase Error-Code Forwarding: errorCode Feld im Return-Objekt"

requirements-completed: [CFG-01, CFG-02]

duration: 1min
completed: 2026-03-05
---

# Phase 25 Plan 01: Push Foundation Summary

**DB-Schema Migration (error_count, event_reminders), Firebase errorCode Forwarding und Push-Type Registry mit 17 dokumentierten Types**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-05T22:24:40Z
- **Completed:** 2026-03-05T22:25:51Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Migration-Datei mit push_tokens Erweiterung (error_count, last_error_at) und event_reminders Tabelle erstellt
- Firebase sendFirebasePushNotification gibt jetzt errorCode im Error-Return zurueck (null-safe)
- Push-Type Registry mit allen 17 Push-Types als Kommentar-Block in pushService.js dokumentiert
- Inline CREATE TABLE aus notifications.js Route entfernt (Schema jetzt nur noch in Migration)

## Task Commits

Each task was committed atomically:

1. **Task 1: SQL Migration-Datei und Notifications Route Cleanup** - `a82388b` (feat)
2. **Task 2: Firebase Error-Code Forwarding** - `314415d` (feat)
3. **Task 3: Push-Type Registry Dokumentation** - `064d859` (feat)

## Files Created/Modified
- `backend/migrations/add_push_foundation.sql` - DB-Schema Migration fuer push_tokens Erweiterung und event_reminders
- `backend/push/firebase.js` - errorCode Feld im Error-Return hinzugefuegt
- `backend/routes/notifications.js` - Inline CREATE TABLE Block entfernt
- `backend/services/pushService.js` - Push-Type Registry Kommentar-Block mit 17 Types

## Decisions Made
- Push-Type Registry als Kommentar-Block in pushService.js statt separatem Config-File (per User-Entscheidung in CONTEXT.md)
- Migration idempotent mit IF NOT EXISTS fuer sichere Wiederholbarkeit auf neuen und bestehenden Installationen

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

Migration muss auf der Produktionsdatenbank ausgefuehrt werden:
```bash
ssh root@server.godsapp.de "docker exec -i konfi-quest-db-1 psql -U konfi_user -d konfi_db" < backend/migrations/add_push_foundation.sql
```

## Next Phase Readiness
- error_count und last_error_at Spalten bereit fuer Phase 26 (Token-Lifecycle)
- event_reminders Tabelle bereit fuer Phase 27 (Event-Reminders)
- errorCode Forwarding bereit fuer Token-Cleanup Logik in Phase 26

---
*Phase: 25-foundation-konfiguration*
*Completed: 2026-03-05*
