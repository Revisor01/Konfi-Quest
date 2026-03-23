# Phase 34: Pflicht-Event-Grundlagen - Research

**Researched:** 2026-03-09
**Domain:** Pflicht-Event-Erstellung mit Auto-Enrollment, Punkte-Guard und "Was mitbringen"-Feld
**Confidence:** HIGH

## Summary

Phase 34 erweitert das bestehende Event-System um Pflicht-Events (mandatory-Flag), Auto-Enrollment aller Jahrgangs-Konfis, Punkte-Unterdrueckung und ein optionales "Was mitbringen"-Textfeld. Die Codebase bietet solide Grundlagen: `event_bookings` mit `attendance_status`, `event_jahrgang_assignments` fuer Jahrgangs-Zuweisung, und eine funktionierende Push-Infrastruktur mit 18 Push-Types. Keine neuen Dependencies noetig.

Die Hauptrisiken liegen in drei Schema-Constraints die im Weg stehen: (1) `max_participants` hat `NOT NULL CHECK (max_participants > 0)` -- Pflicht-Events brauchen entweder einen hohen Dummy-Wert oder der Constraint muss auf `>= 0` geaendert werden. (2) `status CHECK (status IN ('confirmed', 'pending', 'cancelled'))` ist nicht synchron mit der Live-DB (Code nutzt bereits 'waitlist'). (3) Die Nachtrags-Enrollment-Logik fuer neue Konfis erfordert Hooks an zwei Stellen: `auth.js` (Registrierung via Invite-Code, Zeile 594) und `konfi-managment.js` (Jahrgang-Wechsel, Zeile 258).

**Primary recommendation:** Schema-Migration ZUERST (Constraints fixen + neue Spalten), dann Backend-Logik (Auto-Enrollment + Punkte-Guard), dann Frontend (EventModal + Push). Alles in einer Phase machbar, da keine neuen Dependencies und nur bestehende Patterns erweitert werden.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PFL-01 | Admin kann ein Event als "verpflichtend" markieren (mandatory-Toggle im EventModal) | Neue `mandatory BOOLEAN DEFAULT false` Spalte auf `events`. EventModal.tsx bekommt IonToggle. Bei mandatory=true: points-Feld ausblenden, max_participants irrelevant machen. |
| PFL-02 | Bei Pflicht-Event werden alle Konfis der zugewiesenen Jahrgaenge automatisch als angemeldet eingetragen (Auto-Enrollment) | Batch-INSERT mit `ON CONFLICT DO NOTHING` ueber `konfi_profiles JOIN users WHERE jahrgang_id = ANY($2) AND organization_id = $3`. Nachtrags-Hook bei Konfi-Registrierung (auth.js:594) und Jahrgang-Wechsel (konfi-managment.js:258). |
| PFL-03 | Pflicht-Events vergeben keine Punkte (Punkte-Feld wird ausgeblendet/deaktiviert, Backend-Guard) | Bestehende Attendance-Route (events.js:1314) hat bereits Guard: `if (attendance_status === 'present' && eventData.points > 0)`. Bei mandatory=true wird points=0 erzwungen im Backend. EventModal blendet Punkte-Feld aus. |
| PFL-04 | Konfis erhalten Push-Benachrichtigung wenn ein neues Pflicht-Event erstellt wird | Bestehende `PushService.sendNewEventToOrgKonfis()` (pushService.js:718) kann wiederverwendet oder durch jahrgangs-spezifische Variante ergaenzt werden. `sendToMultipleUsers()` (pushService.js:119) fuer Batch-Push. |
| EUI-01 | Events haben ein optionales "Was mitbringen"-Textfeld, das in der Event-Detail-Ansicht angezeigt wird | Neue `bring_items TEXT` Spalte auf `events`. Nullable, fuer ALLE Events (nicht nur Pflicht). Im EventModal als IonTextarea. In Admin- und Konfi-EventDetailView anzeigen. |
</phase_requirements>

## Standard Stack

### Core (unveraendert, erweitert genutzt)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL (pg) | ^8.16.3 | Neue Spalten auf `events`, Batch-INSERT fuer Auto-Enrollment | Bestehendes DB-Pattern, keine neue Dependency |
| Express + express-validator | ^4.18.2 / ^7.3.1 | Event-Erstellung erweitern, Validierung fuer mandatory/bring_items | Bestehende Route-Patterns in events.js |
| firebase-admin | ^12.7.0 | Push-Notification an auto-enrolled Konfis | Bestehender PushService, 18 Push-Types |
| Socket.io | ^4.7/^4.8 | Live-Update bei Auto-Enrollment | `liveUpdate.sendToOrg()` Pattern existiert |
| React + Ionic | 19 / 8 | EventModal erweitern (IonToggle, IonTextarea) | Bestehende UI-Patterns, useIonModal |

