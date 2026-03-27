# Pitfalls Research: Test-Suite + CI/CD fuer Konfi Quest

**Domain:** Test-Suite und CI/CD Pipeline fuer bestehende Express/Ionic/Capacitor App mit 18 Route-Dateien, RBAC, Multi-Tenancy, Socket.IO, PostgreSQL
**Researched:** 2026-03-27
**Confidence:** HIGH (Codebase-Analyse + offizielle Docs + Community-Erfahrungen)

---

## Kritische Pitfalls

### Pitfall 1: Vitest Parallelisierung zerstoert Test-Isolation bei gemeinsamer Datenbank

**Was schief geht:**
Vitest fuehrt Test-Suites standardmaessig parallel aus. Wenn alle 18 Route-Test-Dateien gegen dieselbe PostgreSQL-Instanz laufen, loescht Suite A Testdaten per TRUNCATE waehrend Suite B gerade einen Test ausfuehrt der diese Daten erwartet. Tests schlagen zufaellig fehl -- klassische Flaky Tests.

**Warum es passiert:**
Bei Jest (seriell) funktioniert ein einfaches `beforeAll(seed) / afterAll(truncate)` Pattern. Vitest parallelisiert aber Test-Dateien ueber Worker-Threads. Ein naives Uebertragen des Jest-Patterns fuehrt zu Race Conditions zwischen den Workern.

**Wie man es vermeidet:**
1. **Transaction-Rollback Pattern:** Jeder Test laeuft in einer eigenen Transaktion die am Ende zurueckgerollt wird. So sieht jeder Test denselben Baseline-Zustand. Konfi Quest nutzt `pg` direkt (kein ORM), daher: pro Test einen eigenen `client` aus dem Pool holen, `BEGIN` ausfuehren, am Ende `ROLLBACK`. Die Route-Handler muessen den `client` injiziert bekommen (nicht den globalen `pool`).
2. **Schema-pro-Suite:** Jede Test-Suite bekommt ein eigenes PostgreSQL-Schema (`CREATE SCHEMA test_suite_xyz`). Teurer bei 18 Suites, aber perfekte Isolation ohne Code-Aenderung an den Routes.
3. **Sequentielle Ausfuehrung als Fallback:** `vitest --pool=forks --poolOptions.forks.singleFork` fuer Integration-Tests, parallele Ausfuehrung nur fuer Unit-Tests. Langsamer, aber zuverlaessig.

**Warnung:**
Tests werden gruen auf dem lokalen Rechner (wenige parallel) und rot in CI (alle parallel). Flaky Tests die nur in CI auftreten sind extrem schwer zu debuggen.

**Phase:**
Phase 1 (Backend-Test-Infrastruktur) -- MUSS vor dem ersten Route-Test geloest sein.

---

### Pitfall 2: server.js ist ein monolithischer Seiteneffekt-Block -- nicht testbar ohne Refactoring

**Was schief geht:**
Die aktuelle `server.js` macht beim Import sofort: Express-App erstellen, HTTP-Server starten, Socket.IO initialisieren, DB-Connection testen, Migrations ausfuehren, `server.listen()` aufrufen. Supertest braucht aber nur die Express-`app` Instanz OHNE dass der Server tatsaechlich auf einem Port lauscht. Ein `require('./server')` in Tests startet den gesamten Produktions-Server.

**Warum es passiert:**
Die App wurde ohne Tests gebaut. Alles in einer Datei ist einfacher zu verstehen und zu deployen. Aber Tests brauchen modulare Importe: `app` ohne `listen()`, `db` ohne automatische Migration, `io` ohne echten WebSocket-Server.

**Wie man es vermeidet:**
1. **app.js extrahieren:** Express-App-Konfiguration (Middleware, Routes) in `app.js` auslagern. `server.js` importiert `app` und ruft `listen()` auf. Tests importieren nur `app`.
2. **Database-Factory:** `database.js` exportiert eine Funktion `createPool(config)` statt einen globalen Pool mit automatischem Migrations-Lauf. Tests rufen `createPool(testConfig)` auf.
3. **Socket.IO separat:** `io` Setup in eigene Datei. Tests koennen Socket.IO entweder mocken oder einen eigenen Test-Server starten.
4. **Kein Top-Level await/then:** Die aktuelle `pool.query('SELECT NOW()').then(() => runMigrations(pool))` in `database.js` laeuft beim Import. Das muss in eine explizit aufrufbare `init()` Funktion.

