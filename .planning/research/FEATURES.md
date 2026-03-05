# Feature Landscape: Push-Notification System v1.5

**Domain:** Push-Notifications, Badge-Sync, Event-Erinnerungen fuer Ionic/Capacitor App
**Researched:** 2026-03-05
**Confidence:** HIGH (Codebase-Analyse + Firebase-Dokumentation + Capacitor-Doku)

## Ist-Zustand Analyse

### Bereits implementiert (14 Push-Typen in pushService.js)

| Typ | Methode | Aufgerufen von | Status |
|-----|---------|----------------|--------|
| chat | sendChatNotification | Socket.io Handler | Aktiv |
| new_activity_request | sendNewActivityRequestToAdmins | activities Route | Aktiv |
| activity_request_status | sendActivityRequestStatusToKonfi | activities Route | Aktiv |
| badge_earned | sendBadgeEarnedToKonfi | badges Route | Aktiv |
| activity_assigned | sendActivityAssignedToKonfi | konfi-managment Route | Aktiv |
| bonus_points | sendBonusPointsToKonfi | bonus Route | Aktiv |
| event_registered | sendEventRegisteredToKonfi | konfi Route | Aktiv |
| event_unregistered | sendEventUnregisteredToKonfi | konfi Route | Aktiv |
| event_unregistration | sendEventUnregistrationToAdmins | konfi Route | Aktiv |
| event_reminder | sendEventReminderToKonfi | backgroundService | Aktiv |
| waitlist_promotion | sendWaitlistPromotionToKonfi | konfi Route | Aktiv |
| event_cancelled | sendEventCancellationToKonfis | events Route | Aktiv |
| new_event | sendNewEventToOrgKonfis | events Route | Aktiv |
| event_attendance | sendEventAttendanceToKonfi | events Route | Aktiv |
| events_pending_approval | sendEventsPendingApprovalToAdmins | backgroundService | Aktiv |
| badge_update | sendBadgeUpdate | backgroundService | Aktiv |
| level_up | sendLevelUpToKonfi | **NICHT AUFGERUFEN** | Nur Methode vorhanden |

### Bereits implementierte Infrastruktur

| Komponente | Status | Details |
|-----------|--------|---------|
| Firebase Admin SDK | Aktiv | push/firebase.js, Service Account vorhanden |
| push_tokens Tabelle | Aktiv | user_id, token, platform, device_id, UPSERT |
| BackgroundService | Aktiv | Badge-Updates (5min), Event-Reminders (15min), Pending-Events (4h) |
| event_reminders Tabelle | Genutzt | Verhindert Doppel-Erinnerungen (1_day, 1_hour) |
| BadgeContext (Frontend) | Aktiv | Separate Context fuer Badge-Count, WebSocket-Integration |
| AppContext Push-Setup | Aktiv | Token-Registrierung, FCM-Listener, Navigation bei Tap |
| Token-Refresh bei App Resume | Aktiv | Alle 12h via localStorage Timestamp |
| Device-Token Cleanup bei Logout | Teilweise | DELETE-Route existiert, aber wird sie aufgerufen? |

## Table Stakes

Features, die Nutzer fuer ein zuverlaessiges Push-System erwarten. Fehlen = App wirkt unfertig.

