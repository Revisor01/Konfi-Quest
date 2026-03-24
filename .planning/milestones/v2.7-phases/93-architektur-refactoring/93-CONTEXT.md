# Phase 93: Architektur-Refactoring - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

chatUtils dynamischer Admin, Event-Buchungslogik in bookingUtils extrahieren, useOfflineQuery Fetcher stabilisieren.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — refactoring with clear targets.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/utils/chatUtils.js` — created_by=1 hardcoded (Zeile 21)
- `backend/routes/konfi.js` Zeilen 1242-1409 — Event-Buchungslogik
- `backend/routes/events.js` Zeilen 940-1000 — Event-Buchungslogik (Duplikat)
- `frontend/src/hooks/useOfflineQuery.ts` — Fetcher als Dependency im useCallback

### Established Patterns
- Utils-Pattern: liveUpdate.js, losungService.js als Vorbilder
- useCallback für stabile Referenzen im Frontend
- useRef für mutable Werte ohne Re-Render (dataRef Pattern aus v2.5)

### Integration Points
- chatUtils wird von server.js beim Start aufgerufen (initializeChatRooms)
- konfi.js Event-Booking: POST /events/:id/book, DELETE /events/:id/cancel
- events.js Event-Booking: POST /events/:id/register, DELETE /events/:id/cancel
- useOfflineQuery wird von ~30 Pages im Frontend verwendet

</code_context>

<specifics>
## Specific Ideas

- bookingUtils: Waitlist-Position, Buchungsstatus, Cancel+Nachrücken als Shared Functions
- useOfflineQuery: fetcherRef Pattern (wie dataRef) — Ref trackt aktuelle Fetcher-Funktion, useCallback hat keine fetcher-Dependency

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
