# Phase 39: Events - Research

**Researched:** 2026-03-10
**Domain:** Teamer-Events (Backend-Erweiterung + Frontend-View)
**Confidence:** HIGH

## Summary

Phase 39 erweitert das bestehende Event-System um Teamer-Funktionalitaet. Die Architektur ist klar: Zwei neue Boolean-Spalten in der `events`-Tabelle (`teamer_needed`, `teamer_only`) steuern die Sichtbarkeit und Buchbarkeit. Das Frontend benoetigt eine vollstaendige `TeamerEventsPage` mit 3 Segmenten (Meine/Alle/Team), die das bestehende `EventsView`-Pattern der Konfi-Seite 1:1 als Vorlage nutzt. Die Buchungslogik fuer Teamer:innen ist bewusst vereinfacht (kein Timeslot, keine Warteliste, nur "Dabei"/"Nicht dabei").

Die groesste technische Herausforderung liegt in der Backend-Erweiterung: Der bestehende `POST /:id/book` Endpoint ist aktuell auf `req.user.type === 'konfi'` beschraenkt. Er muss entweder erweitert oder ein paralleler Teamer-Booking-Endpoint erstellt werden. Der QR-Check-in (`POST /qr-checkin`) ist bereits rollenagnostisch und funktioniert fuer alle authentifizierten User mit gueltigem Booking.

**Primary recommendation:** Bestehende DB-Tabellen/Endpoints erweitern statt neue zu erstellen. Zwei Spalten `teamer_needed BOOLEAN DEFAULT false` und `teamer_only BOOLEAN DEFAULT false` in `events`. Booking-Endpoint um Teamer-Logik erweitern (vereinfacht, ohne Timeslot/Warteliste).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 3 Segmente im Teamer Events-Tab: Meine / Alle / Team
- Meine: Alle Events wo Teamer:in dabei ist (selbst gebucht oder vom Admin zugewiesen)
- Alle: Alle Jahrgangs-Events -- auch reine Konfi-Events sichtbar (aber nicht buchbar fuer Teamer:innen)
- Team: Alle fuer Teamer:innen buchbare Events gemischt (sowohl "Teamer gesucht"-Konfi-Events als auch reine Teamer-Events)
- Sortierung: Chronologisch (naechstes Event zuerst)
- Vergangene Events bleiben sichtbar mit Anwesenheitsstatus
- Kompakter Header mit Stats-Row
- Buchungs-Flow: Vereinfacht -- Dabei oder nicht, kein Timeslot, keine Warteliste
- Jederzeit austragbar (keine Frist)
- Admin kann Teamer:innen direkt zu Events hinzufuegen
- Push-Benachrichtigung an Admin bei Ein-/Austragung von Teamer:innen
- QR-Code Check-in wie bei Konfis -- gleicher QR-Code pro Event
- QRScannerModal wird 1:1 wiederverwendet
- 3 Event-Zustaende: Normal (nur Konfis), Teamer:innen gesucht (beide), Nur fuer Teamer:innen
- Zustaende schliessen sich gegenseitig aus
- Admin sieht in Event-Teilnehmerliste getrennte Sektionen: "Konfis (X)" und "Teamer:innen (X)"
- Layout und Struktur 1:1 wie bei Konfis und Admin -- gleiche CSS-Klassen
- Corner Badge oben rechts mit "TEAM" bei Events die fuer Teamer:innen offen sind
- Vereinfachter Buchungsbereich: "Dabei" / "Nicht dabei"-Button statt Timeslot-Auswahl

