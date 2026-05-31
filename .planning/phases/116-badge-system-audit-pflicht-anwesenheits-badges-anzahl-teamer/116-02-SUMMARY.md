---
phase: 116-badge-system-audit-pflicht-anwesenheits-badges-anzahl-teamer
plan: 02
subsystem: backend/badges-progress
tags: [badges, progress, prozent-bug, mandatory-events, teamer-year, rbac]
requires:
  - "criteria_type mandatory_event_count (Plan 01, badges.js Wertung)"
  - "KONSISTENZ-VERTRAG-Query aus 116-01-SUMMARY (woertlich uebernommen)"
  - "users.teamer_since (DATE, Migration 064, bestehend)"
provides:
  - "Progress-Cases event_count + mandatory_event_count in GET /konfi/badges"
  - "Extra-Feld-Fix specific_activity/activity_combination (Name statt ID)"
  - "activity_count-Progress zaehlt Aktivitaeten + besuchte Events (Wertungs-Konsistenz)"
  - "teamer_year-Progress (teamer.js) mit Startjahr-Filter aus teamer_since"
affects:
  - "backend/routes/konfi.js (GET /konfi/badges Progress-switch)"
  - "backend/routes/teamer.js (GET /badges Progress)"
tech-stack:
  added: []
  patterns:
    - "Progress-Query byte-identisch zur Wertungs-Query (kein Wertung/Progress-Mismatch)"
    - "activeYears als Array (activeYearValues) statt INTEGER fuer year-Filter"
key-files:
  created: []
  modified:
    - backend/routes/konfi.js
    - backend/routes/teamer.js
    - backend/tests/routes/konfi.test.js
    - backend/tests/routes/teamer.test.js
decisions:
  - "mandatory_event_count-Progress-Query byte-identisch zur Wertung Plan 01 (Konsistenz-Test beweist gleiches Ergebnis)"
  - "teamer_year-Case in konfi.js defensiv 0 (GET /konfi/badges liefert nur target_role=konfi)"
  - "specific_activity/activity_combination nutzen Aktivitaets-Namen (required_activity_name/required_activities) statt IDs"
metrics:
  duration: "~25 min"
  completed: 2026-05-31
  tasks: 2
  files: 4
---

# Phase 116 Plan 02: Prozent-Bug-Fix der Badge-Fortschrittsanzeige Summary

Behebung des Prozent-Bugs der Badge-Fortschrittsanzeige: fehlende Progress-Cases (`event_count`, `mandatory_event_count`, `teamer_year`) ergaenzt, Extra-Feld-Mismatch bei `specific_activity`/`activity_combination` behoben, `activity_count`-Progress um Events erweitert und `teamer_year`-Progress (teamer.js) mit Startjahr-Filter aus `teamer_since` konsistent zur Wertung gemacht.

## Was umgesetzt wurde

### Task 1: Fehlende Progress-Cases + Extra-Feld-Fix in GET /konfi/badges (konfi.js)
- **`case 'event_count'`** (neu): COUNT besuchter Events (`attendance_status='present'`, org-gefiltert). Vorbild Wertung badges.js:165.
- **`case 'mandatory_event_count'`** (neu): KONSISTENZ-VERTRAG-Query — byte-identisch zur Wertung aus Plan 01 (siehe Byte-Bestaetigung unten).
- **`case 'teamer_year'`** (neu, defensiv): `progress.current = 0` mit `break` und Kommentar. GET /konfi/badges liefert nur `target_role='konfi'`, der echte teamer_year-Progress liegt im Teamer-Endpoint (Task 2). Case ergaenzt statt weggelassen (D-10).
- **`case 'activity_count'`** (Mismatch-Fix): zaehlte bisher nur `user_activities`. Die Wertung (badges.js:272) addiert `activityCount + eventCount`. Progress ergaenzt um COUNT besuchter Events -> identisch zur Wertung. Zusaetzlich `organization_id`-Filter ergaenzt (vorher fehlend).
- **`specific_activity`** (Extra-Feld-Fix D-11): statt `extraData.activity_id` jetzt `extraData.required_activity_name`; Query auf `JOIN activities a ON ua.activity_id = a.id WHERE a.name = $2 AND a.organization_id = $3` (analog Wertung badges.js:209-214).
- **`activity_combination`** (Extra-Feld-Fix D-11): statt `extraData.activity_ids` jetzt `extraData.required_activities` (Namen); `COUNT(DISTINCT a.name)` ueber `JOIN activities a ON ... a.name IN (...)` mit org-Filter (analog Wertung badges.js:221-223).

### Task 2: teamer_year-Progress mit Startjahr-Filter (teamer.js)
- **Strukturumbau (D-12)**: `const activeYears = activeYearsRes.rows.length;` (INTEGER) ersetzt durch `const activeYearValues = activeYearsRes.rows.map(r => r.year);` (Array). Die Query lieferte bereits `EXTRACT(YEAR FROM d.date)::int as year`.
- **Keine Regression**: Es gab keine weitere Verwendung der alten Variable `activeYears` ausser im teamer_year-Case selbst — verifiziert per grep (nur `activeYearsRes` und `activeYearValues` verbleiben). Andere Cases (activity_count/event_count/unique_activities) nutzen eigene Zaehler und sind unveraendert.
- **Startjahr-Ermittlung**: Promise.all um `SELECT teamer_since FROM users WHERE id = $1` erweitert. `teamerStartYear` = `YEAR(teamer_since)`; NULL-Fallback = `Math.min(...activeYearValues)` (aelteste aktive Jahr = aelteste Teamer-Aktivitaet). Konsistent zur Wertung badges.js:422-477.
- **teamer_year-Case**: `progressPoints = teamerStartYear === null ? 0 : activeYearValues.filter(y => y >= teamerStartYear).length;`

