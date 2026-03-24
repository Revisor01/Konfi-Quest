# Konfi Quest

## What This Is

Eine Ionic 8 Hybrid-App (iOS/Android) zur Verwaltung von Konfirmandenpunkten in Kirchengemeinden. Konfis sammeln Gottesdienst- und Gemeindepunkte durch Aktivitaeten, Events und Bonuspunkte. Admins und Teamer verwalten Konfis, vergeben Punkte, erstellen Events und kommunizieren ueber einen integrierten Chat. Das System unterstuetzt mehrere Organisationen (Multi-Tenancy) mit rollenbasierter Zugriffskontrolle (RBAC). Vollstaendig gehaertet (v1.0), konsistentes Design-System (v1.1), poliert (v1.2), Layout (v1.3), Logik debuggt (v1.4), Push-Notifications (v1.5), Dashboard-Konfig (v1.6), Unterricht/Pflicht-Events (v1.7), Teamer-Rolle (v1.8), produktionsreif (v1.9).

## Shipped: v1.9 Bugfix + Polish (2026-03-19)

Alle Bugs, UI-Inkonsistenzen und Logik-Luecken nach dem Grundaufbau geschlossen. App produktionsreif.

**Geliefert:** Ghost-Push-Fix, Event-Jahrgangs-Filter, Event-Absagen/Chat-Erstellung, Punkte-Toggle-Sperre, Admin-Struktur (Chat-Filter Konfis/Team), Badge-UI-Polish, Chat-Verlassen, Zertifikat-2x2-Grid + Standard-Seed.

## Shipped: v2.0 Ionic Update + Theme (2026-03-19)

Ionic 8.8.1, Ionicons 8, rdlabo iOS26 2.3.0 + MD3 1.1.0, alle Capacitor Plugins auf neuestem v7 Stand.

## Shipped: v2.1 App-Resilienz (2026-03-21)

Offline-First: Alle 30 Pages mit SWR-Cache, WriteQueue fuer Chat/Antraege/Admin-CRUD (30 Queue-Aktionen), Corner-Badge System fuer Queue-Status, 42 Online-Only Buttons, axios-retry + Idempotency-Keys, koordinierter Reconnect-Sync.

**Geliefert:** TokenStore (Capacitor Preferences statt localStorage), NetworkMonitor, offlineCache + useOfflineQuery (SWR), WriteQueue (FIFO persistent), Corner-Badge Flex-Container, Online-Only Guards, axios-retry + useActionGuard, Backend Idempotency-Keys (client_id UUID), koordinierte Sync-Sequenz (flush → invalidate → badges).

## Shipped: v2.2 Codebase-Hardening (2026-03-21)

Types konsolidiert, 73 DB-Indizes + 23 FKs, CustomEvents→LiveUpdateContext, ErrorBoundary, Performance-Splits, Token-Refresh (15min+90d+Soft-Revoke), nativer Datei-Viewer, Rollen-Audit-Fixes, Teamer+Badge-Polish, UI-Testing-Fixes (12 Phasen, 25 Plans).

## Shipped: v2.3 Konfi + Teamer Wrapped (2026-03-22)

Spotify-Wrapped-Style Jahresrueckblick: 9 Konfi-Slides + 7 Teamer-Slides mit Swiper 12, EffectCreative, Count-up Animationen. Share-Funktion (html-to-image, 1080x1920 Story-Export, natives Share-Sheet). Individualisierung: highlight_type-basierte Slide-Reihenfolge, seed-gesteuerte Formulierungen, KategorieSlide-Balkendiagramm, GottesdienstSlide-Counter, UeberDasZiel-Konfetti. Dashboard-Cards + Push bei Freischaltung. Wiederansicht "Meine Wrappeds" in Profilen. 6 Phasen, 11 Plans, 2213 LOC.

## Shipped: v2.4 Codebase-Cleanup (2026-03-22)