**Warnung:**
Dieses Refactoring ist die groesste Huerde. Ohne es sind Backend-Integration-Tests unmoeglich. Aber es muss minimal-invasiv sein -- keine Route-Logik aendern, nur die Verdrahtung.

**Phase:**
Phase 1 (Backend-Test-Infrastruktur) -- erstes Arbeitspacket, Voraussetzung fuer alles andere.

---

### Pitfall 3: RBAC-Testdaten-Explosion durch 5 Rollen x Multi-Tenancy

**Was schief geht:**
Konfi Quest hat 5 Rollen (konfi, teamer, admin, org_admin, super_admin), Multi-Tenancy (organization_id auf fast allen Tabellen), und Jahrgangs-Filterung. Um eine einzelne Route wie `GET /api/events` vollstaendig zu testen, braucht man: User jeder Rolle, zwei verschiedene Organisationen, Jahrgaenge pro Organisation, Events die zu bestimmten Jahrgaengen gehoeren. Das Seed-Script fuer eine Route wird 50+ INSERT-Statements.

**Warum es passiert:**
RBAC mit Multi-Tenancy bedeutet: Jeder API-Endpunkt hat mindestens 5 positive Testfaelle (pro Rolle) und 5 negative (Rolle darf nicht). Dazu kommen Cross-Org-Tests (Admin von Org A darf Daten von Org B nicht sehen). Die kombinatorische Komplexion explodiert.

**Wie man es vermeidet:**
1. **Shared Test-Fixtures:** Eine `test/fixtures/seed.sql` die einmal alle Rollen, 2 Organisationen, Jahrgaenge, Beispiel-Events etc. anlegt. Jeder Test nutzt diese Baseline und aendert nur was er spezifisch braucht.
2. **Helper-Funktionen:** `createTestUser(role, orgId)`, `loginAs(role)` die JWT-Tokens zurueckgeben. Nicht in jedem Test manuell POST /api/auth/login aufrufen.
3. **Fixture-Hierarchie:** Basis-Seed (Users, Orgs) wird einmal pro Test-Suite geladen. Spezifische Daten (Events, Activities) werden pro Test hinzugefuegt und per Rollback entfernt.
4. **Test-Matrix statt Einzeltests:** Fuer RBAC-Checks eine parametrisierte Test-Funktion: `testRBAC('/api/events', { allowed: ['admin', 'teamer', 'konfi'], forbidden: ['super_admin_cross_org'] })`.

**Warnung:**
Wenn das Seed-Script nicht sorgfaeltig gepflegt wird, brechen bei einer Schema-Aenderung (neue Spalte, neuer FK) 50+ Tests gleichzeitig. Seed-Daten muessen in die Migrations-Pipeline integriert sein.

**Phase:**
Phase 1 (Seed/Fixtures) -- direkt nach server.js Refactoring, vor den ersten Route-Tests.

---

### Pitfall 4: Playwright kann keine Capacitor-Plugins testen -- falscher E2E-Scope

**Was schief geht:**
Playwright testet die Web-App im Browser. Capacitor-Plugins (Push-Notifications, Camera, FileViewer, StatusBar, Share, Haptics) existieren im Browser nicht. Wenn ein Testfall "Konfi scannt Event-QR" testet, crasht die App mit "Plugin not available" oder "Notifications not supported in this browser". Das Team schreibt aufwaendige Mocks fuer jedes Plugin und testet am Ende nur die Mocks, nicht die echte App.

**Warum es passiert:**
E2E-Tests sollen "wie ein User" testen. Aber der User nutzt die native iOS/Android App, nicht den Browser. Playwright testet nur den Web-Teil. Native Features (QR-Scanner, Push, Share) sind unerreichbar.

**Wie man es vermeidet:**
1. **Capacitor-Plugin-Mocks global registrieren:** Capacitor bietet offiziell `@capacitor/core` Mocking (`Capacitor.registerPlugin` mit Web-Fallbacks). Fuer Playwright einen globalen Setup der alle Plugins mit No-Op-Mocks registriert.
2. **E2E-Scope klar definieren:** Playwright testet: Login, Navigation, CRUD-Flows, Chat-UI, Punkte-Vergabe, Event-Buchung. Playwright testet NICHT: Push-Empfang, QR-Scan, File-Download, Share-Sheet, Haptics.
3. **Keine nativen E2E-Tests in v2.9:** Appium/Detox fuer native Tests sind ein eigenes Projekt. Fuer v2.9 reicht Playwright auf dem Web-Build voellig aus. Native Tests spaeter evaluieren wenn App im Store ist.
4. **Environment-Guard:** `if (Capacitor.isNativePlatform())` Guards in der App existieren bereits -- Playwright laeuft als "web", nicht als "ios/android".

