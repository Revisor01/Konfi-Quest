# Phase 50: UI-Polish - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Kleinere UI-Inkonsistenzen in verschiedenen Bereichen beheben: Toggle-Positionierung, QR-Button-Platzierung, Badge-Formatierung, Chat-Badge-Overflow, Befoerdern-Hinweis und Beschreibungstext-Schriftgroesse.

</domain>

<decisions>
## Implementation Decisions

### Toggle-Switches rechts aussen (UI-01)
- Toggle-Switches in Jahrgang-Modal und Dashboard-Einstellungen sollen rechts aussen stehen
- Standard IonToggle slot="end" Pattern verwenden
- Betrifft: AdminJahrgaengeePage.tsx (JahrgangModal) und AdminDashboardSettingsPage.tsx

### QR-Scanner-Button Header (UI-02)
- QR-Scanner-Button soll oben rechts im Header positioniert sein (IonButtons slot="end")
- Aktuell: FAB unten rechts — muss in den Header verschoben werden
- Betrifft: KonfiDashboardPage oder aehnliche Seite mit QR-Scanner

### Badge-Fortschritt ohne Nachkommastellen (UI-03)
- Badge-Fortschrittsanzeige soll auf ganze Zahlen gerundet werden (Math.round oder Math.floor)
- Kein "75.3%" — nur "75%"
- Betrifft: Badge-Views wo Fortschritt angezeigt wird

### Chat-Tab-Badge z-index (UI-04)
- Chat-Tab-Badge wird aktuell abgeschnitten — z-index und/oder overflow korrigieren
- IonBadge auf dem Chat-Tab muss komplett sichtbar sein
- Betrifft: MainTabs.tsx oder variables.css

### Befoerdern-Button Hinweistext (UI-08)
- Info-Hinweistext soll UEBER dem Befoerdern-Button stehen (nicht darunter oder ohne Hinweis)
- Erklaert was passiert wenn ein Konfi zum Teamer befoerdert wird
- Betrifft: KonfiDetailView oder aehnliche Admin-Seite mit Befoerdern-Funktion

### Beschreibungstexte Schriftgroesse (Success Criterion 6)
- Beschreibungstexte in Event-Details und Material-Details sollen lesbare Schriftgroesse haben
- Nicht zu klein (mindestens 14px oder 0.875rem)
- Betrifft: EventDetailView.tsx und MaterialDetailView oder aehnliche

### Claude's Discretion
- Genaue CSS-Werte fuer z-index und overflow Fixes
- Exakter Wortlaut des Befoerdern-Hinweistexts
- Ob Math.round oder Math.floor fuer Badge-Fortschritt

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Toggle-Position
- `frontend/src/components/admin/pages/AdminJahrgaengeePage.tsx` — JahrgangModal Toggle-Switches
- `frontend/src/components/admin/pages/AdminDashboardSettingsPage.tsx` — Dashboard Toggle-Switches

### QR-Scanner
- Konfi-Dashboard oder Seite mit QR-Scanner-FAB (suchen nach IonFab oder qrCode)

### Badge-Fortschritt
- Badge-Views mit Fortschrittsanzeige (suchen nach toFixed oder Prozent-Berechnung)

### Chat-Badge
- `frontend/src/components/layout/MainTabs.tsx` — Tab-Badge Rendering
- `frontend/src/theme/variables.css` — Badge/Tab CSS

### Befoerdern
- Admin Konfi-Detail-View mit Befoerdern-Funktion

### Beschreibungstexte
- `frontend/src/components/admin/views/EventDetailView.tsx` — Event-Beschreibung
- Material-Detail-Views — Material-Beschreibung

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Established Patterns
- IonToggle slot="end" fuer rechts-ausgerichtete Toggles
- IonButtons slot="end" fuer Header-Buttons
- IonBadge auf IonTabButton fuer Tab-Badges

### Integration Points
- Alle Fixes sind unabhaengig voneinander — koennen in einem Plan als separate Tasks oder ein Task mit mehreren Aenderungen gemacht werden

</code_context>

<specifics>
## Specific Ideas

- Alle 6 Fixes sind klein und unabhaengig — ein einziger Plan mit einem Task pro Fix oder ein Task fuer alle

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 50-ui-polish*
*Context gathered: 2026-03-19*
