# Technology Stack: v1.7 Unterricht + Pflicht-Events

**Project:** Konfi Quest
**Researched:** 2026-03-09
**Scope:** Pflicht-Events mit Auto-Enrollment, Opt-out mit Begruendung, QR-Code Self-Check-in, Anwesenheitsstatistik
**Overall Confidence:** HIGH

---

## Empfehlung: Eine neue Dependency (QR-Scanner)

v1.7 braucht **eine neue Frontend-Dependency** fuer den QR-Code-Scan auf dem Geraet. Alles andere (QR-Generierung, DB-Patterns, Attendance-Tracking, Push) existiert bereits.

---

## Neue Dependency

### Frontend: `@capacitor/barcode-scanner`

| Eigenschaft | Wert |
|-------------|------|
| **Package** | `@capacitor/barcode-scanner` |
| **Version** | `@latest-7` (Capacitor-7-kompatible Version) |
| **Zweck** | QR-Code scannen auf Konfi-Geraet fuer Self-Check-in |
| **Plattformen** | iOS, Android, Web (Fallback) |
| **Confidence** | HIGH |

**Warum dieses Plugin:**
- Offizielles Capacitor-Plugin (nicht Community) -- beste Wartungsgarantie
- `@capacitor-community/barcode-scanner` ist deprecated (letzte Version vor 3 Jahren)
- Capacitor 7 Support via `npm install @capacitor/barcode-scanner@latest-7`
- API: `scanBarcode()` mit `CapacitorBarcodeScannerTypeHint.QR_CODE` -- eine Methode, fertig
- Unterstuetzt QR-Code explizit als Format-Hint
- Web-Fallback vorhanden (dev-tauglich)

**Warum NICHT `@capacitor-mlkit/barcode-scanning`:**
- ML Kit ist Overkill fuer reinen QR-Scan (groessere Binary, mehr Konfiguration)
- Offizielles Plugin reicht voellig
- ML Kit waere relevant wenn multi-format Barcodes (EAN, UPC etc.) gescannt werden muessten

**Installation:**
```bash
cd frontend && npm install @capacitor/barcode-scanner@latest-7
```

**Android-Hinweis:** Minimum SDK Target 26 erforderlich. Das Projekt verwendet Capacitor 7.4.2 mit Android 7.4.4 -- sollte bereits SDK 26+ sein, aber in `android/variables.gradle` pruefen.

**iOS-Hinweis:** Camera-Permission (`NSCameraUsageDescription`) ist bereits konfiguriert (existiert fuer `@capacitor/camera`).

---

## Bestehender Stack (unveraendert, aber erweitert genutzt)

| Technologie | Version | Neue Nutzung in v1.7 | Warum ausreichend |
|-------------|---------|---------------------|-------------------|
| `qrcode` | ^1.5.4 | QR-Code Generierung fuer Check-in-Token pro Event | Bereits fuer Invite-Codes genutzt (`AdminInvitePage.tsx`), `QRCode.toDataURL()` Pattern existiert |
| PostgreSQL (pg) | ^8.16.3 | Neue Spalten auf `events` + `event_bookings`, Opt-out-Tabelle | Bestehende Tabellen erweitern, kein neues Pattern |
| Express + express-validator | ^4.18.2 / ^7.3.1 | Neue Endpoints fuer Check-in, Opt-out, Auto-Enrollment | Bestehende Route-Patterns in `events.js` wiederverwenden |
| Socket.io | ^4.7.2 / ^4.8.1 | Live-Update bei Check-in (Admin sieht sofort wer da ist) | `liveUpdate.sendToOrgAdmins()` Pattern existiert |
| Push (firebase-admin) | ^12.7.0 | Neuer Push-Typ fuer Pflicht-Event-Erinnerung | `PushService` hat bereits 18 Push-Types, ein weiterer ist trivial |
| `crypto` (Node built-in) | -- | Check-in-Token generieren (`crypto.randomBytes`) | Pattern bereits in `auth.js` Zeile 33, 347 |
| Axios | ^1.10.0 | Neue API-Calls fuer Check-in, Opt-out | Bestehender `api`-Service |

