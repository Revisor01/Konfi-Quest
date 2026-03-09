# Roadmap: Konfi Quest

## Milestones

- Shipped **v1.0 Security + Stabilisierung** - Phases 1-2 (shipped 2026-03-01)
- Shipped **v1.1 Design-Konsistenz** - Phases 3-7 (shipped 2026-03-02)
- Shipped **v1.2 Polishing + Tech Debt** - Phases 8-11 (shipped 2026-03-02)
- Shipped **v1.3 Layout-Polishing** - Phases 12-19 (shipped 2026-03-04)
- Shipped **v1.4 Logik-Debug** - Phases 20-24 (shipped 2026-03-05)
- Shipped **v1.5 Push-Notifications** - Phases 25-29 (shipped 2026-03-07)
- Shipped **v1.6 Dashboard-Konfig + Punkte-Logik** - Phases 30-33 (shipped 2026-03-09)
- Current **v1.7 Unterricht + Pflicht-Events** - Phases 34-37 (in progress)

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

### v1.7 Unterricht + Pflicht-Events (In Progress)

**Milestone Goal:** Pflicht-Events mit Auto-Enrollment, Opt-out mit Begruendung, QR-Code Check-in, Anwesenheitsstatistik und Dashboard-Widget.

- [x] **Phase 34: Pflicht-Event-Grundlagen** - Mandatory-Flag, Auto-Enrollment, bring_items-Feld, Punkte-Guard (completed 2026-03-09)
- [x] **Phase 35: Opt-out-Flow** - Abmeldung mit Begruendung, Admin-Uebersicht, Push bei Opt-out (completed 2026-03-09)
- [ ] **Phase 36: QR-Code Check-in** - QR-Generierung, Scanner, Zeitfenster-Validierung, manuelle Korrektur
- [ ] **Phase 37: Dashboard-Widget + Anwesenheitsstatistik** - Naechstes-Event-Widget, pro-Konfi Statistik

## Phase Details

### Phase 34: Pflicht-Event-Grundlagen
**Goal**: Admin kann Pflicht-Events erstellen, die automatisch alle Jahrgangs-Konfis anmelden, keine Punkte vergeben und ein optionales "Was mitbringen"-Feld haben
**Depends on**: Phase 33 (v1.6 abgeschlossen)
**Requirements**: PFL-01, PFL-02, PFL-03, PFL-04, EUI-01
**Success Criteria** (what must be TRUE):
  1. Admin kann im EventModal ein Event als "verpflichtend" markieren und beim Speichern werden alle Konfis der zugewiesenen Jahrgaenge automatisch als angemeldet eingetragen
  2. Pflicht-Events vergeben keine Punkte -- das Punkte-Feld ist im Modal ausgeblendet und das Backend verhindert Punktevergabe
  3. Admin kann ein optionales "Was mitbringen"-Textfeld beim Event-Erstellen ausfuellen, das in der Event-Detail-Ansicht angezeigt wird
  4. Konfis erhalten eine Push-Benachrichtigung wenn ein neues Pflicht-Event fuer ihren Jahrgang erstellt wird
  5. Konfis die nach Event-Erstellung einem Jahrgang zugewiesen werden, werden automatisch nachgetragen
**Plans**: 2 plans

Plans:
- [ ] 34-01-PLAN.md -- DB-Schema + Backend: mandatory/bring_items Spalten, Auto-Enrollment, Punkte-Guard, Push, Nachtrags-Hooks
- [ ] 34-02-PLAN.md -- Frontend: EventModal Pflicht-Toggle + bring_items, Detail-Views, Pflicht-Indikator

### Phase 35: Opt-out-Flow
**Goal**: Konfis koennen sich mit Begruendung von Pflicht-Events abmelden und Admins haben volle Transparenz ueber alle Abmeldungen
**Depends on**: Phase 34
**Requirements**: OPT-01, OPT-02, OPT-03
**Success Criteria** (what must be TRUE):
  1. Konfi sieht bei Pflicht-Events einen "Abmelden"-Button und kann eine Freitext-Begruendung eingeben, die gespeichert wird
  2. Admin sieht in der Event-Teilnehmerliste alle Opt-out-Eintraege mit der jeweiligen Begruendung
  3. Admin erhaelt eine Push-Benachrichtigung wenn ein Konfi sich von einem Pflicht-Event abmeldet
**Plans**: 2 plans

Plans:
- [ ] 35-01-PLAN.md -- DB-Schema + Backend: opt_out_reason/opt_out_date Spalten, Opt-out/Opt-in Endpoints, DELETE-Guard, Push-Methoden, Participants-Query
- [ ] 35-02-PLAN.md -- Frontend: UnregisterModal mandatory-Prop, Konfi Opt-out/Opt-in UI, Event-Liste Markierung, Admin Teilnehmerliste + Zaehler

### Phase 36: QR-Code Check-in
**Goal**: Anwesenheit wird ueber QR-Code-Scan erfasst mit Zeitfenster-Validierung und manueller Admin-Korrektur als Fallback
**Depends on**: Phase 34
**Requirements**: QRC-01, QRC-02, QRC-03, QRC-04
**Success Criteria** (what must be TRUE):
  1. Admin kann pro Event einen QR-Code im Fullscreen anzeigen, den angemeldete Konfis mit der App scannen
  2. Konfi wird nach erfolgreichem QR-Scan automatisch als "anwesend" markiert und sieht eine Bestaetigung
  3. QR-Code-Scan wird abgelehnt wenn er ausserhalb des Zeitfensters (30 Min vor bis 30 Min nach Event-Start) stattfindet
  4. Admin kann die Anwesenheit einzelner Konfis manuell auf "anwesend" oder "abwesend" korrigieren, unabhaengig vom QR-Check-in
**Plans**: TBD

Plans:
- [ ] 36-01: TBD
- [ ] 36-02: TBD

### Phase 37: Dashboard-Widget + Anwesenheitsstatistik
**Goal**: Konfis sehen ihr naechstes Event im Dashboard und Admins haben eine pro-Konfi Anwesenheitsuebersicht
**Depends on**: Phase 34, Phase 35, Phase 36
**Requirements**: EUI-02, EUI-03, ANW-01, ANW-02
**Success Criteria** (what must be TRUE):
  1. Konfi-Dashboard zeigt ein Widget "Naechstes Event" mit Titel, Datum, Ort und Was-mitbringen-Info (falls vorhanden)
  2. Dashboard-Widget ist ueber DashboardConfig (show_next_event Toggle) vom Org-Admin ein/ausblendbar
  3. Admin sieht pro Konfi eine Anwesenheitsquote fuer Pflicht-Events (z.B. "7/10 anwesend, 70%")
  4. Admin sieht pro Konfi eine Liste der verpassten Pflicht-Events mit Opt-out-Grund oder "Nicht erschienen"

**Plans**: TBD

Plans:
- [ ] 37-01: TBD
- [ ] 37-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 34 -> 35 -> 36 -> 37

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 34. Pflicht-Event-Grundlagen | 2/2 | Complete   | 2026-03-09 | - |
| 35. Opt-out-Flow | 2/2 | Complete   | 2026-03-09 | - |
| 36. QR-Code Check-in | v1.7 | 0/2 | Not started | - |
| 37. Dashboard-Widget + Anwesenheitsstatistik | v1.7 | 0/2 | Not started | - |
