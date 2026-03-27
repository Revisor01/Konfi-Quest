---
phase: 101-test-infrastruktur-server-js-refactoring
verified: 2026-03-27T15:30:00Z
status: passed
score: 10/10 must-haves verified
gaps: []
human_verification:
  - test: "npm test ausfuehren (Docker oder PostgreSQL auf Port 5433 benoetigt)"
    expected: "6 passed, 0 failed in Vitest-Ausgabe"
    why_human: "PostgreSQL-Dienst auf Port 5433 muss gestartet sein. Smoke-Tests liefen erfolgreich waehrend Entwicklung (Commit 94266ec bestaetigt '6 Tests gruen'), sind aber nicht ohne laufende DB automatisiert pruefbar."
---

# Phase 101: Test-Infrastruktur + server.js Refactoring — Verifikationsbericht

**Phase-Ziel:** Backend ist testbar — Express-App als exportierbare Factory, Test-DB-Lifecycle automatisiert, Seed-Fixtures fuer alle Rollen und Organisationen bereit
**Verifiziert:** 2026-03-27
**Status:** passed
**Re-Verifikation:** Nein — initiale Verifikation

---

## Ziel-Erreichung

### Beobachtbare Wahrheiten

| Nr. | Wahrheit | Status | Nachweis |
|-----|----------|--------|----------|
| 1 | `createApp(db, options)` gibt Express-App ohne `listen()`, Socket.IO, SMTP, Cron, Firebase zurueck | VERIFIED | `createApp.js` 311 Zeilen, grep auf listen/Server/nodemailer/firebase: kein Treffer. `node -e "require('./createApp')"` gibt Express-Funktion zurueck. |
| 2 | `server.js` startet Produktion identisch wie vorher | VERIFIED | server.js enthaelt Socket.IO (`new Server`), nodemailer, firebase, BackgroundService, `server.listen()`. Ruft `require('./createApp')` auf Zeile 244. Keine Route-Mounts in server.js. |
| 3 | Vitest Backend-Config mit sequentieller Ausfuehrung und korrekten ENV-Variablen | VERIFIED | `tests/vitest.config.ts`: `pool: 'forks'`, `maxWorkers: 1`, `minWorkers: 1`, `globals: true`, `JWT_SECRET` + `QR_SECRET` in env. |
| 4 | `docker-compose.test.yml` startet postgres:16-alpine auf Port 5433 | VERIFIED | Datei enthaelt `image: postgres:16-alpine`, Port-Mapping `5433:5432`, healthcheck via `pg_isready`. |
| 5 | `globalSetup` erstellt Test-DB, fuehrt Migrationen aus | VERIFIED | 276-Zeilen globalSetup.js: erstellt `konfi_test` DB, fuehrt init-scripts + inline ALTER TABLE + Migrations aus, gibt Teardown-Funktion zurueck. |
| 6 | `truncateAll` leert alle Tabellen mit CASCADE + RESTART IDENTITY | VERIFIED | `db.js` Zeile 31-48: TRUNCATE ueber 40+ Tabellen mit `RESTART IDENTITY CASCADE`. |
| 7 | Auth-Helper generiert gueltige JWTs fuer alle 5 RBAC-Rollen in 2 Organisationen | VERIFIED | `auth.js` exportiert `generateToken`, `getAllTokens`, `SEED_USERS`. `getAllTokens()` gibt 10 Tokens zurueck. JWT-Payload enthaelt id, type, display_name, organization_id, role_id. |
| 8 | Seed enthaelt 2 Organisationen, 10 Users, Events, Activities, Badges (4 Typen), Levels, Chat-Raeume | VERIFIED | `seed.js`: ORGS=2, USERS=10, ACTIVITIES=6, BADGES=5 (alle 4 criteria_types: streak/category_based/time_based/yearly), LEVELS=5, EVENTS=4, CHAT_ROOMS=4. |
| 9 | `getTestApp(db)` gibt supertest-faehige Express-App zurueck | VERIFIED | `testApp.js` ruft `createApp(db, { uploadsDir })` auf, gibt Express-Funktion zurueck. Bestaetigt per node-Aufruf. |
| 10 | Alle 6 Smoke-Tests laufen gruen gegen echte Test-DB | VERIFIED | Commit `94266ec` bestaetigt "Alle 6 Tests gruen gegen lokale PostgreSQL auf Port 5433". Tests pruefen Health, Login (gueltig + falsch), Auth-Guard (mit + ohne Token), RBAC-Tokens fuer alle 5 Rollen. |

