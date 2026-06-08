# External Integrations

**Analysis Date:** 2026-06-09

> Verified against current source (`backend/server.js`, `backend/createApp.js`,
> `backend/push/firebase.js`, `backend/services/*`, `frontend/src/main.tsx`).

## APIs & External Services

**Push Notifications:**
- Firebase Cloud Messaging (FCM) via `firebase-admin ^13.10.0`
  - Implementation: `backend/push/firebase.js` (`initializeFirebase`, `sendFirebasePushNotification`, `sendFirebaseSilentPush`)
  - Higher-level orchestration: `backend/services/pushService.js`, badge silent-push in `backgroundService.js`
  - Credentials: `backend/push/firebase-service-account.json` file (preferred) OR `FIREBASE_SERVICE_ACCOUNT` env (JSON string)
  - Covers iOS (APNs via FCM, `apns-push-type` alert/background) + Android (priority `high`, default channel)
  - Client side: `@capacitor/push-notifications` registers device tokens (stored in `push_tokens` table)

**Daily Bible Verse (Tageslosung):**
- Losungen API at `https://losung.konfi-quest.de/api/`
  - Implementation: `backend/services/losungService.js` (dynamic `node-fetch`, 5s timeout, DB-cached in `daily_verses`)
  - Auth: `LOSUNG_API_KEY` env var (query param `api_key`)
  - User-Agent: `Konfi-Quest-App/1.0`

**Web Fonts:**
- Google Fonts (Bebas Neue) - preconnect + stylesheet in `frontend/index.html`

## Data Storage

**Databases:**
- PostgreSQL (prod: `postgres:15-alpine`; CI/test: `postgres:16-alpine`)
  - Container in prod: `konfi_quest-postgres-1` (DB `konfi_db`, user `konfi_user`)
  - Connection: `DATABASE_URL` + `PGHOST/PGUSER/PGDATABASE/PGPASSWORD/PGPORT`
  - Client: `pg ^8.16.3` connection pool — `backend/database.js`
  - Pool tunables: `PG_POOL_MAX` (20), `PG_IDLE_TIMEOUT` (30s), `PG_CONN_TIMEOUT` (5s)
  - Migrations: file-based runner in `database.js` (`schema_migrations` table, sorted `backend/migrations/*.sql`)
  - Timezone: `Europe/Berlin` (TZ/PGTZ)

**File Storage:**
- Local filesystem via `multer ^2.1.1` — `backend/createApp.js`
  - Mounted volume `/opt/Konfi-Quest/uploads` -> `/app/uploads`
  - Three upload pipelines: `uploads/chat` (5MB), `uploads/material` (20MB), `uploads/requests` (images only, 5MB)
  - Filenames hashed (SHA-256 of timestamp+name+random) — original names not on disk
  - Magic-byte validation via `file-type ^22.0.1` (beyond declared MIME allowlist)

**Caching:**
- No external cache (no Redis/Memcached). In-DB cache for Losungen (`daily_verses`); LRU token-verify cache in RBAC middleware.

## Authentication & Identity

**Auth Provider:**
- Custom JWT (`jsonwebtoken ^9.0.2`), `JWT_SECRET` env (server exits if missing)
- HTTP auth: `verifyToken` + RBAC `verifyTokenRBAC(db)` — `backend/createApp.js`, `backend/middleware/rbac.js`
- Socket.IO auth: JWT in `socket.handshake.auth.token` — `backend/server.js`
- Roles: super_admin / org_admin / admin / teamer / konfi (role helpers `requireSuperAdmin/OrgAdmin/Admin/Teamer`)
- Passwords: `bcrypt ^6.0.0`. Token model: access 15min + refresh 90d rotating (per project notes)

## Realtime

**Socket.IO `^4.7.2`** (server `backend/server.js`, client `socket.io-client`):
- JWT-authenticated; org-isolated rooms (`room_{id}`, `user_{type}_{id}`)
- Events: `joinRoom`, `leaveRoom`, `typing`, `stopTyping` (each validates `organization_id`)
- CORS origins from `CORS_ORIGINS` (default `https://konfi-quest.de,https://www.konfi-quest.de`)
- DI wiring via `backend/utils/liveUpdate.js` (`liveUpdate.init(io)`)

## Monitoring & Observability

