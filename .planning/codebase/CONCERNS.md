# Codebase Concerns

**Analysis Date:** 2026-03-23

---

## Tech Debt

**Massiv überdimensionierte Route-Dateien:**
- Issue: Drei Backend-Routen überschreiten 2000 Zeilen — `backend/routes/konfi.js` (2081 Z.), `backend/routes/events.js` (2067 Z.), `backend/routes/chat.js` (1875 Z.). Business-Logik, DB-Queries und HTTP-Handler sind nicht getrennt.
- Files: `backend/routes/konfi.js`, `backend/routes/events.js`, `backend/routes/chat.js`
- Impact: Änderungen an einem Endpunkt erfordern das Durchsuchen von 2000+ Zeilen. Merge-Konflikte bei paralleler Arbeit. Kein Wiederverwenden von Logik möglich.
- Fix approach: Extrahieren von Datenbankzugriffen in `backend/services/` Module (z.B. `konfiService.js`, `eventService.js`). HTTP-Handler auf <50 Zeilen reduzieren.

**Gleiches im Frontend: überdimensionierte Komponenten:**
- Issue: Mehrere Komponenten überschreiten 900 Zeilen. `KonfiDetailSections.tsx` (1181 Z.), `BadgeManagementModal.tsx` (1124 Z.), `ChatRoom.tsx` (1058 Z.), `TeamerEventsPage.tsx` (921 Z.).
- Files: `frontend/src/components/admin/views/KonfiDetailSections.tsx`, `frontend/src/components/admin/modals/BadgeManagementModal.tsx`, `frontend/src/components/chat/ChatRoom.tsx`, `frontend/src/components/teamer/pages/TeamerEventsPage.tsx`
- Impact: Schwer zu testen, schwer zu lesen. Kleines UI-Bugfix erfordert Navigation durch 1000+ Zeilen.
- Fix approach: Aufteilen in kleinere Subkomponenten analog zu `EventDetailSections.tsx`-Pattern.

**Hartkodierter API-Key als Fallback:**
- Issue: In `backend/routes/konfi.js:1439` und `backend/routes/teamer.js:766` steht ein hartkodierter API-Key als Fallback-Wert für `LOSUNG_API_KEY`. Kommentar sagt "TODO: Fallback nach Deployment entfernen", ist aber noch drin.
- Files: `backend/routes/konfi.js` (Zeile 1439), `backend/routes/teamer.js` (Zeile 766)
- Impact: API-Key im Source-Code ist ein Security-Risiko. Wenn der Key jemals rotiert wird, muss der Code geändert werden.
- Fix approach: Fallback entfernen. Wenn `LOSUNG_API_KEY` fehlt, Request mit klarem Fehler abweisen statt mit altem Key senden.

**`global.io` als Socket.io Kommunikationskanal:**
- Issue: Der Socket.io-Server wird in `backend/server.js:139` als `global.io` exportiert. Routen in `chat.js`, `users.js` greifen direkt auf `global.io` zu statt ein sauber injiziertes Objekt zu verwenden.
- Files: `backend/server.js` (Zeile 139), `backend/routes/chat.js` (Zeilen 755-770), `backend/routes/users.js` (Zeilen 260-267)
- Impact: Implizite globale Abhängigkeit. Testbarkeit nicht gegeben. Ändert man die Socket-Initialisierung, brechen Routen ohne Typ-Fehler.
- Fix approach: `io` als Parameter in Route-Module injizieren (gleich wie `db`), `global.io` entfernen.

**Legacy Single-ID Felder in material.js:**
- Issue: `backend/routes/material.js` unterstützt sowohl altes `event_id`/`jahrgang_id` als auch neues `event_ids`/`jahrgang_ids` Array-Format in POST und PUT (Zeilen 349-369, 429-464).
- Files: `backend/routes/material.js`
- Impact: Zwei Codepfade für dieselbe Operation. Frontend wurde bereits auf Array-Format migriert, Legacy-Pfad kann entfernt werden.
- Fix approach: Überprüfen ob Frontend noch `event_id` (singular) sendet. Falls nicht: Legacy-Pfad entfernen.

**Kein DB-Connection-Pool-Limit konfiguriert:**
- Issue: `backend/database.js` erstellt einen `pg.Pool` ohne explizites `max`-Setting (Standard pg: 10 Connections).
- Files: `backend/database.js`
- Impact: Bei steigender Last (4000+ User EKD-Skalierung) kann der Pool erschöpft werden, bevor das Limit greift. Kein Monitoring möglich.
- Fix approach: `max`, `idleTimeoutMillis` und `connectionTimeoutMillis` explizit setzen. Umgebungsvariable `PG_POOL_MAX` für Deployment-spezifische Konfiguration.