useHistory → useIonRouter (14 Dateien), Losung-API-Key in ENV, Socket.IO Org-Isolation, node-cron statt setInterval, Chat N+1 → 3 Bulk-Queries, Capacitor typsichere Imports, Migration-Runner in database.js, SQLite raus, Legacy-Multer raus, SMTP-Bug gefixt, konfi-management.js Typo, activity_requests.konfi_id→user_id, express-validator auf material.js+teamer.js. 5 Phasen, 12 Plans.

## Shipped: v2.5 Security-Hardening + Polish (2026-03-23)

Letzte Sicherheitsluecken geschlossen, Performance-Engpaesse beseitigt, Architektur bereinigt: Logout-Token-Revoke, 5 Security-Fixes (Passwort/Chat/Typing/API-Key/Stale-Closure), Chat N+1 mit LATERAL Joins, Wrapped parallelisiert, global.io durch DI ersetzt, schema_migrations Tracking, material.js Array-only, DB Pool konfigurierbar, Cron-Guard bereinigt. 4 Phasen, 6 Plans, 15 Requirements.

## Shipped: v2.6 Final Polish + Bugfixes (2026-03-23)

Verbleibende Tech-Debt abgearbeitet: bcrypt async, Badge/Notification N+1 eliminiert, URLs via ENV konfigurierbar, SMTP/QR-Fallbacks bereinigt, losungService extrahiert, SIGTERM-Handler, LiveUpdateContext useRef, Event-Navigation useIonRouter (schwarzer Screen gefixt), Badge-Progress streak/time_based implementiert. 2 Phasen, 3 Plans, 14 Requirements.

## Shipped: v2.7 Backend-Hardening (2026-03-24)

Auth-Routes auf RBAC migriert (gesperrte User sofort blockiert), Magic-Bytes Upload-Validierung, Badge-Cron Bulk-Query, verifyTokenRBAC LRU-Cache, chatUtils dynamischer Admin, bookingUtils extrahiert, useOfflineQuery fetcherRef stabilisiert. 2 Phasen, 3 Plans, 7 Requirements.

## Geplant: v3.0 Onboarding + Landing

**Goal:** Onboarding-Flow, Landing Website mit Erklaerung, Github Readme, Wiki — letzter Schritt vor oeffentlichem Launch.

## Core Value

Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung mit zwei getrennten Punktearten (Gottesdienst und Gemeinde), die jeweils eigene Mindestanforderungen haben.

## Requirements

### Validated

