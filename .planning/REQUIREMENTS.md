# Requirements: Konfi Quest

**Defined:** 2026-03-24
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v2.8 Requirements

Requirements fuer Design-Polish. Jedes Item maps zu einer Roadmap-Phase.

### Teamer Dashboard

- [ ] **TDB-01**: Zertifikate-Card Farbe Lila statt Rosa/Pink
- [ ] **TDB-02**: Losung im Teamer-Dashboard sichtbar
- [ ] **TDB-03**: Neue Badges markiert (Konfi-Dashboard-Pattern) mit Popover bei Klick

### Teamer Chat

- [ ] **TCH-01**: Chat erstellen zeigt User-Liste korrekt an
- [ ] **TCH-02**: Gruppenchats fuer Teamer:innen moeglich
- [ ] **TCH-03**: Chat-Farbschema: Teamer/Team Rosa, Konfis Lila, Jahrgang Tuerkis
- [ ] **TCH-04**: Chats werden zuverlaessig geladen

### Teamer Events

- [ ] **TEV-01**: Suchleisten in Events + Badges ans Chat-Pattern (IonList inset + "Suche & Filter" Header)
- [ ] **TEV-02**: MaterialModal Beschreibungstext groesser + Swipe-Back Fix nach Modal-Oeffnen
- [ ] **TEV-03**: Buttons "Anwesend" / "Anwesenheit ausstehend" Stil anpassen
- [ ] **TEV-04**: Material-Tab Beschreibungstext groesser

### Konfi Dashboard

- [ ] **KDB-01**: Events-Card immer sichtbar (auch leer), Layout wie Teamer:innen, Aufforderung Event buchen
- [ ] **KDB-02**: Events-Card Layout: Titel+Datum+Uhrzeit, Ort, Mitbringen auf eigenen Zeilen

### Konfi Chat

- [ ] **KCH-01**: "Team"-Chat in korrekter Farbe

### Konfi Events

- [ ] **KEV-01**: Event-Details Beschreibungstext groesser
- [ ] **KEV-02**: Teilnehmer:innen-Liste Abstand zwischen Elementen reduzieren
- [ ] **KEV-03**: Events-Suchleiste korrekte Breite + Position + "Suche & Filter" Zwischenueberschrift

### Konfi Badges

- [ ] **KBD-01**: Zwischenueberschrift "Suche & Filter"
- [ ] **KBD-02**: Badge-Kacheln immer gleich gross, 3 pro Zeile, Titel abschneiden
- [ ] **KBD-03**: Popover-Breite dynamisch an Titel anpassen

### Konfi Aktivitaeten

- [ ] **KAK-01**: Antrag-Modal: Kategorien-Auswahl komplett entfernen

### Konfi Historie

- [ ] **KHI-01**: Punkte-Uebersicht + Badges als ausklappbare Akkordeons einbauen (kein Extra-Klick)
- [ ] **KHI-02**: SectionHeader: "Fuer Uebersicht klicken" + zweite Stats-Zeile (Events, Bonus), "GD" statt "Gottesdienst"

### Konfi Profil

- [ ] **KPR-01**: Punkte-Uebersicht SectionHeader wie Teamer:innen, 6 Stats breit (2 Reihen)
- [ ] **KPR-02**: Bibeluebersetzung: neues Modal mit Erklaerungen zu Versionen statt einfache Liste

### Admin Aktivitaeten

- [ ] **AAK-01**: Invalid Date Bug beheben
- [ ] **AAK-02**: Modal Aktivitaeten hinzufuegen: Datumspicker korrigieren
- [ ] **AAK-03**: Teamer:innen-Aktivitaeten im Modal anzeigen
- [ ] **AAK-04**: Teamer:innen-Aktivitaeten erstellen ohne Punkte-Pflicht
- [ ] **AAK-05**: Kategorien-Symbol korrekte Farbe in Liste

### Admin UI-Patterns

- [ ] **AUI-01**: Slider: Wert stehen lassen, links/rechts Skala-Werte, Spannen tunen
- [ ] **AUI-02**: Alle Listen-Cards gleicher Abstand oben/unten wie rechts/links

