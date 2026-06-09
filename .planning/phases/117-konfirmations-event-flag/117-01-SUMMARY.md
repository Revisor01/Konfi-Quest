---
phase: 117-konfirmations-event-flag
plan: 01
subsystem: backend/events
tags: [migration, events, is_konfirmation, rbac]
requires: []
provides:
  - "events.is_konfirmation (BOOLEAN DEFAULT false) via Migration 091"
  - "POST/PUT /api/events akzeptieren und validieren is_konfirmation"
  - "GET /api/events und GET /api/events/:id liefern is_konfirmation"
affects:
  - backend/routes/events.js
  - backend/migrations/091_event_is_konfirmation.sql
  - backend/tests/routes/events.test.js
tech-stack:
  added: []
  patterns: ["Boolean-Flag analog mandatory ohne Buchungslogik"]
key-files:
  created:
    - backend/migrations/091_event_is_konfirmation.sql
  modified:
    - backend/routes/events.js
    - backend/tests/routes/events.test.js
decisions:
  - "is_konfirmation strikt analog mandatory, aber OHNE Buchungs-Guards (nur Markierung/Farbe)"
  - "/series bleibt unveraendert (mandatory fehlt dort ebenso)"
  - "Kein Unique-Constraint: mehrere Events duerfen gleichzeitig is_konfirmation=true tragen"
metrics:
  duration: "~15 min"
  completed: "2026-06-09"
---

# Phase 117 Plan 01: Konfirmations-Event-Flag Backend Summary

Robustes Boolean-Flag `events.is_konfirmation` ersetzt die fragile String-basierte Kategorie-Erkennung; bestehende Konfirmation-Events werden per Migration verlustfrei auf das Flag ueberfuehrt.

## Was gebaut wurde

### Task 1: Migration 091 (`backend/migrations/091_event_is_konfirmation.sql`)
Exakte Reihenfolge (UPDATE VOR DELETE ist kritisch — sonst gehen die Match-Informationen verloren):
1. `ALTER TABLE events ADD COLUMN IF NOT EXISTS is_konfirmation BOOLEAN DEFAULT false;` (idempotent)
2. `UPDATE events ... SET is_konfirmation = true` ueber `event_categories JOIN categories` mit `c.name ILIKE '%konfirmation%'`
3. `DELETE FROM event_categories ... ILIKE '%konfirmation%'` (FK loesen)
4. `DELETE FROM categories WHERE name ILIKE '%konfirmation%'` (Kategorie entfernen, nicht mehr waehlbar)

Idempotent und Test-DB-sicher: bei leerer DB treffen UPDATE/DELETE 0 Zeilen. Kein Datenverlust an Events (nur Kategorie + Verknuepfung entfernt, Event bleibt mit gesetztem Flag).

### Task 2: `backend/routes/events.js` (genaue Zeilen, is_konfirmation analog mandatory)
- Validierung POST `validateCreateEvent`: Zeile 27 `body('is_konfirmation').optional().isBoolean()`
- Validierung PUT `validateUpdateEvent`: Zeile 36
- GET `/:id` SELECT-Spaltenliste: Zeile 527 (is_konfirmation direkt hinter mandatory ergaenzt)
- POST Destructuring: Zeile 664
- POST INSERT: Spaltenliste Zeile 699, neuer Platzhalter `$20`, Parameter `is_konfirmation || false` Zeile 709 (VALUES auf 25 Platzhalter erweitert)
- PUT Destructuring: Zeile 808
- PUT UPDATE: SET-Liste `is_konfirmation = $17` Zeile 837 (Folgenummern bis `$23` hochgezaehlt), Parameter `is_konfirmation || false` Zeile 846
- GET `/` Liste: UNVERAENDERT — `SELECT e.*` schleift das Flag automatisch durch
- `/series` (~Zeile 1700ff): UNVERAENDERT (verifiziert: kein is_konfirmation ab Zeile 1600). mandatory fehlt dort ebenso; strikt-analog bedeutet konsequente Auslassung (Series-Events sind weder Pflicht noch Konfirmation).
- KEINE Buchungs-Guards (effectivePoints o.ae.) auf is_konfirmation — Locked Decision.

grep-Zaehlung `is_konfirmation` in events.js: **9 Treffer** (>= 7 gefordert), alle an den geforderten Stellen.

### Task 3: Integrationstests (`backend/tests/routes/events.test.js`)
Neuer `describe('Konfirmations-Flag (is_konfirmation)')`-Block mit 6 Tests:
1. POST mit `is_konfirmation=true` -> GET /:id liefert true
2. POST ohne Flag -> Default false
3. PUT-Toggle false->true->false (beidseitig)
4. POST mit Nicht-Boolean -> 400 (Validierung greift)
5. Zwei Events gleichzeitig is_konfirmation=true (kein Unique-Constraint, KONF-04)
6. GET /api/events schleift Flag pro Event durch (via e.*)

grep-Zaehlung im Test: **22 Treffer** (>= 6 gefordert).

## Deviations from Plan
None - plan executed exactly as written.

## Verifikation
- `node -c backend/routes/events.js` -> Syntax OK
- `node -c backend/tests/routes/events.test.js` -> Syntax OK
- Migration-Statement-Check (node-Skript aus Plan) -> OK (alle 5 Pflicht-Strings vorhanden)
- `/series`-Bereich verifiziert ohne is_konfirmation

**Hinweis Test-Lauf:** `npx vitest run` konnte lokal NICHT ausgefuehrt werden (kein Docker auf diesem Mac -> keine Test-PostgreSQL). Erwartet und dokumentiert. Die Tests laufen in der GitHub-Actions-CI nach dem Push. Lokale Verifikation erfolgte per `node -c` (Syntax) + grep (alle is_konfirmation-Stellen sitzen).

## Vertrag fuer Plan 02 (Frontend)
- Flag heisst **`is_konfirmation`** (BOOLEAN).
- Kommt in **GET /api/events** (Liste, via e.*) UND **GET /api/events/:id** (Detail) mit.
- POST/PUT `/api/events` akzeptieren `is_konfirmation` als optionalen Boolean im Body (validiert analog mandatory; Nicht-Boolean -> 400).
- Default false. Kein Buchungsverhalten (nur Markierung/Farbe). Die alte Konfirmation-Kategorie existiert nach Migration nicht mehr.

## Self-Check: PASSED
- backend/migrations/091_event_is_konfirmation.sql: FOUND
- backend/routes/events.js: FOUND (is_konfirmation 9x)
- backend/tests/routes/events.test.js: FOUND (is_konfirmation 22x)
- Commit 16b7556 (Migration): FOUND
- Commit 2ab5bda (events.js + Tests): FOUND
