# Project Research Summary

**Project:** Konfi Quest v2.9 — Test-Suite + CI/CD
**Domain:** Test-Infrastruktur fuer bestehende Express/Ionic/PostgreSQL Multi-Tenant-App
**Researched:** 2026-03-27
**Confidence:** HIGH

## Executive Summary

Konfi Quest v2.9 baut eine vollstaendige Test-Suite und CI/CD-Pipeline fuer eine produktive Multi-Tenant-App nach. Das Projekt hat 18 Backend-Route-Dateien (~14.000 LOC), 125 Frontend-Komponenten (~42.000 LOC), RBAC mit 5 Rollen, Multi-Tenancy (organization_id), Socket.IO, Capacitor-Native-Features und eine etablierte Deployment-Pipeline via git push zu Portainer. Die Herausforderung ist nicht "neue Tests schreiben", sondern "bestehenden Code testbar machen" — das erfordert gezieltes Refactoring als Voraussetzung.

Der empfohlene Ansatz ist ein klares 4-Phasen-Modell: Zuerst Infrastruktur und Refactoring (server.js testbar machen, Test-DB aufsetzen, Fixtures), dann kritische Backend-Integration-Tests mit echtem PostgreSQL (Auth, RBAC, Events, Punkte), dann Frontend-Logik-Tests (Hooks, Context — explizit NICHT Ionic-UI-Snapshots) plus CI/CD-Pipeline, und schliesslich E2E-Tests mit Playwright fuer 4-5 Kernpfade. Die CI/CD-Pipeline blockiert Deployments bei fehlschlagenden Tests (via Portainer-Webhook nach gruenen Tests).

Die groessten Risiken sind (1) das monolithische server.js das ohne Refactoring nicht testbar ist, (2) Vitest-Parallelisierung die Race Conditions auf der gemeinsamen Test-DB erzeugt, und (3) die Versuchung alles zu testen. Mitigation: Transaction-Rollback-Pattern fuer DB-Isolation, App-Factory statt direktem server.js-Import, explizite Coverage-Ziele (75-80% Backend, 40-50% Frontend) die Wartbarkeit ueber reine Zahlen stellen.

## Key Findings

### Empfohlener Stack

Details in STACK.md. Minimale neue Abhaengigkeiten — das Projekt hat bereits fast alles installiert.

**Core Technologies:**
- Vitest 4.1: Backend-Test-Runner — bereits im Frontend installiert, einheitlicher Runner, solider CJS-Support fuer CommonJS-Backend
- supertest 7.2: HTTP-Level-Testing der Express-Routes — De-facto-Standard, fluent API, kein Server-Start noetig
- Playwright 1.52: E2E-Tests — 2-3x schneller als Cypress, Auto-Wait, Ionic Framework selbst nutzt Playwright
- PostgreSQL Service Container (postgres:16): Test-DB in CI — native GitHub-Actions-Feature, kein Docker-in-Docker, Health-Check eingebaut
- GitHub Actions: CI-Orchestrierung — bestehende Workflows (backend.yml, frontend.yml) erweitern, nicht ersetzen

**Bewusste Nicht-Entscheidungen:**
- Cypress entfernen (installiert, ungenutzt, langsamer als Playwright, ~500MB)
- Testcontainers abgelehnt (Over-Engineering, 15s Overhead pro Run, Docker-in-Docker)
- pg-mem abgelehnt (unvollstaendig: LATERAL Joins, RANK() OVER, ON CONFLICT nicht unterstuetzt)
- 100% Coverage-Enforcement abgelehnt (treibt zu sinnlosen Tests)

**Gesamt: 2 neue npm-Pakete (Backend: vitest + supertest), 1 neues + 1 entferntes (Frontend: Playwright statt Cypress)**

### Erwartete Features

Details in FEATURES.md. Priorisiert nach Sicherheits- und Geschaeftsrisiko.

**Muss haben (Table Stakes):**
- Backend Integration Tests Auth-Lifecycle: Login, Token-Refresh, Logout-Revoke, gesperrte User
- Backend Integration Tests RBAC: Jede Rolle, Cross-Org-Isolation (DSG-EKD-Pflicht)
- Backend Integration Tests Events: Kapazitaet, Warteliste-Nachruecken, Pflicht-Events
- Backend Integration Tests Punkte: Atomare Transaktionen (BEGIN/COMMIT), keine Race Conditions
- Test-Datenbank-Setup mit Docker und Transaction-Rollback-Isolation
- GitHub Actions CI Pipeline mit Tests als Deploy-Gate

