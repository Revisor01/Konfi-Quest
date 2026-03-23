# Codebase Structure

**Analysis Date:** 2026-03-23

## Directory Layout

```
Konfipoints/                        # Project root
├── backend/                        # Node.js Express API
│   ├── server.js                   # App entry point
│   ├── database.js                 # PostgreSQL pool + migration runner
│   ├── Dockerfile                  # Backend container image
│   ├── middleware/                 # Express middleware
│   │   ├── rbac.js                 # JWT auth + RBAC enforcement
│   │   └── validation.js           # express-validator helpers
│   ├── routes/                     # Route handlers (19 files)
│   ├── services/                   # Business logic services
│   ├── utils/                      # Shared helpers
│   ├── migrations/                 # SQL migration files (auto-run on start)
│   ├── uploads/                    # File uploads (gitignored)
│   │   ├── chat/                   # Chat file attachments
│   │   └── requests/               # Activity request photos
│   ├── push/                       # Push notification assets
│   └── init-scripts/               # Docker PostgreSQL init SQL
├── frontend/                       # React 19 + Ionic 8 app
│   ├── src/                        # Source code
│   ├── ios/                        # Capacitor iOS project
│   ├── android/                    # Capacitor Android project
│   ├── cypress/                    # E2E tests
│   ├── Dockerfile                  # Frontend nginx container image
│   ├── nginx.conf                  # nginx config for serving SPA
│   ├── capacitor.config.ts         # Capacitor native config
│   ├── vite.config.ts              # Vite build config
│   └── tsconfig.json               # TypeScript config
├── .planning/                      # GSD planning docs
│   ├── codebase/                   # Codebase analysis docs (this file)
│   └── milestones/                 # Phase plans per milestone
├── portainer-stack.yml             # Docker Compose for production (Portainer)
├── init-scripts/                   # Root-level DB init scripts
└── .github/workflows/              # CI/CD GitHub Actions
```

## Frontend `src/` Layout

```
frontend/src/
├── App.tsx                         # Root component, context providers, auth guard
├── main.tsx                        # React DOM entry point
├── components/
│   ├── admin/                      # Admin role components
│   │   ├── pages/                  # Full-screen admin pages (IonPage)
│   │   ├── views/                  # Reusable sub-views (KonfiDetailView, EventDetailView, ActivityRings)
│   │   ├── modals/                 # Admin modal components
│   │   └── settings/               # Settings sub-components
│   ├── konfi/                      # Konfi role components
│   │   ├── pages/                  # Full-screen konfi pages
│   │   ├── views/                  # Dashboard sections, event views, profile
│   │   └── modals/                 # Konfi modals (requests, scanner, history)
│   ├── teamer/                     # Teamer role components
│   │   ├── pages/                  # Full-screen teamer pages
│   │   └── views/                  # TeamerBadgesView
│   ├── chat/                       # Chat system components
│   │   ├── pages/                  # ChatOverviewPage
│   │   ├── views/                  # ChatRoomView
│   │   └── modals/                 # Chat-specific modals
│   ├── wrapped/                    # Wrapped feature (year review)
│   │   ├── slides/                 # Swiper 12 slide components
│   │   │   └── teamer/             # Teamer-specific wrapped slides
│   │   └── share/                  # Share functionality
│   ├── auth/                       # Authentication pages
│   ├── layout/                     # App shell components
│   │   └── MainTabs.tsx            # Tab router, all authenticated routes
│   ├── common/                     # Generic reusable components
│   └── shared/                     # Domain-shared components
├── contexts/                       # React context providers
├── hooks/                          # Custom React hooks
├── services/                       # Data access + platform services
├── types/                          # TypeScript type definitions
├── utils/                          # Pure utility functions
└── theme/
    └── variables.css               # CSS custom properties (design tokens)
```

## Directory Purposes

**`backend/routes/`:**
- Purpose: One file per API domain; each exports a factory function
- Contains: `auth.js`, `konfi.js`, `events.js`, `badges.js`, `activities.js`, `chat.js`, `jahrgaenge.js`, `konfi-management.js`, `categories.js`, `users.js`, `roles.js`, `organizations.js`, `settings.js`, `notifications.js`, `levels.js`, `teamer.js`, `material.js`, `wrapped.js`
- Key files: `backend/routes/auth.js` (login, register, token refresh, password reset)

**`backend/services/`:**
- Purpose: Business logic that spans multiple routes or runs on a schedule
- Contains: `backgroundService.js` (cron: badge checks, event reminders, token cleanup, wrapped generation), `pushService.js` (FCM via Firebase), `emailService.js` (nodemailer SMTP)

