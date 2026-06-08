# Technology Stack

**Analysis Date:** 2026-06-09

> Stack was major-modernized on 2026-06-08. Versions below are read directly from
> `frontend/package.json`, `backend/package.json`, Dockerfiles and build configs —
> not from older map documents.

## Languages

**Primary:**
- TypeScript `^6.0.3` - Entire frontend (`frontend/src/**/*.tsx`, `*.ts`)
- JavaScript (CommonJS, Node) - Entire backend (`backend/**/*.js`)

**Secondary:**
- SQL (PostgreSQL dialect) - Migrations in `backend/migrations/*.sql`, init in `init-scripts/`
- Gradle (Groovy) - Android build (`frontend/android/`)
- Swift/Obj-C project config - iOS shell (`frontend/ios/App/`)

## Runtime

**Backend Environment:**
- Node.js `>=20.0.0` (`backend/package.json` engines)
- Docker base image: `node:20-bookworm` (`backend/Dockerfile`)
- CI test runner: Node `22` (`.github/workflows/ci.yml`)
- Module system: CommonJS (`require`/`module.exports`)

**Frontend Environment:**
- Browser / Capacitor WebView (iOS + Android)
- ESM (`"type": "module"` in `frontend/package.json`)
- Build image: `node:20-alpine` (multi-stage), served via `nginx:alpine` (`frontend/Dockerfile`)

**Package Manager:**
- npm (lockfiles: `frontend/package-lock.json`, `backend/package-lock.json`)
- Frontend installs require `--legacy-peer-deps` (React 19 peer ranges; see `frontend/Dockerfile`, CI)
- Lockfile: present for both

## Frameworks

### Frontend

**Core:**
- Ionic React `@ionic/react ^8.5.0` - UI component framework (iOS26/MD3 styling)
- `@ionic/react-router ^8.5.0` - Ionic router bindings
- React `^19.2.7` + React DOM `^19.2.7` - View layer
- React Router `react-router ^5.3.4` + `react-router-dom ^5.3.4` (v5, NOT v6)
- Ionicons `^8.0.13` - Icon set (Unicode emojis forbidden by project rule)
- Theming: `@rdlabo/ionic-theme-ios26 ^2.3.2`, `@rdlabo/ionic-theme-md3 ^1.1.0`

**State / Data:**
- React Context (`AppContext`) - no external state lib
- axios `^1.10.0` + `axios-retry ^4.5.0` - HTTP client with retry
- `socket.io-client ^4.8.1` - realtime chat

**UI utilities:**
- `swiper ^12.1.2` - Wrapped slides / carousels
- `qrcode ^1.5.4` + `qr-scanner ^1.4.2` - QR generation & scanning
- `html-to-image ^1.11.13` - share-image rendering (Wrapped)

### Backend

**Core:**
- Express `^5.2.1` (Express 5 — empty body is `undefined`, defaulted to `{}` in `backend/createApp.js`)
- PostgreSQL via `pg ^8.16.3` (connection pool in `backend/database.js`)
- `socket.io ^4.7.2` - WebSocket server (`backend/server.js`)

**Security / Middleware:**
- `helmet ^8.1.0` - security headers (CSP disabled, HSTS handled by Apache)
- `jsonwebtoken ^9.0.2` - JWT auth (RBAC via `backend/middleware/rbac.js`)
- `bcrypt ^6.0.0` - password hashing
- `express-rate-limit ^8.3.1` - per-user/IP rate limiting (7 limiters in `server.js`)
- `express-validator ^7.3.1` - input validation
- `cors ^2.8.5` (present; in prod CORS is set by the Apache vHost, not middleware)

**Files / Integrations:**
- `multer ^2.1.1` - multipart upload (chat/material/request configs in `createApp.js`)
- `file-type ^22.0.1` - magic-byte file validation
- `nodemailer ^8.0.10` - SMTP mail
- `firebase-admin ^13.10.0` - FCM push (`backend/push/firebase.js`)
- `node-cron ^4.2.1` - scheduled jobs (`backend/services/backgroundService.js`)
- `node-fetch` (dynamic import) - Losungen API call (`backend/services/losungService.js`)
- Override: `protobufjs ^7.5.5` (transitive pin for firebase-admin)

## Native (Capacitor)

**Capacitor `^8.4.0`** (core/cli/ios/android all `8.x`). Config: `frontend/capacitor.config.ts`
- App ID: `de.godsapp.konfiquest`, App name: `Konfi Quest`, webDir `dist`
- `androidScheme: 'https'` (avoids Android mixed-content blocking of API calls)

