---
phase: 23-user-rechte-institutionen-debug
plan: 01
subsystem: auth
tags: [rbac, rate-limiting, express, postgresql]

requires:
  - phase: 22-punkte-vergabe-debug
    provides: Funktionierendes RBAC-System mit verifyTokenRBAC Middleware
provides:
  - Korrekte last_login_at Aktualisierung nur beim Login
  - Rate-Limiter fuer Organisations-Endpunkte (20 req/15min)
affects: [auth, organizations, middleware]

tech-stack:
  added: []
  patterns:
    - "Rate-Limiter als Middleware vor Route-Registrierung einhaengen"

key-files:
  created: []
  modified:
    - backend/middleware/rbac.js
    - backend/routes/auth.js
    - backend/server.js

key-decisions:
  - "last_login_at UPDATE gehoert ausschliesslich in den Login-Endpunkt, nicht in die Token-Verifikation"
  - "orgLimiter mit 20 req/15min auf alle Org-Endpunkte (inkl. GET)"

patterns-established:
  - "Statistik-relevante Timestamps nur bei tatsaechlichen User-Aktionen aktualisieren"

requirements-completed: [USR-01, USR-04]

duration: 3min
completed: 2026-03-05
---

# Phase 23 Plan 01: User-Rechte und Institutionen Debug Summary

**last_login_at aus Token-Middleware in Login-Endpunkt verschoben und Organisations-Endpunkte mit Rate-Limiter geschuetzt**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-05T21:10:45Z
- **Completed:** 2026-03-05T21:13:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- last_login_at wird nicht mehr bei jedem authentifizierten Request aktualisiert -- Login-Statistik ist jetzt korrekt
- Organisations-Endpunkte sind mit eigenem Rate-Limiter (20 req/15min) vor Missbrauch geschuetzt

## Task Commits

Each task was committed atomically:

1. **Task 1: last_login_at aus Middleware entfernen und in Login-Endpunkt verschieben** - `5e03690` (fix)
2. **Task 2: Rate-Limiter fuer Organisations-Endpunkte** - `8002e0e` (feat)

## Files Created/Modified
- `backend/middleware/rbac.js` - last_login_at UPDATE entfernt aus verifyTokenRBAC
- `backend/routes/auth.js` - last_login_at UPDATE nach Passwort-Verifikation im Login eingefuegt
- `backend/server.js` - orgLimiter definiert und auf /api/organizations Route eingehaengt

## Decisions Made
- last_login_at UPDATE gehoert ausschliesslich in den Login-Endpunkt, nicht in die Token-Verifikation
- orgLimiter mit 20 req/15min auf alle Org-Endpunkte (inkl. GET), da auch Statistik-Abrufe limitiert werden sollen

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 23-02 kann ohne Blocker ausgefuehrt werden
- Middleware und Rate-Limiting sind stabil

---
*Phase: 23-user-rechte-institutionen-debug*
*Completed: 2026-03-05*
