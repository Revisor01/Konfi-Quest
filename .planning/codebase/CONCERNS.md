# Codebase Concerns

**Analysis Date:** 2026-03-20

---

## Tech Debt

**ICON_MAP / BADGE_ICONS als globales Duplikat:**
- Issue: Die Icon-Lookup-Map (Ionicon-Name → importiertes Icon-Objekt) ist 8x in verschiedenen Dateien kopiert, mit leicht unterschiedlichen Typsignaturen
- Files: `src/components/konfi/views/DashboardView.tsx`, `src/components/konfi/views/BadgesView.tsx`, `src/components/teamer/views/TeamerBadgesView.tsx`, `src/components/teamer/pages/TeamerBadgesPage.tsx`, `src/components/teamer/pages/TeamerDashboardPage.tsx`, `src/components/teamer/pages/TeamerKonfiStatsPage.tsx`, `src/components/admin/BadgesView.tsx`, `src/components/admin/modals/BadgeManagementModal.tsx`, `src/components/admin/pages/AdminCertificatesPage.tsx`
- Impact: Jede Icon-Erweiterung muss 8x gepflegt werden; aktuell unterschiedliche Typen (`Record<string, string>` vs. `Record<string, {icon, name, category}>`)
- Fix approach: Zentrales `src/utils/iconMap.ts` mit exportierten Hilfsfunktionen `getBadgeIcon(name)` und `getCertificateIcon(name)` erstellen

**Inline-Typdeklarationen statt gemeinsamer Typen:**
- Issue: Die Interfaces `Konfi`, `Badge`, `Event`, `Jahrgang` sind je 5–10x in verschiedenen Komponenten lokal deklariert, obwohl `src/types/dashboard.ts` existiert
- Files: `src/components/admin/KonfisView.tsx`, `src/components/admin/pages/AdminKonfisPage.tsx`, `src/components/admin/views/KonfiDetailView.tsx`, `src/components/admin/modals/ParticipantManagementModal.tsx`, `src/utils/helpers.ts` (Konfi/Badge); `src/components/konfi/views/EventsView.tsx`, `src/components/konfi/pages/KonfiEventsPage.tsx`, `src/components/admin/EventsView.tsx`, etc. (Event)
- Impact: Inkonsistente Felder zwischen Komponenten, TypeScript-Fehler werden unterdrückt mit `any`
- Fix approach: Getrennte `src/types/entities.ts` mit `Konfi`, `Badge`, `Event`, `Jahrgang` als kanonische Typen; alle lokalen Interfaces ersetzen

**Legacy Upload-Konfiguration in server.js:**
- Issue: `upload` (line 334 in `backend/server.js`) ist explizit als deprecated kommentiert (`Legacy upload for other parts`), wird aber noch weitergegeben (`activitiesRouter`)
- Files: `backend/server.js:334`, `backend/routes/activities.js`
- Impact: Unklares Upload-Verhalten für Aktivitäten; Dateien landen ungekennzeichnet in `uploads/`
- Fix approach: Alle Upload-Routen auf spezifische Multer-Konfigurationen migrieren, legacy `upload` entfernen

**verifyToken vs verifyTokenRBAC doppelt vorhanden:**
- Issue: Zwei separate Token-Verifikations-Middlewares existieren in `backend/server.js` (`verifyToken`) und `backend/middleware/rbac.js` (`verifyTokenRBAC`). `verifyToken` lädt keine User-Daten aus der DB und wird noch von `auth.js`-Routen genutzt.
- Files: `backend/server.js:374`, `backend/middleware/rbac.js:19`, `backend/routes/auth.js:162`
- Impact: Inkonsistente User-Daten in Requests; `verifyToken` prüft nicht `is_active` oder Organization-Status
- Fix approach: `verifyToken` vollständig durch `verifyTokenRBAC` ersetzen

