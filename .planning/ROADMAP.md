# Roadmap: Konfi Quest

## Milestones

- Shipped **v1.0 Security + Stabilisierung** - Phases 1-2 (shipped 2026-03-01)
- Shipped **v1.1 Design-Konsistenz** - Phases 3-7 (shipped 2026-03-02)
- Shipped **v1.2 Polishing + Tech Debt** - Phases 8-11 (shipped 2026-03-02)
- Shipped **v1.3 Layout-Polishing** - Phases 12-19 (shipped 2026-03-04)
- Shipped **v1.4 Logik-Debug** - Phases 20-24 (shipped 2026-03-05)
- Shipped **v1.5 Push-Notifications** - Phases 25-29 (shipped 2026-03-07)
- In Progress **v1.6 Dashboard-Konfig + Punkte-Logik** - Phases 30-33

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

### v1.6 Dashboard-Konfig + Punkte-Logik (In Progress)

**Milestone Goal:** Punkte-Typen pro Jahrgang konfigurierbar machen und Dashboard-Widgets fuer Org-Admins steuerbar machen.

- [x] **Phase 30: DB-Schema + Backend-Endpoints** - Jahrgang-Config und Dashboard-Settings als Datengrundlage (completed 2026-03-07)
- [x] **Phase 31: Punkte-Logik Backend** - Guards, Badge-Skip und Warnung bei Deaktivierung (completed 2026-03-07)
- [x] **Phase 32: Punkte-UI Frontend** - Ringe, Bars, Ranking und Historie reagieren auf deaktivierte Typen (completed 2026-03-08)
- [ ] **Phase 33: Dashboard-Widget-Steuerung** - Org-Admin steuert Dashboard-Sektionen fuer Konfis

## Phase Details

### Phase 30: DB-Schema + Backend-Endpoints
**Goal**: Jahrgang-Tabelle und Settings-Tabelle liefern die Konfigurationsdaten fuer Punkte-Typen und Dashboard-Widgets
**Depends on**: Nothing (first phase of v1.6)
**Requirements**: PKT-01, PKT-02, PKT-03, DSH-01
**Success Criteria** (what must be TRUE):
  1. Org-Admin kann im Jahrgang-Edit-Modal Gottesdienst-Punkte und Gemeinde-Punkte einzeln aktivieren/deaktivieren
  2. Org-Admin kann das Punkteziel (target) pro Jahrgang im laufenden Jahr aendern
  3. Dashboard-Endpoint (/api/konfi/dashboard) liefert point_config mit den aktiven Punkte-Typen des Jahrgangs
  4. Org-Admin kann in den Settings Dashboard-Sektionen (Losung, Ranking, Badges, Events, Konfirmation) ein/ausblenden
**Plans**: 2 plans

Plans:
- [ ] 30-01-PLAN.md — DB-Schema Migration + Backend-Endpoints (Jahrgaenge CRUD, Settings Dashboard-Keys, Dashboard point_config)
- [ ] 30-02-PLAN.md — Frontend Jahrgang-Modal Punkte-Config + Settings Dashboard-Toggles + AdminGoalsPage entfernen

### Phase 31: Punkte-Logik Backend
**Goal**: Backend verhindert Punktevergabe fuer deaktivierte Typen und passt Badge-Logik sowie Ranking an
**Depends on**: Phase 30
**Requirements**: PKT-04, PKT-05, PUI-04
**Success Criteria** (what must be TRUE):
  1. API gibt 400er-Fehler mit klarer Meldung zurueck wenn Punkte an einen deaktivierten Typ vergeben werden sollen
  2. Beim Deaktivieren eines Punkte-Typs erscheint eine Warnung mit der Anzahl betroffener Konfis die bereits Punkte haben
  3. Badge-Vergabe ueberspringt Kriterien die einen deaktivierten Punkte-Typ erfordern (gottesdienst_points, gemeinde_points, both_categories)
  4. Ranking-Query summiert nur aktive Punkte-Typen des jeweiligen Jahrgangs
**Plans**: 2 plans

Plans:
- [ ] 31-01-PLAN.md — Guard-Funktion + 5 Eintrittspunkte + Warnung bei Deaktivierung
- [ ] 31-02-PLAN.md — Badge-Logik + Ranking-Queries fuer aktive Punkte-Typen

