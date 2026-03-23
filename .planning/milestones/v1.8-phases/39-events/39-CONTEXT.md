# Phase 39: Events - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Teamer:innen können sich für Events einbuchen und sehen alle relevanten Events in einem strukturierten Tab mit 3 Segmenten (Meine, Alle, Team). Admin kann Events für Teamer:innen öffnen oder reine Teamer-Events erstellen. Teamer:innen bestätigen Anwesenheit per QR-Code Check-in.

</domain>

<decisions>
## Implementation Decisions

### Segment-Aufteilung (Teamer Events-Tab)
- 3 Segmente: Meine / Alle / Team
- **Meine:** Alle Events wo Teamer:in dabei ist (selbst gebucht oder vom Admin zugewiesen)
- **Alle:** Alle Jahrgangs-Events — auch reine Konfi-Events sichtbar (aber nicht buchbar für Teamer:innen)
- **Team:** Alle für Teamer:innen buchbare Events gemischt (sowohl "Teamer gesucht"-Konfi-Events als auch reine Teamer-Events)
- Sortierung: Chronologisch (nächstes Event zuerst) in allen Segmenten
- Vergangene Events bleiben sichtbar mit Anwesenheitsstatus (wie bei Konfis)
- Kompakter Header mit Stats-Row (Gesamt/Anstehend/Gebucht) wie bei Konfi-EventsView

### Buchungs-Flow Teamer:innen
- Vereinfacht: Dabei oder nicht — kein Timeslot, keine Warteliste
- Teamer:in klickt "Ich bin dabei" / "Nicht mehr dabei"
- Jederzeit austragbar (keine Frist)
- Admin kann Teamer:innen auch direkt zu Events hinzufügen
- Bei zu vielen Anmeldungen: Admin entfernt manuell
- Push-Benachrichtigung an Admin bei Ein-/Austragung von Teamer:innen

### Anwesenheitsbestätigung
- QR-Code Check-in wie bei Konfis — gleicher QR-Code pro Event
- QRScannerModal wird 1:1 wiederverwendet
- Backend prüft qr_token und verbucht Anwesenheit auch für Teamer-Buchungen

### Admin-Seite: Event-Konfiguration
- Toggle im Event-Erstellungs-/Bearbeitungsformular (kann jederzeit geändert werden)
- 3 Zustände pro Event:
  1. **Normal** (Standard): Nur Konfis sehen/buchen
  2. **Teamer:innen gesucht**: Konfis UND Teamer:innen sehen es, beide können buchen
  3. **Nur für Teamer:innen**: Nur Teamer:innen sehen/buchen, kein Konfi-Zugang
- Zustände schließen sich gegenseitig aus (kein gleichzeitiges "Teamer gesucht" + "Nur Teamer")
- Admin sieht in Event-Teilnehmerliste getrennte Sektionen: "Konfis (12)" und "Teamer:innen (3)"

### Event-Darstellung für Teamer:innen
- Layout und Struktur 1:1 wie bei Konfis und Admin — gleiche CSS-Klassen, gleiche Komponenten-Patterns
- Event-Karte zeigt: Name, Datum, Uhrzeit, Ort, Status + Anzahl angemeldeter Teamer:innen und Konfis
- Corner Badge oben rechts mit "TEAM" bei Events die für Teamer:innen offen sind (bestehendes CSS-Pattern nutzen)
- Event-Detail-Ansicht: Gleich wie Konfis + zusätzlich Teamer:innen-Infos (Namensliste der angemeldeten Teamer:innen)
- Vereinfachter Buchungsbereich: "Dabei" / "Nicht dabei"-Button statt Timeslot-Auswahl

### Sprache & Schreibweise
- IMMER echte Umlaute: äöüß
- IMMER gendern: Teamer:innen, Teilnehmer:innen etc.
- "Konfis" ist bereits Plural, wird NICHT gegendert
- Design-Patterns und CSS-Klassen aus bestehendem Code verwenden

### Claude's Discretion
- Genaue Implementierung der DB-Spalten für Event-Zustände (teamer_needed, teamer_only o.ä.)
- Stats-Row Werte pro Segment (welche Zähler angezeigt werden)
- Fehlermeldungen und Edge-Case-Handling
- Push-Nachricht Format/Text

</decisions>

<specifics>
## Specific Ideas

- "Layout und Struktur darf kein Unterschied sein zu Konfis und Admin — dafür haben wir alles im CSS vorbereitet"
- Corner Badge oben rechts mit "TEAM" — bestehendes zweites Corner Badge CSS-Pattern nutzen
- Teamer:innen-Buchung ist bewusst simpel gehalten: "Wer helfen will soll helfen"
- Admin kann Teamer:innen direkt zu Events hinzufügen (gleich wie bei Konfis)
- Gleicher QR-Code für Konfis und Teamer:innen beim Check-in

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EventsView.tsx` (Konfi): 3-Segment-Pattern mit IonSegment, Stats-Row, Event-Karten — als 1:1-Vorlage
- `EventDetailView.tsx`: Event-Detail-Ansicht — wiederverwendbar mit Teamer:innen-Erweiterung
- `QRScannerModal`: QR-Code Check-in Komponente — 1:1 wiederverwendbar
- `EmptyState` Shared Component: Für leere Segmente
- `SectionHeader`, `ListSection`: Shared Components aus EventsView
- CSS Corner Badge Pattern: Zweites Badge oben rechts für "TEAM"-Kennzeichnung
- `TeamerEventsPage.tsx`: EmptyState-Platzhalter — wird zur vollständigen Events-Seite

### Established Patterns
- `MainTabs.tsx`: Teamer-Routing bereits implementiert (Phase 38)
- `events.js` Backend: Vollständige Event-CRUD mit Teamer-Jahrgang-Filterung bereits vorhanden
- `event_bookings` Tabelle: Buchungssystem mit Status (confirmed, waitlist, opted_out)
- `useIonModal` Hook: Für alle Modals
- Kompakter Header-Style: Icon + Titel inline, Stats-Row darunter

### Integration Points
- `backend/routes/events.js`: Teamer-Jahrgang-Filter bereits implementiert (Zeile 91), muss um Teamer-Buchungslogik erweitert werden
- `events` DB-Tabelle: Neue Spalten für teamer_needed/teamer_only Zustände
- Event-Erstellungsformular (Admin): Toggle-Felder für Teamer-Konfiguration
- Push-Notification System: Neue Events für Teamer:innen-Buchungen

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 39-events*
*Context gathered: 2026-03-10*
