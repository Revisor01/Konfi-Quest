# Roadmap: Konfi Quest

## Milestones

- Shipped **v1.0 Security + Stabilisierung** - Phases 1-2 (shipped 2026-03-01)
- Shipped **v1.1 Design-Konsistenz** - Phases 3-7 (shipped 2026-03-02)
- Shipped **v1.2 Polishing + Tech Debt** - Phases 8-11 (shipped 2026-03-02)
- Shipped **v1.3 Layout-Polishing** - Phases 12-19 (shipped 2026-03-04)
- Shipped **v1.4 Logik-Debug** - Phases 20-24 (shipped 2026-03-05)
- Shipped **v1.5 Push-Notifications** - Phases 25-29 (shipped 2026-03-07)
- Shipped **v1.6 Dashboard-Konfig + Punkte-Logik** - Phases 30-33 (shipped 2026-03-09)
- Shipped **v1.7 Unterricht + Pflicht-Events** - Phases 34-37 (shipped 2026-03-09)
- v1.8 Teamer - Phases 38-43 (in progress)

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

<details>
<summary>Shipped v1.3 Layout-Polishing (Phases 12-19) - SHIPPED 2026-03-04</summary>

See .planning/milestones/v1.3-ROADMAP.md for full details.

Phase 12: Bug-Fixes + Sicherheit (2 plans, complete)
Phase 13: Globale UI-Anpassungen (2 plans, complete)
Phase 14: Konfi Views -- Dashboard, Events, Badges (2 plans, complete)
Phase 15: Konfi Views -- Antraege (1 plan, complete)
Phase 16: Konfi Views -- Profil + Verlinkungen (1 plan, complete)
Phase 17: Admin Views Polishing (3 plans, complete)
Phase 17.1: Checkbox-Farben + Einmalpasswort Fixes (2 plans, complete)
Phase 18: Settings-Bereich (3 plans, complete)
Phase 19: Super-Admin Ueberarbeitung (2 plans, complete)

</details>

<details>
<summary>Shipped v1.4 Logik-Debug (Phases 20-24) - SHIPPED 2026-03-05</summary>

See .planning/milestones/v1.4-ROADMAP.md for full details.

Phase 20: Event-Logik Debug (2 plans, complete)
Phase 21: Badge-Logik Debug (2 plans, complete)
Phase 22: Punkte-Vergabe Debug (2 plans, complete)
Phase 23: User/Rechte/Institutionen Debug (2 plans, complete)
Phase 24: Chat-Logik Debug (1 plan, complete)

</details>

<details>
<summary>Shipped v1.5 Push-Notifications (Phases 25-29) - SHIPPED 2026-03-07</summary>

See .planning/milestones/v1.5-ROADMAP.md for full details.

Phase 25: Foundation + Konfiguration (1 plan, complete)
Phase 26: Token-Lifecycle (2 plans, complete)
Phase 27: Badge-Count Single Source of Truth (2 plans, complete)
Phase 28: Fehlende Push-Flows (2 plans, complete)
Phase 29: Token-Cleanup + End-to-End Verifikation (1 plan, complete)

</details>

<details>
<summary>Shipped v1.6 Dashboard-Konfig + Punkte-Logik (Phases 30-33) - SHIPPED 2026-03-09</summary>

See .planning/milestones/v1.6-ROADMAP.md for full details.

Phase 30: DB-Schema + Backend-Endpoints (2 plans, complete)
Phase 31: Punkte-Logik Backend (2 plans, complete)
Phase 32: Punkte-UI Frontend (2 plans, complete)
Phase 33: Dashboard-Widget-Steuerung (1 plan, complete)

</details>

<details>
<summary>Shipped v1.7 Unterricht + Pflicht-Events (Phases 34-37) - SHIPPED 2026-03-09</summary>

See .planning/milestones/v1.7-ROADMAP.md for full details.

Phase 34: Pflicht-Event-Grundlagen (2 plans, complete)
Phase 35: Opt-out-Flow (2 plans, complete)
Phase 36: QR-Code Check-in (2 plans, complete)
Phase 37: Dashboard-Widget + Anwesenheitsstatistik (2 plans, complete)

</details>

### v1.8 Teamer (In Progress)

