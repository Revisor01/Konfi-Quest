# Domain Pitfalls: v1.5 Push-Notifications

**Domain:** Push-Notification-System Verbesserungen (Token-Lifecycle, Scheduled Notifications, Badge-Count-Sync)
**Researched:** 2026-03-05
**Confidence:** HIGH (basierend auf Codebase-Analyse, Firebase-Dokumentation, Capacitor-Dokumentation, Community-Issues)

## Critical Pitfalls

Fehler die Rewrites oder schwerwiegende Probleme verursachen.

### Pitfall 1: Badge-Count wird von 4 unabhaengigen Systemen verwaltet — kein Single Source of Truth

**What goes wrong:**
Badge-Counts divergieren zwischen App-Icon, TabBar und Chat-Liste. User sieht "3" auf dem App-Icon aber "0" im Chat-Tab, oder umgekehrt. Schlimmstenfalls akkumulieren Badges endlos und zeigen unrealistische Zahlen (z.B. "47 ungelesen" obwohl alles gelesen wurde).

**Why it happens:**
Aktuell verwalten 4 verschiedene Systeme den Badge-Count unabhaengig voneinander:
1. **BadgeContext** (`BadgeContext.tsx`): Holt `unread_count` via `/chat/rooms` API, setzt Device-Badge via `@capawesome/capacitor-badge`
2. **AppContext** (`AppContext.tsx`): Hat eigenen `chatNotifications` State mit `totalUnreadCount` und `unreadByRoom`, kommentierte Badge-Logik ("Badge logic removed - now handled by BadgeContext"), aber State wird trotzdem weiter aktualisiert
3. **PushService** (`pushService.js`): Sendet `badge: 1` hardcoded bei den meisten Notifications, `sendBadgeUpdate` sendet beliebigen Count
4. **Capacitor Badge Plugin**: Wird direkt in `BadgeContext` und indirekt ueber APNS Payload gesetzt

Die Systeme widersprechen sich: AppContext deaktiviert seine Badge-Logik ("Badge logic removed"), fuehrt aber weiterhin Badge-relevante Berechnungen durch (Zeile 308-313: liest Device-Badge bei Start und setzt es als `totalUnreadCount`). BadgeContext refresht via API bei jedem WebSocket `newMessage` Event. PushService sendet `badge: 1` als statischen Wert unabhaengig vom echten Count.

**Consequences:**
- App-Icon zeigt falsche Zahl (APNS setzt Badge auf das was der Server sendet — aktuell immer "1")
- TabBar-Badges und App-Icon-Badge sind nicht synchron
- User oeffnet Chat, liest alles, App-Icon zeigt weiterhin Badge
- Bei vielen Notifications akkumuliert der Badge-Count auf dem Icon nicht korrekt (jede Push setzt auf "1" statt zu inkrementieren)

**Prevention:**
- Badge-Count MUSS serverseitig berechnet werden — nur der Server kennt den echten Unread-Count
- Ein einziges System (BadgeContext) konsumiert den serverseitigen Count
- PushService muss den echten Count vom Server holen und in den APNS Payload einsetzen (nicht `badge: 1`)
- AppContext-Badge-Logik komplett entfernen (nicht nur auskommentieren)
- APNS Badge im Push-Payload ist der einzige Weg, den App-Icon Badge im Background zu aktualisieren

**Detection:**
- App-Icon Badge zeigt immer "1" unabhaengig von der tatsaechlichen Anzahl
- Badge bleibt nach dem Lesen aller Nachrichten bestehen
- Unterschiedliche Zahlen auf App-Icon vs. TabBar vs. Chat-Liste

**Phase to address:** Fruehe Phase — vor allen neuen Push-Flows, weil jeder neue Flow den Badge-Count beeinflussen muss

---

### Pitfall 2: Fallback-Device-IDs erzeugen Ghost-Tokens die nie bereinigt werden

**What goes wrong:**
Die `push_tokens`-Tabelle fuellt sich mit Token-Eintraegen, die nie wieder geloescht werden koennen. Push-Notifications werden an tote Tokens gesendet, was Firebase-Quota verbraucht und die Zustellung an echte Geraete verzoegert.

