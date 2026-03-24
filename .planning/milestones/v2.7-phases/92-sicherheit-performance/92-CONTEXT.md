# Phase 92: Sicherheit + Performance - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Auth-Routes auf RBAC-Middleware migrieren, Upload-MIME-Validierung mit Magic-Bytes, backgroundService Badge-Check Bulk-Query, verifyTokenRBAC LRU-Cache.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/middleware/rbac.js` — verifyTokenRBAC bereits implementiert (prüft is_active, token_invalidated_at, organization_active)
- `backend/server.js` Zeile 405-418 — altes verifyToken (nur JWT-Signatur)
- `backend/routes/badges.js` — checkAndAwardBadges Funktion
- `backend/services/backgroundService.js` — Badge-Cron mit N+1 Schleife

### Established Patterns
- DI-Pattern (db, io als Parameter)
- express-validator für Eingabevalidierung
- multer mit fileFilter für Upload-Validierung (server.js Zeilen 315-398)

### Integration Points
- `backend/routes/auth.js` — 9 Stellen mit verifyToken statt verifyTokenRBAC
- `backend/server.js` — multer fileFilter für Chat/Material/Avatar Uploads
- `backend/services/backgroundService.js` Zeilen 75-109 — Badge N+1 Schleife
- `backend/middleware/rbac.js` Zeilen 43-91 — DB-Query bei jedem Request

</code_context>

<specifics>
## Specific Ideas

- file-type npm Paket für Magic-Bytes-Analyse
- lru-cache npm Paket für Token-Cache (oder einfaches Map mit setTimeout)

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
