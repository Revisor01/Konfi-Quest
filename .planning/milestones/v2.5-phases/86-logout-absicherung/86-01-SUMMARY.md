---
phase: 86-logout-absicherung
plan: 01
subsystem: auth
tags: [jwt, refresh-token, token-revoke, security, logout, postgres]

# Dependency graph
requires:
  - phase: v2.2-codebase-hardening
    provides: Token-Refresh System (15min Access + 90d Refresh + Soft-Revoke) mit refresh_tokens Tabelle
provides:
  - POST /api/auth/logout Endpoint mit verifyToken-Schutz und revoked_at=NOW() Update
  - Frontend logout() ruft Revoke vor clearAuth() auf (Best-effort, Online-Only)
affects: [87-input-validierung, 88-performance, 89-backend-cleanup]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Best-effort Logout: HTTP 200 immer, auch bei DB-Fehler oder fehlendem Token"
    - "Online-Guard vor Token-Revoke: networkMonitor.isOnline check vor API-Call"
    - "Reihenfolge: Push-Token entfernen → Refresh-Token revokieren → clearAuth()"

key-files:
  created: []
  modified:
    - backend/routes/auth.js
    - frontend/src/services/auth.ts

key-decisions:
  - "Best-effort Muster: Logout scheitert niemals — auch bei DB-Fehler oder fehlender Netzverbindung"
  - "verifyToken schützt den Endpoint: kein ungeschützter Massen-Revoke möglich"
  - "Offline-Case akzeptiert: Token läuft nach 90 Tagen ab — ausreichendes Sicherheitsniveau"

patterns-established:
  - "Logout-Endpoint: router.post('/logout', verifyToken, ...) Best-effort mit JSON 200 immer"
  - "Frontend Token-Revoke: try/catch vor clearAuth(), nur online, console.warn bei Fehler"

requirements-completed: [SEC-01, SEC-02]

# Metrics
duration: 8min
completed: 2026-03-23
---

# Phase 86 Plan 01: Logout-Absicherung Summary

**Serverseitiges Refresh-Token-Revoke beim Logout: POST /api/auth/logout in Express + Frontend-Aufruf vor clearAuth() mit Online-Guard**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-23T10:19:00Z
- **Completed:** 2026-03-23T10:27:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- POST /api/auth/logout Endpoint in backend/routes/auth.js nach POST /refresh eingefügt, geschützt durch verifyToken Middleware
- UPDATE refresh_tokens SET revoked_at = NOW() beim Logout — gestohlene Tokens werden sofort wertlos
- Frontend logout() ruft api.post('/auth/logout') mit dem aktuellen Refresh Token auf, bevor clearAuth() die lokalen Daten löscht
- Best-effort Muster durchgehend: Logout schlägt nie fehl, auch bei DB-Fehler oder Offline

## Task Commits

Jeder Task wurde atomar committed:

1. **Task 1: Backend POST /api/auth/logout Endpoint** - `a7ba534` (feat)
2. **Task 2: Frontend logout() ruft /api/auth/logout vor clearAuth() auf** - `b8ebd89` (feat)

## Files Created/Modified
- `backend/routes/auth.js` - POST /logout Route nach POST /refresh eingefügt (Zeilen 799-821)
- `frontend/src/services/auth.ts` - getRefreshToken zu Imports hinzugefügt, SEC-02 Block vor clearAuth()

## Decisions Made
- Best-effort Muster beibehalten: HTTP 200 auch ohne refresh_token im Body und bei DB-Fehlern — App muss sich immer ausloggen können
- Offline-Case bewusst nicht in WriteQueue: ein Revoke-Versuch nach Reconnect würde scheitern (Token schon lokal gelöscht), 90-Tage-Ablauf ist akzeptable Sicherheitsgrenze
- verifyToken als Pflicht-Middleware: verhindert, dass ein Angreifer beliebige Token-Hashes revokieren kann

## Deviations from Plan

Keine — Plan wurde exakt wie spezifiziert ausgeführt.

## Issues Encountered

Keine.

## User Setup Required

Keine — keine externen Dienste oder Umgebungsvariablen erforderlich.

## Next Phase Readiness
- Logout-Absicherung vollständig: Backend-Endpoint + Frontend-Aufruf in Produktion deploybar
- Bestehende POST /refresh Logik prüft bereits revoked_at IS NULL — kein weiterer Code nötig
- Bereit für Phase 87 (Input-Validierung)

---
*Phase: 86-logout-absicherung*
*Completed: 2026-03-23*