**Why it happens:**
Der aktuelle Code hat zwei separate Device-ID-Quellen:
1. **Capacitor `Device.getId()`** — liefert eine stabile, geraete-spezifische ID
2. **Fallback-Generierung** (`AppContext.tsx` Zeile 42-43): `${platform}_${Date.now()}_${Math.random()...}` — generiert bei jedem Fehlschlag eine NEUE ID

Das Fallback wird gespeichert in `localStorage`, aber:
- Wenn `Device.getId()` einmal fehlschlaegt (z.B. Timing-Problem beim App-Start) wird eine Fallback-ID generiert
- Beim naechsten App-Start funktioniert `Device.getId()` und liefert die echte ID
- Jetzt existieren ZWEI Eintraege in `push_tokens`: einer mit der echten ID, einer mit der Fallback-ID
- Die Fallback-ID wird beim Logout nie korrekt geloescht (Logout nutzt `Device.getId()`, nicht die Fallback-ID)

Zusaetzlich: `getTokensForUser` in `pushService.js` (Zeile 11) filtert Device-IDs mit Underscores via `AND device_id NOT LIKE '%\\_\\_%'` — das soll Fallback-IDs ausfiltern, filtert aber auch legitime Device-IDs mit Underscores. Diese gefilterten Tokens bleiben in der DB, werden nie genutzt, nie geloescht.

**Consequences:**
- DB-Tabelle waechst unbegrenzt
- Push-Sends an tote Tokens erzeugen Firebase-Errors die geloggt aber nicht behandelt werden
- Logout loescht nur den Token zur aktuellen Device-ID, nicht den Fallback-Token

**Prevention:**
- Fallback-Device-ID-Generierung entfernen — wenn `Device.getId()` fehlschlaegt, Push-Registrierung abbrechen und spaeter erneut versuchen
- Token-Cleanup-Job der Tokens aelter als 60 Tage loescht
- Bei Token-Registrierung alle alten Tokens des gleichen Users mit dem gleichen FCM-Token loeschen (nicht nur andere User)
- `NOT LIKE '%\\_\\_%'` Filter entfernen und stattdessen explizit ungueltige Tokens markieren

**Detection:**
- `SELECT COUNT(*) FROM push_tokens GROUP BY user_id` zeigt User mit >2 Tokens pro Plattform
- Firebase-Error-Logs zeigen wiederholt `messaging/registration-token-not-registered`

---

### Pitfall 3: Firebase-Error bei ungueltigem Token wird geloggt aber Token nie aus DB entfernt

**What goes wrong:**
Einmal registrierte Tokens bleiben fuer immer in der Datenbank, auch wenn das Geraet die App deinstalliert hat, der FCM-Token expired ist, oder das APNS-Token ungueltig wurde. Jeder Push-Versuch an diese Tokens erzeugt einen Firebase-Error, kostet Latenz und verbraucht Firebase-Quota.

**Why it happens:**
In `pushService.js` werden Firebase-Errors nur geloggt:
```javascript
} catch (error) {
  console.error('Push failed for token:', error.message);
  errorCount++;
}
```
Es gibt keine Pruefung des Error-Codes und keine Entfernung des Tokens aus der Datenbank.

Firebase liefert spezifische Error-Codes die eine Bereinigung triggern sollten:
- `messaging/registration-token-not-registered` — Token existiert nicht mehr (App deinstalliert)
- `messaging/invalid-argument` — Token-Format ist ungueltig
- `messaging/invalid-registration-token` — Token ist malformed

