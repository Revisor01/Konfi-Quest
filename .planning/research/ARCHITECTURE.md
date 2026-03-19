# Architecture: Offline-Layer Integration

**Projekt:** Konfi Quest v2.1 App-Resilienz
**Recherchiert:** 2026-03-19
**Fokus:** Wie Offline-Cache, Schreib-Queue und Sync in die bestehende Axios + Socket.io + React Context Architektur integriert werden

## Ist-Zustand: Datenfluss heute

```
Page (z.B. KonfiDashboardPage)
  |-- useEffect -> api.get('/konfi/dashboard') -> setState(response.data)
  |-- useLiveRefresh(['dashboard', 'events', 'badges'], refreshAllData)
  |-- IonRefresher -> loadDashboardData()

api.ts (Axios)
  |-- Request Interceptor: JWT aus localStorage
  |-- Response Interceptor: 401 -> Logout, 429 -> Rate-Limit Event

websocket.ts (Socket.io)
  |-- initializeWebSocket(token) -> singleton Socket
  |-- Events: newMessage, liveUpdate, joinRoom, leaveRoom

Contexts:
  |-- AppContext: user, error, success, push permissions
  |-- BadgeContext: chatUnreadByRoom, pendingRequests/Events, WebSocket listener
  |-- LiveUpdateContext: subscribe/unsubscribe Pub-Sub fuer WebSocket-Events
  |-- ModalContext: presentingElement Management
```

### Aktuelles Datenladen-Pattern (in jeder Page)

```typescript
// Typisches Pattern in ~30 Pages:
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

const loadData = async () => {
  setLoading(true);
  try {
    const response = await api.get('/endpoint');
    setData(response.data);
  } catch (err) {
    setError('Fehler beim Laden');
  } finally {
    setLoading(false);
  }
};

useEffect(() => { loadData(); }, []);
useLiveRefresh('type', loadData);
```

**Wichtige Beobachtungen:**
- Kein zentraler Data-Layer -- jede Page holt eigene Daten direkt via `api.get()`
- Kein Caching -- jeder Seitenwechsel laedt alles neu
- Kein Offline-Handling -- Netzfehler zeigen generische Fehlermeldung
- localStorage nur fuer Auth (token, user, device_id) -- keine Datencaches
- Socket.io hat bereits Reconnection-Logik (10 Versuche, 1s Delay)
- IonRefresher (Pull-to-Refresh) existiert auf den meisten Pages

---

## Empfohlene Architektur: Cache-First mit Schreib-Queue

### Architektur-Ueberblick

```
                                  FRONTEND
 +-----------------------------------------------------------------+
 |                                                                   |
 |  Pages (unveraendert)                                             |
 |    |                                                              |
 |    v                                                              |
 |  useOfflineQuery(key, fetcher)   <-- Neuer Hook, ersetzt         |
 |    |                                 direktes api.get()           |
 |    v                                                              |
 |  OfflineCache (Singleton Service)                                 |
 |    |-- get(key): CachedData | null                                |
 |    |-- set(key, data, ttl)                                        |
 |    |-- invalidate(key | pattern)                                  |
 |    |-- Storage: Capacitor Preferences (nativ) / localStorage      |
 |    |                                                              |
 |  WriteQueue (Singleton Service)                                   |
 |    |-- enqueue(method, url, body, metadata)                       |
 |    |-- flush(): Promise<Results>                                  |
 |    |-- getQueue(): QueueItem[]                                    |
 |    |-- Storage: Capacitor Preferences                             |
 |    |                                                              |
 |  NetworkMonitor (Singleton Service)                               |
 |    |-- isOnline: boolean                                          |
 |    |-- subscribe(callback)                                        |
 |    |-- Uses: Capacitor Network Plugin + navigator.onLine          |
 |    |                                                              |
 |  SyncManager (Singleton Service)                                  |
 |    |-- syncOnResume(): void                                       |
 |    |-- syncPeriodic(): void                                       |
 |    |-- Koordiniert: WriteQueue.flush + Cache-Invalidierung        |
 |    |                                                              |
 |  OfflineBanner (UI-Komponente)                                    |
 |    |-- Zeigt Status an: offline / syncing / online                |
 |    |                                                              |
 +-----------------------------------------------------------------+

                                  BACKEND
 +-----------------------------------------------------------------+
 |  Neue Endpoints:                                                  |
 |    GET /sync/changes?since=timestamp                              |
 |      -> Inkrementelle Aenderungen seit letztem Sync               |
 |    POST /sync/batch                                               |
 |      -> Mehrere Schreiboperationen auf einmal                     |
 |  Aenderungen an bestehenden Endpoints:                            |
 |    Alle GET-Responses: + updated_at Feld                          |
 |    Chat-Nachrichten: + client_id fuer Deduplizierung              |
 +-----------------------------------------------------------------+
```

