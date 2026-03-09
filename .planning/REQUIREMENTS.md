# Requirements: Konfi Quest

**Defined:** 2026-03-09
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v1.7 Requirements

Requirements fuer Milestone v1.7: Unterricht + Pflicht-Events.

### Pflicht-Events

- [x] **PFL-01**: Admin kann ein Event als "verpflichtend" markieren (mandatory-Toggle im EventModal)
- [x] **PFL-02**: Bei Pflicht-Event werden alle Konfis der zugewiesenen Jahrgaenge automatisch als angemeldet eingetragen (Auto-Enrollment)
- [x] **PFL-03**: Pflicht-Events vergeben keine Punkte (Punkte-Feld wird ausgeblendet/deaktiviert, Backend-Guard)
- [x] **PFL-04**: Konfis erhalten Push-Benachrichtigung wenn ein neues Pflicht-Event erstellt wird

### Opt-out

- [ ] **OPT-01**: Konfi kann sich von einem Pflicht-Event mit Freitext-Begruendung abmelden (Opt-out statt Abmeldung)
- [ ] **OPT-02**: Admin sieht alle Opt-out-Begruendungen in der Event-Teilnehmerliste
- [ ] **OPT-03**: Admin erhaelt Push-Benachrichtigung wenn ein Konfi sich von einem Pflicht-Event abmeldet

### QR-Check-in

- [ ] **QRC-01**: Admin kann einen signierten QR-Code pro Event generieren und im Fullscreen anzeigen
- [ ] **QRC-02**: Konfi kann QR-Code scannen und wird automatisch als "anwesend" markiert (Self-Check-in)
- [ ] **QRC-03**: QR-Code ist nur 30 Minuten vor bis 30 Minuten nach Event-Start gueltig (Zeitfenster)
- [ ] **QRC-04**: Admin kann Anwesenheit manuell korrigieren (present/absent), auch nach QR-Check-in

### Event-UI

- [x] **EUI-01**: Events haben ein optionales "Was mitbringen"-Textfeld, das in der Event-Detail-Ansicht angezeigt wird
- [ ] **EUI-02**: Dashboard zeigt Widget "Naechstes Event" mit Titel, Datum, Ort und Was-mitbringen-Info
- [ ] **EUI-03**: Dashboard-Widget ist ueber DashboardConfig (show_next_event Toggle) vom Org-Admin steuerbar

### Anwesenheitsstatistik

- [ ] **ANW-01**: Admin sieht pro Konfi eine Anwesenheitsquote fuer Pflicht-Events (X/Y anwesend, Prozent)
- [ ] **ANW-02**: Admin sieht pro Konfi eine Liste der verpassten Pflicht-Events mit Opt-out-Grund oder "Nicht erschienen"

## v2 Requirements

Zurueckgestellt fuer spaetere Milestones.

### Erweiterte Anwesenheit

- **ANW-03**: Jahrgangs-weite Anwesenheitsuebersicht (Tabelle aller Konfis mit Anwesenheitsquote)
- **ANW-04**: Anwesenheits-Badge-Kriterien (z.B. >=90% Anwesenheitsquote)
- **ANW-05**: Bulk-Attendance: Admin markiert mehrere Konfis gleichzeitig als present/absent

### QR-Erweiterungen

- **QRC-05**: QR-Code als druckbares PDF exportieren

### Event-Erweiterungen

- **EUI-04**: Opt-out-Frist (Abmeldung nur bis X Tage vor Event)
- **EUI-05**: Event duplizieren (Schnellerstellung aehnlicher Events)

## Out of Scope

| Feature | Reason |
|---------|--------|
| GPS/Geofencing Check-in | Zu komplex, Privacy-Bedenken, unzuverlaessig in Gebaeuden |
| Automatische Absent-Markierung | Gefaehrlich wenn Admin QR vergessen hat anzuzeigen |
| Eltern-Benachrichtigung bei Fehlen | DSGVO-komplex, braucht Eltern-Accounts |
| NFC Check-in | Hardware-Abhaengigkeit, nicht universell |
| Entschuldigung hochladen (Bild/PDF) | Dokumenten-Management zu komplex, Freitext reicht |
| Punkte fuer Pflicht-Events (optional) | Verwischt Trennung Pflicht=Anwesenheit, Freiwillig=Punkte |
| Wiederkehrende Events (Recurring) | Massiv komplex (Ausnahmen, einzelne Absagen), v1.8+ |
| Self-Check-in ohne QR (Button) | Trivial zu faelschen, QR beweist physische Anwesenheit |
| Konfi sieht eigene Anwesenheitsstatistik | Erzeugt Druck/Angst, Anwesenheit ist Admin-only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PFL-01 | Phase 34 | Complete |
| PFL-02 | Phase 34 | Complete |
| PFL-03 | Phase 34 | Complete |
| PFL-04 | Phase 34 | Complete |
| EUI-01 | Phase 34 | Complete |
| OPT-01 | Phase 35 | Pending |
| OPT-02 | Phase 35 | Pending |
| OPT-03 | Phase 35 | Pending |
| QRC-01 | Phase 36 | Pending |
| QRC-02 | Phase 36 | Pending |
| QRC-03 | Phase 36 | Pending |
| QRC-04 | Phase 36 | Pending |
| EUI-02 | Phase 37 | Pending |
| EUI-03 | Phase 37 | Pending |
| ANW-01 | Phase 37 | Pending |
| ANW-02 | Phase 37 | Pending |

**Coverage:**
- v1.7 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after roadmap creation*