| Feature | Warum erwartet | Komplexitaet | Abhaengigkeiten | Req-ID |
|---------|---------------|-------------|-----------------|--------|
| Token-Cleanup bei Logout | Geraet erhaelt nach Logout weiter Pushes fuer alten User -- fundamentaler Vertrauensbruch | LOW | Frontend muss DELETE /device-token aufrufen | TKN-01 |
| Fallback-Device-ID korrekt filtern | Query `NOT LIKE '%\\_\\_%'` filtert Fallback-IDs raus -- Geraete ohne echte ID erhalten nie Pushes | LOW | pushService.js getTokensForUser anpassen | TKN-02 |
| Token-Refresh bei App Resume | Bereits implementiert (12h Intervall) -- verifizieren dass es zuverlaessig funktioniert | LOW | AppContext.tsx -- nur Verifikation | TKN-03 |
| Token-Uebergabe bei User-Wechsel | FCM-Token gehoert physisch dem Geraet, nicht dem User. Bei Re-Login muss alter User-Token geloescht werden | LOW | Bereits in notifications.js implementiert (DELETE WHERE token=$1 AND user_id!=$2) | TKN-04 |
| Invalid-Token-Bereinigung nach Firebase-Error | Firebase gibt `messaging/registration-token-not-registered` bei ungueltigem Token -- dieser muss sofort aus DB entfernt werden | MEDIUM | pushService.js sendToUser muss Error-Codes auswerten | CLN-01 |
| Periodischer Token-Cleanup | Verwaiste Tokens (User geloescht, Token >60 Tage alt) verstopfen DB und verursachen unnoetige Firebase-Calls | LOW | Neuer Cleanup-Job in backgroundService, alle 24h | CLN-02 |
| Badge-Count als Single Source of Truth | Aktuell: BadgeContext rechnet aus Chat-Rooms, backgroundService sendet Badge-Updates, AppContext hoert auf badge_update Pushes -- drei Quellen, keine ist autoritativ | MEDIUM | BadgeContext muss einzige Quelle sein, alles andere konsumiert | BDG-01 |
| App-Icon Badge korrekt | iOS/Android App-Icon muss ungelesene Nachrichten korrekt anzeigen -- @capawesome/capacitor-badge ist bereits integriert | LOW | Abhaengig von BDG-01 (Single Source) | BDG-02 |
| Chat Unread-Counts pro Raum | chat_participants.last_read_at existiert, wird aber nicht immer korrekt aktualisiert | LOW | Backend-Query bereits korrekt in backgroundService | BDG-03 |
| TabBar Badge-Zahlen korrekt | TabBar-Badges muessen mit tatsaechlichen Counts uebereinstimmen | LOW | Abhaengig von BDG-01 | BDG-04 |
| Bestehende 14 Push-Flows verifiziert | Alle existierenden Flows muessen tatsaechlich funktionieren (nicht nur Code vorhanden) | MEDIUM | End-to-End Test auf echtem Geraet | CMP-01 |

## Differentiators

Features, die das System komplett machen. Nicht zwingend erwartet, aber machen die App professionell.

| Feature | Wert-Proposition | Komplexitaet | Abhaengigkeiten | Req-ID |
|---------|-----------------|-------------|-----------------|--------|
| Event-Erinnerungen (1 Tag + 1 Stunde) | Konfis vergessen Events -- Erinnerungen erhoehen Teilnahme signifikant. **Bereits implementiert** in backgroundService + pushService, braucht nur Verifikation + event_reminders Tabelle anlegen | LOW | event_reminders Tabelle muss existieren (CREATE TABLE falls nicht vorhanden) | FLW-01 |
| Admin-Alert bei neuer Konfi-Registrierung | Admin weiss sofort wenn ein neuer Konfi sich registriert hat und kann reagieren (Willkommensnachricht, Jahrgangs-Zuweisung pruefen) | LOW | auth.js register-konfi Route + PushService.sendToMultipleUsers | FLW-02 |
| Level-Up Push-Notification | Konfi erhaelt Glueckwunsch-Push bei Level-Aufstieg. **sendLevelUpToKonfi existiert bereits** in pushService, wird aber nie aufgerufen | LOW | Muss in der Route eingebaut werden, wo Level-Checks passieren (nach Punkte-Vergabe) | FLW-03 |
| Punkte-Meilenstein Push | Konfi erhaelt Push wenn Mindestpunkte (Gottesdienst oder Gemeinde) erreicht sind -- wichtiger Moment in der Konfi-Zeit | MEDIUM | Neue Methode in pushService, Trigger nach Punkte-Update in konfi-managment/bonus Routes | FLW-04 |
| Push-Type Registry mit Defaults | Zentrale Definition aller Push-Typen mit Enable/Disable-Flag -- macht System wartbar und erweiterbar | LOW | Neue Datei pushTypes.js mit Type-Registry-Map | CFG-02 |
| Push-Types aktivierbar/deaktivierbar | Admins oder Code koennen bestimmte Push-Typen abschalten (z.B. Event-Erinnerungen oder Bonus-Pushes) | LOW | pushTypes.js + Check in sendToUser vor jedem Send | CFG-01 |

