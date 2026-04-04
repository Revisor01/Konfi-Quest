# Phase 112: Konfi Aktivitaeten + Profil + Modal - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning
**Mode:** Auto-generated

<domain>
## Phase Boundary

Verbleibende Konfi-Views und Modale an Design-Patterns anpassen.

</domain>

<decisions>
## Implementation Decisions

### Aktivitaeten-View (KAV-01)
- **D-01:** Listen an neuen Listen-Stil: flex-div statt IonList, 12px CardContent Padding

### Konfi Profil (KPR-01, KPR-02)
- **D-02:** Alle Listen-Elemente an neuen Stil angepasst
- **D-03:** Meine-Wrappeds: kein Padding unten wenn nur ein Wrapped vorhanden (conditional style)

### Modal Aktivitaet beantragen (MAB-01)
- **D-04:** Abstaende der Elemente innerhalb Cards an Listen-Abstaende (12px) angepasst

### Claude's Discretion
Exakte Anpassungen in den einzelnen Views.

</decisions>

<canonical_refs>
## Canonical References

- `frontend/src/components/konfi/views/ActivitiesView.tsx` — Aktivitaeten-View
- `frontend/src/components/konfi/views/ProfileView.tsx` — Profil-View
- `frontend/src/components/konfi/modals/` — Aktivitaet-beantragen Modal

</canonical_refs>

<code_context>
## Existing Code Insights

- Konfi-Views nutzen teilweise noch IonList-Wrapper
- PointsHistoryModal ist das Referenz-Pattern

</code_context>

<specifics>
## Specific Ideas
Keine.
</specifics>

<deferred>
## Deferred Ideas
None.
</deferred>
