# Requirements: Konfi Quest

**Defined:** 2026-03-24
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v2.8 Requirements

Requirements fuer Design-Polish. Jedes Item maps zu einer Roadmap-Phase.

### Teamer Dashboard

- [x] **TDB-01**: Zertifikate-Card Farbe Lila statt Rosa/Pink
- [x] **TDB-02**: Losung im Teamer-Dashboard sichtbar
- [x] **TDB-03**: Neue Badges markiert (Konfi-Dashboard-Pattern) mit Popover bei Klick

### Teamer Chat

- [x] **TCH-01**: Chat erstellen zeigt User-Liste korrekt an
- [x] **TCH-02**: Gruppenchats fuer Teamer:innen moeglich
- [x] **TCH-03**: Chat-Farbschema: Teamer/Team Rosa, Konfis Lila, Jahrgang Tuerkis
- [x] **TCH-04**: Chats werden zuverlaessig geladen

### Teamer Events

- [x] **TEV-01**: Suchleisten in Events + Badges ans Chat-Pattern (IonList inset + "Suche & Filter" Header)
- [x] **TEV-02**: MaterialModal Beschreibungstext groesser + Swipe-Back Fix nach Modal-Oeffnen
- [x] **TEV-03**: Buttons "Anwesend" / "Anwesenheit ausstehend" Stil anpassen
- [x] **TEV-04**: Material-Tab Beschreibungstext groesser

### Konfi Dashboard

- [x] **KDB-01**: Events-Card immer sichtbar (auch leer), Layout wie Teamer:innen, Aufforderung Event buchen
- [x] **KDB-02**: Events-Card Layout: Titel+Datum+Uhrzeit, Ort, Mitbringen auf eigenen Zeilen

### Konfi Chat

- [x] **KCH-01**: "Team"-Chat in korrekter Farbe

### Konfi Events

- [x] **KEV-01**: Event-Details Beschreibungstext groesser
- [x] **KEV-02**: Teilnehmer:innen-Liste Abstand zwischen Elementen reduzieren
- [x] **KEV-03**: Events-Suchleiste korrekte Breite + Position + "Suche & Filter" Zwischenueberschrift

### Konfi Badges

- [x] **KBD-01**: Zwischenueberschrift "Suche & Filter"
- [x] **KBD-02**: Badge-Kacheln immer gleich gross, 3 pro Zeile, Titel abschneiden
- [x] **KBD-03**: Popover-Breite dynamisch an Titel anpassen

### Konfi Aktivitaeten

- [x] **KAK-01**: Antrag-Modal: Kategorien-Auswahl komplett entfernen

### Konfi Historie

- [x] **KHI-01**: Punkte-Uebersicht + Badges als ausklappbare Akkordeons einbauen (kein Extra-Klick)
- [x] **KHI-02**: SectionHeader: "Fuer Uebersicht klicken" + zweite Stats-Zeile (Events, Bonus), "GD" statt "Gottesdienst"

### Konfi Profil

- [x] **KPR-01**: Punkte-Uebersicht SectionHeader wie Teamer:innen, 6 Stats breit (2 Reihen)
- [x] **KPR-02**: Bibeluebersetzung: neues Modal mit Erklaerungen zu Versionen statt einfache Liste

### Admin Aktivitaeten

- [x] **AAK-01**: Invalid Date Bug beheben
- [x] **AAK-02**: Modal Aktivitaeten hinzufuegen: Datumspicker korrigieren
- [x] **AAK-03**: Teamer:innen-Aktivitaeten im Modal anzeigen
- [x] **AAK-04**: Teamer:innen-Aktivitaeten erstellen ohne Punkte-Pflicht
- [x] **AAK-05**: Kategorien-Symbol korrekte Farbe in Liste

### Admin UI-Patterns

- [x] **AUI-01**: Slider: Wert stehen lassen, links/rechts Skala-Werte, Spannen tunen
- [x] **AUI-02**: Alle Listen-Cards gleicher Abstand oben/unten wie rechts/links

