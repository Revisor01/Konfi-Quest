# Phase 49: Badge-UI - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Badge-Verwaltung und -Anzeige konsistent gestalten: Modal-Auswahl auf backgroundColor-Change umstellen, Konfi/Teamer-Segment korrekt positionieren, und Teamer-Badge-Ansicht 1:1 wie Konfi aufbauen.

</domain>

<decisions>
## Implementation Decisions

### Badge-Modal Selection Pattern (UI-05)
- BadgeManagementModal nutzt aktuell `app-list-item--selected` CSS-Klasse fuer Auswahl-Markierung (Zeile 475, 543, 650)
- Das verursacht eine Umrandung — soll durch backgroundColor-Change ersetzt werden
- Pattern: Bei Selection statt `app-list-item--selected` Klasse einen backgroundColor inline-Style oder eine andere CSS-Klasse verwenden die den Hintergrund aendert
- Kein Rand/Outline bei Auswahl — nur Farbwechsel des Hintergrunds

### Badge-Segment Position + Styling (UI-06)
- Admin BadgesView hat bereits Konfi/Teamer Segment (Zeile 288-301)
- Segment muss unter dem Header positioniert sein (nicht im Header selbst)
- "Teamer:innen" darf bei Auswahl NICHT lila/fett sein — normales Segment-Styling
- Pruefen ob das aktuelle Styling korrekt ist, sonst fixen

### Teamer-Badge-Ansicht (UI-07) — BEREITS ERLEDIGT
- TeamerBadgesPage wurde bereits in Phase 52 ueberarbeitet und ist fertig
- Kein weiterer Umbau noetig — UI-07 ist erfuellt

### Claude's Discretion
- Exakte backgroundColor-Werte fuer die Selection-States
- Ob bestehende TeamerBadgesPage komplett durch BadgesView ersetzt wird oder angepasst
- Styling-Details fuer das Segment

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Badge-Modal
- `frontend/src/components/admin/modals/BadgeManagementModal.tsx` — app-list-item--selected Klasse (Zeile 475, 543, 650) die ersetzt werden muss

### Admin Badge-Verwaltung
- `frontend/src/components/admin/BadgesView.tsx` — Konfi/Teamer Segment (Zeile 288-301), Badge-Listen
- `frontend/src/components/admin/pages/AdminBadgesPage.tsx` — selectedRole State, targetRole Props

### Badge-Ansichten (Referenz)
- `frontend/src/components/konfi/views/BadgesView.tsx` — Konfi-Badge-Ansicht (REFERENZ fuer Teamer 1:1)
- `frontend/src/components/teamer/pages/TeamerBadgesPage.tsx` — Aktuelle Teamer-Badge-Seite
- `frontend/src/components/teamer/views/TeamerBadgesView.tsx` — Teamer Badge-View

### CSS
- `frontend/src/theme/variables.css` — app-list-item--selected Klasse die Umrandung verursacht

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Konfi BadgesView (konfi/views/BadgesView.tsx): Referenz-Design fuer Teamer-Badge-Ansicht
- Admin BadgesView hat bereits Konfi/Teamer Segment — Styling pruefen
- backgroundColor-Change Pattern existiert in anderen Modals (z.B. CertificatesPage Zeile 316)

### Established Patterns
- `app-list-item--selected` CSS-Klasse fuer Selection — soll hier NICHT verwendet werden
- backgroundColor-Change inline-Style fuer Selection (z.B. Zertifikate-Icon-Auswahl)
- IonSegment fuer Tabs

### Integration Points
- BadgeManagementModal: Selection-Klasse ersetzen
- Admin BadgesView: Segment-Position und Styling pruefen
- TeamerBadgesPage: An Konfi-BadgesView angleichen

</code_context>

<specifics>
## Specific Ideas

- Teamer-Badge-Ansicht soll exakt gleich aussehen wie Konfi-Badge-Ansicht, nur mit Teamer vorausgewaehlt
- Kein app-list-item--selected in Badge-Modal — nur Hintergrundfarbe aendern

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 49-badge-ui*
*Context gathered: 2026-03-19*