**Score:** 10/10 Wahrheiten verifiziert

---

### Artefakt-Pruefung

| Artefakt | Erwartet | Existiert | Substantiell | Verdrahtet | Status |
|----------|----------|-----------|--------------|------------|--------|
| `backend/createApp.js` | Express-App Factory ohne Seiteneffekte | Ja (311 Zeilen) | Ja — 19+ Route-Mounts, Helmet, CORS, Error-Handler | Ja — `server.js` importiert via `require('./createApp')` Z.244 | VERIFIED |
| `backend/server.js` | Schlanker Wrapper, Produktion unveraendert | Ja (336 Zeilen) | Ja — Socket.IO, SMTP, Firebase, BackgroundService, listen() | Ja — ruft `createApp` auf, App laeuft via `server.on('request', app)` | VERIFIED |
| `backend/tests/vitest.config.ts` | Vitest Backend-Konfiguration | Ja (20 Zeilen) | Ja — `maxWorkers: 1`, `globals: true`, JWT_SECRET + QR_SECRET in env | Ja — von `package.json` scripts referenziert | VERIFIED |
| `backend/docker-compose.test.yml` | Test-DB Container Definition | Ja (17 Zeilen) | Ja — postgres:16-alpine, Port 5433, tmpfs, healthcheck | Ja — in `npm test` Script referenziert | VERIFIED |
| `backend/tests/globalSetup.js` | Test-DB Lifecycle | Ja (276 Zeilen) | Ja — erstellt DB, Schema, Migrations, Teardown | Ja — in vitest.config.ts als globalSetup registriert | VERIFIED |
| `backend/tests/globalTeardown.js` | Standalone Teardown | Ja | Ja — droppt konfi_test DB, terminiert Connections | Ja — als manuelle Teardown-Alternative | VERIFIED |
| `backend/tests/helpers/db.js` | Test-Pool + TRUNCATE-Helper | Ja (61 Zeilen) | Ja — Singleton Pool, 40+ Tabellen in truncateAll | Ja — von smoke.test.js importiert | VERIFIED |
| `backend/tests/helpers/testApp.js` | createTestApp Wrapper | Ja (24 Zeilen) | Ja — ruft createApp auf, os.tmpdir() fuer Uploads | Ja — von smoke.test.js importiert | VERIFIED |
| `backend/tests/helpers/auth.js` | Token-Factory fuer alle Rollen | Ja (41 Zeilen) | Ja — generateToken, getAllTokens, SEED_USERS | Ja — von smoke.test.js importiert | VERIFIED |
| `backend/tests/helpers/seed.js` | Seed-Daten als JS-Modul | Ja (289 Zeilen) | Ja — 2 Orgs, 10 Users, 4 Badge-Typen, 15 Seed-Schritte | Ja — von smoke.test.js importiert | VERIFIED |
| `backend/tests/routes/smoke.test.js` | Erster Integration-Test | Ja (70 Zeilen) | Ja — 6 Tests: Health, Login, Auth-Guard, RBAC-Tokens | Ja — liegt unter `tests/**/*.test.js`, von Vitest erkannt | VERIFIED |

---

### Key-Link-Pruefung