**Warnung:**
Die Versuchung ist gross, "alles E2E zu testen". Das fuehrt zu 80% der Zeit in Plugin-Mocking statt in sinnvollen Test-Szenarien.

**Phase:**
Phase 3 (E2E-Tests) -- E2E-Scope VORHER definieren, nicht waehrend der Implementierung.

---

### Pitfall 5: Socket.IO Tests haengen durch nicht geschlossene Connections

**Was schief geht:**
Socket.IO-Tests erstellen Client- und Server-Sockets. Wenn ein Test fehlschlaegt (Assertion Error), wird der `afterEach` Cleanup uebersprungen und Sockets bleiben offen. Der Vitest-Prozess beendet sich nie ("hangs on exit"), oder der naechste Test bekommt Events vom vorherigen Test.

**Warum es passiert:**
WebSocket-Connections sind persistent. Anders als HTTP-Requests (die nach der Response automatisch enden) bleiben Socket-Connections offen bis explizit geschlossen. Ein vergessenes `socket.disconnect()` in einem einzigen Test blockiert die gesamte Test-Suite.

**Wie man es vermeidet:**
1. **Garantierter Cleanup mit try/finally:** Nicht `afterEach(() => socket.close())` sondern Socket-Erstellung in einem Helper der automatisch in einem Registry trackt, und `afterAll` schliesst ALLE registrierten Sockets.
2. **Timeouts auf allen Socket-Operationen:** `await waitForEvent(socket, 'message', { timeout: 3000 })` statt unbegrenzt auf Events zu warten.
3. **Separater HTTP-Server pro Socket-Test-Suite:** Nicht den gleichen Server wie fuer REST-Tests verwenden. Socket.IO braucht einen echten HTTP-Server (nicht nur supertest).
4. **`--forceExit` als Sicherheitsnetz:** `vitest --forceExit` beendet den Prozess auch bei offenen Handles. Aber nur als CI-Fallback, nicht als Loesung fuer kaputte Tests.
5. **Socket-Tests in eigene Test-Datei:** Isoliert von REST-Tests, eigener Server-Lifecycle.

**Warnung:**
"Tests laufen lokal, aber CI haengt nach 10 Minuten" ist das typische Symptom. Timeout in GitHub Actions auf 5 Minuten setzen um schnell zu merken wenn etwas haengt.

**Phase:**
Phase 2 (Socket.IO-Tests) -- eigene Phase, nicht mit REST-Tests mischen.

---

## Moderate Pitfalls

### Pitfall 6: Test-Datenbank-Schema driftet von Produktion ab

**Was schief geht:**
Die Test-Datenbank wird initial mit `init-scripts/` und `migrations/` aufgesetzt. Jemand fuegt eine Migration hinzu, vergisst aber den Test-Seed zu aktualisieren. Oder eine Migration funktioniert auf der leeren Test-DB aber nicht auf der Produktions-DB (weil dort bereits Daten existieren). Tests sind gruen, Produktion ist kaputt.

**Warum es passiert:**
Konfi Quest nutzt ein eigenes Migration-System (`database.js` + SQL-Dateien in `migrations/`). Es gibt kein Schema-Diff-Tool das warnt wenn Test-DB und Prod-DB divergieren.

**Wie man es vermeidet:**
1. **Gleicher Migrations-Pfad:** Test-DB wird exakt wie Prod-DB aufgesetzt: `init-scripts/` ausfuehren, dann alle `migrations/` in Reihenfolge. Kein separates Test-Schema.
2. **Seed-Daten getrennt von Schema:** Schema kommt aus Migrations. Testdaten kommen aus `test/fixtures/seed.sql`. Niemals Schema-Aenderungen im Seed-Script.
3. **CI prueft Migration auf leerer DB:** Ein eigener CI-Step der eine komplett leere DB nimmt, alle Migrations laufen laesst, und dann die Tests startet. Das verhindert "funktioniert nur mit existierenden Daten".

