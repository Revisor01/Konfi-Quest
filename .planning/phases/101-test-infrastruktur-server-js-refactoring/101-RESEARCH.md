# Phase 101: Test-Infrastruktur + server.js Refactoring - Research

**Researched:** 2026-03-27
**Domain:** Express.js Test-Infrastruktur, createApp Factory Pattern, PostgreSQL Test-DB Lifecycle, Vitest Backend-Setup
**Confidence:** HIGH

## Summary

Phase 101 baut die gesamte Test-Infrastruktur fuer das Konfi Quest Backend auf. Der zentrale Blocker ist das monolithische `server.js` (591 Zeilen), das beim Import sofort Server, Socket.IO, SMTP, Firebase und Cron-Jobs startet. Ohne Refactoring zu einer `createApp(db, options)` Factory sind keine Integration-Tests moeglich.

Die bestehende Route-Architektur ist bereits test-freundlich: Alle 18 Routes nutzen Factory-DI (`module.exports = (db, rbacVerifier, roleHelpers, ...) => router`). Das Refactoring muss nur die Verdrahtung in eine exportierbare Funktion extrahieren -- keine Route-Logik aendern.

Kritische Entscheidungen aus CONTEXT.md sind bereits getroffen: TRUNCATE CASCADE statt Transaction-Rollback (wegen interner Transaktionen in Routes), sequentielle Vitest-Ausfuehrung, docker-compose.test.yml fuer Test-DB, Seed als JS-Modul mit ~100 Datensaetzen.

**Primary recommendation:** server.js in createApp-Factory + Aufruf-Wrapper aufteilen, dann Vitest + supertest + Test-DB-Lifecycle aufbauen, Seed-Fixtures mit allen 5 RBAC-Rollen in 2 Orgs erstellen, einen Smoke-Test schreiben der `npm test` validiert.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** TRUNCATE CASCADE vor jedem Test. Kein Transaction-Rollback (Routes nutzen intern BEGIN/COMMIT in activities, events, konfi-management, badges). ~5ms pro Cleanup ist akzeptabel.
- **D-02:** Vitest laeuft sequentiell fuer Backend-Tests (kein `--parallel`). Verhindert DB-Races.
- **D-03:** Docker Container via docker-compose.test.yml (postgres:16-alpine). Lokal und in CI identisch.
- **D-04:** `npm test` startet Container automatisch (oder nutzt laufenden). In CI: GitHub Actions Service Container.
- **D-05:** Realistischer Seed mit ~100 Datensaetzen: 2 Organisationen, alle 5 RBAC-Rollen pro Org, je 2-3 Konfis/Teamer pro Org, Beispiel-Events/Activities/Badges/Levels/Zertifikate/Bonus-Punkte/Chat-Raeume.
- **D-06:** Seed als JavaScript-Modul (nicht SQL) -- kann von Tests importiert werden um IDs/Tokens zu referenzieren.
- **D-07:** createApp Factory-Pattern: `createApp(db, options)` exportiert Express-App OHNE Seiteneffekte (kein listen(), kein Socket.IO, kein SMTP, kein Cron, kein Firebase).
- **D-08:** server.js ruft `createApp()` auf und startet Server + Socket.IO + Cron. Produktions-Verhalten aendert sich NICHT.
- **D-09:** Tests rufen `createApp(testDb)` auf und bekommen saubere Express-App fuer supertest.
- **D-10:** Helper generiert echte JWTs fuer alle 5 Rollen + beide Orgs. RBAC wird NIEMALS gemockt -- echte Middleware, echte Tokens.

### Claude's Discretion
- Vitest Config Details (vitest.config.backend.ts Setup)
- TRUNCATE-Reihenfolge (FK-Constraints beachten)
- Ob globalSetup/globalTeardown oder beforeAll/afterAll in Testdateien