---

## Datenbank-Strategie

### 1. Events-Tabelle: Neue Spalten

```sql
ALTER TABLE events
  ADD COLUMN mandatory BOOLEAN DEFAULT false,
  ADD COLUMN bring_items TEXT;  -- "Was mitbringen" Freitext
```

**Warum `mandatory` als Boolean:**
- Einfachste Semantik: Event ist entweder Pflicht oder freiwillig
- Pflicht-Events haben grundlegend andere Logik (kein Opt-in, kein Punkte, Auto-Enrollment)
- Boolean steuert die Verzweigung in der Business-Logik

**Warum `bring_items` als TEXT (nicht JSONB):**
- Einfacher Freitext ("Bibel, Stift, Block"), kein strukturierter Datentyp
- Wird nur angezeigt, nicht gefiltert/gesucht
- Optional (NULL = nichts mitbringen)
- Fuer ALLE Events verfuegbar, nicht nur Pflicht-Events

### 2. Event-Bookings: Neue Spalten fuer Opt-out

```sql
ALTER TABLE event_bookings
  ADD COLUMN opt_out_reason TEXT,
  ADD COLUMN checked_in_at TIMESTAMP,
  ADD COLUMN check_in_method VARCHAR(20) CHECK (check_in_method IN ('qr', 'manual'));
```

**Bestehende Spalten die weiterverwendet werden:**
- `status`: 'confirmed' (auto-enrolled), 'cancelled' (opted-out)
- `attendance_status`: 'present' / 'absent' (bleibt wie gehabt fuer Admin-Korrektur)

**Flow fuer Pflicht-Events:**
```
Event erstellt (mandatory=true) → Auto-Enrollment aller Jahrgangs-Konfis
  → event_bookings mit status='confirmed' fuer jeden Konfi

Konfi moechte nicht kommen → Opt-out:
  → status='cancelled', opt_out_reason='Familienfest'

Konfi scannt QR am Event → Check-in:
  → attendance_status='present', checked_in_at=NOW(), check_in_method='qr'

Admin korrigiert → Manueller Check-in:
  → attendance_status='present', checked_in_at=NOW(), check_in_method='manual'
```

**Warum kein separates `event_attendance`-Tabelle:**
- `event_bookings` hat bereits `attendance_status` (present/absent)
- Zusaetzliche Felder (`opt_out_reason`, `checked_in_at`, `check_in_method`) passen semantisch auf die Booking-Zeile
- Ein Booking = ein Konfi pro Event -- genau die richtige Granularitaet
- Unique Constraint `(user_id, event_id)` existiert bereits -- verhindert Doppel-Check-ins

### 3. Check-in-Tokens: Kein persistentes Speichern

```sql
-- NICHT noetig: Keine separate Tabelle fuer QR-Tokens
-- Token wird dynamisch generiert: HMAC(event_id + secret)
-- oder einfach: crypto.randomBytes() gespeichert in-memory/Redis
```

**Empfehlung: Event-basierter statischer Token**

```javascript
// Backend generiert Token bei Event-Erstellung oder auf Abruf
const crypto = require('crypto');
const token = crypto.createHmac('sha256', process.env.JWT_SECRET)
  .update(`event-checkin-${eventId}`)
  .digest('hex')
  .substring(0, 12);

// QR-Code Inhalt: https://konfi-quest.de/checkin/{token}
// oder App-Deep-Link: konfiquest://checkin/{token}
```

**Warum HMAC statt Random-Token in DB:**
- Deterministisch: Gleicher Event = gleicher Token (kein DB-Lookup zum Generieren)
- Sicher: Ohne JWT_SECRET nicht erratbar
- Kein Cleanup noetig (keine Token-Tabelle die waechst)
- Admin kann QR jederzeit neu generieren (kommt immer derselbe raus)
- Validierung: Backend berechnet erwarteten Token und vergleicht