## Anti-Features

Features, die verlockend erscheinen, aber in v1.5 NICHT gebaut werden sollten.

| Anti-Feature | Warum verlockend | Warum problematisch | Alternative |
|--------------|-----------------|--------------------|----|
| User-Level Notification Preferences UI | Nutzer koennte selbst waehlen welche Pushes er bekommt | Zu komplex fuer v1.5: Settings-UI, Backend-Speicherung, Frontend-Toggle pro Typ, Migration. Bei <100 Nutzern nicht noetig | Code-Level Toggles (CFG-01) reichen. User-Preferences als v2.0 Feature |
| Digest-Notifications (taegliche Zusammenfassung) | Weniger Push-Spam, eleganter | Erfordert Queue-System, Aggregation-Logik, Template-Engine fuer Zusammenfassungen. Overkill bei aktueller Nutzerzahl | Einzelne Pushes mit sinnvollem Timing (nicht mitten in der Nacht) |
| Rich Notifications mit Bildern/Actions | iOS unterstuetzt Bilder und Action-Buttons in Pushes | Erfordert Notification Service Extension (Swift), separate Build-Konfiguration, Content-Available vs Alert Push Typen | Standard-Pushes mit klarem Titel und Body reichen |
| Web Push Notifications | Nutzer am Desktop koennten auch Pushes bekommen | App ist native-only. Web Push erfordert Service Worker, separates Token-Management, Browser-Kompatibilitaet | Kein Web-Push. In-App Notification Center existiert |
| SMS/Email fuer Push-Events | Fallback wenn Push nicht ankommt | SMS kostet Geld pro Nachricht, Email-Notifications erfordern Template-System. Mail-Service existiert aber ist nicht fuer Push vorgesehen | Push-Zuverlaessigkeit verbessern (Token-Cleanup, Retry) statt Fallback-Kanaele |
| Lokale Notifications (Capacitor Local Notifications) | Event-Erinnerungen ohne Server moeglich | Server-seitige Erinnerungen sind zuverlaessiger (backgroundService laeuft bereits). Lokale Notifications erfordern Alarm-Permissions auf Android, werden bei App-Kill geloescht | Server-Side Event Reminders (backgroundService, bereits implementiert) |
| node-cron statt setInterval | Praezisere Zeitsteuerung mit Cron-Syntax | Aktuelle setInterval-Loesung in backgroundService funktioniert ausreichend. node-cron wuerde neue Dependency einfuehren ohne echten Mehrwert bei 15-Minuten-Intervallen | setInterval beibehalten. Cron nur noetig wenn minutengenaues Scheduling kritisch wird |

## Feature-Abhaengigkeiten

```
[Token-Cleanup bei Logout] (TKN-01)
    Keine Abhaengigkeit -- Frontend-Aenderung beim Logout

[Fallback-Device-ID Fix] (TKN-02)
    Keine Abhaengigkeit -- Query-Anpassung in pushService.js

[Invalid-Token-Bereinigung] (CLN-01)
    Erfordert: Firebase Error-Code Parsing
    Beeinflusst: Alle Push-Flows (weniger fehlgeschlagene Sends)

[Periodischer Token-Cleanup] (CLN-02)
    Erfordert: Neuer Job in backgroundService
    Optimalerweise nach CLN-01 (gleiche Token-Logik)

[Badge-Count Single Source] (BDG-01)
    Keine Abhaengigkeit -- Refactoring von BadgeContext
    BLOCKER fuer: BDG-02, BDG-03, BDG-04

[App-Icon Badge] (BDG-02)
    Erfordert: BDG-01

[Chat Unread-Counts] (BDG-03)
    Erfordert: BDG-01

[TabBar Badges] (BDG-04)
    Erfordert: BDG-01

[Event-Erinnerungen] (FLW-01)
    Bereits implementiert -- nur Verifikation + DB-Migration
    Erfordert: event_reminders Tabelle existiert

[Admin-Alert Registrierung] (FLW-02)
    Keine Abhaengigkeit -- auth.js Erweiterung

[Level-Up Push] (FLW-03)
    Erfordert: Level-Check-Logik identifizieren (wo werden Punkte vergeben?)
    sendLevelUpToKonfi existiert bereits

[Punkte-Meilenstein Push] (FLW-04)
    Erfordert: Meilenstein-Definition (welche Schwellwerte?)
    Erfordert: konfi_profiles.gottesdienst_points/gemeinde_points Abfrage

[Push-Type Registry] (CFG-02)
    Keine Abhaengigkeit -- neue Datei
    BLOCKER fuer: CFG-01

[Push-Types Toggle] (CFG-01)
    Erfordert: CFG-02 (Registry muss existieren)

[14 Flows verifiziert] (CMP-01)
    Erfordert: CLN-01 (sonst schlagen Sends mit invaliden Tokens fehl)
    Am besten NACH allen anderen Features
```

