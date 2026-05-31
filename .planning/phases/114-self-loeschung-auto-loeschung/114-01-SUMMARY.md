---
phase: 114-self-loeschung-auto-loeschung
plan: 01
subsystem: database
tags: [postgres, migration, soft-delete, dsgvo, cascade-delete, rbac]

# Dependency graph
requires:
  - phase: bestehende RBAC-Struktur
    provides: konfi-management.js Admin-Delete (inline 16-Tabellen-Kaskade als Vorlage)
provides:
  - users.deleted_at + users.archived_at (Soft-Delete-Marker, Tag-60/Tag-120-Unterscheidung)
  - partieller Index idx_users_deleted_at fuer Filter-Performance
  - jahrgaenge.confirmation_date NOT NULL (DB-Pflichtfeld) mit COALESCE-Backfill
  - deleteKonfiCascade(client, userId, organizationId) - gemeinsame kaskadierende Loesch-Funktion (Single Source of Truth)
affects: [Self-Delete Plan 02, Auto-Delete Cron Plan 05, Soft-Delete-Filter]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single Source of Truth fuer kaskadierende Loeschung (deleteKonfiCascade)"
    - "Transaktions-Steuerung beim Aufrufer (Funktion bekommt client, kein eigenes BEGIN/COMMIT)"
    - "Idempotente Migrationen mit IF NOT EXISTS + COALESCE-Backfill vor NOT NULL"

key-files:
  created:
    - backend/migrations/082_self_auto_deletion.sql
    - backend/utils/konfiDeletion.js
    - backend/tests/utils/konfiDeletion.test.js
  modified:
    - backend/routes/konfi-management.js
    - backend/routes/jahrgaenge.js
    - backend/tests/helpers/seed.js

key-decisions:
  - "deleteKonfiCascade fuehrt KEIN eigenes BEGIN/COMMIT aus - Aufrufer steuert Transaktion, damit Admin/Self/Auto-Delete dieselbe Funktion in ihre eigene Transaktion einbetten koennen (D-04)"
  - "confirmation_date-Backfill via COALESCE(confirmation_date, created_at::date) - konservativ, springt nie in die Vergangenheit, kein Jahrgang bleibt NULL (T-114-01)"
  - "jahrgaenge POST/PUT bekommen COALESCE-Fallback fuer confirmation_date (CURRENT_DATE bei POST, bestehender Wert bei PUT), damit der neue NOT NULL-Constraint bestehende Aufrufer nicht bricht"

patterns-established:
  - "Kaskadierende Loeschung: organization_id nur bei org-gebundenen Tabellen mitgeben (Scope-Schutz gegen versehentliches Loeschen fremder Daten, T-114-02)"
  - "Soft-Delete-Doppelmarker: archived_at (Tag 60) + deleted_at (Unsichtbarkeit) fuer Cron-gesteuerten zweistufigen Loesch-Prozess"

requirements-completed: [D-04, D-06, D-09, D-11]

# Metrics
duration: 12min
completed: 2026-05-31
---

# Phase 114 Plan 01: Fundament Self-/Auto-Loeschung Summary

**Schema-Migration (Soft-Delete-Spalten + confirmation_date NOT NULL) und gemeinsame kaskadierende Loesch-Funktion deleteKonfiCascade als Single Source of Truth fuer Admin/Self/Auto-Delete.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-31T08:52:00Z
- **Completed:** 2026-05-31T08:59:30Z
- **Tasks:** 3 von 3
- **Files modified:** 6

## Accomplishments

- **Migration 082** fuegt `deleted_at` und `archived_at` auf `users` hinzu (D-11), erstellt einen partiellen Index `idx_users_deleted_at` und macht `jahrgaenge.confirmation_date` nach COALESCE-Backfill zum NOT NULL-Pflichtfeld (D-06). Idempotent (zweimal anwendbar ohne Fehler, manuell gegen die Test-DB verifiziert).
- **deleteKonfiCascade** (backend/utils/konfiDeletion.js) kapselt die 16 DELETE-Statements in korrekter FK-Reihenfolge ohne eigene Transaktion (D-04). `organization_id` wird nur bei den 5 org-gebundenen Tabellen mitgegeben (Scope-Schutz).
- **Admin-Delete** (konfi-management.js) nutzt nun die gemeinsame Funktion statt 16 inline-Statements; Verhalten und Response-Texte unveraendert.
- **Tests:** 4 neue Tests fuer deleteKonfiCascade (User entfernt, abhaengige Tabellen leer, keine eigene Transaktion, Org-Isolation), bestehende 44 konfi-management-Tests bleiben gruen.

