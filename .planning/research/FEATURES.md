# Feature Landscape: Offline/Resilienz (v2.1)

**Domain:** Offline-First-Faehigkeiten fuer Ionic/Capacitor Hybrid-App (Kirchengemeinde)
**Recherchiert:** 2026-03-19
**Konfidenz:** HIGH (etablierte Patterns, Capacitor-Oekosystem gut dokumentiert, Codebase analysiert)

## Ist-Zustand Analyse

### Aktueller Offline-Support: Keiner

| Aspekt | Status | Auswirkung |
|--------|--------|-----------|
| API-Calls | Kein Cache, kein Retry | App zeigt leere Seite oder Fehler wenn offline |
| Netzwerk-Erkennung | Nicht implementiert | App weiss nicht ob online/offline |
| Schreib-Operationen | Fire-and-forget | Bei Verbindungsabbruch: Daten verloren |
| Double-Submit | Kein Schutz | Doppelte Chat-Nachrichten, doppelte Antraege moeglich |
| WebSocket (Chat) | Reconnect vorhanden (10 Versuche) | Verpasste Nachrichten nach Reconnect nicht nachgeladen |
| Datenpersistenz | localStorage fuer Token/User | Keine gecachten API-Daten |

### Bestehende Infrastruktur die genutzt werden kann

| Komponente | Datei | Relevanz |
|-----------|-------|---------|
| Axios-Interceptor | `services/api.ts` | Bereits 401/429-Handler, erweiterbar um Retry + Cache |
| Socket.io-Client | `services/websocket.ts` | Reconnect-Logik vorhanden, erweiterbar um State-Recovery |
| AppContext | `contexts/AppContext.tsx` | Globaler State, erweiterbar um NetworkContext |
| BadgeContext | `contexts/BadgeContext.tsx` | Unread-Counts, muessen gecacht werden |
| Capacitor Core | `package.json` | @capacitor/core ^7.6.0 — Network Plugin verfuegbar |

## Table Stakes

Features die Nutzer bei einer App mit Offline-Unterstuetzung erwarten. Fehlen = App fuehlt sich unzuverlaessig an.

| Feature | Warum erwartet | Komplexitaet | Abhaengigkeiten im bestehenden System |
|---------|---------------|--------------|---------------------------------------|
| Offline-Lese-Cache (Dashboard) | Konfis oeffnen App ohne Netz und sehen leere Seite — inakzeptabel | Mittel | AppContext laedt alle Dashboard-Daten per API-Call, kein Cache vorhanden |
| Offline-Lese-Cache (Chat-Verlauf) | Chat ist Kernfunktion, Nachrichten muessen auch offline lesbar sein | Mittel | Socket.io liefert Live-Daten, REST liefert History — beides ohne Cache |
| Offline-Lese-Cache (Events) | Konfi will nachschauen wann/wo Event ist, gerade unterwegs ohne Netz | Niedrig | Einfache GET-Responses, gut cachebar |
| Offline-Banner/Indikator | Nutzer muss wissen WARUM Aktionen nicht gehen, sonst Frustration | Niedrig | @capacitor/network Plugin fuer Status, UI-Banner global |
| Stale-While-Revalidate | Sofort gecachte Daten zeigen, im Hintergrund aktualisieren — App fuehlt sich schnell an | Mittel | Erfordert Cache-Layer zwischen API-Service und Komponenten |
| Automatischer Retry bei transienten Fehlern | 500er/Timeout duerfen nicht sofort "Fehler" zeigen, Retry ist Standard | Niedrig | Axios-Interceptor bereits vorhanden, Erweiterung um Retry-Logik |
| Double-Submit-Schutz | Doppeltes Absenden von Chat-Nachrichten oder Aktivitaets-Antraegen | Niedrig | Loading-States und Button-Disable pro Aktion |

## Differentiators

Features die die App absetzen, aber nicht zwingend erwartet werden.

