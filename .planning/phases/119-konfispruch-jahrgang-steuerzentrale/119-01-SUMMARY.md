---
phase: 119-konfispruch-jahrgang-steuerzentrale
plan: 01
subsystem: backend
tags: [jahrgaenge, konfspruch, migration, validation]
requires: []
provides:
  - "jahrgaenge.konfspruch_enabled (BOOLEAN NOT NULL DEFAULT true)"
  - "POST/PUT/GET /admin/jahrgaenge mit konfspruch_enabled"
  - "jahrgaenge.confirmation_date nullable (NOT-NULL-Constraint aus 082 entfernt)"
affects:
  - "Folge-Plaene 119-* (Frontend-Toggle, Konfispruch-Card-Gate)"
tech-stack:
  added: []
  patterns:
    - "*_enabled-Spaltenmuster (analog 064 gottesdienst_enabled/gemeinde_enabled)"
    - "COALESCE($n, spalte) fuer partielle PUT-Updates"
key-files:
  created:
    - backend/migrations/094_jahrgang_konfspruch_enabled.sql
  modified:
    - backend/routes/jahrgaenge.js
    - backend/tests/routes/jahrgaenge.test.js
    - backend/tests/globalSetup.js
decisions:
  - "konfspruch_enabled DEFAULT true (D-03): prod-konsistent zum 118-Stand, Card bleibt sichtbar"
  - "confirmation_date DROP NOT NULL in Migration 094 (D-04): verhindert NOT-NULL-Violation in Prod"
metrics:
  duration: "~15 min"
  completed: "2026-06-09"
  tasks: 2
  files: 4
---

# Phase 119 Plan 01: Jahrgang-Steuerzentrale Datenmodell + Backend-Vertrag Summary

konfspruch_enabled-Flag auf jahrgaenge (D-01, SPRUCH-07) plus Entkopplung von confirmation_date als Pflicht-Eingabe (D-04) inklusive DROP des in Migration 082 gesetzten NOT-NULL-Constraints, damit die Jahrgang-Neuanlage ohne Konfirmationsdatum auch gegen das Prod-Schema funktioniert.

## Was gebaut wurde

### Task 1: Migration 094
- Neue Migration `094_jahrgang_konfspruch_enabled.sql` mit zwei idempotenten DDL-Schritten:
  1. `ALTER TABLE jahrgaenge ADD COLUMN IF NOT EXISTS konfspruch_enabled BOOLEAN NOT NULL DEFAULT true` (D-01, analog 064-Muster). DEFAULT true haelt bestehende Jahrgaenge prod-konsistent zum 118-Stand (Card war ohne Gate immer sichtbar, D-03).
  2. `ALTER TABLE jahrgaenge ALTER COLUMN confirmation_date DROP NOT NULL` (D-04). Entfernt den in Migration 082:24 gesetzten NOT-NULL-Constraint. In Postgres idempotent. Die Spalte bleibt physisch erhalten, wird ab jetzt nur nicht mehr beschrieben/erzwungen.

### Task 2 (TDD): jahrgaenge.js
- Validierung (`validateCreateJahrgang` + `validateUpdateJahrgang`): die `confirmation_date`-Pflichtregel (notEmpty/isISO8601) entfernt; `konfspruch_enabled` als `optional().isBoolean()` ergaenzt.
- POST: `confirmation_date` aus Destrukturierung, INSERT-Spaltenliste und params entfernt; `konfspruch_enabled` in Spaltenliste + params (Default true wenn undefined).
- PUT: `confirmation_date` aus Destrukturierung, SET-Klausel und params entfernt; `konfspruch_enabled` via `COALESCE($6, konfspruch_enabled)` ergaenzt. Parameter-Nummerierung neu durchnummeriert.
- GET '/': unveraendert (SELECT j.* liefert konfspruch_enabled automatisch).
- Veraltete confirmation_date-Kommentare entfernt (der String kommt nirgends mehr in jahrgaenge.js vor).
- Tests: Pflicht-confirmation_date-Faelle umgeschrieben (POST ohne -> 201, PUT ohne -> 200); neue Faelle fuer konfspruch_enabled (Default true, explizit false, Nicht-Boolean -> 400, PUT-Update + GET-Verifikation, COALESCE-Erhalt), GET-Test prueft konfspruch_enabled=true.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] konfspruch_enabled-Spalte im Test-Schema (globalSetup.js) ergaenzt**
- **Found during:** Task 2
- **Issue:** Die neuen Tests greifen auf `konfspruch_enabled` zu. Das Test-Schema (`backend/tests/globalSetup.js`) legt jahrgaenge-Spalten manuell an (Migrationen laufen im Test nicht). Ohne die Spalte waeren alle neuen konfspruch_enabled-Tests in CI nicht lauffaehig.
- **Fix:** `ALTER TABLE jahrgaenge ADD COLUMN IF NOT EXISTS konfspruch_enabled BOOLEAN NOT NULL DEFAULT true;` analog zu den bestehenden gottesdienst_enabled/gemeinde_enabled-Eintraegen ergaenzt.
- **Files modified:** backend/tests/globalSetup.js
- **Commit:** c2d4f33

Das Test-Schema hat `confirmation_date` bereits NULLABLE angelegt (kein NOT NULL) — die DROP-NOT-NULL-Wirkung von Migration 094 ist gegen das Prod-Schema relevant und kann lokal/CI nicht direkt getestet werden (dokumentierte Prod-vs-Test-Falle aus dem Plan-Objective).

`backend/tests/helpers/db.js`: jahrgaenge ist in truncateAll bereits abgedeckt — keine Aenderung noetig.

## Verification

- `node -e` Content-Check Migration 094: ok (konfspruch_enabled, IF NOT EXISTS, DEFAULT true, confirmation_date, DROP NOT NULL alle vorhanden).
- `node --check routes/jahrgaenge.js`: ok.
- `node --check tests/routes/jahrgaenge.test.js`: ok.
- `node --check tests/globalSetup.js`: ok.
- `grep -q konfspruch_enabled routes/jahrgaenge.js`: vorhanden. `! grep -q confirmation_date routes/jahrgaenge.js`: String kommt nicht mehr vor.
- vitest: NICHT lokal ausfuehrbar (kein Docker/Test-Postgres auf diesem Mac) — Ausfuehrung erfolgt in CI, wie im Plan vorgesehen.

## Self-Check: PASSED

- backend/migrations/094_jahrgang_konfspruch_enabled.sql: FOUND
- backend/routes/jahrgaenge.js: FOUND (geaendert)
- backend/tests/routes/jahrgaenge.test.js: FOUND (geaendert)
- backend/tests/globalSetup.js: FOUND (geaendert)
- Commit 4f8a555 (Migration): FOUND
- Commit c2d4f33 (Tests + Test-Schema): FOUND
- Commit 82f9573 (jahrgaenge.js): FOUND
