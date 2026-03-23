# Phase 85: Code-Cleanup - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

9 unabhaengige Cleanup-Tasks: SQLite raus, Legacy-Multer entfernen, deprecated FileViewerModal loeschen, crypto require verschieben, SMTP_SECURE Bug fixen, konfi-managment.js Typo korrigieren, activity_requests.konfi_id umbenennen, express-validator auf material.js + teamer.js ergaenzen.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

Alle Implementierungsentscheidungen liegen bei Claude -- reine Cleanup-Phase.

Bekannte Details aus Codebase-Audit:
- CLN-01: sqlite3 aus backend/package.json dependencies entfernen
- CLN-02: backend/data/*.db Dateien loeschen + .gitignore
- CLN-03: Legacy upload = multer({dest: uploadsDir}) aus server.js entfernen, Stellen auf requestUpload/materialUpload migrieren
- CLN-04: frontend/src/components/chat/modals/FileViewerModal.tsx loeschen (deprecated, kein aktiver Import)
- CLN-05: crypto require in server.js an den Anfang verschieben (vor Multer-Callbacks)
- CLN-06: server.js Zeile 124: secure: process.env.SMTP_SECURE === 'true' || true → secure: process.env.SMTP_SECURE !== 'false'
- CLN-07: konfi-managment.js → konfi-management.js umbenennen + Import in server.js anpassen
- CLN-08: ALTER TABLE activity_requests RENAME COLUMN konfi_id TO user_id + alle Query-Stellen anpassen
- CLN-09: express-validator body-Validierungen auf material.js und teamer.js ergaenzen

</decisions>

<code_context>
## Existing Code Insights

### Key Files
- backend/server.js -- Multer, crypto, SMTP config
- backend/package.json -- sqlite3 dependency
- backend/routes/konfi-managment.js -- Typo im Dateinamen
- backend/routes/activities.js, konfi.js, konfi-managment.js -- activity_requests.konfi_id Queries
- backend/routes/material.js, teamer.js -- fehlende express-validator

</code_context>

<specifics>
## Specific Ideas

Keine -- straightforward Cleanup.

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
