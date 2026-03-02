# Phase 5: Admin-Views Erweitert - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Restliche 6 Admin-Seiten (UsersView, OrganizationView, LevelsPage, GoalsPage, InvitePage, SettingsPage) auf Shared Components umstellen und Inline-Styles durch CSS-Klassen ersetzen. Zusaetzlich: Detail-Views (Admin-EventDetailView, Konfi-EventDetailView, KonfiDetailView) nachtraeglich bereinigen und Icon-Farb-Konsistenz herstellen. Bestehende Farben und Funktionalitaet beibehalten.

</domain>

<decisions>
## Implementation Decisions

### GoalsPage + InvitePage
- Standard IonToolbar beibehalten (kein SectionHeader) -- sind Formular-/Modal-Seiten, keine Daten-Views
- GoalsPage: Stepper-Pattern (Plus/Minus-Buttons mit grosser Zahl) als `app-stepper` CSS-Klasse extrahieren -- wird auch im Event-Modal verwendet
- InvitePage: Inline-Styles moeglichst sinnvoll durch CSS-Klassen ersetzen, wiederverwendbare Patterns bevorzugen
- Standard-Ionic-Komponenten (IonSelect, IonButton) bleiben wie sie sind

### SettingsPage
- IonToolbar beibehalten (ist Root-Tab-Page, kein View)
- Alle wiederkehrenden Patterns als CSS-Klassen: flex:1, margin:16px, padding:16px als Utility-Klassen
- Ziel: unter 5 Inline-Styles
- Profil-Block modernisieren -- passend zum Stil der uebrigen App (Claude waehlt bestes Pattern)

### Inline-Style Bereinigung
- Kein festes numerisches Ziel -- alle wiederkehrenden Patterns als CSS-Klassen extrahieren
- Pragmatisch: was sinnvoll wiederverwendbar ist wird Klasse, einmalige Sonderfaelle duerfen bleiben
- Fuer Views mit SectionHeader/ListSection (UsersView, OrganizationView, LevelsPage): auch funktional aufraeumen

### Funktionale Verbesserungen (bestehende Views)
- IonItemSliding einfuehren wo fehlend
- IonRefresher einfuehren wo fehlend
- Suchleiste einfuehren wo sinnvoll (z.B. UsersView)
- Claude entscheidet pragmatisch wo was fehlt

### OrganizationView
- Alles in CSS-Klassen und bestehende Standards nutzen fuer volle Konsistenz
- Suche+Filter-Block: app-search-bar und app-segment-wrapper Pattern nutzen
- Initialen-Icon: Als `app-avatar-initials` CSS-Klasse extrahieren (wiederverwendbar fuer Organisationen und Benutzer)
- Detail-Stats-Row: `app-detail-stats` CSS-Klasse nutzen (Icon + Text Paare in Row)
- Runde Swipe-Action-Buttons (Edit/Delete): Als CSS-Klasse extrahieren

### Icon-Konsistenz (WICHTIG - gilt ueberall)
- Gleiche Bedeutung = gleiches Icon = gleiche Farbe -- ueberall in der App
- Icons sind IMMER solid, NICHT outline (Ausnahme: Navigations-Icons wie arrowBack)
- Icon-Farben als CSS-Klassen definieren (z.B. app-icon-color--events, app-icon-color--participants)
- Auch in Phase-4-Dateien (EventDetailViews, AdminProfilePage) nachtraeglich anwenden

### Icon-Farb-Mapping (Referenz fuer Planner)
| Konzept | Icon | Farbe | CSS-Klasse |
|---------|------|-------|------------|
| Events/Datum | `calendar` | #dc2626 (rot) | app-icon-color--events |
| Uhrzeit | `time` | #dc2626 (rot) | app-icon-color--events |
| Ort | `location` | #dc2626 (rot) | app-icon-color--events |
| Teilnehmer/Konfis | `people` | #34c759 (gruen) | app-icon-color--participants |
| Team/Users | `person` | #667eea (blau) | app-icon-color--users |
| Warteliste | `listOutline`/`hourglass` | #fd7e14 (orange) | app-icon-color--warning |
| Punkte/Trophy | `trophy` | #ff9500 (orange) | app-icon-color--badges |
| Badges | `ribbon` | #f59e0b (orange) | app-icon-color--badges |
| Kategorie | `pricetag` | #5b21b6 (lila) | app-icon-color--category |
| Gottesdienst | `school` | #3b82f6 (blau) | app-icon-color--gottesdienst |
| Gemeinde | `people` | #22c55e (gruen) | app-icon-color--gemeinde |
| Aktivitaeten | `flash` | #059669 (gruen) | app-icon-color--activities |
| Organisationen | `business` | #2dd36f (gruen) | app-icon-color--organizations |
| Jahrgaenge | `school` | #007aff (blau) | app-icon-color--jahrgang |
| Status aktiv | `checkmarkCircle` | #34c759 (gruen) | app-icon-color--success |
| Status inaktiv | `closeCircle` | #dc3545 (rot) | app-icon-color--danger |