### Deferred Ideas (OUT OF SCOPE)
Keine -- alle Punkte sind Phase-relevant.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INF-01 | server.js refactored -- Express-App exportierbar fuer supertest (createApp-Pattern) | createApp Factory Pattern (Section Architecture Patterns), Route-Signatur-Analyse aller 18 Routes, JWT_SECRET Top-Level-Problem |
| INF-02 | createTestApp Helper erstellt Test-Express-App mit echtem pg-Pool gegen Test-DB | createTestApp Code-Beispiel, Mock-Matrix (was gemockt wird: SMTP/Firebase/Socket.IO/Cron), was echt bleibt (RBAC/DB) |
| INF-03 | Test-DB Lifecycle: Setup, Migration, Seed, Teardown pro Test-Suite | docker-compose.test.yml Pattern, globalSetup/Teardown, runMigrations-Wiederverwendung, TRUNCATE CASCADE Reihenfolge |
| INF-04 | Auth-Test-Helpers generieren echte JWTs fuer alle 5 RBAC-Rollen | JWT-Token-Factory Pattern, JWT_SECRET Env-Handling, Token-Payload-Struktur aus auth.js/rbac.js |
| INF-05 | Seed-Fixtures fuer 2+ Organisationen, alle Rollen, Beispieldaten | Seed-Daten-Struktur, FK-Abhaengigkeiten, ~100 Datensaetze Plan, JS-Modul-Export |
| INF-06 | Vitest Backend-Config (vitest.config.backend.ts) mit sequentieller Ausfuehrung | Vitest 4.1 CJS-Kompatibilitaet, sequentielle Config, globalSetup/Teardown Einbindung |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **RBAC-Struktur verwenden** -- Alte admins/konfis Tabellen sind deprecated
- **Deutsche Entwicklungssprache** -- Kommentare, Variablennamen deutsch
- **KEINE UNICODE EMOJIS** -- Nur IonIcons/Line Icons erlaubt (auch in Test-Dateien, Seed-Daten!)
- **ECHTE UMLAUTE** -- ue/oe/ae verboten, immer ue/oe/ae verwenden
- **NIEMALS docker-compose auf dem Server** -- Deployment nur via git push + Portainer
- **Produktivsystem** -- Alle Aenderungen muessen der RBAC-Struktur folgen

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.2 | Test-Runner fuer Backend | Bereits im Frontend, einheitlicher Runner, CJS-Support transparent |
| supertest | 7.2.2 | HTTP-Level Express-Tests | De-facto-Standard fuer Express-API-Tests, 2.4M weekly downloads |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pg | 8.16.3 (bestehend) | PostgreSQL Client | Bereits installiert, wird fuer Test-Pool wiederverwendet |
| jsonwebtoken | 9.0.2 (bestehend) | JWT-Erzeugung in Auth-Helpers | Bereits installiert, Token-Factory nutzt gleiche Lib |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| supertest | node:test + fetch | Kein automatisches Port-Management, mehr Boilerplate |
| TRUNCATE CASCADE | Transaction-Rollback | Schneller (~1ms vs ~5ms), ABER bricht bei Routes mit internen Transaktionen (activities, events, konfi-management, badges) |
| docker-compose.test.yml | Testcontainers | Over-Engineering: 15s extra Startup, Docker-in-Docker in CI |
| Seed als JS-Modul | Seed als SQL | SQL kann nicht von Tests importiert werden um IDs zu referenzieren |

**Installation:**
```bash
cd backend && npm install -D vitest supertest
```

**Version verification:** vitest 4.1.2, supertest 7.2.2 (verifiziert via `npm view` am 2026-03-27).

## Architecture Patterns

### Recommended Project Structure
```
backend/
  server.js              # MODIFIZIERT: importiert createApp, startet Server + IO + Cron
  createApp.js           # NEU: Express-App Factory ohne Seiteneffekte
  database.js            # MODIFIZIERT: exportiert auch createPool() Factory
  tests/
    vitest.config.ts     # NEU: Vitest Backend-Config
    globalSetup.js       # NEU: Test-DB erstellen, migrieren
    globalTeardown.js    # NEU: Test-DB droppen
    helpers/
      testApp.js         # NEU: createTestApp(db) Wrapper
      auth.js            # NEU: Token-Factory fuer alle 5 Rollen x 2 Orgs
      seed.js            # NEU: ~100 Datensaetze als JS-Modul
      db.js              # NEU: Test-Pool + TRUNCATE-Helper
    routes/
      smoke.test.js      # NEU: Erster Smoke-Test (Health + Auth Login)
```

### Pattern 1: createApp Factory (INF-01)

**Was:** `server.js` wird in zwei Dateien aufgeteilt: `createApp.js` (pure Express-App) und `server.js` (Aufruf + Server-Start).

