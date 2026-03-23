---
phase: 85-code-cleanup
plan: 01
subsystem: backend
tags: [sqlite, multer, smtp, crypto, cleanup, dependencies]

# Dependency graph
requires: []
provides:
  - SQLite-Dependency vollständig aus backend/package.json entfernt
  - Legacy-Multer-Block aus server.js entfernt
  - Deprecated FileViewerModal aus chat/modals geloescht
  - crypto require an Dateianfang verschoben (vor Multer-Configs)
  - SMTP_SECURE Bug behoben (war immer true unabhaengig von ENV)
  - upload-Parameter aus konfi.js und activities.js Signaturen entfernt
affects: [backend-deployment, docker-image-build]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "crypto wird an Dateianfang mit anderen requires geladen (kein late require)"
    - "SMTP_SECURE via ENV steuerbar: !== 'false' Pattern (wie emailService.js)"

key-files:
  created: []
  modified:
    - backend/package.json
    - backend/server.js
    - backend/routes/konfi.js
    - backend/routes/activities.js
  deleted:
    - frontend/src/components/chat/modals/FileViewerModal.tsx

key-decisions:
  - "SMTP_SECURE: !== 'false' statt === 'true' || true — konsistent mit emailService.js Pattern"
  - "*.db Pattern in Root-.gitignore bereits vorhanden, kein separater Eintrag noetig"

patterns-established: []

requirements-completed: [CLN-01, CLN-02, CLN-03, CLN-04, CLN-05, CLN-06]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 85 Plan 01: Code Cleanup — SQLite, Legacy-Multer, SMTP Bug Summary

**SQLite-Dependency entfernt, Legacy-Multer-Block geloescht, crypto-Reihenfolge-Bug und SMTP_SECURE-Bug in server.js behoben, tote Frontend-Komponente geloescht**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T22:49:06Z
- **Completed:** 2026-03-22T22:49:26Z
- **Tasks:** 2
- **Files modified:** 4 (plus 1 geloescht)

## Accomplishments

- sqlite3 aus backend/package.json entfernt (reduziert Docker-Image-Groesse)
- Legacy-Multer Block (`const upload = multer`) aus server.js entfernt, upload-Parameter aus konfi.js und activities.js Signaturen bereinigt
- crypto require an Dateianfang verschoben (war nach dem Legacy-Multer-Block, also nach `requestUpload` Nutzung — potenzielle Race-Condition)
- SMTP_SECURE Bug geloest: `=== 'true' || true` war immer `true` unabhaengig von ENV-Wert; jetzt `!== 'false'` wie in emailService.js
- Deprecated `chat/modals/FileViewerModal.tsx` geloescht (Nachfolger `shared/FileViewerModal.tsx` aktiv genutzt)

## Task Commits

Jeder Task wurde atomisch committed:

1. **Task 1: SQLite-Dependency entfernen und DB-Dateien loeschen** - `093cb04` (chore)
2. **Task 2: server.js bereinigen und FileViewerModal loeschen** - `c378c43` (chore)

## Files Created/Modified

- `backend/package.json` - sqlite3 aus dependencies entfernt
- `backend/server.js` - crypto nach oben, Legacy-Multer Block entfernt, SMTP_SECURE gefixt, Route-Aufrufe ohne upload-Parameter
- `backend/routes/konfi.js` - Signatur von 4 auf 3 Parameter reduziert (upload entfernt)
- `backend/routes/activities.js` - Signatur von 5 auf 4 Parameter reduziert (upload entfernt)
- `frontend/src/components/chat/modals/FileViewerModal.tsx` - GELOESCHT (deprecated)

## Decisions Made

- SMTP_SECURE: `!== 'false'` Pattern gewaehlt (konsistent mit emailService.js, semantisch klarer)
- Root `.gitignore` hat bereits `*.db` Pattern — kein zusaetzlicher Eintrag noetig

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - keine externen Dienste konfiguriert.

## Next Phase Readiness

- Alle 6 CLN-Requirements (CLN-01 bis CLN-06) abgearbeitet
- Backend-Deployment: Docker-Image wird beim naechsten Build ohne sqlite3 gebaut
- Keine laufenden Tests/Builds betroffen

---
*Phase: 85-code-cleanup*
*Completed: 2026-03-22*

## Self-Check: PASSED

- backend/package.json: FOUND
- backend/server.js: FOUND
- backend/routes/konfi.js: FOUND
- backend/routes/activities.js: FOUND
- frontend/src/components/chat/modals/FileViewerModal.tsx: CONFIRMED DELETED
- Commit 093cb04: FOUND
- Commit c378c43: FOUND