- Punktesystem mit zwei getrennten Punktearten (Gottesdienst + Gemeinde) mit eigenen Mindestanforderungen -- existing
- RBAC mit 5 Rollen: Konfi, Teamer, Admin, Orgadmin, Superadmin -- existing
- Aktivitaeten-System mit Kategorien und Punktwerten -- existing
- Event-System mit Buchung, Timeslots und Warteliste -- existing
- Chat-System mit Echtzeit-Messaging (Socket.io), Polls, Dateiuploads -- existing
- Badge-System mit Levels und automatischer Vergabe -- existing
- Bonus-Punkte-System -- existing
- Jahrgaenge-Verwaltung -- existing
- Multi-Organisations-Management mit Tenant-Isolation -- existing
- QR-Code Onboarding/Invite-System -- existing
- Push-Notifications (Firebase/APNS) -- existing
- PostgreSQL Backend mit Docker-Deployment -- existing
- Konfi-UI fertig designt (Referenz-Design) -- existing
- helmet HTTP Security Headers auf allen Responses -- v1.0
- Multi-Tenant-Isolation auf allen Backend-Routes (organization_id) -- v1.0
- express-validator Input-Validierung auf allen 15 Route-Files -- v1.0
- SQL-Injection-Fix durch getPointField Whitelist -- v1.0
- Rate-Limiter mit deutscher Fehlermeldung -- v1.0
- TabBar CSS-only Rendering fuer 6+ Tabs -- v1.0
- Theme-Isolation iOS26/MD3 ohne Kollisionen -- v1.0
- Badge-Punkte ohne Double-Count-Risiko -- v1.0
- Deprecated dateUtils entfernt -- v1.0
- SectionHeader, EmptyState, ListSection als wiederverwendbare Shared Components -- v1.1
- 100+ CSS-Utility-Klassen (Header, Stats, Modal, Icon-Farben, Auth) in variables.css -- v1.1
- Alle 22 Admin-Views auf Shared Components und CSS-Klassen umgestellt -- v1.1
- 13 Icon-Farb-CSS-Klassen fuer konsistente app-weite Farbgebung -- v1.1
- Alle 28 Modale auf useIonModal migriert, isOpen-Pattern eliminiert -- v1.1
- iOS Card-Modal Backdrop-Effekt und Unsaved-Changes-Schutz -- v1.1
- QR-Code Onboarding mit Auto-Login und differenzierten Fehlermeldungen -- v1.1
- Username-Verfuegbarkeitspruefung bei Registrierung -- v1.1
- JWT 90-Tage-Laufzeit fuer Konfi-Sessions -- v1.1
- Super-Admin TabBar auf 2 Tabs (Organisationen + Profil) eingeschraenkt -- v1.2
- ActivityRings 3. Runde korrekte Strichstaerke und Bright-Farbvarianten -- v1.2
- Dashboard Design-Review mit tageszeitabhaengiger Begruessing und Glass-Chips -- v1.2
- rateLimitMessage UI-Wiring ueber Custom Event Pattern -- v1.2
- console.log Cleanup (148 Frontend + 177 Backend) -- v1.2
- app-condense-toolbar auf alle 20 collapsible Headers -- v1.2
- EventDetailView Inline-Styles durch 17 BEM CSS-Klassen ersetzt -- v1.2
- CLAUDE.md komplett neu geschrieben mit aktuellem Projektstatus -- v1.2
- Globale Listen-Icons 32px mit Top-Alignment, Fokus-Rahmen entfernt -- v1.3
- Checkbox-Farben dynamisch (Kontext-Farbe statt hardcoded Tuerkis) -- v1.3
- Sicheres Einmalpasswort-System mit Kopier-Button -- v1.3
- Konfi-Views poliert (Start-Tab, EmptyStates, PointsHistory 3+2, Profil Lila) -- v1.3
- Admin-Views vereinheitlicht (Corner-Badges, Solid-Icons, Stepper, Beschreibungs-Cards) -- v1.3
- Settings ueberarbeitet (Konto/Verwaltung/Inhalt, Kategorien Sky-Blue, Badges Oberkategorie-Icons) -- v1.3
- Super-Admin komplett neu (kein TabBar, Vollbild, mattes Blau, Logout-Button) -- v1.3
- Event-Logik transaktionssicher: waitlist-Status, Registrierungsfenster, Nachruecken, Kapazitaetspruefung -- v1.4
- Badge-Kriterien komplett repariert: alle 13 Typen, Streak-Jahreswechsel, category_activities UNION ALL -- v1.4
- Punkteoperationen atomar: client.connect()/BEGIN/COMMIT, GREATEST(0,...), Bonus-Route konsolidiert -- v1.4
- RBAC gehaertet: last_login_at nur beim Login, Jahrgang-Filter, Org-Loeschkette, Rate-Limiting -- v1.4
- Chat-Sicherheit: Path-Traversal-Schutz, Org-Dateizugriff, Socket-Disconnect bei Rollenaenderung -- v1.4
- Push-Type Registry mit 18 Notification-Types und Firebase Error-Code Forwarding -- v1.5
- Token-Lifecycle: Logout-Cleanup, 12h-Refresh, User-Wechsel, Fallback-Device-ID -- v1.5
- BadgeContext als Single Source of Truth fuer Unread-Counts (App-Icon, TabBar, Chat) -- v1.5
- Push-Flows: Event-Erinnerungen, Admin-Alert bei Registrierung, Level-Up-Notifications -- v1.5
- Selbstreinigendes Token-System mit 6h-Cleanup fuer verwaiste/fehlerhafte Tokens -- v1.5
- Konsistentes Result-Pattern in allen Push-Send-Methoden mit error_count Tracking -- v1.5
- Punkte-Typ pro Jahrgang konfigurierbar: Gottesdienst/Gemeinde einzeln aktivierbar mit eigenen Zielwerten -- v1.6
- Backend-Guard verhindert Punktevergabe fuer deaktivierte Typen, Badge-Logik ueberspringt deaktivierte Kriterien -- v1.6
- ActivityRings dynamisch (1-3 Ringe), Ranking/Historie/Progress-Bars reagieren auf deaktivierte Typen -- v1.6
- Dashboard-Widget-Steuerung: 5 Sektionen vom Org-Admin ein/ausblendbar, Tageslosung-API optimiert -- v1.6
- Pflicht-Events mit Auto-Enrollment, Punkte-Guard und Nachtrags-Hooks -- v1.7
- Opt-out mit Freitext-Begruendung, Admin-Uebersicht und Push-Benachrichtigung -- v1.7
- QR-Code Self-Check-in mit Zeitfenster-Validierung und manuelle Admin-Korrektur -- v1.7
- "Was mitbringen"-Textfeld auf Events mit Dashboard-Widget-Integration -- v1.7
- Pro-Konfi Anwesenheitsstatistik mit Farbcodierung und verpasste-Events-Liste -- v1.7
- Offline-First SWR-Cache, WriteQueue, Corner-Badges, axios-retry, koordinierter Sync -- v2.1
- Token-Refresh (15min Access + 90d Refresh + Soft-Revoke), nativer Datei-Viewer, 73 DB-Indizes -- v2.2
- Konfi-Wrapped: 9 Slides (Intro, Punkte, Events, Badges, Monat, Chat, Endspurt, Abschluss) mit Swiper 12 -- v2.3
- Teamer-Wrapped: 7 Slides mit Rosa-Farbschema und geteilter Infrastruktur -- v2.3
- Share-Funktion: 1080x1920 Story-Export via html-to-image + natives Share-Sheet -- v2.3
- Wrapped-Individualisierung: highlight_type, Kategorie-Balkendiagramm, Gottesdienst-Counter, Konfetti, Formulierungen -- v2.3
- Dashboard-Integration: Wrapped-Cards + Push-Notification bei Freischaltung -- v2.3
- Wiederansicht "Meine Wrappeds" in Konfi- und Teamer-Profilen -- v2.3
- Backend-Logout mit Refresh-Token-Revoke (POST /api/auth/logout) -- v2.5
- Losung-API-Key Fallback entfernt, 503 bei fehlendem ENV -- v2.5
- Passwort-Minimum auf 8 Zeichen erhoeht -- v2.5
- Chat-Nachrichten Laengenlimit 4000 Zeichen -- v2.5
- Socket.IO Typing Org-Isolation via DB-Check -- v2.5
- Chat N+1 eliminiert (LATERAL Joins fuer DM-Namen + Sortierung) -- v2.5
- Wrapped-Generierung parallelisiert (Promise.allSettled) -- v2.5
- global.io durch Dependency Injection ersetzt (liveUpdate.init, Parameter) -- v2.5
- material.js nur noch Array-Format (event_ids, jahrgang_ids) -- v2.5
- schema_migrations Tracking-Tabelle (Migrationen nur einmal ausfuehren) -- v2.5
- DB Pool explizit konfigurierbar (PG_POOL_MAX, idleTimeout, connectionTimeout) -- v2.5
- Wrapped-Cron Date-Guard entfernt (node-cron Schedule reicht) -- v2.5
- useOfflineQuery Stale-Closure via dataRef beseitigt -- v2.5

