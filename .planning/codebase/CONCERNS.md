# Codebase Concerns

**Analysis Date:** 2026-02-27

## Tech Debt

**Incomplete Badge Streak & Time-Based Calculation:**
- Issue: Streak calculation and time-based progress calculation are stubbed with TODO comments but not implemented
- Files: `backend/routes/konfi.js` (lines 962-970)
- Impact: Badge progress tracking for streak-based and time-based badges always shows 0% progress. Users cannot accurately track progress toward these badge types.
- Fix approach: Implement streak calculation logic (track consecutive completed activities) and time-based calculation (track time spent on activities). May require schema changes to track activity timestamps and streaks.

**SQL Injection Vulnerability in Dynamic Column Updates:**
- Issue: Template literal interpolation in UPDATE statements with unvalidated column names (`${pointField}`)
- Files: `backend/routes/activities.js` (lines 211, 275, 374, 406)
- Impact: While `pointField` is validated as either `gottesdienst_points` or `gemeinde_points` before use, the pattern is brittle and could become a vulnerability if refactored. Dynamic SQL construction is error-prone.
- Fix approach: Use CASE statements or parameterized queries instead of template literals. Example: `UPDATE konfi_profiles SET gottesdienst_points = CASE WHEN $3 = 'gottesdienst' THEN gottesdienst_points + $1 ELSE gottesdienst_points END WHERE user_id = $2`

**Deprecated Date Utilities Still Used:**
- Issue: `parseLocalTime` and `getLocalNow` are marked DEPRECATED but may still be referenced
- Files: `frontend/src/utils/dateUtils.ts` (lines 118, 127)
- Impact: These deprecated functions should be fully migrated away from to avoid future confusion and potential breakage
- Fix approach: Search codebase for all usages and migrate to the recommended replacements. Document the replacement pattern in CONVENTIONS.md.

**Unvalidated SQLite Migration References:**
- Issue: Code references `backup_sqlite/` directory as a fallback and reference point
- Files: `backend/` entire routes directory and CLAUDE.md (line 170)
- Impact: SQLite version is out of sync with PostgreSQL version. If PostgreSQL migration is incomplete or a developer references SQLite code, features may differ between versions.
- Fix approach: Complete full SQLite→PostgreSQL migration for all routes. Remove SQLite backup after verification or clearly document it as reference-only and frozen.

**Partially Migrated RBAC System:**
- Issue: Some systems (badges, statistics, organizations, auth) still need PostgreSQL migration from SQLite equivalents
- Files: See CLAUDE.md lines 153-158 for incomplete list
- Impact: Inconsistent schema patterns, unclear which code references old vs. new tables. Badge system uses potentially incomplete queries that may not filter by organization correctly.
- Fix approach: Follow systematic migration approach: complete badge system migration (next priority), then statistics, organizations, auth. Ensure each migration includes organization_id filtering.

## Known Bugs

**Poll-Voting 404 with Fallback Logic:**
- Symptoms: Poll votes return 404 initially because frontend sent message_id instead of poll_id
- Files: `backend/routes/chat.js` (poll voting implementation)
- Trigger: User votes on a poll in chat
- Workaround: Fallback-logic implemented in backend to accept both message_id and poll_id. Works but indicates schema design issue or poor API specification.
- Fix approach: Clarify chat schema (is poll_id or message_id primary?). Document API contract clearly. Consider removing fallback after confirming all frontend clients are updated.

**TabBar Effect Library Limitations (6+ tabs):**
- Symptoms: `registerTabBarEffect` from `@rdlabo/ionic-theme-ios26` fails on iOS with more than 5-6 tabs
- Files: `frontend/src/components/layout/MainTabs.tsx`
- Trigger: Render 6+ tabs on iOS device
- Workaround: Currently limit to 5-6 tabs or implement alternative tab styling for iOS
- Fix approach: Either migrate to stable tab library, use conditional rendering to hide tabs on iOS, or implement custom tab effect handling.

**Rate Limiter Blocking (15-min Cooldown):**
- Symptoms: After 10 failed login attempts, user is blocked for 15 minutes
- Files: `backend/server.js` (rate limiter configuration)
- Trigger: 10+ failed login attempts in short time window
- Workaround: Server restart resets limiter state (not recommended for production)
- Fix approach: Document rate limiter in frontend UI. Implement "account locked" notification. Consider persistent rate limiter (Redis) that survives server restarts.