**Web Analytics:**
- Umami — script `https://t.godsapp.de/script.js`, website-id `dfd37276-5ad4-474d-8306-bf3ed9a3a5d3`
  - Loaded ONLY on web, never in native app: `frontend/src/main.tsx` (`Capacitor.isNativePlatform()` guard)
  - Deliberate: native app collects no analytics (store data-collection + minor protection)
- Uptime Kuma (`uptime.godsapp.de`) - external uptime monitoring (infra, per project notes)

**Error Tracking:**
- None (no Sentry/Rollbar). Errors via `console.error` + central Express error handler (`createApp.js`)

**Logs:**
- stdout/stderr to Docker; startup banner in `server.js` reports SMTP/Firebase/Background status

## Email (SMTP)

- `nodemailer ^8.0.10` — config + verify in `backend/server.js`, templates in `backend/services/emailService.js`
- Host `server.godsapp.de`, port `465` secure, user `team@konfi-quest.de` (env `SMTP_HOST/PORT/USER/PASS/SECURE`)
- `tls.rejectUnauthorized: false`
- Uses: password reset, invites, license-expiry reminder (`sendLicenseExpiryReminderEmail`, cron-driven)

## Scheduled Jobs (Cron / Intervals)

`backend/services/backgroundService.js` (`node-cron ^4.2.1` + setInterval, started in `server.js`):
- Badge updates — every 5 min (silent badge push + badge awarding)
- Event reminders — every 15 min (1-day & 1-hour before, dedup via `event_reminders`)
- Pending-events admin reminder — every 4 h
- Push-token cleanup — every 6 h (error_count>=10, >30d inactive, orphaned)
- Wrapped generation — `0 6 1 * *` (1st of month, Europe/Berlin)
- Auto-deletion (DSG-EKD) — `0 2 * * *` (soft @60d, hard cascade @120d)
- Trial-expiry + license reminders — `0 3 * * *`

## CI/CD & Deployment

**Source / Registry:**
- GitHub Actions `.github/workflows/ci.yml` (also `frontend.yml`)
  - Jobs: backend-test (Node 22 + postgres:16 service), frontend-test, build-and-push (matrix)
  - `npm audit --audit-level=critical` gate (backend hard, frontend non-blocking)
  - Builds & pushes `ghcr.io/<owner>/konfi-quest-{backend,frontend}:latest` + sha tag (buildx, gha cache)
  - Triggers Portainer webhook on backend image (`secrets.PORTAINER_WEBHOOK`)

**Hosting:**
- `server.godsapp.de` (Netcup), Docker. Stack `konfi_quest` (Portainer id 249) — NOT git-bound, no Watchtower
- Reverse proxy chain: Apache (KeyHelp, SSL/HSTS/CORS) -> Traefik (`8888`) -> containers
- Production deploy: GitHub Actions builds image -> pull image -> Portainer `update_stack` (manual pull required)

## Store Automation

- App Store Connect API (JWT signing via `asc-jwt.sh` toolkit) - iOS upload + listing/text updates
  - Apple App ID `6748016619`, bundle `de.godsapp.konfiquest`
- Google Play Developer API - AAB upload + listing (Python `:commit` workaround)
- Store assets / listings: `store-assets/` (`marketing-copy.md`, `STORE-LISTINGS.md`, screenshots, raw frames)

## Environment Configuration

**Required env vars (backend):**
- `JWT_SECRET` (mandatory), `DATABASE_URL` (+ `PGHOST/PGUSER/PGDATABASE/PGPASSWORD/PGPORT`)
- `SMTP_HOST/PORT/USER/PASS` (+ optional `SMTP_SECURE`), `LOSUNG_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT` (or service-account JSON file), `CORS_ORIGINS`, `PORT`

**Frontend:**
- `VITE_API_URL` (build-time, embedded by Vite)

**Secrets location:**
- Prod: injected via Portainer stack env / docker-compose
- Firebase: `backend/push/firebase-service-account.json` (gitignored)
- Android keystore: external (`~/Nextcloud/...`, `KONFI_*` env from secrets store)

## Webhooks & Callbacks

**Incoming:**
- Portainer redeploy webhook (called by GitHub Actions after backend build)

**Outgoing:**
- Push to FCM (Google) / APNs (Apple via FCM)
- Losungen API fetch (`losung.konfi-quest.de`)
- SMTP delivery (`server.godsapp.de:465`)

---

*Integration audit: 2026-06-09*