### Claude's Discretion
- Genaue Implementierung der DB-Spalten fuer Event-Zustaende (teamer_needed, teamer_only o.ae.)
- Stats-Row Werte pro Segment (welche Zaehler angezeigt werden)
- Fehlermeldungen und Edge-Case-Handling
- Push-Nachricht Format/Text

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EVT-01 | Admin kann bei Konfi-Events einen "Teamer gesucht"-Toggle setzen | DB-Spalte `teamer_needed` + Admin-Formular Toggle |
| EVT-02 | Teamer sieht Events mit "Teamer gesucht" und kann sich einbuchen | GET /events Filterung + Teamer-Booking-Endpoint |
| EVT-03 | Admin kann reine Teamer-Events erstellen (nur fuer Teamer sichtbar/buchbar) | DB-Spalte `teamer_only` + Admin-Formular Toggle |
| EVT-04 | Teamer kann Anwesenheit bei Events bestaetigen wo er eingeteilt ist | QR-Check-in bereits rollenagnostisch, muss nur Booking erkennen |
| EVT-05 | Teamer sieht alle fuer ihn relevanten Events (Teamer-gesucht + Teamer-Events) | GET /events Response erweitert um teamer_needed/teamer_only Felder |
| EVT-06 | Events-Tab mit 3 Segmenten: Meine (gebucht), Alle (Jahrgangs-Uebersicht), Team (buchbar) | TeamerEventsPage Frontend-Implementierung |
</phase_requirements>

## Standard Stack

### Core (bereits im Projekt)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express | 4.x | Backend REST API | Bereits im Projekt |
| PostgreSQL | 15+ | Datenbank | Bereits im Projekt |
| React | 19 | Frontend Framework | Bereits im Projekt |
| Ionic React | 8.x | UI Components (IonSegment, IonItem etc.) | Bereits im Projekt |
| ionicons | 7.x | Icons | Bereits im Projekt |

### Supporting (bereits im Projekt)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| jsonwebtoken | - | QR-Token Verifikation | Check-in |
| PushService | intern | Push-Benachrichtigungen | Buchungs-Notifications |
| liveUpdate | intern | WebSocket Live-Updates | Echtzeit-UI-Refresh |

### Keine neuen Abhaengigkeiten noetig
Diese Phase nutzt ausschliesslich bestehende Libraries und Patterns.

## Architecture Patterns

### Empfohlene Aenderungsstruktur
```
backend/
  routes/events.js           # Erweitern: Booking, GET-Filter, Create/Update
  services/pushService.js    # Erweitern: Teamer-Booking-Notifications

frontend/src/
  components/teamer/
    pages/TeamerEventsPage.tsx   # Komplett neu (ersetzt EmptyState-Platzhalter)
    views/TeamerEventsView.tsx   # Neu: 3-Segment-View (Vorlage: konfi/EventsView.tsx)
    views/TeamerEventDetailView.tsx  # Neu: Detail-Ansicht (Vorlage: konfi/EventDetailView.tsx)

  components/admin/
    pages/AdminEventsPage.tsx    # Erweitern: Toggle-Felder im Create/Edit-Formular
    views/EventDetailView.tsx    # Erweitern: Getrennte Sektionen Konfis/Teamer:innen

init-scripts/
  01-create-schema.sql          # Migration-Kommentare fuer neue Spalten
```

### Pattern 1: DB-Schema-Erweiterung
**What:** Zwei neue Boolean-Spalten statt ENUM fuer Event-Zustaende
**When to use:** Immer wenn sich Zustaende gegenseitig ausschliessen aber erweiterbar sein sollen
**Example:**
```sql
-- Migration (auf Live-DB ausfuehren):
ALTER TABLE events ADD COLUMN IF NOT EXISTS teamer_needed BOOLEAN DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS teamer_only BOOLEAN DEFAULT false;

-- Constraint: teamer_needed und teamer_only schliessen sich aus
ALTER TABLE events ADD CONSTRAINT events_teamer_exclusive
  CHECK (NOT (teamer_needed = true AND teamer_only = true));

-- Index fuer schnelle Filterung
CREATE INDEX idx_events_teamer ON events (teamer_needed, teamer_only)
  WHERE teamer_needed = true OR teamer_only = true;
```

**Drei Zustaende:**
1. `teamer_needed=false, teamer_only=false` -> Normal (nur Konfis)
2. `teamer_needed=true, teamer_only=false` -> Teamer:innen gesucht (Konfis UND Teamer:innen)
3. `teamer_needed=false, teamer_only=true` -> Nur Teamer:innen

