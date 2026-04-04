# Phase 111: Konfi Badges + Popovers - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning
**Mode:** Auto-generated

<domain>
## Phase Boundary

Badges-View, Badge-Grid und Popovers an Design-Patterns anpassen.

</domain>

<decisions>
## Implementation Decisions

### Badges-View (KBV-01 bis KBV-05)
- **D-01:** Tab-Leiste (IonSegment) AUSSERHALB der Card in app-segment-wrapper
- **D-02:** Suchleiste hinzufuegen (wie Chat — ios26-searchbar-classic)
- **D-03:** Teilnehmer:innen-Liste an Listen-Stil angepasst (app-list-item Pattern)
- **D-04:** Anmelde-/Anwesenheits-Button in Listen-Stil ueberfuehrt
- **D-05:** Erreichte-Badges Abstaende: 12px Padding in CardContent
- **D-06:** Badge-Grid: CSS Grid mit grid-template-columns: repeat(3, 1fr) — immer 1/3 Breite, egal wie lang der Titel

### Popovers (BPO-01, BPO-02)
- **D-07:** Popover: Titel einzeilig (white-space: nowrap, text-overflow: ellipsis), Beschreibung darf umbrechen
- **D-08:** Popovers centered positioniert (side: undefined oder alignment: center)
- **D-09:** Max-Width auf Popover damit es nicht aus dem Bildschirm laeuft

### Claude's Discretion
Exakte Popover-Positionierung und Badge-Grid CSS.

</decisions>

<canonical_refs>
## Canonical References

- `frontend/src/components/konfi/views/BadgesView.tsx` — Badges-View
- `frontend/src/components/konfi/views/EventsView.tsx` — Tab-Leiste Referenz
- `frontend/src/components/chat/ChatOverview.tsx` — Suchleiste Referenz

</canonical_refs>

<code_context>
## Existing Code Insights

- BadgesView hat Tab-Leiste und Badge-Grid
- Popovers werden mit IonPopover oder useIonPopover implementiert

</code_context>

<specifics>
## Specific Ideas
Keine.
</specifics>

<deferred>
## Deferred Ideas
None.
</deferred>
