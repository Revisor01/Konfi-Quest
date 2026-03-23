# Phase 35: Opt-out-Flow - Research

**Researched:** 2026-03-09
**Domain:** Event-Booking Status-Management, Push-Notifications, Konfi/Admin UI
**Confidence:** HIGH

## Summary

Phase 35 implementiert den Opt-out-Flow fuer Pflicht-Events. Der Kern ist ein Status-Wechsel auf `event_bookings` von `confirmed` auf `opted_out` (kein DELETE), mit Pflicht-Begruendung und Push-Benachrichtigungen an Admins. Der bestehende `opted_out` Status existiert bereits im CHECK-Constraint der Datenbank.

Die Implementierung nutzt fast ausschliesslich bestehende Patterns: Das `UnregisterModal` wird mit einem `mandatory`-Prop erweitert, das Push-Pattern `sendEventUnregistrationToAdmins` dient als Vorlage, und die Teilnehmerliste im Admin-View bekommt eine zusaetzliche visuelle Darstellung fuer opted_out-Eintraege.

**Primary recommendation:** Zwei neue Backend-Endpoints (POST opt-out, POST opt-in) statt den bestehenden DELETE-Endpoint wiederzuverwenden, da Pflicht-Events kein DELETE sondern einen Status-Wechsel brauchen. Frontend-Aenderungen konzentrieren sich auf das UnregisterModal (mandatory-Prop), die Konfi-EventDetailView (Opt-out/Opt-in Buttons) und die Admin-EventDetailView (opted_out Darstellung in Teilnehmerliste).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Booking-Status von 'confirmed' auf 'opted_out' aendern (NICHT DELETE)
- opt_out_reason (Text) und opt_out_date (Timestamp) als neue Spalten auf event_bookings
- Keine separate Log-Tabelle noetig — alles in event_bookings
- 'opted_out' Status existiert bereits im CHECK-Constraint
- Keine Frist: Opt-out jederzeit moeglich (auch am selben Tag), nur nicht nach Event-Ende
- Konfi kann Opt-out selbst rueckgaengig machen (opted_out -> confirmed), Begruendung bleibt gespeichert
- Begruendung ist Pflichtfeld bei Opt-out, mindestens 5 Zeichen
- Button erst aktiv wenn Text eingegeben
- Bestehendes UnregisterModal wiederverwenden, mit leicht angepasstem Text bei Pflicht-Events (mandatory-Prop)
- Bei Pflicht-Events: Hinweis dass Begruendung Pflicht ist
- Opt-out-Status in Konfi-EventDetailView: ROTER Status-Text 'Du hast dich abgemeldet' + gruener Button 'Wieder anmelden'
- In der Konfi-Event-Liste: Opt-out sichtbar mit roter Markierung/Badge
- ROT ist die Warnfarbe fuer alle Abmeldungen/Abwesenheiten
- Opted-out Konfis bleiben inline in der Teilnehmerliste (keine separate Sektion)
- Roter 'Abgemeldet'-Badge am Eintrag
- Begruendung direkt sichtbar als kleinerer Text unter dem Namen (kein extra Tap noetig)
- Teilnehmer-Zaehler: X/Y Format (z.B. '12/15 Teilnehmer') — X = noch angemeldet, Y = alle Jahrgangs-Konfis
- Push nur an Admins der Organisation (nicht an Konfi) bei Opt-out
- Push-Text enthaelt Begruendung direkt
- Ruecknahme: Push an Admins wenn Konfi sich wieder anmeldet

