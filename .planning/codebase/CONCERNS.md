# Codebase Concerns

**Analysis Date:** 2026-03-23

---

## Tech Debt

**Zwei parallele Auth-Middleware (verifyToken vs. verifyTokenRBAC):**
- Issue: `verifyToken` in `backend/server.js` (Zeile 405–418) prüft nur die JWT-Signatur. Die RBAC-Middleware `verifyTokenRBAC` in `backend/middleware/rbac.js` prüft zusätzlich `is_active`, `token_invalidated_at` (Soft-Revoke) und `organization_active`. Die Auth-Routes `/change-password`, `/update-email`, `/update-role-title`, `/me`, `/invite-code*` und `/logout` nutzen weiterhin das alte `verifyToken` ohne diese Checks.
- Files: `backend/routes/auth.js` (Zeilen 177, 213, 241, 268, 336, 384, 413, 452, 799), `backend/server.js` (Zeile 405)
- Impact: Gesperrte oder deaktivierte User können Passwörter ändern, E-Mails aktualisieren und sich ausloggen, bis ihr JWT abläuft (15 min). Soft-Revoke gilt für diese Endpunkte nicht.
- Fix approach: Auth-Routes auf `verifyTokenRBAC` umstellen, `verifyToken`-Funktion aus `server.js` entfernen.

**Hardcodierte Admin-User-ID 1 in chatUtils:**
- Issue: Beim automatischen Erstellen von Jahrgangs-Chat-Räumen beim Serverstart wird `created_by = 1` hartcodiert.
- Files: `backend/utils/chatUtils.js` (Zeile 21 — INSERT mit `1` als created_by-Wert)
- Impact: Bei Multi-Tenant-Einsatz (EKD-Skalierung) verweist `created_by` in neuen Organisationen auf einen fremden User oder einen nicht existierenden User-Eintrag. Referentielle Integrität kann verletzt werden.
- Fix approach: Ersten aktiven Admin der jeweiligen Organisation per Sub-Query ermitteln oder die Spalte auf NULL erlauben.

**Doppelte Event-Buchungslogik in konfi.js und events.js:**
- Issue: Waitlist-Positionsberechnung, Buchungsstatus-Ermittlung und Buchungs-Cancel mit Waitlist-Nachrücken sind sowohl in `backend/routes/konfi.js` als auch in `backend/routes/events.js` implementiert. Beide Dateien übersteigen 2000 Zeilen.
- Files: `backend/routes/konfi.js` (Zeilen 1242–1409), `backend/routes/events.js` (Zeilen 940–1000)
- Impact: Bugfixes müssen an zwei Stellen gepflegt werden. Abweichungen zwischen beiden Implementierungen sind bereits vorhanden (z. B. Timeslot-Handling-Detailunterschiede).
- Fix approach: Booking-Logik in `backend/utils/bookingUtils.js` extrahieren.

**Routen-Dateigrößen über Wartbarkeitsgrenze:**
- Issue: Mehrere Route-Dateien sind so groß, dass sie kaum noch einzeln überschaubar sind.
  - `backend/routes/events.js`: 2071 Zeilen
  - `backend/routes/konfi.js`: 2052 Zeilen
  - `backend/routes/chat.js`: 1877 Zeilen
- Files: `backend/routes/events.js`, `backend/routes/konfi.js`, `backend/routes/chat.js`
- Impact: Onboarding-Kosten hoch, unabsichtliche Seiteneffekte bei Änderungen schwer erkennbar.
- Fix approach: Events in Sub-Router aufteilen (booking, checkin, management). Konfi-Route analog aufteilen.