**Milestone Goal:** Teamer als vollwertige Rolle mit eigenem Dashboard, Event-Teilnahme, Badge-System und Material-Bereich einfuehren.

- [x] **Phase 38: Rolle + App-Shell** - Teamer-Transition und eigene 5-Tab-UI aufbauen (completed 2026-03-10)
- [x] **Phase 39: Events** - Teamer-gesucht-Toggle, Teamer-Events und Event-Buchung (completed 2026-03-10)
- [x] **Phase 40: Badges + Aktivitaeten** - Teamer-Badge-System mit 5 Badge-Typen und Admin-Konfiguration (gap closure) (completed 2026-03-11)
- [x] **Phase 41: Zertifikate + Dashboard** - Dashboard mit Zertifikat-Anzeige, Begruessing und naechsten Events (completed 2026-03-11)
- [ ] **Phase 42: Material** - Datei-Uploads und Material-Bereich pro Jahrgang
- [ ] **Phase 43: Profil + Chat** - Profil mit Antraegen und Badge-Historie, Chat-Zugriff

## Phase Details

### Phase 38: Rolle + App-Shell
**Goal**: Teamer existiert als nutzbare Rolle mit eigener Navigation und UI-Grundstruktur
**Depends on**: Nothing (Teamer-Rolle existiert bereits im RBAC-Backend)
**Requirements**: ROL-01, ROL-02, ROL-03, ROL-04
**Success Criteria** (what must be TRUE):
  1. Admin kann in der Konfi-Verwaltung einen Konfi zum Teamer befoerdern und der Konfi hat danach die Teamer-Rolle
  2. Nach Transition sieht der Ex-Konfi eine eigene TabBar mit 5 Tabs (Dashboard, Events, Chat, Material, Profil)
  3. Konfi-Badges und Konfi-Punkte/Level bleiben nach Transition erhalten und sind im Teamer-Profil sichtbar (eingefroren)
  4. Teamer kann sich einloggen und sieht ausschliesslich die Teamer-UI, nicht die Konfi- oder Admin-UI
**Plans:** 2/2 plans complete

Plans:
- [ ] 38-01-PLAN.md -- Backend: Transition-Endpoint, user.type-Erweiterung, Badge-Skip
- [ ] 38-02-PLAN.md -- Frontend: Teamer-TabBar, Profil, EmptyState-Pages, Transition-Button

### Phase 39: Events
**Goal**: Teamer koennen sich fuer Events einbuchen und sehen alle relevanten Events in einem strukturierten Tab
**Depends on**: Phase 38
**Requirements**: EVT-01, EVT-02, EVT-03, EVT-04, EVT-05, EVT-06
**Success Criteria** (what must be TRUE):
  1. Admin kann bei einem Konfi-Event den "Teamer gesucht"-Toggle aktivieren und es erscheint fuer Teamer im Team-Segment
  2. Admin kann reine Teamer-Events erstellen die nur fuer Teamer sichtbar und buchbar sind
  3. Teamer sieht Events-Tab mit 3 Segmenten (Meine, Alle, Team) und kann sich in Teamer-gesucht-Events und Teamer-Events einbuchen
  4. Teamer kann bei Events wo er eingeteilt ist seine Anwesenheit bestaetigen
**Plans:** 2/2 plans complete

Plans:
- [x] 39-01-PLAN.md -- Backend: DB-Schema, Booking, Filter, Check-in fuer Teamer
- [x] 39-02-PLAN.md -- Frontend: Admin-Formular, Teilnehmerliste, TeamerEventsPage mit 3 Segmenten

### Phase 40: Badges + Aktivitaeten
**Goal**: Teamer sammeln Badges durch Aktivitaeten, Event-Teilnahme und Engagement
**Depends on**: Phase 38
**Requirements**: BDG-01, BDG-02, BDG-03, BDG-04, BDG-05, BDG-06, BDG-07
**Success Criteria** (what must be TRUE):
  1. Admin kann Teamer-spezifische Aktivitaeten erstellen und einem Teamer manuell zuweisen
  2. Teamer erhaelt automatisch Badges basierend auf 5 Kriterien-Typen (Aktivitaeten-Anzahl, Event-Teilnahme, Streak, Sammel-Badge, Jahres-Badge)
  3. Admin kann Badge-Typen und deren Kriterien frei konfigurieren (Schwellenwerte, Kategorien, Gruppen)
  4. Vergebene Badges erscheinen im Dashboard und Profil des Teamers
