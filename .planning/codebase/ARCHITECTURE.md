<!-- refreshed: 2026-06-09 -->
# Architecture

**Analysis Date:** 2026-06-09

## System Overview

Konfi Quest is a multi-tenant church confirmation-class management app. A single Ionic 8 / React 19 frontend (deployed as native iOS + Android via Capacitor and as a web build) talks to one Node.js / Express 5 backend over a JSON REST API plus a Socket.IO realtime channel. All persistent state lives in a single PostgreSQL database with row-level tenant isolation via `organization_id`.

```text
┌─────────────────────────────────────────────────────────────┐
│   CLIENTS (one React 19 + Ionic 8 codebase)                  │
├──────────────────┬──────────────────┬───────────────────────┤
│   iOS (Capacitor)│ Android(Capacitor)│   Web (nginx/dist)   │
│  `frontend/ios`  │ `frontend/android`│   `frontend/dist`    │
└────────┬─────────┴────────┬─────────┴──────────┬────────────┘
         │ REST (axios) + Socket.IO (websocket.ts)             │
         ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│   FRONTEND CORE                                              │
│   api.ts (axios + JWT refresh interceptor) `src/services`   │
│   Contexts: AppContext / BadgeContext / LiveUpdateContext   │
│   Offline layer: useOfflineQuery + writeQueue + offlineCache│
└────────┬────────────────────────────────────────────────────┘
         │ HTTPS (Traefik → Apache vHost → Express)
         ▼
┌─────────────────────────────────────────────────────────────┐
│   BACKEND (Express 5)                                        │
│   server.js (prod wrapper) → createApp.js (route factory)   │
│   Middleware: rbac.js (verifyTokenRBAC, requireRole...)     │
│   18 route modules `backend/routes/*.js`                    │
│   Services: push / email / background(cron) / losung        │
│   Socket.IO server (org-isolated chat) in server.js         │
└────────┬───────────────────────────────────┬────────────────┘
         │ pg Pool (database.js)             │ Firebase Admin
         ▼                                   ▼
┌──────────────────────────────┐   ┌─────────────────────────┐
│   PostgreSQL 15              │   │   FCM (push notifications)│
│   ~50 tables, organization_id│   │   `backend/push/firebase`│
│   isolation, schema_migrations│  └─────────────────────────┘
└──────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Express app factory | Wires middleware + mounts all 18 routers, no side effects (used by tests) | `backend/createApp.js` |
| Production wrapper | http.Server + Socket.IO + SMTP + cron + Firebase bootstrap | `backend/server.js` |
| RBAC middleware | JWT verification, role gating, jahrgang + org access | `backend/middleware/rbac.js` |
| DB pool + migrations | pg Pool, idempotent file-based migration runner | `backend/database.js` |
| Push service | FCM token registration + send | `backend/services/pushService.js` |
| Background jobs | node-cron: badges, auto-deletion, trial-expiry, license-reminder, wrapped | `backend/services/backgroundService.js` |
| API client | axios instance + request/response interceptors (JWT refresh) | `frontend/src/services/api.ts` |
| Auth state | global user/session context | `frontend/src/contexts/AppContext.tsx` |
| Token store | sync memory getter + async Preferences persistence | `frontend/src/services/tokenStore.ts` |
| Offline query | SWR-style read cache hook (all ~30 pages) | `frontend/src/hooks/useOfflineQuery.ts` |
| Write queue | FIFO persistent queue for offline mutations | `frontend/src/services/writeQueue.ts` |
| Tab navigation | Role-based tab routing for 5 roles | `frontend/src/components/layout/MainTabs.tsx` |

## Pattern Overview

**Overall:** Layered REST monolith (backend) + offline-first SPA (frontend), single-database multi-tenant.

**Key Characteristics:**
- Route modules are factory functions: `module.exports = (db, rbacVerifier, roleHelpers, ...) => router`. Dependencies (db, io, upload handlers) are injected by `createApp.js`, enabling test isolation with a throwaway PostgreSQL.
- `createApp.js` is pure (no `listen`, no Socket.IO, no cron); `server.js` adds all side effects. Tests run `createApp(testDb)` against supertest.
- RBAC is role-based, not permission-granular. Five roles in a hierarchy gate every route.
- Multi-tenancy via `organization_id` filter on every tenant-scoped query (enforced in route handlers and Socket.IO room joins).
- Frontend is offline-first: reads via SWR cache, writes via persistent FIFO queue replayed on reconnect.

## Layers

**Frontend presentation (`frontend/src/components`):**
- Purpose: role-specific UI (konfi / teamer / admin / shared / auth / chat / wrapped)
- Pattern: each role has `pages/` (route targets) and `views/` (composable sections), plus `modals/`
- Depends on: contexts, services, hooks

**Frontend service layer (`frontend/src/services`):**
- Purpose: API access, token storage, websocket, offline cache, write queue, network monitor
- `api.ts` is the single axios instance every feature imports

**Backend routing layer (`backend/routes`):**
- Purpose: HTTP endpoints, request validation, business logic, SQL
- 18 modules mounted under `/api/*` by `createApp.js`

**Backend middleware (`backend/middleware`):**
- `rbac.js` (auth + authorization), `validation.js`, `uploadValidation.js`

**Backend services + utils (`backend/services`, `backend/utils`):**
- Cross-route logic: push, email, cron jobs, booking/limit/streak/deletion helpers, role hierarchy

**Data layer (`backend/database.js` + PostgreSQL):**
- `query()` for normal access, `getClient()` for BEGIN/COMMIT transactions

## Data Flow

### Primary Request Path (authenticated REST call)

1. Component calls a service that uses the shared axios instance (`frontend/src/services/api.ts:9`).
2. Request interceptor attaches `Authorization: Bearer <access-token>` from tokenStore (`api.ts:34`).
3. Request hits Traefik → Apache vHost (sets CORS) → Express (`createApp.js` `trust proxy`).
4. `verifyTokenRBAC(db)` middleware decodes JWT, loads user + role + org into `req.user` (`backend/middleware/rbac.js:54`, LRU-cached).
5. Role guard runs: `requireSuperAdmin` / `requireOrgAdmin` / `requireAdmin` / `requireTeamer` and/or `checkJahrgangAccess` / `requireSameOrganization` (`rbac.js:184-339`).
6. Route handler executes SQL via `db.query()` / `db.getClient()`, always filtering by `req.user.organization_id`.
7. JSON response returns; on `401` the response interceptor refreshes the token and replays the request (`api.ts:56`).

### Token Refresh Flow

1. Any response with `401` (not itself a `/refresh` call) triggers refresh (`api.ts:61`).
2. If a refresh is already in flight, the request subscribes and waits (`api.ts:89`).
3. Otherwise `POST /api/auth/refresh` with the 90-day rotating refresh token (`api.ts:102`).
4. New access + refresh tokens stored; queued requests replayed with the new bearer (`api.ts:106-114`).
5. On refresh failure, `auth:relogin-required` event fires; `App.tsx` sets `session_expired` and redirects to login.

### Realtime Chat Flow (Socket.IO)

1. Client connects with JWT in `socket.handshake.auth.token` (`backend/server.js:56`).
2. Auth middleware decodes token, joins personal room `user_<type>_<id>` (`server.js:74`).
3. `joinRoom` verifies the room's `organization_id` matches the user's org before joining `room_<id>` (`server.js:78-98`) — org isolation enforced server-side.
4. Messages persist via `/api/chat` routes (`backend/routes/chat.js`) and broadcast to the room; push fired for offline members.

### Offline Read/Write Flow

1. Reads go through `useOfflineQuery` (SWR): cache-first, revalidate on focus/reconnect (`frontend/src/hooks/useOfflineQuery.ts`).
2. Cache persisted in `offlineCache.ts`; network state from `networkMonitor.ts`.
3. Writes while offline append to `writeQueue.ts` (persistent FIFO) and replay in order on reconnect.

**State Management:**
- React Context only — `AppContext` (user/session), `BadgeContext` (unread/pending counts), `LiveUpdateContext` (Capacitor live updates). No Redux.

## Key Abstractions

**Route factory:**
- Purpose: dependency-injected Express router
- Examples: `backend/routes/auth.js`, `backend/routes/events.js`, `backend/routes/chat.js`
- Pattern: `(db, rbacVerifier, roleHelpers, ...extras) => express.Router()`

**RBAC verifier + guards:**
- Purpose: single auth/authorization surface
- Examples: `verifyTokenRBAC`, `requireRole`, `checkJahrgangAccess`, `requireSameOrganization` (`backend/middleware/rbac.js`)

**Offline query hook:**
- Purpose: uniform resilient data fetching across all pages
- Examples: every `*Page.tsx` uses `useOfflineQuery`

## Entry Points

**Backend production:**
- Location: `backend/server.js`
- Triggers: `npm start` / Docker CMD
- Responsibilities: create http.Server, Socket.IO, SMTP transporter, Firebase, cron tasks, then `createApp(db, options)` and `listen`

**Backend test app:**
- Location: `backend/createApp.js`
- Triggers: supertest in `backend/tests`
- Responsibilities: pure Express app with injected dummies

**Frontend:**
- Location: `frontend/src/main.tsx` → `App.tsx`
- Triggers: Vite build / Capacitor WebView load
- Responsibilities: provider tree (`AppProvider` → `BadgeProvider` → `LiveUpdateProvider` → `ErrorBoundary`), route to `LoginView` (unauthenticated) or `MainTabs` (authenticated)

## RBAC & Multi-Tenancy

**Roles (hierarchy, `backend/middleware/rbac.js`, `backend/utils/roleHierarchy.js`):**
- `super_admin` — organization management only (cross-org), NO jahrgang data access. Granted via `super_admin` role OR `is_super_admin` flag on an `org_admin` (`rbac.js:207-219`).
- `org_admin` — full access within own organization incl. user management.
- `admin` — like org_admin but without user management (konfis, requests, badges, etc.).
- `teamer` — events + awarding points; restricted to assigned jahrgaenge via `checkJahrgangAccess`.
- `konfi` — own profile, activities, events, badges, chat.

**Guards:** `requireSuperAdmin`, `requireOrgAdmin = requireRole('org_admin')`, `requireAdmin = requireRole('org_admin','admin')`, `requireTeamer = requireRole('org_admin','admin','teamer')` (`rbac.js:220-222`).

**Tenant isolation:** every tenant-scoped table carries `organization_id`; route handlers filter by `req.user.organization_id`, and Socket.IO enforces the same on room joins/typing. `requireSameOrganization` blocks cross-org references. `MainTabs.tsx` renders a reduced super-admin navigation when `user.role_name === 'super_admin'`.

## Background Jobs (node-cron, Europe/Berlin)

Registered in `backend/services/backgroundService.js`, started by `server.js`:
- Badge evaluation — recurring (custom_badges → user_badges)
- Wrapped generation — `0 6 1 * *` (`backgroundService.js:409`)
- Auto-deletion (DSGVO/DSG-EKD soft+hard) — `0 2 * * *` (`backgroundService.js:510`)
- Trial-expiry — `0 3 * * *` (`backgroundService.js:545`)
- License-reminder — runs in the 03:00 task (`backgroundService.js:554`)

## Architectural Constraints

- **Threading:** single-threaded Node event loop; cron tasks run in-process. No worker threads.
- **Single database:** all tenants share one PostgreSQL instance; isolation is application-enforced via `organization_id`, not schema/DB separation.
- **CORS:** set by the Apache vHost, NOT Express — adding CORS middleware would emit duplicate `Access-Control-Allow-Origin` and break WebView requests (`createApp.js` security section).
- **CSP/HSTS:** CSP disabled (Ionic inline styles); HSTS set by Apache/KeyHelp, not helmet.
- **Express 5 body default:** middleware in `createApp.js` defaults `req.body` to `{}` (Express 5 leaves it `undefined`), so `const { x } = req.body` destructures don't crash.
- **Transactions:** must use `db.getClient()` (same connection) — `db.query()` may use different pooled connections.

## Anti-Patterns

### `<IonModal isOpen={state}>`

**What happens:** Declarative modal open state instead of the hook API.
**Why it's wrong:** Breaks iOS card presentation and lifecycle; project convention forbids it (CLAUDE.md).
**Do this instead:** Use `useIonModal(Component, props)` and call `present()/dismiss()`.

### Double-counting bonus points

**What happens:** Adding `bonus_points` rows AND `konfi_profiles` accumulated totals when displaying.
**Why it's wrong:** Bonus points are stored in both places by design; summing both double-counts.
**Do this instead:** Display the accumulated total in `konfi_profiles` only.

### Self-filter on chat participants by `user_type`

**What happens:** Filtering "self" with `p.user_id===id && p.user_type===type`.
**Why it's wrong:** A user's own `type` may be `teamer` while participants only store `admin`/`konfi`, so self isn't filtered and the wrong color shows.
**Do this instead:** Filter by `p.user_id !== user.id` only (fixed in ChatOverview/ChatRoom).

## Error Handling

**Strategy:** route-level try/catch returning JSON error + status; frontend axios interceptors translate `401` (refresh) and `429` (rate-limit alert via `rate-limit` window event).

**Patterns:**
- `ErrorBoundary` wraps the app (`frontend/src/components/common/ErrorBoundary.tsx`).
- DB transactions roll back on error and always `client.release()`.

## Cross-Cutting Concerns

**Logging:** `console` on backend; Socket.IO engine connection errors warned.
**Validation:** `backend/middleware/validation.js`, `uploadValidation.js` (magic-bytes upload check).
**Authentication:** JWT access (~15 min) + rotating refresh (~90 d, soft-revoke) via `backend/routes/auth.js`; verified by `verifyTokenRBAC` (LRU-cached).
**Security headers:** helmet (CSP off) in `createApp.js`; rate limiters injected by `server.js`.

---

*Architecture analysis: 2026-06-09*