### Phase 32: Punkte-UI Frontend
**Goal**: Alle Punkte-bezogenen UI-Elemente reagieren korrekt auf deaktivierte Punkte-Typen
**Depends on**: Phase 30
**Requirements**: PUI-01, PUI-02, PUI-03, PUI-05
**Success Criteria** (what must be TRUE):
  1. ActivityRings zeigen dynamisch 1, 2 oder 3 Ringe basierend auf den aktiven Punkte-Typen (Gesamt-Ring nur bei 2 aktiven Typen)
  2. Fortschrittsbalken in KonfisView und KonfiDetailView blenden deaktivierte Punkte-Typen komplett aus
  3. Ranking-Liste im Dashboard zeigt nur die Summe der aktiven Punkte-Typen an
  4. Punkte-Historie filtert Eintraege deaktivierter Punkte-Typen aus der Anzeige
**Plans**: 2 plans

Plans:
- [ ] 32-01-PLAN.md — Konfi-Dashboard: ActivityRings dynamisch, point_config nutzen, Stats/Ranking/Historie anpassen
- [ ] 32-02-PLAN.md — Admin-Views: Backend Config-Spalten, KonfisView bedingte Bars, KonfiDetailView ausgegraut-Pattern

### Phase 33: Dashboard-Widget-Steuerung
**Goal**: Dashboard rendert nur die vom Org-Admin aktivierten Sektionen
**Depends on**: Phase 30
**Requirements**: DSH-02, DSH-03
**Success Criteria** (what must be TRUE):
  1. DashboardView blendet deaktivierte Sektionen (Losung, Ranking, Badges, Events, Konfirmation) komplett aus
  2. Aenderungen an der Dashboard-Konfiguration wirken sofort fuer alle Konfis der Organisation ohne App-Neustart
**Plans**: 2 plans

Plans:
- [ ] 33-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 30 -> 31 -> 32 -> 33
Note: Phase 32 und 33 haengen beide nur von Phase 30 ab und koennten parallel ausgefuehrt werden.

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
| 12. Bug-Fixes + Sicherheit | v1.3 | 2/2 | Complete | 2026-03-03 |
| 13. Globale UI-Anpassungen | v1.3 | 2/2 | Complete | 2026-03-03 |
| 14. Konfi Views -- Dashboard, Events, Badges | v1.3 | 2/2 | Complete | 2026-03-03 |
| 15. Konfi Views -- Antraege | v1.3 | 1/1 | Complete | 2026-03-03 |
| 16. Konfi Views -- Profil + Verlinkungen | v1.3 | 1/1 | Complete | 2026-03-03 |
| 17. Admin Views Polishing | v1.3 | 3/3 | Complete | 2026-03-03 |
| 17.1. Checkbox-Farben + Einmalpasswort | v1.3 | 2/2 | Complete | 2026-03-03 |
| 18. Settings-Bereich | v1.3 | 3/3 | Complete | 2026-03-04 |
| 19. Super-Admin Ueberarbeitung | v1.3 | 2/2 | Complete | 2026-03-04 |
| 20. Event-Logik Debug | v1.4 | 2/2 | Complete | 2026-03-05 |
| 21. Badge-Logik Debug | v1.4 | 2/2 | Complete | 2026-03-05 |
| 22. Punkte-Vergabe Debug | v1.4 | 2/2 | Complete | 2026-03-05 |
| 23. User/Rechte/Institutionen Debug | v1.4 | 2/2 | Complete | 2026-03-05 |
| 24. Chat-Logik Debug | v1.4 | 1/1 | Complete | 2026-03-05 |
| 25. Foundation + Konfiguration | v1.5 | 1/1 | Complete | 2026-03-05 |
| 26. Token-Lifecycle | v1.5 | 2/2 | Complete | 2026-03-06 |
| 27. Badge-Count Single Source of Truth | v1.5 | 2/2 | Complete | 2026-03-06 |
| 28. Fehlende Push-Flows | v1.5 | 2/2 | Complete | 2026-03-06 |
| 29. Token-Cleanup + End-to-End Verifikation | v1.5 | 1/1 | Complete | 2026-03-07 |
| 30. DB-Schema + Backend-Endpoints | 2/2 | Complete    | 2026-03-07 | - |
| 31. Punkte-Logik Backend | 2/2 | Complete    | 2026-03-07 | - |
| 32. Punkte-UI Frontend | 2/2 | Complete   | 2026-03-08 | - |
| 33. Dashboard-Widget-Steuerung | v1.6 | 0/? | Not started | - |