**Plans:** 4/4 plans complete

Plans:
- [x] 40-01-PLAN.md -- DB-Migration und Backend-Route-Anpassung (Tabellen umbenennen, target_role)
- [x] 40-02-PLAN.md -- checkAndAwardBadges Teamer-Branch mit 5 Kriterien-Typen und Badge-API
- [x] 40-03-PLAN.md -- Frontend: Admin Segment-Toggles, Teamer-Filter, TeamerBadgesView
- [ ] 40-04-PLAN.md -- Gap Closure: Admin-Teamer-Detail-View und ActivityModal target_role Filter

### Phase 41: Zertifikate + Dashboard
**Goal**: Teamer sieht ein vollstaendiges Dashboard mit Zertifikaten, naechsten Events und Badges
**Depends on**: Phase 38, Phase 39, Phase 40
**Requirements**: ZRT-01, ZRT-02, ZRT-03, DSH-01, DSH-02, DSH-03, DSH-04
**Success Criteria** (what must be TRUE):
  1. Admin kann Teamer Zertifikate zuweisen (JuLeiCa, Teamer-Card, frei konfigurierbare Typen) mit Ausstellungsdatum
  2. Teamer sieht tageszeitabhaengige Begruessing im Dashboard
  3. Zertifikate werden prominent im Dashboard angezeigt (aehnlich Konfi-Level-Anzeige mit Datum und Status)
  4. Dashboard zeigt naechste anstehende Events und eigene Badges-Sektion
**Plans**: 3 plans

Plans:
- [x] 41-01-PLAN.md -- Backend: DB-Schema Zertifikate, CRUD-Endpoints, Teamer-Dashboard-Endpoint, Settings-Erweiterung
- [x] 41-02-PLAN.md -- Frontend: TeamerDashboardPage, Admin Zertifikat-Verwaltung, Dashboard-Konfiguration
- [ ] 41-03-PLAN.md -- Gap Closure: Config-Key-Mismatch und Event-Feld-Mismatch im Dashboard fixen

### Phase 42: Material
**Goal**: Teamer haben Zugriff auf einen Datei-Bereich mit Materialien pro Jahrgang
**Depends on**: Phase 38
**Requirements**: MAT-01, MAT-02, MAT-03
**Success Criteria** (what must be TRUE):
  1. Admin oder Teamer kann Dateien (PDF, Bilder, Dokumente) hochladen und einem Jahrgang zuordnen
  2. Material-Tab zeigt Dateien sortiert nach Jahrgang mit Dateiname, Typ und Upload-Datum
  3. Teamer kann Dateien aus der Materialliste herunterladen
**Plans**: 2 plans

Plans:
- [ ] 42-01: TBD

### Phase 43: Profil + Chat
**Goal**: Teamer hat ein vollstaendiges Profil mit Antraegen und Badge-Historie sowie Chat-Zugriff
**Depends on**: Phase 38, Phase 40
**Requirements**: PRF-01, PRF-02, PRF-03, CHT-01, CHT-02
**Success Criteria** (what must be TRUE):
  1. Teamer kann Aktivitaets-Antraege stellen (gleicher Flow wie bei Konfis)
  2. Teamer sieht im Profil eine Badges-Uebersicht mit aktuellen Teamer-Badges und eingefrorenen Konfi-Badges als Historie
  3. Teamer kann Chat-Raeume erstellen und hat vollen Zugriff auf Nachrichten, Polls und Datei-Uploads
**Plans**: 2 plans

Plans:
- [ ] 43-01: TBD
- [ ] 43-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 38 -> 39 -> 40 -> 41 -> 42 -> 43

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 38. Rolle + App-Shell | 2/2 | Complete    | 2026-03-10 |
| 39. Events | 2/2 | Complete | 2026-03-10 |
| 40. Badges + Aktivitaeten | 4/4 | Complete    | 2026-03-11 |
| 41. Zertifikate + Dashboard | 3/3 | Complete   | 2026-03-11 |
| 42. Material | 0/1 | Not started | - |
| 43. Profil + Chat | 0/2 | Not started | - |