## MVP-Empfehlung fuer v1.5

### Phase 1: Token-Zuverlaessigkeit (Fundament)
1. **TKN-01**: Logout Token-Cleanup -- Vertrauensbruch beseitigen
2. **TKN-02**: Fallback-ID Fix -- Geraete ohne echte ID erreichen
3. **TKN-04**: User-Wechsel Token-Uebergabe -- bereits implementiert, verifizieren
4. **CLN-01**: Firebase Error-Code Cleanup -- ungueltige Tokens sofort entfernen
5. **CLN-02**: Periodischer Cleanup -- verwaiste Tokens bereinigen

### Phase 2: Badge-Count-Sync (User-sichtbar)
6. **BDG-01**: Single Source of Truth definieren -- BadgeContext als einzige Quelle
7. **BDG-02**: App-Icon Badge korrekt -- @capawesome/capacitor-badge sync
8. **BDG-03**: Chat Unread-Counts -- pro Raum korrekt
9. **BDG-04**: TabBar Badges -- konsistent mit BDG-01

### Phase 3: Fehlende Push-Flows (Neue Features)
10. **FLW-01**: Event-Erinnerungen -- verifizieren (bereits implementiert)
11. **FLW-02**: Admin-Alert Registrierung -- auth.js erweitern
12. **FLW-03**: Level-Up Push -- sendLevelUpToKonfi aufrufen
13. **FLW-04**: Punkte-Meilenstein -- neue Logik

### Phase 4: Konfiguration + Verifikation
14. **CFG-02**: Push-Type Registry -- zentrale Definition
15. **CFG-01**: Push-Types Toggle -- aktivierbar/deaktivierbar
16. **CMP-01**: Alle 14+4 Flows End-to-End verifizieren

**Reihenfolge-Rationale:**
- Token-Zuverlaessigkeit ZUERST: Ohne zuverlaessige Token-Zustellung sind neue Flows sinnlos
- Badge-Sync VOR neuen Flows: Nutzer sehen sofort Verbesserung bei bestehenden Features
- Konfiguration ZULETZT: Setzt voraus, dass alle Flows existieren und funktionieren

## Feature-Priorisierungs-Matrix

| Feature | Nutzer-Wert | Implementierungskosten | Prioritaet |
|---------|------------|----------------------|-----------|
| Token-Cleanup bei Logout (TKN-01) | HIGH | LOW | P1 |
| Fallback-ID Fix (TKN-02) | MEDIUM | LOW | P1 |
| Token-Refresh verifizieren (TKN-03) | LOW | LOW | P1 |
| User-Wechsel Token (TKN-04) | MEDIUM | LOW | P1 |
| Invalid-Token-Bereinigung (CLN-01) | HIGH | MEDIUM | P1 |
| Periodischer Cleanup (CLN-02) | MEDIUM | LOW | P1 |
| Badge Single Source (BDG-01) | HIGH | MEDIUM | P1 |
| App-Icon Badge (BDG-02) | MEDIUM | LOW | P1 |
| Chat Unread-Counts (BDG-03) | MEDIUM | LOW | P1 |
| TabBar Badges (BDG-04) | MEDIUM | LOW | P1 |
| Event-Erinnerungen (FLW-01) | HIGH | LOW (Verifikation) | P1 |
| Admin-Alert Registrierung (FLW-02) | MEDIUM | LOW | P1 |
| Level-Up Push (FLW-03) | MEDIUM | LOW | P1 |
| Punkte-Meilenstein (FLW-04) | MEDIUM | MEDIUM | P1 |
| Push-Type Registry (CFG-02) | LOW | LOW | P1 |
| Push-Types Toggle (CFG-01) | LOW | LOW | P1 |
| Alle Flows verifiziert (CMP-01) | HIGH | MEDIUM | P1 |

