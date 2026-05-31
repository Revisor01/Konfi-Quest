---
phase: 114-self-loeschung-auto-loeschung
plan: 03
subsystem: backend+frontend
tags: [express-validator, jahrgaenge, confirmation_date, dsgvo, validation, ionic]

# Dependency graph
requires:
  - phase: 114-01
    provides: jahrgaenge.confirmation_date NOT NULL (DB-Pflichtfeld) + COALESCE-Fallback in POST/PUT
provides:
  - confirmation_date als API-Pflichtfeld in Create + Update (notEmpty + isISO8601)
  - saubere 400-Antwort statt 500er Constraint-Violation bei fehlendem Datum
  - Frontend-Formular erzwingt Konfirmationsdatum vor dem Speichern
affects: [Auto-Delete Cron Plan 05 (verlaessliches confirmation_date als Fristbasis)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pflichtfeld-Validierung via express-validator notEmpty().isISO8601() statt optional()"
    - "Frontend-Doppelschutz: Save-Button disabled + Guard in handleSubmit mit Fehler-Toast"

key-files:
  created: []
  modified:
    - backend/routes/jahrgaenge.js
    - backend/tests/routes/jahrgaenge.test.js
    - frontend/src/components/admin/pages/AdminJahrgaengeePage.tsx

key-decisions:
  - "COALESCE-Fallback aus Plan 01 in POST (CURRENT_DATE) und PUT (bestehender Wert) entfernt: die notEmpty-Validierung garantiert nun einen gueltigen Wert, daher direkte Zuweisung $2::date statt COALESCE. Tests bleiben gruen."
  - "Frontend doppelt abgesichert: Save-Button disabled bei leerem Datum UND Guard in handleSubmit mit Fehler-Toast 'Bitte ein Konfirmationsdatum waehlen' (deckt Offline-WriteQueue-Pfad mit ab)"

patterns-established:
  - "Pflichtfeld mit zwei Fehlermeldungen: notEmpty (leer) und isISO8601 (Format) liefern getrennte, sprechende 400-Texte"

requirements-completed: [D-06]

# Metrics
metrics:
  duration: ~12 min
  completed: 2026-05-31
  tasks: 2
  files-modified: 3
---

# Phase 114 Plan 03: confirmation_date Pflichtfeld Summary

confirmation_date wird zum API- und Formular-Pflichtfeld (D-06) — die verlaessliche Fristbasis fuer den Auto-Loesch-Cron (Plan 05); Backend liefert jetzt 400 statt 500 bei fehlendem Datum.

## Was gebaut wurde

### Task 1: Backend — Pflichtvalidierung in Create + Update (Commit 5522656)

- `validateCreateJahrgang` und `validateUpdateJahrgang`: `confirmation_date`-Regel von `.optional().isISO8601()` auf `.notEmpty().withMessage('Konfirmationsdatum ist erforderlich').isISO8601().withMessage('Ungültiges Datumsformat')` umgestellt (jahrgaenge.js Zeile 15 + 26).
- COALESCE-Fallback aus Plan 01 entfernt: INSERT nutzt jetzt `$2::date` statt `COALESCE($2::date, CURRENT_DATE)`, UPDATE nutzt `$2::date` statt `COALESCE($2::date, confirmation_date)`. Die Validierung garantiert den Wert, der Fallback war toter Code geworden.
- Tests erweitert (jahrgaenge.test.js): POST ohne confirmation_date -> 400, POST mit leerem confirmation_date -> 400, PUT ohne -> 400, PUT mit leerem -> 400. Bestehende Happy-Path-Tests (POST/PUT/DELETE-Setup) liefern jetzt ein `confirmation_date` mit, da das Feld sonst 400 ergaebe.

### Task 2: Frontend — Konfirmationsdatum erzwingen (Commit 5f4bac4)

- payload (AdminJahrgaengeePage.tsx): `|| null`-Fallback entfernt, `confirmation_date: formData.confirmation_date.trim()` sendet nie mehr null.
- handleSubmit: Guard ergaenzt, der bei leerem Datum mit Fehler-Toast "Bitte ein Konfirmationsdatum wählen" abbricht (greift auch im Offline-WriteQueue-Pfad).
- Save-Button: `disabled`-Bedingung um `!formData.confirmation_date.trim()` erweitert.
- Label "Konfirmationsdatum" als Pflichtfeld mit " *" markiert (analog zu "Name *").

## Verifikation

- Backend: `vitest run tests/routes/jahrgaenge.test.js` -> 24 Tests gruen (inkl. 4 neue 400-Tests fuer fehlendes/leeres Datum in POST + PUT).
- Frontend: `tsc --noEmit` ohne Fehler; Plan-grep-Verify (sendet trim() ohne `|| null`) bestanden.
- Threat-Mitigations T-114-07 (leer/ungueltig -> 400 via notEmpty+isISO8601) und T-114-08 (400 statt 500er Constraint-Violation) umgesetzt.

## Test-Infrastruktur-Hinweis

Der Worktree hatte kein eigenes `node_modules` (weder backend noch frontend). Fuer die Verifikation wurde jeweils ein Symlink auf das `node_modules` des Hauptrepos gelegt (`backend/node_modules`, `frontend/node_modules`). Diese Symlinks sind NICHT eingecheckt — es wurden ausschliesslich die drei Quelldateien einzeln gestaged. (Hinweis: `node_modules` ist im Worktree nicht via .gitignore ausgeschlossen, daher wurde nie `git add .`/`-A` verwendet.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Bestehende Tests ohne confirmation_date liefen ins 400**
- **Found during:** Task 1
- **Issue:** Mehrere Happy-Path-Tests (POST 201, POST mit optionalen Feldern, PUT 200, PUT 404-Faelle, DELETE-Setup-POSTs) sendeten kein confirmation_date und waeren mit der neuen Pflichtvalidierung auf 400 gelaufen.
- **Fix:** Allen betroffenen Sende-Bodies ein gueltiges `confirmation_date` (z.B. '2027-05-01') ergaenzt. Die Pflicht-Verletzung wird stattdessen in dedizierten neuen Tests geprueft.
- **Files modified:** backend/tests/routes/jahrgaenge.test.js
- **Commit:** 5522656

**2. [Rule 3 - Cleanup] COALESCE-Fallback aus Plan 01 entfernt**
- **Found during:** Task 1
- **Issue:** Plan 01 hatte POST/PUT einen COALESCE-Fallback fuer confirmation_date gegeben, um den NOT-NULL-Constraint abzufedern. Mit notEmpty-Validierung kommt nie null/leer an -> der Fallback ist toter Code.
- **Fix:** INSERT/UPDATE auf direkte `$2::date`-Zuweisung umgestellt und Kommentare aktualisiert. Tests blieben gruen (24/24), daher entfernt (Plan erlaubte das explizit nur bei gruenen Tests).
- **Files modified:** backend/routes/jahrgaenge.js
- **Commit:** 5522656

## Known Stubs

Keine.

## Self-Check: PASSED

- backend/routes/jahrgaenge.js — vorhanden, notEmpty enthalten
- backend/tests/routes/jahrgaenge.test.js — vorhanden, 24 Tests gruen
- frontend/src/components/admin/pages/AdminJahrgaengeePage.tsx — vorhanden, Verify-grep bestanden
- Commit 5522656 (Task 1) — vorhanden
- Commit 5f4bac4 (Task 2) — vorhanden