---

## Neue Komponenten (6 Dateien)

### 1. `frontend/src/services/offlineCache.ts` -- Cache-Storage

```typescript
// Schnittstelle:
interface CacheEntry<T> {
  data: T;
  timestamp: number;    // Wann gecacht
  ttl: number;          // Time-to-live in ms
  version: number;      // Schema-Version fuer Migrationen
}

class OfflineCache {
  async get<T>(key: string): Promise<CacheEntry<T> | null>;
  async set<T>(key: string, data: T, ttl?: number): Promise<void>;
  async invalidate(pattern: string): Promise<void>;  // z.B. 'events:*'
  async clear(): Promise<void>;
  isStale(entry: CacheEntry<any>): boolean;
}
```

**Storage-Entscheidung:** `@capacitor/preferences` (nicht Filesystem, nicht IndexedDB).

Gruende:
- Bereits im Capacitor-Oekosystem (kein neues Plugin)
- Key-Value String-Storage, perfekt fuer JSON-serialisierte API-Responses
- Nativ auf iOS (UserDefaults) und Android (SharedPreferences)
- Synchron auf nativen Plattformen, async API
- Limit: ~1MB pro Key ist ausreichend -- groesste Response (Dashboard) ist <50KB
- Web-Fallback: localStorage (bereits im Einsatz)

**Cache-Keys nach Konvention:**
```
cache:konfi:dashboard:{userId}
cache:konfi:events:{userId}
cache:konfi:badges:{userId}
cache:konfi:profile:{userId}
cache:chat:rooms:{userId}
cache:chat:messages:{roomId}:page:{n}
cache:admin:konfis:{orgId}
cache:admin:events:{orgId}
```

**TTL-Defaults:**
| Datentyp | TTL | Begruendung |
|----------|-----|-------------|
| Dashboard | 5 Min | Punkte aendern sich selten |
| Events | 10 Min | Registrierungsstatus relevant |
| Badges | 30 Min | Aendern sich sehr selten |
| Chat-Rooms | 2 Min | Unread-Counts muessen aktuell sein |
| Chat-Messages | 1 Stunde | Historische Nachrichten aendern sich nicht |
| Profil | 15 Min | Aendert sich selten |
| Admin-Listen | 5 Min | Muessen relativ aktuell sein |

### 2. `frontend/src/services/writeQueue.ts` -- Offline-Schreib-Queue

```typescript
interface QueueItem {
  id: string;           // UUID, fuer Deduplizierung
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  body: any;
  createdAt: number;
  retryCount: number;
  maxRetries: number;
  metadata: {
    type: 'chat_message' | 'activity_request' | 'event_booking';
    displayText: string;  // Fuer UI: "Nachricht an Allgemein"
  };
}

class WriteQueue {
  async enqueue(item: Omit<QueueItem, 'id' | 'createdAt' | 'retryCount'>): Promise<string>;
  async flush(): Promise<FlushResult>;
  async getQueue(): Promise<QueueItem[]>;
  async remove(id: string): Promise<void>;
  async clear(): Promise<void>;
  get pendingCount(): number;
}
```

**Scope der Queue -- NUR diese Operationen:**
1. Chat-Nachrichten (`POST /chat/rooms/:id/messages`)
2. Aktivitaets-Antraege (`POST /konfi/activities/:id/request`)

**NICHT in der Queue (zu komplex/riskant):**
- Event-Buchungen (Kapazitaetspruefung noetig)
- Admin-Operationen (Punkte vergeben, Konfis verwalten)
- Passwort-Aenderungen
- Datei-Uploads

**Deduplizierung:** Jedes QueueItem bekommt eine `client_id` (UUID). Backend prueft bei Chat-Messages auf Duplikate per `client_id`.

### 3. `frontend/src/services/networkMonitor.ts` -- Netzwerkstatus

```typescript
class NetworkMonitor {
  isOnline: boolean;
  connectionType: 'wifi' | 'cellular' | 'none' | 'unknown';
  subscribe(callback: (online: boolean) => void): () => void;

  // Nutzt:
  // - @capacitor/network Plugin (nativ)
  // - navigator.onLine + online/offline Events (Web)
}
```

