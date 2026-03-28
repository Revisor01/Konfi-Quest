---
phase: 107-e2e-tests-mit-playwright
plan: 01
subsystem: testing/e2e
tags: [playwright, docker-compose, e2e, login]
dependency_graph:
  requires: [backend/Dockerfile, frontend/Dockerfile, backend/tests/helpers/seed.js]
  provides: [docker-compose.e2e.yml, playwright.config.ts, e2e/helpers/auth.ts, e2e/login.spec.ts]
  affects: [frontend/Dockerfile]
tech_stack:
  added: ["@playwright/test", "pg (root)"]
  patterns: [docker-compose-e2e-stack, playwright-global-setup, ionic-e2e-selektoren]
key_files:
  created: [docker-compose.e2e.yml, playwright.config.ts, e2e/global-setup.ts, e2e/global-teardown.ts, e2e/helpers/auth.ts, e2e/login.spec.ts, package.json]
  modified: [frontend/Dockerfile]
decisions:
  - "Playwright mit Chromium-only (D-10) -- Ionic-App braucht keinen Multi-Browser-Test"
  - "Frontend Dockerfile um VITE_API_URL Build-Arg erweitert -- Vite bettet env-vars zur Build-Zeit ein"
  - "Ionic-spezifische Selektoren: ion-input[placeholder] input statt getByPlaceholder"
  - "Root package.json mit test:e2e Script erstellt (existierte vorher nicht)"
metrics:
  duration_seconds: 344
  completed: "2026-03-28T07:28:04Z"
---

# Phase 107 Plan 01: E2E-Infrastruktur und Login-Flow Tests Summary

Docker-Compose E2E Stack (postgres + backend + frontend) mit Playwright-Konfiguration und Login-Flow Tests fuer Konfi und Admin

## Was gebaut wurde

### Docker-Compose E2E Stack (docker-compose.e2e.yml)
- 3 Services: e2e-db (postgres:16-alpine, Port 5444), e2e-backend (Port 5555), e2e-frontend (Port 5556)
- Backend mit DATABASE_URL, JWT_SECRET, CORS_ORIGINS konfiguriert
- Frontend mit VITE_API_URL als Build-Arg (Vite Build-Zeit Variable)
- Health-Checks auf allen Services fuer zuverlaessiges Startup

### Playwright-Konfiguration (playwright.config.ts)
- Chromium-only Projekt, testDir ./e2e
- baseURL: http://localhost:5556 (Frontend)
- globalSetup startet Docker-Stack und seedet DB
- globalTeardown raeumt Stack auf (docker compose down -v)

### Login-Flow E2E Tests (e2e/login.spec.ts)
- Konfi-Login: konfi1 einloggen, Weiterleitung zu /konfi/dashboard
- Admin-Login: admin1 einloggen, Weiterleitung zu /admin/*
- Falsches Passwort: Fehlermeldung .app-auth-error wird angezeigt
- Auth-Helper loginAs() wiederverwendbar fuer Plan 02

## Commits

| Task | Commit | Beschreibung |
|------|--------|-------------|
| 1 | d1dc9ea | Docker-Compose E2E Stack + Playwright-Konfiguration |
| 2 | 8851760 | Login-Flow E2E Tests fuer Konfi und Admin |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Frontend Dockerfile fehlte VITE_API_URL Build-Arg**
- **Found during:** Task 1
- **Issue:** Frontend Dockerfile hatte kein ARG VITE_API_URL, Vite-Build wuerde ohne API-URL bauen
- **Fix:** ARG VITE_API_URL + ENV VITE_API_URL=$VITE_API_URL vor RUN npm run build eingefuegt
- **Files modified:** frontend/Dockerfile
- **Commit:** d1dc9ea

**2. [Rule 3 - Blocking] Kein Root package.json vorhanden**
- **Found during:** Task 1
- **Issue:** Projekt hatte kein Root package.json fuer Playwright-Installation
- **Fix:** package.json mit test:e2e Script erstellt, @playwright/test und pg als devDependencies
- **Files modified:** package.json (neu)
- **Commit:** d1dc9ea

### Hinweis: Docker nicht lokal verfuegbar
Docker war auf dem Entwicklungsrechner nicht installiert. Alle Artefakte wurden erstellt und syntaktisch geprueft, aber der E2E Stack konnte nicht live getestet werden. Tests muessen bei Docker-Verfuegbarkeit manuell verifiziert werden.

## Known Stubs

Keine -- alle Dateien sind vollstaendig implementiert.

## Self-Check: PASSED

- 7/7 Dateien vorhanden
- 2/2 Commits gefunden (d1dc9ea, 8851760)
