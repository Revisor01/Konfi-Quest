# Phase 27: Badge-Count Single Source of Truth - Research

**Researched:** 2026-03-06
**Domain:** Frontend State-Konsolidierung, Push Badge Sync, React Context Pattern
**Confidence:** HIGH

## Summary

Diese Phase konsolidiert 4 unabhaengige Badge-Count-Systeme (BadgeContext, AppContext chatNotifications, MainTabs Polling, backgroundService) in einen einzigen BadgeContext als Single Source of Truth. Die Codebasis zeigt klar, dass Chat-Unreads aktuell doppelt verwaltet werden (BadgeContext.refreshFromAPI und AppContext.refreshChatNotifications machen denselben API-Call GET /chat/rooms), waehrend pendingRequestsCount und pendingEventsCount isoliert in MainTabs gepollt werden. Der backgroundService berechnet Badge-Counts serverseitig nur aus Chat-Unreads -- Antraege und Events fehlen komplett.

Die Aenderungen sind primaer Refactoring: Bestehende Logik wird verschoben, nicht neu erfunden. Das Risiko ist gering, weil alle Datenquellen (API-Endpoints, WebSocket-Events, Window-Events) bereits existieren und funktionieren.

**Primary recommendation:** BadgeContext erweitern um chatUnreadByRoom, pendingRequestsCount und pendingEventsCount. AppContext chatNotifications-State entfernen. MainTabs Polling-Logik nach BadgeContext verschieben. backgroundService Badge-Query um Antraege/Events-Counts erweitern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- BadgeContext.tsx wird zur zentralen Stelle fuer ALLE Badge-Counts
- chatNotifications State aus AppContext wird komplett nach BadgeContext verschoben (unreadByRoom + totalUnread)
- pendingRequestsCount und pendingEventsCount aus MainTabs werden nach BadgeContext verschoben
- AppContext chatNotifications wird entfernt
- MainTabs wird schlank: liest nur noch aus BadgeContext
- Admin: Chat-Unreads + offene Antraege + Events zu verbuchen
- Konfi: Chat-Unreads (nur)
- Level-Up, Punkte, Achievements sind KEINE Badge-Counts
- App-Icon = Summe aller Badge-Kategorien
- Echter Count bis erledigt -- KEIN Reset bei App-Open
- WebSocket 'newMessage' Event + API Refresh fuer Chat-Unreads
- Per-Room unreadByRoom in BadgeContext verwaltet
- Unread-Count sofort auf 0 beim Betreten des Raums (last_read_at Update)
- Window Events ('requestStatusChanged', 'events-updated') fuer Antraege/Events Live-Update
- backgroundService als Server-seitiger Fallback (Silent Push fuer App-Icon)

### Claude's Discretion
- Exakte BadgeContext Interface-Erweiterung (welche Felder, welche Methoden)
- Wie backgroundService die zusaetzlichen Counts (Antraege, Events) berechnet
- Reihenfolge der Migration (Backend-first oder Frontend-first)
- Ob refreshFromAPI ein oder mehrere API-Calls macht

### Deferred Ideas (OUT OF SCOPE)
- Badge fuer neue Achievements/Badges bei Konfis
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BDG-01 | Badge-Count Single Source of Truth -- ein System verwaltet den Count, andere konsumieren | BadgeContext-Erweiterung um alle Count-Kategorien, AppContext/MainTabs-Bereinigung |
| BDG-02 | App-Icon Badge zeigt korrekte Unread-Anzahl | backgroundService Badge-Query erweitern um Antraege+Events, Capacitor Badge.set mit Gesamt-Count |
| BDG-03 | Chat-Liste zeigt korrekte Unread-Counts pro Raum | unreadByRoom Map in BadgeContext, ChatOverview konsumiert aus BadgeContext |
| BDG-04 | TabBar Badge-Zahlen stimmen mit tatsaechlichen Counts ueberein | MainTabs liest chatUnread/pendingRequests/pendingEvents direkt aus useBadge() |
</phase_requirements>

## Standard Stack

