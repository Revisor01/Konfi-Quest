# Feature Landscape: Pflicht-Events, QR-Check-in, Anwesenheitsstatistik v1.7

**Domain:** Pflicht-Event-Verwaltung mit Anwesenheits-Tracking fuer Konfirmanden-App
**Researched:** 2026-03-09
**Confidence:** HIGH (Codebase vollstaendig analysiert, UX-Patterns aus Church/School-Management-Tools verifiziert)

## Ist-Zustand Analyse

### Event-System (bestehend)

| Komponente | Status | Details |
|-----------|--------|---------|
| Event-CRUD | Fertig | Titel, Datum, Endzeit, Ort, Maps-URL, Beschreibung, Kategorien, Punkte, Punkt-Typ |
| Opt-in Buchung | Fertig | `event_bookings` mit status `confirmed`/`waitlist`/`pending` |
| Abmeldung mit Grund | Fertig | `UnregisterModal` mit Freitext-Pflichtfeld, 2-Tage-Frist |
| Timeslots | Fertig | `event_timeslots` Tabelle, ActionSheet-Auswahl |
| Warteliste | Fertig | `waitlist_enabled`, `max_waitlist_size`, Nachrueck-Logik |
| Registrierungsfenster | Fertig | `registration_opens_at`, `registration_closes_at` |
| Attendance-Tracking (Admin) | Fertig | `attendance_status` auf `event_bookings` (`present`/`absent`/NULL) |
| Punkte-Vergabe | Fertig | Automatisch bei `present`, Abzug bei `absent`, transaktionssicher |
| Jahrgang-Zuweisung | Fertig | `event_jahrgang_assignments` -- Events fuer bestimmte Jahrgaenge |
| Push-Erinnerungen | Fertig | 24h + 1h vor Event via `backgroundService.js` |
| Dashboard-Events | Fertig | `show_events` Toggle in `DashboardConfig` (5 Widget-Toggles) |
| Kategorien | Fertig | `event_categories` Verknuepfungstabelle |

### Was FEHLT fuer v1.7

| Fehlend | Auswirkung |
|---------|-----------|
| Pflicht-Flag auf Events | Alle Events sind opt-in, keine Auto-Enrollment-Logik |
| QR-Code Check-in | Attendance nur manuell durch Admin in Teilnehmerliste |
| "Was mitbringen" Feld | Kein strukturiertes Feld, nur Freitext in `description` |
| Naechstes-Event Widget | Dashboard zeigt nur angemeldete Events, kein prominentes naechstes Event |
| Pro-Konfi Anwesenheitsstatistik | Keine aggregierte Anwesenheits-Uebersicht pro Konfi |
| Opt-out statt Opt-in fuer Pflicht-Events | Konfi muss sich aktiv anmelden, kein Auto-Enrollment |

## Table Stakes

Features ohne die v1.7 unvollstaendig ist.

