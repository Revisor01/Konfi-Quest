# Technology Stack

**Analysis Date:** 2026-03-22

## Languages

**Primary:**
- TypeScript 5.1 - Frontend (React/Ionic), strict mode enabled
- JavaScript (CommonJS) - Backend (Node.js Express), alle Routes und Services

**Secondary:**
- SQL - PostgreSQL Migrations in `backend/migrations/*.sql`
- HTML/CSS - `frontend/public/` (Landing, Datenschutz), `frontend/src/theme/`

## Runtime

**Environment:**
- Node.js >= 16.0.0 (Backend, laut `engines` in `backend/package.json`)
- Node.js 18-alpine (Frontend Build-Stage Docker), Node.js 18-bullseye (Backend Docker)
- Browser/Capacitor Native Runtime (Frontend)

**Package Manager:**
- npm (beide Workspaces)
- Lockfile: `frontend/package-lock.json` und `backend/package-lock.json` vorhanden

## Frameworks

**Core Frontend:**
- React 19.0.0 - UI Framework (`frontend/package.json`)
- Ionic React 8.5.0 (`@ionic/react`) - Mobile UI-Komponenten
- Ionic React Router 8.5.0 (`@ionic/react-router`) - Routing
- Capacitor 7.x / 8.x - Native iOS/Android Bridge
- Swiper 12.1.2 - Slides/Carousel (Wrapped-Feature)

**Core Backend:**
- Express 4.18.2 - HTTP Framework (`backend/package.json`)
- Socket.io 4.7.2 - WebSocket/Real-time Chat

**Theme/Design:**
- `@rdlabo/ionic-theme-ios26` 2.2.0 - iOS 26 Design-Theme
- `@rdlabo/ionic-theme-md3` 1.0.2 - Material 3 Design-Theme
- Ionicons 8.0.13 - Icon Library

**Testing:**
- Vitest 4.1.0 - Unit Test Runner (`frontend/vite.config.ts`)
- Cypress 13.5.0 - E2E Tests (`frontend/cypress.config.ts`)
- Testing Library (React, DOM, user-event) - Test Utilities

**Build/Dev:**
- Vite 6.4.1 - Frontend Build-Tool (`frontend/vite.config.ts`)
- Nodemon 3.0.2 - Backend Dev-Reload
- TypeScript ESLint 8.24.0 + ESLint 9.20.1 - Linting

## Key Dependencies

**Frontend - Kritisch:**
- `axios` 1.10.0 + `axios-retry` 4.5.0 - HTTP Client mit Auto-Retry (`frontend/src/services/api.ts`)
- `socket.io-client` 4.8.1 - WebSocket Client (`frontend/src/services/websocket.ts`)
- `@capacitor/push-notifications` 7.0.6 - Native Push Notifications
- `@capacitor/preferences` 8.0.1 - Persistenter Token-Store (`frontend/src/services/tokenStore.ts`)
- `@capacitor/network` 8.0.1 - Netzwerk-Status für Offline-Erkennung
- `@capawesome/capacitor-background-task` 8.0.2 - Background Sync
- `@capawesome/capacitor-badge` 7.0.1 - App-Badge auf Icon
- `qrcode` 1.5.4 + `qr-scanner` 1.4.2 - QR-Code Generierung und Scannen
- `html-to-image` 1.11.13 - Wrapped-Card als Bild exportieren

**Backend - Kritisch:**
- `pg` 8.16.3 - PostgreSQL Client (`backend/database.js`)
- `jsonwebtoken` 9.0.2 - JWT Auth (`backend/middleware/rbac.js`)
- `bcrypt` 5.1.1 - Passwort-Hashing
- `firebase-admin` 13.7.0 - FCM Push Notifications (`backend/push/firebase.js`)
- `socket.io` 4.7.2 - WebSocket Server (`backend/server.js`)
- `multer` 2.1.1 - File Uploads (Chat, Material, Aktivitäten-Requests)
- `nodemailer` 8.0.2 - E-Mail Versand (`backend/services/emailService.js`)
- `helmet` 8.1.0 - HTTP Security Headers
- `express-rate-limit` 8.3.1 - Rate Limiting (Auth, Chat, Events, Uploads)
- `express-validator` 7.3.1 - Input-Validierung

**Backend - Legacy (nicht aktiv genutzt):**
- `sqlite3` 5.1.6 - Nur noch für Backup/Migration (`backend/backup_sqlite/`)

## Configuration

**Environment (Backend):**
- `JWT_SECRET` - Pflicht, Server-Start schlägt fehl ohne diesen Wert
- `DATABASE_URL` - PostgreSQL Connection String (`backend/database.js`)
- `PGHOST`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, `PGPORT` - Alternativ zu DATABASE_URL
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `SMTP_FROM` - E-Mail
- `FIREBASE_SERVICE_ACCOUNT` - JSON-String als Alternative zu `backend/push/firebase-service-account.json`
- `CORS_ORIGINS` - Kommaseparierte erlaubte Origins (Default: konfi-quest.de)
- `PORT` - HTTP Port (Default: 5000)
- `NODE_ENV` - Umgebung (production/development)

**Frontend:**
- Keine `.env`-Variablen aktiv genutzt — API-URL ist hardcoded als `https://konfi-quest.de/api` in `frontend/src/services/api.ts`
- WebSocket-URL hardcoded als `https://konfi-quest.de` in `frontend/src/services/websocket.ts`
- App-ID: `de.godsapp.konfiquest` (`frontend/capacitor.config.ts`)

**Build:**
- `frontend/vite.config.ts` - Vite Build-Config mit Vitest-Konfiguration
- `frontend/tsconfig.json` - TypeScript strict mode, ESNext target
- `frontend/capacitor.config.ts` - Capacitor App-Config (Plugins, App-ID)
- `frontend/ionic.config.json` - Ionic Project-Config (type: react-vite)

## Platform Requirements

**Development:**
- Node.js >= 18 empfohlen (Docker-Base-Image)
- Backend: `cd backend && npm start` (Port 5000)
- Frontend: `cd frontend && npm run dev` (Port 5173)
- PostgreSQL Docker Container

**Production:**
- Docker (3 Container: postgres, backend, frontend)
- Stack-Definiton: `portainer-stack.yml` (Root)
- Backend-Image: `ghcr.io/revisor01/konfi-quest-backend:latest`
- Frontend-Image: `ghcr.io/revisor01/konfi-quest-frontend:latest` (Nginx:alpine)
- PostgreSQL 15-alpine
- Backend Docker-Port: 127.0.0.1:8623:5000
- Frontend Docker-Port: 127.0.0.1:8624:80
- Reverse Proxy: Apache (KeyHelp) → Traefik → Docker (server.godsapp.de)
- Deployment: git push → Portainer automatisch (kein docker-compose manuell)
- iOS/Android: Capacitor Native Apps, App-ID `de.godsapp.konfiquest`

---

*Stack analysis: 2026-03-22*
