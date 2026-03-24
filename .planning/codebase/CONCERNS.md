# Codebase Concerns

**Analysis Date:** 2026-03-24

---

## Sicherheit (Kritisch)

### APNs Private Keys in Git-History

- Risk: Apple Push Notification Service (APNs) private Schlüsseldateien sind ins Git-Repository committed
- Files: `docs/AuthKey_7AQA623H3T.p8`, `docs/AuthKey_A29U7SN796.p8`
- Current mitigation: Keine — Dateien sind im Git-Index (`git ls-files docs/` bestätigt)
- Recommendations: Sofort aus Git-History entfernen (`git filter-branch` oder `git-filter-repo`), Schlüssel bei Apple Developer Portal widerrufen und neu erstellen, `docs/*.p8` in `.gitignore` aufnehmen

### Produktions-Secrets in portainer-stack.yml (Git-tracked)

- Risk: Alle Produktions-Credentials liegen in einer versionierten Datei
- Files: `portainer-stack.yml`
- Betroffene Werte: `JWT_SECRET: konfi-secret-super-secure-2025`, `POSTGRES_PASSWORD: konfi_secure_password_2025`, `SMTP_PASS: "NkqFQuTx877Sia6Pp"`, `LOSUNG_API_KEY: ksadh8324oijcff45rfdsvcvhoids44`
- Aktueller Zustand: Datei ist in `.gitignore` gelistet, aber bereits getrackt (Git ignoriert gitignorierte Dateien nur für neue Dateien, nicht für bereits getrackten Content)
- Impact: Jeder mit Lesezugriff auf das Repo kann alle Produktions-Secrets einsehen
- Fix approach: `git rm --cached portainer-stack.yml`, alle aufgeführten Secrets rotieren, Portainer-Stack über Portainer-Umgebungsvariablen oder Docker Secrets verwalten

### TLS-Zertifikatvalidierung deaktiviert

- Risk: SMTP-Verbindungen ignorieren Zertifikatsfehler
- Files: `backend/server.js:177`, `backend/services/emailService.js:39`
- Code: `rejectUnauthorized: false` in beiden SMTP-Konfigurationen
- Current mitigation: Verbindung läuft nur im internen Docker-Netzwerk (127.0.0.1)
- Recommendations: Eigentlichen Hostnamen im Docker-Container korrekt auflösen oder selbst-signiertes Zertifikat des Mailservers explizit vertrauen statt TLS-Validierung komplett zu deaktivieren

### Passwort-Policy-Bypass in Admin-User-Verwaltung

- Risk: Admin-Benutzer können mit schwachen Passwörtern erstellt werden
- Files: `backend/routes/users.js:37` (Reset: min. 6 Zeichen), `backend/routes/users.js:18` (`commonValidations.password`)
- Problem: `validatePassword` (min. 8 Zeichen + Komplexität aus `utils/passwordUtils.js`) wird in `users.js` NICHT aufgerufen. Nur `auth.js` verwendet `validatePassword`. Admin-erstellte Nutzer und Passwort-Resets durch Admins unterliegen damit nur dem 6-Zeichen-Minimum.
- Fix approach: `validatePassword` auch in `users.js`-Validierungsregeln für `validateCreateUser` und `validateResetPassword` einbinden

### Fehlende JSON-Body-Größenbegrenzung

- Risk: DoS durch große JSON-Requests
- Files: `backend/server.js:282`
- Code: `app.use(express.json())` ohne `limit`-Option — Standard-Limit ist 100kb, was für die meisten Endpoints ausreicht, aber kein explizites Limit gesetzt
- Recommendations: `app.use(express.json({ limit: '1mb' }))` explizit setzen für klare Dokumentation und Schutz

---

## Tech Debt

### Legacy `user_type`-Feld im Chat-System

