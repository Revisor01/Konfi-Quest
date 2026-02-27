# Codebase Structure

**Analysis Date:** 2026-02-27

## Directory Layout

```
Konfipoints/
├── backend/                       # Node.js Express API server
│   ├── data/                      # SQLite backup (legacy, not used)
│   ├── init-scripts/              # Database initialization scripts for PostgreSQL
│   ├── middleware/                # RBAC and auth middleware
│   ├── migrations/                # Database migration files (SQLite → PostgreSQL)
│   ├── routes/                    # API endpoint definitions (13+ route modules)
│   ├── services/                  # Background jobs, email, push notifications
│   ├── uploads/                   # User-uploaded files (chat, activity requests)
│   ├── utils/                     # Helper utilities (RBAC, password, chat, date)
│   ├── server.js                  # Main Express + Socket.io server
│   ├── database.js                # PostgreSQL connection pool
│   ├── package.json               # Dependencies: express, pg, socket.io, bcrypt, nodemailer
│   └── Dockerfile                 # Docker build config
├── frontend/                      # React 19 + Ionic 8 Capacitor app
│   ├── src/
│   │   ├── components/            # UI components organized by domain
│   │   ├── contexts/              # React Context API state management
│   │   ├── services/              # API client, WebSocket, auth
│   │   ├── types/                 # TypeScript type definitions
│   │   ├── utils/                 # Utility functions
│   │   ├── theme/                 # CSS variables and styling
│   │   ├── App.tsx                # Root component with providers
│   │   └── main.tsx               # Vite entry point
│   ├── public/                    # Static assets (icons, images)
│   ├── android/                   # Capacitor Android build config
│   ├── ios/                       # Capacitor iOS build config
│   ├── dist/                      # Production build output
│   ├── package.json               # Dependencies: react 19, @ionic/react 8, capacitor, vite
│   ├── vite.config.ts             # Vite build config
│   ├── tsconfig.json              # TypeScript config
│   └── Dockerfile                 # Docker build config
├── init-scripts/                  # Database schema and initial data
├── docs/                          # Project documentation
├── .planning/                     # GSD planning artifacts
├── docker-compose.yml             # PostgreSQL + Backend + Frontend services
├── CLAUDE.md                      # Project guidelines (German, RBAC, no emojis)
└── package-lock.json              # Root lockfile (monorepo)
```

## Directory Purposes

**backend/:**
- Purpose: REST API and real-time server for all client requests
- Contains: Express routes, database queries, business logic, Socket.io handlers
- Key files: `server.js` (entry), `routes/` (endpoints), `middleware/rbac.js` (auth), `database.js` (DB pool)

**backend/routes/:**
- Purpose: Define API endpoints grouped by domain
- Contains: 13+ modules, each exporting a router function
- Key modules:
  - `auth.js` (1762 lines) - Login, registration, password reset (unified RBAC)
  - `konfi.js` (1437 lines) - Konfi dashboard, points, activities, requests
  - `chat.js` (1730 lines) - Chat messages, polls, files, room management
  - `events.js` (1437 lines) - Event CRUD, registration, waitlist, timeslots
  - `konfi-management.js` - Admin panel for Konfi data
  - `activities.js` - Activity categories and definitions
  - `badges.js` - Badge definitions and earning logic
  - `users.js` - User management (admin)
  - `organizations.js` - Multi-tenant org management
  - `jahrgaenge.js` - Age group/year management
  - `categories.js` - Activity categories
  - `levels.js` - Point level definitions
  - `notifications.js` - Device token registration, notification sending
  - `settings.js` - Global settings

**backend/middleware/:**
- Purpose: Request authentication and authorization
- Contains: RBAC verification middleware
- Key: `rbac.js` - `verifyTokenRBAC` middleware used by all protected routes

**backend/services/:**
- Purpose: Background processes and external integrations
- Contains:
  - `emailService.js` - Send password resets, notifications via SMTP
  - `pushService.js` - Firebase Cloud Messaging for mobile push notifications
  - `backgroundService.js` - Background tasks like cleanup, reporting

**backend/utils/:**
- Purpose: Shared utility functions
- Contains:
  - `roleHierarchy.js` - Role permission levels and checks
  - `passwordUtils.js` - Password validation and hashing
  - `chatUtils.js` - Chat-specific helpers
  - `liveUpdate.js` - Socket.io notification broadcasting
  - `dateUtils.js` - Date formatting