### Active

(Keine aktiven Requirements — naechster Milestone definiert neue)

### Out of Scope

- App Store Submission -- erst nach Stabilisierung
- Komplettes Backend-Refactoring (Route-Splitting) -- funktioniert, nur kritische Fixes
- API-Dokumentation (Swagger/OpenAPI) -- kein externer Zugriff geplant

## Context

- App ist im Beta/Test-Stadium, laeuft produktiv mit PostgreSQL auf Docker (server.godsapp.de)
- v1.0 shipped: Backend Security Hardening + Theme-Stabilisierung (2 Phasen, 5 Plans)
- v1.1 shipped: Design-Konsistenz ueber alle Admin- und Konfi-Bereiche (5 Phasen, 17 Plans, -1227 Netto-Zeilen)
- v1.2 shipped: Polishing + Tech Debt (4 Phasen, 6 Plans, 78 Dateien geaendert)
- v1.3 shipped: Layout-Polishing (9 Phasen, 18 Plans, 48 Requirements, 65 Dateien geaendert)
- v1.4 shipped: Logik-Debug (5 Phasen, 9 Plans, 24 Requirements, 50 Dateien, +3397/-1552 Zeilen)
- v1.5 shipped: Push-Notifications (5 Phasen, 8 Plans, 17 Requirements, 16 Dateien, +647/-406 Zeilen)
- v1.6 shipped: Dashboard-Konfig + Punkte-Logik (4 Phasen, 7 Plans, 13 Requirements, 18 Dateien, +866/-524 Zeilen)
- v1.7 shipped: Unterricht + Pflicht-Events (4 Phasen, 8 Plans, 17 Requirements, 23 Dateien, +2312/-523 Zeilen)
- v1.8 shipped: Teamer (5 Phasen, 14 Plans, 27 Requirements, Rolle+Events+Badges+Zertifikate+Material)
- v2.3 shipped: Konfi + Teamer Wrapped (6 Phasen, 11 Plans, 51 Requirements, 2213 LOC neue Wrapped-Komponenten)
- v2.5 shipped: Security-Hardening + Polish (4 Phasen, 6 Plans, 15 Requirements, 14 Dateien, +225/-135 Zeilen)
- v2.6 shipped: Final Polish + Bugfixes (2 Phasen, 3 Plans, 14 Requirements)
- v2.7 shipped: Backend-Hardening (2 Phasen, 3 Plans, 7 Requirements)
- Gesamt: 93 Phasen, 146 Plans ueber 17 Milestones shipped
- Codebase: ~36.800 Zeilen (TS/TSX/CSS)
- Frontend nutzt iOS 26 Theme und MD3 Theme (beide aktiv, platform-scoped)
- Deployment: git push -> Portainer Docker auto-build -> Xcode Build fuer iOS-Test auf echtem Geraet
- PostgreSQL-Migration: Alle 15 Backend-Routes vollstaendig migriert
- Mail-Service (emailService.js) konfiguriert mit Nodemailer, SMTP-Envs in docker-compose.yml

