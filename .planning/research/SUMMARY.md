# Project Research Summary

**Project:** Konfi Quest v2.1 — App-Resilienz (Offline + Sync)
**Domain:** Offline-Caching und Schreib-Queue fuer Ionic/Capacitor Hybrid-App
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

Konfi Quest ist eine native Hybrid-App (Capacitor 7 / React 19 / Ionic 8) fuer Kirchengemeinden mit ca. 50-200 Nutzern, die momentan keinerlei Offline-Unterstuetzung hat. Beim Wegfall der Netzwerkverbindung zeigt die App leere Seiten oder generische Fehlermeldungen — ein inakzeptabler Zustand fuer eine App, die Jugendliche bei der Konfirmationsvorbereitung begleitet. Die empfohlene Loesung ist ein schlanker, pragmatischer Offline-Layer: Lese-Cache mit Stale-While-Revalidate via Capacitor Preferences, eine begrenzte Schreib-Queue fuer Chat-Nachrichten und Aktivitaets-Antraege, sowie automatische Retry-Logik im bestehenden Axios-Interceptor. Der Ansatz nutzt das vorhandene Oekosystem (Axios, Socket.io, AppContext) und erweitert es konservativ, statt es zu ersetzen.

Das Hauptrisiko liegt in zwei kritischen Bereichen: Erstens speichert die App derzeit JWT-Token und User-Daten in localStorage, das auf iOS vom WKWebView ohne Warnung geraeumt werden kann — eine Migration auf Capacitor Preferences muss als erstes passieren. Zweitens hat Socket.io zwar Reconnect-Logik, aber kein "Was habe ich verpasst?"-Protokoll: Nach einer Offline-Phase fehlen dem Chat Nachrichten und dem Dashboard aktuelle Punkte. Beide Risiken sind loesbar und muessen vor dem eigentlichen Cache-Aufbau addressiert werden.

Die Forschung empfiehlt klar, keine schweren Sync-Frameworks (RxDB, PouchDB, CouchDB) einzusetzen. Die Nutzerbasis und die append-only Natur der meisten Schreiboperationen rechtfertigen keinen vollstaendigen Offline-Modus. Ziel ist eine App, die sich bei transienter Verbindung zuverlaessig anfuehlt — nicht eine App, die wochenlang offline funktioniert. Dieser Scope-Eingrenzung sollte das Roadmap konsequent folgen.

## Key Findings

### Empfohlener Stack

Die Erweiterung des Tech-Stacks ist bewusst minimal gehalten. Es werden 4 neue Pakete hinzugefuegt: `@capacitor/network` (Offline-Erkennung via nativer OS-APIs), `@capacitor/preferences` (persistenter Key-Value-Cache, ersetzt localStorage fuer kritische Daten), `@capawesome/capacitor-background-task` (Queue-Flush wenn App in Background geht) und `axios-retry` (Exponential Backoff). Alle drei Capacitor-Plugins folgen dem v7-Versionsschema des bestehenden Projekts. Drei Eigenbauten ersetzen extern nicht sinnvoll vorhandene Loesungen: ein `useCachedQuery`-Hook (SWR-Pattern), ein `QueueService` (FIFO Offline-Queue) und ein `useSubmitGuard`-Hook (Double-Submit-Schutz).

**Core-Technologien (nur Neuzugaenge):**
- `@capacitor/network` ^7.0.1: Netzwerkstatus via NWPathMonitor (iOS) / ConnectivityManager (Android) — zuverlaessiger als navigator.onLine
- `@capacitor/preferences` ^7.0.1: Persistenter JSON-Cache via UserDefaults/SharedPreferences — wird NICHT vom OS geraeumt, im Gegensatz zu localStorage
- `@capawesome/capacitor-background-task` ^7.0.1: ~30 Sekunden Background-Execution um Queue zu leeren bevor App suspendiert wird
- `axios-retry` ^4.5.0: Community-Standard-Interceptor (5M+ weekly downloads) fuer Exponential Backoff

**Nicht installieren (Over-Engineering):**
- SQLite, RxDB, @ionic/storage, Service Worker, tanstack-query — alle unangemessen fuer diese App-Groesse und diesen Sync-Ansatz