### Admin Teamer-Details

- [x] **ATD-01**: SectionHeader "Teamer:in" statt "Konfi", Rosa statt Lila, nur 3 Stats (Zerts, Events, Badges)

### Admin Zertifikate

- [x] **AZE-01**: Zertifikat-Zuweisen als volles Modal
- [x] **AZE-02**: Teamer-seit ordentlicher Datumspicker
- [x] **AZE-03**: Laufzeit eingeben, automatisch Start bei Vergabe
- [x] **AZE-04**: Icon-Picker: gepicktes Icon im Modal anzeigen (wie bei Badges)

### Admin Chat

- [x] **ACH-01**: Chat-Farblogik konsistent (Teamer Rosa, Konfi Lila, Jahrgang Tuerkis)
- [x] **ACH-02**: User-Liste beim Chat-Erstellen performant laden
- [x] **ACH-03**: Modal "Mitglieder hinzufuegen" korrektes Pattern (Haekchen, Umrandungen, Farben)
- [x] **ACH-04**: Poll-erstellen Modal: Abstaende rechts/links pruefen
- [x] **ACH-05**: Chat verlassen: Admins nicht erlauben + Hinweis-Text
- [x] **ACH-06**: Chat loeschen: Verhalten bei anderen Teilnehmer:innen pruefen und fixen

### Admin Events

- [x] **AEV-01**: Suchfeld korrekte Position + Zwischenueberschriften
- [x] **AEV-02**: Jahrgangs-Filter in Card mit Zwischenueberschrift formatieren
- [x] **AEV-03**: Event-Details: "Konfi hinzufuegen" statt "Kind hinzufuegen"
- [x] **AEV-04**: Event-Details: Chat-Button oben neben QR-Code mit "Chat erstellen?" Bestaetigung
- [x] **AEV-05**: Event-Details: Beschreibungstext groesser
- [x] **AEV-06**: Event-Absagen Action-Dialog verbessern (nicht nur eine Zeile)
- [x] **AEV-07**: Nach Event-Absage Seite reloaden, Event aus Liste entfernen
- [x] **AEV-08**: Abgesagtes Event loeschen: Push an angemeldete Konfis, Info "X Konfis angemeldet"

### Admin Bugs

- [x] **ABG-01**: Wartelisten-Nachruecken: Bei 3/2 gebucht soll erst bei unter Kapazitaet nachgerueckt werden
- [x] **ABG-02**: Chat aus Event oeffnen: schwarzer Screen beheben, Event-Chats pruefen

### Admin Antraege

- [x] **AAN-01**: Modal 1:1 wie bei Konfis mit Icons in Antragsdaten
- [x] **AAN-02**: Entscheidungs-Buttons: rot/gruen statt alte Buttons

### Admin Profil

- [x] **APR-01**: Blauton bei Modal-Erlaeuterungen an SectionHeader-Blau anpassen
- [x] **APR-02**: "App Info" entfernen

### Admin Dashboard

- [ ] **ADA-01**: Dashboard-Reihenfolge bei Admin und Konfi gleich
- [ ] **ADA-02**: Dashboard-Sektionen sortierbar machen (Konfi-Dashboard steuern)

### Admin Material

- [x] **AMA-01**: Jahrgangs-Tab-Leiste durch Dropdown mit Popover in Card mit Suche ersetzen
- [x] **AMA-02**: Suchleiste wie Chat-Pattern
- [x] **AMA-03**: "Ohne Event" Tab: Text korrigieren (Material vorhanden, nicht "Erstell dein erstes")
- [x] **AMA-04**: MaterialModal: Button "Datei auswaehlen" Abstand und Zentrierung fixen

### Admin Jahrgaenge

- [x] **AJG-01**: Datumspicker Endjahreszahl erhoehen (aktuell 2026, braucht 2028+)

## Future Requirements

