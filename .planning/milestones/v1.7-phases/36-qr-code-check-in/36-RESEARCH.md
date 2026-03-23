# Phase 36: QR-Code Check-in - Research

**Researched:** 2026-03-09
**Domain:** QR-Code Generierung, In-App Kamera-Scanner, JWT Token Signierung, Zeitfenster-Validierung
**Confidence:** HIGH

## Summary

Phase 36 fuegt QR-Code-basiertes Self-Check-in fuer Events hinzu. Admin generiert einen signierten QR-Code pro Event (JWT mit HMAC-SHA256), zeigt ihn im Fullscreen an. Konfis scannen den QR-Code mit einem In-App-Kamera-Scanner und werden automatisch als "anwesend" markiert. Das Backend validiert Zeitfenster, Buchungsstatus und Duplikate. Die manuelle Admin-Korrektur bleibt unveraendert.

Die technische Umsetzung baut auf bestehenden Bausteinen auf: `qrcode` (v1.5.4) ist bereits installiert fuer QR-Generierung, `jsonwebtoken` (v9.0.2) ist bereits im Backend fuer JWT-Signierung, und die Attendance-Route (`PUT /events/:id/participants/:participantId/attendance`) existiert bereits. Neu hinzugefuegt werden muss nur eine QR-Scanner-Library fuer das Frontend.

**Primary recommendation:** `qr-scanner` (nimiq) als Scanner-Library verwenden. Web Worker-basiert, leichtgewichtig, aktiv gepflegt, keine UI-Abhaengigkeiten. QR-Token als JWT mit separatem QR_SECRET signieren. Neuer Backend-Endpoint fuer QR-Check-in, der intern die bestehende Attendance-Logik nutzt.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Signierter JWT-Token (Event-ID + Zeitstempel + HMAC-SHA256 Signatur)
- Token wird einmalig pro Event generiert und in der DB gespeichert (Spalte auf events-Tabelle)
- Kein Reset/Regenerieren moeglich — einmal generiert = fix
- Ein Scan pro Konfi: Backend prueft ob bereits eingecheckt, Duplikat wird ignoriert
- Nur angemeldete Konfis (status = confirmed) koennen einchecken — keine Auto-Buchung
- Konfis mit opted_out Status werden abgelehnt
- QR-Check-in ist fuer ALLE Event-Typen verfuegbar (Pflicht und freiwillig)
- In-App Kamera-Scanner (NICHT Standard-Kamera-App)
- Scanner oeffnet als Fullscreen-Modal (useIonModal)
- Zwei Einstiegspunkte: Button "Einchecken" in Konfi-EventDetailView UND FAB auf Konfi-EventsView
- Fehlermeldungen inline im Scanner (roter Banner), Scanner bleibt offen
- Bei "bereits eingecheckt": blauer Info-Banner statt roter Fehler
- Nach erfolgreichem Scan: Scanner schliesst, EventDetailView zeigt gruenen "Anwesend"-Status
- Bei FAB-Einstieg: Event wird aus QR erkannt, EventDetailView oeffnet sich mit Status
- Button "QR-Code anzeigen" in Admin-EventDetailView
- Fullscreen-Modal mit: Event-Name, Datum/Uhrzeit, grosser QR-Code, Hinweistext
- Live-Zaehler unter QR-Code: "X/Y eingecheckt" mit Polling (alle 10 Sekunden)
- Beamer-tauglich (grosser QR, minimales UI drumherum)
- Bestehende Tap -> ActionSheet -> Anwesend/Abwesend Logik bleibt unveraendert
- QR-Scan nutzt den gleichen handleAttendanceUpdate/Backend-Mechanismus
- Keine Aenderungen an der Admin-Teilnehmerliste noetig
- Zeitfenster bezieht sich auf event_date (Hauptdatum), NICHT auf einzelne Timeslots
- Konfigurierbar pro Event: neues Feld "Check-in-Fenster" (Integer, Minuten)
- Default: 30 Minuten (vorausgefuellt im EventModal, aenderbar)
- Bedeutung: X Minuten VOR und X Minuten NACH Event-Start
- KEINE Aenderung an Punkte-Logik

