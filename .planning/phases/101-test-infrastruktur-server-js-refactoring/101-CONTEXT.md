# Phase 101: Test-Infrastruktur + server.js Refactoring - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend testbar machen: server.js als createApp-Factory refactoren, Test-DB Lifecycle aufsetzen, Seed-Fixtures erstellen, Vitest Backend-Config einrichten, Auth-Test-Helpers bauen. Danach kann `npm test` einen Smoke-Test gegen echte PostgreSQL ausfuehren.

</domain>

<decisions>
## Implementation Decisions

### DB-Isolation
- **D-01:** TRUNCATE CASCADE vor jedem Test. Kein Transaction-Rollback (Routes nutzen intern BEGIN/COMMIT in activities, events, konfi-management, badges). ~5ms pro Cleanup ist akzeptabel.
- **D-02:** Vitest laeuft sequentiell fuer Backend-Tests (kein `--parallel`). Verhindert DB-Races.

### DB-Lifecycle
- **D-03:** Docker Container via docker-compose.test.yml (postgres:16-alpine). Lokal und in CI identisch.
- **D-04:** `npm test` startet Container automatisch (oder nutzt laufenden). In CI: GitHub Actions Service Container.

### Seed-Strategie
- **D-05:** Realistischer Seed mit ~100 Datensaetzen:
  - 2 Organisationen (Multi-Tenant-Isolation testbar)
  - Alle 5 RBAC-Rollen (Konfi, Teamer, Admin, Orgadmin, Superadmin) pro Org
  - Je 2-3 Konfis und Teamer pro Org
  - Beispiel-Events (mit Timeslots, Warteliste)
  - Beispiel-Activities (Gottesdienst + Gemeinde Kategorien)
  - Badges: Alle Vergabe-Typen (streak, kategorie-basiert, zeit-basiert, jahres-basiert)
  - Levels mit Schwellenwerten
  - Zertifikate/Lizenzen
  - Bonus-Punkte Eintraege
  - Chat-Raeume (jahrgang, direct, group, admin)
- **D-06:** Seed als JavaScript-Modul (nicht SQL) — kann von Tests importiert werden um IDs/Tokens zu referenzieren.

### server.js Refactoring
- **D-07:** createApp Factory-Pattern: `createApp(db, options)` exportiert Express-App OHNE Seiteneffekte (kein listen(), kein Socket.IO, kein SMTP, kein Cron, kein Firebase).
- **D-08:** server.js ruft `createApp()` auf und startet Server + Socket.IO + Cron. Produktions-Verhalten aendert sich NICHT.
- **D-09:** Tests rufen `createApp(testDb)` auf und bekommen saubere Express-App fuer supertest.

### Auth-Test-Helpers
- **D-10:** Helper generiert echte JWTs fuer alle 5 Rollen + beide Orgs. RBAC wird NIEMALS gemockt — echte Middleware, echte Tokens.

### Claude's Discretion
- Vitest Config Details (vitest.config.backend.ts Setup)
- TRUNCATE-Reihenfolge (FK-Constraints beachten)
- Ob globalSetup/globalTeardown oder beforeAll/afterAll in Testdateien

</decisions>

<canonical_refs>
## Canonical References

### Backend-Architektur
- `backend/server.js` — Monolithisches Serverfile, muss zu createApp-Factory refactored werden
- `backend/database.js` — Pool-Config + Migration-Runner (runMigrations)
- `backend/middleware/rbac.js` — verifyTokenRBAC mit LRU-Cache

### Route-Factory-Pattern
- `backend/routes/auth.js` — Beispiel: `module.exports = (db, verifyToken, transporter, SMTP_CONFIG, rateLimiters, rbacVerifier)`
- `backend/routes/*.js` — Alle 18 Routes nutzen Factory-DI-Pattern

### Research
- `.planning/research/ARCHITECTURE.md` — Test-Architektur, createTestApp Pattern, Mock-Matrix
- `.planning/research/PITFALLS.md` — server.js Refactoring Risiken, DB-Isolation Pitfalls
- `.planning/research/STACK.md` — Vitest 4.1 + supertest 7.2 Empfehlung

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/database.js` Pool + runMigrations — kann fuer Test-DB wiederverwendet werden
- `backend/migrations/*.sql` — Vollstaendiges Schema, laeuft via runMigrations
- `backend/init-scripts/` — Initiale DB-Struktur (falls vorhanden)

### Established Patterns
- Factory-DI: Jede Route exportiert `module.exports = (db, verifyToken, ...)` — createTestApp kann alle Routes mit Test-DB verdrahten
- JWT: `jwt.sign({ id, type, organization_id, role_id }, JWT_SECRET)` — Auth-Helper kann gleiche Struktur nutzen

### Integration Points
- server.js Zeile 21-52: App + Server + Socket.IO Setup — muss in createApp extrahiert werden
- server.js Zeile 425-445: Route-Registrierung — muss in createApp wandern
- package.json: `"test"` Script fehlt noch

</code_context>

<specifics>
## Specific Ideas

- Seed muss Badge-Vergabe-Typen abdecken: streak, kategorie-basiert, zeit-basiert, jahres-basiert
- Levels mit realistischen Schwellenwerten im Seed
- Zertifikate/Lizenzen muessen im Seed enthalten sein

</specifics>

<deferred>
## Deferred Ideas

Keine — alle Punkte sind Phase-relevant.

</deferred>