**Typo im Dateinamen des Backend-Routers:**
- Issue: `backend/routes/konfi-managment.js` (fehlendes 'e' in management)
- Files: `backend/routes/konfi-managment.js`, `backend/server.js:415`
- Impact: Verwirrend bei Suchen, erschwertes Onboarding
- Fix approach: Umbenennen auf `konfi-management.js` und Imports aktualisieren

**Inline Schema-Migrationen in Route-Dateien:**
- Issue: `CREATE TABLE IF NOT EXISTS` wird beim Server-Start innerhalb von Route-Modulen ausgeführt, nicht in einer zentralen Migrations-Pipeline
- Files: `backend/routes/material.js:12`, `backend/routes/teamer.js:10`, `backend/routes/badges.js:630`
- Impact: Schemaänderungen werden nicht versioniert; kein Rollback möglich; jeder Server-Start führt potenziell DDL aus
- Fix approach: Migrations-Verzeichnis `backend/migrations/` mit nummerierten SQL-Dateien; bei Start einmalig ausführen

**`ExploreContainer` — ungenutzter Ionic-Scaffold-Code:**
- Issue: `src/components/ExploreContainer.tsx` ist ein Überbleibsel aus dem Ionic-Projektgerüst und wird nirgendwo importiert
- Files: `src/components/ExploreContainer.tsx`
- Impact: Toter Code im Repo; verwirrt neue Entwickler
- Fix approach: Datei und zugehörige CSS-Datei löschen

**`window.location.href` statt React Router Navigation:**
- Issue: An 11 Stellen wird `window.location.href` für Navigation verwendet, was einen Full-Page-Reload auslöst und den SPA-Routing-State zerstört
- Files: `src/contexts/AppContext.tsx:390`, `src/components/konfi/views/ProfileView.tsx:159,165`, `src/components/teamer/pages/TeamerProfilePage.tsx:145,150`, `src/components/admin/views/EventDetailView.tsx:570,1001`, `src/components/admin/pages/AdminOrganizationsPage.tsx:71`, `src/components/admin/pages/AdminSettingsPage.tsx:63,69`, `src/services/api.ts:32`
- Impact: Verlust von React-State, schlechtere Nutzererfahrung durch vollständigen Reload; unterdrückt Ionic-Page-Transitions
- Fix approach: `useHistory().push()` bzw. `useHistory().replace()` verwenden; für Push-Navigation in `AppContext` einen custom Router-Event-Bus implementieren

**DOM-Custom-Events als Cross-Component-Kommunikation:**
- Issue: Mehrere Komponenten nutzen `window.dispatchEvent(new CustomEvent(...))` und `window.addEventListener(...)` für State-Updates, obwohl ein WebSocket-basierter `LiveUpdateContext` existiert
- Files: `src/contexts/BadgeContext.tsx:152`, `src/components/konfi/views/EventDetailView.tsx:132,145,164`, `src/components/admin/views/KonfiDetailView.tsx:168,180,378,402`, `src/components/admin/views/EventDetailView.tsx:410,487,510,525`
- Impact: Zwei parallele Aktualisierungssysteme; schwer testbar; Race Conditions möglich
- Fix approach: Alle Custom Events durch `LiveUpdateContext.triggerRefresh()` und `useLiveRefresh()` ersetzen

**Dangling Event Listeners (nie dispatcht):**
- Issue: Vier Admin-Pages registrieren `window.addEventListener` für Events, die nirgendwo im Code dispatcht werden
- Files: `src/components/admin/pages/AdminActivityRequestsPage.tsx:85` (`activity-requests-updated`), `src/components/admin/pages/AdminBadgesPage.tsx:89` (`badges-updated`), `src/components/admin/pages/AdminOrganizationsPage.tsx:102` (`organizations-updated`), `src/components/admin/pages/AdminUsersPage.tsx:77` (`users-updated`), `src/components/admin/pages/AdminActivitiesPage.tsx:78` (`activities-updated`)
- Impact: Dead Code; diese Seiten aktualisieren sich nach Änderungen in Modals nicht automatisch
- Fix approach: Entweder Dispatcher in den Modals hinzufügen, oder (bevorzugt) auf `useLiveRefresh()` migrieren