Detailquelle: `.planning/research/STACK.md`

### Erwartete Features

Die Forschung unterscheidet klar zwischen Pflicht-Features (Table Stakes), optionalen Differenzierern und bewussten Anti-Features. Der aktuelle Offline-Support ist vollstaendig nicht vorhanden: kein Cache, kein Retry, keine Netzwerk-Erkennung, kein Double-Submit-Schutz.

**Muss vorhanden sein (Table Stakes) — User erwarten das:**
- Offline-Lese-Cache fuer Dashboard (Punkte, Ringe, Level)
- Offline-Lese-Cache fuer Chat-Verlauf (letzte 50 Nachrichten pro Raum)
- Offline-Lese-Cache fuer Events (Datum, Ort, Beschreibung)
- Offline-Banner/Indikator — User muss verstehen WARUM Aktionen nicht gehen
- Stale-While-Revalidate — gecachte Daten sofort zeigen, im Hintergrund aktualisieren
- Automatischer Retry bei transienten Fehlern (500er, Timeouts)
- Double-Submit-Schutz fuer Chat-Nachrichten und Aktivitaets-Antraege

**Gut zu haben (Differenzierer), aber nicht zwingend:**
- Offline-Schreib-Queue fuer Chat-Nachrichten (mit Optimistic UI)
- Offline-Schreib-Queue fuer Aktivitaets-Antraege
- WebSocket-Reconnect mit State-Recovery (verpasste Nachrichten nachladen)
- App-Resume Sync via Capacitor appStateChange Event

**Bewusst zurueckstellen (v2+ oder nie):**
- Vollstaendiger Offline-Modus fuer Admin-Operationen — Konfliktpotenzial zu hoch
- Offline-Event-Buchung — Kapazitaetspruefung benoetigt Server-Validierung
- Offline-QR-Check-in — serverseitige Validierung zwingend
- Periodischer Hintergrund-Sync — App-Resume reicht, spart Batterie
- SQLite als lokale DB, CouchDB/PouchDB/RxDB — falsches Tool fuer PostgreSQL-Backend

Detailquelle: `.planning/research/FEATURES.md`

### Architektur-Ansatz

Die bestehende Architektur (ca. 30 Pages die direkt `api.get()` aufrufen, kein zentraler Data-Layer) wird durch einen einheitlichen Hook erweiterbar gemacht, ohne bestehende Pages komplett neu zu schreiben. Der Kernpattern: Jede Page ersetzt `api.get()` durch `useOfflineQuery(cacheKey, fetcher)` — eine mechanische Aenderung von ca. 10 Minuten pro Page. Alle neuen Services werden als Singletons implementiert (wie das bestehende api.ts und websocket.ts), keine neuen React-Contexts ausser `isOnline`-State im bestehenden AppContext.

**Neue Hauptkomponenten:**
1. `offlineCache.ts` — Lese-Cache: get/set/invalidate via Capacitor Preferences, TTL-basiert
2. `writeQueue.ts` — Schreib-Queue: FIFO, persistiert sofort, nur Chat + Aktivitaets-Antraege
3. `networkMonitor.ts` — Netzwerkstatus: Capacitor Network Plugin + navigator.onLine als Dual-Source
4. `syncManager.ts` — Sync-Koordinator: WriteQueue.flush + Cache-Invalidierung bei Reconnect/Resume
5. `useOfflineQuery.ts` — Cache-First Hook: ersetzt direktes api.get() in allen Pages
6. `OfflineBanner.tsx` — UI: Offline/Syncing-Status, global in App-Shell

**Backend-Aenderungen:**
- `GET /sync/changes?since=timestamp` — inkrementelle Aenderungs-Pruefung (kein Delta-Sync, nur "hat sich etwas geaendert?")
- `client_id` Spalte auf `chat_messages` + Deduplizierungs-Logik
- DB-Migration: `ALTER TABLE chat_messages ADD COLUMN client_id UUID` mit Unique Index

Detailquelle: `.planning/research/ARCHITECTURE.md`

### Kritische Pitfalls

1. **localStorage auf iOS kann geraeumt werden** — JWT-Token, User-Daten und Write-Queue SOFORT auf `@capacitor/preferences` migrieren bevor irgendetwas anderes gebaut wird. localStorage-Migration muss erste Implementierungsaufgabe sein. Betroffen: auth.ts, api.ts, LiveUpdateContext.tsx, AppContext.tsx.

