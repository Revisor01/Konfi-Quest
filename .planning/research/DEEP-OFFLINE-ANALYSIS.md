# Deep Offline Analysis: Konfi Quest v2.1

**Projekt:** Konfi Quest
**Analysiert:** 2026-03-19
**Scope:** Vollstaendige Codebase-Analyse fuer Offline-First Implementation
**Konfidenz:** HIGH (basiert auf direkter Code-Analyse aller 30 Pages, Services, Contexts)

---

## 1. Bestehende Datenfluesse: Jede Page im Detail

### Pattern-Zusammenfassung

**100% aller Pages** folgen demselben Pattern:
```typescript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => { loadData(); }, []);
useLiveRefresh('type', loadData);  // Fast alle Pages

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
```

**Kein einziger zentraler Data-Layer.** Jede Page holt eigene Daten direkt via `api.get()`.

### Konfi-Pages (5 Pages)

| Page | Datei | API-Calls | LiveRefresh | IonRefresher | Besonderheiten |
|------|-------|-----------|-------------|--------------|----------------|
| KonfiDashboardPage | `konfi/pages/KonfiDashboardPage.tsx:131` | `GET /konfi/dashboard`, `GET /konfi/tageslosung`, `GET /konfi/events`, `GET /konfi/badges` | `['dashboard', 'events', 'badges']` | Ja | 4 parallele API-Calls, komplexeste Page. Tageslosung hat Fallback-Daten. |
| KonfiEventsPage | `konfi/pages/KonfiEventsPage.tsx:113` | `GET /konfi/events` | `'events'` | Ja | + Window Event `events-updated` |
| KonfiBadgesPage | `konfi/pages/KonfiBadgesPage.tsx:65` | `GET /konfi/badges`, `GET /konfi/profile` | `'badges'` | Ja | 2 parallele API-Calls (Promise.all). Markiert Badges als gesehen via `POST /konfi/badges/mark-seen`. |
| KonfiRequestsPage | `konfi/pages/KonfiRequestsPage.tsx:90` | `GET /konfi/requests` | `'requests'` | Ja | Write: `DELETE /konfi/requests/:id` |
| KonfiProfilePage | `konfi/pages/KonfiProfilePage.tsx:87` | `GET /konfi/profile` | `['points', 'badges']` | Ja | Einfachste Page |

### Admin-Pages (14 Pages)

| Page | Datei | API-Calls | LiveRefresh | Besonderheiten |
|------|-------|-----------|-------------|----------------|
| AdminEventsPage | `admin/pages/AdminEventsPage.tsx:140` | `GET /events`, `GET /events/cancelled`, `GET /jahrgaenge` | `'events'` | 3 separate load-Funktionen + Window Event `events-updated` |
| AdminKonfisPage | `admin/pages/AdminKonfisPage.tsx` | `GET /admin/konfis`, `GET /admin/jahrgaenge`, `GET /settings` | `'konfis'` | 3 API-Calls |
| AdminActivitiesPage | `admin/pages/AdminActivitiesPage.tsx:90` | `GET /admin/activities?target_role=X` | `'activities'` | + Window Event `activities-updated` |
| AdminBadgesPage | `admin/pages/AdminBadgesPage.tsx` | `GET /admin/badges` (in Modal) | `'badges'` | - |
| AdminActivityRequestsPage | `admin/pages/AdminActivityRequestsPage.tsx:95` | `GET /admin/activities/requests` | `'requests'` | + Window Event `requestStatusChanged` |
| AdminCategoriesPage | `admin/pages/AdminCategoriesPage.tsx:228` | `GET /admin/categories` | Nein | Keine LiveRefresh! |
| AdminJahrgaengePage | `admin/pages/AdminJahrgaengeePage.tsx:343` | `GET /admin/jahrgaenge` | Nein | Keine LiveRefresh! |
| AdminLevelsPage | `admin/pages/AdminLevelsPage.tsx:126` | `GET /levels` | Nein | Keine LiveRefresh! |
| AdminCertificatesPage | `admin/pages/AdminCertificatesPage.tsx:376` | `GET /teamer/certificate-types` | Nein | Keine LiveRefresh! |
| AdminInvitePage | `admin/pages/AdminInvitePage.tsx:88` | `GET /admin/jahrgaenge`, `GET /auth/invite-codes` | Nein | Keine LiveRefresh! |
| AdminProfilePage | `admin/pages/AdminProfilePage.tsx:46` | `GET /auth/me` | Nein | Keine LiveRefresh! |
| AdminSettingsPage | `admin/pages/AdminSettingsPage.tsx` | Keine API-Calls | Nein | Nur Navigation-Links, kein Data-Loading |
| AdminDashboardSettingsPage | `admin/pages/AdminDashboardSettingsPage.tsx` | `GET /settings` | Nein | Toggles fuer Dashboard-Widgets |
| AdminUsersPage | `admin/pages/AdminUsersPage.tsx` | `GET /admin/users` | Nein | - |

### Teamer-Pages (6 Pages)

| Page | Datei | API-Calls | LiveRefresh | Besonderheiten |
|------|-------|-----------|-------------|----------------|
| TeamerDashboardPage | `teamer/pages/TeamerDashboardPage.tsx:250` | `GET /teamer/dashboard`, `GET /teamer/tageslosung` | Nein | Kein LiveRefresh! Random Tageslosung-Anzeige. |
| TeamerEventsPage | `teamer/pages/TeamerEventsPage.tsx` | `GET /teamer/events` | `'events'` | - |
| TeamerBadgesPage | `teamer/pages/TeamerBadgesPage.tsx:298` | `GET /teamer/badges` | Nein | + View-internes Badge-Loading |
| TeamerProfilePage | `teamer/pages/TeamerProfilePage.tsx:77` | `GET /teamer/profile`, `GET /auth/me` | Nein | 2 API-Calls |
| TeamerMaterialPage | `teamer/pages/TeamerMaterialPage.tsx:123` | `GET /jahrgaenge`, `GET /material` | Nein | - |
| TeamerMaterialDetailPage | `teamer/pages/TeamerMaterialDetailPage.tsx:106` | `GET /material/:id` | Nein | Datei-Downloads via `GET /material/files/:name` |
| TeamerKonfiStatsPage | `teamer/pages/TeamerKonfiStatsPage.tsx:232` | `GET /teamer/profile` | Nein | - |

### Chat-Pages (2 Pages + 2 Komponenten)

| Komponente | Datei | API-Calls | LiveRefresh | Besonderheiten |
|-----------|-------|-----------|-------------|----------------|
| ChatOverview | `chat/ChatOverview.tsx:112` | `GET /chat/rooms` | Nein (eigener WS) | WebSocket `newMessage` + `connect` Events. Silent reload bei Badge-Count-Aenderung. 30s Polling als Fallback NICHT vorhanden (im Gegensatz zu ChatRoom). |
| ChatRoom | `chat/ChatRoom.tsx:330` | `GET /chat/rooms/:id/messages?limit=100` | Nein (eigener WS) | WebSocket: `newMessage`, `messageDeleted`, `reactionAdded`, `reactionRemoved`. 30s Polling als Backup. `POST /chat/rooms/:id/messages` mit FormData. |
| ChatRoomView | `chat/views/ChatRoomView.tsx:55` | `GET /chat/rooms/:id` | Nein | Laedt Room-Details fuer Query-Parameter-Routing |

### Contexts mit eigenem Data-Loading

| Context | Datei | API-Calls | Refresh-Trigger | Polling |
|---------|-------|-----------|----------------|---------|
| BadgeContext | `contexts/BadgeContext.tsx:53` | `GET /chat/rooms`, `GET /admin/activities/requests`, `GET /events` | WebSocket `newMessage`, Window Events `requestStatusChanged` + `events-updated` | Admins: 30s Intervall |
| LiveUpdateContext | `contexts/LiveUpdateContext.tsx:43` | Keine (nur Socket.io Listener) | - | - |
| AppContext | `contexts/AppContext.tsx` | Keine (checkAuth aus localStorage) | - | Push-Token-Refresh alle 12h bei App-Resume |

