# Phase 36: QR-Code Check-in - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Anwesenheitserfassung per QR-Code-Scan fuer ALLE Events (Pflicht und freiwillig). Admin zeigt QR-Code an, Konfi scannt mit In-App-Kamera. Zeitfenster-Validierung und manuelle Admin-Korrektur als Fallback. Punkte-Vergabe-Logik bleibt unveraendert (present -> Punkte bei nicht-mandatory Events).

</domain>

<decisions>
## Implementation Decisions

### QR-Code Inhalt + Sicherheit
- Signierter JWT-Token (Event-ID + Zeitstempel + HMAC-SHA256 Signatur)
- Token wird einmalig pro Event generiert und in der DB gespeichert (Spalte auf events-Tabelle)
- Kein Reset/Regenerieren moeglich — einmal generiert = fix
- Ein Scan pro Konfi: Backend prueft ob bereits eingecheckt, Duplikat wird ignoriert
- Nur angemeldete Konfis (status = confirmed) koennen einchecken — keine Auto-Buchung
- Konfis mit opted_out Status werden abgelehnt
- QR-Check-in ist fuer ALLE Event-Typen verfuegbar (Pflicht und freiwillig)

### Scanner-UX (Konfi)
- In-App Kamera-Scanner (NICHT Standard-Kamera-App)
- Scanner oeffnet als Fullscreen-Modal (useIonModal)
- Zwei Einstiegspunkte: Button "Einchecken" in Konfi-EventDetailView UND FAB auf Konfi-EventsView
- Fehlermeldungen inline im Scanner (roter Banner), Scanner bleibt offen
- Bei "bereits eingecheckt": blauer Info-Banner statt roter Fehler
- Nach erfolgreichem Scan: Scanner schliesst, EventDetailView zeigt gruenen "Anwesend"-Status
- Bei FAB-Einstieg: Event wird aus QR erkannt, EventDetailView oeffnet sich mit Status

### Admin QR-Anzeige
- Button "QR-Code anzeigen" in Admin-EventDetailView
- Oeffnet Fullscreen-Modal mit: Event-Name, Datum/Uhrzeit, grosser QR-Code, Hinweistext
- Live-Zaehler unter QR-Code: "X/Y eingecheckt" mit Polling (alle 10 Sekunden)
- Beamer-tauglich (grosser QR, minimales UI drumherum)

### Manuelle Korrektur
- Bestehende Tap -> ActionSheet -> Anwesend/Abwesend Logik bleibt unveraendert
- QR-Scan nutzt den gleichen handleAttendanceUpdate/Backend-Mechanismus
- Keine Aenderungen an der Admin-Teilnehmerliste noetig

### Zeitfenster
- Bezieht sich auf event_date (Hauptdatum), NICHT auf einzelne Timeslots
- Konfigurierbar pro Event: neues Feld "Check-in-Fenster" (Integer, Minuten)
- Default: 30 Minuten (vorausgefuellt im EventModal, aenderbar)
- Bedeutung: X Minuten VOR und X Minuten NACH Event-Start
- Scan ausserhalb Zeitfenster: Fehlermeldung im Scanner ("Check-in ist erst ab [Uhrzeit] moeglich" / "Check-in-Zeitraum ist abgelaufen")

### Punkte-Logik
- KEINE Aenderung: Punkte werden bei attendance_status = 'present' vergeben (bestehende Logik in events.js:1440)
- QR-Scan ist nur ein neuer Weg, present zu setzen — gleicher Backend-Mechanismus
- Pflicht-Events: keine Punkte (mandatory Guard bleibt)
- Freiwillige Events: Punkte bei present (egal ob QR oder manuell)

### Claude's Discretion
- Wahl der QR-Scanner-Library (jsqr, qr-scanner, oder html5-qrcode)
- Polling-Implementierung fuer Live-Zaehler (setInterval vs. useEffect)
- Genaues JWT-Token-Format und Signatur-Secret-Handling
- Camera-Permission-Handling und Fallback bei Ablehnung
- Capacitor-Plugin-Konfiguration fuer Kamera-Zugriff

</decisions>

<specifics>
## Specific Ideas

- Scanner soll sich anfuehlen wie ein nativer QR-Scanner (Kamera-Preview mit Scan-Rahmen)
- QR-Modal fuer Admin soll beamer-freundlich sein (weisser Hintergrund, grosser Code)
- Fehlermeldungen im Scanner sollen klar und auf Deutsch sein

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `qrcode` v1.5.4: QR-Code Generator bereits installiert — fuer Admin QR-Generierung nutzen
- `@capacitor/camera` v7.0.1: Kamera-Plugin bereits installiert
- `handleAttendanceUpdate()` in Admin-EventDetailView: bestehende Attendance-Logik mit optimistischem UI-Update
- `showAttendanceActionSheet()`: bestehende manuelle Korrektur-UI
- IonItemSliding + ActionSheet Pattern: bewaehertes Teilnehmer-Management
- IonIcon `qrCode`/`qrCodeOutline`: QR-Icons verfuegbar
- SectionHeader, LoadingSpinner: wiederverwendbare Shared Components

### Established Patterns
- useIonModal Hook fuer alle Modals (NIEMALS IonModal isOpen)
- Optimistisches UI-Update bei Attendance-Aenderungen (sofort anzeigen, Rollback bei Fehler)
- AppContext setSuccess/setError fuer Feedback
- Corner-Badges mit Farb-Klassen (success/danger/info/warning)
- IonItemSliding mit Swipe-Actions fuer Teilnehmer-Aktionen
- API-Service (axios-basiert) fuer Backend-Calls

### Integration Points
- Backend: PUT `/events/:id/participants/:participantId/attendance` — bestehende Route, QR-Check-in nutzt gleichen Mechanismus
- DB: `event_bookings.attendance_status` (present/absent) bereits vorhanden
- DB: `events` Tabelle braucht neue Spalten: `qr_token` (TEXT) und `checkin_window` (INTEGER, Default 30)
- Frontend: Konfi-EventDetailView braucht QR-Scanner-Button und Anwesend-Status-Anzeige
- Frontend: Konfi-EventsView braucht FAB fuer Scanner
- Frontend: Admin-EventDetailView braucht QR-Code-Anzeige-Button
- Frontend: Admin-EventModal braucht Check-in-Fenster-Feld
- Capacitor: Camera-Permissions muessen konfiguriert werden (iOS Info.plist, Android Manifest)
- Scanner-Library muss hinzugefuegt werden (qrcode Lib ist nur Generator, kein Scanner)

</code_context>

<deferred>
## Deferred Ideas

- Onboarding-QR-Scanner auf In-App-Scanner umstellen (aktuell Standard-Kamera via Deep Link) — einheitliches Scanner-Erlebnis
- QR-Code als druckbares PDF exportieren (QRC-05, v2 Requirement)

</deferred>

---

*Phase: 36-qr-code-check-in*
*Context gathered: 2026-03-09*
