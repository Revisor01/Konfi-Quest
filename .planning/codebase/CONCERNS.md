# Codebase Concerns

**Analysis Date:** 2026-03-22

---

## Tech Debt

### N+1 Query in Chat-Nachrichten-Endpunkt
- Issue: Für jede der bis zu 200 geladenen Nachrichten wird eine separate SQL-Query für Reactions ausgeführt (und ggf. eine weitere für Poll-Votes). Bei 200 Nachrichten = bis zu 400 zusätzliche Queries pro Request.
- Files: `backend/routes/chat.js` (Zeilen 599–630)
- Impact: Deutliche Verlangsamung bei aktiven Chat-Räumen; skaliert schlecht mit wachsender Nutzerzahl.
- Fix approach: Reactions und Poll-Votes in einer einzigen JOIN-Query oder zwei Bulk-Queries laden (IN (array of message_ids)), dann im Applikationscode zuordnen.

### Legacy-Multer-Upload (`upload`) noch im Einsatz
- Issue: In `backend/server.js` wird ein nicht typisierter Legacy-Multer (`const upload = multer({ dest: uploadsDir })`) als "deprecated" kommentiert, aber noch als Parameter an `konfiRoutes` und `activitiesRouter` übergeben.
- Files: `backend/server.js` (Zeilen 334–344, 446, 457), `backend/routes/konfi.js`, `backend/routes/activities.js`
- Impact: Dateien landen unkontrolliert in `uploads/` ohne Hash-Namensgebung; mögliche Namenskollisionen.
- Fix approach: Alle Stellen auf `requestUpload` oder `materialUpload` migrieren; Legacy-Config entfernen.

### `sqlite3` als Produktions-Dependency
- Issue: `sqlite3` ist in `backend/package.json` als normale Dependency enthalten, obwohl die SQLite-Datenbank vollständig auf PostgreSQL migriert wurde. Der aktive Code verwendet SQLite nicht mehr.
- Files: `backend/package.json` (Zeile 35)
- Impact: Unnötige Build-Zeit, potenzielle Sicherheitslücken in einer unbenutzten Abhängigkeit, vergrößertes Docker-Image.
- Fix approach: `sqlite3` aus `dependencies` entfernen. SQLite-DB-Dateien (`backend/data/konfi-points.db`, `backend/data/konfi.db`) ebenfalls löschen oder in `.gitignore` aufnehmen.

### Veraltete SQLite-DB-Dateien im Repository
- Issue: `backend/data/konfi-points.db` und `backend/data/konfi.db` existieren noch im `backend/data/`-Verzeichnis.
- Files: `backend/data/`
- Impact: Möglicher Datenleck älterer Produktionsdaten; unnötiger Speicher in Git-History.
- Fix approach: Dateien aus Repository entfernen, `.gitignore` für `backend/data/*.db` ergänzen.

### Typo im Dateinamen einer zentralen Route
- Issue: Die Route für Konfi-Verwaltung heißt `konfi-managment.js` (fehlendes 'e' in management). Alle Imports referenzieren diesen Tippfehler.
- Files: `backend/routes/konfi-managment.js`, `backend/server.js` (Zeile 415)
- Impact: Irreführend für alle neuen Entwickler:innen; erschwert Suche nach der Datei.
- Fix approach: Datei in `konfi-management.js` umbenennen und alle Imports anpassen.

### Hardcodierte API-URLs im Frontend ohne Env-Variable
- Issue: Die Backend-URL und WebSocket-URL sind direkt als String-Konstanten hardcodiert. Der Kommentar in `websocket.ts` erklärt, dass `VITE_API_URL` in nativen Capacitor-Apps nicht funktioniert, aber eine Lösung fehlt.
- Files: `frontend/src/services/api.ts` (Zeile 6), `frontend/src/services/websocket.ts` (Zeile 6)
- Impact: Jeder Umgebungswechsel (Staging, Dev) erfordert manuelle Code-Änderung; kein lokales Entwickeln gegen anderen Server möglich.
- Fix approach: Capacitor-kompatible Konfiguration über `capacitor.config.ts`-Server-URL oder Build-Time-Konstanten in `vite.config.ts`.