### Badge-Erstellung (eigener Milestone)

- **BDG-01**: Badge-Erstellung komplett ueberarbeiten (zu komplex fuer Design-Polish)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Badges erstellen | Eigener Milestone — Logik zu komplex fuer Design-Polish |
| Onboarding-Flow | v3.0 |
| Landing Website | v3.0 |
| Staging-Umgebung | v3.1 |
| Test-Suite | v3.2 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUI-01 | Phase 94 | Complete |
| AUI-02 | Phase 94 | Complete |
| TCH-01 | Phase 95 | Complete |
| TCH-02 | Phase 95 | Complete |
| TCH-03 | Phase 95 | Complete |
| TCH-04 | Phase 95 | Complete |
| KCH-01 | Phase 95 | Complete |
| ACH-01 | Phase 95 | Complete |
| ACH-02 | Phase 95 | Complete |
| ACH-03 | Phase 95 | Complete |
| ACH-04 | Phase 95 | Complete |
| ACH-05 | Phase 95 | Complete |
| ACH-06 | Phase 95 | Complete |
| KDB-01 | Phase 96 | Complete |
| KDB-02 | Phase 96 | Complete |
| KEV-01 | Phase 96 | Complete |
| KEV-02 | Phase 96 | Complete |
| KEV-03 | Phase 96 | Complete |
| KBD-01 | Phase 96 | Complete |
| KBD-02 | Phase 96 | Complete |
| KBD-03 | Phase 96 | Complete |
| KAK-01 | Phase 96 | Complete |
| KHI-01 | Phase 96 | Complete |
| KHI-02 | Phase 96 | Complete |
| KPR-01 | Phase 96 | Complete |
| KPR-02 | Phase 96 | Complete |
| TDB-01 | Phase 97 | Complete |
| TDB-02 | Phase 97 | Complete |
| TDB-03 | Phase 97 | Complete |
| TEV-01 | Phase 97 | Complete |
| TEV-02 | Phase 97 | Complete |
| TEV-03 | Phase 97 | Complete |
| TEV-04 | Phase 97 | Complete |
| AAK-01 | Phase 98 | Complete |
| AAK-02 | Phase 98 | Complete |
| AAK-03 | Phase 98 | Complete |
| AAK-04 | Phase 98 | Complete |
| AAK-05 | Phase 98 | Complete |
| ATD-01 | Phase 98 | Complete |
| AAN-01 | Phase 98 | Complete |
| AAN-02 | Phase 98 | Complete |
| APR-01 | Phase 98 | Complete |
| APR-02 | Phase 98 | Complete |
| AJG-01 | Phase 98 | Complete |
| AEV-01 | Phase 99 | Complete |
| AEV-02 | Phase 99 | Complete |
| AEV-03 | Phase 99 | Complete |
| AEV-04 | Phase 99 | Complete |
| AEV-05 | Phase 99 | Complete |
| AEV-06 | Phase 99 | Complete |
| AEV-07 | Phase 99 | Complete |
| AEV-08 | Phase 99 | Complete |
| ABG-01 | Phase 99 | Complete |
| ABG-02 | Phase 99 | Complete |
| AZE-01 | Phase 100 | Complete |
| AZE-02 | Phase 100 | Complete |
| AZE-03 | Phase 100 | Complete |
| AZE-04 | Phase 100 | Complete |
| AMA-01 | Phase 100 | Complete |
| AMA-02 | Phase 100 | Complete |
| AMA-03 | Phase 100 | Complete |
| AMA-04 | Phase 100 | Complete |
| ADA-01 | Phase 100 | Pending |
| ADA-02 | Phase 100 | Pending |

**Coverage:**
- v2.8 Requirements: 64 total (Hinweis: urspruenglich als 51 angegeben, tatsaechlich 64 durch Zaehlung)
- Mapped to phases: 64
- Unmapped: 0

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after roadmap creation (Phase 94-100)*
