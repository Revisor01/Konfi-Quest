# Codebase Concerns

**Analysis Date:** 2026-03-23

---

## Tech Debt

**Synchrone bcrypt-Aufrufe blockieren den Event Loop:**
- Issue: `bcrypt.hashSync()` und `bcrypt.compareSync()` in mehreren Routen blockieren den Node.js Event Loop während des Hashing-Vorgangs. bcrypt ist absichtlich langsam; synchrone Varianten frieren den gesamten Server ein.
- Files: `backend/routes/konfi-management.js` (Zeilen 140, 392), `backend/routes/users.js` (Zeilen 169, 236)
- Impact: Während einem Passwort-Hash (typisch 100–300 ms) können keine anderen Requests verarbeitet werden. Bei gleichzeitigen Logins spürbare Verzögerungen.
- Fix approach: Alle `bcrypt.hashSync` / `bcrypt.compareSync` durch `await bcrypt.hash` / `await bcrypt.compare` ersetzen. Vorbild: `backend/routes/auth.js` (bereits korrekt async).

**Hardcoded Produktions-URLs ohne Umgebungsvariable:**
- Issue: API-Basis-URL, WebSocket-URL und Invite-URLs sind direkt im Code hardcodiert. Kein lokales Entwickeln mit anderem Backend möglich, ohne Quellcode zu ändern.
- Files:
  - `frontend/src/services/api.ts` (Zeile 6): `const API_BASE_URL = 'https://konfi-quest.de/api'`
  - `frontend/src/services/websocket.ts` (Zeile 6): `const WS_URL = 'https://konfi-quest.de'`
  - `frontend/src/components/admin/pages/AdminInvitePage.tsx` (Zeilen 114, 145, 208, 232, 244)
  - `backend/routes/auth.js` (Zeile 314): Reset-URL hardcodiert
  - `backend/services/emailService.js` (Zeile 127, 191): Logo-URL hardcodiert
- Impact: Keine Staging-Umgebung möglich. Lokale Entwicklung gegen Produktion läuft.
- Fix approach: `VITE_API_URL` als Vite-Env-Variable einführen, in nativen Apps über Capacitor-Config oder Build-Skript injizieren. Kommentar in `websocket.ts` Zeile 5 erläutert warum `VITE_API_URL` dort nicht funktioniert — alternativer Ansatz nötig (z.B. Capacitor Preferences beim App-Start).

**Migrations-Namenskonvention inkonsistent:**
- Issue: Drei Migrationen ohne numerisches Präfix (`add_idempotency_keys.sql`, `add_invite_codes.sql`, `add_push_foundation.sql`). Das Migrations-System sortiert per `.sort()` alphabetisch. Diese Dateien sortieren hinter `077_...` ein, aber zukünftige Dateien mit höheren Nummern würden vor ihnen laufen.
- Files: `backend/migrations/add_idempotency_keys.sql`, `backend/migrations/add_invite_codes.sql`, `backend/migrations/add_push_foundation.sql`, `backend/database.js` (Zeile 30)
- Impact: Eine neue Migration `078_something.sql` würde nach `077_...` aber vor `add_*` laufen, obwohl `add_*` bereits in der DB liegt. Solange `add_*` bereits angewendet wurden, ist es aktuell sicher.
- Fix approach: Neue Migrationen immer mit numerischem Präfix anlegen. Bestehende `add_*`-Dateien umbenennen ist riskant wenn sie bereits in Produktion angewendet wurden.

**Veraltete SQLite-Skripte in package.json:**
- Issue: `start:sqlite` und `dev:sqlite` Skripte verweisen auf `backend/backup_sqlite/server.js`, das nicht existiert.
- Files: `backend/package.json` (Zeilen 8, 10)
- Impact: Verwirrend bei Onboarding, würde sofort mit einem Fehler scheitern.
- Fix approach: Skripte aus `package.json` entfernen.

**Globaler Module-Level Listener-Map in LiveUpdateContext:**
- Issue: `listeners` Map in `frontend/src/contexts/LiveUpdateContext.tsx` (Zeile 40) ist auf Modul-Ebene deklariert, nicht innerhalb des Providers. Sie wird bei Logout/Login nicht geleert. Alte Callback-Referenzen können akkumulieren wenn der Provider mehrfach gemountet wird.
- Files: `frontend/src/contexts/LiveUpdateContext.tsx`
- Impact: Potentiell alte Callbacks die nach Logout noch feuern. Speicherleck bei wiederholtem Mount/Unmount (selten in normaler App-Nutzung).
- Fix approach: `listeners` als `useRef` innerhalb des Providers oder als `Map` die beim Provider-Unmount geleert wird.

