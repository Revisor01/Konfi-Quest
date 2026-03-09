# Architecture: Pflicht-Events, QR-Check-in, Auto-Enrollment, Anwesenheitsstatistik

**Projekt:** Konfi Quest v1.7
**Recherchiert:** 2026-03-09
**Confidence:** HIGH (basiert auf vollstaendiger Codebase-Analyse)

## Empfohlene Architektur

### Ueberblick

Pflicht-Events erweitern das bestehende Event-System um vier Saeulen:
1. **Mandatory-Flag + Auto-Enrollment** -- events-Tabelle + automatische event_bookings
2. **Opt-out statt Opt-in** -- Neue event_optouts-Tabelle (getrennt von Buchungen)
3. **QR-Check-in** -- Event-spezifische JWT-QR-Codes + Scan-Endpunkt + Konfi-Scanner-UI
4. **Anwesenheitsstatistik** -- Aggregierte Abfragen ueber event_bookings.attendance_status

```
Admin erstellt Pflicht-Event (mandatory=true, jahrgang_ids=[...])
    |
    v
Backend: Auto-Enrollment aller Konfis aus zugewiesenen Jahrgaengen
    |-> Batch-INSERT INTO event_bookings fuer alle Konfis
    |-> Push-Notification: "Du wurdest fuer XYZ eingetragen"
    |
Konfi sieht Event im Dashboard + Events-Tab
    |-> Opt-out-Button mit Pflicht-Begruendung
    |-> INSERT INTO event_optouts + UPDATE booking status
    |
Event-Tag: Admin zeigt QR-Code (JWT-basiert, stateless)
    |-> Konfi scannt QR -> POST /events/:id/checkin
    |-> Backend setzt attendance_status='present'
    |-> KEIN Punktevergabe (Pflicht-Events haben points=0)
    |
Admin-Korrektur: Manuell present/absent setzen (bestehende Route)
    |
Statistik: Aggregation ueber event_bookings WHERE event.mandatory=true
```

### Komponentengrenzen

| Komponente | Verantwortung | Kommuniziert mit |
|-----------|---------------|-------------------|
| `events.js` (Backend) | Pflicht-Event CRUD, Auto-Enrollment, QR-Token-Generierung, Check-in-Endpunkt | db, pushService, liveUpdate |
| `konfi.js` (Backend) | Konfi-Event-Ansicht inkl. Pflicht-Status, Opt-out-Route, Dashboard-Erweiterung | db, events-Daten |
| `konfi-managment.js` (Backend) | Pro-Konfi Anwesenheitsstatistik-Route | db |
| `EventModal.tsx` (Admin) | Mandatory-Toggle, Bring-Items-Feld im Erstellformular | API POST/PUT /events |
| `EventDetailView.tsx` (Admin) | QR-Code-Anzeige, Anwesenheitsstatistik, Opt-out-Uebersicht | API GET /events/:id |
| `EventsView.tsx` (Konfi) | Pflicht-Events visuell markiert | API |
| `EventDetailView.tsx` (Konfi) | Opt-out-Button, QR-Scanner, Bring-Items-Anzeige | API, Capacitor BarcodeScanner |
| `DashboardView.tsx` (Konfi) | "Naechstes Event"-Widget mit Bring-Items | API /konfi/dashboard |

## Datenbank-Aenderungen

### Bestehende Tabellen: Aenderungen

#### `events` -- 2 neue Spalten
```sql
ALTER TABLE events ADD COLUMN mandatory BOOLEAN DEFAULT FALSE;
ALTER TABLE events ADD COLUMN bring_items TEXT;  -- Freitext "Was mitbringen"
```

**Warum keine eigene Tabelle:** `mandatory` ist ein einfaches Flag auf dem Event selbst. `bring_items` ist ein optionaler Freitext der zu jedem Event gehoert (nicht nur Pflicht-Events).

#### `event_bookings` -- 1 neue Spalte
```sql
ALTER TABLE event_bookings ADD COLUMN enrollment_type VARCHAR(20) DEFAULT 'self';
-- Werte: 'self' (bestehendes Verhalten), 'auto' (Auto-Enrollment), 'admin' (Admin-Buchung)
```

