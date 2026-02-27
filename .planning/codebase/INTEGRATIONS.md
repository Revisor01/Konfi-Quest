# External Integrations

**Analysis Date:** 2026-02-27

## APIs & External Services

**Push Notifications:**
- **Firebase Cloud Messaging (FCM)** - Mobile push notifications
  - SDK/Client: `firebase-admin` 12.7.0 (backend only)
  - Auth: Service account JSON file at `backend/push/firebase-service-account.json`
  - Email: firebase-adminsdk-fbsvc@konfiquest-push.iam.gserviceaccount.com
  - Supports: iOS (APNS) and Android (FCM)
  - Implementation: `backend/push/firebase.js` exports `sendFirebasePushNotification()`
  - Backend routes: `/routes/notifications.js` handles push requests

**Email/SMTP:**
- **server.godsapp.de** - SMTP relay server
  - Port: 465 (TLS)
  - Auth: team@konfi-quest.de
  - Implementation: `backend/server.js` - nodemailer transporter
  - Hostname validation disabled for Docker (IP-based connection)
  - Configuration: `SMTP_CONFIG` in server.js

## Data Storage

**Databases:**
- **PostgreSQL** 15-alpine
  - Host: postgres (Docker internal) or 127.0.0.1 (local)
  - Port: 5432
  - Database: konfi_db
  - User: konfi_user
  - Connection: Environment variable `DATABASE_URL` or `PG*` vars
  - Client: `pg` library (8.16.3) - no ORM, raw SQL queries
  - Init scripts: `./init-scripts/` (Docker entrypoint)
  - Data persistence: `./postgres/` volume

**File Storage:**
- **Local filesystem only** - No cloud storage integration
  - Chat uploads: `uploads/chat/` (Docker volume mounted)
  - Activity request uploads: `uploads/requests/`
  - General uploads: `uploads/`
  - Max file size: 5MB
  - Encrypted filenames: MD5 hash of timestamp + filename + random

**Caching:**
- **None detected** - No Redis, Memcached, or other caching layer

## Authentication & Identity

**Auth Provider:**
- **Custom JWT implementation** - No external auth (Authentik or OAuth)
  - Issuer: Self-signed via backend
  - Secret: `process.env.JWT_SECRET`
  - Implementation: `backend/routes/auth.js`
  - Flow: Username/password → bcrypt compare → JWT token issued
  - Client storage: localStorage key `konfi_token`
  - Token injection: axios interceptor in `frontend/src/services/api.ts`
  - Socket.io auth: Token passed in socket handshake

**Password Security:**
- bcrypt 5.1.1 for hashing
- Rounds: Default bcrypt settings (typically 10)

## Monitoring & Observability

**Error Tracking:**
- **None detected** - No Sentry, Bugsnag, or error aggregation service

**Logs:**
- **Console logging** - stdout/stderr only
  - Socket.io connection events
  - Database connection status
  - SMTP verification
  - API request logging (partial)
  - No persistent log storage detected

**Health Checks:**
- Backend Docker healthcheck: `node healthcheck.js` (30s interval)
- PostgreSQL healthcheck: `pg_isready` (10s interval)

## CI/CD & Deployment

**Hosting:**
- **Docker** on server.godsapp.de (Hetzner)
  - Deployment path: `/opt/Konfi-Quest/`
  - Docker Compose orchestration
  - Watchtower auto-updates **disabled** (labels set to false)

**CI Pipeline:**
- **None detected** - Manual deployment via SSH
  - Process: SSH to server → git pull → docker-compose down → docker-compose up -d --build
  - No GitHub Actions, GitLab CI, or Jenkins

