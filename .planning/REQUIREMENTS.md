# Requirements: Konfi Quest

**Defined:** 2026-03-03
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v1.3 Requirements

Requirements fuer Milestone v1.3 Layout-Polishing.

### Global UI

- [x] **GUI-01**: Listen-Icons in allen Views kleiner und oben positioniert (statt gross und zentriert)
- [x] **GUI-02**: Auswahl-Rahmen (orange/tuerkis/rot) bei Fokus/Select in allen Modals und Listen entfernt
- [x] **GUI-03**: Auswahl-Farben konsistent: Konfis=Orange, alle anderen=Tuerkis (Haekchen, Hervorhebung)
- [x] **GUI-04**: Gruen in Headers kraeftiger (Aktivitaeten, Antraege -- zu matt)
- [x] **GUI-05**: Auth-Seiten durchgehende Hintergrundfarbe (weisser Bereich unten entfernt)

### Konfi Views

- [x] **KUI-01**: Tab "Dashboard" in "Start" umbenannt
- [x] **KUI-02**: Konfi EventDetailView Teilnehmer:innen-Anzeige redesignt (passt zum Design-System)
- [x] **KUI-03**: BadgesView EmptyState fuer "Offen" und "In Arbeit" Sektionen wenn leer
- [x] **KUI-04**: KonfiProfileView Farbe von Blau auf Lila geaendert
- [x] **KUI-05**: PointsHistoryModal "Gesamt" Textüberlauf behoben, Layout 3+2 statt 4+1
- [x] **KUI-06**: Bibeluebersetzung-Aendern Action funktioniert (aktuell ohne Funktion)
- [x] **KUI-07**: RequestsView Header-Gruen dunkler (wie Admin-Antraege)
- [x] **KUI-08**: Konfi ActivityRequestModal Icons von Lila auf Gruen geaendert
- [x] **KUI-09**: Konfi RequestDetailModal an Admin-Modal angeglichen
- [x] **KUI-10**: UnregisterModal erreichbar/verlinkt
- [x] **KUI-11**: EditProfileModal pruefen und verlinken oder entfernen

### Admin Views

- [x] **AUI-01**: KonfiDetailView Corner-Badge fuer Bonus- und Event-Eintraege (Konsistenz)
- [x] **AUI-02**: KonfiDetailView Icon vor Approved-Namen
- [x] **AUI-03**: Benutzer:innen-Liste Funktions-Icon von Line auf Solid
- [x] **AUI-04**: GoalsPage/PunkteZiel-Modal Standard-Stepper-Pattern (kein Sonderdesign)
- [x] **AUI-05**: Admin EventDetailView Beschreibung als eigene Card (wie Konfi-Ansicht)
- [x] **AUI-06**: Admin vs Konfi EventDetailView Detail-Reihenfolge angeglichen
- [x] **AUI-07**: ActivityModal Haekchen-Position wie andere Modals (nicht oben rechts)

### Settings-Bereich

- [x] **SET-01**: Settings-Seite Struktur: Profil raus, Konto oben, Verwaltung, Inhalt
- [x] **SET-02**: Benutzer + Konfis einladen Farbe auf mattes Blau
- [x] **SET-03**: Aktivitaeten Gottesdienst-Aktivitaeten in Blau
- [x] **SET-04**: Kategorien durchgehend Orange (nicht Gruen im Inneren)
- [x] **SET-05**: Kategorien eigene Farbe zur Abgrenzung von Badges
- [x] **SET-06**: Level-Modal Icon-Farbe Lila + iOS Backdrop-Effekt
- [x] **SET-07**: Profil-Modals Icons und Funktionsbeschreibung auf Lila
- [x] **SET-08**: AdminBadgesPage Zurueck-Button oben links
- [x] **SET-09**: Badges-Sektionen Oberkategorie-Icons in Zwischenueberschriften

### Super-Admin

- [x] **SUA-01**: Keine TabBar, nur Organisationen-View (kein Profil-Tab)
- [x] **SUA-02**: Direkter Redirect nach Login auf Organisationen (keine weisse Seite)
- [x] **SUA-03**: Farbe mattes Blau durchgehend
- [x] **SUA-04**: Listen-Elemente an CSS-Variablen/Design-System angepasst
- [x] **SUA-05**: Statistik als SectionHeader oben (wie andere Views)
- [x] **SUA-06**: OrganizationManagementModal ans Design-System angepasst
- [x] **SUA-07**: Logout-Moeglichkeit eingebaut

### Bugs

