# Phase 41: Zertifikate + Dashboard - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Teamer bekommt ein vollstaendiges Dashboard mit Zertifikat-Anzeige, naechsten Events, Badges und Tageslosung. Admin kann Zertifikat-Typen frei erstellen und Teamern zuweisen. Dashboard-Sektionen sind admin-konfigurierbar.

</domain>

<decisions>
## Implementation Decisions

### Zertifikat-System
- Nur freie Typen: Admin erstellt alle Zertifikat-Typen selbst (Name + Icon), keine vordefinierten
- Typische Typen die Admins erstellen: Teamer-Card, JuLeiCa, Erste Hilfe, Rettungsschwimmer
- Ausstellungsdatum ist Pflicht, Ablaufdatum ist optional
- Admin verwaltet Zertifikat-Typen in den Admin-Einstellungen (AdminSettingsPage, neuer Abschnitt)
- Admin weist Zertifikate im Teamer-Detail zu (KonfiDetailView, neue Sektion "Zertifikate")

### Dashboard-Layout
- Reihenfolge: Begruessing > Zertifikate > Events > Badges > Losung (von oben nach unten)
- Begruessing tageszeitabhaengig + Name, wie bei Konfis, mit "Moin" als zusaetzliche Variante (norddeutscher Touch)
- Dashboard admin-konfigurierbar mit show_*-Flags (aequivalent zum Konfi-Dashboard)
- Gemeinsame Admin-Unterseite fuer Dashboard-Konfiguration: Konfi UND Teamer auf einer Seite
- Konfigurierbare Sektionen: Zertifikate, Events, Badges, Losung

### Zertifikat-Darstellung
- Horizontale Karten, alle gleich gross, kein Springen im Layout
- Aehnlich der Level-Anzeige bei Konfis
- 3 Zustaende: Gueltig (volle Farbe + Datum), Abgelaufen (Warnung-Akzent orange/rot + "Abgelaufen"), Nicht erhalten (ausgegraut)
- Alle verfuegbaren Zertifikat-Typen werden immer angezeigt (nicht erhaltene ausgegraut, motiviert zum Sammeln)
- Details im Popover (wie bei Level-Anzeige), nicht inline

### Events im Dashboard
- Die naechsten 3 anstehenden Events (Teamer-Events + Teamer-gesucht)
- "Alle anzeigen" fuehrt zum Events-Tab
- Wie beim Konfi-Dashboard

### Badges im Dashboard
- Kompakte Uebersicht wie bei Konfis: letzte 3 erhaltene Badges als Icons + Gesamtanzahl (z.B. "5 von 12 Badges")
- Klick fuehrt zur vollen TeamerBadgesView im Profil-Tab

### Tageslosung
- Ja, wie bei Konfis: Losungstext + Lehrtext, gleiche API, gleiche Darstellung
- Als konfigurierbare Sektion ganz unten

### Claude's Discretion
- Genauer Aufbau der Dashboard-Konfigurations-Unterseite
- DB-Schema fuer Zertifikate (Tabellen, Spalten)
- API-Endpunkte fuer Zertifikat-CRUD und Dashboard-Daten
- Popover-Design fuer Zertifikat-Details
- Wie die "Moin"-Variante getriggert wird (zufaellig oder regional)

</decisions>

<specifics>
## Specific Ideas

- Zertifikat-Karten sollen wie die Level-Anzeige funktionieren: horizontale Karten, gleich gross, Details im Popover
- "Moin" als norddeutsche Begruessungs-Variante einstreuen (nicht immer, aber gelegentlich)
- Dashboard-Konfiguration fuer Konfi UND Teamer auf einer gemeinsamen Admin-Unterseite (nicht getrennte Seiten)
- Zertifikate zeigen immer alle verfuegbaren Typen (auch nicht erhaltene), wie Badges

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TeamerDashboardPage.tsx`: Existiert als EmptyState-Platzhalter, wird zum vollen Dashboard ausgebaut
- `KonfiDashboardPage.tsx` + `DashboardView.tsx`: Referenz-Implementierung mit DashboardConfig, Events, Badges, Losung
- `TeamerBadgesView.tsx`: Existiert bereits (Phase 40), zeigt Teamer-Badges mit earned/unearned
- `DashboardConfig` Interface: show_konfirmation, show_events, show_losung, show_badges, show_ranking
- Losungs-API: Bereits im Konfi-Dashboard integriert, wiederverwendbar
- `useIonPopover`: Fuer Zertifikat-Detail-Popover (wie Level-Popover)

### Established Patterns
- Dashboard-Daten werden ueber einen einzigen `/api/konfi/dashboard` Endpoint geladen
- DashboardConfig kommt vom Backend und steuert Sektionen-Sichtbarkeit
- Horizontale Karten-Layouts existieren in Badge-Views
- Segment-Toggle Pattern fuer Admin-Konfiguration (Konfi/Teamer)
- Rose (#e11d48) als Teamer-Akzentfarbe (Phase 38)

### Integration Points
- `AdminSettingsPage.tsx`: Neuer Abschnitt fuer Zertifikat-Typen-Verwaltung
- `KonfiDetailView.tsx`: Neue Sektion "Zertifikate" fuer Teamer-Detail (nutzt role_name aus Phase 40)
- `teamer.js`: Neuer Dashboard-Endpoint und Zertifikat-Endpoints
- Dashboard-Konfiguration: Gemeinsame Admin-Unterseite fuer beide Rollen

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 41-zertifikate-dashboard*
*Context gathered: 2026-03-11*