| Feature | Warum erwartet | Komplexitaet | Abhaengigkeiten | Notes |
|---------|---------------|-------------|-----------------|-------|
| Pflicht-Flag (`mandatory`) auf Events | Kern-Anforderung: Unterscheidung Pflicht vs. freiwillig. Bestimmt gesamte Buchungs-Logik | Low | `events` Tabelle: neue Spalte `mandatory BOOLEAN DEFAULT false` | Nur im EventModal als Toggle, aendert Buchungs-Flow komplett |
| Auto-Enrollment aller Jahrgangs-Konfis | Bei mandatory=true: Alle Konfis der zugewiesenen Jahrgaenge werden automatisch als `confirmed` eingetragen | Med | `event_jahrgang_assignments` (schon da), `konfi_profiles.jahrgang_id`, `event_bookings` | Beim Event-Erstellen/-Bearbeiten: INSERT INTO event_bookings fuer alle Konfis des Jahrgangs. Neue Konfis im Jahrgang? -> Trigger oder manueller Sync |
| Opt-out mit Freitext-Begruendung | Bei Pflicht-Events: Konfis sind angemeldet, koennen sich mit Grund abmelden. Admin sieht Gruende | Med | `event_bookings`: neue Spalte `opt_out_reason TEXT`, Status wechselt zu `opted_out` | Bestehender `UnregisterModal` kann erweitert werden. Wichtig: Opt-out ist NICHT gleich "absent" -- Konfi meldet sich VOR dem Event ab |
| Keine Punkte fuer Pflicht-Events | Pflicht-Events tracken nur Anwesenheit, vergeben KEINE Punkte | Low | Backend: `events.points` = 0 bei mandatory, oder Guard in Attendance-Route | EventModal: Punkte-Feld ausblenden/deaktivieren wenn mandatory=true. Backend: Skip Punkte-Vergabe |
| QR-Code generiert pro Event | Admin zeigt QR-Code, Konfis scannen beim Betreten | Med | Neue Route `GET /events/:id/qr` die signiertes Token generiert. Frontend: QR-Anzeige im Admin EventDetail | QR-Inhalt: JWT/signierter Payload mit event_id + Zeitstempel. KEIN statischer QR (Missbrauch) |
| QR-Scan im Konfi-Frontend | Konfi scannt QR-Code mit Kamera, wird als "present" markiert | Med | Capacitor BarcodeScanner Plugin (bereits QR-Scan fuer Onboarding vorhanden!), neue Route `POST /konfi/events/:id/checkin` | Wiederverwende bestehende QR-Scan-Infrastruktur vom Onboarding. Validierung: Ist Konfi fuer Event angemeldet? Ist Event heute? |
| Manuelle Admin-Korrektur | Admin kann Attendance nachtraeglich aendern (present/absent) -- auch nach QR-Check-in | Low | `PUT /events/:id/participants/:pid/attendance` existiert bereits! | Bestehende Route reicht. UI zeigt QR-Check-in-Status + manuelle Override-Moeglichkeit |
| "Was mitbringen" Textfeld | Optionales Feld auf allen Events fuer Materialien/Mitbring-Info | Low | `events` Tabelle: neue Spalte `bring_items TEXT` | EventModal: neues IonTextarea. EventDetailView (Konfi + Admin): Anzeige wenn nicht leer |
| Dashboard-Widget "Naechstes Event" | Prominente Card auf dem Dashboard mit naechstem anstehenden Event + Was-mitbringen | Med | `DashboardView.tsx`, Dashboard-Daten-Endpoint erweitern | Zeigt: Titel, Datum/Uhrzeit, Ort, "Was mitbringen". Nur fuer Events wo Konfi angemeldet ist. Neuer Toggle `show_next_event` in DashboardConfig |
| Pro-Konfi Anwesenheitsstatistik (Admin-Sicht) | Admin sieht pro Konfi: Anwesenheitsquote, Fehlzeiten, Gruende | Med | `event_bookings` JOIN `events` WHERE mandatory=true, gruppiert pro Konfi | KonfiDetailView: Neue Section "Anwesenheit" mit Quote (X/Y anwesend), Liste der Fehlzeiten mit Opt-out-Gruenden |

## Differentiators

Features die ueber das Minimum hinausgehen, aber echten Mehrwert bieten.

