# Requirements: Konfi Quest

**Defined:** 2026-03-02
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v1.2 Requirements

Requirements fuer Milestone v1.2 Polishing + Tech Debt.

### Super-Admin UI

- [x] **SUI-01**: Super-Admin sieht nach Login nur Organisations-Verwaltung und Profil/Settings (keine Konfis, Chat, Events, Antraege Tabs)
- [x] **SUI-02**: Super-Admin hat Zugriff auf eigenes Profil und App-Einstellungen

### Dashboard

- [x] **DASH-01**: ActivityRings zeigen 3. Runde korrekt und sichtbar an (Bug-Fix)
- [ ] **DASH-02**: Dashboard-Header (ActivityRings, Level, Greeting) auf Design-Konsistenz geprueft
- [ ] **DASH-03**: Konfirmation-Sektion auf Design-Konsistenz geprueft
- [ ] **DASH-04**: Events-Sektion auf Design-Konsistenz geprueft
- [ ] **DASH-05**: Badges-Sektion auf Design-Konsistenz geprueft
- [ ] **DASH-06**: Tageslosung-Sektion auf Design-Konsistenz geprueft
- [ ] **DASH-07**: Ranking-Sektion auf Design-Konsistenz geprueft

### Tech Debt

- [x] **DEBT-01**: rateLimitMessage wird in Error-Handlern korrekt angezeigt
- [x] **DEBT-02**: Unnoetige console.log Statements aus Produktionscode entfernt
- [x] **DEBT-03**: app-condense-toolbar CSS-Klasse auf alle 19 collapsible Headers angewendet
- [x] **DEBT-04**: Inline Styles in EventDetailView durch CSS-Klassen ersetzt

### Dokumentation

- [ ] **DOC-01**: CLAUDE.md PostgreSQL-Migrationsstatus korrigiert (alle Migrationen abgeschlossen)

## Future Requirements

Geplante Milestones nach v1.2:

### v1.3 Repo Hygiene
- **REPO-01**: Git Repo aufgeraeumt (unnoetige Dateien, alte Branches)
- **REPO-02**: Lizenzen geprueft und hinzugefuegt
- **REPO-03**: README erstellt
- **REPO-04**: Allgemeine Code-Sauberkeit

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
| Neue Features/Funktionen | Fokus v1.2 liegt auf Polishing und Tech Debt |
| Offline-Support | Komplexitaet zu hoch |
| App Store Submission | Erst nach Stabilisierung |
| Backend-Refactoring | Funktioniert, nur kritische Fixes |
| PostgreSQL-Migration | Bereits vollstaendig abgeschlossen (alle 15 Routes) |
| Statistics System | Wurde nie benoetigt, Datei existiert nicht |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SUI-01 | Phase 8 | Complete |
| SUI-02 | Phase 8 | Complete |
| DASH-01 | Phase 9 | Complete |
| DASH-02 | Phase 9 | Pending |
| DASH-03 | Phase 9 | Pending |
| DASH-04 | Phase 9 | Pending |
| DASH-05 | Phase 9 | Pending |
| DASH-06 | Phase 9 | Pending |
| DASH-07 | Phase 9 | Pending |
| DEBT-01 | Phase 10 | Complete |
| DEBT-02 | Phase 10 | Complete |
| DEBT-03 | Phase 10 | Complete |
| DEBT-04 | Phase 10 | Complete |
| DOC-01 | Phase 11 | Pending |

**Coverage:**
- v1.2 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after roadmap creation*