**`dateUtils` wird kaum genutzt:**
- Issue: `src/utils/dateUtils.ts` stellt Datum-Formatierungsfunktionen bereit, aber 165 Vorkommen von `new Date(...)`, `.toLocaleDateString()` und `.toLocaleTimeString()` sind direkt in Komponenten; `dateUtils`-Funktionen werden nur in `helpers.ts` importiert
- Files: `src/utils/dateUtils.ts`, fast alle Page- und View-Komponenten
- Impact: Inkonsistente Datums-Formatierung, schwer anpassbar (z.B. Locale-Wechsel)
- Fix approach: `dateUtils`-Nutzung in neuen Komponenten forcieren; schrittweise bestehende Inline-Formatierungen migrieren

**`global.io` als WebSocket-Bus:**
- Issue: Socket.io-Instanz wird auf `global.io` gesetzt und aus 20 Stellen in Route-Dateien direkt als `global.io` abgerufen
- Files: `backend/server.js:109`, `backend/utils/liveUpdate.js:13,27,38,61,77,100,120,141`, `backend/routes/chat.js:696,1354`, `backend/routes/users.js:260`
- Impact: Starke Kopplung; nicht testbar; potenzielle Probleme bei späterem Clustering/Scaling
- Fix approach: `io` als Dependency in Router-Factory-Funktionen injizieren (analog zum `db`-Pattern)

---

## Bekannte Bugs / Unvollständige Features

**Badge-Kriterien `streak` und `time_based` nicht implementiert:**
- Symptoms: Badges mit `criteria_type = 'streak'` oder `'time_based'` zeigen immer 0% Fortschritt
- Files: `backend/routes/konfi.js:1018-1026`
- Trigger: Jedes Mal wenn ein Konfi seine Badges lädt
- Workaround: Admins können solche Badge-Typen anlegen, aber Konfis sehen keinen Fortschritt

**Push-Notification-Listener doppelt registriert:**
- Symptoms: `pushNotificationReceived` und `pushNotificationActionPerformed` werden in `App.tsx` UND `AppContext.tsx` registriert. `App.tsx` ruft zusätzlich `PushNotifications.removeAllListeners()` auf, was die Listeners aus `AppContext.tsx` löscht.
- Files: `src/App.tsx:100`, `src/contexts/AppContext.tsx:309,319,325`
- Trigger: App-Start auf nativer Plattform
- Workaround: Nicht bekannt; führt zu inkonsistenter Verarbeitung von Push-Events

**Event-Chat-Navigation bricht SPA-State:**
- Symptoms: Navigation zum Event-Chat über `window.location.href` löscht React-State
- Files: `src/components/admin/views/EventDetailView.tsx:570`
- Trigger: Klick auf "Chat öffnen" in der Event-Detailansicht

**Badge-Counter in MainTabs läuft auf eigenem 60s-Intervall:**
- Symptoms: `MainTabs.tsx` lädt Badge-Count alle 60 Sekunden, obwohl `BadgeContext` bereits WebSocket-basierte Echtzeit-Updates bereitstellt
- Files: `src/components/layout/MainTabs.tsx:77-96`
- Impact: Doppelte API-Last; potenziell veraltete Zahlen wenn WebSocket und Polling divergieren

**Tageslosung wird jedes Render neu geladen:**
- Symptoms: `DashboardView` reagiert auf `dailyVerse` als `useEffect`-Dependency, aber lädt selbst die Losung vom Backend nach – doppelter Request wenn `KonfiDashboardPage` die Losung ebenfalls lädt
- Files: `src/components/konfi/views/DashboardView.tsx:463-498`, `src/components/konfi/pages/KonfiDashboardPage.tsx:174`