### Hardcodierter Losung-API-Key im Quellcode
- Issue: Der API-Schlüssel für die Losung-API (`ksadh8324oijcff45rfdsvcvhoids44`) ist direkt im Quellcode in zwei Route-Dateien als String-Literal hardcodiert.
- Files: `backend/routes/teamer.js` (Zeile 741), `backend/routes/konfi.js` (Zeile 1439)
- Impact: API-Key ist in Git-History sichtbar und nicht rotierbar ohne Code-Änderung.
- Fix approach: In Umgebungsvariable `LOSUNG_API_KEY` auslagern.

### Deprecated Chat-Komponente nicht entfernt
- Issue: `frontend/src/components/chat/modals/FileViewerModal.tsx` ist mit `// DEPRECATED: Ersetzt durch shared/FileViewerModal.tsx` markiert, existiert aber noch und exportiert eine Default-Komponente.
- Files: `frontend/src/components/chat/modals/FileViewerModal.tsx`
- Impact: Verwirrung über welche Komponente genutzt werden soll; toter Code erhöht Bundle-Größe marginal.
- Fix approach: Datei löschen, da kein aktiver Import gefunden wurde.

### `activity_requests.konfi_id` vs. RBAC-Namenskonvention
- Issue: Die Tabelle `activity_requests` verwendet noch `konfi_id` als Fremdschlüssel statt `user_id`, während alle anderen migrierten Tabellen (`user_activities`, `user_badges`) bereits auf `user_id` umgestellt wurden.
- Files: `backend/routes/konfi.js` (Zeile 638), `backend/routes/konfi-managment.js` (Zeile 365), `backend/routes/activities.js` (mehrere)
- Impact: Inkonsistenz im Schema; erschwertes Queryjoin-Pattern bei zukünftigen Erweiterungen.
- Fix approach: Migration schreiben: `ALTER TABLE activity_requests RENAME COLUMN konfi_id TO user_id`.

### Inline-Migrationen in Routes beim Server-Start
- Issue: `backend/routes/badges.js` führt bei jedem Server-Start Schema-Checks und ALTERs durch (konfi_badges → user_badges etc.). `backend/routes/jahrgaenge.js` und `backend/routes/wrapped.js` tun dasselbe. Dies sind idempotente Schema-Migrationen, die in Route-Dateien eingebettet sind.
- Files: `backend/routes/badges.js` (Zeilen 631–710), `backend/routes/jahrgaenge.js`, `backend/routes/wrapped.js` (Zeile 15–30)
- Impact: Erhöhte Server-Startzeit; unklar ob Migrationen vollständig ausgeführt wurden; Vermischung von Initialisierungs- und Request-Handler-Code.
- Fix approach: Einmal-Migrationen in `backend/migrations/` SQL-Dateien auslagern; in `backend/database.js` beim Start einmalig ausführen.

### Unvollständige Input-Validierung auf mehreren Route-Dateien
- Issue: `backend/routes/material.js` und `backend/routes/teamer.js` haben keine `express-validator`-Imports. `material.js` greift direkt auf `req.body.name`, `req.body.title`, `req.body.tag_ids` zu ohne Validierung.
- Files: `backend/routes/material.js`, `backend/routes/teamer.js`
- Impact: Potenzielle unerwartete Typen / leere Strings in der Datenbank; fehlende Fehlermeldungen für Client.
- Fix approach: `express-validator` body-Validierungen analog zu `categories.js` ergänzen.

### `crypto` wird vor `require` verwendet
- Issue: In `backend/server.js` wird `crypto` auf Zeile 265 und 300 in Multer-Storage-Callbacks verwendet, aber erst auf Zeile 347 `require`'d. Node.js hoisted das `require` nicht; die frühen Aufrufe landen aber nicht direkt beim Start, da sie nur in Callbacks ausgeführt werden – trotzdem ist die Reihenfolge irreführend und fehlerträchtig.
- Files: `backend/server.js` (Zeilen 265, 300, 347)
- Impact: Potentieller Laufzeitfehler wenn Callback vor Zeile 347 ausgeführt wird; schwer zu debuggendes Problem.
- Fix approach: `const crypto = require('crypto')` an den Anfang der Datei verschieben.