## Task-Commits

| Task | Beschreibung | Commit |
| ---- | ------------ | ------ |
| 1 | Migration 082 (Soft-Delete-Spalten + confirmation_date NOT NULL) | 88a581b |
| 2 (RED) | Failing test fuer deleteKonfiCascade | e87e714 |
| 2 (GREEN) | deleteKonfiCascade + seed.js-Fix | 3df8526 |
| 3 | Admin-Delete auf deleteKonfiCascade umgestellt + jahrgaenge Rule-3-Fix | 3a85aa5 |

## TDD Gate Compliance

Task 2 wurde nach TDD-Zyklus ausgefuehrt:
- RED: `test(114-01)` Commit e87e714 (Test schlaegt fehl - Modul existiert nicht)
- GREEN: `feat(114-01)` Commit 3df8526 (Implementierung, alle 4 Tests gruen)
- REFACTOR: nicht noetig (Funktion bereits minimal und sauber)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] seed.js verletzte neuen confirmation_date NOT NULL-Constraint**
- **Found during:** Task 2 (GREEN-Phase)
- **Issue:** Nach Migration 082 (confirmation_date NOT NULL) schlug die gemeinsame Seed-Funktion `seed()` fehl, weil jahrgaenge ohne `confirmation_date` eingefuegt wurden. Das blockierte ALLE Test-Suites, die seed() nutzen.
- **Fix:** `JAHRGAENGE`-Fixtures + INSERT in tests/helpers/seed.js um `confirmation_date` ergaenzt.
- **Files modified:** backend/tests/helpers/seed.js
- **Commit:** 3df8526

**2. [Rule 3 - Blocking] jahrgaenge POST/PUT brachen durch NOT NULL-Constraint**
- **Found during:** Task 3 (voller Suite-Lauf)
- **Issue:** Die jahrgaenge-Route erlaubte das Anlegen/Aktualisieren ohne `confirmation_date`; nach Migration 082 fuehrte das zu 500-Fehlern (5 jahrgaenge.test.js-Tests rot). Die Route steht nicht in `files_modified` des Plans, die Breakage ist aber direkte Folge der Migration aus diesem Plan.
- **Fix:** POST `INSERT ... COALESCE($2::date, CURRENT_DATE)` (Fallback heutiges Datum), PUT `confirmation_date = COALESCE($2::date, confirmation_date)` (behaelt bestehenden Wert). Mirror der Migration-Backfill-Philosophie, abwaertskompatibel.
- **Files modified:** backend/routes/jahrgaenge.js
- **Commit:** 3a85aa5

## Verification

- `vitest run tests/utils/konfiDeletion.test.js tests/routes/konfi-management.test.js tests/routes/jahrgaenge.test.js` -> 68 Tests gruen.
- Migration 082 idempotent (zweimal angewendet gegen Test-DB ohne Fehler).
- Kein inline-16-Statement-Block mehr im konfi-management.js DELETE-Handler.
- auth.test.js + teamer.test.js isoliert gruen (deren Fehler im vollen Parallel-Lauf sind vorbestehende `deadlock detected`-Artefakte in truncateAll, NICHT durch diese Aenderung verursacht).

## Bekannte vorbestehende Issues (out of scope)

- Beim vollstaendigen Parallel-Suite-Lauf treten sporadisch `deadlock detected`-Fehler in `truncateAll` auf (material.test.js u.a.). Das ist ein vorbestehendes Test-Infrastruktur-Problem (parallele TRUNCATE-Contention auf gemeinsamen Tabellen), unabhaengig von dieser Phase. Einzeln/in kleineren Gruppen laufen alle Suites gruen. Nicht gefixt (Scope-Boundary).

## Self-Check: PASSED
