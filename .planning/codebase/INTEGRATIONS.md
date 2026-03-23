# External Integrations

**Analysis Date:** 2026-03-23

## APIs & External Services

**Push-Benachrichtigungen:**
- Firebase Cloud Messaging (FCM) via `firebase-admin` 13.7
  - SDK/Client: `firebase-admin` (Backend), `@capacitor/push-notifications` (Frontend)
  - Auth: Service Account JSON - Datei `backend/push/firebase-service-account.json` oder Env-Var `FIREBASE_SERVICE_ACCOUNT`
  - Implementierung: `backend/push/firebase.js`
  - Funktionen: Alert-Pushes, Silent Badge-Updates, APNS-Headers für iOS
  - Kapazitäten: Einzelne Token-Adressierung, kein Topic-Messaging

**Tageslosung API:**
- Interner Dienst unter `https://losung.konfi-quest.de/api/`
  - Auth: `LOSUNG_API_KEY` Env-Var (Pflichtfeld)
  - Implementierung: `backend/services/losungService.js`
  - Caching: DB-Cache in Tabelle `daily_verses` (1 Tag), Fallback auf letzten gespeicherten Wert
  - Abfrage-Parameter: `api_key`, `translation` (Standard: `LUT` für Lutherbibel 2017)

## Data Storage

**Datenbank:**
- PostgreSQL 15 Alpine
  - Connection: `DATABASE_URL` (Connection String) oder Einzel-Env-Vars `PGHOST/PGUSER/PGDATABASE/PGPASSWORD/PGPORT`
  - Client: `pg` 8.16 mit Connection Pool (`backend/database.js`)
  - Pool-Konfiguration: Standard 20 Connections, tuningfähig via `PG_POOL_MAX`
  - Transaktions-Support: `db.getClient()` für dedizierte Connections mit BEGIN/COMMIT/ROLLBACK
  - Migrations: Automatisch beim Server-Start, SQL-Dateien in `backend/migrations/`, Tracking in `schema_migrations`
  - Daten-Persistenz: Volume `/opt/Konfi-Quest/postgres` auf Server

**File Storage:**
- Lokales Dateisystem im Backend-Container
  - Volume: `/opt/Konfi-Quest/uploads` → Container `/app/uploads`
  - Unterverzeichnisse: `uploads/requests/` (Aktivitäts-Nachweise), `uploads/chat/` (Chat-Anhänge), `uploads/material/` (Unterrichtsmaterial)
  - Dateinamen: SHA256-Hash (keine Originalname-Exposition)
  - Upload-Größen: 5 MB (Chat/Requests), 20 MB (Material)
  - Zugriff: Ausschließlich über geschützte API-Endpunkte (kein statisches Serving)

**Offline-Cache (Frontend):**
- `@capacitor/filesystem` für persistenten lokalen Cache
  - Implementierung: `frontend/src/services/offlineCache.ts`
  - Pattern: SWR (Stale-While-Revalidate) auf allen 30 Pages via `useOfflineQuery`

**Token-Speicher (Frontend):**
- `@capacitor/preferences` für persistenten JWT-Speicher
  - Implementierung: `frontend/src/services/tokenStore.ts`
  - Pattern: Synchroner Memory-Getter + asynchroner Preferences-Setter

**Caching:**
- PostgreSQL-basierter DB-Cache für Tageslosungen (Tabelle `daily_verses`)
- Kein separater Cache-Dienst (kein Redis)

## Authentication & Identity

**Auth Provider:**
- Custom JWT-Authentication
  - Access Token: 15 Minuten Laufzeit
  - Refresh Token: 90 Tage, rotierend, in Tabelle `refresh_tokens` gespeichert
  - Soft-Revoke: `token_invalidated_at` Timestamp in `users`-Tabelle
  - Passwort-Hashing: bcrypt
  - Implementierung Backend: `backend/routes/auth.js`, `backend/middleware/rbac.js`
  - Implementierung Frontend: `frontend/src/services/auth.ts`, `frontend/src/services/api.ts`
  - Socket.IO-Auth: JWT im `handshake.auth.token` (`backend/server.js`)

**RBAC-Rollenhierarchie:**
- `super_admin` (5) - Organisationsübergreifend
- `org_admin` (4) - Volle Rechte in eigener Organisation
- `admin` (3) - Konfis, Events, Badges, Aktivitäten
- `teamer` (2) - Events, Konfis ansehen, Punkte vergeben
- `konfi` (1) - Nur eigene Daten
- Middleware: `backend/middleware/rbac.js` - `verifyTokenRBAC`, `requireSuperAdmin`, `requireOrgAdmin`, `requireAdmin`, `requireTeamer`

