# Architecture Research: Test-Suite + CI/CD Integration

**Domain:** Testing & CI/CD fuer bestehende Express+Ionic App
**Researched:** 2026-03-27
**Confidence:** HIGH

## System Overview: Test-Infrastruktur

```
┌─────────────────────────────────────────────────────────────────────┐
│                      GitHub Actions CI Pipeline                     │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Backend      │  │ Frontend     │  │ E2E          │              │
│  │ Integration  │  │ Component    │  │ Playwright   │              │
│  │ Tests        │  │ Tests        │  │ Tests        │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
├─────────┴─────────────────┴─────────────────┴───────────────────────┤
│                      Test Infrastructure                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ PostgreSQL   │  │ jsdom        │  │ Backend +    │              │
│  │ Service      │  │ (Vitest)     │  │ Frontend     │              │
│  │ Container    │  │              │  │ (Docker)     │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
├─────────────────────────────────────────────────────────────────────┤
│  npm audit  │  TypeScript Check  │  ESLint  │  Deploy Gate          │
└─────────────────────────────────────────────────────────────────────┘
```

### Bestehende Architektur-Eigenheiten

Das Backend nutzt ein **Factory-Function-Pattern** -- jede Route-Datei exportiert eine Funktion, die `db`, `rbacVerifier`, `roleHelpers` und weitere Dependencies injiziert bekommt:

```javascript
// activities.js
module.exports = (db, rbacVerifier, { requireAdmin, requireTeamer }, checkAndAwardBadges) => { ... }
// auth.js
module.exports = (db, verifyToken, transporter, SMTP_CONFIG, rateLimiters, rbacVerifier) => { ... }
```

Das ist der **zentrale Hebelpunkt** fuer Integration-Tests: Die `db`-Dependency kann durch einen Test-Pool ersetzt werden, der auf eine isolierte Test-Datenbank zeigt.

**Wichtig:** Das Backend ist CommonJS (`require`), das Frontend ist ESM (`import`). Die Test-Konfigurationen muessen das beruecksichtigen.

## Neue Komponenten

### 1. Backend Test-Infrastruktur (NEU)

| Komponente | Datei(en) | Zweck |
|------------|-----------|-------|
| Test-DB-Setup | `backend/tests/setup.js` | PostgreSQL-Pool auf Test-DB, Migrations, Seed, Teardown |
| App-Factory | `backend/tests/createTestApp.js` | Express-App mit Test-DB + gemockten Services erstellen |
| Auth-Helper | `backend/tests/helpers/auth.js` | JWT-Tokens fuer verschiedene Rollen generieren |
| Seed-Data | `backend/tests/helpers/seed.js` | Minimale Testdaten (Org, Rollen, Users, Jahrgang) |
| Route-Tests | `backend/tests/routes/*.test.js` | Ein Testfile pro Route-Datei (18 Dateien) |

### 2. Frontend Test-Erweiterungen (MODIFIZIERT)

| Komponente | Datei(en) | Zweck |
|------------|-----------|-------|
| Setup erweitert | `frontend/src/setupTests.ts` | Ionic-Mocks, Capacitor-Mocks hinzufuegen |
| Test-Utils | `frontend/src/tests/testUtils.tsx` | Custom render mit AppContext/Router-Wrapper |
| Hook-Tests | `frontend/src/hooks/__tests__/` | useOfflineQuery, useActionGuard |
| Context-Tests | `frontend/src/contexts/__tests__/` | AppContext Login/Logout Flows |

### 3. E2E Test-Infrastruktur (NEU)

| Komponente | Datei(en) | Zweck |
|------------|-----------|-------|
| Playwright Config | `e2e/playwright.config.ts` | Browser-Setup, Base-URL, Timeouts |
| Page Objects | `e2e/pages/*.ts` | LoginPage, DashboardPage, EventsPage, ChatPage |
| Test Specs | `e2e/tests/*.spec.ts` | Kernpfade: Login, Punkte, Events, Chat |
| Docker Compose | `e2e/docker-compose.test.yml` | Backend + DB + Frontend fuer E2E |
| Global Setup | `e2e/global-setup.ts` | DB-Seed, Server-Start, Health-Check |

