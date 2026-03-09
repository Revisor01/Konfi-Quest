# Requirements: Konfi Quest

**Defined:** 2026-03-09
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v1.8 Requirements

Requirements fuer Milestone v1.8 Teamer. Jedes Requirement mapped auf Roadmap-Phasen.

### Rolle + Transition (ROL)

- [ ] **ROL-01**: Admin kann einen Konfi manuell zum Teamer befoerdern
- [ ] **ROL-02**: Bei Transition bleiben Konfi-Badges als Historie erhalten
- [ ] **ROL-03**: Bei Transition werden Konfi-Punkte und Level eingefroren (sichtbar aber nicht aktiv)
- [ ] **ROL-04**: Teamer bekommt eigene TabBar-UI mit 5 Tabs (Dashboard, Events, Chat, Material, Profil)

### Dashboard (DSH)

- [ ] **DSH-01**: Teamer sieht tageszeitabhaengige Begruessing im Dashboard
- [ ] **DSH-02**: Teamer sieht Zertifikat-Anzeige (JuLeiCa, Teamer-Card mit Datum) prominent im Dashboard
- [ ] **DSH-03**: Teamer sieht naechste anstehende Events im Dashboard
- [ ] **DSH-04**: Teamer sieht eigene Badges-Sektion im Dashboard (wie bei Konfis)

### Events (EVT)

- [ ] **EVT-01**: Admin kann bei Konfi-Events einen "Teamer gesucht"-Toggle setzen
- [ ] **EVT-02**: Teamer sieht Events mit "Teamer gesucht" und kann sich einbuchen
- [ ] **EVT-03**: Admin kann reine Teamer-Events erstellen (nur fuer Teamer sichtbar/buchbar)
- [ ] **EVT-04**: Teamer kann Anwesenheit bei Events bestaetigen wo er eingeteilt ist
- [ ] **EVT-05**: Teamer sieht alle fuer ihn relevanten Events (Teamer-gesucht + Teamer-Events)
- [ ] **EVT-06**: Events-Tab mit 3 Segmenten: Meine (gebucht), Alle (Jahrgangs-Uebersicht), Team (buchbar als Supporter + Teamer-Events)

### Badges + Aktivitaeten (BDG)

- [ ] **BDG-01**: Admin kann Teamer-spezifische Aktivitaeten erstellen und manuell vergeben
- [ ] **BDG-02**: Teamer-Badges vom Typ Aktivitaeten-Anzahl (X Aktivitaeten gesamt oder pro Kategorie)
- [ ] **BDG-03**: Teamer-Badges vom Typ Event-Teilnahme (X Events gesamt oder pro Kategorie)
- [ ] **BDG-04**: Teamer-Badges vom Typ Streak (X Events hintereinander)
- [ ] **BDG-05**: Teamer-Badges vom Typ Sammel-Badge (alle Badges einer Gruppe)
- [ ] **BDG-06**: Teamer-Badges vom Typ Jahres-Badge (aktiv im X. Teamer-Jahr)
- [ ] **BDG-07**: Admin kann Teamer-Badge-Typen und Kriterien frei konfigurieren

### Zertifikate (ZRT)

- [ ] **ZRT-01**: Admin kann Teamer Zertifikate zuweisen (JuLeiCa, Teamer-Card, etc.) mit Datum
- [ ] **ZRT-02**: Zertifikate werden im Dashboard prominent angezeigt (aehnlich Konfi-Level-Anzeige)
- [ ] **ZRT-03**: Zertifikat-Typen sind frei konfigurierbar durch Admin

### Material (MAT)

- [ ] **MAT-01**: Admin oder Teamer kann Dateien hochladen (PDF, Bilder, Dokumente)
- [ ] **MAT-02**: Material ist pro Jahrgang organisiert
- [ ] **MAT-03**: Teamer sieht sortierte Materialliste und kann Dateien herunterladen

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
| ROL-01 | Phase 38 | Pending |
| ROL-02 | Phase 38 | Pending |
| ROL-03 | Phase 38 | Pending |
| ROL-04 | Phase 38 | Pending |
| DSH-01 | Phase 41 | Pending |
| DSH-02 | Phase 41 | Pending |
| DSH-03 | Phase 41 | Pending |
| DSH-04 | Phase 41 | Pending |
| EVT-01 | Phase 39 | Pending |
| EVT-02 | Phase 39 | Pending |
| EVT-03 | Phase 39 | Pending |
| EVT-04 | Phase 39 | Pending |
| EVT-05 | Phase 39 | Pending |
| EVT-06 | Phase 39 | Pending |
| BDG-01 | Phase 40 | Pending |
| BDG-02 | Phase 40 | Pending |
| BDG-03 | Phase 40 | Pending |
| BDG-04 | Phase 40 | Pending |
| BDG-05 | Phase 40 | Pending |
| BDG-06 | Phase 40 | Pending |
| BDG-07 | Phase 40 | Pending |
| ZRT-01 | Phase 41 | Pending |
| ZRT-02 | Phase 41 | Pending |
| ZRT-03 | Phase 41 | Pending |
| MAT-01 | Phase 42 | Pending |
| MAT-02 | Phase 42 | Pending |
| MAT-03 | Phase 42 | Pending |
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
