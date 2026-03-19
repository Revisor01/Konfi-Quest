# Domain Pitfalls: Offline-First in bestehender Ionic/Capacitor App

**Domain:** Offline-Caching und Sync fuer Hybrid-App mit PostgreSQL, Socket.io, JWT Auth
**Researched:** 2026-03-19
**Confidence:** HIGH (basierend auf Codebase-Analyse + offizielle Capacitor/Socket.io Docs + Community-Erfahrungen)

---

## Kritische Pitfalls

Fehler, die zu Datenverlust, Rewrites oder schweren Bugs fuehren.

### Pitfall 1: localStorage als Offline-Cache auf iOS

**Was schief geht:** Die gesamte App nutzt aktuell `localStorage` fuer Token und User-Daten (`konfi_token`, `konfi_user`). Wenn man den Offline-Cache ebenfalls auf localStorage aufbaut, kann iOS den gesamten WKWebView-Storage raeumen -- bei Speicherdruck, nach Force-Close, oder wenn die App lange im Hintergrund war. Das betrifft ALLE localStorage-Daten, inklusive des JWT-Tokens.

**Warum es passiert:** WKWebView behandelt localStorage als Cache, nicht als persistenten Speicher. iOS kann diesen jederzeit ohne Warnung loeschen. Das ist dokumentiertes Verhalten, kein Bug.

**Konsequenzen:**
- User wird ploetzlich ausgeloggt (Token weg)
- Offline-Cache komplett verloren
- Ungesendete Nachrichten in der Write-Queue verloren
- User muss sich neu einloggen, obwohl JWT noch 90 Tage gueltig waere

**Praevention:**
1. JWT-Token und User-Daten SOFORT auf `@capacitor/preferences` migrieren (UserDefaults/SharedPreferences, 100% persistent)
2. Offline-Cache in IndexedDB speichern (groesser als localStorage, async, aber AUCH nicht 100% persistent auf iOS)
3. Fuer die Write-Queue (ungesendete Nachrichten/Antraege) ZUSAETZLICH `@capacitor/preferences` als Backup verwenden
4. Kritische Daten (Token, Queue) niemals NUR in localStorage

**Erkennung:** Sporadische Logout-Reports von iOS-Usern, "weisser Bildschirm" nach App-Resume

**Betroffene Dateien:**
- `frontend/src/services/auth.ts` -- `localStorage.getItem('konfi_token')`
- `frontend/src/services/api.ts` -- Axios Interceptor liest Token aus localStorage
- `frontend/src/contexts/LiveUpdateContext.tsx` -- Token aus localStorage fuer WebSocket
- `frontend/src/contexts/AppContext.tsx` -- Device ID Fallback in localStorage

---

### Pitfall 2: Socket.io Reconnect ohne Daten-Resync

**Was schief geht:** Nach einem Offline-Zeitraum reconnected Socket.io automatisch (bis zu 10 Versuche konfiguriert), aber die App hat KEINE Logik, die verpassten Events nachzuladen. Der User sieht veraltete Daten bis zum naechsten manuellen Refresh.

**Warum es passiert:** Socket.io puffert zwar ausgehende Events waehrend der Trennung, aber eingehende Events (neue Chat-Nachrichten, Dashboard-Updates, Badge-Aenderungen) gehen verloren. Die aktuelle `LiveUpdateContext.tsx` lauscht auf Events, hat aber keinen Mechanismus fuer "was habe ich verpasst?".

**Konsequenzen:**
- Chat zeigt nicht alle Nachrichten nach Reconnect
- Dashboard-Daten (Punkte, Level) veraltet
- Badge-Counts stimmen nicht
- User merkt nicht, dass Daten fehlen -- kein visueller Hinweis

**Praevention:**
1. Bei jedem `socket.on('connect')` einen Timestamp des letzten erfolgreichen Syncs mitschicken
2. Backend-Endpoint `/api/sync/since?timestamp=X` der geaenderte Daten seit X liefert
3. NICHT auf Socket.io Connection State Recovery verlassen -- funktioniert nur bei kurzen Unterbrechungen (< 2 Minuten)
4. Stale-While-Revalidate: Gecachte Daten sofort zeigen, nach Reconnect im Hintergrund aktualisieren

**Erkennung:** Chat-Nachrichten fehlen nach Flugmodus, Dashboard zeigt alte Punktestaende

---

### Pitfall 3: Write-Queue ohne Idempotenz-Keys

**Was schief geht:** Offline gesammelte Chat-Nachrichten oder Aktivitaets-Antraege werden bei Reconnect gesendet. Wenn die Verbindung waehrend des Sendens abbricht, werden dieselben Requests erneut gesendet -- doppelte Nachrichten, doppelte Antraege.

