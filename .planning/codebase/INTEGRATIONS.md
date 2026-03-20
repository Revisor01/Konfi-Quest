# External Integrations

**Analysis Date:** 2026-03-20

## APIs & External Services

**Push Notifications:**
- Firebase Cloud Messaging (FCM) / APNs — native Push-Benachrichtigungen für iOS und Android
  - SDK/Client: `firebase-admin` 13.7 (Backend), `@capacitor/push-notifications` 7.0 (Frontend)
  - Konfiguration: Service-Account-Datei `backend/push/firebase-service-account.json` oder Env-Var `FIREBASE_SERVICE_ACCOUNT`
  - Implementierung: `backend/push/firebase.js` (Initialisierung + Versand), `backend/services/pushService.js` (20 Push-Types)
  - Frontend-Registrierung: `frontend/src/contexts/AppContext.tsx` (FCM-Token-Empfang via Capacitor + Senden an `/api/notifications/device-token`)
  - Hintergrund-Service: `backend/services/backgroundService.js` (Badge-Updates alle 5 Minuten, Event-Erinnerungen)

**E-Mail (SMTP):**
- Eigener SMTP-Server auf `server.godsapp.de` (Port 465, SSL)
  - SDK/Client: `nodemailer` 8.0
  - Auth: Env-Vars `SMTP_USER`, `SMTP_PASS` (Default-Absender: `team@konfi-quest.de`)
  - Implementierung: `backend/services/emailService.js` (gecachter Transporter), eingebunden in `backend/server.js`
  - Verwendung: Passwort-Reset, Einladungen, Konfi-Registrierungsbestätigung

## Data Storage

**Databases:**
- PostgreSQL 15 (Docker-Container: `postgres:15-alpine`)
  - Connection: Env-Var `DATABASE_URL` (Format: `postgresql://user:pass@host:5432/db`) oder individuelle `PG*`-Vars
  - Client: `pg` 8.16 (Pool-basiert), keine ORM — reines SQL
  - Pool-Konfiguration: `backend/database.js`
  - Schema-Init: `init-scripts/01-create-schema.sql`
  - Migrations: `backend/migrations/` (manuelle SQL-Dateien: `add_invite_codes.sql`, `add_push_foundation.sql`)
  - Daten-Volume: `/opt/Konfi-Quest/postgres` (Produktionsserver)

**SQLite (Legacy):**
- Noch als Abhängigkeit (`sqlite3` 5.1) im `backend/package.json`, aber nur für `backend/backup_sqlite/` — nicht im aktiven Betrieb

**File Storage:**
- Lokales Dateisystem (kein S3 / Cloud-Storage)
  - Upload-Verzeichnis: `backend/uploads/` (Produktions-Volume: `/opt/Konfi-Quest/uploads`)
  - Unterverzeichnisse: `uploads/requests/` (Aktivitätsanträge), `uploads/chat/` (Chat-Anhänge), `uploads/material/` (Kursmaterial)
  - Dateinamen: MD5-Hash-basiert (verschleiert), keine Original-Dateinamen
  - Limits: Chat/Requests 5 MB, Material 20 MB
  - Zugriff: Ausschließlich über geschützte API-Endpoints (kein statisches Serving)

**Caching:**
- Kein dedizierter Cache-Dienst (kein Redis/Memcached)
- In-Memory-Caching: Nodemailer-Transporter (`emailService.js`), Firebase-App-Instanz (`firebase.js`)

## Authentication & Identity

**Auth Provider:**
- Custom JWT — kein externer Auth-Provider
  - JWT-Erstellung: `backend/routes/auth.js`
  - JWT-Verifikation: `backend/middleware/rbac.js` (`verifyTokenRBAC`)
  - Secret: Env-Var `JWT_SECRET` (PFLICHTFELD)
  - Token-Speicherung Frontend: `localStorage` (`konfi_token`, `konfi_user`)
  - RBAC-Rollen: `super_admin` (5), `org_admin` (4), `admin` (3), `teamer` (2), `konfi` (1)
  - Socket.IO nutzt dasselbe JWT für WebSocket-Authentifizierung (`backend/server.js` Z. 52–68)

## Monitoring & Observability

**Error Tracking:**
- Keines — kein Sentry, Datadog o.Ä. integriert