**Alternative (einfacher, auch valide):** Token als Spalte auf `events`-Tabelle (`checkin_token VARCHAR(24)`), einmal bei Erstellung generiert. Vorteil: Explizit in DB sichtbar. Nachteil: Migration, eine Spalte mehr.

**Empfehlung: HMAC-Ansatz** -- zero DB-Change, zero Cleanup, deterministisch.

### 4. Pflicht-Events: Interaktion mit `max_participants` und Points

```sql
-- Pflicht-Events MUESSEN:
-- max_participants: Wird ignoriert oder auf Jahrgangs-Groesse gesetzt
-- points: MUSS 0 sein (keine Punkte fuer Pflicht-Events)
-- registration_opens_at / registration_closes_at: Irrelevant (Auto-Enrollment)
-- waitlist_enabled: false (alle sind enrolled)

-- Backend-Constraint (Code, nicht DB):
-- IF mandatory THEN points = 0 AND waitlist_enabled = false
```

---

## QR-Code Check-in Flow

### Generierung (Admin-Seite, bestehendes Pattern)

```typescript
// Bestehendes Pattern aus AdminInvitePage.tsx:
import QRCode from 'qrcode';

const qrDataUrl = await QRCode.toDataURL(checkinUrl, {
  width: 300,
  margin: 2,
  color: { dark: '#000000', light: '#ffffff' }
});
```

Keine neue Library noetig. `qrcode` ^1.5.4 ist bereits installiert.

### Scanning (Konfi-Geraet, neue Dependency)

```typescript
import { BarcodeScanner, CapacitorBarcodeScannerTypeHint } from '@capacitor/barcode-scanner';

const result = await BarcodeScanner.scanBarcode({
  hint: CapacitorBarcodeScannerTypeHint.QR_CODE
});

if (result.ScanResult) {
  // Token extrahieren und an Backend senden
  const token = extractTokenFromUrl(result.ScanResult);
  await api.post(`/events/checkin/${token}`);
}
```

### Check-in Endpoint (Backend)

```javascript
// POST /events/checkin/:token
router.post('/checkin/:token', rbacVerifier, async (req, res) => {
  // 1. Token validieren (HMAC-Vergleich ueber alle Events der Org)
  // 2. Event finden
  // 3. Pruefen ob User enrolled ist (event_bookings Eintrag)
  // 4. attendance_status = 'present', checked_in_at = NOW(), check_in_method = 'qr'
  // 5. Live-Update an Admins
  // 6. Push an Konfi: "Check-in erfolgreich"
});
```

### Echtzeit-Updates bei Check-in

```
Konfi scannt QR → POST /events/checkin/:token
  → Backend: attendance_status = 'present'
  → Socket.io: liveUpdate.sendToOrgAdmins(..., 'events', 'update', { eventId, action: 'checkin' })
  → Admin-UI: Teilnehmerliste aktualisiert sich sofort
```

Bestehender `liveUpdate`-Mechanismus reicht. Kein neues Socket-Event noetig -- das `events.update` Pattern existiert bereits (events.js Zeile 1369).

---

## Anwesenheitsstatistik

Reine SQL-Aggregation ueber bestehende Tabellen. Keine neue Infrastruktur.

```sql
-- Pro-Konfi Statistik
SELECT
  COUNT(*) FILTER (WHERE e.mandatory = true) as total_pflicht,
  COUNT(*) FILTER (WHERE e.mandatory = true AND eb.attendance_status = 'present') as anwesend,
  COUNT(*) FILTER (WHERE e.mandatory = true AND eb.attendance_status = 'absent') as abwesend,
  COUNT(*) FILTER (WHERE e.mandatory = true AND eb.status = 'cancelled') as entschuldigt,
  COUNT(*) FILTER (WHERE e.mandatory = true AND eb.attendance_status IS NULL AND eb.status = 'confirmed') as ausstehend
FROM event_bookings eb
JOIN events e ON eb.event_id = e.id
WHERE eb.user_id = $1 AND e.organization_id = $2;
```