**SIGTERM-Handler fehlt:**
- Issue: Nur `SIGINT` wird behandelt, nicht `SIGTERM`. Docker sendet beim Container-Stop `SIGTERM`, nach 10 Sekunden `SIGKILL`. Ohne SIGTERM-Handler gibt es keinen Graceful Shutdown bei Docker-Deployments.
- Files: `backend/server.js` (Zeile 582)
- Impact: Laufende Requests werden abgebrochen. Datenbankverbindungen nicht sauber geschlossen.
- Fix approach: `process.on('SIGTERM', ...)` identisch zu `SIGINT` hinzufügen.

---

## Performance Bottlenecks

**N+1 Query-Pattern bei Badge-Progress-Berechnung:**
- Problem: In `GET /badges` werden alle Badges eines Konfis geladen, dann für jedes nicht-verdiente Badge 1–2 separate DB-Queries ausgeführt (je nach `criteria_type`). Bei 20 Badges = bis zu 40 Queries.
- Files: `backend/routes/konfi.js` (Zeilen 900–1072)
- Cause: `for (let badge of badges)` mit `await db.query()` innerhalb. Verschiedene Kriterien-Typen (`total_points`, `gottesdienst_points`, `gemeinde_points`, `activity_count`, `specific_activity`, `category_activities`, `activity_combination`, `unique_activities`) erfordern jeweils unterschiedliche Queries.
- Improvement path: Punkte-Daten (die sich für alle Badges eines Konfis nicht ändern) einmal vorab laden. Kriterien-unabhängige Daten (`konfi_profiles`, `user_activities` Aggregationen) in einem JOIN-Query sammeln statt einzeln.

**N+1 Notification-Insert beim Aktivitäts-Antrag:**
- Problem: Beim Einreichen eines Antrags wird für jeden Admin der Organisation eine separate `INSERT INTO notifications` Query ausgeführt.
- Files: `backend/routes/konfi.js` (Zeilen 681–699)
- Cause: `for (const admin of admins) { await db.query("INSERT INTO notifications ...") }`
- Improvement path: Bulk-Insert mit `INSERT INTO notifications ... SELECT ... FROM unnest($1::int[])` oder mit `VALUES ($1, ...), ($2, ...), ...` konstruiert per Array.

**Keine Paginierung für viele Endpoints:**
- Problem: Mehrere Listen-Endpoints in `backend/routes/konfi.js` liefern alle Datensätze ohne `LIMIT`/`OFFSET` zurück (z.B. Events-Liste, Activities-Liste, Requests-Liste).
- Files: `backend/routes/konfi.js` (Abschnitte mit `ORDER BY` ohne `LIMIT`)
- Cause: Bisher akzeptable Datenmenge pro Organisation. Bei EKD-Skalierung (4000+ User) problematisch.
- Improvement path: Cursor-basierte oder Offset-Paginierung einführen, Frontend entsprechend anpassen.

**Kein Code Splitting im Frontend:**
- Problem: Alle Routen und große Komponenten werden beim ersten App-Load vollständig gebündelt. Keine `React.lazy()`-Verwendung.
- Files: `frontend/src/components/layout/MainTabs.tsx` (alle Imports synchron)
- Cause: Bisher wurden keine Lazy-Loading-Optimierungen vorgenommen.
- Improvement path: Routen-Ebenen mit `React.lazy()` und `Suspense` wrappen, besonders für Admin- und Teamer-Bereiche.

---

## Security Considerations

**Content Security Policy deaktiviert:**
- Risk: Kein CSP bedeutet vollständige XSS-Ausnutzbarkeit falls XSS-Vektoren existieren.
- Files: `backend/server.js` (Zeilen 267, 270)
- Current mitigation: Kommentar erklärt: Ionic/React benötigt Inline-Styles/Scripts. Helmet-Header `xXssProtection` ist aktiv.
- Recommendations: Nonce-basierte CSP für Ionic evaluieren oder zumindest `default-src 'self'` mit eng gefassten Ausnahmen konfigurieren.

**MIME-Typ-Validierung nur über Client-Header:**
- Risk: `multer` prüft nur `file.mimetype`, das vom Client geliefert wird und manipulierbar ist. Magic-Byte-Validierung fehlt.
- Files: `backend/server.js` (Zeilen 316–335 für Chat-Upload, 360–375 für Material-Upload)
- Current mitigation: Dateinamen werden als SHA-256-Hash gespeichert (verhindert Ausführung), statische Dateiauslieferung ist deaktiviert, alle Files werden über Auth-geschützte Endpoints serviert.
- Recommendations: `file-type` npm-Paket zur Magic-Byte-Prüfung ergänzen. Besonders relevant für Video/Audio-Uploads die als Schadcode getarnt sein könnten.