**Frontend: inline Fetcher-Funktionen in useOfflineQuery (instabile Referenzen):**
- Issue: Alle Aufrufstellen von `useOfflineQuery` übergeben den Fetcher als inline-`async () => { ... }`-Funktion. Die `revalidate`-Funktion in `useOfflineQuery` hat `fetcher` als Dependency im `useCallback`. Inline-Funktionen sind bei jedem Render eine neue Referenz, was potenziell zu redundanten Revalidierungen führt.
- Files: `frontend/src/components/admin/pages/AdminKonfisPage.tsx` (Zeile 67), alle weiteren Seiten die `useOfflineQuery` nutzen (mind. 30 Stellen).
- Impact: Erhöhte API-Last durch doppelte Fetches nach State-Updates auf Seiten mit mehreren `useOfflineQuery`-Aufrufen. In der Praxis abgefedert durch Cache-TTL, aber nicht vollständig verhindert.
- Fix approach: Fetcher-Funktionen mit `useCallback` memoizen oder `useOfflineQuery` intern so absichern, dass Fetcher-Referenzwechsel ignoriert werden (Ref-Pattern).

**Fehlende MIME-Type-Validierung auf Magic-Bytes-Ebene:**
- Issue: Der Upload-Filter in `backend/server.js` validiert Dateitypen ausschließlich anhand des vom Client gemeldeten `Content-Type`-Headers (`file.mimetype`). Multer liest diesen Header aus der Multipart-Form; ein Angreifer kann beliebige Dateien hochladen, indem er den MIME-Type manuell setzt.
- Files: `backend/server.js` (Zeilen 315–334, 350–375, 391–398)
- Impact: Möglicherweise schadhafte Dateien (z. B. ausführbare Scripte mit `.png`-Extension) landen im Upload-Verzeichnis. Aktuell werden Uploads nicht als static serviert (positiv), aber Verarbeitungsrisiken bestehen.
- Fix approach: `file-type`-Paket (Magic-Bytes-Analyse) als zusätzlichen Check nach dem Multer-Filter einbauen.

---

## Sicherheit

**TLS-Zertifikatsvalidierung deaktiviert für SMTP:**
- Risk: `rejectUnauthorized: false` in der SMTP-Konfiguration deaktiviert die Server-Zertifikat-Prüfung. Man-in-the-Middle-Angriffe auf E-Mail-Übertragungen sind möglich.
- Files: `backend/server.js` (Zeile 177), `backend/services/emailService.js` (Zeile 39)
- Current mitigation: Intern (Docker → Hetzner SMTP). Kommentar im Code erklärt den Grund (Zertifikat auf Hostname ausgestellt, Docker nutzt IP).
- Recommendations: SMTP-Host so konfigurieren, dass er über den im Zertifikat eingetragenen Hostname erreichbar ist, und `rejectUnauthorized` wieder auf `true` setzen.

**Content Security Policy vollständig deaktiviert:**
- Risk: Kein CSP-Header schützt vor Cross-Site-Scripting. XSS-Angriffe, die externe Scripts nachladen, werden nicht geblockt.
- Files: `backend/server.js` (Zeile 267: `contentSecurityPolicy: false`)
- Current mitigation: Ionic/React serialisiert Template-Strings über JSX, direktes `dangerouslySetInnerHTML` ist nicht erkennbar in den Quellen.
- Recommendations: Striktes CSP mit `nonce`-Ansatz für Ionic-kompatible Konfiguration evaluieren (zumindest `default-src 'self'` mit Inline-Script-Whitelist).

**Benutzernamen werden in Login-Logs im Klartext protokolliert:**
- Risk: Login-Versuche werden mit dem Benutzernamen geloggt (`console.warn("Login-Versuch: ${username}")`). Bei falschen Passwörtern erscheint der Benutzername ebenfalls im Log.
- Files: `backend/routes/auth.js` (Zeilen 93, 114, 120)
- Current mitigation: Logs liegen nur auf dem Server, kein externer Log-Dienst erkennbar.
- Recommendations: Benutzernamen in Logs maskieren oder nur Hash-Präfix loggen.

