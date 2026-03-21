# Phase 60: Queue-Kern + Konfi-Aktionen - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

WriteQueue Service implementieren (FIFO, persistent in Capacitor Preferences). Konfi-Queue-Aktionen: Chat-Nachrichten (Text+Bild), Aktivitaets-Antraege (mit/ohne Foto), Opt-out. Fire-and-Forget-Aktionen (Mark-Read, Reaktionen, Poll, Settings-Toggles, Bibeluebersetzung, Funktionsbeschreibung). Queue-Infrastruktur: Flush bei Reconnect/Resume, Background-Task, Fehlerbehandlung.

</domain>

<decisions>
## Implementation Decisions

### WriteQueue Service
- **D-01:** Neuer Service `writeQueue.ts` — FIFO-Queue persistent in Capacitor Preferences
- **D-02:** Queue-Item Interface: `{ id, method, url, body, maxRetries, retryCount, createdAt, metadata: { type, clientId, roomId? } }`
- **D-03:** Methoden: enqueue(), flush(), flushTextOnly(), remove(), getAll(), clear()
- **D-04:** Flush-Logik: Items sequentiell abarbeiten, bei 4xx entfernen + User informieren, bei 5xx/408/429 retryCount++
- **D-05:** Max 5 Retries pro Item, danach als failed markieren

### Chat-Queue (Konfi + alle Rollen)
- **D-06:** ChatRoom.tsx sendMessage: Wenn offline → writeQueue.enqueue() + Optimistic UI mit queueStatus 'pending'
- **D-07:** Bei Reconnect: Queue flusht → Server sendet newMessage via WebSocket → optimistic msg wird durch echte ersetzt
- **D-08:** Chat mit Bild: Bild in Capacitor Filesystem speichern, Queue-Item hat Referenz auf lokale Datei, Upload nur im Vordergrund
- **D-09:** client_id (UUID) wird bei jedem Queue-Item generiert — Backend dedupliziert (Phase 57 Idempotency-Keys)

### Aktivitaets-Antraege Queue
- **D-10:** KonfiRequestsPage / ActivityRequestModal: Wenn offline → writeQueue.enqueue() + Optimistic UI mit Uhr-Icon (Corner-Badge)
- **D-11:** Antrag mit Foto: Foto lokal speichern, Upload im Vordergrund
- **D-12:** client_id fuer Deduplizierung

### Opt-out Queue
- **D-13:** Konfi EventDetailView Opt-out: Wenn offline → writeQueue.enqueue() + Uhr-Icon am Event

### Fire-and-Forget
- **D-14:** Kein Queue-Feedback — rein optimistisch, Queue im Hintergrund
- **D-15:** Betrifft: mark-read, Reaktionen, badges-mark-seen, poll-vote, Bibeluebersetzung, Dashboard-Settings, Chat-Permissions, Funktionsbeschreibung

### Queue-Infrastruktur
- **D-16:** Queue-Flush bei App-Resume (appStateChange isActive=true) UND Socket.io Reconnect
- **D-17:** @capawesome/capacitor-background-task: Bei App-Background nur Text-Items flushen (keine Uploads)
- **D-18:** Queue ueberlebt App-Neustart (Capacitor Preferences)
- **D-19:** Flush-Reihenfolge bei Reconnect: Queue flushen → Cache invalidieren (Phase 62)

### Claude's Discretion
- Optimistic UI Umsetzung (wie genau die pending-Items in der UI erscheinen)
- Capacitor Filesystem Pfad fuer lokale Dateien
- Toast/Benachrichtigung bei failed Queue-Items
- Debouncing bei schnellem Online/Offline-Wechsel waehrend Flush

</decisions>

<canonical_refs>
## Canonical References

### Research
- `.planning/research/DEEP-OFFLINE-ANALYSIS.md` §3 (Write Queue Gruppierung nach Komplexitaet)
- `.planning/research/DEEP-OFFLINE-ANALYSIS.md` §7 (Background Sync Feasibility — 30s iOS Limit)
- `.planning/research/DEEP-OFFLINE-ANALYSIS.md` §9 (Konflikt-Szenarien fuer Queue-Aktionen)
- `.planning/research/DEEP-OFFLINE-ANALYSIS.md` §10 (ChatRoom sendMessage mit Queue-Support)

### Voraussetzungen (Phase 55-59)
- `frontend/src/services/networkMonitor.ts` — isOnline fuer Queue-Entscheidung
- `frontend/src/services/tokenStore.ts` — Token fuer API-Calls beim Flush
- `frontend/src/hooks/useActionGuard.ts` — Kann mit Queue-Logik kombiniert werden
- `frontend/src/components/chat/MessageBubble.tsx` — queueStatus Props (Phase 59)
- `frontend/src/components/chat/ChatRoom.tsx` — handleRetryMessage/onDeleteQueued (Phase 59)
- `frontend/src/types/chat.ts` — queueStatus + localId Felder (Phase 59)

### Betroffene Dateien
- `frontend/src/components/chat/ChatRoom.tsx` — sendMessage Queue-Integration
- `frontend/src/components/konfi/modals/ActivityRequestModal.tsx` — Antrag Queue
- `frontend/src/components/konfi/views/EventDetailView.tsx` — Opt-out Queue
- `frontend/src/contexts/BadgeContext.tsx` — mark-read Fire-and-Forget
- `frontend/src/components/chat/ChatRoom.tsx` — Reaktionen, Poll Fire-and-Forget

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- networkMonitor.subscribe() — Queue-Flush bei Online-Wechsel triggern
- offlineCache.ts Pattern — gleiche Capacitor Preferences Abstraktion fuer Queue-Persistenz
- ChatRoom.tsx handleRetryMessage/onDeleteQueued — bereits in Phase 59 vorbereitet
- MessageBubble.tsx queueStatus Props — bereits in Phase 59 vorbereitet

### Established Patterns
- ChatRoom.tsx sendMessage nutzt FormData fuer multipart Uploads
- ActivityRequestModal hat separaten Foto-Upload (POST /konfi/upload-photo)
- BadgeContext mark-read ist bereits optimistisch (sofortige UI-Aenderung)

### Integration Points
- writeQueue.ts → api.ts (flush nutzt axios fuer Requests)
- writeQueue.ts → Capacitor Preferences (Persistenz)
- writeQueue.ts → networkMonitor (Flush bei Online-Wechsel)
- writeQueue.ts → AppContext (appStateChange fuer Resume)
- ChatRoom.tsx → writeQueue (enqueue bei offline)
- main.tsx oder App.tsx → @capawesome/capacitor-background-task (Background-Flush)

</code_context>

<deferred>
## Deferred Ideas

- Admin-Queue (Events, Aktivitaeten, Badges etc.) — Phase 61
- Teamer-Queue (Event buchen/abmelden) — Phase 61
- SyncManager (Reconnect-Reihenfolge koordinieren) — Phase 62
- Cache-Invalidierung nach Queue-Flush — Phase 62

</deferred>

---

*Phase: 60-queue-kern-konfi-aktionen*
*Context gathered: 2026-03-21*