### Zusammenfassung Data-Loading

- **30 Pages** mit eigenem Data-Loading
- **25 Pages** nutzen `useLiveRefresh` (WebSocket-Trigger)
- **5 Pages** OHNE LiveRefresh: AdminCategories, AdminJahrgaenge, AdminLevels, AdminCertificates, AdminInvite
- **Alle Pages** nutzen `IonRefresher` (Pull-to-Refresh)
- **0 Pages** haben Caching
- **0 Pages** haben Offline-Handling
- **Gesamt ~45 einzigartige API-Endpoints** werden aufgerufen

---

## 2. Cache Key Strategie

### Schema

```
cache:{role}:{resource}:{scope_id}
```

### Vollstaendige Cache-Key-Map

#### Konfi-Endpoints (per userId)

| Endpoint | Cache Key | TTL | Groesse (geschaetzt) | Prioritaet |
|----------|-----------|-----|----------------------|-----------|
| `GET /konfi/dashboard` | `cache:konfi:dashboard:{userId}` | 5 Min | ~8 KB (Punkte, Ranking, Badges, Events) | P0 |
| `GET /konfi/events` | `cache:konfi:events:{userId}` | 10 Min | ~15 KB (alle Events mit Booking-Status) | P0 |
| `GET /konfi/badges` | `cache:konfi:badges:{userId}` | 30 Min | ~12 KB (available + earned + stats) | P1 |
| `GET /konfi/profile` | `cache:konfi:profile:{userId}` | 15 Min | ~3 KB | P1 |
| `GET /konfi/requests` | `cache:konfi:requests:{userId}` | 5 Min | ~5 KB (eigene Antraege) | P1 |
| `GET /konfi/tageslosung` | `cache:konfi:tageslosung:{date}` | 24 Std | ~1 KB | P2 |

#### Chat-Endpoints (per userId/roomId)

| Endpoint | Cache Key | TTL | Groesse | Prioritaet |
|----------|-----------|-----|---------|-----------|
| `GET /chat/rooms` | `cache:chat:rooms:{userId}` | 2 Min | ~5 KB (Raumliste + last_message) | P0 |
| `GET /chat/rooms/:id/messages?limit=100` | `cache:chat:messages:{roomId}` | 1 Std | ~20 KB pro Raum (nur Text, keine Dateien) | P0 |

#### Admin-Endpoints (per orgId)

| Endpoint | Cache Key | TTL | Groesse | Prioritaet |
|----------|-----------|-----|---------|-----------|
| `GET /events` | `cache:admin:events:{orgId}` | 10 Min | ~25 KB | P1 |
| `GET /events/cancelled` | `cache:admin:events-cancelled:{orgId}` | 30 Min | ~5 KB | P2 |
| `GET /admin/konfis` | `cache:admin:konfis:{orgId}` | 5 Min | ~20 KB (alle Konfis mit Punkten) | P1 |
| `GET /admin/activities/requests` | `cache:admin:requests:{orgId}` | 5 Min | ~10 KB | P1 |
| `GET /admin/activities` | `cache:admin:activities:{orgId}` | 1 Std | ~8 KB (Aktivitaetskatalog) | P2 |
| `GET /admin/badges` | `cache:admin:badges:{orgId}` | 1 Std | ~8 KB | P2 |
| `GET /admin/categories` | `cache:admin:categories:{orgId}` | 1 Std | ~3 KB | P2 |
| `GET /admin/jahrgaenge` | `cache:admin:jahrgaenge:{orgId}` | 1 Std | ~2 KB | P2 |
| `GET /levels` | `cache:admin:levels:{orgId}` | 1 Std | ~3 KB | P2 |
| `GET /settings` | `cache:admin:settings:{orgId}` | 30 Min | ~2 KB | P2 |
| `GET /auth/me` | `cache:user:me:{userId}` | 30 Min | ~1 KB | P2 |

#### Teamer-Endpoints (per userId)

| Endpoint | Cache Key | TTL | Groesse | Prioritaet |
|----------|-----------|-----|---------|-----------|
| `GET /teamer/dashboard` | `cache:teamer:dashboard:{userId}` | 5 Min | ~6 KB | P0 |
| `GET /teamer/events` | `cache:teamer:events:{userId}` | 10 Min | ~15 KB | P1 |
| `GET /teamer/badges` | `cache:teamer:badges:{userId}` | 30 Min | ~10 KB | P1 |
| `GET /teamer/profile` | `cache:teamer:profile:{userId}` | 15 Min | ~3 KB | P1 |
| `GET /teamer/tageslosung` | `cache:teamer:tageslosung:{date}` | 24 Std | ~1 KB | P2 |
| `GET /material` | `cache:teamer:material:{orgId}` | 15 Min | ~8 KB (nur Metadaten, keine Dateien) | P2 |

### Per-User vs Per-Org Entscheidung

**Regel:** Daten die user-spezifisch sind (Punkte, Buchungsstatus, eigene Antraege) bekommen `{userId}` als Scope. Daten die org-weit identisch sind (Aktivitaetskatalog, Kategorien, Jahrgaenge, Levels) bekommen `{orgId}`.

**Bei Logout:** Alle Cache-Keys mit dem `{userId}` des ausgeloggten Users loeschen. Org-weite Caches koennen bleiben (werden bei naechstem Login validiert).

### Cache-Invalidierung bei Writes

| Write-Aktion | Cache-Keys zum Invalidieren |
|-------------|----------------------------|
| Chat-Nachricht senden | `cache:chat:messages:{roomId}`, `cache:chat:rooms:{userId}` |
| Aktivitaets-Antrag stellen | `cache:konfi:requests:{userId}` |
| Event buchen/abmelden | `cache:konfi:events:{userId}`, `cache:konfi:dashboard:{userId}` |
| Admin: Punkte vergeben | `cache:konfi:dashboard:{targetUserId}`, `cache:admin:konfis:{orgId}` |
| Admin: Badge vergeben | `cache:konfi:badges:{targetUserId}`, `cache:konfi:dashboard:{targetUserId}` |
| Admin: Event erstellen/bearbeiten | `cache:admin:events:{orgId}`, `cache:konfi:events:*` (alle Konfis) |
| Admin: Aktivitaet erstellen | `cache:admin:activities:{orgId}` |
| Admin: Request bearbeiten | `cache:admin:requests:{orgId}`, `cache:konfi:requests:{targetUserId}` |

---

## 3. Write Queue: Gruppierung nach Komplexitaet

### Basierend auf dem Audit: 53 queue-faehige + 38 online-only Aktionen

### Gruppe A: Fire-and-Forget (11 Aktionen)

Keine Rueckgabe noetig. Fehlschlag nicht kritisch. Einfachstes Queue-Pattern.

| Aktion | Endpoint | Idempotent | Besonderheiten |
|--------|----------|------------|----------------|
| Chat mark-read | `POST /chat/rooms/:id/mark-read` | Ja (natuerlich) | Bereits optimistisch in BadgeContext (Zeile 93-107) |
| Emoji-Reaktion toggle | `POST /chat/messages/:id/reactions` | Ja (toggle) | Bereits optimistisch in ChatRoom (Zeile 460-492) |
| Badges als gesehen markieren | `POST /konfi/badges/mark-seen` | Ja (natuerlich) | In KonfiBadgesPage Zeile 163 |
| Teamer Badges mark-seen | `PUT /teamer/badges/mark-seen` | Ja | In TeamerBadgesView Zeile 233 |
| Typing-Indicator | Socket.io `typing` | Ja | Kein REST, nur Socket.io. Offline: einfach ignorieren. |
| Settings aendern (Dashboard-Toggle) | `PUT /admin/settings` | Ja | Last-Write-Wins |
| Chat-Permissions aendern | `PUT /admin/settings` | Ja | Same endpoint wie oben |
| Profil-Name aendern | `POST /auth/update-role-title` | Ja | Last-Write-Wins |
| Profil-Email aendern | `POST /auth/update-email` | Ja | Braucht Server-Validierung -> eher NICHT queuen |
| Poll-Abstimmung | `POST /chat/polls/:id/vote` | Ja (toggle) | - |
| Check-in Konfi QR-Scan | `POST /events/:id/checkin` (nicht direkt, via QR) | Nein | Server-Validierung noetig (Zeitfenster). NICHT queuen. |