- Issue: Das Chat-System verwendet ein separates `user_type`-Feld (`'admin'`, `'konfi'`, `'teamer'`) in `chat_participants` und `chat_read_status`, das parallel zur RBAC-Rollen-Struktur existiert
- Files: `backend/routes/chat.js` (96 Vorkommen von `user_type`), `backend/middleware/rbac.js:156` (erzeugt `type` als Backward-Compatibility-Feld)
- Impact: Teamer-Nutzer werden im Chat als `'admin'` behandelt (der Backward-Compat-Wert aus `rbac.js` mappt `teamer` → `admin`). Die Chat-Logik prüft nur `'admin'` und `'konfi'` als valide `target_user_type` Werte (Zeile 234). Eine echte Teamer-Unterscheidung im Chat ist nicht vorhanden.
- Fix approach: `user_type` auf RBAC-`role_name` umstellen oder die Chat-Tabellen mit einem FK auf `users.id` ohne redundantes `user_type`-Feld refaktorieren

### `setImmediate` mit sofort ausgeführter Funktion (Bug)

- Issue: `initializeChatRooms(db)` wird beim Aufruf sofort ausgeführt und gibt ein Promise zurück — `setImmediate` erhält dieses Promise, nicht die Funktion
- Files: `backend/server.js:527`
- Code: `setImmediate(initializeChatRooms(db));`
- Korrekte Verwendung wäre: `setImmediate(() => initializeChatRooms(db)());`
- Impact: Die Chat-Room-Initialisierung läuft synchron im Start-Up-Code (nicht nach dem nächsten Tick) und Fehler sind nicht vollständig abgefangen
- Fix approach: `initializeChatRooms(db)()` direkt aufrufen oder `setImmediate(() => initializeChatRooms(db)())` verwenden

### Legacy `data`-Verzeichnis wird noch erstellt

- Issue: Das `data/`-Verzeichnis (war für SQLite-DB) wird bei jedem Server-Start noch angelegt, auch wenn es nicht mehr gebraucht wird
- Files: `backend/server.js:424-429`
- Impact: Kein Funktionsproblem, aber toter Code der Verwirrung stiftet
- Fix approach: Zeilen 424-429 in `server.js` entfernen

### `checkAndAwardBadges` als Property am Router-Objekt

- Issue: `checkAndAwardBadges` wird als Property auf dem Express-Router-Objekt exportiert (`badgesRouter.checkAndAwardBadges`), was ein ungewöhnliches und fragiles Muster ist
- Files: `backend/routes/badges.js:818`, `backend/server.js:477`
- Impact: Schwierig zu testen, unklar ob Property nach Hot-Reload erhalten bleibt; wird auch als `module.exports.checkAndAwardBadges` exportiert (zwei Export-Wege)
- Fix approach: Als eigene Service-Funktion in `backend/services/badgeService.js` auslagern

### Kein User-Cache-Invalidation bei Rollenänderungen

- Issue: Der In-Memory-User-Cache in `rbac.js` (30s TTL) wird bei Rollenänderungen nicht explizit invalidiert
- Files: `backend/middleware/rbac.js:35-41`, `backend/routes/users.js:260-273`
- `invalidateUserCache` ist exportiert, wird aber in keiner Route aufgerufen
- Impact: Nach einer Rollenänderung kann ein Nutzer bis zu 30 Sekunden lang mit der alten Rolle handeln (socket.io-Disconnect als Workaround ist vorhanden, aber HTTP-Requests laufen weiter)
- Fix approach: `invalidateUserCache(id)` in `users.js` nach erfolgreicher Rollenänderung aufrufen

### Viele große Dateien ohne Aufteilung

- Issue: Mehrere Komponenten und Routes sind sehr groß und enthalten mehrere unabhängige Verantwortlichkeiten
- Files:
  - `frontend/src/components/admin/views/KonfiDetailSections.tsx` (1181 Zeilen)
  - `frontend/src/components/admin/modals/BadgeManagementModal.tsx` (1124 Zeilen)
  - `frontend/src/components/chat/ChatRoom.tsx` (1058 Zeilen)
  - `backend/routes/events.js` (2042 Zeilen)
  - `backend/routes/konfi.js` (2023 Zeilen)
  - `backend/routes/chat.js` (1878 Zeilen)
