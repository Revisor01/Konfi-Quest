---
phase: 55-fundament
plan: 01
subsystem: auth
tags: [capacitor-preferences, tokenstore, storage-migration, async-boot]

requires:
  - phase: none
    provides: existing localStorage auth pattern
provides:
  - tokenStore.ts — In-Memory-Cache + Capacitor Preferences fuer Auth-Daten
  - migrateStorage.ts — Einmalige localStorage->Preferences Migration
  - Async Boot-Sequenz in main.tsx
  - auth.ts, api.ts, AppContext.tsx auf TokenStore migriert
affects: [55-02, 55-03, 55-04, 56-cache, 57-retry]

tech-stack:
  added: ["@capacitor/preferences", "@capacitor/network"]
  patterns: ["TokenStore: sync Getter aus Memory + async Setter nach Preferences", "Async Boot: migrateToPreferences -> initTokenStore -> render"]

key-files:
  created:
    - frontend/src/services/tokenStore.ts
    - frontend/src/services/migrateStorage.ts
  modified:
    - frontend/src/main.tsx
    - frontend/src/services/auth.ts
    - frontend/src/services/api.ts
    - frontend/src/contexts/AppContext.tsx
    - frontend/package.json

key-decisions:
  - "Sync Getter / Async Setter Pattern: Axios Interceptor bleibt synchron, Persistence via Capacitor Preferences"
  - "Migration behaelt localStorage-Keys (Rollback-Sicherheit per D-10)"
  - "clearAuth() in 401-Handler als fire-and-forget mit .then() fuer redirect"

patterns-established:
  - "TokenStore Pattern: getToken()/getUser() synchron aus Memory, setToken()/setUser() async nach Preferences"
  - "Boot-Sequenz: migrateToPreferences() -> initTokenStore() -> render() in async IIFE"
  - "Storage-Migration mit einmaligem Flag (storage_migrated_v1)"

requirements-completed: [STR-01, STR-02, STR-03, STR-04]

duration: 5min
completed: 2026-03-20
---

# Phase 55 Plan 01: TokenStore + Storage-Migration Summary

**TokenStore-Service mit sync Memory-Cache und async Capacitor Preferences, localStorage-Migration und async Boot-Sequenz in main.tsx**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T20:40:44Z
- **Completed:** 2026-03-20T20:45:39Z
- **Tasks:** 2
- **Files modified:** 7 (+ package-lock.json)

## Accomplishments
- TokenStore-Service erstellt mit synchronen Gettern (Memory) und async Settern (Preferences)
- Einmalige localStorage->Preferences Migration mit storage_migrated_v1 Flag
- main.tsx auf async Boot umgestellt: migrateToPreferences -> initTokenStore -> render
- auth.ts, api.ts und AppContext.tsx komplett auf TokenStore migriert — kein localStorage mehr

## Task Commits

Each task was committed atomically:

1. **Task 1: TokenStore + Migration + Async Boot + Capacitor Deps** - `d764f82` (feat)
2. **Task 2: Core-Services auf TokenStore migrieren** - `2a69e45` (feat)

## Files Created/Modified
- `frontend/src/services/tokenStore.ts` - In-Memory-Cache + Capacitor Preferences fuer Token, User, DeviceId, PushTimestamp
- `frontend/src/services/migrateStorage.ts` - Einmalige Migration von 4 localStorage-Keys nach Preferences
- `frontend/src/main.tsx` - Async Boot-Sequenz mit Migration und TokenStore-Init
- `frontend/src/services/auth.ts` - Login/Logout/CheckAuth nutzen TokenStore statt localStorage
- `frontend/src/services/api.ts` - Request-Interceptor nutzt getToken(), 401-Handler nutzt clearAuth()
- `frontend/src/contexts/AppContext.tsx` - getUser(), getPushTokenTimestamp(), getDeviceId/setDeviceId statt localStorage
- `frontend/package.json` - @capacitor/preferences und @capacitor/network als Dependencies

## Decisions Made
- Sync Getter / Async Setter Pattern: Axios Interceptor bleibt synchron, Capacitor Preferences async im Hintergrund
- localStorage-Keys nach Migration NICHT loeschen (Rollback-Sicherheit per D-10)
- clearAuth() im 401-Handler als fire-and-forget mit .then() fuer redirect nach Cleanup
- checkAuth() bleibt sync (liest aus Memory), checkAuthAsync() als Zukunftssicherheit hinzugefuegt

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm install mit --legacy-peer-deps**
- **Found during:** Task 1 (Capacitor Dependencies installieren)
- **Issue:** npm install scheiterte wegen Peer-Dependency-Konflikten
- **Fix:** --legacy-peer-deps Flag verwendet
- **Files modified:** package.json, package-lock.json
- **Verification:** Dependencies korrekt in package.json eingetragen
- **Committed in:** d764f82

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Standard npm peer-dep Workaround, kein Scope Creep.

## Issues Encountered
- Paralleler Agent (55-02) hat gleichzeitig api.ts und AppContext.tsx modifiziert (networkMonitor Import). Kein Konflikt — Aenderungen sind komplementaer.

## Known Stubs
None — alle Daten sind korrekt verdrahtet.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TokenStore als zentrale Auth-Storage-Schicht etabliert
- Verbleibende localStorage-Zugriffe in anderen Dateien (ChatRoom, ChatOverview, BadgeContext, LiveUpdateContext) werden in Plan 02 migriert
- NetworkMonitor (Plan 02) und 401-Offline-Fix (Plan 03) koennen auf TokenStore aufbauen

---
## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 55-fundament*
*Completed: 2026-03-20*