**Warum es passiert:** HTTP-Requests sind nicht idempotent (POST erstellt jedes Mal eine neue Ressource). Ohne Client-seitige Request-ID kann das Backend Duplikate nicht erkennen.

**Konsequenzen:**
- Doppelte Chat-Nachrichten
- Doppelte Aktivitaets-Antraege (mit doppelten Punkten!)
- Doppelte Event-Buchungen

**Praevention:**
1. Jeder queued Request bekommt eine UUID (`crypto.randomUUID()`)
2. Backend prueft auf `idempotency_key` und ignoriert Duplikate (409 Conflict oder 200 mit bestehendem Result)
3. Queue-Eintraege erst nach erfolgreicher Server-Bestaetigung entfernen (nicht nach dem Senden)
4. Retry-Logik mit Exponential Backoff: 1s, 2s, 4s, 8s, max 30s

**Erkennung:** Doppelte Eintraege in DB nach Netzwerk-Wechseln (WiFi zu LTE)

---

### Pitfall 4: JWT laeuft offline ab, kein Refresh-Token

**Was schief geht:** Der JWT hat 90 Tage Laufzeit (hardcoded in `auth.js:132`). Es gibt keinen Refresh-Token-Mechanismus. Wenn ein User laengere Zeit offline war und der Token ablaeuft, kann er sich nicht automatisch re-authentifizieren. Der Axios-Interceptor in `api.ts:28-33` loescht sofort Token und User und leitet auf `/` weiter -- auch wenn der User gerade offline ist.

**Warum es passiert:** Bei 90 Tagen Laufzeit ist Ablauf selten, aber: (a) der 401-Handler in api.ts unterscheidet nicht zwischen "Token abgelaufen" und "Server nicht erreichbar", (b) ein Netzwerkfehler kann als 401 fehlinterpretiert werden wenn ein Proxy dazwischen steht.

**Konsequenzen:**
- User wird waehrend Offline-Nutzung ausgeloggt
- Alle gecachten Daten werden unzugaenglich (App zeigt Login-Screen)
- Write-Queue kann nicht mehr synchronisiert werden (kein gültiger Token)

**Praevention:**
1. 401-Handler MUSS pruefen ob Netzwerk verfuegbar ist BEVOR Token geloescht wird
2. Offline-Zustand: 401 ignorieren, Token behalten, bei Reconnect erneut versuchen
3. Token-Ablauf client-seitig pruefen (JWT dekodieren, `exp` Feld lesen) BEVOR Request gesendet wird
4. Optional: Refresh-Token einbauen (long-lived, in Capacitor Preferences gespeichert)
5. Mindestens: Bei Token-Ablauf waehrend Offline den User NICHT ausloggen, sondern nach Reconnect Re-Login-Dialog zeigen

**Erkennung:** User-Reports "App hat mich ausgeloggt obwohl ich nichts gemacht habe"

---

## Moderate Pitfalls

### Pitfall 5: IndexedDB Storage-Limits auf iOS ueberschreiten

**Was schief geht:** Wenn Chat-Nachrichten mit Dateien/Bildern gecacht werden, kann der Storage schnell wachsen. WKWebView-Apps bekommen ca. 15% des Gesamtspeichers als Quota. Auf einem 64GB iPhone mit 50GB belegt sind das nur ~2GB -- klingt viel, aber Base64-kodierte Bilder aus dem Chat fressen das schnell auf.

**Praevention:**
1. Bilder/Dateien NICHT im Cache speichern -- nur Metadaten und Thumbnails
2. Cache-Groesse pro Datentyp begrenzen (z.B. max. 500 Chat-Nachrichten pro Raum)
3. LRU-Eviction: Aelteste Eintraege automatisch loeschen wenn Limit erreicht
4. `navigator.storage.estimate()` nutzen um Quota zu pruefen (ab Safari 17/iOS 17)
5. QuotaExceededError abfangen und graceful degraden

**Erkennung:** `QuotaExceededError` Exceptions in Sentry/Error-Tracking

---

### Pitfall 6: Race Conditions beim Sync nach Reconnect

**Was schief geht:** App kommt online, mehrere Systeme starten gleichzeitig: (a) Write-Queue sendet gepufferte Requests, (b) Socket.io reconnected und sendet Live-Updates, (c) Hintergrund-Sync laedt aktuelle Daten. Diese drei Prozesse koennen sich gegenseitig ueberschreiben oder zu inkonsistenten Zustaenden fuehren.