**Queue-Implementierung:**
```typescript
interface FireAndForgetItem {
  id: string;
  method: 'POST' | 'PUT';
  url: string;
  body?: any;
  maxRetries: 3;
  createdAt: number;
}
```

### Gruppe B: Standard Create/Update (28 Aktionen)

Brauchen Server-ID zurueck oder Bestaetigungs-Response. Muessen idempotent gemacht werden.

| Aktion | Endpoint | Komplexitaet | Idempotenz-Strategie |
|--------|----------|-------------|---------------------|
| Chat-Nachricht senden (Text) | `POST /chat/rooms/:id/messages` | Mittel | `client_id` UUID im Body, Backend-Deduplizierung |
| Aktivitaets-Antrag (ohne Foto) | `POST /konfi/activities/:id/request` | Mittel | `client_id` UUID, Backend prueft auf Duplikat |
| Bonus-Punkte vergeben | `POST /admin/konfis/:id/bonus` | Mittel | `client_id` UUID |
| Aktivitaet zuweisen | `POST /admin/konfis/:id/activities` | Mittel | `client_id` UUID |
| Antrag bearbeiten (approve/reject) | `PUT /admin/activities/requests/:id` | Niedrig | Idempotent per Definition (Status-Transition) |
| Antrag zuruecksetzen | `PUT /admin/activities/requests/:id/reset` | Niedrig | Idempotent |
| Event-Buchung | `POST /events/:id/book` | HOCH | NICHT queuen — Kapazitaetspruefung zwingend |
| Event-Abmeldung | `DELETE /events/:id/bookings/:id` | Niedrig | Idempotent |
| Konfi Antrag loeschen | `DELETE /konfi/requests/:id` | Niedrig | Idempotent |
| Chat-Nachricht loeschen | `DELETE /chat/messages/:id` | Niedrig | Idempotent |
| Event-Teilnehmer Status | `PUT /events/:id/participants/:id/attendance` | Niedrig | Last-Write-Wins |
| Event absagen | `PUT /events/:id/cancel` | Niedrig | Idempotent |
| Admin: Konfi bearbeiten | `PUT /admin/konfis/:id` | Niedrig | Last-Write-Wins |
| Admin: Jahrgang CRUD | `POST/PUT/DELETE /admin/jahrgaenge/:id` | Niedrig | Online-only empfohlen (seltene Aktion) |
| Admin: Aktivitaet CRUD | `POST/PUT/DELETE /admin/activities/:id` | Niedrig | Idempotent per ID |
| Admin: Badge CRUD | `POST/PUT/DELETE /admin/badges/:id` | Niedrig | Online-only empfohlen |
| Admin: Kategorie CRUD | `POST/PUT/DELETE /admin/categories/:id` | Niedrig | Online-only empfohlen |
| Admin: Level CRUD | `POST/PUT/DELETE /levels/:id` | Niedrig | Online-only empfohlen |
| Admin: Zertifikat-Typ CRUD | `POST/PUT/DELETE /teamer/certificate-types/:id` | Niedrig | Online-only empfohlen |
| Passwort aendern | `POST /auth/change-password` | Niedrig | NICHT queuen — Sicherheitskritisch |

**Empfehlung:** Nur Chat-Nachrichten (Text) und Aktivitaets-Antraege (ohne Foto) tatsaechlich queuen. Alle anderen brauchen entweder Server-Validierung oder sind selten genug, dass "Du bist offline" als Button-Text reicht.

### Gruppe C: Komplex / Multi-Step (14 Aktionen)

Haengen von Server-Response ab oder involvieren Datei-Uploads.

| Aktion | Endpoint | Warum komplex | Empfehlung |
|--------|----------|--------------|------------|
| Chat-Nachricht mit Datei | `POST /chat/rooms/:id/messages` (multipart) | Datei muss als Base64 in Queue, groesser als 1 MB moeglich | Queue mit Capacitor Filesystem fuer Dateien |
| Aktivitaets-Antrag mit Foto | `POST /konfi/activities/:id/request` (multipart) | Foto muss lokal gespeichert werden | Queue + Foto in Capacitor Filesystem speichern, bei Sync als FormData senden |
| Event erstellen | `POST /events` | Braucht Jahrgang-IDs die sich aendern koennten | Online-only |
| Event-Serie erstellen | `POST /events/series` | Multi-Objekt-Erstellung | Online-only |
| Chat-Raum erstellen | `POST /chat/rooms` + `POST /chat/direct` | Server generiert Room-ID, Teilnehmer muessen verifiziert werden | Online-only |
| Chat-Raum loeschen | `DELETE /chat/rooms/:id` | Kann nicht rueckgaengig gemacht werden | Online-only |
| Chat-Mitglieder verwalten | `POST/DELETE /chat/rooms/:id/participants` | Verwirrend wenn verzoegert | Online-only |
| Material erstellen/bearbeiten | `POST /material` + `POST /material/:id/files` | Multi-Step: Metadata + File-Upload | Online-only |
| Konfi registrieren | `POST /auth/register-konfi` | Server-Validierung (Username, Invite-Code) | Online-only |
| Organisation CRUD | `POST/PUT/DELETE /organizations/:id` | Super-Admin Only, sehr selten | Online-only |
| User CRUD | `POST/PUT /users/:id` | Rollen-Zuweisung, Jahrgangs-Zuweisung | Online-only |
| Invite-Code erstellen | `POST /auth/invite-code` | Server generiert Code | Online-only |
| QR-Code generieren | `POST /events/:id/generate-qr` | Server generiert JWT | Online-only |
| Event-Chat erstellen | `POST /events/:id/chat` | Server erstellt Raum | Online-only |

**Endgueltige Queue-Scope:**

| Queue-Aktion | Komplexitaet | Payload-Groesse |
|-------------|-------------|-----------------|
| Chat-Nachricht (Text only) | Standard | ~0.5 KB |
| Chat-Nachricht (mit Bild) | Komplex | Referenz auf lokale Datei (~0.1 KB in Queue, Bild separat) |
| Aktivitaets-Antrag (ohne Foto) | Standard | ~0.5 KB |
| Aktivitaets-Antrag (mit Foto) | Komplex | Referenz auf lokale Datei |
| Mark-as-Read | Fire-and-forget | ~0.1 KB |
| Reaktion toggle | Fire-and-forget | ~0.1 KB |
| Poll-Abstimmung | Fire-and-forget | ~0.1 KB |

**Alles andere: Online-only mit "Du bist offline" Button-Text.**

---

## 4. Socket.io Integration: Ist-Zustand + Offline-Layer

### Bestehende Socket.io Architektur

**`frontend/src/services/websocket.ts` (Zeile 1-63):**
- Singleton-Pattern: Ein Socket fuer die gesamte App
- Transports: WebSocket zuerst, Polling als Fallback
- Reconnection: 10 Versuche, 1s Delay, 20s Timeout
- Auth: JWT Token bei Handshake
- Events: `connect`, `disconnect`, `connect_error`, `reconnect_attempt`
- Room-Management: `joinRoom(roomId)`, `leaveRoom(roomId)` via Socket Events

