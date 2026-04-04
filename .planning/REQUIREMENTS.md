# Requirements: Konfi Quest v2.10 Design-Polish + UX-Feinschliff

**Defined:** 2026-03-28
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v2.10 Requirements

### Globale CSS-Patterns

- [ ] **CSS-01**: Globale CSS-Variable fuer Beschreibungstexte (--app-description-font-size) skalierbar an einer Stelle
- [ ] **CSS-02**: Listen-Pattern global: flex-div statt IonList, 12px Card-Padding, app-list-item mit 8px margin-bottom
- [ ] **CSS-03**: Suche+Filter Pattern global: Section-Header oben, Suchleiste wie Chat, Tab-Leiste ausserhalb der Card
- [ ] **CSS-04**: Corner-Badge Titel-Overlap geloest: dynamisches paddingRight (70px single, 120px dual) statt paddingTop

### UX-Haptics

- [x] **UXH-01**: Pull-to-Refresh loest Haptics-Feedback (ImpactStyle.Light) bei ionPullStart aus — in allen Views mit IonRefresher

### Searchbar-Styling

- [x] **SBS-01**: Alle IonSearchbar-Instanzen nutzen ios26-searchbar-classic Klasse fuer den runderen iOS-Look

### IonRange-Verbesserung

- [x] **IRV-01**: IonRange zeigt den aktuell eingestellten Wert sichtbar an (Label/Badge neben dem Slider bleibt waehrend und nach dem Ziehen sichtbar)
- [x] **IRV-02**: Maximalwerte der IonRange-Slider sind korrekt konfiguriert und sinnvoll gewaehlt

### Konfi Events-View

- [ ] **KEV-01**: Suche+Filter Card unter Section-Header, Suchleiste wie Chat-Pattern
- [ ] **KEV-02**: Section-Header immer oben an gleicher Stelle
- [ ] **KEV-03**: Event-Liste an neuen Listen-Stil angepasst (12px Padding, flex-div)

### Konfi Event-Details

- [ ] **KED-01**: Beschreibungstext groesser via globale CSS-Variable --app-description-font-size

### Konfi Badges-View

- [ ] **KBV-01**: Tab-Leiste ausserhalb der Card (wie Events), Suchleiste hinzufuegen (wie Chat)
- [ ] **KBV-02**: Teilnehmer:innen-Liste an Listen-Stil angepasst
- [ ] **KBV-03**: Anmelde-/Anwesenheits-Button in Listen-Stil ueberfuehrt
- [ ] **KBV-04**: Erreichte-Badges-Liste: Abstaende links/rechts an Listen-Stil angepasst (12px)
- [ ] **KBV-05**: Badge-Grid: immer 1/3 Breite pro Badge (CSS Grid mit gleichgrossen Zellen, nicht flex-shrink)

### Badges Popovers

- [ ] **BPO-01**: Popover skaliert mit Titel (nicht mit Beschreibung), Titel einzeilig ohne Umbruch, Beschreibung darf umbrechen
- [ ] **BPO-02**: Popovers centered positioniert damit sie nicht aus dem Bild laufen (links/rechts)

### Konfi Aktivitaeten-View

- [ ] **KAV-01**: Listen an neuen Listen-Stil angepasst

### Konfi Profil

- [ ] **KPR-01**: Alle Listen-Elemente an neuen Stil angepasst
- [ ] **KPR-02**: Meine-Wrappeds: kein Padding unten wenn nur ein Wrapped vorhanden

### Modal Aktivitaet beantragen

- [ ] **MAB-01**: Abstaende der Elemente innerhalb Cards an Listen-Abstaende angepasst (12px)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Neue Features/Funktionalitaet | Nur Design-Polish, keine neuen Capabilities |
| Backend-Aenderungen | Reine Frontend/UI-Phase |
| Teamer/Admin Seiten | Erst nach Konfi-Seiten, gleiche globale CSS nutzen |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CSS-01 | Phase 108 | Pending |
| CSS-02 | Phase 108 | Pending |
| CSS-03 | Phase 108 | Pending |
| CSS-04 | Phase 108 | Pending |
| UXH-01 | Phase 109 | Complete |
| SBS-01 | Phase 109 | Complete |
| IRV-01 | Phase 109 | Complete |
| IRV-02 | Phase 109 | Complete |
| KEV-01 | Phase 110 | Pending |
| KEV-02 | Phase 110 | Pending |
| KEV-03 | Phase 110 | Pending |
| KED-01 | Phase 110 | Pending |
| KBV-01 | Phase 111 | Pending |
| KBV-02 | Phase 111 | Pending |
| KBV-03 | Phase 111 | Pending |
| KBV-04 | Phase 111 | Pending |
| KBV-05 | Phase 111 | Pending |
| BPO-01 | Phase 111 | Pending |
| BPO-02 | Phase 111 | Pending |
| KAV-01 | Phase 112 | Pending |
| KPR-01 | Phase 112 | Pending |
| KPR-02 | Phase 112 | Pending |
| MAB-01 | Phase 112 | Pending |

**Coverage:**
- v2.10 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-04-04*
