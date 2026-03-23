# Phase 90: Backend-Cleanup + Performance - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend-seitige Tech-Debt-Items: Performance (bcrypt async, Badge N+1, Notification Bulk), Konfiguration (ENV-Variablen, Fallbacks entfernen), Cleanup (SQLite-Reste, Migrations-Namen, losungService, SIGTERM).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/routes/auth.js` — bereits korrekt async bcrypt (Vorbild)
- `backend/routes/badges.js` — streak-Berechnung existiert (Zeile 546)
- `backend/database.js` — Pool + runMigrations bereits vorhanden

### Established Patterns
- DI-Pattern fuer Services (liveUpdate.init, db als Parameter)
- express-validator fuer Eingabevalidierung
- process.env mit Fallback-Defaults

### Integration Points
- `backend/server.js` — SIGTERM, SMTP-Config
- `backend/routes/konfi.js` + `backend/routes/teamer.js` — Losung-Duplikat
- `backend/routes/konfi-management.js` + `backend/routes/users.js` — bcrypt sync
- `frontend/src/services/api.ts` + `websocket.ts` — hardcoded URLs

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