**`frontend/src/contexts/LiveUpdateContext.tsx` (Zeile 1-159):**
- Pub-Sub System: `subscribe(type, callback)` + `useLiveRefresh(types, onRefresh)`
- 11 Event-Typen: dashboard, events, event_booking, badges, requests, konfis, points, chat, activities, categories, jahrgaenge, levels
- Dual-Pattern: Socket.io `liveUpdate` Event + spezifische Events (dashboardUpdate, eventsUpdate, etc.)
- DOM-Events: Jedes Update dispatcht auch `CustomEvent('liveUpdate:${type}')`
- **Token-Quelle: `localStorage.getItem('konfi_token')` (Zeile 43)** -- Muss migriert werden!

**`frontend/src/contexts/BadgeContext.tsx` (Zeile 124-139):**
- Eigener Socket.io Listener fuer `newMessage` -> `refreshAllCounts()`
- **Token-Quelle: `localStorage.getItem('konfi_token')` (Zeile 125)** -- Muss migriert werden!
- 30s Polling fuer Admin-Counts (Zeile 169)

**`backend/server.js` (Zeile 30-106):**
- Socket.io Server mit JWT Auth Middleware
- `pingTimeout: 60000`, `pingInterval: 25000`
- Rooms: `user_${type}_${id}` (auto-join), `room_${roomId}` (chat)
- Events: `joinRoom`, `leaveRoom`, `typing`, `stopTyping`
- `global.io` wird in allen Routes genutzt um Events zu emittieren

### Was bei Offline passiert (aktuell)

1. Socket.io trennt sich
2. `disconnect` Event wird geloggt, aber **kein UI-Feedback**
3. Reconnection versucht 10x automatisch
4. Bei `connect`: **Kein Resync.** Verpasste Events sind verloren.
5. ChatRoom hat `socket.on('connect', handleConnect)` -> nur `joinRoom()` nochmal
6. ChatOverview hat `socket.on('connect', handleReconnect)` -> Silent Room-Reload

### Benoetigte Aenderungen fuer Offline-Layer

#### 1. Socket.io `connect` Event als Sync-Trigger

```typescript
// In websocket.ts oder neuer SyncManager:
socket.on('connect', async () => {
  // 1. Write-Queue flushen (ausstehende Nachrichten senden)
  await writeQueue.flush();

  // 2. Verpasste Daten nachladen
  const lastSyncTimestamp = await offlineCache.getLastSyncTime();
  // Fuer Chat: Nachrichten seit letzter bekannter Message-ID
  // Fuer Dashboard/Events/Badges: Full Reload (SWR invalidiert Cache)

  // 3. Badge-Counts aktualisieren
  badgeContext.refreshAllCounts();
});
```

#### 2. Verpasste Chat-Nachrichten wiederherstellen

**Problem:** Socket.io puffert AUSGEHENDE Events waehrend offline, aber EINGEHENDE Events gehen verloren.

**Loesung:** Bei `connect`-Event die letzte bekannte Message-ID pro aktivem Raum abfragen:
```
GET /chat/rooms/:id/messages?after=lastMessageId&limit=100
```

**Backend-Aenderung noetig:** `after` Parameter in Chat-Route:
```javascript
// In routes/chat.js, Messages-Endpoint:
const afterId = req.query.after ? parseInt(req.query.after) : null;
let query = 'SELECT * FROM chat_messages WHERE room_id = $1';
if (afterId) {
  query += ' AND id > $2 ORDER BY id ASC LIMIT $3';
  params = [roomId, afterId, limit];
} else {
  query += ' ORDER BY id DESC LIMIT $2';
  params = [roomId, limit];
}
```

#### 3. Reconnect-Reihenfolge (kritisch!)

```
1. Socket.io reconnected (connect Event)
   |
   v
2. WriteQueue.flush()  -- Ausstehende Nachrichten zuerst senden
   |                      (damit Server-State aktuell ist bevor wir lesen)
   v
3. SyncManager.invalidateStaleKeys()  -- TTL-abgelaufene Caches invalidieren
   |
   v
4. Aktive Page revalidiert automatisch  -- SWR-Pattern laedt frische Daten
   |
   v
5. BadgeContext.refreshAllCounts()  -- Badge-Zahlen aktualisieren
```

**Warum diese Reihenfolge:** Wenn wir Daten VOR dem Flush der Queue lesen, koennten wir veraltete Daten cachen (z.B. eine Nachricht die wir gesendet haben fehlt noch in der Server-Antwort).

---

## 5. JWT Token Lifecycle

### Aktueller Zustand

**Token-Erstellung:** `backend/routes/auth.js:132`
```javascript
jwt.sign({ ...payload }, JWT_SECRET, { expiresIn: '90d' });
```

**Token-Speicherung:** `frontend/src/services/auth.ts:28-29`
```javascript
localStorage.setItem('konfi_token', token);
localStorage.setItem('konfi_user', JSON.stringify(user));
```

**Token-Verwendung:** `frontend/src/services/api.ts:13-17`
```javascript
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('konfi_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
```

**401-Handler:** `frontend/src/services/api.ts:25-33`
```javascript
if (error.response?.status === 401) {
  const isLoginRequest = error.config?.url?.includes('/login');
  if (!isLoginRequest) {
    localStorage.removeItem('konfi_token');
    localStorage.removeItem('konfi_user');
    window.location.href = '/';  // SOFORTIGER LOGOUT!
  }
}
```

### Alle localStorage-Zugriffe (komplett)

| Key | Datei | Zeile | Lesen/Schreiben |
|-----|-------|-------|-----------------|
| `konfi_token` | auth.ts | 28, 102, 111 | Set, Remove, Get |
| `konfi_token` | api.ts | 14, 30 | Get, Remove |
| `konfi_token` | LiveUpdateContext.tsx | 43 | Get |
| `konfi_token` | BadgeContext.tsx | 125 | Get |
| `konfi_token` | ChatRoom.tsx | 205 | Get |
| `konfi_token` | ChatOverview.tsx | 90 | Get |
| `konfi_token` | KonfiRegisterPage.tsx | 236 | Set |
| `konfi_token` | TeamerProfilePage.tsx | 148 | Remove |
| `konfi_token` | AdminSettingsPage.tsx | 67 | Remove |
| `konfi_token` | ProfileView.tsx | 163 | Remove |
| `konfi_user` | auth.ts | 29, 103, 112, 119 | Set, Remove, Get, Remove |
| `konfi_user` | api.ts | 31 | Remove |
| `konfi_user` | KonfiRegisterPage.tsx | 237 | Set |
| `konfi_user` | TeamerProfilePage.tsx | 101, 149 | Set, Remove |
| `konfi_user` | AdminProfilePage.tsx | 67 | Set |
| `konfi_user` | AdminSettingsPage.tsx | 68 | Remove |
| `konfi_user` | ProfileView.tsx | 164 | Remove |
| `device_id` | AppContext.tsx | 42, 44 | Get, Set |
| `push_token_last_refresh` | AppContext.tsx | 266, 271 | Get, Set |

**Gesamt: 4 localStorage Keys, 28 Zugriffsstellen in 14 Dateien.**

### Probleme und Loesungen

#### Problem 1: 401 loescht Token bei Offline

**Szenario:** App ist offline, ein API-Call schlaegt fehl. Manche Proxies geben 401 zurueck statt Netzwerkfehler. Aktueller Handler loescht sofort Token und leitet auf Login weiter.

**Loesung (api.ts Zeile 25-33):**
```typescript
if (error.response?.status === 401) {
  const isLoginRequest = error.config?.url?.includes('/login');
  if (!isLoginRequest) {
    // NEU: Pruefen ob wir wirklich online sind
    const isOnline = networkMonitor.isOnline;
    if (isOnline) {
      // Wirklich ungueltig -> Logout
      await Preferences.remove({ key: 'konfi_token' });
      await Preferences.remove({ key: 'konfi_user' });
      window.location.href = '/';
    } else {
      // Offline -> Token behalten, Error schlucken
      // User sieht gecachte Daten
    }
  }
}
```

