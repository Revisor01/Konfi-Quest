# Requirements: Konfi Quest

**Defined:** 2026-03-07
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung mit zwei getrennten Punktearten

## v1.6 Requirements

Requirements fuer Milestone v1.6 Dashboard-Konfig + Punkte-Logik.

### Punkte-Konfiguration

- [x] **PKT-01**: Org-Admin kann Gottesdienst-Punkte pro Jahrgang aktivieren/deaktivieren
- [x] **PKT-02**: Org-Admin kann Gemeinde-Punkte pro Jahrgang aktivieren/deaktivieren
- [x] **PKT-03**: Org-Admin kann Punkteziel (target) pro Jahrgang im laufenden Jahr aendern
- [x] **PKT-04**: Backend lehnt Punktevergabe fuer deaktivierte Typen ab
- [x] **PKT-05**: Warnung erscheint beim Deaktivieren wenn Konfis bereits Punkte dieses Typs haben

### Punkte-UI

- [x] **PUI-01**: ActivityRings zeigen nur aktive Punkte-Typen (dynamische Ring-Anzahl)
- [ ] **PUI-02**: Progress-Bars/Fortschrittsbalken blenden deaktivierte Typen aus
- [x] **PUI-03**: Ranking beruecksichtigt nur aktive Punkte-Typen
- [x] **PUI-04**: Badge-Vergabe ueberspringt Kriterien die deaktivierte Punkte-Typen erfordern
- [x] **PUI-05**: Punkte-Historie blendet deaktivierte Typen aus

### Dashboard-Konfig

- [x] **DSH-01**: Org-Admin kann Dashboard-Sektionen ein/ausblenden (Losung, Ranking, Badges, Events, Konfirmation)
- [ ] **DSH-02**: Dashboard rendert nur aktivierte Sektionen
- [ ] **DSH-03**: Konfig-Aenderungen wirken sofort fuer alle Konfis der Organisation

## Entscheidungen

- Punkte bleiben in DB erhalten wenn Typ deaktiviert wird, werden aber in UI/Ranking ausgeblendet
- Punkte-Typ-Konfiguration auf `jahrgaenge`-Tabelle (Boolean-Spalten), nicht in Settings
- Dashboard-Widget-Toggles in bestehender `settings`-Tabelle (Key-Value Pattern)
- Warnung beim Deaktivieren wenn Konfis bereits Punkte haben
- Punkteziel im laufenden Jahr aenderbar
- Ranking summiert nur aktive Punkte-Typen (alte Punkte bleiben in DB, zaehlen aber nicht)
- both_categories Badge-Kriterium wird uebersprungen wenn nur ein Typ aktiv

## Future Requirements

### Unterricht (v1.7)
- **UNT-01**: Kategorie "Unterricht" mit Auto-Enrollment
- **UNT-02**: Opt-out mit Begruendung
- **UNT-03**: Anwesenheitsuebersicht

## Out of Scope

| Feature | Reason |
|---------|--------|
| Separates Config-Modal fuer Dashboard | Widget-Toggles in bestehende Settings integriert |
| AdminGoals pro Jahrgang | Aktuell org-weit, reicht fuer v1.6 |
| Offline-Support | Komplexitaet zu hoch |
| Teamer-System | Eigener Milestone v1.8 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PKT-01 | Phase 30 | Complete |
| PKT-02 | Phase 30 | Complete |
| PKT-03 | Phase 30 | Complete |
| PKT-04 | Phase 31 | Complete |
| PKT-05 | Phase 31 | Complete |
| PUI-01 | Phase 32 | Complete |
| PUI-02 | Phase 32 | Pending |
| PUI-03 | Phase 32 | Complete |
| PUI-04 | Phase 31 | Complete |
| PUI-05 | Phase 32 | Complete |
| DSH-01 | Phase 30 | Complete |
| DSH-02 | Phase 33 | Pending |
| DSH-03 | Phase 33 | Pending |

**Coverage:**
- v1.6 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-03-07*
*Last updated: 2026-03-07 after roadmap creation*
