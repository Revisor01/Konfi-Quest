# Roadmap: Konfi Quest

## Milestones

- Shipped **v1.0 Security + Stabilisierung** - Phases 1-2 (shipped 2026-03-01)
- Shipped **v1.1 Design-Konsistenz** - Phases 3-7 (shipped 2026-03-02)
- Shipped **v1.2 Polishing + Tech Debt** - Phases 8-11 (shipped 2026-03-02)
- Active **v1.3 Layout-Polishing** - Phases 12-19 (in progress)

## Phases

<details>
<summary>Shipped v1.0 Security + Stabilisierung (Phases 1-2) - SHIPPED 2026-03-01</summary>

See .planning/milestones/v1.0-ROADMAP.md for full details.

Phase 1: Backend Security Hardening (3 plans, complete)
Phase 2: Frontend Stabilisierung + Bug-Fixes (2 plans, complete)

</details>

<details>
<summary>Shipped v1.1 Design-Konsistenz (Phases 3-7) - SHIPPED 2026-03-02</summary>

See .planning/milestones/v1.1-ROADMAP.md for full details.

Phase 3: Design-System Grundlagen (3 plans, complete)
Phase 4: Admin-Views Core (4 plans, complete)
Phase 5: Admin-Views Erweitert + Detail-Views + Icon-Konsistenz (3 plans, complete)
Phase 6: Modal-Konsistenz (4 plans, complete)
Phase 7: Onboarding-Validierung (3 plans, complete)

</details>

<details>
<summary>Shipped v1.2 Polishing + Tech Debt (Phases 8-11) - SHIPPED 2026-03-02</summary>

See .planning/milestones/v1.2-ROADMAP.md for full details.

Phase 8: Super-Admin UI (1 plan, complete)
Phase 9: Dashboard Bug-Fix + Design-Review (2 plans, complete)
Phase 10: Tech Debt Cleanup (2 plans, complete)
Phase 11: Dokumentation (1 plan, complete)

</details>

### v1.3 Layout-Polishing (In Progress)

**Milestone Goal:** Systematischer Durchgang aller Views und Modals -- Farben, Umrandungen, fehlende Back-Links, Icon-Groessen, Auswahl-Rahmen, Bugs und Design-Inkonsistenzen beseitigen.

- [x] **Phase 12: Bug-Fixes + Sicherheit** - Funktionale Bugs in Modals und Auth-Seiten beheben, Passwort-Sicherheit erhoehen (completed 2026-03-03)
- [x] **Phase 13: Globale UI-Anpassungen** - Querschnittliche visuelle Fixes die alle Views betreffen (completed 2026-03-03)
- [x] **Phase 14: Konfi Views -- Dashboard, Events, Badges** - Konfi-Hauptansichten polieren (completed 2026-03-03)
- [x] **Phase 15: Konfi Views -- Antraege** - Request-Views und -Modals an Design-System angleichen (1 plan) (completed 2026-03-03)
- [x] **Phase 16: Konfi Views -- Profil + Verlinkungen** - Profilfarbe, fehlende Actions und Modal-Verlinkungen (completed 2026-03-03)
- [x] **Phase 17: Admin Views Polishing** - Admin-spezifische Detail-Views und Modals vereinheitlichen (completed 2026-03-03)
- [ ] **Phase 17.1: Checkbox-Farben + Einmalpasswort Fixes** - Tuerkise Checkbox-Farben und fehlende Passwort-Anzeige
- [ ] **Phase 18: Settings-Bereich** - Settings-Seite Struktur, Farben und Modal-Konsistenz
- [ ] **Phase 19: Super-Admin Ueberarbeitung** - Super-Admin komplett neu aufgebaut (keine TabBar, Design-System)

## Phase Details

### Phase 12: Bug-Fixes + Sicherheit
**Goal**: Alle funktionalen Bugs sind behoben und Konfi-Passwoerter werden sicher verwaltet
**Depends on**: Nothing (erste Phase in v1.3)
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, BUG-06, SEC-01
**Success Criteria** (what must be TRUE):
  1. ParticipantManagementModal zeigt alle gebuchten User korrekt an
  2. BadgeManagementModal laedt Kategorien und Aktivitaeten aus der Datenbank
  3. Invite-Modal QR-Code bleibt nach Schliessen und erneutem Oeffnen erhalten
  4. ForgotPassword-Mail wird erfolgreich versendet und ResetPassword-Seite zeigt korrekte Umlaute und funktionierenden Zurueck-Button
  5. Admin kann fuer Konfis ein Einmalpasswort generieren und per Kopier-Button weitergeben (kein Klartext-Passwort sichtbar)
**Plans**: 2 plans
Plans:
- [ ] 12-01-PLAN.md -- Admin-Modal-Bugs (ParticipantManagement, BadgeManagement, Invite QR)
- [ ] 12-02-PLAN.md -- Auth-Bugs + Einmalpasswort-Sicherheit (ForgotPassword, ResetPassword, SEC-01)

