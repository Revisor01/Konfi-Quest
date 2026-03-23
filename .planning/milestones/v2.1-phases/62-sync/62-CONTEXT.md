# Phase 62: Sync - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Sync-Koordination: Bei Socket.io Reconnect korrekte Reihenfolge sicherstellen (Queue flush → Cache invalidieren → Badge-Counts). Bei App-Resume aktive Page revalidieren. Kein Delta-Sync Endpoint — SWR-Revalidierung reicht fuer 4000 User.

</domain>

<decisions>
## Implementation Decisions

### Reconnect-Reihenfolge (SYN-02)
- **D-01:** Bei Socket.io `connect` Event (Reconnect, nicht erster Connect): 1) writeQueue.flush() 2) offlineCache Stale-Keys invalidieren 3) BadgeContext.refreshAllCounts()
- **D-02:** Reihenfolge ist KRITISCH: Erst Queue flushen (damit Server-State aktuell ist), dann lesen
- **D-03:** Implementierung in websocket.ts onReconnect Callback-System (bereits in Phase 55 angelegt)

### App-Resume Revalidierung (SYN-04)
- **D-04:** Bei appStateChange (Background → Foreground): Aktive Page revalidiert via offlineCache TTL-Check
- **D-05:** Bereits teilweise in AppContext.tsx implementiert (Phase 60: Queue-Flush bei Resume). Fehlt: Cache-Invalidierung + Badge-Refresh

### SWR bei App-Start (SYN-01)
- **D-06:** Bereits durch useOfflineQuery implementiert (Phase 56): Cache lesen → sofort anzeigen → Revalidierung im Hintergrund
- **D-07:** Kein zusaetzlicher Code noetig — SYN-01 ist bereits erfuellt durch das bestehende SWR-Pattern

### Chat-Nachladen (SYN-03)
- **D-08:** Bereits in Phase 55 implementiert: Backend ?after=lastMessageId, ChatRoom/ChatOverview Reconnect-Handler
- **D-09:** Kein zusaetzlicher Code noetig — SYN-03 ist bereits erfuellt

### Kein Delta-Sync Endpoint
- **D-10:** Kein /sync/changes Endpoint — SWR-Revalidierung reicht
- **D-11:** Kein updated_at Felder Migration noetig
- **D-12:** Bei 4000 Usern: SWR verteilt Requests ueber Zeit (TTL-basiert), kein Thundering-Herd

### Claude's Discretion
- Debouncing bei schnellem Resume (App kurz in Background und sofort zurueck)
- Reihenfolge der Cache-Invalidierung (welche Keys zuerst)
- Logging/Debugging fuer Sync-Probleme

</decisions>

<canonical_refs>
## Canonical References

### Bereits implementierte Bausteine
- `frontend/src/services/writeQueue.ts` — flush() Methode (Phase 60)
- `frontend/src/services/offlineCache.ts` — clearAll() + isStale() (Phase 56)
- `frontend/src/services/websocket.ts` — onReconnect System (Phase 55)
- `frontend/src/contexts/AppContext.tsx` — appStateChange Handler + Queue-Flush bei Resume (Phase 60)
- `frontend/src/contexts/BadgeContext.tsx` — refreshAllCounts() (bestehend)
- `frontend/src/hooks/useOfflineQuery.ts` — SWR-Pattern mit Network-Listener (Phase 56)

</canonical_refs>

<code_context>
## Existing Code Insights

### Was schon steht
- writeQueue.flush() bei Resume (AppContext, Phase 60)
- writeQueue.flush() bei Online-Wechsel (networkMonitor, Phase 60)
- ChatRoom/ChatOverview Reconnect-Handler (Phase 55)
- useOfflineQuery SWR bei App-Start (Phase 56)
- onReconnect Callback-System in websocket.ts (Phase 55)

### Was noch fehlt
- Koordinierte Reconnect-Reihenfolge (flush → invalidate → badges) — aktuell passiert flush und Chat-Nachladen separat, nicht koordiniert
- Cache-Invalidierung bei Resume — aktuell nur Queue-Flush
- Badge-Refresh nach Reconnect — aktuell nur bei newMessage Event

### Integration Points
- websocket.ts onReconnect → koordinierte Sync-Sequenz
- AppContext appStateChange → Cache-Invalidierung + Badge-Refresh nach Queue-Flush
- BadgeContext → refreshAllCounts() Aufruf aus Sync-Sequenz

</code_context>

<deferred>
## Deferred Ideas

- /sync/changes Delta-Sync Endpoint — nur bei nachgewiesenem Performance-Problem (4000+ User Peak)
- Socket.io Connection State Recovery — nicht noetig mit ?after Pattern
- Periodischer Background-Sync — App-Resume reicht

</deferred>

---

*Phase: 62-sync*
*Context gathered: 2026-03-21*
