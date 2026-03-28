---
phase: 103-core-business-integration-tests
plan: 02
subsystem: backend-tests
tags: [integration-tests, konfi, chat, postgresql]
dependency_graph:
  requires: [101-02, 101-03]
  provides: [konfi-tests, chat-tests]
  affects: [backend/tests]
tech_stack:
  added: []
  patterns: [supertest-integration, truncate-seed-pattern]
key_files:
  created:
    - backend/tests/routes/konfi.test.js
    - backend/tests/routes/chat.test.js
  modified:
    - backend/tests/globalSetup.js
decisions:
  - globalSetup um fehlende Spalten erweitert (bonus_points.completed_date, user_badges.seen, event_points.description, chat_messages.*, chat_message_reactions)
metrics:
  duration: 517
  completed: "2026-03-28T03:17:00Z"
  tasks: 2
  files: 3
  tests_added: 39
---

# Phase 103 Plan 02: Konfi + Chat Integration-Tests Summary

Konfi-Dashboard/Profil/History und Chat-Raeume/Nachrichten/Teilnehmer mit 39 Tests gegen echte PostgreSQL abgesichert.

## Task Results

| Task | Name | Commit | Files | Tests |
|------|------|--------|-------|-------|
| 1 | Konfi Integration-Tests | 940a7da | konfi.test.js, globalSetup.js | 15 |
| 2 | Chat Integration-Tests | 91065e8 | chat.test.js, globalSetup.js | 24 |

## Implementation Details

### Task 1: Konfi Integration-Tests (15 Tests)

6 describe-Bloecke decken alle Konfi-Endpoints ab:

- **GET /api/konfi/dashboard**: Aggregierte Daten (Punkte, Level, Badges, Events, Ranking, Point-Config, Dashboard-Config)
- **GET /api/konfi/profile**: display_name, username, Punkte-Info, Jahrgang
- **GET /api/konfi/points-history**: Bonus-Eintraege aus Seed, Totals-Objekt (gottesdienst, gemeinde, total)
- **GET /api/konfi/activities**: Org-Filterung (Org 1 = 4 Aktivitaeten, Org 2 = 2)
- **GET /api/konfi/badges**: Badge-Liste fuer Konfi
- **GET /api/konfi/events**: Jahrgang-Assignment-Filterung via event_jahrgang_assignments, Cross-Org-Isolation

Alle Endpoints pruefen type-Check (Admin bekommt 403) und Auth (ohne Token 401).

### Task 2: Chat Integration-Tests (24 Tests)

8 describe-Bloecke decken Chat-CRUD und Datei-Endpoints ab:

- **GET /api/chat/rooms**: Konfi sieht eigene Raeume, Org-2-Isolation, Admin-Raeume
- **POST /api/chat/rooms**: Gruppenraum erstellen (nur Admin), Konfi 403, Validierung
- **POST /api/chat/direct**: Direct-Chat mit Admin, Konfi-zu-Konfi 403, Validierung
- **GET /api/chat/rooms/:id/messages**: Nachrichten lesen, Nicht-Teilnehmer 403
- **POST /api/chat/rooms/:id/messages**: Senden, Leere-Nachricht 400, Nicht-Teilnehmer 403
- **GET /api/chat/rooms/:id/participants**: Teilnehmer-Liste (4 im Jahrgangs-Chat)
- **POST /api/chat/rooms/:id/participants**: Admin fuegt hinzu, nur Gruppenchats
- **DELETE /api/chat/rooms/:id/participants/:uid/:type**: Entfernen + Verifikation
- **Datei-Endpoint**: Supertest file mock mit echten PNG Magic-Bytes, 415 bei falschen Bytes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] globalSetup fehlende DB-Spalten**
- **Found during:** Task 1 + Task 2
- **Issue:** Produktions-DB hat Spalten die weder in init-scripts noch Migrationen definiert sind
- **Fix:** globalSetup.js um folgende Spalten erweitert:
  - `bonus_points.completed_date` (DATE)
  - `user_badges.seen` (BOOLEAN)
  - `event_points.description` (TEXT)
  - `chat_messages.deleted_at`, `message_type`, `reply_to`, `file_name`, `file_size`, `client_id`
  - `chat_message_reactions` Tabelle komplett neu
- **Files modified:** backend/tests/globalSetup.js
- **Commits:** 940a7da, 91065e8

## Decisions Made

1. **event_jahrgang_assignments nicht in Seed:** Stattdessen in Tests manuell gesetzt, da Events ohne Jahrgang-Assignment nicht sichtbar sind (INNER JOIN). Das ist realistischer als globales Seeding.
2. **Datei-Test mit echten PNG Magic-Bytes:** Statt Fake-Content werden echte PNG-Header-Bytes verwendet (0x89504E47), damit validateMagicBytes den Upload akzeptiert.
3. **415 bei falschen Magic-Bytes akzeptiert:** validateMagicBytes gibt 415 (Unsupported Media Type) statt 400 zurueck -- Test angepasst.

## Self-Check: PASSED
