# Architecture Patterns

**Domain:** Push-Notification-System Verbesserung fuer Ionic/Capacitor App
**Researched:** 2026-03-05
**Confidence:** HIGH (basiert auf direkter Codebase-Analyse aller relevanten Dateien)

## Ist-Zustand: Bestehende Push-Architektur

### Komponenten-Uebersicht

```
Frontend (React 19 + Ionic 8 + Capacitor 7)
  |-- AppContext.tsx ......... Token-Registrierung, Chat-Notifications State, Push-Permission
  |-- BadgeContext.tsx ....... Device Badge Sync, WebSocket newMessage Listener
  |-- websocket.ts .......... Socket.io Client (Singleton)

Backend (Node.js Express + PostgreSQL)
  |-- server.js ............. Socket.io Setup, Route Mounting, BackgroundService.startAllServices()
  |-- push/firebase.js ...... Firebase Admin SDK, sendFirebasePushNotification()
  |-- services/pushService.js PushService Klasse, 14 statische Methoden, 663 Zeilen
  |-- services/backgroundService.js ... 3 setInterval-Services (Badge 5min, Reminder 15min, Pending 4h)
  |-- routes/notifications.js ........ Token CRUD (POST/DELETE /device-token, POST /test-push)
  |-- routes/chat.js ................. sendChatNotification + sendBadgeUpdate (2 Aufrufe)
  |-- routes/events.js ............... 8 PushService Aufrufe
  |-- routes/konfi.js ................ 4 PushService Aufrufe
  |-- routes/activities.js ........... 2 PushService Aufrufe
  |-- routes/badges.js ............... 1 PushService Aufruf (sendBadgeEarnedToKonfi)
  |-- routes/konfi-managment.js ...... 1 PushService Aufruf (sendBonusPointsToKonfi)

Datenbank (PostgreSQL)
  |-- push_tokens ........... user_id, user_type, token, platform, device_id, updated_at
  |-- event_reminders ....... event_id, user_id, reminder_type, sent_at (implizit, kein CREATE)
  |-- chat_messages ......... Basis fuer Badge Count Berechnung
  |-- chat_participants ..... last_read_at fuer Unread-Berechnung
```

### Alle 14 bestehenden Push-Flows

| # | Flow | PushService Methode | Aufgerufen in |
|---|------|---------------------|---------------|
| 1 | Neuer Antrag -> Admins | sendNewActivityRequestToAdmins | konfi.js |
| 2 | Antrag-Status -> Konfi | sendActivityRequestStatusToKonfi | activities.js |
| 3 | Aktivitaet zugewiesen -> Konfi | sendActivityAssignedToKonfi | activities.js |
| 4 | Bonuspunkte -> Konfi | sendBonusPointsToKonfi | konfi-managment.js |
| 5 | Badge erhalten -> Konfi | sendBadgeEarnedToKonfi | badges.js |
| 6 | Event-Anmeldung -> Konfi | sendEventRegisteredToKonfi | konfi.js |
| 7 | Event-Abmeldung -> Konfi | sendEventUnregisteredToKonfi | konfi.js |
| 8 | Event-Abmeldung -> Admins | sendEventUnregistrationToAdmins | konfi.js |
| 9 | Warteliste aufgerueckt -> Konfi | sendWaitlistPromotionToKonfi | events.js, konfi.js |
| 10 | Event abgesagt -> Konfis | sendEventCancellationToKonfis | events.js |
| 11 | Neues Event -> Org-Konfis | sendNewEventToOrgKonfis | events.js |
| 12 | Event-Anwesenheit -> Konfi | sendEventAttendanceToKonfi | events.js |
| 13 | Event-Erinnerung -> Konfi | sendEventReminderToKonfi | backgroundService.js |
| 14 | Events warten auf Verbuchung -> Admins | sendEventsPendingApprovalToAdmins | backgroundService.js |
| -- | Chat-Nachricht -> User | sendChatNotification | chat.js |
| -- | Badge Update (Silent) -> User | sendBadgeUpdate | chat.js, backgroundService.js |
| -- | Level-Up -> Konfi | sendLevelUpToKonfi | **EXISTIERT aber wird NIRGENDS aufgerufen!** |

