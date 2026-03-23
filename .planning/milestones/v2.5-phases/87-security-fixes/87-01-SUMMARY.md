---
phase: 87-security-fixes
plan: 01
subsystem: security
tags: [express-validator, socket.io, react-hooks, api-key, password-validation, chat]

# Dependency graph
requires:
  - phase: 86-logout
    provides: Backend-Logout-Endpoint + Token-Revoke (Basis für v2.5-Hardening)
provides:
  - Losung-API-Key Fallback entfernt (SEC-03)
  - Passwort-Mindestlänge 8 Zeichen (SEC-04)
  - Chat-Nachrichten Längenlimit 4000 Zeichen (SEC-05)
  - Socket.IO Typing Org-Isolation (SEC-06)
  - useOfflineQuery Stale-Closure-freie revalidate-Funktion (CLN-02)
affects: [88-performance, 89-tech-debt]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "503 bei fehlendem Pflicht-ENV-Key statt Fallback-Wert"
    - "dataRef-Pattern für stabile useCallback-Dependencies ohne Stale-Closure"
    - "Typing-Handler mit DB-Org-Check analog zum joinRoom-Handler"

key-files:
  created: []
  modified:
    - backend/routes/konfi.js
    - backend/routes/teamer.js
    - backend/middleware/validation.js
    - backend/routes/auth.js
    - backend/routes/chat.js
    - backend/server.js
    - frontend/src/hooks/useOfflineQuery.ts

key-decisions:
  - "503 bei fehlendem LOSUNG_API_KEY statt stille Fehler oder Fallback"
  - "dataRef-Ref statt funktionalem State-Update für Stale-Closure-Fix (sauberer, kein verschachtelter setState)"
  - "revalidate jetzt in Initial-useEffect-Dependencies, da keine Closure-Loop-Gefahr mehr"

patterns-established:
  - "ENV-Key-Guard: process.env.KEY fehlt → 503 mit console.error, kein Fallback im Code"
  - "Typing-Org-Check: immer DB-Query vor Socket.IO-Emit analog zu joinRoom"

requirements-completed: [SEC-03, SEC-04, SEC-05, SEC-06, CLN-02]

# Metrics
duration: 8min
completed: 2026-03-23
---

# Phase 87 Plan 01: Security-Fixes Summary

**5 unabhängige Sicherheits- und Bug-Fixes: API-Key-Fallback entfernt, Passwort-Minimum auf 8, Chat-Limit 4000, Typing Org-Isolation via DB-Check, useOfflineQuery Stale-Closure via dataRef beseitigt**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-23T10:17:00Z
- **Completed:** 2026-03-23T10:25:56Z
- **Tasks:** 5 von 5
- **Files modified:** 7

## Accomplishments

- Hardkodierter Losung-API-Fallback-Key aus konfi.js und teamer.js entfernt — fehlendes ENV gibt 503
- Passwort-Mindestlänge in allen 4 Validierungs-Stellen von 6 auf 8 erhöht (validation.js + auth.js)
- Chat-Nachrichten-Längenlimit 4000 Zeichen in validateSendMessage eingefügt
- Typing-Handler in server.js mit DB-Org-Check abgesichert — kein Cross-Org Typing-Leak mehr
- useOfflineQuery Stale-Closure beseitigt via dataRef — revalidate jetzt stabil in useEffect-Dependencies

## Task Commits

1. **Task 1: Losung-API-Key Fallback entfernen** - `f9b9f5e` (fix)
2. **Task 2: Passwort-Mindestlänge auf 8 erhöhen** - `7a0a57c` (fix)
3. **Task 3: Chat-Nachrichten Längenlimit 4000** - `a82edf8` (fix)
4. **Task 4: Socket.IO Typing Org-Check** - `a56d148` (fix)
5. **Task 5: useOfflineQuery Stale-Closure Fix** - `6f5448b` (fix)

## Files Created/Modified

- `backend/routes/konfi.js` - LOSUNG_API_KEY ohne Fallback, 503 bei fehlendem Key
- `backend/routes/teamer.js` - Identisch: LOSUNG_API_KEY ohne Fallback
- `backend/middleware/validation.js` - password min: 6 → min: 8
- `backend/routes/auth.js` - validateChangePassword + validateResetPassword + reset-password Route auf min 8
- `backend/routes/chat.js` - validateSendMessage: content mit isLength({ max: 4000 })
- `backend/server.js` - typing + stopTyping Handler mit async DB-Org-Check
- `frontend/src/hooks/useOfflineQuery.ts` - dataRef eingefügt, revalidate-Dep bereinigt, Initial-useEffect korrigiert

## Decisions Made

- **503 statt stiller Fallback:** Bei fehlendem LOSUNG_API_KEY wird 503 zurückgegeben und console.error geloggt. Kein Fallback-Wert erlaubt.
- **dataRef-Pattern:** Statt funktionalem setData-Update mit verschachtelten setState-Aufrufen wird ein useRef zur stabilen Datenwert-Verfolgung eingesetzt.
- **revalidate in useEffect-Dependencies:** Da revalidate nun ohne `data` in seinen Dependencies stabil ist, kann es sicher in den Initial-useEffect aufgenommen werden — der alte Kommentar "bewusst nicht in deps" wurde entfernt.

## Deviations from Plan

Keine - Plan exakt wie geschrieben ausgeführt.

## Issues Encountered

Keine.

## User Setup Required

Keine — LOSUNG_API_KEY war bereits als ENV-Variable gesetzt. Der Fix entfernt nur den unsicheren Fallback.

## Next Phase Readiness

- Alle 5 Phase-87-Requirements erfüllt
- Backend startbar ohne Syntaxfehler
- v2.5 Security-Hardening vollständig abgeschlossen (Phase 86 + 87)
- Bereit für Phase 88 (Performance) und Phase 89 (Tech-Debt)

## Self-Check: PASSED

- SUMMARY.md: FOUND
- konfi.js: FOUND
- server.js: FOUND
- useOfflineQuery.ts: FOUND
- Commit f9b9f5e: FOUND (Task 1)
- Commit 7a0a57c: FOUND (Task 2)
- Commit a82edf8: FOUND (Task 3)
- Commit a56d148: FOUND (Task 4)
- Commit 6f5448b: FOUND (Task 5)

---
*Phase: 87-security-fixes*
*Completed: 2026-03-23*