**backend/uploads/:**
- Purpose: Store user-uploaded files
- Contains:
  - `chat/` - Images/files from chat messages
  - `requests/` - Files from activity requests

**backend/init-scripts/:**
- Purpose: Database initialization when PostgreSQL container starts
- Contains: SQL scripts that create schema, tables, indexes, initial data

**frontend/src/components/:**
- Purpose: React component tree organized by feature domain
- Structure:
  - `admin/` - Admin panel (management pages for konfis, activities, events, etc.)
    - `pages/` - Full-page views (AdminKonfisPage, AdminEventsPage, etc.)
    - `views/` - Reusable view components (KonfiDetailView, EventDetailView)
    - `modals/` - Popup modals for forms
    - `settings/` - Admin settings components
  - `konfi/` - Konfi user interface (their dashboard, badges, events)
    - `pages/` - KonfiDashboardPage, KonfiEventsPage, KonfiProfilePage
    - `views/` - DashboardView, EventsView, BadgesView, ProfileView
    - `modals/` - ActivityRequestModal, EditProfileModal, ChangePasswordModal
  - `chat/` - Chat/messaging interface
    - `pages/` - ChatOverviewPage (room list)
    - `views/` - ChatRoomView (message feed)
    - `modals/` - Create room, options, direct message modals
  - `auth/` - Authentication pages
    - LoginView, KonfiRegisterPage, ForgotPasswordPage, ResetPasswordPage
  - `layout/` - Navigation structure
    - `MainTabs.tsx` - Tab bar routing (switches layout based on user role)
  - `common/` - Reusable components
    - LoadingSpinner, PushNotificationSettings, shared UI elements

**frontend/src/contexts/:**
- Purpose: Global state management via React Context API
- Contains:
  - `AppContext.tsx` - User auth state, profile, organization, role, JWT token
  - `BadgeContext.tsx` - Chat unread count badge state
  - `LiveUpdateContext.tsx` - Real-time WebSocket event subscriptions
  - `ModalContext.tsx` - Modal presentation state (deprecated, using useIonModal instead)

**frontend/src/services/:**
- Purpose: Communication with backend and native features
- Contains:
  - `api.ts` - Axios client with baseURL, auth interceptors, error handling
  - `auth.ts` - Auth service functions (login, register, logout, password reset)
  - `websocket.ts` - Socket.io initialization, room join/leave, event handling

**frontend/src/types/:**
- Purpose: TypeScript type definitions
- Contains: Models for User, Konfi, Event, ChatMessage, Badge, Activity, etc.

**frontend/src/theme/:**
- Purpose: Design system and CSS variables
- Contains: `variables.css` - CSS custom properties for colors, spacing, fonts

**frontend/src/utils/:**
- Purpose: Frontend utility functions
- Contains: Date formatting, API error parsing, validation helpers

## Key File Locations

**Entry Points:**
- Backend: `backend/server.js` - Starts Express + Socket.io on port 5000
- Frontend: `frontend/src/main.tsx` - Vite entry, mounts App to DOM
- App Root: `frontend/src/App.tsx` - Provider wrapping, auth check, route dispatch

**Configuration:**
- Database: `backend/database.js` - PostgreSQL pool configuration
- API Client: `frontend/src/services/api.ts` - Axios baseURL, interceptors
- WebSocket: `frontend/src/services/websocket.ts` - Socket.io connection config
- Build: `frontend/vite.config.ts`, `backend/Dockerfile`, `docker-compose.yml`

**Core Logic:**
- RBAC Middleware: `backend/middleware/rbac.js` - User + role loading, permission checks
- Role Hierarchy: `backend/utils/roleHierarchy.js` - Role level comparisons
- Auth Routes: `backend/routes/auth.js` - Login, registration, password reset
- Konfi Routes: `backend/routes/konfi.js` - Konfi dashboard, points, activities
- Chat Routes: `backend/routes/chat.js` - Messages, polls, rooms, files
- Events Routes: `backend/routes/events.js` - Event CRUD, booking, waitlist

**Testing:**
- Frontend: `frontend/cypress/` - E2E tests via Cypress
- Frontend: `frontend/src/App.test.tsx` - Unit test example
- Backend: No test framework configured (run via `npm test` → error)

## Naming Conventions

**Files:**
- Backend routes: PascalCase (auth.js, activities.js, konfi.js, chat.js)
- Frontend components: PascalCase.tsx (LoginView.tsx, AdminKonfisPage.tsx)
- Utilities: camelCase.js (roleHierarchy.js, passwordUtils.js)
- Styles: variables.css (not per-component, global theme)

