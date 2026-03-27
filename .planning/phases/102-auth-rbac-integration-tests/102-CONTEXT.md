# Phase 102: Auth + RBAC Integration Tests - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning
**Mode:** Auto-generated (discuss auto — pure test/infrastructure phase)

<domain>
## Phase Boundary

Authentifizierung und Autorisierung sind lueckenlos getestet — kein Login-Bug, kein Cross-Org-Zugriff, kein Rollen-Bypass geht unbemerkt durch. Tests nutzen echte PostgreSQL Test-DB und echte JWT-Tokens (nie gemockt).

</domain>

<decisions>
## Implementation Decisions

### Test-Strategie
- **D-01:** Tests nutzen die bestehende Test-Infrastruktur aus Phase 101 (getTestApp, getTestPool, truncateAll, seed, generateToken)
- **D-02:** RBAC wird NIEMALS gemockt — echte JWT-Tokens + echte Middleware + echte DB-Lookups (per D-10 aus Phase 101)
- **D-03:** Jeder Test-File nutzt beforeEach mit truncateAll + seed fuer saubere Isolation
- **D-04:** Tests pruefen HTTP Status-Codes UND Response-Body-Struktur

### Auth-Lifecycle Tests
- **D-05:** Login mit korrekten/falschen Credentials, gesperrtem User, fehlendem User
- **D-06:** Token-Refresh mit gueltigem/abgelaufenem/revoked Refresh-Token
- **D-07:** Logout mit Token-Revoke (POST /api/auth/logout)

### RBAC-Matrix Tests
- **D-08:** Fuer jeden geschuetzten Endpoint alle 5 Rollen testen — unberechtigte Zugriffe muessen 403 erhalten
- **D-09:** Tabelle: konfi darf /api/konfi/* aber nicht /api/admin/*, admin darf /api/admin/* aber nicht /api/konfi/*, etc.

### Cross-Org-Isolation Tests
- **D-10:** Admin von Org A kann keine Daten von Org B lesen (GET) oder aendern (PUT/DELETE)
- **D-11:** Konfi von Org A kann nur eigene Org-Daten sehen

### Claude's Discretion
Alle technischen Implementierungsdetails (Test-Gruppierung, Describe-Block-Struktur, Helper-Extraktion) liegen bei Claude.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Test-Infrastruktur (Phase 101)
- `backend/createApp.js` — Express-App Factory
- `backend/tests/helpers/testApp.js` — getTestApp(db) Wrapper
- `backend/tests/helpers/db.js` — getTestPool, truncateAll, closePool
- `backend/tests/helpers/seed.js` — seed(), USERS, PASSWORD, ORGS, ROLES
- `backend/tests/helpers/auth.js` — generateToken, getAllTokens
- `backend/tests/vitest.config.ts` — Vitest-Config mit ENV-Variablen

### Zu testende Routes
- `backend/routes/auth.js` — Login, Register, Token-Refresh, Logout
- `backend/middleware/rbac.js` — verifyTokenRBAC, Role-Helpers

### Phase 101 Referenz
- `.planning/phases/101-test-infrastruktur-server-js-refactoring/101-CONTEXT.md` — Architektur-Entscheidungen
- `.planning/phases/101-test-infrastruktur-server-js-refactoring/101-02-SUMMARY.md` — Seed-Daten Details

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- getTestApp(db) — supertest-faehige Express-App
- generateToken(userKey) — JWT fuer beliebige Seed-User
- getAllTokens() — Tokens fuer alle 10 Seed-User
- truncateAll(db) — TRUNCATE CASCADE fuer Test-Isolation
- seed(db) — 2 Orgs, 10 Users, alle Rollen

### Established Patterns
- Smoke-Test Pattern aus 101-03: beforeAll/beforeEach/afterAll mit getTestPool/truncateAll/seed/closePool
- supertest(app).get/post mit .set('Authorization', `Bearer ${token}`)

### Integration Points
- Auth-Routes: POST /api/auth/login, POST /api/auth/register, POST /api/auth/refresh, POST /api/auth/logout
- RBAC-Middleware auf allen /api/admin/*, /api/konfi/*, /api/teamer/* Routes

</code_context>

<specifics>
## Specific Ideas

No specific requirements — pure test phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped (auto mode, infrastructure phase).

</deferred>

---

*Phase: 102-auth-rbac-integration-tests*
*Context gathered: 2026-03-27*
