# Technology Stack: v1.5 Push-Notifications

**Project:** Konfi Quest
**Researched:** 2026-03-05
**Scope:** Stack-Ergaenzungen fuer Scheduled Push, Token-Lifecycle, Badge-Count-Sync
**Overall Confidence:** HIGH

---

## Bestandsaufnahme (bereits installiert, NICHT aendern)

| Technology | Version | Zweck |
|------------|---------|-------|
| firebase-admin | ^12.7.0 | FCM Push-Versand via `admin.messaging().send()` |
| @capacitor/push-notifications | ^7.0.1 | Native Push-Registration und Token-Empfang |
| @capawesome/capacitor-badge | ^7.0.1 | App-Icon Badge-Count (get/set/clear) |
| @capacitor/device | ^7.0.1 | Device-ID fuer Token-Zuordnung |
| @capacitor/app | 7.0.1 | App-Lifecycle Events (Resume/Pause) |
| socket.io / socket.io-client | ^4.7.2 / ^4.8.1 | Echtzeit Chat + Badge-Updates |
| pg | ^8.16.3 | PostgreSQL (push_tokens Tabelle) |

---

## Neue Dependencies

### Backend: node-cron

| Technology | Version | Zweck | Warum |
|------------|---------|-------|-------|
| node-cron | ^3.0.3 | Event-Erinnerungen (FLW-01), Token-Cleanup (CLN-02) | Leichtgewichtig, null externe Abhaengigkeiten, crontab-Syntax, laeuft im selben Express-Prozess |

**Warum node-cron und nicht Alternativen:**

| Kategorie | Empfohlen | Alternative | Warum nicht |
|-----------|-----------|-------------|-------------|
| Scheduler | node-cron | node-schedule | node-schedule ist Date-basiert, fuer minuetliches Polling Overkill |
| Scheduler | node-cron | agenda | Braucht MongoDB. Massiv ueberengineered fuer 2 Cron-Jobs |
| Scheduler | node-cron | bull / bullmq | Redis-Abhaengigkeit. Sinnvoll bei hohem Durchsatz, hier unnoetig |
| Scheduler | node-cron | setTimeout-Ketten | Fragil, kein Cron-Ausdruck-Support, schwer zu warten |

**Installation:**

```bash
cd backend && npm install node-cron@^3.0.3
```

**Confidence:** HIGH — node-cron ist De-facto-Standard fuer Node.js-Cron-Jobs. 2095+ abhaengige Packages im npm-Registry.

### Frontend: Keine neuen Dependencies

Alle benoetigten Plugins sind bereits installiert. Kein neues Package noetig.

---

## Bestehende APIs besser nutzen (kein Install noetig)

### 1. firebase-admin: sendEachForMulticast (Batch-Versand)

**Status:** Bereits in firebase-admin ^12.7.0 enthalten, aktuell NICHT genutzt.

**Aktuelles Problem:** `pushService.js` sendet Nachrichten einzeln in einer for-Schleife. Bei Event-Erinnerungen an 30+ Konfis wird das langsam.

**Empfehlung:** `sendEachForMulticast` fuer Batch-Szenarien nutzen (bis zu 500 Tokens pro Aufruf):

```javascript
// AKTUELL (sequentiell, langsam):
for (const token of tokens) {
  await sendFirebasePushNotification(token.token, notification);
}

// BESSER (Batch, bis zu 500 Tokens):
const message = {
  tokens: tokenList,  // string[] mit FCM-Tokens
  notification: { title, body },
  data: { type: 'event_reminder', ... },
  apns: { payload: { aps: { badge: badgeCount, sound: 'default' } } }
};
const response = await admin.messaging().sendEachForMulticast(message);
// response.responses[i].success / response.responses[i].error
```

**Wichtig:** `sendMulticast()` ist deprecated seit firebase-admin v12. `sendEachForMulticast()` ist der aktuelle Ersatz.

**Wann verwenden:** Event-Erinnerungen (FLW-01), neue Events an alle Konfis, Event-Absagen. NICHT fuer Einzel-Push (Chat, Badge-Earned etc.).

**Confidence:** HIGH — Offizielle Firebase-Dokumentation.

