# Technology Stack: Test-Suite + CI/CD

**Project:** Konfi Quest v2.9
**Researched:** 2026-03-27
**Scope:** Neue Abhaengigkeiten fuer Backend Integration Tests, Frontend Component Tests, E2E Tests und CI/CD Pipeline

## Empfohlener Stack (Neue Abhaengigkeiten)

### Backend Integration Tests

| Technology | Version | Zweck | Warum |
|------------|---------|-------|-------|
| Vitest | ^4.1.2 | Test-Runner fuer Backend | Bereits im Frontend installiert (^4.1.0), einheitlicher Runner ueber die gesamte Codebase. Vitest 4.0+ ist stabil mit verbessertem CJS-Support. |
| supertest | ^7.2.2 | HTTP-Level Testing der Express-Routes | De-facto-Standard fuer Express-API-Tests. Fluent API, automatisches Port-Management, 2.4M weekly downloads. |

**Kritischer Hinweis -- CommonJS Backend:**
Das Backend ist CommonJS (`require()`, kein `"type": "module"` in package.json). Vitest ist ESM-first, aber behandelt CJS-Imports transparent beim Ausfuehren. Einzige Einschraenkung: `vi.mock()` funktioniert NICHT mit `require()`-Imports. Das ist fuer Integration-Tests kein Problem, weil wir gegen eine echte DB testen und NICHTS mocken wollen. Vitest braucht eine eigene `vitest.config.ts` im Backend-Ordner.

**Warum NICHT Jest fuer das Backend:**
- Vitest ist bereits im Frontend (^4.1.0) -- zwei Test-Runner erhoehen Komplexitaet
- Vitest 4.x hat soliden CommonJS-Support fuer Test-Ausfuehrung
- Bei Integration-Tests wird nichts gemockt, daher ist die `vi.mock()`-CJS-Einschraenkung irrelevant
- Einheitliche Config-Sprache (vite.config / vitest.config)

**Confidence:** HIGH (Vitest bereits im Projekt, supertest ist Standard)

### Test-Datenbank-Strategie

| Technology | Version | Zweck | Warum |
|------------|---------|-------|-------|
| PostgreSQL Service Container | postgres:16 | Isolierte Test-DB in GitHub Actions | GitHub Actions bietet native Service Containers -- kein Extra-Paket noetig. Schneller Start, health-checks eingebaut. |
| Docker Compose (lokal) | -- | Test-DB lokal starten | Einfaches `docker run` oder separates docker-compose.test.yml fuer lokale Entwicklung. |

**Warum NICHT Testcontainers:**
- Testcontainers (^11.13.0) ist maechtig, aber Over-Engineering fuer diesen Use Case
- Wir brauchen EINE PostgreSQL-Instanz, keine dynamisch provisionierten Container
- GitHub Actions Service Containers decken CI ab, lokal reicht ein `docker run`
- Testcontainers fuegt ~15 Sekunden Container-Startup pro Testlauf hinzu vs. bereits laufender Service
- Testcontainers erfordert Docker-in-Docker-Setup in CI -- unnoetige Komplexitaet

**Test-Isolation-Strategie:**
```
beforeEach: BEGIN Transaction
afterEach:  ROLLBACK Transaction
```
Jeder Test laeuft in einer Transaktion die zurueckgerollt wird. Schnell, isoliert, kein Seed-Reset noetig. Fuer Tests die Transaktionen selbst nutzen (z.B. Punkte-Operationen): Schema-Reset per `TRUNCATE ... CASCADE` im `beforeAll`.

**Confidence:** HIGH (GitHub Actions Service Containers sind offiziell dokumentiert und bewaehrt)

### Frontend Component Tests

| Technology | Version | Zweck | Warum |
|------------|---------|-------|-------|
| Vitest | ^4.1.2 | Test-Runner | Bereits installiert, konfiguriert in vite.config.ts |
| @testing-library/react | ^16.2.0 | React Component Testing | Bereits installiert als devDependency |
| @testing-library/jest-dom | ^5.16.5 | DOM Assertions (toBeInTheDocument etc.) | Bereits installiert als devDependency |
| @testing-library/user-event | ^14.4.3 | User-Interaktions-Simulation | Bereits installiert als devDependency |
| jsdom | ^29.0.0 | Browser-Umgebung fuer Tests | Bereits installiert, konfiguriert als Vitest environment |

**Bereits vorhanden -- NICHTS neues installieren.**
Die Frontend-Testing-Infrastruktur ist komplett eingerichtet (vite.config.ts hat `test` Block, setupTests.ts existiert). Es fehlen nur die eigentlichen Testdateien.

