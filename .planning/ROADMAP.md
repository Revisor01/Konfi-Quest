# Roadmap: Konfi Quest -- Design-Konsistenz + Security Hardening

## Overview

Konfi Quest ist eine produktive Ionic 8 App zur Konfirmandenpunkteverwaltung. Das Konfi-UI ist fertig designt und dient als Referenz. Dieser Milestone bringt die gesamte App auf ein konsistentes, sicheres Niveau: zuerst Backend-Security haerten (Multi-Tenant-Isolation, Input-Validierung), dann die Grundlage stabilisieren (Bugs, Themes), Design-System-Bausteine erstellen, alle Admin-Views angleichen, Modals vereinheitlichen, und zuletzt den Onboarding-Flow validieren. Ergebnis: eine go-live-bereite App mit einheitlichem Design und abgesichertem Backend.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Security Hardening** - Backend absichern: Helmet, organization_id-Audit, Input-Validierung, SQL-Injection-Fix
- [ ] **Phase 2: Bug-Fixes und Theme-Stabilisierung** - Bekannte Bugs beheben und Theme-Konfiguration plattformkorrekt einrichten
- [ ] **Phase 3: Design-System Grundlagen** - Shared Components und CSS-Klassen als Bausteine fuer alle Views erstellen
- [ ] **Phase 4: Admin-Views Kern** - Die sechs meistgenutzten Admin-Seiten ans Konfi-Design-Pattern anpassen
- [ ] **Phase 5: Admin-Views Verwaltung** - Restliche sechs Admin-Seiten ans Konfi-Design-Pattern anpassen
- [ ] **Phase 6: Modal-Konsistenz** - Alle Modals auf useIonModal migrieren und Design vereinheitlichen
- [ ] **Phase 7: Onboarding-Validierung** - QR-Code Onboarding-Flow vollstaendig validieren und Fehler beheben

## Phase Details

### Phase 1: Security Hardening
**Goal**: Das Backend ist gegen die identifizierten Sicherheitsluecken gehaertet -- Multi-Tenant-Isolation ist lueckenlos, Input-Validierung verhindert Injection-Angriffe, und HTTP Security Headers schuetzen alle Responses
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06
**Success Criteria** (what must be TRUE):
  1. Jeder HTTP-Response vom Backend enthaelt Security Headers (X-Content-Type-Options, Strict-Transport-Security, etc. via helmet)
  2. Ein Nutzer aus Organisation A kann keine Daten von Organisation B abrufen -- auch nicht ueber notifications.js oder andere bisher ungefilterte Routes
  3. Manipulierte Eingaben (SQL-Injection-Versuche, fehlende Felder, ungueltige Typen) werden vom Backend mit verstaendlichen Fehlermeldungen abgelehnt
  4. Bei Rate-Limiting sieht der Nutzer eine klare deutschsprachige Meldung mit Hinweis auf die Wartezeit, nicht nur einen technischen 429-Fehler
**Plans**: 3

Plans:
- [ ] 01-01: Helmet + SQL-Injection Fix (SEC-01, SEC-06) [Wave 1]
- [ ] 01-02: Org-Isolation Audit + Fix (SEC-02, SEC-03) [Wave 1]
- [ ] 01-03: Input-Validierung + Rate-Limiter UX (SEC-04, SEC-05) [Wave 2, depends on 01-01]

### Phase 2: Bug-Fixes und Theme-Stabilisierung
**Goal**: Die bekannten Bugs sind behoben und die Theme-Konfiguration funktioniert plattformkorrekt -- iOS bekommt iOS 26 Theme, Android bekommt MD3 Theme, ohne Kollisionen
**Depends on**: Phase 1
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04, THM-01, THM-02, THM-03, THM-04
**Success Criteria** (what must be TRUE):
  1. Die TabBar zeigt alle 6 Tabs auf iOS korrekt an, ohne Render-Fehler oder abgeschnittene Icons
  2. Badge-Punkte in der Konfi-Uebersicht stimmen exakt mit der Summe aus Aktivitaets-Punkten und Bonus-Punkten ueberein (kein Double-Count)
  3. Auf iOS rendert die App im iOS 26 Stil, auf Android im Material Design 3 Stil -- ohne dass CSS-Regeln des jeweils anderen Themes sichtbar eingreifen
  4. Keine deprecated Date-Utility-Aufrufe (parseLocalTime, getLocalNow) mehr im Codebase vorhanden
  5. Bei systematischem Durchgang durch alle Seiten treten keine sichtbaren UI-Fehler auf (Layout-Versatz, fehlende Icons, abgeschnittene Texte)
**Plans**: TBD

Plans:
- [x] 02-01: TabBar-Fix + Theme-Isolation (BUG-01, THM-01, THM-02, THM-03, THM-04) [Wave 1]
- [ ] 02-02: TBD

