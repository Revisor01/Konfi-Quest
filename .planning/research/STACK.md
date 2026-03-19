# Technology Stack: v2.1 App-Resilienz (Offline + Sync)

**Project:** Konfi Quest
**Researched:** 2026-03-19
**Scope:** Offline-Lese-Cache, Schreib-Queue, Retry-Logik, Background-Sync, Offline-Erkennung
**Overall Confidence:** MEDIUM-HIGH

## Empfohlener Stack (nur Neuzugaenge)

### Offline-Erkennung

| Technologie | Version | Zweck | Begruendung |
|-------------|---------|-------|-------------|
| @capacitor/network | ^7.0.1 | Online/Offline-Status erkennen, Events bei Wechsel | Offizielles Capacitor-Plugin, native APIs (NWPathMonitor iOS, ConnectivityManager Android), zuverlaessiger als navigator.onLine. Folgt dem Capacitor-7-Versionsschema des Projekts. |

**Einschraenkungen beachten:** Das Plugin meldet auf iOS gelegentlich verzoegertes "online"-Event nach Reconnect. Auf Android mit VPN kann der Status flippen. Deshalb: Network-Plugin als primaere Quelle verwenden, aber zusaetzlich bei jedem API-Call den tatsaechlichen Netzwerkstatus ableiten (HTTP-Fehler = offline behandeln). Dual-Source-Ansatz.

### Lokaler Cache-Speicher

| Technologie | Version | Zweck | Begruendung |
|-------------|---------|-------|-------------|
| @capacitor/preferences | ^7.0.1 | Persistenter Key-Value-Cache fuer API-Responses | Nutzt UserDefaults (iOS) und SharedPreferences (Android) -- garantiert persistent, wird NICHT vom OS geraeumt. Reicht voellig fuer JSON-Responses (Dashboard, Events, Chat-Listen, Profil). Kein SQLite-Overhead noetig. |

**Warum NICHT SQLite:** Die App cached API-Responses als JSON-Blobs (10-50 KB pro Endpoint). Das sind ~15 Endpoints mit je einem JSON-Objekt. Dafuer ist SQLite massiver Overkill -- komplexes Setup, native Build-Aenderungen, Migration-Logik. Capacitor Preferences speichert String-Werte zuverlaessig und persistent. JSON.stringify/parse reicht.

**Warum NICHT IndexedDB/localStorage:** Das OS kann Web-Storage jederzeit raeumen wenn der Speicher knapp wird. Fuer einen Offline-Cache ist das inakzeptabel -- der Cache muss da sein wenn er gebraucht wird.

**Warum NICHT @ionic/storage:** Abstraktion ueber IndexedDB/SQLite/localStorage mit Driver-System. Unnoetige Indirektion -- Capacitor Preferences macht dasselbe direkt und zuverlaessiger auf nativer Ebene.

### Schreib-Queue (Eigenbau)

| Technologie | Version | Zweck | Begruendung |
|-------------|---------|-------|-------------|
| Eigener QueueService | -- | Offline-Schreiboperationen zwischenspeichern und bei Reconnect absenden | Kein npm-Paket noetig. Die Queue speichert Chat-Nachrichten und Aktivitaets-Antraege als JSON-Array in @capacitor/preferences. Bei Reconnect werden sie FIFO abgearbeitet. ~100 Zeilen TypeScript. |

**Warum kein fertiges Paket:** Es gibt kein etabliertes, Capacitor-7-kompatibles "offline queue"-Paket. Die Anforderung ist einfach genug (FIFO-Queue mit Retry), dass eine eigene Loesung wartbarer ist als eine Abhaengigkeit mit ungewisser Zukunft.

### Retry-Logik

| Technologie | Version | Zweck | Begruendung |
|-------------|---------|-------|-------------|
| axios-retry | ^4.5.0 | Automatischer Retry mit Exponential Backoff fuer transiente Fehler | Bereits etabliert (5M+ weekly downloads), TypeScript-Support, konfigurierbar pro Request. Integriert sich als Axios-Interceptor -- passt perfekt in die bestehende api.ts. Kein Umbau noetig. |

