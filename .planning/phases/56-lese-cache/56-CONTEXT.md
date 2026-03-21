# Phase 56: Lese-Cache - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

useOfflineQuery Hook mit SWR-Pattern implementieren. offlineCache Service auf Basis von Capacitor Preferences. Alle 30 Pages auf useOfflineQuery migrieren. Cache-Invalidierung bei Logout.

</domain>

<decisions>
## Implementation Decisions

### offlineCache Service
- **D-01:** Neuer Service `offlineCache.ts` — get/set/invalidate/clear via Capacitor Preferences
- **D-02:** Cache-Eintraege als JSON mit `{ data, timestamp, ttl }` Struktur in Preferences gespeichert
- **D-03:** Cache-Key Schema: `cache:{role}:{resource}:{scope_id}` (userId oder orgId je nach Daten)
- **D-04:** TTL-Defaults aus Research: Dashboard 5min, Events 10min, Chat 1h, Stammdaten 1h, Tageslosung 24h
- **D-05:** `clearUserCache(userId)` bei Logout — loescht alle Keys mit dem userId-Scope

### useOfflineQuery Hook
- **D-06:** Hook-Signatur: `useOfflineQuery<T>(cacheKey, fetcher, options?)` → `{ data, loading, error, isStale, isOffline, refresh }`
- **D-07:** SWR-Pattern: Cache lesen → sofort anzeigen → im Hintergrund revalidieren wenn online
- **D-08:** Wenn offline + kein Cache: `error: "Keine Daten verfuegbar (offline)"`, `loading: false`
- **D-09:** Wenn offline + Cache vorhanden: Daten anzeigen, `isStale: true`, `isOffline: true`
- **D-10:** `refresh()` Funktion fuer IonRefresher und useLiveRefresh — revalidiert nur wenn online
- **D-11:** Race-Condition-Schutz via `currentKeyRef` bei schnellem Key-Wechsel (z.B. Segment-Switch)

### Page-Migration Pattern
- **D-12:** Mechanische Migration: `useState + useEffect + api.get` → `useOfflineQuery(key, () => api.get(...).then(r => r.data))`
- **D-13:** useLiveRefresh-Callback wird zu `refresh` aus dem Hook
- **D-14:** IonRefresher-Handler wird zu `await refresh(); event.detail.complete()`
- **D-15:** Pages mit mehreren API-Calls: Jeder Call bekommt eigenen useOfflineQuery (wie KonfiDashboardPage mit 4 Calls)

### Cache-Invalidierung
- **D-16:** Bei Logout: `offlineCache.clearAll()` fuer den aktuellen User
- **D-17:** Org-weite Caches (Kategorien, Level, etc.) bleiben bei Logout erhalten — werden bei naechstem Login revalidiert

### Claude's Discretion
- Genauer Umgang mit loading-States bei mehreren useOfflineQuery pro Page
- Error-Boundary fuer fehlgeschlagene Cache-Reads (corrupted JSON)
- Reihenfolge der Page-Migration (welche Pages zuerst)

</decisions>

<specifics>
## Specific Ideas

- Referenz-Migration: KonfiDashboardPage (komplexeste Page, 4 API-Calls) als Vorlage fuer alle anderen
- KonfiEventsPage (einfachste Page, 1 API-Call) als Quick-Win zuerst
- Deep-Analysis hat Before/After Code-Beispiele fuer beide Pages

</specifics>

<canonical_refs>
## Canonical References

### Research
- `.planning/research/DEEP-OFFLINE-ANALYSIS.md` §1 (Alle 30 Pages mit API-Calls + TTLs)
- `.planning/research/DEEP-OFFLINE-ANALYSIS.md` §2 (Cache Key Strategie + Invalidierung)
- `.planning/research/DEEP-OFFLINE-ANALYSIS.md` §6 (Capacitor Preferences Sizing — max 230KB/User)
- `.planning/research/DEEP-OFFLINE-ANALYSIS.md` §10 (useOfflineQuery Hook Design + Before/After)

### Phase 55 Artefakte (Voraussetzungen)
- `frontend/src/services/tokenStore.ts` — getToken()/getUser() fuer Cache-Key Scope (userId)
- `frontend/src/services/networkMonitor.ts` — isOnline fuer SWR-Revalidierung
- `frontend/src/contexts/AppContext.tsx` — isOnline State + user fuer Cache-Keys

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tokenStore.ts` getUser() — liefert userId fuer Cache-Key-Scope
- `networkMonitor.ts` — isOnline + subscribe fuer Revalidierung bei Online-Wechsel
- `useLiveRefresh` Hook — bleibt erhalten, ruft jetzt `refresh()` statt `loadData()` auf

### Established Patterns
- Alle 30 Pages folgen identisches Pattern: useState + useEffect + api.get + useLiveRefresh
- IonRefresher ist auf allen Pages vorhanden
- 25 von 30 Pages nutzen useLiveRefresh

### Integration Points
- Jede Page: api.get() → useOfflineQuery()
- AppContext: Logout-Handler ruft offlineCache.clearAll() auf
- offlineCache nutzt Capacitor Preferences (gleiche Dependency wie tokenStore)

</code_context>

<deferred>
## Deferred Ideas

- Chat-Messages Cache (spezieller Hybrid-Ansatz mit WebSocket) — Phase 60
- Cache-Invalidierung bei Write-Aktionen — Phase 60+
- Periodischer Background-Revalidierung — Phase 62

</deferred>

---

*Phase: 56-lese-cache*
*Context gathered: 2026-03-21*
