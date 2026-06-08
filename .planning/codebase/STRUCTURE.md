# Codebase Structure

**Analysis Date:** 2026-06-09

## Directory Layout

```
Konfipoints/
├── backend/                    # Node.js + Express 5 + PostgreSQL API
│   ├── createApp.js            # Pure Express app factory (mounts all routers)
│   ├── server.js               # Production wrapper: http + Socket.IO + cron + SMTP + Firebase
│   ├── database.js             # pg Pool + idempotent migration runner
│   ├── routes/                 # 18 route modules (factory functions)
│   ├── middleware/             # rbac.js, validation.js, uploadValidation.js
│   ├── services/               # push, email, backgroundService(cron), losung
│   ├── utils/                  # booking/limit/streak/deletion/role helpers
│   ├── push/                   # firebase.js + service-account (FCM)
│   ├── migrations/             # numbered .sql files (064..089)
│   ├── tests/                  # supertest integration suites
│   ├── uploads/                # runtime upload dirs (requests/chat/material)
│   └── Dockerfile
├── frontend/                   # Ionic 8 + React 19 + Vite + Capacitor
│   ├── src/                    # App source (see below)
│   ├── ios/                    # Capacitor iOS native project
│   ├── android/                # Capacitor Android native project (gitignored)
│   ├── dist/                   # Vite web build output
│   ├── public/                 # static assets
│   ├── capacitor.config.ts
│   ├── vite.config.ts
│   └── Dockerfile (nginx serve)
├── .planning/                  # GSD workflow artifacts (phases, milestones, codebase docs)
├── store-assets/               # App Store / Play Store listings + screenshots
├── e2e/                        # Playwright end-to-end journeys
├── docs/                       # project documentation
├── init-scripts/               # DB init for Docker
├── docker-compose.e2e.yml      # e2e stack
├── portainer-stack.yml         # production deploy compose
└── CLAUDE.md                   # project rules (RBAC, no-emoji, umlauts)
```

## Directory Purposes

**`backend/routes/` (18 modules):**
- Purpose: all HTTP endpoints; each is a factory `(db, rbacVerifier, roleHelpers, ...) => router`
- Mounted in `createApp.js`. Mapping of file → mount path:

| File | Mount | Scope |
|------|-------|-------|
| `auth.js` | `/api/auth` | login, refresh, register, password reset, invite |
| `konfi.js` | `/api/konfi` | konfi self-service (dashboard, profile, requests) |
| `chat.js` | `/api/chat` | chat rooms/messages/participants/polls |
| `notifications.js` | `/api/notifications` | notification feed |
| `events.js` | `/api/events` | events, bookings, timeslots, waitlist |
| `settings.js` | `/api/settings` | org settings |
| `activities.js` | `/api/admin/activities` | activity catalog |
| `badges.js` | `/api/admin/badges` | custom badges + `checkAndAwardBadges` |
| `konfi-management.js` | `/api/admin/konfis` | admin konfi CRUD |
| `jahrgaenge.js` | `/api/admin/jahrgaenge` | year groups |
| `categories.js` | `/api/admin/categories` | activity categories |
| `users.js` | `/api/admin/users` + `/api/users` | user management |
| `roles.js` | `/api/roles` | roles |
| `organizations.js` | `/api/organizations` | super-admin org management (rate-limited) |
| `levels.js` | `/api/levels` | level/XP config |
| `teamer.js` | `/api/teamer` | teamer dashboard + stats |
| `wrapped.js` | `/api/wrapped` | year-in-review |
| `material.js` | `/api/material` | material library (uploads) |

**`backend/middleware/`:**
- `rbac.js` — `verifyTokenRBAC`, `requireRole`, `requireSuperAdmin/OrgAdmin/Admin/Teamer`, `checkJahrgangAccess`, `requireSameOrganization`
- `validation.js`, `uploadValidation.js` (magic-bytes check)

**`backend/services/`:**
- `pushService.js` (FCM send/register), `emailService.js` (SMTP templates), `backgroundService.js` (node-cron jobs), `losungService.js` (daily Bible verse)