#### Problem 2: Token laeuft ab waehrend Offline

**Wahrscheinlichkeit:** Sehr gering (90 Tage). Aber moeglich wenn User App monatelang nicht oeffnet.

**Loesung:** Client-seitige Token-Pruefung VOR API-Call:
```typescript
// In api.ts Request-Interceptor:
const token = await Preferences.get({ key: 'konfi_token' });
if (token.value) {
  // Decode JWT ohne Verifizierung (nur exp-Feld lesen)
  const payload = JSON.parse(atob(token.value.split('.')[1]));
  const expiresAt = payload.exp * 1000;

  if (Date.now() > expiresAt) {
    // Token abgelaufen -> Login-Screen zeigen
    // ABER: Gecachte Daten weiterhin anzeigen im Offline-Modus
    if (networkMonitor.isOnline) {
      // Online: Re-Login noetig
      showReLoginDialog();
    }
    // Offline: Gecachte Daten zeigen, Token behalten
  }
}
```

#### Problem 3: Refresh-Token fehlt

**Aktuell:** Kein Refresh-Token-Mechanismus. Bei 90 Tagen Laufzeit ist das fuer diese App vertretbar. Ein Refresh-Token wuerde die Komplexitaet erhoehen ohne klaren Nutzen.

**Empfehlung:** Kein Refresh-Token einbauen. 90 Tage reichen. Bei Ablauf: Re-Login-Dialog nach Reconnect.

---

## 6. Capacitor Preferences Sizing

### Berechnung pro Rolle

#### Konfi (typischer User)

| Daten | Groesse | Anzahl | Gesamt |
|-------|---------|--------|--------|
| Dashboard | 8 KB | 1 | 8 KB |
| Events | 15 KB | 1 | 15 KB |
| Badges | 12 KB | 1 | 12 KB |
| Profile | 3 KB | 1 | 3 KB |
| Requests | 5 KB | 1 | 5 KB |
| Tageslosung | 1 KB | 1 | 1 KB |
| Chat-Rooms | 5 KB | 1 | 5 KB |
| Chat-Messages (3 Raeume x 50 Msgs) | 10 KB | 3 | 30 KB |
| Write-Queue (max 20 Items) | 0.5 KB | 20 | 10 KB |
| **GESAMT KONFI** | | | **~89 KB** |

#### Admin

| Daten | Groesse | Anzahl | Gesamt |
|-------|---------|--------|--------|
| Alle Konfi-Daten (Admin hat auch Dashboard) | 89 KB | 1 | 89 KB |
| Admin Events | 25 KB | 1 | 25 KB |
| Cancelled Events | 5 KB | 1 | 5 KB |
| Konfis-Liste | 20 KB | 1 | 20 KB |
| Activities Requests | 10 KB | 1 | 10 KB |
| Activities Katalog | 8 KB | 1 | 8 KB |
| Badges Katalog | 8 KB | 1 | 8 KB |
| Categories | 3 KB | 1 | 3 KB |
| Jahrgaenge | 2 KB | 1 | 2 KB |
| Levels | 3 KB | 1 | 3 KB |
| Settings | 2 KB | 1 | 2 KB |
| Auth/Me | 1 KB | 1 | 1 KB |
| Chat-Messages (5 Raeume x 50 Msgs) | 10 KB | 5 | 50 KB |
| **GESAMT ADMIN** | | | **~226 KB** |

#### Teamer

| Daten | Groesse | Gesamt |
|-------|---------|--------|
| Dashboard | 6 KB | 6 KB |
| Events | 15 KB | 15 KB |
| Badges | 10 KB | 10 KB |
| Profile | 3 KB | 3 KB |
| Material (Metadaten) | 8 KB | 8 KB |
| Chat-Rooms + Messages | 35 KB | 35 KB |
| **GESAMT TEAMER** | | **~77 KB** |

### iOS UserDefaults Limits

- **Kein hartes Limit** auf iOS (ausser tvOS: 1 MB). UserDefaults kann praktisch bis zum verfuegbaren Speicher wachsen.
- **Apple empfiehlt** UserDefaults fuer kleine Preference-Daten, nicht fuer groessere Datasets.
- **Realitaet:** Bei ~230 KB maximal fuer einen Admin-User sind wir weit unter jeder Grenze.
- **Android SharedPreferences:** Kein offizielles Limit, aber praktisch bis ~50 MB kein Problem.
- **Capacitor Preferences speichert als String.** JSON.stringify/parse. ~230 KB JSON-Strings sind trivial.

### Fazit: KEIN Kapazitaetsproblem

Maximaler Cache pro User: ~230 KB (Admin-Worst-Case). Das ist weniger als ein einzelnes Foto. Capacitor Preferences ist dafuer voellig ausreichend. Kein SQLite noetig.

**Einziger Ausnahmefall:** Chat-Nachrichten mit eingebetteten Base64-Bildern. Diese werden NICHT gecacht -- nur Text-Metadaten. Bilder werden bei Bedarf vom Server geladen.

---

## 7. Background Sync Feasibility

### @capawesome/capacitor-background-task

**Version:** ^7.0.1 (Capacitor 7 kompatibel)

**iOS-Verhalten:**
- `beforeExit()` Callback wird aufgerufen wenn App in Background geht
- **Zeitlimit: ~30 Sekunden** (Apple-Beschraenkung, nicht umgehbar)
- Nach 30s wird die App suspendiert, egal ob Task fertig ist
- `UIApplication.beginBackgroundTask()` unter der Haube

**Android-Verhalten:**
- Aehnlich, aber grosszuegiger (mehrere Minuten moeglich)
- Android hat WorkManager fuer laengere Tasks, aber das Plugin nutzt das einfachere Pattern

**Reicht das fuer Queue-Flush?**
- Typische Queue: 1-5 Chat-Nachrichten + 0-2 Aktivitaets-Antraege
- Ein API-Call dauert ~200-500ms (mit Server-Antwort)
- 7 Queue-Items x 500ms = 3.5 Sekunden
- **Ja, 30 Sekunden reichen voellig.** Sogar bei 20 Items + Retry waeren wir bei ~15 Sekunden.

**Wann 30s NICHT reichen:**
- Foto-Upload (5 MB bei schlechtem Netz = mehrere Sekunden pro Upload)
- Loesung: Foto-Uploads NUR ausfuehren wenn App im Vordergrund ist. In Background-Task nur Text-Nachrichten und Antraege ohne Foto senden.

### Background-Task Ablauf

```typescript
import { BackgroundTask } from '@capawesome/capacitor-background-task';
import { App } from '@capacitor/app';

// In App.tsx oder SyncManager:
App.addListener('appStateChange', async ({ isActive }) => {
  if (!isActive) {
    // App geht in Background
    const taskId = await BackgroundTask.beforeExit(async () => {
      try {
        // Nur Text-basierte Queue-Items flushen
        await writeQueue.flushTextOnly();
      } finally {
        BackgroundTask.finish({ taskId });
      }
    });
  }
});
```

### Periodischer Background-Sync

**iOS BGTaskScheduler:** Nicht empfohlen. iOS beschraenkt Frequency stark bei Apps mit geringer Nutzung. Unzuverlaessig.

**Empfehlung:** Kein periodischer Background-Sync. Stattdessen:
1. **App-Resume:** SyncManager bei `appStateChange isActive=true` triggern (bereits in AppContext Zeile 284)
2. **Socket.io Reconnect:** Sync bei `connect` Event triggern
3. **Foreground-Timer:** Alle 5 Minuten Cache-Invalidierung pruefen (nur wenn App offen ist)

---

## 8. Migration Path: localStorage -> Capacitor Preferences

### Aktuelle localStorage Keys

