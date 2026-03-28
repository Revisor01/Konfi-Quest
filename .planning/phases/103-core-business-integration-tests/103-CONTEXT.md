# Phase 103: Core Business Integration Tests - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-generated (discuss auto — pure test/infrastructure phase)

<domain>
## Phase Boundary

Die fuenf geschaeftskritischen Route-Gruppen (Activities, Events, Konfi, Chat, Badges) sind mit Integration-Tests abgesichert. Tests nutzen echte PostgreSQL Test-DB und echte JWT-Tokens.

</domain>

<decisions>
## Implementation Decisions

### Test-Strategie
- **D-01:** Tests nutzen bestehende Test-Infrastruktur aus Phase 101 (getTestApp, getTestPool, truncateAll, seed, generateToken)
- **D-02:** RBAC wird NIEMALS gemockt — echte JWT-Tokens + echte Middleware + echte DB-Lookups
- **D-03:** Jeder Test-File nutzt beforeEach mit truncateAll + seed fuer saubere Isolation
- **D-04:** Tests pruefen HTTP Status-Codes UND Response-Body-Struktur

### Activities-Tests (BIT-03)
- **D-05:** CRUD-Operationen: Erstellen, Lesen, Aktualisieren, Loeschen von Aktivitaeten
- **D-06:** Punkte-Vergabe an Konfis pruefen (konfi_profiles.gottesdienst_points/gemeinde_points aktualisiert)
- **D-07:** Kategorie-Filterung testen

### Events-Tests (BIT-04)
- **D-08:** Event-Erstellen, Buchen, Timeslot-Kapazitaet
- **D-09:** Warteliste-Nachruecken und Pflicht-Event-Absage (Opt-out)

### Konfi-Tests (BIT-05)
- **D-10:** Profil-Abruf, Punkte-History, Dashboard-Daten-Aggregation

### Chat-Tests (BIT-06)
- **D-11:** Raum-Erstellung, Nachrichten-CRUD, Teilnehmer-Verwaltung
- **D-12:** Datei-Endpoints (ohne echten Upload — supertest file mock)

### Badge-Tests (BIT-07)
- **D-13:** Manuelle Vergabe, Level-Zuordnung
- **D-14:** Auto-Award-Trigger und Progress-Berechnung

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
- `backend/tests/vitest.config.ts` — Vitest-Config

### Bestehende Tests (Phase 102 Referenz)
- `backend/tests/routes/auth.test.js` — Auth-Lifecycle Test-Pattern
- `backend/tests/routes/rbac.test.js` — RBAC-Matrix Test-Pattern
- `backend/tests/routes/smoke.test.js` — Basis-Pattern

### Zu testende Routes
- `backend/routes/activities.js` — Activities CRUD + Punkte-Vergabe
- `backend/routes/events.js` — Events + Buchung + Timeslots + Warteliste
- `backend/routes/konfi.js` — Konfi-Profil + Dashboard + History
- `backend/routes/chat.js` — Chat-Raeume + Nachrichten + Teilnehmer
- `backend/routes/badges.js` — Badges + Levels + Auto-Award

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- getTestApp(db), generateToken(userKey), truncateAll(db), seed(db) — komplette Test-Infrastruktur
- Bestehende Test-Patterns aus auth.test.js und rbac.test.js

### Established Patterns
- beforeAll: getTestPool + getTestApp
- beforeEach: truncateAll + seed
- afterAll: closePool
- supertest(app).get/post/put/delete mit .set('Authorization', `Bearer ${token}`)

### Integration Points
- Activities: POST /api/admin/activities, GET /api/admin/activities, Punkte an konfi_profiles
- Events: POST /api/admin/events, POST /api/events/:id/book, Timeslots, Warteliste
- Konfi: GET /api/konfi/dashboard, GET /api/konfi/profile, GET /api/konfi/points-history
- Chat: POST /api/chat/rooms, POST /api/chat/rooms/:id/messages, GET /api/chat/rooms
- Badges: POST /api/admin/badges, GET /api/admin/badges, checkAndAwardBadges

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

*Phase: 103-core-business-integration-tests*
*Context gathered: 2026-03-28*
