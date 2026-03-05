# Project Research Summary

**Project:** Konfi Quest v1.5 Push-Notifications
**Domain:** Push-Notification-System Verbesserung (Token-Lifecycle, Badge-Sync, Scheduled Notifications)
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

Konfi Quest hat bereits ein funktionierendes Push-Notification-System mit 14 aktiven Push-Flows, Firebase Admin SDK, Capacitor Push Notifications und einer push_tokens-Tabelle in PostgreSQL. Das System leidet jedoch unter drei strukturellen Problemen: Der Badge-Count wird von 4 unabhaengigen Systemen verwaltet ohne Single Source of Truth, ungueltige FCM-Tokens werden nie bereinigt (Firebase-Errors werden nur geloggt), und der Token-Lifecycle hat Luecken bei Logout und Fallback-Device-IDs. Alle 14 bestehenden Push-Flows funktionieren im Code, aber `sendLevelUpToKonfi` wird nirgends aufgerufen und Event-Erinnerungen referenzieren eine Tabelle die moeglicherweise nicht existiert.

Der empfohlene Ansatz ist konservativ: Nur eine neue Dependency (node-cron), keine Architektur-Umstellung, sondern gezielte Reparaturen an bestehenden Komponenten. Drei neue Services (BadgeCountService, TokenCleanupService, NotificationTypeRegistry) kapseln die fehlende Logik. Das bestehende setInterval-Pattern im BackgroundService bleibt erhalten. Firebase `sendEachForMulticast` wird fuer Batch-Szenarien genutzt (bereits in firebase-admin enthalten). Kein Redis, kein Bull, kein separater Worker-Prozess.

Die Hauptrisiken sind: (1) Badge-Count-Divergenz zwischen App-Icon, TabBar und Chat -- loesbar durch BadgeCountService als einzige Berechnungsquelle. (2) APNS-Header fuer Silent Pushes sind falsch konfiguriert (`apns-push-type: alert` statt `background` fuer Badge-Only Updates) -- iOS verwirft diese Pushes im Background. (3) Push-Listener in AppContext akkumulieren bei User-State-Changes weil kein Cleanup im useEffect existiert. Alle drei sind mit gezielten Code-Aenderungen behebbar.

## Key Findings

### Recommended Stack

Nur eine neue Dependency: **node-cron v3.0.3** fuer periodische Jobs (Event-Erinnerungen alle 15 Min, Token-Cleanup taeglich). Alle anderen benoetigten APIs sind bereits installiert und teilweise ungenutzt.

**Core technologies (bereits vorhanden, besser nutzen):**
- **firebase-admin ^12.7.0:** `sendEachForMulticast()` fuer Batch-Versand (aktuell nicht genutzt, sendet sequentiell)
- **firebase-admin Error-Codes:** Token-Invalidierung erkennen (`messaging/registration-token-not-registered`) -- aktuell werden Fehler nur geloggt
- **@capawesome/capacitor-badge ^7.0.1:** Badge.set()/clear() -- funktioniert, aber Android-Workaround noetig (removeAllDeliveredNotifications vor Badge.set)
- **node-cron ^3.0.3 (NEU):** Einzige neue Dependency -- leichtgewichtiger Cron-Scheduler im Express-Prozess

**Bewusst NICHT hinzugefuegt:** Redis/BullMQ (unnoetig bei <100 Usern), @capacitor-firebase/messaging (wuerde Custom FCM Plugin ersetzen), Web Push (App ist native-only), PM2/Worker-Prozesse (ein Docker-Container reicht).

### Expected Features

**Must have (Table Stakes) -- 11 Requirements:**
- Token-Cleanup bei Logout (TKN-01) -- Geraet erhaelt nach Logout weiter Pushes fuer alten User
- Fallback-Device-ID Fix (TKN-02) -- Geraete mit Fallback-IDs erhalten NIE Pushes
- Invalid-Token-Bereinigung nach Firebase-Error (CLN-01) -- tote Tokens bleiben fuer immer in DB
- Periodischer Token-Cleanup (CLN-02) -- verwaiste Tokens bereinigen
- Badge-Count Single Source of Truth (BDG-01) -- 4 Systeme verwalten Badge unabhaengig
- App-Icon Badge korrekt (BDG-02) -- APNS setzt Badge aktuell immer auf "1"
- Chat Unread-Counts pro Raum (BDG-03) -- last_read_at nicht immer korrekt
- TabBar Badges konsistent (BDG-04) -- abhaengig von BDG-01
- Bestehende 14 Push-Flows verifiziert (CMP-01) -- End-to-End auf echtem Geraet