**Warum:** Unterscheidung zwischen Selbstanmeldung und Auto-Enrollment fuer Statistik und UI. Der bestehende `status`-Flow (confirmed/waitlist) bleibt unveraendert -- Auto-Enrolled Konfis bekommen direkt `status='confirmed'`.

**Bestehendes Schema event_bookings (relevant):**
- `id`, `event_id`, `user_id`, `status` (confirmed/waitlist), `booking_date`, `attendance_status` (present/absent/null), `timeslot_id`, `organization_id`
- UNIQUE auf `(event_id, user_id)` -- verhindert Doppelbuchungen
- `attendance_status` wird bereits von der bestehenden Attendance-Route gesetzt

### Neue Tabelle: `event_optouts`

```sql
CREATE TABLE event_optouts (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  opted_out_at TIMESTAMP DEFAULT NOW(),
  organization_id INTEGER NOT NULL REFERENCES organizations(id),
  UNIQUE(event_id, user_id)
);
```

**Warum eigene Tabelle statt nur status-Aenderung in event_bookings:**

1. **Begruendung als Pflichtfeld:** `reason` muss gespeichert werden -- passt nicht in event_bookings Struktur.
2. **Parallele zum bestehenden Pattern:** `event_unregistrations` Tabelle existiert bereits fuer freiwillige Abmeldungen mit Grund (Zeile 325-332 in events.js). Opt-outs folgen dem gleichen Pattern.
3. **Saubere Admin-Ansicht:** Admin sieht Opt-outs getrennt von Teilnehmerliste, analog zu bestehender Unregistrations-Ansicht.
4. **event_bookings.status wird trotzdem aktualisiert:** Auf 'opted_out' gesetzt, damit die bestehende COUNT-Logik (`WHERE status = 'confirmed'`) die Abgemeldeten korrekt nicht mitzaehlt.

**Query-Kompatibilitaetsanalyse:**
Alle bestehenden COUNT-Queries in events.js filtern explizit auf `status = 'confirmed'` oder `status = 'waitlist'`. Ein neuer Status `opted_out` fliesst automatisch NICHT in `registered_count` ein. Getestet an 8+ Stellen im Code.

### Keine neue Tabelle fuer QR-Codes

QR-Codes werden **nicht** in der DB gespeichert. Stattdessen:
- QR-Payload = signierter JWT: `{ type: "event_checkin", event_id, org_id, exp }`
- Admin-UI generiert QR on-the-fly mit `qrcode`-Bibliothek (v1.5.4, bereits installiert im Frontend)
- Backend validiert JWT bei Check-in -- kein DB-Lookup noetig
- `type`-Feld im JWT verhindert Verwechslung mit Auth-JWTs

**Vorteil:** Kein Token-Management, kein Cleanup, keine Race-Conditions, kein DB-State.

## Datenfluss-Aenderungen

### 1. Event-Erstellung mit Auto-Enrollment (Erweiterung POST /events)

```
POST /events (bestehend, erweitert)
  Body: { ...existing, mandatory: true, bring_items: "Bibel, Stift", jahrgang_ids: [1, 2] }

  Neuer Code NACH Event-Insert und NACH Jahrgang-Assignments:
  IF mandatory AND jahrgang_ids.length > 0:
    1. Batch-INSERT alle Konfis der zugewiesenen Jahrgaenge:
       INSERT INTO event_bookings (event_id, user_id, status, enrollment_type, booking_date, organization_id)
       SELECT $1, u.id, 'confirmed', 'auto', NOW(), $3
       FROM users u
       JOIN konfi_profiles kp ON u.id = kp.user_id
       WHERE kp.jahrgang_id = ANY($2) AND u.organization_id = $3
       ON CONFLICT (event_id, user_id) DO NOTHING
    2. Push-Notification an alle eingetragenen Konfis
```

**Pflicht-Event Constraints:**
- `points = 0` (immer, keine Punkte fuer Pflicht-Events)
- `max_participants = 0` (unbegrenzt, alle Jahrgangs-Konfis werden eingetragen)
- `registration_opens_at = NULL`, `registration_closes_at = NULL` (keine Registrierung noetig)
- `waitlist_enabled = false` (keine Warteliste noetig)
- EventModal muss diese Felder ausblenden/fix setzen wenn `mandatory = true`

