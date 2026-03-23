# Phase 53: Chat verlassen - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Konfis und Teamer:innen koennen Gruppenchats (inkl. Event-Chats) verlassen. Jahrgangschats und Direct-Chats sind nicht verlassbar. Backend Self-Leave Endpoint + Frontend UI im Chat-Header.

</domain>

<decisions>
## Implementation Decisions

### Verlassen-Regeln
- Verlassbar: `group` Typ Chats (inkl. Event-Chats die als group erstellt werden)
- NICHT verlassbar: `jahrgang` Typ (Systemchat, automatisch erstellt)
- NICHT verlassbar: `direct` Typ (1-zu-1 Nachrichten)
- Admin-Team-Chats (`admin` Typ): Nur Teamer koennen verlassen, Admins nicht
- Konfis und Teamer:innen koennen self-leave, Admins koennen weiterhin andere entfernen (existiert bereits)

### Verlassen-UI
- Drei-Punkte-Menu (IonButtons) im Chat-Header mit "Verlassen" Option
- Nur sichtbar bei verlassbaren Chat-Typen (group, und admin nur fuer Teamer)
- Bestaetigungs-Alert: "Chat wirklich verlassen? Du erhaelst keine Nachrichten mehr aus diesem Chat."
- Nach Bestaetigung: API-Call, dann Navigation zurueck zur Chat-Uebersicht

### Nach dem Verlassen
- Chat verschwindet aus der eigenen Chat-Liste
- Nachrichten bleiben fuer andere Teilnehmer:innen erhalten (kein Loeschen)
- Man kann von Admins wieder hinzugefuegt werden (Wiederaufnahme moeglich)
- Kein "Nutzer hat verlassen" Systemnachricht (einfach still verschwinden)

### Claude's Discretion
- Genauer Wortlaut des Bestaetigungs-Alerts
- Ob ein IonActionSheet oder IonAlert fuer die Bestaetigung verwendet wird
- Position des Menu-Buttons im Header (neben Members oder separat)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Chat Backend
- `backend/routes/chat.js` — Participant-Management (Zeile 900-930 Admin-Remove), Room-Typen, Chat-Erstellung
- `backend/routes/chat.js` — chat_participants Tabelle (room_id, user_id, user_type)

### Chat Frontend
- `frontend/src/components/chat/ChatRoom.tsx` — Chat-Anzeige, Header-Buttons, Members-Modal
- `frontend/src/components/chat/ChatOverview.tsx` — Chat-Liste, Raum-Filter
- `frontend/src/components/chat/MembersModal.tsx` — Mitglieder-Verwaltung, Admin-Remove

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Admin-Remove Endpoint (DELETE /chat/rooms/:roomId/participants/:userId/:userType) — Pattern fuer Self-Leave
- MembersModal: Hat bereits Participant-Rendering und Remove-Logik fuer Admins
- ChatRoom Header: Hat bereits IonButtons slot="end" fuer Members-Icon

### Established Patterns
- useIonAlert fuer Bestaetigungen
- api.delete fuer Loeschen/Entfernen
- history.goBack() oder router.push fuer Navigation nach Aktion
- WebSocket liveUpdate fuer Echtzeit-Updates

### Integration Points
- Backend: Neuer Self-Leave Endpoint (DELETE /chat/rooms/:roomId/leave)
- ChatRoom.tsx: Drei-Punkte-Menu mit "Verlassen" Option (nur bei group/admin Typ)
- ChatOverview: Chat verschwindet nach Leave (refetch oder lokales Filtern)

</code_context>

<specifics>
## Specific Ideas

- Drei-Punkte-Menu im Header statt Button am Ende der Mitgliederliste
- Still verschwinden — keine Systemnachricht "Nutzer hat verlassen"
- Admins koennen nicht aus Admin-Chats raus, nur Teamer

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 53-chat-verlassen*
*Context gathered: 2026-03-19*