**Warum:** server.js hat aktuell folgende Seiteneffekte beim Import:
1. Socket.IO Server erstellen (Zeile 43-52)
2. SMTP-Transporter erstellen + verify (Zeile 181-188)
3. Firebase initialisieren (Zeile 538-545)
4. BackgroundService starten (Zeile 522)
5. chatUtils.initializeChatRooms aufrufen (Zeile 516)
6. server.listen (Zeile 549)
7. Graceful Shutdown Handler registrieren (Zeile 570-591)

**KRITISCH -- JWT_SECRET Top-Level Guard:**
Mehrere Module lesen `process.env.JWT_SECRET` auf Top-Level und werfen sofort einen Error wenn es fehlt:
- `backend/middleware/rbac.js` Zeile 3-6
- `backend/routes/auth.js` Zeile 22-24
- `backend/routes/konfi.js` Zeile 13-15
- `backend/routes/chat.js` Zeile 1057 (inline)
- `backend/server.js` Zeile 25-29

**Konsequenz:** `JWT_SECRET` muss als Environment-Variable gesetzt sein BEVOR irgendein `require()` auf diese Module laeuft. In Tests: `process.env.JWT_SECRET = 'test-secret'` ganz am Anfang der globalSetup oder in vitest.config.ts `env`.

**Beispiel createApp.js:**
```javascript
// backend/createApp.js
const express = require('express');
const helmet = require('helmet');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function createApp(db, options = {}) {
  const {
    transporter = null,    // SMTP (null in Tests)
    smtpConfig = {},
    io = null,             // Socket.IO (null in Tests)
    rateLimiters = {},     // Leer in Tests
    uploadsDir = path.join(__dirname, 'uploads'),
  } = options;

  const app = express();
  app.set('trust proxy', 1);

  // Security
  app.use(helmet({
    contentSecurityPolicy: false,
    strictTransportSecurity: false,
    crossOriginEmbedderPolicy: false,
  }));

  // Rate-Limiting nur wenn uebergeben
  if (rateLimiters.general) {
    app.use(rateLimiters.general);
  }

  app.use(express.json());

  // Upload-Verzeichnisse erstellen
  // ... (wie bisher)

  // RBAC Middleware
  const { verifyTokenRBAC, filterByJahrgangAccess,
          requireSuperAdmin, requireOrgAdmin, requireAdmin, requireTeamer
  } = require('./middleware/rbac');
  const rbacVerifier = verifyTokenRBAC(db);
  const roleHelpers = { requireSuperAdmin, requireOrgAdmin, requireAdmin, requireTeamer };

  // Dummy-IO fuer Tests wenn kein io uebergeben
  const ioOrDummy = io || {
    to: () => ({ emit: () => {} }),
    emit: () => {},
    in: () => ({ emit: () => {} }),
  };

  // Dummy-Transporter fuer Tests
  const transporterOrDummy = transporter || { sendMail: async () => ({}) };

  // Routes mounten (gleiche Signatur wie bisher)
  const badgesRouter = require('./routes/badges')(db, rbacVerifier, roleHelpers);
  const activitiesRouter = require('./routes/activities')(
    db, rbacVerifier, roleHelpers, badgesRouter.checkAndAwardBadges
  );

  // Health
  app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Konfi Points API is running' });
  });

  // Alle Route-Mounts hier...
  app.use('/api/auth', require('./routes/auth')(
    db, verifyToken, transporterOrDummy, smtpConfig, rateLimiters, rbacVerifier
  ));
  // ... (alle 18 Routes analog)

  // Error Handler
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
  });

  return app;
}

module.exports = { createApp };
```

### Pattern 2: Test-DB Lifecycle via globalSetup/globalTeardown (INF-03)

**Was:** globalSetup erstellt eine Test-Datenbank, fuehrt alle Migrations aus, seeded Basisdaten. globalTeardown droppt die DB.

**Empfehlung: globalSetup + beforeEach(TRUNCATE)** statt beforeAll/afterAll in Testdateien.
- globalSetup: 1x pro `npm test` Lauf -- DB erstellen, migrieren, seeden
- beforeEach in jedem Testfile: TRUNCATE + Re-Seed (oder nur TRUNCATE + spezifischer Insert)
- globalTeardown: DB droppen, Pool schliessen

