# Phase 110: Konfi Events + Details - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning
**Mode:** Auto-generated

<domain>
## Phase Boundary

Events-View und Event-Details der Konfirmanden an globale CSS-Patterns anpassen.

</domain>

<decisions>
## Implementation Decisions

### Events-View (KEV-01, KEV-02, KEV-03)
- **D-01:** Suche+Filter Card unter Section-Header — Suchleiste wie Chat-Pattern (ios26-searchbar-classic)
- **D-02:** Section-Header immer oben an gleicher Stelle (SectionHeader Komponente)
- **D-03:** Event-Liste an neuen Listen-Stil: flex-div statt IonList, 12px CardContent Padding

### Event-Details (KED-01)
- **D-04:** Beschreibungstext nutzt globale CSS-Klasse app-description-text (--app-description-font-size Variable)

### Claude's Discretion
Exakte Anpassung der EventsView Struktur.

</decisions>

<canonical_refs>
## Canonical References

- `frontend/src/components/konfi/views/EventsView.tsx` — Events-View (Referenz-View)
- `frontend/src/components/chat/ChatOverview.tsx` — Suche+Filter Referenz
- `frontend/src/theme/variables.css` — CSS-Patterns

</canonical_refs>

<code_context>
## Existing Code Insights

- EventsView ist die Design-Referenz-View
- app-description-text CSS-Klasse existiert

</code_context>

<specifics>
## Specific Ideas
Keine.
</specifics>

<deferred>
## Deferred Ideas
None.
</deferred>