**`backend/utils/`:**
- `bookingUtils.js`, `konfiLimit.js`, `konfiDeletion.js`, `streakCalculation.js`, `roleHierarchy.js`, `chatUtils.js`, `liveUpdate.js`, `passwordUtils.js`, `pointTypeGuard.js`, `dateUtils.js`

**`backend/migrations/`:**
- Numbered `.sql` (064–089), applied once by `database.js` runner, tracked in `schema_migrations`. Never run by hand on prod.

## Frontend `src/` Structure

```
frontend/src/
├── main.tsx                    # React entry, mounts <App/>
├── App.tsx                     # Providers + auth gate + IonReactRouter
├── components/
│   ├── auth/                   # LoginView, KonfiRegisterPage, Forgot/ResetPassword
│   ├── layout/                 # MainTabs.tsx (role-based tab routing)
│   ├── konfi/                  # pages/ views/ modals/  (konfi role UI)
│   ├── teamer/                 # pages/ views/ modals/  (teamer role UI)
│   ├── admin/                  # *View.tsx + pages/ views/ modals/ settings/
│   ├── chat/                   # chat UI (overview, room, polls)
│   ├── wrapped/                # year-in-review slides
│   ├── shared/                 # cross-role: StatusBadge, ListSection, SectionHeader,
│   │                           #   SpiritFooter, TrialBanner, FileViewerModal, DeleteAccountModal
│   └── common/                 # ErrorBoundary, LoadingSpinner, PushNotificationSettings
├── contexts/                   # AppContext, BadgeContext, LiveUpdateContext, ModalContext
├── hooks/                      # useOfflineQuery, useActionGuard, useCountUp
├── services/                   # api.ts, tokenStore.ts, auth.ts, websocket.ts,
│                               #   offlineCache.ts, writeQueue.ts, networkMonitor.ts, migrateStorage.ts
├── types/                      # chat.ts, dashboard.ts, event.ts, user.ts, wrapped.ts, ionic.d.ts
├── theme/                      # variables.css (design tokens, app-* classes)
├── utils/                      # dateUtils, haptics, helpers, nativeFileViewer, uuid
├── __tests__/                  # frontend unit/component tests
└── __mocks__/                  # test mocks
```

**Role component convention:** each role folder splits into:
- `pages/` — route targets imported by `MainTabs.tsx` (e.g. `AdminKonfisPage.tsx`, `KonfiDashboardPage.tsx`, `TeamerEventsPage.tsx`)
- `views/` — composable section components rendered inside pages (e.g. `EventsView.tsx`, `KonfiDetailView.tsx`)
- `modals/` — `useIonModal` content components

## Key File Locations

**Entry Points:**
- `backend/server.js`: production process (cron, sockets, listen)
- `backend/createApp.js`: Express app factory (also used by tests)
- `frontend/src/main.tsx` → `frontend/src/App.tsx`: React app
- `frontend/src/components/layout/MainTabs.tsx`: post-login routing per role

**Configuration:**
- `backend/database.js`: pg Pool + migration runner (env: `DATABASE_URL`, `PG_POOL_MAX`, `PG_IDLE_TIMEOUT`, `PG_CONN_TIMEOUT`)
- `backend/.env`: backend secrets (DO NOT read)
- `frontend/capacitor.config.ts`, `frontend/vite.config.ts`, `frontend/nginx.conf`
- `portainer-stack.yml`: prod deploy

**Core Logic:**
- `backend/routes/*.js`: business logic + SQL
- `backend/middleware/rbac.js`: auth/authorization
- `frontend/src/services/api.ts`: API client + JWT refresh

**Testing:**
- `backend/tests/`: integration (supertest + real PostgreSQL)
- `frontend/src/__tests__/`: unit/component
- `e2e/` + `playwright.config.ts`: end-to-end

## Database Schema (RBAC tables)