### 2. Opt-out-Flow (Neue Route in konfi.js)

```
POST /konfi/events/:id/optout
  Body: { reason: "Familientermin" }
  Auth: Konfi-JWT

  1. Pruefe: Event existiert und ist mandatory?
  2. Pruefe: Konfi hat confirmed Booking fuer dieses Event?
  3. Pruefe: Kein existierender Opt-out?
  4. BEGIN Transaction:
     a) INSERT INTO event_optouts (event_id, user_id, reason, organization_id)
     b) UPDATE event_bookings SET status = 'opted_out'
        WHERE event_id = $1 AND user_id = $2
  5. COMMIT
  6. Push an Admin: "Max hat sich von XYZ abgemeldet: Familientermin"
  7. Live-Update an Admins
```

**Opt-out rueckgaengig machen (Admin-Entscheidung):**
- DELETE FROM event_optouts WHERE event_id = $1 AND user_id = $2
- UPDATE event_bookings SET status = 'confirmed'
- Separate Admin-Route: PUT /events/:id/participants/:userId/revert-optout

### 3. QR-Check-in (Neue Routen)

**Admin: QR-Token generieren**
```
GET /events/:id/qr-token
  Auth: Admin/Teamer-JWT

  1. Pruefe: Event existiert und gehoert zur Organisation
  2. Generiere JWT:
     jwt.sign(
       { type: 'event_checkin', event_id, org_id },
       process.env.JWT_SECRET,
       { expiresIn: '24h' }
     )
  3. Response: { token: "eyJ..." }
  Frontend generiert QR-Code aus Token mit qrcode.toDataURL()
```

**Konfi: Check-in ausfuehren**
```
POST /events/:id/checkin
  Body: { token: "eyJ..." }  -- JWT aus gescanntem QR-Code
  Auth: Konfi-JWT (normaler Auth-Header)

  1. jwt.verify(token): Pruefe Signatur + Ablauf
  2. Pruefe: decoded.type === 'event_checkin'
  3. Pruefe: decoded.event_id === req.params.id
  4. Pruefe: decoded.org_id === req.user.organization_id
  5. Pruefe: Konfi hat Booking fuer dieses Event (status='confirmed')
  6. Pruefe: Kein Opt-out vorhanden
  7. Pruefe: Nicht bereits attendance_status='present'
  8. UPDATE event_bookings SET attendance_status = 'present'
     WHERE event_id = $1 AND user_id = $2
  9. Response: { success: true, message: "Anwesenheit bestaetigt" }
  10. Live-Update an Admin
```

**Wichtig:** Die bestehende Admin-Attendance-Route (`PUT /events/:id/participants/:participantId/attendance`) bleibt fuer manuelle Korrektur. Bei Pflicht-Events (points=0) greift die bestehende Bedingung `if (attendance_status === 'present' && eventData.points > 0)` automatisch NICHT -- keine Punkte werden vergeben. Kein Code-Change an dieser Route noetig.

### 4. Dashboard-Widget "Naechstes Event" (Erweiterung bestehender Route)

```
GET /konfi/dashboard (bestehend, erweitert)
  Neue Subquery:
    SELECT e.id, e.name, e.event_date, e.location, e.bring_items, e.mandatory,
           eb.status as booking_status,
           CASE WHEN eo.id IS NOT NULL THEN true ELSE false END as has_opted_out,
           eb.attendance_status
    FROM events e
    JOIN event_bookings eb ON e.id = eb.event_id AND eb.user_id = $1
    LEFT JOIN event_optouts eo ON e.id = eo.event_id AND eo.user_id = $1
    WHERE e.mandatory = true
      AND e.event_date > NOW()
      AND e.organization_id = $2
      AND e.cancelled = false
    ORDER BY e.event_date ASC
    LIMIT 1

  Response: {
    ...existing,
    next_mandatory_event: { id, name, event_date, location, bring_items, has_opted_out, attendance_status } | null
  }
```

**DashboardView-Integration:** Neues Widget zwischen Konfirmation-Card und Events-Section.
- Gesteuert ueber bestehendes `dashboardConfig`-System
- Neuer Settings-Key: `dashboard_show_next_event`
- DashboardConfig-Interface erweitern: `show_next_event: boolean`

