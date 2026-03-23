# Technology Stack

**Analysis Date:** 2026-03-23

## Languages

**Primary:**
- TypeScript 5.x - Frontend (strict mode, ESNext target)
- JavaScript (CommonJS) - Backend (Node.js, no TypeScript)

**Secondary:**
- SQL - PostgreSQL migrations in `backend/migrations/*.sql`
- HTML/CSS - Frontend theme in `frontend/src/theme/`

## Runtime

**Environment:**
- Node.js >=16.0.0 (backend requirement from `backend/package.json`)
- Browser + iOS + Android (frontend via Capacitor)

**Package Manager:**
- npm (both frontend and backend)
- Lockfiles: `frontend/package-lock.json`, `backend/package-lock.json`, root `package-lock.json`
- Module system: Frontend uses ESM (`"type": "module"`), Backend uses CommonJS (`require()`)

## Frameworks

**Core (Frontend):**
- React 19.0.0 - UI framework
- Ionic React 8.5.0 (`@ionic/react`, `@ionic/react-router`) - Mobile UI component library
- React Router 5.3.4 - Client-side routing (NOT v6)
- Swiper 12.1.2 - Slide/carousel component (used in Wrapped feature)

**Core (Backend):**
- Express 4.18.2 - HTTP server framework
- Socket.IO 4.7.2 (server) + `socket.io-client` 4.8.1 (frontend) - Real-time WebSocket communication

**Mobile (Capacitor):**
- `@capacitor/core` ^7.6.0 - Capacitor bridge
- `@capacitor/android` ^7.6.0 - Android platform
- `@capacitor/ios` ^7.6.0 - iOS platform
- `@capacitor/push-notifications` ^7.0.6 - Native push notification handling
- `@capacitor/preferences` ^8.0.1 - Persistent key-value storage (used for token/cache)
- `@capacitor/filesystem` ^7.1.8 - File system access
- `@capacitor/network` ^8.0.1 - Network status monitoring
- `@capacitor/camera` ^7.0.5 - Camera access
- `@capacitor/haptics` 7.0.1 - Haptic feedback
- `@capacitor/share` ^7.0.4 - Native share sheet
- `@capacitor/status-bar` 7.0.1 - Status bar control
- `@capacitor/keyboard` ^7.0.5 - Keyboard management
- `@capacitor/device` ^7.0.4 - Device info
- `@capawesome/capacitor-background-task` ^8.0.2 - Background tasks
- `@capawesome/capacitor-badge` ^7.0.1 - App icon badge count
- `@capacitor-community/file-opener` ^7.0.1 - File opening
- `@capacitor/file-viewer` ^1.0.7 - In-app file viewer

**Theme:**
- `@rdlabo/ionic-theme-ios26` ^2.2.0 - iOS 26 / Liquid Glass theme animations
- `@rdlabo/ionic-theme-md3` ^1.0.2 - Material Design 3 animations

**Testing (Frontend):**
- Vitest ^4.1.0 - Unit test runner
- Cypress ^13.5.0 - E2E tests
- `@testing-library/react` ^16.2.0 - React component testing utilities
- jsdom ^29.0.0 - DOM environment for unit tests

**Build/Dev (Frontend):**
- Vite ^6.4.1 - Build tool and dev server (port 5173)
- TypeScript 5.x - Type checking (`tsc && vite build`)
- `@vitejs/plugin-react` ^4.0.1 - React fast refresh
- `rollup-plugin-visualizer` ^7.0.1 - Bundle analysis

## Key Dependencies

**Critical (Backend):**
- `pg` ^8.16.3 - PostgreSQL client (connection pool via `database.js`)
- `jsonwebtoken` ^9.0.2 - JWT signing/verification (access 15min + refresh 90d)
- `bcrypt` ^5.1.1 - Password hashing
- `firebase-admin` ^13.7.0 - FCM push notifications via Firebase Admin SDK
- `express-rate-limit` ^8.3.1 - Rate limiting (10 failed attempts → 15 min lockout)
- `helmet` ^8.1.0 - HTTP security headers
- `express-validator` ^7.3.1 - Input validation middleware
- `multer` ^2.1.1 - File upload handling
- `nodemailer` ^8.0.2 - Email via SMTP
- `node-cron` ^3.0.3 - Scheduled background jobs
- `cors` ^2.8.5 - Cross-origin request handling

**Critical (Frontend):**
- `axios` ^1.10.0 - HTTP client with interceptors for auth/retry
- `axios-retry` ^4.5.0 - Automatic retry with exponential backoff
- `html-to-image` ^1.11.13 - Screenshot/share generation for Wrapped feature
- `qrcode` ^1.5.4 + `qr-scanner` ^1.4.2 - QR code generation and scanning
- `ionicons` ^8.0.13 - Icon set (must use named imports, never Unicode emojis)

## Configuration

**Environment (Backend):**
- `JWT_SECRET` - Required, no default, causes process.exit(1) if missing
- `DATABASE_URL` - PostgreSQL connection string
- `PG_POOL_MAX` - Pool size, default 20 (scalable to 50+ for EKD rollout)
- `PG_IDLE_TIMEOUT` - Default 30000ms
- `PG_CONN_TIMEOUT` - Default 5000ms
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` - Email
- `LOSUNG_API_KEY` - API key for daily Bible verse service
- `FIREBASE_SERVICE_ACCOUNT` - JSON string fallback if `push/firebase-service-account.json` missing
- `CORS_ORIGINS` - Comma-separated allowed origins, default `https://konfi-quest.de,https://www.konfi-quest.de`

**Environment (Frontend):**
- API base URL hardcoded in `src/services/api.ts`: `https://konfi-quest.de/api`
- WebSocket URL hardcoded in `src/services/websocket.ts`: `https://konfi-quest.de`
- (No `VITE_*` env vars — native Capacitor apps can't use them)

**Build:**
- Frontend: `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/capacitor.config.ts`
- Backend: `backend/package.json` (no transpilation, plain Node.js)
- Linting: `frontend/eslint.config.js` (typescript-eslint, react-hooks, react-refresh)

**App ID:** `de.godsapp.konfiquest`

## Platform Requirements

**Development:**
- Node.js >=16.0.0
- npm
- For iOS: Xcode + Apple Developer account
- For Android: Android Studio

**Production:**
- Docker (backend image: `ghcr.io/revisor01/konfi-quest-backend:latest`)
- Docker (frontend image: `ghcr.io/revisor01/konfi-quest-frontend:latest`)
- PostgreSQL 15 Alpine (image: `postgres:15-alpine`)
- Nginx (inside frontend container, serves SPA + static pages)
- Deployed via Portainer on Hetzner server `server.godsapp.de`
- Backend port mapping: `127.0.0.1:8623:5000`
- Frontend port mapping: `127.0.0.1:8624:80`
- Reverse proxy: Traefik → Apache (KeyHelp) → domain `konfi-quest.de`

---

*Stack analysis: 2026-03-23*