---

## Explizit NICHT hinzufuegen

| Bibliothek | Warum nicht |
|------------|------------|
| `@capacitor-mlkit/barcode-scanning` | ML Kit ist Overkill fuer reinen QR-Scan. Groessere App-Size, mehr native Config. Offizielles Plugin reicht. |
| `@capacitor-community/barcode-scanner` | Deprecated seit 3 Jahren. Kein Capacitor 7 Support. |
| Redis / In-Memory Store | Check-in-Tokens sind HMAC-basiert (deterministisch berechnet), brauchen keinen Cache. Rate-Limiter laeuft bereits in-memory. |
| `uuid` | Check-in-Tokens brauchen keine UUIDs. HMAC oder `crypto.randomBytes` reicht (Pattern existiert). |
| `date-fns` / `dayjs` | Zeitvergleiche (Event-Datum, Check-in-Fenster) funktionieren mit nativem `Date` und PostgreSQL `NOW()`. Kein Date-Library noetig. |
| `react-qr-reader` / `html5-qrcode` | Web-only QR-Scanner. Capacitor-Plugin ist besser fuer native App-Experience (Kamera-Overlay, Performance). |
| Separate Attendance-Tabelle | `event_bookings` hat bereits `attendance_status`. Neue Spalten (`opt_out_reason`, `checked_in_at`, `check_in_method`) gehoeren semantisch dorthin. |
| WebSocket-Room pro Event | Nicht noetig. `liveUpdate.sendToOrgAdmins()` reicht fuer Check-in-Updates. Admins sehen alle Events ihrer Org. |

---

## Integrationspunkte mit bestehendem System

### QR-System (bestehendes Invite-Pattern wiederverwenden)

```
Bestehend (Invite):                    Neu (Check-in):
AdminInvitePage                        AdminEventDetail
  → QRCode.toDataURL(inviteUrl)          → QRCode.toDataURL(checkinUrl)
  → Konfi scannt mit Kamera               → Konfi scannt mit BarcodeScanner
  → Browser oeffnet URL                    → App verarbeitet Token intern
  → auth.js registriert User              → events.js markiert present
```

**Unterschied:** Invite-QR oeffnet eine URL im Browser (Registrierung). Check-in-QR wird IN der App gescannt und intern verarbeitet (kein Browser). Deshalb braucht es den nativen BarcodeScanner.

### Event-System (bestehende attendance erweitern)

```
Bestehend:                             Neu:
Admin markiert manuell present/absent  Konfi scannt QR → auto-present
  → PUT /events/:id/participants/        → POST /events/checkin/:token
       :participantId/attendance              (gleiche DB-Updates)
  → Points werden vergeben               → Keine Points (mandatory=true → points=0)
```

Die bestehende `PUT .../attendance` Route bleibt fuer Admin-Korrekturen. Die neue `POST /checkin/:token` Route macht dasselbe ohne Punkte.

### Push-System (neuer Push-Type)

```javascript
// pushService.js: Neuer Typ hinzufuegen
// Typ 19: pflicht_event_reminder
// Typ 20: checkin_confirmed
static async sendPflichtEventReminder(db, konfiId, eventName, eventDate) { ... }
static async sendCheckinConfirmed(db, konfiId, eventName) { ... }
```

Bestehende Push-Infrastruktur (18 Types, Token-Management, FCM/APNS) wird nur um 2 Types erweitert.

### Auto-Enrollment (bestehende event_bookings nutzen)

