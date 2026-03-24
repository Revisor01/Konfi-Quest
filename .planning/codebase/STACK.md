# Technology Stack

**Analysis Date:** 2026-03-24

## Languages

**Primary:**
- TypeScript 5.1.6 - Frontend (alle `.ts`/`.tsx` Dateien in `frontend/src/`)
- JavaScript (CommonJS) - Backend (`backend/server.js`, `backend/routes/`, `backend/services/`)

**Secondary:**
- SQL - Datenbankmigrationen in `backend/migrations/*.sql`
- HTML/CSS - `frontend/index.html`, `frontend/src/theme/variables.css`

## Runtime

**Environment:**
- Node.js 18 (Dockerfile: `node:18-alpine` / `node:18-bullseye`)
- Engine-Anforderung im Backend: `>=16.0.0` (laut `backend/package.json`)

**Package Manager:**
- npm (Frontend + Backend)
- Lockfiles: `frontend/package-lock.json`, `backend/package-lock.json` — beide vorhanden

## Frameworks

**Core Frontend:**
- React 19.0.0 - UI-Framework
- Ionic React 8.5.0 (`@ionic/react`) - Mobile UI Component Library
- Ionic React Router 8.5.0 (`@ionic/react-router`) - Navigation
- React Router 5.3.4 - Routing-Engine
- Ionicons 8.0.13 - Icon-System (kein Emoji, nur IonIcons erlaubt)

**Theming:**
- `@rdlabo/ionic-theme-ios26` 2.2.0 - iOS 26 Theme
- `@rdlabo/ionic-theme-md3` 1.0.2 - Material Design 3 Theme

**Core Backend:**
- Express 4.18.2 - HTTP Server Framework

**Mobile:**
- Capacitor 7.6.0 (`@capacitor/core`, `@capacitor/ios`, `@capacitor/android`) - Native App Bridge
- App-ID: `de.godsapp.konfiquest`

**Real-Time:**
- Socket.IO 4.8.1 (Client: `socket.io-client`) - WebSocket-basiertes Chat-System
- Socket.IO 4.7.2 (Server: `socket.io`) - Server-seitige WebSocket-Verarbeitung

**Testing:**
- Vitest 4.1.0 - Unit-Test-Runner
- Cypress 13.5.0 - E2E-Test-Framework
- `@testing-library/react` 16.2.0 - React-Testutilities

**Build/Dev:**
- Vite 6.4.1 - Frontend Build-Tool und Dev-Server (Port 5173)
- `@vitejs/plugin-react` - React-Unterstützung in Vite
- Terser 5.4.0 - JS-Minifier
- `rollup-plugin-visualizer` - Bundle-Analyse (`frontend/stats.html`)
- nodemon 3.0.2 - Backend Dev-Autorestart

## Key Dependencies

**Critical Frontend:**
- `axios` 1.10.0 - HTTP-Client für API-Requests (`frontend/src/services/api.ts`)
- `axios-retry` 4.5.0 - Automatischer Retry mit exponential backoff für 5xx/429
- `swiper` 12.1.2 - Wrapped-Slideshow (Konfi/Teamer Wrapped Feature)
- `html-to-image` 1.11.13 - Screenshot-Generierung für Share-Feature
- `qrcode` 1.5.4 + `qr-scanner` 1.4.2 - QR-Code Generierung und Scannen

**Critical Backend:**
- `pg` 8.16.3 - PostgreSQL-Client (Connection Pool via `database.js`)
- `jsonwebtoken` 9.0.2 - JWT Access Tokens (15 Min) + Refresh Tokens (90 Tage)
- `bcrypt` 5.1.1 - Passwort-Hashing
- `firebase-admin` 13.7.0 - Firebase Cloud Messaging für Push-Nachrichten
- `node-cron` 3.0.3 - Cron-Jobs (Wrapped-Generierung am 1. jeden Monats 06:00)
- `multer` 2.1.1 - Datei-Upload-Handling (Chat, Material, Aktivitäts-Anträge)
- `nodemailer` 8.0.2 - E-Mail-Versand (SMTP)
- `helmet` 8.1.0 - HTTP Security Headers
- `express-rate-limit` 8.3.1 - Rate Limiting (Auth, Chat, Events, Uploads, Orgs)
- `express-validator` 7.3.1 - Request-Validierung
- `file-type` 19.6.0 - MIME-Typ-Validierung für Uploads