**Konfiguration:**
- Retry-Count: 3
- Backoff: Exponential mit Jitter (verhindert Thundering Herd)
- Retry-Bedingungen: Netzwerkfehler + 5xx + 408 (Timeout) + 429 (Rate Limit, mit Retry-After Header)
- NICHT retrien: 4xx (ausser 408/429), Login-Requests

**Warum NICHT retry-axios:** Aehnliche Funktionalitaet, aber axios-retry hat 10x mehr Downloads und bessere TypeScript-Typen. Beide sind valide, aber axios-retry ist der Community-Standard.

### Background-Sync (App-Lifecycle)

| Technologie | Version | Zweck | Begruendung |
|-------------|---------|-------|-------------|
| @capacitor/app (bereits installiert) | 7.0.1 | App-Resume-Event fuer Sync-Trigger | Bereits im Projekt. `appStateChange`-Event nutzen um bei Resume einen Sync auszuloesen. |
| @capawesome/capacitor-background-task | ^7.0.1 | Schreib-Queue im Hintergrund abarbeiten wenn App in Background geht | Erlaubt ~30 Sekunden Background-Execution nach App-Minimize. Reicht um eine Queue mit wenigen Eintraegen abzuarbeiten. Capacitor-7-kompatibel (v7.0.1). |

**Warum NICHT @capacitor/background-runner:** Das offizielle Plugin ist fuer periodische Background-Tasks (wie iOS BGTaskScheduler). Zu komplex fuer den Use-Case. Wir brauchen nur "wenn App in Background geht, Queue leeren" -- dafuer ist capawesome/background-task perfekt.

**Warum NICHT transistorsoft/background-fetch:** Fuer periodische Hintergrund-Syncs (alle 15 Min). iOS erlaubt das nur unzuverlaessig und schraenkt es bei geringer Nutzung ein. Nicht noetig -- App-Resume + Socket.io-Reconnect decken den Sync-Bedarf ab.

### Bestehende Technologien (unveraendert, aber erweitert)

| Technologie | Aktuell | Erweiterung |
|-------------|---------|-------------|
| axios | ^1.10.0 | + axios-retry Interceptor, + Request-Dedup-Logik |
| socket.io-client | ^4.8.1 | Reconnect-Event als Sync-Trigger nutzen (bereits built-in) |
| @capacitor/app | 7.0.1 | appStateChange fuer Resume-Sync |
| React Context (AppContext) | -- | + NetworkContext fuer Online/Offline-State, + CacheContext fuer Stale-While-Revalidate |

## Architektur-Entscheidungen

### Stale-While-Revalidate Pattern

Kein extra Paket noetig. Custom Hook `useCachedQuery(key, fetchFn)`:
1. Lese sofort aus Preferences-Cache (synchron-aehnlich, da Preferences schnell ist)
2. Zeige gecachte Daten sofort an
3. Fetche im Hintergrund aktuelle Daten
4. Update State + Cache bei Erfolg
5. Bei Netzwerkfehler: Gecachte Daten behalten, kein Fehler anzeigen

```typescript
// Pseudocode fuer den Hook
function useCachedQuery<T>(key: string, fetchFn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    // 1. Cache lesen
    Preferences.get({ key }).then(cached => {
      if (cached.value) {
        setData(JSON.parse(cached.value));
        setIsStale(true);
      }
    });

    // 2. Frische Daten holen
    fetchFn().then(fresh => {
      setData(fresh);
      setIsStale(false);
      Preferences.set({ key, value: JSON.stringify(fresh) });
    }).catch(() => {
      // Offline -- cached data bleibt
    });
  }, [key]);

  return { data, isStale };
}
```

### Request Deduplication

Eigenbau (~30 Zeilen). Map von laufenden Requests, gleiche URLs teilen sich ein Promise. Verhindert doppelte API-Calls wenn mehrere Komponenten gleichzeitig dieselben Daten laden.

### Double-Submit-Schutz

Kein Paket noetig. Pattern: `useSubmitGuard()` Hook der einen `isSubmitting`-State und eine `guardedSubmit(fn)`-Funktion liefert. Button disabled waehrend Submit, automatisches Re-Enable bei Erfolg/Fehler.