### 4. CI/CD Pipeline (NEU + MODIFIZIERT)

| Komponente | Datei(en) | Zweck |
|------------|-----------|-------|
| Test-Workflow | `.github/workflows/test.yml` | NEU: Tests bei jedem Push auf alle Branches |
| Backend-Workflow | `.github/workflows/backend.yml` | MODIFIZIERT: `needs: test` hinzufuegen |
| Frontend-Workflow | `.github/workflows/frontend.yml` | MODIFIZIERT: `needs: test` hinzufuegen |

## Empfohlene Projektstruktur (Neue Dateien)

```
backend/
├── tests/
│   ├── setup.js                    # globalSetup: DB erstellen, Migrations, Pool
│   ├── teardown.js                 # globalTeardown: DB droppen, Pool schliessen
│   ├── createTestApp.js            # Express-App Factory fuer Tests
│   ├── vitest.config.js            # Separate Vitest-Config fuer Backend (CJS)
│   ├── helpers/
│   │   ├── auth.js                 # generateTestToken(role, orgId, userId)
│   │   ├── seed.js                 # seedTestData(db) -> Basis-Datensatz
│   │   └── request.js              # supertest(app) Wrapper mit Auth-Header
│   └── routes/
│       ├── auth.test.js
│       ├── activities.test.js
│       ├── badges.test.js
│       ├── categories.test.js
│       ├── chat.test.js
│       ├── events.test.js
│       ├── jahrgaenge.test.js
│       ├── konfi-management.test.js
│       ├── konfi.test.js
│       ├── levels.test.js
│       ├── material.test.js
│       ├── notifications.test.js
│       ├── organizations.test.js
│       ├── roles.test.js
│       ├── settings.test.js
│       ├── teamer.test.js
│       ├── users.test.js
│       └── wrapped.test.js
│
frontend/
├── src/
│   ├── setupTests.ts               # MODIFIZIERT: Ionic + Capacitor Mocks
│   └── tests/
│       ├── testUtils.tsx            # Custom render mit Contexts
│       ├── mocks/
│       │   ├── ionic.ts             # useIonRouter, useIonModal Mocks
│       │   ├── capacitor.ts         # Preferences, Network, Camera Mocks
│       │   └── api.ts               # axios Mock-Factory
│       ├── hooks/
│       │   ├── useOfflineQuery.test.ts
│       │   └── useActionGuard.test.ts
│       └── contexts/
│           └── AppContext.test.tsx
│
e2e/
├── playwright.config.ts
├── docker-compose.test.yml
├── global-setup.ts
├── pages/
│   ├── LoginPage.ts
│   ├── DashboardPage.ts
│   ├── EventsPage.ts
│   └── ChatPage.ts
└── tests/
    ├── auth.spec.ts
    ├── punkte.spec.ts
    ├── events.spec.ts
    └── chat.spec.ts
│
.github/workflows/
├── test.yml                         # NEU: Test-Pipeline
├── backend.yml                      # MODIFIZIERT: needs: test
└── frontend.yml                     # MODIFIZIERT: needs: test
```

## Architektur-Patterns

### Pattern 1: Test-DB pro Testlauf mit Transaction-Rollback

**Was:** Jeder Testlauf bekommt eine eigene PostgreSQL-Datenbank. Innerhalb des Laufs wird vor jedem Test eine Transaction gestartet und nach jedem Test ein ROLLBACK ausgefuehrt.

**Warum:** Echte PostgreSQL statt SQLite/Mocks, weil das Backend LATERAL Joins, COALESCE, RANK() OVER, Array-Aggregation und andere PG-spezifische Features nutzt. Transaction-Rollback ist schneller als TRUNCATE nach jedem Test.