**Neues Plugin noetig:** `@capacitor/network` (noch nicht in package.json).

### 4. `frontend/src/services/syncManager.ts` -- Sync-Koordinator

```typescript
class SyncManager {
  // Bei App-Resume (appStateChange -> isActive)
  async syncOnResume(): Promise<void>;

  // Periodisch (alle 5 Min wenn online)
  startPeriodicSync(intervalMs?: number): void;
  stopPeriodicSync(): void;

  // Bei Reconnect (WebSocket 'connect' Event)
  async syncOnReconnect(): Promise<void>;

  // Ablauf:
  // 1. WriteQueue.flush() -- ausstehende Schreiboperationen senden
  // 2. Inkrementeller Sync via GET /sync/changes?since=lastSync
  // 3. Betroffene Cache-Keys invalidieren
  // 4. Window Event 'sync-complete' dispatchen -> Pages refreshen
}
```

### 5. `frontend/src/hooks/useOfflineQuery.ts` -- Der zentrale Hook

```typescript
interface UseOfflineQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isStale: boolean;      // Daten aus Cache, Revalidierung laeuft
  isOffline: boolean;
  refresh: () => Promise<void>;
}

function useOfflineQuery<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options?: {
    ttl?: number;
    enabled?: boolean;     // Conditional fetching
    onSuccess?: (data: T) => void;
  }
): UseOfflineQueryResult<T>;
```

**Ablauf des Hooks:**
```
1. Cache lesen -> wenn vorhanden: sofort data setzen (isStale = true wenn TTL abgelaufen)
2. Wenn online: fetcher() aufrufen
   -> Erfolg: data aktualisieren, Cache schreiben, isStale = false
   -> Fehler: Cache-Daten behalten, error setzen
3. Wenn offline: Cache-Daten anzeigen (isStale = true), kein Fetch
```

### 6. `frontend/src/components/common/OfflineBanner.tsx` -- UI-Komponente

```typescript
// Kleiner Banner oben in der App wenn offline
// Zeigt: "Offline - Daten werden angezeigt aus dem Cache"
// Oder: "Synchronisiere..." mit Spinner
// Verschwindet automatisch wenn online
```

**Positionierung:** In der App-Shell (App.tsx), ueber allen Pages. Nutzt `IonToast` oder absolut positioniertes div.

---

## Aenderungen an bestehenden Dateien

### Aenderungs-Matrix

| Datei | Aenderung | Aufwand |
|-------|-----------|---------|
| `services/api.ts` | Offline-Erkennung im Response-Interceptor, Retry-Logik | Klein |
| `contexts/AppContext.tsx` | `isOnline` State + NetworkMonitor Integration | Klein |
| `contexts/BadgeContext.tsx` | Cache fuer Badge-Counts, Offline-Fallback | Mittel |
| `contexts/LiveUpdateContext.tsx` | Bei reconnect -> SyncManager.syncOnReconnect() | Klein |
| `services/websocket.ts` | reconnect Event -> SyncManager triggern | Klein |
| Jede Page mit `api.get()` (~25 Pages) | `api.get()` durch `useOfflineQuery()` ersetzen | Mittel (repetitiv) |
| `ChatRoom.tsx` | sendMessage -> WriteQueue bei offline | Mittel |
| `App.tsx` | OfflineBanner + NetworkMonitor Init | Klein |
| `package.json` | + @capacitor/network, @capacitor/preferences | Trivial |

### Detail: `services/api.ts` Aenderungen

```typescript
// BESTEHEND (bleibt):
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 Handler (bleibt)
    // 429 Handler (bleibt)

    // NEU: Retry-Logik fuer transiente Fehler
    if (isRetryableError(error) && !error.config.__retryCount) {
      error.config.__retryCount = (error.config.__retryCount || 0) + 1;
      if (error.config.__retryCount <= 3) {
        const delay = Math.pow(2, error.config.__retryCount) * 1000; // 2s, 4s, 8s
        return new Promise(resolve =>
          setTimeout(() => resolve(api(error.config)), delay)
        );
      }
    }

    return Promise.reject(error);
  }
);

function isRetryableError(error: any): boolean {
  // Netzwerkfehler (kein Response) oder 5xx Server-Fehler
  return !error.response || (error.response.status >= 500 && error.response.status < 600);
}
```