---

## Ist-Analyse: Identifizierte Probleme

### Problem 1: Badge Count -- 4 Quellen, keine Single Source of Truth

```
Quelle 1: BadgeContext.tsx
  WebSocket 'newMessage' --> refreshFromAPI() --> GET /chat/rooms
  --> Zaehlt unread_count pro Room --> Badge.set()

Quelle 2: BackgroundService.updateAllUserBadges() [alle 5 Min]
  SQL: COUNT chat_messages WHERE created_at > last_read_at
  --> PushService.sendBadgeUpdate() --> Silent Push

Quelle 3: AppContext.tsx pushNotificationReceived Handler
  Push mit type='badge_update' --> setzt chatNotifications.totalUnreadCount

Quelle 4: chat.js Route POST /rooms/:roomId/mark-read
  Eigene SQL Query fuer Badge Count --> PushService.sendBadgeUpdate()

KONSEQUENZ: Race Conditions. Counts koennen divergieren.
```

### Problem 2: Token Lifecycle -- Lueckenhaft

```
- Logout loescht nur exaktes device_id/platform Match
- Fallback-IDs (Format: platform_timestamp_random) werden AKTIV ausgefiltert
  in getTokensForUser() durch: device_id NOT LIKE '%\\_\\_%'
  --> Tokens mit Fallback-IDs erhalten NIE Push-Notifications!
- Kein Cleanup bei Firebase-Errors (ungueltige Tokens bleiben fuer immer)
- Kein periodischer Cleanup veralteter Tokens
- CREATE TABLE IF NOT EXISTS in notifications.js Route (bei JEDEM POST Request)
```

### Problem 3: sendLevelUpToKonfi existiert aber wird nie aufgerufen

Die Methode ist in pushService.js definiert (Zeile 453-472) aber kein Route-Handler ruft sie auf. Weder in activities.js noch in konfi-managment.js noch in badges.js.

### Problem 4: firebase.js gibt bei Fehlern kein `tokenInvalid` Flag zurueck

```javascript
// AKTUELL: Fehler werden nur geloggt
} catch (error) {
    console.error('Firebase notification error:', error);
    return { success: false, error: error.message };
}
// --> Kein Unterschied zwischen ungueltigem Token und Netzwerk-Fehler
```

---

## Empfohlene Architektur: Neue Komponenten

### Komponente 1: NotificationTypeRegistry (NEU)

**Datei:** `backend/config/notificationTypes.js`
**Verantwortung:** Zentrale Definition aller Push-Notification-Types mit enabled/disabled Flags.

```javascript
const NOTIFICATION_TYPES = {
  // Activities
  new_activity_request:    { enabled: true, category: 'activities', target: 'admin' },
  activity_request_status: { enabled: true, category: 'activities', target: 'konfi' },
  activity_assigned:       { enabled: true, category: 'activities', target: 'konfi' },
  // Bonus
  bonus_points:            { enabled: true, category: 'points', target: 'konfi' },
  // Badges
  badge_earned:            { enabled: true, category: 'badges', target: 'konfi' },
  // Events
  event_registered:        { enabled: true, category: 'events', target: 'konfi' },
  event_unregistered:      { enabled: true, category: 'events', target: 'konfi' },
  event_unregistration:    { enabled: true, category: 'events', target: 'admin' },
  waitlist_promotion:      { enabled: true, category: 'events', target: 'konfi' },
  event_cancelled:         { enabled: true, category: 'events', target: 'konfi' },
  new_event:               { enabled: true, category: 'events', target: 'konfi' },
  event_attendance:        { enabled: true, category: 'events', target: 'konfi' },
  event_reminder:          { enabled: true, category: 'events', target: 'konfi' },
  events_pending_approval: { enabled: true, category: 'events', target: 'admin' },
  // Chat
  chat:                    { enabled: true, category: 'chat', target: 'all' },
  badge_update:            { enabled: true, category: 'system', target: 'all' },
  // NEU in v1.5
  new_registration:        { enabled: true, category: 'admin', target: 'admin' },
  level_up:                { enabled: true, category: 'progress', target: 'konfi' },
  points_milestone:        { enabled: true, category: 'progress', target: 'konfi' },
};

const isTypeEnabled = (type) => {
  const config = NOTIFICATION_TYPES[type];
  return config ? config.enabled : false;
};
```