### Phase 13: Globale UI-Anpassungen
**Goal**: App-weite visuelle Konsistenz bei Icons, Auswahl-Rahmen und Farben hergestellt
**Depends on**: Phase 12
**Requirements**: GUI-01, GUI-02, GUI-03, GUI-04, GUI-05
**Success Criteria** (what must be TRUE):
  1. Listen-Icons in allen Views sind kleiner und am oberen Rand des Listeneintrags positioniert
  2. Keine sichtbaren Auswahl-Rahmen (orange/tuerkis/rot) beim Fokussieren oder Selektieren in Modals und Listen
  3. Auswahl-Hervorhebungen und Haekchen sind konsistent: Orange fuer Konfis, Tuerkis fuer alle anderen Rollen
  4. Gruen-Toene in Aktivitaeten- und Antraege-Headers sind kraeftig und gut lesbar
  5. Auth-Seiten (Login, Register, ForgotPassword) haben durchgehende Hintergrundfarbe ohne weissen Bereich unten
**Plans**: TBD

### Phase 14: Konfi Views -- Dashboard, Events, Badges
**Goal**: Konfi-Hauptansichten (Start-Tab, Events, Badges, Punkte-Historie) sind visuell poliert
**Depends on**: Phase 13
**Requirements**: KUI-01, KUI-02, KUI-03, KUI-05
**Success Criteria** (what must be TRUE):
  1. Erster Tab heisst "Start" statt "Dashboard"
  2. EventDetailView-Teilnehmer:innen-Anzeige passt zum Design-System (kein Fremdkoerper)
  3. BadgesView zeigt EmptyState-Komponenten fuer leere "Offen"- und "In Arbeit"-Sektionen
  4. PointsHistoryModal "Gesamt"-Text ist nicht abgeschnitten und Layout zeigt 3+2 statt 4+1
**Plans**: TBD

### Phase 15: Konfi Views -- Antraege
**Goal**: Konfi-Antraege-Bereich ist farblich und strukturell an den Admin-Antraege-Bereich angeglichen
**Depends on**: Phase 13
**Requirements**: KUI-07, KUI-08, KUI-09
**Success Criteria** (what must be TRUE):
  1. RequestsView Header-Gruen ist dunkler und entspricht dem Admin-Antraege-Header
  2. ActivityRequestModal Icons sind Gruen statt Lila
  3. Konfi RequestDetailModal hat gleiches Layout und gleiche Struktur wie das Admin-Pendant
**Plans**: 1 plan
Plans:
- [ ] 15-01-PLAN.md -- Konfi Antrags-Modals Sektions-Icons von Lila auf Gruen + Header-Farbe Verifikation

### Phase 16: Konfi Views -- Profil + Verlinkungen
**Goal**: Konfi-Profil hat die richtige Farbe und alle Einstellungs-Actions sind erreichbar
**Depends on**: Phase 13
**Requirements**: KUI-04, KUI-06, KUI-10, KUI-11
**Success Criteria** (what must be TRUE):
  1. KonfiProfileView verwendet Lila statt Blau als Hauptfarbe
  2. Bibeluebersetzung-Aendern-Action oeffnet ein funktionierendes Modal oder Auswahlmenue
  3. UnregisterModal ist von einer sichtbaren Stelle aus erreichbar (z.B. Profil oder Settings)
  4. EditProfileModal ist entweder verlinkt und funktional oder sauber entfernt
**Plans**: 1 plan
Plans:
- [ ] 16-01-PLAN.md -- Profil-Farbe Lila, Bibelübersetzung-Bug-Fix, EditProfileModal entfernen

### Phase 17: Admin Views Polishing
**Goal**: Admin-Detail-Views und -Modals sind visuell konsistent mit dem Design-System
**Depends on**: Phase 13
**Requirements**: AUI-01, AUI-02, AUI-03, AUI-04, AUI-05, AUI-06, AUI-07
**Success Criteria** (what must be TRUE):
  1. KonfiDetailView zeigt Corner-Badges fuer Bonus- und Event-Eintraege (wie bei Aktivitaeten)
  2. KonfiDetailView zeigt ein Icon vor dem Approved-Namen
  3. Benutzer:innen-Liste verwendet Solid-Icons statt Line-Icons fuer Funktionsanzeige
  4. GoalsPage und PunkteZiel-Modal verwenden Standard-Stepper-Pattern ohne Sonderdesign
  5. Admin EventDetailView zeigt Beschreibung als eigene Card und hat gleiche Detail-Reihenfolge wie Konfi-Ansicht
**Plans**: 3 plans
Plans:
- [ ] 17-01-PLAN.md -- KonfiDetailView Corner-Badges Verifikation + Icon vor Name (AUI-01, AUI-02)
- [ ] 17-02-PLAN.md -- UsersView Solid-Icons + GoalsPage Standard-Stepper (AUI-03, AUI-04)
- [ ] 17-03-PLAN.md -- Admin EventDetailView Beschreibung eigene Card + ActivityModal Checkbox-Position (AUI-05, AUI-06, AUI-07)

