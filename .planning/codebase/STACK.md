# Technology Stack

**Analysis Date:** 2026-03-20

## Languages

**Primary:**
- TypeScript 5.1 - Frontend (React/Ionic), strict mode aktiviert
- JavaScript (CommonJS) - Backend (Node.js/Express), kein TypeScript

**Secondary:**
- SQL - PostgreSQL-Datenbankschema und Migrations
- HTML/CSS - Frontend-Templates, Ionic-Theme-Variablen

## Runtime

**Environment:**
- Node.js >=16.0.0 (backend engine requirement); Docker-Images basieren auf `node:18-alpine` (frontend build) und `node:18-bullseye` (backend)
- Browser / Capacitor Native (iOS & Android) - Frontend

**Package Manager:**
- npm — beide Pakete
- Lockfiles: vorhanden (`package-lock.json` in `frontend/` und `backend/`)

## Frameworks

**Core (Frontend):**
- React 19.0.0 - UI-Framework
- Ionic React 8.5.0 - Mobile-UI-Komponenten und Navigation (`@ionic/react`, `@ionic/react-router`)
- Capacitor 7.x - Native-Brücke für iOS & Android (`@capacitor/core`, `@capacitor/ios`, `@capacitor/android`)
- React Router 5.3 - Client-seitiges Routing (via `@ionic/react-router`)

**Core (Backend):**
- Express 4.18 - HTTP-Server und API-Framework
- Socket.IO 4.7 - WebSocket-Server für Echtzeit-Chat

**Theming / UI Add-ons:**
- `@rdlabo/ionic-theme-ios26` 2.2.0 - iOS 26 Design-Sprache
- `@rdlabo/ionic-theme-md3` 1.0.2 - Material Design 3
- Ionicons 8.0 - Icon-Bibliothek (nur IonIcon, keine Unicode-Emojis)

**Testing:**
- Vitest 4.1 - Unit-Tests (Frontend), Config in `frontend/vite.config.ts`
- Cypress 13.5 - E2E-Tests (Frontend), Config in `frontend/cypress.config.ts`
- Testing Library (React, DOM, user-event) - Test-Utilities

**Build/Dev (Frontend):**
- Vite 6.4 - Build-Tool und Dev-Server, Port 5173
- `@vitejs/plugin-react` 4.0 - React-Plugin für Vite
- `@vitejs/plugin-legacy` 6.1 - Legacy-Browser-Support
- terser 5.4 - Minification
- rollup-plugin-visualizer 7.0 - Bundle-Analyse

**Build/Dev (Backend):**
- nodemon 3.0 - Dev-Server mit Auto-Reload

## Key Dependencies

**Frontend — Kritisch:**
- `axios` 1.10 - HTTP-Client für API-Calls; zentraler Wrapper in `frontend/src/services/api.ts`
- `socket.io-client` 4.8 - WebSocket-Client; Service in `frontend/src/services/websocket.ts`
- `@capacitor/push-notifications` 7.0 - Push-Notification-Empfang (FCM/APNs)
- `@capacitor/device` 7.0 - Device-ID-Abfrage für Push-Token-Management
- `qrcode` 1.5 + `qr-scanner` 1.4 - QR-Code-Generierung und -Scan
- `@capacitor/camera` 7.0 - Kamerazugriff (Profilfotos)
- `@capacitor/filesystem` 7.1 - Datei-Zugriff (Downloads, Zertifikate)
- `@capacitor/haptics` 7.0 - Haptisches Feedback
- `@capawesome/capacitor-badge` 7.0 - App-Badge-Steuerung
- `@capacitor-community/file-opener` 7.0 - Dateien öffnen
- `@capacitor/share` 7.0 - Native Share-Sheet

**Backend — Kritisch:**
- `express` 4.18 - HTTP-Framework
- `pg` 8.16 - PostgreSQL-Client (Pool-basiert); Konfiguration in `backend/database.js`
- `jsonwebtoken` 9.0 - JWT-Erstellung und -Verifikation
- `bcrypt` 5.1 - Passwort-Hashing
- `firebase-admin` 13.7 - Firebase Cloud Messaging (Push-Benachrichtigungen)
- `socket.io` 4.7 - Echtzeit-WebSocket-Server
- `nodemailer` 8.0 - E-Mail-Versand (SMTP)
- `multer` 2.1 - Datei-Upload-Handling (Chat, Requests, Material)
- `express-rate-limit` 8.3 - Mehrere Rate-Limiter (Auth, Chat, Buchungen, Uploads, Org)
- `helmet` 8.1 - HTTP-Security-Headers
- `express-validator` 7.3 - Request-Validierung

**Backend — Vorhanden aber veraltet:**
- `sqlite3` 5.1 - Legacy-Datenbankadapter; nur noch für `backup_sqlite/` vorhanden, nicht im aktiven Betrieb

## Configuration

**Environment (Backend):**
- `JWT_SECRET` — PFLICHTFELD, Server startet nicht ohne diesen Wert
- `DATABASE_URL` — PostgreSQL Connection String (Format: `postgresql://user:pass@host:5432/db`)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE` — E-Mail-Konfiguration
- `CORS_ORIGINS` — Kommaseparierte erlaubte Origins (Default: `https://konfi-quest.de,https://www.konfi-quest.de`)
- `PORT` — HTTP-Port (Default: 5000, Docker-Mapping: 8623:5000)
- `FIREBASE_SERVICE_ACCOUNT` — Optionale JSON-Umgebungsvariable als Alternative zur Datei `backend/push/firebase-service-account.json`
- `NODE_ENV` — `production` / `development`

**Environment (Frontend):**
- Keine `.env`-Variablen — API-URL und WebSocket-URL sind hardcodiert in `frontend/src/services/api.ts` (`https://konfi-quest.de/api`) und `frontend/src/services/websocket.ts` (`https://konfi-quest.de`)

**Build:**
- Frontend: `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/tsconfig.node.json`
- Capacitor: `frontend/capacitor.config.ts` (App-ID: `de.godsapp.konfiquest`)
- ESLint: `frontend/eslint.config.js`

## Platform Requirements

**Development:**
- Node.js 18+ (empfohlen, Dockerfile-Basis)
- PostgreSQL 15 (Docker-Image: `postgres:15-alpine`)
- npm (kein yarn/pnpm)
- Für native iOS/Android-Builds: Xcode (iOS) / Android Studio (Android)

**Production:**
- Docker (alle Dienste als Container)
- Hetzner VPS (`server.godsapp.de`, IP: 213.109.162.132)
- Portainer für Container-Management
- Apache (KeyHelp) + Traefik als Reverse-Proxy-Kette
- Domain: `konfi-quest.de`
- HTTPS via KeyHelp/ACME

---

*Stack-Analyse: 2026-03-20*
