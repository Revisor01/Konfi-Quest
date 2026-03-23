# External Integrations

**Analysis Date:** 2026-03-23

## APIs & External Services

**Push-Benachrichtigungen:**
- Firebase Cloud Messaging (FCM) / Apple Push Notification Service (APNS)
  - SDK/Client: `firebase-admin` 13.7 (Backend), `@capacitor/push-notifications` 7.0 (Frontend)
  - Auth: Service-Account-JSON via `FIREBASE_SERVICE_ACCOUNT` (env) oder `backend/push/firebase-service-account.json`
  - Implementierung: `backend/push/firebase.js` (sendFirebasePushNotification, sendFirebaseSilentPush)
  - Push-Service-Registry: `backend/services/pushService.js` (20+ Notification-Typen)
  - Tokens werden in DB-Tabelle `push_tokens` gespeichert; Cleanup-Service laeuft alle 6h

**Tageslosung:**
- Externe Losungen-API (godsapp.de-eigene API)
  - Endpoint: API-Key-gesichert
  - Auth: `LOSUNG_API_KEY` (env), Fallback-Key im Code (`backend/routes/konfi.js` Zeile 1439)
  - Verwendung: Anzeige der Tageslosung in Konfi- und Teamer-Views

## Data Storage

**Datenbank:**
- PostgreSQL 15 (Alpine)
  - Connection: `DATABASE_URL` (env) oder `PGHOST`/`PGUSER`/`PGDATABASE`/`PGPASSWORD`/`PGPORT`
  - Client: `pg` 8.16 mit Connection-Pool (`backend/database.js`)
  - Schema via SQL-Migrationen in `backend/migrations/` (automatisch beim Start)
  - Datenpfad auf Server: `/opt/Konfi-Quest/postgres`
  - Tabellen: `users`, `konfi_profiles`, `roles`, `organizations`, `jahrgaenge`, `activities`, `konfi_activities`, `badges`, `konfi_badges`, `events`, `event_bookings`, `chat_rooms`, `chat_messages`, `chat_participants`, `chat_read_status`, `push_tokens`, `refresh_tokens`, `bonus_points`, `levels`, `wrapped_snapshots`, `material`, u.a.

**Datei-Storage:**
- Lokal auf dem Server (kein Cloud-Storage)
  - Volume-Mount: `/opt/Konfi-Quest/uploads` → `/app/uploads`
  - Unterverzeichnisse: `uploads/requests/` (Activity-Fotos), `uploads/chat/` (Chat-Anhänge), `uploads/material/` (Material-Dateien)
  - Dateinamen: SHA-256-Hash (Datenschutz)
  - Limits: 5 MB (Chat/Requests), 20 MB (Material)
  - Zugriff: Ausschliesslich über geschützte API-Endpunkte (kein statischer Serve)

**Caching:**
- In-Memory-Token-Cache: `frontend/src/services/tokenStore.ts` (sync Getter, async Persistierung nach Capacitor Preferences)
- Offline-Cache: `frontend/src/services/offlineCache.ts` (SWR-Pattern für alle 30 Pages via `useOfflineQuery`)
- Capacitor Preferences: Persistenter Key-Value-Store auf dem Gerät (Token, User-Objekt, Device-ID, Push-Token-Timestamp)

## Authentication & Identity

**Auth-System:**
- Custom JWT-basiertes System (kein externer Auth-Provider)
  - Access-Token: 15 Minuten Laufzeit, HS256-Signatur mit `JWT_SECRET`
  - Refresh-Token: 90 Tage rotierend, SHA-256-gehasht in DB-Tabelle `refresh_tokens`
  - Implementierung: `backend/routes/auth.js`, Middleware: `backend/middleware/rbac.js`
  - Frontend Token-Refresh: `frontend/src/services/api.ts` (Interceptor, verhindert parallele Refresh-Requests)
  - Soft-Revoke: Token in DB als invalidiert markierbar ohne sofortigen Logout

**RBAC (Role-Based Access Control):**
  - Rollen: `super_admin`, `org_admin`, `admin`, `teamer`, `konfi`
  - Middleware: `verifyTokenRBAC`, `requireSuperAdmin`, `requireOrgAdmin`, `requireAdmin`, `requireTeamer` (alle in `backend/middleware/rbac.js`)
  - Organisations-Isolation: Alle Queries gefiltert nach `organization_id`