### Phase 17.1: Checkbox-Farben + Einmalpasswort Fixes
**Goal**: Checkbox-Farben in Listen verwenden dynamische Typ-Farbe statt hardcoded tuerkis, und Einmalpasswort wird nach Generierung korrekt angezeigt
**Depends on**: Phase 13
**Requirements**: FIX-01, FIX-02
**Success Criteria** (what must be TRUE):
  1. Checkbox-Farben in Admin-Modals verwenden die dynamische Typ-Farbe statt hardcoded tuerkis
  2. Einmalpasswort wird nach Klick auf Generieren im Alert korrekt angezeigt (Neuerstellung + Regenerierung)
**Plans**: 2 plans
Plans:
- [ ] 17.1-01-PLAN.md -- Checkbox-Farben dynamisch statt hardcoded tuerkis (FIX-01)
- [ ] 17.1-02-PLAN.md -- Einmalpasswort-Anzeige bei Erstellung und Regenerierung (FIX-02)

### Phase 18: Settings-Bereich
**Goal**: Settings-Seite hat klare Struktur, konsistente Farben und alle Modals passen zum Design-System
**Depends on**: Phase 13
**Requirements**: SET-01, SET-02, SET-03, SET-04, SET-05, SET-06, SET-07, SET-08, SET-09
**Success Criteria** (what must be TRUE):
  1. Settings-Seite zeigt Sektionen in der Reihenfolge: Konto oben, Verwaltung, Inhalt (Profil raus)
  2. Einladen-Bereich ist mattes Blau, Gottesdienst-Aktivitaeten sind Blau, Kategorien haben eigene Farbe (nicht Orange wie Badges)
  3. Level-Modal hat Lila Icon-Farbe und iOS Backdrop-Effekt
  4. Profil-Modals zeigen Icons und Funktionsbeschreibung in Lila
  5. AdminBadgesPage hat Zurueck-Button oben links und Badges-Sektionen zeigen Oberkategorie-Icons in Zwischenueberschriften
**Plans**: TBD

### Phase 19: Super-Admin Ueberarbeitung
**Goal**: Super-Admin-Bereich ist komplett ueberarbeitet mit eigenem Design ohne TabBar
**Depends on**: Phase 13
**Requirements**: SUA-01, SUA-02, SUA-03, SUA-04, SUA-05, SUA-06, SUA-07
**Success Criteria** (what must be TRUE):
  1. Super-Admin hat keine TabBar mehr, nur eine einzelne Organisationen-View
  2. Nach Login wird direkt auf Organisationen weitergeleitet (keine weisse Seite)
  3. Durchgehend mattes Blau als Farbschema, alle Listen-Elemente passen zum Design-System
  4. Statistik wird als SectionHeader oben angezeigt und OrganizationManagementModal ist ans Design-System angepasst
  5. Super-Admin kann sich ueber einen sichtbaren Logout-Button abmelden
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend Security Hardening | v1.0 | 3/3 | Complete | 2026-03-01 |
| 2. Frontend Stabilisierung | v1.0 | 2/2 | Complete | 2026-03-01 |
| 3. Design-System Grundlagen | v1.1 | 3/3 | Complete | 2026-03-01 |
| 4. Admin-Views Core | v1.1 | 4/4 | Complete | 2026-03-01 |
| 5. Admin-Views Erweitert | v1.1 | 3/3 | Complete | 2026-03-01 |
| 6. Modal-Konsistenz | v1.1 | 4/4 | Complete | 2026-03-02 |
| 7. Onboarding-Validierung | v1.1 | 3/3 | Complete | 2026-03-02 |
| 8. Super-Admin UI | v1.2 | 1/1 | Complete | 2026-03-02 |
| 9. Dashboard Bug-Fix + Design-Review | v1.2 | 2/2 | Complete | 2026-03-02 |
| 10. Tech Debt Cleanup | v1.2 | 2/2 | Complete | 2026-03-02 |
| 11. Dokumentation | v1.2 | 1/1 | Complete | 2026-03-02 |
| 12. Bug-Fixes + Sicherheit | 2/2 | Complete    | 2026-03-03 | - |
| 13. Globale UI-Anpassungen | 2/2 | Complete    | 2026-03-03 | - |
| 14. Konfi Views -- Dashboard, Events, Badges | 2/2 | Complete    | 2026-03-03 | - |
| 15. Konfi Views -- Antraege | 1/1 | Complete    | 2026-03-03 | - |
| 16. Konfi Views -- Profil + Verlinkungen | 1/1 | Complete    | 2026-03-03 | - |
| 17. Admin Views Polishing | 3/3 | Complete    | 2026-03-03 | - |
| 17.1. Checkbox-Farben + Einmalpasswort | 1/2 | In Progress|  | - |
| 18. Settings-Bereich | v1.3 | 0/? | Not started | - |
| 19. Super-Admin Ueberarbeitung | v1.3 | 0/? | Not started | - |