**JWT_SECRET an mehreren Stellen separat geladen:**
- Risk: `JWT_SECRET` wird in `server.js`, `routes/auth.js`, `routes/konfi.js`, `middleware/rbac.js` und `routes/chat.js` (direkt via `process.env.JWT_SECRET`) separat eingelesen. Chat-Route verwendet `process.env.JWT_SECRET` ohne den Start-Check.
- Files: `backend/routes/chat.js` (Zeile 1055), `backend/routes/konfi.js` (Zeile 11), `backend/routes/auth.js` (Zeile 22)
- Current mitigation: Startup-Check in `server.js` und `middleware/rbac.js` schlägt fehl, wenn `JWT_SECRET` fehlt.
- Recommendations: Zentrales Auth-Modul erstellen, das `JWT_SECRET` einmalig liest und exportiert.

---

## Performance-Engpässe

**Background Badge Service: Serielle DB-Abfragen pro User (N+1):**
- Problem: `backgroundService.js` iteriert alle User mit Push-Tokens in einer `for`-Schleife und führt für jeden User mehrere DB-Abfragen durch (`checkAndAwardBadges` + Chat-Unread-Count + Badge-Count).
- Files: `backend/services/backgroundService.js` (Zeilen 75–109)
- Cause: `checkAndAwardBadges` lädt für jeden User individuell alle Badges der Organisation plus earned-Badges. Bei 100+ Usern mit Push-Tokens: 300+ sequentielle DB-Queries alle 5 Minuten.
- Improvement path: Badge-Check auf einen bulk-fähigen SQL-Query umschreiben; Chat-Unread-Count via GROUP BY in einer Query für alle User aggregieren.

**verifyTokenRBAC: DB-Query bei jedem Request:**
- Problem: `verifyTokenRBAC` führt bei jedem authentifizierten Request zwei DB-Abfragen aus: User-Lookup + Jahrgangs-Assignments.
- Files: `backend/middleware/rbac.js` (Zeilen 43–91)
- Cause: Kein Caching. Bei aktivem System mit vielen gleichzeitigen Usern liegt die Auth-Last proportional zu allen API-Requests an.
- Improvement path: Short-lived In-Memory-Cache (z. B. 30 Sekunden) mit LRU-Strategie für User-Objekte.

**Chat: Nachrichten-Limit hardcoded auf 200:**
- Problem: Die initiale Chat-Nachrichtenladung ist auf 200 Nachrichten hart begrenzt ohne Pagination für ältere Nachrichten.
- Files: `backend/routes/chat.js` (Zeile 588: `LIMIT 200`)
- Cause: Einfache Implementierung ohne Cursor-basiertes Pagination.
- Improvement path: Cursor-Pagination implementieren (vor/nach `message_id`), sodass die App nachladen kann.

---

## Fragile Bereiche

**setImmediate mit falschem Aufruf in server.js:**
- Files: `backend/server.js` (Zeile 527)
- Why fragile: `setImmediate(initializeChatRooms(db))` ruft `initializeChatRooms(db)` sofort auf und übergibt das zurückgegebene Promise an `setImmediate` — nicht die Funktion selbst. Das Ergebnis ist, dass die Chat-Raum-Initialisierung synchron im Startup-Code läuft (noch vor dem Server-Listen) und Fehler darin den Start nicht blockieren, aber das Promise unkontrolliert im Hintergrund läuft.
- Safe modification: Ändern zu `setImmediate(() => initializeChatRooms(db)())` oder besser `initializeChatRooms(db)().catch(...)` im Server-Start-Block.
- Test coverage: Keine Tests vorhanden.

**checkAndAwardBadges: globale Seiteneffekte via routerexport:**
- Files: `backend/routes/badges.js` (Zeilen 818, 823)
- Why fragile: `checkAndAwardBadges` ist sowohl an `router.checkAndAwardBadges` als auch an `module.exports.checkAndAwardBadges` gehängt. Andere Routes (`activities.js`, `events.js`, `konfi.js`, `backgroundService.js`) importieren diese Funktion auf unterschiedliche Wege (über `badgesRouter.checkAndAwardBadges` aus `server.js` DI, bzw. `require('../routes/badges').checkAndAwardBadges` direkt in `backgroundService.js`).
- Safe modification: Funktion in eigene Datei `backend/utils/badgeUtils.js` auslagern.
- Test coverage: Keine automatisierten Tests.