**Umsetzung:**
```javascript
// backend/tests/setup.js
const { Pool } = require('pg');

const TEST_DB = `konfi_test_${process.pid}`;
const adminPool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres'
});

module.exports = async function globalSetup() {
  await adminPool.query(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
  await adminPool.query(`CREATE DATABASE "${TEST_DB}"`);
  // Migrations laufen in setup, nicht bei jedem Testfile
  await adminPool.end();
};
```

```javascript
// In jedem Testfile: Transaction-Wrapper
let client;
beforeEach(async () => {
  client = await testPool.connect();
  await client.query('BEGIN');
});
afterEach(async () => {
  await client.query('ROLLBACK');
  client.release();
});
```

**Trade-offs:**
- PRO: Tests sind isoliert, schnell, nutzen echte PG-Syntax
- CON: Braucht laufende PostgreSQL-Instanz (Docker oder CI Service Container)
- WICHTIG: Nested-Transaction-Problem (siehe unten)

### Pattern 2: App-Factory fuer Route-Tests

**Was:** Eine Funktion `createTestApp(db)` baut die Express-App mit Test-DB auf, ohne Server zu starten (kein `server.listen`). Supertest arbeitet direkt mit der App-Instanz.

**Warum:** server.js ist monolithisch (Socket.IO, SMTP, Firebase, Cron-Jobs, Graceful Shutdown). Tests brauchen nur Express-Routes + DB. Die bestehende Dependency-Injection ueber Factory-Functions macht das moeglich.

**Umsetzung:**
```javascript
// backend/tests/createTestApp.js
const express = require('express');
const helmet = require('helmet');

function createTestApp(db) {
  const app = express();
  app.use(express.json());
  app.use(helmet({ contentSecurityPolicy: false, strictTransportSecurity: false }));

  // KEIN Rate-Limiting in Tests (wuerde bei Parallel-Tests triggern)

  // RBAC Middleware mit Test-DB
  const { verifyTokenRBAC, requireAdmin, requireTeamer, requireSuperAdmin,
          requireOrgAdmin, filterByJahrgangAccess } = require('../middleware/rbac');
  const rbacVerifier = verifyTokenRBAC(db);
  const roleHelpers = { requireSuperAdmin, requireOrgAdmin, requireAdmin, requireTeamer };

  // Dummy-IO fuer Chat-Route (kein echter Socket.IO in Tests)
  const dummyIO = {
    to: () => ({ emit: () => {} }),
    emit: () => {},
    in: () => ({ emit: () => {} })
  };

  // Routes mounten -- gleiche Signatur wie server.js
  const badgesRouter = require('../routes/badges')(db, rbacVerifier, roleHelpers);
  const activitiesRouter = require('../routes/activities')(
    db, rbacVerifier, roleHelpers, badgesRouter.checkAndAwardBadges
  );
  // ... alle 18 Routes analog

  app.use('/api/admin/badges', badgesRouter);
  app.use('/api/admin/activities', activitiesRouter);
  // ... etc.

  // Error Handler (wie in server.js)
  app.use((err, req, res, next) => {
    res.status(500).json({ error: 'Something went wrong!' });
  });

  return app;
}
```

**Trade-offs:**
- PRO: Volle Route-Integration (Middleware, Validation, Auth) ohne Server-Overhead
- PRO: Kein Socket.IO/SMTP/Firebase noetig
- CON: createTestApp muss bei neuen Routes aktualisiert werden (koppelt an server.js)

### Pattern 3: JWT-Token-Factory fuer Auth-Tests

**Was:** Helper-Funktion generiert gueltige JWT-Tokens fuer beliebige Rollen, ohne echten Login-Flow.

**Warum:** verifyTokenRBAC prueft Token UND laedt User aus DB (mit LRU-Cache, 30s TTL). Test-User muessen in der DB existieren UND ein gueltiger Token vorhanden sein.

