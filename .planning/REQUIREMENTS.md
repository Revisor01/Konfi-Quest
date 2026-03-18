# Requirements: Konfi Quest

**Defined:** 2026-03-09
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v1.8 Requirements

Requirements fuer Milestone v1.8 Teamer. Jedes Requirement mapped auf Roadmap-Phasen.

### Rolle + Transition (ROL)

- [x] **ROL-01**: Admin kann einen Konfi manuell zum Teamer befoerdern
- [x] **ROL-02**: Bei Transition bleiben Konfi-Badges als Historie erhalten
- [x] **ROL-03**: Bei Transition werden Konfi-Punkte und Level eingefroren (sichtbar aber nicht aktiv)
- [x] **ROL-04**: Teamer bekommt eigene TabBar-UI mit 5 Tabs (Dashboard, Events, Chat, Material, Profil)

### Dashboard (DSH)

- [x] **DSH-01**: Teamer sieht tageszeitabhaengige Begruessing im Dashboard
- [x] **DSH-02**: Teamer sieht Zertifikat-Anzeige (JuLeiCa, Teamer-Card mit Datum) prominent im Dashboard
- [x] **DSH-03**: Teamer sieht naechste anstehende Events im Dashboard
- [x] **DSH-04**: Teamer sieht eigene Badges-Sektion im Dashboard (wie bei Konfis)

### Events (EVT)

- [x] **EVT-01**: Admin kann bei Konfi-Events einen "Teamer gesucht"-Toggle setzen
- [x] **EVT-02**: Teamer sieht Events mit "Teamer gesucht" und kann sich einbuchen
- [x] **EVT-03**: Admin kann reine Teamer-Events erstellen (nur fuer Teamer sichtbar/buchbar)
- [x] **EVT-04**: Teamer kann Anwesenheit bei Events bestaetigen wo er eingeteilt ist
- [x] **EVT-05**: Teamer sieht alle fuer ihn relevanten Events (Teamer-gesucht + Teamer-Events)
- [ ] **EVT-06**: Events-Tab mit 3 Segmenten: Meine (gebucht), Alle (Jahrgangs-Uebersicht), Team (buchbar als Supporter + Teamer-Events)

### Badges + Aktivitaeten (BDG)

- [x] **BDG-01**: Admin kann Teamer-spezifische Aktivitaeten erstellen und manuell vergeben
- [x] **BDG-02**: Teamer-Badges vom Typ Aktivitaeten-Anzahl (X Aktivitaeten gesamt oder pro Kategorie)
- [x] **BDG-03**: Teamer-Badges vom Typ Event-Teilnahme (X Events gesamt oder pro Kategorie)
- [x] **BDG-04**: Teamer-Badges vom Typ Streak (X Events hintereinander)
- [x] **BDG-05**: Teamer-Badges vom Typ Sammel-Badge (alle Badges einer Gruppe)
- [x] **BDG-06**: Teamer-Badges vom Typ Jahres-Badge (aktiv im X. Teamer-Jahr)
- [x] **BDG-07**: Admin kann Teamer-Badge-Typen und Kriterien frei konfigurieren

### Zertifikate (ZRT)

- [x] **ZRT-01**: Admin kann Teamer Zertifikate zuweisen (JuLeiCa, Teamer-Card, etc.) mit Datum
- [x] **ZRT-02**: Zertifikate werden im Dashboard prominent angezeigt (aehnlich Konfi-Level-Anzeige)
- [x] **ZRT-03**: Zertifikat-Typen sind frei konfigurierbar durch Admin

### Material (MAT)

- [x] **MAT-01**: Admin oder Teamer kann Dateien hochladen (PDF, Bilder, Dokumente)
- [x] **MAT-02**: Material ist pro Jahrgang organisiert
- [x] **MAT-03**: Teamer sieht sortierte Materialliste und kann Dateien herunterladen

### Profil (PRF)

- [ ] **PRF-01**: Teamer kann Aktivitaets-Antraege stellen (wie Konfis)
- [x] **PRF-02**: Teamer sieht Badges-Uebersicht und Badge-Historie im Profil
- [x] **PRF-03**: Teamer sieht eingefrorene Konfi-Badges als Historie

### Chat (CHT)

- [ ] **CHT-01**: Teamer kann Chat-Raeume und Gruppen erstellen
- [ ] **CHT-02**: Teamer hat Zugriff auf bestehende Chat-Funktionalitaet (Nachrichten, Polls, Dateien)

## v1.9 Requirements

Requirements fuer Milestone v1.9 Bugfix + Polish. App produktionsreif machen.

### Push (PUSH)

