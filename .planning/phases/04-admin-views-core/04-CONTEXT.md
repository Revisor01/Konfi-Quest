# Phase 4: Admin-Views Core - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Alle Admin-Views (Haupt-Views, Detail-Views, Pages, Settings, Modals) und Konfi-Views ans Konfi-Referenz-Design anpassen. Bestehende Funktionalitaet beibehalten, Inline-Styling durch CSS-Klassen und Shared Components ersetzen. Badges-Tab aus der Admin-TabBar nach Settings verschieben und auf 5 Tabs reduzieren.

</domain>

<decisions>
## Implementation Decisions

### Detail-View Layout
- KonfiDetailView behaelt den ActivityRings-Header komplett unberuehrt — kein SectionHeader, kein Angleichen
- EventDetailView nutzt SectionHeader mit status-basierter Farbe:
  - `upcoming` = Blau
  - `open` = Gruen
  - `closed` = Grau
  - `cancelled` = Rot
- Header-Farbe basiert ausschliesslich auf `registration_status`, nicht auf Attendance-Fortschritt
- Teilnehmer-Statusse (confirmed, pending/waitlist, present, absent) muessen im Admin- und Konfi-Bereich korrekt abgebildet werden
- Modal-Pages (GoalsPage, InvitePage) behalten Standard IonToolbar — kein SectionHeader in Modals (Phase 6 Scope)

### List-Item Styling
- CSS-Klassen in variables.css erweitern fuer wiederkehrende Inline-Styles (z.B. app-list-item--gottesdienst, app-list-item--gemeinde fuer Farb-Borders)
- Status-Farben als CSS-Klassen standardisieren: app-list-item--success (gruen), app-list-item--warning (orange), app-list-item--danger (rot), app-list-item--info (blau)
- Einheitliches Such-Pattern fuer alle Suchleisten (gleiche Abstande, Stil, Position oberhalb der Liste)
- Jede View behaelt ihre spezifische Datenanzeige — nur das visuelle Styling (Abstande, Farben, Font-Groessen) wird angeglichen
- IonItemSliding (Swipe-Aktionen) ueberall einfuehren wo loeschbare/editierbare Items sind
- Settings-Pattern: eigene CSS-Klassen (z.B. app-settings-item) fuer AdminSettingsPage und AdminProfilePage mit groesseren Abstaenden und Gruppen-Headern
- Segment-Tabs (IonSegment) einheitlich stylen: gleiche Abstande, Farben und Position ueber alle Views

### Admin-Konfi Uebergang
- Farben angleichen: Admin-Views bekommen die gleichen Farb-Presets wie ihre Konfi-Gegenstuecke (Events=Rot in beiden, Badges=Orange in beiden etc.)
- Views ohne Konfi-Gegenstueck (KonfisView, OrganizationView, UsersView) behalten bestehende Farb-Presets
- Einheitlicher FAB-Button in allen Views mit Erstellen-Funktion (gleiche Position, Groesse, Farbe)
- Pull-to-Refresh (IonRefresher) ueberall einfuehren wo Daten-Listen sind
- Badges-Tab aus Admin-TabBar entfernen, Badge-Verwaltung in Settings-Bereich integrieren (neben Levels), Admin-TabBar auf 5 Tabs reduzieren

### Inline-Styles Bereinigung
- Maximal bereinigen: Jedes Inline-Style das durch eine CSS-Klasse ersetzbar ist, wird ersetzt
- Nur echte dynamische Werte (z.B. width basierend auf Prozentwert) bleiben inline
- Ziel: deutlich unter 100 Inline-Styles in Admin-Dateien
- Bereinigung betrifft auch Admin-Modals (EventModal, ActivityModal, BonusModal etc.)
- Bereinigung betrifft auch Konfi-Views und Konfi-Modals

### Claude's Discretion
- Swipe-Aktionen pro View: Claude entscheidet ob nur Delete oder Delete+Edit sinnvoll ist
- Exakte CSS-Klassen-Namen fuer neue Patterns (Suche, Settings, Segment-Tabs)
- Reihenfolge der Badge-Verwaltung innerhalb der Settings-Page
- Welche verbleibenden Inline-Styles als dynamisch/legitim eingestuft werden

</decisions>

<specifics>
## Specific Ideas

- Admin- und Konfi-Events sollen visuell identisch aufgebaut sein — gleiche Farbe, gleicher Header, nur Admin hat zusaetzliche Edit/Delete-Aktionen
- Badges gehoert konzeptuell in Settings weil es ein festes Setting ist (wie Levels), nicht etwas wo man aktiv arbeitet
- Die Admin-TabBar mit 5 statt 6 Tabs: Konfis, Activities, Events, Chat, Settings

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SectionHeader` (shared/): 8 Farb-Presets, Stats-Row — bereits in 15 Views importiert
- `ListSection` (shared/): IonCard-Wrapper mit auto-EmptyState — bereits in den meisten Views
- `EmptyState` (shared/): Icon + Text Leerzustand
- CSS-Klassen in variables.css: app-list-item, app-icon-circle, app-corner-badge, app-info-row, app-status-chip — bereits in vielen Views genutzt
- `filterBySearchTerm` (utils/helpers): Wiederverwendbare Suchfunktion

### Established Patterns
- Admin-Views nutzen SectionHeader mit Preset + ListSection mit EmptyState-Props (Phase 3 Pattern)
- List-Items nutzen app-list-item CSS-Klassen mit IonItemSliding fuer Swipe-Aktionen
- Farbcodierung ueber CSS-Klassen: --success (gruen), --danger (rot), --info (blau), --warning (orange)
- EventsView hat statusColor/statusText Inline-Logik die zu CSS-Klassen werden sollte

### Integration Points
- Admin-TabBar: frontend/src/components/layout/MainTabs.tsx — Tab-Konfiguration fuer Admin-Bereich
- Admin-Pages (Wrapper): frontend/src/components/admin/pages/Admin*Page.tsx — laden die Views als Content
- Route-Konfiguration: muss angepasst werden wenn Badges-Tab entfernt wird
- Settings-Page: AdminSettingsPage.tsx — hier wird Badge-Verwaltung integriert

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-admin-views-core*
*Context gathered: 2026-03-01*