**Badge Count Calculation Double-Addition Risk:**
- Symptoms: Bonus points may be counted twice if not handled carefully
- Files: `backend/routes/konfi.js` (dashboard endpoint), bonus point accumulation
- Trigger: Dashboard load after bonus point award
- Workaround: CLAUDE.md explicitly warns against double-counting
- Fix approach: Implement clear separation: `konfi_profiles.gottesdienst_points` = activity-only, separate `bonus_points` table for bonuses. Dashboard query must sum these separately.

**Missing Routes from SQLite Migration:**
- Symptoms: 4 routes missing from chat system (polls, files, etc.)
- Files: `backend/routes/chat.js` missing compared to `backend/backup_sqlite/routes/chat.js`
- Trigger: User attempts poll/file operations beyond basic voting
- Workaround: Routes were added from SQLite backup
- Fix approach: Complete feature parity audit between SQLite backup and PostgreSQL implementation.

## Security Considerations

**Organization-Based Access Control Gaps:**
- Risk: Multi-tenant system must filter all queries by organization_id, but not all routes enforce this consistently
- Files: Multiple backend routes, especially recently migrated ones
- Current mitigation: CLAUDE.md documents the security fix (July 2025), chat system now filters by organization_id
- Recommendations:
  1. Audit ALL routes for organization_id filtering in WHERE clauses
  2. Create automated test suite to verify organization isolation
  3. Add middleware that enforces organization_id validation on all queries
  4. Document organization_id filtering as required pattern in CONVENTIONS.md

**JWT Token Expiration (24 hours):**
- Risk: Long-lived tokens (24h) increase risk if token is compromised. No refresh token mechanism.
- Files: `backend/routes/auth.js` (line 90)
- Current mitigation: Tokens are transmitted over HTTPS only
- Recommendations:
  1. Implement refresh token mechanism with shorter access token lifetime (1-2 hours)
  2. Add token rotation on each refresh
  3. Implement token blacklist for logout
  4. Add device/user-agent validation to tokens

**Email Verification Not Implemented:**
- Risk: Users can register with invalid email addresses
- Files: `backend/routes/auth.js` (registration flow)
- Current mitigation: None
- Recommendations:
  1. Implement email verification flow
  2. Prevent password reset/notification delivery to unverified emails
  3. Add rate limiting on email verification attempts

**Push Notification Token Leakage:**
- Risk: Push notification tokens stored in push_tokens table without clear cleanup policy
- Files: `backend/services/pushService.js`, database schema
- Current mitigation: Tokens filtered by max(id) per device
- Recommendations:
  1. Implement token expiration (30-90 days)
  2. Add cleanup job for expired tokens
  3. Add user logout endpoint that invalidates push tokens
  4. Document token lifecycle clearly

**Firebase Admin Credentials:**
- Risk: Firebase credentials must be in environment or file not tracked in git
- Files: `backend/push/firebase.js` (loaded from env)
- Current mitigation: Credentials in .env file (not in git)
- Recommendations:
  1. Verify .gitignore includes firebase credentials
  2. Document credential setup in README
  3. Implement credential rotation mechanism
  4. Add monitoring for invalid/expired credentials

## Performance Bottlenecks

**Large Monolithic Route Files:**
- Problem: konfi.js (1,762 lines) and chat.js (1,730 lines) are too large for effective maintenance
- Files: `backend/routes/konfi.js`, `backend/routes/chat.js`, `backend/routes/events.js` (1,437 lines)
- Cause: Multiple features bundled in single module. Middleware, helpers, and main handlers mixed together.
- Improvement path:
  1. Break konfi.js into: dashboard.js, points.js, badges.js, levels.js
  2. Break chat.js into: messages.js, rooms.js, participants.js, polls.js
  3. Extract utility functions to separate utils files
  4. Create separate middleware files per domain

**N+1 Query Problem in Dashboard:**
- Problem: Badge progress calculation runs separate query for each badge (lines 953-980 in konfi.js)
- Files: `backend/routes/konfi.js` (dashboard endpoint)
- Cause: Loop over badges array, querying database in each iteration
- Improvement path:
  1. Consolidate badge progress queries using SQL window functions or CTEs
  2. Fetch all badge progress in single query with LEFT JOINs
  3. Cache badge configuration (rarely changes)

