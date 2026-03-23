# Architecture

**Analysis Date:** 2026-03-23

## Pattern Overview

**Overall:** Client-Server with Role-Based Access Control (RBAC) and Offline-First Frontend

**Key Characteristics:**
- Strict multi-tenancy via `organization_id` on every data resource
- Five-tier role hierarchy enforced at middleware level: `super_admin` > `org_admin` > `admin` > `teamer` > `konfi`
- Offline-First SWR pattern on all 30+ frontend pages via `useOfflineQuery`
- Real-time updates via Socket.IO with organization-isolated rooms
- Persistent write queue for offline mutations (FIFO, survives app restarts)

## Layers

**Backend: Route Layer:**
- Purpose: HTTP request handling, input validation, rate limiting
- Location: `backend/routes/`
- Contains: 19 route files (`.js`), each exports a factory function `(db, verifyTokenRBAC, roleHelpers, ...) => router`
- Depends on: middleware (rbac, validation), services, utils, database
- Used by: `backend/server.js` (mounted at `/api/*`)

**Backend: Middleware Layer:**
- Purpose: Authentication, authorization, input sanitization
- Location: `backend/middleware/rbac.js`, `backend/middleware/validation.js`
- Contains: `verifyTokenRBAC` (JWT decode + DB user lookup + jahrgang assignments), `requireRole`, `requireAdmin`, `requireTeamer`, `checkJahrgangAccess`, `filterByJahrgangAccess`
- Depends on: `backend/database.js`, `pg` pool, `jsonwebtoken`
- Used by: all route files via `server.js` dependency injection

**Backend: Service Layer:**
- Purpose: Cross-cutting business logic not tied to a single route
- Location: `backend/services/`
- Contains: `pushService.js` (FCM push notifications), `emailService.js` (SMTP via nodemailer), `backgroundService.js` (cron jobs: badge checks every 5 min, event reminders, wrapped generation, token cleanup)
- Depends on: `backend/database.js`
- Used by: route files, `server.js` (background services), `database.js` (on startup)

**Backend: Utils Layer:**
- Purpose: Shared helper functions
- Location: `backend/utils/`
- Contains: `liveUpdate.js` (Socket.IO emit wrappers), `chatUtils.js` (chat room initialization), `dateUtils.js`, `passwordUtils.js`, `pointTypeGuard.js`, `roleHierarchy.js`
- Depends on: `backend/database.js` (liveUpdate lazy-requires it)
- Used by: route files, `server.js`

**Backend: Database Layer:**
- Purpose: PostgreSQL connection pool and migration runner
- Location: `backend/database.js`
- Contains: `pg.Pool` wrapper exposing `query(text, params)` and `getClient()` for transactions; auto-runs SQL migrations from `backend/migrations/*.sql` on startup
- Depends on: `DATABASE_URL` env var
- Used by: all route files and services

**Frontend: Context Layer:**
- Purpose: Global application state shared across component tree
- Location: `frontend/src/contexts/`
- Contains: `AppContext.tsx` (user session, online status, push registration), `BadgeContext.tsx` (unread counts, pending requests), `LiveUpdateContext.tsx` (Socket.IO event routing to subscribers), `ModalContext.tsx` (modal stack management)
- Depends on: `services/tokenStore.ts`, `services/api.ts`, `services/websocket.ts`
- Used by: `frontend/src/App.tsx` (providers wrap entire tree), all page/view components

**Frontend: Services Layer:**
- Purpose: Data access abstractions and platform bridges
- Location: `frontend/src/services/`
- Contains: `api.ts` (axios instance with JWT interceptor, silent token refresh, retry), `tokenStore.ts` (in-memory + Capacitor Preferences sync), `offlineCache.ts` (TTL cache via Capacitor Preferences), `writeQueue.ts` (FIFO persistent offline mutation queue), `websocket.ts` (Socket.IO singleton with reconnect sync), `networkMonitor.ts` (online/offline detection), `auth.ts`, `websocket.ts`
- Depends on: `@capacitor/preferences`, `axios`, `socket.io-client`
- Used by: contexts, hooks, page components

