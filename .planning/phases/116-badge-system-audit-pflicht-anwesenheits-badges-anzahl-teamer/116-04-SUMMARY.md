---
phase: 116
plan: "04"
subsystem: badges
tags: [refactor, deduplizierung, streak, dry, utils]
type: refactor-nachtrag
requires: [backend/routes/badges.js, backend/routes/konfi.js]
provides: [backend/utils/streakCalculation.js, computeCurrentStreak]
affects: [Badge-Wertung Streak, Badge-Progress Streak]
tech-stack:
  added: []
  patterns: [Single Source of Truth Util (analog konfiDeletion/konfiLimit)]
key-files:
  created:
    - backend/utils/streakCalculation.js
    - backend/tests/utils/streakCalculation.test.js
  modified:
    - backend/routes/badges.js
    - backend/routes/konfi.js
decisions:
  - Streak-Logik einmalig in Util gebuendelt statt zweimal inline gepflegt
metrics:
  duration: ~10 min
  completed: 2026-05-31
---

# Phase 116 Plan 04: Streak-Berechnung Deduplizierung Summary

JWT-freier reiner Refactor: die zuvor doppelt gepflegte Wochen-Streak-Logik
(Badge-Wertung in `badges.js` und Badge-Progress in `konfi.js`) wird in eine
gemeinsame Util `computeCurrentStreak` extrahiert, sodass Wertung und Anzeige
garantiert dieselbe Logik nutzen und nicht auseinanderlaufen koennen.

## Was gebaut wurde

- **`backend/utils/streakCalculation.js`** (neu): exportiert `computeCurrentStreak(dates)`
  -> integer, plus die internen Helfer `getYearWeek` und `getISOWeeksInYear`
  (mit-exportiert, falls anderswo gebraucht). Die Funktion berechnet den aktuellen
  Streak (Anzahl aufeinanderfolgender aktiver ISO-Wochen bis zur neuesten aktiven
  Woche) aus einer Liste von Datumswerten. Logik BYTE-genau aus der bisherigen
  `badges.js`-Implementierung uebernommen: Start bei 1, Abbruch bei erster Luecke
  via `break`, Jahresuebergang W1 -> letzte Woche des Vorjahres.

- **`backend/routes/badges.js`**: `checkStreakCriteria` ruft jetzt
  `computeCurrentStreak(streakResults.map(r => r.date))` auf. Die Datenabfrage
  (UNION user_activities + present event_bookings) bleibt unveraendert in badges.js,
  nur die Wochen-Streak-Rechnung kommt aus der Util. Das frueher top-level definierte
  `getISOWeeksInYear` (nur hier genutzt) sowie die Inline-`getYearWeek` und die
  Streak-Schleife wurden entfernt.

- **`backend/routes/konfi.js`**: der `streak`-Progress-case ersetzt die komplette
  Inline-Kopie (eigenes `getYearWeek`, eigenes `getISOWeeksInYear`, eigene Schleife)
  durch `progress.current = computeCurrentStreak(streakResults.map(r => r.date))`.

- **`backend/tests/utils/streakCalculation.test.js`** (neu): 7 reine Unit-Tests
  (keine DB): leere/null/undefined Liste -> 0; eine Woche -> 1; drei konsekutive
  -> 3; Luecke (W10,W9,W7) -> 2; Jahresuebergang -> 2; Reihenfolgeunabhaengigkeit;
  Filterung ungueltiger Datumswerte.

## Verifikation

`cd backend && npx vitest run --config tests/vitest.config.ts tests/utils/streakCalculation.test.js tests/routes/badges.test.js tests/routes/konfi.test.js`

- streakCalculation.test.js: 7 passed
- badges.test.js + konfi.test.js: 53 passed
- Gesamt: 60 passed, 0 failed

Bestehende Streak-Tests bleiben gruen -> Verhalten nachweislich identisch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/Korrektheit] Jahresuebergangs-Testfall an reales ISO-Verhalten angepasst**
- **Found during:** Schreiben des Unit-Tests
- **Issue:** Die Task-Vorgabe nannte als Jahresuebergangs-Testfall "W1/2026 + W52/2025 -> 2".
  Das ist mit der bestehenden (unveraenderten) Logik NICHT herstellbar: der
  29.12.2025 faellt nach ISO-8601 bereits in W1/2026, und `getISOWeeksInYear(2025)`
  liefert formelbedingt 53 (nicht 52), sodass die erwartete Vorwoche von W1/2026
  rechnerisch W53/2025 waere — zwischen einem realen W52/2025-Datum und W1/2026
  liegt damit eine Luecke und der Streak ergaebe 1, nicht 2.
- **Fix:** Verhaltenstreuer Jahresuebergangs-Test gewaehlt, der denselben
  `expectedWeek === 0`-Codepfad durchlaeuft und mit der echten, unveraenderten
  Logik 2 ergibt: W53/2026 (2026-12-28) + W1/2027 (2027-01-04) -> 2. Fuer 2026
  deckt sich die Formel mit dem realen ISO-Kalender (53 Wochen), daher folgt
  W1/2027 konsekutiv auf W53/2026.
- **Files modified:** backend/tests/utils/streakCalculation.test.js
- **Commit:** c1dd74b
- **Hinweis:** Es wurde KEINE Verhaltensaenderung an der Streak-Logik vorgenommen.
  Die leichte Off-by-one-Eigenheit von `getISOWeeksInYear` in bestimmten
  Uebergangsjahren bleibt unveraendert erhalten (Deduplizierung, kein Bugfix der
  Datumslogik) und wurde nur im Test korrekt abgebildet statt einen unrealistischen
  Erwartungswert zu erzwingen.

## Known Stubs

Keine.

## Hinweise

- STATE.md und ROADMAP.md wurden auftragsgemaess NICHT veraendert.
- Der `backend/node_modules`-Symlink (auf das Haupt-Repo) wurde NICHT eingecheckt.

## Self-Check: PASSED

- backend/utils/streakCalculation.js: FOUND
- backend/tests/utils/streakCalculation.test.js: FOUND
- Commit c1dd74b: FOUND