| Feature | Wertversprechen | Komplexitaet | Notes |
|---------|----------------|-------------|-------|
| Zeitfenster fuer QR-Check-in | QR-Code nur X Minuten vor/nach Event-Start gueltig. Verhindert fruehes/spaetes Scannen | Low | Backend-Validierung: `event_date - 30min <= NOW <= event_date + 30min`. Konfigurierbar? Nein, fester Wert reicht |
| Push-Benachrichtigung bei Opt-out | Admin erhaelt Push wenn ein Konfi sich von Pflicht-Event abmeldet | Low | PushService.sendToOrgAdmins existiert. Trigger bei Opt-out |
| Anwesenheits-Badge-Kriterien | Neue Badge-Criteria: `mandatory_attendance_rate` (z.B. >=90% Anwesenheit) oder `mandatory_streak` | Med | `badges.js` CRITERIA_TYPES erweitern. Sinnvoll fuer Engagement-Tracking ohne Punkte |
| Bulk-Attendance (Admin) | Admin markiert mehrere Konfis gleichzeitig als present/absent statt einzeln | Med | Neue Route `PUT /events/:id/bulk-attendance`. UI: Checkbox-Liste + "Alle anwesend" Button |
| Anwesenheits-Uebersicht Jahrgang | Tabelle: Alle Konfis eines Jahrgangs mit Anwesenheitsquote ueber alle Pflicht-Events | Med | Aggregations-Query. Nett fuer Elterngespraeche/Konfi-Gespraeche |
| Opt-out-Frist | Opt-out nur bis X Tage vor Event moeglich (wie bestehende Abmelde-Frist) | Low | Bestehende `canUnregister` Logik (2-Tage-Frist) kann wiederverwendet werden |
| QR-Code als PDF druckbar | Admin kann QR-Code als PDF exportieren zum Aushaengen | Low | Canvas-to-PDF im Frontend. Spart Admin das Screenshot-Machen |

## Anti-Features

Features die explizit NICHT gebaut werden sollen.

| Anti-Feature | Warum vermeiden | Stattdessen |
|-------------|----------------|-------------|
| GPS/Geofencing Check-in | Uebermaessig komplex, Privacy-Bedenken, unzuverlaessig in Kirchengebaeuden (dicke Waende) | QR-Code reicht. Physische Anwesenheit wird durch Scan im Raum bestaetigt |
| Automatische Absent-Markierung | Event vorbei + kein Check-in = auto-absent? Gefaehrlich weil Admin vergessen haben koennte QR anzuzeigen | Admin markiert manuell oder bulk. Unverarbeitete Bookings bleiben `attendance_status = NULL` (bestehendes Verhalten) |
| Eltern-Benachrichtigung bei Fehlen | DSGVO-komplex, braucht Eltern-Accounts, Einverstaendniserklaerungen | Admin kommuniziert bei Bedarf direkt mit Eltern (ausserhalb der App) |
| NFC Check-in | Hardware-Abhaengigkeit, nicht jedes Geraet hat NFC-Writer | QR-Code ist universell, benoetigt nur Kamera |
| Entschuldigung hochladen (Bild/PDF) | Dokumenten-Management ist ein eigenes System. Storage, Datenschutz, Aufbewahrungsfristen | Freitext-Grund reicht. Bei Bedarf kann Admin Notizen machen |
| Punkte-Vergabe fuer Pflicht-Events als Option | "Manche Pflicht-Events koennten doch Punkte geben" -- Verwischt die klare Trennung. Pflicht = Anwesenheit, Freiwillig = Punkte | Trennung beibehalten. Wenn ein Event Punkte geben soll, ist es kein Pflicht-Event |
| Wiederholende Events (Recurring) | Event-Serien (jeden Sonntag) -- massiv komplex: Ausnahmen, einzelne Absagen, unterschiedliche Teilnehmer | Admin erstellt Events einzeln. Bei Bedarf: "Event duplizieren" Button (v1.8+) |
| Self-Attendance ohne QR (Button-Check-in) | Konfi drueckt einfach "Ich bin da" ohne physischen QR-Scan -- trivial zu faelschen | QR-Scan ist der Beweis der physischen Anwesenheit |
| Konfi sieht eigene Anwesenheitsstatistik | Konfi-Dashboard zeigt Fehlzeiten-Quote -- erzeugt Druck/Angst statt Motivation | Anwesenheit ist Admin-only. Konfi sieht nur ob angemeldet/abgemeldet |

## Feature-Abhaengigkeiten

