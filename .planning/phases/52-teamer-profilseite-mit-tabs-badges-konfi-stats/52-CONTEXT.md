# Phase 52: Teamer-Profilseite mit Tabs (Badges, Konfi-Stats) - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Teamer-Profilseite (`TeamerProfilePage.tsx`) vollstaendig ueberarbeiten. Aequivalent zur Admin-Profilseite im Layout, aber in Teamer-Farben. Vertikal gestapelte Sektionen: Header, Profil-Einstellungen, Teamer-Badges, Konfi-Badges (wenn vorhanden), Konfi-Stats (wenn vorhanden). Bestehende Komponenten maximal wiederverwenden.

</domain>

<decisions>
## Implementation Decisions

### Header-Layout
- Detail-Header wie AdminProfilePage: zentrierter Avatar mit Initialen (weisser Kreis), Name gross darunter
- Untertitel: `role_title` aus dem Profil verwenden (nicht hardcoded "Teamer:in") — zeigt die eigene Rollenbeschreibung
- Info-Chips: E-Mail-Adresse + "Teamer:in seit [Datum]"
- Farbe: Rose/Rot Gradient beibehalten (#e11d48 -> #be123c), konsistent mit --teamer Klasse
- Avatar: Nur Initialen, kein Foto-Upload

### Seitenstruktur
- KEIN Segment-Switcher / Tabs — alles vertikal gestapelt wie bei AdminProfilePage
- Reihenfolge von oben nach unten:
  1. Detail-Header (Avatar, Name, Role, Chips)
  2. Profil-Einstellungen (IonList mit klickbaren Items)
  3. Teamer-Badges (im Konfi-Badge-Look, NICHT im TeamerBadgesView-Grid)
  4. Konfi-Badges (nur wenn ehemaliger Konfi, im Standard-Konfi-Badge-Look)
  5. Konfi-Stats Zusammenfassung (nur wenn Daten vorhanden, klickbar)
  6. Logout-Button ganz unten

### Badges-Darstellung
- Teamer-Badges UND Konfi-Badges: 1:1 im Look der Konfi-View (Standard-Badge-Ansicht)
- NICHT im TeamerBadgesView-Grid-Style mit Filterung
- Konfi-Badges nur anzeigen wenn ehemaliger Konfi mit erreichten Badges

### Konfi-Stats
- Kompakte Zusammenfassung oben (Gottesdienst-Punkte + Gemeinde-Punkte Totals)
- Nur anzeigen wenn konfiHistory existiert und Punkte > 0
- Bei Klick auf Stats: PointHistory-Ansicht als Modal oeffnen (useIonModal)
- PointHistory-Komponente wiederverwenden

### Account-Einstellungen
- Drei Items als IonList: Rollentitel bearbeiten, E-Mail aendern, Passwort aendern
- Bestehende Modals wiederverwenden (ChangeEmailModal, ChangePasswordModal)
- Rollentitel: eigenes Modal oder Inline-Edit (Claude's Discretion)
- Logout-Button als eigene Sektion am Seitenende (roter Button)

### Claude's Discretion
- Exact spacing und padding zwischen Sektionen
- Sektions-Header Icons und Farben
- Rollentitel-Aenderungs-UI (Modal vs Inline)
- Empty State Design fuer Badges wenn keine vorhanden
- Uebergangsanimationen

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Referenz-Implementierungen
- `frontend/src/components/admin/pages/AdminProfilePage.tsx` — Referenz fuer Header-Layout, Avatar, Info-Chips, Einstellungs-Items mit Modalen
- `frontend/src/components/teamer/pages/TeamerProfilePage.tsx` — Aktuelle Implementierung die ueberarbeitet wird
- `frontend/src/components/admin/views/KonfiDetailView.tsx` — Zeigt wie Teamer-Stats, Badges, Konfi-History conditional gerendert werden

### Badge-Darstellung
- `frontend/src/components/konfi/views/BadgesView.tsx` — Standard Konfi-Badge-Look der 1:1 uebernommen werden soll (NICHT TeamerBadgesView)

### Modals
- `frontend/src/components/konfi/modals/ChangeEmailModal.tsx` — Wiederverwenden fuer E-Mail-Aenderung
- `frontend/src/components/konfi/modals/ChangePasswordModal.tsx` — Wiederverwenden fuer Passwort-Aenderung

### Styling
- `frontend/src/theme/variables.css` — CSS-Klassen: app-detail-header, app-header-banner--teamer, app-icon-circle, app-list-item

### Backend
- `backend/routes/teamer.js` — GET /teamer/profile Endpoint (liefert user + konfi_data)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AdminProfilePage.tsx`: Detail-Header Pattern mit Avatar, Info-Chips, IonList-Sektionen — als Vorlage kopieren und anpassen
- `ChangeEmailModal` + `ChangePasswordModal`: Direkt wiederverwendbar via useIonModal Hook
- `BadgesView.tsx` (Konfi): Badge-Darstellung 1:1 uebernehmen
- `PointHistory`: Als Modal einbetten fuer Konfi-Stats Detail

### Established Patterns
- `useIonModal` Hook fuer alle Modals (NIEMALS `<IonModal isOpen>`)
- `app-detail-header` CSS-Klasse fuer grosse zentrierte Header
- `app-header-banner--teamer` fuer Rose/Rot Gradient
- Pull-to-refresh via IonRefresher

### Integration Points
- Backend GET `/teamer/profile` liefert bereits: user (display_name, username, email, role_title, organization_name, teamer_since) + konfi_data (points, badges)
- Backend muss evtl. erweitert werden: konfiHistory + Konfi-Badges separat laden wenn vorhanden

</code_context>

<specifics>
## Specific Ideas

- "Wie bei Admin" — AdminProfilePage ist die primaere Referenz fuer Layout und Struktur
- "1:1 wie in der Konfi View" — Badges muessen exakt wie BadgesView (Konfi) aussehen, nicht wie TeamerBadgesView
- "PointHistory wiederverwenden" — bestehende PointHistory-Komponente als Modal einbetten
- Rollentitel dynamisch aus `role_title` Feld, nicht hardcoded

</specifics>

<deferred>
## Deferred Ideas

- Foto-Upload fuer Avatar — eigene Phase falls gewuenscht
- TeamerBadgesView-Grid mit Filterung — bleibt separate View, wird hier nicht eingebaut

</deferred>

---

*Phase: 52-teamer-profilseite-mit-tabs-badges-konfi-stats*
*Context gathered: 2026-03-18*