### Phase 3: Design-System Grundlagen
**Goal**: Wiederverwendbare UI-Bausteine (Shared Components und CSS-Klassen) existieren, sodass Admin-Views durch Komposition statt Copy-Paste ans Konfi-Design angeglichen werden koennen
**Depends on**: Phase 2
**Requirements**: DES-01, DES-02, DES-03, DES-04
**Success Criteria** (what must be TRUE):
  1. Eine SectionHeader-Komponente existiert und rendert kompakte Header mit Icon + Titel inline und optionaler Stats-Row -- identisch zum Konfi-Referenz-Design
  2. Eine EmptyState-Komponente existiert und zeigt in leeren Listen einen konsistenten Leerzustand mit Icon und Text
  3. Eine ListSection-Komponente existiert und rendert einheitliche Listen-Darstellungen mit den bestehenden app-list-item CSS-Klassen
  4. Die bestehenden CSS-Klassen aus variables.css (app-list-item, app-icon-circle, app-card, etc.) sind dokumentiert und ggf. um fehlende Klassen (app-header-banner, app-stats-row) ergaenzt
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Admin-Views Kern
**Goal**: Die sechs meistgenutzten Admin-Seiten (Konfis, Aktivitaeten, Events, Badges, Jahrgaenge, Kategorien) sehen aus wie das Konfi-Referenz-Design -- gleiche Header, gleiche Listen, gleiche Farblogiken
**Depends on**: Phase 3
**Requirements**: ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-06
**Success Criteria** (what must be TRUE):
  1. Die KonfiPage/KonfiListView nutzt SectionHeader, ListSection und die Konfi-Farblogiken -- visuell konsistent mit dem Konfi-Bereich
  2. Die ActivitiesPage und CategoriesPage zeigen Aktivitaeten und Kategorien in einheitlichen Listen mit korrekten Abstaenden und Farbcodierung
  3. Die EventsPage nutzt das gleiche Header-Banner-Pattern wie die Konfi-Referenz, wobei die erweiterten Admin-Bearbeitungsfunktionen erhalten bleiben
  4. Die BadgesPage und JahrgaengePage folgen dem gleichen kompakten Header-Pattern mit Stats-Row und einheitlichen Listen-Items
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Admin-Views Verwaltung
**Goal**: Die restlichen sechs Admin-Seiten (Users, Organizations, Levels, Goals, Invites, Settings) folgen dem gleichen Design-Pattern wie die Kern-Seiten aus Phase 4
**Depends on**: Phase 4
**Requirements**: ADM-07, ADM-08, ADM-09, ADM-10, ADM-11, ADM-12
**Success Criteria** (what must be TRUE):
  1. Die UsersPage und OrganizationsPage zeigen Benutzer und Organisationen in einheitlichen Listen mit SectionHeader und korrekten Abstaenden
  2. Die LevelsPage und GoalsPage nutzen das gleiche kompakte Header-Pattern und Farblogiken wie alle anderen Admin-Views
  3. Die InvitesPage und SettingsPage sind visuell konsistent mit dem Rest der Admin-Oberflaeche
  4. Alle zwoelf Admin-Views sind visuell nicht mehr als "andere App" gegenueber dem Konfi-Bereich erkennbar -- gleiche Designsprache durchgaengig
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Modal-Konsistenz
**Goal**: Alle Modals in der App nutzen das useIonModal-Pattern mit konsistentem Design (Referenz: Event-Erstellen-Modal) und funktionieren korrekt auf iOS mit Backdrop-Effekt
**Depends on**: Phase 5
**Requirements**: MOD-01, MOD-02, MOD-03, MOD-04
**Success Criteria** (what must be TRUE):
  1. Kein einziges Modal im Codebase nutzt mehr das isOpen-Pattern -- alle verwenden useIonModal
  2. Alle Chat-Modals (CreateChatModal, GroupChatModal, DirectMessageModal, SimpleCreateChatModal) oeffnen und schliessen korrekt ueber useIonModal
  3. Jedes Modal hat konsistente Formular-Inputs, Farblogiken und Abstaende gemaess der Event-Erstellen-Modal-Referenz
  4. Auf iOS zeigt jedes Modal den korrekten Card-Modal-Backdrop-Effekt (presenting element korrekt gesetzt)
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Onboarding-Validierung
**Goal**: Der QR-Code Onboarding-Flow funktioniert zuverlaessig end-to-end -- von der Einladungsgenerierung durch den Admin bis zur abgeschlossenen Konfi-Registrierung
**Depends on**: Phase 1
**Requirements**: ONB-01, ONB-02
**Success Criteria** (what must be TRUE):
  1. Ein Admin kann einen Einladungs-QR-Code generieren, ein neuer Konfi kann diesen scannen und die Registrierung erfolgreich abschliessen
  2. Fehlerfaelle im Onboarding-Flow (abgelaufener Code, bereits verwendeter Code, fehlende Felder) werden mit verstaendlichen deutschsprachigen Meldungen behandelt
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Security Hardening | 3/3 | Complete | 2026-02-28 |
| 2. Bug-Fixes und Theme-Stabilisierung | 1/2 | In Progress | - |
| 3. Design-System Grundlagen | 0/0 | Not started | - |
| 4. Admin-Views Kern | 0/0 | Not started | - |
| 5. Admin-Views Verwaltung | 0/0 | Not started | - |
| 6. Modal-Konsistenz | 0/0 | Not started | - |
| 7. Onboarding-Validierung | 0/0 | Not started | - |