**Should have (Differentiators) -- 6 Requirements:**
- Event-Erinnerungen verifizieren (FLW-01) -- bereits implementiert, braucht Verifikation + DB-Migration
- Admin-Alert bei neuer Registrierung (FLW-02) -- auth.js erweitern
- Level-Up Push (FLW-03) -- sendLevelUpToKonfi existiert, wird nie aufgerufen
- Punkte-Meilenstein Push (FLW-04) -- neue Logik
- Push-Type Registry (CFG-02) -- zentrale Type-Definition
- Push-Types Toggle (CFG-01) -- Enable/Disable-Flags

**Defer (v2+):**
- User-Level Notification Preferences UI -- bei <100 Nutzern nicht noetig
- Digest-Notifications (taegliche Zusammenfassung) -- Overkill
- Rich Notifications mit Bildern/Actions -- erfordert Notification Service Extension
- SMS/Email Fallback -- Push-Zuverlaessigkeit verbessern statt Fallback-Kanaele

### Architecture Approach

Die Architektur erweitert das bestehende System um drei neue Services ohne die Grundstruktur zu aendern. PushService bleibt die zentrale Klasse fuer alle Push-Sends, wird aber um Type-Guard (NotificationTypeRegistry) und Token-Invalidierung (firebase.js tokenInvalid Flag) ergaenzt. BadgeCountService zentralisiert die Badge-Berechnung die aktuell an 4 Stellen unabhaengig passiert. TokenCleanupService implementiert reaktive (bei jedem Send) und proaktive (alle 24h) Token-Bereinigung.

**Neue Komponenten:**
1. **NotificationTypeRegistry** (backend/config/notificationTypes.js) -- Zentrale Type-Definitionen mit enabled/disabled Flags
2. **BadgeCountService** (backend/services/badgeCountService.js) -- Einzige Quelle fuer Badge-Count-Berechnung
3. **TokenCleanupService** (backend/services/tokenCleanupService.js) -- Reaktive + proaktive Token-Bereinigung

**Modifikationen an bestehenden Komponenten:**
- firebase.js: tokenInvalid Return-Wert bei spezifischen Error-Codes
- PushService.sendToUser(): Type-Check + Token-Invalidierung + sendEachForMulticast
- PushService.getTokensForUser(): Fallback-ID-Filter entfernen
- AppContext.tsx: Logout Token-Cleanup + Listener-Cleanup im useEffect
- BadgeContext.tsx: Neuer /chat/badge-count Endpoint statt /chat/rooms parsen
- BackgroundService: TokenCleanupService-Intervall hinzufuegen

**DB-Aenderungen:**
- push_tokens: error_count + last_error_at Spalten (fuer spaetere Erweiterung)
- event_reminders: CREATE TABLE IF NOT EXISTS (wird referenziert aber nie erstellt)
- CREATE TABLE aus notifications.js Route-Handler entfernen

### Critical Pitfalls

1. **Badge-Count ohne Single Source of Truth** -- 4 Systeme (BadgeContext, AppContext, PushService, Capacitor Badge) verwalten den Count unabhaengig. Loesung: BadgeCountService als einzige Berechnungsquelle, alle anderen konsumieren. APNS Payload muss echten Count enthalten (nicht hardcoded "1").

2. **Firebase-Errors bei ungueltigen Tokens werden ignoriert** -- Tokens bleiben fuer immer in der DB, jeder Push-Send an tote Tokens verbraucht Firebase-Quota und Latenz. Loesung: Error-Code-Parsing in firebase.js, sofortige Token-Loeschung bei `messaging/registration-token-not-registered`.

3. **APNS-Header fuer Silent Pushes falsch** -- Badge-Only Updates nutzen `apns-push-type: alert` statt `background`. iOS verwirft diese im Background. Loesung: firebase.js muss zwischen Alert-Pushes und Silent-Pushes unterscheiden.

4. **Push-Listener akkumulieren in AppContext** -- useEffect fuer setupPushNotifications hat keinen Cleanup. Listener stacken bei User-State-Changes. Loesung: removeAllListeners() im useEffect-Cleanup.

5. **Fallback-Device-IDs erzeugen Ghost-Tokens** -- Tokens mit Fallback-IDs werden per `NOT LIKE '%\\_\\_%'` ausgefiltert, bleiben aber in der DB. Loesung: Filter entfernen, reaktives Cleanup ueber tokenInvalid.

## Implications for Roadmap