**Integration:** PushService.sendToUser() prueft `isTypeEnabled(notification.data.type)` vor dem Senden. Code-Level Config, kein DB-Backing -- reicht fuer v1.5 (CFG-01, CFG-02).

### Komponente 2: BadgeCountService (NEU)

**Datei:** `backend/services/badgeCountService.js`
**Verantwortung:** Einzige Quelle fuer Badge-Count-Berechnung. Alle anderen Stellen konsumieren diesen Service.

```javascript
class BadgeCountService {
  static async calculateForUser(db, userId) {
    const { rows: [result] } = await db.query(`
      SELECT COALESCE(SUM(
        CASE WHEN cm.created_at > COALESCE(cp.last_read_at, '1970-01-01')
             AND cm.sender_id != $1
        THEN 1 ELSE 0 END
      ), 0)::int as total_unread
      FROM chat_participants cp
      JOIN chat_messages cm ON cm.room_id = cp.room_id
      WHERE cp.user_id = $1
    `, [userId]);
    return result.total_unread;
  }

  static async syncToDevices(db, userId) {
    const count = await this.calculateForUser(db, userId);
    await PushService.sendBadgeUpdate(db, userId, count);
    return count;
  }
}
```

**Konsumenten:**
- BackgroundService.updateAllUserBadges() --> `BadgeCountService.syncToDevices()` (statt eigene Query)
- chat.js mark-read Route --> `BadgeCountService.syncToDevices()` (statt eigene Query)
- Neuer Endpoint GET /api/chat/badge-count --> `BadgeCountService.calculateForUser()` (statt /chat/rooms parsen)

### Komponente 3: TokenCleanupService (NEU)

**Datei:** `backend/services/tokenCleanupService.js`
**Verantwortung:** Ungueltige und verwaiste Tokens aus der DB entfernen.

**Zwei Mechanismen:**

1. **Reaktiv (bei jedem Send):** firebase.js gibt `tokenInvalid: true` zurueck bei:
   - `messaging/registration-token-not-registered`
   - `messaging/invalid-registration-token`
   - `messaging/mismatched-credential`
   --> PushService.sendToUser() loescht Token sofort aus DB

2. **Proaktiv (alle 24h via BackgroundService):**
   - Tokens mit `updated_at` aelter als 90 Tage loeschen
   - Tokens von geloeschten Usern loeschen (LEFT JOIN users WHERE users.id IS NULL)
   - Duplikat-Tokens (gleicher Token-Wert, verschiedene Zeilen) auf neueste reduzieren

---

## Empfohlene Architektur: Modifikationen bestehender Komponenten

### Modifikation 1: push/firebase.js -- Token-Invalidierung erkennen

```javascript
// AENDERUNG: Unterscheide ungueltige Tokens von anderen Fehlern
} catch (error) {
    const invalidTokenCodes = [
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token',
      'messaging/mismatched-credential'
    ];
    const tokenInvalid = invalidTokenCodes.includes(error.code);
    return { success: false, error: error.message, tokenInvalid };
}
```

### Modifikation 2: PushService.sendToUser() -- Type-Check + Token-Cleanup