**Hardcodierter Server-IP-Fallback in SMTP-Konfiguration:**
- Risk: Falls `SMTP_HOST` nicht gesetzt ist, wird die Produktions-IP `213.109.162.132` als SMTP-Host verwendet.
- Files: `backend/server.js` (Zeile 167), `backend/services/emailService.js` (Zeile 31)
- Current mitigation: In Produktion sind ENV-Variablen gesetzt.
- Recommendations: Fallback-IP entfernen, stattdessen mit `process.exit(1)` auf fehlende `SMTP_HOST`-Variable reagieren.

**QR-Code-Secret fällt auf JWT_SECRET zurück:**
- Risk: QR-Codes für Event-Check-In nutzen denselben Secret wie Auth-JWTs wenn `QR_SECRET` nicht gesetzt ist.
- Files: `backend/routes/events.js` (Zeile 10): `const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET`
- Current mitigation: QR-Codes haben kurze Gültigkeit.
- Recommendations: Eigenen `QR_SECRET` als Pflichtumgebungsvariable definieren.

---

## Fragile Areas

**Badge-Progress-Berechnung mit unimplementierten Kriterien-Typen:**
- Files: `backend/routes/konfi.js` (Zeilen 1055–1063)
- Why fragile: `streak` und `time_based` Kriterien-Typen geben immer `current: 0` zurück (TODO-Kommentare). Badges mit diesen Typen zeigen nie Fortschritt, auch wenn der Konfi die Bedingung erfüllen würde. Im Gegensatz dazu sind diese Typen in `backend/routes/badges.js` (Zeile 546) korrekt implementiert für die Badge-Vergabe. Inkonsistenz zwischen Vergabe und Fortschrittsanzeige.
- Safe modification: `checkStreakCriteria` aus `badges.js` in eine gemeinsame Util-Funktion extrahieren und in `konfi.js` für die Progress-Berechnung verwenden.
- Test coverage: Keine automatisierten Tests.

**Migration Runner ohne Transaktionen:**
- Files: `backend/database.js` (Zeilen 37–50)
- Why fragile: Jede Migration läuft ohne Transaktion. Wenn eine Migration halb ausgeführt wird und dann fehlschlägt, können Schema-Änderungen teilweise angewendet sein ohne Eintrag in `schema_migrations`. Neustart würde die Migration erneut versuchen, was zu Doppel-Ausführungsfehlern führt.
- Safe modification: Jede Migration in `BEGIN`/`COMMIT` wrappen, `schema_migrations`-Insert innerhalb derselben Transaktion.

**`window.location.href` Navigation statt useIonRouter:**
- Files:
  - `frontend/src/App.tsx` (Zeile 159)
  - `frontend/src/components/admin/pages/AdminOrganizationsPage.tsx` (Zeile 73)
  - `frontend/src/components/admin/pages/AdminSettingsPage.tsx` (Zeile 65)
  - `frontend/src/components/admin/views/EventDetailSections.tsx` (Zeile 371)
  - `frontend/src/components/admin/views/EventDetailView.tsx` (Zeile 397)
  - `frontend/src/components/konfi/views/ProfileView.tsx` (Zeilen 210, 215)
  - `frontend/src/components/teamer/pages/TeamerProfilePage.tsx` (Zeilen 165, 169)
  - `frontend/src/contexts/AppContext.tsx` (Zeile 445)
- Why fragile: `window.location.href` triggert einen vollständigen Seiten-Reload statt Ionic-Navigation. Verliert App-State, Ionic-Animationen, und kann auf nativem iOS/Android zu unerwünschtem Verhalten führen.
- Safe modification: Logout-Flows können als Full-Reload akzeptabel sein (State soll gelöscht werden). `EventDetailSections.tsx` Zeile 371 (Serie-Navigation) und `EventDetailView.tsx` Zeile 397 (Chat-Navigation) sollten auf `useIonRouter` umgestellt werden.

**Große monolithische Komponenten:**
- Files:
  - `frontend/src/components/admin/views/KonfiDetailSections.tsx` (1181 Zeilen)
  - `frontend/src/components/admin/modals/BadgeManagementModal.tsx` (1124 Zeilen)
  - `frontend/src/components/chat/ChatRoom.tsx` (1058 Zeilen)
  - `frontend/src/components/teamer/pages/TeamerEventsPage.tsx` (921 Zeilen)
  - `frontend/src/components/konfi/views/EventDetailView.tsx` (875 Zeilen)
