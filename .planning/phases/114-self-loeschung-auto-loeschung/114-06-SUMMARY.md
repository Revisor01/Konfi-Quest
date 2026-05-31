---
phase: 114-self-loeschung-auto-loeschung
plan: 06
subsystem: background-service
tags: [cron, node-cron, dsg-ekd, auto-deletion, soft-delete, cascade-delete, rbac]

# Dependency graph
requires:
  - phase: 114-01
    provides: deleteKonfiCascade(client, userId, organizationId), users.deleted_at + users.archived_at, jahrgaenge.confirmation_date NOT NULL
  - phase: 114-04/05
    provides: Soft-Delete-Sichtbarkeits-Filter (deleted_at IS NULL ueberall)
provides:
  - BackgroundService.runAutoDeletion(db) - taegliche 60/120-Tage-Auto-Loeschung je Jahrgang
  - BackgroundService.startAutoDeletionCron / stopAutoDeletionCron (0 2 * * * Europe/Berlin)
  - Registrierung in startAllServices + stopAllServices
affects: [DSG-EKD-Datenaufbewahrung, abgeschlossene Phase 114]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "node-cron Cron-Job mit Europe/Berlin Timezone analog startWrappedCron"
    - "Fehler-Isolation pro Jahrgang UND pro Konfi-Hard-Delete (try/catch je Ebene)"
    - "Idempotente Soft-Loeschung via WHERE deleted_at IS NULL"
    - "Teamer-Ausnahme via Rollen-Filter r.name='konfi' in Auswahl-Queries"

key-files:
  created:
    - backend/tests/services/autoDeletion.test.js
  modified:
    - backend/services/backgroundService.js

key-decisions:
  - "Hard-Delete (>=120 Tage) vor Soft-Delete (>=60 und <120) pro Jahrgang; 120er-Schwelle hat Vorrang, 60er-Query grenzt mit < 120 ab, sodass ein Konfi nie in beiden Buckets landet (T-114-17)"
  - "Jeder Hard-Delete-Kandidat in eigener Transaktion (BEGIN/deleteKonfiCascade/COMMIT, ROLLBACK bei Fehler); Fehler pro Konfi loggen und weitermachen, statt den ganzen Job abzubrechen (D-15)"
  - "Teamer-Ausnahme ausschliesslich ueber Rollen-Join r.name='konfi'; promotete Teamer (role_id gewechselt, teamer_since gesetzt) werden so nie erfasst, ohne separate teamer_since-Pruefung (D-10)"
  - "runAutoDeletion fuehrt Soft-Delete als einzelnes UPDATE ... FROM mit RETURNING aus (Bulk, idempotent durch deleted_at IS NULL)"

requirements-completed: [D-07, D-08, D-09, D-10, D-13, D-14, D-15]

# Metrics
duration: 9min
completed: 2026-05-31
---

# Phase 114 Plan 06: Auto-Loeschung Cron-Job Summary

**Taeglicher node-cron-Job (02:00 Europe/Berlin) loescht Konfis je Jahrgang ab confirmation_date: Tag 60 soft (deleted_at + archived_at), Tag 120 kaskadierend hart via deleteKonfiCascade, mit Teamer-Ausnahme, Idempotenz und Fehler-Isolation.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-31T18:09:00Z
- **Completed:** 2026-05-31T18:12:40Z
- **Tasks:** 2 von 2
- **Files modified:** 2

## Accomplishments

- **runAutoDeletion(db)** in backgroundService.js: laedt alle Jahrgaenge, verarbeitet je Jahrgang in eigener try/catch zuerst Hard-Delete-Kandidaten (CURRENT_DATE - confirmation_date >= 120) kaskadierend via `deleteKonfiCascade` (je Konfi eigene Transaktion, ROLLBACK bei Fehler), dann Soft-Delete-Kandidaten (>= 60 und < 120 Tage, deleted_at IS NULL) per Bulk-UPDATE mit deleted_at + archived_at = NOW().
- **Teamer-Ausnahme (D-10):** Beide Auswahl-Queries joinen `roles r` und filtern `r.name = 'konfi'`. Zu Teamer:innen promotete Personen (role_id gewechselt) werden nie erfasst.
- **Idempotenz (D-15):** Soft nur bei `deleted_at IS NULL`; Hard loescht die Zeile, ein zweiter Lauf findet sie nicht mehr. Mehrfachlauf am selben Tag aendert nichts.
- **Fehler-Isolation (D-15):** Fehler werden pro Jahrgang und pro Hard-Delete-Konfi abgefangen und geloggt; der Job laeuft weiter.
- **Cron-Registrierung:** `startAutoDeletionCron`/`stopAutoDeletionCron` (Schedule `0 2 * * *`, Timezone Europe/Berlin) analog zu `startWrappedCron`, eingereiht in `startAllServices` + `stopAllServices`. Neue Klassen-Property `autoDeletionCronTask`.
- **Tests:** 6 Integration-Tests (autoDeletion.test.js) gegen echte PostgreSQL-Test-DB, alle gruen.

## Task-Commits

| Task | Beschreibung | Commit |
| ---- | ------------ | ------ |
| 1 (RED) | Failing Tests fuer runAutoDeletion (6 Szenarien) | 4aaab42 |
| 1 (GREEN) | runAutoDeletion + Cron-Methoden implementiert | 1487888 |
| 2 | Cron-Registrierung in start/stopAllServices | 3a82e8c |

## TDD Gate Compliance

Task 1 wurde nach TDD-Zyklus ausgefuehrt:
- RED: `test(114-06)` Commit 4aaab42 (alle 6 Tests schlagen fehl - `runAutoDeletion is not a function`)
- GREEN: `feat(114-06)` Commit 1487888 (Implementierung, alle 6 Tests gruen)
- REFACTOR: nicht noetig (Methode bereits klar strukturiert)

## Test-Szenarien (alle gruen)

1. confirmation_date vor 60 Tagen -> deleted_at + archived_at gesetzt (Soft).
2. confirmation_date vor 120 Tagen -> User + abhaengige Tabellen (konfi_profiles, user_badges) entfernt (Hard).
3. confirmation_date vor 30 Tagen -> unveraendert (Rettungsfenster, D-07).
4. Promoteter Teamer (role=teamer, teamer_since gesetzt) im 120-Tage-Jahrgang -> nicht geloescht/archiviert (D-10).
5. Idempotenz: zweiter Lauf setzt deleted_at nicht erneut; Hard-Delete wirft beim Zweitlauf keinen Fehler.
6. Simulierter DB-Fehler beim Hard-Delete bricht den Job nicht ab; Soft-Delete eines anderen Jahrgangs wird trotzdem ausgefuehrt (D-15).

## Deviations from Plan

None - Plan exakt wie geschrieben ausgefuehrt. Die im Plan-Interface erwaehnten Cron-Methoden wurden zusammen mit runAutoDeletion in einem GREEN-Commit angelegt; die Task-2-relevante Registrierung in start/stopAllServices erfolgte als separater Commit.

## Verification

- `npx vitest run --config tests/vitest.config.ts tests/services/autoDeletion.test.js` -> 6 Tests gruen.
- `node -e "require('./services/backgroundService.js')"` -> laedt fehlerfrei.
- grep: `runAutoDeletion`, `deleteKonfiCascade`, `startAutoDeletionCron`, `0 2 * * *`, `this.startAutoDeletionCron(db)` alle vorhanden.

## Self-Check: PASSED