**Umsetzung:**
```javascript
// backend/tests/helpers/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-ci';

function generateTestToken(user) {
  return jwt.sign({
    id: user.id,
    type: user.role_name,
    display_name: user.display_name,
    organization_id: user.organization_id
  }, JWT_SECRET, { expiresIn: '1h' });
}

// Pre-built Token-Factories (User-IDs muessen mit Seed uebereinstimmen)
const tokens = {
  konfi:      () => generateTestToken({ id: 100, role_name: 'konfi',       display_name: 'Test Konfi',    organization_id: 1 }),
  teamer:     () => generateTestToken({ id: 101, role_name: 'teamer',      display_name: 'Test Teamer',   organization_id: 1 }),
  admin:      () => generateTestToken({ id: 102, role_name: 'admin',       display_name: 'Test Admin',    organization_id: 1 }),
  orgAdmin:   () => generateTestToken({ id: 103, role_name: 'org_admin',   display_name: 'Test OrgAdmin', organization_id: 1 }),
  superAdmin: () => generateTestToken({ id: 104, role_name: 'super_admin', display_name: 'Test Super',    organization_id: null }),
  // Andere Organisation (fuer Multi-Tenancy-Tests)
  adminOrg2:  () => generateTestToken({ id: 200, role_name: 'admin',       display_name: 'Org2 Admin',    organization_id: 2 }),
};
```

**Kritisch:** JWT_SECRET muss in Tests als Environment-Variable gesetzt werden (gleicher Wert wie in der Middleware). Der LRU-Cache in rbac.js cached User-Daten 30s -- bei schnellen Tests kein Problem, aber `invalidateUserCache()` exportieren fuer Tests wo User-Daten sich aendern.

### Pattern 4: Capacitor + Ionic Mock-Layer

**Was:** Mock-Module fuer Capacitor Plugins und Ionic Navigation, die in jsdom nicht funktionieren.

**Warum:** Frontend-Tests laufen in jsdom. Capacitor-Plugins (Preferences, Network, Camera, PushNotifications) brauchen native Bridges. Ionic Navigation (useIonRouter, useIonModal) braucht Ionic-Runtime.

**Umsetzung:**
```typescript
// frontend/src/tests/mocks/capacitor.ts
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn().mockResolvedValue({ value: null }),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  }
}));

vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn().mockResolvedValue({ connected: true, connectionType: 'wifi' }),
    addListener: vi.fn().mockReturnValue({ remove: vi.fn() }),
  }
}));
```

```typescript
// frontend/src/tests/testUtils.tsx
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

function renderWithProviders(ui: React.ReactElement, options = {}) {
  return render(
    <MemoryRouter>
      {/* AppContext braucht gemockten API-Client */}
      {ui}
    </MemoryRouter>,
    options
  );
}
```

**Hinweis:** `@ionic/react` Komponenten rendern in jsdom, aber ohne Shadow DOM. Snapshot-Tests auf Ionic-Komponenten sind fragil. Besser: Verhalten testen (Click-Handler, State-Aenderungen), nicht DOM-Struktur.

## Data Flow: Test-Ausfuehrung

### Backend Integration Test Flow

```
Vitest globalSetup
    |
    v
CREATE DATABASE konfi_test_<pid>
    |
    v
Run all SQL Migrations (backend/migrations/*.sql)
    |
    v
Seed: Organization, Roles, Users (alle 5 Rollen), Jahrgang, Kategorien, Aktivitaeten
    |
    v
+-- Testfile 1 (auth.test.js) -------------------------+
|  beforeEach: BEGIN Transaction                        |
|  Test: supertest(app).post('/api/auth/login')...      |
|  afterEach: ROLLBACK Transaction                      |
+-------------------------------------------------------+
+-- Testfile 2 (activities.test.js) --------------------+
|  beforeEach: BEGIN Transaction                        |
|  Test: supertest(app).get('/api/admin/activities')... |
|  afterEach: ROLLBACK Transaction                      |
+-------------------------------------------------------+
    |
    v
Vitest globalTeardown: DROP DATABASE, pool.end()
```