---

## Known Bugs / Unfertige Features

**Badge-Kriterien `streak` und `time_based` nicht implementiert:**
- Symptoms: Badges mit `criteria_type = 'streak'` oder `criteria_type = 'time_based'` zeigen immer `progress.current = 0`. Kein Fortschritt wird berechnet.
- Files: `backend/routes/konfi.js` (Zeilen 1055-1063)
- Trigger: Wenn ein Admin einen Badge mit `criteria_type = 'streak'` oder `'time_based'` erstellt und ein Konfi diesen sieht.
- Workaround: Keine solchen Badge-Typen erstellen.

---

## Security Considerations

**Content Security Policy deaktiviert:**
- Risk: `contentSecurityPolicy: false` in `backend/server.js:249`. Kein CSP-Header wird gesendet. XSS-Angriffe werden nicht durch Browser-Mechanismus abgemildert.
- Files: `backend/server.js` (Zeile 249)
- Current mitigation: Kommentar sagt "Ionic/React braucht inline Styles". `innerHTMLTemplatesEnabled: true` in `frontend/src/App.tsx:81` erweitert die Angriffsfläche.
- Recommendations: Schrittweise CSP mit `'unsafe-inline'`-Ausnahmen für Ionic einführen. `innerHTMLTemplatesEnabled` prüfen ob wirklich benötigt.

**TLS-Zertifikat-Validierung deaktiviert (SMTP):**
- Risk: `rejectUnauthorized: false` in `backend/server.js:156` und `backend/services/emailService.js:39`. SMTP-Verbindungen akzeptieren ungültige oder selbstsignierte Zertifikate.
- Files: `backend/server.js` (Zeile 156), `backend/services/emailService.js` (Zeile 39)
- Current mitigation: Kommentar erklärt Docker-zu-IP-Problem. Verbindung geht intern auf `213.109.162.132`.
- Recommendations: Eigenes SMTP-Zertifikat auf IP ausstellen oder Hostname statt IP verwenden, damit `rejectUnauthorized: true` gesetzt werden kann.

**Logout revokiert kein Refresh Token:**
- Risk: `frontend/src/services/auth.ts:logout()` löscht nur den Push-Token des Geräts. Das Refresh Token (90 Tage gültig) wird nicht auf dem Server invalidiert. Wer das Refresh Token abgegriffen hat, kann 90 Tage lang neue Access Tokens holen.
- Files: `frontend/src/services/auth.ts` (Zeilen 43-130), `backend/routes/auth.js`
- Current mitigation: Token-Rotation beim Refresh: altes Token wird sofort revokiert. Rotation schützt aber nur wenn das Token einmal verwendet wurde.
- Recommendations: Backend-Endpunkt `/auth/logout` implementieren der das aktive Refresh Token des Users per `revoked_at = NOW()` invalidiert. Frontend-Logout soll diesen Endpunkt aufrufen.

**Minimale Passwortrichtlinie (6 Zeichen):**
- Risk: Passwörter müssen nur 6 Zeichen lang sein. Keine Komplexitätsanforderungen (Zahlen, Sonderzeichen). Bei EKD-Betrieb mit 4000+ Usern ist das schwach.
- Files: `backend/routes/auth.js` (Zeile 57, 86, 701), `backend/middleware/validation.js` (Zeile 59)
- Current mitigation: bcrypt mit 10 Runden. Rate Limiter auf Auth-Endpoint (10 Versuche / 15 Min).
- Recommendations: Minimum auf 8 Zeichen erhöhen. Optional: Zeichen-Klassen-Anforderung hinzufügen.

**Chat-Nachrichten ohne Längenbegrenzung:**
- Risk: `validateSendMessage` in `backend/routes/chat.js:22-27` validiert `content` nur als `optional().trim()` ohne `isLength`-Limit. Kein Max-Length.
- Files: `backend/routes/chat.js` (Zeilen 22-27)
- Current mitigation: `chatMessageLimiter` (Rate Limiting auf Endpunkt). DB-Feld hat kein `VARCHAR`-Limit (vermutlich `TEXT`).
- Recommendations: `isLength({ max: 4000 })` zur Validierung hinzufügen. Schützt vor Speicher-Erschöpfung und absichtlich langen Nachrichten.

