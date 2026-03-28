# Requirements: Konfi Quest v2.9 Test-Suite + CI/CD

**Defined:** 2026-03-27
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v2.9 Requirements

### Test-Infrastruktur

- [x] **INF-01**: server.js refactored — Express-App exportierbar fuer supertest (createApp-Pattern)
- [x] **INF-02**: createTestApp Helper erstellt Test-Express-App mit echtem pg-Pool gegen Test-DB
- [x] **INF-03**: Test-DB Lifecycle: Setup, Migration, Seed, Teardown pro Test-Suite
- [x] **INF-04**: Auth-Test-Helpers generieren echte JWTs fuer alle 5 RBAC-Rollen
- [x] **INF-05**: Seed-Fixtures fuer 2+ Organisationen, alle Rollen, Beispieldaten
- [x] **INF-06**: Vitest Backend-Config (vitest.config.backend.ts) mit sequentieller Ausfuehrung

### Backend Integration Tests

- [x] **BIT-01**: Auth-Routes getestet (Login, Register, Refresh, Logout, Passwort-Reset)
- [x] **BIT-02**: RBAC-Matrix getestet — jede Route prueft alle 5 Rollen + Org-Isolation
- [x] **BIT-03**: Activities-Routes getestet (CRUD, Punkte-Vergabe, Kategorie-Filter)
- [x] **BIT-04**: Events-Routes getestet (Erstellen, Buchen, Timeslots, Warteliste, Absagen)
- [x] **BIT-05**: Konfi-Routes getestet (Profil, Punkte-History, Dashboard-Daten)
- [x] **BIT-06**: Chat-Routes getestet (Raeume, Nachrichten, Teilnehmer, Dateien)
- [x] **BIT-07**: Badges-Routes getestet (Vergabe, Levels, Auto-Award, Progress)
- [x] **BIT-08**: Remaining Routes getestet (categories, jahrgaenge, levels, notifications, organizations, roles, settings, users, bonus, material, teamer, wrapped)

### CI/CD Pipeline

- [ ] **CIC-01**: GitHub Actions Workflow mit PostgreSQL Service Container fuehrt Backend-Tests aus
- [ ] **CIC-02**: Frontend-Tests (Vitest) laufen in CI Pipeline
- [ ] **CIC-03**: npm audit laeuft in CI und bricht bei critical/high Vulnerabilities ab
- [ ] **CIC-04**: Tests sind Deploy-Gate — Deployment nur bei gruenen Tests

### Frontend Tests

- [ ] **FRT-01**: Kritische Hooks getestet (useOfflineQuery, useActionGuard, AppContext)
- [ ] **FRT-02**: Utility-Funktionen getestet (tokenStore, networkMonitor, api-Service)
- [ ] **FRT-03**: Mindestens 5 Component-Tests fuer Dashboard/Login/EventDetail

### E2E Tests

- [ ] **E2E-01**: Playwright Setup mit Docker Compose Test-Stack (DB + Backend + Frontend)
- [ ] **E2E-02**: Login-Flow E2E (Konfi + Admin)
- [ ] **E2E-03**: Punkte-Vergabe E2E (Admin vergibt Aktivitaet an Konfi)
- [ ] **E2E-04**: Event-Buchung E2E (Konfi bucht Event)
- [ ] **E2E-05**: Chat E2E (Nachricht senden und empfangen)

## Future Requirements

### Staging-Umgebung (v3.1)

- **STG-01**: Zweiter Docker-Stack (test.konfi-quest.de)
- **STG-02**: DB-Spiegel anonymisiert wegen DSG-EKD
- **STG-03**: TestFlight/interner Test-Track gegen Staging

### Erweiterte Tests

- **EXT-01**: Performance/Load-Tests
- **EXT-02**: Visual Regression Tests
- **EXT-03**: Accessibility Tests

## Out of Scope

| Feature | Reason |
|---------|--------|
| Unit Tests fuer jede Komponente | ROI zu gering bei Ionic Shadow-DOM, Integration-Tests wertvoller |
| Mobile-native E2E (Appium) | Capacitor-Plugin-Tests nicht via Playwright moeglich, Web-Flows reichen |
| Snapshot Tests | Hohe Wartungskosten, geringer Wert bei aktiver UI-Entwicklung |
| Mutation Testing | Overkill fuer erste Test-Suite, spaeter evaluieren |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INF-01 | Phase 101 | Complete |
| INF-02 | Phase 101 | Complete |
| INF-03 | Phase 101 | Complete |
| INF-04 | Phase 101 | Complete |
| INF-05 | Phase 101 | Complete |
| INF-06 | Phase 101 | Complete |
| BIT-01 | Phase 102 | Pending |
| BIT-02 | Phase 102 | Complete |
| BIT-03 | Phase 103 | Complete |
| BIT-04 | Phase 103 | Complete |
| BIT-05 | Phase 103 | Pending |
| BIT-06 | Phase 103 | Pending |
| BIT-07 | Phase 103 | Complete |
| BIT-08 | Phase 104 | Complete |
| CIC-01 | Phase 105 | Pending |
| CIC-02 | Phase 105 | Pending |
| CIC-03 | Phase 105 | Pending |
| CIC-04 | Phase 105 | Pending |
| FRT-01 | Phase 106 | Pending |
| FRT-02 | Phase 106 | Pending |
| FRT-03 | Phase 106 | Pending |
| E2E-01 | Phase 107 | Pending |
| E2E-02 | Phase 107 | Pending |
| E2E-03 | Phase 107 | Pending |
| E2E-04 | Phase 107 | Pending |
| E2E-05 | Phase 107 | Pending |

**Coverage:**
- v2.9 requirements: 26 total
- Mapped to phases: 26
- Unmapped: 0

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 after roadmap creation*