### Nested-Transaction-Problem (KRITISCH)

Einige Routes nutzen `db.getClient()` + `BEGIN/COMMIT` fuer atomare Operationen (z.B. Punkte-Vergabe in activities.js, Event-Buchung in events.js). Wenn der Test-Wrapper schon in einer Transaction ist, wuerde ein inneres `BEGIN` eine Subtransaction starten (PostgreSQL unterstuetzt das via SAVEPOINT).

**Loesung:** Fuer diese speziellen Tests den Transaction-Wrapper weglassen und stattdessen nach dem Test manuell aufraumen. Alternativ: `db.getClient()` im Test-Setup so wrappen, dass `BEGIN` zu `SAVEPOINT test_inner_N` wird und `COMMIT` zu `RELEASE SAVEPOINT`.

**Pragmatischer Ansatz:** Die meisten Routes nutzen `db.query()` (kein getClient). Nur 3-4 Routes nutzen Transaktionen (activities, events, konfi-management, badges). Fuer diese: `afterEach` mit explizitem TRUNCATE der betroffenen Tabellen statt Transaction-Rollback.

### CI Pipeline Flow

```
Push/PR auf beliebigen Branch
    |
    v
┌─── test.yml (Parallel Jobs) ──────────────────────────────────────┐
│                                                                    │
│  Job 1: Backend Tests              Job 2: Frontend Tests           │
│  ┌───────────────────────┐        ┌───────────────────────┐       │
│  │ services:              │        │ npm ci                 │       │
│  │   postgres:15-alpine   │        │ tsc --noEmit           │       │
│  │ npm ci                 │        │ vitest run             │       │
│  │ vitest run             │        │ eslint                 │       │
│  │ npm audit --audit-level│        └───────────────────────┘       │
│  │   =moderate            │                                        │
│  └───────────────────────┘                                        │
│                                                                    │
│  Job 3: E2E Tests (nur bei PR auf main)                            │
│  ┌──────────────────────────────────────────────────┐              │
│  │ docker compose -f e2e/docker-compose.test.yml up  │              │
│  │ wait-for backend:5000/api/health                   │              │
│  │ npx playwright test                                │              │
│  │ Upload: test-results/ als Artifact                 │              │
│  └──────────────────────────────────────────────────┘              │
└────────────────────────────────────────────────────────────────────┘
    |
    v
Alle Jobs gruen?
    | JA                              | NEIN
    v                                 v
backend.yml / frontend.yml           PR blockiert
(Deploy via Portainer Webhook)
```

### Socket.IO Test-Strategie

Socket.IO wird in Backend-Integration-Tests **nicht** direkt getestet. Stattdessen:

1. **Chat-HTTP-Endpoints** (POST message, GET rooms, GET messages) werden per supertest getestet
2. **Socket-Events** (typing, joinRoom) werden in E2E-Tests implizit ueber den Chat-Flow getestet
3. In createTestApp wird ein **Dummy-IO** uebergeben, der `to().emit()` und `emit()` als No-Ops bereitstellt
4. Die Chat-Route bekommt den Dummy-IO als Parameter:
```javascript
app.use('/api/chat', chatRoutes(db, { verifyTokenRBAC: rbacVerifier }, uploadsDir, chatUpload, dummyIO));
```

## Test-Datenbank Lifecycle

### Lokale Entwicklung

```bash
# Option 1: Separater Test-Container (empfohlen)
docker run -d --name konfi-test-db -p 5433:5432 \
  -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test postgres:15-alpine

# Tests ausfuehren
TEST_DATABASE_URL=postgresql://test:test@localhost:5433/postgres \
JWT_SECRET=test-secret \
npx vitest run --config backend/tests/vitest.config.js

# Option 2: Bestehenden Konfi-DB-Container nutzen (andere Database)
# Die Test-DB wird als separate Database im gleichen Container erstellt
```