### Claude's Discretion
- Wahl der QR-Scanner-Library (jsqr, qr-scanner, oder html5-qrcode)
- Polling-Implementierung fuer Live-Zaehler (setInterval vs. useEffect)
- Genaues JWT-Token-Format und Signatur-Secret-Handling
- Camera-Permission-Handling und Fallback bei Ablehnung
- Capacitor-Plugin-Konfiguration fuer Kamera-Zugriff

### Deferred Ideas (OUT OF SCOPE)
- Onboarding-QR-Scanner auf In-App-Scanner umstellen (aktuell Standard-Kamera via Deep Link)
- QR-Code als druckbares PDF exportieren (QRC-05, v2 Requirement)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QRC-01 | Admin kann einen signierten QR-Code pro Event generieren und im Fullscreen anzeigen | QR-Generierung mit bestehendem `qrcode` npm-Paket (v1.5.4, bereits installiert). JWT-Signierung mit bestehendem `jsonwebtoken` (v9.0.2). Neues DB-Feld `qr_token` auf events-Tabelle. Admin-Modal mit `QRCode.toDataURL()` (Pattern aus AdminInvitePage). |
| QRC-02 | Konfi kann QR-Code scannen und wird automatisch als "anwesend" markiert | `qr-scanner` Library (Web Worker-basiert) fuer In-App Kamera-Scanner. Neuer Backend-Endpoint `POST /events/qr-checkin` der Token validiert und bestehende Attendance-Logik aufruft. |
| QRC-03 | QR-Code ist nur im konfigurierten Zeitfenster gueltig | Backend-Validierung gegen `event_date` und neues `checkin_window` Feld. Fehlermeldungen mit konkreten Uhrzeiten. |
| QRC-04 | Admin kann Anwesenheit manuell korrigieren | Bestehende `handleAttendanceUpdate()` und `showAttendanceActionSheet()` bleiben unveraendert. Keine Aenderungen noetig. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `qr-scanner` | ^1.4.2 | In-App QR-Code Scanner mit Kamera-Zugriff | Web Worker-basiert (blockiert nicht UI), leichtgewichtig (~50KB), aktiv gepflegt, kein UI-Framework-Lock-in, native Camera API |
| `qrcode` | 1.5.4 | QR-Code Generierung (Admin-Anzeige) | Bereits installiert, bewaehrtes Pattern aus AdminInvitePage |
| `jsonwebtoken` | 9.0.2 | JWT-Signierung fuer QR-Token | Bereits im Backend installiert und verwendet |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@capacitor/camera` | 7.0.1 | Kamera-Berechtigungen auf nativen Plattformen | Bereits installiert, fuer Permission-Check vor Scanner-Start |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `qr-scanner` | `html5-qrcode` | Mehr Features (Barcode-Support), aber letzte Veroeffentlichung vor 3 Jahren (v2.3.8, ~2023), nutzt ZXing.js das in Maintenance-Mode ist |
| `qr-scanner` | `jsQR` | Puristisch (nur Decoder), aber kein Kamera-Handling, Entwicklung dormant, Main-Thread-blockierend |
| `qr-scanner` | `@capacitor-community/barcode-scanner` | Nativer Scanner, aber kein Web-Support, erfordert Background-Transparency-Hacks in Ionic, invasiver |

**Empfehlung:** `qr-scanner` ist die beste Wahl: Web Worker verhindert UI-Jank, eingebautes Kamera-Management, funktioniert auf Web + iOS + Android (ueber WebView), aktiv gepflegt, und laesst sich in ein useIonModal einbetten ohne Framework-Konflikte.

**Installation:**
```bash
cd frontend && npm install qr-scanner
```

## Architecture Patterns

### Recommended Project Structure
```
backend/routes/events.js          # Neue Endpoints: POST /events/:id/generate-qr, POST /events/qr-checkin
backend/migrations/               # 036_add_qr_checkin.sql (qr_token, checkin_window Spalten)

