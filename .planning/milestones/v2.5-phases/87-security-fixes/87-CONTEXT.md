# Phase 87: Security-Fixes - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

5 unabhaengige Security/Bug-Fixes: Losung-API-Key Fallback entfernen, Passwort-Minimum 6→8, Chat-Nachrichten Laengenlimit, Socket.IO Typing Org-Check, useOfflineQuery Stale-Closure Fix.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

Infrastruktur-Phase. Details:
- SEC-03: konfi.js:1439, teamer.js:766 -- Fallback-Wert entfernen, bei fehlendem Key Fehler werfen
- SEC-04: auth.js Zeile 57/86/701, validation.js Zeile 59 -- isLength({min:6}) → isLength({min:8})
- SEC-05: chat.js Zeilen 22-27 -- isLength({max:4000}) zur validateSendMessage hinzufuegen
- SEC-06: server.js Zeilen 115-129 -- typing/stopTyping analog zu joinRoom Org-Check
- CLN-02: useOfflineQuery.ts Zeile 135 -- data aus revalidate-Closure entfernen, setData nutzen

</decisions>

<code_context>
## Existing Code Insights

### Key Files
- backend/routes/konfi.js, teamer.js -- Losung-API-Key
- backend/routes/auth.js, backend/middleware/validation.js -- Passwort-Validierung
- backend/routes/chat.js -- Chat-Nachricht Validierung
- backend/server.js -- Socket.IO typing Handler
- frontend/src/hooks/useOfflineQuery.ts -- Stale-Closure

</code_context>

<specifics>
## Specific Ideas
Keine.
</specifics>

<deferred>
## Deferred Ideas
None
</deferred>