### Core (bereits im Projekt)
| Library | Version | Purpose | Warum |
|---------|---------|---------|-------|
| React Context | 19 | State Management fuer Badge-Counts | Bereits als BadgeContext vorhanden |
| @capawesome/capacitor-badge | vorhanden | App-Icon Badge setzen | Badge.set({count}), Badge.clear() |
| socket.io-client | vorhanden | WebSocket fuer Chat-Unreads | 'newMessage' Event bereits genutzt |

### Supporting (bereits im Projekt)
| Library | Purpose | Verwendung |
|---------|---------|------------|
| Window CustomEvents | Antraege/Events Live-Update | 'requestStatusChanged', 'events-updated' |
| Firebase Cloud Messaging | Silent Push fuer Badge-Update | sendBadgeUpdate via backgroundService |

### Keine neuen Dependencies noetig
Alle benoetigten Libraries sind bereits installiert und in Verwendung.

## Architecture Patterns

### Aktueller Zustand (4 Systeme, nicht synchron)

```
BadgeContext.tsx          → badgeCount (nur Chat-Unreads gesamt)
                           → refreshFromAPI() → GET /chat/rooms → zaehlt unread_count
                           → WebSocket newMessage → refreshFromAPI()
                           → Badge.set(badgeCount) bei Aenderung

AppContext.tsx            → chatNotifications { totalUnreadCount, unreadByRoom }
                           → refreshChatNotifications() → GET /chat/rooms (DUPLIKAT!)
                           → markChatRoomAsRead(), addUnreadChatMessage()
                           → Groesstenteils disabled ("Badge Context handles updates")

MainTabs.tsx              → pendingRequestsCount (Polling 30s) → GET /admin/activities/requests
                           → pendingEventsCount (Polling 60s) → GET /events
                           → newBadgesCount (Polling 60s) → GET /konfi/badges
                           → Window Events fuer sofortige Updates

backgroundService.js      → Alle 5 Min Badge-Update fuer alle User
                           → NUR Chat-Unreads in Badge-Query
                           → Fehlt: Antraege + Events
```

### Ziel-Zustand (1 System, BadgeContext)

```
BadgeContext.tsx (erweitert)
├── chatUnreadByRoom: Record<number, number>   ← aus GET /chat/rooms
├── chatUnreadTotal: number                     ← Summe chatUnreadByRoom
├── pendingRequestsCount: number                ← aus GET /admin/activities/requests
├── pendingEventsCount: number                  ← aus GET /events (filtered)
├── totalBadgeCount: number                     ← Summe aller (role-abhaengig)
│
├── refreshAllCounts()                          ← API-Call bei App-Start
├── markRoomAsRead(roomId)                      ← Setzt chatUnreadByRoom[roomId] = 0
├── handleNewMessage(roomId?)                   ← WebSocket Listener
│
├── Badge.set(totalBadgeCount)                  ← Device Badge sync
└── Window Event Listeners                      ← requestStatusChanged, events-updated

MainTabs.tsx (schlank)
├── useBadge()
└── Nur noch Rendering, kein Polling

AppContext.tsx (bereinigt)
├── chatNotifications ENTFERNT
├── refreshChatNotifications ENTFERNT
├── markChatRoomAsRead ENTFERNT
└── addUnreadChatMessage ENTFERNT

backgroundService.js (erweitert)
└── Badge-Query: Chat-Unreads + Antraege + Events pro User
```

### Pattern: BadgeContext Interface (Empfehlung)

```typescript
interface BadgeContextType {
  // Chat
  chatUnreadByRoom: Record<number, number>;
  chatUnreadTotal: number;

  // Admin-only
  pendingRequestsCount: number;
  pendingEventsCount: number;

  // Gesamt (Role-abhaengig)
  totalBadgeCount: number;

  // Actions
  refreshAllCounts: () => Promise<void>;
  markRoomAsRead: (roomId: number) => void;

  // Legacy (fuer schrittweise Migration)
  badgeCount: number;  // Alias fuer chatUnreadTotal (Abwaertskompatibilitaet)
}
```

### Pattern: refreshAllCounts (ein oder mehrere API-Calls)

**Empfehlung: Parallele API-Calls** (statt neuem Combined-Endpoint):

