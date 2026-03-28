---
phase: 106-frontend-tests
plan: 02
subsystem: frontend-tests
tags: [vitest, hooks, context, useActionGuard, useOfflineQuery, AppContext]
dependency_graph:
  requires: [capacitor-mocks, service-unit-tests]
  provides: [hook-tests, context-tests]
  affects: [frontend/src/__tests__/hooks, frontend/src/__tests__/contexts]
tech_stack:
  added: []
  patterns: [renderHook, waitFor, vi.mock, act, TestConsumer-Pattern]
key_files:
  created:
    - frontend/src/__tests__/hooks/useActionGuard.test.ts
    - frontend/src/__tests__/hooks/useOfflineQuery.test.ts
    - frontend/src/__tests__/contexts/AppContext.test.tsx
  modified: []
decisions:
  - SWR-Test mit gesteuertem Promise-Resolve um Race-Condition zwischen Cache und Fetch zu kontrollieren
  - AppContext-Test mit TestConsumer-Komponente statt direktem Hook-Aufruf (da Provider JSX rendert)
  - Alle Capacitor-Plugins und Services via vi.mock auf Modul-Level gemockt
metrics:
  duration_seconds: 177
  completed: "2026-03-28"
  tasks: 2
  tests_total: 24
  files_created: 3
  files_modified: 0
---

# Phase 106 Plan 02: Hook-Tests + AppContext Summary

24 Tests fuer useActionGuard (Double-Submit-Guard), useOfflineQuery (SWR-Pattern) und AppContext (globaler State-Provider).

## Tasks Completed

### Task 1: useActionGuard + useOfflineQuery Hook-Tests
- **Commit:** 9aaf195
- useActionGuard: 6 Tests -- initial state, guard execution mit isSubmitting-Tracking, double-guard rejection ("Aktion laeuft bereits"), error handling (finally-Block), error propagation
- useOfflineQuery: 9 Tests -- loading lifecycle, data delivery, error ohne Cache, onSuccess/onError Callbacks, enabled=false Skip, select-Transformation, isOffline-Reflection, SWR Cache+Background-Revalidation

### Task 2: AppContext Provider-Tests
- **Commit:** 0192608
- 9 Tests: Provider rendert children, useApp wirft ausserhalb Provider, user initial null, user initial aus tokenStore, setUser/setError/setSuccess Setter, clearMessages, isOnline initial true
- Mocks fuer 5 Capacitor-Plugins + 5 Services (tokenStore, networkMonitor, writeQueue, offlineCache, api)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SWR-Test Race-Condition**
- **Found during:** Task 1
- **Issue:** waitFor-Assertion fuer Cache-Daten schlug fehl, da der Fetcher sofort resolved und frische Daten die Cache-Daten ueberschrieben bevor die Assertion greifen konnte
- **Fix:** Fetcher mit gesteuertem Promise (resolveFetcher) implementiert, das erst nach der Cache-Assertion aufgeloest wird
- **Files modified:** useOfflineQuery.test.ts
- **Commit:** 9aaf195

## Known Stubs

Keine -- alle Tests sind vollstaendig implementiert.

## Test-Ergebnisse

```
Test Files  3 passed (3)
Tests       24 passed (6 + 9 + 9)
Duration    ~1.2s
```

## Self-Check: PASSED

- All 3 created files exist on disk
- Both commits (9aaf195, 0192608) verified in git log