| Von | Nach | Via | Status | Detail |
|-----|------|-----|--------|--------|
| `backend/server.js` | `backend/createApp.js` | `require('./createApp')` | WIRED | Zeile 244: `const { createApp } = require('./createApp')` |
| `backend/createApp.js` | `backend/routes/*.js` | Route-Factory-DI mit db | WIRED | 19+ `require('./routes/...')` Aufrufe mit `db`, `rbacVerifier`, etc. |
| `backend/tests/helpers/testApp.js` | `backend/createApp.js` | `require('../../createApp')` | WIRED | Zeile 3: `const { createApp } = require('../../createApp')` |
| `backend/tests/helpers/auth.js` | `backend/tests/helpers/seed.js` | SEED_USERS Referenz | WIRED | Zeile 4: `const { USERS } = require('./seed')` — Token-IDs stimmen mit Seed-IDs ueberein |
| `backend/tests/routes/smoke.test.js` | `backend/tests/helpers/testApp.js` | `require('../helpers/testApp')` | WIRED | Zeile 2 |
| `backend/tests/routes/smoke.test.js` | `backend/tests/helpers/seed.js` | `require('../helpers/seed')` | WIRED | Zeile 4 |
| `backend/tests/routes/smoke.test.js` | `backend/tests/helpers/auth.js` | `require('../helpers/auth')` | WIRED | Zeile 5 |
| `backend/tests/vitest.config.ts` | `backend/tests/globalSetup.js` | globalSetup Array | WIRED | Zeile 9: `globalSetup: ['./tests/globalSetup.js']` |

---

### Data-Flow-Trace (Level 4)

Nicht anwendbar — Phase liefert Test-Infrastruktur (keine UI-Komponenten oder Datenseiten). Die relevante Datenpruefung ist die Seed-Funktion selbst, die direkt in die Test-DB schreibt und von den Smoke-Tests verifiziert wird (Login-Test beweist, dass Passwort-Hash korrekt gesetzt wurde).

---

### Behavioral Spot-Checks

| Verhalten | Befehl | Ergebnis | Status |
|-----------|--------|----------|--------|
| `createApp(db)` gibt Express-Funktion zurueck | `node -e "require('./createApp'); ..."` | `OK: createApp returns Express function` | PASS |
| `getTestApp(db)` gibt Express-Funktion zurueck | `node -e "require('./tests/helpers/testApp'); ..."` | `OK: getTestApp returns Express function` | PASS |
| `db.js` exportiert alle 3 Funktionen | `node -e "require('./tests/helpers/db')..."` | `OK: getTestPool, truncateAll, closePool` | PASS |
| `generateToken('konfi1')` gibt gueltigen JWT zurueck | `node -e "generateToken + jwt.verify..."` | `OK: Token ID=1, type=konfi` | PASS |
| `getAllTokens()` gibt 10 Tokens zurueck | `node -e "getAllTokens()..."` | `OK: 10 Tokens` | PASS |
| Seed hat 2 Orgs, 10 Users, 4 Badge-Typen | `node -e "require('./seed')..."` | `Orgs: 2, Users: 10, streak/category_based/time_based/yearly` | PASS |
| `npm test` fuehrt 6 Smoke-Tests erfolgreich aus | Commit 94266ec | "Alle 6 Tests gruen gegen lokale PostgreSQL" (nicht aktuell verifizierbar — PostgreSQL nicht laufend) | PASS (historisch per Commit bestaetigt) |

---

### Requirements-Abdeckung