### Detail: Jede Page migrieren (Beispiel KonfiDashboardPage)

```typescript
// VORHER:
const [dashboardData, setDashboardData] = useState(null);
const [loading, setLoading] = useState(true);

const loadDashboardData = async () => {
  setLoading(true);
  try {
    const response = await api.get('/konfi/dashboard');
    setDashboardData(response.data);
  } catch (err) {
    setError('Fehler beim Laden');
  } finally {
    setLoading(false);
  }
};

useEffect(() => { loadDashboardData(); }, []);

// NACHHER:
const {
  data: dashboardData,
  loading,
  isStale,
  refresh: refreshDashboard
} = useOfflineQuery(
  `konfi:dashboard:${user?.id}`,
  () => api.get('/konfi/dashboard').then(r => r.data),
  { ttl: 5 * 60 * 1000 }
);

// useLiveRefresh bleibt, ruft jetzt refresh() statt loadData() auf
useLiveRefresh(['dashboard'], refreshDashboard);
```

**Migration-Aufwand pro Page:** ~10 Minuten. Mechanische Aenderung, kein Redesign.

### Detail: ChatRoom.tsx -- Offline-Schreib-Queue

```typescript
// VORHER:
const sendMessage = async () => {
  await api.post(`/chat/rooms/${room.id}/messages`, formData, { ... });
};

// NACHHER:
const sendMessage = async () => {
  const clientId = crypto.randomUUID();

  if (!networkMonitor.isOnline) {
    // Optimistisch in UI anzeigen
    addOptimisticMessage({ clientId, content, status: 'pending' });

    // In Queue einreihen
    await writeQueue.enqueue({
      method: 'POST',
      url: `/chat/rooms/${room.id}/messages`,
      body: { ...formData, client_id: clientId },
      maxRetries: 5,
      metadata: { type: 'chat_message', displayText: `Nachricht an ${room.name}` }
    });
    return;
  }

  // Online: direkt senden (wie bisher)
  await api.post(`/chat/rooms/${room.id}/messages`, { ...formData, client_id: clientId });
};
```

---

## Backend-Aenderungen

### Neue Endpoints

#### `GET /sync/changes?since=timestamp`

```javascript
// Gibt alle Aenderungen seit dem Timestamp zurueck
// Gruppiert nach Typ, damit Frontend weiss welche Caches zu invalidieren
router.get('/sync/changes', verifyTokenRBAC, async (req, res) => {
  const since = new Date(parseInt(req.query.since));
  const userId = req.user.id;
  const orgId = req.user.organization_id;

  const changes = {
    dashboard: await hasDashboardChanges(userId, since),
    events: await hasEventChanges(orgId, since),
    badges: await hasBadgeChanges(userId, since),
    chat: await hasChatChanges(userId, since),
    // ... weitere Typen
  };

  res.json({ changes, serverTime: Date.now() });
});
```

**Warum kein kompletter Delta-Sync:** Zu komplex fuer den Nutzen. Die App hat ~100 aktive Nutzer. Ein einfacher "hat sich etwas geaendert?"-Check reicht, um betroffene Caches zu invalidieren. Die Pages laden dann bei Bedarf die vollen Daten.

#### Chat-Deduplizierung

```javascript
// In chat.js POST /rooms/:id/messages:
// NEU: client_id Pruefung
if (req.body.client_id) {
  const existing = await pool.query(
    'SELECT id FROM chat_messages WHERE client_id = $1',
    [req.body.client_id]
  );
  if (existing.rows.length > 0) {
    return res.json(existing.rows[0]); // Idempotent: gleiche Nachricht zurueckgeben
  }
}
```

### DB-Aenderung

```sql
-- chat_messages: client_id fuer Deduplizierung
ALTER TABLE chat_messages ADD COLUMN client_id UUID;
CREATE UNIQUE INDEX idx_chat_messages_client_id ON chat_messages(client_id) WHERE client_id IS NOT NULL;

-- updated_at Trigger auf relevanten Tabellen (falls noch nicht vorhanden)
-- Wird fuer /sync/changes benoetigt
```

---

## Datenfluss: Stale-While-Revalidate