- [x] **BUG-01**: ParticipantManagementModal zeigt keine User
- [x] **BUG-02**: BadgeManagementModal Kategorien und Aktivitaeten nicht aus DB geladen
- [x] **BUG-03**: Invite-Modal QR-Code nicht persistiert nach Schliessen/Oeffnen
- [x] **BUG-04**: ForgotPassword Mail wird nicht gesendet
- [x] **BUG-05**: ResetPasswordPage Unicode-Encoding "pr\u00fen" statt "pruefen"
- [x] **BUG-06**: ResetPasswordPage Zurueck-Button Layout

### Fixes (nachtraeglich)

- [x] **FIX-01**: Checkbox-Farben in Admin-Modals nicht hardcoded tuerkis, sondern dynamische Typ-Farbe verwenden
- [x] **FIX-02**: Einmalpasswort wird nach Generierung korrekt im Alert angezeigt (sowohl bei Neuerstellung als auch bei Regenerierung)

### Sicherheit

- [x] **SEC-01**: Konfi-Passwort-Management: Einmalpasswort generieren statt Klartext-Anzeige, mit Kopier-Button

## Future Requirements

Geplante Milestones nach v1.3:

### v1.4 Push-Benachrichtigungen
- **PUSH-01**: Systematischer Durchgang aller Push-Notification-Flows
- **PUSH-02**: Alle Trigger geprueft und debugged

### v1.5 Event-Logik Debug
- **EVTD-01**: Anmeldung/Abmeldung Logiken verifiziert
- **EVTD-02**: Wartelisten-Mechanik debugged
- **EVTD-03**: Zeitsteuerung (Start, Anmeldeschluss) geprueft

### v2.0 Teamer + Neue Features
- **TEAM-01**: Teamer-Bereich ans Design-System anpassen
- **TEAM-02**: Teamer-Badges implementieren
- **TEAM-03**: Konfi Wrapped Feature

## Out of Scope

| Feature | Reason |
|---------|--------|
| Neue Features/Funktionen | Fokus v1.3 liegt auf Layout-Polishing |
| Teamer-Bereich | Eigener Milestone v2.0 |
| Offline-Support | Komplexitaet zu hoch |
| App Store Submission | Erst nach Stabilisierung |
| Backend-Refactoring | Funktioniert, nur kritische Fixes |
| Repo Hygiene (README, Lizenzen) | Verschoben, Layout hat Prioritaet |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GUI-01 | Phase 13 | Complete |
| GUI-02 | Phase 13 | Complete |
| GUI-03 | Phase 13 | Complete |
| GUI-04 | Phase 13 | Complete |
| GUI-05 | Phase 13 | Complete |
| KUI-01 | Phase 14 | Complete |
| KUI-02 | Phase 14 | Complete |
| KUI-03 | Phase 14 | Complete |
| KUI-04 | Phase 16 | Complete |
| KUI-05 | Phase 14 | Complete |
| KUI-06 | Phase 16 | Complete |
| KUI-07 | Phase 15 | Complete |
| KUI-08 | Phase 15 | Complete |
| KUI-09 | Phase 15 | Complete |
| KUI-10 | Phase 16 | Complete |
| KUI-11 | Phase 16 | Complete |
| AUI-01 | Phase 17 | Complete |
| AUI-02 | Phase 17 | Complete |
| AUI-03 | Phase 17 | Complete |
| AUI-04 | Phase 17 | Complete |
| AUI-05 | Phase 17 | Complete |
| AUI-06 | Phase 17 | Complete |
| AUI-07 | Phase 17 | Complete |
| SET-01 | Phase 18 | Complete |
| SET-02 | Phase 18 | Complete |
| SET-03 | Phase 18 | Complete |
| SET-04 | Phase 18 | Complete |
| SET-05 | Phase 18 | Complete |
| SET-06 | Phase 18 | Complete |
| SET-07 | Phase 18 | Complete |
| SET-08 | Phase 18 | Complete |
| SET-09 | Phase 18 | Complete |
| SUA-01 | Phase 19 | Complete |
| SUA-02 | Phase 19 | Complete |
| SUA-03 | Phase 19 | Complete |
| SUA-04 | Phase 19 | Complete |
| SUA-05 | Phase 19 | Complete |
| SUA-06 | Phase 19 | Complete |
| SUA-07 | Phase 19 | Complete |
| BUG-01 | Phase 12 | Complete |
| BUG-02 | Phase 12 | Complete |
| BUG-03 | Phase 12 | Complete |
| BUG-04 | Phase 12 | Complete |
| BUG-05 | Phase 12 | Complete |
| BUG-06 | Phase 12 | Complete |
| FIX-01 | Phase 17.1 | Complete |
| FIX-02 | Phase 17.1 | Complete |
| SEC-01 | Phase 12 | Complete |

**Coverage:**
- v1.3 requirements: 48 total
- Mapped to phases: 48/48
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 after roadmap creation*