### 2. firebase-admin: Error-Codes fuer Token-Cleanup (CLN-01)

Bereits in firebase-admin enthalten. Folgende Error-Codes identifizieren ungueltige Tokens:

```javascript
const INVALID_TOKEN_ERRORS = [
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered'
];
```

**Aktueller Zustand:** `firebase.js` loggt Fehler, loescht aber keine Tokens aus der DB. Jeder fehlgeschlagene Push an einen ungueltigen Token bleibt in der DB und erzeugt bei jedem Versand erneut einen Fehler.

**Aenderung:** Nach jedem Push-Fehler Error-Code pruefen. Bei ungueltigem Token: DELETE FROM push_tokens WHERE token = $1.

**Confidence:** HIGH — Firebase-Dokumentation listet Error-Codes explizit.

### 3. @capawesome/capacitor-badge: Badge.set() und Badge.clear()

**Bereits genutzt** in BadgeContext.tsx. Funktioniert korrekt auf iOS.

**Android-Problem (dokumentiert):** Auf Android verwaltet das System den Badge-Count basierend auf Notification-Center-Eintraegen SEPARAT von `Badge.set()`. `Badge.clear()` hat keinen Einfluss auf den System-Notification-Count.

**Workaround:** Beim App-Oeffnen `PushNotifications.removeAllDeliveredNotifications()` aufrufen (loescht Notification-Center), DANN `Badge.set({ count: serverCount })`. So stimmen System-Badge und App-Badge ueberein.

