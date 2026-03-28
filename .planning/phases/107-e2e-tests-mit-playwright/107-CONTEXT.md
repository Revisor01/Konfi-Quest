# Phase 107: E2E Tests mit Playwright - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-generated (discuss auto — infrastructure/test phase)

<domain>
## Phase Boundary

Die 4 wichtigsten User-Journeys sind End-to-End im echten Browser verifiziert. Docker-Compose Test-Stack (DB + Backend + Frontend) startet automatisch und ist fuer Playwright erreichbar.

</domain>

<decisions>
## Implementation Decisions

### Test-Stack
- **D-01:** Docker-Compose Test-Stack mit 3 Services: postgres, backend, frontend
- **D-02:** Backend baut aus lokalem Dockerfile, Frontend als Vite dev-server oder static build
- **D-03:** Playwright Tests laufen AUSSERHALB des Docker-Stacks (host-seitig, greift auf localhost zu)

### E2E Test-Flows
- **D-04:** Login-Flow: Konfi und Admin koennen sich einloggen und sehen ihr jeweiliges Dashboard
- **D-05:** Punkte-Vergabe: Admin vergibt Aktivitaet an Konfi, Punkte erscheinen im Konfi-Profil
- **D-06:** Event-Buchung: Konfi bucht ein Event, Buchung erscheint in der Event-Liste
- **D-07:** Chat: Nachricht wird gesendet und beim Empfaenger angezeigt

### Test-Daten
- **D-08:** Seed-Daten aus Phase 101 wiederverwenden (gleiche 2 Orgs, 10 Users)
- **D-09:** Tests nutzen die gleichen Credentials wie Integration-Tests (testpasswort123)

### Playwright-Konfiguration
- **D-10:** Playwright mit Chromium only (kein Firefox/WebKit noetig fuer Ionic-App)
- **D-11:** baseURL zeigt auf localhost wo der Test-Stack laeuft

### Claude's Discretion
- Docker-Compose Konfiguration (Ports, Netzwerk, Health-Checks)
- Playwright Config-Details (timeouts, retries, screenshots)
- Test-Helper-Abstraktion (Page Objects vs. direkte Selektoren)

</decisions>

<canonical_refs>
## Canonical References

### Docker-Konfiguration
- `backend/Dockerfile` — Backend Docker Build
- `frontend/Dockerfile` — Frontend Docker Build (falls vorhanden)
- `backend/docker-compose.test.yml` — Referenz fuer PostgreSQL-Config

### Test-Infrastruktur
- `backend/tests/helpers/seed.js` — Seed-Daten und User-Credentials
- `backend/createApp.js` — Express-App Factory

### CI-Integration
- `.github/workflows/ci.yml` — CI Pipeline (E2E als zusaetzlicher Job moeglich)

### Research
- Playwright kann KEINE nativen Ionic/Capacitor Apps testen (nur Web-Version)
- Frontend muss als Web-App erreichbar sein (nicht als native App)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Seed-Daten mit bekannten Credentials (konfi1/testpasswort123, admin1/testpasswort123)
- Docker-Compose Pattern aus docker-compose.test.yml

### Integration Points
- Frontend Dev-Server auf localhost:5173 oder Build-Output auf eigenem Port
- Backend auf localhost:5000 (oder konfigurierbarer Port)
- PostgreSQL fuer Backend

</code_context>

<specifics>
## Specific Ideas

- Playwright laeuft nur lokal/manuell, NICHT in CI (zu komplex fuer erste Iteration)
- E2E Tests als npm Script: npm run test:e2e
- Docker-Compose Stack startet/stoppt automatisch via Playwright globalSetup/globalTeardown

</specifics>

<deferred>
## Deferred Ideas

- E2E in CI integrieren (GitHub Actions mit Playwright Container) — nach v2.9 evaluieren
- Visual Regression Tests — Out of Scope per REQUIREMENTS.md

</deferred>

---

*Phase: 107-e2e-tests-mit-playwright*
*Context gathered: 2026-03-28*
