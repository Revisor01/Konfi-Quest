# Roadmap: Konfi Quest

## Milestones

- Shipped **v1.0 Security + Stabilisierung** - Phases 1-2 (shipped 2026-03-01)
- Shipped **v1.1 Design-Konsistenz** - Phases 3-7 (shipped 2026-03-02)
- Shipped **v1.2 Polishing + Tech Debt** - Phases 8-11 (shipped 2026-03-02)
- Shipped **v1.3 Layout-Polishing** - Phases 12-19 (shipped 2026-03-04)
- In Progress **v1.4 Logik-Debug** - Phases 20-24

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

### v1.4 Logik-Debug (In Progress)

**Milestone Goal:** Systematischer Debug aller Kern-Logiken (Events, Badges, Punkte, Rechte) als Grundlage fuer Push-Benachrichtigungen

- [x] **Phase 20: Event-Logik Debug** - Buchung, Warteliste, Nachruecken, Kapazitaet, Timeslots und Stornierung absichern (completed 2026-03-04)
- [x] **Phase 21: Badge-Logik Debug** - Alle Badge-Kriterien systematisch pruefen und korrigieren (completed 2026-03-04)
- [x] **Phase 22: Punkte-Vergabe Debug** - Transaktionssicherheit und Konsistenz bei Punkteoperationen (completed 2026-03-05)
- [x] **Phase 23: User/Rechte/Institutionen Debug** - RBAC, Jahrgang-Filterung und Org-Verwaltung absichern (completed 2026-03-05)
- [x] **Phase 24: Chat-Logik Debug** - Dateizugriff und Socket-Rollen-Konsistenz (completed 2026-03-05)

## Phase Details

### Phase 20: Event-Logik Debug
**Goal**: Events koennen zuverlaessig gebucht, storniert und nachgerueckt werden -- ohne Race Conditions oder inkonsistente Zustaende
**Depends on**: Nothing (first phase of v1.4)
**Requirements**: EVT-01, EVT-02, EVT-03, EVT-04, EVT-05, EVT-06, EVT-07, EVT-08
**Success Criteria** (what must be TRUE):
  1. Konfi kann ein Event buchen und landet bei voller Kapazitaet auf der Warteliste mit einheitlichem Status
  2. Bei Stornierung (durch Konfi oder Admin) rueckt der naechste Wartelisten-Eintrag automatisch nach -- bei Timeslot-Events nur innerhalb desselben Timeslots
  3. Konfi kann nur buchen wenn das Registrierungsfenster offen ist (opens_at/closes_at wird geprueft)
  4. Admin-Buchung fuer einen Konfi prueft Kapazitaet transaktionssicher und kann nicht ueberbuchen
  5. Konfi sieht seine Wartelisten-Buchungen in der eigenen Buchungsuebersicht
**Plans**: 2 plans (Wave 1 parallel)

Plans:
- [ ] 20-01: events.js -- Status-Vereinheitlichung (waitlist statt pending), User-Bookings-Fix, Admin-Booking Transaktion, Nachruecken bei Kapazitaetsaenderung [EVT-01, EVT-05, EVT-06, EVT-08]
- [ ] 20-02: konfi.js -- Registrierungsfenster-Pruefung, Nachrueck-Logik bei Stornierung, Route-Dokumentation [EVT-01, EVT-02, EVT-03, EVT-04, EVT-07]

### Phase 21: Badge-Logik Debug
**Goal**: Alle Badge-Kriterien loesen korrekt aus -- unabhaengig von Kriterium-Typ, Zeitraum oder Datenkonstellation
**Depends on**: Phase 20 (Event-Punkte muessen korrekt vergeben werden bevor Badge-Kriterien darauf aufbauen)
**Requirements**: BDG-01, BDG-02, BDG-03, BDG-04, BDG-05
**Success Criteria** (what must be TRUE):
  1. Alle 13 Badge-Kriterium-Typen vergeben Badges korrekt wenn die Bedingung erfuellt ist
  2. Streak-Badges zaehlen korrekt ueber den Jahreswechsel (Woche 52/53 nach Woche 1)
  3. Category-Activities-Badges zaehlen sowohl regulaere Aktivitaeten als auch Event-Kategorien
  4. Default-Badges bei neuer Organisation enthalten korrekte Umlaute
**Plans**: 2 plans (Wave 1 parallel)