### CI (GitHub Actions)

```yaml
services:
  postgres:
    image: postgres:15-alpine
    env:
      POSTGRES_PASSWORD: test
      POSTGRES_USER: test
      POSTGRES_DB: postgres
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

### Isolation-Garantien

| Ebene | Mechanismus | Garantiert |
|-------|------------|------------|
| Zwischen Testlaeufen | Eigene Database pro `process.pid` | Parallele Testlaeufe kollidieren nicht |
| Zwischen Testfiles | Shared DB, Transaction-Rollback | Kein State-Leak zwischen Files |
| Zwischen einzelnen Tests | Transaction-Rollback (SAVEPOINT bei Nested) | Volle Isolation |
| Multi-Tenancy | Seed mit 2 Organisationen | Org-Isolation testbar |

## Seed-Daten Struktur

Der Seed muss die RBAC-Hierarchie und Multi-Tenancy abbilden:

```
Organization 1: "Test-Gemeinde"
  ├── Roles: konfi(1), teamer(2), admin(3), org_admin(4), super_admin(5)
  ├── Users:
  │   ├── ID 100: Konfi (role_id=1, org=1) + konfi_profile + jahrgang
  │   ├── ID 101: Teamer (role_id=2, org=1)
  │   ├── ID 102: Admin (role_id=3, org=1)
  │   └── ID 103: OrgAdmin (role_id=4, org=1)
  ├── Jahrgang: "2025/26" mit confirmation_date
  ├── Kategorien: 2-3 Basis-Kategorien
  └── Aktivitaeten: 3-4 mit verschiedenen Typen (gottesdienst/gemeinde)

Organization 2: "Andere Gemeinde" (fuer Isolation-Tests)
  ├── Users:
  │   └── ID 200: Admin (role_id=3, org=2)
  └── Jahrgang: eigener Jahrgang