**`backend/utils/`:**
- Purpose: Stateless helpers injected into routes
- Contains: `liveUpdate.js` (Socket.IO emit wrapper — init with `io`, then call `sendToUser/sendToOrgAdmins`), `chatUtils.js`, `dateUtils.js`, `passwordUtils.js`, `pointTypeGuard.js`, `roleHierarchy.js`

**`backend/migrations/`:**
- Purpose: Ordered SQL migration files, run automatically at startup
- Contains: Files named `NNN_description.sql` (e.g. `068_refresh_tokens.sql`, `075_wrapped.sql`)
- Generated: No — hand-written
- Committed: Yes

**`frontend/src/contexts/`:**
- Purpose: Global state management via React Context
- Key files: `AppContext.tsx` (user, online state), `BadgeContext.tsx` (unread counts, Socket.IO init), `LiveUpdateContext.tsx` (real-time event routing), `ModalContext.tsx`

**`frontend/src/services/`:**
- Purpose: All external I/O abstracted behind service modules
- Key files: `api.ts` (axios with auth interceptor + silent refresh), `tokenStore.ts` (dual-layer memory + Preferences), `offlineCache.ts` (TTL cache), `writeQueue.ts` (persistent offline FIFO queue), `websocket.ts` (Socket.IO singleton), `networkMonitor.ts`

**`frontend/src/hooks/`:**
- Purpose: Data-fetching and UI logic extracted for reuse
- Key files: `useOfflineQuery.ts` (SWR pattern — used on every data-fetching page), `useActionGuard.ts`, `useCountUp.ts`

**`frontend/src/types/`:**
- Purpose: Shared TypeScript type definitions
- Key files: `user.ts` (`BaseUser`, `AdminUser`, `ChatUser`), `dashboard.ts`, `event.ts`, `chat.ts`, `wrapped.ts`, `ionic.d.ts`

**`frontend/src/components/admin/pages/`:**
- Purpose: Full IonPage components for admin tab routing
- Naming: `Admin<Feature>Page.tsx` (e.g. `AdminKonfisPage.tsx`, `AdminEventsPage.tsx`)

**`frontend/src/components/konfi/pages/`:**
- Purpose: Full IonPage components for konfi tab routing
- Naming: `Konfi<Feature>Page.tsx`

**`frontend/src/components/teamer/pages/`:**
- Purpose: Full IonPage components for teamer tab routing
- Naming: `Teamer<Feature>Page.tsx`

**`frontend/src/components/*/views/`:**
- Purpose: Reusable sub-page content components rendered inside pages; contain the actual data-fetching logic and UI
- Pattern: Page = shell + navigation; View = content + `useOfflineQuery` + business logic

**`frontend/src/components/*/modals/`:**
- Purpose: `useIonModal` modal components — never rendered inline, always through the hook
- Pattern: Accept `onClose` and `onSuccess` callback props; `onSuccess` triggers parent data refresh

## Key File Locations

**Entry Points:**
- `backend/server.js`: Backend app start, all route mounting
- `frontend/src/main.tsx`: Frontend React render root
- `frontend/src/App.tsx`: Auth guard, context provider hierarchy, top-level routing

**Configuration:**
- `portainer-stack.yml`: Production Docker Compose (backend port 8623, frontend port 8624)
- `frontend/capacitor.config.ts`: Capacitor native app configuration
- `frontend/vite.config.ts`: Vite build config
- `frontend/src/theme/variables.css`: All CSS design tokens and custom properties
- `backend/database.js`: DB pool config and migration runner

**Core Business Logic:**
- `backend/middleware/rbac.js`: RBAC enforcement — all auth decisions flow through here
- `backend/routes/badges.js`: Badge checking logic (`checkAndAwardBadges`) injected into other routes
- `frontend/src/services/api.ts`: Axios instance — modify here for global request/response behavior
- `frontend/src/services/writeQueue.ts`: Offline write queue — mutation metadata types defined here

**Testing:**
- `frontend/cypress/`: E2E test directory
- `frontend/src/App.test.tsx`: Frontend unit test

## Naming Conventions

**Backend Files:**
- Route files: `kebab-case.js` matching API path segment (e.g. `konfi-management.js` → `/api/admin/konfis`)
- Service files: `camelCase.js` (e.g. `backgroundService.js`, `pushService.js`)
- Util files: `camelCase.js` (e.g. `liveUpdate.js`, `chatUtils.js`)

