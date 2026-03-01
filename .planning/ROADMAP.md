# Roadmap: Konfi Quest

## Milestones

- Shipped **v1.0 Security + Stabilisierung** - Phases 1-2 (shipped 2026-03-01)
- Current **v1.1 Design-Konsistenz** - Phases 3-7 (in progress)

## Phases

<details>
<summary>Shipped v1.0 Security + Stabilisierung (Phases 1-2) - SHIPPED 2026-03-01</summary>

See .planning/milestones/v1.0-ROADMAP.md for full details.

Phase 1: Backend Security Hardening (3 plans, complete)
Phase 2: Frontend Stabilisierung + Bug-Fixes (2 plans, complete)

</details>

### v1.1 Design-Konsistenz (In Progress)

**Milestone Goal:** Admin- und Teamer-Bereiche an das fertige Konfi-Design-Pattern anpassen, alle Modale konsistent machen und Shared Components einfuehren.

**Phase Numbering:**
- Integer phases (3, 4, 5, 6, 7): Planned milestone work
- Decimal phases (3.1, 4.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 3: Design-System Grundlagen** - Shared Components und CSS-Klassen als Fundament fuer alle weiteren Phasen
- [ ] **Phase 4: Admin-Views Core** - Die 6 meistgenutzten Admin-Views ans Konfi-Referenz-Design anpassen
- [ ] **Phase 5: Admin-Views Erweitert** - Restliche 6 Admin-Views konsistent gestalten
- [ ] **Phase 6: Modal-Konsistenz** - Alle Modale auf useIonModal und einheitliches Design migrieren
- [ ] **Phase 7: Onboarding-Validierung** - QR-Code Einladungs- und Registrierungsflow pruefen und absichern

## Phase Details

### Phase 3: Design-System Grundlagen
**Goal**: Das bestehende Header-Banner-Pattern (pro Seite eigene Farbe, Icon+Titel+Stats-Row, dekorative Kreise) in wiederverwendbare Shared Components extrahieren. Die Farben und Struktur sind BEREITS implementiert -- hier wird nur DRY-Refactoring gemacht, NICHTS verworfen.
**Depends on**: Nothing (v1.0 shipped, alle Voraussetzungen erfuellt)
**Requirements**: DES-01, DES-02, DES-03, DES-04
**Success Criteria** (what must be TRUE):
  1. Ein Entwickler kann SectionHeader in jeder View importieren und erhaelt einen kompakten Header mit Icon + Titel inline und optionaler Stats-Row -- ohne eigenes CSS
  2. Leere Listen zeigen ueberall den gleichen EmptyState mit Icon und erklaerenden Text
  3. ListSection rendert einheitliche Listen-Darstellungen unter Nutzung der bestehenden app-list-item Klassen
  4. Die CSS-Klassen in variables.css sind dokumentiert (Kommentare) und um app-header-banner und app-stats-row ergaenzt
**Plans**: 3

Plans:
- [x] 03-01: CSS-Klassen und Shared Components erstellen (SectionHeader, EmptyState, ListSection) [Wave 1]
- [x] 03-02: 8 Haupt-Views (Konfi + Admin-Core) auf Shared Components umstellen [Wave 2]
- [x] 03-03: 8 restliche Views (Admin-Pages, Konfi-Views, Chat) auf Shared Components umstellen [Wave 2]

### Phase 4: Admin-Views Core
**Goal**: Die 6 meistgenutzten Admin-Seiten auf die neuen Shared Components umstellen. Die Seiten haben BEREITS eigene Farben und Header-Pattern -- hier wird das bestehende Inline-Styling durch die Shared Components aus Phase 3 ersetzt, ohne Farben oder Logik zu aendern.
**Depends on**: Phase 3
**Requirements**: ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-06
**Success Criteria** (what must be TRUE):
  1. KonfiPage nutzt SectionHeader und ListSection -- der visuelle Unterschied zum Konfi-Bereich ist minimal
  2. ActivitiesPage und CategoriesPage zeigen Items in einheitlichen Listen mit korrekten Abstaenden und Farbcodierung
  3. EventsPage nutzt das Header-Banner-Pattern der Konfi-Referenz, wobei Admin-Bearbeitungsfunktionen (Edit, Delete) erhalten bleiben
  4. BadgesPage und JahrgaengePage folgen dem kompakten Header-Pattern mit Stats-Row
  5. Beim Wechsel zwischen Konfi- und Admin-Bereich ist der visuelle Stil erkennbar einheitlich
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Admin-Views Erweitert
**Goal**: Restliche 6 Admin-Seiten auf Shared Components umstellen. Auch hier: bestehende Farben und Funktionalitaet beibehalten, nur Inline-Styling durch Components ersetzen und ggf. kleinere Inkonsistenzen angleichen.
**Depends on**: Phase 4
**Requirements**: ADM-07, ADM-08, ADM-09, ADM-10, ADM-11, ADM-12
**Success Criteria** (what must be TRUE):
  1. UsersPage und OrganizationsPage zeigen ihre Listen mit SectionHeader und einheitlichen Abstaenden
  2. LevelsPage und GoalsPage nutzen das kompakte Header-Pattern mit Farblogiken
  3. InvitesPage und SettingsPage fuegen sich nahtlos in die visuelle Sprache der uebrigen Admin-Oberflaeche ein
  4. Jede Admin-Seite im Codebase nutzt mindestens eine Shared Component aus Phase 3
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Modal-Konsistenz
**Goal**: Jedes Modal in der App nutzt useIonModal, hat konsistente Formular-Inputs und zeigt auf iOS den korrekten Card-Modal-Backdrop-Effekt
**Depends on**: Phase 4 (Modals werden aus Admin-Views geoeffnet)
**Requirements**: MOD-01, MOD-02, MOD-03, MOD-04
**Success Criteria** (what must be TRUE):
  1. Kein einziges Modal im Codebase nutzt mehr das isOpen-Pattern -- eine Codebase-Suche nach "isOpen={" in Modal-Kontexten liefert null Treffer
  2. Alle Chat-Modals (CreateChat, GroupChat, DirectMessage, SimpleCreateChat) oeffnen und schliessen korrekt ueber useIonModal
  3. Formular-Inputs in Modalen haben einheitliche Farblogiken und Abstaende gemaess der Event-Erstellen-Modal-Referenz
  4. Auf einem iOS-Geraet zeigt jedes Modal den Card-Modal-Backdrop-Effekt (presenting element korrekt gesetzt)
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Onboarding-Validierung
**Goal**: Der QR-Code-basierte Einladungs- und Registrierungsflow funktioniert zuverlaessig mit verstaendlichen Fehlermeldungen
**Depends on**: Phase 3 (Shared Components fuer Onboarding-UI)
**Requirements**: ONB-01, ONB-02
**Success Criteria** (what must be TRUE):
  1. Ein Admin kann einen Einladungs-QR-Code generieren, ein neuer Konfi kann diesen scannen und die Registrierung erfolgreich abschliessen
  2. Ein abgelaufener QR-Code zeigt eine deutschsprachige Fehlermeldung statt eines technischen Fehlers
  3. Ein bereits verwendeter Code wird erkannt und mit einer verstaendlichen Meldung abgelehnt
  4. Fehlende Pflichtfelder im Registrierungsformular werden mit deutschsprachigen Validierungsmeldungen angezeigt
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 3 -> 3.x -> 4 -> 4.x -> 5 -> 5.x -> 6 -> 6.x -> 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend Security Hardening | v1.0 | 3/3 | Complete | 2026-03-01 |
| 2. Frontend Stabilisierung | v1.0 | 2/2 | Complete | 2026-03-01 |
| 3. Design-System Grundlagen | v1.1 | 0/? | Not started | - |
| 4. Admin-Views Core | v1.1 | 0/? | Not started | - |
| 5. Admin-Views Erweitert | v1.1 | 0/? | Not started | - |
| 6. Modal-Konsistenz | v1.1 | 0/? | Not started | - |
| 7. Onboarding-Validierung | v1.1 | 0/? | Not started | - |