2. **Axios 401-Handler loescht Token bei Offline-Zustand** — Aktuell unterscheidet der Handler nicht zwischen "Token abgelaufen" und "Server nicht erreichbar". Offline + 401 = sofortiger Logout. Fix: Netzwerkstatus pruefen BEVOR Token geloescht wird. Zweite Prioritaet, direkt nach Storage-Migration.

3. **Write-Queue ohne Idempotenz-Keys fuehrt zu Duplikaten** — Chat-Nachrichten und Aktivitaets-Antraege muessen bei Reconnect-Retry identifizierbar sein. client_id (UUID) muss von Anfang an in Queue und Backend vorhanden sein, nicht nachtraeglich hinzugefuegt werden.

4. **Socket.io reconnect ohne State-Recovery** — Nach Offline-Phase werden verpasste Chat-Nachrichten und Live-Updates nicht nachgeladen. SyncManager muss bei reconnect-Event `/sync/changes?since=lastSync` aufrufen und betroffene Cache-Keys invalidieren.

5. **Race Conditions beim Sync nach Reconnect** — Write-Queue, Socket.io Live-Updates und Hintergrund-Sync koennen sich gegenseitig ueberschreiben. Klare Sync-Reihenfolge: Erst Write-Queue abarbeiten, dann Read-Sync, dann Live-Updates aktivieren. Mutex im SyncManager.

Detailquelle: `.planning/research/PITFALLS.md`

## Implications for Roadmap

Die Forschung zeigt eine klare Abhaengigkeitskette: Ohne stabile Storage-Grundlage bricht alles andere. Ohne Netzwerk-Erkennung kann kein Cache-Layer sinnvoll entscheiden. Ohne Cache-Layer ist der SWR-Hook nicht implementierbar. Ohne SWR-Hook ist Page-Migration nicht sinnvoll. Schreib-Queue baut auf NetworkMonitor und Cache-Layer auf. SyncManager braucht beides.

### Phase 1: Fundament — Storage + Netzwerk + Schutzschicht

**Rationale:** Kritische Pitfalls 1 und 2 muessen zuerst geloest werden, sonst zieht jeder weitere Offline-Code auf einem instabilen Fundament. localStorage-Migration ist Voraussetzung fuer alles Nachfolgende.
**Delivers:** App loggt User nicht mehr faelschlicherweise aus, Token ist persistent, Netzwerkstatus global verfuegbar, Offline-Banner sichtbar.
**Addresses:** Table Stakes "Offline-Erkennung + Offline-Banner"
**Avoids:** Pitfall 1 (localStorage iOS), Pitfall 4 (JWT offline Logout)
**Tasks:**
- `@capacitor/network` und `@capacitor/preferences` installieren + `npx cap sync`
- `localStorage` -> `@capacitor/preferences` Migration fuer Token, User, DeviceID (mit Migrationspfad fuer bestehende User)
- `networkMonitor.ts` Singleton implementieren
- `isOnline` in AppContext integrieren
- Axios 401-Handler um Offline-Pruefung erweitern
- `OfflineBanner.tsx` in App-Shell einbauen

### Phase 2: Lese-Cache + SWR + Page-Migration

**Rationale:** Erst wenn Storage und Netzwerk-Erkennung stabil sind, macht ein Cache-Layer Sinn. Die mechanische Page-Migration (useOfflineQuery) kann dann schnell und risikoarm durchgefuehrt werden.
**Delivers:** App zeigt gecachte Daten bei Offline, Stale-While-Revalidate-Pattern, keine leeren Seiten mehr.
**Addresses:** Table Stakes "Offline-Lese-Cache Dashboard/Chat/Events", "Stale-While-Revalidate"
**Avoids:** Pitfall 9 (gefaehrlich alte Daten) durch TTL-Limits und Stale-Indikatoren
**Tasks:**
- `offlineCache.ts` implementieren mit TTL-Defaults (Dashboard 5 Min, Events 10 Min, Chat 1h)
- `useOfflineQuery.ts` Hook implementieren
- KonfiDashboardPage als Referenz-Migration
- Restliche ~25 Pages systematisch migrieren
- BadgeContext auf Cache-Fallback umstellen