### Pattern 2: Teamer-Booking (vereinfacht)
**What:** Eigener Code-Pfad im bestehenden Booking-Endpoint
**When to use:** Teamer:in bucht ein Event
**Example:**
```javascript
// In POST /:id/book - bestehenden Konfi-Check erweitern:
router.post('/:id/book', rbacVerifier, async (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.id;
  const isTeamer = req.user.type === 'teamer';
  const isKonfi = req.user.type === 'konfi';

  if (!isKonfi && !isTeamer) {
    return res.status(403).json({ error: 'Keine Berechtigung' });
  }

  // Event laden
  const { rows: [event] } = await client.query(
    "SELECT * FROM events WHERE id = $1 AND organization_id = $2 FOR UPDATE",
    [eventId, req.user.organization_id]
  );

  // Teamer-Berechtigungspruefung
  if (isTeamer) {
    if (!event.teamer_needed && !event.teamer_only) {
      return res.status(403).json({ error: 'Dieses Event ist nicht fuer Teamer:innen buchbar' });
    }
    // Vereinfachte Buchung: Direkt confirmed, kein Timeslot, keine Warteliste
    // ...insert mit status='confirmed'...
  }

  // Konfi-Berechtigungspruefung
  if (isKonfi && event.teamer_only) {
    return res.status(403).json({ error: 'Dieses Event ist nur fuer Teamer:innen' });
  }

  // ...bestehende Konfi-Logik...
});
```

### Pattern 3: GET /events Response-Erweiterung
**What:** Bestehender GET / Endpoint gibt teamer_needed/teamer_only Felder mit zurueck
**When to use:** Frontend filtert Events clientseitig in Segmente
**Example:**
```javascript
// Bereits in SELECT: e.* liefert automatisch die neuen Spalten
// Teamer-Filter erweitern:
if (req.user.role_name === 'teamer') {
  // Teamer sieht: Events aus seinen Jahrgaengen + reine Teamer-Events
  filteredRows = rows.filter(row => {
    // Reine Teamer-Events sind immer sichtbar
    if (row.teamer_only) return true;
    // Jahrgangs-Filter wie bisher
    if (!row.jahrgang_ids) return true;
    const eventJahrgangIds = row.jahrgang_ids.split(',').map(id => parseInt(id, 10));
    return eventJahrgangIds.some(id => viewableJahrgaenge.includes(id));
  });
}
```

### Pattern 4: Frontend Segment-Filterung (clientseitig)
**What:** Events werden einmal geladen, dann clientseitig in 3 Segmente gefiltert
**When to use:** TeamerEventsView
**Example:**
```typescript
// Segment-Filterung
const getFilteredEvents = () => {
  switch (activeTab) {
    case 'meine':
      return events.filter(e => e.is_registered);
    case 'alle':
      // Alle Events aus Jahrgaengen (Konfi + Teamer)
      return events.filter(e => !e.teamer_only);
    case 'team':
      // Fuer Teamer:innen buchbar: teamer_needed ODER teamer_only
      return events.filter(e => e.teamer_needed || e.teamer_only);
    default:
      return events;
  }
};
```

### Pattern 5: Admin-Teilnehmerliste getrennt
**What:** In der Event-Detail-Ansicht des Admins werden Konfis und Teamer:innen getrennt angezeigt
**When to use:** EventDetailView (Admin)
**Example:**
```typescript
// Teilnehmer nach Rolle aufteilen
const konfiParticipants = participants.filter(p => p.role_name === 'konfi' || !p.role_name);
const teamerParticipants = participants.filter(p => p.role_name === 'teamer');
// Getrennte Sektionen rendern
```

