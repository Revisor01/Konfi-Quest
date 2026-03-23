# Milestones

## v2.6 Final Polish + Bugfixes (Shipped: 2026-03-23)

**Phases completed:** 2 phases, 3 plans, 7 tasks

**Key accomplishments:**

- bcrypt sync durch async ersetzt, Notification-Schleife durch Bulk-INSERT, Badge N+1 Queries durch Vorab-Laden eliminiert
- Frontend-URLs via VITE_API_URL konfigurierbar, SMTP/QR-Fallbacks bereinigt, losungService extrahiert, SIGTERM-Handler mit server.close implementiert
- LiveUpdateContext useRef-Migration, Event-Detail useIonRouter-Navigation, streak/time_based Badge-Progress implementiert

---

## v2.5 Security-Hardening + Polish (Shipped: 2026-03-23)

**Phases completed:** 4 phases, 6 plans, 17 tasks

**Key accomplishments:**

- Serverseitiges Refresh-Token-Revoke beim Logout: POST /api/auth/logout in Express + Frontend-Aufruf vor clearAuth() mit Online-Guard
- 5 unabhängige Sicherheits- und Bug-Fixes: API-Key-Fallback entfernt, Passwort-Minimum auf 8, Chat-Limit 4000, Typing Org-Isolation via DB-Check, useOfflineQuery Stale-Closure via dataRef beseitigt
- GET /chat/rooms mit LATERAL Joins: Direct-Namen inline geladen, ORDER BY ohne korrelierte Subquery
- Wrapped-Snapshot-Generierung parallelisiert via Promise.allSettled mit eigenem DB-Client pro Konfi, Pool-Konfiguration explizit mit PG_POOL_MAX ENV
- global.io aus dem gesamten Backend entfernt und durch explizite Dependency Injection (init/Parameter) ersetzt
- material.js Legacy-Singular-Felder entfernt, schema_migrations Tracking eingefuehrt, doppelter Wrapped-Cron Date-Guard entfernt

---

## v2.4 Codebase-Cleanup (Shipped: 2026-03-22)

**Phases completed:** 5 phases, 12 plans, 19 tasks

**Key accomplishments:**

- useHistory aus 7 Auth/Konfi-Dateien entfernt und durch useIonRouter (Ionic 8 native API) mit korrektem replace/push/goBack-Pattern ersetzt
- 8 Dateien auf useIonRouter migriert, MainTabs mit 5 Wrapper-Komponenten statt props.history in Route render-props
- One-liner:
- Socket.IO joinRoom-Handler mit asynchronem DB-Check gegen Cross-Org-Room-Beitritt abgesichert (chat_rooms.organization_id-Vergleich)
- GET /rooms/:id/messages von bis zu 400 N+1-Queries auf maximal 3 Bulk-Queries mit ANY($1::int[]) umgestellt
- FCM-Plugin per registerPlugin<FCMPlugin> typsicher eingebunden, alle window-as-any-Capacitor-Zugriffe und In-Memory-State von window auf Modul-Level-Variablen migriert
- Migration-Runner in database.js eingebaut, der alle .sql-Dateien aus migrations/ beim Server-Start ausfuehrt, und badges.js Inline-Migrationen als idempotentes 076_badges_rename_migrations.sql ausgelagert
- Drei Inline-Migrations-Funktionen (runMigrations, ensurePointConfigColumns, ensureWrappedSchema) aus Route-Dateien geloescht — SQL-Dateien unter backend/migrations/ sind jetzt alleinige Schema-Quelle
- SQLite-Dependency entfernt, Legacy-Multer-Block geloescht, crypto-Reihenfolge-Bug und SMTP_SECURE-Bug in server.js behoben, tote Frontend-Komponente geloescht
- One-liner:

---

## v2.3 Konfi + Teamer Wrapped (Shipped: 2026-03-22)

**Phases completed:** 6 phases, 11 plans, 22 tasks

**Key accomplishments:**