### Admin Teamer-Details

- [ ] **ATD-01**: SectionHeader "Teamer:in" statt "Konfi", Rosa statt Lila, nur 3 Stats (Zerts, Events, Badges)

### Admin Zertifikate

- [ ] **AZE-01**: Zertifikat-Zuweisen als volles Modal
- [ ] **AZE-02**: Teamer-seit ordentlicher Datumspicker
- [ ] **AZE-03**: Laufzeit eingeben, automatisch Start bei Vergabe
- [ ] **AZE-04**: Icon-Picker: gepicktes Icon im Modal anzeigen (wie bei Badges)

### Admin Chat

- [ ] **ACH-01**: Chat-Farblogik konsistent (Teamer Rosa, Konfi Lila, Jahrgang Tuerkis)
- [ ] **ACH-02**: User-Liste beim Chat-Erstellen performant laden
- [ ] **ACH-03**: Modal "Mitglieder hinzufuegen" korrektes Pattern (Haekchen, Umrandungen, Farben)
- [ ] **ACH-04**: Poll-erstellen Modal: Abstaende rechts/links pruefen
- [ ] **ACH-05**: Chat verlassen: Admins nicht erlauben + Hinweis-Text
- [ ] **ACH-06**: Chat loeschen: Verhalten bei anderen Teilnehmer:innen pruefen und fixen

### Admin Events

- [ ] **AEV-01**: Suchfeld korrekte Position + Zwischenueberschriften
- [ ] **AEV-02**: Jahrgangs-Filter in Card mit Zwischenueberschrift formatieren
- [ ] **AEV-03**: Event-Details: "Konfi hinzufuegen" statt "Kind hinzufuegen"
- [ ] **AEV-04**: Event-Details: Chat-Button oben neben QR-Code mit "Chat erstellen?" Bestaetigung
- [ ] **AEV-05**: Event-Details: Beschreibungstext groesser
- [ ] **AEV-06**: Event-Absagen Action-Dialog verbessern (nicht nur eine Zeile)
- [ ] **AEV-07**: Nach Event-Absage Seite reloaden, Event aus Liste entfernen
- [ ] **AEV-08**: Abgesagtes Event loeschen: Push an angemeldete Konfis, Info "X Konfis angemeldet"

### Admin Bugs

- [ ] **ABG-01**: Wartelisten-Nachruecken: Bei 3/2 gebucht soll erst bei unter Kapazitaet nachgerueckt werden
- [ ] **ABG-02**: Chat aus Event oeffnen: schwarzer Screen beheben, Event-Chats pruefen

### Admin Antraege

- [ ] **AAN-01**: Modal 1:1 wie bei Konfis mit Icons in Antragsdaten
- [ ] **AAN-02**: Entscheidungs-Buttons: rot/gruen statt alte Buttons

### Admin Profil

- [ ] **APR-01**: Blauton bei Modal-Erlaeuterungen an SectionHeader-Blau anpassen
- [ ] **APR-02**: "App Info" entfernen

### Admin Dashboard

- [ ] **ADA-01**: Dashboard-Reihenfolge bei Admin und Konfi gleich
- [ ] **ADA-02**: Dashboard-Sektionen sortierbar machen (Konfi-Dashboard steuern)

### Admin Material

- [ ] **AMA-01**: Jahrgangs-Tab-Leiste durch Dropdown mit Popover in Card mit Suche ersetzen
- [ ] **AMA-02**: Suchleiste wie Chat-Pattern
- [ ] **AMA-03**: "Ohne Event" Tab: Text korrigieren (Material vorhanden, nicht "Erstell dein erstes")
- [ ] **AMA-04**: MaterialModal: Button "Datei auswaehlen" Abstand und Zentrierung fixen

### Admin Jahrgaenge

- [ ] **AJG-01**: Datumspicker Endjahreszahl erhoehen (aktuell 2026, braucht 2028+)

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
| (wird durch Roadmap gefuellt) | | |

**Coverage:**
- v2.8 Requirements: 51 total
- Mapped to phases: 0
- Unmapped: 51

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 after initial definition*
