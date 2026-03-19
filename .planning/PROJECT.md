# Konfi Quest

## What This Is

Eine Ionic 8 Hybrid-App (iOS/Android) zur Verwaltung von Konfirmandenpunkten in Kirchengemeinden. Konfis sammeln Gottesdienst- und Gemeindepunkte durch Aktivitaeten, Events und Bonuspunkte. Admins und Teamer verwalten Konfis, vergeben Punkte, erstellen Events und kommunizieren ueber einen integrierten Chat. Das System unterstuetzt mehrere Organisationen (Multi-Tenancy) mit rollenbasierter Zugriffskontrolle (RBAC). Vollstaendig gehaertet (v1.0), konsistentes Design-System (v1.1), poliert (v1.2), Layout (v1.3), Logik debuggt (v1.4), Push-Notifications (v1.5), Dashboard-Konfig (v1.6), Unterricht/Pflicht-Events (v1.7), Teamer-Rolle (v1.8), produktionsreif (v1.9).

## Shipped: v1.9 Bugfix + Polish (2026-03-19)

Alle Bugs, UI-Inkonsistenzen und Logik-Luecken nach dem Grundaufbau geschlossen. App produktionsreif.

**Geliefert:** Ghost-Push-Fix, Event-Jahrgangs-Filter, Event-Absagen/Chat-Erstellung, Punkte-Toggle-Sperre, Admin-Struktur (Chat-Filter Konfis/Team), Badge-UI-Polish, Chat-Verlassen, Zertifikat-2x2-Grid + Standard-Seed.

## Current Milestone: v2.0 Ionic Update + Theme

**Goal:** Ionic 8.6.4 auf 8.8.1 aktualisieren, rdlabo iOS26/MD3 Themes updaten, Ionicons 7 auf 8 migrieren (Breaking Changes bei Icon-Namen).

**Target features:**
- Ionic Framework von 8.6.4 auf 8.8.1 aktualisieren
- rdlabo/ionic-theme-ios26 auf 2.3.0 aktualisieren (nutzt neue 8.8.1 Features)
- rdlabo/ionic-theme-md3 auf neueste Version aktualisieren
- Ionicons 7.4.0 auf 8.0.13 migrieren (Icon-Umbenennungen pruefen und fixen)
- Theme-Konfiguration pruefen und anpassen (variables.css, App.tsx Transitions)

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

### Active

- [ ] Ghost-Push-Bug debuggen und fixen (leere Admin-Push alle 5 Min)
- [ ] Event-Sichtbarkeit: Jahrgangs-Filter, abgesagte Events, Pflicht-Events korrekt
- [ ] Auto-Enrollment bei Jahrgangs-Beitritt fuer bestehende Pflicht-Events
- [ ] Punkte-Toggle-Sperre, Admin-Listen-Korrektur, Ein-Typ-Statusbalken
- [ ] Punkte-History Header Layout und korrekte Datenanzeige
- [ ] UI-Polish: Toggles, Badge-Rundung, Chat-Badge, QR-Button, Befoerdern-Text
- [ ] Admin-Struktur: Zertifikate/Dashboard/Badges als Unterseiten im Inhalt-Bereich
- [ ] Event-Logik: Teamer-only Felder, Absagen, Teilnehmer-Filter, Event-Chat
- [ ] Badge-UI: Modal-Selection, Segment-Position, Teamer-Badge-Ansicht
- [ ] Teamer-Profil ordentlich gestalten
- [ ] Admin-Badge fuer unverbuchte Events

### Out of Scope

- Teamer-System (Rolle, Dashboard, Badges, Events, Chat) -- shipped v1.8
- Konfi Wrapped -- eigener Milestone (Timing-abhaengig)
- Offline-Support -- Komplexitaet zu hoch, nur bei konkretem Bedarf
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
- Gesamt: 43 Phasen, 92 Plans ueber 9 Milestones shipped
- Codebase: ~34.259 Zeilen (TS/TSX/CSS)
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

---
*Last updated: 2026-03-13 after v1.9 milestone start*
