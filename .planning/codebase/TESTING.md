# Testing Patterns

**Analysis Date:** 2026-06-09

The codebase is well-tested. The full suite was established in milestone v2.9 (backend integration tests against real PostgreSQL, frontend unit tests, Playwright E2E, GitHub Actions CI as deploy-gate).

## Test Framework

**Runner:** `vitest` ^4.1.8 (both backend and frontend).

**Backend config:** `backend/tests/vitest.config.ts`
- `pool: 'forks'`, `maxWorkers: 1`, `minWorkers: 1` (single-worker — see Known Issues)
- `globals: true`, `globalSetup: ./tests/globalSetup.js`
- `include: ['tests/**/*.test.{js,ts}']`, `testTimeout: 10000`
- Injects `JWT_SECRET`, `QR_SECRET`, `NODE_ENV=test`, `TEST_DATABASE_URL`

**Frontend:** vitest with `jsdom`, `@testing-library/react` + `@testing-library/jest-dom` + `@testing-library/user-event`. CI runs `npx vitest run`.

**HTTP assertions (backend):** `supertest` ^7.2.2 against the in-process Express app.

**E2E:** `@playwright/test` ^1.58 (`/Users/simonluthe/Documents/Konfipoints/playwright.config.ts`). Legacy `cypress` ^15 is also configured in the frontend but the active E2E user-journeys are Playwright.

## Run Commands

```bash
# Backend — spins up disposable PostgreSQL via docker-compose then runs vitest
cd backend && npm test          # docker compose -f docker-compose.test.yml up -d --wait && vitest run; teardown
cd backend && npm run test:ci   # vitest only (CI provides postgres service)
cd backend && npm run test:watch

# Frontend
cd frontend && npx vitest run   # all unit tests
cd frontend && npm run test.unit

# E2E (Playwright, from repo root)
npm run test:e2e                # npx playwright test
```

## Test File Organization

**Backend** — `backend/tests/` (separate from source):
```
backend/tests/
├── vitest.config.ts
├── globalSetup.js        # creates konfi_test DB, applies schema/migrations
├── globalTeardown.js
├── helpers/
│   ├── db.js             # getTestPool(), truncateAll(), closePool()
│   ├── seed.js           # seed() + USERS/ACTIVITIES/CATEGORIES fixtures
│   ├── auth.js           # generateToken(userKey) / getAllTokens()
│   └── testApp.js        # getTestApp(db) -> createApp() wrapper
├── routes/               # one *.test.js per route (20 files)
├── services/             # autoDeletion.test.js
└── utils/                # konfiDeletion, konfiLimit, streakCalculation
```
Route suites: `activities, auth, badges, categories, chat, events, jahrgaenge, konfi-management, konfi, levels, material, notifications, organizations, rbac, roles, settings, smoke, teamer, users, wrapped` — every API route has integration coverage.

**Frontend** — co-located under `frontend/src/__tests__/`:
```
src/__tests__/
├── components/  # SectionHeader, ErrorBoundary, LoadingSpinner, ListSection, EmptyState
├── contexts/    # AppContext
├── hooks/       # useActionGuard, useOfflineQuery
└── services/    # writeQueue, networkMonitor, tokenStore, api
```
Capacitor plugins are stubbed in `frontend/src/__mocks__/@capacitor/`.

**E2E** — `e2e/` (repo root): `login.spec.ts`, `event-buchung.spec.ts`, `punkte-vergabe.spec.ts`, `chat.spec.ts` + `global-setup.ts` / `global-teardown.ts` / `helpers/`.

## Test Counts (approx)

- Backend: ~579 `it/test` cases across 23 files (integration + service + util).
- Frontend: ~80 `it/test` cases across 12 files.
- E2E: 4 Playwright user-journey specs.

## Test Structure (Backend)

Real DB, real RBAC, no mocking of auth. Standard suite shape (`backend/tests/routes/activities.test.js`):

