# Requirements: Konfi Quest

**Defined:** 2026-03-05
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v1.4 Requirements

Requirements fuer Logik-Debug Milestone. Jedes Requirement wird einer Roadmap-Phase zugeordnet.

### Event-Logik

- [x] **EVT-01**: Event-Buchung verwendet konsistenten Warteliste-Status (nicht `pending` vs `waitlist`)
- [x] **EVT-02**: Konfi-Buchungsroute prueft `registration_opens_at`/`registration_closes_at`
- [x] **EVT-03**: Nachruecken funktioniert korrekt bei Stornierung (Self-Cancel und Admin-Cancel)
- [x] **EVT-04**: Nachruecken bei Timeslot-Events nur innerhalb desselben Timeslots
- [x] **EVT-05**: Kapazitaetsaenderung (mehr Plaetze) loest Nachruecken aus
- [x] **EVT-06**: `GET /user/bookings` zeigt auch Wartelisten-Buchungen
- [x] **EVT-07**: Doppelte Booking-Routen (`events.js` vs `konfi.js`) konsolidiert oder synchronisiert
- [x] **EVT-08**: Admin-Booking (`POST /:id/participants`) prueft Kapazitaet mit Transaktion

### Badge-Logik

- [ ] **BDG-01**: Alle 13 Badge-Kriterium-Typen funktionieren korrekt
- [ ] **BDG-02**: Streak-Berechnung funktioniert bei Jahreswechsel (Woche 52/53)
- [ ] **BDG-03**: `category_activities` zaehlt korrekt ueber Activity- und Event-Kategorien
- [ ] **BDG-04**: `bonus_points`-Kriterium ist klar dokumentiert (zaehlt Vergaben, nicht Summe)
- [ ] **BDG-05**: Default-Badges bei Org-Erstellung verwenden korrekte Umlaute

### Punkte-Vergabe

- [ ] **PNK-01**: Activity-Zuweisung verwendet Transaktion (INSERT + UPDATE atomar)
- [ ] **PNK-02**: Bonus-Punkte-Zuweisung verwendet Transaktion
- [ ] **PNK-03**: Bonus-Punkte-Loeschung kann keine negativen Punkte erzeugen (`GREATEST(0, ...)`)
- [ ] **PNK-04**: Doppelte Bonus-Routen (`activities.js` vs `konfi-managment.js`) konsolidiert
- [ ] **PNK-05**: Points-History-Berechnung (Subtraktion) ist korrekt und konsistent

### User/Rechte/Institutionen

- [ ] **USR-01**: `last_login_at` wird nur beim echten Login aktualisiert, nicht bei jedem Request
- [ ] **USR-02**: Jahrgang-Zugriffs-Filterung ist konsistent in allen relevanten Routes
- [ ] **USR-03**: Org-Loeschung beruecksichtigt alle abhaengigen Daten korrekt (CASCADE verifiziert)
- [ ] **USR-04**: Organisations-Endpunkte haben angemessenes Rate-Limiting

### Chat-Logik

- [ ] **CHT-01**: Dateizugriff `GET /files/:filename` prueft Organisation-Zugehoerigkeit
- [ ] **CHT-02**: Socket.io-Rollen werden bei Rollenaenderung aktualisiert

## Future Requirements

### Push-Benachrichtigungen (v1.5)

- **PUSH-01**: Systematischer Durchgang aller Push-Flows
- **PUSH-02**: Push bei Event-Nachruecken korrekt
- **PUSH-03**: Push bei Badge-Vergabe korrekt
- **PUSH-04**: Push bei Chat-Nachrichten korrekt

## Out of Scope

| Feature | Reason |
|---------|--------|
| Chat-Komplett-Refactoring | Chat laeuft gut, nur Sicherheits-Checks |
| Frontend-UI-Aenderungen | Rein Backend-Logik-Fixes, kein Design |
| Neue Features | Debug-Milestone, keine neuen Funktionen |
| Teamer-Bereich | Eigener Milestone v2.0 |
| Performance-Optimierung | Nur wo direkt mit Bug verbunden |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EVT-01 | Phase 20 | Complete |
| EVT-02 | Phase 20 | Complete |
| EVT-03 | Phase 20 | Complete |
| EVT-04 | Phase 20 | Complete |
| EVT-05 | Phase 20 | Complete |
| EVT-06 | Phase 20 | Complete |
| EVT-07 | Phase 20 | Complete |
| EVT-08 | Phase 20 | Complete |
| BDG-01 | Phase 21 | Pending |
| BDG-02 | Phase 21 | Pending |
| BDG-03 | Phase 21 | Pending |
| BDG-04 | Phase 21 | Pending |
| BDG-05 | Phase 21 | Pending |
| PNK-01 | Phase 22 | Pending |
| PNK-02 | Phase 22 | Pending |
| PNK-03 | Phase 22 | Pending |
| PNK-04 | Phase 22 | Pending |
| PNK-05 | Phase 22 | Pending |
| USR-01 | Phase 23 | Pending |
| USR-02 | Phase 23 | Pending |
| USR-03 | Phase 23 | Pending |
| USR-04 | Phase 23 | Pending |
| CHT-01 | Phase 24 | Pending |
| CHT-02 | Phase 24 | Pending |

**Coverage:**
- v1.4 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation*
