# External Integrations

**Analysis Date:** 2026-03-24

## APIs & External Services

**Push-Benachrichtigungen:**
- Firebase Cloud Messaging (FCM) - Push-Nachrichten für iOS (APNS) und Android
  - SDK/Client: `firebase-admin` 13.7.0 (Backend), `@capacitor/push-notifications` 7.0.6 (Frontend)
  - Auth: `FIREBASE_SERVICE_ACCOUNT` (JSON-String) oder Datei `backend/push/firebase-service-account.json`
  - Implementierung: `backend/push/firebase.js`
  - Funktionen: `sendFirebasePushNotification` (sichtbar), `sendFirebaseSilentPush` (Badge-Update)
  - Push-Service-Wrapper: `backend/services/pushService.js`

**Tageslosung:**
- Losungen API (`https://losung.konfi-quest.de/api/`) - Tägliche Bibelverse (Herrnhuter Losungen)
  - Auth: `LOSUNG_API_KEY` (Query-Parameter)
  - Implementierung: `backend/services/losungService.js`
  - Caching: DB-Cache in `daily_verses`-Tabelle (7 Tage TTL)
  - Genutzt in: `backend/routes/konfi.js`, `backend/routes/teamer.js`, `backend/routes/settings.js`
  - Frontend-Cache: `offlineCache` mit 24h TTL (`CACHE_TTL.TAGESLOSUNG`)

## Data Storage

