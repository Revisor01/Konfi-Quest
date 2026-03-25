# Phase 97: Teamer UI - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Teamer-Dashboard polieren (Zertifikate Lila, Losung pruefen, Badges 1:1 wie Konfi-Dashboard) + Events/Material Suchleisten und Beschreibungstexte.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Zertifikate (TDB-01)
- Zertifikate-Card Gradient von Rosa (#e11d48/#be185d) auf Lila (#7c3aed/#6d28d9) aendern
- Nur der Gradient aendert sich, Layout und Logik bleiben gleich

### Dashboard Losung (TDB-02)
- Losung ist bereits im Teamer-Dashboard implementiert (Zeile 602-636 in TeamerDashboardPage.tsx)
- Pruefen ob Dashboard-Config `show_losung` korrekt gesetzt und Default auf true ist
- Falls Config-Check fehlt oder Default false: fixen

### Dashboard Badges (TDB-03)
- Badges-Sektion im Teamer-Dashboard 1:1 wie im Konfi-Dashboard machen
- Konfi-Dashboard als Referenz: Ueberschriften, Hinweis-Text, geheime Badges anzeigen
- Geheime Badges auch fuer Teamer:innen anzeigen (gleiche Logik wie Konfi)
- Kleiner "Neu"-Schriftzug auf kuerzlich verdienten Badges (awarded_date < 7 Tage)
- "Neu"-Schriftzug auch im Konfi-Dashboard einfuegen (beide gleich)
- Popover bei Klick auf Badge (Badge-Details)

### Events Suchleisten (TEV-01)
- Gleich wie Phase 96: "Suche & Filter" SectionHeader mit searchOutline Icon + IonSearchbar in IonList inset
- Auf TeamerEventsPage und TeamerBadgesPage anwenden

### MaterialModal + Swipe (TEV-02)
- Beschreibungstext: `app-description-text` CSS-Klasse verwenden
- Swipe-Back nach Modal-Oeffnen fixen (gestureEnabled oder ion-back-button pruefen)

### Anwesenheits-Buttons (TEV-03)
- Bestehende Info-Boxen (Anwesend/Abwesend/Ausstehend) im Design-System konsistenter machen
- Farben an bestehende CSS-Variablen angleichen

### Material-Tab Beschreibung (TEV-04)
- `app-description-text` CSS-Klasse auf Material-Beschreibungstexte anwenden

### Claude's Discretion
- Exakte Umsetzung der Konfi-Dashboard-Badge-Referenz fuer Teamer
- Wie der "Neu"-Schriftzug gestylt wird (Position, Farbe, Groesse)
- Swipe-Back Fix Details

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- KonfiDashboardPage.tsx Badges-Sektion als 1:1 Referenz fuer Teamer
- `app-description-text` CSS-Klasse (aus Phase 96 eingefuehrt)
- "Suche & Filter" Pattern (aus Phase 96 in KonfiEventsPage)
- SectionHeader Shared Component

### Established Patterns
- Teamer-Dashboard: Rose/Pink Gradient fuer Zertifikate
- Losung: Blockquote + Citation, API Endpoint /teamer/tageslosung
- Badge-Grid: 56px Icons, Goldener Gradient fuer verdiente
- Searchbar: ios26-searchbar-classic Klasse

### Integration Points
- TeamerDashboardPage.tsx — Zertifikate-Gradient, Losung-Config, Badges-Sektion
- TeamerEventsPage.tsx — Suchleiste
- TeamerBadgesPage.tsx — Suchleiste
- TeamerMaterialDetailPage.tsx — Beschreibungstext
- KonfiDashboardPage.tsx — "Neu"-Badge auch hier einfuegen

</code_context>

<specifics>
## Specific Ideas

- Lila Gradient: #7c3aed → #6d28d9
- Konfi-Dashboard Badge-Sektion als exakte Referenz
- "Neu"-Schriftzug fuer BEIDE Dashboards (Konfi + Teamer)
- Geheime Badges auch bei Teamer:innen

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