**Frontend: Hooks Layer:**
- Purpose: Reusable data-fetching and UI logic
- Location: `frontend/src/hooks/`
- Contains: `useOfflineQuery.ts` (SWR pattern: cache-first, background revalidation, stale detection), `useActionGuard.ts` (prevents duplicate mutations), `useCountUp.ts` (animated number counters)
- Depends on: `services/offlineCache.ts`, `services/networkMonitor.ts`
- Used by: all page and view components

**Frontend: Component Layer:**
- Purpose: UI rendering, role-specific views, modals
- Location: `frontend/src/components/`
- Contains: Role-segmented subdirectories (`admin/`, `konfi/`, `teamer/`, `chat/`, `wrapped/`, `auth/`, `common/`, `shared/`, `layout/`)
- Depends on: contexts, hooks, services, `@ionic/react`
- Used by: `frontend/src/App.tsx` via React Router routes

## Data Flow

**Standard Read Flow (Online):**

1. Page/view mounts, calls `useOfflineQuery(cacheKey, fetcher, options)`
2. Hook checks `offlineCache.get(cacheKey)` — returns cached data immediately if fresh
3. Simultaneously fires `fetcher()` (calls `api.get(...)`)
4. `api.ts` interceptor attaches `Authorization: Bearer <token>` from `tokenStore.getToken()`
5. Backend `verifyTokenRBAC` middleware validates JWT, loads user + `assigned_jahrgaenge` from DB
6. Route handler queries PostgreSQL via `db.query(...)` with `organization_id` filter
7. Response flows back; hook updates state and writes to `offlineCache`

**Standard Read Flow (Offline):**

1. `useOfflineQuery` checks `offlineCache` — returns stale cached data
2. Marks data as `isStale: true`
3. When network returns, `networkMonitor` fires, hook calls `revalidate()`

**Write Flow (Online):**

1. Component calls `api.post/put/delete(...)` directly
2. On success, `liveUpdate.sendToUser()` or `sendToOrgAdmins()` fires Socket.IO event
3. `LiveUpdateContext` routes event to subscribed views → triggers `refresh()`

**Write Flow (Offline):**

1. Component calls `writeQueue.enqueue({ method, url, body, metadata })`
2. Queue persists to `Capacitor.Preferences` under `queue:items`
3. On reconnect: `websocket.ts` calls `writeQueue.flush()` → replays items in FIFO order
4. After flush: `offlineCache.invalidateAll()` marks all cache stale → background revalidation

**Token Refresh Flow:**

1. `api.ts` response interceptor catches HTTP 401
2. If offline: keeps token, rejects error (cached data remains available)
3. If online + refresh token available: calls `POST /api/auth/refresh`
4. On success: updates `tokenStore` with new access + refresh tokens
5. Replays all queued requests that arrived during refresh (`refreshSubscribers`)
6. On failure: clears auth, dispatches `auth:relogin-required` CustomEvent

**Real-Time Update Flow:**

1. Backend route calls `liveUpdate.sendToUser(userType, userId, updateType, action)` after mutation
2. Socket.IO emits `liveUpdate` event to room `user_<type>_<id>`
3. `LiveUpdateContext` socket listener receives event, calls registered callbacks by `updateType`
4. Subscribed page/view calls `refresh()` on its `useOfflineQuery` instance

**State Management:**
- Global session state: `AppContext` (user object, online status)
- Badge/unread counts: `BadgeContext` (computed via `useMemo` from chat + requests + events)
- Real-time subscriptions: `LiveUpdateContext` (Map of `LiveUpdateType → Set<callback>`)
- Local UI state: `useState` within components
- Token storage: dual-layer — synchronous in-memory `_token` + async `Capacitor.Preferences`

## Key Abstractions

**RBAC Middleware:**
- Purpose: Authenticates every request and enriches `req.user` with role, organization, jahrgang assignments
- Examples: `backend/middleware/rbac.js`
- Pattern: Factory function takes `db`, returns Express middleware. Each request does a live DB lookup to catch deactivated users and soft-revoked tokens

**Route Factory Pattern:**
- Purpose: Dependency injection — routes receive `db`, `verifyTokenRBAC`, `roleHelpers` as constructor arguments
- Examples: `backend/routes/activities.js`, `backend/routes/events.js`, `backend/routes/chat.js`
- Pattern: `module.exports = (db, rbacVerifier, roleHelpers, ...) => { const router = express.Router(); ... return router; }`