**Warum globalSetup statt beforeAll:** Mit `--pool=forks` laeuft jeder Testfile in eigenem Worker. globalSetup laeuft garantiert einmal VOR allen Workern. beforeAll in Testdateien wuerde pro Worker laufen.

**ABER:** Da Tests sequentiell laufen (D-02), ist der Unterschied gering. globalSetup ist trotzdem sauberer weil DB-Erstellung und Migration nur 1x stattfinden.

**Beispiel:**
```javascript
// backend/tests/globalSetup.js
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const TEST_DB_NAME = 'konfi_test';
const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';

module.exports = async function globalSetup() {
  const adminPool = new Pool({ connectionString: ADMIN_URL });

  // DB droppen falls vorhanden, neu erstellen
  await adminPool.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
  await adminPool.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  await adminPool.end();

  // Migrations auf Test-DB ausfuehren
  const testUrl = ADMIN_URL.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`);
  const testPool = new Pool({ connectionString: testUrl });

  // init-scripts zuerst (007_levels.sql)
  const initDir = path.join(__dirname, '..', 'init-scripts');
  if (fs.existsSync(initDir)) {
    const initFiles = fs.readdirSync(initDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of initFiles) {
      await testPool.query(fs.readFileSync(path.join(initDir, file), 'utf8'));
    }
  }

  // runMigrations wiederverwenden
  const { runMigrations } = require('../database');
  // ACHTUNG: database.js fuehrt Pool-Test + Migration automatisch aus!
  // Besser: runMigrations direkt auf testPool aufrufen
  await runMigrations(testPool);

  await testPool.end();
};
```

### Pattern 3: TRUNCATE CASCADE Reihenfolge (Claude's Discretion)

**FK-Abhaengigkeiten erfordern korrekte Reihenfolge.** Mit `CASCADE` wird das automatisch geloest, aber die Reihenfolge der Tabellen in der TRUNCATE-Anweisung spielt keine Rolle wenn CASCADE verwendet wird.

**Empfohlener TRUNCATE-Helper:**
```javascript
// backend/tests/helpers/db.js
const TRUNCATE_TABLES = [
  'chat_messages',
  'chat_participants',
  'chat_rooms',
  'event_bookings',
  'konfi_activities',
  'konfi_badges',
  'bonus_points',
  'konfi_profiles',
  'user_jahrgang_assignments',
  'users',
  'activities',
  'badges',
  'events',
  'event_timeslots',
  'jahrgaenge',
  'categories',
  'levels',
  'organizations',
  'roles',
  'schema_migrations',
].join(', ');

async function truncateAll(db) {
  await db.query(`TRUNCATE ${TRUNCATE_TABLES} RESTART IDENTITY CASCADE`);
}
```

**RESTART IDENTITY** setzt Serial-Counter zurueck -- damit stimmen erwartete IDs im Seed ueberein.

### Pattern 4: Auth-Test-Helper (INF-04)

**Token-Payload-Struktur** (aus auth.js Zeile 138 + rbac.js Zeile 68-76):
```javascript
// Was auth.js signiert:
jwt.sign({
  id: user.id,
  type: roleType,          // 'konfi', 'teamer', oder 'admin'
  display_name: user.display_name,
  organization_id: user.organization_id,
  role_id: user.role_id
}, JWT_SECRET, { expiresIn: '15m' });

// Was rbac.js liest:
decoded.id     -> fuer DB-Lookup
decoded.iat    -> fuer Soft-Revoke-Check
```

**Wichtig:** rbac.js verwendet den Token NUR um `decoded.id` zu bekommen. Dann laedt es den vollstaendigen User aus der DB (mit Cache). Der Token-Payload muss also vor allem eine gueltige `id` enthalten die in der Test-DB existiert.

**Empfehlung fuer Auth-Helper:**
```javascript
// backend/tests/helpers/auth.js
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

// Seed-User-IDs (muessen mit seed.js uebereinstimmen)
const SEED_USERS = {
  // Org 1
  konfi1:      { id: 1, type: 'konfi',  organization_id: 1 },
  konfi2:      { id: 2, type: 'konfi',  organization_id: 1 },
  teamer1:     { id: 3, type: 'teamer', organization_id: 1 },
  admin1:      { id: 4, type: 'admin',  organization_id: 1 },
  orgAdmin1:   { id: 5, type: 'admin',  organization_id: 1 },
  // Org 2
  konfi3:      { id: 6, type: 'konfi',  organization_id: 2 },
  teamer2:     { id: 7, type: 'teamer', organization_id: 2 },
  admin2:      { id: 8, type: 'admin',  organization_id: 2 },
  orgAdmin2:   { id: 9, type: 'admin',  organization_id: 2 },
  // Super-Admin (org-uebergreifend)
  superAdmin:  { id: 10, type: 'admin', organization_id: null },
};

