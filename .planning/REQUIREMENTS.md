# Requirements: Konfi Quest

**Defined:** 2026-02-27
**Core Value:** Konsistente, sichere App fuer den produktiven Einsatz mit einheitlichem Design ueber alle Rollen

## v1 Requirements

Requirements fuer den aktuellen Milestone: Design-Konsistenz + Security Hardening + Bug-Fixes.

### Security

- [x] **SEC-01**: Backend nutzt helmet fuer HTTP Security Headers (Dependency existiert, aber ist nicht aktiviert)
- [x] **SEC-02**: Alle Backend-Routes filtern Queries konsistent nach organization_id (Multi-Tenant-Isolation)
- [x] **SEC-03**: notifications.js Route hat organization_id-Filterung (aktuell komplett fehlend)
- [x] **SEC-04**: Backend nutzt express-validator fuer systematische Input-Validierung auf allen Endpoints
- [x] **SEC-05**: Rate-Limiter zeigt dem User eine verstaendliche Meldung bei Blockierung (nicht nur 429 Error)
- [x] **SEC-06**: SQL-Injection-Risiko in activities.js durch sichere Query-Patterns ersetzt (kein Template-Literal fuer Spaltennamen)

### Design-System

- [ ] **DES-01**: Shared SectionHeader-Component erstellt (kompakter Header mit Icon + Titel inline, Stats-Row)
- [ ] **DES-02**: Shared EmptyState-Component erstellt (konsistenter Leerzustand fuer Listen)
- [ ] **DES-03**: Shared ListSection-Component erstellt (einheitliche Listen-Darstellung)
- [ ] **DES-04**: Bestehende CSS-Klassen aus variables.css (app-list-item, app-icon-circle, etc.) dokumentiert und konsolidiert

### Admin-Views Design-Konsistenz

- [ ] **ADM-01**: Admin KonfiPage/KonfiListView ans Konfi-Design-Pattern angepasst (kompakte Header, Farblogiken, Abstaende)
- [ ] **ADM-02**: Admin ActivitiesPage ans Konfi-Design-Pattern angepasst
- [ ] **ADM-03**: Admin EventsPage ans Konfi-Design-Pattern angepasst (beruecksichtigt erweiterte Admin-Bearbeitungsfunktionen)
- [ ] **ADM-04**: Admin BadgesPage ans Konfi-Design-Pattern angepasst
- [ ] **ADM-05**: Admin JahrgaengePage ans Konfi-Design-Pattern angepasst
- [ ] **ADM-06**: Admin CategoriesPage ans Konfi-Design-Pattern angepasst
- [ ] **ADM-07**: Admin UsersPage ans Konfi-Design-Pattern angepasst
- [ ] **ADM-08**: Admin OrganizationsPage ans Konfi-Design-Pattern angepasst
- [ ] **ADM-09**: Admin LevelsPage ans Konfi-Design-Pattern angepasst
- [ ] **ADM-10**: Admin GoalsPage ans Konfi-Design-Pattern angepasst
- [ ] **ADM-11**: Admin InvitesPage ans Konfi-Design-Pattern angepasst
- [ ] **ADM-12**: Admin SettingsPage ans Konfi-Design-Pattern angepasst

### Modal-Konsistenz

- [ ] **MOD-01**: Alle Chat-Modals (CreateChatModal, GroupChatModal, DirectMessageModal, SimpleCreateChatModal) auf useIonModal migriert
- [ ] **MOD-02**: Alle verbleibenden isOpen-Pattern Modals auf useIonModal migriert
- [ ] **MOD-03**: Alle Modals nutzen konsistente Farblogiken, Inputs und Abstaende (Referenz: Event-Erstellen-Modal)
- [ ] **MOD-04**: Backdrop-Effekt auf iOS funktioniert korrekt in allen Modals (presenting element korrekt gesetzt)

### Theme-Konfiguration

- [x] **THM-01**: iOS 26 Theme (@rdlabo/ionic-theme-ios26) korrekt und konsistent angewandt
- [x] **THM-02**: MD3 Theme (@rdlabo/ionic-theme-md3) fuer Android geprueft und korrekt konfiguriert
- [x] **THM-03**: Theme-Kollision zwischen iOS26 und MD3 geloest (aktuell werden beide bedingungslos geladen)
- [x] **THM-04**: registerTabBarEffect Bug mit 6+ Tabs geloest oder Workaround implementiert