- Why fragile: Sehr große Dateien sind schwer zu lesen und zu testen. Änderungen in einem Bereich der Komponente können unerwartete Seiteneffekte in anderen Bereichen haben.
- Safe modification: Inkrementell auslagern — Helper-Hooks für Geschäftslogik, kleinere Unter-Komponenten für UI-Abschnitte.

**Dual-Duplikat-Routen `teamer.js` / `konfi.js` für Tageslosung:**
- Files: `backend/routes/teamer.js` (Zeile 771), `backend/routes/konfi.js` (Zeile 1444)
- Why fragile: Dieselbe externe Losung-API wird von zwei Routen unabhängig aufgerufen. Änderungen (API-Key, URL, Fehlerbehandlung) müssen an zwei Stellen synchron gehalten werden.
- Safe modification: Losung-Abruf in `backend/services/losungService.js` auslagern.

---

## Test Coverage Gaps

**Keine Backend-Tests vorhanden:**
- What's not tested: Gesamte Backend-Logik — Routes, Middleware, Datenbankoperationen, Business-Logik (Badge-Vergabe, Event-Booking, Punkte-Berechnung).
- Files: `backend/` (komplett)
- Risk: Regressionen werden erst in Produktion entdeckt. Kritische Pfade wie Race-Condition-Schutz bei Event-Buchungen sind ohne Tests schwer zu verifizieren.
- Priority: Hoch

**Frontend-Tests minimal:**
- What's not tested: Ein einziger Smoke-Test (`App.test.tsx` — prüft nur ob App rendert ohne zu crashen). Cypress-E2E hat nur einen Placeholder-Test (`cypress/e2e/test.cy.ts` — prüft einen nicht vorhandenen "Tab 1 page" Text).
- Files: `frontend/src/App.test.tsx`, `frontend/cypress/e2e/test.cy.ts`
- Risk: UI-Regressionen, kaputte Formulare und Navigations-Flows werden nicht automatisch erkannt.
- Priority: Hoch — besonders für kritische Flows (Login, Aktivitäts-Antrag, Event-Buchung).

---

## Known Bugs

**Badge-Fortschrittsanzeige für `streak` und `time_based` immer 0%:**
- Symptoms: Konfis mit streak- oder zeitbasierten Badges sehen 0% Fortschritt, auch wenn Aktivitäten vorhanden sind.
- Files: `backend/routes/konfi.js` (Zeilen 1055–1063)
- Trigger: Aufruf von `GET /konfi/badges` für einen Konfi mit Badges dieser Kriterien-Typen.
- Workaround: Keiner. Badges können dennoch vergeben werden (badges.js berechnet korrekt), aber der Fortschritt im Frontend zeigt immer 0.

---

## Scaling Limits

**PostgreSQL Connection Pool:**
- Current capacity: `PG_POOL_MAX` Standard 20 Connections
- Limit: Bei EKD-Skalierung (4000+ User, viele parallele Badge-Progress-Berechnungen mit N+1-Queries) wird der Pool zum Flaschenhals.
- Scaling path: `PG_POOL_MAX` im Docker-Compose erhöhen (z.B. auf 50), N+1-Queries durch Bulk-Queries ersetzen, Read-Replica für lesende Queries einführen.

**Kein Database Backup-Prozess im Code:**
- Current capacity: Kein automatisierter Backup im Codebase sichtbar.
- Limit: Datenverlust bei Serverausfall oder fehlerhafter Migration ohne Rollback-Möglichkeit.
- Scaling path: Automatisierte `pg_dump` Cronjobs auf dem Server einrichten, Backup-Rotation definieren.

---

## Dependencies at Risk

**`bcrypt` v5 (synchrone API in Verwendung):**
- Risk: Wie oben beschrieben — synchrone Varianten werden aktiv genutzt trotz async-API.
- Impact: Performance-Degradation unter Last.
- Migration plan: Async-API der gleichen Version verwenden — kein Paket-Wechsel nötig.

**Frontend ohne Produktions-Monitoring:**
- Risk: Kein Sentry, Bugsnag oder ähnliches. Produktionsfehler sind nur über `console.error` im ErrorBoundary sichtbar.
- Files: `frontend/src/components/common/ErrorBoundary.tsx` (Zeile 31)
- Impact: Fehler in Produktion werden nur entdeckt wenn User sich aktiv beschweren.
- Migration plan: Sentry SDK ergänzen (`@sentry/capacitor` für native Apps), im ErrorBoundary und in kritischen catch-Blöcken aufrufen.

---

*Concerns-Audit: 2026-03-23*