Laut [Firebase Best Practices](https://firebase.google.com/docs/cloud-messaging/manage-tokens): Tokens sollten bei diesen Errors sofort geloescht werden. Zusaetzlich sollten Tokens die >60 Tage nicht aktualisiert wurden als "stale" betrachtet werden.

**Consequences:**
- Jeder Push-Send-Vorgang dauert laenger (sequentielle Sends an alle Tokens inkl. toter)
- Firebase-Quota wird verschwendet
- Error-Logs werden mit wiederholten Fehlern geflutet
- Bei `sendToMultipleUsers` (z.B. Event-Notification an alle Konfis) multipliziert sich das Problem

**Prevention:**
- Error-Code-Pruefung in `sendFirebasePushNotification` oder im catch-Block von `sendToUser`:
  - Bei `messaging/registration-token-not-registered`, `messaging/invalid-argument`: Token sofort aus DB loeschen
  - Bei `messaging/internal-error`: Retry mit Backoff, Token behalten
  - Bei `messaging/quota-exceeded`: Alle Sends pausieren
- Periodischer Cleanup-Job (Cron, taeglich): Tokens loeschen deren `updated_at` aelter als 60 Tage ist
- `sendFirebasePushNotification` in `firebase.js` muss den Error WERFEN (nicht `{ success: false }` returnen) damit der Caller den Error-Code pruefen kann — aktuell wird der Error geschluckt (Zeile 65-68)

**Detection:**
- `SELECT COUNT(*), MAX(updated_at) FROM push_tokens` — wenn aelteste Tokens Monate alt sind, fehlt Cleanup
- Firebase Console zeigt hohe Error-Rate bei Cloud Messaging

---

## Moderate Pitfalls

### Pitfall 4: Scheduled Event-Erinnerungen ohne Persistenz — Server-Restart loescht alle Jobs

**What goes wrong:**
Event-Erinnerungen (FLW-01: "X Stunden vor Event-Beginn") werden als In-Memory Cron-Jobs geplant. Bei einem Server-Restart (Docker-Rebuild, Deployment) gehen alle geplanten Jobs verloren. Konfis erhalten keine Erinnerungen fuer bereits erstellte Events.

**Why it happens:**
Node-Cron und aehnliche In-Memory-Scheduler verlieren ihren State bei Process-Restart. Docker-Container werden bei jedem `docker-compose up -d --build` neu erstellt. Das aktuelle Deployment-Pattern (`git pull && docker-compose down && docker-compose up -d --build`) garantiert einen Restart bei jedem Deploy.

**Prevention:**
Zwei Ansaetze, nach Komplexitaet:

**Einfacher Ansatz (empfohlen):** Polling-basiert statt Scheduler
- Cron-Job laeuft alle 5 Minuten und prueft: "Welche Events beginnen in den naechsten 1h / 24h?"
- Query: `SELECT * FROM events WHERE start_date BETWEEN NOW() AND NOW() + INTERVAL '1 hour' AND reminder_sent = false`
- `reminder_sent` Boolean-Spalte in `events` oder separate `event_reminders` Tabelle
- Ueberlebt Restarts automatisch weil der State in der Datenbank liegt

**Komplexerer Ansatz:** Job-Queue (Bull/BullMQ mit Redis)
- Overkill fuer diesen Use-Case, erfordert Redis-Setup

**Detection:**
- Event-Erinnerungen funktionieren nach Deploy nicht mehr
- Keine Erinnerungen fuer Events die vor dem letzten Restart erstellt wurden

---

### Pitfall 5: Token-Cleanup bei Logout schlaegt fehl wenn JWT bereits expired ist

**What goes wrong:**
Wenn ein Konfi die App laengere Zeit nicht oeffnet und der JWT (90 Tage Laufzeit) ablaeuft, kann der Token nicht mehr per API geloescht werden. Der Logout-Call in `auth.ts` (Zeile 81) `api.delete('/notifications/device-token')` benoetigt einen gueltigen JWT (`verifyTokenRBAC` Middleware). Bei expirtem JWT erhaelt der Call `401 Unauthorized`, der Push-Token bleibt in der DB.

**Why it happens:**
Das DELETE-Endpoint fuer Device-Tokens ist durch `verifyTokenRBAC` geschuetzt. Logisch korrekt (nur eigene Tokens loeschen), aber problematisch beim "erzwungenen Logout" nach Token-Expiry. Der Logout-Code faengt den Fehler ab (Zeile 88-98: "Logout sollte trotzdem funktionieren"), aber der Push-Token wird nicht entfernt.

**Consequences:**
- Verwaiste Tokens in der DB die bei jedem Push-Send getestet werden
- Nach Passwort-Reset und Neu-Login: Alter Token existiert noch parallel zum neuen
- Bei User-Loeschung: Token verwaist komplett

**Prevention:**
- Token-Cleanup NICHT nur beim Logout machen, sondern auch:
  1. Bei Token-Registrierung: Alle alten Tokens des gleichen Users auf dem gleichen Device loeschen (bereits teilweise implementiert via UPSERT)
  2. Periodischer Server-Side Cleanup: Tokens von deaktivierten/geloeschten Usern entfernen
  3. Tokens deren `updated_at` > 90 Tage (JWT-Laufzeit) alt ist automatisch loeschen
- Alternative: Token-Delete-Endpoint OHNE Auth-Requirement, aber mit Device-ID + User-ID als Identifikation (Sicherheitsabwaegung)

---

### Pitfall 6: Push-Listener in AppContext werden bei jedem User-State-Change neu registriert

**What goes wrong:**
Push-Notification-Listener (`pushNotificationReceived`, `pushNotificationActionPerformed`, `registration`) werden mehrfach registriert. Notifications werden doppelt oder dreifach verarbeitet. Navigation bei Notification-Tap fuehrt zu falschem Ziel oder wird mehrfach ausgefuehrt.

**Why it happens:**
In `AppContext.tsx` (Zeile 438-547) wird `setupPushNotifications` in einem `useEffect` mit Dependency `[user]` ausgefuehrt. Jedes Mal wenn `setUser()` aufgerufen wird (auch mit dem gleichen User-Objekt), werden neue Listener registriert. Die alten Listener werden NICHT entfernt — es gibt kein Cleanup in der Return-Funktion des `useEffect`.

`PushNotifications.addListener` registriert Listener kumulativ. Ohne `removeAllListeners()` oder individuellem Listener-Cleanup stacken sich die Listener.

Zusaetzlich: Das zweite `useEffect` (Zeile 344-378, `handleNativeFCMToken`) registriert einen `window.addEventListener('fcmToken', ...)` — dieser wird korrekt aufgeraeumt. Aber das dritte `useEffect` (Zeile 438-547) hat KEINEN Cleanup.

**Consequences:**
- Notification-Handler wird 2-3x aufgerufen pro Notification
- Navigation bei Tap fuehrt zu Race-Conditions (mehrere `window.location.href` Zuweisungen)
- Performance-Degradation durch Listener-Akkumulation

**Prevention:**
- `useEffect` Cleanup-Funktion muss alle registrierten Listener entfernen:
  ```typescript
  return () => {
    PushNotifications.removeAllListeners();
  };
  ```
- ABER: `removeAllListeners()` entfernt ALLE Listener global — auch die aus anderen Effects. Besser: Individuelle Listener-Referenzen speichern und einzeln entfernen
- `pushAlreadyRegistered` Flag schuetzt nur vor doppelter Permission-Anfrage, nicht vor doppelten Listenern
- Capacitor-Doku empfiehlt: Listener in einer zentralen Stelle registrieren, nicht in React-Lifecycle-Hooks

---

### Pitfall 7: sendToMultipleUsers ist sequentiell — bei 100+ Konfis blockiert ein Push-Send minutenlang

**What goes wrong:**
Die Methode `sendToMultipleUsers` (Zeile 65-72) iteriert sequentiell ueber alle User-IDs. Fuer jeden User werden alle Tokens geladen (DB-Query) und dann sequentiell an Firebase gesendet. Bei einer Organisation mit 50 Konfis und je 2 Devices: 50 * 2 = 100 sequentielle Firebase-API-Calls.

**Why it happens:**
Einfache `for...of` Loop ohne Parallelisierung:
```javascript
for (const userId of userIds) {
  const result = await this.sendToUser(db, userId, notification);
  results.push({ userId, ...result });
}
```

**Consequences:**
- Event-Erstellung blockiert den Express-Handler waehrend alle Pushes gesendet werden
- API-Response an den Admin kommt erst nach allen Push-Sends zurueck
- Bei Firebase-Timeout eines einzelnen Tokens blockiert der gesamte Vorgang

**Prevention:**
- Push-Sends NICHT im Request-Handler ausfuehren — in eine Queue auslagern oder `setImmediate()` / `process.nextTick()` nutzen
- `Promise.allSettled()` statt sequentiellem Loop fuer Parallelisierung
- Firebase `sendEachForMulticast()` API nutzen fuer Batch-Sends (bis zu 500 Tokens pro Call)
- Response an Admin sofort zurueckgeben, Pushes asynchron im Hintergrund senden

---

### Pitfall 8: APNS-spezifische Konfiguration fehlt fuer Silent Pushes und Badge-Only Updates

**What goes wrong:**
Badge-Count-Updates via `sendBadgeUpdate` (Zeile 156-187) senden eine Notification ohne `title` und `body`. iOS behandelt Notifications ohne Content als Silent Pushes, die spezielle APNS-Header benoetigen (`apns-push-type: background`, `content-available: 1`). Ohne diese Header wird die Notification von iOS verworfen.

**Why it happens:**
In `firebase.js` (Zeile 49-61) werden APNS-Header statisch gesetzt:
```javascript
headers: {
  'apns-push-type': 'alert',
  'apns-priority': '10',
}
```
`apns-push-type: alert` erfordert einen sichtbaren Notification-Body. Badge-Only Updates sind kein "alert" — sie sollten `apns-push-type: background` mit `apns-priority: 5` und `content-available: 1` verwenden.

**Consequences:**
- Badge-Count-Updates kommen auf iOS nicht an
- App-Icon Badge wird nicht aktualisiert wenn die App im Background ist
- Nur bei App-Oeffnung wird der Badge korrekt gesetzt (via API-Call)

**Prevention:**
- `sendFirebasePushNotification` muss unterscheiden zwischen Alert-Pushes (mit title/body) und Silent-Pushes (badge-only)
- Fuer Silent Pushes:
  ```javascript
  apns: {
    headers: {
      'apns-push-type': 'background',
      'apns-priority': '5',
    },
    payload: {
      aps: {
        'content-available': 1,
        badge: badgeCount,
      }
    }
  }
  ```
- Android hat dieses Problem nicht — FCM auf Android setzt Data-Messages ohne Notification-Content korrekt zu

---

## Minor Pitfalls

### Pitfall 9: CREATE TABLE IF NOT EXISTS in Route-Handler statt Migration

**What goes wrong:**
`notifications.js` (Zeile 33-41) fuehrt `CREATE TABLE IF NOT EXISTS push_tokens` bei JEDEM `POST /device-token` Request aus. Bei parallelen Requests kann es zu Race-Conditions kommen. Schema-Aenderungen (z.B. neue Spalte `organization_id`) koennen nicht sauber durchgefuehrt werden.

**Prevention:**
- Schema-Definition in eine separate Migrations-Datei verschieben
- `CREATE TABLE` aus dem Route-Handler entfernen
- Neue Spalten via `ALTER TABLE` Migration hinzufuegen

---

### Pitfall 10: Notification-Type Registry fehlt — neue Push-Flows erfordern Aenderungen an 3+ Stellen

**What goes wrong:**
Beim Hinzufuegen eines neuen Push-Flows (z.B. "Level-Up Notification") muessen Aenderungen an mehreren Stellen vorgenommen werden: PushService (neuen Method), Route (Call), Frontend Navigation Handler (`pushNotificationActionPerformed` Switch-Case in AppContext), ggf. BadgeContext. Wenn eine Stelle vergessen wird, fehlt die Navigation bei Tap oder der Badge-Count stimmt nicht.

**Prevention:**
- Zentrale Notification-Type Registry als Konfiguration:
  ```javascript
  const NOTIFICATION_TYPES = {
    level_up: { enabled: true, navigateTo: (user) => user.type === 'admin' ? '/admin/konfis' : '/konfi/dashboard' },
    // ...
  };
  ```
- Frontend-Navigation-Handler liest aus dieser Registry statt hardcoded Switch-Case
- Neue Types muessen nur an EINER Stelle registriert werden

---

### Pitfall 11: Token-Registrierung sendet Platform als "web" auf Desktop-Browsern

**What goes wrong:**
Die Validierung in `notifications.js` erlaubt `platform: 'web'` (Zeile 12). Capacitor auf Desktop gibt `web` als Platform zurueck. Ein Token mit Platform `web` ist kein FCM-Token und kann nicht fuer Push-Notifications verwendet werden. Der Token wird gespeichert aber jeder Push-Versand an diesen Token schlaegt fehl.

**Prevention:**
- `web`-Platform aus der Validierung entfernen (oder separat behandeln)
- Push-Registrierung nur auf nativen Plattformen ausfuehren (bereits durch `Capacitor.isNativePlatform()` Check im Frontend geschuetzt, aber Server-Side Defence-in-Depth fehlt)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Badge-Count-Sync (BDG-*) | Pitfall 1: 4 Systeme verwalten Badge | Zuerst AppContext Badge-Logik komplett entfernen, dann BadgeContext als Single Source of Truth etablieren, dann PushService den echten Count senden lassen |
| Token-Lifecycle (TKN-*) | Pitfall 2 + 5: Fallback-IDs + Logout bei expired JWT | Fallback-ID-Generierung entfernen, Server-Side Cleanup implementieren |
| Token-Bereinigung (CLN-*) | Pitfall 3: Firebase-Errors nicht behandelt | Error-Code-Parsing in firebase.js, Token-Loeschung bei spezifischen Error-Codes |
| Event-Erinnerungen (FLW-01) | Pitfall 4: In-Memory Scheduler verliert Jobs | Polling-basierter Ansatz mit DB-State statt Scheduler |
| Neue Push-Flows (FLW-*) | Pitfall 10: Aenderungen an 3+ Stellen noetig | Notification-Type Registry als erstes erstellen, dann neue Flows hinzufuegen |
| Push-Konfiguration (CFG-*) | Pitfall 10: Kein zentrales Type-Registry | CFG-02 (Notification-Type Registry) vor CFG-01 (Enable/Disable Flags) implementieren |
| Push-Listener (CMP-01) | Pitfall 6: Listener-Akkumulation | Listener-Setup in AppContext reparieren bevor neue Notification-Types verifiziert werden |
| Push-Send Performance | Pitfall 7: Sequentielle Sends | Bei Event-Notifications (alle Konfis einer Org) auf async/parallel umstellen |
| Badge-Only Updates | Pitfall 8: Silent Push APNS Config | firebase.js um Push-Type-Unterscheidung erweitern |

## Integration Gotchas (v1.5-spezifisch)

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| BadgeContext + AppContext | Beide Systeme zaehlen Badges, AppContext hat "removed" Badge-Logik die trotzdem noch State setzt | AppContext komplett von Badge-Management befreien, nur BadgeContext nutzen |
| PushService + Badge Count | `badge: 1` hardcoded statt echtem Count | Server muss echten Unread-Count berechnen und in APNS Payload einsetzen |
| Firebase Error + Token DB | Error wird geloggt, Token bleibt | Error-Code parsen, bei `not-registered`/`invalid-argument` Token aus DB loeschen |
| Cron-Jobs + Docker | In-Memory Jobs gehen bei Container-Restart verloren | DB-basierter State fuer alle Scheduled Tasks |
| Multiple Device Tokens + Logout | Logout loescht nur Token der aktuellen Device-ID | Server-Side Cleanup fuer verwaiste Tokens implementieren |
| WebSocket (BadgeContext) + Push | Doppelte Updates: WebSocket `newMessage` Event UND Push Notification erhoehen Badge | Deduplizierung: Wenn App im Foreground (WebSocket aktiv), Push-Badge ignorieren |

## "Looks Done But Isn't" Checklist (v1.5)

- [ ] **AppContext Badge-Logik "entfernt":** Kommentare sagen "Badge logic removed - now handled by BadgeContext", aber `setChatNotifications` State wird weiter gepflegt und Device-Badge wird bei App-Start gelesen (Zeile 308-313)
- [ ] **Push-Listener Cleanup:** `setupPushNotifications` useEffect (Zeile 438) hat KEINEN Cleanup — Listener akkumulieren bei User-State-Changes
- [ ] **Fallback-Device-ID Filter:** `NOT LIKE '%\\_\\_%'` in PushService filtert Tokens, aber die gefilterten Tokens werden nie bereinigt
- [ ] **Token-Loeschung bei Logout:** `auth.ts` loescht Token per API — funktioniert nur wenn JWT noch gueltig ist
- [ ] **sendBadgeUpdate:** Methode existiert aber wird nirgendwo aufgerufen (nur der Method-Body existiert, kein Caller im Code)
- [ ] **Event-Reminder Methode:** `sendEventReminderToKonfi` existiert in PushService, aber es gibt keinen Scheduler der sie aufruft
- [ ] **firebase.js Error Handling:** `sendFirebasePushNotification` catcht den Error und returned `{ success: false }` — der Caller in PushService catcht ebenfalls und loggt nur. Doppeltes Error-Swallowing.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Badge-Count divergiert | LOW | `BadgeContext.refreshFromAPI()` manuell triggern, Device Badge via `Badge.clear()` zuruecksetzen |
| DB voll mit Ghost-Tokens | LOW | `DELETE FROM push_tokens WHERE updated_at < NOW() - INTERVAL '90 days'` |
| Firebase-Errors durch tote Tokens | LOW | Einmaliger Cleanup-Job + Error-Handler in PushService einbauen |
| Event-Erinnerungen nach Restart weg | MEDIUM | Polling-Job nachtraeglich einbauen, `reminder_sent` Spalte migrieren |
| Listener-Duplikate | LOW | `PushNotifications.removeAllListeners()` einmalig aufrufen, dann sauberen Setup |
| Silent Push auf iOS funktioniert nicht | LOW | APNS Header in firebase.js anpassen, Unterscheidung alert/background einfuehren |

## Sources

- [Firebase Best Practices fuer Token Management](https://firebase.google.com/docs/cloud-messaging/manage-tokens) — Token-Freshness, Staleness Window, Cleanup
- [Firebase FCM Error Codes](https://firebase.google.com/docs/cloud-messaging/error-codes) — Welche Errors Token-Loeschung triggern sollten
- [Firebase Blog: Managing Cloud Messaging Tokens](https://firebase.blog/posts/2023/04/managing-cloud-messaging-tokens/) — Periodischer Token-Cleanup
- [Capacitor Push Notifications API](https://capacitorjs.com/docs/apis/push-notifications) — Listener-Management, Registration
- [Capacitor Badge Plugin (capawesome)](https://github.com/capawesome-team/capacitor-badge) — autoClear, Persist-Optionen
- [GitHub Issue #1301: iOS Badge Count Handling](https://github.com/ionic-team/capacitor/issues/1301) — Background Badge Updates
- [GitHub Issue #1749: APNs vs FCM Token Confusion](https://github.com/ionic-team/capacitor/issues/1749) — Token-Lifecycle iOS
- [GitHub Issue #24: Background Badge Count Update](https://github.com/capawesome-team/capacitor-badge/issues/24) — Listener fuer Background Notifications
- [Node-Cron Patterns, Practices and Pitfalls](https://www.bomberbot.com/node/mastering-node-js-job-scheduling-with-node-cron-patterns-practices-and-pitfalls/) — Server-Restart verliert Jobs
- Codebase-Analyse: `backend/services/pushService.js`, `backend/push/firebase.js`, `backend/routes/notifications.js`, `frontend/src/contexts/AppContext.tsx`, `frontend/src/contexts/BadgeContext.tsx`, `frontend/src/services/auth.ts`

---
*Pitfalls research for: Konfi Quest v1.5 Push-Notifications*
*Researched: 2026-03-05*
