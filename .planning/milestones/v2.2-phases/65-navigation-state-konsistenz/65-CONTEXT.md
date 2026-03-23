# Phase 65: Navigation und State-Konsistenz - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

CustomEvents durch LiveUpdateContext ersetzen, Router-Konsistenz sicherstellen. Alle window.dispatchEvent/addEventListener Patterns fuer Daten-Updates auf das bestehende LiveUpdateContext Pub-Sub System migrieren.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase.

Aufgaben:
- Alle CustomEvent Dispatches fuer Daten-Updates identifizieren (events-updated, activities-updated, requestStatusChanged etc.)
- Diese durch LiveUpdateContext.emit() / useLiveRefresh() ersetzen
- Router-Konsistenz pruefen: Alle Routen korrekt definiert, keine toten Links
- Window Events die NICHT Daten-Updates sind (z.B. rate-limit Event) BEIBEHALTEN
- Bestehende useLiveRefresh-Nutzung nicht brechen

</decisions>

<canonical_refs>
## Canonical References

- `frontend/src/contexts/LiveUpdateContext.tsx` — Bestehendes Pub-Sub System
- `frontend/src/components/*/` — CustomEvent Dispatcher und Listener

</canonical_refs>

<code_context>
## Existing Code Insights

### Established Patterns
- LiveUpdateContext hat subscribe/emit Pattern fuer 11 Event-Typen
- useLiveRefresh Hook fuer Page-Level Subscriptions
- Einige Pages nutzen zusaetzlich window CustomEvents neben LiveRefresh

### Integration Points
- Alle Pages mit window.dispatchEvent('events-updated') etc.
- Alle Pages mit window.addEventListener fuer Daten-Events

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>

---

*Phase: 65-navigation-state-konsistenz*
*Context gathered: 2026-03-21*
