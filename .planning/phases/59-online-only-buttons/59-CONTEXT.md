# Phase 59: Online-Only Buttons - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

42 Online-Only Aktionen zeigen "Du bist offline" und sind disabled wenn offline. Chat-Nachrichten zeigen Uhr-Icon bei Pending und Ausrufezeichen bei Fehler. Kein globales Offline-Banner.

</domain>

<decisions>
## Implementation Decisions

### Online-Only Button Pattern
- **D-01:** Alle 42 OOA-Aktionen aus REQUIREMENTS.md bekommen einen isOnline-Check
- **D-02:** Pattern: `disabled={!isOnline}` auf dem Button + Text-Aenderung zu "Du bist offline" wenn `!isOnline`
- **D-03:** isOnline kommt aus AppContext (bereits in Phase 55 implementiert): `const { isOnline } = useApp()`
- **D-04:** Kein globales Offline-Banner — nur kontextbezogene Hinweise an betroffenen Buttons

### Chat Queue-Status UI
- **D-05:** Pending Chat-Nachricht zeigt timeOutline Icon neben dem Zeitstempel rechts unten in der Bubble
- **D-06:** Nach Zustellung verschwindet die Uhr einfach (kein Haekchen)
- **D-07:** Bei Fehler wechselt Uhr zu alertCircleOutline rot, Tap auf Nachricht zeigt ActionSheet "Erneut senden" / "Loeschen"
- **D-08:** Chat-Queue-Status kommt erst in Phase 60 tatsaechlich zum Einsatz — Phase 59 baut nur die UI-Infrastruktur (MessageBubble erweiterung)

### Claude's Discretion
- Reihenfolge der Button-Migration (welche Dateien zuerst)
- Exakter Wortlaut "Du bist offline" vs. "Offline" vs. "Nicht verfuegbar"
- Styling des disabled-Zustands (opacity, Farbe)
- MessageBubble Layout fuer Status-Icon

</decisions>

<canonical_refs>
## Canonical References

### Requirements (42 Online-Only Aktionen)
- `.planning/REQUIREMENTS.md` OOA-01 bis OOA-42 — Vollstaendige Liste aller Aktionen die online-only sind

### Chat UI
- `frontend/src/components/chat/MessageBubble.tsx` — Bestehende Nachricht-Bubble wo Status-Icon eingefuegt wird
- `frontend/src/components/chat/ChatRoom.tsx` — Wo Nachrichten gerendert werden

### Phase 55 Artefakte
- `frontend/src/contexts/AppContext.tsx` — isOnline State (bereits implementiert)
- `frontend/src/services/networkMonitor.ts` — Netzwerk-Status Service

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useApp()` Hook liefert bereits isOnline — kein neuer Import noetig
- IonButton disabled Prop — Standard Ionic Pattern
- useActionGuard Hook (Phase 57) — bereits in allen Modals, kann als isOnline-Check-Traeger dienen

### Established Patterns
- Alle Modals haben Submit-Buttons mit onClick-Handler
- IonButton disabled ist bereits in vielen Modals via useActionGuard vorhanden
- MessageBubble.tsx rendert Zeitstempel rechts unten in der Bubble

### Integration Points
- ~30 Dateien mit Online-Only Buttons (Modals, Pages, Views)
- MessageBubble.tsx fuer Chat-Status-Icon
- ChatRoom.tsx fuer Fehler-ActionSheet bei Tap

</code_context>

<deferred>
## Deferred Ideas

- Queue-Logik (wann Uhr erscheint/verschwindet) — Phase 60
- WriteQueue Service — Phase 60
- Tatsaechliches Queuing von Nachrichten — Phase 60

</deferred>

---

*Phase: 59-online-only-buttons*
*Context gathered: 2026-03-21*
