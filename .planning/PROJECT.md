# Konfi Quest

## What This Is

Eine Ionic 8 Hybrid-App (iOS/Android) zur Verwaltung von Konfirmandenpunkten in Kirchengemeinden. Konfis sammeln Gottesdienst- und Gemeindepunkte durch Aktivitaeten, Events und Bonuspunkte. Admins und Teamer verwalten Konfis, vergeben Punkte, erstellen Events und kommunizieren ueber einen integrierten Chat. Das System unterstuetzt mehrere Organisationen (Multi-Tenancy) mit rollenbasierter Zugriffskontrolle (RBAC). Backend ist gegen Sicherheitsluecken gehaertet (v1.0).

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
- Deprecated dateUtils (parseGermanTime, getGermanNow) entfernt -- v1.0

### Active

- [ ] Design-Konsistenz: Admin-Bereich ans Konfi-Design-Pattern anpassen (kompakte Header, Farblogiken, konsistente Abstaende, gleiche Ionic-Komponenten)
- [ ] Design-Konsistenz: Teamer-Bereich ans gleiche Design-Pattern anpassen
- [ ] Alle Modale auf konsistentes Design pruefen (Referenz: Event-Erstellen-Modal mit Farblogiken, konsistenten Inputs, korrekten Abstaenden)
- [ ] Modal-Routing/Backdrop-Effekt auf iOS sicherstellen (useIonModal Pattern ueberall)
- [ ] QR-Code Onboarding-System validieren und sicherstellen dass es korrekt funktioniert
- [ ] Shared Components erstellen (SectionHeader, EmptyState, ListSection)
- [ ] CSS-Klassen dokumentieren und konsolidieren

### Out of Scope

- Neue Features/Funktionen hinzufuegen -- Fokus liegt auf Konsistenz und Stabilitaet
- Offline-Support -- Komplexitaet zu hoch fuer aktuellen Milestone
- App Store Submission -- Erst nach Design-Konsistenz und Stabilisierung
- Komplettes Backend-Refactoring (Route-Splitting) -- Funktioniert, nur kritische Fixes
- API-Dokumentation (Swagger/OpenAPI) -- Kein externer Zugriff geplant

## Context

- App ist im Beta/Test-Stadium, laeuft produktiv mit PostgreSQL auf Docker (server.godsapp.de)
- v1.0 shipped: Backend Security Hardening + Bug-Fixes + Theme-Stabilisierung (2 Phasen, 5 Plans)
- Konfi-UI ist fertig designt und dient als Referenz fuer alle anderen Bereiche
- Chat nutzt bereits ein globales Layout
- Events-Bereich hat Sonderrolle: Admin kann Events bearbeiten (erweitertes UI), daher kein 1:1 globales Layout moeglich
- Das Event-Erstellen-Modal ist die Design-Referenz fuer Modale (Farblogiken, Inputs, Abstaende)
- Frontend nutzt iOS 26 Theme und MD3 Theme (beide aktiv, platform-scoped)
- Es gibt 20+ Modale im Frontend, die alle dem useIonModal-Pattern folgen sollen
- Deployment: git push -> Portainer Docker auto-build -> Xcode Build fuer iOS-Test auf echtem Geraet
- badges.js PostgreSQL-Migration noch nicht abgeschlossen (relevant fuer Admin-Views)

## Constraints

- **Tech Stack**: React 19 + Ionic 8 + Capacitor 7 + Node.js/Express + PostgreSQL -- bestehend, nicht aendern
- **Timeline**: Bald ready fuer produktiven Einsatz -- kein fester Termin, aber zeitnah
- **Design-Regel**: KEINE Unicode Emojis, nur IonIcons. Echte Umlaute verwenden.
- **Modal-Pattern**: Immer useIonModal Hook, NIEMALS IonModal isOpen={state}
- **Sprache**: Deutsche UI-Texte und Fehlermeldungen

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Konfi-UI als Design-Referenz | Bereits fertig und vom User abgenommen | -- Pending |
| Event-Erstellen-Modal als Modal-Referenz | Beste Umsetzung von Farblogiken und konsistenten Inputs | -- Pending |
| iOS 26 Theme beibehalten | Bereits integriert, funktioniert | Bestaetigt v1.0 |
| MD3 Theme fuer Android aktiv | Beide Themes koexistieren mit Platform-Scoping | Bestaetigt v1.0 |
| Sicherheit vor neuen Features | Bestehende Concerns muessen vor Go-Live behoben werden | Bestaetigt v1.0 |
| Admin-Seiten UX anpassen statt neu bauen | Alle Admin-Seiten existieren funktional, brauchen nur Design-Update | -- Pending |
| helmet CSP deaktiviert | Reines API-Backend, kein HTML served | Bestaetigt v1.0 |
| getPointField wirft Error statt stillem Fallback | Explizite Fehler sind sicherer als stille Defaults | Bestaetigt v1.0 |
| registerTabBarEffect entfernt | CSS-only Ansatz funktioniert zuverlaessig fuer 6+ Tabs | Bestaetigt v1.0 |
| Badge-Punkte nur aus konfi_profiles | Backend COALESCE garantiert nie-null Werte, Fallback war toter Code | Bestaetigt v1.0 |

---
*Last updated: 2026-03-01 after v1.0 milestone*