**Redundant Organization Filtering:**
- Problem: Complex dynamic SQL generation for organization_id filtering on each request
- Files: `backend/middleware/rbac.js` (line 35: `${placeholders}.map...` pattern)
- Cause: Database queries need to filter by user's assigned jahrgänge
- Improvement path:
  1. Cache user's assigned jahrgänge in JWT token (if small)
  2. Use database-level row-level security (RLS) instead of manual filtering
  3. Create materialized view for user→jahrgang→organization relationships

**Unindexed Foreign Keys in Queries:**
- Problem: Many WHERE clauses filtering by `user_id`, `konfi_id`, `organization_id` without confirmed indexes
- Files: Entire backend (check database.js)
- Cause: Database schema may be missing indexes on frequently queried columns
- Improvement path:
  1. Run EXPLAIN ANALYZE on slow queries
  2. Add indexes on: organization_id, jahrgang_id, konfi_id, user_id for all tables
  3. Monitor query performance in production
  4. Consider connection pooling optimization

**Frontend Context Re-renders on Every Update:**
- Problem: AppContext may trigger re-renders on every state update affecting entire app
- Files: `frontend/src/contexts/AppContext.tsx` (630 lines)
- Cause: Single context for all app state without value memoization
- Improvement path:
  1. Split AppContext into multiple contexts (auth, user, organization, ui)
  2. Wrap context values in useMemo to prevent unnecessary re-renders
  3. Use useCallback for context-updating functions
  4. Consider Redux or Zustand for complex state

## Fragile Areas

**Chat Room Membership Synchronization:**
- Files: `backend/routes/chat.js` (lines 16-71: ensureAdminJahrgangChatMembership)
- Why fragile: Complex logic auto-adds/removes admins from jahrgang chats based on assignments. If jahrgang assignment is deleted but admin is still in chat, sync may fail silently.
- Safe modification:
  1. Add tests verifying all admin→jahrgang→chat transitions
  2. Add logging of sync operations
  3. Implement idempotent operations (safe to run multiple times)
- Test coverage: Likely missing integration tests for admin assignment changes

**Badge Award Logic:**
- Files: `backend/routes/konfi.js` (checkAndAwardBadges function)
- Why fragile: Award logic needs to check criteria, update badges table, verify org_id. If schema changes (new badge type), logic breaks.
- Safe modification:
  1. Create badge award service class (like PushService)
  2. Add comprehensive test suite for each badge criteria type
  3. Document all badge criteria types and their logic
- Test coverage: No tests visible for badge awarding

**Event Booking with Waitlist:**
- Files: `backend/routes/events.js` (1,437 lines of event logic)
- Why fragile: Complex state machine (available→booked→waitlisted) with slot management. Concurrent bookings could cause race conditions.
- Safe modification:
  1. Use database transactions (already in use)
  2. Add pessimistic locking if high concurrency expected
  3. Document state transitions clearly
- Test coverage: Unknown if concurrent booking tests exist

**Modal System in Frontend:**
- Files: `frontend/src/components/**/*Modal.tsx` (20+ modal files)
- Why fragile: CLAUDE.md shows old pattern deprecated. Some modals may still use `isOpen={state}` pattern
- Safe modification:
  1. Audit all modals for isOpen vs useIonModal pattern
  2. Create modal component wrapper enforcing correct pattern
  3. Add linter rule to catch old pattern
- Test coverage: No visual regression tests for modals

## Scaling Limits

**PostgreSQL Connection Pool:**
- Current capacity: Limited by pool size in database.js (default pg pool ~10 connections)
- Limit: If concurrent requests exceed pool size, they queue indefinitely
- Scaling path:
  1. Configure pool size based on max expected concurrent requests
  2. Monitor connection usage in production
  3. Implement connection pooling service (pgBouncer) if needed
  4. Add queue timeout to fail fast instead of hanging

**Chat Message Storage:**
- Current capacity: All messages stored in PostgreSQL (unlimited theoretically)
- Limit: Query performance degrades as chat_messages table grows. Pagination is required.
- Scaling path:
  1. Implement message pagination/infinite scroll (likely already done)
  2. Archive old messages after 1-2 years
  3. Consider separate document DB (MongoDB) for message history
  4. Implement full-text search for message search feature