## Monitoring & Observability

**Error Tracking:**
- Nicht konfiguriert (kein Sentry, kein Datadog)

**Health Check:**
- Backend: `backend/healthcheck.js` (Docker HEALTHCHECK, `/api/health` Endpoint)
- Uptime Kuma: Externes Monitoring auf `uptime.godsapp.de`

**Logs:**
- `console.log/error/warn` direkt (kein strukturiertes Logging-Framework)
- Docker-Log-Aggregation über Portainer

## CI/CD & Deployment

**Hosting:**
- Hetzner-Server `server.godsapp.de` (IP: 213.109.162.132)
- Docker-Stack via Portainer (`/opt/Konfi-Quest/`)
- Apache (KeyHelp) → Traefik (Port 8888) → Docker-Container

**Container-Registry:**
- GitHub Container Registry (GHCR): `ghcr.io/revisor01/konfi-quest-backend:latest` und `ghcr.io/revisor01/konfi-quest-frontend:latest`

**CI Pipeline:**
- Deployment via `git push` → Portainer-Webhook (kein manuelles docker-compose!)

**Native App-Deployment:**
- iOS: Xcode + App Store (App-ID: `de.godsapp.konfiquest`)
- Android: Android Studio + Play Store
- Capacitor CLI: `@capacitor/cli` 7.6

## Echtzeit-Kommunikation

**WebSocket (Socket.IO):**
- Server: `backend/server.js` (Socket.IO 4.7, JWT-Auth auf Verbindungsebene)
- Client: `frontend/src/services/websocket.ts` (automatischer Reconnect, 10 Versuche)
- Räume: `user_{type}_{id}` (persönliche Benachrichtigungen), `room_{id}` (Chat-Räume)
- Events: `joinRoom`, `leaveRoom`, `typing`, `stopTyping`, `newMessage`, `userTyping`, `userStoppedTyping`
- Organisations-Isolation: Prüfung beim `joinRoom`-Event

## E-Mail

**SMTP:**
- Provider: Selbst-gehosteter SMTP auf `server.godsapp.de` (Port 465, TLS)
- Absender: `team@konfi-quest.de`
- Client: Nodemailer 8.0 (`backend/services/emailService.js`)
- Umgebungsvariablen: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`
- Verwendungszwecke: Passwort-Reset-E-Mails, Passwort-geändert-Bestätigungen

## Background-Services (Cron)

Alle Cron-Jobs laufen im Backend-Prozess via `node-cron` und `setInterval` (`backend/services/backgroundService.js`):

- Badge-Update: alle 5 Minuten (Chat-Unread-Count berechnen, Silent-Push senden)
- Event-Erinnerungen: alle 15 Minuten (1-Tag und 1-Stunden Reminder via Push)
- Pending-Events-Reminder für Admins: alle 4 Stunden
- Push-Token-Cleanup: alle 6 Stunden (Error-Tokens, inaktive >30 Tage, verwaiste)
- Wrapped-Cron: Am 1. jeden Monats um 06:00 Uhr (Europe/Berlin) - Konfi-Wrapped bei Konfirmationsmonat, Teamer-Wrapped am 1. Dezember

## Webhooks & Callbacks

**Eingehend:**
- Kein Webhook-Empfang von externen Diensten konfiguriert

**Ausgehend:**
- Kein Webhook-Versand an externe Dienste konfiguriert

## Umgebungsvariablen-Übersicht

**Pflicht (Backend):**
- `JWT_SECRET` - Server-Start schlägt ohne diesen Wert fehl
- `DATABASE_URL` oder `PG*`-Variablen

**Optional aber produktionsrelevant:**
- `SMTP_USER`, `SMTP_PASS` - Ohne diese kein E-Mail-Versand
- `FIREBASE_SERVICE_ACCOUNT` - Ohne dies kein Push-Versand
- `LOSUNG_API_KEY` - Fallback-Key im Code vorhanden (sollte entfernt werden)
- `CORS_ORIGINS` - Default: `https://konfi-quest.de,https://www.konfi-quest.de`
- `NODE_ENV` - `production` für Produktionsmodus

**Secrets-Speicherort auf Server:**
- Docker-Compose-Environment in Portainer-Stack-Konfiguration
- `backend/push/firebase-service-account.json` (alternativ zu env-var)

---

*Integrations-Analyse: 2026-03-23*