**Sollte haben (Differentiators):**
- E2E Tests Playwright fuer 4-5 Kernpfade (Login, Punkte, Events, Chat, Admin-CRUD)
- Backend Unit Tests Utility-Functions (bookingUtils, chatUtils, pointTypeGuard — hoher ROI, schnell testbar)
- Frontend Hook-Tests: useOfflineQuery, useActionGuard, tokenStore
- Coverage Reports in CI (Vitest --coverage eingebaut, kein Extra-Paket)
- npm audit als Security-Gate bei jedem Push

**Zurueckstellen auf Phase 2+:**
- Socket.IO Integration Tests (hohe Infrastruktur-Komplexitaet, Chat seit v2.5 stabil)
- Visual Regression Tests (zwei Themes iOS26 + MD3 machen Snapshots fragil)
- Performance/Load Tests (erst vor EKD-Skalierung auf 4000+ User relevant)
- Native E2E via Appium/Detox (erst wenn App im Store ist)

### Architektur-Ansatz

Details in ARCHITECTURE.md. Das Backend nutzt ein Factory-Function-Pattern: jede Route-Datei exportiert eine Funktion die `db`, `rbacVerifier` und weitere Dependencies injiziert bekommt. Das ist der zentrale Hebelpunkt fuer Tests — `createTestApp(db)` baut die Express-App mit Test-DB auf, ohne Server zu starten. Kein Socket.IO, kein SMTP, kein Firebase, kein Cron.

**Haupt-Komponenten (neu zu erstellen):**
1. Backend Test-Infrastruktur: `backend/tests/` — vitest.config.js, setup.js, teardown.js, createTestApp.js, helpers/ (auth, seed, request), 18 Route-Testfiles
2. Frontend Test-Erweiterungen: setupTests.ts aktualisieren, Capacitor/Ionic Mock-Layer, testUtils.tsx Custom Render, Hook-Tests
3. E2E Test-Infrastruktur: `e2e/` — playwright.config.ts, docker-compose.test.yml, global-setup.ts, Page Objects, Kernpfad-Specs
4. CI/CD Pipeline: `.github/workflows/test.yml` (NEU, 3-4 Jobs), backend.yml + frontend.yml erweitern mit `needs: test`

**Schluessel-Patterns:**
- Transaction-Rollback pro Test (BEGIN / ROLLBACK) statt TRUNCATE nach jedem Test — schnell, isoliert
- Eigene Test-DB pro Testlauf (`konfi_test_{pid}`) verhindert Kollisionen bei parallelen Runs
- Dummy-IO fuer Socket.IO in Integration-Tests (emit-Stubs), echtes Socket.IO nur in E2E
- Echte PostgreSQL immer — nie SQLite, nie pg-mem — wegen PG-spezifischer Features im Backend

**Mock-Strategie:**
- PostgreSQL: immer ECHT (Service Container in CI, docker run lokal)
- Firebase/FCM: MOCK via `DISABLE_PUSH=true` ENV-Flag
- Socket.IO: DUMMY in Integration-Tests (No-Op emit-Stubs), ECHT in E2E
- SMTP/Nodemailer: MOCK via ENV-Flag
- Capacitor Plugins: MOCK in Frontend jsdom-Tests, N/A in E2E (Chromium Web-Browser)
- RBAC Middleware: NIEMALS mocken — immer echt mit echten JWT-Tokens

### Kritische Pitfalls

Details in PITFALLS.md (13 Pitfalls dokumentiert, 5 kritisch, 5 moderat, 3 gering).

1. **Vitest-Parallelisierung erzeugt Race Conditions auf gemeinsamer DB** — Transaction-Rollback-Pattern implementieren (BEGIN/ROLLBACK per Test), alternativ `--poolOptions.forks.singleFork` als Sofortmassnahme. Muss vor dem ersten Route-Test geloest sein.

2. **server.js ist monolithischer Seiteneffekt-Block** — `createTestApp(db)` als App-Factory bauen (Phase-1-Voraussetzung). Minimales Refactoring: `if (require.main === module) server.listen(...)` Guard, Firebase + Cron ueber ENV-Flags deaktivierbar. Niemals `require('./server')` in Tests.