function generateToken(userKey) {
  const user = SEED_USERS[userKey];
  return jwt.sign({
    id: user.id,
    type: user.type,
    display_name: `Test ${userKey}`,
    organization_id: user.organization_id,
  }, JWT_SECRET, { expiresIn: '1h' });
}

// Convenience: alle Tokens vorab generieren
function getAllTokens() {
  const tokens = {};
  for (const key of Object.keys(SEED_USERS)) {
    tokens[key] = generateToken(key);
  }
  return tokens;
}
```

### Anti-Patterns to Avoid
- **RBAC-Middleware mocken:** Niemals `vi.mock('./middleware/rbac')`. Echte Tokens, echte Middleware, echte DB-Lookups. Das ist der wertvollste Teil der Tests.
- **server.js direkt importieren:** Startet Socket.IO, SMTP, Firebase, Cron, listen(). Immer `createApp()` verwenden.
- **Parallele Ausfuehrung:** Locked Decision D-02 -- sequentiell, kein `--parallel`.
- **Transaction-Rollback:** Locked Decision D-01 -- TRUNCATE CASCADE, weil Routes interne Transaktionen nutzen.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP-Test-Client | Eigener fetch-Wrapper | supertest | Automatisches Port-Management, Fluent API, Express-Integration |
| JWT-Signierung in Tests | Manuelle Token-Strings | jsonwebtoken.sign() | Gleiche Lib wie Produktion, korrekte iat/exp Claims |
| DB-Migration in Tests | Eigenes Schema-Script | runMigrations aus database.js | Gleicher Migrations-Pfad wie Produktion, kein Schema-Drift |
| Test-DB-Container | Manuelles docker run | docker-compose.test.yml | Reproduzierbar, identisch in CI und lokal |

## Common Pitfalls

### Pitfall 1: JWT_SECRET Top-Level Guard verhindert require()
**Was passiert:** `require('./middleware/rbac')` wirft sofort `Error: JWT_SECRET environment variable is required` wenn die Env-Variable nicht gesetzt ist.
**Root Cause:** rbac.js, auth.js, konfi.js lesen JWT_SECRET auf Module-Top-Level (nicht in einer Funktion).
**Vermeidung:** In `vitest.config.ts` die `env`-Option setzen: `env: { JWT_SECRET: 'test-secret-key', NODE_ENV: 'test' }`. Oder in globalSetup ganz am Anfang: `process.env.JWT_SECRET = 'test-secret-key'`.
**Warnsignal:** `Error: JWT_SECRET environment variable is required` beim Test-Start.

### Pitfall 2: database.js fuehrt automatisch Migrations beim Import aus
**Was passiert:** `require('./database')` in server.js loest sofort `pool.query('SELECT NOW()').then(() => runMigrations(pool))` aus.
**Root Cause:** database.js Zeile 59-64 hat Top-Level Side-Effect.
**Vermeidung:** database.js refactoren: `runMigrations` exportieren, aber den automatischen Aufruf nur wenn `require.main === module` oder via explizitem Init-Call. Fuer Phase 101 minimal-invasiv: In createApp die Route-Imports direkt mit dem uebergebenen `db` verdrahten, database.js wird nur noch von server.js importiert.
**Warnsignal:** "Database startup failed" Fehler in Tests.

### Pitfall 3: RBAC LRU-Cache liefert stale Daten in Tests
**Was passiert:** Cache TTL ist 30s. Wenn ein Test einen User aendert und sofort abfragt, bekommt er cached Daten.
**Root Cause:** rbac.js cached User-Objekte 30 Sekunden (USER_CACHE_TTL).
**Vermeidung:** `process.env.NODE_ENV === 'test'` pruefen und Cache deaktivieren, ODER `invalidateUserCache()` nach Rollen-Aenderungen in Tests aufrufen. Besser: `USER_CACHE_TTL` auf 0 setzen via ENV.
**Warnsignal:** Tests die Rollen-Aenderungen pruefen schlagen sporadisch fehl.

### Pitfall 4: verifyToken vs verifyTokenRBAC Verwirrung
**Was passiert:** server.js definiert ZWEI Auth-Middlewares: `verifyToken` (Zeile 405-418, einfacher JWT-Check) und `rbacVerifier = verifyTokenRBAC(db)` (aus rbac.js, laedt User aus DB). Auth-Route nutzt `verifyToken`, alle anderen nutzen `rbacVerifier`.
**Vermeidung:** In createApp BEIDE Middlewares erstellen. `verifyToken` ist eine lokale Funktion die JWT_SECRET braucht -- muss auch in createApp definiert werden.

### Pitfall 5: Badges-Router hat Cross-Dependency zu Activities
**Was passiert:** `badgesRouter.checkAndAwardBadges` wird an activitiesRouter, eventsRouter, und konfi-managementRouter uebergeben.
**Root Cause:** badges.js Zeile 818: `router.checkAndAwardBadges = checkAndAwardBadges` -- die Funktion wird am Router-Objekt angehaengt.
**Vermeidung:** In createApp die Initialisierungs-Reihenfolge beibehalten: ERST badgesRouter, DANN activitiesRouter/eventsRouter/konfiManagementRouter.

### Pitfall 6: Upload-Verzeichnisse muessen in Tests existieren
**Was passiert:** server.js erstellt `uploads/`, `uploads/requests/`, `uploads/chat/`, `uploads/material/` bei Start. Wenn createApp das auch tut, werden diese Verzeichnisse im Projekt-Root erstellt.
**Vermeidung:** In Tests ein temporaeres Verzeichnis nutzen (z.B. `os.tmpdir()`) und als `uploadsDir` an createApp uebergeben.

## Code Examples

### Vitest Config fuer Backend (INF-06)
```typescript
// backend/tests/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Sequentiell -- Locked Decision D-02
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Global Setup/Teardown fuer DB-Lifecycle
    globalSetup: ['./tests/globalSetup.js'],
    // Testdateien
    include: ['tests/**/*.test.{js,ts}'],
    // Environment-Variablen
    env: {
      JWT_SECRET: 'test-secret-key-for-vitest',
      NODE_ENV: 'test',
      TEST_DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/postgres',
    },
    // Timeout fuer DB-Tests
    testTimeout: 10000,
  },
});
```

### docker-compose.test.yml (INF-03)
```yaml
# backend/docker-compose.test.yml
services:
  test-db:
    image: postgres:16-alpine
    ports:
      - "5433:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: postgres
    tmpfs:
      - /var/lib/postgresql/data  # RAM-Disk fuer Speed
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 2s
      timeout: 5s
      retries: 5