**Databases:**
- PostgreSQL 15-alpine
  - Connection: `DATABASE_URL` (Connection String), Fallback: `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, `PGPORT`
  - Client: `pg` 8.16.3 mit Connection Pool (`backend/database.js`)
  - Pool-Config: max 20 Connections, 30s Idle-Timeout, 5s Connection-Timeout
  - Migrations: `backend/migrations/*.sql` (automatisch beim Startup via `runMigrations()`)
  - Migration-Tracking: `schema_migrations`-Tabelle (idempotent)
  - Docker-Volume: `/opt/Konfi-Quest/postgres`
  - Kern-Tabellen: `users`, `konfi_profiles`, `konfi_activities`, `bonus_points`, `konfi_badges`, `event_bookings`, `chat_rooms`, `chat_messages`, `chat_participants`, `push_tokens`, `daily_verses`, `wrapped_snapshots`

**File Storage:**
- Lokales Dateisystem (Docker-Volume: `/opt/Konfi-Quest/uploads` → `/app/uploads`)
  - `backend/uploads/requests/` - Aktivitäts-Antragsfotos (5MB Limit, nur Bilder)
  - `backend/uploads/chat/` - Chat-Dateien (5MB Limit, Bilder/PDF/Video/Audio/Office)
  - `backend/uploads/material/` - Lernmaterial (20MB Limit, Bilder/PDF/Video/Audio/Office/ODF)
  - Dateinamen: SHA256-Hash aus Timestamp + Originalname + Random (keine öffentliche Static-Route)
  - Alle Dateien werden über geschützte Endpunkte ausgeliefert (kein direkter Static-Zugriff)

**Caching:**
- Keine externe Cache-Lösung (kein Redis, kein Memcached)
- DB-Cache: PostgreSQL-Tabelle `daily_verses` für Tageslosung
- Frontend-Offline-Cache: `@capacitor/preferences` (SQLite-basiert auf Native, localStorage im Browser)
  - Implementierung: `frontend/src/services/offlineCache.ts`
  - SWR-Pattern auf allen ~30 Pages via `useOfflineQuery`-Hook (`frontend/src/hooks/useOfflineQuery.ts`)

## Authentication & Identity

**Auth Provider:**
- Custom JWT (kein externer Auth-Provider)
  - Access Token: 15 Minuten Laufzeit
  - Refresh Token: 90 Tage, rotierend, Soft-Revoke bei Logout
  - Storage (Frontend): In-Memory-Cache + `@capacitor/preferences` (`frontend/src/services/tokenStore.ts`)
  - Middleware (Backend): `verifyTokenRBAC` in `backend/middleware/rbac.js`
  - Token-Refresh: Automatisch in `frontend/src/services/api.ts` (Interceptor, verhindert parallele Refresh-Requests)
  - Passwort-Hashing: bcrypt 5.1.1 (`backend/utils/passwordUtils.js`)

**RBAC-System:**
- Rollen: `superadmin`, `admin`, `teamer`, `konfi`
- Organisation-Isolation: Alle Daten sind `organization_id`-scoped
- Middleware-Helfer: `requireSuperAdmin`, `requireOrgAdmin`, `requireAdmin`, `requireTeamer`
- Jahrgangs-Filter: `filterByJahrgangAccess` für teilweise Admin-Zugriffe

## Monitoring & Observability

**Error Tracking:**
- Kein externes Tool (kein Sentry, kein Datadog)

**Logs:**
- `console.log/error/warn` direkt im Code
- Docker-Container-Logs via Portainer

**Uptime:**
- Uptime Kuma: `https://uptime.godsapp.de` (externer Monitoring-Service, nicht im Codebase integriert)
- Backend Health-Check: `GET /api/health` → `{ status: 'OK' }`
- Docker Health-Check: `backend/healthcheck.js` (alle 30s)

## CI/CD & Deployment

**Hosting:**
- Hetzner Server (`server.godsapp.de`, IP: 213.109.162.132)
- Docker via Portainer (Stack: `/opt/stacks/`)
- Container-Images: GitHub Container Registry (`ghcr.io/revisor01/konfi-quest-*`)

**CI Pipeline:**
- Kein CI/CD im Repository konfiguriert (kein `.github/workflows/`)
- Deployment-Trigger: `git push` → Portainer Webhook → Automatisches Image-Pull und -Restart

**Web-Infrastruktur:**
- Apache (KeyHelp) → Traefik (intern Port 8888) → Docker-Container
- Frontend: Port 8624 (Nginx)
- Backend: Port 8623 (Node.js)
- WebSocket: Apache leitet WebSocket-Upgrades weiter an Traefik

## Webhooks & Callbacks

**Incoming:**
- Kein externer Webhook-Empfang konfiguriert

**Outgoing:**
- Kein ausgehender Webhook konfiguriert

## WebSocket (Real-Time)

**Socket.IO:**
- Server: `backend/server.js` (io-Instanz, an HTTP-Server gebunden)
- Client: `frontend/src/services/websocket.ts`
- Auth: JWT-Token im Handshake (`socket.handshake.auth.token`)
- Organisation-Isolation: `joinRoom` prüft `organization_id` vor Raum-Beitritt
- Features: Chat-Nachrichten, Typing-Indikatoren, Live-Aktivitäts-Updates
- Reconnect-Logik: WriteQueue flushen → Cache invalidieren → Badge-Refresh bei Wiederverbindung

## E-Mail

**SMTP:**
- Provider: Eigener Mail-Server (`server.godsapp.de`, Port 465)
- Client: `nodemailer` 8.0.2
- Konfiguration: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`
- Genutzt für: Passwort-Reset, Einladungs-E-Mails
- TLS: `rejectUnauthorized: false` (Zertifikat auf Hostname, Docker nutzt IP)

## Background Services

**Alle Services in `backend/services/backgroundService.js`:**

| Service | Intervall | Zweck |
|---------|-----------|-------|
| Badge Update | alle 5 Min | App-Icon-Badge-Count via Silent Push |
| Event Reminder | alle 15 Min | Push-Erinnerungen (1 Tag + 1 Stunde vor Event) |
| Pending Events | alle 4 Std | Admin-Erinnerung für offene Event-Teilnahme-Verbuchungen |
| Token Cleanup | alle 6 Std | Veraltete/fehlerhafte Push-Tokens bereinigen |
| Wrapped Cron | 1. jeden Monats 06:00 | Auto-Generierung von Konfi/Teamer-Wrapped (node-cron) |

## Offline-Funktionalität

**WriteQueue:**
- Persistente FIFO-Queue für offline ausgelöste Aktionen
- Storage: `@capacitor/preferences` (Key: `queue:items`)
- Implementierung: `frontend/src/services/writeQueue.ts`
- Auto-Flush bei Reconnect (Socket.IO + Network-Monitor)
- Unterstützt: Chat, Aktivitäts-Anträge, Opt-Out, Admin-Aktionen, Teamer-Aktionen

---

*Integrations-Analyse: 2026-03-24*