**Praevention:**
1. Klare Sync-Reihenfolge: Erst Write-Queue abarbeiten, DANN Read-Sync, DANN Live-Updates aktivieren
2. Sync-Lock: Nur ein Sync-Prozess gleichzeitig aktiv
3. Optimistic Updates rueckgaengig machen wenn Server-Antwort abweicht
4. Versionierung: Jeder Cache-Eintrag hat Timestamp, neuerer gewinnt

**Erkennung:** Sporadische UI-Flicker, kurzzeitig falsche Daten nach Reconnect

---

### Pitfall 7: App-Resume nach Background auf iOS

**Was schief geht:** Wenn die App auf iOS in den Hintergrund geht, kann WKWebView nach einiger Zeit terminiert werden. Bei App-Resume ist der JS-Kontext weg -- alle In-Memory-States (React Context, Socket-Verbindung, Timer) sind verloren, aber die DOM-Shell steht noch. Das fuehrt zu einem "Zombie-Zustand": App sieht normal aus, funktioniert aber nicht.

**Praevention:**
1. `@capacitor/app` App State Listener nutzen: `App.addListener('appStateChange', ...)`
2. Bei Resume: Netzwerkstatus pruefen, Socket reconnecten, Cache-Daten in Context laden
3. Heartbeat-Mechanismus: Wenn App laenger als X Sekunden im Background war, vollstaendigen Re-Init durchfuehren
4. NICHT davon ausgehen dass In-Memory-State nach Background noch gueltig ist

**Erkennung:** Weisser Bildschirm nach App-Resume, "frozen" UI die nicht reagiert

---

### Pitfall 8: Offline-Banner blockiert wichtige UI-Elemente

**Was schief geht:** Ein Offline-Banner am oberen oder unteren Rand ueberlagert Inhalte, besonders auf kleinen Bildschirmen. Bei Ionic mit iOS Safe Areas und TabBar kann das Layout komplett kaputt gehen.

**Praevention:**
1. Banner als Teil des regulaeren Layouts (nicht als Overlay/Absolute-Position)
2. Ionic `ion-header` oder dedizierter Slot nutzen, der den Content nach unten schiebt
3. Auf verschiedenen Geraetegroessen testen (iPhone SE, iPad)
4. Banner muss dismissable sein oder automatisch verschwinden bei Reconnect
5. Niemals den TabBar oder Modale verdecken

**Erkennung:** UI-Bug-Reports von Usern mit kleinen Bildschirmen

---

### Pitfall 9: Stale-While-Revalidate zeigt gefaehrlich alte Daten

**Was schief geht:** Die App zeigt gecachte Event-Daten (Kapazitaet, Zeitslots) die sich seitdem geaendert haben. User bucht einen Zeitslot der voll ist, oder erscheint zu einem abgesagten Event.

**Praevention:**
1. Cache-Alter anzeigen: "Stand: vor 3 Stunden" als visueller Hinweis
2. Kritische Aktionen (Event-Buchung, Punkte-Vergabe) IMMER online erfordern -- mit klarer Fehlermeldung wenn offline
3. Fuer reine Lese-Daten (Dashboard, Profil) ist Stale-Cache akzeptabel
4. Fuer interaktive Daten (Events, Chat) maximales Cache-Alter definieren (z.B. 30 Minuten)

**Erkennung:** Fehlbuchungen, User-Beschwerden ueber "falsche" Informationen

---

## Geringfuegige Pitfalls

### Pitfall 10: Capacitor Network Plugin false positives

**Was schief geht:** `@capacitor/network` meldet "online" obwohl keine echte Konnektivitaet besteht (Captive Portal, DNS-Fehler, Server down).

**Praevention:**
1. Network Plugin als Hinweis nutzen, nicht als Wahrheit
2. Zusaetzlich Health-Check gegen eigenen Server: `GET /api/health` mit kurzem Timeout (3s)
3. Erst nach erfolgreichem Health-Check den Status auf "online" setzen

---

### Pitfall 11: Chat-Nachrichten Reihenfolge nach Offline-Sync

**Was schief geht:** Offline verfasste Nachrichten haben Client-Timestamps, Server-Timestamps weichen ab. Nachrichten erscheinen in falscher Reihenfolge nach dem Sync.

**Praevention:**
1. Client-Timestamp UND Server-Timestamp speichern
2. Sortierung immer nach Server-Timestamp (nach Sync) oder Client-Timestamp (vor Sync)
3. Visueller Hinweis bei noch nicht synchronisierten Nachrichten (z.B. Uhr-Icon statt Haekchen)

---

### Pitfall 12: Bundle-Groesse durch Offline-Libraries

**Was schief geht:** Libraries wie `localForage`, `Dexie.js`, `workbox` oder `idb` erhoehen die Bundle-Groesse. Bei einer App die bisher ~34.000 Zeilen hat, kann das signifikant sein.