**setupTests.ts muss aktualisiert werden:**
- Aktuell importiert `@testing-library/jest-dom/extend-expect` (altes API)
- Muss auf `@testing-library/jest-dom/vitest` aktualisiert werden (Vitest 4.x kompatibel)
- `matchMedia` Mock ist bereits vorhanden (gut fuer Ionic)
- Ionic-spezifische Mocks hinzufuegen: `IonRouter`, `IonModal`, Capacitor Plugins

**Confidence:** HIGH (alles bereits installiert und konfiguriert)

### E2E Tests

| Technology | Version | Zweck | Warum |
|------------|---------|-------|-------|
| @playwright/test | ^1.52.0 | E2E Testing der Web-App | Schneller als Cypress, bessere CI-Performance, Multi-Browser, Auto-Wait, Tracing. |

**Warum Playwright statt Cypress (bereits in devDependencies ^13.5.0):**
- Cypress ist bereits installiert aber UNBENUTZT (keine Testdateien, kein cypress.config)
- Playwright ist 2-3x schneller in CI (parallele Browser-Kontexte statt seriell)
- Playwright hat native `auto-wait` -- weniger Flaky Tests als Cypress
- Playwright Tracing (Vitest 4.0 Integration) fuer Debugging
- Ionic Framework selbst nutzt Playwright fuer ihre Tests
- Headless-Chromium-Only reicht fuer unseren Use Case (keine Cross-Browser-Pflicht)
- Playwright hat bessere Unterstuetzung fuer Single-Page-Apps mit dynamischem Routing

**Cypress entfernen:**
```bash
cd frontend && npm uninstall cypress
```
Spart ~500MB node_modules und vermeidet Verwirrung durch zwei E2E-Frameworks.

**E2E-Scope:** Nur Web-Version testen (localhost:5173). Capacitor-Native-Tests sind Out of Scope fuer v2.9.

**Confidence:** HIGH (Playwright ist der klare Gewinner fuer neue Projekte 2025/2026, Ionic-Empfehlung)

### CI/CD Pipeline

| Technology | Version | Zweck | Warum |
|------------|---------|-------|-------|
| GitHub Actions | -- | CI/CD Orchestrierung | Bereits vorhanden (frontend.yml, backend.yml). Erweitern, nicht ersetzen. |
| actions/setup-node@v4 | -- | Node.js Setup | Standard fuer npm-basierte Projekte |
| PostgreSQL Service Container | postgres:16 | Test-DB in CI | Native GitHub Actions Feature, kein Extra-Tooling |
| npm audit | -- | Dependency-Sicherheitspruefung | Bereits in npm eingebaut, kein Extra-Paket |

**Pipeline-Architektur (3 Jobs, 2 Workflows):**

1. **test.yml** (NEU, bei jedem Push/PR):
   - Job 1: `backend-tests` -- Vitest + supertest gegen PostgreSQL Service Container
   - Job 2: `frontend-tests` -- Vitest Component Tests (jsdom)
   - Job 3: `e2e-tests` -- Playwright gegen laufende App (depends_on: Job 1 + 2)
   - Job 4: `security-audit` -- npm audit (parallel zu Tests)

2. **backend.yml / frontend.yml** (bestehend, Deploy):
   - Erweitern mit `needs: test` damit Deploy nur nach gruenen Tests laeuft
   - Alternativ: test.yml als required check, Deploy-Workflows behalten `workflow_dispatch`

**Confidence:** HIGH (bestehende GitHub Actions Infrastruktur, Service Containers offiziell dokumentiert)

## Nicht hinzufuegen (bewusste Entscheidungen)

| Kategorie | Abgelehnt | Warum nicht |
|-----------|-----------|-------------|
| Test-DB | testcontainers ^11.13.0 | Over-Engineering: GitHub Actions Service Container reicht, spart 15s Startup + Docker-in-Docker |
| Test-DB | pg-mem | In-Memory PostgreSQL-Emulation, aber unvollstaendig (keine Window Functions, CTEs fragil). Wir haben LATERAL Joins, PERCENT_RANK -- die brauchen echtes PostgreSQL. |
| E2E | Cypress ^13.5.0 | Bereits installiert aber unbenutzt. Langsamer als Playwright, groesserer Footprint. Entfernen. |
| E2E | Vitest Browser Mode | Vitest 4.0 Browser Mode ist stabil, aber fuer E2E-Tests einer Full-Stack-App (Backend + Frontend + DB) ist Playwright besser geeignet. Browser Mode ist fuer Component-Tests. |
| Mocking | msw (Mock Service Worker) | Fuer Backend-Integration-Tests mocken wir NICHTS (echte DB). Fuer Frontend-Tests reichen einfache axios-Mocks. MSW lohnt sich erst bei >50 API-Endpunkten mit komplexer Zustandslogik. |
| Coverage | istanbul/c8 separat | Vitest hat `--coverage` eingebaut (v8-Provider). Kein separates Coverage-Tool noetig. |
| Reporting | jest-html-reporter etc. | GitHub Actions Annotations reichen. Bei Bedarf spaeter ergaenzen. |
| Mutation Testing | stryker-mutator | Guter Ansatz, aber deutlich zu frueh. Erst grundlegende Tests schreiben, dann Qualitaet messen. |
| Visual Regression | Vitest toMatchScreenshot | Ionic-Themes (iOS26/MD3) machen Screenshot-Vergleiche fragil. Manuelle UI-Pruefung reicht vorerst. |
| API Docs/Tests | Swagger/OpenAPI | Explizit Out of Scope (siehe PROJECT.md) |