## Constraints

- **Tech Stack**: React 19 + Ionic 8 + Capacitor 7 + Node.js/Express + PostgreSQL -- bestehend, nicht aendern
- **Timeline**: Bald ready fuer produktiven Einsatz -- kein fester Termin, aber zeitnah
- **Design-Regel**: KEINE Unicode Emojis, nur IonIcons. Echte Umlaute verwenden.
- **Modal-Pattern**: Immer useIonModal Hook, NIEMALS IonModal isOpen={state}
- **Sprache**: Deutsche UI-Texte und Fehlermeldungen

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Konfi-UI als Design-Referenz | Bereits fertig und vom User abgenommen | Bestaetigt v1.1 |
| Event-Erstellen-Modal als Modal-Referenz | Beste Umsetzung von Farblogiken und konsistenten Inputs | Bestaetigt v1.1 |
| iOS 26 Theme beibehalten | Bereits integriert, funktioniert | Bestaetigt v1.0 |
| MD3 Theme fuer Android aktiv | Beide Themes koexistieren mit Platform-Scoping | Bestaetigt v1.0 |
| Sicherheit vor neuen Features | Bestehende Concerns muessen vor Go-Live behoben werden | Bestaetigt v1.0 |
| Admin-Seiten UX anpassen statt neu bauen | Alle Admin-Seiten existieren funktional, brauchen nur Design-Update | Bestaetigt v1.1 |
| Bestehende Seiten-Farben erhalten | Jede View hat eigene Farbgradients, werden nicht verworfen | Bestaetigt v1.1 |
| helmet CSP deaktiviert | Reines API-Backend, kein HTML served | Bestaetigt v1.0 |
| getPointField wirft Error statt stillem Fallback | Explizite Fehler sind sicherer als stille Defaults | Bestaetigt v1.0 |
| registerTabBarEffect entfernt | CSS-only Ansatz funktioniert zuverlaessig fuer 6+ Tabs | Bestaetigt v1.0 |
| Badge-Punkte nur aus konfi_profiles | Backend COALESCE garantiert nie-null Werte | Bestaetigt v1.0 |
| Domain-Farb-Zuordnung fuer Modals | Events=Rot, Activities=Gruen, Badges=Orange, Konfi=Lila, Settings=Blau | Bestaetigt v1.1 |
| Multi-Use Invite Codes | Codes unbegrenzt wiederverwendbar statt single-use | Bestaetigt v1.1 |
| DashboardView custom Layout | ActivityRings-Layout bleibt unberuehrt von SectionHeader-Migration | Bestaetigt v1.1 |
| Pragmatischer canDismiss | Close-Button-Schutz mit isDirtyRef, Swipe-to-Dismiss akzeptiert | Bestaetigt v1.1 |
| PostgreSQL-Migration vollstaendig | Alle 15 Routes bereits migriert, statistics.js nie noetig | Bestaetigt v1.2-Recherche |
| Mail-Service konfiguriert | emailService.js mit Nodemailer, SMTP-Envs in docker-compose.yml | Bestaetigt v1.2-Recherche |
| Super-Admin 2-Tab Layout | Nur Organisationen + Profil, reduzierte Oberflaeche | Bestaetigt v1.2 |
| ActivityRings 3. Runde gleiche Strichstaerke | 0.7 statt 0.35, Bright-Farbvarianten statt Opacity | Bestaetigt v1.2 |
| Custom Event fuer Rate-Limit Alerts | Globaler 429-Handler ueber Axios-Interceptor und Custom Event | Bestaetigt v1.2 |
| BEM-Klassen fuer EventDetailView | 17 app-event-detail__* Klassen statt Inline-Styles | Bestaetigt v1.2 |
| CLAUDE.md als kompaktes Arbeitsdokument | Nur aktuell relevante Infos, keine historischen Details | Bestaetigt v1.2 |
| Dynamische Checkbox-Farben statt hardcoded | Kontext-Farbe (typeColor) statt einheitlich Tuerkis | Bestaetigt v1.3 |
| Einmalpasswort-System mit subHeader-Alert | Prominente Passwort-Anzeige ohne HTML in IonAlert | Bestaetigt v1.3 |
| Activities-Gruen #047857 statt #059669 | Bessere Lesbarkeit in Headers | Bestaetigt v1.3 |
| Kategorien Sky-Blue #0ea5e9 | Eigene Farbe statt Activities/Badges fuer Abgrenzung | Bestaetigt v1.3 |
| Super-Admin ohne IonTabs | Nur IonRouterOutlet fuer tabfreies Vollbild-Layout | Bestaetigt v1.3 |
| Organisationen mattes Blau #667eea | Identisch mit users-Preset, semantische Icon-Farben | Bestaetigt v1.3 |
| Punkte-Typ-Config auf jahrgaenge-Tabelle | Boolean-Spalten statt separate Tabelle, pro Jahrgang konfigurierbar | Bestaetigt v1.6 |
| Dashboard-Widget-Toggles in settings KV | Bestehende Settings-Tabelle nutzen statt neue Tabelle | Bestaetigt v1.6 |
| Deaktivierte Punkte bleiben in DB | UI/Ranking blendet aus, historische Daten erhalten | Bestaetigt v1.6 |
| Dashboard-Widgets komplett ausblenden | Kein Platzhalter, nachfolgende Widgets ruecken auf | Bestaetigt v1.6 |
| Punkte-Guard: mandatory erzwingt points=0 | Unabhaengig vom Frontend-Input, Backend verhindert Punktevergabe | Bestaetigt v1.7 |
| Opt-out als Status-Wechsel statt Booking loeschen | confirmed -> opted_out, opt_out_reason bleibt bei Opt-in erhalten | Bestaetigt v1.7 |
| QR_SECRET faellt auf JWT_SECRET zurueck | Einfache Konfiguration, separates Secret optional | Bestaetigt v1.7 |
| Konfi scannt Event-QR (nicht umgekehrt) | Skaliert besser, ein QR-Code fuer alle Konfis | Bestaetigt v1.7 |
| Check-in-Fenster bei allen Event-Typen | Pflicht + freiwillig, konfigurierbar 5-120 Min | Bestaetigt v1.7 |
| Scanner-Feedback als inline Banners | Ueber Video-Feed statt Toast, bessere UX | Bestaetigt v1.7 |