### `secure: process.env.SMTP_SECURE === 'true' || true` – Bug
- Issue: Der SMTP-`secure`-Wert ist immer `true`, da `|| true` den gesamten Ausdruck auf `true` fixiert, unabhängig vom Env-Wert. Die env-Variable hat damit keinen Effekt.
- Files: `backend/server.js` (Zeile 124)
- Impact: Kann nicht auf Nicht-TLS-SMTP-Ports umgestellt werden ohne Code-Änderung.
- Fix approach: `secure: process.env.SMTP_SECURE !== 'false'` (wie in `emailService.js` korrekt implementiert).

---

## Security Considerations

### TLS-Zertifikatsvalidierung deaktiviert für SMTP
- Risk: SMTP-Verbindungen akzeptieren ungültige oder selbst-signierte Zertifikate.
- Files: `backend/server.js` (Zeile 132), `backend/services/emailService.js` (Zeile 39)
- Current mitigation: Interne Server-zu-Server-Verbindung im Docker-Netzwerk.
- Recommendations: Entweder Zertifikat auf den Docker-internen Hostname ausstellen oder intern ohne TLS kommunizieren und nur nach außen TLS erzwingen. Alternat: `ca`-Option mit dem tatsächlichen Zertifikat statt `rejectUnauthorized: false`.

### Hardcodierter Fallback-SMTP-Host und -Username
- Risk: Produktions-IP `213.109.162.132` und E-Mail-Adresse `noreply@konfi-quest.de` sind als Fallback-Werte hardcodiert.
- Files: `backend/server.js` (Zeilen 122, 126), `backend/services/emailService.js` (Zeilen 31, 57)
- Current mitigation: Env-Variablen haben Vorrang wenn gesetzt.
- Recommendations: Keinen Produktions-Fallback in Code – Pflichtfelder ohne Default erzwingen (analog zu `JWT_SECRET`).

### Rate-Limiter nutzt In-Memory-Store
- Risk: Alle Rate-Limiter (`authLimiter`, `registerLimiter` etc.) nutzen den Standard In-Memory-Store von `express-rate-limit`. Bei Container-Neustart oder horizontaler Skalierung werden Limits zurückgesetzt.
- Files: `backend/server.js` (Zeilen 150–211)
- Current mitigation: Single-Instance-Deployment hinter Traefik.
- Recommendations: Bei Skalierung auf Redis-Store (`rate-limit-redis`) umstellen. Aktuell kein Problem bei Single-Instance.

### `global.io` als globale Variable
- Risk: Die Socket.IO-Instanz wird als `global.io` gesetzt und aus Route-Dateien direkt verwendet. Dieses Muster macht implizite Abhängigkeiten und ist schwer testbar.
- Files: `backend/server.js` (Zeile 109), `backend/routes/users.js` (Zeile 260), `backend/routes/chat.js` (Zeilen 727–742)
- Current mitigation: Kein unmittelbares Sicherheitsrisiko.
- Recommendations: `io` als Parameter an Routes übergeben (wie `db`).

---

## Performance Bottlenecks

### N+1 Queries bei Chat-Nachrichten-Reaktionen
- Problem: Pro geladener Nachricht wird eine separate DB-Query für Reactions ausgeführt; bei Polls zusätzlich eine für Votes. Max. 400+ Queries pro `/rooms/:id/messages`-Aufruf.
- Files: `backend/routes/chat.js` (Zeilen 599–630)
- Cause: `Promise.all(messages.map(async (msg) => db.query(...)))` innerhalb des Nachrichten-Loaders.
- Improvement path: Bulk-Query mit `WHERE message_id = ANY($1::int[])`, dann im JS-Code den Nachrichten zuordnen.

### Wrapped-Snapshot-Generierung ist sequenziell pro Nutzer
- Problem: Beim manuellen Generieren von Konfi- oder Teamer-Wrappeds werden Snapshots in einer `for...of`-Schleife mit `await` sequenziell generiert. Bei 30+ Konfis dauert das entsprechend lange.
- Files: `backend/routes/wrapped.js` (Zeilen 429–445, 506–521)
- Cause: Bewusste Entscheidung zur Fehlertoleranz (einzelne Fehler werden geloggt, nicht abgebrochen), aber keine Parallelisierung.
- Improvement path: `Promise.allSettled` mit einem Concurrency-Limit (z.B. 5 gleichzeitig) statt vollständig sequenziell.

