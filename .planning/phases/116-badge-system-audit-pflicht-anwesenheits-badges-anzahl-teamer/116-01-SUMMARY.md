---
phase: 116-badge-system-audit-pflicht-anwesenheits-badges-anzahl-teamer
plan: 01
subsystem: backend/badges
tags: [badges, criteria-types, mandatory-events, teamer-year, rbac]
requires:
  - "events.mandatory (BOOLEAN, bestehend)"
  - "event_bookings.attendance_status ('present', bestehend)"
  - "users.teamer_since (DATE, Migration 064, bestehend)"
provides:
  - "criteria_type mandatory_event_count (Pflicht-Anwesenheits-Badge, target_role=konfi)"
  - "Konsistenz-Vertrag-Zaehl-Query fuer Pflicht-Events (Plan 02 uebernimmt sie woertlich)"
  - "teamer_year-Startjahr aus users.teamer_since (NULL-Fallback auf aelteste Aktivitaet)"
affects:
  - "backend/routes/konfi.js (Plan 02: Progress-Case mandatory_event_count muss identisch zaehlen)"
tech-stack:
  added: []
  patterns:
    - "Dedizierte COUNT-Query im switch-Case statt preloaded (preloaded.eventCount hat keinen mandatory-Filter)"
    - "INSERT-only-Badge-Vergabe (kein Entzug bei Schwellwert-Anhebung)"
key-files:
  created: []
  modified:
    - backend/routes/badges.js
    - backend/tests/routes/badges.test.js
decisions:
  - "mandatory_event_count zaehlt ausschliesslich events.mandatory=true UND attendance_status='present' (D-02)"
  - "target_role=konfi, INSERT-only ohne Entzug (D-03, D-06)"
  - "teamer_year-Startjahr aus users.teamer_since statt nicht-existenter user_role_history (D-08)"
metrics:
  duration: "~20 min"
  completed: 2026-05-31
  tasks: 2
  files: 2
---

# Phase 116 Plan 01: Backend-Wertungslogik Pflicht-Anwesenheit + Teamer-Jahre Summary

Neuer criteria_type `mandatory_event_count` (Pflicht-Anwesenheits-Badge fuer Konfis, zaehlt besuchte Pflicht-Events) plus Fix des `teamer_year`-Startjahrs auf `users.teamer_since` statt der nicht-existenten Tabelle `user_role_history`.

## Was umgesetzt wurde

### Task 1: criteria_type mandatory_event_count
- Neuer Eintrag in `CRITERIA_TYPES` (`backend/routes/badges.js`, nahe `event_count`): Label "Pflicht-Anwesenheit", description "Anzahl besuchter Pflicht-Events", Help-Text mit Beispielwert 12 und Hinweis, dass nur Pflicht-Events mit bestaetigter Anwesenheit zaehlen.
- Neuer `case 'mandatory_event_count'` im Konfi-Wertungs-switch. Dedizierte COUNT-Query (nicht `preloaded.eventCount`, da dieser keinen mandatory-Filter hat). `earned = parseInt(count) >= badge.criteria_value`.
- target_role=konfi (laeuft im Konfi-Branch), INSERT-only — kein Entzug bei spaeterer Schwellwert-Anhebung (bestehender `alreadyEarned`-Check unveraendert).

### Task 2: teamer_year-Startjahr aus users.teamer_since
- Den toten `user_role_history`-try/catch-Block ersetzt durch `SELECT teamer_since FROM users WHERE id = $1`.
- Wenn `teamer_since` gesetzt: `startYear = new Date(teamer_since).getFullYear()`.
- Wenn `teamer_since` NULL (Altdaten): bestehender Fallback auf `MIN(ua.completed_date)` der aeltesten Teamer-Aktivitaet unveraendert beibehalten.
- Restliche Logik (allDates sammeln, activeYears-Set, relevantYears-Filter `y >= startYear`, Vergleich gegen criteria_value) unveraendert.