### Detail-Views nachtraeglich bereinigen
- Admin-EventDetailView (63 Inline-Styles): Icon-Farben durch CSS-Klassen ersetzen, Layout-Styles bereinigen
- Konfi-EventDetailView (34 Inline-Styles): Icon-Farben durch CSS-Klassen ersetzen
- KonfiDetailView (51 Inline-Styles): Wurde in Phase 4 bewusst uebersprungen (ActivityRings-Header bleibt). Aber Inline-Styles in Info-Rows und Listen koennen bereinigt werden

### Claude's Discretion
- Profil-Block-Design auf SettingsPage (passend zum App-Stil)
- Welche Views IonRefresher/IonItemSliding/Suchleiste brauchen
- Ob KonfiDetailView ActivityRings-Header-Bereich angepasst wird oder nur darunter

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SectionHeader`: Bereits in UsersView, OrganizationView, LevelsPage (Phase 3)
- `ListSection`: Bereits in UsersView, OrganizationView, LevelsPage (Phase 3)
- CSS-Klassen aus Phase 4: app-settings-item, app-info-box, app-segment-wrapper, app-search-bar, app-progress-bar, app-points-display, app-detail-header, app-status-chip
- SectionHeader Presets: events, activities, konfis, users, organizations, badges, requests, jahrgang

### Established Patterns
- GoalsPage/InvitePage: Formular-Seiten mit IonToolbar (kein SectionHeader)
- SettingsPage: Navigations-Seite mit app-settings-item Pattern
- Stepper-Pattern: Plus/Minus-Buttons in GoalsPage und Event-Modal

### Integration Points
- variables.css: Neue CSS-Klassen (app-stepper, app-avatar-initials, app-detail-stats, app-icon-color--)
- Phase-4-Dateien: EventDetailViews nachtraeglich Icon-Farb-Klassen anwenden

### Aktuelle Inline-Style-Counts
| Datei | Inline-Styles | Hat SectionHeader |
|-------|--------------|-------------------|
| UsersView.tsx | 17 | Ja (Phase 3) |
| OrganizationView.tsx | 31 | Ja (Phase 3) |
| AdminLevelsPage.tsx | 10 | Ja (Phase 3) |
| AdminGoalsPage.tsx | 19 | Nein (Formular) |
| AdminInvitePage.tsx | 27 | Nein (Formular) |
| AdminSettingsPage.tsx | 26 | Nein (Tab-Root) |
| Admin-EventDetailView.tsx | 63 | Ja (Phase 4) |
| Konfi-EventDetailView.tsx | 34 | Ja (Phase 4) |
| KonfiDetailView.tsx | 51 | Nein (ActivityRings) |
| **Summe** | **278** | |

</code_context>

<specifics>
## Specific Ideas

- Stepper soll so aussehen wie im Event-Erstellen-Modal (gleiche app-stepper Klasse)
- Icon-Konsistenz: "Ueberall wo wir etwa Kategorie in Stats haben, gleiches Icon, gleiche Farbe"
- SettingsPage Profil-Block: "Passend zum Stil der uebrigen App" modernisieren
- OrganizationView: "Alles in CSS und unsere Standards nutzen, damit Konsistenz entsteht"

</specifics>

<deferred>
## Deferred Ideas

None -- Diskussion blieb im Phase-Scope.

</deferred>

---

*Phase: 05-admin-views-erweitert*
*Context gathered: 2026-03-02*