frontend/src/components/
├── konfi/
│   ├── modals/QRScannerModal.tsx  # Fullscreen Scanner mit Kamera-Preview
│   └── views/
│       ├── EventDetailView.tsx    # + "Einchecken" Button + Anwesend-Status
│       └── EventsView.tsx         # + FAB fuer Scanner
├── admin/
│   ├── modals/QRDisplayModal.tsx  # Fullscreen QR-Anzeige mit Live-Zaehler
│   ├── modals/EventModal.tsx      # + Check-in-Fenster Feld
│   └── views/EventDetailView.tsx  # + "QR-Code anzeigen" Button
```

### Pattern 1: QR-Token Generierung (Backend)
**What:** JWT-Token mit Event-ID und Timestamp, signiert mit separatem Secret
**When to use:** Beim ersten Aufruf von "QR-Code anzeigen" durch Admin

```javascript
// backend/routes/events.js
const crypto = require('crypto');
const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET;

// POST /events/:id/generate-qr
const token = jwt.sign(
  { eventId: id, orgId: req.user.organization_id, iat: Math.floor(Date.now() / 1000) },
  QR_SECRET,
  { algorithm: 'HS256' }  // Kein expiresIn - Token laeuft nicht ab, Zeitfenster wird separat geprueft
);
await db.query("UPDATE events SET qr_token = $1 WHERE id = $2 AND organization_id = $3", [token, id, orgId]);
```

**Wichtig:** Token hat KEIN `expiresIn` — die Zeitfenster-Validierung laeuft ueber `event_date` und `checkin_window`, nicht ueber JWT-Expiry. So kann derselbe QR-Code jedes Mal wenn das Event stattfindet wiederverwendet werden (falls noetig).

### Pattern 2: QR-Check-in Endpoint (Backend)
**What:** Neuer Endpoint der Token validiert, Zeitfenster prueft, und Attendance setzt
**When to use:** Wenn Konfi einen QR-Code scannt

```javascript
// POST /events/qr-checkin
// Body: { token: "..." }
// 1. jwt.verify(token, QR_SECRET) -> { eventId, orgId }
// 2. Pruefe: User hat Booking mit status = 'confirmed' fuer dieses Event
// 3. Pruefe: attendance_status ist noch NULL (kein Duplikat)
// 4. Pruefe: Zeitfenster (event_date - checkin_window <= NOW <= event_date + checkin_window)
// 5. UPDATE event_bookings SET attendance_status = 'present'
// 6. Punkte-Vergabe (gleiche Logik wie bestehender Attendance-Endpoint)
```

### Pattern 3: In-App Scanner Modal (Frontend)
**What:** Fullscreen Modal mit Kamera-Preview und QR-Scan
**When to use:** Konfi klickt "Einchecken" oder FAB

```typescript
// QRScannerModal.tsx
import QrScanner from 'qr-scanner';

// Im Modal:
const videoRef = useRef<HTMLVideoElement>(null);
const scannerRef = useRef<QrScanner | null>(null);