**Directories:**
- Backend domain modules: lowercase plural (routes/, services/, utils/, middleware/)
- Frontend domains: lowercase singular (admin/, konfi/, chat/, auth/)
- Sub-paths in frontend: pages/, views/, modals/ (organizing component types within each domain)

**Functions & Methods:**
- API routes: camelCase (router.get(), router.post(), router.put())
- Middleware: verb + Noun (verifyTokenRBAC, checkAndAwardBadges)
- React hooks: use* (useApp, useBadge, useLocation from React Router)

**Types & Interfaces:**
- User, Konfi, Event, ChatMessage, Badge (PascalCase, singular)
- Props interfaces: ComponentNameProps (e.g., LoginViewProps)

**Database Tables:**
- Plural snake_case (users, konfi_profiles, chat_messages, event_bookings)
- Junction tables: both_singular_snake_case (user_jahrgang_assignments, chat_participants)

## Where to Add New Code

**New Feature (e.g., Reports, Leaderboard):**
- Primary code: `backend/routes/reports.js` - Create new route module, export router function
- API client: `frontend/src/services/api.ts` - Add helper functions for report endpoints
- Components: `frontend/src/components/admin/pages/AdminReportsPage.tsx` - New admin page
- Tests: `backend/backup_sqlite/routes/reports.js` - Reference if migrating from SQLite
- Integration: Register route in `backend/server.js` → `app.use('/api/reports', reportsRoutes(db, rbacVerifier, ...))`

**New Component (Page/Modal/View):**
- Location: `frontend/src/components/{domain}/{pages|views|modals}/ComponentName.tsx`
- Import context: `import { useApp } from '../../contexts/AppContext'` (adjust path)
- Use Ionic components: `IonPage`, `IonHeader`, `IonToolbar`, `IonContent`
- Modal pattern: Use `useIonModal` hook (NOT `<IonModal isOpen>`)
- Styling: Apply CSS classes from `src/theme/variables.css`

**New Utility Function:**
- Shared backend: `backend/utils/newHelper.js` - Export function, import in routes
- Shared frontend: `frontend/src/utils/newHelper.ts` - Import in components/services
- Specific to route: Define inline in `backend/routes/module.js` (no export needed)

**New Database Table:**
- Create migration: `backend/migrations/YYYY-MM-DD_description.sql`
- Add init script: `backend/init-scripts/10-tables.sql` - SQL CREATE statement
- Update TypeScript: `frontend/src/types/index.ts` - Add interface for type safety
- Add query helpers: `backend/routes/newModule.js` - CRUD operations

**New Admin Page:**
- Location: `frontend/src/components/admin/pages/AdminNewFeaturePage.tsx`
- View logic: `frontend/src/components/admin/views/NewFeatureView.tsx`
- Modals: `frontend/src/components/admin/modals/NewFeatureModal.tsx`
- Integration: Import in `frontend/src/components/layout/MainTabs.tsx` → Add route + tab button

**New Konfi Feature:**
- Location: `frontend/src/components/konfi/pages/KonfiNewPage.tsx`
- View: `frontend/src/components/konfi/views/NewView.tsx`
- Modals: `frontend/src/components/konfi/modals/NewModal.tsx`
- Integration: Import in MainTabs.tsx, add route

## Special Directories

**backend/data/:**
- Purpose: Legacy SQLite database (not actively used)
- Generated: No, checked in for reference
- Committed: Yes (historical backup)

**backend/migrations/:**
- Purpose: Database schema change scripts
- Generated: No, manually created for major schema updates
- Committed: Yes (track schema evolution)

**backend/uploads/:**
- Purpose: Runtime storage of uploaded files (chat images, request attachments)
- Generated: Yes, populated at runtime
- Committed: No (in .gitignore)

**frontend/dist/:**
- Purpose: Production build output (compiled JS, HTML, assets)
- Generated: Yes, created by `npm run build`
- Committed: No (in .gitignore)

**frontend/android/ & frontend/ios/:**
- Purpose: Capacitor native app configurations and build metadata
- Generated: Partially (updated by Capacitor CLI)
- Committed: Yes (templates and config)

**.planning/codebase/:**
- Purpose: GSD mapping artifacts (this file and others)
- Generated: By mapping agent
- Committed: Yes (design documentation)

---

*Structure analysis: 2026-02-27*