| Swiper 12 fuer Wrapped-Slides | Offiziell von Ionic empfohlen, EffectCreative fuer 3D-Uebergaenge | Bestaetigt v2.3 |
| html-to-image statt html2canvas | 3-4x schneller, kleinerer Bundle | Bestaetigt v2.3 |
| CSS @keyframes statt Framer Motion | +50KB fuer triviale Animationen vermieden | Bestaetigt v2.3 |
| Share-Cards als reines HTML/CSS | Ionic Shadow-DOM wird von html-to-image nicht zuverlaessig gerendert | Bestaetigt v2.3 |
| Keine Percentil-Vergleiche | Datenschutz Minderjaehrige (DSG-EKD) | Bestaetigt v2.3 |
| Renderer-Map Pattern statt cloneElement | TypeScript-kompatible dynamische Slide-Reihenfolge | Bestaetigt v2.3 |
| Formulierung-Seed deterministisch | (userId * 31 + year * 17) % 97 -- reproduzierbar pro User/Jahr | Bestaetigt v2.3 |

---
| useIonRouter statt React Router v6 | Ionic 8 inkompatibel mit RR v6 (peerDep ^5.0.1) | Bestaetigt v2.4 |
| Migration-Runner in database.js | Inline-Migrationen in Routes eliminiert | Bestaetigt v2.4 |
| node-cron statt setInterval | Kein Drift nach Container-Neustart | Bestaetigt v2.4 |
| Bulk-Queries fuer Chat-Reactions | N+1 (400 Queries) → 3 Bulk-Queries | Bestaetigt v2.4 |

