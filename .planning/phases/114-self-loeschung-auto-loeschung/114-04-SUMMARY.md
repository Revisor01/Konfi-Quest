---
phase: 114-self-loeschung-auto-loeschung
plan: 04
subsystem: backend-routes
tags: [postgres, soft-delete, dsgvo, ranking, visibility, rbac]

# Dependency graph
requires:
  - phase: 114-01
    provides: users.deleted_at TIMESTAMP NULL (Migration 082)
provides:
  - deleted_at IS NULL Filter an Kern-Sichtbarkeitsquellen (Konfi-Liste/Detail, Dashboard-/Profil-Ranking, Level-Aggregate)
  - beidseitig gefilterte RANK()-Subqueries (korrekte Rang-Gesamtzahl ohne Phantom-Konfis)
affects: [Soft-Delete-Filter-Sweep Teil 2 (Plan 114-05: Events, Chat, Wrapped, Badges)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Soft-Delete-Filter in WHERE-Bedingung (nicht JOIN-ON), damit LEFT JOINs nicht zu INNER werden"
    - "Beidseitige RANK()-Filterung (u und u2), damit Rang-Position UND Gesamtzahl konsistent bleiben"

key-files:
  created: []
  modified:
    - backend/routes/konfi-management.js
    - backend/routes/konfi.js
    - backend/routes/levels.js
    - backend/tests/routes/konfi-management.test.js
    - backend/tests/routes/konfi.test.js
    - backend/tests/routes/levels.test.js

key-decisions:
  - "Konfi-Detail-Query (role IN konfi/teamer) erhaelt deleted_at IS NULL — schliesst nur soft-geloeschte Konfis aus; Teamer bleiben unberuehrt, da sie nie soft-geloescht werden (D-10)"
  - "Teamer-Liste (GET /teamer) und promote-teamer bleiben bewusst ungefiltert (D-10 Teamer nie soft-geloescht, D-07 Promote arbeitet im Rettungsfenster vor Tag 60)"
  - "RANK()-Subqueries in konfi.js (Dashboard + Profil identisch) beidseitig gefiltert (u und u2), sonst zaehlt ein archivierter Konfi noch in total_in_jahrgang hinein (T-114-10)"

patterns-established:
  - "Jede Query, die Konfis als sichtbare Personen liefert, ergaenzt AND u.deleted_at IS NULL am passenden Alias"

requirements-completed: [D-08, D-12]

# Metrics
duration: 9min
completed: 2026-05-31
---

# Phase 114 Plan 04: Soft-Delete-Filter-Sweep Teil 1 (Kern-Sichtbarkeit) Summary

**deleted_at IS NULL Filter an allen Kern-Konfi-Query-Stellen (Admin-Liste/Detail, Konfi-Dashboard- und Profil-Ranking, Level-Aggregate) mit beidseitig gefilterten RANK()-Subqueries, damit soft-geloeschte Konfis ab Tag 60 nirgends mehr erscheinen und die Rangberechnung anderer Konfis nicht verfaelschen.**

## Performance

- **Duration:** 9 min
- **Tasks:** 3 von 3
- **Files modified:** 6

## Accomplishments

- **konfi-management.js:** `deleted_at IS NULL` in Konfi-Liste (GET /), DELETE-Existenz-Check und Konfi-Detail (GET /:id). Teamer-Liste und promote-teamer bewusst ungefiltert (D-10/D-07). 3 neue Tests.
- **konfi.js:** `deleted_at IS NULL` an 8 Stellen — Dashboard-Lookup, Dashboard-Ranking, Profil-Lookup, Profil-Stats sowie BEIDE Seiten der RANK()-Subqueries (u und u2) in Dashboard und Profil. 1 neuer Test prueft, dass ein soft-geloeschter Mit-Konfi nicht ins `total_in_jahrgang` zaehlt und nicht im ranking-Array erscheint.
- **levels.js:** `deleted_at IS NULL` im Level-Usage-Count-Aggregat und im Konfi-Level-Lookup. 1 neuer Test prueft 404 fuer soft-geloeschten Konfi.

## Task-Commits

| Task | Beschreibung | Commit |
| ---- | ------------ | ------ |
| 1 | konfi-management.js Filter (Liste, Detail, Delete-Check) + Tests | b9faedb |
| 2 | konfi.js Filter (Dashboard-/Profil-Ranking, RANK beidseitig) + Test | 7943807 |
| 3 | levels.js Filter (Aggregate) + Test | fec90b2 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] total_in_jahrgang ist String, nicht Number**
- **Found during:** Task 2 (Testlauf)
- **Issue:** PostgreSQL `COUNT(*)` liefert die Spalte als String; der erste Testentwurf erwartete `toBe(2)` (Number) und schlug fehl.
- **Fix:** Test-Assertion auf `Number(...)` umgestellt (vor `toBe`). Reine Test-Korrektur, keine Route-Aenderung.
- **Files modified:** backend/tests/routes/konfi.test.js
- **Commit:** 7943807

## Verification

- `vitest run tests/routes/konfi-management.test.js` -> 47 Tests gruen (44 vorher + 3 neu).
- `vitest run tests/routes/konfi.test.js` -> 16 Tests gruen (15 vorher + 1 neu).
- `vitest run tests/routes/levels.test.js` -> 19 Tests gruen (18 vorher + 1 neu).
- Filter-Counts: konfi-management.js 3x, konfi.js 8x, levels.js 2x `deleted_at IS NULL`.
- RANK()-Subqueries beidseitig gefiltert (u und u2) in Dashboard und Profil verifiziert.

## Bekannte vorbestehende Issues (out of scope)

- Im gemeinsamen Parallel-Lauf aller drei Suiten schlaegt sporadisch der vorbestehende Test "GET /api/levels > Jeder authentifizierte User bekommt 200 + Array" mit `error: deadlock detected` (parallele TRUNCATE-Contention in `truncateAll`) fehl. Dieses Artefakt ist bereits im 114-01-SUMMARY dokumentiert, unabhaengig von dieser Aenderung und betrifft KEINEN der neuen Soft-Delete-Tests. Isoliert laufen alle drei Suiten gruen. Nicht gefixt (Scope-Boundary).

## Self-Check: PASSED