**Warnung:**
Wenn Tests eine eigene Schema-Definition haben (z.B. ein `test-schema.sql` statt der echten Migrations), wird das Schema irgendwann divergieren. Garantiert.

**Phase:**
Phase 1 (DB-Setup) -- von Anfang an gleichen Migrations-Pfad nutzen.

---

### Pitfall 7: JWT/Auth-Mocking unterlaueft RBAC-Sicherheitstests

**Was schief geht:**
Um Tests schneller zu schreiben, wird `verifyTokenRBAC` gemockt: `jest.mock('./middleware/rbac', () => ({ verifyTokenRBAC: () => (req, res, next) => { req.user = fakeUser; next(); } }))`. Dadurch werden RBAC-Regeln nie getestet. Ein Konfi kann ploetzlich Admin-Endpunkte aufrufen und kein Test merkt es.

**Warum es passiert:**
Auth-Middleware macht Tests kompliziert: JWT generieren, Token in Header setzen, User in DB anlegen. Der schnelle Weg ist Mocking. Aber genau die Auth-Middleware ist der wichtigste Teil der zu testen ist.

**Wie man es vermeidet:**
1. **Echte JWTs in Tests:** Helper `generateTestToken(userId)` der mit dem Test-JWT_SECRET einen echten Token signiert. Dauert < 1ms, kein Grund zu mocken.
2. **Login-Helper:** `async function loginAs(role) { return axios.post('/api/auth/login', credentials[role]) }` der ein echtes Token zurueckgibt. Einmal pro Suite, Token fuer alle Tests der Suite wiederverwenden.
3. **RBAC-Matrix-Tests:** Dedizierte Testdatei `rbac.test.js` die fuer JEDEN Endpoint prueft: Welche Rollen duerfen zugreifen, welche nicht? Das ist der wertvollste Test der gesamten Suite.
4. **Niemals Middleware mocken:** Auth-Middleware ist kein "externes System" das gemockt werden sollte. Sie ist Kern-Business-Logik.

**Warnung:**
Wenn ein PR "tests added" zeigt aber `verifyTokenRBAC` gemockt ist, sind die Tests wertlos. Code Review muss darauf achten.

**Phase:**
Phase 2 (Route-Tests) -- als explizite Regel in Test-Konventionen festhalten.

---

### Pitfall 8: GitHub Actions CI wird langsam durch Docker-in-Docker und fehlende Caches

**Was schief geht:**
Die bestehenden Workflows bauen Docker-Images und pushen zu GHCR. Wenn Tests hinzukommen, muss zuerst eine PostgreSQL-Datenbank gestartet werden (Service Container oder Testcontainers). Testcontainers braucht Docker-in-Docker, was in GitHub Actions zusaetzlichen Overhead hat. Ohne npm-Cache dauert `npm install` bei jedem Run 30-60 Sekunden. Die gesamte CI-Pipeline wird 5+ Minuten langsam.

**Warum es passiert:**
Tests werden als Afterthought zur bestehenden Build-Pipeline hinzugefuegt statt die Pipeline neu zu strukturieren.

**Wie man es vermeidet:**
1. **PostgreSQL Service Container statt Testcontainers:** GitHub Actions bietet native Service-Container die schneller starten als Testcontainers. Kein Docker-in-Docker noetig:
   ```yaml
   services:
     postgres:
       image: postgres:16
       env:
         POSTGRES_PASSWORD: test
       options: >-
         --health-cmd pg_isready
         --health-interval 10s
         --health-timeout 5s
         --health-retries 5
   ```
2. **npm-Cache aktivieren:** `actions/setup-node@v4` mit `cache: 'npm'` spart 20-40 Sekunden pro Run.
3. **Tests VOR dem Docker-Build:** Erst testen, dann nur bei Erfolg das Image bauen. Nicht umgekehrt.
4. **Separate Jobs:** `test` Job (2 Min) und `build-and-push` Job (3 Min) parallel wo moeglich, `build-and-push` haengt von `test` ab via `needs: test`.

**Warnung:**
Wenn CI > 5 Minuten dauert, werden Entwickler anfangen Tests zu skippen oder `[skip ci]` in Commits zu schreiben. CI muss schnell bleiben.

**Phase:**
Phase 4 (CI/CD Pipeline) -- Pipeline-Architektur VOR der Implementierung planen.