**Confidence:** MEDIUM — Dokumentiert in capawesome GitHub Issues (#203), Workaround muss auf Zielgeraeten getestet werden.

---

## Architektur-Entscheidungen fuer v1.5

### 1. Cron-Jobs: Im Express-Prozess, KEIN separater Worker

**Warum:** App laeuft in einem einzelnen Docker-Container. Separater Worker-Prozess waere Overhead ohne Nutzen. node-cron im Express-Prozess reicht fuer 2 Jobs.

**Geplante Jobs:**

| Job | Cron-Ausdruck | Zweck | Requirement |
|-----|---------------|-------|-------------|
| Event-Erinnerung | `*/15 * * * *` (alle 15 Min) | Prueft Events in den naechsten 24h/1h, sendet Push an angemeldete Konfis | FLW-01 |
| Token-Cleanup | `0 3 * * *` (taeglich 03:00) | Loescht Tokens aelter als 60 Tage, Tokens von geloeschten Usern | CLN-02 |

**Dateistruktur:**

```
backend/
  cron/
    index.js              # Startet alle Cron-Jobs
    eventReminders.js     # Event-Erinnerungen Logik
    tokenCleanup.js       # Token-Bereinigung Logik
  config/
    pushTypes.js          # Notification-Type Registry
```

### 2. Badge-Count: Server als Single Source of Truth (BDG-01)

**Aktueller Zustand (3 unabhaengige Quellen):**
- BadgeContext: Holt unread_count via `/chat/rooms` API
- Device-Badge: Wird via `Badge.set()` gesetzt
- Push-Payload: APNS badge-Count im Payload

**Problem:** Diese drei koennen divergieren. BadgeContext refresht nur bei WebSocket-Event, Push-Payload hat statischen Wert, Device-Badge wird nur bei State-Change aktualisiert.

**Loesung:**

```
PostgreSQL (chat_messages.read_at IS NULL) = Source of Truth

Ausspielwege (alle nutzen denselben Server-Count):
  1. Push-Payload: apns.payload.aps.badge = serverCount
  2. WebSocket: badgeUpdate-Event mit serverCount
  3. API: GET /chat/rooms liefert unread_count pro Raum

Frontend:
  - BadgeContext konsumiert Server-Count, berechnet NIE selbst
  - Badge.set() wird NUR mit Server-Count aufgerufen
  - Bei App-Resume: API-Refresh, dann Badge.set()
```

### 3. Token-Lifecycle: Bestehendes Schema reicht (TKN-01 bis TKN-04)

Die `push_tokens` Tabelle hat bereits alle benoetigten Felder:

```sql
push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,
  device_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform, device_id)
)
```

**Keine Schema-Aenderung noetig.** Logik-Aenderungen:

| Requirement | Was fehlt | Wo aendern |
|-------------|-----------|------------|
| TKN-01 (Logout-Cleanup) | Frontend ruft DELETE /device-token nicht zuverlaessig auf | AppContext.tsx Logout-Flow |
| TKN-02 (Fallback-ID) | `device_id NOT LIKE '%\\_\\_%'` filtert Fallback-IDs aus | pushService.js Query anpassen |
| TKN-03 (Token-Refresh) | Logik existiert in AppContext (12h Check), braucht nur Verifizierung | AppContext.tsx |
| TKN-04 (User-Wechsel) | DELETE WHERE token AND user_id != new_user existiert bereits | notifications.js (bereits korrekt) |

### 4. Push-Type Registry: Code-Level Config (CFG-01, CFG-02)

Kein neues Package noetig. Einfaches JavaScript-Objekt:

```javascript
// backend/config/pushTypes.js
const PUSH_TYPES = {
  chat_message:          { enabled: true,  label: 'Chat-Nachrichten' },
  event_reminder_1day:   { enabled: true,  label: 'Event-Erinnerung (1 Tag)' },
  event_reminder_1hour:  { enabled: true,  label: 'Event-Erinnerung (1 Stunde)' },
  new_activity_request:  { enabled: true,  label: 'Neuer Aktivitaets-Antrag' },
  activity_request_status: { enabled: true, label: 'Antrag genehmigt/abgelehnt' },
  badge_earned:          { enabled: true,  label: 'Badge erhalten' },
  level_up:              { enabled: true,  label: 'Level-Up' },
  points_milestone:      { enabled: true,  label: 'Punkte-Meilenstein' },
  new_event:             { enabled: true,  label: 'Neues Event' },
  event_registered:      { enabled: true,  label: 'Event-Anmeldung' },
  event_unregistered:    { enabled: true,  label: 'Event-Abmeldung' },
  event_cancelled:       { enabled: true,  label: 'Event abgesagt' },
  event_attendance:      { enabled: true,  label: 'Anwesenheit verbucht' },
  waitlist_promotion:    { enabled: true,  label: 'Wartelisten-Nachrueecker' },
  bonus_points:          { enabled: true,  label: 'Bonuspunkte' },
  activity_assigned:     { enabled: true,  label: 'Aktivitaet zugewiesen' },
  events_pending:        { enabled: true,  label: 'Events warten auf Verbuchung' },
  new_registration:      { enabled: true,  label: 'Neue Konfi-Registrierung' },
};

module.exports = PUSH_TYPES;
```

**PushService nutzt Registry:** Vor jedem Push pruefen ob `PUSH_TYPES[type].enabled === true`.

**Warum kein DB-Config:** Per-User-Preferences sind out-of-scope fuer v1.5 (PREF-01/PREF-02 in Future Requirements). Code-Level Defaults reichen.

---

## Was NICHT hinzugefuegt werden soll

| Technologie | Warum nicht |
|-------------|-------------|
| Redis / BullMQ | Kein Queue-System noetig. Max 50-100 Push-Nachrichten pro Event-Erinnerung. node-cron + Batch-Versand reicht. |
| @capacitor-firebase/messaging | Wuerde bestehende Push-Integration (Custom FCM Plugin in AppDelegate.swift) komplett ersetzen. Zu grosses Risiko fuer v1.5. |
| web-push | Out of scope — App ist native-only |
| Notification-Preferences DB-Tabelle | Out of scope fuer v1.5, Code-Level Config reicht |
| Separate Worker-Prozesse / PM2 | Ein Docker-Container, ein Prozess. Cron-Jobs sind CPU-leicht (DB-Query + HTTP-Calls). |
| node-schedule | Bietet Date-basiertes Scheduling, aber Event-Erinnerungen brauchen Polling-Pattern (alle 15 Min pruefen), nicht punkt-genaue Ausfuehrung |
| Firebase Cloud Functions | Backend laeuft self-hosted auf Hetzner, nicht auf Google Cloud. Cloud Functions waeren ein separates Deployment. |

---

## Zusammenfassung: Was sich aendert

```
Backend:
  + npm install node-cron@^3.0.3    # Einzige neue Dependency
  + backend/cron/index.js            # Cron-Job Starter
  + backend/cron/eventReminders.js   # Event-Erinnerungen (FLW-01)
  + backend/cron/tokenCleanup.js     # Token-Bereinigung (CLN-02)
  + backend/config/pushTypes.js      # Notification-Type Registry (CFG-01, CFG-02)
  ~ backend/push/firebase.js         # Error-Handling + Token-Cleanup (CLN-01)
  ~ backend/services/pushService.js  # sendEachForMulticast + Badge-Count + Type-Check
  ~ backend/routes/notifications.js  # Logout-Token-Cleanup robuster (TKN-01)
  ~ backend/server.js                # Cron-Jobs starten

Frontend:
  (keine neuen Dependencies)
  ~ BadgeContext.tsx                  # Server als Source of Truth (BDG-01)
  ~ AppContext.tsx                    # Logout: Token loeschen (TKN-01), Fallback-ID Fix (TKN-02)
```

---

## Requirement-zu-Stack Mapping

| Requirement | Stack-Komponente | Neue Dependency? |
|-------------|------------------|------------------|
| TKN-01 | AppContext.tsx + notifications.js | Nein |
| TKN-02 | pushService.js Query-Fix | Nein |
| TKN-03 | AppContext.tsx (bereits implementiert) | Nein |
| TKN-04 | notifications.js (bereits implementiert) | Nein |
| CLN-01 | firebase.js Error-Code Check | Nein |
| CLN-02 | node-cron + tokenCleanup.js | **Ja: node-cron** |
| FLW-01 | node-cron + eventReminders.js + sendEachForMulticast | **Ja: node-cron** |
| FLW-02 | pushService.js (neuer Flow) | Nein |
| FLW-03 | pushService.js (sendLevelUpToKonfi existiert bereits!) | Nein |
| FLW-04 | pushService.js (neuer Flow, Meilenstein-Check) | Nein |
| CFG-01 | config/pushTypes.js | Nein |
| CFG-02 | config/pushTypes.js | Nein |
| BDG-01 | Server-Side Count Berechnung | Nein |
| BDG-02 | BadgeContext.tsx + APNS Payload | Nein |
| BDG-03 | BadgeContext.tsx / AppContext.tsx | Nein |
| BDG-04 | BadgeContext.tsx State-Sync | Nein |
| CMP-01 | Audit bestehender Push-Flows | Nein |

**Ergebnis:** 1 neue Dependency (node-cron). Rest sind Code-Aenderungen an bestehenden Dateien.

---

## Quellen

- [node-cron npm](https://www.npmjs.com/package/node-cron) — v3.0.3 stable, aktiv gepflegt (Confidence: HIGH)
- [Firebase Admin SDK: Send Messages](https://firebase.google.com/docs/cloud-messaging/send/admin-sdk) — sendEachForMulticast Dokumentation (Confidence: HIGH)
- [Firebase Messaging API Reference](https://firebase.google.com/docs/reference/admin/node/firebase-admin.messaging.messaging) — Error-Codes, Batch-APIs (Confidence: HIGH)
- [Capawesome Badge Plugin](https://capawesome.io/plugins/badge/) — Badge-Count Management (Confidence: HIGH)
- [Capacitor Push Notifications API](https://capacitorjs.com/docs/apis/push-notifications) — Token-Registration, removeAllDeliveredNotifications (Confidence: HIGH)
- [Android Badge Count Issue #203](https://github.com/capawesome-team/capacitor-plugins/issues/203) — Badge.clear() vs System-Count (Confidence: MEDIUM)
- [Firebase sendMulticast Deprecation](https://community.flutterflow.io/discussions/post/the-messaging-sendmulticast-function-is-no-longer-supported-in-firebase-KVt3BAb65dNRhk6) — sendMulticast deprecated, sendEachForMulticast empfohlen (Confidence: HIGH)

---

*Stack research for: Konfi Quest v1.5 Push-Notifications*
*Researched: 2026-03-05*