### Claude's Discretion
- Genauer Wortlaut der Modal-Texte bei Pflicht-Events
- Sortierung der Teilnehmerliste (opted_out am Ende oder gemischt)
- Styling-Details fuer roten Badge und Begruendungstext

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OPT-01 | Konfi kann sich von einem Pflicht-Event mit Freitext-Begruendung abmelden (Opt-out statt Abmeldung) | Neuer POST /konfi/events/:id/opt-out Endpoint (Status-Wechsel confirmed->opted_out), UnregisterModal mit mandatory-Prop, opt_out_reason/opt_out_date Spalten |
| OPT-02 | Admin sieht alle Opt-out-Begruendungen in der Event-Teilnehmerliste | Participants-Query in events.js bereits JOINt event_bookings — erweitern um opt_out_reason/opt_out_date, Admin-EventDetailView Teilnehmerliste um roten Badge + Begruendungstext erweitern |
| OPT-03 | Admin erhaelt Push-Benachrichtigung wenn ein Konfi sich von einem Pflicht-Event abmeldet | Neuer PushService-Methode sendEventOptOutToAdmins (Vorlage: sendEventUnregistrationToAdmins), Push-Text enthaelt Begruendung |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express.js | (bestehend) | Backend-Routing fuer opt-out/opt-in Endpoints | Projektstandardz |
| PostgreSQL | (bestehend) | event_bookings Status-Management, neue Spalten | Projektstandard |
| Ionic React 8 | (bestehend) | UI-Komponenten (IonButton, IonIcon, Badges) | Projektstandard |
| ionicons | (bestehend) | Icons fuer Opt-out/Opt-in UI | Projektstandard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PushService | (intern) | Push-Notifications an Admins | Bei Opt-out und Opt-in Ruecknahme |
| liveUpdate | (intern) | WebSocket Live-Updates | Nach Status-Wechsel |

### Alternatives Considered
Keine — alle Entscheidungen sind durch CONTEXT.md festgelegt.

## Architecture Patterns

### Pattern 1: Status-Wechsel statt DELETE
**What:** Pflicht-Event Abmeldung aendert `event_bookings.status` von `confirmed` auf `opted_out` statt den Datensatz zu loeschen.
**When to use:** Bei Pflicht-Events (mandatory=true)
**Why:** Booking muss erhalten bleiben fuer Transparenz, Wiederanmeldung und Admin-Einsicht.

**Bestehender Unregister-Flow (konfi.js Zeile 1735):**
```javascript
// AKTUELL: DELETE - NICHT fuer Pflicht-Events verwenden!
router.delete('/events/:id/register', ...)
// Loescht event_bookings Zeile komplett
await db.query('DELETE FROM event_bookings WHERE user_id = $1 AND event_id = $2', [konfiId, eventId]);
```

**Neuer Opt-out-Flow:**
```javascript
// NEU: POST /konfi/events/:id/opt-out
// Status-Wechsel, KEIN DELETE
await db.query(
  `UPDATE event_bookings
   SET status = 'opted_out', opt_out_reason = $3, opt_out_date = NOW()
   WHERE user_id = $1 AND event_id = $2 AND status = 'confirmed'`,
  [konfiId, eventId, reason]
);
```

### Pattern 2: UnregisterModal mit mandatory-Prop
**What:** Bestehendes UnregisterModal (`frontend/src/components/konfi/modals/UnregisterModal.tsx`) wird um ein `mandatory`-Prop erweitert.
**When to use:** Bei Pflicht-Events wird mandatory=true gesetzt, bei normalen Events bleibt es false/undefined.

**Bestehende Struktur:**
- Hat bereits Textarea fuer Begruendung
- Hat bereits Abmelden/Abbrechen Buttons
- Hat bereits `reason.trim()` Validierung

**Erweiterung:**
- `mandatory?: boolean` Prop hinzufuegen
- Bei mandatory: Hinweis-Text "Dies ist ein Pflicht-Event. Bitte gib einen Grund fuer deine Abmeldung an."
- Bei mandatory: Mindestens 5 Zeichen Validierung
- Submit-Button disabled wenn `reason.trim().length < 5` (bei mandatory)

### Pattern 3: Bedingte Action-Buttons in EventDetailView
**What:** Die Konfi-EventDetailView zeigt bei Pflicht-Events kontextabhaengige Buttons.
**When to use:** Im Action-Area der Konfi-EventDetailView.

**Aktuelle Logik (Zeile 651-734):**
```typescript
{eventData.mandatory ? (
  // "Du bist automatisch angemeldet" — HIER muss Opt-out-Button rein
) : eventData.is_registered ? (
  // Normaler Abmelde-Flow
) : ...}
```