```javascript
static async sendToUser(db, userId, notification) {
  // NEU: Type-Check gegen Registry
  const type = notification.data?.type;
  if (type && !isTypeEnabled(type)) {
    return { success: true, sent: 0, message: 'Type disabled' };
  }

  const tokens = await this.getTokensForUser(db, userId);
  // ... bestehende Logik ...

  for (const token of tokens) {
    const result = await sendFirebasePushNotification(token.token, payload);
    // NEU: Ungueltige Tokens sofort entfernen
    if (result.tokenInvalid) {
      await db.query('DELETE FROM push_tokens WHERE id = $1', [token.id]);
    }
  }
}
```

### Modifikation 3: PushService.getTokensForUser() -- Fallback-ID-Filter entfernen

```javascript
// VORHER (filtert Fallback-IDs komplett aus):
AND device_id NOT LIKE '%\\_\\_%'

// NACHHER (alle Tokens senden, Fallback-IDs sind valide):
-- Filter komplett entfernt. Jeder Token wird versucht.
-- Ungueltige Tokens werden reaktiv per tokenInvalid geloescht.
```

**Begruendung:** Der Underscore-Filter schliesst alle Tokens mit Fallback-Device-IDs aus. Das ist der Kern von TKN-02 -- diese Tokens werden nie erreicht. Mit reaktivem Cleanup (Modifikation 2) braucht man den Filter nicht mehr.

### Modifikation 4: notifications.js Route -- Logout + Table-Fix

1. **CREATE TABLE entfernen:** push_tokens Tabelle gehoert in DB-Init, nicht in Route-Handler.
2. **Logout erweitern:** DELETE loescht alle Tokens des Users auf dem Device (nicht nur exaktes Match).

```javascript
// VORHER: Loescht nur exaktes device_id + platform Match
// NACHHER: Loescht ALLE Tokens des Users auf diesem Device
router.delete('/device-token', verifyTokenRBAC, async (req, res) => {
  const { device_id } = req.body;
  const userId = req.user.id;
  // Alle Plattform-Tokens fuer dieses Device entfernen
  await db.query('DELETE FROM push_tokens WHERE user_id = $1 AND device_id = $2', [userId, device_id]);
  res.json({ success: true });
});
```

### Modifikation 5: AppContext.tsx -- Logout Token Cleanup + Token-Uebergabe

```typescript
// Bei Logout: Device-Tokens loeschen BEVOR Token/Auth entfernt wird
const handleLogout = async () => {
  try {
    const deviceInfo = await Device.getId();
    await api.delete('/notifications/device-token', {
      data: { device_id: deviceInfo.identifier }
    });
  } catch (err) { /* Fehler ignorieren */ }
  // ... bestehende Logout-Logik ...
};
```

### Modifikation 6: BadgeContext.tsx -- Vereinfachter API-Call

```typescript
// VORHER: Holt /chat/rooms und zaehlt manuell unread_count
const refreshFromAPI = useCallback(async () => {
  const response = await api.get('/chat/rooms');
  let totalUnread = 0;
  response.data.forEach((room: any) => { totalUnread += room.unread_count || 0; });
  setBadgeCount(totalUnread);
}, []);

// NACHHER: Holt dezidierten Badge-Endpoint (Single Source of Truth)
const refreshFromAPI = useCallback(async () => {
  const response = await api.get('/chat/badge-count');
  setBadgeCount(response.data.count);
}, []);
```

### Modifikation 7: BackgroundService -- Cleanup-Intervall + Event-Reminder-Fix

```javascript
static startAllServices(db) {
  this.startBadgeUpdateService(db);      // bestehend, 5 Min
  this.startEventReminderService(db);    // bestehend, 15 Min -- event_reminders Tabelle absichern
  this.startPendingEventsService(db);    // bestehend, 4h
  this.startTokenCleanupService(db);     // NEU, 24h
}
```

**Event-Reminder-Fix:** Die event_reminders Tabelle wird im Code referenziert aber nirgends erstellt. CREATE TABLE IF NOT EXISTS muss beim Service-Start ausgefuehrt werden.