---

## Performance Bottlenecks

**N+1-Problem: Chat-Räume / Direct-Message-Namen:**
- Problem: Beim Laden der Chat-Übersicht (`GET /chat/rooms`) wird für jeden Direct-Chat-Raum eine separate DB-Query ausgeführt, um den Namen des anderen Teilnehmers zu holen.
- Files: `backend/routes/chat.js` (Zeilen 426-441)
- Cause: `Promise.all(rooms.map(async (room) => ...db.query(...)))` — ein Query pro Direct-Room.
- Improvement path: Sub-Query oder JOIN in der Haupt-Room-Query, die für Direct-Chats den anderen Participant-Namen direkt mitlädt.

**N+1-Problem: Wrapped-Snapshot-Generierung:**
- Problem: Beim Generieren von Wrapped-Snapshots (manuell und per Cron) werden pro Konfi 8-10 einzelne DB-Queries in `generateKonfiSnapshot()` ausgeführt: Profil, Bonus, Events, Gottesdienst-Count, Kategorie-Verteilung, Events gesamt, Lieblings-Event, Badges, Badge-Total, Chat-Nachrichten, aktivster Monat.
- Files: `backend/routes/wrapped.js` (Zeilen 22-233, 406-422, 639-654), `backend/services/backgroundService.js` (Zeilen 419-428)
- Cause: Sequentielle `await client.query()` calls in einer `for...of`-Schleife über alle Konfis.
- Improvement path: Queries parallel mit `Promise.all()` pro Konfi ausführen. Langfristig: Bulk-Queries die alle Konfis eines Jahrgangs in einer Abfrage berechnen (z.B. `GROUP BY user_id`).

**Korrelierte Subquery in Chat-Übersicht:**
- Problem: `ORDER BY (SELECT created_at FROM chat_messages WHERE room_id = r.id ...)` in `backend/routes/chat.js:419` ist eine korrelierte Subquery — wird für jede Zeile des Resultsets ausgeführt.
- Files: `backend/routes/chat.js` (Zeile 419)
- Cause: Kein Materialized CTE oder Lateral Join wird verwendet.
- Improvement path: In `LATERAL` Sub-Query oder CTE umschreiben, oder eine `last_message_at`-Spalte in `chat_rooms` pflegen und bei neuen Nachrichten updaten.

---

## Fragile Areas

**useOfflineQuery: `revalidate` bewusst aus Dependencies ausgelassen:**
- Files: `frontend/src/hooks/useOfflineQuery.ts` (Zeile 135)
- Why fragile: `revalidate` fehlt in `useEffect`-Dependencies mit Kommentar "wuerde Loop verursachen". Das ist ein symptomatischer Fix für ein Architekturproblem — `revalidate` schließt `data` per Closure ein, was Stale-Closure-Bugs verursachen kann.
- Safe modification: `data`-Parameter aus `revalidate`-Closure entfernen. `setData` verwenden um Stale-Closure zu vermeiden. Dann kann `revalidate` sicher in Dependencies aufgenommen werden.
- Test coverage: Kein Testfile für `useOfflineQuery.ts`.

**Migrations-System ohne Versionstabelle:**
- Files: `backend/database.js`, `backend/migrations/`
- Why fragile: Alle SQL-Dateien werden bei jedem Server-Start ausgeführt. Die meisten sind idempotent (IF NOT EXISTS), aber `077_activity_requests_rename_konfi_id.sql` und Teile anderer Migrations sind es nur durch `DO $$` Blöcke. Kein Tracking welche Migrations bereits gelaufen sind (kein `schema_migrations`-Tabelle).
- Safe modification: Keine neue Migration schreiben ohne `IF NOT EXISTS`-Schutz oder `DO $$`-Block. Migration-Namen nie umbenennen.
- Test coverage: Keine.

**Socket.io Typing-Indicator ohne Org-Isolation:**
- Files: `backend/server.js` (Zeilen 115-129)
- Why fragile: `socket.on('typing', (roomId) => ...)` leitet den Typing-Event ohne zu prüfen ob der sendende User zum Room gehört. `joinRoom` prüft Org-Isolation, aber `typing` und `stopTyping` tun das nicht.
- Safe modification: Vor dem Weiterleiten des Typing-Events Org-Check durchführen (analog zu `joinRoom`-Handler).
- Test coverage: Keine.