### Phase 1: Foundation + Konfiguration
**Rationale:** Grundlagen die alle weiteren Phasen brauchen. NotificationTypeRegistry ist Voraussetzung fuer Type-Guards in PushService. DB-Aenderungen muessen vor Code-Aenderungen passieren.
**Delivers:** NotificationTypeRegistry, DB-Schema-Fixes (event_reminders Tabelle, push_tokens Erweiterung, CREATE TABLE aus Route entfernen)
**Addresses:** CFG-01, CFG-02
**Avoids:** Pitfall 10 (Aenderungen an 3+ Stellen bei neuen Push-Flows)
**Komplexitaet:** LOW -- neue Dateien + SQL-Statements

### Phase 2: Token-Lifecycle reparieren
**Rationale:** Ohne zuverlaessige Token-Zustellung sind alle weiteren Push-Verbesserungen wirkungslos. Dies ist die kritischste Phase.
**Delivers:** Reaktive Token-Invalidierung (firebase.js), Fallback-ID-Filter entfernt, Logout-Cleanup robust, Push-Listener-Cleanup in AppContext
**Addresses:** TKN-01, TKN-02, TKN-03, TKN-04, CLN-01
**Avoids:** Pitfall 2 (Ghost-Tokens), Pitfall 3 (Firebase-Errors ignoriert), Pitfall 5 (Logout bei expired JWT), Pitfall 6 (Listener-Akkumulation)
**Komplexitaet:** MEDIUM -- firebase.js, PushService, AppContext aendern

### Phase 3: Badge-Count Single Source of Truth
**Rationale:** User-sichtbarste Verbesserung. Voraussetzung fuer korrekte Badge-Anzeige bei allen Push-Flows. Unabhaengig von Phase 2 implementierbar (parallel moeglich).
**Delivers:** BadgeCountService, GET /chat/badge-count Endpoint, BadgeContext vereinfacht, AppContext Badge-Logik entfernt, APNS Silent Push korrekt
**Addresses:** BDG-01, BDG-02, BDG-03, BDG-04
**Avoids:** Pitfall 1 (4 Badge-Systeme), Pitfall 8 (APNS Silent Push Header)
**Komplexitaet:** MEDIUM -- neuer Service + mehrere Dateien refactoren

### Phase 4: Fehlende Push-Flows
**Rationale:** Neue Features auf dem jetzt zuverlaessigen Fundament. Level-Up und Admin-Alert sind LOW-Effort (Methoden existieren teilweise schon).
**Delivers:** Level-Up Push aktiv (FLW-03), Admin-Alert bei Registrierung (FLW-02), Punkte-Meilenstein (FLW-04), Event-Erinnerungen verifiziert (FLW-01)
**Addresses:** FLW-01, FLW-02, FLW-03, FLW-04
**Avoids:** Pitfall 4 (Polling statt In-Memory-Scheduler fuer Event-Erinnerungen)
**Komplexitaet:** LOW-MEDIUM -- FLW-03 ist nur ein Funktionsaufruf, FLW-04 braucht Meilenstein-Logik

### Phase 5: Token-Cleanup + End-to-End Verifikation
**Rationale:** Abschluss-Phase. Proaktiver Cleanup setzt reaktiven Cleanup (Phase 2) voraus. End-to-End-Verifikation aller 17 Flows (14 bestehende + 3 neue) als Abnahme.
**Delivers:** TokenCleanupService, 24h-Cleanup-Job in BackgroundService, alle Push-Flows End-to-End verifiziert
**Addresses:** CLN-02, CMP-01
**Avoids:** Pitfall 7 (sequentielle Sends -- sendEachForMulticast fuer Batch)
**Komplexitaet:** MEDIUM -- TokenCleanupService + umfassende Verifikation auf echtem Geraet

### Phase Ordering Rationale

- **Foundation vor allem:** DB-Schema und Type-Registry sind Voraussetzungen fuer alle Code-Aenderungen
- **Token-Lifecycle vor neuen Flows:** Ohne zuverlaessige Zustellung sind neue Push-Flows nutzlos
- **Badge-Sync parallel zu Token-Lifecycle moeglich:** Keine direkte Abhaengigkeit, aber sauberer wenn Token-Lifecycle zuerst steht
- **Neue Flows erst auf solidem Fundament:** Level-Up, Meilenstein-Push etc. brauchen funktionierendes Token-System + Type-Registry
- **Verifikation ganz am Ende:** Alle Flows muessen existieren bevor End-to-End-Tests sinnvoll sind
- **Insgesamt 1 neue Dependency (node-cron):** Minimales Risiko, maximaler Fokus auf Code-Qualitaet