```
Event erstellt (mandatory=true, jahrgang_ids=[2,5])
  → Backend: SELECT user_id FROM konfi_profiles WHERE jahrgang_id IN (2,5)
  → INSERT INTO event_bookings (event_id, user_id, status, organization_id)
      SELECT $1, kp.user_id, 'confirmed', $2
      FROM konfi_profiles kp WHERE kp.jahrgang_id = ANY($3)
      ON CONFLICT (user_id, event_id) DO NOTHING
```

Keine neue Tabelle. Nutzt `event_bookings` mit bestehendem Unique Constraint.

---

## Installation

```bash
# Einzige neue Dependency
cd frontend && npm install @capacitor/barcode-scanner@latest-7

# Danach: Capacitor sync (fuer native Projekte)
npx cap sync
```

**Backend: Null neue Dependencies.**

---

## Zusammenfassung: Was sich aendert

```
Backend:
  (keine neuen Dependencies)
  ~ backend/routes/events.js          # mandatory-Flag, Auto-Enrollment, Check-in-Endpoint, bring_items
  + backend/routes/events.js          # POST /checkin/:token (neuer Endpoint)
  ~ backend/services/pushService.js   # 2 neue Push-Types
  ~ backend/routes/konfi.js           # Anwesenheitsstatistik-Endpoint

Frontend:
  + @capacitor/barcode-scanner        # NEUE DEPENDENCY
  ~ AdminEventCreateModal             # mandatory Toggle, bring_items Feld
  ~ AdminEventDetailView              # QR-Code anzeigen, Opt-out-Gruende sehen, Attendance-Uebersicht
  + KonfiQRScanPage/Modal             # NEUES UI: Scanner fuer Check-in
  ~ KonfiEventsView                   # Opt-out Button mit Begruendung, "Was mitbringen" anzeigen
  ~ KonfiDashboardPage                # Widget "Naechstes Pflicht-Event"
  + KonfiAttendanceView               # NEUES UI: Eigene Anwesenheitsstatistik

Datenbank:
  + ALTER TABLE events ADD COLUMN mandatory BOOLEAN DEFAULT false
  + ALTER TABLE events ADD COLUMN bring_items TEXT
  + ALTER TABLE event_bookings ADD COLUMN opt_out_reason TEXT
  + ALTER TABLE event_bookings ADD COLUMN checked_in_at TIMESTAMP
  + ALTER TABLE event_bookings ADD COLUMN check_in_method VARCHAR(20)
```

---

## Quellen

- [Capacitor Barcode Scanner Plugin Docs](https://capacitorjs.com/docs/apis/barcode-scanner) -- Offizielles Plugin, Capacitor 7 Support via `@latest-7` Tag
- [@capacitor/barcode-scanner npm](https://www.npmjs.com/package/@capacitor/barcode-scanner) -- Version 3.0.1 (latest), `latest-7` fuer Cap 7
- [Ionic Blog: Introducing Capacitor Barcode Scanner](https://ionic.io/blog/introducing-capacitor-barcode-scanner-plugin) -- Offizielles Plugin-Announcement
- Codebase-Analyse: `AdminInvitePage.tsx` -- QR-Generierung mit `qrcode` ^1.5.4 (Zeile 40, 110, 143, 204)
- Codebase-Analyse: `events.js` -- Attendance-Route (Zeile 1288-1432), Event-Queries mit attendance_status
- Codebase-Analyse: `auth.js` -- `crypto.randomBytes` Pattern (Zeile 33, 347)
- Codebase-Analyse: `01-create-schema.sql` -- events/event_bookings Schema (Zeile 289-404)
- Codebase-Analyse: `liveUpdate` Pattern in events.js (Zeile 1369)
- Codebase-Analyse: `pushService.js` -- 18 bestehende Push-Types

**Confidence: HIGH** -- Einzige neue Dependency ist das offizielle Capacitor-Plugin. Alle anderen Empfehlungen basieren auf direkter Codebase-Analyse und bestehenden Patterns.

---

*Stack research for: Konfi Quest v1.7 Unterricht + Pflicht-Events*
*Researched: 2026-03-09*