- [x] **PUSH-01**: Admin erhaelt keine leeren Push-Benachrichtigungen mehr (Ghost-Push-Bug debuggen und fixen)

### Events (EVT-v19)

- [x] **EVT-v19-01**: Konfi sieht nur Events seines eigenen Jahrgangs (keine fremden Pflicht-Events, keine fremden Konfirmationen)
- [x] **EVT-v19-02**: Abgesagte Events werden nicht mehr in der Konfi-Event-Liste angezeigt
- [x] **EVT-v19-03**: Konfi kann sich nicht von Pflicht-Events abmelden bei denen er nicht angemeldet ist
- [x] **EVT-v19-04**: Neue Konfis in einem Jahrgang werden automatisch zu bestehenden Pflicht-Events des Jahrgangs hinzugefuegt
- [x] **EVT-v19-05**: Event absagen funktioniert aus der Admin-Ansicht
- [ ] **EVT-v19-06**: Teamer-only Events blenden Punkt-Typ, Teilnehmer-Limit, Warteliste und Jahrgangszuordnung aus
- [ ] **EVT-v19-07**: "Mitbringen" und "Pflicht" werden farbig hervorgehoben in Event-Liste und Details
- [x] **EVT-v19-08**: Konfi-Events zeigen "Meine" als erstes Segment
- [x] **EVT-v19-09**: Admin Event-Liste hat Jahrgangs-Filter und zeigt Jahrgang in den Listen-Details
- [x] **EVT-v19-10**: Admin Event-Details: "Teamer gesucht"-Hinweis entfaellt wenn Teamer-Anzahl bereits angezeigt wird
- [x] **EVT-v19-11**: Admin Event-Details: "Teamer hinzufuegen" zeigt nur Teamer, "Kind hinzufuegen" zeigt nur Konfis des Jahrgangs
- [x] **EVT-v19-12**: Aus einem Event kann ein Chat mit allen angemeldeten Konfis und Teamer:innen erstellt werden

### Punkte (PKT-v19)

- [ ] **PKT-v19-01**: Deaktivierter Punkt-Typ graut den anderen Toggle aus (mindestens ein Typ muss aktiv bleiben) mit Hinweis wie viele Konfis bereits Punkte haben
- [ ] **PKT-v19-02**: Admin-Konfi-Liste zeigt korrekte Gesamtpunkte (nur aktive Typen)
- [ ] **PKT-v19-03**: Bei nur einem aktiven Punkt-Typ wird ein breiter Statusbalken angezeigt (wie der Gesamtbalken bei zwei Typen)
- [ ] **PKT-v19-04**: Punkte-History Header zeigt korrekte Daten und besseres Layout fuer 6 Stats (Events, Bonus, Aktivitaeten, Gesamt, Gottesdienst, Gemeinde)

### UI (UI)

- [ ] **UI-01**: Toggle-Switches stehen rechts aussen in Jahrgang-Modal und Dashboard-Einstellungen
- [ ] **UI-02**: QR-Scanner-Button oben rechts (Header-Position) statt unten rechts FAB
- [ ] **UI-03**: Badge-Fortschritt ohne Nachkommastellen
- [ ] **UI-04**: Chat-Tab-Badge wird nicht abgeschnitten (z-index/Overflow korrigieren)
- [ ] **UI-05**: Badge-Modal: Auswahl ohne Umrandung, mit backgroundColor-Change Pattern (wie ueberall sonst)
- [ ] **UI-06**: Badge-Segment (Konfi/Teamer) unter dem Header positioniert, "Teamer:innen" nicht lila/fett bei Auswahl
- [ ] **UI-07**: Teamer-Badge-Ansicht 1:1 wie Konfi-Badge-Ansicht mit Segment-Wechsel (Teamer vorausgewaehlt)
- [ ] **UI-08**: Befoerdern-Button: Info-Hinweistext steht ueber dem Button

### Admin-Struktur (ADM)

- [ ] **ADM-01**: Zertifikat-Verwaltung als Unterseite im Inhalt-Bereich (nicht inline in Settings)
- [ ] **ADM-02**: Dashboard-Einstellungen als Unterseite im Inhalt-Bereich
- [ ] **ADM-03**: Badge-Verwaltung als Unterseite im Inhalt-Bereich, mit Typ-Abfrage (Konfi/Teamer) vor Badge-Erstellung
- [ ] **ADM-04**: Admin-Badge auf Events-Tab fuer Events die verbucht werden muessen
- [ ] **ADM-05**: Chat-Filter zeigt "Konfis" und "Team" statt "Admins"

### Teamer (TMR)