### Anti-Patterns to Avoid
- **Separater Teamer-Events-Endpoint:** NICHT einen neuen GET /teamer-events bauen. Bestehenden GET / nutzen und clientseitig filtern.
- **Neue Tabelle fuer Teamer-Bookings:** NICHT `teamer_event_bookings` erstellen. Bestehende `event_bookings` nutzen -- sie referenziert bereits `users` generisch.
- **ENUM statt Booleans:** NICHT `event_audience ENUM('konfi', 'teamer', 'both')` verwenden. Zwei Booleans mit CHECK-Constraint sind flexibler und expliziter.
- **Teamer-Booking mit Warteliste/Timeslots:** NICHT die Konfi-Buchungslogik kopieren. Teamer-Buchung ist bewusst einfach.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event-Listen-Darstellung | Eigene Card-Komponenten | Bestehendes `app-list-item` CSS-Pattern | Konsistenz, Corner Badge Pattern existiert |
| QR-Check-in | Neues Scanner-Modal | `QRScannerModal` 1:1 wiederverwenden | Bereits getestet, funktioniert rollenagnostisch |
| Event-Detail-Ansicht | Komplett neue Komponente | Konfi `EventDetailView` als Vorlage klonen | 90% identische Logik |
| Push-Benachrichtigungen | Eigenes Notification-System | `PushService.sendToMultipleUsers()` | Bewaehrtes Pattern |
| Segment-Navigation | Custom Tab-Komponente | `IonSegment` + `IonSegmentButton` | Ionic Standard |
| Live-Updates | Polling | `liveUpdate.sendToUser()` / `useLiveRefresh()` | WebSocket bereits implementiert |

## Common Pitfalls

### Pitfall 1: Booking-Endpoint Konfi-Check
**What goes wrong:** `POST /:id/book` hat `if (req.user.type !== 'konfi') return 403` -- Teamer:innen werden blockiert
**Why it happens:** Endpoint war bisher nur fuer Konfis gedacht
**How to avoid:** Check auf `isKonfi || isTeamer` erweitern, dann je nach Typ unterschiedliche Logik
**Warning signs:** 403-Fehler beim Teamer-Booking

### Pitfall 2: DELETE /:id/book ebenfalls Konfi-only
**What goes wrong:** `DELETE /:id/book` hat `if (req.user.type !== 'konfi') return 403`
**Why it happens:** Gleicher historischer Grund
**How to avoid:** Auch hier erweitern, da Teamer:innen sich jederzeit austragen koennen

### Pitfall 3: Admin-Participant-Add ignoriert Teamer-Rolle
**What goes wrong:** `POST /:id/participants` (Admin fuegt User hinzu) prueft nicht ob User Teamer ist und ob Event fuer Teamer offen ist
**Why it happens:** Route wurde fuer Konfis gebaut
**How to avoid:** Entweder keine Pruefung (Admin darf alles) oder weiche Warnung

### Pitfall 4: GET /:id Participants ohne Rollen-Info
**What goes wrong:** Admin-Detail liefert Teilnehmer ohne `role_name`, Frontend kann nicht Konfis/Teamer:innen trennen
**Why it happens:** Participants-Query joined nur `users` und `konfi_profiles`
**How to avoid:** JOIN auf `roles` Tabelle hinzufuegen: `LEFT JOIN roles r ON u.role_id = r.id` und `r.name as role_name` selektieren

### Pitfall 5: QR-Check-in erfordert confirmed Booking
**What goes wrong:** QR-Check-in funktioniert nur mit `status = 'confirmed'` Bookings -- passt fuer Teamer
**Why it happens:** Check-in-Logik prueft `booking.status !== 'confirmed'`
**How to avoid:** Kein Problem, da Teamer-Bookings direkt `confirmed` Status bekommen (kein Timeslot, keine Warteliste). Sicherstellen dass Teamer-Bookings immer mit `status='confirmed'` erstellt werden.

### Pitfall 6: Punkte-Vergabe beim QR-Check-in fuer Teamer
**What goes wrong:** QR-Check-in vergibt Punkte via `konfi_profiles` -- Teamer haben kein aktives konfi_profile
**Why it happens:** Punkte-Logik nutzt `konfi_profiles` Tabelle
**How to avoid:** Punkte-Vergabe beim Check-in nur fuer Konfis, nicht fuer Teamer:innen. Teamer sammeln keine Punkte (Out of Scope). Pruefung: `if (event.points > 0 && !event.mandatory && req.user.type === 'konfi')` statt nur `if (event.points > 0 && !event.mandatory)`.

