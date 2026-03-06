# Requirements: Konfi Quest

**Defined:** 2026-03-05
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v1.5 Requirements

Requirements fuer Push-Notifications Milestone. Jedes mapped auf Roadmap-Phasen.

### Token-Lifecycle

- [x] **TKN-01**: Device Token wird bei Logout vollstaendig geloescht (alle Tokens des Users auf diesem Device)
- [x] **TKN-02**: Fallback Device-ID funktioniert zuverlaessig (keine Filterung in Queries)
- [x] **TKN-03**: Token-Refresh bei App Resume alle 12h zuverlaessig
- [x] **TKN-04**: Token-Uebergabe bei User-Wechsel auf selben Device korrekt (alter User Token geloescht)

### Token-Bereinigung

- [x] **CLN-01**: Ungueltige Tokens werden nach Firebase-Error aus DB entfernt
- [ ] **CLN-02**: Periodischer Cleanup von verwaisten Tokens (User geloescht, Token veraltet)

### Fehlende Push-Flows

- [ ] **FLW-01**: Event-Erinnerung X Stunden vor Event-Beginn an angemeldete Konfis
- [ ] **FLW-02**: Admin erhaelt Push bei neuer Konfi-Registrierung (Invite-Code eingeloest)
- [ ] **FLW-03**: Konfi erhaelt Push bei Level-Up
- [ ] **FLW-04**: Konfi erhaelt Push bei Punkte-Meilenstein (Mindestpunkte Gottesdienst/Gemeinde erreicht)

### Push-Konfiguration

- [x] **CFG-01**: Push-Types koennen per Konfig-Flag aktiviert/deaktiviert werden (Code-Level Defaults)
- [x] **CFG-02**: Notification-Type Registry mit zentraler Type-Definition und Default-Einstellungen

### Badge-Count

- [ ] **BDG-01**: Badge-Count Single Source of Truth — ein System verwaltet den Count, andere konsumieren
- [ ] **BDG-02**: App-Icon Badge (iOS/Android) zeigt korrekte Unread-Anzahl
- [ ] **BDG-03**: Chat-Liste zeigt korrekte Unread-Counts pro Raum
- [ ] **BDG-04**: TabBar Badge-Zahlen stimmen mit tatsaechlichen Unread-Counts ueberein

### Vollstaendigkeit

- [ ] **CMP-01**: Alle bestehenden 14 Push-Flows verifiziert und funktionsfaehig

## Future Requirements

### Notification Preferences

- **PREF-01**: User kann Push-Notification-Praeferenzen einstellen (welche Types)
- **PREF-02**: Admin kann org-weite Notification-Defaults setzen

### Erweiterte Flows

- **EXT-01**: Digest-Notifications (taegliche Zusammenfassung statt einzelne Pushes)
- **EXT-02**: Rich Notifications mit Bildern/Actions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Web Push Notifications | App ist native-only, kein Web-Push noetig |
| SMS Notifications | Zu teuer, Push reicht |
| Email Notifications fuer Push-Events | Mail-Service existiert, aber nicht fuer Push-Events vorgesehen |
| User-Level Notification Preferences UI | Zu komplex fuer v1.5, Admin-Config reicht |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TKN-01 | Phase 26 | Complete |
| TKN-02 | Phase 26 | Complete |
| TKN-03 | Phase 26 | Complete |
| TKN-04 | Phase 26 | Complete |
| CLN-01 | Phase 26 | Complete |
| CLN-02 | Phase 29 | Pending |
| FLW-01 | Phase 28 | Pending |
| FLW-02 | Phase 28 | Pending |
| FLW-03 | Phase 28 | Pending |
| FLW-04 | Phase 28 | Pending |
| CFG-01 | Phase 25 | Complete |
| CFG-02 | Phase 25 | Complete |
| BDG-01 | Phase 27 | Pending |
| BDG-02 | Phase 27 | Pending |
| BDG-03 | Phase 27 | Pending |
| BDG-04 | Phase 27 | Pending |
| CMP-01 | Phase 29 | Pending |

**Coverage:**
- v1.5 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation*