### Admin-Views ohne Offline-/SWR-Caching
- Problem: Viele Admin-Komponenten und Modals führen API-Calls direkt über `api.get/post` ohne `useOfflineQuery` durch. Jedes Öffnen eines Modals triggert einen neuen Netzwerk-Request ohne Cache.
- Files: `frontend/src/components/admin/KonfisView.tsx`, `frontend/src/components/admin/BadgesView.tsx`, `frontend/src/components/admin/EventsView.tsx`, `frontend/src/components/admin/modals/ActivityManagementModal.tsx`, `frontend/src/components/admin/modals/UserManagementModal.tsx` (und ~18 weitere Admin-Dateien)
- Cause: `useOfflineQuery` wurde primär für Konfi/Teamer-Views implementiert; Admin-Views wurden nicht nachgezogen.
- Improvement path: Admin-Views schrittweise auf `useOfflineQuery` migrieren.

---

## Fragile Areas

### Großdateien mit mehreren Verantwortlichkeiten
- Files:
  - `backend/routes/events.js` (2067 Zeilen) – Eventmanagement, Buchungslogik, QR-Check-in, Timeslots, Badge-Vergabe
  - `backend/routes/chat.js` (1847 Zeilen) – Chat-Rooms, Nachrichten, Datei-Upload, Polls, Reaktionen, Teilnehmer
  - `backend/routes/konfi-managment.js` (1008 Zeilen) – Konfi-Verwaltung, Punkte, Aktivitäten, Import/Export
  - `frontend/src/components/admin/views/KonfiDetailSections.tsx` (1181 Zeilen)
  - `frontend/src/components/admin/modals/BadgeManagementModal.tsx` (1124 Zeilen)
  - `frontend/src/components/chat/ChatRoom.tsx` (1058 Zeilen)
- Why fragile: Änderungen in einem Bereich können unbemerkt andere Bereiche brechen; hoher Cognitive Load; schwer zu testen.
- Safe modification: Immer vollständige Datei lesen; nach Änderungen alle betroffenen Features manuell testen.
- Test coverage: Keine automatisierten Tests vorhanden.

### Wrapped-Cron läuft über `setInterval` ohne echten Cron-Scheduler
- Files: `backend/services/backgroundService.js` (Zeile 418)
- Why fragile: `setInterval(24h)` driftet über Zeit; bei Container-Neustart nach dem 1. eines Monats kann der Trigger verpasst werden, da der nächste Check erst 24h nach Start kommt.
- Safe modification: Immer manuellen Trigger-Button testen nach Deployment-Änderungen.
- Improvement path: `node-cron` oder ähnliches einsetzen, das nach einem Restart die nächste geplante Ausführung korrekt berechnet.

### Socket.IO-Authentifizierung überprüft keine Organization-Isolation
- Files: `backend/server.js` (Zeilen 53–68, 71–106)
- Why fragile: Socket.IO-JWT-Auth prüft nur ob der Token gültig ist, nicht ob der User zu einer aktiven Organisation gehört. Ein Nutzer aus Org A könnte theoretisch einem Room von Org B beitreten, wenn er die `roomId` kennt (`socket.on('joinRoom', roomId)` ohne Validierung).
- Safe modification: Vor `socket.join(room_${roomId})` die Organization-Zugehörigkeit des Rooms prüfen.

### Übermäßige `window as any`-Zugriffe für Capacitor-Plugins
- Files: `frontend/src/contexts/AppContext.tsx` (Zeilen 23, 25, 54, 145, 173, 248, 250, 260–261)
- Why fragile: Capacitor-Plugins werden über `(window as any).Capacitor?.Plugins?.FCM` angesprochen statt über typsichere Imports. Bei Capacitor-Updates bricht der Code stumm (kein TypeScript-Fehler).
- Safe modification: Vor Capacitor-Version-Upgrades alle `window as any`-Zugriffe testen.
- Fix approach: Korrekten Capacitor-Plugin-Import nutzen: `import { FCM } from '@capacitor-community/fcm'`.