**Gemischte asynchrone Dateioperationen:**
- Files: `backend/routes/material.js` (Zeilen 506, 633 — `fs.unlinkSync`), `backend/routes/activities.js` (Zeile 400 — Callback-Style `fs.unlink`), `backend/routes/chat.js` / `backend/routes/jahrgaenge.js` / `backend/routes/events.js` (async `fs.unlink`)
- Why fragile: `fs.unlinkSync` blockiert den Node.js-Eventloop in Request-Handlern. `fs.unlink` mit Callback in einem async-Kontext wird nicht awaited. Fehler beim Callback-Style werden nur ignoriert, wenn `err` nicht geprüft wird.
- Safe modification: Einheitlich `fs.promises.unlink` mit `await` verwenden.

**Chatutils: N+1-Schleife beim Server-Start:**
- Files: `backend/utils/chatUtils.js` (Schleife über alle Jahrgänge + innere Schleife über Konfis)
- Why fragile: Beim Start werden für jede Organisation alle Jahrgänge geladen; für jeden Jahrgang wird ein Raum geprüft/erstellt; für jeden Raum werden alle Konfis als Teilnehmer eingetragen. Bei großen Datenbeständen (EKD-Skalierung) läuft dies sequentiell und belastet die DB stark.
- Safe modification: Transaktion mit Bulk-Insert oder idempotentes Migrations-SQL.
- Test coverage: Keine Tests.

---

## Test Coverage Gaps

**Nahezu keine Testabdeckung vorhanden:**
- What's not tested: Das gesamte Backend (alle 15 Routes, alle Services, Middleware), die gesamte Frontend-Business-Logik (Offline-Queue, Badge-Logik, Auth-Flow).
- Files: `backend/routes/*.js` (0 Tests), `frontend/src/**/*.tsx` (0 Tests außer `App.test.tsx` mit Trivial-Smoke-Test)
- Risk: Jede Änderung an kritischen Pfaden (Buchung, Punkte, Badge-Award) kann unbemerkt Regressionen einführen.
- Priority: Hoch

**Cypress E2E nur als Stub vorhanden:**
- What's not tested: Der einzige Cypress-Test (`frontend/cypress/e2e/test.cy.ts`) prüft einen Inhalt (`Tab 1 page`), der im aktuellen Stand der App nicht existiert.
- Files: `frontend/cypress/e2e/test.cy.ts`
- Risk: CI kann nicht feststellen, ob die App grundlegend funktioniert.
- Priority: Hoch

---

## Fehlende kritische Features

**Kein Logging-Framework (nur console.*):**
- Problem: 279 `console.error/warn/log`-Aufrufe im Backend ohne strukturiertes Logging. Kein Log-Level-Management, kein zentrales Error-Tracking.
- Blocks: Effektives Monitoring in Produktion, Fehleranalyse ohne direkten Serverzugriff.

**Keine Datenbankbackup-Strategie im Code konfiguriert:**
- Problem: Es gibt keine automatischen Backup-Jobs oder Hinweise auf eine Backup-Strategie im Code oder in den Docker-Konfigurationsdateien.
- Blocks: Datenwiederherststellung nach Datenverlust.

---

## Dependencies at Risk

**Keine automatisierten Dependency-Updates:**
- Risk: Sicherheitslücken in transitiven Dependencies werden nicht automatisch erkannt.
  - `backend/package.json` enthält keine `audit`-CI-Pipeline.
- Impact: Bekannte CVEs in direkten oder transitiven Dependencies bleiben unentdeckt bis zu manuellem `npm audit`.
- Migration plan: `npm audit` in CI/CD-Workflow (`.github/workflows/`) integrieren und automatischen Dependabot-Scan aktivieren.

---

*Concerns-Analyse: 2026-03-23*