### 5. Konfi-Events-Liste erweitern (Erweiterung GET /konfi/events)

Bestehende Query in konfi.js (Zeile 1127-1184) erweitern:

```sql
-- Neue Felder im SELECT:
e.mandatory,
e.bring_items,
CASE WHEN eo.id IS NOT NULL THEN true ELSE false END as has_opted_out,
eo.reason as opt_out_reason

-- Neuer LEFT JOIN:
LEFT JOIN event_optouts eo ON e.id = eo.event_id AND eo.user_id = $2
```

**Konfi-UI Auswirkungen:**
- EventsView.tsx: Pflicht-Badge auf mandatory Events
- EventDetailView.tsx (Konfi): Opt-out-Button statt Register-Button fuer mandatory Events
- bring_items als Info-Card anzeigen (fuer alle Events, nicht nur Pflicht)

### 6. Anwesenheitsstatistik (Neue Route in konfi-managment.js)

```
GET /konfi-management/:id/attendance
  Auth: Admin/Teamer-JWT

  Response: {
    total_mandatory_events: number,    -- Alle Pflicht-Events des Konfis
    attended: number,                   -- attendance_status = 'present'
    absent: number,                     -- attendance_status = 'absent'
    opted_out: number,                  -- In event_optouts
    pending: number,                    -- Noch nicht stattgefunden
    attendance_rate: number,            -- attended / (attended + absent) * 100
    events: [
      {
        event_id, event_name, event_date,
        attendance_status: 'present' | 'absent' | null,
        opt_out_reason: string | null
      }
    ]
  }
```

**Admin-UI:** Neue Sektion in der Admin-Konfi-Detail-Ansicht (konfi-managment Detail View). Zeigt Anwesenheitsquote + Event-Liste mit Statusfarben.

## Betroffene bestehende Dateien

### Backend (zu aendern)

| Datei | Aenderung | Aufwand |
|-------|-----------|---------|
| `backend/routes/events.js` | POST: mandatory + bring_items + Auto-Enrollment. PUT: mandatory-Aenderung. Neue Routen: GET /:id/qr-token, POST /:id/checkin | Mittel |
| `backend/routes/konfi.js` | GET /events: mandatory, bring_items, opt_out_status. Neue Route: POST /events/:id/optout. GET /dashboard: next_mandatory_event | Mittel |
| `backend/routes/konfi-managment.js` | Neue Route: GET /:id/attendance | Klein |
| `backend/routes/settings.js` | dashboard_show_next_event Validierung + UPSERT | Klein |

### Frontend (zu aendern)

| Datei | Aenderung | Aufwand |
|-------|-----------|---------|
| `frontend/src/components/admin/modals/EventModal.tsx` | Mandatory-Toggle, Bring-Items-Feld, Felder-Ausblendung bei mandatory | Mittel |
| `frontend/src/components/admin/views/EventDetailView.tsx` | QR-Code-Anzeige-Button, Opt-out-Liste | Mittel |
| `frontend/src/components/konfi/views/EventsView.tsx` | Pflicht-Badge auf Events, Status-Logik fuer auto-enrolled/opted-out | Klein |
| `frontend/src/components/konfi/views/EventDetailView.tsx` | Opt-out-Button, Bring-Items-Card, QR-Scanner-Button | Mittel |
| `frontend/src/components/konfi/views/DashboardView.tsx` | "Naechstes Event"-Widget Section | Mittel |
| `frontend/src/types/dashboard.ts` | DashboardEvent um mandatory, bring_items erweitern | Klein |

### Frontend (neu zu erstellen)

| Datei | Zweck | Aufwand |
|-------|-------|---------|
| `frontend/src/components/konfi/modals/OptOutModal.tsx` | Abmeldung mit Pflicht-Begruendung (useIonModal Pattern) | Klein |
| `frontend/src/components/konfi/modals/QrScannerModal.tsx` | QR-Code Scanner fuer Check-in (Capacitor Plugin) | Mittel |
| `frontend/src/components/admin/modals/QrDisplayModal.tsx` | QR-Code Vollbild-Anzeige fuer Admin | Klein |
| `frontend/src/components/admin/views/AttendanceStatsView.tsx` | Pro-Konfi Anwesenheitsstatistik in Admin-Konfi-Detail | Mittel |