```
User oeffnet KonfiDashboardPage
       |
       v
useOfflineQuery('konfi:dashboard:42', fetcher)
       |
       +-- 1. OfflineCache.get('konfi:dashboard:42')
       |       |
       |       +-- Cache HIT, TTL nicht abgelaufen
       |       |     -> data = cachedData, loading = false, isStale = false
       |       |     -> FERTIG (kein Netzwerk-Request)
       |       |
       |       +-- Cache HIT, TTL abgelaufen
       |       |     -> data = cachedData, loading = false, isStale = true
       |       |     -> Weiter zu Schritt 2 (Revalidierung im Hintergrund)
       |       |
       |       +-- Cache MISS
       |             -> data = null, loading = true
       |             -> Weiter zu Schritt 2
       |
       +-- 2. NetworkMonitor.isOnline?
               |
               +-- JA: fetcher() aufrufen
               |     |
               |     +-- Erfolg: data = freshData, Cache aktualisieren
               |     +-- Fehler: Cache-Daten behalten, error setzen
               |
               +-- NEIN: Nichts tun (Cache-Daten bleiben)
                         isOffline = true
```

---

## Sync-Ausloeser

| Trigger | Aktion |
|---------|--------|
| App-Start (mit User) | SyncManager.syncOnResume() |
| App wird aktiv (appStateChange isActive) | SyncManager.syncOnResume() |
| WebSocket reconnect | SyncManager.syncOnReconnect() |
| Periodisch (alle 5 Min) | SyncManager.syncPeriodic() |
| Manuell (Pull-to-Refresh) | useOfflineQuery.refresh() |
| Netzwerk-Status: offline -> online | WriteQueue.flush() + Cache-Invalidierung |

---

## Komponentengrenzen

| Komponente | Verantwortung | Kommuniziert mit |
|-----------|---------------|-------------------|
| OfflineCache | Lese-Cache Verwaltung (get/set/invalidate) | useOfflineQuery, SyncManager |
| WriteQueue | Schreib-Queue Verwaltung (enqueue/flush) | SyncManager, ChatRoom, RequestsPage |
| NetworkMonitor | Netzwerkstatus erkennen und melden | Alle (via subscribe) |
| SyncManager | Orchestriert Sync-Ablauf bei Statuswechsel | WriteQueue, OfflineCache, AppContext |
| useOfflineQuery | Hook fuer Pages: Cache-First Datenladen | OfflineCache, NetworkMonitor, api.ts |
| OfflineBanner | UI: Offline/Syncing Status anzeigen | NetworkMonitor, SyncManager |

**Keine neuen Contexts noetig.** NetworkMonitor und SyncManager sind Singleton-Services (wie api.ts und websocket.ts). Der einzige State, der in die React-Welt muss (`isOnline`), geht in den bestehenden AppContext.

---

## Empfohlene Build-Reihenfolge

Die Reihenfolge folgt den Abhaengigkeiten -- jede Phase baut auf der vorherigen auf.

### Phase 1: Fundament (NetworkMonitor + OfflineCache + OfflineBanner)
- `@capacitor/network` und `@capacitor/preferences` installieren
- `networkMonitor.ts` implementieren
- `offlineCache.ts` implementieren (Capacitor Preferences Storage)
- `isOnline` in AppContext integrieren
- `OfflineBanner.tsx` in App-Shell einbauen
- **Testbar:** Banner erscheint bei Flugmodus, Cache liest/schreibt

### Phase 2: useOfflineQuery Hook + erste Page-Migration
- `useOfflineQuery.ts` implementieren
- KonfiDashboardPage migrieren (Referenz-Migration)
- KonfiEventsPage migrieren
- KonfiBadgesPage migrieren
- **Testbar:** Pages zeigen Cache-Daten bei Offline, Stale-Indicator

### Phase 3: Alle Pages migrieren
- Restliche ~22 Pages systematisch migrieren
- BadgeContext auf Cache-Fallback umstellen
- **Testbar:** Komplette App nutzbar bei kurzem Offline

### Phase 4: Retry-Logik + Double-Submit-Schutz
- Exponential Backoff in api.ts Response-Interceptor
- Loading-States und Button-Disable auf allen Submit-Buttons
- **Testbar:** Flaky-Netzwerk simulieren, keine doppelten Submits

### Phase 5: WriteQueue + Chat-Offline
- `writeQueue.ts` implementieren
- ChatRoom.tsx fuer Offline-Nachrichten anpassen
- Backend: client_id auf chat_messages, Deduplizierung
- **Testbar:** Chat-Nachricht offline senden, nach Reconnect zugestellt

