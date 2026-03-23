# Phase 89: Architektur + Cleanup - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

4 Architektur/Cleanup-Items: global.io durch DI ersetzen, material.js Legacy-Felder entfernen, Migrations-Versionstabelle, Wrapped-Cron doppelter Guard entfernen.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

Infrastruktur-Phase. Details:
- ARCH-01: server.js Zeile 139 global.io → io als Parameter an Route-Module (wie db), chat.js + users.js anpassen
- ARCH-02: material.js Zeilen 349-369, 429-464 -- Legacy event_id/jahrgang_id Singular-Pfad entfernen, nur Array-Format
- ARCH-03: database.js -- schema_migrations Tabelle erstellen, Migrationsnamen tracken, nur neue ausfuehren
- CLN-01: backgroundService.js Zeile 450 -- if (today.getDate() !== 1) Guard entfernen, node-cron reicht

</decisions>

<code_context>
## Existing Code Insights

### Key Files
- backend/server.js -- global.io, Route-Initialisierung
- backend/routes/chat.js, users.js -- global.io Zugriffe
- backend/routes/material.js -- Legacy Single-ID Felder
- backend/database.js -- Migration-Runner
- backend/services/backgroundService.js -- Wrapped-Cron Guard

</code_context>

<specifics>
## Specific Ideas
Keine.
</specifics>

<deferred>
## Deferred Ideas
None
</deferred>