## KONSISTENZ-VERTRAG: Byte-Bestaetigung der mandatory_event_count-Query

Die Progress-Query in `konfi.js` (`case 'mandatory_event_count'`) entspricht Byte-fuer-Byte der Wertungs-Query aus Plan 01 (`badges.js`). Normalisierter Vergleich (Whitespace-kollabiert) ergab Identitaet:

```sql
SELECT COUNT(*) FROM event_bookings eb JOIN events e ON eb.event_id = e.id
WHERE eb.user_id = $1 AND eb.attendance_status = 'present' AND e.mandatory = true AND eb.organization_id = $2
```

Einziger Unterschied ist die Einrueckung der ersten Zeile (Code-Kontext) sowie die Parameter-Variablennamen (`konfiId`/`req.user.organization_id` vs. `userId`/`konfi.organization_id`) — der SQL-String selbst ist identisch. Der **Konsistenz-Test** (`KONSISTENZ: mandatory_event_count Progress.current == Wertungs-COUNT`) schickt denselben Test-Konfi durch beide Pfade (`checkAndAwardBadges` + GET /konfi/badges) und beweist gleiche Zaehlung (beide == 3) — Byte-Konsistenz, nicht nur Textgleichheit.

## Tests

### konfi.test.js (6 neue Tests, Block "GET /api/konfi/badges Progress-Berechnung")
- event_count: 4 Events, value=6 -> current=4, percentage=67
- mandatory_event_count: 3 Pflicht besucht + 2 Nicht-Pflicht + 1 nicht besucht, value=12 -> current=3, percentage=25
- KONSISTENZ: Progress.current == Wertungs-COUNT (== 3)
- specific_activity: required_activity_name, 2 Erledigungen -> current=2
- activity_combination: required_activities=[A,B], A erledigt -> current=1
- activity_count: 2 Aktivitaeten + 3 Events -> current=5

### teamer.test.js (4 neue Tests, Block "GET /api/teamer/badges teamer_year-Progress")
- teamer_since=2026 + Aktivitaet 2024+2026 -> current=1 (nur 2026 zaehlt)
- teamer_since=2024 + Aktivitaet 2024+2026 -> current=2
- teamer_since=NULL -> Fallback aelteste Aktivitaet (2023+2024 -> current=2)
- Regressions-Test: event_count-Progress zaehlt weiterhin 2 besuchte Events

Ergebnis: `konfi.test.js 22 passed (22)`, `teamer.test.js 43 passed (43)`, gemeinsamer Lauf `65 passed (65)`.

## Deviations from Plan

Keine inhaltlichen Deviations. Zwei umgebungs-/test-technische Anpassungen:

**[Rule 3 - Blocking] node_modules-Symlink im Worktree fehlte**
- **Found during:** Vorbereitung (vor Task 1)
- **Issue:** Kein node_modules im Worktree -> `npx vitest` konnte nicht aufloesen.
- **Fix:** Symlink `backend/node_modules -> /Users/simonluthe/Documents/Konfipoints/backend/node_modules` angelegt. NICHT eingecheckt (untracked).
- **Files modified:** keine (nur Symlink im Arbeitsverzeichnis).

**[Rule 1 - Test-Fixture] Aktivitaets-Namen in Tests eindeutig gemacht**
- **Found during:** Task 1 (specific_activity/activity_combination GREEN-Lauf)
- **Issue:** Die Test-Helper haengten `-${Math.random()}` an den Aktivitaets-Namen, wodurch der per `required_activity_name` referenzierte Bare-Name nicht traf (Progress 0 statt erwartet). Zusaetzlich kollidierte `Sonntagsgottesdienst` mit dem Seed.
- **Fix:** Helper legt Aktivitaet mit exaktem Namen an; Tests nutzen einen seed-fremden Namen (`Pfingst-Spezial`, `Kombi-A`).
- **Files modified:** backend/tests/routes/konfi.test.js (Commit 9cc1c9c).

Hinweis (keine Deviation): Der bestehende Test `Teamer bekommt 200 + Profil-Daten` schlug einmalig beim ersten Lauf mit DB-Warmup (~1s) fehl und war bei Wiederholung gruen — bekannte Flakiness des ersten Testlaufs, unabhaengig von dieser Aenderung.

## Verification

- `npx vitest run --config tests/vitest.config.ts tests/routes/konfi.test.js` -> 22 passed
- `npx vitest run --config tests/vitest.config.ts tests/routes/teamer.test.js` -> 43 passed
- gemeinsamer Lauf -> 65 passed (65)
- `grep "case 'event_count'" konfi.js` -> Treffer (:986)
- `grep "case 'mandatory_event_count'" konfi.js` -> Treffer (:996), Query enthaelt `e.mandatory = true` UND `attendance_status = 'present'`
- `grep "required_activity_name" konfi.js` -> Treffer; `extraData.activity_id`/`extraData.activity_ids` entfernt (0 Treffer)
- `grep "required_activities" konfi.js` -> Treffer
- `grep "teamer_since" teamer.js` -> Treffer im Progress-Pfad (:316)
- mandatory_event_count-Query normalisiert byte-identisch zur Wertung (Plan 01)
- Keine Datei-Loeschungen, keine Schema-Migration

## Known Stubs

Keine.

## Self-Check: PASSED

- Dateien vorhanden: backend/routes/konfi.js, backend/routes/teamer.js, backend/tests/routes/konfi.test.js, backend/tests/routes/teamer.test.js, 116-02-SUMMARY.md
- Commits vorhanden: 76bdca1 (test konfi), 9cc1c9c (feat konfi), ad559c6 (test teamer), e36cf0a (feat teamer)