**Logs:**
- `console.log/warn/error` direkt (kein strukturiertes Logging-Framework)
- Uptime-Monitoring: Uptime Kuma (`https://uptime.godsapp.de`) — externes Monitoring des Health-Endpoints `GET /api/health`

**Health Check:**
- `backend/healthcheck.js` — wird vom Docker-HEALTHCHECK-Befehl alle 30 Sekunden aufgerufen

## CI/CD & Deployment

**Hosting:**
- Hetzner VPS `server.godsapp.de` (IP: 213.109.162.132)
- Docker-Compose-Stack (Portainer-verwalteter Stack): `portainer-stack.yml`
  - Services: `postgres` (intern Port 5432), `backend` (extern 8623:5000), `frontend` (extern 8624:80)

**Container Registry:**
- GitHub Container Registry (GHCR): `ghcr.io/revisor01/konfi-quest-backend:latest`, `ghcr.io/revisor01/konfi-quest-frontend:latest`

**CI Pipeline:**
- GitHub Actions: `.github/workflows/backend.yml`, `.github/workflows/frontend.yml`
  - Backend: Automatisch bei Push auf `main` wenn `backend/**` geändert → Docker-Build → GHCR-Push → Portainer-Webhook
  - Frontend: Nur manuell (`workflow_dispatch`) → Docker-Build → GHCR-Push → Portainer-Webhook
- Portainer-Webhook: Secret `PORTAINER_WEBHOOK` (GitHub Secrets) — triggert automatisches Re-Deploy

**Reverse Proxy:**
- Apache (KeyHelp) auf Port 443 → Traefik auf `127.0.0.1:8888` → Backend (8623) / Frontend (8624)
- HTTPS und HSTS: Von Apache/KeyHelp-ACME verwaltet (nicht im App-Code)

## WebSocket (Echtzeit)

**Server:** Socket.IO 4.7 — eingebettet in Express-HTTP-Server (`backend/server.js`)
- Authentifizierung: JWT via `socket.handshake.auth.token`
- Rooms: User-Rooms (`user_{type}_{id}`) für persönliche Benachrichtigungen, Chat-Rooms (`room_{id}`)
- Events: `joinRoom`, `leaveRoom`, `typing`, `stopTyping`, `userTyping`, `userStoppedTyping`
- Global exportiert als `global.io` für Nutzung in Route-Handlern

**Client:** Socket.IO Client 4.8 — `frontend/src/services/websocket.ts`
- URL: `https://konfi-quest.de` (hardcodiert)
- Transports: WebSocket (primär), Polling (Fallback)
- Reconnection: Bis zu 10 Versuche

## QR-Code

**Generierung:** `qrcode` 1.5 (Frontend) — für Event-Check-In-Codes
**Scan:** `qr-scanner` 1.4 (Frontend) + `@capacitor/camera` — für nativen QR-Scan

## Environment Configuration

**Pflicht-Env-Vars (Backend):**
- `JWT_SECRET` — Server startet nicht ohne diesen Wert
- `DATABASE_URL` — PostgreSQL Connection String
- `SMTP_USER`, `SMTP_PASS` — E-Mail-Versand

**Optionale Env-Vars (Backend):**
- `SMTP_HOST` (Default: `213.109.162.132`), `SMTP_PORT` (Default: `465`), `SMTP_SECURE`
- `CORS_ORIGINS` (Default: `https://konfi-quest.de,https://www.konfi-quest.de`)
- `PORT` (Default: `5000`)
- `FIREBASE_SERVICE_ACCOUNT` (alternativ zu `backend/push/firebase-service-account.json`)
- `NODE_ENV`

**Secrets-Speicherort:**
- Produktions-Secrets: Im Portainer-Stack (Umgebungsvariablen des Containers)
- Firebase-Credentials: `backend/push/firebase-service-account.json` (NICHT committen) oder Env-Var

## Webhooks & Callbacks

**Incoming (von GitHub Actions):**
- Portainer-Webhook-URL (Secret `PORTAINER_WEBHOOK`) — triggert Stack-Update nach Image-Push

**Outgoing:**
- Keine ausgehenden Webhooks an externe Dienste

---

*Integrations-Analyse: 2026-03-20*
