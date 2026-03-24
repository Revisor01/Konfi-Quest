# Phase 95: Chat-Farbschema + Korrekturen - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Einheitliches Chat-Farbschema ueber alle 3 Rollen (Admin, Teamer, Konfi) + Behebung aller bekannten Chat-Bugs (User-Liste, Gruppenchats, Laden, Poll-Abstaende, Members-Pattern, Admin-Leave, Chat-Loeschen).

</domain>

<decisions>
## Implementation Decisions

### Chat-Farbschema
- Farbzuordnung nach Raumtyp: `admin/team` Rosa #e11d48, `jahrgang` Tuerkis #06b6d4, `direct konfi` Lila #5b21b6, `group` Orange #f97316
- Farben ueberall anwenden: ChatOverview (Border + Icon-Circle + Corner-Badge) + ChatRoom Header
- Aktuell inkonsistent: `admin` und `jahrgang` haben BEIDE #06b6d4, Team-Chats fehlen Rosa komplett
- Farben als CSS-Klassen in variables.css statt inline (app-list-item--team, app-list-item--jahrgang, etc.)
- Konfi-Farbe muss in MembersModal und SimpleCreateChatModal identisch sein (aktuell: Lila vs Orange)

### Chat-Bugs
- User-Liste (TCH-01, ACH-02): SimpleCreateChatModal bereits korrekt mit Jahrgangs-Filter. MembersModal `loadAllUsers()` muss auf gleichen Filter umgestellt werden (aktuell laedt potentiell alle Konfis ohne Org/Jahrgangs-Filter)
- Gruppenchats Teamer (TCH-02): SimpleCreateChatModal erlaubt `group`-Typ nur fuer Admin-Rolle. Fuer Teamer:innen freischalten (chatType-Auswahl anbieten)
- Chats laden nicht (TCH-04): Backend-Route + Frontend-Aufruf debuggen, SWR-Cache-Invalidation sicherstellen
- Poll-Modal Abstaende (ACH-04): Doppeltes Padding (16px Container-Div + IonList inset margin) entfernen — nur IonList inset verwenden

### Admin Chat-Regeln
- MembersModal Pattern (ACH-03): Auf SimpleCreateChatModal-Pattern umstellen mit app-list-item, konsistenten Farben und Checkboxen
- Admin Chat verlassen (ACH-05): Backend gibt bereits 403 zurueck. Frontend: "Verlassen"-Button fuer Admins in Team-Chats ausblenden + Hinweistext "Admins koennen Team-Chats nicht verlassen" anzeigen
- Chat loeschen (ACH-06): FK-Kaskade loescht korrekt alles inkl. Teilnehmer. Im Loesch-Dialog Info-Text "Chat wird fuer alle Teilnehmer:innen geloescht" hinzufuegen

### Claude's Discretion
- Konkretes Debugging-Vorgehen fuer TCH-04 (Chats laden nicht)
- CSS-Klassen-Namensgebung fuer die neuen Raumtyp-Farben

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SimpleCreateChatModal.tsx` — bereits korrektes User-Loading mit Jahrgangs-Filter, Referenz fuer MembersModal-Fix
- `ChatOptionsModal.tsx` — Leave/Delete Logik bereits implementiert
- CSS-Klassen `app-list-item--chat`, `app-list-item--primary`, `app-list-item--warning` in variables.css
- `app-icon-circle--chat`, `app-icon-circle--warning` CSS-Klassen

### Established Patterns
- Chat-Farben aktuell inline in ChatOverview.tsx Zeile 383-385 definiert
- `canLeaveChat()` in ChatRoom.tsx Zeile 948-976 prueft Raumtyp und User-Rolle
- Swipe-Delete in ChatOverview nur fuer `direct`/`group` (korrekt)
- Backend chat.js: Admin kann nicht aus admin-Raum verlassen (403), jahrgang/direct nicht verlassbar (400)

### Integration Points
- ChatOverview.tsx — Farben fuer Room-Liste (Border, Icon-Circle, Corner-Badge)
- ChatRoom.tsx — Header-Farbe basierend auf Raumtyp
- SimpleCreateChatModal.tsx — Gruppen-Chat Freischaltung fuer Teamer
- MembersModal.tsx — User-Loading und Farb-Pattern angleichen
- PollModal.tsx — Container-Padding entfernen
- Backend chat.js — ggf. Teamer-Gruppenchat-Erstellung erlauben

</code_context>

<specifics>
## Specific Ideas

- Farben: Team/Admin Rosa #e11d48, Jahrgang Tuerkis #06b6d4, Konfi/Direct Lila #5b21b6, Gruppe Orange #f97316
- MembersModal soll exakt gleiches Pattern wie SimpleCreateChatModal verwenden
- "Admins koennen Team-Chats nicht verlassen" als Hinweis-Text wenn Admin Leave versucht
- "Chat wird fuer alle Teilnehmer:innen geloescht" im Loesch-Bestaetigungsdialog

</specifics>

<deferred>
## Deferred Ideas

- Push-Benachrichtigung bei Chat-Loeschung an Teilnehmer:innen (nicht in v2.8 Scope)

</deferred>