```

### npm test Script (INF-03/INF-06)
```json
{
  "scripts": {
    "test": "docker compose -f docker-compose.test.yml up -d --wait && vitest run --config tests/vitest.config.ts; EXIT=$?; docker compose -f docker-compose.test.yml down; exit $EXIT",
    "test:ci": "vitest run --config tests/vitest.config.ts"
  }
}
```

### Seed-Daten Struktur (INF-05)
```javascript
// backend/tests/helpers/seed.js
const bcrypt = require('bcrypt');

// Export: IDs die Tests referenzieren koennen
const ORGS = {
  testGemeinde: { id: 1, name: 'Test-Gemeinde', slug: 'test-gemeinde' },
  andereGemeinde: { id: 2, name: 'Andere Gemeinde', slug: 'andere-gemeinde' },
};

const ROLES = {
  konfi: { id: 1, name: 'konfi', display_name: 'Konfi' },
  teamer: { id: 2, name: 'teamer', display_name: 'Teamer:in' },
  admin: { id: 3, name: 'admin', display_name: 'Admin' },
  orgAdmin: { id: 4, name: 'org_admin', display_name: 'Org-Admin' },
  superAdmin: { id: 5, name: 'super_admin', display_name: 'Super-Admin' },
};

async function seed(db) {
  const passwordHash = await bcrypt.hash('testpasswort123', 10);

  // 1. Rollen
  for (const role of Object.values(ROLES)) {
    await db.query(
      'INSERT INTO roles (id, name, display_name) VALUES ($1, $2, $3)',
      [role.id, role.name, role.display_name]
    );
  }

  // 2. Organisationen
  for (const org of Object.values(ORGS)) {
    await db.query(
      'INSERT INTO organizations (id, name, slug, is_active) VALUES ($1, $2, $3, true)',
      [org.id, org.name, org.slug]
    );
  }

  // 3. Users (alle 5 Rollen x 2 Orgs + SuperAdmin)
  // ... INSERT-Statements

  // 4. konfi_profiles
  // 5. Jahrgaenge
  // 6. Kategorien
  // 7. Aktivitaeten (gottesdienst + gemeinde)
  // 8. Badges (streak, kategorie-basiert, zeit-basiert, jahres-basiert)
  // 9. Levels mit Schwellenwerten
  // 10. Events mit Timeslots
  // 11. Bonus-Punkte
  // 12. Chat-Raeume (jahrgang, direct, group, admin)

  return { ORGS, ROLES, USERS, /* ... */ };
}