### Keine neuen Dependencies

Phase 34 braucht NULL neue npm-Packages. Alles wird mit bestehendem Stack geloest.

## Architecture Patterns

### Empfohlene Aenderungen

```
backend/
  routes/events.js          # POST/PUT erweitern: mandatory, bring_items, Auto-Enrollment
  routes/auth.js             # Nachtrags-Enrollment bei Konfi-Registrierung
  routes/konfi-managment.js  # Nachtrags-Enrollment bei Jahrgang-Wechsel
  services/pushService.js    # Optionaler neuer Push-Type fuer Pflicht-Events
frontend/
  components/admin/modals/EventModal.tsx  # mandatory-Toggle, bring_items-Feld, Felder-Ausblendung
  components/admin/views/EventDetailView.tsx  # bring_items anzeigen
  components/konfi/views/EventDetailView.tsx  # bring_items anzeigen
  types/                     # Event-Interface erweitern
```

### Pattern 1: Batch-INSERT fuer Auto-Enrollment
**Was:** Ein einziger SQL-Query enrolled alle Jahrgangs-Konfis
**Wann:** `mandatory === true` bei Event-Erstellung (POST /events)
**Beispiel:**
```javascript
// NACH Event-Insert und NACH Jahrgang-Assignments
if (mandatory && jahrgang_ids && jahrgang_ids.length > 0) {
  const enrollQuery = `
    INSERT INTO event_bookings (event_id, user_id, status, booking_date, organization_id)
    SELECT $1, u.id, 'confirmed', NOW(), $3
    FROM users u
    JOIN konfi_profiles kp ON u.id = kp.user_id
    JOIN roles r ON u.role_id = r.id
    WHERE kp.jahrgang_id = ANY($2::int[])
      AND u.organization_id = $3
      AND r.name = 'konfi'
    ON CONFLICT (user_id, event_id) DO NOTHING
  `;
  const { rowCount } = await db.query(enrollQuery, [eventId, jahrgang_ids, req.user.organization_id]);
}
```
**Warum:** Performance (1 Query statt N), ON CONFLICT verhindert Duplikate, `r.name = 'konfi'` filtert nur Konfis (keine Admins/Teamer).

### Pattern 2: Punkte-Guard bei mandatory Events
**Was:** Bei mandatory=true wird points=0 erzwungen
**Wann:** Event-Erstellung und Event-Update
**Bestehender Guard (events.js:1314):**
```javascript
// Diese Zeile existiert bereits:
if (attendance_status === 'present' && eventData.points > 0) {
  // Punkte vergeben
}
// Wenn points=0 fuer mandatory Events erzwungen wird, greift der Guard automatisch
```
**Zusaetzlicher Backend-Guard beim Speichern:**
```javascript
const effectivePoints = mandatory ? 0 : (points || 0);
```

### Pattern 3: Nachtrags-Enrollment bei Jahrgang-Zuweisung
**Was:** Wenn ein Konfi einem Jahrgang zugewiesen wird, alle zukuenftigen Pflicht-Events dieses Jahrgangs finden und Auto-Enrollment ausfuehren
**Hook-Stellen:**
1. `auth.js` Zeile 594: `INSERT INTO konfi_profiles (user_id, jahrgang_id, ...)` -- nach COMMIT
2. `konfi-managment.js` Zeile 258: `UPDATE konfi_profiles SET jahrgang_id = $1 WHERE user_id = $2` -- nach COMMIT
**Enrollment-Query:**
```javascript
const enrollFutureEventsQuery = `
  INSERT INTO event_bookings (event_id, user_id, status, booking_date, organization_id)
  SELECT e.id, $1, 'confirmed', NOW(), $3
  FROM events e
  JOIN event_jahrgang_assignments eja ON e.id = eja.event_id
  WHERE eja.jahrgang_id = $2
    AND e.mandatory = true
    AND e.event_date > NOW()
    AND e.organization_id = $3
    AND e.cancelled IS NOT TRUE
  ON CONFLICT (user_id, event_id) DO NOTHING
