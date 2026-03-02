# Requirements: Konfi Quest

**Defined:** 2026-03-01
**Core Value:** Konsistente, sichere App fuer den produktiven Einsatz mit einheitlichem Design ueber alle Rollen

## v1.1 Requirements

Requirements fuer Milestone v1.1 Design-Konsistenz. Jede Requirement ist einer Roadmap-Phase zugeordnet.

### Design-System

- [x] **DES-01**: SectionHeader-Komponente existiert und rendert kompakte Header mit Icon + Titel inline und optionaler Stats-Row -- identisch zum Konfi-Referenz-Design
- [x] **DES-02**: EmptyState-Komponente existiert und zeigt in leeren Listen einen konsistenten Leerzustand mit Icon und Text
- [x] **DES-03**: ListSection-Komponente existiert und rendert einheitliche Listen-Darstellungen mit den bestehenden app-list-item CSS-Klassen
- [x] **DES-04**: Die bestehenden CSS-Klassen aus variables.css sind dokumentiert und um fehlende Klassen (app-header-banner, app-stats-row) ergaenzt

### Admin-Views

- [ ] **ADM-01**: KonfiPage/KonfiListView nutzt SectionHeader, ListSection und die Konfi-Farblogiken -- visuell konsistent mit dem Konfi-Bereich
- [x] **ADM-02**: ActivitiesPage zeigt Aktivitaeten in einheitlichen Listen mit korrekten Abstaenden und Farbcodierung
- [x] **ADM-03**: EventsPage nutzt das gleiche Header-Banner-Pattern wie die Konfi-Referenz, wobei erweiterte Admin-Bearbeitungsfunktionen erhalten bleiben
- [ ] **ADM-04**: BadgesPage folgt dem kompakten Header-Pattern mit Stats-Row und einheitlichen Listen-Items
- [ ] **ADM-05**: JahrgaengePage folgt dem kompakten Header-Pattern mit Stats-Row und einheitlichen Listen-Items
- [x] **ADM-06**: CategoriesPage zeigt Kategorien in einheitlichen Listen mit korrekten Abstaenden und Farbcodierung
- [ ] **ADM-07**: UsersPage zeigt Benutzer in einheitlichen Listen mit SectionHeader und korrekten Abstaenden
- [ ] **ADM-08**: OrganizationsPage zeigt Organisationen in einheitlichen Listen mit SectionHeader
- [ ] **ADM-09**: LevelsPage nutzt kompaktes Header-Pattern und Farblogiken wie alle anderen Admin-Views
- [ ] **ADM-10**: GoalsPage nutzt kompaktes Header-Pattern und Farblogiken wie alle anderen Admin-Views
- [ ] **ADM-11**: InvitesPage ist visuell konsistent mit dem Rest der Admin-Oberflaeche
- [ ] **ADM-12**: SettingsPage ist visuell konsistent mit dem Rest der Admin-Oberflaeche

### Detail-Views Bereinigung

- [ ] **DET-01**: Admin-EventDetailView nutzt Icon-Farb-CSS-Klassen statt Inline-Farben und hat deutlich weniger Inline-Styles
- [ ] **DET-02**: Konfi-EventDetailView nutzt Icon-Farb-CSS-Klassen statt Inline-Farben und hat deutlich weniger Inline-Styles
- [ ] **DET-03**: KonfiDetailView Info-Rows und Listen nutzen CSS-Klassen (ActivityRings-Header bleibt unberuehrt)

### Icon-Konsistenz

- [ ] **ICO-01**: Icon-Farb-Mapping ist als CSS-Klassen (app-icon-color--*) in variables.css definiert und wird in allen Views konsistent genutzt (gleiches Konzept = gleiches Icon solid = gleiche Farbe)

### Modal-Konsistenz

- [ ] **MOD-01**: Kein einziges Modal im Codebase nutzt mehr das isOpen-Pattern -- alle verwenden useIonModal
- [ ] **MOD-02**: Alle Chat-Modals (CreateChatModal, GroupChatModal, DirectMessageModal, SimpleCreateChatModal) oeffnen und schliessen korrekt ueber useIonModal
- [ ] **MOD-03**: Jedes Modal hat konsistente Formular-Inputs, Farblogiken und Abstaende gemaess der Event-Erstellen-Modal-Referenz
- [ ] **MOD-04**: Auf iOS zeigt jedes Modal den korrekten Card-Modal-Backdrop-Effekt (presenting element korrekt gesetzt)

### Onboarding

- [ ] **ONB-01**: Ein Admin kann einen Einladungs-QR-Code generieren, ein neuer Konfi kann diesen scannen und die Registrierung erfolgreich abschliessen
- [ ] **ONB-02**: Fehlerfaelle im Onboarding-Flow (abgelaufener Code, bereits verwendeter Code, fehlende Felder) werden mit verstaendlichen deutschsprachigen Meldungen behandelt

## Future Requirements

### Teamer-Design
- **TEAM-01**: Teamer-Bereich ans gleiche Design-Pattern wie Admin und Konfi anpassen
- **TEAM-02**: Teamer-spezifische Views mit einheitlichen Shared Components

### Backend-Migration
- **MIG-01**: badges.js PostgreSQL-Migration abschliessen
- **MIG-02**: Statistics System PostgreSQL-Migration
- **MIG-03**: Organizations System PostgreSQL-Migration

## Out of Scope

| Feature | Reason |
|---------|--------|
| Neue App-Features (neue Screens, neue Funktionalitaet) | Fokus auf Design-Konsistenz bestehender Views |
| Offline-Support | Komplexitaet zu hoch, nicht relevant fuer Design-Milestone |
| App Store Submission | Erst nach vollstaendiger Design-Konsistenz |
| Backend-Refactoring | Funktioniert, nur Design-Frontend-Arbeit |
| API-Dokumentation | Kein externer API-Zugriff geplant |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DES-01 | Phase 3 | Complete |
| DES-02 | Phase 3 | Complete |
| DES-03 | Phase 3 | Complete |
| DES-04 | Phase 3 | Complete |
| ADM-01 | Phase 3 (SectionHeader/ListSection) + Phase 4 (CSS-Bereinigung) | Partial (SectionHeader done in Phase 3) |
| ADM-02 | Phase 4 | Complete |
| ADM-03 | Phase 4 | Complete |
| ADM-04 | Phase 3 (SectionHeader/ListSection) + Phase 4 (CSS-Bereinigung) | Partial (SectionHeader done in Phase 3) |
| ADM-05 | Phase 3 (SectionHeader/ListSection) + Phase 4 (CSS-Bereinigung) | Partial (SectionHeader done in Phase 3) |
| ADM-06 | Phase 4 | Complete |
| ADM-07 | Phase 5 | Pending |
| ADM-08 | Phase 5 | Pending |
| ADM-09 | Phase 5 | Pending |
| ADM-10 | Phase 5 | Pending |
| ADM-11 | Phase 5 | Pending |
| ADM-12 | Phase 5 | Pending |
| DET-01 | Phase 5 | Pending |
| DET-02 | Phase 5 | Pending |
| DET-03 | Phase 5 | Pending |
| ICO-01 | Phase 5 | Pending |
| MOD-01 | Phase 6 | Pending |
| MOD-02 | Phase 6 | Pending |
| MOD-03 | Phase 6 | Pending |
| MOD-04 | Phase 6 | Pending |
| ONB-01 | Phase 7 | Pending |
| ONB-02 | Phase 7 | Pending |

**Coverage:**
- v1.1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-01 after v1.1 milestone definition*