### Pitfall 7: Event-Anzeige "Teamer-only" fuer Konfis
**What goes wrong:** Konfis sehen teamer_only Events in ihrer Event-Liste
**Why it happens:** GET / Filter filtert nur nach Jahrgang, nicht nach teamer_only
**How to avoid:** Im GET / Endpoint: Konfis sehen keine `teamer_only` Events. Filter hinzufuegen.

### Pitfall 8: Unique Constraint bei Event-Bookings
**What goes wrong:** `event_bookings_user_event_unique` Constraint verhindert Duplikate -- gut so
**Why it happens:** Design-Intent
**How to avoid:** Kein Problem, aber Error-Handling beachten (409 Conflict sauber zurueckgeben)

## Code Examples

### Teamer-Booking-Erweiterung (Backend)
```javascript
// In POST /:id/book erweitern
if (isTeamer) {
  // Teamer darf nur buchen wenn teamer_needed oder teamer_only
  if (!event.teamer_needed && !event.teamer_only) {
    return res.status(403).json({ error: 'Dieses Event ist nicht fuer Teamer:innen buchbar' });
  }

  // Duplikat-Check
  const { rows: [existing] } = await client.query(
    "SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2",
    [eventId, userId]
  );
  if (existing) {
    return res.status(409).json({ error: 'Du bist bereits fuer dieses Event eingetragen' });
  }

  // Direkt confirmed (kein Timeslot, keine Warteliste)
  const { rows: [newBooking] } = await client.query(
    "INSERT INTO event_bookings (event_id, user_id, status, booking_date, organization_id) VALUES ($1, $2, 'confirmed', NOW(), $3) RETURNING id",
    [eventId, userId, req.user.organization_id]
  );

  res.status(201).json({ id: newBooking.id, message: 'Du bist dabei!', status: 'confirmed' });

  // Push an Admin
  try {
    const { rows: [teamerUser] } = await db.query("SELECT display_name FROM users WHERE id = $1", [userId]);
    await PushService.sendToOrgAdmins(db, req.user.organization_id, {
      title: 'Teamer:in angemeldet',
      body: `${teamerUser.display_name} hat sich fuer "${event.name}" angemeldet`,
      data: { type: 'teamer_event_booking', eventId: String(eventId) }
    });
  } catch (e) { console.error('Push failed:', e); }

  return; // Frueh zurueckkehren, Konfi-Logik nicht ausfuehren
}
```

### TeamerEventsView Segment-Structure (Frontend)
```typescript
// Vorlage: src/components/konfi/views/EventsView.tsx
// Segmente: Meine | Alle | Team (statt Anstehend | Meine | Konfi)

<div className="app-segment-wrapper">
  <IonSegment value={activeTab} onIonChange={(e) => onTabChange(e.detail.value as any)}>
    <IonSegmentButton value="meine"><IonLabel>Meine</IonLabel></IonSegmentButton>
    <IonSegmentButton value="alle"><IonLabel>Alle</IonLabel></IonSegmentButton>
    <IonSegmentButton value="team"><IonLabel>Team</IonLabel></IonSegmentButton>
  </IonSegment>
</div>
```

### Corner Badge "TEAM" (Frontend)
```typescript
// Zweites Corner Badge fuer Team-Events (bestehendes CSS-Pattern)
{(event.teamer_needed || event.teamer_only) && (
  <div
    className="app-corner-badge app-corner-badge--purple"
    style={{ top: 'auto', bottom: 0, borderRadius: '10px 0 10px 0' }}
  >
    TEAM
  </div>
)}
```