| Feature | Wertversprechen | Komplexitaet | Abhaengigkeiten |
|---------|----------------|--------------|-----------------|
| Offline-Schreib-Queue (Chat) | Nachricht tippen ohne Netz, wird automatisch bei Reconnect gesendet | Hoch | Socket.io-Integration, Queue-Persistenz, Reihenfolge-Garantie |
| Offline-Schreib-Queue (Aktivitaets-Antraege) | Konfi kann Aktivitaet beantragen auch wenn kurz kein Netz | Mittel | REST-basiert, einfacher als Chat, aber braucht Idempotency |
| Inkrementeller Sync (Delta statt Full-Reload) | Nur geaenderte Daten laden spart Bandbreite und Zeit | Hoch | Backend muss `updated_at`/`since`-Parameter unterstuetzen, aktuell nicht vorhanden |
| Hintergrund-Sync (periodisch) | App aktualisiert Daten ohne dass Nutzer aktiv oeffnet | Mittel | Capacitor Background Task API, begrenzt auf iOS/Android |
| WebSocket-Reconnect mit State-Recovery | Nach Reconnect verpasste Chat-Nachrichten nachladen | Mittel | Socket.io hat reconnect, aber kein "seit wann"-Nachladen implementiert |
| Optimistic UI fuer Chat | Nachricht sofort anzeigen, Bestaetigungs-Haekchen nach Server-ACK | Mittel | Chat-UI muss "pending"-Status pro Nachricht unterstuetzen |

## Anti-Features

Features die bewusst NICHT gebaut werden sollen.

| Anti-Feature | Warum vermeiden | Was stattdessen tun |
|--------------|----------------|---------------------|
| Vollstaendiger Offline-Modus (alle Schreib-Operationen) | Kirchengemeinde-App mit ~50-200 Nutzern, nicht Notion. Admin-Aktionen (Punkte vergeben, Events erstellen) offline = Chaos mit Konflikten | Nur Lese-Cache + begrenzte Schreib-Queue (Chat + Aktivitaets-Antraege) |
| Conflict Resolution mit User-Prompt | Konfis sind 13-14 Jahre alt, "Konflikt aufloesen" ueberfordert | Last-Write-Wins fuer die wenigen Schreib-Operationen, Server ist autoritativ |
| CouchDB/PouchDB/RxDB Sync-Framework | Massiver Overhead fuer kleine Nutzerbasis, PostgreSQL-Backend bleibt | Einfacher Cache-Layer mit Capacitor Preferences |
| Service Worker fuer Offline | Capacitor-App laeuft nativ im WebView, Service Worker bringt Komplexitaet ohne echten Nutzen | Nativer Cache ueber Capacitor APIs + localStorage |
| SQLite als lokale Datenbank | Overkill fuer Cache-Daten (<50KB pro Response), zusaetzliches Plugin, Migration-Aufwand | localStorage + Capacitor Preferences fuer strukturierte JSON-Daten reichen |
| Offline-Event-Buchung | Kapazitaetspruefung, Warteliste, Timeslots — alles Server-seitig, nicht offline sinnvoll | Event-Daten lesen: ja. Buchen: nur online mit klarer Fehlermeldung |
| Offline-QR-Check-in | QR-Scan benoetigt Server-Validierung (Zeitfenster, Duplikat-Check) | Check-in nur online, Offline-Banner zeigt "Internetverbindung noetig" |

## Feature-Details

### 1. Cache-Layer (Stale-While-Revalidate)

**Pattern:** Jeder API-Call geht durch eine Cache-Schicht.
1. Cache pruefen — wenn vorhanden, sofort zurueckgeben
2. API-Call im Hintergrund starten
3. Bei Erfolg: Cache aktualisieren, UI mit neuen Daten aktualisieren
4. Bei Fehler (offline): Gecachte Daten bleiben stehen, kein Fehler-UI

**Was cachen (nach Prioritaet):**