`;
await db.query(enrollFutureEventsQuery, [userId, jahrgangId, organizationId]);
```

### Pattern 4: EventModal Feld-Ausblendung
**Was:** Bei mandatory=true werden irrelevante Felder ausgeblendet
**Auszublendende Felder:**
- `points` (IonInput) -- immer 0, ausblenden
- `point_type` (IonSelect) -- irrelevant ohne Punkte, ausblenden
- `max_participants` (IonInput) -- alle sind enrolled, ausblenden oder hohen Default setzen
- `registration_opens_at` / `registration_closes_at` -- irrelevant, ausblenden
- `waitlist_enabled` / `max_waitlist_size` -- irrelevant, ausblenden
**Sichtbar bleiben:**
- `name`, `description`, `event_date`, `event_end_time`, `location`, `location_maps_url`
- `category_ids`, `jahrgang_ids` (PFLICHT bei mandatory -- ohne Jahrgang kein Enrollment)
- `bring_items` (NEU)
- `has_timeslots` -- fraglich, wahrscheinlich auch irrelevant fuer Pflicht-Events

### Anti-Patterns zu vermeiden
- **max_participants=0 ohne Constraint-Aenderung:** Der CHECK-Constraint `max_participants > 0` verhindert das. Entweder Constraint auf `>= 0` aendern, oder einen hohen Dummy-Wert (9999) verwenden, oder das Feld NULL-bar machen.
- **Auto-Enrollment ueber den bestehenden Book-Endpunkt:** Der Book-Endpunkt (events.js:730-828) prueft Kapazitaet, Registrierungsfenster, Waitlist -- alles irrelevant fuer Pflicht-Events. Direkte DB-Inserts verwenden.
- **Bestehenden Abmelde-Flow fuer Opt-out verwenden:** Der bestehende Flow LOESCHT Bookings (`DELETE FROM event_bookings`). Bei Pflicht-Events muss die Booking BESTEHEN BLEIBEN. Opt-out ist Phase 35, aber die Datenstruktur muss in Phase 34 schon richtig angelegt werden.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Push an alle Jahrgangs-Konfis | Eigene Push-Loop | `PushService.sendToMultipleUsers()` mit User-IDs aus Enrollment-Query | Bestehender Batch-Push-Mechanismus, Token-Lookup inklusive |
| Live-Update an alle Beteiligten | Eigenes Socket-Event | `liveUpdate.sendToOrg()` mit 'events' type | Bestehendes Pattern, alle Admins+Konfis der Org werden benachrichtigt |
| Validierung der Event-Felder | Manuelle if-Checks | `express-validator` body() Rules erweitern | Bestehende validateCreateEvent/validateUpdateEvent Arrays |
| Jahrgangs-Konfi-Lookup | Separate Query + Loop | Ein Batch-INSERT mit JOIN | ON CONFLICT DO NOTHING loest alle Edge Cases (Duplikate, bestehende Bookings) |

## Common Pitfalls

### Pitfall 1: CHECK-Constraint auf event_bookings.status blockiert 'waitlist'
**Was schiefgeht:** Schema-Datei definiert `CHECK (status IN ('confirmed', 'pending', 'cancelled'))`. Die Live-DB nutzt aber bereits 'waitlist'. Bei Fresh-Setup (neuer Docker-Container) wuerde 'waitlist' scheitern.
**Warum es passiert:** Schema nie nachtraeglich synchronisiert.
**Wie vermeiden:** Migration MUSS den CHECK-Constraint auf `('confirmed', 'waitlist', 'cancelled')` aktualisieren. `pending` kann entfernt werden (wird nirgends im Code verwendet). Die Schema-Datei (`01-create-schema.sql` Zeile 387) muss ebenfalls aktualisiert werden.
**Warnung:** Auch wenn Phase 34 keinen neuen Status einfuehrt (Auto-Enrolled bekommen 'confirmed'), muss der Constraint JETZT gefixt werden, weil Phase 35 (Opt-out) den Status 'opted_out' braucht.

### Pitfall 2: max_participants NOT NULL CHECK (max_participants > 0)
**Was schiefgeht:** Pflicht-Events brauchen keine Teilnehmerbegrenzung. Aber `max_participants` ist NOT NULL mit CHECK > 0.
**Wie vermeiden:** Zwei Optionen:
- **Option A (empfohlen):** Constraint auf `CHECK (max_participants >= 0)` aendern. 0 = unbegrenzt (konsistent mit bestehender Logik in events.js Zeile 798: `if (totalCapacity > 0 && ...)`).
- **Option B:** Bei mandatory Events `max_participants = 9999` als Dummy-Wert setzen.
- Schema-Datei Zeile 300 aktualisieren.