```
events-Tabelle erweitern (mandatory, bring_items)
  |-> EventModal: Pflicht-Toggle + "Was mitbringen" Feld
  |     |-> Bei mandatory=true: Punkte-Feld ausblenden, Auto-Enrollment Logik
  |     |-> Bei mandatory=true: Registrierungsfenster irrelevant (alle sind enrolled)
  |
  |-> Auto-Enrollment (Backend)
  |     |-> INSERT event_bookings fuer alle Jahrgangs-Konfis bei Event-Erstellung
  |     |-> Neuer Status 'opted_out' in event_bookings + opt_out_reason Spalte
  |     |-> Push an betroffene Konfis ("Neues Pflicht-Event: [Titel]")
  |
  |-> Opt-out Flow (Konfi-Frontend)
  |     |-> EventDetailView: "Abmelden" Button mit Pflicht-Grund-Modal
  |     |-> Bestehender UnregisterModal erweitern (Kontext: Pflicht vs. Freiwillig)
  |
  |-> QR-Code Check-in (unabhaengig von Pflicht, fuer ALLE Events nutzbar)
  |     |-> Backend: QR-Token-Generierung (signiert, zeitlich begrenzt)
  |     |-> Admin EventDetailView: QR-Code anzeigen Button
  |     |-> Konfi: QR-Scanner (bestehende Capacitor-Infrastruktur)
  |     |-> Backend: Check-in Validierung (angemeldet? heute? Zeitfenster?)
  |
  |-> "Was mitbringen" Anzeige
  |     |-> Konfi EventDetailView: Neue Info-Row
  |     |-> Dashboard "Naechstes Event" Widget: bring_items anzeigen
  |
  |-> Dashboard-Widget "Naechstes Event"
  |     |-> DashboardConfig: show_next_event Toggle (6. konfigurierbares Widget)
  |     |-> Dashboard-Endpoint: Naechstes Event mit bring_items liefern
  |     |-> DashboardView: Neue Section zwischen Header und Konfirmation
  |
  |-> Pro-Konfi Anwesenheitsstatistik (abhaengig von mandatory Events)
       |-> Backend: Aggregations-Endpoint fuer Anwesenheitsquote
       |-> KonfiDetailView (Admin): Neue "Anwesenheit" Section
       |-> Fehlzeiten-Liste mit Opt-out-Gruenden
```

## UX-Pattern-Analyse

### Pflicht-Event Enrollment: Default-Enrolled mit Opt-out

**Pattern aus Church/School Management (Planning Center, ChurchTrac, MinHub):**
- Pflicht-Events werden automatisch fuer alle betroffenen Teilnehmer gebucht
- Teilnehmer sehen Event sofort in ihrer Liste als "Angemeldet"
- Abmeldung erfordert aktive Handlung + Begruendung
- Admin sieht Abmeldungen separat von No-Shows

**Fuer Konfi Quest:**
- Konfi oeffnet Events-Tab -> sieht Pflicht-Event mit Label "Pflicht" und Status "Angemeldet"
- "Abmelden" Button ist vorhanden, oeffnet Modal mit Pflicht-Grund-Textfeld
- Nach Abmeldung: Status wechselt zu "Entschuldigt" (nicht "Nicht angemeldet")
- Admin-EventDetail: Drei Spalten: Anwesend / Entschuldigt / Nicht erschienen

### QR-Code Check-in: Scan-to-Confirm

**Pattern aus QR-Attendance-Apps (OneTap, Grow Numbers, AttendMe):**
- Admin generiert/zeigt QR-Code (am Beamer, ausgedruckt, auf Tablet)
- Teilnehmer scannen mit eigenem Geraet
- System bestaetigt sofort: Gruener Haken + kurze Vibration
- Admin sieht Live-Counter der eingecheckten Teilnehmer
- Zeitfenster: QR nur gueltig waehrend des Events

