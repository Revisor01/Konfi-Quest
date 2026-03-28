---
phase: 106-frontend-tests
plan: 01
subsystem: frontend-tests
tags: [vitest, unit-tests, capacitor-mocks, tokenStore, networkMonitor, api-service]
dependency_graph:
  requires: []
  provides: [capacitor-mocks, service-unit-tests]
  affects: [frontend/src/__tests__, frontend/src/__mocks__]
tech_stack:
  added: []
  patterns: [vi.mock, vi.resetModules, dynamic-import-isolation]
key_files:
  created:
    - frontend/src/__mocks__/@capacitor/preferences.ts
    - frontend/src/__mocks__/@capacitor/network.ts
    - frontend/src/__mocks__/@capacitor/core.ts
    - frontend/src/__tests__/services/tokenStore.test.ts
    - frontend/src/__tests__/services/networkMonitor.test.ts
    - frontend/src/__tests__/services/api.test.ts
  modified:
    - frontend/src/setupTests.ts
decisions:
  - vi.mock statt __mocks__ Verzeichnis fuer Capacitor-Plugins (registerPlugin-Proxy umgehen)
  - vi.resetModules + dynamischer Import fuer Modul-Level-State-Isolation
  - Interceptor-Test via handlers-Array statt HTTP-Mock-Library
metrics:
  duration_seconds: 250
  completed: "2026-03-28"
  tasks: 2
  tests_total: 24
  files_created: 6
  files_modified: 1
---

# Phase 106 Plan 01: Service Unit-Tests + Capacitor-Mocks Summary

Test-Infrastruktur mit Capacitor-Mocks und 24 Unit-Tests fuer tokenStore (10), networkMonitor (6) und api-Service (8).

## Tasks Completed

### Task 1: Capacitor-Mocks + setupTests aktualisieren
- **Commit:** 1ef6467
- Erstellt: 3 Capacitor-Mock-Dateien (Preferences mit In-Memory-Store, Network, Core)
- setupTests.ts: Import von `@testing-library/jest-dom` aktualisiert (ohne `/extend-expect`)

### Task 2: tokenStore + networkMonitor + api Unit-Tests
- **Commit:** aceceb7
- tokenStore: 10 Tests — alle 5 Getter, 5 Setter, clearAuth (behaelt DeviceId), initTokenStore (laedt aus Preferences), korruptes JSON Handling
- networkMonitor: 6 Tests — isOnline initial true, subscribe/unsubscribe, Window-Event-Registration, Idempotenz, Status-Updates via Events
- api-Service: 8 Tests — Auth-Header mit/ohne Token, 401 ohne RefreshToken dispatcht relogin-Event, 429 setzt rateLimitMessage, Backend-Error-Message Prioritaet, Login-Request 401 Bypass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vi.mock statt __mocks__ Verzeichnis**
- **Found during:** Task 2
- **Issue:** `__mocks__/@capacitor/preferences.ts` wurde nicht von Vitest aufgeloest, da Capacitor-Plugins ueber registerPlugin einen Proxy nutzen der den echten PreferencesWeb laedt
- **Fix:** Explizites `vi.mock('@capacitor/preferences', () => ...)` in jeder Test-Datei statt automatischer __mocks__ Resolution
- **Files modified:** tokenStore.test.ts, networkMonitor.test.ts
- **Commit:** aceceb7

**2. [Rule 3 - Blocking] Network.getStatus Spy-Erkennung**
- **Found during:** Task 2
- **Issue:** Dynamisch importiertes `Network.getStatus` wurde von `toHaveBeenCalledTimes` nicht als Spy erkannt
- **Fix:** Mock-Funktionen auf Modul-Level definiert und direkt referenziert statt aus dynamischem Import
- **Files modified:** networkMonitor.test.ts
- **Commit:** aceceb7

## Known Stubs

Keine — alle Tests sind vollstaendig implementiert.

## Test-Ergebnisse

```
Test Files  3 passed (3 service test files)
Tests       24 passed
Duration    ~900ms
```

Hinweis: App.test.tsx hat 2 pre-existierende unhandled rejections (Capacitor Badge Plugin in jsdom) — nicht von diesem Plan verursacht.