### Research Flags

Phasen die tiefere Research waehrend der Planung brauchen:
- **Phase 3 (Badge-Count):** APNS Silent Push Header-Konfiguration muss auf echtem iOS-Geraet getestet werden. Android Badge-Verhalten (Badge.clear() vs System-Notification-Count) ist nur MEDIUM Confidence.
- **Phase 4 (FLW-04 Punkte-Meilenstein):** Meilenstein-Schwellwerte muessen definiert werden (welche Punkte-Zahlen?). Level-Check-Logik muss im Code lokalisiert werden.

Phasen mit Standard-Patterns (keine Research noetig):
- **Phase 1 (Foundation):** SQL CREATE TABLE, JS Config-Objekt -- trivial
- **Phase 2 (Token-Lifecycle):** Firebase Error-Codes sind offiziell dokumentiert, Cleanup-Pattern ist Standard
- **Phase 5 (Cleanup):** Periodischer DB-Cleanup ist etabliertes Pattern

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Nur 1 neue Dependency (node-cron), Rest existiert bereits. Firebase-APIs offiziell dokumentiert |
| Features | HIGH | Basiert auf direkter Codebase-Analyse aller relevanten Dateien. 14 bestehende Flows verifiziert |
| Architecture | HIGH | Alle Dateien analysiert (pushService.js 663 Zeilen, AppContext.tsx 584 Zeilen etc.). Probleme konkret identifiziert |
| Pitfalls | HIGH | Firebase-Doku, Capacitor-Doku, Community-Issues. Alle Probleme im Code nachvollziehbar |

**Overall confidence:** HIGH

### Gaps to Address

- **Android Badge-Count Verhalten:** `Badge.clear()` hat keinen Einfluss auf System-Notification-Count. Workaround (removeAllDeliveredNotifications) muss auf Zielgeraeten getestet werden -- MEDIUM Confidence
- **Punkte-Meilenstein Schwellwerte:** Welche Punkte-Zahlen loesen einen Meilenstein-Push aus? Settings-Tabelle hat `min_gottesdienst_points` und `min_gemeinde_points` -- muessen definiert werden
- **Level-Check Lokalisierung:** Wo genau im Code passiert der Level-Check nach Punkte-Vergabe? Muss in activities.js / konfi-managment.js / badges.js identifiziert werden
- **event_reminders Tabelle:** Wird im Code referenziert, existiert moeglicherweise nicht in der DB. Muss vor Phase 4 geprueft werden
- **node-cron vs setInterval:** FEATURES.md listet node-cron als Anti-Feature (setInterval reicht), STACK.md empfiehlt node-cron. Empfehlung: setInterval beibehalten fuer bestehende Jobs, node-cron nur fuer neue Cron-spezifische Jobs falls noetig

## Sources

### Primary (HIGH confidence)
- [Firebase Admin SDK: Send Messages](https://firebase.google.com/docs/cloud-messaging/send/admin-sdk) -- sendEachForMulticast, Batch-APIs
- [Firebase FCM Error Codes](https://firebase.google.com/docs/cloud-messaging/error-codes) -- Token-Invalidierung
- [Firebase: Token Management Best Practices](https://firebase.google.com/docs/cloud-messaging/manage-tokens) -- 60-Tage Staleness
- [Capacitor Push Notifications API](https://capacitorjs.com/docs/apis/push-notifications) -- Token-Lifecycle, Listener-Management
- [Capawesome Badge Plugin](https://capawesome.io/plugins/badge/) -- Badge.set/clear

### Secondary (MEDIUM confidence)
- [Android Badge Count Issue #203](https://github.com/capawesome-team/capacitor-plugins/issues/203) -- Badge.clear() vs System-Count
- [Firebase sendMulticast Deprecation](https://community.flutterflow.io/discussions/post/the-messaging-sendmulticast-function-is-no-longer-supported-in-firebase-KVt3BAb65dNRhk6) -- sendEachForMulticast als Ersatz
- [node-cron npm](https://www.npmjs.com/package/node-cron) -- v3.0.3 stable

### Codebase-Analyse (HIGH confidence)
- pushService.js (663 Zeilen, 14+2 Methoden), backgroundService.js (312 Zeilen), firebase.js (74 Zeilen)
- AppContext.tsx (584 Zeilen), BadgeContext.tsx (107 Zeilen), notifications.js (165 Zeilen)
- Alle Route-Handler: activities.js, auth.js, badges.js, chat.js, events.js, konfi.js, konfi-managment.js

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