- Impact: Schwierige Wartbarkeit, hohe kognitive Last, Merge-Konflikte wahrscheinlicher
- Fix approach: Schrittweise in kleinere Komponenten/Module aufteilen; Backend-Routes nach REST-Ressourcen trennen

---

## Performance-Engpässe

### Badge-Update-Hintergrunddienst läuft für alle User sequenziell

- Problem: `BackgroundService.updateAllUserBadges` iteriert alle User mit Push-Tokens in einer Schleife und prüft/vergibt Badges einzeln
- Files: `backend/services/backgroundService.js:94-130`
- Cause: `checkAndAwardBadges` wird pro User aufgerufen, macht mehrere DB-Queries je User
- Bei EKD-Skalierung (4000+ User): Service-Zyklus (alle 5 Min.) dauert möglicherweise länger als 5 Minuten
- Improvement path: Batch-Verarbeitung mit `Promise.all` (begrenzte Concurrency), Badge-Check nur bei tatsächlichen Punkt-Änderungen triggern statt Polling

### Sequential Waitlist-Promotion in Event-Update

- Problem: Wartelisten-Beförderung iteriert Einträge sequenziell mit einzelnen UPDATE-Queries
- Files: `backend/routes/events.js:950-953`, `backend/routes/events.js:968-971`
- Cause: `for (const entry of waitlistEntries) { await client.query(UPDATE ...) }`
- Improvement path: Bulk-UPDATE mit `WHERE id = ANY($1::int[])` statt N einzelne Queries

### Chat: Unbegrenztes `after`-Polling ohne Backpressure

- Problem: Der `after`-Parameter in der Chat-Nachrichten-API ist auf 200 Nachrichten begrenzt, aber kein Throttling bei Reconnects
- Files: `backend/routes/chat.js:584-590`
- Bei Offline-Reconnect mit langem Rückstand werden alle verpassten Nachrichten auf einmal geladen

---

## Fragile Bereiche

### Event-Buchungs-Transaktion: Viele separate `client.release()`-Aufrufe

- Files: `backend/routes/events.js` (9 `getClient()`-Aufrufe, ~55 `client.release()`-Aufrufe)
- Why fragile: Das Early-Return-Pattern (`ROLLBACK; client.release(); return res.status(...)`) ist fehleranfällig — jede neue early-return-Bedingung erfordert manuelles `client.release()`. Ein vergessenes Release verursacht Connection-Pool-Erschöpfung.
- Safe modification: Try-finally-Block verwenden (`finally { client.release(); }`) statt manueller Release-Aufrufe in jedem Branch
- Test coverage: Keine automatisierten Tests für Transaktions-Rollback-Szenarien

### Chat-Dateizugriff prüft Membership ohne `user_type`

- Files: `backend/routes/chat.js:1084-1088`
- Problem: Die Membership-Check-Query für Dateizugriff (`chat_participants`) prüft `user_id` aber nicht `user_type`. Da Nutzer mehrere `user_type`-Einträge haben könnten (nach Rollenänderung), kann dies zu unerwarteten Zugriffen führen.
- Safe modification: `AND cp.user_id = $2 AND cp.user_type = $3` mit dem korrekten `user_type` des anfragenden Users

### `ensureAdminJahrgangChatMembership` kennt keine Teamer-Rolle

- Files: `backend/routes/chat.js:40-100`
- Why fragile: Die Funktion verwaltet Chat-Mitgliedschaft nur für `user_type = 'admin'`. Teamer-Nutzer werden nicht eigenständig verwaltet — sie "erben" den `admin`-user_type via Backward-Compat. Wenn das RBAC-Mapping geändert wird, bricht Chat-Membership für Teamer.
- Test coverage: Keine Tests