## Monitoring & Observability

**Error Tracking:**
- Kein externes Tool (kein Sentry, kein Datadog)
- Nur `console.error()` Logging im Backend
- Uptime Kuma für Verfügbarkeitsüberwachung (https://uptime.godsapp.de)

**Health Check:**
- Backend: `GET /api/health` → `{ status: 'OK' }`
- Docker Healthcheck: `backend/healthcheck.js` (Interval 30s, Timeout 3s)

**Logs:**
- `console.log/error/warn` im Backend
- Kein strukturiertes Logging-Framework

## CI/CD & Deployment

**Hosting:**
- Hetzner-Server (server.godsapp.de, IP: 213.109.162.132)
- Docker-Container verwaltet über Portainer
- Reverse Proxy: Apache (KeyHelp) → Traefik (Port 8888) → Container

**Container Registry:**
- GitHub Container Registry (ghcr.io)
  - Backend: `ghcr.io/revisor01/konfi-quest-backend:latest`
  - Frontend: `ghcr.io/revisor01/konfi-quest-frontend:latest`

**CI Pipeline:**
- Kein expliziter CI-Workflow gefunden (kein `.github/workflows/`)
- Deployment via `git push` → Portainer zieht automatisch neue Images

**Stack-Definition:**
- `portainer-stack.yml` im Projekt-Root

## Webhooks & Callbacks

**Eingehend:**
- Keine dedizierten Webhook-Endpunkte gefunden

**Ausgehend:**
- Firebase FCM API für Push-Benachrichtigungen (via `firebase-admin` SDK)
- Losung API (`https://losung.konfi-quest.de/api/`) für Tageslosungen

## E-Mail (SMTP)

**Provider:**
- Eigener SMTP-Server auf server.godsapp.de (Port 465, SSL)
  - Konfiguration: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` Env-Vars
  - Absender: `team@konfi-quest.de`
  - Client: `nodemailer` 8.0 (`backend/server.js`)
  - TLS: `rejectUnauthorized: false` (Docker-Umgebung, Zertifikat auf Hostname ausgestellt)
  - Verwendung: Einladungs-E-Mails, Passwort-Reset (in `backend/routes/auth.js`)

## Echtzeit-Kommunikation

**WebSocket:**
- Socket.IO 4.7 (Backend) + socket.io-client 4.8 (Frontend)
  - URL: Abgeleitet aus `VITE_API_URL` (ohne `/api`-Suffix)
  - Auth: JWT in `handshake.auth.token`
  - Transports: WebSocket zuerst, Polling als Fallback
  - Org-Isolation: Raum-Zugriff nur innerhalb gleicher `organization_id`
  - Events: `joinRoom`, `leaveRoom`, `typing`, `stopTyping`, `userTyping`, `userStoppedTyping`
  - Implementierung Frontend: `frontend/src/services/websocket.ts`
  - Reconnect-Logik: 10 Versuche, exponentieller Backoff + Queue-Flush + Cache-Invalidierung

## Native Plattform-Integration

**iOS:**
- Capacitor 7 + `@capacitor/ios`
  - App-ID: `de.godsapp.konfiquest`
  - APNS via Firebase Admin SDK (APNs-Push-Type Header für Alert/Background)
  - Xcode-Projekt unter `frontend/ios/`

**Android:**
- Capacitor 7 + `@capacitor/android`
  - FCM via Firebase Admin SDK
  - Android-Projekt unter `frontend/android/`

**Native APIs genutzt:**
- `@capacitor/push-notifications` - Push-Token Registrierung und Empfang
- `@capacitor/haptics` - Haptisches Feedback
- `@capacitor/camera` - Kamerazugriff für Profilfotos
- `@capacitor/network` - Netzwerkstatus für Offline-Erkennung
- `@capacitor/filesystem` - Offline-Cache-Persistenz
- `@capacitor/preferences` - Tokenspeicherung
- `@capacitor/share` - Native Share-Sheet für Wrapped-Feature
- `@capawesome/capacitor-badge` - App-Icon-Badge
- `@capawesome/capacitor-background-task` - Hintergrundaufgaben
- `@capacitor-community/file-opener` - Dateien nativ öffnen
- `@capacitor/file-viewer` - Datei-Vorschau

---

*Integrations-Analyse: 2026-03-23*