Defined cumulatively via `backend/migrations/*.sql`. Core tenant-scoped tables (all carry `organization_id` where applicable):
- `users` — id, display_name, username, role_id, organization_id, is_super_admin, teamer_since, deleted_at
- `konfi_profiles` — user_id, gottesdienst_points, gemeinde_points, jahrgang_id
- `konfi_activities` — konfi_id, activity_id, completed_date, admin_id
- `bonus_points` — konfi_id, points, type, description, admin_id
- `custom_badges` / `user_badges` — badge definitions + awards (old `badges` table is a dead 0-row altlast)
- `chat_rooms` / `chat_messages` / `chat_participants` (+ polls, reactions)
- `event_bookings` — user_id, event_id, status, booking_date (+ events, timeslots)
- `organizations` — multi-tenant root; max_konfis, trial/license fields, kirchenkreis
- `roles`, `jahrgaenge`, `levels`, `refresh_tokens`, `schema_migrations`

## `.planning/` (GSD Workflow)

```
.planning/
├── PROJECT.md, STATE.md, ROADMAP.md, BACKLOG.md   # project meta
├── FEATURE-MATRIX.md                              # role × feature rights (source of truth)
├── MILESTONES.md, RETROSPECTIVE.md
├── milestones/                                    # per-milestone records
├── phases/                                        # per-phase plans
├── quick/, research/, sketches/                   # working notes
└── codebase/                                       # THIS map (ARCHITECTURE/STRUCTURE/STACK/
                                                    #   INTEGRATIONS/CONVENTIONS/TESTING/CONCERNS)
```

## `store-assets/`

```
store-assets/
├── marketing-copy.md, STORE-LISTINGS.md   # listing texts (Apple + Google)
├── screenshots/                           # store screenshots
├── ios-raw/                               # raw iOS captures
└── android-1.0.1/                         # Android release assets
```

## Naming Conventions

**Files:**
- Backend: lowercase/kebab (`konfi-management.js`, `rbac.js`)
- Frontend components: PascalCase `.tsx` (`KonfiDashboardPage.tsx`, `EventsView.tsx`)
- Pages suffixed `Page`, views suffixed `View`, modals suffixed `Modal`
- Migrations: `NNN_description.sql` (zero-padded, sequential)

**Directories:**
- Role buckets lowercase (`konfi/`, `teamer/`, `admin/`) each with `pages|views|modals`

## Where to Add New Code

**New API endpoint:**
- Add to the matching `backend/routes/<domain>.js` factory; mount in `backend/createApp.js` if new module
- Gate with the appropriate `rbac.js` guard + filter by `organization_id`
- Schema change → new `backend/migrations/NNN_*.sql` (next number, never edit applied files)

**New role-specific screen:**
- Page: `frontend/src/components/<role>/pages/<Name>Page.tsx`
- Section: `frontend/src/components/<role>/views/<Name>View.tsx`
- Wire route into `frontend/src/components/layout/MainTabs.tsx`
- Data fetch via `useOfflineQuery`; mutations via `writeQueue` where offline matters

**New cross-role UI primitive:**
- `frontend/src/components/shared/` (export from `index.ts`)

**New background job:**
- Add to `backend/services/backgroundService.js` (node-cron, `timezone: 'Europe/Berlin'`), start it in `backend/server.js`

**Shared helper / type:**
- Backend: `backend/utils/`
- Frontend logic: `frontend/src/utils/` or `frontend/src/services/`; types in `frontend/src/types/`

## Special Directories

**`frontend/android/`:**
- Purpose: Capacitor Android native project
- Generated: partially (Capacitor)
- Committed: No (gitignored) — `versionCode` must be bumped manually in `app/build.gradle`

**`frontend/ios/`:**
- Purpose: Capacitor iOS native project
- Committed: Yes (Xcode project)

**`backend/uploads/`:**
- Purpose: runtime file storage (`requests/`, `chat/`, `material/`), auto-created by `createApp.js`
- Committed: No

**`frontend/dist/`, `backend/node_modules/`:**
- Generated, not committed

---

*Structure analysis: 2026-06-09*
