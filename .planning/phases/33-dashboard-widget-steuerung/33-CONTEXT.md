# Phase 33: Dashboard-Widget-Steuerung - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Dashboard rendert nur die vom Org-Admin aktivierten Sektionen. Backend liefert bereits `dashboard_config` im Dashboard-Endpoint (Phase 30). Admin-Settings-UI mit 5 Toggles existiert bereits (Phase 30-02). Diese Phase verdrahtet die Config mit der DashboardView-Renderlogik.

</domain>

<decisions>
## Implementation Decisions

### Deaktiviertes Widget-Verhalten
- Deaktivierte Widgets werden komplett ausgeblendet (kein Platzhalter, kein Hinweis)
- Nachfolgende Widgets ruecken auf
- Konfis sehen nicht dass ein Widget existiert aber deaktiviert ist

### Leer-Zustand
- Wenn alle 5 Widgets deaktiviert sind, bleibt nur die Header-Card (Begruessing, ActivityRings, Level)
- Kein zusaetzlicher "Keine Inhalte"-Hinweis noetig

### Backend-Strategie
- Backend liefert weiterhin alle Daten unabhaengig von der Dashboard-Config
- Nur Frontend blendet Sektionen basierend auf `dashboard_config` aus
- Keine Backend-Optimierung (Ranking/Badges werden fuer Level-Berechnung etc. sowieso gebraucht)

### Sofort-Wirkung (DSH-03)
- "Sofort" bedeutet: beim naechsten Dashboard-Laden (App-Oeffnen oder Pull-to-Refresh)
- Kein Polling, kein WebSocket-Push
- `dashboard_config` kommt mit jedem GET /konfi/dashboard Response mit
- Kein Hinweis fuer Org-Admin im Settings-Bereich noetig

### Tageslosung-Sonderfall
- Wenn `dashboard_config.show_losung === false`: API-Call GET /konfi/tageslosung wird gar nicht erst gemacht
- Spart einen Netzwerk-Request bei deaktivierter Losung
- Andere Widgets: Backend liefert Daten trotzdem, Frontend blendet nur aus

### Header-Card
- Header-Card (Begruessing, ActivityRings, Level-Info) ist immer sichtbar
- Nicht konfigurierbar -- Kern-Feature des Dashboards
- Kein neuer Toggle noetig

### Claude's Discretion
- Reihenfolge der Conditional-Checks in DashboardView
- Wie dashboard_config durch Props oder Context an DashboardView gelangt
- Ob dashboard_config als eigenes Interface oder in bestehendes DashboardData integriert wird

</decisions>

<specifics>
## Specific Ideas

- Die 5 Toggle-Keys sind bereits definiert: `show_konfirmation`, `show_events`, `show_losung`, `show_badges`, `show_ranking`
- DashboardView hat bereits klar abgegrenzte Sektionen (Konfirmation L752, Events L810, Tageslosung L922, Badges L969, Ranking L1243)
- Jede Sektion hat bereits eine Datenverfuegbarkeits-Pruefung -- die Config-Pruefung muss VOR diese bestehende Pruefung

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DashboardView.tsx`: 5 klar abgegrenzte Widget-Sektionen mit bestehenden Conditional-Renders
- `KonfiDashboardPage.tsx`: Laedt dashboard_config bereits als Teil von dashboardData (GET /konfi/dashboard)
- `AdminSettingsPage.tsx`: 5 IonToggle-Switches mit optimistischem Update-Pattern (Phase 30-02)
- Backend `konfi.js` Dashboard-Endpoint: Liefert `dashboard_config` bereits im Response (Phase 30)

### Established Patterns
- Props-Weitergabe von Page zu View: KonfiDashboardPage -> DashboardView (bestehend fuer pointConfig, events, badges)
- Conditional Rendering: `{condition && (<IonCard>...</IonCard>)}` Pattern in DashboardView
- Config-Defaults: `!== false` Check fuer Boolean-Werte (Phase 32 ActivityRings Pattern)

### Integration Points
- `KonfiDashboardPage.tsx`: Muss dashboard_config aus dashboardData extrahieren und an DashboardView weitergeben
- `DashboardView.tsx`: Muss neue Props fuer dashboard_config akzeptieren und Sektionen bedingt rendern
- Tageslosung-Load in DashboardView: Muss `show_losung` pruefen bevor API-Call gemacht wird

</code_context>

<deferred>
## Deferred Ideas

None -- Diskussion blieb im Phase-Scope

</deferred>

---

*Phase: 33-dashboard-widget-steuerung*
*Context gathered: 2026-03-09*