- wrapped_snapshots Tabelle + 5 API-Endpoints mit Konfi/Teamer-Aggregation (Punkte, Events, Badges, Chat, Endspurt-Flag)
- Wrapped-Cron mit automatischer Monatsanfang-Generierung (Konfi+Teamer) und has_wrapped Flag in beiden Dashboards
- Swiper 12 Fullscreen-Container mit EffectCreative-Slides, Progress-Dots, CSS-Animationssystem und TypeScript-Interfaces fuer Konfi+Teamer Wrapped
- 4 Konfi-Slides (Intro, Punkte, Events, Badges) mit Count-up Animationen, Badge-Grid und Highlight-Event Box
- AktivsterMonatSlide, ChatSlide, EndspurtSlide (bedingt) und AbschlussSlide mit Teamer-CTA -- komplette Konfi-Slideshow mit 7-8 Slides verdrahtet
- 7 Teamer-Slide-Komponenten mit Rosa-Farbschema (#e11d48/#fb7185) und WrappedModal-Integration via wrappedType=teamer
- html-to-image basierter Bild-Export fuer Wrapped-Slides als 1080x1920 Story-Bilder mit nativem Share-Sheet und Text-Fallback
- Wrapped-Cards in Konfi/Teamer-Dashboard mit useIonModal und Push-Notification bei Wrapped-Generierung via PushService
- Konfi-Snapshots um highlight_type, formulierung_seed, Gottesdienst-Count und Kategorie-Verteilung erweitert, History-Endpoint fuer Wiederansicht
- Drei neue Slide-Komponenten (Kategorie-Balkendiagramm, Gottesdienst-Count-up, UeberDasZiel-Konfetti) mit highlight_type-basierter Reihenfolge und seed-gesteuerten Formulierungsvarianten
- Meine Wrappeds Sektionen in Konfi- und Teamer-Profilen + Konfi-Wrapped Card in Teamer Konfi-Historie mit WrappedModal-Wiederansicht

---

## v2.2 Codebase-Hardening (Shipped: 2026-03-22)

**Phases completed:** 19 phases, 25 plans, 47 tasks

**Key accomplishments:**

- User (9x) und Event (8x) duplizierte Interfaces in zentrale types/ Dateien konsolidiert, 19 as-any Casts eliminiert, -404 Netto-Zeilen
- Debug-console.logs entfernt (App.tsx, api.ts, SimpleCreateChatModal) und 4 as-any Casts durch korrekte TypeScript-Typisierung ersetzt
- 73 CREATE INDEX IF NOT EXISTS und 23 ADD CONSTRAINT FK-Statements fuer alle ~30 Tabellen basierend auf WHERE/JOIN-Analyse aller 17 Route-Dateien
- Inline CREATE TABLE Statements aus material.js und teamer.js in zentrale Migration 064 extrahiert, 145 Zeilen Schema-Code aus Routes entfernt
- 17 window.dispatchEvent-Aufrufe (events-updated, konfis-updated, requestStatusChanged) durch LiveUpdateContext.triggerRefresh() ersetzt, LiveUpdateType um users + organizations erweitert
- Alle 9 window.addEventListener-Bloecke fuer Daten-Events entfernt/migriert — useLiveRefresh ist einziger Daten-Update-Mechanismus
- 3 Admin-Mega-Komponenten (4373 Zeilen gesamt) in je Haupt-Datei + Sektionen-Datei aufgeteilt mit 24 React.memo-Komponenten
- ChatRoom unter 750 Zeilen nicht erreicht (1124 statt <750)
- Refresh-Token-Rotation mit SHA-256 Hashing, 15min Access-Tokens und Soft-Revoke via token_invalidated_at
- Automatischer 401-Refresh mit Race-Condition-Schutz, Refresh-Token in Capacitor Preferences und Re-Login-Dialog bei abgelaufenem Session
- Fullscreen FileViewerModal mit CSS-transform Pinch-to-Zoom, Multi-Datei-Swipe, PDF/Video/Fallback-Support und nativem Download/Share via Capacitor
- Chat und Material nutzen einheitlichen Fullscreen-Viewer mit Swipe-Kontext, API-Pfad-Aufloesung fuer Auth-geschuetzte Dateien, kein nativer FileOpener mehr
- Multi-Tenant bonus-points DELETE mit org_id JOIN, letzter org_admin Loeschungsschutz, pending activity_requests Check
- EventDetailView auf useOfflineQuery migriert, isOnline-silent-returns eliminiert, IonSegment Kategorie-Filter im ActivityRequestModal
- GET /teamer/badges um progress_percentage/progress_points erweitert, Jahres-Badge Luecken-Logik dokumentiert
- Badge-Grid mit fester Breite und Ellipsis, Listen-Padding 4px gegen Corner-Badge-Ueberlappung, Zertifikat-Karten mit min-height 120px
- TeamerBadgesPage mit teamer_year Kategorie, geheime Badge-Darstellung (Sichtbar/Geheim-Segment), Dashboard Badge-Platzhalter und Profil Stats-Header
- GET /teamer/konfis Endpoint mit Jahrgang-Filter fuer DirectMessageModal, alle 3 Teamer-Pages bestaetigt mit useOfflineQuery
- Event-Suchleiste auf 3 Pages, Material-Suchleiste Groessen-Fix, cloudOfflineOutline Icon auf 21 Dateien
- DirectMessageModal erkennt Teamer-Rolle und ruft /teamer/konfis statt /admin/konfis auf
- Stats aus TeamerProfilePage entfernt, SectionHeader mit Konfi-Punkten in KonfiStatsPage, arrowBack-Buttons und Modal-Backdrop-Fix
- PDF und DOCX werden auf iOS/Android per FileOpener im nativen Quick Look/Viewer geoeffnet statt im iframe
- Zentrale openFileNatively Utility (FileOpener fuer Bilder, FileViewer fuer Dokumente) mit Web-Fallback-Return und Chat-Video onClick-Fix
- ChatRoom, TeamerMaterialDetailPage und TeamerMaterialPage auf openFileNatively Utility umgestellt mit FileViewerModal als Web-Fallback

---

## v2.2 Codebase-Hardening (Shipped: 2026-03-21)

**Phases completed:** 14 phases, 13 plans, 24 tasks

**Key accomplishments:**

- User (9x) und Event (8x) duplizierte Interfaces in zentrale types/ Dateien konsolidiert, 19 as-any Casts eliminiert, -404 Netto-Zeilen
- Debug-console.logs entfernt (App.tsx, api.ts, SimpleCreateChatModal) und 4 as-any Casts durch korrekte TypeScript-Typisierung ersetzt
- 73 CREATE INDEX IF NOT EXISTS und 23 ADD CONSTRAINT FK-Statements fuer alle ~30 Tabellen basierend auf WHERE/JOIN-Analyse aller 17 Route-Dateien
- Inline CREATE TABLE Statements aus material.js und teamer.js in zentrale Migration 064 extrahiert, 145 Zeilen Schema-Code aus Routes entfernt
- 17 window.dispatchEvent-Aufrufe (events-updated, konfis-updated, requestStatusChanged) durch LiveUpdateContext.triggerRefresh() ersetzt, LiveUpdateType um users + organizations erweitert
- Alle 9 window.addEventListener-Bloecke fuer Daten-Events entfernt/migriert — useLiveRefresh ist einziger Daten-Update-Mechanismus
- 3 Admin-Mega-Komponenten (4373 Zeilen gesamt) in je Haupt-Datei + Sektionen-Datei aufgeteilt mit 24 React.memo-Komponenten
- ChatRoom unter 750 Zeilen nicht erreicht (1124 statt <750)
- Refresh-Token-Rotation mit SHA-256 Hashing, 15min Access-Tokens und Soft-Revoke via token_invalidated_at
- Automatischer 401-Refresh mit Race-Condition-Schutz, Refresh-Token in Capacitor Preferences und Re-Login-Dialog bei abgelaufenem Session
- Fullscreen FileViewerModal mit CSS-transform Pinch-to-Zoom, Multi-Datei-Swipe, PDF/Video/Fallback-Support und nativem Download/Share via Capacitor
- Chat und Material nutzen einheitlichen Fullscreen-Viewer mit Swipe-Kontext, API-Pfad-Aufloesung fuer Auth-geschuetzte Dateien, kein nativer FileOpener mehr

---

## v2.1 App-Resilienz (Shipped: 2026-03-21)

**Phases completed:** 15 phases, 23 plans, 43 tasks

**Key accomplishments:**

- TokenStore-Service mit sync Memory-Cache und async Capacitor Preferences, localStorage-Migration und async Boot-Sequenz in main.tsx
- Alle 9 verbleibenden localStorage-Zugriffe auf TokenStore migriert - null funktionale localStorage-Zugriffe fuer Auth-Daten im gesamten Frontend
- NetworkMonitor Singleton mit Capacitor Network Plugin, isOnline in AppContext, und 401-Handler der Offline-Requests nicht als Auth-Fehler behandelt
- Backend ?after-Filter fuer inkrementelles Chat-Nachladen und Socket.io Reconnect-Handler in ChatRoom + ChatOverview
- offlineCache Service mit Capacitor Preferences und useOfflineQuery SWR-Hook fuer offline-faehige API-Queries
- 5 Konfi-Pages (Dashboard, Events, Badges, Requests, Profil) und 2 Chat-Komponenten (Overview, Room) nutzen SWR-Cache via useOfflineQuery -- Konfis sehen alle Daten auch offline
- 14 Admin-Pages auf useOfflineQuery migriert -- Admins sehen alle Stammdaten, Listen und Konfigurationen offline mit SWR-Pattern
- Alle 7 Teamer-Pages auf useOfflineQuery migriert mit SWR-Pattern und rollenspezifischen Cache-Keys
- axios-retry mit 3x Exponential Backoff + Jitter fuer transiente Fehler, useActionGuard Hook in allen 22 Submit-Modals
- client_id UUID Deduplizierung fuer Chat-Nachrichten und Aktivitaets-Antraege mit Check-then-Insert + UNIQUE-Index-Fallback
- Flex-Container CSS-Klassen fuer Multi-Badge-Anzeige mit Queue- und Fehler-Badge Varianten in variables.css
- Alle 23 Corner-Badge Stellen auf .app-corner-badges Flex-Container migriert, inline-Positionierung und Trenner durch CSS-Klassen ersetzt
- Chat-Nachrichten zeigen Queue-Status als Icons neben dem Zeitstempel mit ActionSheet bei Fehler-Tap
- 23 Modals mit isOnline-Check: Submit-Buttons zeigen 'Du bist offline' und sind disabled wenn offline
- isOnline-Guards auf alle destruktiven und server-validierten Buttons in Admin, Chat, Konfi und Auth Pages -- kein Button fuehrt offline zu einem API-Call
- FIFO WriteQueue Service mit Capacitor Preferences Persistenz, Auto-Flush bei Online/Resume und Background-Task fuer Text-only Flush
- Chat sendMessage mit writeQueue-Fallback, Optimistic UI (pending/error), Retry/Delete ActionSheet und lokaler Bild-Speicherung
- ActivityRequestModal + EventDetailView Opt-out offline-fähig mit Queue-Fallback, lokaler Foto-Speicherung und pending-Anzeige in KonfiRequestsPage
- 8 Fire-and-Forget-Aktionen (mark-read, Reaktionen, Poll, Badges-seen, Bibeluebersetzung, Dashboard-Settings, Chat-Permissions, Funktionsbeschreibung) offline-faehig mit rein optimistischem UI via writeQueue
- 5 Admin-Modals (Event, Aktivitaet, Badge, Level, Material) mit writeQueue Offline-Fallback und immer klickbaren Submit-Buttons
- 7 Admin-Dateien queue-faehig: Kategorien/Jahrgaenge/Zertifikate erstellen+bearbeiten, Antraege genehmigen/ablehnen/zuruecksetzen, Bonus-Punkte und Aktivitaeten offline zuweisbar
- Teamer-Event-Buchung und -Abmeldung offline-faehig via writeQueue mit networkMonitor-Branching
- Koordinierte Sync-Sequenz bei Socket.io Reconnect und App-Resume: flush -> invalidateAll -> badge-refresh in fester Reihenfolge

---

## v2.0 Ionic Update + Theme (Shipped: 2026-03-19)

**Phases completed:** 10 phases, 13 plans, 0 tasks

**Key accomplishments:**

- (none recorded)

---

## v1.9 Bugfix + Polish (Shipped: 2026-03-19)

**Phases completed:** 10 phases, 13 plans, 0 tasks

**Key accomplishments:**

- (none recorded)

---

## v1.7 Unterricht + Pflicht-Events (Shipped: 2026-03-09)

**Phases completed:** 4 Phasen (34-37), 8 Plans
**Timeline:** 2026-03-09 (1 Tag)
**Stats:** 23 files changed, 2312 insertions, 523 deletions
**Requirements:** 17/17 (PFL: 4, OPT: 3, QRC: 5, EUI: 3, ANW: 2)

**Key accomplishments:**

- Pflicht-Events mit Auto-Enrollment aller Jahrgangs-Konfis, Punkte-Guard und Nachtrags-Hooks bei Jahrgang-Wechsel
- Opt-out-Flow mit Freitext-Begruendung (min. 5 Zeichen), Admin-Uebersicht und Push-Benachrichtigung bei Abmeldung
- QR-Code Check-in mit signiertem JWT-Token, konfigurierbarem Zeitfenster (5-120 Min) und Live-Zaehler im Admin-Modal
- Manuelle Anwesenheitskorrektur und druckfreundlicher QR-Code mit Print-CSS
- Pro-Konfi Anwesenheitsstatistik mit farbiger IonProgressBar (gruen/gelb/rot) und verpasste-Events-Liste
- Dashboard Events-Widget mit Was-mitbringen-Info (bagHandle-Icon) und Admin-Toggle (show_events)

---

## v1.6 Dashboard-Konfig + Punkte-Logik (Shipped: 2026-03-09)

**Phases completed:** 4 Phasen (30-33), 7 Plans, 14 Tasks
**Timeline:** 2026-03-07 bis 2026-03-09 (3 Tage)
**Stats:** 18 files changed, 866 insertions, 524 deletions
**Requirements:** 13/13 (PKT: 5, PUI: 5, DSH: 3)

**Key accomplishments:**

- Punkte-Typ-Konfiguration pro Jahrgang: Gottesdienst und Gemeinde einzeln aktivierbar/deaktivierbar mit individuellen Zielwerten
- Backend-Guard verhindert Punktevergabe fuer deaktivierte Typen mit 400er-Fehler und Warnung bei Deaktivierung
- ActivityRings dynamisch: 1 oder 3 Ringe basierend auf aktiven Punkte-Typen, Ranking/Badges/Historie angepasst
- Admin-Views mit ausgegraut-Pattern: deaktivierte Typen sichtbar bei 40% Opacity mit "(deaktiviert)" Label
- Dashboard-Widget-Steuerung: 5 Sektionen (Konfirmation, Events, Losung, Badges, Ranking) vom Org-Admin ein/ausblendbar
- Tageslosung-API-Call-Optimierung: bei deaktivierter Losung wird kein Netzwerk-Request gemacht

---

## v1.5 Push-Notifications (Shipped: 2026-03-07)

**Phases completed:** 5 phases (25-29), 8 plans, 16 tasks
**Timeline:** 2026-03-05 bis 2026-03-07 (3 Tage)
**Stats:** 16 files changed, 647 insertions, 406 deletions
**Requirements:** 17/17 (TKN: 4, CLN: 2, FLW: 4, CFG: 2, BDG: 4, CMP: 1)

**Key accomplishments:**

- Push-Type Registry mit 18 dokumentierten Notification-Types und Firebase Error-Code Forwarding als Grundlage
- Vollstaendiger Token-Lifecycle: Logout-Cleanup, 12h-Refresh, User-Wechsel-Handling, Fallback-Device-ID Fix
- BadgeContext als Single Source of Truth fuer alle Unread-Counts (App-Icon, TabBar, Chat-Liste)
- Neue Push-Flows: Event-Erinnerungen (15min-Intervall), Admin-Alert bei Registrierung, Level-Up-Notifications
- Selbstreinigendes Token-System mit 6h-Cleanup-Intervall fuer verwaiste/fehlerhafte Tokens
- Konsistentes Result-Pattern in allen Push-Send-Methoden mit error_count Tracking

---

## v1.4 Logik-Debug (Shipped: 2026-03-05)

**Phases completed:** 5 phases, 9 plans, 0 tasks

**Key accomplishments:**

- (none recorded)

---

## v1.3 Layout-Polishing (Shipped: 2026-03-04)

**Phases completed:** 9 Phasen (12-19 + 17.1), 18 Plans
**Timeline:** 2026-03-03 bis 2026-03-04 (2 Tage)
**Stats:** 65 files changed, 4654 insertions, 637 deletions
**Git range:** Phase 12 bis Phase 19 (59 Commits)
**Requirements:** 48/48 (GUI: 5, KUI: 11, AUI: 7, SET: 9, SUA: 7, BUG: 6, FIX: 2, SEC: 1)

**Key accomplishments:**

- Admin-Modal-Bugs behoben (Participant, Badges, QR-Code) + sicheres Einmalpasswort-System mit Kopier-Button
- Globale UI-Konsistenz: Listen-Icons 32px/Top-Aligned, Fokus-Rahmen entfernt, Checkbox-Farben vereinheitlicht
- Konfi-Views poliert: Tab "Start", EmptyStates, PointsHistory 3+2 Layout, Profil Lila, Antrags-Icons Gruen
- Admin-Views vereinheitlicht: Corner-Badges, Solid-Icons, Standard-Stepper, Beschreibungs-Cards, Checkbox links
- Settings-Bereich ueberarbeitet: Struktur (Konto/Verwaltung/Inhalt), Kategorien Sky-Blue, Gottesdienst Blau, Badges mit Oberkategorie-Icons
- Super-Admin komplett neu: TabBar entfernt, Vollbild-Layout, mattes Blau (#667eea), Logout-Button, OrganizationManagementModal

**v1.2 Tech Debt aufgeloest:**

- Checkbox-Farben von hardcoded Tuerkis auf dynamische Kontext-Farben
- Einmalpasswort-Alert ohne HTML-Tags (subHeader statt HTML in message)

---

## v1.2 Polishing + Tech Debt (Shipped: 2026-03-02)

**Phases completed:** 4 Phasen (8-11), 6 Plans
**Timeline:** 2026-03-02 (1 Tag)
**Stats:** 78 files changed, 3210 insertions, 1177 deletions
**Git range:** Phase 08 bis Phase 11 (15 Commits)
**Requirements:** 14/14 (SUI-01/02, DASH-01-07, DEBT-01-04, DOC-01)

**Key accomplishments:**

- Super-Admin TabBar auf 2 Tabs reduziert (Organisationen + Profil), alle anderen Admin-Tabs ausgeblendet
- ActivityRings 3. Runde Strichstaerke von 0.35 auf 0.7 korrigiert, hellere Bright-Farbvarianten, Maximum 300%
- Dashboard Design-Review: tageszeitabhaengige Begruessing, Badge-Stats als Glass-Chips, Tageslosung Zitat-Style
- rateLimitMessage UI-Wiring ueber Custom Event Pattern, generischer 429-Handler via Axios-Interceptor
- console.log Cleanup: 148 Frontend + 177 Backend Statements bereinigt, strukturierter Server-Start
- app-condense-toolbar CSS-Klasse auf alle 20 collapsible Headers, 17 BEM-Klassen fuer EventDetailView
- CLAUDE.md komplett neu geschrieben (202 auf 127 Zeilen), alle 15 Routes als migriert dokumentiert

**v1.1 Tech Debt aufgeloest:**

- EventDetailView Inline-Styles von 20 auf 1 (Admin) bzw. 11 auf 3 (Konfi) reduziert
- app-condense-toolbar von 2/19 auf 20/20 Stellen migriert
- rateLimitMessage Wiring-Gap aus v1.0 behoben

## Geplante Milestones

- **v1.8 Teamer** -- Neue Rolle, professionelleres Dashboard, Konfi-zu-Teamer Transition, Teamer-Badges/Events/Chat
- **v1.9 Datenschutz + Archivierung** -- Jahrgaenge archivieren, Loeschfristen, DSGVO
- **Konfi Wrapped** -- Spotify-Wrapped-Style Rueckblick vor Konfirmation

---

## v1.1 Design-Konsistenz (Shipped: 2026-03-02)

**Phases completed:** 5 Phasen (3-7), 17 Plans
**Timeline:** 2026-03-01 bis 2026-03-02 (2 Tage)
**Stats:** 66 files changed, 4426 insertions, 5653 deletions (Netto: -1227 Zeilen)
**Git range:** Phase 03 bis Phase 07 (47 Commits)

**Key accomplishments:**

- Shared Components (SectionHeader, EmptyState, ListSection) mit Preset-Farbsystem in 17 Views eingebaut
- 100+ CSS-Utility-Klassen in variables.css (Header, Stats, Modal, Icon-Farben, Auth-Seiten)
- Admin-TabBar auf 5 Tabs reduziert, Badges unter Settings verschoben
- Alle 28 Modale auf useIonModal migriert, isOpen-Pattern komplett eliminiert
- iOS Card-Modal Backdrop-Effekt und Unsaved-Changes-Schutz implementiert
- QR-Code Onboarding mit Auto-Login, differenzierten Fehlermeldungen und Username-Verfuegbarkeitspruefung

**Tech Debt (akzeptiert):**

- Einige Admin-Views haben mehr Inline-Styles als angepeilt (EventDetailView 63, AdminSettings 26)
- 3 Chat-Modals (GroupChat, DirectMessage, CreateChat) Props-migriert aber ohne aktive Aufrufer
- app-condense-toolbar nur 2/19 Stellen migriert

---

## v1.0 Security + Stabilisierung (Shipped: 2026-03-01)

**Phases completed:** 2 phases, 5 plans
**Timeline:** 2026-02-28 bis 2026-03-01 (2 Tage)
**Stats:** 37 files changed, 2294 insertions, 340 deletions

**Key accomplishments:**

- helmet Security Headers und express-validator Input-Validierung auf allen 15 Backend-Routes
- Multi-Tenant-Isolation lueckenlos: notifications.js und settings.js mit organization_id-Filterung
- SQL-Injection-Fix: getPointField Whitelist ersetzt unsichere Template-Literals in 8 Stellen
- TabBar-Rendering stabilisiert: registerTabBarEffect entfernt, CSS-only fuer 6+ Tabs
- Theme-Isolation: iOS26 und MD3 koexistieren ohne Kollisionen (Platform-scoped Overrides)
- Badge Double-Count-Risiko eliminiert: Fallback-Berechnungspfad entfernt, nur konfi_profiles Werte

**Known Gaps (Phasen 3-7 nicht ausgefuehrt):**

- DES-01 bis DES-04: Design-System Grundlagen (Phase 3)
- ADM-01 bis ADM-12: Admin-Views Design-Konsistenz (Phasen 4+5)
- MOD-01 bis MOD-04: Modal-Konsistenz (Phase 6)
- ONB-01, ONB-02: Onboarding-Validierung (Phase 7)

**Tech Debt:**

- SEC-05 Wiring-Gap: error.rateLimitMessage in api.ts ungenutzt (Login funktioniert ueber alternativen Pfad)
- iOS Glass-Effekt und Android Theme-Isolation visuell ausstehend

---