### Bug-Fixes

- [x] **BUG-01**: TabBar-Rendering mit 6+ Tabs auf iOS stabil (registerTabBarEffect Workaround)
- [ ] **BUG-02**: Badge Double-Count Risiko eliminiert (klare Trennung activity-points vs bonus-points)
- [ ] **BUG-03**: Deprecated dateUtils (parseLocalTime, getLocalNow) durch aktuelle Implementierungen ersetzt
- [ ] **BUG-04**: UI-Fehler auf einzelnen Seiten identifiziert und behoben (systematischer Durchgang)

### Onboarding

- [ ] **ONB-01**: QR-Code Onboarding-Flow validiert und getestet (Einladung generieren, QR scannen, Registrierung abschliessen)
- [ ] **ONB-02**: Fehler im Onboarding-Flow identifiziert und behoben

## v2 Requirements

Deferred fuer zukuenftigen Release. Nicht im aktuellen Roadmap.

### Security (v2)

- **SEC-V2-01**: JWT Refresh-Token-Mechanismus mit kuerzerer Access-Token-Laufzeit (2h statt 24h)
- **SEC-V2-02**: Secure Token Storage (iOS Keychain / Android Keystore statt localStorage)
- **SEC-V2-03**: Token-Blacklisting bei Passwort-Aenderung und Logout
- **SEC-V2-04**: Audit-Logging fuer Admin-Aktionen (Punkte vergeben, Aktivitaeten loeschen, etc.)
- **SEC-V2-05**: DSGVO-Datenexport-Endpoint

### Performance (v2)

- **PERF-V2-01**: N+1 Query Problem im Dashboard (Badge-Progress) durch CTEs/JOINs loesen
- **PERF-V2-02**: AppContext in mehrere Contexts aufteilen (auth, user, organization, ui)
- **PERF-V2-03**: Backend Route-Files aufteilen (konfi.js, chat.js, events.js)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Neue App-Features (neue Punkte-Arten, neue Gamification) | Fokus auf Konsistenz und Stabilitaet, nicht neue Features |
| Offline-Support | Zu hohe Komplexitaet fuer aktuellen Milestone |
| App Store Submission | Erst nach Design-Konsistenz und Stabilisierung |
| Backend-Refactoring (Route-Splitting) | Funktioniert, nur kritische Fixes -- v2 |
| API-Dokumentation (Swagger/OpenAPI) | Kein externer Zugriff geplant |
| Capacitor 8 Migration | Zu frisch fuer Produktion, v2 evaluieren |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-01 | Phase 1 | Complete |
| SEC-02 | Phase 1 | Complete |
| SEC-03 | Phase 1 | Complete |
| SEC-04 | Phase 1 | Complete |
| SEC-05 | Phase 1 | Complete |
| SEC-06 | Phase 1 | Complete |
| BUG-01 | Phase 2 | Complete |
| BUG-02 | Phase 2 | Pending |
| BUG-03 | Phase 2 | Pending |
| BUG-04 | Phase 2 | Pending |
| THM-01 | Phase 2 | Complete |
| THM-02 | Phase 2 | Complete |
| THM-03 | Phase 2 | Complete |
| THM-04 | Phase 2 | Complete |
| DES-01 | Phase 3 | Pending |
| DES-02 | Phase 3 | Pending |
| DES-03 | Phase 3 | Pending |
| DES-04 | Phase 3 | Pending |
| ADM-01 | Phase 4 | Pending |
| ADM-02 | Phase 4 | Pending |
| ADM-03 | Phase 4 | Pending |
| ADM-04 | Phase 4 | Pending |
| ADM-05 | Phase 4 | Pending |
| ADM-06 | Phase 4 | Pending |
| ADM-07 | Phase 5 | Pending |
| ADM-08 | Phase 5 | Pending |
| ADM-09 | Phase 5 | Pending |
| ADM-10 | Phase 5 | Pending |
| ADM-11 | Phase 5 | Pending |
| ADM-12 | Phase 5 | Pending |
| MOD-01 | Phase 6 | Pending |
| MOD-02 | Phase 6 | Pending |
| MOD-03 | Phase 6 | Pending |
| MOD-04 | Phase 6 | Pending |
| ONB-01 | Phase 7 | Pending |
| ONB-02 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-27*
*Last updated: 2026-02-27 after initial definition*
