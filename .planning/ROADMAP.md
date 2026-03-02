# Roadmap: Konfi Quest

## Milestones

- Shipped **v1.0 Security + Stabilisierung** - Phases 1-2 (shipped 2026-03-01)
- Shipped **v1.1 Design-Konsistenz** - Phases 3-7 (shipped 2026-03-02)
- In Progress **v1.2 Polishing + Tech Debt** - Phases 8-11

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

### v1.2 Polishing + Tech Debt (In Progress)

**Milestone Goal:** Super-Admin UI einschraenken, Konfi Dashboard Rings debuggen und Design-Review, Tech Debt aufraeumen, Dokumentation korrigieren

- [x] **Phase 8: Super-Admin UI** - Super-Admin sieht nur Organisations-Verwaltung und Profil/Settings (completed 2026-03-02)
- [x] **Phase 9: Dashboard Bug-Fix + Design-Review** - ActivityRings 3. Runde Fix und Design-Konsistenz aller Dashboard-Sektionen (completed 2026-03-02)
- [ ] **Phase 10: Tech Debt Cleanup** - rateLimitMessage Wiring, console.log Cleanup, condense-toolbar, Inline Styles
- [ ] **Phase 11: Dokumentation** - CLAUDE.md PostgreSQL-Status korrigieren

## Phase Details

### Phase 8: Super-Admin UI
**Goal**: Super-Admin hat eine reduzierte, auf Organisations-Verwaltung fokussierte Oberflaeche
**Depends on**: Nothing (unabhaengig von anderen v1.2 Phasen)
**Requirements**: SUI-01, SUI-02
**Success Criteria** (what must be TRUE):
  1. Super-Admin sieht nach Login nur 2 Tabs: Organisationen und Profil/Settings
  2. Super-Admin sieht NICHT die Tabs Konfis, Chat, Events oder Antraege
  3. Super-Admin kann sein eigenes Profil aufrufen und App-Einstellungen aendern
**Plans**: 1 plan

Plans:
- [ ] 08-01-PLAN.md -- Super-Admin TabBar und Routing einschraenken (MainTabs + AdminSettingsPage)

### Phase 9: Dashboard Bug-Fix + Design-Review
**Goal**: Konfi Dashboard zeigt alle Runden korrekt an und alle Sektionen folgen dem Design-System
**Depends on**: Nothing (unabhaengig von Phase 8)
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07
**Success Criteria** (what must be TRUE):
  1. ActivityRings zeigen 3. Runde mit korrekter Strichstaerke und Groesse an (kein duenner/kleiner Ring bei 35% stroke-width)
  2. Dashboard-Header (ActivityRings, Level, Greeting) nutzt konsistente Spacing, Typografie und Farben gemaess Design-System
  3. Alle 6 Dashboard-Sektionen (Konfirmation, Events, Badges, Tageslosung, Ranking) bestehen Design-Konsistenz-Check
  4. Keine visuellen Regressionen in bestehenden Dashboard-Elementen
**Plans**: 2 plans

Plans:
- [ ] 09-01-PLAN.md -- ActivityRings 3. Runde Bug-Fix (Strichstaerke, Farbe, Maximum 300%)
- [ ] 09-02-PLAN.md -- Dashboard-Sektionen Design-Review (CSS-Klassen, Begruessing, Tageslosung-Zitat)

### Phase 10: Tech Debt Cleanup
**Goal**: Bekannte Code-Qualitaetsprobleme sind behoben und der Produktionscode ist sauber
**Depends on**: Nothing (unabhaengig von anderen v1.2 Phasen)
**Requirements**: DEBT-01, DEBT-02, DEBT-03, DEBT-04
**Success Criteria** (what must be TRUE):
  1. Rate-Limit Fehlermeldung wird dem User korrekt in der UI angezeigt wenn der Limiter greift
  2. Keine console.log Statements mehr im Produktionscode (ausser bewusste console.error/warn)
  3. Alle 19 collapsible Headers haben die app-condense-toolbar CSS-Klasse
  4. EventDetailView hat keine Inline-Styles mehr, alle durch CSS-Klassen ersetzt
**Plans**: 2 plans

Plans:
- [ ] 10-01-PLAN.md -- rateLimitMessage UI-Wiring in Login + generischer 429-Handler + console.log Cleanup (Frontend 148 + Backend 177) + strukturierter Server-Start
- [ ] 10-02-PLAN.md -- app-condense-toolbar auf alle 19+ collapsible Headers + EventDetailView Inline-Styles durch CSS-Klassen ersetzen

### Phase 11: Dokumentation
**Goal**: CLAUDE.md spiegelt den tatsaechlichen Projektstatus korrekt wider
**Depends on**: Nothing (unabhaengig von anderen v1.2 Phasen)
**Requirements**: DOC-01
**Success Criteria** (what must be TRUE):
  1. CLAUDE.md zeigt alle 15 PostgreSQL-Routes als vollstaendig migriert an
  2. Keine "NOCH NICHT MIGRIERT" oder "NAECHSTE" Eintraege mehr in der Migrationsliste
**Plans**: TBD

Plans:
- [ ] 11-01: CLAUDE.md PostgreSQL-Migrationsstatus korrigieren

## Progress

**Execution Order:**
Phases 8-11 sind unabhaengig voneinander und koennen in beliebiger Reihenfolge ausgefuehrt werden.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Backend Security Hardening | v1.0 | 3/3 | Complete | 2026-03-01 |
| 2. Frontend Stabilisierung | v1.0 | 2/2 | Complete | 2026-03-01 |
| 3. Design-System Grundlagen | v1.1 | 3/3 | Complete | 2026-03-01 |
| 4. Admin-Views Core | v1.1 | 4/4 | Complete | 2026-03-01 |
| 5. Admin-Views Erweitert | v1.1 | 3/3 | Complete | 2026-03-01 |
| 6. Modal-Konsistenz | v1.1 | 4/4 | Complete | 2026-03-02 |
| 7. Onboarding-Validierung | v1.1 | 3/3 | Complete | 2026-03-02 |
| 8. Super-Admin UI | 1/1 | Complete   | 2026-03-02 | - |
| 9. Dashboard Bug-Fix + Design-Review | v1.2 | 2/2 | Complete | 2026-03-02 |
| 10. Tech Debt Cleanup | 1/2 | In Progress|  | - |
| 11. Dokumentation | v1.2 | 0/1 | Not started | - |