3. **RBAC-Middleware mocken verhindert Sicherheits-Tests** — Echte JWT-Tokens mit `generateTestToken()`, echte RBAC-Middleware immer. `vi.mock` auf rbac.js ist verboten in Route-Tests. RBAC-Matrix-Tests (`rbac.test.js`) sind der wertvollste Teil der gesamten Suite.

4. **Ionic Shadow DOM macht Component-Tests fragil** — Frontend-Tests auf Hooks und Services beschraenken. Snapshot-Tests auf Ionic-Komponenten grundsaetzlich vermeiden. Shadow-DOM-spezifische Selektoren brechen bei jedem Ionic Minor-Update.

5. **Test-Maintenance-Burden uebersteigt den Nutzen** — Assertions auf wesentliche Felder (`toHaveProperty('id')`), nicht exakte Objekte. 80/20-Regel anwenden: Auth + Punkte + Events + RBAC decken 80% der Bugs ab. Lieber 60% stabiler Coverage als 95% fragile.

## Implications for Roadmap

Basierend auf der kombinierten Recherche ergibt sich ein klares 4-Phasen-Modell mit strikter Abhaengigkeits-Reihenfolge:

### Phase 1: Backend-Test-Infrastruktur + Refactoring

**Rationale:** Ohne diese Phase sind alle anderen Tests unmoeoglich. server.js muss testbar gemacht werden, Test-DB-Lifecycle muss stehen, Seed-Fixtures muessen repruesentative Daten fuer alle 5 Rollen und 2 Organisationen bereitstellen.

**Delivers:**
- server.js Refactoring: `require.main === module` Guard, `DISABLE_PUSH=true`, `DISABLE_CRON=true` ENV-Flags
- `backend/tests/vitest.config.js` (CJS-kompatibel, kein jsdom, globalSetup/globalTeardown)
- `backend/tests/setup.js` + `teardown.js` (DROP + CREATE DATABASE per Testlauf via `process.pid`)
- `backend/tests/helpers/auth.js` (JWT-Token-Factory fuer alle 5 Rollen + Cross-Org Org2-Admin)
- `backend/tests/helpers/seed.js` (2 Organisationen, alle Rollen, Jahrgang, Kategorien, Aktivitaeten)
- `backend/tests/createTestApp.js` (alle 18 Routes ohne listen(), ohne Socket.IO, ohne SMTP)
- `.env.test` mit allen noetigten Variablen (Dummy-Werte fuer Firebase, SMTP, QR_SECRET)
- Smoke-Test `auth.test.js` zum Validieren der Infrastruktur

**Addresses:** Test-DB-Setup (Table Stakes), Basis fuer alle Route-Tests
**Avoids:** Pitfall 2 (Monolith), Pitfall 3 (Seed-Komplexitaet), Pitfall 11 (RBAC-Cache), Pitfall 12 (Migration-Rerun), Pitfall 13 (ENV-Variablen)
**Research Flag:** Kein Phase-Research noetig — direkt aus Codebase-Analyse ableitbar.

---

### Phase 2: Backend Integration Tests (Tier 1 + 2)

**Rationale:** Sicherheitskritische Tests zuerst, dann Geschaeftslogik. Auth-Tests erzeugen die JWT-Tokens die alle anderen Tests nutzen. RBAC-Matrix-Tests sind die wertvollsten Tests der gesamten Suite.

**Delivers:**
- `auth.test.js`: Login, Register, Token-Refresh, Logout-Revoke, gesperrter User, Rate-Limiting
- RBAC-Matrix: Jeder Endpoint x jede Rolle x Cross-Org-Isolation (Org A sieht keine Daten von Org B)
- `events.test.js`: Buchung, Kapazitaet, Warteliste-Nachruecken, Pflicht-Events, QR-Check-in
- `konfi.test.js` + `konfi-management.test.js`: Atomare Punkte-Vergabe, kein Double-Count
- `activities.test.js` + `badges.test.js`: Aktivitaetszuweisung, Badge-Trigger
- Backend Unit Tests: bookingUtils, chatUtils, pointTypeGuard, roleHierarchy, passwordUtils
- Verbleibende Tier-2/3 Routes: chat (HTTP-Endpoints), jahrgaenge, categories, levels, settings, notifications, users, teamer, wrapped