```typescript
const refreshAllCounts = useCallback(async () => {
  try {
    const promises: Promise<any>[] = [
      api.get('/chat/rooms')
    ];

    if (user?.type === 'admin') {
      promises.push(api.get('/admin/activities/requests'));
      promises.push(api.get('/events'));
    }

    const results = await Promise.all(promises);

    // Chat
    const rooms = results[0].data;
    const unreadByRoom: Record<number, number> = {};
    let chatTotal = 0;
    rooms.forEach((room: any) => {
      unreadByRoom[room.id] = room.unread_count || 0;
      chatTotal += room.unread_count || 0;
    });

    // Admin Counts
    let requests = 0;
    let events = 0;
    if (user?.type === 'admin' && results.length > 1) {
      requests = results[1].data.filter((r: any) => r.status === 'pending').length;
      events = results[2].data.filter((e: any) =>
        e.unprocessed_count > 0 && new Date(e.event_date) < new Date()
      ).length;
    }

    // State setzen
    setChatUnreadByRoom(unreadByRoom);
    setChatUnreadTotal(chatTotal);
    setPendingRequestsCount(requests);
    setPendingEventsCount(events);
  } catch (error) {
    console.error('BadgeContext: refreshAllCounts fehlgeschlagen:', error);
  }
}, [user]);
```

### Pattern: backgroundService Badge-Query Erweiterung

```sql
-- Erweiterte Badge-Query: Chat + Antraege + Events
SELECT
  (
    SELECT COUNT(DISTINCT cm.id)::int
    FROM chat_messages cm
    JOIN chat_participants cp ON cm.room_id = cp.room_id
    LEFT JOIN chat_read_status crs ON cm.room_id = crs.room_id
      AND crs.user_id = $1 AND crs.user_type = $2
    WHERE cp.user_id = $1 AND cp.user_type = $2
      AND cm.created_at > COALESCE(crs.last_read_at, '1970-01-01')
      AND cm.deleted_at IS NULL
      AND NOT (cm.user_id = $1 AND cm.user_type = $2)
  ) as chat_unread,
  CASE WHEN $2 = 'admin' THEN (
    SELECT COUNT(*)::int
    FROM activity_requests ar
    JOIN konfi_profiles kp ON ar.konfi_id = kp.user_id
    JOIN users u ON u.id = $1
    WHERE kp.organization_id = u.organization_id
      AND ar.status = 'pending'
  ) ELSE 0 END as pending_requests,
  CASE WHEN $2 = 'admin' THEN (
    SELECT COUNT(DISTINCT e.id)::int
    FROM events e
    JOIN event_bookings eb ON e.id = eb.event_id
    JOIN users u ON u.id = $1
    WHERE e.organization_id = u.organization_id
      AND e.event_date < CURRENT_DATE
      AND eb.status = 'confirmed'
      AND eb.attendance_status IS NULL
  ) ELSE 0 END as pending_events
```

### Anti-Patterns zu Vermeiden
- **Doppelte API-Calls:** BadgeContext UND AppContext rufen GET /chat/rooms auf -- muss konsolidiert werden
- **Polling in UI-Komponenten:** MainTabs pollt Antraege/Events direkt -- gehoert in Context
- **Badge-Count nur Chat:** backgroundService ignoriert Antraege/Events fuer App-Icon Badge

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Device Badge | Eigene Badge-Logik | @capawesome/capacitor-badge | Bereits funktioniert, Badge.set/clear |
| WebSocket | Eigener Socket-Handler | Bestehender initializeWebSocket | Socket.io Setup bereits korrekt |
| Polling Fallback | Neuer Polling-Mechanismus | setInterval wie in MainTabs | Bewaehrtes Pattern bereits vorhanden |
| Combined API | Neuer Backend-Endpoint | Promise.all mit bestehenden Endpoints | Vermeidet Backend-Aenderung, 3 parallele Calls sind schnell genug |

## Common Pitfalls