## Installation

### Backend (neue Abhaengigkeiten)

```bash
cd backend && npm install -D vitest supertest
```

### Frontend (Cypress entfernen, Playwright hinzufuegen)

```bash
cd frontend && npm uninstall cypress && npm install -D @playwright/test
npx playwright install chromium  # Nur Chromium, spart ~800MB
```

### Keine weiteren Pakete noetig

Frontend hat bereits: vitest, @testing-library/react, @testing-library/jest-dom, @testing-library/user-event, jsdom

## Konfigurationsdateien (neu zu erstellen)

| Datei | Zweck |
|-------|-------|
| `backend/vitest.config.ts` | Vitest-Config fuer Backend (CommonJS-kompatibel, kein jsdom) |
| `backend/tests/setup.ts` | globalSetup: DB-Schema laden, Test-Daten seeden |
| `backend/tests/helpers.ts` | Shared: createTestApp(), getAuthToken(), DB-Transaction-Wrapper |
| `frontend/playwright.config.ts` | Playwright-Config (baseURL, webServer, chromium-only) |
| `frontend/src/setupTests.ts` | UPDATE: jest-dom/vitest Import, Ionic Mocks |
| `.github/workflows/test.yml` | Neue CI-Pipeline mit 4 Jobs |

## Zusammenfassung

| Bereich | Loesung | Neue Abhaengigkeit? |
|---------|---------|---------------------|
| Backend Test-Runner | Vitest 4.1 | JA -- `vitest` (devDep im Backend) |
| Backend HTTP-Tests | supertest 7.2 | JA -- `supertest` (devDep im Backend) |
| Backend Test-DB (CI) | PostgreSQL Service Container | NEIN (GitHub Actions nativ) |
| Backend Test-DB (lokal) | docker run postgres:16 | NEIN |
| Frontend Test-Runner | Vitest 4.1 | NEIN (bereits installiert) |
| Frontend Component Tests | @testing-library/react | NEIN (bereits installiert) |
| E2E Tests | Playwright 1.52 | JA -- `@playwright/test` (devDep) |
| CI/CD Pipeline | GitHub Actions | NEIN (bereits vorhanden) |
| Security Audit | npm audit | NEIN (npm-builtin) |
| Coverage | Vitest --coverage | NEIN (vitest-builtin) |
| Altes E2E-Framework | Cypress entfernen | ENTFERNEN -- `cypress` |

**Gesamt: 2 neue npm-Pakete (Backend), 1 neues + 1 entferntes (Frontend). Minimaler Footprint.**

## Quellen

- Vitest 4.0 Release: https://vitest.dev/blog/vitest-4 (HIGH confidence)
- Vitest 4.1 Release: https://vitest.dev/blog/vitest-4-1 (HIGH confidence)
- supertest npm: https://www.npmjs.com/package/supertest (HIGH confidence)
- Playwright Release Notes: https://playwright.dev/docs/release-notes (HIGH confidence)
- GitHub Actions PostgreSQL Service Containers: https://docs.github.com/en/actions/using-containerized-services/creating-postgresql-service-containers (HIGH confidence)
- Ionic React Testing: https://ionicframework.com/docs/react/testing/introduction (HIGH confidence)
- Vitest + Testcontainers + PostgreSQL: https://nikolamilovic.com/posts/integration-testing-node-postgres-vitest-testcontainers/ (MEDIUM confidence)
- Testcontainers Node.js: https://www.npmjs.com/package/testcontainers (MEDIUM confidence)
- Testing Strategies 2026: https://calmops.com/programming/javascript/javascript-testing-guide-2026/ (MEDIUM confidence)
- GitHub Actions + Vitest + PostgreSQL Setup: https://samueldurante.com/post/setting-up-tests-environment-vitest-github-actions/ (MEDIUM confidence)