**Capacitor plugins (all `8.x` unless noted):**
- `@capacitor/app`, `@capacitor/camera`, `@capacitor/device`, `@capacitor/filesystem`
- `@capacitor/haptics`, `@capacitor/keyboard`, `@capacitor/network`, `@capacitor/preferences`
- `@capacitor/push-notifications ^8.1.1`, `@capacitor/share`, `@capacitor/status-bar`
- `@capacitor/file-viewer ^2.0.1`, `@capacitor-community/file-opener ^8.0.1`
- `@capawesome/capacitor-background-task ^8.0.2`, `@capawesome/capacitor-badge ^8.0.2`

**iOS:**
- Min deployment target: iOS `15.0` (`ios/App/App.xcodeproj/project.pbxproj`)
- Build tool: Xcode (manual archive/upload via App Store Connect API)
- Requires JDK 21 for Capacitor tooling (per project notes)

**Android:**
- `minSdkVersion = 24`, `compileSdkVersion = 36`, `targetSdkVersion = 36` (`android/variables.gradle`)
- `applicationId de.godsapp.konfiquest`, current `versionCode 32`, `versionName 1.0.1` (`android/app/build.gradle`)
- Build: Gradle `bundleRelease` (AAB), signed via `KONFI_*` keystore env
- NOTE: `frontend/android/` is gitignored — bump versionCode manually before each AAB build

## Build Tooling

**Frontend:**
- Vite `^8.0.16` - dev server + bundler (`frontend/vite.config.ts`); build = `tsc && vite build`
- `@vitejs/plugin-react ^6.0.2`
- `terser ^5.4.0` - minification
- `rollup-plugin-visualizer ^7.0.1` - bundle analysis
- Dev server port `3000` (Vite config); project docs also reference `5173`

**TypeScript config** (`frontend/tsconfig.json`):
- `target: ESNext`, `module: ESNext`, `moduleResolution: bundler`
- `strict: true`, `jsx: react-jsx`, `noEmit: true`, `allowJs: false`
- Tests excluded from typecheck; `tsconfig.node.json` referenced

**Linting:**
- ESLint `^9.39.4` (flat config) + `typescript-eslint ^8.24.0`
- `eslint-plugin-react`, `eslint-plugin-react-hooks ^5.2.0`, `eslint-plugin-react-refresh`

**Backend:**
- No bundler — runs `node server.js` directly
- `nodemon ^3.0.2` for dev (`npm run dev`)
- DB build deps in image: `python3`, `make`, `g++`, `postgresql-client` (native `bcrypt`/`pg`)

## Test Stack

**Frontend:**
- Vitest `^4.1.8` (jsdom env, `src/setupTests.ts`) - unit/component tests
- Testing Library: `@testing-library/react ^16.2.0`, `/jest-dom`, `/user-event`, `/dom`
- `jsdom ^29.0.0`
- Cypress `^15.16.0` - component/e2e (`npm run test.e2e`)

**Backend:**
- Vitest `^4.1.8` (`backend/tests/vitest.config.ts`): pool `forks`, `maxWorkers 1`, globalSetup
- `supertest ^7.2.2` - HTTP integration tests against `createApp(testDb)`
- Real PostgreSQL via `docker compose -f docker-compose.test.yml` (test DB port 5433)

**E2E (root):**
- Playwright (`playwright.config.ts`) - specs in `e2e/` (login, chat, event-buchung, punkte-vergabe)
- Sequential (`workers: 1`), chromium only, baseURL `http://localhost:5556`
- Orchestrated via `docker-compose.e2e.yml`

## Configuration

**Environment (build-time, frontend):**
- `VITE_API_URL` - API base, injected as Vite build-arg (`frontend/Dockerfile`)

**Environment (runtime, backend)** — set via Portainer stack / compose:
- `JWT_SECRET` (required, server exits if missing), `DATABASE_URL` + `PG*` vars
- `PG_POOL_MAX` (def 20), `PG_IDLE_TIMEOUT` (def 30s), `PG_CONN_TIMEOUT` (def 5s)
- `SMTP_HOST/PORT/USER/PASS/SECURE`, `LOSUNG_API_KEY`, `CORS_ORIGINS`
- `FIREBASE_SERVICE_ACCOUNT` (fallback to `backend/push/firebase-service-account.json` file)

## Platform Requirements

**Development:**
- Node 20+, npm, Docker (for test/e2e PostgreSQL)
- iOS builds: macOS + Xcode + JDK 21; Android: JDK 21 + Android SDK 36

**Production:**
- Docker on `server.godsapp.de` (Netcup); 3 services (postgres, backend, frontend)
- Images on `ghcr.io/revisor01/konfi-quest-{backend,frontend}:latest`
- Backend container port `127.0.0.1:8623:5000`, frontend `8624:80`, postgres `5432`
- Fronting: Apache (KeyHelp) -> Traefik -> containers; `app.set('trust proxy', 1)`

---

*Stack analysis: 2026-06-09*
