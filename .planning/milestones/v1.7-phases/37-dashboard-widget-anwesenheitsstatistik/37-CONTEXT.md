# Phase 37: Dashboard-Widget + Anwesenheitsstatistik - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Bestehendes Events-Widget im Konfi-Dashboard um "Was mitbringen"-Info erweitern. Pro-Konfi Anwesenheitsstatistik fuer Pflicht-Events in der Admin KonfiDetailView mit Quote und Liste verpasster Events.

</domain>

<decisions>
## Implementation Decisions

### Naechstes-Event-Widget (EUI-02, EUI-03)
- KEIN neues Widget — bestehendes Events-Widget im Dashboard wird erweitert
- Jedes Event in der Liste bekommt die "Was mitbringen"-Info angezeigt (bring_items Feld, falls vorhanden)
- Wenn kein bring_items gesetzt: nichts zusaetzlich anzeigen
- Bestehender show_events Toggle steuert das Widget weiterhin — KEIN neuer show_next_event Toggle
- Backend muss bring_items im /konfi/events oder /konfi/dashboard Endpoint mitliefern

### Anwesenheitsquote (ANW-01)
- Anzeige in der bestehenden Admin KonfiDetailView als neue Sektion
- Nur Pflicht-Events (mandatory=true) werden gezaehlt — freiwillige Events sind optional und verzerren die Statistik
- Darstellung: "X/Y anwesend (Z%)" als Zusammenfassung
- Backend braucht neuen Endpoint oder Erweiterung des bestehenden Konfi-Detail-Endpoints

### Verpasste-Events-Liste (ANW-02)
- Unterhalb der Anwesenheitsquote in der KonfiDetailView
- Zeigt vergangene Pflicht-Events wo Konfi NICHT present war
- Unterscheidung: "Opt-out: [Begruendung]" vs "Nicht erschienen" (attendance_status absent oder NULL bei vergangenem Event)
- Sortierung chronologisch (neueste zuerst)

### Claude's Discretion
- Genaue Platzierung der Anwesenheits-Sektion in KonfiDetailView (nach Aktivitaeten oder nach Bonuspunkten)
- Farbgebung und Icons fuer die Anwesenheitsquote
- Ob Quote als Progress-Bar, Text oder Ring dargestellt wird
- Pagination oder Scrolling fuer lange Verpasste-Events-Listen
- Backend-Query-Optimierung (JOIN vs separate Abfragen)

</decisions>

<specifics>
## Specific Ideas

- "Was mitbringen" nur zeigen wenn vorhanden — kein leeres Feld, keine Platzhalter
- Verpasste Events sollen klar zwischen freiwilliger Abmeldung (Opt-out mit Grund) und unentschuldigtem Fehlen unterscheiden

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- DashboardView.tsx: Widget-Architektur mit 5 konfigurierbaren Sektionen und dashboardConfig Props
- KonfiDashboardPage.tsx: loadUpcomingEvents() laedt bereits anstehende Events fuer Dashboard
- KonfiDetailView.tsx: Pro-Konfi Detailansicht mit Aktivitaeten, Bonuspunkte, Badges Sektionen
- Settings KV-Store: dashboard_show_* Pattern fuer Widget-Toggles (show_events bereits vorhanden)
- AdminSettingsPage.tsx: Toggle-Controls fuer Dashboard-Widgets
- SectionHeader: Wiederverwendbar fuer neue Anwesenheits-Sektion

### Established Patterns
- Dashboard-Config ueber Settings-Tabelle mit UNIQUE(organization_id, key)
- Events-Daten via /konfi/events und /konfi/dashboard Endpoints
- KonfiDetailView zeigt Daten in Sektionen mit SectionHeader + Liste
- useIonModal fuer alle Modals
- AppContext setSuccess/setError fuer Feedback

### Integration Points
- Backend: /konfi/events muss bring_items Feld mitliefern (aktuell nicht im SELECT)
- Backend: /konfi/dashboard muss bring_items in upcoming Events enthalten
- Backend: Neuer Endpoint fuer pro-Konfi Anwesenheitsstatistik (oder Erweiterung von /konfi-management/:id)
- Frontend: DashboardView Events-Sektion um bring_items erweitern
- Frontend: KonfiDetailView um Anwesenheits-Sektion erweitern
- DB: Alle Daten vorhanden (event_bookings.attendance_status, events.mandatory, events.bring_items, event_bookings.opt_out_reason)

</code_context>

<deferred>
## Deferred Ideas

None — Diskussion blieb innerhalb Phase-Scope

</deferred>

---

*Phase: 37-dashboard-widget-anwesenheitsstatistik*
*Context gathered: 2026-03-09*
