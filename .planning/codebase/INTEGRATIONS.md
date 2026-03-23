# External Integrations

**Analysis Date:** 2026-03-23

## APIs & External Services

**Daily Bible Verse (Losung):**
- Service: Custom Losungen API at `https://losung.konfi-quest.de/api/`
- Purpose: Fetches the daily Herrnhuter Losung (Bible verse of the day)
- SDK/Client: Native `node-fetch` (dynamic import in backend)
- Auth: API key via env var `LOSUNG_API_KEY`
- Caching: Results cached in PostgreSQL table `daily_verses` (keyed by date + translation)
- Endpoints: `backend/routes/konfi.js` (line ~1405) and `backend/routes/teamer.js` (line ~742)
- Translations: LUT (Lutherbibel default), selectable per Konfi profile

**Firebase Cloud Messaging (FCM):**
- Service: Google Firebase Admin SDK
- Purpose: Push notifications to iOS and Android devices
- SDK/Client: `firebase-admin` ^13.7.0 (backend)
- Auth: Service account JSON from `backend/push/firebase-service-account.json` or env var `FIREBASE_SERVICE_ACCOUNT`
- Implementation: `backend/push/firebase.js` — `sendFirebasePushNotification()`, `sendFirebaseSilentPush()`
- Wrapper: `backend/services/pushService.js` — `PushService` class with 20+ typed notification methods
- Native receiving: `@capacitor/push-notifications` ^7.0.6 (frontend)
- Token storage: PostgreSQL table `push_tokens` (user_id, platform, device_id, token)
- Notification types: chat, badge_update, activity requests, badge earned, level up, event reminders, waitlist promotion, event cancellation, new events, and more

## Data Storage

**Databases:**
- Type: PostgreSQL 15 (Alpine Docker image)
- Connection env var: `DATABASE_URL` (e.g., `postgresql://konfi_user:...@postgres:5432/konfi_db`)
- Client: `pg` ^8.16.3 — connection pool via `backend/database.js`
- Pool config: max 20 connections (configurable via `PG_POOL_MAX` for EKD-scale)
- Migrations: SQL files in `backend/migrations/`, auto-applied at startup via `runMigrations()` in `database.js`
- Migration tracking: `schema_migrations` table (idempotent, filename-based)
- Production data path: `/opt/Konfi-Quest/postgres` (bind mount on Hetzner server)

**Offline Cache (Frontend):**
- Storage: `@capacitor/preferences` (wraps native iOS NSUserDefaults / Android SharedPreferences)
- Implementation: `frontend/src/services/offlineCache.ts`
- Pattern: SWR (stale-while-revalidate) via `useOfflineQuery` hook (`frontend/src/hooks/useOfflineQuery.ts`)
- TTL ranges: 2 min (chat rooms) to 24h (daily verse)

**WriteQueue (Frontend):**
- Storage: `@capacitor/preferences` (key: `queue:items`)
- Implementation: `frontend/src/services/writeQueue.ts`
- Purpose: FIFO persistent queue for offline mutations — flushes on reconnect

**File Storage:**
- Uploads: Local filesystem, path `/opt/Konfi-Quest/uploads` (bind-mounted into backend container)
- Served via: Express static or multer (backend)
- Upload handler: `multer` ^2.1.1

**Caching:**
- Server-side: PostgreSQL table `daily_verses` for Losung responses
- Client-side: `@capacitor/preferences`-backed TTL cache (offlineCache)

## Authentication & Identity

**Auth Provider:**
- Custom JWT-based auth (no third-party identity provider)
- Implementation: `backend/middleware/rbac.js` — `verifyTokenRBAC` middleware
- JWT: `jsonwebtoken` ^9.0.2, signed with `JWT_SECRET`
- Token lifecycle: Access token 15 min, Refresh token 90 days (rotating)
- Soft-revoke: `token_invalidated_at` column in `users` table
- Password: bcrypt hashing via `bcrypt` ^5.1.1
- Frontend token storage: `frontend/src/services/tokenStore.ts` — sync memory getter + async `@capacitor/preferences` setter