useEffect(() => {
  if (!videoRef.current) return;
  const scanner = new QrScanner(
    videoRef.current,
    (result) => handleScanResult(result.data),
    {
      preferredCamera: 'environment',
      maxScansPerSecond: 5,
      highlightScanRegion: true,
      highlightCodeOutline: true,
      returnDetailedScanResult: true,
    }
  );
  scannerRef.current = scanner;
  scanner.start().catch(err => setPermissionDenied(true));
  return () => scanner.destroy();
}, []);
```

### Pattern 4: Admin QR-Display Modal mit Polling
**What:** Fullscreen QR-Anzeige mit Live-Zaehler
**When to use:** Admin zeigt QR-Code fuer Event

```typescript
// QRDisplayModal.tsx - Polling fuer Live-Zaehler
useEffect(() => {
  const interval = setInterval(async () => {
    try {
      const res = await api.get(`/events/${eventId}/attendance-count`);
      setCheckedInCount(res.data.checked_in);
      setTotalCount(res.data.total);
    } catch (e) { /* ignore polling errors */ }
  }, 10000);
  return () => clearInterval(interval);
}, [eventId]);
```

### Anti-Patterns to Avoid
- **IonModal isOpen={state}:** Projekt-Konvention verbietet dies. IMMER useIonModal Hook verwenden.
- **Scanner im Hintergrund weiterlaufen lassen:** Scanner MUSS bei Modal-Close destroyed werden (Kamera freigeben, Batterie sparen).
- **JWT_SECRET fuer QR-Token:** Besser ein separates QR_SECRET verwenden (oder Fallback auf JWT_SECRET). Wenn jemand ein Auth-JWT bekommt, soll er keine QR-Tokens faelschen koennen.
- **Token-Expiry statt Zeitfenster:** JWT `expiresIn` ist NICHT das richtige Werkzeug fuer Check-in-Zeitfenster. Das Zeitfenster bezieht sich auf event_date, nicht auf Token-Erstellungszeitpunkt.
- **Auto-Enrollment bei QR-Scan:** Wenn ein Konfi nicht angemeldet ist (kein Booking), darf der Scan NICHT automatisch eine Buchung erstellen.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR-Code Dekodierung | Eigener Canvas-basierter Decoder | `qr-scanner` mit Web Worker | Robuste Erkennung unter verschiedenen Lichtverhaeltnissen, Winkel-Toleranz, Performance |
| QR-Code Generierung | Canvas-Manipulation | `qrcode` (bereits installiert) | Fehlerkorrektur-Level, Groessen-Optimierung, Data-URL-Output |
| Kamera-Stream Management | getUserMedia + Video-Element manuell | `qr-scanner` (handhabt Kamera intern) | Permission-Handling, Kamera-Wechsel, Cleanup, Browser-Kompatibilitaet |
| Token-Signierung | Eigene HMAC-Implementierung | `jsonwebtoken` (bereits installiert) | Standard JWT-Format, Verifikation, Payload-Encoding |

**Key insight:** Die gesamte Scanner-Komplexitaet (Kamera-Zugriff, Frame-Analyse, Worker-Threading, Fehlerkorrektur) ist in `qr-scanner` gekapselt. Der eigene Code beschraenkt sich auf: Modal oeffnen, Scanner starten, Ergebnis an Backend senden.

## Common Pitfalls

### Pitfall 1: Kamera-Berechtigung auf iOS
**What goes wrong:** iOS Safari/WKWebView zeigt keinen Permission-Dialog wenn die App-Info.plist keinen NSCameraUsageDescription hat, oder wenn die Permission schon abgelehnt wurde.
**Why it happens:** iOS braucht eine Erklaerung WARUM die Kamera gebraucht wird. Einmal abgelehnt, kann die App nicht erneut fragen.
**How to avoid:** NSCameraUsageDescription ist bereits in Info.plist vorhanden (fuer Chat-Fotos). Text sollte aktualisiert werden um QR-Scanning zu erwaehnen. Bei abgelehnter Permission: klare Meldung mit Verweis auf Einstellungen anzeigen.
**Warning signs:** Scanner zeigt schwarzes Bild oder `NotAllowedError`.

### Pitfall 2: Scanner-Cleanup bei Modal-Close
**What goes wrong:** Kamera laeuft weiter im Hintergrund, Batterie wird geleert, naechster Scanner-Start schlaegt fehl weil Kamera "in use" ist.
**Why it happens:** `qr-scanner.destroy()` wird nicht aufgerufen wenn Modal geschlossen wird.
**How to avoid:** useEffect Cleanup-Funktion MUSS `scanner.destroy()` aufrufen. Zusaetzlich onWillDismiss Handler nutzen.
**Warning signs:** Gruene Kamera-LED bleibt an nach Scanner-Schliessung.

### Pitfall 3: Worker-File-Path in Vite Build
**What goes wrong:** `qr-scanner` findet den Worker-File nicht nach dem Build.
**Why it happens:** Vite benennt Assets um (Hashing), aber qr-scanner erwartet den Worker unter einem bestimmten Pfad.
**How to avoid:** Worker-File muss in `public/` kopiert werden ODER statisch importiert werden: `QrScanner.WORKER_PATH = '/qr-scanner-worker.min.js'`. Alternativ: Vite Plugin zum Kopieren verwenden. Oder seit neueren Versionen: `import QrScannerWorkerPath from 'qr-scanner/qr-scanner-worker.min.js?url'; QrScanner.WORKER_PATH = QrScannerWorkerPath;`
**Warning signs:** Konsolen-Fehler "Failed to load worker", Scanner startet nicht.

### Pitfall 4: Zeitfenster-Berechnung mit Zeitzonen
**What goes wrong:** Event um 10:00 Uhr wird als 09:00 oder 11:00 Uhr interpretiert, Check-in wird faelschlicherweise abgelehnt.
**Why it happens:** `event_date` wird in UTC gespeichert, Vergleich muss in derselben Timezone passieren.
**How to avoid:** Zeitfenster-Pruefung komplett im Backend mit PostgreSQL `NOW()` und `event_date` (beide in UTC). NICHT im Frontend berechnen.
**Warning signs:** Check-in funktioniert zu bestimmten Uhrzeiten nicht, Fehlermeldungen zeigen falsche Zeiten.

### Pitfall 5: Doppelter Check-in bei langsamem Netzwerk
**What goes wrong:** Konfi scannt, Netzwerk ist langsam, scannt nochmal — zwei Requests gleichzeitig unterwegs.
**Why it happens:** Scanner bleibt offen und scannt kontinuierlich.
**How to avoid:** Nach erstem erfolgreichen Scan sofort `scanner.stop()` aufrufen und Loading-State anzeigen. Backend-seitig: `attendance_status IS NULL` als Bedingung im UPDATE (idempotent). Frontend-seitig: Scanning-Flag setzen das weitere Verarbeitung blockiert.
**Warning signs:** Doppelte Push-Nachrichten, doppelte Punkte-Vergabe.

### Pitfall 6: Android CAMERA Permission in Manifest
**What goes wrong:** Kamera-Zugriff funktioniert nicht auf Android-Geraeten.
**Why it happens:** AndroidManifest.xml hat keine `<uses-permission android:name="android.permission.CAMERA" />` Zeile. Aktuell ist nur INTERNET dort.
**How to avoid:** CAMERA Permission im AndroidManifest.xml hinzufuegen.
**Warning signs:** Permission-Dialog erscheint nicht, Scanner bleibt schwarz.

## Code Examples

### QR-Token Generierung (Backend)
```javascript
// In events.js - neuer Endpoint
router.post('/:id/generate-qr', rbacVerifier, requireTeamer, async (req, res) => {
  const { id } = req.params;

  // Pruefen ob Event existiert und zur Organisation gehoert
  const { rows: [event] } = await db.query(
    "SELECT id, qr_token FROM events WHERE id = $1 AND organization_id = $2",
    [id, req.user.organization_id]
  );
  if (!event) return res.status(404).json({ error: 'Event nicht gefunden' });

  // Wenn bereits generiert, zurueckgeben
  if (event.qr_token) {
    return res.json({ qr_token: event.qr_token });
  }

  // Neuen Token generieren
  const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET;
  const token = jwt.sign(
    { eid: parseInt(id), oid: req.user.organization_id },
    QR_SECRET,
    { algorithm: 'HS256' }
  );

  await db.query("UPDATE events SET qr_token = $1 WHERE id = $2", [token, id]);
  res.json({ qr_token: token });
});
```

### QR-Check-in Endpoint (Backend)
```javascript
// In events.js - neuer Endpoint fuer Konfi-Self-Check-in
router.post('/qr-checkin', rbacVerifier, async (req, res) => {
  const { token } = req.body;
  const userId = req.user.id;

  // 1. Token verifizieren
  const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET;
  let payload;
  try {
    payload = jwt.verify(token, QR_SECRET);
  } catch (err) {
    return res.status(400).json({ error: 'Ungueltiger QR-Code' });
  }

  const eventId = payload.eid;

  // 2. Event laden und Zeitfenster pruefen
  const { rows: [event] } = await db.query(
    `SELECT id, name, event_date, checkin_window, mandatory, points, point_type, qr_token, organization_id
     FROM events WHERE id = $1 AND qr_token = $2`,
    [eventId, token]
  );
  if (!event) return res.status(404).json({ error: 'Event nicht gefunden' });

  // Org-Check
  if (event.organization_id !== req.user.organization_id) {
    return res.status(403).json({ error: 'Kein Zugriff' });
  }

  // 3. Zeitfenster pruefen
  const window = event.checkin_window || 30;
  const { rows: [timeCheck] } = await db.query(
    `SELECT NOW() BETWEEN (event_date - ($1 || ' minutes')::interval)
                    AND (event_date + ($1 || ' minutes')::interval) AS in_window,
            event_date,
            NOW() < (event_date - ($1 || ' minutes')::interval) AS too_early,
            NOW() > (event_date + ($1 || ' minutes')::interval) AS too_late
     FROM events WHERE id = $2`,
    [window, eventId]
  );

  if (!timeCheck.in_window) {
    if (timeCheck.too_early) {
      return res.status(400).json({
        error: 'Check-in ist noch nicht moeglich',
        error_type: 'too_early',
        event_date: event.event_date,
        checkin_window: window
      });
    }
    return res.status(400).json({
      error: 'Der Check-in-Zeitraum ist abgelaufen',
      error_type: 'too_late'
    });
  }

  // 4. Booking pruefen
  const { rows: [booking] } = await db.query(
    `SELECT id, status, attendance_status FROM event_bookings
     WHERE event_id = $1 AND user_id = $2`,
    [eventId, userId]
  );

  if (!booking) return res.status(400).json({ error: 'Du bist nicht fuer dieses Event angemeldet', error_type: 'not_registered' });
  if (booking.status === 'opted_out') return res.status(400).json({ error: 'Du hast dich von diesem Event abgemeldet', error_type: 'opted_out' });
  if (booking.status !== 'confirmed') return res.status(400).json({ error: 'Deine Anmeldung ist nicht bestaetigt', error_type: 'not_confirmed' });
  if (booking.attendance_status === 'present') return res.status(200).json({ message: 'Du bist bereits eingecheckt', already_checked_in: true, event_name: event.name });

  // 5. Attendance setzen + Punkte (gleiche Logik wie bestehender Endpoint)
  // ... Transaction mit Punkte-Vergabe analog zu PUT /:id/participants/:participantId/attendance
});
```

### Scanner Modal (Frontend)
```typescript
// QRScannerModal.tsx
import QrScanner from 'qr-scanner';

