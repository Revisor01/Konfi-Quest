# Konfi Quest

## What This Is

Eine Ionic 8 Hybrid-App (iOS/Android) zur Verwaltung von Konfirmandenpunkten in Kirchengemeinden. Konfis sammeln Gottesdienst- und Gemeindepunkte durch Aktivitaeten, Events und Bonuspunkte. Admins und Teamer verwalten Konfis, vergeben Punkte, erstellen Events und kommunizieren ueber einen integrierten Chat. Das System unterstuetzt mehrere Organisationen (Multi-Tenancy) mit rollenbasierter Zugriffskontrolle (RBAC). Backend ist gegen Sicherheitsluecken gehaertet (v1.0). Admin- und Konfi-Bereiche haben ein konsistentes Design-System mit Shared Components, CSS-Klassen und einheitlichen Modalen (v1.1). Super-Admin UI eingeschraenkt, Dashboard poliert, Tech Debt bereinigt, Dokumentation aktualisiert (v1.2).

## Current State

v1.0, v1.1 und v1.2 shipped. App ist funktional komplett mit gehärtetem Backend, konsistentem Design-System und bereinigtem Tech Debt. Naechster Schritt: neuer Milestone definieren (v1.3 Repo Hygiene, v1.4 Push-Notifications, oder v2.0 Teamer).

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

### Active

(Kein aktiver Milestone -- naechsten mit /gsd:new-milestone starten)

### Out of Scope

- Teamer-Bereich Design -- eigener Milestone v2.0
- Teamer-Badges -- eigener Milestone v2.0
- Konfi Wrapped -- eigener Milestone v2.0
- Offline-Support -- Komplexitaet zu hoch
- App Store Submission -- erst nach Stabilisierung
- Komplettes Backend-Refactoring (Route-Splitting) -- funktioniert, nur kritische Fixes
- API-Dokumentation (Swagger/OpenAPI) -- kein externer Zugriff geplant

## Context

- App ist im Beta/Test-Stadium, laeuft produktiv mit PostgreSQL auf Docker (server.godsapp.de)
- v1.0 shipped: Backend Security Hardening + Theme-Stabilisierung (2 Phasen, 5 Plans)
- v1.1 shipped: Design-Konsistenz ueber alle Admin- und Konfi-Bereiche (5 Phasen, 17 Plans, -1227 Netto-Zeilen)
- v1.2 shipped: Polishing + Tech Debt (4 Phasen, 6 Plans, 78 Dateien geaendert)
- Gesamt: 11 Phasen, 28 Plans ueber 3 Milestones shipped
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

---
*Last updated: 2026-03-02 after v1.2 milestone complete*