### Pitfall 1: AppContext Consumer-Breakage
**Was passiert:** Entfernen von chatNotifications aus AppContext bricht alle Komponenten die useApp().chatNotifications nutzen
**Warum:** ChatOverview, AppContext pushNotificationReceived Handler, und moeglicherweise weitere Stellen nutzen chatNotifications
**Vermeidung:** Vor dem Entfernen ALLE Referenzen auf chatNotifications, refreshChatNotifications, markChatRoomAsRead, addUnreadChatMessage suchen und migrieren
**Warnsignal:** TypeScript Compile-Errors nach AppContext-Aenderung

### Pitfall 2: BadgeContext braucht User-Info
**Was passiert:** BadgeContext hat aktuell keinen Zugriff auf user.type (admin/konfi), braucht ihn aber fuer rolle-spezifische Counts
**Warum:** BadgeProvider ist in der Komponentenhierarchie oberhalb oder neben AppProvider
**Vermeidung:** BadgeContext muss user-Objekt als Prop oder ueber eigenen Auth-Check erhalten. Alternative: BadgeProvider innerhalb AppProvider nesten, damit useApp() verfuegbar ist
**Warnsignal:** undefined user beim Versuch Admin-Counts zu laden

### Pitfall 3: Race Condition bei App-Start
**Was passiert:** refreshAllCounts wird aufgerufen bevor User authentifiziert ist
**Warum:** BadgeContext mountet vor Auth-Check abgeschlossen
**Vermeidung:** refreshAllCounts nur aufrufen wenn user nicht null ist (useEffect mit user-Dependency)
**Warnsignal:** 401-Fehler in der Console bei App-Start

### Pitfall 4: WebSocket newMessage triggert doppelten Refresh
**Was passiert:** WebSocket 'newMessage' in BadgeContext UND ChatOverview fuehrt zu doppeltem API-Call
**Warum:** Beide Komponenten haben eigene WebSocket-Listener
**Vermeidung:** ChatOverview soll auf BadgeContext chatUnreadByRoom reagieren (useEffect), nicht eigenen WebSocket-Listener fuer Counts haben. ChatOverview kann Rooms-Liste separat laden fuer UI, aber Unread-Counts aus BadgeContext nehmen
**Warnsignal:** Doppelte GET /chat/rooms Calls in Network-Tab

### Pitfall 5: Silent Push Badge-Count Mismatch
**Was passiert:** backgroundService sendet Badge-Count nur mit Chat-Unreads, Frontend addiert aber Antraege+Events
**Warum:** Zwei verschiedene Berechnungslogiken (Backend vs Frontend)
**Vermeidung:** backgroundService Badge-Query MUSS dieselbe Summe berechnen wie das Frontend (Chat + Antraege + Events fuer Admins)
**Warnsignal:** App-Icon zeigt anderen Count als TabBar-Summe

### Pitfall 6: Konfi-View pendingEventsCount
**Was passiert:** pendingEventsCount wird im Konfi-View nie gezeigt, aber API-Call wuerde trotzdem gemacht
**Warum:** Konfi hat keinen Admin-Tab und keine Events-zu-verbuchen Logik
**Vermeidung:** Admin-only API-Calls (activities/requests, events filter) nur fuer user.type === 'admin' ausfuehren

## Code Examples

### Beispiel: ChatOverview Migration (unreadByRoom aus BadgeContext)

```typescript
// VORHER: ChatOverview berechnet unread selbst aus room.unread_count
const totalUnread = response.data.reduce((sum, room) => sum + (room.unread_count || 0), 0);
setBadgeCount(totalUnread);

// NACHHER: ChatOverview nutzt unreadByRoom aus BadgeContext fuer Anzeige
const { chatUnreadByRoom } = useBadge();
// room.unread_count kommt weiterhin aus API, aber Badge-Count wird NICHT hier gesetzt
// BadgeContext aktualisiert sich selbst via WebSocket/Events
```

### Beispiel: MainTabs Migration (schlank)

```typescript
// VORHER: MainTabs hat eigene Polling-Logik (30s/60s Intervals)
const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
useEffect(() => { /* 30s polling */ }, []);

// NACHHER: MainTabs liest nur aus BadgeContext
const { chatUnreadTotal, pendingRequestsCount, pendingEventsCount } = useBadge();
// Kein useState, kein useEffect, kein Polling
```

### Beispiel: markRoomAsRead in BadgeContext

