# Phase 46: Event-Admin + Teamer-Logik - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin kann Events vollstaendig verwalten: absagen mit Bestaetigung, Teamer-only Events mit ausgeblendeten irrelevanten Feldern, farbige Hervorhebung von Mitbringen/Pflicht, getrennte Hinzufuegen-Modals fuer Teamer vs Konfis, und Event-Chat-Erstellung mit allen Teilnehmer:innen.

</domain>

<decisions>
## Implementation Decisions

### Event absagen (EVT-v19-05)
- Roter Button am Ende der Event-Details (Action-Sheet Stil), NICHT im Header-Menu
- Bestaetigungs-Alert vor dem Absagen ("Wirklich absagen? Alle Teilnehmer:innen werden benachrichtigt")
- Backend-Route `/events/:id/cancel` existiert bereits (events.js:1986-2050) — nur Frontend-Button fehlt
- Nach Absage: Event zeigt "Abgesagt" Status, Button wird deaktiviert/ausgeblendet

### Teamer-only Felder ausblenden (EVT-v19-06)
- Bei `teamerAccess === 'teamer_only'` im EventModal folgende Felder verstecken:
  - Punkt-Typ (point_type)
  - Teilnehmer-Limit (max_participants)
  - Warteliste (waitlist_enabled, max_waitlist_size)
  - Jahrgangszuordnung (jahrgang_ids)
- Felder per conditional render ausblenden (nicht nur disabled)

### Mitbringen + Pflicht Hervorhebung (EVT-v19-07)
- Aktuelle Farben beibehalten und konsistent machen:
  - Pflicht: rot (#dc2626) mit shieldCheckmark Icon — in Liste UND Details
  - Mitbringen: lila (#8b5cf6) mit bagHandle Icon — in Liste UND Details
- Sicherstellen dass beide Markierungen sowohl in Admin-Event-Liste als auch in Event-Details sichtbar sind

### Teamer-Hinweis Redundanz (EVT-v19-10)
- "Teamer gesucht"-Hinweis in Event-Details entfaellt wenn bereits eine Teamer:innen-Sektion mit Count angezeigt wird
- Hinweis nur zeigen wenn: teamer_needed === true UND keine Teamer-Sektion sichtbar ist (teamerParticipants.length === 0)

### Getrennte Hinzufuegen-Modals (EVT-v19-11)
- Teilnehmer-Listen sind bereits getrennt (Konfis / Teamer:innen Sektionen existieren)
- "Teamer:in hinzufuegen" Button oeffnet ParticipantManagementModal mit Filter: nur Teamer anzeigen
- "Kind hinzufuegen" Button (statt "Teilnehmer:in hinzufuegen") oeffnet Modal mit Filter: nur Konfis des Event-Jahrgangs anzeigen
- Modal bekommt neuen Prop `filterRole: 'teamer' | 'konfi' | null` fuer die Filterung

### Event-Chat Erstellung (EVT-v19-12)
- Button in Admin-Event-Details: "Chat erstellen" (nur sichtbar wenn kein Event-Chat existiert)
- Erstellt einen Gruppen-Chat mit Event-Name als Chat-Name
- Alle aktuell angemeldeten Konfis + Teamer werden als Teilnehmer:innen hinzugefuegt
- Admin (Ersteller) wird auch hinzugefuegt
- Einmalige Erstellung — spaetere Buchungen/Abmeldungen aktualisieren den Chat NICHT automatisch
- Wenn Chat bereits existiert: Button wird zu "Zum Chat" (navigiert zum bestehenden Chat)
- Backend: `chat_rooms.event_id` Spalte existiert bereits, `POST /rooms` muss event_id unterstuetzen

### Claude's Discretion
- Genauer Wortlaut der Bestaetigungs-Alerts
- Styling-Details fuer den Cancel-Button
- Exact API-Payload fuer Event-Chat-Erstellung
- Ob "Chat erstellen" auch Waitlist-Teilnehmer:innen einschliesst (wahrscheinlich nicht)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Event-Admin Backend
- `backend/routes/events.js` — Cancel-Route (Zeile 1986-2050), Teamer-only Validierung (Zeile 654-655), Event-Erstellung (Zeile 600-750)
- `backend/routes/chat.js` — Chat-Room-Erstellung, event_id Spalte in chat_rooms

### Event-Admin Frontend
- `frontend/src/components/admin/views/EventDetailView.tsx` — Teilnehmer-Listen (Zeile 1085-1197), Teamer-Hinweis (Zeile 710-717), Mitbringen-Anzeige (Zeile 720-727)
- `frontend/src/components/admin/modals/EventModal.tsx` — Teamer-Zugang Select (Zeile 542-553), zu versteckende Felder bei teamer_only
- `frontend/src/components/admin/EventsView.tsx` — Pflicht-Faerbung (Zeile 275-277), Mitbringen-Icon (Zeile 438-443)
- `frontend/src/components/admin/modals/ParticipantManagementModal.tsx` — Modal fuer Teilnehmer hinzufuegen (braucht filterRole Prop)

No external specs — requirements fully captured in decisions above and REQUIREMENTS.md (EVT-v19-05 bis EVT-v19-12).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Cancel-Route existiert vollstaendig im Backend (events.js:1986-2050) — sendet Push, setzt cancelled=true
- `chat_rooms.event_id` Spalte existiert bereits — Chat-Room-Erstellung kann event_id nutzen
- Teilnehmer-Listen sind bereits in Konfis/Teamer getrennt (EventDetailView.tsx:1124-1176)
- ParticipantManagementModal existiert — braucht nur filterRole Prop

### Established Patterns
- useIonModal Hook fuer alle Modals (keine isOpen-Pattern)
- Alert-Bestaetigung ueber `useIonAlert` Hook
- Event-Status-Farben: rot (#dc2626), lila (#8b5cf6), orange, gruen — in EventsView.tsx definiert
- Chat-Erstellung ueber `POST /api/chat/rooms` mit participants Array

### Integration Points
- EventDetailView.tsx: Cancel-Button und Chat-Button hinzufuegen
- EventModal.tsx: Conditional render bei teamer_only
- ParticipantManagementModal: filterRole Prop + Backend-Query anpassen
- Chat-Route: event_id Parameter in Room-Erstellung unterstuetzen

</code_context>

<specifics>
## Specific Ideas

- "Kind hinzufuegen" statt "Teilnehmer:in hinzufuegen" im Konfis-Bereich — klarere Sprache
- Event-Chat Button nur sichtbar wenn kein Chat existiert, danach "Zum Chat" mit Navigation
- Cancel-Button als roter outline-Button am Ende der Details, wie ein Loeschen-Button

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 46-event-admin-teamer-logik*
*Context gathered: 2026-03-18*
