# Konfi Quest

## What This Is

Eine Ionic 8 Hybrid-App (iOS/Android) zur Verwaltung von Konfirmandenpunkten in Kirchengemeinden. Konfis sammeln Gottesdienst- und Gemeindepunkte durch Aktivitaeten, Events und Bonuspunkte. Admins und Teamer verwalten Konfis, vergeben Punkte, erstellen Events und kommunizieren ueber einen integrierten Chat. Das System unterstuetzt mehrere Organisationen (Multi-Tenancy) mit rollenbasierter Zugriffskontrolle (RBAC).

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

### Active

- [ ] Design-Konsistenz: Admin-Bereich ans Konfi-Design-Pattern anpassen (kompakte Header, Farblogiken, konsistente Abstende, gleiche Ionic-Komponenten)
- [ ] Design-Konsistenz: Teamer-Bereich ans gleiche Design-Pattern anpassen
- [ ] Alle Modale auf konsistentes Design pruefen (Referenz: Event-Erstellen-Modal mit Farblogiken, konsistenten Inputs, korrekten Abstaenden)
- [ ] Modal-Routing/Backdrop-Effekt auf iOS sicherstellen (useIonModal Pattern ueberall)
- [ ] QR-Code Onboarding-System validieren und sicherstellen dass es korrekt funktioniert
- [ ] iOS 26 Theme (@rdlabo/ionic-theme-ios26) konsistent anwenden
- [ ] MD3 Theme (@rdlabo/ionic-theme-md3) fuer Android pruefen und ggf. aktivieren
- [ ] Sicherheitsprobleme aus Concerns-Analyse beheben (Organization-Filtering, JWT Token-Lifecycle, etc.)
- [ ] Bekannte Bugs fixen (TabBar 6+ Tabs, Rate-Limiter UX, Badge Double-Count Risiko)
- [ ] UI-Fehler auf einzelnen Seiten identifizieren und beheben

### Out of Scope

- Neue Features/Funktionen hinzufuegen -- Fokus liegt auf Konsistenz und Stabilitaet
- Offline-Support -- Komplexitaet zu hoch fuer aktuellen Milestone
- App Store Submission -- Erst nach Design-Konsistenz und Stabilisierung
- Komplettes Backend-Refactoring (Route-Splitting) -- Funktioniert, nur kritische Fixes
- API-Dokumentation (Swagger/OpenAPI) -- Kein externer Zugriff geplant

## Context

- App ist im Beta/Test-Stadium, laeuft produktiv mit PostgreSQL auf Docker (server.godsapp.de)
- Konfi-UI ist fertig designt und dient als Referenz fuer alle anderen Bereiche
- Chat nutzt bereits ein globales Layout
- Events-Bereich hat Sonderrolle: Admin kann Events bearbeiten (erweitertes UI), daher kein 1:1 globales Layout moeglich
- Das Event-Erstellen-Modal ist die Design-Referenz fuer Modale (Farblogiken, Inputs, Abstaende)
- Frontend nutzt iOS 26 Theme und hat MD3 Theme als Dependency (aber ggf. nicht aktiv)
- Es gibt 20+ Modale im Frontend, die alle dem useIonModal-Pattern folgen sollen
- Deployment: git push -> Portainer Docker auto-build -> Xcode Build fuer iOS-Test auf echtem Geraet
- CLAUDE.md dokumentiert Migration als teilweise unvollstaendig, aber User sieht keine Fehler im laufenden Betrieb
- Concerns-Analyse hat Sicherheitsluecken und Performance-Probleme identifiziert

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
| iOS 26 Theme beibehalten | Bereits integriert, funktioniert | -- Pending |
| MD3 Theme fuer Android pruefen | Dependency vorhanden (@rdlabo/ionic-theme-md3), aber ggf. nicht aktiv | -- Pending |
| Sicherheit vor neuen Features | Bestehende Concerns muessen vor Go-Live behoben werden | -- Pending |
| Admin-Seiten UX anpassen statt neu bauen | Alle Admin-Seiten existieren funktional, brauchen nur Design-Update | -- Pending |

---
*Last updated: 2026-02-27 after initialization*
