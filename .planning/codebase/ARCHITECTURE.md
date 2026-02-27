# Architecture

**Analysis Date:** 2026-02-27

## Pattern Overview

**Overall:** Multi-layer client-server architecture with real-time WebSocket communication

**Key Characteristics:**
- Monolithic backend (Node.js Express) serving REST API + WebSocket server
- Frontend as hybrid mobile app (React 19 + Ionic 8 + Capacitor)
- PostgreSQL database with RBAC-based access control
- Real-time chat and notifications via Socket.io
- Organization-scoped multi-tenancy

## Layers

**Presentation Layer (Frontend):**
- Purpose: Cross-platform mobile UI for Konfis and Admins (React + Ionic)
- Location: `frontend/src/`
- Contains: Components (pages, views, modals), contexts for state, services for API communication
- Depends on: API service (`services/api.ts`) for HTTP, WebSocket service for real-time updates
- Used by: End users (Konfis, Admins) via iOS/Android apps

**API Layer (Backend REST):**
- Purpose: Expose business logic as REST endpoints with RBAC authentication
- Location: `backend/routes/`
- Contains: 13+ route modules handling auth, konfi data, chat, events, admin operations
- Depends on: Database layer, middleware (RBAC verification), services (email, push notifications)
- Used by: Frontend application exclusively

**Real-time Layer (WebSocket):**
- Purpose: Live chat, typing indicators, notifications
- Location: `backend/server.js` (io setup) + `backend/routes/chat.js` (chat logic)
- Contains: Socket.io connection management, room-based messaging, user presence
- Depends on: Database, Socket.io transport
- Used by: Chat component, notification system

**Business Logic Layer:**
- Purpose: Encapsulate domain operations (activities, badges, events, notifications)
- Location: `backend/routes/` + `backend/services/`
- Contains: Route handlers with business rules, validation, database queries
- Depends on: Database, utilities (role hierarchy, password validation)
- Used by: API layer

**Database Access Layer:**
- Purpose: PostgreSQL connection pooling and query execution
- Location: `backend/database.js`
- Contains: pg Pool configuration with connection string
- Depends on: PostgreSQL instance (Docker container)
- Used by: All backend routes and services

**Middleware Layer:**
- Purpose: Authentication, authorization, request rate limiting
- Location: `backend/middleware/rbac.js`, rate limiters in `server.js`
- Contains: `verifyTokenRBAC` (JWT validation + role/org loading), rate limiters for auth/chat/general
- Depends on: JWT token in request header, database for user/role lookups
- Used by: All protected API routes

**State Management (Frontend):**
- Purpose: Global application state (user, auth, chat notifications, badges)
- Location: `frontend/src/contexts/`
- Contains: `AppContext` (auth state, user data), `BadgeContext` (notification counts), `LiveUpdateContext` (real-time updates)
- Depends on: Services (API, WebSocket), localStorage for persistence
- Used by: React components throughout application

## Data Flow

**Authentication Flow:**
1. User submits credentials → `POST /api/auth/login`
2. Backend validates password (bcrypt), generates JWT token
3. Backend returns user object + token
4. Frontend stores token in localStorage, initializes AppContext
5. Subsequent requests include `Authorization: Bearer <token>` header
6. Backend verifies token via `verifyTokenRBAC` middleware, loads user + role + organization data

**Chat Message Flow:**
1. User types message in chat room
2. Message sent via WebSocket → `POST /api/chat/messages` (if persistence needed) + `socket.emit('message')`
3. Server validates user in room, stores in `chat_messages` table
4. Server broadcasts to room subscribers via `io.to('room_${roomId}').emit('newMessage')`
5. Connected clients receive message, update UI, increment chat badge
6. Badge count persisted via BadgeContext + API sync

**Points Assignment Flow:**
1. Admin submits activity/bonus points → `POST /api/konfi/:konfiId/activities` or `/bonus-points`
2. Backend validates admin permission via RBAC (requires role >= admin)
3. Backend creates record in `konfi_activities` or `bonus_points` table
4. Backend recalculates total points in `konfi_profiles`
5. WebSocket notifies target Konfi of point update
6. Konfi app receives real-time update, refreshes dashboard

**Event Booking Flow:**
1. Konfi selects event, clicks register → `POST /api/events/:eventId/register`
2. Backend checks timeslot availability, waitlist status
3. Backend creates record in `event_bookings` with status (confirmed/waitlisted)
4. Backend broadcasts update to admin event view
5. Admin sees updated participant counts in real-time

**Real-time Push Notification Flow:**
1. Chat message received → server broadcasts via Socket.io
2. BadgeContext increments local badge count
3. Firebase/native push notification triggers (if app in background)
4. Backend sends push via `pushService.sendNotification()`
5. User's app receives notification, updates badge via Capacitor

## Key Abstractions

**User Model:**
- Purpose: Unified representation of all users (Konfis + Admins)
- Examples: `backend/routes/auth.js`, `middleware/rbac.js`, `backend/routes/users.js`
- Pattern: Single `users` table + role-based access control
- Fields: `id, username, password_hash, display_name, role_id, organization_id, is_super_admin`

**Konfi Profile:**
- Purpose: Extended data for Konfis (points, badges, activities)
- Examples: `konfi_profiles`, `konfi_activities`, `konfi_badges` tables
- Pattern: Separate profile table linked to user via user_id
- Usage: Dashboard displays totals from konfi_profiles; detailed history from linked tables

