# Roadmap: Konfi Quest

## Milestones

- Shipped **v1.0 Security + Stabilisierung** - Phases 1-2 (shipped 2026-03-01)
- Shipped **v1.1 Design-Konsistenz** - Phases 3-7 (shipped 2026-03-02)
- Shipped **v1.2 Polishing + Tech Debt** - Phases 8-11 (shipped 2026-03-02)
- Shipped **v1.3 Layout-Polishing** - Phases 12-19 (shipped 2026-03-04)
- Shipped **v1.4 Logik-Debug** - Phases 20-24 (shipped 2026-03-05)
- Active **v1.5 Push-Notifications** - Phases 25-29

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

### v1.5 Push-Notifications (Active)

**Milestone Goal:** Push-Notification-System zuverlaessig und vollstaendig machen — Token-Lifecycle, fehlende Flows, Admin-Konfiguration, Badge-Count-Sync.

- [x] **Phase 25: Foundation + Konfiguration** - DB-Schema-Fixes, Firebase Error-Code Forwarding, Push-Type Dokumentation (completed 2026-03-05)
- [x] **Phase 26: Token-Lifecycle** - Token-Zustellung zuverlaessig machen (Logout, Fallback-ID, Refresh, Wechsel, Invalidierung) (completed 2026-03-06)
- [x] **Phase 27: Badge-Count Single Source of Truth** - BadgeCountService als einzige Berechnungsquelle, korrekte Badge-Anzeige ueberall (completed 2026-03-06)
- [ ] **Phase 28: Fehlende Push-Flows** - Event-Erinnerungen, Admin-Alert, Level-Up, Punkte-Meilenstein
- [ ] **Phase 29: Token-Cleanup + End-to-End Verifikation** - Proaktiver Cleanup, alle 17 Push-Flows verifiziert

## Phase Details

### Phase 25: Foundation + Konfiguration
**Goal**: Push-System hat sauberes DB-Schema und Firebase Error-Code Forwarding als Grundlage fuer alle weiteren Aenderungen
**Depends on**: Nothing (first phase of v1.5)
**Requirements**: CFG-01, CFG-02
**Success Criteria** (what must be TRUE):
  1. Jeder Push-Notification-Type ist in einer zentralen Registry definiert mit Name, Beschreibung und enabled-Flag
  2. Push-Types koennen per Flag aktiviert/deaktiviert werden und PushService prueft diese Flags vor dem Versand
  3. event_reminders Tabelle existiert in der DB (CREATE TABLE IF NOT EXISTS)
  4. push_tokens Tabelle hat error_count und last_error_at Spalten fuer spaetere Token-Bereinigung
**Plans**: 1 plan

Plans:
- [ ] 25-01-PLAN.md — DB-Schema Migration, Firebase Error-Code Forwarding, Push-Type Registry Dokumentation

### Phase 26: Token-Lifecycle
**Goal**: Jedes Geraet erhaelt zuverlaessig Push-Notifications fuer den aktuell eingeloggten User — keine Ghost-Tokens, keine verlorenen Geraete
**Depends on**: Phase 25
**Requirements**: TKN-01, TKN-02, TKN-03, TKN-04, CLN-01
**Success Criteria** (what must be TRUE):
  1. Nach Logout erhaelt das Geraet keine Pushes mehr fuer den abgemeldeten User
  2. Geraete mit Fallback-Device-IDs erhalten Pushes genauso zuverlaessig wie Geraete mit nativer Device-ID
  3. Token wird bei App Resume (nach >12h) automatisch refreshed ohne User-Aktion
  4. Bei User-Wechsel auf demselben Geraet erhaelt nur der neue User Pushes
  5. Firebase-Errors mit ungueltigen Tokens fuehren sofort zur Loeschung des Tokens aus der DB
**Plans**: 2 plans

Plans:
- [ ] 26-01-PLAN.md — Backend: Fallback-ID Filter entfernen, Firebase Error-Handling in sendToUser/sendChatNotification
- [ ] 26-02-PLAN.md — Frontend: localStorage-Key Refresh umbenennen, Logout/User-Wechsel Verifikation

### Phase 27: Badge-Count Single Source of Truth
**Goal**: Unread-Badge-Zahlen sind ueberall konsistent — App-Icon, TabBar und Chat-Liste zeigen denselben korrekten Wert
**Depends on**: Phase 25
**Requirements**: BDG-01, BDG-02, BDG-03, BDG-04
**Success Criteria** (what must be TRUE):
  1. Ein einziger BadgeCountService berechnet den Badge-Count, alle anderen Systeme konsumieren diesen Wert
  2. Das App-Icon auf dem Homescreen zeigt die korrekte Anzahl ungelesener Nachrichten (nicht hardcoded "1")
  3. In der Chat-Liste zeigt jeder Raum die richtige Anzahl ungelesener Nachrichten seit letztem Besuch
  4. Die TabBar-Badges (Chat-Tab, Notifications-Tab) stimmen mit den tatsaechlichen Unread-Counts ueberein
**Plans**: 2 plans

Plans:
- [ ] 27-01-PLAN.md — Frontend-Konsolidierung: BadgeContext erweitern, AppContext/MainTabs bereinigen, ChatOverview umstellen
- [ ] 27-02-PLAN.md — Backend: backgroundService Badge-Query um Antraege und Events erweitern

### Phase 28: Fehlende Push-Flows
**Goal**: Konfis und Admins erhalten alle relevanten Push-Benachrichtigungen — Events, Registrierungen, Level-Ups, Meilensteine
**Depends on**: Phase 26
**Requirements**: FLW-01, FLW-02, FLW-03, FLW-04
**Success Criteria** (what must be TRUE):
  1. Angemeldete Konfis erhalten X Stunden vor einem Event eine Erinnerungs-Push
  2. Admins erhalten eine Push-Benachrichtigung wenn ein neuer Konfi sich ueber Invite-Code registriert
  3. Konfis erhalten eine Push-Benachrichtigung wenn sie ein neues Level erreichen
  4. Konfis erhalten eine Push-Benachrichtigung wenn sie die Mindestpunkte fuer Gottesdienst oder Gemeinde erreichen
**Plans**: 2 plans

Plans:
- [ ] 28-01-PLAN.md — Event-Reminder Verifikation (FLW-01) + Admin-Alert bei Registrierung (FLW-02)
- [ ] 28-02-PLAN.md — Level-Up Push Helper + Integration an 4 Punkte-Vergabe-Stellen (FLW-03, FLW-04 covered)

### Phase 29: Token-Cleanup + End-to-End Verifikation
**Goal**: Das Push-System ist selbstreinigend und alle 17 Push-Flows (14 bestehende + 3 neue) funktionieren End-to-End auf echtem Geraet
**Depends on**: Phase 26, Phase 27, Phase 28
**Requirements**: CLN-02, CMP-01
**Success Criteria** (what must be TRUE):
  1. Verwaiste Tokens (User geloescht, Token aelter als 60 Tage) werden automatisch alle 24h bereinigt
  2. Alle 14 bestehenden Push-Flows senden erfolgreich an ein echtes iOS-Geraet
  3. Alle 3 neuen Push-Flows (Level-Up, Admin-Alert, Meilenstein) senden erfolgreich an ein echtes iOS-Geraet
**Plans**: TBD

Plans:
- [ ] 29-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 25 -> 26 -> 27 -> 28 -> 29

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
| 28. Fehlende Push-Flows | 1/2 | In Progress|  | - |
| 29. Token-Cleanup + End-to-End Verifikation | v1.5 | 0/? | Not started | - |