**`initializeChatRooms` falsch mit `setImmediate` aufgerufen:**
- Symptoms: `setImmediate(initializeChatRooms(db))` ruft `initializeChatRooms(db)` sofort aus und übergibt das Ergebnis (eine async Funktion) an `setImmediate`. Das bedeutet `setImmediate` empfängt eine Funktion und ruft sie nie auf
- Files: `backend/server.js:493`, `backend/utils/chatUtils.js:4`
- Impact: Chat-Räume für neue Jahrgänge werden beim Server-Start nicht automatisch angelegt
- Fix approach: `setImmediate(initializeChatRooms(db))` → `setImmediate(() => initializeChatRooms(db)())`

---

## Sicherheitsbedenken

**TLS-Validierung deaktiviert:**
- Risk: SMTP-Verbindungen akzeptieren ungültige Zertifikate (`rejectUnauthorized: false`)
- Files: `backend/server.js:132`, `backend/services/emailService.js:39`
- Current mitigation: SMTP-Server liegt auf eigenem Server (selbes Netzwerk)
- Recommendations: Eigenes Zertifikat konfigurieren oder `rejectUnauthorized: true` nach Zertifikat-Fix aktivieren

**Content Security Policy vollständig deaktiviert:**
- Risk: XSS-Angriffe werden nicht durch Browser-seitige CSP blockiert
- Files: `backend/server.js:225`
- Current mitigation: Helmet übrige Header sind aktiv (X-Frame-Options, X-XSS-Protection)
- Recommendations: Schrittweise CSP für API-Responses einführen; für die App selbst ist CSP im Capacitor-Kontext tatsächlich schwierig

**JWT-Token-Laufzeit 90 Tage ohne Refresh-Mechanismus:**
- Risk: Gestohlene Tokens sind 90 Tage gültig; kein Token-Revoke außer Benutzer-Deaktivierung
- Files: `backend/routes/auth.js:132`, `backend/routes/auth.js:640`
- Current mitigation: `is_active`-Check in `verifyTokenRBAC` macht inaktive User ungültig
- Recommendations: Refresh-Token-System implementieren; Token-Laufzeit auf 7-14 Tage reduzieren

**MD5 für Upload-Dateinamen:**
- Risk: MD5 ist kein sicherer Hash (kollisionsanfällig)
- Files: `backend/server.js:265,300,355`
- Current mitigation: Zusätzliches `Math.random()` und Timestamp; Files werden nicht direkt öffentlich serviert
- Recommendations: `crypto.randomBytes(16).toString('hex')` statt MD5 verwenden

**`(window as any)` für native Plugin-Zugriffe:**
- Risk: Typ-Sicherheit aufgehoben; falsche Plugin-Namen/Methoden führen zu silent failures
- Files: `src/contexts/AppContext.tsx:132,160` (FCMPlugin-Zugriff über `window.Capacitor.Plugins`)
- Recommendations: Typisierten Capacitor-Plugin-Wrapper erstellen

**`crypto` wird nach der ersten Verwendung in `server.js` require'd:**
- Issue: `const crypto = require('crypto')` steht auf Zeile 347, wird aber bereits ab Zeile 265 genutzt (funktioniert wegen Node.js-Hoisting nicht, aber nur weil es davor in einem anderen Scope verwendet wird)
- Files: `backend/server.js:265,300,347`
- Fix approach: `crypto` require an Dateianfang verschieben

---

## Performance-Probleme

**Mega-Komponenten (1000-1500 Zeilen):**
- Problem: Mehrere Komponenten sind zu groß für effektives Rendering und Wartbarkeit
- Files: `src/components/admin/views/KonfiDetailView.tsx` (1517 Zeilen), `src/components/konfi/views/DashboardView.tsx` (1491 Zeilen), `src/components/admin/views/EventDetailView.tsx` (1414 Zeilen), `src/components/admin/modals/EventModal.tsx` (1401 Zeilen)
- Cause: Fehlende Aufteilung in Sub-Komponenten
- Improvement path: Logisch getrennte Abschnitte (z.B. "Aktivitätsliste", "Bonus-Sektion") in eigene Komponenten auslagern

