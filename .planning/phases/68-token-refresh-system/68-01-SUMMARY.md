---
phase: 68-token-refresh-system
plan: 01
subsystem: auth
tags: [jwt, refresh-token, sha256, token-rotation, postgresql]

requires:
  - phase: 66-error-boundary-sicherheit
    provides: SHA-256 Hashing Pattern fuer Token-Speicherung
provides:
  - refresh_tokens DB-Tabelle mit SHA-256 Hash-Speicherung
  - POST /auth/refresh Endpoint mit Token-Rotation
  - token_invalidated_at Soft-Revoke auf users Tabelle
  - 15min Access-Token Laufzeit (statt 90d)
  - Login + Register Response mit refresh_token Feld
affects: [68-02 Frontend Token-Refresh Integration]

tech-stack:
  added: []
  patterns: [Refresh-Token-Rotation, Soft-Revoke via token_invalidated_at, SHA-256 Token-Hashing]

key-files:
  created:
    - backend/migrations/068_refresh_tokens.sql
  modified:
    - backend/middleware/rbac.js
    - backend/routes/auth.js

key-decisions:
  - "SHA-256 fuer Refresh-Token-Hash konsistent mit Phase 66"
  - "Token-Rotation: altes Refresh-Token wird bei jedem Refresh sofort revoked"
  - "Cleanup-Job im Auth-Modul via setInterval (24h Intervall)"

patterns-established:
  - "Refresh-Token-Rotation: Bei jedem /auth/refresh wird ein neues Paar (Access + Refresh) ausgestellt"
  - "Soft-Revoke: token_invalidated_at auf users ermoeglicht sofortige Invalidierung aller bestehenden Tokens"

requirements-completed: [TOKEN-DB, TOKEN-REFRESH, TOKEN-REVOKE, TOKEN-LOGIN]

duration: 2min
completed: 2026-03-21
---

# Phase 68 Plan 01: Backend Token-Refresh-System Summary

**Refresh-Token-Rotation mit SHA-256 Hashing, 15min Access-Tokens und Soft-Revoke via token_invalidated_at**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T19:10:49Z
- **Completed:** 2026-03-21T19:13:10Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- DB-Migration: refresh_tokens Tabelle mit SHA-256 token_hash, FK CASCADE, 2 Indizes + token_invalidated_at Spalte auf users
- verifyTokenRBAC prueft JWT iat gegen token_invalidated_at fuer Soft-Revoke (401 bei invalidiertem Token)
- JWT-Laufzeit von 90d auf 15m reduziert in Login, Register und Refresh
- Login + Register geben refresh_token neben token zurueck
- Neuer POST /auth/refresh Endpoint mit Token-Rotation (altes Token sofort revoked, neues Paar ausgestellt)
- Cleanup-Job entfernt abgelaufene/revoked Tokens alle 24h

## Task Commits

Each task was committed atomically:

1. **Task 1: DB-Migration + verifyTokenRBAC Invalidierungs-Check** - `1f5ea83` (feat)
2. **Task 2: /auth/refresh Endpoint + Login erweitern + JWT 15min** - `c527682` (feat)

## Files Created/Modified
- `backend/migrations/068_refresh_tokens.sql` - refresh_tokens Tabelle + token_invalidated_at Spalte
- `backend/middleware/rbac.js` - token_invalidated_at im SELECT + iat-Vergleich fuer Soft-Revoke
- `backend/routes/auth.js` - Refresh-Token Helper, Login/Register mit refresh_token, /auth/refresh Endpoint, Cleanup-Job

## Decisions Made
- SHA-256 fuer Refresh-Token-Hash konsistent mit Phase 66 Pattern
- Token-Rotation: altes Refresh-Token wird bei jedem Refresh sofort revoked (kein Reuse moeglich)
- Cleanup-Job als setInterval im Auth-Modul (24h), entfernt abgelaufene + 7-Tage-alte revoked Tokens

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Migration muss beim naechsten Deployment automatisch ausgefuehrt werden.

## Next Phase Readiness
- Backend-Infrastruktur komplett, bereit fuer Plan 02 (Frontend Token-Refresh Integration)
- Frontend tokenStore muss Refresh-Token speichern und bei 401 automatisch refreshen

---
*Phase: 68-token-refresh-system*
*Completed: 2026-03-21*
