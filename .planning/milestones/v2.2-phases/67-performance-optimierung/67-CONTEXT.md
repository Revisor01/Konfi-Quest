# Phase 67: Performance-Optimierung - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Mega-Komponenten aufteilen, React.memo/useMemo wo noetig, SELECT * durch explizite Spalten ersetzen, BackgroundService optimieren.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase.

Aufgaben:
- Groesste Komponenten identifizieren (>500 Zeilen) und sinnvoll aufteilen
- React.memo fuer teure Child-Komponenten in Listen
- useMemo/useCallback fuer berechnete Werte die bei jedem Render neu berechnet werden
- Backend: SELECT * durch explizite Spalten ersetzen wo sinnvoll (nicht ueberall, nur bei breiten Tabellen)
- KONSERVATIV: Nur optimieren wo messbarer Nutzen, keine premature optimization

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Known Large Components
- ChatRoom.tsx, KonfiDashboardPage, AdminEventsPage, TeamerEventsPage sind die groessten
- EventDetailView (Admin + Konfi) sind ebenfalls gross

### Integration Points
- Frontend: Komponenten-Splitting
- Backend: SQL-Queries in routes/

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

*Phase: 67-performance-optimierung*
*Context gathered: 2026-03-21*