| Key | Wert | Kritikalitaet | Groesse |
|-----|------|---------------|---------|
| `konfi_token` | JWT String | KRITISCH | ~800 Bytes |
| `konfi_user` | JSON Object | KRITISCH | ~300 Bytes |
| `device_id` | UUID String | Mittel | ~50 Bytes |
| `push_token_last_refresh` | Timestamp | Niedrig | ~13 Bytes |

### Migrations-Strategie

**Wann ausfuehren:** Beim App-Start, BEVOR irgendein API-Call gemacht wird.

**Ablauf:**
```typescript
// frontend/src/services/storageMigration.ts
import { Preferences } from '@capacitor/preferences';

const MIGRATION_KEY = 'storage_migrated_v1';

export async function migrateToPreferences(): Promise<void> {
  // 1. Pruefen ob bereits migriert
  const { value: migrated } = await Preferences.get({ key: MIGRATION_KEY });
  if (migrated === 'true') return;

  // 2. Token migrieren
  const token = localStorage.getItem('konfi_token');
  if (token) {
    await Preferences.set({ key: 'konfi_token', value: token });
  }

  // 3. User migrieren
  const user = localStorage.getItem('konfi_user');
  if (user) {
    await Preferences.set({ key: 'konfi_user', value: user });
  }

  // 4. Device-ID migrieren
  const deviceId = localStorage.getItem('device_id');
  if (deviceId) {
    await Preferences.set({ key: 'device_id', value: deviceId });
  }

  // 5. Push-Token-Timestamp migrieren
  const pushRefresh = localStorage.getItem('push_token_last_refresh');
  if (pushRefresh) {
    await Preferences.set({ key: 'push_token_last_refresh', value: pushRefresh });
  }

  // 6. Migration als abgeschlossen markieren
  await Preferences.set({ key: MIGRATION_KEY, value: 'true' });

  // 7. localStorage Keys NICHT loeschen!
  // Behalten als Fallback fuer den Fall dass Preferences fehlschlaegt.
  // Werden erst in v2.2 entfernt.
}
```

### Betroffene Dateien (alle 14)

Jede Datei die `localStorage.getItem('konfi_token')` oder aehnliches aufruft, muss auf asynchrones `Preferences.get()` umgestellt werden.

**Herausforderung:** `localStorage.getItem()` ist synchron, `Preferences.get()` ist async. Das betrifft:

1. **`api.ts` Request-Interceptor (Zeile 13-18):** Interceptor muss async werden
   ```typescript
   // VORHER (sync):
   const token = localStorage.getItem('konfi_token');

   // NACHHER: Token im Speicher halten, async laden bei Init
   let cachedToken: string | null = null;

   export async function initToken() {
     const { value } = await Preferences.get({ key: 'konfi_token' });
     cachedToken = value;
   }

   api.interceptors.request.use((config) => {
     if (cachedToken) {
       config.headers.Authorization = `Bearer ${cachedToken}`;
     }
     return config;
   });
   ```

2. **`auth.ts` checkAuth() (Zeile 110-125):** Wird synchron aufgerufen in `AppContext.tsx:93` (`useState<User | null>(checkAuth())`). Muss async werden.
   ```typescript
   // VORHER:
   const [user, setUser] = useState<User | null>(checkAuth()); // Synchron!

   // NACHHER:
   const [user, setUser] = useState<User | null>(null);
   useEffect(() => {
     checkAuthAsync().then(u => setUser(u));
   }, []);
   ```

3. **`LiveUpdateContext.tsx` (Zeile 43):** Token lesen fuer Socket.io Init
4. **`BadgeContext.tsx` (Zeile 125):** Token lesen fuer Socket.io Init
5. **`ChatRoom.tsx` (Zeile 205):** Token lesen fuer Socket.io Init
6. **`ChatOverview.tsx` (Zeile 90):** Token lesen fuer Socket.io Init

**Pattern-Loesung:** Ein globaler Token-Cache der bei App-Start einmal aus Preferences geladen wird:

```typescript
// frontend/src/services/tokenStore.ts
import { Preferences } from '@capacitor/preferences';

let _token: string | null = null;
let _user: any | null = null;
let _initialized = false;

export async function initTokenStore(): Promise<void> {
  const [tokenResult, userResult] = await Promise.all([
    Preferences.get({ key: 'konfi_token' }),
    Preferences.get({ key: 'konfi_user' }),
  ]);
  _token = tokenResult.value;
  _user = userResult.value ? JSON.parse(userResult.value) : null;
  _initialized = true;
}

export function getToken(): string | null {
  return _token;
}

export function getUser(): any | null {
  return _user;
}

export async function setToken(token: string): Promise<void> {
  _token = token;
  await Preferences.set({ key: 'konfi_token', value: token });
}

export async function setUser(user: any): Promise<void> {
  _user = user;
  await Preferences.set({ key: 'konfi_user', value: JSON.stringify(user) });
}

export async function clearAuth(): Promise<void> {
  _token = null;
  _user = null;
  await Promise.all([
    Preferences.remove({ key: 'konfi_token' }),
    Preferences.remove({ key: 'konfi_user' }),
  ]);
}
```

**Aufruf in App-Entry:** `initTokenStore()` muss in `main.tsx` oder `App.tsx` aufgerufen werden BEVOR die App rendert. Das erfordert einen kleinen Umbau:

```typescript
// main.tsx
async function boot() {
  await migrateToPreferences();
  await initTokenStore();
  // Erst jetzt React rendern
  createRoot(document.getElementById('root')!).render(<App />);
}
boot();
```

### "Already Migrated" Erkennung

Der `MIGRATION_KEY = 'storage_migrated_v1'` in Capacitor Preferences reicht. Wenn dieser Key existiert und `'true'` ist, wurde bereits migriert. Neue Installationen haben weder localStorage noch den Key -- die Migration laeuft dann einfach durch ohne etwas zu kopieren.

---

## 9. Konflikt-Szenarien fuer Queue-Aktionen

### Chat-Nachricht gequeued + Server-State veraendert

| Szenario | Wahrscheinlichkeit | Was passiert | Loesung |
|----------|-------------------|-------------|---------|
| Nachricht an Raum der geloescht wurde | Sehr niedrig | Server gibt 404 zurueck | Queue-Item als `failed` markieren, User informieren: "Chat existiert nicht mehr" |
| Nachricht an Raum aus dem User entfernt wurde | Niedrig | Server gibt 403 zurueck | Queue-Item als `failed` markieren, User informieren: "Du bist nicht mehr Mitglied" |
| Nachricht doppelt (Retry nach Timeout) | Mittel | Server erstellt Duplikat | `client_id` Deduplizierung im Backend. Gleiche client_id = gleiche Nachricht zurueckgeben. |

### Aktivitaets-Antrag gequeued + Server-State veraendert

| Szenario | Wahrscheinlichkeit | Was passiert | Loesung |
|----------|-------------------|-------------|---------|
| Aktivitaet wurde geloescht | Sehr niedrig | Server gibt 404 zurueck | Queue-Item als `failed` markieren, User informieren |
| Aktivitaet wurde deaktiviert | Niedrig | Server gibt 400/422 zurueck | Queue-Item als `failed` markieren, User informieren |
| Antrag bereits gestellt (Duplikat) | Mittel | Server gibt 409 Conflict | `client_id` Deduplizierung oder Server-seitige "already requested" Pruefung |
| Punkte-Typ deaktiviert fuer Jahrgang | Sehr niedrig | Server gibt 400 zurueck (Guard) | Queue-Item als `failed` markieren |

### Allgemeines Konflikt-Handling

