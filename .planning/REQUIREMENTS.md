# Requirements: Konfi Quest

**Defined:** 2026-03-22
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v2.3 Requirements

Requirements fuer Milestone v2.3 Konfi + Teamer Wrapped.

### Backend-Daten (DAT)

- [x] **DAT-01**: Backend generiert Wrapped-Snapshot als JSONB pro Konfi (Punkte, Events, Badges, Chat-Stats, aktivster Monat)
- [x] **DAT-02**: Backend generiert Wrapped-Snapshot als JSONB pro Teamer (Events geleitet, Konfis betreut, Badges, Zertifikate, Jahre aktiv)
- [x] **DAT-03**: wrapped_snapshots Tabelle mit user_id, type (konfi/teamer), year, data JSONB, generated_at
- [x] **DAT-04**: Konfirmations-Datum (confirmation_date) pro Jahrgang konfigurierbar
- [x] **DAT-05**: Automatischer Trigger: Wrapped wird generiert am 1. des Monats der Konfirmation
- [x] **DAT-06**: Teamer Wrapped wird automatisch am 1. Dezember generiert
- [x] **DAT-07**: Admin kann Wrapped-Zeitpunkt ueberschreiben (manuell frueher/spaeter ausloesen)
- [x] **DAT-08**: Endspurt-Erkennung: Wenn Konfi unter Zielwert liegt, wird ein Endspurt-Flag im Snapshot gesetzt

### Konfi-Slides (KS)

- [ ] **KS-01**: Intro-Slide: "Dein Konfi-Jahr [Jahr]" mit Name und Jahrgang
- [ ] **KS-02**: Punkte-Slide: Gesamtpunkte (Gottesdienst + Gemeinde) mit animiertem Count-up
- [ ] **KS-03**: Events-Slide: Anzahl besuchter Events + Highlight-Event
- [ ] **KS-04**: Badges-Slide: Verdiente Badges mit Icons, Anzahl von Total
- [ ] **KS-05**: Aktivster-Monat-Slide: Monat mit den meisten Aktivitaeten/Events
- [ ] **KS-06**: Chat-Slide: Nachrichten gesendet, Reaktionen gegeben
- [ ] **KS-07**: Endspurt-Slide: Wenn unter Zielwert, motivierende Nachricht mit fehlenden Punkten
- [ ] **KS-08**: Abschluss-Slide: Zusammenfassung + Einladung Teamer:in zu werden
- [ ] **KS-09**: Slides nur mit eigenen Daten, keine Vergleiche mit anderen Konfis (Datenschutz)

### Teamer-Slides (TS)

- [ ] **TS-01**: Intro-Slide: "Dein Teamer-Jahr [Jahr]"
- [ ] **TS-02**: Events-Slide: Events geleitet (Anzahl + Typen)
- [ ] **TS-03**: Konfis-Slide: Konfis im Jahrgang betreut
- [ ] **TS-04**: Badges-Slide: Verdiente Teamer-Badges
- [ ] **TS-05**: Zertifikate-Slide: Erhaltene Zertifikate
- [ ] **TS-06**: Jahre-Slide: Aktive Jahre als Teamer:in
- [ ] **TS-07**: Abschluss-Slide: Zusammenfassung + Danke

### UI + Interaktion (UI)

- [x] **UI-01**: Horizontaler Slide-Container mit Swiper 12 (EffectCreative Uebergaenge)
- [x] **UI-02**: Dunkler Fullscreen-Hintergrund, farbige Akzente (Konfi: Lila, Teamer: Rosa)
- [x] **UI-03**: Animierte Zahlen (Count-up) und Fade-in Uebergaenge (CSS Animations)
- [x] **UI-04**: Progress-Indicator oben (Dots oder Balken wie Instagram Stories)
- [x] **UI-05**: Schliessen-Button (X) oben rechts
- [x] **UI-06**: Wrapped als Fullscreen-Modal (kein eigener Route, verhindert Swipe-Back-Konflikte)

### Share (SHR)

- [ ] **SHR-01**: Share-Button auf jedem Slide
- [ ] **SHR-02**: Bild-Export des aktuellen Slides (html-to-image, reine HTML/CSS Cards ohne Ionic-Komponenten)
- [ ] **SHR-03**: Natives Share-Sheet via Capacitor Share
- [ ] **SHR-04**: Text-Fallback wenn Bild-Export fehlschlaegt
- [ ] **SHR-05**: Share-Card Format 1080x1920 (Story-Format)
- [ ] **SHR-06**: Dezentes Wasserzeichen/Logo auf Share-Cards

### Dashboard-Integration (INT)

- [ ] **INT-01**: Konfi-Dashboard zeigt "Dein Wrapped ist da!" Card wenn verfuegbar
- [ ] **INT-02**: Teamer-Dashboard zeigt "Dein Teamer-Jahr!" Card wenn verfuegbar
- [ ] **INT-03**: Push-Notification wenn Wrapped freigeschaltet wird
- [ ] **INT-04**: Wrapped nur einmal pro Jahr/Zeitraum verfuegbar (kein erneutes Generieren)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Percentile/Vergleiche mit anderen | Datenschutz Minderjaehrige (DSG-EKD) |
| Oeffentliche Leaderboards | Privacy |
| KI-generierte Texte | Risiko/Aufwand |
| Wrapped-Party/Multiplayer | Overkill |
| Video-Export | Zu komplex, Bild reicht |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DAT-01 | Phase 75 | Complete |
| DAT-02 | Phase 75 | Complete |
| DAT-03 | Phase 75 | Complete |
| DAT-04 | Phase 75 | Complete |
| DAT-05 | Phase 75 | Complete |
| DAT-06 | Phase 75 | Complete |
| DAT-07 | Phase 75 | Complete |
| DAT-08 | Phase 75 | Complete |
| KS-01 | Phase 76 | Pending |
| KS-02 | Phase 76 | Pending |
| KS-03 | Phase 76 | Pending |
| KS-04 | Phase 76 | Pending |
| KS-05 | Phase 76 | Pending |
| KS-06 | Phase 76 | Pending |
| KS-07 | Phase 76 | Pending |
| KS-08 | Phase 76 | Pending |
| KS-09 | Phase 76 | Pending |
| UI-01 | Phase 76 | Complete |
| UI-02 | Phase 76 | Complete |
| UI-03 | Phase 76 | Complete |
| UI-04 | Phase 76 | Complete |
| UI-05 | Phase 76 | Complete |
| UI-06 | Phase 76 | Complete |
| TS-01 | Phase 77 | Pending |
| TS-02 | Phase 77 | Pending |
| TS-03 | Phase 77 | Pending |
| TS-04 | Phase 77 | Pending |
| TS-05 | Phase 77 | Pending |
| TS-06 | Phase 77 | Pending |
| TS-07 | Phase 77 | Pending |
| SHR-01 | Phase 78 | Pending |
| SHR-02 | Phase 78 | Pending |
| SHR-03 | Phase 78 | Pending |
| SHR-04 | Phase 78 | Pending |
| SHR-05 | Phase 78 | Pending |
| SHR-06 | Phase 78 | Pending |
| INT-01 | Phase 79 | Pending |
| INT-02 | Phase 79 | Pending |
| INT-03 | Phase 79 | Pending |
| INT-04 | Phase 79 | Pending |

**Coverage v2.3:**
- v2.3 requirements: 37 total
- Mapped to phases: 37
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