**Uses:** Vitest + supertest + echte PostgreSQL (Phase-1-Infrastruktur)
**Avoids:** Pitfall 1 (Race Conditions: Transaction-Rollback), Pitfall 7 (Auth-Mocking verboten), Pitfall 10 (Maintenance-Burden: minimale Assertions)
**Research Flag:** Kein Phase-Research noetig — Express/supertest/PostgreSQL-Pattern gut dokumentiert.

---

### Phase 3: CI/CD Pipeline + Frontend Tests

**Rationale:** CI-Pipeline laeuft fruehestmoeglich, sobald Backend-Tests stabil sind — verhindert Deploy-Regression waehrend restliche Tests geschrieben werden. Frontend-Tests fokussieren explizit auf Hooks und Logic, nicht auf Ionic-UI.

**Delivers:**
- `.github/workflows/test.yml`: Job 1 backend-tests (Service Container), Job 2 frontend-tests (jsdom), Job 3 security-audit (npm audit), Job 4 e2e-tests (nur PRs auf main)
- `backend.yml` + `frontend.yml` erweitern: `needs: test` als Deploy-Gate
- Branch-Protection-Rule auf GitHub: test.yml als Required Check
- `frontend/src/setupTests.ts` Update: `@testing-library/jest-dom/vitest` Import, Capacitor-Mocks, Ionic-Mocks
- `frontend/src/tests/mocks/`: capacitor.ts, ionic.ts, api.ts Mock-Factories
- `frontend/src/tests/testUtils.tsx`: Custom render mit AppContext/Router-Wrapper
- `useOfflineQuery.test.ts`, `useActionGuard.test.ts`, `AppContext.test.tsx`

**Implements:** CI-Pipeline-Architektur (Komponente 4), Frontend-Test-Erweiterungen (Komponente 2)
**Avoids:** Pitfall 8 (CI-Speed: npm-Cache via setup-node@v4, Service-Container statt Testcontainers, Tests vor Build), Pitfall 9 (Shadow DOM: kein UI-Testing, nur Hook-Logic)
**Research Flag:** setupTests.ts Ionic 8.8.1 + jsdom-Mock-Details koennen kurze Recherche benoetigen, aber Standard-Pattern deckt das ab.

---

### Phase 4: E2E Tests mit Playwright

**Rationale:** Hoechste Setup-Komplexitaet (eigener Docker-Stack), daher nach Backend und CI. Nur 4-5 Kernpfade — Scope MUSS vor Implementierung definiert sein.

**Delivers:**
- `e2e/playwright.config.ts` + `e2e/global-setup.ts`
- `e2e/docker-compose.test.yml` (Backend + DB + Frontend-Dev-Server)
- Page Objects: LoginPage, DashboardPage, EventsPage, ChatPage
- `auth.spec.ts`, `punkte.spec.ts`, `events.spec.ts`, `chat.spec.ts`
- Nur Web-Build (localhost:5173) — keine nativen Capacitor-Features in Scope

**Addresses:** E2E-Differentiator, Chat-Org-Isolation im echten Browser verifizieren, Login-Flow End-to-End
**Avoids:** Pitfall 4 (Capacitor in Playwright: klarer Scope vorab definiert), Pitfall 5 (Socket.IO haengt: Timeouts + Socket-Registry), Pitfall 8 (CI-Speed: `reuseExistingServer: true`)
**Research Flag:** Phase-Research empfohlen fuer Playwright + Ionic-SPA-Routing und Docker-Compose-E2E-Setup in CI.

---

### Phase-Reihenfolge Begruendung

- **Infrastruktur zuerst (Phase 1):** Keine Abkuerzung moeglich — ohne App-Factory und Test-DB gibt es keine Tests
- **Backend vor Frontend (Phase 2 vor 3):** Backend-Tests sind sicherheitskritischer, besser isoliert testbar als Ionic-Components
- **CI frueh einrichten (Phase 3):** Pipeline laeuft sobald erste Backend-Tests stabil sind — Deploy-Gate verhindert Regression
- **E2E zuletzt (Phase 4):** Hoechste Komplexitaet, aber Integration-Tests finden 90% der Bugs schneller und billiger
- **Kein Big-Bang:** Inkrementell — nach Phase 1+2 hat das Projekt bereits 75-80% Backend-Coverage und echten Sicherheitsschutz

### Research Flags

Phasen die waehrend der Planung tiefer recherchiert werden sollten:
- **Phase 4 (E2E):** Playwright + Ionic-SPA in Docker-Compose — spezifische Konfiguration fuer Ionic-Router-Outlet, Playwright `webServer`-Config, E2E-Health-Check-Pattern in CI

