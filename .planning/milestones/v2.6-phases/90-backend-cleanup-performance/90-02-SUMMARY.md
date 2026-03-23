---
phase: 90-backend-cleanup-performance
plan: 02
subsystem: infra
tags: [env-config, smtp, graceful-shutdown, migration-naming, losung-service]

requires:
  - phase: 90-backend-cleanup-performance/01
    provides: bcrypt-async und LiveUpdateContext-Fix

provides:
  - VITE_API_URL-konfigurierbare Frontend-URLs (Staging-faehig)
  - SMTP ohne hardcodierten IP-Fallback
  - QR_SECRET als Pflicht-ENV
  - losungService.js als dedizierter Service
  - SIGTERM-Handler fuer Docker Graceful Shutdown
  - Numerische Migrations-Praefixe (078-080)

affects: [deployment, docker, staging]

tech-stack:
  added: []
  patterns:
    - "Graceful Shutdown mit server.close + db.end + 10s Timeout"
    - "losungService als extrahierter DB-Cache-Service"

key-files:
  created:
    - backend/services/losungService.js
  modified:
    - frontend/src/services/api.ts
    - frontend/src/services/websocket.ts
    - backend/server.js
    - backend/services/emailService.js
    - backend/routes/events.js
    - backend/package.json
    - backend/routes/konfi.js
    - backend/routes/teamer.js
    - backend/migrations/078_add_idempotency_keys.sql
    - backend/migrations/079_add_invite_codes.sql
    - backend/migrations/080_add_push_foundation.sql

key-decisions:
  - "VITE_API_URL mit Produktions-Fallback statt rein hardcoded"
  - "server.godsapp.de als SMTP-Fallback statt IP-Adresse"
  - "QR_SECRET ohne Fallback - process.exit(1) bei fehlendem ENV"
  - "Gemeinsamer gracefulShutdown fuer SIGINT und SIGTERM"

patterns-established:
  - "Service-Extraktion: Duplizierter Routen-Code in eigenen Service auslagern"

requirements-completed: [CONF-01, CONF-02, CONF-03, CLN-03, CLN-04, CLN-05, CLN-06]

duration: 3min
completed: 2026-03-23
---

# Phase 90 Plan 02: ENV-Konfiguration, Cleanup und Graceful Shutdown Summary

**Frontend-URLs via VITE_API_URL konfigurierbar, SMTP/QR-Fallbacks bereinigt, losungService extrahiert, SIGTERM-Handler mit server.close implementiert**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T18:40:44Z
- **Completed:** 2026-03-23T18:44:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Frontend API-URL und WebSocket-URL via VITE_API_URL konfigurierbar (Staging-faehig)
- Hardcodierter IP-Fallback (213.109.162.132) durch server.godsapp.de ersetzt
- QR_SECRET ist Pflicht-ENV ohne JWT_SECRET-Fallback mit process.exit(1)
- SQLite-Skripte aus package.json entfernt
- 3 Migrationen mit numerischem Praefix umbenannt (078-080)
- losungService.js extrahiert und in konfi.js + teamer.js eingebunden (-78 Zeilen Duplikat)
- SIGTERM/SIGINT-Handler mit server.close + db.end + 10s Timeout

## Task Commits

Each task was committed atomically:

1. **Task 1: ENV-Konfiguration + Fallbacks entfernen** - `4317b5c` (feat)
2. **Task 2: Cleanup + losungService + SIGTERM** - `a1d0eeb` (refactor)

## Files Created/Modified
- `frontend/src/services/api.ts` - VITE_API_URL Konfiguration
- `frontend/src/services/websocket.ts` - VITE_API_URL fuer WebSocket mit /api Stripping
- `backend/server.js` - SMTP Hostname statt IP, SIGTERM/SIGINT gracefulShutdown
- `backend/services/emailService.js` - SMTP Hostname statt IP
- `backend/routes/events.js` - QR_SECRET Pflicht-ENV ohne Fallback
- `backend/package.json` - SQLite/Migrate-Skripte entfernt
- `backend/services/losungService.js` - Neuer extrahierter Losung-Service
- `backend/routes/konfi.js` - Verwendet fetchTageslosung statt inline Code
- `backend/routes/teamer.js` - Verwendet fetchTageslosung statt inline Code
- `backend/migrations/078_add_idempotency_keys.sql` - Umbenannt mit numerischem Praefix
- `backend/migrations/079_add_invite_codes.sql` - Umbenannt mit numerischem Praefix
- `backend/migrations/080_add_push_foundation.sql` - Umbenannt mit numerischem Praefix

## Decisions Made
- VITE_API_URL mit Produktions-Fallback: Aendert nichts an Produktion, ermoeglicht aber Staging-Betrieb
- server.godsapp.de als SMTP-Fallback: Hostname statt IP, robuster bei IP-Aenderungen
- QR_SECRET ohne Fallback: Server startet nicht ohne -- zwingt zur expliziten Konfiguration
- Gemeinsamer gracefulShutdown: Eine Funktion fuer SIGINT und SIGTERM, vermeidet Code-Duplizierung

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend ist staging-faehig konfiguriert
- Alle veralteten Artefakte entfernt
- Bereit fuer weitere v2.6 Plans oder v3.0 Onboarding

---
*Phase: 90-backend-cleanup-performance*
*Completed: 2026-03-23*