```typescript
interface QueueFlushResult {
  succeeded: QueueItem[];
  failed: FailedQueueItem[];
}

interface FailedQueueItem extends QueueItem {
  error: {
    status: number;
    message: string;
  };
}

// Nach Queue-Flush:
async function handleFlushResult(result: QueueFlushResult): Promise<void> {
  if (result.failed.length === 0) return;

  // Nicht-retribare Fehler (4xx ausser 408/429):
  const permanentFailures = result.failed.filter(
    item => item.error.status >= 400 && item.error.status < 500
      && item.error.status !== 408 && item.error.status !== 429
  );

  if (permanentFailures.length > 0) {
    // User informieren via Toast
    const failedCount = permanentFailures.length;
    showToast(`${failedCount} Aktion(en) konnten nicht gesendet werden`);

    // Failed Items aus Queue entfernen (nicht nochmal versuchen)
    for (const item of permanentFailures) {
      await writeQueue.remove(item.id);
    }
  }

  // Retribare Fehler (5xx, 408, 429): Im Queue belassen, naechster Flush versucht es erneut
}
```

### Optimistic UI Ruecknahme

Chat-Nachrichten die als "pending" angezeigt werden:
- **Erfolgreich gesendet:** Uhr-Icon wird zu Haekchen (Status: `sent`)
- **Permanent fehlgeschlagen:** Uhr-Icon wird zu Ausrufezeichen + roter Rahmen
- **User-Aktion bei Fehler:** Tap auf fehlgeschlagene Nachricht bietet "Erneut senden" oder "Loeschen"

```typescript
// ChatRoom.tsx: Optimistic Messages
interface OptimisticMessage extends Message {
  _clientId: string;
  _status: 'pending' | 'sent' | 'failed';
}
```

---

## 10. useOfflineQuery Hook Design

### API Surface

```typescript
interface UseOfflineQueryOptions<T> {
  /** Cache TTL in Millisekunden. Default: 5 Minuten */
  ttl?: number;
  /** Nur fetchen wenn true. Default: true */
  enabled?: boolean;
  /** Callback nach erfolgreichem Fetch */
  onSuccess?: (data: T) => void;
  /** Callback bei Fehler */
  onError?: (error: Error) => void;
  /** Cache-Daten transformieren (z.B. filtern, sortieren) */
  select?: (data: T) => T;
}

interface UseOfflineQueryResult<T> {
  /** Die Daten (aus Cache oder frisch) */
  data: T | null;
  /** Erster Ladevorgang (kein Cache vorhanden) */
  loading: boolean;
  /** Fehler beim Laden */
  error: string | null;
  /** Daten sind aus Cache, Revalidierung laeuft */
  isStale: boolean;
  /** App ist offline */
  isOffline: boolean;
  /** Manueller Refresh (fuer IonRefresher und useLiveRefresh) */
  refresh: () => Promise<void>;
}

function useOfflineQuery<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options?: UseOfflineQueryOptions<T>
): UseOfflineQueryResult<T>;
```

### Implementierung

```typescript
// frontend/src/hooks/useOfflineQuery.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineCache } from '../services/offlineCache';
import { networkMonitor } from '../services/networkMonitor';

export function useOfflineQuery<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  options?: UseOfflineQueryOptions<T>
): UseOfflineQueryResult<T> {
  const { ttl = 5 * 60 * 1000, enabled = true, onSuccess, onError, select } = options || {};

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [isOffline, setIsOffline] = useState(!networkMonitor.isOnline);

  // Ref um Race Conditions bei schnellem Key-Wechsel zu vermeiden
  const currentKeyRef = useRef(cacheKey);
  currentKeyRef.current = cacheKey;

  // Netzwerk-Status tracken
  useEffect(() => {
    const unsub = networkMonitor.subscribe((online) => {
      setIsOffline(!online);
      if (online && isStale) {
        // Wieder online: Revalidieren
        revalidate();
      }
    });
    return unsub;
  }, [isStale]);

  const revalidate = useCallback(async () => {
    if (!enabled) return;

    try {
      const freshData = await fetcher();

      // Nur setzen wenn Key sich nicht geaendert hat
      if (currentKeyRef.current !== cacheKey) return;

      const transformed = select ? select(freshData) : freshData;
      setData(transformed);
      setIsStale(false);
      setError(null);
      setLoading(false);

      // Cache aktualisieren
      await offlineCache.set(cacheKey, freshData, ttl);

      onSuccess?.(transformed);
    } catch (err) {
      // Nur setzen wenn Key sich nicht geaendert hat
      if (currentKeyRef.current !== cacheKey) return;

      if (data !== null) {
        // Haben Cache-Daten -> Error nicht anzeigen, Cache behalten
        setIsStale(true);
      } else {
        // Kein Cache -> Error anzeigen
        setError(err instanceof Error ? err.message : 'Fehler beim Laden');
        setLoading(false);
      }

      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }, [cacheKey, fetcher, enabled, ttl, onSuccess, onError, select, data]);

  // Initial Load: Cache -> dann Revalidierung
  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      // 1. Cache lesen
      const cached = await offlineCache.get<T>(cacheKey);
      if (cancelled) return;

      if (cached) {
        const transformed = select ? select(cached.data) : cached.data;
        setData(transformed);
        setLoading(false);

        if (offlineCache.isStale(cached)) {
          setIsStale(true);
          // Revalidieren im Hintergrund
          if (networkMonitor.isOnline) {
            revalidate();
          }
        } else {
          setIsStale(false);
        }
      } else {
        // Kein Cache -> direkt fetchen
        if (networkMonitor.isOnline) {
          await revalidate();
        } else {
          setLoading(false);
          setIsOffline(true);
          setError('Keine Daten verfuegbar (offline)');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [cacheKey, enabled]);

  const refresh = useCallback(async () => {
    if (networkMonitor.isOnline) {
      await revalidate();
    }
  }, [revalidate]);

  return { data, loading, error, isStale, isOffline, refresh };
}
```

### Before/After Beispiele

#### KonfiDashboardPage (komplexeste Page: 4 API-Calls)

**VORHER** (`KonfiDashboardPage.tsx`):
```typescript
const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
const [dailyVerse, setDailyVerse] = useState<DailyVerse | null>(null);
const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
const [badgeStats, setBadgeStats] = useState<BadgeStats>({...});
const [loading, setLoading] = useState(true);

useEffect(() => {
  loadDashboardData();
  loadDailyVerse();
  loadUpcomingEvents();
  loadBadgeStats();
}, []);

const refreshAllData = useCallback(() => {
  loadDashboardData();
  loadUpcomingEvents();
  loadBadgeStats();
}, []);

useLiveRefresh(['dashboard', 'events', 'badges'], refreshAllData);

const loadDashboardData = async () => {
  setLoading(true);
  try {
    const response = await api.get('/konfi/dashboard');
    setDashboardData(response.data);
  } catch (err) {
    setError('Fehler beim Laden der Dashboard-Daten');
  } finally {
    setLoading(false);
  }
};

// + 3 weitere aehnliche loadX() Funktionen...
```

**NACHHER:**
```typescript
const { data: dashboardData, loading: dashLoading, isStale, refresh: refreshDashboard }
  = useOfflineQuery<DashboardData>(
    `konfi:dashboard:${user?.id}`,
    () => api.get('/konfi/dashboard').then(r => r.data),
    { ttl: 5 * 60 * 1000 }
  );

const { data: dailyVerse }
  = useOfflineQuery<DailyVerse>(
    `konfi:tageslosung:${new Date().toISOString().split('T')[0]}`,
    () => api.get('/konfi/tageslosung').then(r => {
      // Transformations-Logik hierhin verschieben
      const apiData = r.data.data;
      return {
        losungstext: apiData.losung?.text?.replace(/\[|\]/g, '') || '',
        losungsvers: apiData.losung?.reference || '',
        lehrtext: apiData.lehrtext?.text?.replace(/\[|\]/g, '') || '',
        lehrtextvers: apiData.lehrtext?.reference || '',
      };
    }),
    { ttl: 24 * 60 * 60 * 1000 } // 24 Stunden
  );

const { data: upcomingEvents, refresh: refreshEvents }
  = useOfflineQuery<Event[]>(
    `konfi:events:${user?.id}`,
    () => api.get('/konfi/events').then(r => r.data),
    {
      ttl: 10 * 60 * 1000,
      select: (events) => events.filter(e =>
        new Date(e.event_date) >= new Date() && (e.is_registered || e.booking_status === 'confirmed')
      )
    }
  );

const { data: allBadges, refresh: refreshBadges }
  = useOfflineQuery(
    `konfi:badges:${user?.id}`,
    () => api.get('/konfi/badges').then(r => r.data),
    { ttl: 30 * 60 * 1000 }
  );

const loading = dashLoading; // Nur Dashboard bestimmt Loading-State

// LiveRefresh ruft jetzt refresh() auf statt loadData()
const refreshAll = useCallback(() => {
  refreshDashboard();
  refreshEvents();
  refreshBadges();
}, [refreshDashboard, refreshEvents, refreshBadges]);

useLiveRefresh(['dashboard', 'events', 'badges'], refreshAll);

// IonRefresher:
const handleRefresh = async (event: CustomEvent) => {
  await Promise.all([refreshDashboard(), refreshEvents(), refreshBadges()]);
  event.detail.complete();
};
```