Super-Admin: ID 104 (role_id=5, org=null)
```

## Integration Points

### Bestehende Workflows modifizieren

| Workflow | Aenderung | Details |
|----------|-----------|---------|
| `backend.yml` | `needs: [test]` beim build-and-push Job | Deploy nur nach gruenen Tests |
| `frontend.yml` | `needs: [test]` beim build-and-push Job | Deploy nur nach gruenen Tests |

**Wichtig:** backend.yml triggert aktuell nur auf `push to main` + `paths: backend/**`. Der neue test.yml triggert auf ALLE Branches. Die `needs`-Verknuepfung funktioniert nur wenn test.yml auch auf main/push triggert.

### Mock-Matrix: Was wird wo gemockt?

| Dependency | Backend Integration | Frontend Unit | E2E |
|------------|---------------------|---------------|-----|
| PostgreSQL | ECHT (Service Container) | N/A | ECHT (Docker Compose) |
| RBAC Middleware | ECHT (verifyTokenRBAC + DB) | N/A | ECHT |
| Firebase/FCM | MOCK (vi.mock pushService) | N/A | SKIP (kein FCM-ENV) |
| SMTP/Nodemailer | MOCK (vi.mock emailService) | N/A | SKIP |
| Socket.IO | DUMMY (emit-Stubs) | N/A | ECHT (Browser-Client) |
| Capacitor Plugins | N/A | MOCK (alle Plugins) | N/A (Browser, nicht nativ) |
| Ionic Navigation | N/A | PARTIAL MOCK (useIonRouter) | ECHT (Chromium) |
| axios/API-Calls | N/A | MOCK (vi.mock axios) | ECHT |
| Losungs-API | MOCK (fetch-Mock) | MOCK | SKIP |
| file-type (Magic Bytes) | ECHT (mit Test-Dateien) | N/A | ECHT |

### Interne Boundaries

| Boundary | Kommunikation | Test-Relevanz |
|----------|---------------|---------------|
| Routes <-> DB | pg Pool queries | Kern des Integration-Tests |
| Routes <-> RBAC Middleware | verifyTokenRBAC(db) | Immer echt, nie mocken |
| Routes <-> PushService | pushService.send() | Mocken (kein Firebase in CI) |
| Routes <-> emailService | emailService.send() | Mocken (kein SMTP in CI) |
| Routes <-> liveUpdate | liveUpdate.emit() | Mocken (braucht io-Instanz) |
| Routes <-> pointTypeGuard | checkPointTypeEnabled(db) | Echt (liest aus DB) |
| Routes <-> bookingUtils | Shared Booking-Logik | Echt (pure Functions + DB) |

## Build-Reihenfolge (empfohlen)

Die Reihenfolge folgt der Dependency-Kette:

### Phase 1: Backend Test-Infrastruktur
1. `backend/tests/vitest.config.js` -- Vitest-Config (CommonJS-kompatibel)
2. `backend/tests/setup.js` + `teardown.js` -- DB-Lifecycle
3. `backend/tests/helpers/auth.js` -- Token-Factory
4. `backend/tests/helpers/seed.js` -- Basis-Daten
5. `backend/tests/createTestApp.js` -- App-Factory (alle 18 Routes)
6. `backend/package.json` -- vitest + supertest als devDependencies
7. **Ein Smoke-Test** (`auth.test.js` mit Login + Register) zum Validieren der Infrastruktur

### Phase 2: Backend Route-Tests (18 Dateien)
Reihenfolge nach Abhaengigkeit:
1. `auth.test.js` -- Login, Register, Token-Refresh (Basis fuer alle)
2. `roles.test.js` + `organizations.test.js` -- RBAC-Grundlagen
3. `jahrgaenge.test.js` + `categories.test.js` -- Stammdaten
4. `activities.test.js` + `badges.test.js` -- Kern-Spielmechanik (nutzen Transaktionen!)
5. `konfi.test.js` + `konfi-management.test.js` -- Konfi-CRUD
6. `events.test.js` -- Event-Buchung + Warteliste (komplex, nutzt Transaktionen!)
7. `chat.test.js` -- Chat-CRUD (HTTP-Endpoints, ohne Socket)
8. `levels.test.js` + `settings.test.js` + `notifications.test.js` + `users.test.js`
9. `teamer.test.js` + `material.test.js` + `wrapped.test.js`

### Phase 3: Frontend Test-Setup
1. `setupTests.ts` erweitern (Capacitor + Ionic Global-Mocks)
2. `tests/mocks/` -- Capacitor, Ionic, API Mock-Dateien
3. `tests/testUtils.tsx` -- Custom render mit Provider-Wrapper
4. Hook-Tests (useOfflineQuery, useActionGuard)
5. Context-Tests (AppContext Login/Logout)

### Phase 4: CI/CD Pipeline
1. `.github/workflows/test.yml` -- Neue Test-Pipeline
2. `backend.yml` + `frontend.yml` modifizieren (needs: test)
3. Branch-Protection-Rule auf GitHub (require test.yml to pass)

### Phase 5: E2E Tests (optional, hoehere Komplexitaet)
1. `e2e/docker-compose.test.yml` (Backend + DB + nginx Frontend)
2. `e2e/playwright.config.ts` + `e2e/global-setup.ts`
3. Page Objects (LoginPage, DashboardPage, EventsPage, ChatPage)
4. Kernpfad-Tests (Login -> Dashboard -> Event buchen -> Chat schreiben)

## Anti-Patterns

### Anti-Pattern 1: SQLite als Test-DB-Ersatz

**Was Leute tun:** SQLite in-memory statt PostgreSQL, weil "schneller und einfacher"
**Warum falsch:** Backend nutzt PG-spezifische Features: LATERAL JOIN, RANK() OVER, ON CONFLICT DO UPDATE, COALESCE mit Arrays, Interval-Arithmetik, JSONB. SQLite wuerde Syntax-Fehler oder falsche Ergebnisse liefern.
**Stattdessen:** PostgreSQL 15-alpine als Docker Container. Startup dauert 2-3 Sekunden in CI.

### Anti-Pattern 2: Gesamten server.js in Tests importieren

**Was Leute tun:** `require('./server')` im Test, um die Express-App zu bekommen
**Warum falsch:** server.js startet Socket.IO, SMTP-Verbindung, Firebase-Init, Background-Cron-Jobs, chatUtils.initializeChatRooms(), und ruft `server.listen()` auf. Das verursacht Port-Konflikte, haengende Prozesse, und Firebase-Fehler in CI.
**Stattdessen:** `createTestApp(db)` baut nur Express + Routes + Middleware auf. Kein listen(), kein Socket.IO, kein SMTP.

### Anti-Pattern 3: RBAC-Middleware mocken

**Was Leute tun:** `verifyTokenRBAC` stubben damit alle Requests durchgehen, "um Routes isoliert zu testen"
**Warum falsch:** 80% der sicherheitsrelevanten Bugs sind Autorisierungs-Fehler. Wenn Tests die Auth umgehen, finden sie Org-Isolation-Verletzungen, Rollen-Escalation und fehlende Checks nicht.
**Stattdessen:** Echte Middleware + echte Tokens + Negativ-Tests ("Konfi darf KEINE Admin-Route aufrufen", "Admin Org2 sieht KEINE Daten von Org1").

### Anti-Pattern 4: Snapshot-Tests fuer Ionic-Komponenten

**Was Leute tun:** `expect(component).toMatchSnapshot()` auf IonCard, IonList etc.
**Warum falsch:** Ionic rendert in jsdom ohne Shadow DOM und ohne Styling. Snapshots brechen bei jedem Ionic-Update, ohne echte Regressions-Information.
**Stattdessen:** Verhalten testen (Button-Klick loest Aktion aus, Loading-State wird angezeigt, Fehlermeldung erscheint).

## Skalierungs-Ueberlegungen

| Aspekt | Jetzt (18 Route-Files) | Bei 50+ Tests pro File | Mitigation |
|--------|------------------------|------------------------|------------|
| CI-Dauer | ~30s Backend, ~15s Frontend | ~2-3min total | Vitest Threads (default), parallel Jobs |
| DB-Connections | 1 Pool, max 5 | Pool-Exhaustion bei Parallelisierung | `PG_POOL_MAX=5` in Tests, `--pool=forks` statt threads |
| Flaky E2E | Selten bei 4 Tests | Haeufig bei 20+ | Retry-Policy (2x), Screenshot + Trace on Failure |
| Test-Wartung | createTestApp spiegelt server.js | Drift wenn Routes hinzukommen | Kommentar in server.js: "Route hier + in createTestApp.js mounten" |

## Quellen

- Codebase-Analyse: server.js (Route-Mounting, 18 Factory-Functions), database.js (Pool, Migrations), rbac.js (LRU-Cache, Rollen-Hierarchie)
- Bestehende CI: backend.yml + frontend.yml (GHCR Build + Portainer Webhook)
- Bestehende Test-Infra: frontend/vite.config.ts (Vitest konfiguriert), setupTests.ts, @testing-library Dependencies, Cypress als devDep (ungenutzt)
- Backend-Eigenheiten: CommonJS (require/module.exports), kein ESM, pg Pool mit konfigurierbarem Pool-Max

**Confidence:** HIGH -- alle Empfehlungen basieren auf direkter Analyse der bestehenden Codebase-Patterns (Factory-DI, RBAC-Middleware, PG-spezifische Queries). Kein externes Guessing noetig.

---
*Architecture research for: Test-Suite + CI/CD Integration in Konfi Quest*
*Researched: 2026-03-27*