## Patterns zu befolgen

### Pattern 1: Batch-INSERT fuer Auto-Enrollment
**Was:** Ein einziger SQL-Query enrolled alle Jahrgangs-Konfis
**Wann:** `mandatory === true` bei Event-Erstellung
```javascript
const enrollQuery = `
  INSERT INTO event_bookings (event_id, user_id, status, enrollment_type, booking_date, organization_id)
  SELECT $1, u.id, 'confirmed', 'auto', NOW(), $3
  FROM users u
  JOIN konfi_profiles kp ON u.id = kp.user_id
  WHERE kp.jahrgang_id = ANY($2) AND u.organization_id = $3
  ON CONFLICT (event_id, user_id) DO NOTHING
`;
await db.query(enrollQuery, [eventId, jahrgang_ids, req.user.organization_id]);
```
**Warum:** Performance (1 Query statt N) und Atomaritaet. ON CONFLICT verhindert Duplikate bei Re-Enrollment.

### Pattern 2: JWT-basierte QR-Codes (stateless)
**Was:** Signierte JWTs im QR-Code statt DB-gespeicherte Tokens
**Wann:** Event-Check-in
```javascript
// Generierung (Admin-Route)
const token = jwt.sign(
  { type: 'event_checkin', event_id: eventId, org_id: orgId },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);
// Validierung (Check-in-Route)
const decoded = jwt.verify(token, process.env.JWT_SECRET);
if (decoded.type !== 'event_checkin') throw new Error('Invalid token type');
```
**Warum:** Kein Token-Management noetig. JWT-Secret ist bereits konfiguriert. `type`-Feld verhindert Missbrauch von Auth-Tokens als Check-in-Tokens.

### Pattern 3: Bestehende Attendance-Route fuer Admin-Korrektur
**Was:** Keine neue Route fuer manuelle Attendance-Aenderung bei Pflicht-Events
**Wann:** Admin korrigiert Anwesenheit nachtraeglich
**Warum:** Die bestehende PUT /events/:id/participants/:participantId/attendance (Zeile 1289) funktioniert bereits korrekt: Bei events.points=0 werden keine Punkte vergeben (Bedingung Zeile 1314: `if (attendance_status === 'present' && eventData.points > 0)`).

### Pattern 4: event_unregistrations als Vorbild fuer event_optouts
**Was:** Separate Tabelle mit Grund, analog zu bestehendem Pattern
**Referenz:** events.js Zeile 325-332, event_unregistrations mit user_id, event_id, reason, unregistered_at
**Warum:** Bewaehrtes Pattern im Projekt. Admin-UI zeigt bereits Abmeldungen mit Gruenden an.

### Pattern 5: Dashboard-Widget ueber Settings-KV
**Was:** `dashboard_show_next_event` Toggle ueber bestehende Settings-Tabelle
**Referenz:** v1.6 Dashboard-Widget-Steuerung (5 bestehende Keys: dashboard_show_konfirmation, show_events, show_losung, show_badges, show_ranking)
**Warum:** Exakt gleiches Pattern. Kein neues System noetig.

## Anti-Patterns zu vermeiden

### Anti-Pattern 1: QR-Codes in der Datenbank speichern
**Was:** Tabelle `event_qr_tokens` mit generierten Codes
**Warum schlecht:** Unnoetige Komplexitaet. Cleanup-Jobs noetig. Race-Conditions bei Token-Validierung.
**Stattdessen:** JWT-signierte Tokens. Stateless, selbst-verifizierend, ablaufend.

### Anti-Pattern 2: Separate Pflicht-Events-Tabelle
**Was:** Neue `mandatory_events` Tabelle neben `events`
**Warum schlecht:** Dupliziert Event-Logik. Alle bestehenden Event-Queries (8+ Stellen) muessten UNION verwenden.
**Stattdessen:** Boolean `mandatory` Spalte auf `events`.

### Anti-Pattern 3: HTML5 getUserMedia fuer QR-Scanning
**Was:** Browser-basierter QR-Scanner ohne Capacitor Plugin
**Warum schlecht:** Unzuverlaessig auf iOS WebView. Capacitor handhabt Kamera-Permissions besser. Native Scanner ist schneller.
**Stattdessen:** Capacitor Barcode Scanner Plugin (`@capgo/capacitor-barcode-scanner` oder `@capacitor-mlkit/barcode-scanning`).