---

### Pitfall 9: Ionic Shadow DOM macht Component-Tests fragil

**Was schief geht:**
Ionic-Komponenten nutzen Shadow DOM. `screen.getByText('Punkte')` findet Text innerhalb von `<ion-card>` nicht, weil er im Shadow Root liegt. Tests die `querySelector` nutzen scheitern, weil Shadow DOM Boundaries nicht durchlaufen werden. Das Team schreibt Tests mit `shadowRoot.querySelector` die bei jedem Ionic-Update brechen.

**Warum es passiert:**
React Testing Library und Vitest sind fuer Standard-DOM konzipiert. Shadow DOM ist eine parallele Welt. Ionics offizielle Test-Dokumentation fuer React ist duenn und empfiehlt hauptsaechlich "test business logic, not UI".

**Wie man es vermeidet:**
1. **Business-Logik-Tests statt Component-Tests:** Hooks testen (`useOfflineQuery`, `AppContext`), nicht UI-Komponenten. Die wertvolle Logik steckt in den Hooks und Services, nicht im Ionic-Markup.
2. **`testing-library/dom` mit `{ legacyRoot: true }`:** Ionic 8 hat einen Compat-Mode der Shadow DOM flacht. Aber fragil bei Updates.
3. **data-testid auf nativen Elementen:** Ionic leitet `data-testid` an den inneren nativen Element weiter. `<IonButton data-testid="submit">` ist per `getByTestId` findbar.
4. **Wenige Component-Tests, viele Integration-Tests:** Statt 50 Component-Tests lieber 20 Playwright-E2E-Tests die den echten Browser nutzen und Shadow DOM automatisch durchlaufen.

**Warnung:**
Shadow-DOM-spezifische Selektoren brechen bei jedem Ionic Minor-Update. Wenn ein Test `ion-card >>> .card-content` nutzt, ist er ein Wartungs-Albtraum.

**Phase:**
Phase 3 (Frontend-Tests) -- Scope bewusst auf Hooks/Logic beschraenken, UI-Tests via Playwright.

---

### Pitfall 10: Test-Maintenance-Burden uebersteigt den Nutzen

**Was schief geht:**
Das Team schreibt 300+ Tests fuer alle 18 Routes. Nach 3 Monaten aendert sich das Event-System (neues Feld, geaenderter Flow). 40 Tests brechen. Niemand hat Lust sie alle zu fixen. Tests werden auskommentiert, `.skip()` markiert oder geloescht. Nach 6 Monaten sind 30% der Tests deaktiviert.

**Warum es passiert:**
Bei einer App die ohne Tests gebaut wurde, aendert sich die API haeufiger als bei test-first Entwicklung. Jede Schema-Aenderung, jedes neue Feld, jede geaenderte Validierung bricht bestehende Tests. Wenn Tests zu nah am Implementierungsdetail sind (exakte JSON-Struktur pruefen statt wesentliche Felder), brechen sie noch oefter.

**Wie man es vermeidet:**
1. **Wenige, wertvolle Tests statt viele fragile:** 80/20 Regel: 20% der Endpoints verursachen 80% der Bugs. Teste zuerst: Auth, Punkte-Vergabe, Event-Buchung, RBAC-Boundaries.
2. **Assertions auf wesentliche Felder:** `expect(res.body).toHaveProperty('id')` statt `expect(res.body).toEqual(exaktesObjekt)`. Neue Felder brechen dann keine Tests.
3. **Schema-Assertions mit Zod/joi:** Response-Schema validieren statt exakte Werte. Wenn ein neues Feld hinzukommt, muss nur das Schema aktualisiert werden, nicht 40 Tests.
4. **Test-Priorisierung:** RBAC-Tests > Punkte-Logik-Tests > CRUD-Tests > UI-Tests. Wenn Zeit knapp wird, die wertvollsten Tests behalten.

**Warnung:**
"Wir haben 95% Coverage" ist wertlos wenn die Tests bei jeder Aenderung brechen und deshalb ignoriert werden. Lieber 60% Coverage mit stabilen Tests.

**Phase:**
Alle Phasen -- als uebergreifende Konvention von Anfang an etablieren.

---

## Geringfuegige Pitfalls

### Pitfall 11: LRU-Cache in verifyTokenRBAC liefert stale Daten in Tests