**Wrapped-Cron: Doppelter Date-Guard:**
- Files: `backend/services/backgroundService.js` (Zeile 450), `backend/routes/wrapped.js` (Zeilen 639-741)
- Why fragile: Der Cron-Job ist auf `0 6 1 * *` (1. des Monats) eingestellt UND enthält in `checkWrappedTriggers()` einen manuellen `if (today.getDate() !== 1)` Guard. Der Guard ist redundant und verschleiert die eigentliche Bedingung.
- Safe modification: Guard entfernen, da cron-schedule bereits sicherstellt wann ausgeführt wird. Oder cron-schedule entfernen und nur auf den Guard verlassen.

---

## Scaling Limits

**Kein Database Connection Pool Limit:**
- Current capacity: pg-Default-Pool-Größe 10 Connections.
- Limit: Bei vielen gleichzeitigen Requests (Wrapped-Generierung für großen Jahrgang, viele Cron-Jobs gleichzeitig) kann der Pool erschöpft sein und Requests warten.
- Scaling path: `max: parseInt(process.env.PG_POOL_MAX || '20')` in `backend/database.js` konfigurieren. Bei EKD-Skalierung auf 4000+ User separaten Read-Replica Datenbankserver in Betracht ziehen.

**Wrapped-Generierung blockiert DB-Connection für gesamten Jahrgang:**
- Current capacity: Sequentielle Verarbeitung eines Jahrgangs in einer DB-Transaktion. Für ~30 Konfis ca. 30 × 10 Queries = 300 DB-Calls in einer Transaktion.
- Limit: Bei Jahrgängen mit 50+ Konfis dauert die Transaktion länger als HTTP-Timeout (Apache Default 300s). Bei gleichzeitiger Ausführung für mehrere Orgs (EKD): Contention.
- Scaling path: Generierung asynchron über Job-Queue (z.B. Bull/BullMQ). HTTP-Response sofort senden, Fortschritt über SSE oder Polling melden.

---

## Dependencies at Risk

**Backend komplett in JavaScript (kein TypeScript):**
- Risk: Alle `backend/routes/*.js`-Dateien sind reines JavaScript ohne Type-Checking. Refactorings wie Umbenennen von Datenbankfeldern (`konfi_id` → `user_id` in Migration 077) erzeugen keine Kompilierfehler.
- Impact: Typ-Fehler werden erst zur Laufzeit entdeckt. Beispiel: Falscher Spaltenname in SQL-Template-Literal wird erst beim ersten Request-Aufruf sichtbar.
- Migration plan: Schrittweise auf TypeScript migrieren. Beginnen mit `backend/middleware/` und `backend/services/`. Routes zuletzt.

---

## Missing Critical Features

**Kein Backend-Logout-Endpunkt:**
- Problem: Es gibt keinen `POST /api/auth/logout`-Endpunkt der das aktive Refresh Token des Users revokiert.
- Blocks: Sicherer Logout (Refresh Token bleibt 90 Tage gültig nach Logout). Session-Invalidierung nach Passwortänderung.

**Kein Error-Monitoring / Alerting:**
- Problem: Alle Fehler werden nur per `console.error()` geloggt. Kein Sentry, kein strukturiertes Logging, kein Alerting.
- Blocks: Produktionsfehler können unentdeckt bleiben bis ein User sie meldet. Keine Fehler-Trends sichtbar.

---

## Test Coverage Gaps

**Kein Test für Backend-Logik:**
- What's not tested: Alle 15 Route-Dateien, alle Services (pushService, backgroundService, emailService), Datenbankmigrationen.
- Files: `backend/routes/` (alle), `backend/services/`
- Risk: Regressionsfehler in Punkte-Logik, Badge-Vergabe, Event-Buchungen werden erst durch manuelle Tests oder User-Berichte entdeckt.
- Priority: Hoch — besonders `backend/routes/activities.js` (Punkte-Vergabe), `backend/routes/badges.js` (Badge-Kriterien), `backend/routes/wrapped.js` (Snapshot-Logik).

**Frontend: Ein einziger Smoke-Test:**
- What's not tested: `frontend/src/App.test.tsx` prüft nur "renders without crashing". Keine Tests für Formulare, Validierung, Hooks, Context oder Business-Logik.
- Files: `frontend/src/App.test.tsx`
- Risk: Regressionsfehler in kritischen Flows (Login, Punkte-Antrag, Event-Buchung) nicht abgefangen.
- Priority: Mittel — zumindest `useOfflineQuery`, `AppContext`, `BadgeContext` sollten Unit-Tests haben.

---

*Concerns-Audit: 2026-03-23*
