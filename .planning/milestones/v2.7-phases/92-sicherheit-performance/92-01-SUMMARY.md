---
phase: 92-sicherheit-performance
plan: 01
subsystem: auth, security
tags: [rbac, verifyTokenRBAC, file-type, magic-bytes, upload-validation, mime]

requires:
  - phase: 87-security-fixes
    provides: verifyTokenRBAC Middleware und RBAC-System
provides:
  - Auth-Routes auf verifyTokenRBAC migriert (gesperrte User sofort 401)
  - Magic-Bytes Upload-Validierung Middleware (validateMagicBytes)
affects: [uploads, auth, chat, konfi, material]

tech-stack:
  added: [file-type@19]
  patterns: [magic-bytes-validation-after-multer]

key-files:
  created: [backend/middleware/uploadValidation.js]
  modified: [backend/routes/auth.js, backend/server.js, backend/routes/chat.js, backend/routes/konfi.js, backend/routes/material.js, backend/package.json]

key-decisions:
  - "file-type@19 per dynamic import (ESM-only Paket in CommonJS Backend)"
  - "Text-basierte MIME-Typen (text/plain, text/csv) von Magic-Bytes-Check ausgenommen"
  - "validateMagicBytes immer nach multer und vor Route-Handler eingefuegt"

patterns-established:
  - "Upload-Validation: multer -> validateMagicBytes -> handler (dreistufig)"
  - "Auth-Routes: rbacVerifier statt verifyToken fuer User-Status-Check"

requirements-completed: [SEC-07, SEC-08]

duration: 3min
completed: 2026-03-23
---

# Phase 92 Plan 01: Auth-RBAC-Migration + Upload-MIME-Haertung Summary

**Auth-Routes auf verifyTokenRBAC umgestellt und Magic-Bytes Upload-Validierung mit file-type@19 in alle 3 Upload-Pfade eingebaut**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-23T20:26:10Z
- **Completed:** 2026-03-23T20:28:44Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- 9 Auth-Endpoints (change-password, update-email, update-role-title, me, invite-code, invite-codes, invite-codes/:id/extend, invite-codes/:id DELETE, logout) von verifyToken auf rbacVerifier migriert
- uploadValidation.js Middleware mit fileTypeFromBuffer erstellt
- Alle 3 Upload-Pfade (Chat, Konfi-Foto, Material) validieren Dateien anhand Magic-Bytes

## Task Commits

Each task was committed atomically:

1. **Task 1: Auth-Routes von verifyToken auf verifyTokenRBAC migrieren** - `144ca17` (feat)
2. **Task 2: Magic-Bytes Upload-Validierung erstellen und einbinden** - `24fee8c` (feat)

## Files Created/Modified
- `backend/middleware/uploadValidation.js` - Neue Middleware: Magic-Bytes-Pruefung via file-type
- `backend/routes/auth.js` - 9 Endpoints von verifyToken auf rbacVerifier umgestellt
- `backend/server.js` - rbacVerifier als Parameter an authRoutes uebergeben
- `backend/routes/chat.js` - validateMagicBytes nach chatUpload.single eingebunden
- `backend/routes/konfi.js` - validateMagicBytes nach requestUpload.single eingebunden
- `backend/routes/material.js` - validateMagicBytes nach materialUpload.array eingebunden
- `backend/package.json` - file-type@19 als Dependency

## Decisions Made
- file-type@19 per dynamic import geladen (ESM-only Paket, Backend ist CommonJS)
- Text-basierte MIME-Typen (text/plain, text/csv) haben keine Magic-Bytes und werden uebersprungen
- Erlaubte Prefixes: image/, video/, audio/, application/pdf, Office-Formate (ZIP + CFB)
- req.user.type durch req.user.role_name in update-role-title ersetzt (verifyTokenRBAC setzt role_name)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Auth-Routes vollstaendig auf RBAC-Middleware migriert
- Upload-Validierung aktiv auf allen 3 Upload-Pfaden
- Bereit fuer Phase 92 Plan 02

---
*Phase: 92-sicherheit-performance*
*Completed: 2026-03-23*