**Frontend Files:**
- React components: `PascalCase.tsx` (e.g. `DashboardView.tsx`, `EventModal.tsx`)
- Services/hooks/utils: `camelCase.ts` (e.g. `tokenStore.ts`, `useOfflineQuery.ts`)
- Type files: `camelCase.ts` (e.g. `user.ts`, `dashboard.ts`)

**Frontend Directories:**
- Role-specific: named after role (`admin/`, `konfi/`, `teamer/`)
- Purpose-based: `pages/`, `views/`, `modals/` within each role directory

**Component Naming:**
- Pages: `<Role><Feature>Page` (e.g. `AdminKonfisPage`, `KonfiDashboardPage`, `TeamerEventsPage`)
- Views: `<Feature>View` or `<Feature>Sections` (e.g. `DashboardView.tsx`, `DashboardSections.tsx`)
- Modals: `<Feature>Modal` (e.g. `EventModal`, `BonusModal`, `ActivityRequestModal`)
- Management modals: `<Entity>ManagementModal` (e.g. `ActivityManagementModal`, `BadgeManagementModal`)

**API Routes:**
- Konfi-facing: `/api/konfi/*`
- Admin-facing: `/api/admin/*` (konfis, activities, badges, jahrgaenge, categories)
- Shared: `/api/events/*`, `/api/chat/*`, `/api/settings/*`, `/api/notifications/*`
- Platform: `/api/auth/*`, `/api/users/*`, `/api/roles/*`, `/api/organizations/*`

## Where to Add New Code

**New API Feature:**
- Backend route: create `backend/routes/<feature>.js` using factory pattern `module.exports = (db, verifyTokenRBAC, roleHelpers) => router`
- Mount in: `backend/server.js` under `// ROUTE MOUNTING` section
- Frontend service: add fetch functions to most relevant `frontend/src/services/*.ts` or create new service file

**New Admin Page:**
- Implementation: `frontend/src/components/admin/pages/Admin<Feature>Page.tsx`
- Register route: `frontend/src/components/layout/MainTabs.tsx` in admin `IonRouterOutlet`
- Add tab button: `MainTabs.tsx` admin `IonTabBar` if top-level tab needed

**New Konfi Page:**
- Implementation: `frontend/src/components/konfi/pages/Konfi<Feature>Page.tsx`
- Register route: `frontend/src/components/layout/MainTabs.tsx` in konfi `IonRouterOutlet`

**New View Component:**
- Implementation: `frontend/src/components/<role>/views/<Feature>View.tsx`
- Large views: split into `<Feature>View.tsx` (logic) + `<Feature>Sections.tsx` (presentational sub-components)

**New Modal:**
- Implementation: `frontend/src/components/<role>/modals/<Feature>Modal.tsx`
- Usage: always `const [present, dismiss] = useIonModal(MyModal, { onClose: () => dismiss(), onSuccess: () => { dismiss(); reload(); } })`
- Never use `<IonModal isOpen={state}>` pattern

**New Database Migration:**
- Create: `backend/migrations/<NNN>_<description>.sql` (increment number, descriptive name)
- Auto-runs on next backend container start via `database.js` migration runner

**Utilities:**
- Frontend shared helpers: `frontend/src/utils/helpers.ts` or new `frontend/src/utils/<domain>.ts`
- Backend shared helpers: `backend/utils/<name>.js`

**New Type:**
- Domain-specific: add to appropriate `frontend/src/types/<domain>.ts`
- Cross-cutting user types: `frontend/src/types/user.ts`

## Special Directories

**`backend/uploads/`:**
- Purpose: Persisted file uploads (chat attachments, activity request photos, material files)
- Generated: Yes (at runtime)
- Committed: No — mounted as Docker volume at `/opt/Konfi-Quest/uploads`
- Note: All files served through protected endpoints, not as static files

**`backend/data/`:**
- Purpose: Legacy data directory (kept for compatibility)
- Generated: Yes (mkdir at startup)
- Committed: No

**`backend/migrations/`:**
- Purpose: Idempotent SQL migrations tracked in `schema_migrations` table
- Generated: No — hand-written
- Committed: Yes — migrations are part of the codebase

**`frontend/ios/` and `frontend/android/`:**
- Purpose: Capacitor native project wrappers
- Generated: Partially (Capacitor generates base, custom Swift/Kotlin code hand-written)
- Committed: Yes — includes custom `AppDelegate.swift` with FCM integration

**`.planning/`:**
- Purpose: GSD planning documents — codebase analysis, milestone phases
- Generated: By Claude GSD tooling
- Committed: Yes

---

*Structure analysis: 2026-03-23*