**Neue Logik:**
```typescript
{eventData.mandatory ? (
  eventData.booking_status === 'opted_out' ? (
    // ROTER Status-Text + gruener "Wieder anmelden" Button
  ) : (
    // "Du bist automatisch angemeldet" + "Abmelden" Button (rot)
  )
) : ...}
```

### Pattern 4: Push mit Begruendung
**What:** Neue PushService-Methoden fuer Opt-out und Opt-in mit Begruendung im Push-Text.
**When to use:** Nach erfolgreichem Status-Wechsel.

**Vorlage (pushService.js Zeile 511):**
```javascript
static async sendEventUnregistrationToAdmins(db, organizationId, konfiName, eventName, reason = null) {
  // Holt alle Admins der Organisation
  // Sendet Push mit Begruendung im Body
}
```

**Neue Methoden:**
- `sendEventOptOutToAdmins(db, organizationId, konfiName, eventName, reason)` — Push mit "hat sich abgemeldet. Grund: ..."
- `sendEventOptInToAdmins(db, organizationId, konfiName, eventName)` — Push mit "hat sich wieder angemeldet"

### Pattern 5: Admin-Teilnehmerliste mit opted_out Darstellung
**What:** Bestehende Participants-Query und -Darstellung erweitern um opted_out Daten.
**When to use:** In der Admin-EventDetailView.

**Bestehende Query (events.js Zeile 261-278):**
```sql
SELECT eb.*, u.display_name as participant_name, kp.jahrgang_id,
       j.name as jahrgang_name, et.start_time, et.end_time
FROM event_bookings eb
JOIN users u ON eb.user_id = u.id
...
ORDER BY CASE eb.status WHEN 'confirmed' THEN 1 WHEN 'waitlist' THEN 2 ELSE 3 END
```
- Diese Query gibt bereits ALLE event_bookings zurueck, also auch `opted_out` Eintraege
- Die neuen Spalten `opt_out_reason` und `opt_out_date` muessen zum SELECT hinzugefuegt werden
- Sortierung: opted_out am Ende (ELSE 3 im ORDER BY greift bereits)

### Anti-Patterns to Avoid
- **DELETE bei Pflicht-Events:** Der bestehende DELETE-Endpoint (`router.delete('/events/:id/register')`) darf bei Pflicht-Events NICHT verwendet werden. STATE.md warnt explizit davor (Blockers/Concerns).
- **Separate Opt-out-Tabelle:** Alles in event_bookings, keine separate Tabelle.
- **Doppelte Logik:** Opt-out Berechtigung nicht in Frontend UND Backend duplizieren — Backend ist die Single Source of Truth (Event nicht vorbei, Booking existiert, Event ist mandatory).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Push an Org-Admins | Eigene Admin-Query | PushService.sendToMultipleUsers + bestehende Admin-Query | Pattern bereits etabliert in sendEventUnregistrationToAdmins |
| Modal-Pattern | Neues Modal | UnregisterModal erweitern | Hat bereits Textarea + Validierung |
| Live-Updates | Eigenes WebSocket-Handling | liveUpdate.sendToKonfi / sendToOrgAdmins | Bestehendes Pattern |
| Status-Badge-Styling | Eigene CSS-Klassen | Bestehende app-icon-color--danger / Inline-Styles mit #dc2626 | Rote Warnfarbe ist Projekt-Standard |

## Common Pitfalls

### Pitfall 1: Konfi-Events-Query filtert opted_out heraus
**What goes wrong:** Die Konfi-Events-Query (`konfi.js` Zeile 1127) zaehlt `registered_count` nur fuer `status = 'confirmed'`. Das ist korrekt. ABER: `is_registered` wird ueber `eb_konfi.id IS NOT NULL` berechnet — das ist TRUE auch bei `opted_out`.
**Why it happens:** Die Query JOINt `eb_konfi` ohne Status-Filter.
**How to avoid:** `is_registered` muss pruefen ob `eb_konfi.status = 'confirmed'` (nicht nur ob Booking existiert). Oder neues Feld `is_opted_out` hinzufuegen.
**Warning signs:** Konfi sieht "Angemeldet" obwohl opted_out.