### Admin-Formular Toggle (Frontend)
```typescript
// Im Event-Erstellungs-/Bearbeitungsformular
// Drei Zustaende ueber IonSelect oder zwei gekoppelte Toggles
<IonSelect
  label="Teamer-Zugang"
  value={teamerOnly ? 'teamer_only' : teamerNeeded ? 'teamer_needed' : 'normal'}
  onIonChange={(e) => {
    const v = e.detail.value;
    setTeamerNeeded(v === 'teamer_needed');
    setTeamerOnly(v === 'teamer_only');
  }}
>
  <IonSelectOption value="normal">Nur Konfis</IonSelectOption>
  <IonSelectOption value="teamer_needed">Teamer:innen gesucht</IonSelectOption>
  <IonSelectOption value="teamer_only">Nur Teamer:innen</IonSelectOption>
</IonSelect>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate Konfi-only booking | Rollenbasiertes Booking (Konfi + Teamer) | Phase 39 | Booking-Endpoint wird generischer |
| Events haben keine Teamer-Zuordnung | Events haben teamer_needed/teamer_only Flags | Phase 39 | Neues DB-Schema |
| Nur Konfis sehen Events-Tab | Teamer hat eigenen Events-Tab mit 3 Segmenten | Phase 39 | Neue Frontend-View |

## Open Questions

1. **Teamer-Count in Event-Karten**
   - What we know: Event-Karten zeigen aktuell `registered_count/max_participants`
   - What's unclear: Sollen Teamer-Buchungen separat gezaehlt werden oder in die Gesamtzahl einfliessen?
   - Recommendation: Separate Zaehlung. Im GET / Query: `COUNT(CASE WHEN u.role_name = 'konfi' THEN 1 END) as konfi_count, COUNT(CASE WHEN u.role_name = 'teamer' THEN 1 END) as teamer_count`. Teamer-Bookings zaehlen NICHT gegen max_participants (Kapazitaet gilt nur fuer Konfis).

2. **Teamer-Booking und Registration-Zeitfenster**
   - What we know: Konfi-Bookings pruefen `registration_opens_at` und `registration_closes_at`
   - What's unclear: Gelten diese Zeitfenster auch fuer Teamer:innen?
   - Recommendation: Nein. Teamer:innen koennen sich jederzeit ein-/austragen (Entscheidung aus CONTEXT.md: "Jederzeit austragbar, keine Frist"). Registration-Zeitfenster-Pruefung nur fuer Konfis.

3. **`is_registered` und `booking_status` fuer Teamer im GET /**
   - What we know: Die KonfiEventsPage bekommt `is_registered` und `booking_status` pro Event -- das wird ueber einen separaten User-spezifischen Query oder Subquery gemacht
   - What's unclear: Ob das fuer Teamer:innen bereits funktioniert oder nur fuer Konfis
   - Recommendation: Die bestehende Logik in `GET /user/bookings` (Zeile 1429) prueft `req.user.type !== 'konfi'`. Das muss erweitert werden. Alternativ: Booking-Info direkt im GET / per Subquery anfuegen (fuer alle authentifizierten User).

## Sources

### Primary (HIGH confidence)
- `init-scripts/01-create-schema.sql` - Komplettes DB-Schema (events, event_bookings Tabellen)
- `backend/routes/events.js` - Alle 19 Endpoints analysiert
- `frontend/src/components/konfi/views/EventsView.tsx` - Referenz-View fuer Teamer-Events
- `frontend/src/components/teamer/pages/TeamerEventsPage.tsx` - Aktueller EmptyState-Platzhalter
- `frontend/src/theme/variables.css` - Corner Badge CSS-Pattern
- `frontend/src/components/layout/MainTabs.tsx` - Teamer-Tab-Routing

### Secondary (HIGH confidence)
- `.planning/phases/39-events/39-CONTEXT.md` - User-Entscheidungen und Spezifikation
- `.planning/REQUIREMENTS.md` - EVT-01 bis EVT-06 Requirements
- `backend/services/pushService.js` - Push-Notification-Patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Keine neuen Abhaengigkeiten, alles bestehendes Toolkit
- Architecture: HIGH - Bestehende Patterns klar identifiziert, Erweiterungspunkte bekannt
- Pitfalls: HIGH - Alle relevanten Endpoints analysiert, Konfi-only Guards identifiziert

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stabile Codebasis, keine externen Abhaengigkeiten)
