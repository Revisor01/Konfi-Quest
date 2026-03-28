# Phase 105: CI/CD Pipeline - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Tests laufen automatisch bei jedem Push auf main und blockieren Deployments bei Fehlern. Der bestehende backend.yml Workflow wird zu ci.yml erweitert mit Test-Jobs als Gate vor Build+Deploy.

</domain>

<decisions>
## Implementation Decisions

### Workflow-Architektur
- **D-01:** backend.yml wird zu ci.yml umbenannt — deckt jetzt Tests + Build + Deploy ab
- **D-02:** frontend.yml bleibt unveraendert (nur workflow_dispatch fuer manuelles Frontend-Deploy)
- **D-03:** Drei Jobs: backend-test, frontend-test (parallel), dann build-and-push (needs: [backend-test, frontend-test])
- **D-04:** build-and-push Job bleibt identisch zum bisherigen (GHCR Push + Portainer Webhook)

### Test-als-Deploy-Gate
- **D-05:** backend-test Job laeuft VOR build-and-push (needs-Dependency)
- **D-06:** frontend-test Job laeuft parallel zu backend-test, ebenfalls als Gate
- **D-07:** Build+Deploy wird NUR ausgefuehrt wenn BEIDE Test-Jobs gruen sind

### PostgreSQL in CI
- **D-08:** GitHub Service Container (postgres:16-alpine) statt docker-compose
- **D-09:** Service Container auf Standard-Port 5432 (nicht 5433 wie lokal)
- **D-10:** ENV-Variablen fuer Test-Job: TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres, JWT_SECRET=test-secret-ci, NODE_ENV=test

### npm audit Strategie
- **D-11:** npm audit --audit-level=critical — nur Critical blockiert den Build
- **D-12:** High/Moderate/Low werden geloggt aber blockieren nicht (continue-on-error oder separate Step)

### Frontend-Tests in CI
- **D-13:** Frontend-Test als eigener Job in ci.yml (parallel zum Backend-Test)
- **D-14:** cd frontend && npm ci && npm run test (Vitest)

### Claude's Discretion
- Caching-Strategie (Node modules cachen oder nicht)
- Workflow trigger paths (nur backend/** oder auch root-Dateien)
- Timeout-Werte fuer Test-Jobs

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bestehende Workflows
- `.github/workflows/backend.yml` — Aktueller Build+Deploy Workflow (wird zu ci.yml)
- `.github/workflows/frontend.yml` — Frontend Build (bleibt unveraendert)

### Test-Konfiguration
- `backend/tests/vitest.config.ts` — Vitest-Config mit ENV-Variablen
- `backend/package.json` — test und test:ci Scripts
- `backend/docker-compose.test.yml` — Lokale Test-DB (nicht fuer CI, nur Referenz)

### Secrets (bereits konfiguriert)
- `GITHUB_TOKEN` — Automatisch von GitHub Actions bereitgestellt
- `PORTAINER_WEBHOOK` — Bereits als Repository Secret konfiguriert

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- backend.yml hat bereits funktionierende Build+Push+Deploy Pipeline
- npm run test:ci fuehrt Vitest ohne Docker aus (erwartet laufende PostgreSQL)
- Docker Buildx mit GHA Cache bereits konfiguriert

### Established Patterns
- GHCR (ghcr.io) als Container Registry
- Portainer Webhook fuer Auto-Deploy nach Push
- Docker metadata-action fuer Tags (latest + SHA)

### Integration Points
- ci.yml ersetzt backend.yml — gleicher Trigger (push auf main, paths backend/**)
- Trigger-Paths muessen um .github/workflows/ci.yml und ggf. frontend/** erweitert werden
- PostgreSQL Service Container statt docker-compose.test.yml in CI

</code_context>

<specifics>
## Specific Ideas

- TEST_DATABASE_URL muss auf Port 5432 gesetzt werden (GitHub Service Container Standard-Port, nicht 5433 wie lokal)
- globalSetup.js liest TEST_DATABASE_URL als Fallback — in CI muss diese ENV gesetzt sein
- Vitest Config setzt JWT_SECRET bereits als test-secret-key-for-vitest — CI kann gleichen Wert nutzen

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 105-ci-cd-pipeline*
*Context gathered: 2026-03-28*