### Pitfall 2: canUnregister-Logik kollidiert mit Opt-out
**What goes wrong:** Die bestehende `canUnregister`-Funktion im Frontend (Zeile 211-217) prueft 2-Tage-Frist. Fuer Pflicht-Events gilt aber: Opt-out jederzeit moeglich, nur nicht nach Event-Ende.
**Why it happens:** Unterschiedliche Abmelde-Regeln fuer normale vs. Pflicht-Events.
**How to avoid:** Separate `canOptOut`-Funktion fuer Pflicht-Events: `event_date > now` (Event noch nicht vorbei).
**Warning signs:** Konfi kann sich 1 Tag vor Pflicht-Event nicht abmelden.

### Pitfall 3: Backend-Guard fuer Pflicht-Event fehlt
**What goes wrong:** Ohne expliziten Guard koennten Konfis den normalen DELETE-Endpoint fuer Pflicht-Events missbrauchen (Booking loeschen statt opt-out).
**Why it happens:** Der bestehende DELETE-Endpoint prueft nicht ob das Event mandatory ist.
**How to avoid:** Im bestehenden DELETE-Endpoint pruefen: Wenn Event mandatory ist, mit 400-Fehler ablehnen ("Pflicht-Events koennen nur ueber Opt-out abgemeldet werden").
**Warning signs:** Pflicht-Event Booking verschwindet komplett statt opted_out Status.

### Pitfall 4: Registered_count Zaehlung bei opted_out
**What goes wrong:** Admin-Teilnehmer-Zaehler zeigt falsche Zahlen wenn opted_out Konfis mitgezaehlt werden.
**Why it happens:** Bestehende COUNT-Queries zaehlen nur `status = 'confirmed'`, was korrekt ist. Aber der neue X/Y Zaehler braucht Y = alle Jahrgangs-Konfis (nicht nur aktuelle Bookings).
**How to avoid:** Y-Wert aus konfi_profiles + jahrgaenge berechnen, nicht aus event_bookings.
**Warning signs:** "12/12 Teilnehmer" obwohl 3 opted_out sind.

### Pitfall 5: Opt-in Reset vergisst opt_out_reason zu behalten
**What goes wrong:** Bei Wiederanmeldung wird opt_out_reason geloescht.
**Why it happens:** Natuerlicher Impuls, bei Status-Wechsel zurueck zu confirmed alles zu resetten.
**How to avoid:** CONTEXT.md sagt explizit: "Begruendung bleibt gespeichert". Bei opt-in nur `status = 'confirmed'` setzen, opt_out_reason und opt_out_date NICHT loeschen.
**Warning signs:** Admin verliert Transparenz ueber vergangene Abmeldungen.

## Code Examples

### DB Migration: Neue Spalten
```sql
ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS opt_out_reason TEXT;
ALTER TABLE event_bookings ADD COLUMN IF NOT EXISTS opt_out_date TIMESTAMP;
```

### Backend: Opt-out Endpoint
```javascript
// POST /konfi/events/:id/opt-out
router.post('/events/:id/opt-out', verifyTokenRBAC, async (req, res) => {
  const konfiId = req.user.id;
  const eventId = req.params.id;
  const { reason } = req.body;

  // Validierung: Mindestens 5 Zeichen
  if (!reason || reason.trim().length < 5) {
    return res.status(400).json({ error: 'Begruendung muss mindestens 5 Zeichen haben' });
  }

  // Pruefen ob Event mandatory ist
  const { rows: [event] } = await db.query(
    'SELECT name, event_date, mandatory FROM events WHERE id = $1 AND organization_id = $2',
    [eventId, req.user.organization_id]
  );
  if (!event || !event.mandatory) {
    return res.status(400).json({ error: 'Opt-out nur bei Pflicht-Events moeglich' });
  }

  // Pruefen ob Event noch nicht vorbei
  if (new Date(event.event_date) < new Date()) {
    return res.status(400).json({ error: 'Event ist bereits vorbei' });
  }

  // Status-Wechsel
  const { rowCount } = await db.query(
    `UPDATE event_bookings
     SET status = 'opted_out', opt_out_reason = $3, opt_out_date = NOW()
     WHERE user_id = $1 AND event_id = $2 AND status = 'confirmed'`,
    [konfiId, eventId, reason.trim()]
  );
  if (rowCount === 0) {
    return res.status(400).json({ error: 'Keine aktive Anmeldung gefunden' });
  }

  res.json({ message: 'Abmeldung erfolgreich' });

  // Push + Live-Update (nach Response)
  // ...
});
```