### Phase 3: Retry-Logik + Double-Submit-Schutz

**Rationale:** Nachdem Read-Pfad stabil ist, Schreib-Pfad absichern. Retry-Logik und Double-Submit-Schutz sind unabhaengig voneinander und koennen parallel entwickelt werden. Idempotency-Keys hier implementieren, weil Phase 4 (Write-Queue) sie zwingend benoetigt.
**Delivers:** Keine doppelten Chat-Nachrichten oder Aktivitaets-Antraege, transiente Fehler werden automatisch wiederholt.
**Addresses:** Table Stakes "Automatischer Retry", "Double-Submit-Schutz"
**Avoids:** Pitfall 3 (Duplikate ohne Idempotenz) — Idempotency-Keys als erstes implementieren
**Tasks:**
- `axios-retry` installieren, Response-Interceptor in api.ts erweitern (3 Retries, Exponential Backoff, Jitter)
- `useActionGuard`-Hook fuer Frontend Button-Disable
- Backend: Idempotency-Key Middleware + `idempotency_keys` Tabelle
- Kritische Endpoints absichern: POST /chat/messages, POST /konfi/activities/request, POST /events/:id/book

### Phase 4: Schreib-Queue + Chat-Offline

**Rationale:** Komplexester Teil des Offline-Layers. Baut auf NetworkMonitor (Phase 1), Cache (Phase 2) und Idempotency-Keys (Phase 3) auf. Chat-Integration mit Socket.io erfordert sorgfaeltige Reihenfolge-Logik.
**Delivers:** Chat-Nachrichten werden bei Offline in Queue gespeichert und nach Reconnect automatisch gesendet. Aktivitaets-Antraege ebenfalls.
**Addresses:** Differenzierer "Offline-Schreib-Queue Chat + Aktivitaets-Antraege", "Optimistic UI"
**Avoids:** Pitfall 3 (Duplikate), Pitfall 6 (Race Conditions beim Reconnect)
**Tasks:**
- `writeQueue.ts` implementieren (FIFO, Capacitor Preferences, max 5 Retries)
- DB-Migration: `client_id` Spalte auf `chat_messages`
- ChatRoom.tsx: sendMessage -> WriteQueue bei offline + Optimistic UI
- RequestsPage: Aktivitaets-Antrag -> WriteQueue bei offline
- `@capawesome/capacitor-background-task` fuer Queue-Flush bei App-Background

### Phase 5: SyncManager + App-Resume Sync

**Rationale:** Letzter Baustein. Koordiniert alle vorigen Komponenten und schliesst die Sync-Luecke nach Offline-Phasen. Backend-Endpoint `/sync/changes` wird hier erst benoetigt.
**Delivers:** App ist nach App-Resume sofort aktuell. Chat verpasst keine Nachrichten. Socket.io reconnect loest automatisch Sync aus.
**Addresses:** Differenzierer "WebSocket-Reconnect mit State-Recovery", "App-Resume Sync"
**Avoids:** Pitfall 2 (Socket.io reconnect ohne Resync), Pitfall 6 (Race Conditions)
**Tasks:**
- Backend: `GET /sync/changes?since=timestamp` Endpoint
- `syncManager.ts` implementieren (WriteQueue.flush -> Read-Sync -> Cache-Invalidierung)
- Integration in AppContext Lifecycle (appStateChange)
- Socket.io reconnect -> SyncManager.syncOnReconnect()
- Periodischer Sync alle 5 Minuten (optional, nur wenn online)

### Phase-Reihenfolge Begruendung

- Phasen 1-2 sind Fundament: ohne sie ist kein sinnvoller Offline-Support moeglich und jede weitere Arbeit riskiert instabile Grundlage
- Phase 3 hat keine harte Abhaengigkeit von Phase 2 (kann parallelisiert werden), aber der Read-Pfad sollte stabil sein bevor man den Schreib-Pfad absichert
- Phase 4 hat harte Abhaengigkeit von Phase 3 (Idempotency-Keys MUESSEN vorher da sein)
- Phase 5 ist der Integrations-Baustein — er verbindet alle vorherigen Phasen und hat die meisten Backend-Aenderungen, daher zuletzt