### Anti-Pattern 4: Opt-out nur ueber event_bookings.status
**Was:** Status 'opted_out' in event_bookings ohne eigene Tabelle
**Warum schlecht:** Verliert den Opt-out-Grund. Admin braucht separate Ansicht der Abmeldungen mit Gruenden.
**Stattdessen:** Separate `event_optouts` Tabelle (mit Grund) + event_bookings Status-Update kombiniert.

### Anti-Pattern 5: Auto-Enrollment mit Loop statt Batch
**Was:** FOR-Schleife ueber alle Konfis mit einzelnen INSERTs
**Warum schlecht:** N Queries statt 1. Bei 50 Konfis tolerierbar, aber unnoetig und nicht skalierbar.
**Stattdessen:** `INSERT ... SELECT ... ON CONFLICT DO NOTHING` als ein einziger Query.

## Empfohlene Build-Reihenfolge

Die Reihenfolge folgt den Abhaengigkeiten: DB-Schema zuerst, dann Backend-Logik, dann Frontend.

### Phase 1: DB-Schema + Pflicht-Event-Erstellung + Auto-Enrollment
**Was:** Migration, Event-Erstellung erweitern, Auto-Enrollment
**Begruendung:** Alles andere baut darauf auf. Ohne mandatory-Flag und Auto-Enrollment kein Opt-out, kein Check-in, keine Statistik.
1. SQL-Migration: `mandatory`, `bring_items` auf events. `enrollment_type` auf event_bookings. `event_optouts` Tabelle.
2. POST /events erweitern: mandatory + bring_items speichern + Auto-Enrollment Logik
3. PUT /events erweitern: mandatory nachtraeglich aenderbar mit Re-Enrollment
4. GET /events und GET /events/:id: mandatory + bring_items im Response
5. EventModal.tsx: Mandatory-Toggle, Bring-Items-Feld, Feld-Ausblendung bei mandatory

### Phase 2: Opt-out + Konfi-UI fuer Pflicht-Events
**Was:** Opt-out-Flow, Pflicht-Events in Konfi-UI
**Begruendung:** Haengt von Phase 1 (Events + Bookings existieren) ab. Konfis muessen sich abmelden koennen bevor der Event-Tag kommt.
1. POST /konfi/events/:id/optout Backend-Route
2. Admin-Route: PUT /events/:id/participants/:userId/revert-optout
3. GET /konfi/events erweitern: mandatory, bring_items, has_opted_out, opt_out_reason
4. EventsView.tsx (Konfi): Pflicht-Badge, Status-Logik fuer auto-enrolled/opted-out
5. EventDetailView.tsx (Konfi): Opt-out-Button statt Register, Bring-Items-Card
6. OptOutModal.tsx: Begruendungs-Modal (useIonModal Pattern)
7. Admin EventDetailView.tsx: Opt-out-Liste anzeigen (analog zu Unregistrations)

### Phase 3: QR-Check-in
**Was:** QR-Generierung (Admin), QR-Scanner (Konfi), Check-in-Endpunkt
**Begruendung:** Haengt von Phase 1 (Bookings existieren) ab. Unabhaengig von Phase 2 (Opt-out). Kann parallel gebaut werden.
1. Capacitor Barcode Scanner Plugin installieren + iOS/Android konfigurieren
2. GET /events/:id/qr-token Backend-Route (JWT generieren)
3. POST /events/:id/checkin Backend-Route (JWT validieren, Attendance setzen)
4. QrDisplayModal.tsx (Admin): QR-Code Vollbild-Anzeige mit qrcode Library
5. QrScannerModal.tsx (Konfi): Scanner-UI mit Capacitor Plugin
6. EventDetailView.tsx (Konfi): Scanner-Button integrieren
7. EventDetailView.tsx (Admin): QR-Code-Button integrieren