**Fuer Konfi Quest:**
- Admin oeffnet Event -> "QR-Check-in starten" Button -> Fullscreen QR-Anzeige
- Konfi oeffnet Events-Tab oder scannt direkt (Quick-Action?)
- Nach Scan: Sofort-Feedback "Eingecheckt!" mit gruener Bestaetigung
- Admin EventDetail: Live-Aktualisierung der Anwesenheitsliste
- Zeitfenster: 30 Minuten vor bis 30 Minuten nach Event-Start

### "Naechstes Event" Dashboard-Widget

**Pattern aus Event-Apps und Kirchengemeinde-Tools:**
- Prominente Card oben im Dashboard
- Zeigt: Titel, Datum (relativ: "Morgen", "In 3 Tagen"), Uhrzeit, Ort
- Optionale Zusatzinfo (hier: "Was mitbringen")
- Tap navigiert zur Event-Detail-Seite
- Verschwindet wenn kein zukuenftiges Event vorhanden

**Fuer Konfi Quest:**
- Position: Nach Header, vor Konfirmation (oder als Teil der Events-Section)
- Card-Design konsistent mit bestehenden Dashboard-Cards
- Icon: calendar (Events-Farbe Rot)
- Zeigt nur Events wo Konfi angemeldet ist (inkl. Pflicht-Events)
- "Was mitbringen" als Unter-Info wenn vorhanden

### Anwesenheitsstatistik: Quote + Fehlzeiten-Details

**Pattern aus Schulverwaltungs-Software (Orah, Aeries, Canvas):**
- Prozentuale Anwesenheitsquote prominent angezeigt
- Farbcodierung: Gruen (>90%), Gelb (75-90%), Rot (<75%)
- Detail-Liste: Datum + Grund der Abwesenheit
- Unterscheidung: Entschuldigt vs. Unentschuldigt

**Fuer Konfi Quest:**
- KonfiDetailView (Admin): Neue Section "Anwesenheit bei Pflicht-Events"
- Donut/Progress als Quote: "8/10 anwesend (80%)"
- Darunter: Liste der verpassten Events mit Opt-out-Grund oder "Nicht erschienen"
- Keine separate Seite noetig -- Section in bestehender KonfiDetailView reicht

## Datenmodell-Empfehlung

### Neue Spalten auf `events`

```sql
ALTER TABLE events ADD COLUMN mandatory BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN bring_items TEXT;
```

### Erweiterung `event_bookings`

```sql
-- Neuer Status-Wert 'opted_out' neben 'confirmed', 'waitlist', 'pending'
-- Kein ENUM-Aenderung noetig wenn status VARCHAR ist (pruefen!)
ALTER TABLE event_bookings ADD COLUMN opt_out_reason TEXT;
```

### QR-Check-in: Keine neue Tabelle noetig

- QR-Token wird per JWT signiert (event_id + expiry), nicht persistiert
- Check-in setzt `attendance_status = 'present'` auf bestehender `event_bookings` Zeile
- Optional: `checked_in_at TIMESTAMPTZ` auf event_bookings fuer Audit

```sql
ALTER TABLE event_bookings ADD COLUMN checked_in_at TIMESTAMPTZ;
ALTER TABLE event_bookings ADD COLUMN checked_in_via VARCHAR(20); -- 'qr' oder 'manual'
```

## MVP-Empfehlung

### Priorisiere in dieser Reihenfolge:

1. **Pflicht-Flag + Auto-Enrollment** (Kern-Feature, aendert Event-Semantik)
   - DB-Migration: `mandatory`, `bring_items` auf events
   - Auto-Enrollment-Logik im Backend
   - EventModal: Pflicht-Toggle

2. **Opt-out Flow** (direkt abhaengig von Pflicht-Events)
   - `opt_out_reason` Spalte
   - UnregisterModal-Erweiterung
   - Admin sieht Opt-out-Gruende

3. **QR-Code Check-in** (unabhaengig von Pflicht, aber hoher Nutzen)
   - QR-Token-Generierung
   - Admin QR-Anzeige
   - Konfi QR-Scan (bestehende Infrastruktur)
   - Check-in Validierung

