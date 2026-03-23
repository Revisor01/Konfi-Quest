# Phase 88: Backend-Performance - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

4 Backend-Performance-Verbesserungen: Chat-Raum N+1 (Direct-Message-Namen), korrelierte Subquery in Chat-Sortierung, Wrapped-Snapshot parallelisieren, DB Pool konfigurieren.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

Infrastruktur-Phase. Details:
- PERF-01: chat.js Zeilen 426-441 -- Promise.all pro Direct-Room → JOIN in Haupt-Query
- PERF-02: chat.js Zeile 419 -- korrelierte Subquery ORDER BY → LATERAL oder last_message_at Spalte
- PERF-03: wrapped.js Zeilen 406-422, 639-654 -- sequenzielle for..of → Promise.all pro Konfi (oder Promise.allSettled mit Concurrency-Limit)
- PERF-04: database.js -- max, idleTimeoutMillis, connectionTimeoutMillis explizit setzen, PG_POOL_MAX ENV

</decisions>

<code_context>
## Existing Code Insights

### Key Files
- backend/routes/chat.js -- Chat-Raum-Uebersicht + Nachrichten
- backend/routes/wrapped.js -- Wrapped-Snapshot-Generierung
- backend/database.js -- pg.Pool Konfiguration

</code_context>

<specifics>
## Specific Ideas
Keine.
</specifics>

<deferred>
## Deferred Ideas
None
</deferred>
