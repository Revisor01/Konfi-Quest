---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Logik-Debug
status: in-progress
last_updated: "2026-03-05T21:13:45.000Z"
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 8
  completed_plans: 7
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung
**Current focus:** v1.4 Logik-Debug -- Phase 23: User-Rechte und Institutionen Debug

## Current Position

Phase: 23 (4 of 5) (User-Rechte und Institutionen Debug) -- IN PROGRESS
Plan: 23-01 complete (1 of 2)
Status: Plan 23-01 abgeschlossen, Plan 23-02 ausstehend
Last activity: 2026-03-05 -- Plan 23-01 last_login_at Fix und Org Rate-Limiter abgeschlossen

Progress: [########--] 87%

## Performance Metrics

**Velocity:**
- Total plans completed: 46 (v1.0-v1.3)
- Average duration: --
- Total execution time: --

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| v1.0-v1.3 | 46 | -- | -- |

## Accumulated Context

### Decisions

All v1.0-v1.3 decisions archived in PROJECT.md Key Decisions table.
- [23-01] last_login_at UPDATE gehoert ausschliesslich in den Login-Endpunkt, nicht in die Token-Verifikation
- [23-01] orgLimiter mit 20 req/15min auf alle Org-Endpunkte (inkl. GET)
- [22-02] konfi_profiles als Single Source of Truth fuer Punkte-Totals
- [22-02] Bonus-Endpunkt in konfi-managment.js konsolidiert mit Teamer-Berechtigung
- [22-01] client.connect() Pattern fuer alle Transaktionen statt db.query('BEGIN')
- [22-01] GREATEST(0, ...) bei allen Punkt-Abzuegen
- [22-01] Badge-Check und Push-Notifications nach COMMIT
- [21-01] getISOWeeksInYear Dec-28-Methode fuer korrekte Jahreswechsel-Behandlung
- [21-01] activity_combination filter+length statt every() fuer criteria_value Mindestanzahl
- [21-02] Alle 9 Umlaut-Ersetzungen in defaultBadges korrigiert
- [20-02] FOR UPDATE OF e fuer Row-Level-Locking bei Event-Registrierung
- [20-02] Nachrueck-Logik nach DELETE aber vor Response/Logging eingefuegt
- [20-01] Einheitlicher 'waitlist' Status statt 'pending' in events.js
- [20-01] Nachrueck-Logik innerhalb PUT-Transaktion vor COMMIT ausfuehren
- [20-01] Push-Notifications nach COMMIT senden

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-05
Stopped at: Completed 23-01-PLAN.md
Resume file: .planning/phases/23-user-rechte-institutionen-debug/23-01-SUMMARY.md