### Backend: Opt-in Endpoint (Ruecknahme)
```javascript
// POST /konfi/events/:id/opt-in
router.post('/events/:id/opt-in', verifyTokenRBAC, async (req, res) => {
  const konfiId = req.user.id;
  const eventId = req.params.id;

  // Status zurueck auf confirmed, opt_out_reason BLEIBT erhalten
  const { rowCount } = await db.query(
    `UPDATE event_bookings
     SET status = 'confirmed'
     WHERE user_id = $1 AND event_id = $2 AND status = 'opted_out'`,
    [konfiId, eventId]
  );
  if (rowCount === 0) {
    return res.status(400).json({ error: 'Keine Opt-out-Anmeldung gefunden' });
  }

  res.json({ message: 'Wieder angemeldet' });
  // Push + Live-Update
});
```

### Frontend: UnregisterModal mit mandatory-Prop
```typescript
interface UnregisterModalProps {
  eventName: string;
  mandatory?: boolean;  // NEU
  onClose: () => void;
  onUnregister: (reason: string) => void;
  dismiss: (data?: string, role?: string) => void;
}

// Validierung anpassen:
const isValid = mandatory
  ? reason.trim().length >= 5
  : reason.trim().length > 0;
```

### Frontend: Konfi-EventDetailView Opt-out Buttons
```typescript
{eventData.mandatory ? (
  eventData.booking_status === 'opted_out' ? (
    <div>
      <div style={{ textAlign: 'center', padding: '12px', color: '#dc2626', fontWeight: '600' }}>
        <IonIcon icon={closeCircle} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
        Du hast dich abgemeldet
      </div>
      <IonButton expand="block" style={{ '--background': '#34c759' }} onClick={handleOptIn}>
        <IonIcon icon={checkmarkCircle} slot="start" />
        Wieder anmelden
      </IonButton>
    </div>
  ) : isPastEvent ? (
    <IonNote color="medium">Pflicht-Event (vergangen)</IonNote>
  ) : (
    <div>
      <IonNote color="medium" style={{ display: 'block', textAlign: 'center', padding: '8px' }}>
        <IonIcon icon={shieldCheckmark} /> Du bist automatisch angemeldet
      </IonNote>
      <IonButton expand="block" fill="outline" color="danger" onClick={openOptOutModal}>
        <IonIcon icon={closeCircle} slot="start" />
        Abmelden
      </IonButton>
    </div>
  )
) : /* bestehende Logik */}
```

### Frontend: Admin-Teilnehmerliste mit opted_out
```typescript
// Participant-Interface erweitern:
interface Participant {
  // ... bestehende Felder
  opt_out_reason?: string;
  opt_out_date?: string;
}

// In der Teilnehmerliste:
{participant.status === 'opted_out' && (
  <div>
    <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: '600' }}>Abgemeldet</span>
    {participant.opt_out_reason && (
      <div style={{ color: '#666', fontSize: '0.8rem', marginTop: '2px' }}>
        {participant.opt_out_reason}
      </div>
    )}
  </div>
)}
```

## Key Integration Points