**Role Hierarchy (RBAC):**
- `super_admin` (5) — cross-organization, org management only
- `org_admin` (4) — full rights within own organization
- `admin` (3) — Konfis, events, badges, activities, requests
- `teamer` (2) — view Konfis/events, award points
- `konfi` (1) — own data only

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry, Datadog, or similar)

**Logs:**
- `console.log` / `console.error` / `console.warn` throughout backend
- Docker container logs accessible via Portainer on `https://docker.godsapp.de`

**Uptime:**
- Uptime Kuma at `https://uptime.godsapp.de`

**Health Check:**
- Backend: `backend/healthcheck.js` (used in Docker)
- PostgreSQL: `pg_isready` health check in `portainer-stack.yml`

## CI/CD & Deployment

**Hosting:**
- Server: Hetzner VPS `server.godsapp.de` (IP: 213.109.162.132)
- Docker images published to GitHub Container Registry: `ghcr.io/revisor01/konfi-quest-*`
- Container orchestration: Portainer (auto-deploy on image push)
- Reverse proxy chain: Apache (KeyHelp) → Traefik (port 8888) → Docker containers

**CI Pipeline:**
- Not detected locally; assumed GitHub Actions publishes images to ghcr.io

**Deployment:**
- `git push` triggers Portainer to pull latest images and redeploy
- Never use `docker-compose` commands manually on server (Portainer manages lifecycle)

## Email

**Provider:**
- Self-hosted SMTP on `server.godsapp.de` (port 465, TLS)
- Sender: `team@konfi-quest.de`
- Client: `nodemailer` ^8.0.2
- Implementation: `backend/services/emailService.js`
- Config env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- Uses: Password reset, account notifications

## Real-Time Communication

**WebSocket:**
- Server: Socket.IO 4.7.2 on backend Express server
- Client: `socket.io-client` 4.8.1 in frontend
- URL: `https://konfi-quest.de` (hardcoded, not env var)
- Auth: JWT token passed via `socket.handshake.auth.token`
- Transports: WebSocket first, polling fallback
- Organization isolation: Sockets join org-scoped rooms
- Reconnect sync: flushes WriteQueue → invalidates cache → refreshes badges

## Scheduled Jobs

**Background Service:**
- Implementation: `backend/services/backgroundService.js` using `node-cron` ^3.0.3
- Jobs:
  - Badge updates for all users: every 5 minutes (setInterval)
  - Event reminders: cron-scheduled
  - Pending events approval: cron-scheduled
  - Push token cleanup: cron-scheduled
  - Wrapped generation: cron-scheduled (via `wrappedCronTask`)

## QR Codes

**Generation:**
- `qrcode` ^1.5.4 (frontend)
- Purpose: Event check-in, Konfi registration codes

**Scanning:**
- `qr-scanner` ^1.4.2 (frontend camera-based scanning)

## Share / Export

**Native Share:**
- `@capacitor/share` ^7.0.4 — triggers OS share sheet
- `html-to-image` ^1.11.13 — renders Wrapped slides as images for sharing

## Environment Configuration

**Required env vars (backend):**
- `JWT_SECRET` — mandatory, no default, process exits without it
- `DATABASE_URL` — PostgreSQL connection string
- `SMTP_USER`, `SMTP_PASS` — email credentials
- `LOSUNG_API_KEY` — daily Bible verse API
- `FIREBASE_SERVICE_ACCOUNT` — if no service account JSON file present

**Secrets location:**
- Service account file: `backend/push/firebase-service-account.json` (not committed)
- All other secrets: Docker environment variables (set via Portainer stack config)

## Webhooks & Callbacks

**Incoming:**
- None detected (no Stripe webhooks, no OAuth callbacks from external providers)

**Outgoing:**
- FCM push via Firebase Admin SDK (not a webhook)
- SMTP email via Nodemailer (not a webhook)

---

*Integration audit: 2026-03-23*