**Alle Features sind P1** -- dies ist ein fokussierter Milestone mit klarem Scope.

## Kritische Beobachtungen aus der Codebase

### 1. BadgeContext und AppContext sind nicht synchron
- `BadgeContext.tsx` berechnet Badge-Count aus `/chat/rooms` API
- `AppContext.tsx` hat eigenen `chatNotifications` State mit `totalUnreadCount`
- `backgroundService.js` sendet `badge_update` Push-Notifications mit eigenem Count
- Kommentare wie "Badge logic removed - now handled by BadgeContext" deuten auf halbfertige Migration hin
- **Risiko:** Drei verschiedene Counts koennen divergieren

### 2. sendLevelUpToKonfi ist toter Code
- Methode existiert in pushService.js (Zeile 453-471)
- Wird nirgends aufgerufen -- kein einziger Aufruf in allen Routes
- Muss an der Stelle eingebaut werden, wo Level-Checks nach Punkte-Vergabe passieren

### 3. Event-Reminder Infrastruktur existiert bereits
- backgroundService.js hat komplette Implementierung (1-Tag + 1-Stunde Erinnerungen)
- event_reminders Tabelle wird in Queries referenziert aber moeglicherweise nicht per Migration angelegt
- Muss nur verifiziert werden dass Tabelle existiert und Logik funktioniert

### 4. Firebase Error-Handling fehlt komplett
- In pushService.js wird bei Send-Fehler nur `console.error` geloggt
- Keine Unterscheidung zwischen `messaging/registration-token-not-registered` (Token loeschen!) und temporaeren Fehlern (Retry!)
- Firebase Best Practice: Token sofort aus DB entfernen bei diesen Error-Codes:
  - `messaging/registration-token-not-registered`
  - `messaging/invalid-registration-token`

### 5. Keine Notification-Type-Registry
- Push-Typen sind als Strings ueber pushService.js verstreut ("chat", "new_event", etc.)
- Kein zentraler Ort der definiert welche Typen existieren und ob sie aktiv sind
- Einfache Loesung: Map-Objekt mit Type-Name -> { enabled, defaultTitle, category }

## Quellen

- [Firebase: FCM Token Management Best Practices](https://firebase.google.com/docs/cloud-messaging/manage-tokens) -- Token-Staleness, Cleanup-Strategie
- [Firebase: FCM Error Codes](https://firebase.google.com/docs/cloud-messaging/error-codes) -- Welche Errors Token-Loeschung erfordern
- [Firebase Blog: Managing Cloud Messaging Tokens (2023)](https://firebase.blog/posts/2023/04/managing-cloud-messaging-tokens/) -- 60-Tage Staleness-Window
- [Capacitor Push Notifications API](https://capacitorjs.com/docs/apis/push-notifications) -- Registration, Listeners, Token-Handling
- [TELUS Digital: iOS Badge Count Best Practices](https://www.willowtreeapps.com/craft/best-practices-for-driving-engagement-with-ios-app-notification-badges) -- Server-Side Badge Count, Engagement
- [Braze: Utilizing Badge Count](https://www.braze.com/docs/user_guide/message_building_by_channel/push/ios/utilizing_badge_count) -- Badge-Sync Architektur
- [Apple Developer Forums: Badge Count](https://developer.apple.com/forums/thread/122339) -- Server-Side Badge Berechnung
- [DigitalOcean: node-cron Guide](https://www.digitalocean.com/community/tutorials/nodejs-cron-jobs-by-examples) -- Scheduled Jobs Pattern
- Codebase-Analyse: pushService.js, backgroundService.js, AppContext.tsx, BadgeContext.tsx, notifications.js, auth.js, events.js

---
*Feature-Research fuer: Konfi Quest v1.5 Push-Notifications*
*Recherchiert: 2026-03-05*