### Phase 4: Dashboard-Widget + Anwesenheitsstatistik
**Was:** "Naechstes Event"-Widget, Pro-Konfi Statistik-View
**Begruendung:** Haengt von Phase 1-3 ab (braucht Attendance-Daten fuer Statistik). Darstellungslogik als letztes.
1. GET /konfi/dashboard erweitern: next_mandatory_event Subquery
2. DashboardView.tsx: Neue Widget-Section
3. Settings: dashboard_show_next_event Toggle
4. GET /konfi-management/:id/attendance Backend-Route
5. AttendanceStatsView.tsx: Statistik-Ansicht im Admin-Konfi-Detail
6. Push-Notifications fuer Pflicht-Event-Erinnerungen (24h vorher)

## Skalierbarkeitsueberlegungen

| Concern | Bei 50 Konfis | Bei 500 Konfis | Bei 5000 Konfis |
|---------|---------------|----------------|-----------------|
| Auto-Enrollment | Batch-INSERT, <50ms | Batch-INSERT, <200ms | Batch-INSERT, <1s. Evtl. async Job |
| QR-Check-in | JWT-Verify, <10ms | JWT-Verify, <10ms | JWT-Verify, <10ms (stateless) |
| Attendance-Stats | Single Query mit JOIN, <50ms | Index auf event_bookings(user_id), <100ms | Materialized View erwaegen |
| Dashboard next_event | Subquery, <50ms | Index auf events(mandatory, event_date), <100ms | Kein Problem |

**Aktuell relevant:** 50-100 Konfis pro Organisation. Alle Ansaetze skalieren problemlos.

## Edge Cases

### Edge Case 1: Neuer Konfi nach Event-Erstellung einem Jahrgang hinzugefuegt
**Verhalten:** Kein automatisches Nachtrags-Enrollment. Admin muss manuell hinzufuegen (bestehende POST /:id/participants Route). Zukuenftige Erweiterung: Event-Hooks bei Jahrgang-Aenderung.

### Edge Case 2: Konfi wechselt Jahrgang
**Verhalten:** Bestehende Bookings bleiben. Neue Pflicht-Events des neuen Jahrgangs haben den Konfi nicht automatisch. Bestehende Pflicht-Events des alten Jahrgangs bleiben. Manuelles Management noetig.

### Edge Case 3: Admin aendert Event von normal zu mandatory nachtraeglich
**Verhalten:** Re-Enrollment aller Jahrgangs-Konfis ausfuehren. ON CONFLICT DO NOTHING schuetzt bereits registrierte Konfis. Bestehende Self-Registrations bleiben mit enrollment_type='self'.

### Edge Case 4: Opt-out und dann Event wird abgesagt
**Verhalten:** Event-Absage (bestehendes cancelled-Flag) betrifft alle Bookings. Opt-outs bleiben in event_optouts fuer historische Daten. Status-Anzeige zeigt "Abgesagt" statt "Abgemeldet".

### Edge Case 5: QR-Code nach 24h abgelaufen
**Verhalten:** JWT expired -> Check-in fehlgeschlagen -> Fehlermeldung "QR-Code abgelaufen, bitte Admin kontaktieren". Admin kann neuen QR generieren oder manuell Attendance setzen.

### Edge Case 6: Konfi scannt QR aber hat Opt-out
**Verhalten:** Check-in wird abgelehnt: "Du hast dich von diesem Event abgemeldet". Admin muss erst Opt-out rueckgaengig machen.

## Quellen

- Bestehende Codebase-Analyse:
  - events.js: 1450+ Zeilen, 15 Routen, Attendance-Logik Zeile 1289-1432
  - konfi.js: 1800+ Zeilen, Events-Query Zeile 1117-1215, Dashboard Zeile 32-272
  - konfi-managment.js: Konfi-Detail-Routen
  - settings.js: Dashboard-Widget-Toggles (5 Keys, Zeile 98-112)
  - event_unregistrations: Bestehendes Pattern fuer Abmeldungen mit Grund
  - qrcode npm-Paket: v1.5.4, bereits installiert im Frontend
  - JWT-Signierung: process.env.JWT_SECRET, bereits konfiguriert
  - DashboardView.tsx: 1300+ Zeilen, 6 konfigurierbare Sektionen
  - EventsView.tsx (Konfi): Status-Logik Zeile 145-204, 3 Tabs

---
*Architecture research for: Konfi Quest v1.7 Pflicht-Events + QR-Check-in*
*Researched: 2026-03-09*