const QRScannerModal: React.FC<{ onClose: () => void; onSuccess: (eventId: number) => void }> = ({ onClose, onSuccess }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (!videoRef.current) return;
    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        if (scanning) return; // Verhindere doppelte Verarbeitung
        setScanning(true);
        handleScan(result.data);
      },
      { preferredCamera: 'environment', maxScansPerSecond: 5, highlightScanRegion: true, returnDetailedScanResult: true }
    );
    scannerRef.current = scanner;
    scanner.start().catch(() => setPermissionDenied(true));
    return () => scanner.destroy();
  }, []);

  const handleScan = async (data: string) => {
    try {
      const res = await api.post('/events/qr-checkin', { token: data });
      if (res.data.already_checked_in) {
        setInfo('Du bist bereits eingecheckt');
        setTimeout(() => { setScanning(false); setInfo(null); }, 2000);
      } else {
        onSuccess(res.data.event_id);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'QR-Code konnte nicht verarbeitet werden');
      setTimeout(() => { setScanning(false); setError(null); }, 3000);
    }
  };

  // ... Render: Fullscreen video + Overlay + Error/Info Banner
};
```

### QR-Display Modal (Frontend)
```typescript
// QRDisplayModal.tsx - Admin
import QRCode from 'qrcode';

const QRDisplayModal: React.FC<{ eventId: number; eventName: string; eventDate: string; onClose: () => void }> = (props) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [checkedIn, setCheckedIn] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadQR();
    const interval = setInterval(pollAttendance, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadQR = async () => {
    const res = await api.post(`/events/${props.eventId}/generate-qr`);
    const dataUrl = await QRCode.toDataURL(res.data.qr_token, {
      width: 512, margin: 2, color: { dark: '#000000', light: '#ffffff' }
    });
    setQrDataUrl(dataUrl);
  };

  // ... Render: weisser Hintergrund, grosser QR, Event-Info, Zaehler "X/Y eingecheckt"
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cordova BarcodeScanner Plugin | Web-basierte Scanner (qr-scanner, html5-qrcode) | 2022-2023 | Kein nativer Plugin-Overhead, funktioniert auch im Browser-Dev |
| jsQR (Main-Thread) | qr-scanner (Web Worker) | 2021+ | Keine UI-Blockierung bei Frame-Analyse |
| ZXing.js | Nativer Decoder in qr-scanner | 2020+ | Kleinere Bundle-Size, bessere Performance |

**Deprecated/outdated:**
- `@capacitor-community/barcode-scanner`: Erfordert Background-Transparency-Hacks, invasiv fuer Ionic-Apps
- `jsQR`: Entwicklung dormant, Main-Thread-blockierend
- `html5-qrcode`: Letzte Veroeffentlichung vor 3 Jahren, nutzt ZXing.js in Maintenance-Mode

## Open Questions

1. **Worker-Path in Vite/Capacitor Build**
   - What we know: qr-scanner braucht einen Worker-File der ueber URL geladen wird
   - What's unclear: Ob der moderne `?url` Import-Suffix in Vite mit Capacitor korrekt funktioniert
   - Recommendation: Testen mit `import workerPath from 'qr-scanner/qr-scanner-worker.min.js?url'`. Fallback: Worker-File nach `public/` kopieren.

2. **QR_SECRET Environment Variable**
   - What we know: Separates Secret waere sicherer, aber JWT_SECRET als Fallback ist akzeptabel
   - What's unclear: Ob auf dem Server eine separate ENV-Variable hinzugefuegt werden soll
   - Recommendation: `QR_SECRET` mit Fallback auf `JWT_SECRET` implementieren. In Produktion separates Secret setzen.

3. **Kamera-Performance in Ionic WebView**
   - What we know: qr-scanner funktioniert im Browser und WebView
   - What's unclear: Performance auf aelteren Android-Geraeten mit Ionic WebView
   - Recommendation: `maxScansPerSecond: 5` setzen (statt Default 25) um CPU-Last zu reduzieren

## Sources

### Primary (HIGH confidence)
- Bestehendes Codebase: `backend/routes/events.js` (Attendance-Route Zeilen 1406-1526)
- Bestehendes Codebase: `frontend/src/components/admin/pages/AdminInvitePage.tsx` (QRCode.toDataURL Pattern)
- Bestehendes Codebase: `frontend/package.json` (qrcode v1.5.4, @capacitor/camera v7.0.1)
- Bestehendes Codebase: `backend/package.json` (jsonwebtoken v9.0.2)
- [qr-scanner GitHub README](https://github.com/nimiq/qr-scanner) - API, Constructor Options, Worker Setup

### Secondary (MEDIUM confidence)
- [npm-compare: jsqr vs html5-qrcode vs qr-scanner](https://npm-compare.com/html5-qrcode,jsqr,qr-scanner,qrcode-reader) - Library-Vergleich und Download-Stats
- [html5-qrcode npm](https://www.npmjs.com/package/html5-qrcode) - Letzte Veroeffentlichung vor 3 Jahren (v2.3.8)

### Tertiary (LOW confidence)
- [Dynamsoft Blog](https://www.dynamsoft.com/codepool/ionic-react-qr-code-scanner.html) - Ionic React QR Scanner Patterns (kommerzielles Produkt, aber nuetzliche Architektur-Einblicke)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - `qr-scanner` ist die klare Empfehlung, alle anderen Libraries sind bereits installiert
- Architecture: HIGH - Baut auf bestehenden Patterns auf (useIonModal, QRCode.toDataURL, JWT, Attendance-Route)
- Pitfalls: HIGH - Kamera-Permissions, Worker-Path, Zeitfenster-Zeitzonen sind gut dokumentierte Probleme

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stabiles Domain, keine schnellen Aenderungen erwartet)