**Praevention:**
1. Natives `idb` Wrapper (< 2KB) statt Dexie.js (> 30KB) fuer IndexedDB
2. Kein Service Worker noetig fuer native Capacitor-App (nur fuer PWA relevant)
3. Write-Queue selbst bauen statt schwere Sync-Library einbinden
4. Tree-Shaking sicherstellen in Vite-Config

---

## Phase-spezifische Warnungen

| Phase / Thema | Wahrscheinlicher Pitfall | Gegenmassnahme |
|---|---|---|
| **Storage-Migration** | Pitfall 1: localStorage nach Preferences -- bestehende User verlieren Token | Migration-Code: Beim App-Start pruefen ob Token in localStorage liegt, wenn ja nach Preferences kopieren und aus localStorage loeschen |
| **Cache-Layer aufbauen** | Pitfall 5: Zu viel cachen, Quota ueberschreiten | Cache-Budget pro Datentyp definieren BEVOR Implementation beginnt |
| **Write-Queue** | Pitfall 3: Duplikate ohne Idempotenz | Idempotency-Key als ERSTES implementieren, nicht nachtraeglich |
| **Socket.io Integration** | Pitfall 2 + 6: Reconnect ohne Resync, Race Conditions | Sync-Reihenfolge-Protokoll definieren BEVOR Socket-Reconnect-Handler geschrieben wird |
| **Offline-Banner** | Pitfall 8: Layout-Bruch auf iOS | Banner im Prototyp auf echtem Geraet testen, nicht nur Simulator |
| **Stale-While-Revalidate** | Pitfall 9: User handeln auf Basis veralteter Daten | Read-Only vs. Interactive Daten klar trennen, Write-Aktionen IMMER online erfordern |
| **JWT-Handling** | Pitfall 4: 401 loescht Token im Offline-Zustand | Axios-Interceptor als ERSTES anpassen, vor jedem Cache-Code |

---

## Empfohlene Implementierungs-Reihenfolge (risikominimierend)

1. **Zuerst:** localStorage nach Capacitor Preferences migrieren (Pitfall 1 + 4) -- grundlegende Stabilitaet
2. **Dann:** Axios-Interceptor offline-aware machen (Pitfall 4) -- verhindert falsches Ausloggen
3. **Dann:** IndexedDB Cache-Layer mit Budgets (Pitfall 5) -- Grundlage fuer alles
4. **Dann:** Read-Cache (Stale-While-Revalidate) fuer Dashboard/Events/Chat (Pitfall 9)
5. **Dann:** Write-Queue mit Idempotenz-Keys (Pitfall 3)
6. **Dann:** Socket.io Reconnect-Sync (Pitfall 2 + 6)
7. **Zuletzt:** Offline-Banner und UX-Polish (Pitfall 8)

---

## Quellen

- [Capacitor Storage Guide](https://capacitorjs.com/docs/guides/storage) -- Offizielle Empfehlung zu Preferences vs. localStorage
- [Capacitor Preferences API](https://capacitorjs.com/docs/apis/preferences) -- Plugin-Dokumentation
- [Capacitor Issue #636: localStorage lost on reboot](https://github.com/ionic-team/capacitor/issues/636) -- Bekanntes iOS-Problem
- [Capacitor Issue #555: localStorage durability](https://github.com/ionic-team/capacitor/issues/555) -- Persistenz-Diskussion
- [WebKit Storage Policy Updates](https://webkit.org/blog/14403/updates-to-storage-policy/) -- iOS Quota und Eviction
- [MDN: Storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) -- Browser-Limits
- [Socket.IO Connection State Recovery](https://socket.io/docs/v4/connection-state-recovery) -- Reconnect-Limitierungen
- [Socket.IO Offline Behavior](https://socket.io/docs/v3/client-offline-behavior/) -- Event-Buffering Dokumentation
- [Socket.IO Handling Disconnections Tutorial](https://socket.io/docs/v4/tutorial/handling-disconnections) -- Best Practices
- [Ionic Blog: Best Practices for Offline Apps](https://ionic.io/blog/best-practices-for-building-offline-apps) -- Allgemeine Patterns
- [Ionic Blog: Choosing a Data Storage Solution](https://ionic.io/blog/choosing-a-data-storage-solution-ionic-storage-capacitor-storage-sqlite-or-ionic-secure-storage) -- Storage-Vergleich
- [Auth0: Refresh Tokens](https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/) -- JWT Refresh Strategy
- [Offline Sync & Conflict Resolution Patterns (2026)](https://www.sachith.co.uk/offline-sync-conflict-resolution-patterns-architecture-trade%E2%80%91offs-practical-guide-feb-19-2026/) -- Sync-Architektur
