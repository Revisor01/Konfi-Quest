# Phase 109: Haptics + Searchbar + IonRange - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning
**Mode:** Auto-generated

<domain>
## Phase Boundary

Pull-to-Refresh Haptics in allen Views, Searchbar Classic Style auf alle IonSearchbar, IonRange Wert-Anzeige und Maximalwerte.

</domain>

<decisions>
## Implementation Decisions

### Haptics (UXH-01)
- **D-01:** ionPullStart Event auf allen IonRefresher — Capacitor Haptics ImpactStyle.Light
- **D-02:** Bereits in einigen Views implementiert (triggerPullHaptic Utility existiert), auf ALLE Views ausweiten

### Searchbar (SBS-01)
- **D-03:** ios26-searchbar-classic Klasse auf alle IonSearchbar Instanzen
- **D-04:** Alle Views und Modale durchsuchen nach IonSearchbar

### IonRange (IRV-01, IRV-02)
- **D-05:** IonRange soll aktuellen Wert als Label/Badge sichtbar anzeigen
- **D-06:** Maximalwerte sinnvoll konfiguriert (je nach Kontext: Teilnehmer, Punkte, Kapazitaet)

### Claude's Discretion
Exakte Implementation der Wert-Anzeige (Badge neben Slider vs. Label oben).

</decisions>

<canonical_refs>
## Canonical References

- `frontend/src/utils/haptics.ts` — triggerPullHaptic Utility
- `frontend/src/theme/variables.css` — ios26-searchbar-classic Klasse (falls vorhanden)

</canonical_refs>

<code_context>
## Existing Code Insights

- triggerPullHaptic existiert und wird in ChatOverview, MembersModal verwendet
- IonSearchbar wird in mehreren Modalen und Views verwendet

</code_context>

<specifics>
## Specific Ideas
Keine.
</specifics>

<deferred>
## Deferred Ideas
None.
</deferred>