```javascript
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ACTIVITIES, CATEGORIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Activities Routes', () => {
  let app, db, adminToken, teamerToken, konfiToken, admin2Token;

  beforeAll(async () => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => {
    await truncateAll(db);                  // TRUNCATE ... RESTART IDENTITY CASCADE
    await seed(db);                         // deterministic fixtures
    adminToken = generateToken('admin1');
    teamerToken = generateToken('teamer1');
    konfiToken = generateToken('konfi1');
    admin2Token = generateToken('admin2');  // second org for isolation tests
  });
  afterAll(async () => { await closePool(); });

  it('Konfi bekommt 403', async () => {
    const res = await request(app)
      .get('/api/admin/activities')
      .set('Authorization', `Bearer ${konfiToken}`);
    expect(res.status).toBe(403);
  });
});
```

**Conventions:**
- `truncateAll` then `seed` in `beforeEach` for a clean, deterministic state. `schema_migrations` is preserved.
- Test names are German and describe expected behavior.
- Every route is tested across roles (admin / teamer / konfi / second-org admin) AND for cross-org isolation — the dominant pattern given org-multitenancy.

## Fixtures and Factories

- **Seed:** `backend/tests/helpers/seed.js` exports `seed(db)` plus stable fixture maps (`USERS`, `ACTIVITIES`, `CATEGORIES`) used directly in assertions (e.g. `ACTIVITIES.sonntagsgottesdienst.id`).
- **Tokens:** `backend/tests/helpers/auth.js` — `generateToken(userKey, expiresIn='1h')` signs a production-shaped JWT (`id, type, display_name, organization_id, role_id`) for a seed user. Keys: `admin1`, `admin2`, `teamer1`, `konfi1`, `superAdmin`, etc.
- **App:** `getTestApp(db)` calls `createApp(db, { uploadsDir: <os.tmpdir> })` — no real `io`, `transporter`, or rate limiters (Dummies).

## Mocking Philosophy

- **RBAC is NEVER mocked** (per design decision D-10) — tokens carry real seeded user IDs; auth/permission logic is exercised end-to-end.
- **DB is NEVER mocked** — tests run against a real PostgreSQL instance (`konfi_test` database).
- Mocked only at the edges: `io`, mail `transporter`, rate limiters (Dummies in `createApp`); Capacitor plugins on the frontend (`src/__mocks__/`).

## Test Database

- `backend/tests/helpers/db.js` derives a dedicated `konfi_test` DB from `TEST_DATABASE_URL` (default local `postgresql://postgres:postgres@localhost:5433/postgres`).
- `npm test` provisions it via `backend/docker-compose.test.yml` (`up -d --wait`, teardown after).
- CI provides a `postgres:16-alpine` service container instead.

## CI/CD (Deploy Gate)

`/Users/simonluthe/Documents/Konfipoints/.github/workflows/ci.yml` — "CI Pipeline", Node 22, triggers on push to `main`, PRs to `main`, manual dispatch.

| Job | Does |
|-----|------|
| `backend-test` | postgres:16-alpine service; `npm ci`; `npm audit --audit-level=critical`; `npx vitest run --config tests/vitest.config.ts --passWithNoTests` (TEST_DATABASE_URL → service, JWT_SECRET=test-secret-ci) |
| `frontend-test` | `npm ci --legacy-peer-deps`; audit (non-blocking); `npx vitest run --passWithNoTests` |
| `build-and-push` | needs both test jobs; only on push to `main`; builds + pushes `ghcr.io` backend & frontend images (matrix), then triggers the Portainer webhook |

Tests gate the image build — green tests are required before deploy. A separate `frontend.yml` is manual-dispatch-only (image build, no tests).

## E2E (Playwright)

`playwright.config.ts`: `testDir: ./e2e`, `baseURL: http://localhost:5556`, `workers: 1` (sequential — shared DB), `retries: 1`, chromium only, screenshot/trace on failure, global setup/teardown. Covers core user journeys: login, event booking, point assignment, chat.

## Known Issues

- **Sporadic `deadlock detected` in `truncateAll`** during parallel multi-suite vitest runs. Backend config pins `maxWorkers: 1` to mitigate; running suites individually is reliably green. Root cause is teardown ordering, not feature code.
- **Pre-existing test-schema gap:** `events.cancelled_at` / `event_unregistrations` were missing from an older `globalSetup` snapshot — a schema-sync chore, unrelated to feature code.

---

*Testing analysis: 2026-06-09*
