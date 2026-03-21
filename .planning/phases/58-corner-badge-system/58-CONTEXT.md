# Phase 58: Corner-Badge System - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Bestehende Corner-Badges auf neuen Flex-Container migrieren. Queue-Badge (Uhr-Icon) und Fehler-Badge (Ausrufezeichen) CSS-Klassen erstellen. Alle Listen-Elemente mit Corner-Badges umstellen. Voraussetzung fuer Queue-Status-Anzeige in Phase 60+.

</domain>

<decisions>
## Implementation Decisions

### Flex-Container System
- **D-01:** Neuer `.app-corner-badges` Flex-Container ersetzt einzelne absolute Corner-Badges
- **D-02:** Container ist `position: absolute; top: 0; right: 0; display: flex; gap: 0`
- **D-03:** 2px weisser Trenner (`div` mit `width: 2px; background: white`) zwischen Badges — wie PointsHistoryModal

### Badge-Rundung (KRITISCH — vom User bestimmt)
- **D-04:** Alle Badges ausser letztes Kind: `border-radius: 0 0 10px 10px` (unten-links + unten-rechts abgerundet)
- **D-05:** Letztes Kind (ganz rechts): `border-radius: 0 10px 10px 10px` (oben-rechts Card-Ecke + unten beide)
- **D-06:** Einziges Kind: gleiche Rundung wie letztes Kind `border-radius: 0 10px 10px 10px`
- **D-07:** Referenz-Implementierung: PointsHistoryModal.tsx Zeile 280-303

### Queue-Badge
- **D-08:** Queue-Badge ist immer das linkste Badge im Container (erstes Kind)
- **D-09:** Nur Uhr-Icon (timeOutline aus ionicons), kein Text, orange #ff9500
- **D-10:** Padding schmaler als Text-Badges: `padding: 4px 6px` statt `padding: 4px 10px`
- **D-11:** Nach erfolgreicher Zustellung verschwindet Badge einfach — kein Haekchen, kein Feedback

### Fehler-Badge
- **D-12:** Bei permanentem Fehler (4xx) wechselt Uhr-Icon zu alertCircleOutline, Farbe rot #dc3545
- **D-13:** Tap auf Fehler-Badge oeffnet ActionSheet mit "Erneut senden" und "Loeschen"

### Migration bestehender Badges
- **D-14:** Alle bestehenden Corner-Badges (in ~25 Views/Pages) muessen in den neuen Container migriert werden
- **D-15:** Bestehende `.app-corner-badge` Klasse verliert `position: absolute; top: 0; right: 0` — das uebernimmt der Container
- **D-16:** Badge-Farb-Klassen (--events, --success, --warning, etc.) bleiben erhalten

### Claude's Discretion
- Reihenfolge der View-Migration
- Transition/Animation beim Erscheinen/Verschwinden des Queue-Badges
- Genauer ActionSheet-Inhalt fuer fehlgeschlagene Items

</decisions>

<specifics>
## Specific Ideas

- PointsHistoryModal (Zeile 280-303) ist die exakte Referenz fuer das Multi-Badge Pattern — dort existiert bereits ein Flex-Container mit zwei Badges + weissem Trenner
- Das Queue-Badge erscheint erst in Phase 60 tatsaechlich (Queue-Logik), aber die CSS-Klassen und der Container muessen in Phase 58 stehen

</specifics>

<canonical_refs>
## Canonical References

### Referenz-Implementierung
- `frontend/src/components/konfi/modals/PointsHistoryModal.tsx` Zeile 280-303 — Multi-Badge Flex-Container mit korrekten Rundungen

### Bestehende Corner-Badge CSS
- `frontend/src/theme/variables.css` Zeile 278-296 — `.app-corner-badge` Definition + Farb-Varianten

### Alle Dateien mit Corner-Badges (komplett)
- `frontend/src/components/admin/EventsView.tsx`
- `frontend/src/components/admin/ActivitiesView.tsx`
- `frontend/src/components/admin/KonfisView.tsx`
- `frontend/src/components/admin/UsersView.tsx`
- `frontend/src/components/admin/ActivityRequestsView.tsx`
- `frontend/src/components/admin/views/EventDetailView.tsx`
- `frontend/src/components/admin/views/KonfiDetailView.tsx`
- `frontend/src/components/admin/pages/AdminSettingsPage.tsx`
- `frontend/src/components/admin/pages/AdminLevelsPage.tsx`
- `frontend/src/components/admin/modals/ActivityModal.tsx`
- `frontend/src/components/konfi/views/EventsView.tsx`
- `frontend/src/components/konfi/views/RequestsView.tsx`
- `frontend/src/components/konfi/views/BadgesView.tsx`
- `frontend/src/components/konfi/modals/ActivityRequestModal.tsx`
- `frontend/src/components/konfi/modals/PointsHistoryModal.tsx`
- `frontend/src/components/teamer/pages/TeamerEventsPage.tsx`
- `frontend/src/components/teamer/pages/TeamerBadgesPage.tsx`
- `frontend/src/components/teamer/views/TeamerBadgesView.tsx`
- `frontend/src/components/chat/ChatOverview.tsx`
- `frontend/src/components/chat/modals/MembersModal.tsx`
- `frontend/src/components/chat/modals/SimpleCreateChatModal.tsx`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- PointsHistoryModal bereits Multi-Badge Flex-Container implementiert — kann als Template dienen
- `.app-corner-badge` CSS-Klasse mit 7 Farb-Varianten — bleiben erhalten

### Established Patterns
- Corner-Badges sind immer innerhalb von `.app-list-item` Containern mit `position: relative; overflow: hidden`
- Manche Badges haben `position: static` (PointsHistory, TeamerEvents) — diese sind bereits im Flex-Flow

### Integration Points
- variables.css — CSS-Aenderungen am bestehenden `.app-corner-badge` + neuer `.app-corner-badges` Container
- ~21 Dateien mit Corner-Badge Nutzung — alle muessen migriert werden

</code_context>

<deferred>
## Deferred Ideas

- Queue-Status Logik (wann Uhr erscheint/verschwindet) — Phase 60
- Chat-Nachrichten Queue-UI (Uhr neben Zeitstempel) — Phase 59
- ActionSheet fuer fehlgeschlagene Items — Phase 60

</deferred>

---

*Phase: 58-corner-badge-system*
*Context gathered: 2026-03-21*