Phasen mit Standard-Patterns (kein Phase-Research noetig):
- **Phase 1 (Infrastruktur):** Direkt aus Codebase-Analyse ableitbar, keine externen Unbekannten
- **Phase 2 (Backend-Tests):** supertest + PostgreSQL + Vitest ist gut dokumentiert und bewaehrt
- **Phase 3 (CI + Frontend-Hooks):** GitHub Actions Service Container offiziell dokumentiert, Hook-Tests sind Standard-React-Testing-Library

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Vitest bereits im Projekt, supertest ist Standard, Playwright von Ionic empfohlen. Alle Entscheidungen gegen offizielle Docs verifiziert. |
| Features | HIGH | Vollstaendige Codebase-Analyse (18 Routes, 125 Komponenten). Risiko-Priorisierung direkt aus LOC und Komplexitaet ableitbar. |
| Architecture | HIGH | Factory-DI-Pattern direkt aus Codebase. createTestApp-Konzept ist direkte Konsequenz des bestehenden Patterns. Keine Spekulation noetig. |
| Pitfalls | HIGH | 13 Pitfalls mit konkreter Praevention. Alle aus Codebase-Eigenheiten und offiziell dokumentierten Anti-Patterns abgeleitet. |

**Overall confidence:** HIGH

### Gaps to Address

- **Nested-Transaction-Problem:** Routes die intern Transaktionen nutzen (activities, events, konfi-management) brauchen spezifisches Handling. Pragmatisch: TRUNCATE fuer diese wenigen Test-Suites statt Transaction-Rollback. Entscheidung pro Route-Test-File waehrend Phase-2-Implementierung.
- **createTestApp Drift:** Die App-Factory koppelt an server.js — wenn neue Routes hinzukommen muessen beide gleichzeitig aktualisiert werden. Kommentar in server.js als Reminder empfohlen.
- **Playwright + Ionic SPA Routing:** Ob Ionic-Router-Outlet korrekt mit Playwright interagiert ohne native Capacitor-Runtime braucht Validierung in Phase 4. Capacitor.isNativePlatform() gibt im Browser `false` zurueck — sollte funktionieren.
- **Firebase-Mock Granularitaet:** `DISABLE_PUSH=true` als ENV-Flag reicht fuer die meisten Tests. Tests die pruefen DASS Push aufgerufen wird benoetigen `vi.mock` auf pushService — Entscheidung pro Route-Test-File.

## Sources

### Primary (HIGH confidence)
- Codebase-Analyse: server.js, 18 Route-Dateien (13.947 LOC gesamt), database.js, rbac.js — direkte Quelle fuer alle Architektur-Empfehlungen
- Vitest 4.0/4.1 Release Notes: https://vitest.dev/blog/vitest-4 und vitest-4-1 — Stack-Entscheidung
- supertest npm: https://www.npmjs.com/package/supertest — HTTP-Testing-Standard
- Playwright Release Notes: https://playwright.dev/docs/release-notes — E2E-Framework-Wahl
- GitHub Actions PostgreSQL Service Containers: https://docs.github.com/en/actions/using-containerized-services/creating-postgresql-service-containers — CI-DB-Setup
- Ionic React Testing: https://ionicframework.com/docs/react/testing/introduction — Shadow-DOM-Einschraenkungen

### Secondary (MEDIUM confidence)
- Vitest + Testcontainers + PostgreSQL: https://nikolamilovic.com/posts/integration-testing-node-postgres-vitest-testcontainers/ — Transaction-Rollback-Pattern
- Socket.IO Official Testing Docs: https://socket.io/docs/v4/testing/ — Socket-Test-Cleanup-Pattern
- Testing Strategies 2026: https://calmops.com/programming/javascript/javascript-testing-guide-2026/ — Allgemeine Best Practices
- GitHub Actions + Vitest + PostgreSQL: https://samueldurante.com/post/setting-up-tests-environment-vitest-github-actions/ — CI-Konfiguration

### Tertiary (LOW confidence)
- Playwright + Ionic/Capacitor in Production Apps — Community-Berichte bestaetigen Web-Only-Einschraenkung, keine offizielle Dokumentation fuer spezifische Ionic-SPA-E2E-Konfiguration mit Playwright

---
*Research completed: 2026-03-27*
*Ready for roadmap: yes*