## Installation

```bash
cd frontend

# Neue Capacitor-Plugins
npm install @capacitor/network@latest-7 @capacitor/preferences@latest-7 @capawesome/capacitor-background-task@^7.0.1

# Retry-Logik
npm install axios-retry

# Native Sync
npx cap sync
```

**Keine neuen Dev-Dependencies noetig.**

## Nicht installieren (Over-Engineering-Warnung)

| Paket | Warum nicht |
|-------|-------------|
| @capacitor-community/sqlite | Massiver Overkill fuer JSON-Cache. 34K LoC Codebase braucht keine lokale SQL-Datenbank. |
| @ionic/storage | Unnoetige Abstraktion. Preferences ist direkter und zuverlaessiger. |
| rxdb | Full-featured reactive DB mit Sync-Protokoll. Fuer Konfi Quest viel zu komplex -- die App hat ein Backend mit REST+Socket.io, kein CouchDB-Style Replication noetig. |
| workbox / service-worker | Fuer PWA-Caching gedacht. Konfi Quest ist eine native Capacitor-App, kein PWA. Service Worker im WebView bringen Probleme mit nativen Plugins. |
| couchbase-lite | Enterprise-Grade Offline-Sync. Erfordert Couchbase-Server-Backend. Komplett andere Architektur. |
| tanstack-query / swr | React-Query wuerde gut funktionieren, aber die App hat bereits ein funktionierendes Daten-Pattern (AppContext + direkte API-Calls). TanStack Query einzufuehren wuerde einen Rewrite aller Data-Fetching-Logik bedeuten. Der eigene useCachedQuery-Hook erreicht Stale-While-Revalidate mit ~50 Zeilen ohne den gesamten Datenlayer umzubauen. |
| localforage | Wrapper um IndexedDB/WebSQL/localStorage. Selbe Problematik wie @ionic/storage -- Web-Storage kann geraeumt werden. |

## Zusammenfassung

**4 neue npm-Pakete** (3 Capacitor-Plugins + 1 Library):
- `@capacitor/network` -- Offline-Erkennung
- `@capacitor/preferences` -- Persistenter Cache
- `@capawesome/capacitor-background-task` -- Queue-Flush bei App-Background
- `axios-retry` -- Automatische Retries

**3 Eigenbauten** (~200 Zeilen gesamt):
- `useCachedQuery` Hook -- Stale-While-Revalidate
- `QueueService` -- Offline-Schreib-Queue
- `useSubmitGuard` Hook -- Double-Submit-Schutz

**0 bestehende Pakete entfernen oder ersetzen.**

## Quellen

- [Capacitor Storage Guide](https://capacitorjs.com/docs/guides/storage) -- Offizielle Empfehlung Preferences vs SQLite vs Web-APIs (HIGH confidence)
- [Capacitor Network Plugin API](https://capacitorjs.com/docs/apis/network) -- Offizielle Doku (HIGH confidence)
- [@capacitor-community/sqlite Releases](https://github.com/capacitor-community/sqlite/releases) -- v7.0.x fuer Capacitor 7 (HIGH confidence)
- [Capawesome Background Task](https://capawesome.io/plugins/background-task/) -- v7.0.1 fuer Capacitor 7 (HIGH confidence)
- [axios-retry npm](https://www.npmjs.com/package/axios-retry) -- Community-Standard fuer Axios-Retries (HIGH confidence)
- [Ionic Blog: Choosing Storage](https://ionic.io/blog/choosing-a-data-storage-solution-ionic-storage-capacitor-storage-sqlite-or-ionic-secure-storage) -- Vergleich der Optionen (MEDIUM confidence)
- [Ionic Blog: Offline Best Practices](https://ionic.io/blog/best-practices-for-building-offline-apps) -- Allgemeine Patterns (MEDIUM confidence)
- [RxDB Capacitor Database Guide](https://rxdb.info/capacitor-database.html) -- Vergleich IndexedDB vs SQLite Performance (MEDIUM confidence, herstellernah)