| Daten | Cache-Key-Schema | TTL | Prioritaet |
|-------|-----------------|-----|------------|
| Dashboard (Punkte, Ringe, Level) | `cache:dashboard:{userId}` | 5 Min | P0 |
| Chat-Raumliste | `cache:chatrooms:{userId}` | 2 Min | P0 |
| Chat-Nachrichten (pro Raum, letzte 50) | `cache:chat:{roomId}` | 1 Min (Live via WS) | P0 |
| Event-Liste | `cache:events:{orgId}` | 10 Min | P1 |
| Profil-Daten | `cache:profile:{userId}` | 30 Min | P1 |
| Eigene Antraege | `cache:requests:{userId}` | 5 Min | P1 |
| Aktivitaeten-Katalog | `cache:activities:{orgId}` | 1 Stunde | P2 |
| Badge-Katalog | `cache:badges:{orgId}` | 1 Stunde | P2 |

**Speicher-Strategie:** `localStorage` fuer Web-Dev, gleicher Code funktioniert auch im Capacitor-WebView nativ. Kein SQLite noetig — die Datenmengen sind klein (JSON-Responses typisch < 50KB). localStorage hat 5-10MB Limit, reicht fuer diese App bei weitem.

**Bekanntes Risiko:** Browser/WebView kann localStorage bei Speicherdruck loeschen. Fuer eine App mit 50-200 Nutzern und kleinen Datenmengen ist das akzeptabel — Worst Case: Daten werden frisch geladen.

**Konfidenz:** HIGH — Stale-While-Revalidate ist ein etabliertes Pattern, dokumentiert auf web.dev und in der React-Community.

### 2. Netzwerk-Status-Erkennung

**Technologie:** `@capacitor/network` Plugin (Teil des Capacitor-Oekosystems, muss separat installiert werden).

**Pattern:**
- `Network.addListener('networkStatusChange', ...)` fuer Live-Updates
- `Network.getStatus()` fuer initialen Status beim App-Start
- Globaler React-Context (`NetworkContext`) der `isOnline`-State haelt
- Alle Komponenten koennen via `useNetwork()` den Status abfragen