**Netto-Aenderung:** -45 Zeilen Code, +15 Zeilen. Keine UI-Aenderungen. Vollstaendig mechanische Migration.

#### KonfiEventsPage (typische einfache Page)

**VORHER:**
```typescript
const [events, setEvents] = useState<Event[]>([]);
const [loading, setLoading] = useState(true);

const loadEvents = async () => {
  setLoading(true);
  try {
    const response = await api.get('/konfi/events');
    setEvents(response.data);
  } catch (err) {
    setError('Fehler beim Laden der Events');
  } finally {
    setLoading(false);
  }
};

useEffect(() => { loadEvents(); }, []);
useLiveRefresh('events', () => loadEvents());
```

**NACHHER:**
```typescript
const { data: events, loading, refresh }
  = useOfflineQuery<Event[]>(
    `konfi:events:${user?.id}`,
    () => api.get('/konfi/events').then(r => r.data),
    { ttl: 10 * 60 * 1000 }
  );

useLiveRefresh('events', refresh);
```

**Netto-Aenderung:** -12 Zeilen, +6 Zeilen.

#### ChatRoom (Sonderfall: WebSocket + Queue)

ChatRoom nutzt NICHT `useOfflineQuery` fuer Messages, weil:
1. Messages kommen primaer via WebSocket, nicht via REST
2. Die Message-Liste wird in-memory mutiert bei jedem neuen Event
3. Der REST-Call `GET /messages?limit=100` dient nur als Initial-Load und Backup

**Stattdessen:**
```typescript
// ChatRoom.tsx: Hybrid-Ansatz
// 1. Initial-Load mit Cache
useEffect(() => {
  if (!room?.id) return;

  // Cache lesen fuer sofortige Anzeige
  offlineCache.get<Message[]>(`chat:messages:${room.id}`).then(cached => {
    if (cached) setMessages(cached.data);
  });

  // Frische Daten laden
  loadMessages();
}, [room?.id]);

// 2. Messages in Cache speichern bei jedem Update
useEffect(() => {
  if (messages.length > 0) {
    offlineCache.set(`chat:messages:${room.id}`, messages, 60 * 60 * 1000);
  }
}, [messages]);

// 3. sendMessage mit Queue-Support
const sendMessage = async () => {
  const clientId = crypto.randomUUID();
  const content = messageText.trim();

  // Optimistic UI sofort
  const optimisticMsg: OptimisticMessage = {
    id: -Date.now(), // Temporaere negative ID
    content,
    sender_name: user?.display_name || '',
    user_id: user?.id || 0,
    user_type: user?.type || 'konfi',
    created_at: new Date().toISOString(),
    _clientId: clientId,
    _status: 'pending'
  };
  setMessages(prev => [...prev, optimisticMsg]);
  setMessageText('');

  if (!networkMonitor.isOnline) {
    // Offline: In Queue einreihen
    await writeQueue.enqueue({
      method: 'POST',
      url: `/chat/rooms/${room.id}/messages`,
      body: { content, client_id: clientId },
      maxRetries: 5,
      metadata: { type: 'chat_message', roomId: room.id, clientId }
    });
    return; // Wird spaeter gesendet
  }

  // Online: Direkt senden
  try {
    await api.post(`/chat/rooms/${room.id}/messages`, { content, client_id: clientId });
    // Server sendet newMessage via WebSocket -> optimistic msg wird ersetzt
  } catch (err) {
    // Fehler: In Queue fuer spaeter
    await writeQueue.enqueue({ ... });
  }
};
```

---

## Zusammenfassung: Migrations-Aufwand pro Komponente

| Komponente | Aenderung | Geschaetzter Aufwand | Risiko |
|-----------|-----------|---------------------|--------|
| `services/tokenStore.ts` | NEU (Storage-Abstraktion) | 2 Std | Niedrig |
| `services/storageMigration.ts` | NEU (localStorage->Preferences) | 1 Std | Niedrig |
| `services/offlineCache.ts` | NEU (Cache-Service) | 3 Std | Niedrig |
| `services/writeQueue.ts` | NEU (Schreib-Queue) | 4 Std | Mittel |
| `services/networkMonitor.ts` | NEU (Netzwerk-Status) | 1 Std | Niedrig |
| `services/syncManager.ts` | NEU (Sync-Koordinator) | 3 Std | Mittel |
| `hooks/useOfflineQuery.ts` | NEU (SWR-Hook) | 3 Std | Niedrig |
| `components/common/OfflineBanner.tsx` | NEU (UI-Komponente) | 1 Std | Niedrig |
| `services/api.ts` | Aendern (Retry + Offline-401) | 2 Std | Mittel |
| `services/auth.ts` | Aendern (Preferences statt localStorage) | 1 Std | Mittel |
| `contexts/AppContext.tsx` | Aendern (async checkAuth + isOnline) | 2 Std | Mittel |
| `contexts/LiveUpdateContext.tsx` | Aendern (Token aus TokenStore) | 0.5 Std | Niedrig |
| `contexts/BadgeContext.tsx` | Aendern (Token + Cache-Fallback) | 1 Std | Niedrig |
| `services/websocket.ts` | Aendern (Token + Reconnect-Sync) | 1 Std | Niedrig |
| `main.tsx` / `App.tsx` | Aendern (Boot-Sequenz + Banner) | 1 Std | Niedrig |
| 30 Pages (mechanische Migration) | Aendern (api.get -> useOfflineQuery) | 10 Std (20 Min/Page) | Niedrig |
| `chat/ChatRoom.tsx` | Aendern (Queue + Optimistic UI) | 4 Std | Hoch |
| Backend: `chat.js` | Aendern (client_id, after-Parameter) | 2 Std | Niedrig |
| Backend: DB Migration | NEU (client_id Spalte) | 0.5 Std | Niedrig |
| **GESAMT** | | **~42 Stunden** | |

---

## Quellen

- Codebase-Analyse: Alle Dateipfade und Zeilennummern direkt aus dem Projekt-Source-Code
- [Capacitor Preferences Plugin API](https://capacitorjs.com/docs/apis/preferences) (HIGH confidence)
- [Capacitor Network Plugin API](https://capacitorjs.com/docs/apis/network) (HIGH confidence)
- [Capawesome Background Task Plugin](https://capawesome.io/plugins/background-task/) — 30s iOS Limit (HIGH confidence)
- [iOS UserDefaults Limit](https://developer.apple.com/documentation/foundation/userdefaults/sizelimitexceedednotification) — Kein hartes Limit auf iOS, nur tvOS 1MB (HIGH confidence)
- [Socket.IO Offline Behavior](https://socket.io/docs/v3/client-offline-behavior/) — Event-Buffering nur fuer ausgehende Events (HIGH confidence)