### Pitfall 3: Multi-Tenant-Isolation bei Auto-Enrollment
**Was schiefgeht:** Enrollment-Query ohne `organization_id`-Filter enrolled Konfis aus anderen Organisationen die zufaellig dieselbe Jahrgangs-ID haben.
**Wie vermeiden:** JEDE Enrollment-Query MUSS `u.organization_id = $3` im WHERE haben. Jahrgaenge sind global (SERIAL-IDs), nicht org-spezifisch.

### Pitfall 4: Push-Notification-Spam bei Massen-Enrollment
**Was schiefgeht:** 30 Konfis auto-enrolled = 30 einzelne Push-Calls.
**Wie vermeiden:** `PushService.sendToMultipleUsers()` fuer Batch-Push verwenden. Oder `sendNewEventToOrgKonfis()` (sendet ohnehin an alle Org-Konfis) wiederverwenden -- da Pflicht-Events immer fuer bestimmte Jahrgaenge sind, waere eine jahrgangs-spezifische Push-Methode praeziser.

### Pitfall 5: event_unregistrations nicht in Schema-Datei
**Was schiefgeht:** Der Code referenziert `event_unregistrations` (events.js Zeile 325-332), aber die Tabelle ist NICHT in `01-create-schema.sql` definiert. Sie existiert nur in der Live-DB.
**Wie vermeiden:** Bei der Schema-Synchronisation diese Tabelle in die Schema-Datei aufnehmen. Nicht blockierend fuer Phase 34, aber wichtig fuer Konsistenz.

### Pitfall 6: cancelled-Spalte auf events nicht in Schema
**Was schiefgeht:** Code nutzt `e.cancelled = TRUE` (events.js Zeile 158), aber die Spalte fehlt in der Schema-Datei.
**Wie vermeiden:** Bei der Schema-Synchronisation `cancelled BOOLEAN DEFAULT false` und `cancelled_at TIMESTAMP` aufnehmen. Nicht blockierend, aber die Nachtrags-Enrollment-Query muss `AND e.cancelled IS NOT TRUE` filtern.

## Code Examples

### Event-Erstellung mit mandatory und bring_items erweitern

