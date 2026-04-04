# Phase 108: Globale CSS-Patterns - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase)

<domain>
## Phase Boundary

Wiederverwendbare CSS-Variablen und Patterns definieren die auf allen Seiten (Konfi, Teamer, Admin) gelten. Diese Phase aendert KEINE Views — sie definiert nur die Patterns in variables.css und dokumentiert sie.

</domain>

<decisions>
## Implementation Decisions

### Beschreibungstext-Variable (CSS-01)
- **D-01:** Neue CSS-Variable `--app-description-font-size` in variables.css (Default: 0.95rem)
- **D-02:** Variable wird auf `.app-list-item__subtitle`, Event-Beschreibungen und Modal-Beschreibungen angewendet
- **D-03:** Skalierbar an einer einzigen Stelle fuer die gesamte App

### Listen-Pattern (CSS-02)
- **D-04:** Kein IonList als Listen-Wrapper innerhalb von Cards — immer `div` mit `display: flex; flex-direction: column`
- **D-05:** IonCardContent Padding: 12px (mit Items), 16px (leer/EmptyState)
- **D-06:** app-list-item hat bereits margin-bottom: 8px und :last-child margin-bottom: 0 im CSS — das ist korrekt und bleibt
- **D-07:** Kein inline marginBottom oder gap noetig — CSS regelt die Abstaende

### Suche+Filter Pattern (CSS-03)
- **D-08:** Section-Header immer oben, darunter Suche+Filter Card
- **D-09:** Suchleiste: IonSearchbar mit ios26-searchbar-classic Klasse (wie Chat)
- **D-10:** Tab-Leiste (IonSegment): AUSSERHALB der Card, in eigenem app-segment-wrapper div
- **D-11:** Referenz-Implementation: ChatOverview.tsx fuer Suche, EventsView.tsx fuer Tab-Leiste

### Corner-Badge Fix (CSS-04)
- **D-12:** Titel-Overlap durch dynamisches paddingRight loesen (70px single Badge, 120px dual Badges)
- **D-13:** KEIN paddingTop auf das gesamte Item — das blaest die Listen unproportional auf
- **D-14:** paddingRight auf .app-list-item__title, NICHT auf den Container

### Claude's Discretion
Exakte CSS-Werte und Implementierungsdetails.

</decisions>

<canonical_refs>
## Canonical References

### CSS-Dateien
- `frontend/src/theme/variables.css` — Haupt-CSS mit allen app-* Klassen (Zeile 83-140 fuer Listen)

### Referenz-Views
- `frontend/src/components/konfi/modals/PointsHistoryModal.tsx` — Listen-Pattern Referenz
- `frontend/src/components/chat/ChatOverview.tsx` — Suche+Filter Referenz
- `frontend/src/components/konfi/views/EventsView.tsx` — Tab-Leiste + Section-Header Referenz

</canonical_refs>

<code_context>
## Existing Code Insights

### Was schon existiert
- app-list-item CSS mit margin-bottom: 8px und :last-child: 0 (Zeile 83-121 variables.css)
- app-corner-badges Flex-Container (variables.css)
- app-segment-wrapper fuer Tab-Leisten
- SectionHeader shared Component

### Was fehlt
- --app-description-font-size Variable
- Dokumentierte Suche+Filter Anordnung als Pattern
- paddingRight-Regel fuer Titel bei Corner-Badges

</code_context>

<specifics>
## Specific Ideas

Die CSS-Patterns muessen so definiert werden, dass sie in Phase 109-112 (Konfi) und spaeter fuer Teamer/Admin wiederverwendbar sind.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>

---

*Phase: 108-globale-css-patterns*
*Context gathered: 2026-04-04*