## KONSISTENZ-VERTRAG (Plan 02 uebernimmt diese Query WOERTLICH)

Die Zaehl-Query fuer `mandatory_event_count` (im Konfi-Wertungs-switch in `backend/routes/badges.js`) lautet exakt:

```sql
SELECT COUNT(*) FROM event_bookings eb JOIN events e ON eb.event_id = e.id
WHERE eb.user_id = $1 AND eb.attendance_status = 'present' AND e.mandatory = true AND eb.organization_id = $2
```

Parameter: `$1 = userId`, `$2 = konfi.organization_id`.

Plan 02 (konfi.js Progress-Berechnung) MUSS fuer den `mandatory_event_count`-Progress-Case dieselbe Query mit denselben Filtern und Parametern verwenden, damit `progress.current` exakt dem Wertungs-Count entspricht (kein Wertung/Progress-Mismatch wie beim bestehenden activity_count-Bug).

## teamer_since-Startjahr-Logik (fuer Folgearbeiten)

```
1. SELECT teamer_since FROM users WHERE id = $1
   -> teamer_since gesetzt: startYear = YEAR(teamer_since)
2. teamer_since NULL: Fallback MIN(ua.completed_date) der aeltesten Teamer-Aktivitaet (target_role='teamer')
3. Nur Jahre >= startYear zaehlen (activeYears-Set, relevantYears-Filter unveraendert)
```

## Tests

Ergaenzt in `backend/tests/routes/badges.test.js`:

- **mandatory_event_count Wertung** (4 Tests): 12 Events -> Badge vergeben; 11 Events -> kein Badge; 5 Nicht-Pflicht + 3 nicht-besuchte Pflicht-Events -> kein Badge bei value=1; Schwellwert-Anhebung (3->12) -> bereits vergebenes Badge bleibt erhalten.
- **teamer_year Startjahr aus teamer_since** (3 Tests): teamer_since=2024 + Aktivitaeten 2024/2026 -> Badge bei value=2; teamer_since=2026 + Aktivitaet 2024 -> zaehlt nicht; teamer_since=NULL -> Fallback auf aelteste Aktivitaet (2023).

Ergebnis: `31 passed (31)` — alle neuen Tests gruen, keine Regression.

Hinweis Test-Detail: `event_bookings.attendance_status` hat einen CHECK-Constraint `IN ('present','absent')` — nicht-besuchte Buchungen werden in den Tests mit `'absent'` angelegt (nicht `'registered'`).

## Deviations from Plan

Keine inhaltlichen Deviations. Eine umgebungsbedingte Anpassung:

**[Rule 3 - Blocking] node_modules-Symlink im Worktree fehlte**
- **Found during:** Task 1 (erster Testlauf)
- **Issue:** `npx vitest` im Worktree konnte `vitest/config` nicht aufloesen (kein node_modules im Worktree).
- **Fix:** Symlink `backend/node_modules -> /Users/simonluthe/Documents/Konfipoints/backend/node_modules` angelegt. NICHT eingecheckt (untracked, wie vorgegeben).
- **Files modified:** keine (nur Symlink im Arbeitsverzeichnis)

## Verification

- `npx vitest run --config tests/vitest.config.ts tests/routes/badges.test.js` -> 31 passed (31)
- `grep -c "mandatory_event_count" backend/routes/badges.js` -> 2 (CRITERIA_TYPES + switch-case)
- `grep "user_role_history" backend/routes/badges.js` -> 0 Treffer (toter Pfad entfernt)
- `grep "teamer_since" backend/routes/badges.js` -> Treffer im teamer_year-case
- Keine Datei-Loeschungen, keine Schema-Migration (alle Spalten existieren bereits)

## Known Stubs

Keine.

## Self-Check: PASSED

- Dateien vorhanden: backend/routes/badges.js, backend/tests/routes/badges.test.js, 116-01-SUMMARY.md
- Commits vorhanden: 64e41a5 (test), 7bfe81e (feat), b32be6d (fix)
