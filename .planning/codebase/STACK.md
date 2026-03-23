# Technology Stack

**Analysis Date:** 2026-03-23

## Languages

**Primary:**
- TypeScript 5.1 - Frontend (React-Komponenten, Services, Hooks, Typen unter `frontend/src/`)
- JavaScript (CommonJS) - Backend (Node.js Express unter `backend/`)

**Secondary:**
- SQL - Datenbankmigrationen unter `backend/migrations/` (*.sql Dateien)
- HTML/CSS - Statische Seiten (Landing Page, Datenschutz) unter `frontend/public/`

## Runtime

**Environment:**
- Node.js >=16.0.0 (Dockerfile: node:18-bullseye für Backend, node:18-alpine für Frontend-Build)
- Docker-Container-basierte Ausführung in Produktion

**Package Manager:**
- npm (Backend + Frontend)
- Lockfile: `package-lock.json` in beiden Verzeichnissen vorhanden

## Frameworks

**Core (Backend):**
- Express 4.18 - HTTP-Server und REST-API (`backend/server.js`)
- Socket.IO 4.7 - WebSocket-Server für Echtzeit-Chat und Live-Updates (`backend/server.js`)

**Core (Frontend):**
- React 19.0 - UI-Framework (`frontend/src/`)
- Ionic React 8.5 - Mobile UI-Komponenten und Navigation (`frontend/src/`)
- React Router 5.3 - SPA-Routing (`frontend/src/App.tsx`)
- Capacitor 7/8 - Native Wrapper für iOS und Android (`frontend/capacitor.config.ts`)

**Themes:**
- `@rdlabo/ionic-theme-ios26` 2.2 - iOS 26 Design-System
- `@rdlabo/ionic-theme-md3` 1.0 - Material Design 3

**Testing:**
- Vitest 4.1 - Unit-Test-Runner (`frontend/vitest.config.ts` eingebettet in `vite.config.ts`)
- Cypress 13.5 - E2E-Tests (`frontend/cypress.config.ts`)
- @testing-library/react 16.2 - React-Testutilities

**Build/Dev:**
- Vite 6.4 - Frontend-Build-Tool (`frontend/vite.config.ts`)
- @vitejs/plugin-react 4.0 - React-Plugin für Vite
- TypeScript-Compiler (tsc) - Type-Checking vor Build
- nodemon 3.0 - Backend-Dev-Server mit Hot-Reload

## Key Dependencies

**Critical (Backend):**
- `pg` 8.16 - PostgreSQL-Client mit Connection Pool (`backend/database.js`)
- `jsonwebtoken` 9.0 - JWT-Signierung/Verifikation für Auth (`backend/middleware/rbac.js`)
- `bcrypt` 5.1 - Passwort-Hashing (`backend/server.js`)
- `firebase-admin` 13.7 - Firebase Cloud Messaging für Push-Benachrichtigungen (`backend/push/firebase.js`)
- `socket.io` 4.7 - WebSocket-Server (`backend/server.js`)
- `nodemailer` 8.0 - E-Mail-Versand via SMTP (`backend/server.js`)
- `multer` 2.1 - File-Uploads (Chat, Material, Activity Requests) (`backend/server.js`)
- `node-cron` 3.0 - Geplante Aufgaben (Wrapped-Generierung) (`backend/services/backgroundService.js`)
- `express-rate-limit` 8.3 - Rate-Limiting für Auth, Chat, Uploads (`backend/server.js`)
- `helmet` 8.1 - Security-HTTP-Header (`backend/server.js`)
- `express-validator` 7.3 - Input-Validierung (`backend/middleware/validation.js`)

**Critical (Frontend):**
- `axios` 1.10 + `axios-retry` 4.5 - HTTP-Client mit Auto-Retry (`frontend/src/services/api.ts`)
- `socket.io-client` 4.8 - WebSocket-Client (`frontend/src/services/websocket.ts`)
- `@capacitor/push-notifications` 7.0 - Native Push-Benachrichtigungen
- `@capacitor/preferences` 8.0 - Persistenter Tokenspeicher (`frontend/src/services/tokenStore.ts`)
- `@capacitor/network` 8.0 - Offline-Erkennung (`frontend/src/services/networkMonitor.ts`)
- `swiper` 12.1 - Slider für Wrapped-Feature (`frontend/src/components/wrapped/`)
- `html-to-image` 1.11 - Screenshot-Generierung für Wrapped-Share
- `qrcode` 1.5 + `qr-scanner` 1.4 - QR-Code Generierung und Scan
- `@capawesome/capacitor-badge` 7.0 - App-Icon-Badge-Zähler

**Infrastructure:**
- `@capacitor/filesystem` 7.1 - Lokaler Dateizugriff für Offline-Cache
- `@capacitor-community/file-opener` 7.0 - Datei-Öffnen auf nativer Ebene
- `@capacitor/share` 7.0 - Native Share-Sheet
- `@capacitor/camera` 7.0 - Kamerazugriff für Profilfotos
- `@capawesome/capacitor-background-task` 8.0 - Hintergrundaufgaben

## Configuration

**Environment (Backend):**
- `JWT_SECRET` - Pflichtfeld, Server startet nicht ohne diesen Wert
- `DATABASE_URL` - PostgreSQL Connection String
- `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, `PGPORT` - Einzelne DB-Parameter
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - E-Mail-Konfiguration
- `LOSUNG_API_KEY` - API-Key für Tageslosung-Service
- `FIREBASE_SERVICE_ACCOUNT` - Firebase Service Account JSON (alternativ: `backend/push/firebase-service-account.json`)
- `CORS_ORIGINS` - Erlaubte Origins (Standard: `https://konfi-quest.de,https://www.konfi-quest.de`)
- `PG_POOL_MAX`, `PG_IDLE_TIMEOUT`, `PG_CONN_TIMEOUT` - DB-Pool-Tuning

**Environment (Frontend):**
- `VITE_API_URL` - API-Basis-URL (Standard: `https://konfi-quest.de/api`)

**Build:**
- `frontend/vite.config.ts` - Vite-Konfiguration mit Vitest-Test-Config eingebettet
- `frontend/tsconfig.json` - TypeScript-Compiler-Einstellungen (strict: true)
- `frontend/tsconfig.node.json` - TypeScript-Config für Node/Vite-Konfigurationsdateien
- `frontend/capacitor.config.ts` - Capacitor-Konfiguration (App-ID: `de.godsapp.konfiquest`)
- `frontend/eslint.config.js` - ESLint 9 flat config
- `frontend/ionic.config.json` - Ionic-Projekttyp: `react-vite`

## Platform Requirements

**Development:**
- Node.js >=16, empfohlen 18
- PostgreSQL 15 (via Docker)
- Backend: `cd backend && npm start`
- Frontend: `cd frontend && npm run dev` (Port 5173)

**Production:**
- Docker-Container auf Hetzner-Server (server.godsapp.de)
- Container-Images: `ghcr.io/revisor01/konfi-quest-backend:latest` und `ghcr.io/revisor01/konfi-quest-frontend:latest`
- Stack-Definition: `portainer-stack.yml`
- Backend-Port intern: 5000, nach außen via Traefik: 8623
- Frontend-Port intern: 80 (nginx), nach außen via Traefik: 8624
- PostgreSQL 15 Alpine, Port intern: 5432 (nur localhost)
- Deployment via Portainer (automatisch bei git push, KEIN manuelles docker-compose)
- Externe URL: https://konfi-quest.de
- Datenbankmigrationen laufen automatisch beim Backend-Start (`backend/database.js`)

---

*Stack-Analyse: 2026-03-23*