Plans:
- [ ] 21-01: badges.js -- Streak-Jahreswechsel-Fix, activity_combination criteria_value Fix, Code-Review aller 13 Typen, bonus_points Dokumentation [BDG-01, BDG-02, BDG-03, BDG-04]
- [ ] 21-02: organizations.js -- Default-Badges Umlaute korrigieren [BDG-05]

### Phase 22: Punkte-Vergabe Debug
**Goal**: Punkteoperationen sind transaktionssicher und konsistent -- keine verlorenen Punkte, keine negativen Werte, keine doppelten Routen
**Depends on**: Nothing (kann parallel zu Phase 20 geplant werden, aber sequenziell ausgefuehrt)
**Requirements**: PNK-01, PNK-02, PNK-03, PNK-04, PNK-05
**Success Criteria** (what must be TRUE):
  1. Activity- und Bonus-Punkte-Zuweisungen sind atomar (INSERT + konfi_profiles UPDATE in einer Transaktion)
  2. Loeschen von Bonus-Punkten kann konfi_profiles nie unter 0 setzen
  3. Es gibt genau einen Endpunkt fuer Bonus-Punkte-Operationen (keine doppelten Routen)
  4. Points-History zeigt korrekte Berechnungen ohne Abweichungen zwischen Anzeige und DB-Werten
**Plans**: 2 plans (Wave 1 -> Wave 2)

Plans:
- [ ] 22-01-PLAN.md -- Transaktionssicherheit + Negativ-Schutz in activities.js und konfi-managment.js [PNK-01, PNK-02, PNK-03]
- [ ] 22-02-PLAN.md -- Bonus-Route konsolidieren + Points-History konsistent machen [PNK-04, PNK-05]

### Phase 23: User/Rechte/Institutionen Debug
**Goal**: RBAC-Rollen, Jahrgang-Filterung und Org-Verwaltung funktionieren lueckenlos und konsistent
**Depends on**: Nothing (unabhaengig von Event/Badge/Punkte-Logik)
**Requirements**: USR-01, USR-02, USR-03, USR-04
**Success Criteria** (what must be TRUE):
  1. last_login_at wird nur beim Login-Endpunkt aktualisiert, nicht bei Token-Validierung oder anderen Requests
  2. Jahrgang-basierte Filterung greift konsistent in allen relevanten Routes (Konfis, Activities, Events)
  3. Loeschen einer Organisation entfernt alle abhaengigen Daten sauber (CASCADE-Kette verifiziert)
  4. Organisations-Endpunkte haben Rate-Limiting das Missbrauch verhindert
**Plans**: 2 plans (Wave 1 parallel)

Plans:
- [ ] 23-01-PLAN.md -- last_login_at Fix + Org Rate-Limiting [USR-01, USR-04]
- [ ] 23-02-PLAN.md -- Jahrgang-Filterung in Activities/Events + Org-Loeschung CASCADE [USR-02, USR-03]

### Phase 24: Chat-Logik Debug
**Goal**: Chat-Dateizugriff ist organisationsbezogen abgesichert und Socket-Rollen bleiben aktuell
**Depends on**: Nothing (unabhaengig)
**Requirements**: CHT-01, CHT-02
**Success Criteria** (what must be TRUE):
  1. GET /files/:filename liefert Dateien nur an Nutzer derselben Organisation (kein Cross-Tenant-Zugriff)
  2. Bei Rollenaenderung eines Users werden die Socket.io-Berechtigungen sofort aktualisiert
**Plans**: 1 plan

Plans:
- [ ] 24-01-PLAN.md -- Path-Traversal-Schutz + Org-Check Haertung + Socket-Disconnect bei Rollenaenderung [CHT-01, CHT-02]

## Progress

**Execution Order:**
Phases execute in numeric order: 20 -> 21 -> 22 -> 23 -> 24

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
| 20. Event-Logik Debug | 2/2 | Complete    | 2026-03-04 | - |
| 21. Badge-Logik Debug | 2/2 | Complete    | 2026-03-05 | - |
| 22. Punkte-Vergabe Debug | 2/2 | Complete    | 2026-03-05 | - |
| 23. User/Rechte/Institutionen Debug | 2/2 | Complete    | 2026-03-05 | - |
| 24. Chat-Logik Debug | 1/1 | Complete   | 2026-03-05 | - |