**Firebase Push Notification Queue:**
- Current capacity: Serial processing (one notification at a time per user)
- Limit: If many users need notifications, delivery is delayed
- Scaling path:
  1. Implement batch sending (Firebase supports bulk operations)
  2. Use message queue (Redis, RabbitMQ) for async notification dispatch
  3. Monitor Firebase API rate limits
  4. Implement exponential backoff for failed sends

**User Count in Organization:**
- Current capacity: No documented limits
- Limit: Complex queries may timeout with thousands of users per organization
- Scaling path:
  1. Implement pagination on user lists
  2. Add search/filter optimization
  3. Cache frequently accessed user lists
  4. Consider denormalization if user lists queried frequently

## Dependencies at Risk

**Vulnerable Dependency: express-rate-limit:**
- Risk: Rate limiter state is in-memory, lost on server restart. No documented minimum version.
- Impact: Users blocked for 15 minutes have no way to unblock except wait or admin intervention
- Migration plan: Upgrade to version with Redis backing. Implement external cache-based rate limiting. Add admin override endpoint.

**Fragile Dependency: @rdlabo/ionic-theme-ios26:**
- Risk: Undocumented library, not maintained, fails with 6+ tabs
- Impact: iOS tab bar breaks on complex layouts
- Migration plan: Replace with stable tab solution or implement custom iOS tab styling

**Firebase SDK Dependency:**
- Risk: Version compatibility with React 19 unclear
- Impact: Push notifications break if Firebase SDK isn't compatible
- Migration plan: Verify Firebase SDK supports React 19. Test with latest versions in staging.

**Outdated Multer Configuration:**
- Risk: `legacyHeaders: false` set on 6 different endpoints, inconsistent approach
- Impact: Unclear what headers are expected, file upload may fail with certain clients
- Migration plan: Centralize upload configuration, use consistent middleware

## Missing Critical Features

**Offline Support:**
- Problem: No offline-first features for mobile app. Users need continuous connectivity.
- Blocks: Mobile app reliability, user experience on poor networks
- Priority: Medium (nice-to-have for mobile app)

**Email Notifications:**
- Problem: Only push notifications supported. Email notifications not implemented.
- Blocks: Users on Android devices without Firebase may not receive notifications
- Priority: High (accessibility feature)

**Audit Logging:**
- Problem: No centralized audit log for admin actions (points awarded, activities deleted, etc.)
- Blocks: Compliance, debugging, security investigations
- Priority: High (compliance/legal requirement)

**Data Export:**
- Problem: No bulk data export for users or admins. No GDPR data export endpoint.
- Blocks: GDPR compliance, user data portability
- Priority: High (legal requirement)

**API Documentation:**
- Problem: No OpenAPI/Swagger documentation. API endpoints not documented.
- Blocks: Third-party integrations, client development, maintenance
- Priority: Medium (developer experience)

## Test Coverage Gaps

**Auth System Testing:**
- What's not tested: Token refresh, password reset flow, email verification
- Files: `backend/routes/auth.js` (all password/email flows)
- Risk: Auth bugs in production would break user access
- Priority: Critical - add comprehensive auth test suite

**Badge Awarding Logic:**
- What's not tested: All badge criteria types, edge cases (user already has badge, etc.)
- Files: `backend/routes/konfi.js` (checkAndAwardBadges)
- Risk: Badges awarded incorrectly or not awarded when earned
- Priority: High - badges are core gamification

**Chat Organization Isolation:**
- What's not tested: Multi-organization chat room access, organization boundary enforcement
- Files: `backend/routes/chat.js` (entire org filtering)
- Risk: Users from one org could access chats from another org
- Priority: Critical - security vulnerability

**Event Booking Race Conditions:**
- What's not tested: Concurrent bookings, slot exhaustion, waitlist promotion
- Files: `backend/routes/events.js` (booking logic)
- Risk: Overbooking or wrong waitlist behavior
- Priority: High - business logic correctness

**Frontend Integration Tests:**
- What's not tested: Modal flows, form submissions, error handling
- Files: `frontend/cypress/e2e/test.cy.ts` (appears minimal)
- Risk: UI bugs ship to production without detection
- Priority: Medium - frontend stability

**Database Migration Tests:**
- What's not tested: SQLite→PostgreSQL data integrity, no lost records
- Files: No visible migration tests
- Risk: Data loss or corruption during migration
- Priority: Critical - data integrity

---

*Concerns audit: 2026-02-27*
