# External Integrations

**Analysis Date:** 2026-03-22

## APIs & External Services

**Push Notifications:**
- Firebase Cloud Messaging (FCM) - Push Notifications für iOS und Android
  - SDK/Client: `firebase-admin` 13.7.0 (Backend)
  - Client-Side: `@capacitor/push-notifications` 7.0.6 (Frontend)
  - Implementation: `backend/push/firebase.js` — sendet Alert-Pushes und Silent Pushes (Badge-Updates)
  - Auth: Service Account JSON via `backend/push/firebase-service-account.json` (bevorzugt) oder `FIREBASE_SERVICE_ACCOUNT` Env-Variable
  - Notification Types: chat, badge_update, activity_assigned, badge_earned, bonus_points, event_registered, level_up, event_reminder u.v.m. — vollständige Liste in `backend/services/pushService.js`

**App Badge:**
- `@capawesome/capacitor-badge` 7.0.1 - Zeigt App-Icon-Badge auf iOS/Android
  - Config: `frontend/capacitor.config.ts` (persist: true, autoClear: false)

**File Viewing:**
- `@capacitor/file-viewer` 1.0.7 + `@capacitor-community/file-opener` 7.0.1 - Öffnet Dateien nativ auf dem Gerät
- `@capacitor/share` 7.0.4 - Native Share-Sheet

## Data Storage

**Databases:**
- PostgreSQL 15-alpine (Primary Database)
  - Connection: `DATABASE_URL` Env-Variable (Connection String) oder `PGHOST`/`PGUSER`/`PGDATABASE`/`PGPASSWORD`/`PGPORT`
  - Client: `pg` 8.16.3 mit Connection Pool (`backend/database.js`)
  - Container: `konfi-quest-db` Docker-Container
  - Data: `/opt/Konfi-Quest/postgres` (Server-Volume)
  - Init-Scripts: `init-scripts/` (SQL-Schemas beim ersten Start)
  - Migrations: `backend/migrations/*.sql` (manuell anzuwenden)
  - Tabellen: users, konfi_profiles, konfi_activities, bonus_points, konfi_badges, event_bookings, chat_rooms, chat_messages, chat_participants, push_tokens, organizations, roles, jahrgaenge, activities, badges, events, levels, materials, refresh_tokens

- SQLite (Legacy/Backup, nicht aktiv)
  - Nur noch Backup-Code in `backend/backup_sqlite/`
  - Abhängigkeit `sqlite3` 5.1.6 noch in `backend/package.json` vorhanden

**File Storage:**
- Lokales Filesystem auf dem Server
  - Mount: `/opt/Konfi-Quest/uploads:/app/uploads` (Docker Volume)
  - Unterverzeichnisse: `uploads/requests/`, `uploads/chat/`, `uploads/material/`
  - Dateinamen: SHA256-Hash aus Timestamp + Originalname (kein direkter URL-Zugriff)
  - Kein statisches Serving — alle Dateien nur über geschützte API-Endpunkte abrufbar

**Caching:**
- Frontend: In-Memory SWR-Cache (`frontend/src/services/offlineCache.ts`)
- Frontend: Persistenter Token-Store via `@capacitor/preferences` (`frontend/src/services/tokenStore.ts`)
- Keine serverseitige Cache-Schicht (kein Redis etc.)

## Authentication & Identity

**Auth Provider:**
- Custom JWT — kein externer Auth-Provider
  - Implementation: `backend/middleware/rbac.js` + `backend/routes/auth.js`
  - Access Token: 15 Minuten Gültigkeit
  - Refresh Token: 90 Tage, rotierend (`backend/migrations/068_refresh_tokens.sql`)
  - Soft-Revoke: `token_invalidated_at` in DB — Tokens vor diesem Zeitpunkt werden abgelehnt
  - RBAC-Rollen: super_admin (5), org_admin (4), admin (3), teamer (2), konfi (1)
  - Passwort-Hashing: `bcrypt` 5.1.1

**Frontend Token Management:**
- Synchrone Memory-Getter + asynchrone Preferences-Setter (`frontend/src/services/tokenStore.ts`)
- Auto-Refresh bei 401 mit Queue-System für parallele Requests (`frontend/src/services/api.ts`)