**useOfflineQuery Hook:**
- Purpose: SWR cache-first data fetching with offline support
- Examples: Used on all 30+ pages; pattern: `const { data, loading, refresh } = useOfflineQuery('cache:key', () => api.get('/endpoint').then(r => r.data))`
- Pattern: Accepts `cacheKey`, async `fetcher`, `options`. Always returns cached data first, revalidates in background when online

**WriteQueue:**
- Purpose: Persistent offline mutation queue; survives app restarts
- Examples: `frontend/src/services/writeQueue.ts`
- Pattern: `writeQueue.enqueue({ method, url, body, metadata })` — flush happens automatically on reconnect via `websocket.ts`

**Organization Isolation:**
- Purpose: Multi-tenant data separation — every query filters by `organization_id`
- Examples: All backend routes, Socket.IO `joinRoom` handler in `backend/server.js`
- Pattern: `WHERE organization_id = $1` with `req.user.organization_id` parameter on every query

**Badge System:**
- Purpose: Automatic badge award checking after points/activities/events change
- Examples: `backend/routes/badges.js` exports `checkAndAwardBadges` function, injected into `activities.js`, `events.js`, `konfi-management.js`
- Pattern: Called after every mutation that could trigger a badge condition

## Entry Points

**Backend:**
- Location: `backend/server.js`
- Triggers: `node server.js` (Docker container start), healthcheck at `GET /api/health`
- Responsibilities: Express app setup, Socket.IO server, SMTP transporter, rate limiters, route mounting (19 routes), chat room initialization, background service startup

**Frontend (Web):**
- Location: `frontend/src/main.tsx`
- Triggers: Browser load or Capacitor native app launch
- Responsibilities: React DOM render, wraps `<App />` with context providers

**Frontend (App Shell):**
- Location: `frontend/src/App.tsx`
- Responsibilities: Ionic setup, platform-specific theme (iOS26 / MD3 based on `isPlatform`), auth guard routing, provider hierarchy: `AppProvider > BadgeProvider > LiveUpdateProvider > ModalProvider`

**Route Guard:**
- Location: `frontend/src/App.tsx` (inline `AppContent` component)
- Pattern: `user === null` → redirect to `/login`; `user.type` determines which tab set renders in `MainTabs.tsx`

**Tab Router:**
- Location: `frontend/src/components/layout/MainTabs.tsx`
- Responsibilities: Role-conditional tab bars (admin / konfi / teamer), all route definitions for authenticated pages, lazy modal rendering via `useIonModal`

## Error Handling

**Strategy:** HTTP status codes + structured JSON error responses on backend; toast notifications on frontend

**Patterns:**
- Backend routes: `try/catch` blocks, `res.status(4xx/5xx).json({ error: '...' })` with German error messages
- Frontend mutations: catch blocks dispatch `setError()` to `AppContext`, displayed as `IonToast`
- Frontend reads: `useOfflineQuery` surfaces `error` string from component, shows `EmptyState` component
- Auth failures: `api.ts` interceptor handles 401 globally, dispatches `auth:relogin-required` CustomEvent
- Unhandled: `ErrorBoundary` component wraps the app in `frontend/src/components/common/ErrorBoundary.tsx`
- Background services: `try/catch` with `console.error`, services continue running after individual failures

## Cross-Cutting Concerns

**Logging:** `console.log/warn/error` — no structured logging library; console output captured by Docker

**Validation:** Backend uses `express-validator` (`body()`, `param()` chains) with shared `handleValidationErrors` from `backend/middleware/validation.js`. Frontend uses inline checks before API calls.

**Authentication:** JWT access tokens (15 min TTL) + rotating refresh tokens (90 day TTL) stored in `Capacitor.Preferences`. Soft-revoke via `token_invalidated_at` DB field checked on every request in `verifyTokenRBAC`.

**Multi-tenancy:** Every database query filters by `req.user.organization_id`. Socket.IO enforces org isolation on `joinRoom` and typing events. Chat room creation restricted to same organization.

**Rate Limiting:** Per-endpoint `express-rate-limit` instances — general (1000/15min), auth (10/15min), register (5/hr), chat (30/min), booking (20/15min), upload (30/15min), org management (20/15min).

---

*Architecture analysis: 2026-03-23*