**Capacitor Plugins:**
- `@capacitor/push-notifications` 7.0.6 - Native Push-Benachrichtigungen (FCM/APNS)
- `@capacitor/preferences` 8.0.1 - Persistenter Schlüssel-Wert-Speicher (Token-Cache, Offline-Queue)
- `@capacitor/filesystem` 7.1.8 - Dateisystem-Zugriff (Offline-Foto-Uploads)
- `@capacitor/network` 8.0.1 - Netzwerkstatus-Überwachung (`networkMonitor.ts`)
- `@capacitor/camera` 7.0.5 - Kamera-Zugriff
- `@capacitor/share` 7.0.4 - Native Share-Sheet (Wrapped-Feature)
- `@capacitor/device` 7.0.4 - Device-ID für Push-Token-Tracking
- `@capacitor/haptics` 7.0.1 - Haptisches Feedback
- `@capawesome/capacitor-badge` 7.0.1 - App-Icon-Badge (ungelesene Nachrichten)
- `@capawesome/capacitor-background-task` 8.0.2 - Background-Task-Ausführung

## Configuration

**Environment (Backend):**
- `JWT_SECRET` - Pflichtfeld, Server startet nicht ohne (geprüft in `backend/server.js` Z.26-29)
- `DATABASE_URL` - PostgreSQL Connection String
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - E-Mail-Konfiguration
- `LOSUNG_API_KEY` - API-Key für Tageslosung-Service
- `FIREBASE_SERVICE_ACCOUNT` - Firebase Credentials (alternativ `backend/push/firebase-service-account.json`)
- `CORS_ORIGINS` - Erlaubte Origins (Standard: `https://konfi-quest.de,https://www.konfi-quest.de`)
- `PORT` - Server-Port (Standard: 5000, Docker: 8623)
- `PG_POOL_MAX` - PostgreSQL Connection Pool Max (Standard: 20)
- `NODE_ENV` - Umgebung (production/development)

**Environment (Frontend):**
- `VITE_API_URL` - API-Base-URL (Standard: `https://konfi-quest.de/api`)

**Build:**
- `frontend/vite.config.ts` - Vite Build-Konfiguration
- `frontend/tsconfig.json` - TypeScript Konfiguration (strict mode, ESNext target)
- `frontend/capacitor.config.ts` - Capacitor-Konfiguration
- `frontend/ionic.config.json` - Ionic-Konfiguration (type: `react-vite`)
- `frontend/eslint.config.js` - ESLint mit TypeScript-ESLint und React Hooks Plugin
- `frontend/nginx.conf` - Nginx-Konfiguration für Docker-Container

## Platform Requirements

**Development:**
- Node.js 18+
- npm
- Backend: `cd backend && npm start` (Port 5000)
- Frontend: `cd frontend && npm run dev` (Port 5173)

**Production:**
- Docker (3 Container: postgres, backend, frontend)
- Stack-Datei: `portainer-stack.yml`
- Images: `ghcr.io/revisor01/konfi-quest-backend:latest`, `ghcr.io/revisor01/konfi-quest-frontend:latest`
- PostgreSQL 15-alpine
- Frontend: nginx:alpine (Port 8624 → 80)
- Backend: node:18-bullseye (Port 8623 → 5000)
- Reverse Proxy: Apache (KeyHelp) → Traefik (8888) → Docker-Container
- Deployment: `git push` → Portainer Webhook (NIEMALS manuell `docker-compose up/build`)
- iOS: Capacitor native App (`frontend/ios/`)
- Android: Capacitor native App (`frontend/android/`)

---

*Stack-Analyse: 2026-03-24*
