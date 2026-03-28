# Phase 104: Remaining Routes Integration Tests - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-generated (discuss auto — pure test/infrastructure phase)

<domain>
## Phase Boundary

Alle verbleibenden Backend-Routes haben Integration-Tests — die gesamte API ist abgesichert. Tests fuer: categories, jahrgaenge, levels, notifications, organizations, roles, settings, users, bonus, material, teamer, wrapped.

</domain>

<decisions>
## Implementation Decisions

### Test-Strategie
- **D-01:** Tests nutzen bestehende Test-Infrastruktur aus Phase 101
- **D-02:** RBAC wird NIEMALS gemockt — echte JWT-Tokens + echte Middleware
- **D-03:** Jeder Test-File nutzt beforeEach mit truncateAll + seed
- **D-04:** Jeder Test prueft mindestens Happy-Path (200) und einen Fehlerfall (401/403/404)

### Route-Gruppierung
- **D-05:** Categories, Jahrgaenge, Levels als eine Gruppe (CRUD-Pattern aehnlich)
- **D-06:** Notifications, Organizations, Roles als eine Gruppe (Admin-Verwaltung)
- **D-07:** Settings, Users als eine Gruppe (System-Verwaltung)
- **D-08:** Bonus, Material, Teamer, Wrapped als eine Gruppe (Feature-Routes)

### Claude's Discretion
Alle technischen Implementierungsdetails liegen bei Claude. Gruppierung der Tests in Plans nach eigenem Ermessen.

</decisions>

<canonical_refs>
## Canonical References

### Test-Infrastruktur (Phase 101)
- `backend/tests/helpers/testApp.js` — getTestApp(db) Wrapper
- `backend/tests/helpers/db.js` — getTestPool, truncateAll, closePool
- `backend/tests/helpers/seed.js` — seed(), USERS, PASSWORD
- `backend/tests/helpers/auth.js` — generateToken, getAllTokens

### Bestehende Tests (Phase 102-103 Referenz)
- `backend/tests/routes/auth.test.js` — Auth-Test-Pattern
- `backend/tests/routes/activities.test.js` — CRUD-Test-Pattern
- `backend/tests/routes/events.test.js` — Complex-Route-Pattern

### Zu testende Routes
- `backend/routes/categories.js` — Kategorien CRUD
- `backend/routes/jahrgaenge.js` — Jahrgaenge CRUD
- `backend/routes/levels.js` — Levels CRUD
- `backend/routes/notifications.js` — Push-Notifications
- `backend/routes/organizations.js` — Org-Verwaltung
- `backend/routes/roles.js` — Rollen-Verwaltung
- `backend/routes/settings.js` — Settings KV-Store
- `backend/routes/users.js` — User-Verwaltung
- `backend/routes/bonus.js` — Bonus-Punkte (falls existiert, sonst in konfi-management)
- `backend/routes/material.js` — Material-Upload
- `backend/routes/teamer.js` — Teamer-Dashboard
- `backend/routes/wrapped.js` — Wrapped-Daten

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Komplette Test-Infrastruktur aus Phase 101
- Test-Patterns aus Phase 102-103 (auth, activities, events, konfi, chat, badges)

### Established Patterns
- beforeAll/beforeEach/afterAll mit getTestPool/truncateAll/seed/closePool
- supertest(app) mit Authorization Bearer Token

</code_context>

<specifics>
## Specific Ideas

No specific requirements — pure test phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>

---

*Phase: 104-remaining-routes-integration-tests*
*Context gathered: 2026-03-28*