---

## Komponentengrenzen (Soll-Zustand)

| Komponente | Verantwortung | Kommuniziert mit |
|-----------|---------------|-------------------|
| NotificationTypeRegistry | Type-Definitionen, enabled/disabled Flags | PushService (wird abgefragt vor Send) |
| PushService (modifiziert) | Push senden, Token-Invalidierung, Type-Guard | firebase.js, NotificationTypeRegistry, DB |
| BadgeCountService (neu) | Badge Count berechnen (Single Source of Truth) | DB (chat_messages, chat_participants) |
| TokenCleanupService (neu) | Verwaiste/ungueltige Tokens loeschen | DB (push_tokens) |
| BackgroundService (modifiziert) | Scheduling aller periodischen Tasks | BadgeCountService, TokenCleanupService, PushService |
| BadgeContext (modifiziert) | Device Badge Sync via neuen Endpoint | GET /api/chat/badge-count, WebSocket |
| AppContext (modifiziert) | Token-Registrierung, Logout-Cleanup | notifications.js Route |

---

## Datenfluss: Badge Count (Soll) -- Single Source of Truth

```
                  BadgeCountService.calculateForUser(db, userId)
                               |
          +--------------------+--------------------+
          |                    |                    |
  BackgroundService     chat.js mark-read    GET /api/chat/badge-count
  (alle 5 Min)          Route                (neuer Endpoint)
          |                    |                    |
  syncToDevices()       syncToDevices()       Return { count: N }
  --> Silent Push       --> Silent Push             |
                                              BadgeContext.tsx
                                              --> Badge.set(count)
                                              --> TabBar Badge Update

  WebSocket 'newMessage' --> BadgeContext.refreshFromAPI()
                         --> GET /api/chat/badge-count
```

**Vorher:** 4 unabhaengige Badge-Count-Berechnungen.
**Nachher:** 1 Berechnung (BadgeCountService), 3 Konsumenten.

---

## Datenfluss: Token Lifecycle (Soll) -- Vollstaendig

```
App Start / Login:
  PushNotifications.register() --> registration Event
  --> sendTokenToServer() --> POST /notifications/device-token
  --> Upsert mit Device.getId() als device_id
  --> Collision-Check: DELETE WHERE token=$1 AND user_id != $2

Token Refresh (App Resume, max alle 12h):
  appStateChange --> PushNotifications.register()
  --> updated_at wird in push_tokens aktualisiert

Logout:
  handleLogout() --> DELETE /notifications/device-token (device_id)
  --> Alle Tokens dieses Users auf diesem Device geloescht

User-Wechsel auf gleichem Device:
  Logout alter User --> Tokens geloescht
  Login neuer User --> Neuer Token registriert
  --> Token-Collision loescht evt. verwaiste Tokens

Reaktiver Cleanup (bei jedem Send):
  firebase.js --> tokenInvalid: true
  --> PushService.sendToUser() --> DELETE FROM push_tokens WHERE id = X

Proaktiver Cleanup (alle 24h):
  TokenCleanupService.cleanup()
  --> Tokens aelter 90 Tage
  --> Tokens geloeschter User
  --> Duplikat-Tokens konsolidieren
```

---

## DB-Aenderungen

### Bestehende Tabellen

```sql
-- push_tokens: Felder fuer Error-Tracking (fuer spaetere Erweiterung)
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0;
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;
```

### Tabellen absichern

```sql
-- event_reminders: Wird im Code referenziert aber nirgends erstellt
CREATE TABLE IF NOT EXISTS event_reminders (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  reminder_type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id, reminder_type)
);
```

### push_tokens CREATE TABLE entfernen

Die notifications.js Route fuehrt bei JEDEM POST /device-token ein CREATE TABLE IF NOT EXISTS aus. Das gehoert in die DB-Initialisierung (database.js oder Init-Script), nicht in den Route-Handler.

---