### Portainer-Stack SMTP-Config doppelt (postgres + backend)

- Files: `portainer-stack.yml:15-18` (postgres service), `portainer-stack.yml:48-51` (backend service)
- Why fragile: SMTP-Konfiguration ist im postgres-Service eingetragen, obwohl postgres keine E-Mails sendet. Bei Änderung der SMTP-Credentials muss der postgres-Service unnötig neugestartet werden.
- Fix approach: SMTP-Envs aus dem postgres-Service entfernen

---

## Test-Coverage-Lücken

### Nahezu keine automatisierten Tests

- What's not tested: Alle Backend-Routes, alle Frontend-Komponenten, Transaktions-Logik, Badge-Vergabe-Logik, RBAC-Middleware
- Files: `frontend/src/App.test.tsx` (einzige Testdatei — prüft nur ob App rendert), keine Backend-Tests gefunden
- Risk: Regressions beim Refactoring oder bei neuen Features können nicht automatisch erkannt werden
- Priority: Hoch — besonders kritisch für Auth-, RBAC- und Transaktions-Code

### Keine Integration-Tests für RBAC-Grenzen

- What's not tested: Dass Konfis keine Admin-Endpoints aufrufen können, Organisations-Isolation, Jahrgangs-Zugriffs-Checks
- Risk: Sicherheitslücken durch fehlerhafte Middleware-Komposition könnten unbemerkt eingeführt werden
- Priority: Hoch

---

## Fehlende Kritische Features

### Kein Datei-Cleanup bei verwaisten Uploads

- Problem: Wenn Chat-Nachrichten mit Anhängen gelöscht werden oder Nutzer gelöscht werden, werden Dateien im Dateisystem nicht systematisch bereinigt
- Files: `backend/routes/chat.js:1598-1639` (löscht Dateien beim Raum-Löschen), kein allgemeiner Cleanup-Cron
- Blocks: Langfristig wächst `backend/uploads/` unkontrolliert
- Priority: Mittel — kein sofortiges Problem, aber auf Produktionsserver relevant

### Keine Backup-Strategie dokumentiert

- Problem: Kein automatisiertes DB-Backup oder Upload-Backup im Portainer-Stack sichtbar
- Files: `portainer-stack.yml` (kein Backup-Service)
- Blocks: Wiederherstellung nach Datenverlust
- Priority: Hoch für Produktion

---

## Abhängigkeiten mit Risiko

### React Router v5 bei React 19

- Risk: React Router v5 (`^5.3.4`) ist nicht offiziell für React 19 getestet. React Router v6+ ist der aktuelle Stand.
- Files: `frontend/package.json`
- Impact: Potenzielle Inkompatibilitäten bei React-Updates; fehlende moderne Router-Features (Loader, Actions)
- Migration plan: Upgrade auf React Router v6 + `@ionic/react-router` v6-Kompatibilität prüfen

### Express v4 (nicht v5)

- Risk: Express 5 (stable seit 2024) bringt besseres async Error-Handling. Mit Express 4 müssen unbehandelte async-Errors manuell gefangen werden.
- Files: `backend/package.json` (`"express": "^4.18.2"`)
- Impact: Unbehandelte Promise-Rejections in Route-Handlern werden nicht automatisch als 500-Fehler weitergegeben
- Migration plan: Upgrade auf Express 5 ist schrittweise möglich, da v5 weitgehend kompatibel ist

### `@rdlabo/ionic-theme-ios26` (Drittanbieter-Theme)

- Risk: Nicht-offizielles Community-Package ohne Ionic-Support-Garantie
- Files: `frontend/package.json`
- Known issue: `registerTabBarEffect` funktioniert bei 6 Tabs nicht vollständig (aus MEMORY.md)
- Migration plan: Langfristig auf offizielle Ionic-Theming-APIs wechseln wenn verfügbar

---

*Concerns-Audit: 2026-03-24*