module.exports = { seed, ORGS, ROLES };
```

### Smoke-Test Beispiel
```javascript
// backend/tests/routes/smoke.test.js
const { describe, it, expect, beforeAll, beforeEach } = require('vitest');
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { truncateAll, getTestPool } = require('../helpers/db');
const { seed, ORGS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Smoke Tests', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  it('GET /api/health antwortet mit OK', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });

  it('POST /api/auth/login mit gueltigem Konfi', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'konfi1', password: 'testpasswort123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('refreshToken');
  });

  it('GET /api/konfi/dashboard mit gueltigem Token', async () => {
    const token = generateToken('konfi1');
    const res = await request(app)
      .get('/api/konfi/dashboard')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('GET /api/admin/activities ohne Token gibt 401', async () => {
    const res = await request(app).get('/api/admin/activities');
    expect(res.status).toBe(401);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jest fuer Backend-Tests | Vitest (einheitlich fuer CJS + ESM) | Vitest 4.0 (2025) | Besserer CJS-Support, gleicher Runner wie Frontend |
| Transaction-Rollback | TRUNCATE CASCADE (bei internen Transaktionen) | Projekt-spezifisch | ~5ms statt ~1ms pro Cleanup, dafuer keine Nested-Transaction-Probleme |
| Testcontainers | docker-compose.test.yml + GitHub Service Container | 2025+ | Einfacher, schneller, kein Docker-in-Docker |

## Open Questions

1. **database.js Refactoring-Tiefe**
   - Was wir wissen: database.js fuehrt Migrations automatisch beim Import aus (Top-Level Side-Effect). createApp nutzt den uebergebenen `db` Parameter.
   - Was unklar ist: Soll database.js so refactored werden dass `runMigrations` separat exportiert wird und der automatische Aufruf entfernt wird? Oder reicht es, in Tests database.js einfach nicht zu importieren und nur den Test-Pool zu nutzen?
   - Empfehlung: Minimaler Eingriff -- `runMigrations` bereits exportiert (Zeile 66), den automatischen Top-Level-Aufruf hinter eine `if (require.main !== module)` Guard stellen oder in eine `init()` Funktion verpacken. Tests nutzen eigenen Pool + `runMigrations(testPool)`.

2. **verifyToken-Funktion in createApp**
   - Was wir wissen: server.js Zeile 405-418 definiert eine lokale `verifyToken` Funktion die nur von auth.js genutzt wird.
   - Was unklar ist: Soll `verifyToken` in eine eigene Datei (z.B. middleware/) oder inline in createApp?
   - Empfehlung: Inline in createApp -- es sind nur 15 Zeilen, keine eigene Datei noetig.

3. **Seed-Reihenfolge bei Badges**
   - Was wir wissen: Badges haben FK auf organizations. Badge-Vergabe-Typen (streak, kategorie-basiert, zeit-basiert, jahres-basiert) muessen im Seed abgedeckt werden.
   - Was unklar ist: Welche exakten Badge-Definitionen braucht der Seed? Die Badge-Struktur haengt von der badges-Tabelle ab die via Migrations erstellt wird.
   - Empfehlung: Badge-Schema aus Migrations analysieren, 4 Badges erstellen (einen pro Vergabe-Typ).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend + Tests | Ja | 25.8.2 | -- |
| Docker | Test-DB Container | Nicht lokal verfuegbar | -- | PostgreSQL nativ installieren, oder Tests nur in CI |
| PostgreSQL CLI | Health-Check | Nicht geprueft | -- | docker-compose healthcheck uebernimmt das |

**Missing dependencies with fallback:**
- Docker: Nicht auf der lokalen Maschine verfuegbar. Fallback: PostgreSQL nativ installieren (`brew install postgresql@16`) oder Test-DB nur in CI laufen lassen. docker-compose.test.yml bleibt trotzdem der Standard-Weg.

## Validation Architecture

> `workflow.nyquist_validation` ist nicht explizit gesetzt -- Section wird inkludiert.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `backend/tests/vitest.config.ts` (Wave 0) |
| Quick run command | `cd backend && npx vitest run --config tests/vitest.config.ts` |
| Full suite command | `cd backend && npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INF-01 | createApp exportiert Express-App ohne listen() | smoke | `npx vitest run --config tests/vitest.config.ts tests/routes/smoke.test.js` | Wave 0 |
| INF-02 | createTestApp mit echtem pg-Pool | smoke | Gleicher Smoke-Test | Wave 0 |
| INF-03 | Test-DB wird erstellt, migriert, geseeded, geloescht | smoke | Implizit durch globalSetup/Teardown | Wave 0 |
| INF-04 | Auth-Helpers erzeugen JWTs fuer alle 5 Rollen | unit | `npx vitest run tests/helpers/auth.test.js` | Wave 0 |
| INF-05 | Seed mit 2 Orgs, alle Rollen | integration | Implizit durch Smoke-Test (Login benoetigt Seed-User) | Wave 0 |
| INF-06 | Vitest sequentiell, Config korrekt | smoke | `npm test` erfolgreich = Config korrekt | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npx vitest run --config tests/vitest.config.ts`
- **Per wave merge:** Gleich (nur eine Test-Suite in Phase 101)
- **Phase gate:** `npm test` im Backend-Verzeichnis startet Vitest und Smoke-Test ist gruen

### Wave 0 Gaps
- [ ] `backend/tests/vitest.config.ts` -- Vitest Backend-Config
- [ ] `backend/tests/globalSetup.js` -- DB-Lifecycle
- [ ] `backend/tests/globalTeardown.js` -- DB-Cleanup
- [ ] `backend/tests/helpers/db.js` -- Test-Pool + TRUNCATE
- [ ] `backend/tests/helpers/auth.js` -- Token-Factory
- [ ] `backend/tests/helpers/seed.js` -- Basisdaten
- [ ] `backend/tests/helpers/testApp.js` -- createTestApp Wrapper
- [ ] `backend/tests/routes/smoke.test.js` -- Erster Test
- [ ] `backend/createApp.js` -- Factory (Kern des Refactorings)
- [ ] `backend/docker-compose.test.yml` -- Test-DB Container
- [ ] vitest + supertest Installation: `cd backend && npm install -D vitest supertest`

## Sources

### Primary (HIGH confidence)
- Codebase-Analyse: `backend/server.js` (591 Zeilen, alle Route-Mounts, Seiteneffekte identifiziert)
- Codebase-Analyse: `backend/database.js` (Pool, runMigrations, Top-Level Side-Effect)
- Codebase-Analyse: `backend/middleware/rbac.js` (LRU-Cache, verifyTokenRBAC Signatur, JWT_SECRET Guard)
- Codebase-Analyse: Alle 18 Route-Factory-Signaturen (module.exports Pattern)
- npm registry: vitest 4.1.2, supertest 7.2.2 (verifiziert 2026-03-27)

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` -- createTestApp Pattern, Mock-Matrix, Build-Reihenfolge
- `.planning/research/PITFALLS.md` -- 13 Pitfalls identifiziert und priorisiert
- `.planning/research/STACK.md` -- Vitest + supertest Empfehlung mit Begruendung

### Tertiary (LOW confidence)
- Keine LOW-confidence Findings. Alle Empfehlungen basieren auf direkter Codebase-Analyse.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- vitest + supertest sind Standard, Versionen via npm view verifiziert
- Architecture: HIGH -- createApp Pattern basiert auf vollstaendiger Analyse von server.js und allen 18 Route-Signaturen
- Pitfalls: HIGH -- JWT_SECRET Guard, database.js Side-Effect, LRU-Cache alle direkt im Code verifiziert

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stabil -- Backend aendert sich aktuell nicht)
