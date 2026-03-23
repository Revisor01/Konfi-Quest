# Phase 86: Logout-Absicherung - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend-Endpoint POST /api/auth/logout implementieren der das aktive Refresh Token revokiert. Frontend-Logout ruft diesen Endpoint auf bevor lokale Daten geloescht werden.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

Infrastruktur-Phase. Details:
- refresh_tokens Tabelle existiert bereits (Migration 068)
- Token hat revoked_at Spalte
- Backend auth.js hat bereits Token-Refresh-Logik (Zeilen 760-800)
- Frontend auth.ts logout() loescht nur lokale Daten + Push-Token
- Neuer Endpoint muss das aktive Refresh Token per revoked_at = NOW() invalidieren
- Frontend muss /api/auth/logout aufrufen VOR clearAuth()

</decisions>

<code_context>
## Existing Code Insights

### Key Files
- backend/routes/auth.js -- Token-Refresh-Logik, Login, Register
- frontend/src/services/auth.ts -- logout() Funktion
- frontend/src/services/tokenStore.ts -- Token-Speicherung

</code_context>

<specifics>
## Specific Ideas
Keine.
</specifics>

<deferred>
## Deferred Ideas
None
</deferred>