**Was schief geht:**
Die RBAC-Middleware cached User-Daten 30 Sekunden. In Tests wird ein User angelegt, Login durchgefuehrt, dann die Rolle geaendert. Der naechste Request bekommt noch die alte Rolle aus dem Cache. Test schlaegt fehl oder -- schlimmer -- der Test ist gruen obwohl die RBAC-Logik fehlerhaft ist.

**Praevention:**
1. Cache in Test-Environment deaktivieren: `if (process.env.NODE_ENV === 'test') return null` in `getCachedUser`.
2. Oder: `invalidateUserCache()` nach jeder Rollen-Aenderung in Tests explizit aufrufen.
3. `USER_CACHE_TTL` auf 0 setzen via ENV-Variable in Test-Config.

**Phase:** Phase 1 (Test-Config).

---

### Pitfall 12: Migrations laufen in Tests gegen bereits migrierte DB

**Was schief geht:**
Der erste Test-Run migriert die DB. Der zweite Run versucht erneut zu migrieren. Dank `schema_migrations` Tracking werden Migrations uebersprungen -- aber wenn eine Migration geaendert wurde (Bug-Fix), wird die Aenderung nie angewendet weil der Name bereits in `schema_migrations` steht.

**Praevention:**
1. Test-DB bei jedem Run komplett droppen und neu erstellen: `DROP DATABASE IF EXISTS konfi_test; CREATE DATABASE konfi_test;`
2. Oder: Testcontainers/Service-Container starten immer mit leerer DB.
3. NIEMALS eine persistente Test-DB verwenden die zwischen Runs bestehen bleibt.

**Phase:** Phase 1 (DB-Setup).

---

### Pitfall 13: Environment-Variablen fehlen in CI

**Was schief geht:**
Die App braucht: `JWT_SECRET`, `QR_SECRET`, `DATABASE_URL`, `CORS_ORIGINS`, `VITE_API_URL`, Firebase-Credentials, SMTP-Config. In CI fehlt die Haelfte davon. Server startet nicht, Tests schlagen sofort fehl mit kryptischen Fehlermeldungen.

**Praevention:**
1. `.env.test` Datei mit allen noetigten Variablen (Dummy-Werte fuer Firebase, SMTP). In `.gitignore` NICHT drin -- Test-Secrets sind keine echten Secrets.
2. Nicht-essentielle Services mocken: Firebase Push, SMTP Mail. Testen dass sie aufgerufen werden, nicht dass sie funktionieren.
3. CI Workflow: Alle noetigten ENV-Variablen explizit listen, nicht auf GitHub Secrets verweisen fuer Test-Werte.

**Phase:** Phase 1 (Test-Config).

---

## Technical Debt Patterns

| Shortcut | Sofortiger Nutzen | Langfrist-Kosten | Wann akzeptabel |
|----------|-------------------|------------------|-----------------|
| Auth-Middleware mocken statt echte Tokens | Tests 50% schneller schreiben | RBAC-Bugs nie entdeckt, false sense of security | Niemals fuer Route-Tests. Nur fuer reine Unit-Tests von Utility-Funktionen |
| Exakte JSON-Snapshot-Assertions | Tests schnell geschrieben (`.toMatchSnapshot()`) | Jede API-Aenderung bricht alle Snapshots, Maintenance-Hoelle | Nur fuer stabile, selten aendernde Responses (z.B. Rollen-Liste) |
| Testcontainers statt Service-Container in CI | Lokal identisch zu CI | 20-30s langsamer pro Run durch Docker-in-Docker | Wenn Docker Compose lokal benoetigt wird fuer komplexe Setups |
| Skip Socket.IO Tests | 50% weniger Infrastruktur-Aufwand | Chat-Bugs (Org-Isolation, Typing, Reactions) nie getestet | MVP-Phase, wenn Chat stabil ist und sich nicht aendert |
| Coverage-Threshold erzwingen | Motiviert zum Testen | Entwickler schreiben wertlose Tests um Threshold zu erreichen | Niemals als harte Gate. Als Reporting-Metrik nutzen, nicht als Blocker |

## Integration Gotchas