## Fehlende Push-Flows (neu zu implementieren)

### Flow: Admin-Push bei neuer Konfi-Registrierung (FLW-02)

**Wo integrieren:** `backend/routes/auth.js` im Register-Endpoint, nach erfolgreichem User-Anlegen.

```javascript
// Nach: INSERT INTO users ... mit role='konfi'
await PushService.sendNewRegistrationToAdmins(db, organization_id, display_name);
```

**Neue PushService Methode:** `sendNewRegistrationToAdmins()` -- analog zu `sendNewActivityRequestToAdmins()`.

### Flow: Level-Up Push (FLW-03)

**Wo integrieren:** `backend/routes/badges.js` in `checkAndAwardBadges()`, wo Levels berechnet werden. Oder in `activities.js` / `konfi-managment.js` nach Punkte-Vergabe, wo Level-Check passiert.

**PushService Methode existiert bereits:** `sendLevelUpToKonfi()` -- muss nur aufgerufen werden.

**Wichtig:** Level-Up muss erkannt werden = vorheriges Level speichern, nach Punkte-Aenderung vergleichen.

### Flow: Punkte-Meilenstein Push (FLW-04)

**Wo integrieren:** Nach jeder Punkte-Aenderung (activities.js, konfi-managment.js Bonus), pruefen ob Mindestpunkte fuer Gottesdienst oder Gemeinde erstmals erreicht.

**Neue PushService Methode:** `sendPointsMilestoneToKonfi(db, konfiId, type, currentPoints, requiredPoints)`

**Erkennung:** Settings-Tabelle hat `min_gottesdienst_points` und `min_gemeinde_points`. Vergleich vorher/nachher noetig.

---

## Patterns to Follow

### Pattern 1: Fire-and-Forget Push (BESTEHEND -- beibehalten)

Push-Notifications werden mit try/catch gesendet, Fehler werden geloggt aber nicht propagiert. Push-Fehler sollen nie eine eigentliche Operation blockieren.

```javascript
// Bestehender Pattern in allen Route-Handlern:
try {
  await PushService.sendActivityAssignedToKonfi(db, konfiId, ...);
} catch (pushErr) {
  // Push-Fehler ignorieren, Operation war erfolgreich
}
```

### Pattern 2: Background Service als setInterval (BESTEHEND -- erweitern)

Periodische Tasks laufen als setInterval im Node.js-Prozess. Einzelne Docker-Instanz, kein Cluster, kein separater Scheduler noetig.

### Pattern 3: Centralized Type Guard (NEU)

Jeder Push geht durch isTypeEnabled() Check. Der Check passiert in sendToUser() und sendToMultipleUsers() -- nur an EINER Stelle. Route-Handler muessen sich nicht darum kuemmern.

### Pattern 4: WebSocket fuer Foreground, Push fuer Background (BESTEHEND)

Chat-Nachrichten nutzen beide Kanaele parallel. WebSocket ist schneller fuer Foreground-Updates, Push ist zuverlaessiger fuer Background-Notifications.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Multiple Badge Count Berechnungen

**Was:** Badge Count wird an 4 Stellen unabhaengig berechnet.
**Stattdessen:** BadgeCountService als Single Source of Truth.

### Anti-Pattern 2: Token-Fehler ignorieren

**Was:** Firebase-Send-Fehler werden geloggt, Token bleibt in DB.
**Stattdessen:** tokenInvalid Flag, sofortige Loeschung.

### Anti-Pattern 3: CREATE TABLE in Route-Handler

**Was:** notifications.js erstellt push_tokens Tabelle bei jedem POST.
**Stattdessen:** Tabellen-Erstellung in DB-Init.

### Anti-Pattern 4: Fallback Device-IDs ausfiltern

**Was:** getTokensForUser() filtert device_id NOT LIKE '%\\_\\_%' -- schliesst Fallback-IDs komplett aus.
**Stattdessen:** Filter entfernen, ungueltige Tokens reaktiv per tokenInvalid loeschen.