**Wenig Memoization trotz größerer Listen:**
- Problem: Nur 82 Vorkommen von `useCallback`/`useMemo`/`React.memo` in 119 TypeScript-Dateien; Komponenten mit Konfi-Listen, Badge-Grids und Event-Listings re-rendern bei jedem Parent-Update
- Files: `src/components/admin/KonfisView.tsx`, `src/components/admin/BadgesView.tsx`, `src/components/admin/EventsView.tsx`
- Improvement path: Listenpositionen mit `React.memo` wrappen; Filter/Sort-Berechnungen mit `useMemo` cachen

**`SELECT *` in 22 Backend-Queries:**
- Problem: Überflüssige Felder werden über das Netzwerk transportiert
- Files: `backend/routes/events.js:520,1143`, `backend/routes/auth.js:175`, `backend/routes/levels.js:37`, `backend/routes/badges.js:139,306`, u.a.
- Improvement path: Explizite Spalten auflisten, besonders bei `users`-Queries

**Background-Service läuft alle 5 Minuten für alle User:**
- Problem: `BackgroundService.updateAllUserBadges()` fragt alle User mit Push-Tokens ab und sendet ggf. Pushes — keine Prüfung ob Änderungen stattgefunden haben
- Files: `backend/services/backgroundService.js:17`
- Improvement path: Änderungsbasiertes System (nur Push wenn Badge-Count sich geändert hat) — teilweise implementiert, aber vollständig prüfen

---

## Fragile Bereiche

**Push-Notification-Setup (iOS/Testflight):**
- Files: `src/contexts/AppContext.tsx:128-178`
- Why fragile: Mehrfache Workarounds für iOS APNS-Registrierung über undokumentierte `window.Capacitor.Plugins.FCM`-Calls; `setTimeout` von 2s für Token-Retrieval
- Safe modification: Gesamten APNS-Block nie verändern ohne Testflight-Test
- Test coverage: Keine automatisierten Tests

**`verifyTokenRBAC` macht DB-Query bei jedem Request:**
- Files: `backend/middleware/rbac.js:44`
- Why fragile: 3 DB-Queries pro Request (user, jahrgaenge); bei DB-Ausfall schlagen alle authentifizierten Requests fehl
- Safe modification: Keine Caching-Logik einführen ohne Cache-Invalidierung bei Rollen-/Org-Änderungen zu beachten

**Chat-WebSocket und HTTP-Requests parallel:**
- Files: `src/components/chat/ChatRoom.tsx:30`, `src/services/websocket.ts`
- Why fragile: `ChatRoom` nutzt sowohl WebSocket (für neue Nachrichten) als auch HTTP (für Pagination/History); Socket-Reconnect-Logic ist in `websocket.ts` implementiert, aber `ChatRoom` registriert eigene Socket-Events die beim Unmount nicht immer sauber aufgeräumt werden
- Safe modification: Socket-Listener immer im `useEffect`-Cleanup entfernen

**Inline-Migrations beim Modullade-Zeitpunkt:**
- Files: `backend/routes/material.js:109`, `backend/routes/teamer.js:50`, `backend/routes/badges.js:714`
- Why fragile: Migrations laufen bei jedem `require()` des Moduls; bei DB-Fehler startet der Server trotzdem (Fehler wird nur geloggt, nicht geworfen)
- Safe modification: Migrationen nie auf Tabellenumbenennungen oder Index-Drops ausweiten ohne Rollback-Plan

---

## Skalierungsgrenzen

**Single-Server-WebSocket:**
- Current capacity: Eine Node.js-Instanz
- Limit: Horizontale Skalierung (mehrere Prozesse/Container) ist mit `global.io` nicht möglich — WebSocket-Rooms sind prozess-lokal
- Scaling path: Redis-Adapter für Socket.io (`socket.io-redis`) oder auf Message-Broker migrieren