| Integration | Haeufiger Fehler | Korrekter Ansatz |
|-------------|------------------|------------------|
| PostgreSQL Service Container | Kein Health-Check, Tests starten bevor DB bereit | `--health-cmd pg_isready --health-retries 5` im Workflow |
| Firebase Admin SDK | Echte Credentials in Tests, oder SDK-Init schlaegt fehl | `FIREBASE_CONFIG=test` ENV setzen, Firebase-Calls mocken (jest.mock/vi.mock) |
| Socket.IO in Tests | `io.listen()` auf festem Port, Port-Konflikt bei Parallelausfuehrung | Port 0 (zufaelliger Port) oder `httpServer.listen(0)` |
| Multer/File-Upload Tests | Echte Dateien in Test-Ordner, werden nicht aufgeraeumt | In-Memory-Storage fuer Tests: `multer({ storage: multer.memoryStorage() })` |
| node-cron in Tests | Cron-Jobs laufen im Hintergrund und interferieren mit Tests | Cron-Init in eigene Funktion, in Tests nicht aufrufen |
| Express Rate-Limiter | Tests schlagen nach 10 Requests fehl wegen Rate-Limit | Rate-Limiter in Test-Environment deaktivieren oder `skip: () => process.env.NODE_ENV === 'test'` |

## Performance Traps

| Trap | Symptome | Praevention | Wann es bricht |
|------|----------|-------------|----------------|
| Jeder Test erstellt eigene DB-Connection | Tests werden langsamer ueber Zeit, "too many connections" | Shared Pool mit max 5 Connections fuer alle Tests | Ab ~50 Tests |
| Seed-Script laeuft vor JEDEM Test | Test-Suite braucht 2+ Minuten | Einmal pro Suite seeden, Transaction-Rollback pro Test | Ab ~20 Tests pro Suite |
| Playwright startet Browser pro Test | E2E-Suite dauert 10+ Minuten | `reuseExistingServer: true`, Browser-Context statt neuer Browser | Ab ~15 E2E-Tests |
| npm install ohne Cache in CI | Jeder CI-Run 40s+ fuer install | `actions/setup-node@v4` mit `cache: 'npm'` | Sofort, bei jedem Run |
| Docker-Image-Build vor Tests | 3+ Minuten verschwendet bei fehlschlagenden Tests | Tests zuerst, Build nur bei Erfolg | Sofort |

## "Sieht fertig aus, ist es aber nicht" Checkliste

- [ ] **RBAC-Tests:** "Alle Endpoints getestet" -- aber wurde auch Cross-Organisation-Zugriff getestet? Admin von Org A darf Konfi von Org B NICHT sehen.
- [ ] **Punkte-Tests:** "Punkte vergeben funktioniert" -- aber wurde atomare Transaktion getestet? Zwei gleichzeitige Punkte-Vergaben duerfen sich nicht ueberschreiben.
- [ ] **Chat-Tests:** "Nachrichten senden funktioniert" -- aber wurde Org-Isolation geprueft? User aus Org A darf Chat-Room von Org B nicht sehen.
- [ ] **Event-Tests:** "Buchung funktioniert" -- aber wurde Warteliste-Nachruecken getestet? Wenn ein Platz frei wird, muss der naechste von der Warteliste automatisch nachruecken.
- [ ] **Auth-Tests:** "Login funktioniert" -- aber wurde Token-Refresh und Soft-Revoke getestet? Refresh-Token muss nach Logout ungueltig sein.
- [ ] **CI Pipeline:** "Tests laufen in CI" -- aber laufen sie auch bei PRs oder nur bei Push auf main? PR-Checks muessen vor Merge laufen.
- [ ] **Migration-Tests:** "DB startet" -- aber wurden die Migrations auf einer komplett leeren DB getestet? Nicht nur auf der Entwickler-DB die schon alte Daten hat.

## Recovery Strategies

| Pitfall | Recovery-Aufwand | Recovery-Schritte |
|---------|------------------|-------------------|
| Parallelisierungs-Race-Conditions | MEDIUM | `--poolOptions.forks.singleFork` als Sofortmassnahme, dann Transaction-Rollback Pattern nachruesten |
| server.js nicht testbar | HIGH | app.js Extraktion ist Refactoring, braucht sorgfaeltiges Testen des Produktions-Verhaltens |
| Auth gemockt, RBAC-Bug in Produktion | HIGH | Alle Auth-Mocks entfernen, echte Token-Helper bauen, RBAC-Matrix-Tests schreiben. Moeglicherweise Sicherheits-Audit noetig |
| Flaky Socket.IO Tests | LOW | Socket-Registry mit garantiertem Cleanup implementieren, Timeouts hinzufuegen |
| Test-DB-Schema divergiert | MEDIUM | Test-DB droppen, mit echten Migrations neu aufsetzen, Seed-Script anpassen |
| CI zu langsam (> 5 Min) | LOW | Service-Container statt Testcontainers, npm-Cache, Tests-vor-Build Reihenfolge |
| 30% Tests deaktiviert/skipped | HIGH | Triage: Wertvolle Tests fixen, wertlose loeschen. Coverage-Ziel realistisch setzen |