**Reverse Proxy:**
- **Apache** (via KeyHelp panel) on server.godsapp.de
  - Custom vhost config at: `/etc/apache2/keyhelp/custom_vhosts/`
  - SSL/HTTPS: Handled by Apache + ACME (Let's Encrypt)
  - Domain: konfi-quest.de
  - Port mapping: Apache 443 → Traefik 8888 → Docker containers
  - Or direct: Apache 443 → backend 8623, frontend 8624

**Internal Infrastructure:**
- **Traefik** 8888 (optional reverse proxy within Docker)
  - Acts as service mesh/router if used
  - Not strictly required for basic setup

## Environment Configuration

**Required env vars (Production):**
1. `JWT_SECRET` - **CRITICAL** - Application crashes without it
2. `DATABASE_URL` - PostgreSQL connection string
3. `SMTP_USER` - Email sender account
4. `SMTP_PASS` - Email password

**Optional env vars:**
- `NODE_ENV` - production/development (default: production in Docker)
- `PORT` - Express port (default 5000)
- `CORS_ORIGINS` - Comma-separated allowed origins
- `FIREBASE_SERVICE_ACCOUNT` - JSON-encoded (if not using file)
- `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, `PGPORT` - Individual PG params

**Secrets location:**
- Production: Docker Compose env section in `/opt/Konfi-Quest/docker-compose.yml`
- Development: `.env` file (not tracked in git)
- Service account: `backend/push/firebase-service-account.json` (not tracked, secret)
- Do NOT commit: `docker-compose.yml` with inline secrets to production repos

## Webhooks & Callbacks

**Incoming Webhooks:**
- **None detected** - No Stripe, PayPal, or external service callbacks

**Outgoing Webhooks:**
- **Chat system** - Socket.io events (real-time, not HTTP webhooks)
  - `newMessage` - broadcasted to room
  - `messageDeleted` - broadcasted to room
  - `pollVote` - broadcasted to room
  - `userTyping` - sent to specific users
  - See `backend/routes/chat.js` for event handlers

**Email Sending:**
- Triggered by backend routes via nodemailer
- Password reset emails
- Invitation emails
- Notification emails

## Real-time Communication

**WebSocket (Socket.io):**
- **Version**: socket.io 4.7.2 (backend), 4.8.1 (frontend)
- **URL**: https://konfi-quest.de (shared with HTTP API)
- **Transport fallback**: WebSocket → Long-polling
- **Authentication**: JWT token in socket handshake
  - Middleware: JWT verification in server.js line 55-73
- **Rooms**: User joins `user_{type}_{id}` automatically (global notifications)
- **Chat rooms**: Explicit `joinRoom`/`leaveRoom` events
- **CORS**: Built-in via Socket.io (not Apache)
- **Ping/Pong**: 25s interval, 60s timeout

**Event types emitted:**
- `connection` / `disconnect` - Connection lifecycle
- `joinRoom` / `leaveRoom` - Room membership
- `newMessage` / `messageDeleted` / `pollVote` - Chat events
- `userTyping` - Typing indicator
- `notification` - Server-to-client notifications
- See `backend/server.js` lines 76+ for socket handler setup

## Third-party Libraries (No External APIs)

These are included in package.json but don't connect to external services:

- **ionicons** - Icon library (static, no API)
- **qrcode** - QR code generation (local, no API)
- **multer** - File upload middleware
- **express-rate-limit** - Rate limiting (in-memory)
- **cors** - CORS middleware (currently disabled, Apache handles it)

## Security Considerations

**HTTPS/TLS:**
- Enforced by Apache reverse proxy (Let's Encrypt via ACME)
- Backend runs on localhost only (127.0.0.1)
- Socket.io inherits Apache's HTTPS

**Rate Limiting:**
- Auth: 10 requests / 15 minutes
- File uploads: 30 requests / 15 minutes
- General: 100 requests / 15 minutes

**CORS:**
- Apache configured with custom vhost
- Socket.io: Origins: https://konfi-quest.de, https://www.konfi-quest.de

**Password Hashing:**
- bcrypt (5.1.1) - industry standard

**File Upload Security:**
- MIME type whitelist (no executables)
- Encrypted filenames (no predictable paths)
- Stored outside web root (served through protected endpoints)

---

*Integration audit: 2026-02-27*