| Logout best-effort (online-only Revoke) | Offline-Logout loescht nur lokal, Token laeuft natuerlich ab | Bestaetigt v2.5 |
| LATERAL Join statt korrelierter Subquery | PostgreSQL-spezifisch aber deutlich performanter | Bestaetigt v2.5 |
| Promise.allSettled statt for-of | Fehlerhafte Konfis blockieren andere nicht | Bestaetigt v2.5 |
| liveUpdate.init(io) DI-Pattern | Analog zum bestehenden db-DI-Pattern | Bestaetigt v2.5 |
| schema_migrations Tracking | Einfache Tabelle statt externes Tool (knex/umzug) | Bestaetigt v2.5 |

---
| bcrypt async statt sync | hashSync blockiert Event-Loop 100-300ms | Bestaetigt v2.6 |
| VITE_API_URL fuer Frontend | Staging-Umgebung moeglich machen | Bestaetigt v2.6 |
| losungService.js extrahiert | Dual-Duplikat konfi.js/teamer.js eliminiert | Bestaetigt v2.6 |
| QR_SECRET Pflicht-ENV | Kein Fallback auf JWT_SECRET mehr | Bestaetigt v2.6 |

---
| verifyTokenRBAC LRU-Cache 30s | DB-Query pro Request eliminiert bei 500 aktiven Usern | Bestaetigt v2.7 |
| bookingUtils Shared-Funktionen | Duplikat-Code aus konfi.js/events.js eliminiert | Bestaetigt v2.7 |
| file-type Magic-Bytes Upload | Client-MIME-Header allein nicht vertrauenswuerdig | Bestaetigt v2.7 |

---
*Last updated: 2026-03-24 after v2.7 milestone*