```javascript
// events.js POST / Route -- Aenderungen am insertEventQuery:
const insertEventQuery = `
  INSERT INTO events (
    name, description, event_date, event_end_time, location, location_maps_url,
    points, point_type, type, max_participants, registration_opens_at,
    registration_closes_at, has_timeslots, waitlist_enabled, max_waitlist_size,
    is_series, series_id, created_by, organization_id,
    mandatory, bring_items  -- NEU
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
  RETURNING id
`;

// Werte vorbereiten mit Pflicht-Guards:
const effectivePoints = mandatory ? 0 : (points || 0);
const effectiveMaxParticipants = mandatory ? 0 : max_participants;  // 0 = unbegrenzt
const effectiveWaitlist = mandatory ? false : (waitlist_enabled !== undefined ? waitlist_enabled : true);
```

### EventModal.tsx -- Mandatory-Toggle und Feld-Ausblendung

```typescript
// State im EventModal:
const [mandatory, setMandatory] = useState(event?.mandatory || false);
const [bringItems, setBringItems] = useState(event?.bring_items || '');

// Toggle:
<IonItem>
  <IonLabel>Pflicht-Event</IonLabel>
  <IonToggle
    checked={mandatory}
    onIonChange={(e) => setMandatory(e.detail.checked)}
  />
</IonItem>

// bring_items Feld (immer sichtbar):
<IonItem>
  <IonLabel position="stacked">Was mitbringen (optional)</IonLabel>
  <IonTextarea
    value={bringItems}
    onIonInput={(e) => setBringItems(e.detail.value || '')}
    placeholder="z.B. Bibel, Stift, Block"
    rows={2}
  />
</IonItem>

// Felder ausblenden bei mandatory:
{!mandatory && (
  <>
    {/* points, point_type, max_participants, registration dates, waitlist */}
  </>
)}
```

### Nachtrags-Enrollment in auth.js

```javascript
// Nach COMMIT in auth.js (Zeile 598), nach der Push-Notification:
// Auto-Enrollment fuer zukuenftige Pflicht-Events
try {
  const enrollQuery = `
    INSERT INTO event_bookings (event_id, user_id, status, booking_date, organization_id)
    SELECT e.id, $1, 'confirmed', NOW(), $2
    FROM events e
    JOIN event_jahrgang_assignments eja ON e.id = eja.event_id
    WHERE eja.jahrgang_id = $3
      AND e.mandatory = true
      AND e.event_date > NOW()
      AND e.organization_id = $2
      AND e.cancelled IS NOT TRUE
    ON CONFLICT (user_id, event_id) DO NOTHING
  `;
  await db.query(enrollQuery, [newUser.id, invite.organization_id, invite.jahrgang_id]);
} catch (enrollErr) {
  console.error('Auto-enrollment fuer Pflicht-Events fehlgeschlagen:', enrollErr);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Schema nur in init-scripts | Schema + Migrations-Dateien | v1.4+ | Migrations muessen idempotent sein (IF NOT EXISTS) |
| CHECK-Constraint mit 'pending' | Live-DB nutzt 'waitlist' | Irgendwann nach v1.0 | Schema-Datei ist out of sync, muss gefixt werden |
| Push an alle Org-Konfis | Jahrgangs-spezifische Push moeglich | v1.5 (Push-Foundation) | `sendToMultipleUsers()` mit gefilterten User-IDs |

## Open Questions

1. **max_participants-Constraint Strategie**
   - Was wir wissen: `CHECK (max_participants > 0)` und `NOT NULL` verhindern den Wert 0
   - Was unklar ist: Ob die Live-DB denselben Constraint hat (koennte bereits geaendert sein)
   - Empfehlung: Constraint auf `>= 0` aendern (0 = unbegrenzt). Die bestehende Kapazitaetslogik (Zeile 798) behandelt `> 0` bereits als Bedingung fuer die Pruefung.

2. **Jahrgang-Pflicht bei mandatory Events**
   - Was wir wissen: mandatory ohne jahrgang_ids macht keinen Sinn (wen enrollen?)
   - Was unklar ist: Soll das Backend einen Error werfen oder still nichts tun?
   - Empfehlung: Backend-Validierung: `if (mandatory && (!jahrgang_ids || jahrgang_ids.length === 0)) return 400`. Frontend: jahrgang_ids als Pflichtfeld markieren wenn mandatory=true.

3. **Schema-Synchronisation Umfang**
   - Was wir wissen: Mindestens CHECK-Constraint (status), max_participants-Constraint, event_unregistrations-Tabelle und cancelled-Spalte fehlen
   - Was unklar ist: Gibt es weitere Abweichungen zwischen Schema-Datei und Live-DB?
   - Empfehlung: Nur die fuer Phase 34 relevanten Constraints fixen. Vollstaendige Schema-Synchronisation als separates Housekeeping.

## Sources

### Primary (HIGH confidence -- direkte Codebase-Analyse)
- `init-scripts/01-create-schema.sql` Zeile 289-404: events + event_bookings Schema mit CHECK-Constraints
- `backend/routes/events.js` Zeile 364-435: Event-Erstellung (POST /)
- `backend/routes/events.js` Zeile 1288-1432: Attendance-Route mit Punkte-Guard
- `backend/routes/auth.js` Zeile 580-597: Konfi-Registrierung mit konfi_profiles INSERT
- `backend/routes/konfi-managment.js` Zeile 232-304: Konfi-Update mit Jahrgang-Wechsel
- `backend/services/pushService.js` Zeile 718-753: sendNewEventToOrgKonfis
- `frontend/src/components/admin/modals/EventModal.tsx`: Event-Erstellungs-Modal

### Secondary (HIGH confidence -- Milestone-Research)
- `.planning/research/ARCHITECTURE.md`: Datenfluss-Design fuer Auto-Enrollment
- `.planning/research/PITFALLS.md`: 15 identifizierte Pitfalls mit Code-Referenzen
- `.planning/research/STACK.md`: Stack-Empfehlungen fuer v1.7
- `.planning/research/FEATURES.md`: Feature-Landscape mit Abhaengigkeiten

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Keine neuen Dependencies, alles bestehendes Pattern
- Architecture: HIGH -- Batch-INSERT, Punkte-Guard und Push-Patterns direkt aus Code verifiziert
- Pitfalls: HIGH -- CHECK-Constraints und Schema-Abweichungen direkt in Dateien gefunden

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stabiles Projekt, keine externen Dependencies)
