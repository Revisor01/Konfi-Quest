---
phase: quick/260324-lt3
plan: 260324-lt3
subsystem: security
tags: [git, apns, password-policy, rbac-cache, setimmediate, legacy-cleanup]

requires: []
provides:
  - APNs .p8 Keys aus Git-Tracking entfernt (git rm --cached)
  - portainer-stack.yml nicht mehr getrackt
  - Passwort-Policy min. 8 Zeichen + Komplexitaet bei User-Create und Reset
  - Cache-Invalidierung nach Rollenaenderung (invalidateUserCache)
  - setImmediate Arrow-Function-Wrapper (korrekte Lazy-Ausfuehrung)
  - Legacy data/-Verzeichnis-Code aus server.js entfernt
affects: [users, auth, server-bootstrapping]

tech-stack:
  added: []
  patterns:
    - "validatePassword aus passwordUtils bei allen passwortrelevanten Endpoints einbinden"
    - "invalidateUserCache nach jeder Rollenaenderung aufrufen"

key-files:
  created: []
  modified:
    - .gitignore
    - backend/routes/users.js
    - backend/server.js

key-decisions:
  - "git rm --cached fuer sensible Dateien statt loeschen - Dateien bleiben lokal verfuegbar"
  - "validatePassword zentral in passwordUtils, einmalig importieren und ueberall wiederverwenden"
  - "invalidateUserCache direkt nach DB-Update, vor Socket.io-Disconnect (Reihenfolge wichtig)"

requirements-completed: []

duration: 8min
completed: 2026-03-24
---

# Quick Task 260324-lt3: 6 Sicherheits- und Cleanup-Fixes

**APNs Keys aus Git-Tracking entfernt, Passwort-Policy auf min. 8 Zeichen + Komplexitaet verscharft, RBAC-Cache nach Rollenwechsel invalidiert, setImmediate-Bug mit Arrow-Function gefixt und Legacy SQLite-Code entfernt**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-24T00:20:00Z
- **Completed:** 2026-03-24T00:28:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- APNs Keys (docs/AuthKey_7AQA623H3T.p8, docs/AuthKey_A29U7SN796.p8) und portainer-stack.yml aus Git-Tracking entfernt, Dateien bleiben lokal
- .gitignore um `docs/AuthKey_*.p8` und `*.p8` Regel ergaenzt
- validatePassword (min. 8 Zeichen + Gross-/Kleinbuchstabe + Zahl + Sonderzeichen) bei User-Create und Password-Reset eingebunden
- invalidateUserCache nach jeder Rollenaenderung aufgerufen (sofortige JWT-Wirkung ohne Re-Login)
- setImmediate Arrow-Function-Wrapper korrigiert (Promise wurde als Callback uebergeben, nicht die Funktion)
- Legacy data/-Verzeichnis-Erstellung aus server.js entfernt (SQLite nicht mehr verwendet)

## Task Commits

1. **Task 1: Git-Hygiene** - `cb4d437` (chore)
2. **Task 2: Code-Fixes** - `86104ae` (fix)

## Files Created/Modified

- `.gitignore` - APNs Keys Regel hinzugefuegt
- `backend/routes/users.js` - validatePassword + invalidateUserCache importiert und eingebunden, Validator auf min. 8 Zeichen
- `backend/server.js` - setImmediate Arrow-Function, Legacy data/-Block entfernt

## Decisions Made

- `git rm --cached` statt Dateien loeschen — APNs Keys werden weiterhin lokal fuer Deployment benoetigt
- validatePassword bereits in passwordUtils vorhanden — kein neuer Code noetig, nur import
- `fs`-Import in server.js behalten — wird noch an anderer Stelle (Zeile 295) fuer Upload-Verzeichnis verwendet

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Self-Check

- [x] cb4d437 existiert in git log
- [x] 86104ae existiert in git log
- [x] `git ls-files docs/AuthKey*.p8 portainer-stack.yml` gibt leere Ausgabe
- [x] validatePassword und invalidateUserCache in users.js vorhanden
- [x] setImmediate Arrow-Function in server.js
- [x] dataDir-Block nicht mehr in server.js

## Self-Check: PASSED

## Next Phase Readiness

- Sicherheitslucken geschlossen, Code-Schulden abgebaut
- Bereit fuer weiteres Hardening oder Feature-Arbeit

---
*Quick Task: 260324-lt3*
*Completed: 2026-03-24*