**Bekannte Einschraenkung:** Plugin meldet `connected: true` bei VPN ohne echte Konnektivitaet ([GitHub Issue #1917](https://github.com/ionic-team/capacitor-plugins/issues/1917)). Fuer diese App akzeptabel — bei fehlgeschlagenem API-Call wird offline-Status trotzdem korrekt erkannt via Axios-Error.

**Quellen:** [Capacitor Network API Docs](https://capacitorjs.com/docs/apis/network)

### 3. Offline-Banner UI

**Pattern:** Globaler Banner am oberen Bildschirmrand (unter IonHeader), nicht-dismissbar solange offline.

**Verhalten:**

| Status | Banner-Stil | Text | Dauer |
|--------|------------|------|-------|
| Offline | Gelb/Orange, IonIcon `cloudOfflineOutline` | "Kein Internet — gespeicherte Daten werden angezeigt" | Permanent bis online |
| Reconnecting | Gelb mit Spinner | "Verbindung wird hergestellt..." | Permanent bis connected |
| Zurueck online | Gruen, IonIcon `cloudDoneOutline` | "Wieder verbunden" | 3 Sekunden, dann ausblenden |
| Sync laeuft | Dezent grau, kleiner Spinner | "Daten werden aktualisiert..." | Bis Sync fertig |

**UX-Regeln (nach web.dev Offline UX Guidelines):**
- NICHT grau einfaerben (verwechselbar mit "deaktiviert")
- NICHT aggressive Fehlermeldung (kein rotes X)
- Klar kommunizieren was GEHT (lesen) und was NICHT geht (senden)
- IonIcon verwenden, keine Unicode-Emojis (Projekt-Regel)

**Implementierung:** Globale Komponente `<OfflineBanner />` in App.tsx, nutzt `useNetwork()` Hook.

**Konfidenz:** HIGH — Standard-Pattern, von Slack/WhatsApp etabliert.

### 4. Schreib-Queue

**Nur fuer zwei Operationen:**
1. **Chat-Nachrichten** — Nachricht in lokale Queue, Optimistic UI (Nachricht sofort anzeigen mit "pending"-Indikator), bei Reconnect in Reihenfolge senden
2. **Aktivitaets-Antraege** — Antrag lokal speichern, bei Reconnect an API senden

**Queue-Design:**
```typescript
interface QueueItem {
  id: string;            // UUID, Client-generiert (= Idempotency Key)
  type: 'chat_message' | 'activity_request';
  payload: Record<string, unknown>;
  created_at: number;    // Timestamp
  retry_count: number;
  max_retries: number;   // 5
  status: 'pending' | 'sending' | 'failed' | 'sent';
}
```

**Persistenz:** `localStorage` unter Key `offline_queue` (Queue ueberlebt App-Neustart).

**Abarbeitung:**
1. Bei Reconnect (NetworkContext `isOnline` wird true): Queue abarbeiten
2. Reihenfolge: FIFO (First In, First Out) — wichtig fuer Chat-Nachrichten
3. Zwischen Items: 200ms Pause (verhindert Server-Ueberlastung)
4. Bei Fehler: Exponential Backoff (1s, 2s, 4s), max 5 Retries
5. Nach 5 Fehlversuchen: Item als `failed` markieren, Nutzer informieren

**Konflikt-Strategie:** Last-Write-Wins. Server ist autoritativ. Client-UUID dient als Idempotency-Key — Server lehnt Duplikate ab (identische Response zurueck).

**Backend-Aenderung noetig:** `X-Idempotency-Key` Header auf POST-Endpoints fuer Chat und Aktivitaets-Antraege. Server speichert Key + Response in `idempotency_keys`-Tabelle (auto-cleanup nach 24h via bestehenden Background-Service).

**Konfidenz:** MEDIUM — Pattern ist klar, aber Integration mit Socket.io-Chat erfordert sorgfaeltige Reihenfolge-Logik. Chat-Queue ist komplexer als REST-Queue weil Socket.io Events nicht direkt mit HTTP-Idempotency arbeiten.

### 5. Retry-Logik (Exponential Backoff)

**Wo:** Axios-Interceptor in `services/api.ts` (bereits vorhanden, muss erweitert werden).

**Welche Fehler retrien:**
- HTTP 500, 502, 503, 504 (Server-Fehler)
- Netzwerk-Timeouts (`ECONNABORTED`)
- `ERR_NETWORK` (kein Netz)

**NICHT retrien:**
- HTTP 400, 401, 403, 404, 422 (Client-Fehler — Retry aendert nichts)
- HTTP 429 (Rate-Limit — bereits behandelt mit eigenem Handler)

**Parameter:**
- Max 3 Retries
- Delays: 1s, 2s, 4s (exponential, Basis 2)
- Jitter: +/- 500ms (verhindert Thundering Herd bei vielen gleichzeitigen Reconnects)
- Nur GET-Requests automatisch retrien (idempotent per Definition)
- POST/PUT/DELETE nur retrien wenn `X-Idempotency-Key` Header vorhanden

**Bibliothek:** Kein externes Paket noetig — ~30 Zeilen im Axios-Interceptor. Die Logik ist trivial:
```typescript
const delay = Math.pow(2, retryCount) * 1000 + Math.random() * 1000;
```

**Konfidenz:** HIGH — Trivial zu implementieren, gut verstandenes Pattern.

### 6. Double-Submit-Schutz

**Frontend-seitig:**
- `useActionGuard(action)` Hook: Wrapped async Aktion, setzt `isSubmitting`, disabled Button
- Idempotency-Key pro Formular-Submit (UUID generiert bei Form-Open, regeneriert nach Erfolg)
- Chat-Sende-Button: Disabled waehrend Nachricht gesendet wird

**Backend-seitig:**
- `X-Idempotency-Key` Header auf kritischen POST-Endpoints
- Middleware prueft: Key bereits gesehen? -> gespeicherte Response zurueckgeben
- Tabelle `idempotency_keys (key VARCHAR PRIMARY KEY, response JSONB, created_at TIMESTAMPTZ)`
- Cleanup: Keys aelter als 24h loeschen (im bestehenden Background-Service `backgroundService.js`)

**Kritische Endpoints fuer Idempotency:**
- POST `/chat/messages` (Chat-Nachricht senden)
- POST `/konfi/activities/request` (Aktivitaets-Antrag)
- POST `/events/:id/book` (Event-Buchung)
- POST `/bonus-points` (Bonus-Punkte vergeben)

**Konfidenz:** HIGH — Standard-Pattern, von Stripe/Shopify etabliert.

### 7. Inkrementeller Sync

**Zwei Trigger:**
1. **App-Start (App.tsx `useEffect`):** Alle gecachten Daten aktualisieren
2. **App-Resume (Capacitor App `appStateChange`):** Daten aktualisieren wenn App in Vordergrund kommt

**Phase 1 (ohne Backend-Aenderung):**
- Full-Reload aller gecachten Endpoints bei App-Start/Resume
- SWR-Pattern: Gecachte Daten sofort zeigen, im Hintergrund neu laden
- WebSocket-Events als Live-Update-Kanal (bereits vorhanden fuer Chat)
- Kein periodischer Hintergrund-Sync noetig — App-Resume reicht

**Phase 2 (mit Backend-Aenderung, optional):**
- `?since=ISO-Timestamp` Parameter auf GET-Endpoints
- Backend gibt nur Aenderungen seit Timestamp zurueck
- Spart Bandbreite bei grossen Chat-Historien
- `updated_at` Spalte auf relevanten Tabellen (falls nicht vorhanden)

**WebSocket-Recovery nach Reconnect:**
- Socket.io `reconnect`-Event nutzen
- Chat-Nachrichten seit letzter bekannter Message-ID nachladen (`GET /chat/:roomId/messages?after=lastMsgId`)
- Dashboard-Daten einmal komplett neu laden
- Badge-Counts aktualisieren

**Konfidenz:** MEDIUM fuer Phase 1 (einfach), LOW fuer Phase 2 (braucht Backend-Aenderungen, muss sorgfaeltig geplant werden).

## Feature-Abhaengigkeiten

```
@capacitor/network Plugin installieren
  |
  v
NetworkContext (isOnline State)
  |
  +--> Offline-Banner (liest isOnline)
  |
  +--> Cache-Layer / SWR-Pattern
  |      |
  |      +--> Offline-Lese-Cache (Dashboard, Chat, Events, Profil)
  |      |
  |      +--> Inkrementeller Sync (nutzt Cache-Invalidierung)
  |
  +--> Schreib-Queue
  |      |
  |      +--> Idempotency-Keys (Backend) <-- auch fuer Double-Submit
  |      |
  |      +--> Chat-Queue (Socket.io Integration)
  |      |
  |      +--> Aktivitaets-Antrags-Queue (REST)
  |
  +--> Retry-Logik (Axios-Interceptor)
         |
         +--> Idempotency-Keys fuer POST-Retries

Double-Submit-Schutz (Frontend useActionGuard Hook)
  |
  +--> Idempotency-Keys (Backend, gleiche Tabelle)
```

## MVP-Empfehlung

### Phase 1 — Fundament (muss zuerst, alle anderen bauen darauf auf):
1. NetworkContext + `@capacitor/network` Plugin
2. Offline-Banner UI-Komponente
3. Cache-Layer Service mit SWR-Pattern
4. Retry-Logik im Axios-Interceptor
5. Offline-Lese-Cache fuer Dashboard, Events, Profil, Chat-Raeume

**Ergebnis:** App zeigt gecachte Daten statt leerer Seite, Nutzer sieht Offline-Status, transiente Fehler werden automatisch wiederholt.

### Phase 2 — Schreib-Resilienz (baut auf Phase 1 auf):
6. Double-Submit-Schutz (Frontend `useActionGuard` Hook)
7. Idempotency-Keys (Backend-Middleware + DB-Tabelle)
8. Schreib-Queue Service
9. Chat-Nachrichten-Queue mit Optimistic UI
10. Aktivitaets-Antrags-Queue

**Ergebnis:** Keine doppelten Submits, Chat-Nachrichten werden bei Reconnect automatisch gesendet.

### Phase 3 — Sync-Optimierung (optional, bei Bedarf):
11. App-Resume Sync (Capacitor App Plugin `appStateChange`)
12. WebSocket-Recovery (verpasste Nachrichten nachladen)
13. Inkrementeller Sync mit `since`-Parameter (Backend-Erweiterung)

**Ergebnis:** App ist nach Hintergrund-Phase sofort aktuell, Chat verpasst keine Nachrichten.

### Zurueckstellen:
- SQLite lokale DB — Overkill fuer diese Datenmenge
- CouchDB/PouchDB/RxDB Sync — falsches Tool fuer PostgreSQL-Backend
- Periodischer Hintergrund-Sync — App-Resume reicht, spart Batterie
- Offline-Event-Buchung — Server-Validierung zwingend noetig
- Offline-Admin-Operationen — Konfliktpotenzial zu hoch

## Feature-Priorisierungs-Matrix

| Feature | Nutzer-Wert | Implementierungskosten | Abhaengigkeiten | Prioritaet |
|---------|------------|----------------------|-----------------|-----------|
| NetworkContext + Plugin | HOCH (Basis fuer alles) | NIEDRIG | Keine | P0 |
| Offline-Banner | HOCH | NIEDRIG | NetworkContext | P0 |
| Cache-Layer SWR | HOCH | MITTEL | NetworkContext | P0 |
| Retry-Logik | HOCH | NIEDRIG | Axios-Interceptor (existiert) | P0 |
| Offline-Lese-Cache | HOCH | MITTEL | Cache-Layer | P0 |
| Double-Submit-Schutz (FE) | HOCH | NIEDRIG | Keine | P1 |
| Idempotency-Keys (BE) | HOCH | MITTEL | DB-Migration | P1 |
| Chat-Schreib-Queue | MITTEL | HOCH | Queue-Service, Idempotency, Socket.io | P1 |
| Aktivitaets-Queue | MITTEL | MITTEL | Queue-Service, Idempotency | P1 |
| Optimistic UI Chat | MITTEL | MITTEL | Chat-Schreib-Queue | P1 |
| App-Resume Sync | MITTEL | NIEDRIG | Cache-Layer, Capacitor App Plugin | P2 |
| WS-Recovery | MITTEL | MITTEL | Socket.io, Backend-Endpoint | P2 |
| Inkrementeller Sync | NIEDRIG | HOCH | Backend-Aenderungen (updated_at, since-Parameter) | P3 |
| Periodischer BG-Sync | NIEDRIG | MITTEL | Capacitor Background Task | P3 |

## Quellen

- [Ionic Blog: Best Practices for Building Offline Apps](https://ionic.io/blog/best-practices-for-building-offline-apps)
- [Ionic: Enterprise Guide Offline](https://ionic.io/enterprise-guide/offline)
- [Capacitor Network Plugin API](https://capacitorjs.com/docs/apis/network)
- [Capacitor Storage Guide](https://capacitorjs.com/docs/guides/storage)
- [web.dev: Keeping things fresh with stale-while-revalidate](https://web.dev/articles/stale-while-revalidate)
- [web.dev: Offline UX Design Guidelines](https://web.dev/articles/offline-ux-design-guidelines)
- [Ionic: Choosing a Data Storage Solution](https://ionic.io/blog/choosing-a-data-storage-solution-ionic-storage-capacitor-storage-sqlite-or-ionic-secure-storage)
- [Think-it: Building Offline Apps - A Fullstack Approach](https://think-it.io/insights/offline-apps)
- [Android Developers: Build an offline-first app](https://developer.android.com/topic/architecture/data-layer/offline-first)
- [Sachith: Offline sync & conflict resolution patterns (Feb 2026)](https://www.sachith.co.uk/offline-sync-conflict-resolution-patterns-architecture-trade%E2%80%91offs-practical-guide-feb-19-2026/)
- [LeanCode: Offline Mobile App Design](https://leancode.co/blog/offline-mobile-app-design)
- [GitHub Issue #1917: Network Plugin VPN false positive](https://github.com/ionic-team/capacitor-plugins/issues/1917)
- [npm: exponential-backoff](https://www.npmjs.com/package/exponential-backoff)

---
*Feature-Research fuer: Konfi Quest v2.1 App-Resilienz (Offline/Schreib-Queue/Sync)*
*Recherchiert: 2026-03-19*
