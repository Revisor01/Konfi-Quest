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
- [ ] **PRF-02**: Teamer sieht Badges-Uebersicht und Badge-Historie im Profil
- [ ] **PRF-03**: Teamer sieht eingefrorene Konfi-Badges als Historie

### Chat (CHT)

- [ ] **CHT-01**: Teamer kann Chat-Raeume und Gruppen erstellen
- [ ] **CHT-02**: Teamer hat Zugriff auf bestehende Chat-Funktionalitaet (Nachrichten, Polls, Dateien)

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
| PRF-02 | Phase 43 | Pending |
| PRF-03 | Phase 43 | Pending |
| CHT-01 | Phase 43 | Pending |
| CHT-02 | Phase 43 | Pending |

**Coverage:**
- v1.8 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after roadmap creation*