- [x] **TMR-01**: Teamer-Profil ordentlich gestalten (vollstaendige Profilansicht)

## v2 Requirements

Deferred. Nicht in aktuellem Roadmap.

### Teamer-Erweiterungen

- **TEX-01**: Teamer-Ranking untereinander (optional aktivierbar)
- **TEX-02**: Automatische Konfi-zu-Teamer Transition nach Jahrgangs-Ende
- **TEX-03**: Teamer-spezifische Push-Notification-Typen

## Out of Scope

| Feature | Reason |
|---------|--------|
| Teamer vergibt Punkte | Teamer ist kein Mini-Admin, Punkte sind Admin-Aufgabe |
| Teamer sieht Konfi-Uebersicht | Kein Zugriff auf Konfi-Management, nur eigene Events |
| Teamer erstellt Events | Event-Erstellung ist Admin-Aufgabe |
| Teamer verwaltet Kategorien/Jahrgaenge | Admin-Aufgabe, Teamer hat keinen Zugriff |
| Teamer genehmigt Antraege | Admin-Aufgabe |
| Eigenes Punkte-System fuer Teamer | Teamer sammeln Badges, keine Punkte |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROL-01 | Phase 38 | Complete |
| ROL-02 | Phase 38 | Complete |
| ROL-03 | Phase 38 | Complete |
| ROL-04 | Phase 38 | Complete |
| DSH-01 | Phase 41 | Complete |
| DSH-02 | Phase 41 | Complete |
| DSH-03 | Phase 41 | Complete |
| DSH-04 | Phase 41 | Complete |
| EVT-01 | Phase 39 | Complete |
| EVT-02 | Phase 39 | Complete |
| EVT-03 | Phase 39 | Complete |
| EVT-04 | Phase 39 | Complete |
| EVT-05 | Phase 39 | Complete |
| EVT-06 | Phase 39 | Pending |
| BDG-01 | Phase 40 | Complete |
| BDG-02 | Phase 40 | Complete |
| BDG-03 | Phase 40 | Complete |
| BDG-04 | Phase 40 | Complete |
| BDG-05 | Phase 40 | Complete |
| BDG-06 | Phase 40 | Complete |
| BDG-07 | Phase 40 | Complete |
| ZRT-01 | Phase 41 | Complete |
| ZRT-02 | Phase 41 | Complete |
| ZRT-03 | Phase 41 | Complete |
| MAT-01 | Phase 42 | Complete |
| MAT-02 | Phase 42 | Complete |
| MAT-03 | Phase 42 | Complete |
| PRF-01 | Phase 43 | Pending |
| PRF-02 | Phase 43 | Complete |
| PRF-03 | Phase 43 | Complete |
| CHT-01 | Phase 43 | Pending |
| CHT-02 | Phase 43 | Pending |

**Coverage v1.8:**
- v1.8 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

| Requirement | Phase | Status |
|-------------|-------|--------|
| PUSH-01 | Phase 44 | Complete |
| EVT-v19-01 | Phase 45 | Complete |
| EVT-v19-02 | Phase 45 | Complete |
| EVT-v19-03 | Phase 45 | Complete |
| EVT-v19-04 | Phase 45 | Complete |
| EVT-v19-05 | Phase 46 | Complete |
| EVT-v19-06 | Phase 46 | Pending |
| EVT-v19-07 | Phase 46 | Pending |
| EVT-v19-08 | Phase 45 | Complete |
| EVT-v19-09 | Phase 45 | Complete |
| EVT-v19-10 | Phase 46 | Complete |
| EVT-v19-11 | Phase 46 | Complete |
| EVT-v19-12 | Phase 46 | Complete |
| PKT-v19-01 | Phase 47 | Pending |
| PKT-v19-02 | Phase 47 | Pending |
| PKT-v19-03 | Phase 47 | Pending |
| PKT-v19-04 | Phase 47 | Pending |
| UI-01 | Phase 50 | Pending |
| UI-02 | Phase 50 | Pending |
| UI-03 | Phase 50 | Pending |
| UI-04 | Phase 50 | Pending |
| UI-05 | Phase 49 | Pending |
| UI-06 | Phase 49 | Pending |
| UI-07 | Phase 49 | Pending |
| UI-08 | Phase 50 | Pending |
| ADM-01 | Phase 48 | Pending |
| ADM-02 | Phase 48 | Pending |
| ADM-03 | Phase 48 | Pending |
| ADM-04 | Phase 48 | Pending |
| ADM-05 | Phase 48 | Pending |
| TMR-01 | Phase 51 | Complete |

**Coverage v1.9:**
- v1.9 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-13 after v1.9 roadmap creation*