---

## Build-Reihenfolge (Abhaengigkeiten beachtet)

```
Phase 1: Foundation (keine Abhaengigkeiten)
  |-- NotificationTypeRegistry erstellen (CFG-01, CFG-02)
  |-- push_tokens: error_count/last_error_at Felder hinzufuegen
  |-- event_reminders Tabelle absichern (CREATE IF NOT EXISTS)
  |-- CREATE TABLE aus notifications.js Route entfernen

Phase 2: Token-Lifecycle (abhaengig von Phase 1)
  |-- firebase.js: tokenInvalid Return-Wert (CLN-01)
  |-- PushService.sendToUser(): Token-Invalidierung + Type-Check
  |-- PushService.getTokensForUser(): Fallback-ID-Filter entfernen (TKN-02)
  |-- notifications.js: Logout alle Tokens auf Device (TKN-01)
  |-- AppContext.tsx: Logout Token Cleanup (TKN-01, TKN-04)
  |-- Token-Refresh bei Resume verifizieren (TKN-03)

Phase 3: Badge Count Single Source of Truth (abhaengig von Phase 1)
  |-- BadgeCountService erstellen (BDG-01)
  |-- Neuer Endpoint GET /api/chat/badge-count (BDG-02)
  |-- BackgroundService: BadgeCountService nutzen
  |-- chat.js mark-read: BadgeCountService nutzen
  |-- BadgeContext.tsx: Neuen Endpoint nutzen (BDG-02)
  |-- AppContext chatNotifications von BadgeContext speisen (BDG-03, BDG-04)

Phase 4: Fehlende Push-Flows (abhaengig von Phase 1+2)
  |-- Level-Up Push aufrufen -- Methode existiert bereits (FLW-03)
  |-- Admin-Push bei neuer Registrierung (FLW-02)
  |-- Punkte-Meilenstein Push (FLW-04)
  |-- Event-Reminder-Service verifizieren/fixen (FLW-01)

Phase 5: Token Cleanup + Vollstaendigkeit (abhaengig von Phase 2)
  |-- TokenCleanupService erstellen (CLN-02)
  |-- BackgroundService: Cleanup-Intervall (24h) hinzufuegen
  |-- Alle 14+3 Push-Flows End-to-End verifizieren (CMP-01)
  |-- TabBar Badges fuer Antraege, Events, Chat synchronisieren
```

---

## Skalierbarkeit

| Aspekt | Aktuell (Beta, <20 User) | Bei 100 Usern | Bei 1000 Usern |
|--------|--------------------------|---------------|----------------|
| Push-Tokens | ~10-20 | ~100-200 | ~1000-2000 |
| Badge Sync (5min) | Kein Problem | ~200 Firebase Calls/5min | Firebase Multicast nutzen |
| Event Reminders | Funktioniert | Funktioniert | Bulk-Queries statt Einzel-Loop |
| Token Cleanup | Nicht vorhanden | Leicht noetig | Wichtig gegen DB-Bloat |

**Fuer v1.5 nicht noetig:** Firebase Multicast, Redis-basierter Scheduler, Message Queues. setInterval reicht bei aktueller Nutzerzahl.

---

## Quellen

- Direkte Codebase-Analyse: pushService.js (663 Zeilen, 14+2 Methoden), backgroundService.js (312 Zeilen, 3 Services), firebase.js (74 Zeilen), AppContext.tsx (584 Zeilen), BadgeContext.tsx (107 Zeilen), notifications.js (165 Zeilen), server.js (516 Zeilen)
- Firebase Admin SDK: Error Codes fuer Token-Invalidierung (HIGH confidence -- dokumentierte Firebase-API)
- Capacitor Push Notifications: Token-Lifecycle Verhalten (HIGH confidence -- im Code verifiziert)

---
*Architecture research for: Konfi Quest v1.5 Push-Notifications*
*Researched: 2026-03-05*