**Upload-Dateien auf dem Server-Dateisystem:**
- Current capacity: Verfügbarer Hetzner-Disk-Speicher
- Limit: Skalierung auf mehrere Instanzen unmöglich; kein CDN
- Scaling path: Objekt-Storage (S3/MinIO) mit signierten URLs

---

## Abhängigkeiten mit Risiko

**`react-router-dom` v5 (veraltet):**
- Risk: React Router v5 ist nicht mit React 19 kompatibel (nur v6+); aktuell funktioniert es, aber React-Concurrent-Features sind eingeschränkt
- Impact: `useHistory` statt `useNavigate`; kein `<Outlet>`-Pattern; schwieriger Upgrade-Pfad
- Files: `package.json:react-router-dom ^5.3.4`; alle Komponenten mit `useHistory`

**`@rdlabo/ionic-theme-ios26` und `ionic-theme-md3`:**
- Risk: Third-Party Pakete, nicht von Ionic offiziell; bekanntes Problem mit `registerTabBarEffect` bei 6 Tabs (in MEMORY.md dokumentiert)
- Impact: Tab-Bar-Animationen können brechen nach Ionic-Updates

**`qr-scanner` (Browser-basiert, nicht Capacitor-native):**
- Risk: Nutzt WebRTC/MediaDevices API; auf nativen Apps ist der native Kamera-Stack performanter und zuverlässiger
- Files: `src/components/konfi/modals/QRScannerModal.tsx`
- Migration plan: Capacitor-eigenes QR-Scanner-Plugin oder `@capacitor-mlkit/barcode-scanning`

**`@capacitor-community/photoviewer` installiert aber nie importiert:**
- Risk: Erhöht Bundle-Größe und App-Größe ohne Nutzen
- Files: `package.json:@capacitor-community/photoviewer ^7.1.0`
- Migration plan: Aus `package.json` entfernen

---

## Fehlende kritische Features

**Kein Token-Refresh-Mechanismus:**
- Problem: JWTs laufen nach 90 Tagen ab; es gibt keinen `/auth/refresh`-Endpoint
- Blocks: User werden nach 90 Tagen ohne Warnung ausgeloggt

**Streak/Zeitbasierte Badge-Kriterien nicht implementiert:**
- Problem: `streak` und `time_based` Kriterien-Typen im Backend sind Stubs (geben immer 0 zurück)
- Files: `backend/routes/konfi.js:1018-1026`
- Blocks: Badges mit diesen Kriterien können nicht sinnvoll genutzt werden

**Dark Mode deaktiviert:**
- Problem: Dark Mode ist explizit deaktiviert (`import '@ionic/react/css/palettes/dark.always.css'` auskommentiert); Systemeinstellung wird ignoriert
- Files: `src/App.tsx:67-69`
- Blocks: Nutzer die System-Dark-Mode verwenden bekommen hellen Modus

**Kein Error Boundary:**
- Problem: Keine React Error Boundary in der App; ein Render-Fehler in einer Komponente stürzt die gesamte App ab
- Files: `src/App.tsx`

---

## Test-Coverage-Lücken

**Nahezu keine Tests vorhanden:**
- What's not tested: Gesamtes Frontend außer einem Smoke-Test; gesamtes Backend
- Files: `src/App.test.tsx` (einzige Test-Datei; prüft nur ob App rendert)
- Risk: Regressions bei Refactoring nicht erkennbar
- Priority: Hoch — besonders für kritische Pfade: Login, Punkte-Vergabe, Badge-Vergabe

**Backend ohne Tests:**
- What's not tested: Alle 15 Route-Module; RBAC-Middleware; Badge-Award-Logik; Push-Service
- Files: Alle `backend/routes/*.js`, `backend/middleware/rbac.js`, `backend/services/`
- Risk: Sicherheits-kritische RBAC-Regeln könnten durch Refactoring versehentlich geändert werden
- Priority: Hoch — RBAC-Tests zuerst

---

*Concerns-Audit: 2026-03-20*