### Phase 6: SyncManager + Inkrementeller Sync
- `syncManager.ts` implementieren
- Backend: GET /sync/changes Endpoint
- Integration in AppContext Lifecycle (appStateChange)
- WebSocket reconnect -> Sync
- Periodischer Sync
- **Testbar:** App im Hintergrund, dann oeffnen -> Daten aktuell

---

## Anti-Patterns zu vermeiden

### Anti-Pattern 1: IndexedDB als Cache
**Was:** IndexedDB fuer den Cache verwenden statt Capacitor Preferences.
**Warum schlecht:** Auf iOS/WKWebView gibt es bekannte Probleme mit IndexedDB-Persistenz (Daten koennen bei Speicherdruck geloescht werden). Capacitor Preferences nutzt natives UserDefaults, das zuverlaessiger persistiert.
**Stattdessen:** Capacitor Preferences fuer alles unter ~1MB pro Key. Falls groessere Daten noetig: Capacitor Filesystem.

### Anti-Pattern 2: Globaler State-Store (Redux/Zustand) als Cache
**Was:** Einen State-Manager als Cache-Layer einfuehren.
**Warum schlecht:** Overkill fuer diesen Use-Case. Die App hat ~30 Pages mit einfachen GET-Requests. Ein Hook + Service reicht. State-Manager wuerde die gesamte Architektur aendern.
**Stattdessen:** useOfflineQuery Hook mit Service-Singletons.

### Anti-Pattern 3: Full Offline-First mit CRDT/Conflict Resolution
**Was:** Bidirektionaler Sync mit Konfliktloesung wie bei lokalen Datenbanken (PouchDB/CouchDB).
**Warum schlecht:** Massiver Aufwand, die App hat <100 Nutzer und kaum gleichzeitige Schreibkonflikte. Chat-Nachrichten und Antraege sind append-only, kein Merge noetig.
**Stattdessen:** Last-Write-Wins fuer die wenigen Offline-Writes, Client-ID-Deduplizierung.

### Anti-Pattern 4: Service Worker fuer API-Caching
**Was:** Service Worker mit Workbox fuer automatisches API-Response-Caching.
**Warum schlecht:** Dies ist eine native Capacitor-App, kein PWA. Service Worker laufen nicht zuverlaessig in WKWebView. Ausserdem hat man weniger Kontrolle ueber Cache-Invalidierung.
**Stattdessen:** App-Level Caching in TypeScript mit voller Kontrolle.

---

## Kapazitaets-Abschaetzung

| Datentyp | Geschaetzte Groesse | Pro User |
|----------|---------------------|----------|
| Dashboard | ~5 KB | 1x |
| Events (alle) | ~20 KB | 1x |
| Badges | ~10 KB | 1x |
| Chat-Rooms | ~3 KB | 1x |
| Chat-Messages (letzte 50 pro Room) | ~15 KB | pro Room |
| Profil | ~2 KB | 1x |
| Admin-Listen | ~30 KB | 1x |

**Gesamt pro User:** ~100-200 KB. Capacitor Preferences kann problemlos mehrere MB halten. Kein Kapazitaetsproblem.

---

## Risiken und Mitigationen

| Risiko | Wahrscheinlichkeit | Mitigation |
|--------|---------------------|------------|
| Capacitor Preferences zu langsam fuer grosse Payloads | Niedrig | Benchmark bei 200KB, Fallback auf Filesystem |
| Chat-Nachrichten gehen verloren bei App-Kill waehrend offline | Mittel | WriteQueue persistiert sofort bei enqueue() |
| Race Condition: Sync + manueller Refresh gleichzeitig | Mittel | Mutex/Lock im SyncManager |
| Stale Daten verwirren User | Mittel | isStale-Indicator in UI, klare Kommunikation |
| Cache waechst unbegrenzt | Niedrig | TTL + periodisches Cleanup alter Eintraege |

---

## Quellen

- Capacitor Preferences Plugin Dokumentation (offiziell, v7)
- Capacitor Network Plugin Dokumentation (offiziell, v7)
- Bestehender Codebase: api.ts, websocket.ts, AppContext.tsx, BadgeContext.tsx, LiveUpdateContext.tsx
- Bestehende Pages: KonfiDashboardPage.tsx, KonfiEventsPage.tsx (Datenladen-Pattern)
- Stale-While-Revalidate Pattern (HTTP RFC 5861, SWR/React-Query Konzepte)

**Konfidenz:** HIGH -- basiert auf direkter Codebase-Analyse und bekannten Capacitor-APIs.