### React Router v5 mit React 19
- Files: `frontend/src/App.tsx`, `frontend/src/components/konfi/views/DashboardView.tsx`, `frontend/src/components/konfi/pages/KonfiEventsPage.tsx`, `frontend/src/components/konfi/pages/KonfiEventDetailPage.tsx`
- Why fragile: Die App verwendet React Router v5 (`useHistory`, `<Route component=...>`) mit React 19. React Router v5 ist offiziell nicht mit React 19 kompatibel; manche Features können unerwartet brechen.
- Safe modification: Keine React-Router-Patterns aus v6/v7 einführen, da die App explizit v5 verwendet.
- Improvement path: Migration auf React Router v6 + Ionic-kompatibles Routing-Pattern.

---

## Test Coverage Gaps

### Backend: Kein einziger Test vorhanden
- What's not tested: Alle 18 Route-Dateien, Auth-Logik, Punkte-Berechnung, Badge-Vergabe, Wrapped-Generierung, Event-Buchungslogik.
- Files: `backend/routes/` (alle), `backend/services/` (alle), `backend/middleware/` (alle)
- Risk: Refactorings und Datenbankmigrationen können unbemerkt Produktions-Fehler einführen.
- Priority: High

### Frontend: Praktisch keine Tests
- What's not tested: Fast alle Komponenten, Hooks, Contexts, Services. Einziger vorhandener Test ist ein trivialer Smoke-Test.
- Files: `frontend/src/App.test.tsx` (Zeile 5–8 – einziger Test)
- Risk: Regressions in Kernfunktionen (Punkte-Anzeige, Badge-Vergabe, Chat, Events) werden nicht automatisch erkannt.
- Priority: High

### Kritische Business-Logik ohne Tests
- What's not tested: Punkte-Berechnung (gottesdienst vs. gemeinde), Badge-Vergabe-Trigger, Wrapped-Snapshot-Generierung, Invite-Code-Flow, Token-Refresh-Rotation.
- Files: `backend/routes/activities.js`, `backend/routes/badges.js`, `backend/routes/wrapped.js`, `backend/routes/auth.js` (Zeilen 760–800)
- Risk: Logikfehler bei Punkte-Vergabe könnten zu falschen Konfi-Abschlüssen führen.
- Priority: High

---

## Scaling Limits

### File-Upload-Storage ist lokales Dateisystem
- Current capacity: Lokaler Docker-Volume auf dem Server.
- Limit: Kein automatisches CDN oder Backup; bei Server-Migration müssen alle Uploads manuell migriert werden; bei hohem Upload-Volumen (Videos, PDFs) wächst der Docker-Volume unbegrenzt.
- Files: `backend/server.js` (Zeilen 244–253), `backend/routes/chat.js`, `backend/routes/material.js`, `backend/routes/konfi.js`
- Scaling path: S3-kompatibles Object Storage (z.B. Hetzner Object Storage oder MinIO).

---

## Dependencies at Risk

### `react-router-dom` v5 mit React 19
- Risk: React Router v5 unterstützt React 19 offiziell nicht. Die Abhängigkeit ist eingefroren (`^5.3.4`).
- Files: `frontend/package.json`, `frontend/src/App.tsx`
- Impact: Potenzielle Breaking Changes bei React-Minor-Updates; keine Bugfixes mehr für v5.
- Migration plan: Migration auf React Router v6 (erfordert Umbau aller `useHistory` → `useNavigate` und `<Route component>` → `<Route element>` Patterns).

### `@rdlabo/ionic-theme-ios26` mit bekanntem Problem
- Risk: `registerTabBarEffect` funktioniert nur teilweise bei 6 Tabs (bekannt aus MEMORY.md).
- Files: `frontend/src/App.tsx` (Zeile 29), `frontend/package.json`
- Impact: Tab-Bar-Effekt auf iOS26 ist visuell unvollständig.
- Migration plan: Bug im Package beobachten; ggf. auf native Ionic-iOS26-Unterstützung warten.

---

*Concerns-Audit: 2026-03-22*