4. **"Was mitbringen" + Dashboard-Widget** (UI-Features)
   - bring_items Anzeige in EventDetails
   - Dashboard "Naechstes Event" Card
   - DashboardConfig erweitern

5. **Anwesenheitsstatistik** (Reporting, braucht Daten von 1+2+3)
   - Aggregations-Query
   - KonfiDetailView Section

**Zurueckstellen:**
- Bulk-Attendance (nett, aber manuelles Einzeln-Marking funktioniert)
- Anwesenheits-Badges (v1.8+ wenn Badge-System erweitert wird)
- QR-Code PDF-Export (Screenshot reicht erstmal)
- Jahrgangs-Anwesenheits-Uebersicht (spaeter, braucht mehr Daten)

## Feature-Priorisierungs-Matrix

| Feature | Nutzer-Wert | Implementierungskosten | Prioritaet |
|---------|------------|----------------------|-----------|
| Pflicht-Flag auf Events | HIGH | LOW | P1 |
| Auto-Enrollment Jahrgangs-Konfis | HIGH | MED | P1 |
| Opt-out mit Begruendung | HIGH | MED | P1 |
| Keine Punkte bei Pflicht-Events | HIGH | LOW | P1 |
| QR-Code Check-in (Admin zeigt) | HIGH | MED | P1 |
| QR-Scan (Konfi scannt) | HIGH | MED | P1 |
| "Was mitbringen" Textfeld | MED | LOW | P1 |
| Manuelle Admin-Korrektur | MED | LOW (existiert!) | P1 |
| Dashboard "Naechstes Event" | MED | MED | P1 |
| Pro-Konfi Anwesenheitsstatistik | MED | MED | P1 |
| Zeitfenster QR-Check-in | MED | LOW | P1 |
| Push bei Opt-out | LOW | LOW | P2 |
| Opt-out-Frist | LOW | LOW | P2 |
| Bulk-Attendance | LOW | MED | P2 |
| Anwesenheits-Badges | LOW | MED | P3 |

## Quellen

- Codebase-Analyse: `events.js` (1430 Zeilen, vollstaendiges Event-CRUD, Attendance-Route Z.1289-1431)
- Codebase-Analyse: `EventModal.tsx` (Event-Erstellungs-Modal mit allen Feldern)
- Codebase-Analyse: `EventDetailView.tsx` (Konfi, 710 Zeilen, Buchungs-Flow, UnregisterModal)
- Codebase-Analyse: `DashboardView.tsx` + `KonfiDashboardPage.tsx` (DashboardConfig mit 5 Widget-Toggles)
- Codebase-Analyse: `event_bookings` Schema (status, attendance_status, bestehende Attendance-Logik)
- Codebase-Analyse: QR-Onboarding (bestehende Capacitor BarcodeScanner Nutzung)
- [Church Check-in Systems (Breeze ChMS)](https://www.breezechms.com/blog/check-in-systems-for-churches) -- QR-Check-in Patterns
- [MinHub Youth App](https://apps.apple.com/us/app/minhub-youth/id910303883) -- Youth Ministry Attendance mit QR Kiosk Mode
- [QR Code Attendance Best Practices (Verifyed)](https://www.verifyed.io/blog/qr-code-attendance) -- Zeitfenster, Validierung
- [OneTap QR Attendance](https://www.onetapcheckin.com/qr-code-attendance-app) -- Self-Check-in Patterns
- [Orah Attendance Dashboard](https://success.orah.com/en/articles/9924908-attendance-insights-dashboard-all-widgets) -- Statistik-Widgets
- [Aeries Attendance Dashboard](https://support.aeries.com/support/solutions/articles/14000128314-attendance-dashboard) -- Fehlzeiten-Visualisierung

---
*Feature-Research fuer: Konfi Quest v1.7 Pflicht-Events + QR-Check-in + Anwesenheitsstatistik*
*Recherchiert: 2026-03-09*
