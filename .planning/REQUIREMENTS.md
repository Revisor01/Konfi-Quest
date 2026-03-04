# Requirements: Konfi Quest

**Defined:** 2026-03-05
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v1.4 Requirements

Requirements fuer Logik-Debug Milestone. Jedes Requirement wird einer Roadmap-Phase zugeordnet.

### Event-Logik

- [ ] **EVT-01**: Event-Buchung verwendet konsistenten Warteliste-Status (nicht `pending` vs `waitlist`)
- [ ] **EVT-02**: Konfi-Buchungsroute prueft `registration_opens_at`/`registration_closes_at`
- [ ] **EVT-03**: Nachruecken funktioniert korrekt bei Stornierung (Self-Cancel und Admin-Cancel)
- [ ] **EVT-04**: Nachruecken bei Timeslot-Events nur innerhalb desselben Timeslots
- [ ] **EVT-05**: Kapazitaetsaenderung (mehr Plaetze) loest Nachruecken aus
- [ ] **EVT-06**: `GET /user/bookings` zeigt auch Wartelisten-Buchungen
- [ ] **EVT-07**: Doppelte Booking-Routen (`events.js` vs `konfi.js`) konsolidiert oder synchronisiert
- [ ] **EVT-08**: Admin-Booking (`POST /:id/participants`) prueft Kapazitaet mit Transaktion

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
| EVT-01 | — | Pending |
| EVT-02 | — | Pending |
| EVT-03 | — | Pending |
| EVT-04 | — | Pending |
| EVT-05 | — | Pending |
| EVT-06 | — | Pending |
| EVT-07 | — | Pending |
| EVT-08 | — | Pending |
| BDG-01 | — | Pending |
| BDG-02 | — | Pending |
| BDG-03 | — | Pending |
| BDG-04 | — | Pending |
| BDG-05 | — | Pending |
| PNK-01 | — | Pending |
| PNK-02 | — | Pending |
| PNK-03 | — | Pending |
| PNK-04 | — | Pending |
| PNK-05 | — | Pending |
| USR-01 | — | Pending |
| USR-02 | — | Pending |
| USR-03 | — | Pending |
| USR-04 | — | Pending |
| CHT-01 | — | Pending |
| CHT-02 | — | Pending |

**Coverage:**
- v1.4 requirements: 24 total
- Mapped to phases: 0
- Unmapped: 24

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after initial definition*