## Monitoring & Observability

**Error Tracking:**
- Keines — kein Sentry, Datadog oder ähnliches integriert

**Logs:**
- `console.log`/`console.error`/`console.warn` direkt im Backend-Code
- Healthcheck-Endpoint: `GET /api/health` (für Container-Healthcheck)
- Backend Dockerfile HEALTHCHECK: `backend/healthcheck.js` alle 30s

**Uptime:**
- Extern via Uptime Kuma (https://uptime.godsapp.de, nicht im Projekt integriert)

## CI/CD & Deployment

**Hosting:**
- Hetzner Server (server.godsapp.de, IP: 213.109.162.132)
- Docker Container via Portainer Stack
- Stack-File: `portainer-stack.yml` (Projekt-Root)

**Container Registry:**
- GitHub Container Registry (ghcr.io/revisor01/)
  - Backend: `ghcr.io/revisor01/konfi-quest-backend:latest`
  - Frontend: `ghcr.io/revisor01/konfi-quest-frontend:latest`

**CI Pipeline:**
- Kein CI-System im Repo konfiguriert (kein `.github/workflows/`)
- Deployment: git push → Portainer zieht automatisch neue Images

## Real-time Communication

**WebSocket:**
- Socket.io 4.7.2 (Server) / socket.io-client 4.8.1 (Frontend)
- Server: `backend/server.js` — läuft auf demselben HTTP-Server wie REST-API
- Client: `frontend/src/services/websocket.ts`
- Auth: JWT-Token im Socket-Handshake (`socket.handshake.auth.token`)
- Features: Chat-Nachrichten, Typing-Indicator, persönliche User-Rooms für Echtzeit-Benachrichtigungen
- Transport: WebSocket first, Polling als Fallback
- Reconnect: 10 Versuche, exponentielles Backoff mit Offline-Sync bei Wiederverbindung

## E-Mail

**Provider:**
- Eigener SMTP-Server (KeyHelp auf server.godsapp.de)
  - Host: server.godsapp.de / 213.109.162.132
  - Port: 465 (TLS)
  - Absender: `noreply@konfi-quest.de` / `team@konfi-quest.de`
  - Client: Nodemailer 8.0.2 (`backend/services/emailService.js`)
  - Auth: `SMTP_USER` + `SMTP_PASS` Env-Variablen
  - TLS: `rejectUnauthorized: false` (Docker-Interna, Zertifikat auf Hostname ausgestellt)
  - Verwendung: Passwort-Reset, Einladungs-E-Mails via `backend/routes/auth.js`

## Background Services

**Interner Scheduler:**
- `backend/services/backgroundService.js` — kein externes Cron-System, `setInterval`-basiert
- Badge-Update: alle 5 Minuten — synct Badge-Counts für alle User mit Push-Tokens
- Event-Reminder: prüft bevorstehende Events für Push-Benachrichtigungen
- Pending Events Approval: benachrichtigt Admins über ausstehende Event-Freigaben
- Token Cleanup: bereinigt abgelaufene Refresh-Tokens aus der DB
- Wrapped Cron: prüft monatlich ob Wrapped generiert werden soll (`backend/routes/wrapped.js`)

## Webhooks & Callbacks

**Incoming:**
- Keine externen Webhooks konfiguriert

**Outgoing:**
- Keine ausgehenden Webhooks

## Environment Configuration

**Pflicht-Env-Variablen (Backend):**
- `JWT_SECRET` — fehlt → Server-Prozess beendet sich sofort
- `DATABASE_URL` — PostgreSQL Connection String

**Optionale Env-Variablen (Backend):**
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `SMTP_FROM`
- `FIREBASE_SERVICE_ACCOUNT` — JSON-String wenn keine Service-Account-Datei vorhanden
- `CORS_ORIGINS` — Default: `https://konfi-quest.de,https://www.konfi-quest.de`
- `PORT` — Default: 5000
- `NODE_ENV` — production/development

**Secrets Location:**
- Firebase Service Account: `backend/push/firebase-service-account.json` (nicht im Repo, gitignored)
- Alle anderen Secrets: Docker Environment Variables in Portainer Stack

---

*Integration audit: 2026-03-22*
