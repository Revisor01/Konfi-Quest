# Technology Stack

**Analysis Date:** 2026-03-23

## Languages

**Primary:**
- TypeScript 5.1 - Frontend (alle `.ts`/`.tsx` Dateien in `frontend/src/`)
- JavaScript (CommonJS) - Backend (alle `.js` Dateien in `backend/`)

**Secondary:**
- SQL - Datenbankmigrationen in `backend/migrations/` (`.sql`-Dateien)
- HTML/CSS - `frontend/index.html`, `frontend/src/theme/`

## Runtime

**Environment:**
- Node.js >=16.0.0 (Backend-Anforderung laut `backend/package.json`)
- Aktuelle Dev-Umgebung: Node.js v25.8.1

**Package Manager:**
- npm (Frontend + Backend)
- Lockfiles: `frontend/package-lock.json`, `backend/package-lock.json`, Root-`package-lock.json`

## Frameworks

**Frontend-Core:**
- React 19.0.0 - UI-Framework (`frontend/src/`)
- Ionic React 8.5.0 - Mobile UI-Komponenten und Navigation (`@ionic/react`)
- React Router v5.3.4 - Client-Side-Routing (`react-router-dom`)
- Capacitor 7.x/8.x - Native iOS/Android-Brücke (App-ID: `de.godsapp.konfiquest`)

**Backend-Core:**
- Express 4.18 - HTTP-Framework (`backend/server.js`)
- Socket.IO 4.7 - WebSocket-Server für Chat und Echtzeit-Events

**Theming:**
- `@rdlabo/ionic-theme-ios26` 2.2.0 - iOS26/HIG-Design
- `@rdlabo/ionic-theme-md3` 1.0.2 - Material Design 3

**Build/Dev (Frontend):**
- Vite 6.4 - Build-Tool und Dev-Server
- TypeScript-ESLint 8.24 - Linting
- Vitest 4.1 - Unit Tests
- Cypress 13.5 - E2E Tests

## Key Dependencies

**Frontend - Kritisch:**
- `axios` 1.10 + `axios-retry` 4.5 - HTTP-Client mit exponential-Retry (`frontend/src/services/api.ts`)
- `socket.io-client` 4.8 - WebSocket-Client (`frontend/src/services/websocket.ts`)
- `@capacitor/preferences` 8.0 - Persistenter Token-Store (`frontend/src/services/tokenStore.ts`)
- `@capacitor/push-notifications` 7.0 - FCM/APNS Push-Registrierung
- `@capacitor/network` 8.0 - Netzwerk-Monitoring für Offline-First
- `swiper` 12.1 - Wrapped-Slide-Komponente
- `html-to-image` 1.11 - Wrapped-Screenshot-Export
- `qrcode` / `qr-scanner` - QR-Code-Generierung und -Scan

**Backend - Kritisch:**
- `pg` 8.16 - PostgreSQL-Client (Connection-Pool in `backend/database.js`)
- `jsonwebtoken` 9.0 - JWT Access-Token (15 min) + Refresh-Token (90 Tage)
- `bcrypt` 5.1 - Passwort-Hashing
- `firebase-admin` 13.7 - FCM Push-Nachrichten (`backend/push/firebase.js`)
- `nodemailer` 8.0 - E-Mail-Versand (`backend/services/emailService.js`)
- `node-cron` 3.0 - Wrapped-Cron, Event-Erinnerungen (`backend/services/backgroundService.js`)
- `multer` 2.1 - Datei-Uploads (Chat, Material, Activity-Requests)
- `helmet` 8.1 - HTTP-Security-Header
- `express-rate-limit` 8.3 - Brute-Force-Schutz (6 separate Limiter)
- `express-validator` 7.3 - Input-Validierung

## Configuration

**Environment (Backend):**
- `DATABASE_URL` - PostgreSQL-Verbindung (Format: `postgresql://user:pass@host:5432/db`)
- `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, `PGPORT` - Alternativ zu DATABASE_URL
- `JWT_SECRET` - Pflicht; Server startet nicht ohne diesen Wert
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` - E-Mail-Konfiguration
- `FIREBASE_SERVICE_ACCOUNT` - Firebase Service Account als JSON-String (alternativ: `backend/push/firebase-service-account.json`)
- `LOSUNG_API_KEY` - API-Key für externe Losungen-API
- `CORS_ORIGINS` - Komma-getrennte CORS-Origins (Default: `https://konfi-quest.de,https://www.konfi-quest.de`)
- `NODE_ENV` - `production` aktiviert strengere Einstellungen

**Environment (Frontend):**
- API-URL ist hardcoded: `https://konfi-quest.de/api` in `frontend/src/services/api.ts`
- WebSocket-URL ist hardcoded: `https://konfi-quest.de` in `frontend/src/services/websocket.ts`
- Kein `.env`-File für Vite-Build-Variablen aktiv

**Build:**
- `frontend/vite.config.ts` - Vite-Konfiguration (Vitest jsdom-Umgebung)
- `frontend/tsconfig.json` - TypeScript ESNext + strict mode
- `frontend/capacitor.config.ts` - Capacitor-Plugins und App-ID

## Platform Requirements

**Development:**
- Node.js >= 16 (empfohlen: aktuell v18+ wegen Dockerfiles)
- npm
- PostgreSQL 15 (lokal oder Docker)
- Xcode (iOS-Build via Capacitor)
- Android Studio (Android-Build via Capacitor)

**Production:**
- Docker-Compose mit 3 Services: `postgres:15-alpine`, `node:18-bullseye` (Backend), `nginx:alpine` (Frontend)
- Container-Images via GHCR: `ghcr.io/revisor01/konfi-quest-backend:latest` und `ghcr.io/revisor01/konfi-quest-frontend:latest`
- Deployment via Portainer auf `server.godsapp.de` - **kein manuelles docker-compose**
- Apache als Reverse-Proxy vor Traefik (Port 8888 intern)
- Backend: Port 8623 → intern 5000
- Frontend: Port 8624 → intern 80

---

*Stack-Analyse: 2026-03-23*