### Research Flags

Phasen die wahrscheinlich tiefere Recherche waehrend der Planung brauchen:
- **Phase 4 (Write-Queue):** Chat-Queue mit Socket.io ist komplex — Reihenfolge-Garantie bei Socket.io Events und HTTP-Idempotency mischen sich auf unerwartete Weise. Konkrete Socket.io-Integration mit bestehendem websocket.ts pruefen.
- **Phase 5 (SyncManager):** Backend `/sync/changes` Endpoint erfordert `updated_at`-Felder auf mehreren Tabellen — DB-Schema pruefen ob diese Felder bereits vorhanden sind.

Phasen mit Standard-Patterns (keine tiefere Recherche noetig):
- **Phase 1 (Storage/Netzwerk):** Capacitor Network + Preferences sind offiziell dokumentiert, kein unbekanntes Terrain
- **Phase 2 (Lese-Cache):** Stale-While-Revalidate ist ein bewaehrtes Pattern, Page-Migration ist mechanisch
- **Phase 3 (Retry/Idempotency):** Axios-Retry und Idempotency-Key-Pattern sind gut dokumentiert (Stripe-Pattern)

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Offizielle Capacitor-Doku, konkrete Versionen geprueft, Over-Engineering klar ausgeschlossen |
| Features | HIGH | Codebase direkt analysiert, Ist-Zustand vollstaendig verstanden, klare Scope-Grenzen |
| Architecture | HIGH | Basiert auf direkter Codebase-Analyse (api.ts, websocket.ts, Contexts), keine Annahmen |
| Pitfalls | HIGH | Referenziert konkrete GitHub Issues und offizielle Docs, iOS localStorage Problem gut dokumentiert |

**Overall confidence:** HIGH

### Gaps to Address

- **updated_at Felder in DB:** Fuer `/sync/changes` braucht das Backend `updated_at` auf mehreren Tabellen. Es ist unklar ob diese bereits vorhanden sind. Bei Phase 5 Planung Schema pruefen.
- **iOS 17 Storage Quota API:** `navigator.storage.estimate()` ist ab iOS 17 verfuegbar. Fuer aeltere Geraete faellt dieser Fallback weg. In Phase 2 entscheiden ob Quota-Pruefung noetig ist.
- **Socket.io Connection State Recovery:** Das v4-Feature erlaubt kurze Reconnects ohne Datenverlust (nur bei Verbindungsunterbruch < 2 Minuten). In Phase 5 pruefen ob es fuer den Use-Case sinnvoll nutzbar ist.

## Sources

### Primary (HIGH confidence)
- Capacitor Network Plugin API — https://capacitorjs.com/docs/apis/network
- Capacitor Preferences Plugin API — https://capacitorjs.com/docs/apis/preferences
- Capacitor Storage Guide — https://capacitorjs.com/docs/guides/storage
- Capawesome Background Task v7 — https://capawesome.io/plugins/background-task/
- Capacitor Issue #636 — localStorage lost on reboot (iOS)
- WebKit Storage Policy Updates — https://webkit.org/blog/14403/updates-to-storage-policy/
- Socket.IO Connection State Recovery Docs — https://socket.io/docs/v4/connection-state-recovery
- MDN: Storage quotas and eviction — https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria

### Secondary (MEDIUM confidence)
- Ionic Blog: Best Practices for Building Offline Apps — allgemeine Patterns, herstellernah
- Ionic Blog: Choosing a Data Storage Solution — Storage-Vergleich
- web.dev: Stale-While-Revalidate — https://web.dev/articles/stale-while-revalidate
- web.dev: Offline UX Design Guidelines — Banner-Pattern
- axios-retry npm — https://www.npmjs.com/package/axios-retry
- RxDB Capacitor Database Guide — Vergleich IndexedDB vs SQLite Performance (herstellernah)

### Tertiary (LOW confidence)
- Sachith: Offline sync & conflict resolution patterns (Feb 2026) — Sync-Architektur-Vergleich, einzelne Quelle
- LeanCode: Offline Mobile App Design — allgemeine Empfehlungen ohne Capacitor-Spezifik

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