**Organization:**
- Purpose: Multi-tenancy container (e.g., different church congregations)
- Examples: `backend/routes/organizations.js`, organizations/permissions tables
- Pattern: All resources scoped to organization_id
- Usage: Users can only access data in their organization (enforced by RBAC)

**RBAC (Role-Based Access Control):**
- Purpose: Determine what each user can do
- Examples: `middleware/rbac.js`, role hierarchy in `utils/roleHierarchy.js`
- Pattern: JWT token decoded → user loaded with role → role name determines endpoints allowed
- Roles: `super_admin` (5), `org_admin` (4), `admin` (3), `teamer` (2), `konfi` (1)

**Chat Room:**
- Purpose: Group or direct message container
- Examples: `chat_rooms`, `chat_participants`, `chat_messages` tables
- Pattern: Room has type (group/dm), members, messages with timestamps
- Real-time: Socket.io room `room_${roomId}` for live messaging

**Activity Category & Activity:**
- Purpose: Structured point-earning options
- Examples: `categories` and `activities` tables in `backend/routes/activities.js`
- Pattern: Category contains multiple activities; activity has point value
- Usage: Konfis submit activity requests; admins approve and assign points

**Badge System:**
- Purpose: Gamification - achievements for reaching milestones
- Examples: `konfi_badges`, `badge_levels` tables in `backend/routes/badges.js`
- Pattern: Badges awarded when Konfi reaches point threshold
- Real-time: `checkAndAwardBadges()` called after point assignments

## Entry Points

**Backend Entry Point:**
- Location: `backend/server.js`
- Triggers: Node.js process start
- Responsibilities:
  - Initialize Express app and Socket.io server
  - Set up CORS, middleware, rate limiters
  - Load all route modules
  - Start HTTP/WebSocket server on port 5000 (Docker: 8623)

**Frontend Entry Point:**
- Location: `frontend/src/main.tsx`
- Triggers: Browser loads app
- Responsibilities:
  - Bootstrap React + Vite
  - Initialize Capacitor for native features
  - Mount App.tsx

**App Root (Frontend):**
- Location: `frontend/src/App.tsx`
- Triggers: After Capacitor init
- Responsibilities:
  - Wrap with providers (AppContext, BadgeContext, LiveUpdateContext)
  - Render AppContent component
  - Check authentication status, render login or MainTabs accordingly

**Main Navigation (Frontend):**
- Location: `frontend/src/components/layout/MainTabs.tsx`
- Triggers: After user login
- Responsibilities:
  - Render tab bar with conditional navigation based on user role
  - Admin sees: Konfis, Activities, Events, Badges, Jahrgänge, Categories, Users, Organizations, Levels, Goals, Invites, Settings
  - Konfi sees: Dashboard, Events, Badges, Requests
  - Both see: Chat, Profile

## Error Handling

**Strategy:** Centralized error response format with role-aware messaging

**Patterns:**
- **API Errors:** All routes catch errors, return `{ error: 'German message' }` with status codes (400, 401, 403, 404, 500)
- **Database Errors:** Caught in route handlers, logged with context, generic message returned to client
- **Validation Errors:** Early return with 400 status and field-specific message
- **Auth Errors:** 401 for missing/invalid token, 403 for insufficient permissions
- **Rate Limit Errors:** 429 status with message (handled by express-rate-limit middleware)
- **Socket.io Errors:** Connection errors logged; client auto-reconnects with exponential backoff

**Frontend Error Handling:**
- API errors caught in axios interceptors
- 401 → automatic logout and redirect to login
- Network errors → UI shows toast or retry button
- WebSocket disconnection → auto-reconnect with visual feedback

## Cross-Cutting Concerns

**Logging:**
- Pattern: `console.log()` for info, `console.error()` for errors (no structured logging framework)
- Backend: Logs prefixed with context (e.g., "Socket.io Auth success", "RBAC login attempt")
- Frontend: Component lifecycle and data fetch logging

**Validation:**
- Pattern: Input validation in route handlers before DB operations
- Examples: Password strength (`validatePassword` in auth), email format, numeric IDs, enum values
- Database constraints: NOT NULL, FOREIGN KEY, UNIQUE indexes

**Authentication:**
- Pattern: JWT tokens with user ID and basic claims
- Token validation via `verifyTokenRBAC` middleware
- Token stored in localStorage (frontend) + Authorization header (requests)
- Token refresh: Not implemented (long-lived tokens)

**Authorization:**
- Pattern: RBAC middleware loads user role + organization, route handlers check permissions
- Organization scoping: Explicit `WHERE organization_id = user.organization_id` in queries
- Jahrgang access: Some routes check `user_jahrgang_assignments` for view/edit per jahrgang
- Super admin: Bypasses org check (role_name === 'super_admin' skips org validation)

**Real-time Updates:**
- Pattern: Socket.io rooms for broadcasting (e.g., `room_${chatRoomId}`, `user_${userId}`)
- Fallback: Client polls API if WebSocket unavailable
- Heartbeat: Socket.io ping/pong every 25 seconds to detect stale connections

**Rate Limiting:**
- General: 1000 req/15min per IP
- Auth (login): 10 attempts/15min per IP (brute-force protection)
- Register: 5 registrations/hour per IP (spam prevention)
- Chat messages: 30 messages/minute per user (flood protection)

---

*Architecture analysis: 2026-02-27*