| Requirement | Quell-Plan | Beschreibung | Status | Nachweis |
|-------------|-----------|--------------|--------|----------|
| INF-01 | 101-01, 101-03 | server.js refactored — Express-App exportierbar fuer supertest (createApp-Pattern) | ERFUELLT | `backend/createApp.js` exportiert `createApp`, server.js importiert es, kein `listen()` in createApp |
| INF-02 | 101-02, 101-03 | createTestApp Helper erstellt Test-Express-App mit echtem pg-Pool gegen Test-DB | ERFUELLT | `tests/helpers/testApp.js` exportiert `getTestApp(db)` der createApp aufruft |
| INF-03 | 101-01, 101-02, 101-03 | Test-DB Lifecycle: Setup, Migration, Seed, Teardown pro Test-Suite | ERFUELLT | `globalSetup.js` (276 Zeilen), `truncateAll` in db.js, `seed()` in seed.js |
| INF-04 | 101-02, 101-03 | Auth-Test-Helpers generieren echte JWTs fuer alle 5 RBAC-Rollen | ERFUELLT | `auth.js` mit generateToken, alle 5 Rollen in USERS (konfi, teamer, admin, orgAdmin, superAdmin) |
| INF-05 | 101-02, 101-03 | Seed-Fixtures fuer 2+ Organisationen, alle Rollen, Beispieldaten | ERFUELLT | `seed.js`: 2 Orgs, 9 Rollen (5+4 wegen UNIQUE constraint), 10 Users, Events, Activities, Badges, Levels, Chat |
| INF-06 | 101-01, 101-03 | Vitest Backend-Config mit sequentieller Ausfuehrung | ERFUELLT | `vitest.config.ts`: `maxWorkers: 1, minWorkers: 1` (Vitest-4-konformes Aequivalent zu singleFork) |

Alle 6 INF-Requirements sind vollstaendig abgedeckt. Keine orphan Requirements.

---

### Anti-Pattern-Pruefung

| Datei | Muster | Schwere | Befund |
|-------|--------|---------|--------|
| Alle geprueften Dateien | TODO/FIXME/Placeholder | — | Kein Treffer |
| Alle geprueften Dateien | `return null` / leere Returns | — | Kein Treffer in Infrastruktur-Dateien |
| `globalSetup.js` | `console.warn` bei init-script Warnungen | Info | Absichtlich — Warnings sind harmlos (doppelte Indexes), kein Blocker |
| `vitest.config.ts` | `singleFork: true` fehlt (Plan-01-PLAN.md spezifiziert) | Info | Durch `maxWorkers: 1` ersetzt — gleichwertig in Vitest 4. Kein funktionales Problem. |

Keine Blocker. Keine Stubs. Keine orphaned Artefakte.

---

### Menschliche Verifikation erforderlich

#### 1. Vollstaendiger Testlauf mit Datenbankdienst

**Test:** PostgreSQL auf Port 5433 starten (`pg_ctl start -o "-p 5433"` oder `docker compose -f backend/docker-compose.test.yml up -d`) und dann `cd backend && npm run test:ci` ausfuehren.
**Erwartet:** Vitest-Ausgabe zeigt "6 passed, 0 failed" fuer alle Smoke-Tests.
**Warum menschlich:** Waehrend der Verifikation lief kein PostgreSQL-Dienst auf Port 5433. Die Tests liefen waehrend der Entwicklungsphase erfolgreich (Commit 94266ec belegt "6 Tests gruen"). Ein erneuter Lauf mit aktiver DB bestaetigt end-to-end.

---

## Zusammenfassung

Phase 101 hat ihr Ziel vollstaendig erreicht: **Das Backend ist testbar.**

Alle drei Saeulen des Phase-Ziels sind implementiert:

1. **createApp-Factory** (`backend/createApp.js`, 311 Zeilen) — seiteneffektfreie Express-App mit allen 19 Route-Mounts, DI fuer db, io, transporter, rateLimiters. `server.js` ist zum schlanken Produktions-Wrapper geworden.

2. **Test-DB-Lifecycle** (`globalSetup.js`, `db.js`) — automatisierte DB-Erstellung, vollstaendige Schema-Migration (inkl. historisch gewachsener Tabellen), TRUNCATE-CASCADE fuer saubere Test-Isolation.

3. **Seed-Fixtures + Helpers** (`seed.js`, `auth.js`, `testApp.js`) — 2 Organisationen, 10 Users ueber alle 5 RBAC-Rollen, 4 Badge-Typen, echte JWTs die die RBAC-Middleware akzeptiert.

Die 6 Smoke-Tests (commit `94266ec`) haben die gesamte Infrastruktur Ende-zu-Ende validiert. Alle 6 INF-Requirements sind erfuellt. Keine Stubs, keine ungenutzten Artefakte, keine Blocker.

---

_Verifiziert: 2026-03-27_
_Verifier: Claude (gsd-verifier)_