## Pitfall-to-Phase Mapping

| Pitfall | Praevention in Phase | Verifikation |
|---------|---------------------|--------------|
| P1: Parallelisierung | Phase 1: Backend-Infrastruktur | Alle Tests 5x nacheinander laufen lassen, keine Flakes |
| P2: server.js Monolith | Phase 1: Backend-Infrastruktur | `const app = require('./app')` funktioniert ohne Server-Start |
| P3: RBAC-Daten-Explosion | Phase 1: Fixtures/Seed | Seed-Script laeuft auf leerer DB, alle Rollen + 2 Orgs vorhanden |
| P4: Capacitor in Playwright | Phase 3: E2E-Scope | Scope-Dokument listet was getestet wird und was nicht |
| P5: Socket.IO haengt | Phase 2: Socket-Tests | `vitest --reporter=verbose` zeigt keine haengenden Tests |
| P6: Schema-Drift | Phase 1: DB-Setup | CI startet immer mit leerer DB + Migrations |
| P7: Auth-Mocking | Phase 2: Route-Tests | Kein `vi.mock` auf rbac.js in Route-Test-Dateien |
| P8: CI-Speed | Phase 4: CI/CD | CI Run < 5 Minuten |
| P9: Shadow DOM | Phase 3: Frontend-Tests | Frontend-Tests fokussieren auf Hooks/Logic, nicht UI |
| P10: Maintenance-Burden | Alle Phasen | Assertions auf wesentliche Felder, nicht exakte Objekte |
| P11: RBAC-Cache | Phase 1: Test-Config | USER_CACHE_TTL=0 in .env.test |
| P12: Migration-Rerun | Phase 1: DB-Setup | DROP + CREATE bei jedem Test-Run |
| P13: ENV-Variablen | Phase 1: Test-Config | .env.test vorhanden und vollstaendig |

## Quellen

- [Vitest + Testcontainers + PostgreSQL Integration](https://nikolamilovic.com/posts/integration-testing-node-postgres-vitest-testcontainers/) -- Transaction-Rollback und Global-Setup Patterns
- [Using TestContainers with Vitest](https://dev.to/jcteague/using-testconatiners-with-vitest-499f) -- Parallelisierungs-Probleme und Loesungen
- [Blazing fast Prisma + Postgres Tests](https://codepunkt.de/writing/blazing-fast-prisma-and-postgres-tests-in-vitest/) -- Transaction-Rollback pro Test
- [Socket.IO Official Testing Docs](https://socket.io/docs/v4/testing/) -- Server/Client Setup und Cleanup
- [Socket.IO WebSocket Integration Tests mit Vitest](https://medium.com/@juaogui159/how-to-effectively-write-integration-tests-for-websockets-using-vitest-and-socket-io-360208978210) -- Helper-Pattern fuer Event-Handling
- [Playwright Limitations mit Ionic/Capacitor](https://forum.ionicframework.com/t/testing-the-native-apps-that-come-out-of-capacitor/244855) -- Nur Web-Teil testbar
- [Capacitor Plugin Mocking](https://capacitorjs.com/docs/guides/mocking-plugins) -- Offizielle Mock-Strategie
- [Ionic React Testing Introduction](https://ionicframework.com/docs/react/testing/introduction) -- Shadow DOM Einschraenkungen
- [GitHub Actions PostgreSQL Service Container](https://docs.github.com/en/actions/using-containerized-services/creating-postgresql-service-containers) -- Health-Check Konfiguration
- [Database Testing in GitHub Actions](https://oneuptime.com/blog/post/2025-12-20-database-testing-github-actions/view) -- Best Practices fuer CI-DB-Setup

---
*Pitfalls-Recherche fuer: Test-Suite + CI/CD bei bestehendem Express/Ionic/PostgreSQL Projekt*
*Recherchiert: 2026-03-27*
