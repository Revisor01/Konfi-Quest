# Phase 55: Fundament - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Storage-Migration localStorage->Capacitor Preferences fuer 4 Keys in 28 Zugriffsstellen (14 Dateien). Netzwerk-Erkennung via @capacitor/network mit isOnline im AppContext. 401-Handler-Fix gegen Offline-Logout. Socket.io Reconnect laedt verpasste Chat-Nachrichten nach.

</domain>

<decisions>
## Implementation Decisions

### Boot-Sequenz
- **D-01:** Async Boot in main.tsx: `migrateToPreferences()` -> `initTokenStore()` -> `createRoot().render()`
- **D-02:** Waehrend Boot zeigt die App den bestehenden Auth-Bildschirm (Hintergrund + Logo) mit Spinner, OHNE Login-Formular. Kein weisser Bildschirm, kein neues Design noetig.
- **D-03:** checkAuth() wird async (checkAuthAsync) — AppContext startet mit `user: null`, useEffect laedt User aus TokenStore

### TokenStore
- **D-04:** Neuer Service `tokenStore.ts` — In-Memory-Cache + async Capacitor Preferences dahinter
- **D-05:** Synchrone Getter (`getToken()`, `getUser()`) fuer Request-Interceptor und Socket.io — lesen aus Memory, nicht aus Preferences
- **D-06:** Async Setter (`setToken()`, `setUser()`, `clearAuth()`) schreiben in Memory UND Preferences
- **D-07:** `initTokenStore()` wird einmal bei Boot aufgerufen, laedt aus Preferences in Memory

### Storage-Migration
- **D-08:** Einmalige Migration beim App-Start: localStorage -> Preferences fuer konfi_token, konfi_user, device_id, push_token_last_refresh
- **D-09:** Migration-Flag `storage_migrated_v1` in Preferences. Wenn gesetzt, Migration ueberspringen.
- **D-10:** localStorage-Keys nach Migration NICHT loeschen (Fallback fuer Rollback-Szenario). Werden in v2.2 entfernt.

### Netzwerk-Erkennung
- **D-11:** isOnline State direkt in AppContext (kein eigener NetworkContext — zu wenig State fuer eigenen Context)
- **D-12:** @capacitor/network Plugin fuer native Erkennung + navigator.onLine als Web-Fallback
- **D-13:** NetworkMonitor als Singleton-Service (wie websocket.ts) mit subscribe-Pattern fuer Listener

### 401-Handler-Fix
- **D-14:** api.ts Response-Interceptor prueft `networkMonitor.isOnline` bevor Token geloescht wird
- **D-15:** Wenn offline und 401: Token behalten, Error nicht weiterreichen (User sieht gecachte Daten in Phase 56)
- **D-16:** Wenn online und 401: Token loeschen und Redirect wie bisher

### Socket.io Reconnect + Chat-Nachladen
- **D-17:** Backend Chat-Route bekommt optionalen `?after=lastMessageId` Parameter — gibt nur neuere Nachrichten zurueck
- **D-18:** Bei Socket.io `connect` Event: ChatRoom und ChatOverview laden verpasste Nachrichten via ?after Parameter
- **D-19:** Kein SyncManager in Phase 55 — nur die Grundlage (Backend-Parameter + Frontend-Aufruf bei Reconnect)

### Claude's Discretion
- NetworkMonitor Event-Debouncing (schnelle Online/Offline-Wechsel)
- Genauer Zeitpunkt der Migration in der Boot-Sequenz
- Error-Handling bei fehlgeschlagener Migration
- Socket.io Reconnect-Timing fuer Chat-Nachladen

</decisions>

<specifics>
## Specific Ideas

- Boot-Screen: Bestehender Auth-Bildschirm (Gradient + Logo) mit Spinner — genau wie Login-Page aussehend aber ohne Formular. User erkennt die App sofort.
- TokenStore Pattern: Synchrone Reads aus Memory, async Writes nach Preferences — damit der Axios Request-Interceptor synchron bleibt (kein async Interceptor noetig).

</specifics>

<canonical_refs>
## Canonical References

### Research
- `.planning/research/DEEP-OFFLINE-ANALYSIS.md` §5 (JWT Token Lifecycle) — Alle 28 localStorage-Zugriffe mit Datei+Zeile
- `.planning/research/DEEP-OFFLINE-ANALYSIS.md` §8 (Migration Path) — Migrations-Strategie und betroffene Dateien
- `.planning/research/SUMMARY.md` §Phase 1 — Fundament-Empfehlung mit Aufgabenliste

### Betroffene Dateien (direkt aus Code-Analyse)
- `frontend/src/services/auth.ts` — checkAuth() sync->async, login/logout localStorage->TokenStore
- `frontend/src/services/api.ts` — Request-Interceptor Token aus TokenStore, 401-Handler Offline-Pruefung
- `frontend/src/contexts/AppContext.tsx:93` — useState(checkAuth()) muss async werden
- `frontend/src/contexts/LiveUpdateContext.tsx:43` — localStorage.getItem('konfi_token') -> getToken()
- `frontend/src/contexts/BadgeContext.tsx:125` — localStorage.getItem('konfi_token') -> getToken()
- `frontend/src/components/chat/ChatRoom.tsx:205` — localStorage -> getToken()
- `frontend/src/components/chat/ChatOverview.tsx:90` — localStorage -> getToken()
- `frontend/src/services/websocket.ts` — Token als Parameter, kein direkter localStorage-Zugriff
- `frontend/src/main.tsx` — Async Boot-Sequenz einfuegen

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `websocket.ts` Singleton-Pattern: Exakt das gleiche Pattern fuer NetworkMonitor verwenden
- Auth-Bildschirm Design: Login-Page hat bereits den gewuenschten Look (Gradient + Logo + Spinner)
- `Device.getId()` in AppContext.tsx: Bereits Capacitor Device Plugin integriert

### Established Patterns
- Singleton-Services: api.ts, websocket.ts — NetworkMonitor folgt dem gleichen Pattern
- Context-Pattern: AppContext als zentraler State-Container — isOnline passt hier rein
- Socket.io Events: `connect`, `disconnect` bereits in websocket.ts gehandled — Reconnect-Hook dort einfuegen

### Integration Points
- `main.tsx` -> Boot-Sequenz vor React.render()
- `AppContext.tsx` -> isOnline State + async checkAuth
- `api.ts` -> TokenStore + NetworkMonitor Import
- Alle 14 Dateien mit localStorage -> TokenStore Import
- Backend `routes/chat.js` -> after-Parameter in Messages-Query

</code_context>

<deferred>
## Deferred Ideas

- offlineCache.ts Service — Phase 56
- useOfflineQuery Hook — Phase 56
- axios-retry Integration — Phase 57
- Queue-Badge Corner-Badge System — Phase 58
- WriteQueue Service — Phase 60

</deferred>

---

*Phase: 55-fundament*
*Context gathered: 2026-03-20*
