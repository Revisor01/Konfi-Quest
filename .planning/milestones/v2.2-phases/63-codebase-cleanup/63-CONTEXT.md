# Phase 63: Codebase Cleanup - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Quick-Wins, Konsolidierung und Bug-Fixes ueber die gesamte Codebase. Totes Code entfernen, doppelte Logik konsolidieren, kleine Bugs fixen die bei der Offline-Migration aufgefallen sind.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase.

Aufgabentypen:
- Toter Code entfernen (unused imports, auskommentierter Code, deprecated Funktionen)
- Doppelte Typdefinitionen konsolidieren (User Interface existiert in auth.ts UND AppContext.tsx)
- console.log/console.error Cleanup (nur wo noetig, nicht alle)
- Verbleibende localStorage-Referenzen in Kommentaren entfernen
- TypeScript strict mode Verbesserungen wo einfach moeglich
- Kleine UI-Bugs die beim Testen der Offline-Features auffallen

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Known Issues
- User Interface doppelt definiert (auth.ts + AppContext.tsx)
- Einige console.log Statements aus v2.1 Development
- Verbleibende localStorage-Kommentare nach TokenStore-Migration

### Integration Points
- Gesamte Codebase — kein spezifischer Bereich

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 63-codebase-cleanup*
*Context gathered: 2026-03-21*
