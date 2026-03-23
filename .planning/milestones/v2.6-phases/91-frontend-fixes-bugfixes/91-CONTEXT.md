# Phase 91: Frontend-Fixes + Bugfixes - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Frontend-seitige Fixes: LiveUpdateContext Module-Scope-Leak, window.location.href Navigation (Event-Chat + Serie), Badge-Progress fuer streak/time_based Kriterien.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — bug fixes and architecture improvements with clear targets.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/contexts/LiveUpdateContext.tsx` — listeners Map auf Modul-Ebene (Zeile 40)
- `frontend/src/components/admin/views/EventDetailView.tsx` — window.location.href Zeile 397 (Chat-Nav)
- `frontend/src/components/admin/views/EventDetailSections.tsx` — window.location.href Zeile 371 (Serie-Nav)
- `backend/routes/badges.js` — streak-Berechnung Zeile 546 (checkStreakCriteria)
- `backend/routes/konfi.js` — Badge-Progress Zeilen 1055-1063 (streak/time_based TODO)

### Established Patterns
- useIonRouter fuer Navigation (v2.4 Migration)
- useRef fuer Provider-lokalen State
- Shared Utils fuer Badge-Logik zwischen konfi.js und badges.js

### Integration Points
- EventDetailView → Chat-Route (/admin/chat/:roomId)
- EventDetailSections → Event-Route (/admin/events/:eventId)
- konfi.js Badge-Progress → badges.js Badge-Vergabe (gleiche Kriterien)

</code_context>

<specifics>
## Specific Ideas

- BUG-01: Chat-Erstellung aus Event leitet auf schwarze Seite — window.location.href verursacht Full-Reload, Ionic App-State geht verloren
- BUG-02: checkStreakCriteria aus badges.js extrahieren und in konfi.js fuer Progress-Berechnung wiederverwenden

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
