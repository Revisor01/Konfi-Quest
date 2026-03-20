---
phase: 55-fundament
plan: 03
subsystem: networking
tags: [capacitor-network, offline-detection, singleton, appcontext, axios-interceptor]

requires:
  - phase: 55-fundament-01
    provides: tokenStore mit clearAuth fuer sichere Token-Verwaltung
provides:
  - networkMonitor Singleton mit isOnline Getter und subscribe Pattern
  - isOnline State in AppContext fuer alle Komponenten
  - 401-Handler mit Offline-Pruefung (kein falsches Logout bei Netzwerkausfall)
affects: [56-read-cache, 57-retry, 58-offline-ui, 60-queue, 62-sync]

tech-stack:
  added: ["@capacitor/network@8.0.1"]
  patterns: ["Singleton-Pattern (Modul-Level State mit exportiertem Objekt)", "Subscribe/Unsubscribe Pattern fuer State-Aenderungen", "Debounce fuer Netzwerk-Events (300ms)"]

key-files:
  created: ["frontend/src/services/networkMonitor.ts"]
  modified: ["frontend/src/contexts/AppContext.tsx", "frontend/src/services/api.ts"]

key-decisions:
  - "Debounce 300ms fuer Netzwerkwechsel — verhindert Flackern bei instabiler Verbindung"
  - "Web-Fallback mit navigator.onLine + window events — Dev-Server und Browser-Nutzung funktioniert"
  - "Optimistischer Start (_isOnline = true) — kein falsches Offline-Banner beim App-Start"

patterns-established:
  - "networkMonitor.isOnline: Synchroner Getter fuer Netzwerkstatus ueberall im Code"
  - "networkMonitor.subscribe(): Listener-Pattern fuer reaktive UI-Updates"

requirements-completed: [NET-01, NET-02, NET-04]

duration: 4min
completed: 2026-03-20
---

# Phase 55 Plan 03: NetworkMonitor + Offline-401-Fix Summary

**NetworkMonitor Singleton mit Capacitor Network Plugin, isOnline in AppContext, und 401-Handler der Offline-Requests nicht als Auth-Fehler behandelt**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T20:41:27Z
- **Completed:** 2026-03-20T20:45:06Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- NetworkMonitor Singleton mit Capacitor Network Plugin + Web-Fallback erstellt
- isOnline State in AppContext fuer alle Komponenten verfuegbar
- 401-Handler prueft Netzwerkstatus — Offline = Token behalten, Online = Token loeschen

## Task Commits

Each task was committed atomically:

1. **Task 1: NetworkMonitor Singleton + isOnline in AppContext** - `35b3f1a` (feat)
2. **Task 2: 401-Handler Offline-Fix in api.ts** - `7a42ee1` (feat)

## Files Created/Modified
- `frontend/src/services/networkMonitor.ts` - Singleton-Service fuer Netzwerkstatus-Erkennung mit Debounce und Web-Fallback
- `frontend/src/contexts/AppContext.tsx` - isOnline State hinzugefuegt, networkMonitor.init() + subscribe() in useEffect
- `frontend/src/services/api.ts` - 401-Handler mit networkMonitor.isOnline Check

## Decisions Made
- Debounce 300ms fuer Netzwerkwechsel, verhindert Flackern bei instabiler Verbindung
- Web-Fallback mit navigator.onLine + window events fuer Browser-Dev
- Optimistischer Start (_isOnline = true) — App geht von Online aus bis Gegenteil bewiesen

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @capacitor/network Dependency installiert**
- **Found during:** Task 1 (NetworkMonitor erstellen)
- **Issue:** @capacitor/network war nicht in package.json installiert
- **Fix:** `npm install @capacitor/network --legacy-peer-deps`
- **Files modified:** package.json, package-lock.json
- **Verification:** `npm ls @capacitor/network` zeigt 8.0.1
- **Committed in:** 35b3f1a (Teil von Task 1)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Notwendige Dependency-Installation. Kein Scope Creep.

## Issues Encountered
- Plan 01 (tokenStore) lief parallel — api.ts wurde von beiden Plans modifiziert. Kein Konflikt, da Plan 01 die Imports aenderte und Plan 03 den 401-Handler aenderte.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- networkMonitor.isOnline steht fuer Read-Cache (Phase 56) und Retry-Logik (Phase 57) bereit
- isOnline in AppContext bereit fuer Offline-UI (Phase 58)
- 401-Handler verhindert falsches Logout — Kernproblem von Phase 55 geloest

## Self-Check: PASSED

- networkMonitor.ts: FOUND
- Commit 35b3f1a: FOUND
- Commit 7a42ee1: FOUND

---
*Phase: 55-fundament*
*Completed: 2026-03-20*