```typescript
const markRoomAsRead = useCallback((roomId: number) => {
  setChatUnreadByRoom(prev => {
    const roomUnread = prev[roomId] || 0;
    if (roomUnread === 0) return prev;

    const updated = { ...prev, [roomId]: 0 };
    // chatUnreadTotal und totalBadgeCount aktualisieren sich automatisch
    return updated;
  });

  // API Call zum Server (last_read_at Update)
  api.put(`/chat/rooms/${roomId}/read`).catch(err =>
    console.error('markRoomAsRead API failed:', err)
  );
}, []);
```

## State of the Art

| Alter Ansatz | Neuer Ansatz | Wann | Impact |
|-------------|-------------|------|--------|
| chatNotifications in AppContext | Alles in BadgeContext | Phase 27 | Eliminiert doppelte State-Verwaltung |
| Polling in MainTabs (30s/60s) | Polling in BadgeContext | Phase 27 | Zentrale Steuerung, konsistente Intervals |
| backgroundService nur Chat | backgroundService Chat+Antraege+Events | Phase 27 | App-Icon Badge korrekt fuer Admins |
| Badge.set mit nur Chat-Count | Badge.set mit Gesamt-Count | Phase 27 | App-Icon = TabBar-Summe |

## Empfohlene Reihenfolge

1. **BadgeContext erweitern** (Frontend) -- Neue Felder und Methoden hinzufuegen, alte API beibehalten
2. **MainTabs migrieren** -- Polling raus, useBadge() rein
3. **AppContext bereinigen** -- chatNotifications entfernen, Consumer umstellen
4. **ChatOverview anpassen** -- unreadByRoom aus BadgeContext nutzen
5. **backgroundService erweitern** (Backend) -- Badge-Query um Antraege+Events
6. **Verifizieren** -- Alle 4 Stellen (App-Icon, TabBar, Chat-Liste, Badge-Count) pruefen

**Begruendung Frontend-first:** Die Frontend-Aenderungen sind das Kernproblem (4 Systeme → 1). Der backgroundService ist nur ein Fallback fuer App-Icon wenn App geschlossen ist.

## Open Questions

1. **Provider-Reihenfolge in App.tsx**
   - Was wir wissen: BadgeContext braucht User-Info fuer Admin-spezifische Counts
   - Was unklar ist: Ob BadgeProvider aktuell innerhalb oder ausserhalb AppProvider liegt
   - Empfehlung: Pruefen und ggf. BadgeProvider innerhalb AppProvider nesten, oder User-Token direkt aus localStorage lesen

2. **newBadgesCount in MainTabs (Konfi-View)**
   - Was wir wissen: Konfis sehen Badge-Count fuer neue Badges auf dem Badges-Tab
   - Was unklar ist: Ob das in BadgeContext verschoben werden soll oder als Deferred gilt
   - Empfehlung: Laut CONTEXT.md ist "Badge fuer neue Achievements/Badges bei Konfis" deferred -- newBadgesCount bleibt vorerst in MainTabs

## Sources

### Primary (HIGH confidence)
- BadgeContext.tsx -- Aktueller Zustand, Interface, WebSocket-Listener
- AppContext.tsx -- chatNotifications State, refreshChatNotifications (Zeilen 60-172)
- MainTabs.tsx -- pendingRequestsCount/pendingEventsCount Polling (Zeilen 64-132)
- backgroundService.js -- updateAllUserBadges Badge-Query (Zeilen 39-87)
- pushService.js -- sendBadgeUpdate Methode (Zeilen 230-261)
- chat.js Routes -- unread_count Berechnung, /rooms Endpoint, read-status Update
- firebase.js -- Push-Nachricht Format, APNS Headers

### Secondary (MEDIUM confidence)
- CONTEXT.md -- User-Entscheidungen zu Badge-Kategorien und Refresh-Strategie

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Alles bereits im Projekt vorhanden, keine neuen Dependencies
- Architecture: HIGH - Klare Codebasis-Analyse, alle 4 Systeme dokumentiert
- Pitfalls: HIGH - Konkrete Code-Referenzen fuer jedes Risiko

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stabile Codebasis, keine externen Abhaengigkeiten)
