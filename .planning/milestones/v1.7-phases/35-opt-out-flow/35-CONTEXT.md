# Phase 35: Opt-out-Flow - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Konfis koennen sich mit Begruendung von Pflicht-Events abmelden (Opt-out) und Admins haben volle Transparenz ueber alle Abmeldungen. Konfis koennen Opt-out selbst rueckgaengig machen. Admins werden per Push benachrichtigt.

</domain>

<decisions>
## Implementation Decisions

### Opt-out-Mechanik
- Booking-Status von 'confirmed' auf 'opted_out' aendern (NICHT DELETE)
- opt_out_reason (Text) und opt_out_date (Timestamp) als neue Spalten auf event_bookings
- Keine separate Log-Tabelle noetig — alles in event_bookings
- 'opted_out' Status existiert bereits im CHECK-Constraint
- Keine Frist: Opt-out jederzeit moeglich (auch am selben Tag), nur nicht nach Event-Ende
- Konfi kann Opt-out selbst rueckgaengig machen (opted_out -> confirmed), Begruendung bleibt gespeichert

### Begruendung
- Begruendung ist Pflichtfeld bei Opt-out
- Mindestens 5 Zeichen
- Button erst aktiv wenn Text eingegeben

### Konfi-UI
- Bestehendes UnregisterModal wiederverwenden, mit leicht angepasstem Text bei Pflicht-Events (mandatory-Prop)
- Bei Pflicht-Events: Hinweis dass Begruendung Pflicht ist
- Opt-out-Status in Konfi-EventDetailView: ROTER Status-Text 'Du hast dich abgemeldet' + gruener Button 'Wieder anmelden'
- In der Konfi-Event-Liste: Opt-out sichtbar mit roter Markierung/Badge
- ROT ist die Warnfarbe fuer alle Abmeldungen/Abwesenheiten — durchgaengig bei Konfi UND Admin

### Admin-Transparenz
- Opted-out Konfis bleiben inline in der Teilnehmerliste (keine separate Sektion)
- Roter 'Abgemeldet'-Badge am Eintrag
- Begruendung direkt sichtbar als kleinerer Text unter dem Namen (kein extra Tap noetig)
- Teilnehmer-Zaehler: X/Y Format (z.B. '12/15 Teilnehmer') — X = noch angemeldet, Y = alle Jahrgangs-Konfis

### Push-Benachrichtigungen
- Opt-out: Push nur an Admins der Organisation (nicht an Konfi)
- Push-Text enthaelt Begruendung direkt: "Lisa K. hat sich von 'Konfirmandentag' abgemeldet. Grund: Familienfeier"
- Ruecknahme: Push an Admins wenn Konfi sich wieder anmeldet ("Lisa K. hat sich wieder fuer 'Konfirmandentag' angemeldet")

### Claude's Discretion
- Genauer Wortlaut der Modal-Texte bei Pflicht-Events
- Sortierung der Teilnehmerliste (opted_out am Ende oder gemischt)
- Styling-Details fuer roten Badge und Begruendungstext

</decisions>

<specifics>
## Specific Ideas

- ROT als Warnfarbe fuer alle Abmeldungen — konsistent bei Konfi und Admin, wie bei 'absent'
- UnregisterModal wiederverwenden statt neues Modal — gleiche Basis, mandatory-Prop steuert Text und Validierung
- Bestehendes Push-Pattern (sendEventUnregistrationToAdmins) als Vorlage nutzen

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- UnregisterModal (frontend/src/components/konfi/modals/UnregisterModal.tsx): Hat bereits Textarea + Abmelden/Abbrechen — erweitern mit mandatory-Prop
- sendEventUnregistrationToAdmins (backend/services/pushService.js): Bestehendes Push-Pattern fuer Admin-Benachrichtigung bei Abmeldung
- event_bookings.status CHECK-Constraint: 'opted_out' bereits definiert

### Established Patterns
- Attendance-Status Toggle (PUT /events/:id/participants/:participantId/attendance): Pattern fuer Status-Wechsel auf event_bookings
- Event-Farbcodes: Rot fuer absent/Abmeldung, Gruen fuer present/angemeldet — durchgaengig im System
- Teilnehmerliste-Query (events.js GET /:id): JOINt event_bookings, users, konfi_profiles, jahrgaenge

### Integration Points
- Backend: Neuer Endpoint POST /konfi/events/:id/opt-out (Status-Wechsel + Push)
- Backend: Neuer Endpoint POST /konfi/events/:id/opt-in (Ruecknahme + Push)
- Frontend Konfi EventDetailView: Action-Buttons um Opt-out/Opt-in erweitern
- Frontend Admin EventDetailView: Teilnehmerliste um opted_out-Darstellung erweitern
- DB: opt_out_reason und opt_out_date Spalten auf event_bookings

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 35-opt-out-flow*
*Context gathered: 2026-03-09*