### Backend-Dateien die geaendert werden muessen:
1. **`backend/routes/konfi.js`** — Neue Endpoints POST opt-out und POST opt-in, Guard im bestehenden DELETE-Endpoint
2. **`backend/services/pushService.js`** — Neue Methoden sendEventOptOutToAdmins und sendEventOptInToAdmins
3. **`backend/routes/events.js`** — Participants-Query erweitern um opt_out_reason, opt_out_date

### Frontend-Dateien die geaendert werden muessen:
1. **`frontend/src/components/konfi/modals/UnregisterModal.tsx`** — mandatory-Prop, Validierung, Hinweis-Text
2. **`frontend/src/components/konfi/views/EventDetailView.tsx`** — Opt-out/Opt-in Buttons, Status-Anzeige, booking_status Interface erweitern
3. **`frontend/src/components/admin/views/EventDetailView.tsx`** — Participant-Interface erweitern, opted_out Badge + Begruendung in Liste, Teilnehmer-Zaehler X/Y
4. **`frontend/src/components/konfi/views/EventsView.tsx`** — Rote Markierung/Badge bei opted_out Events in der Liste

### Datenbank-Migration:
- `ALTER TABLE event_bookings ADD COLUMN opt_out_reason TEXT;`
- `ALTER TABLE event_bookings ADD COLUMN opt_out_date TIMESTAMP;`
- Schema-Datei `init-scripts/01-create-schema.sql` aktualisieren

### Konfi-Events-Query Anpassung (konfi.js Zeile 1127):
- `is_registered` muss `eb_konfi.status IN ('confirmed')` pruefen (nicht nur Existenz)
- Neues Feld `is_opted_out` hinzufuegen: `CASE WHEN eb_konfi.status = 'opted_out' THEN true ELSE false END`
- `booking_status` wird bereits zurueckgegeben (Zeile 1150) — 'opted_out' wird automatisch enthalten sein

## Open Questions

1. **Teilnehmer-Zaehler Y-Wert**
   - What we know: X = confirmed count, Y = alle Jahrgangs-Konfis
   - What's unclear: Woher kommt die Gesamtzahl der Jahrgangs-Konfis? Aktuell gibt es keinen JOIN auf konfi_profiles in der Participants-Query.
   - Recommendation: Im Backend separat abfragen: `SELECT COUNT(*) FROM konfi_profiles kp JOIN event_jahrgang_assignments eja ON kp.jahrgang_id = eja.jahrgang_id WHERE eja.event_id = $1`. Oder vereinfacht: Y = confirmed + opted_out (da bei Pflicht-Events alle enrolled sind).

2. **EventsView rote Markierung**
   - What we know: Konfi soll in der Event-Liste opted_out Events mit roter Markierung sehen
   - What's unclear: Genaues Design der Markierung (Badge-Text, Icon, Farbe des Event-Items)
   - Recommendation: Kleiner roter Text "Abgemeldet" unter dem Event-Titel, analog zur "Warteliste"-Anzeige

## Sources

### Primary (HIGH confidence)
- `init-scripts/01-create-schema.sql` — event_bookings CHECK-Constraint bestaetigt 'opted_out' Status
- `backend/routes/konfi.js` — Bestehender Unregister-Flow (DELETE, Zeile 1735-1850)
- `backend/services/pushService.js` — sendEventUnregistrationToAdmins Pattern (Zeile 511-545)
- `frontend/src/components/konfi/modals/UnregisterModal.tsx` — Bestehendes Modal
- `frontend/src/components/konfi/views/EventDetailView.tsx` — Bestehende Action-Buttons
- `frontend/src/components/admin/views/EventDetailView.tsx` — Bestehende Teilnehmerliste
- `backend/routes/events.js` — Participants-Query (Zeile 261-278)

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Pitfall-Warnung zu DELETE bei Pflicht-Events

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Keine neuen Libraries, alles bestehende Projekt-Patterns
- Architecture: HIGH — Klare Vorgaben aus CONTEXT.md, bestehende Code-Patterns als Vorlage
- Pitfalls: HIGH — Direkte Code-Analyse der betroffenen Queries und Logik

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stabil, keine externen Abhaengigkeiten)
