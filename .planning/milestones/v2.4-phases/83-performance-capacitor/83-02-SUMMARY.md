---
phase: 83-performance-capacitor
plan: 02
subsystem: ui
tags: [capacitor, typescript, fcm, push-notifications, refactor]

# Dependency graph
requires: []
provides:
  - Typsichere Capacitor-Plugin-Zugriffe in AppContext.tsx ohne (window as any).Capacitor
  - FCM-Plugin per registerPlugin<FCMPlugin>('FCM') eingebunden
  - Modul-Level-Variablen fuer FCM-Token-Anti-Spam-State
affects: [push-notifications, capacitor-plugins, app-context]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "registerPlugin<T>('PluginName') fuer native Capacitor-Plugins ohne npm-Paket"
    - "Modul-Level-Variablen statt window-Properties fuer In-Memory Anti-Spam-State"

key-files:
  created: []
  modified:
    - frontend/src/contexts/AppContext.tsx

key-decisions:
  - "(App as any).fireRestoredResult behaelt as any - undokumentierte Methode ausserhalb offiziellem Capacitor-API"
  - "FCMPlugin-Interface mit nur den genutzten Methoden (forceAPNSRegistration, forceTokenRetrieval)"
  - "registerPlugin erstellt JS-Bridge-Wrapper fuer nativ registriertes Plugin ohne npm-Paket-Abhaengigkeit"

patterns-established:
  - "registerPlugin-Pattern: Fuer native Capacitor-Plugins ohne @capacitor-community-Paket registerPlugin<Interface>('Name') nutzen"
  - "Modul-Level-State: Anti-Spam/Throttle-State als let-Variablen im Modul, nicht auf window"

requirements-completed: [CAP-01, CAP-02]

# Metrics
duration: 8min
completed: 2026-03-22
---

# Phase 83 Plan 02: Capacitor Typsichere Imports Summary

**FCM-Plugin per registerPlugin<FCMPlugin> typsicher eingebunden, alle window-as-any-Capacitor-Zugriffe und In-Memory-State von window auf Modul-Level-Variablen migriert**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-22T22:25:00Z
- **Completed:** 2026-03-22T22:33:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Alle `(window as any).Capacitor?.Plugins?.FCM`-Zugriffe durch typsicheres `FCM`-Objekt (registerPlugin) ersetzt
- Drei Modul-Level-Variablen `fcmTokenSent`, `fcmTokenLastSent`, `pendingFcmToken` fuer Anti-Spam-State eingefuehrt
- Redundanten `(window as any).Capacitor.Plugins.App`-Block durch direkten `App`-Import ersetzt
- TypeScript-Build fehlerfrei nach allen Aenderungen

## Task Commits

Jede Task wurde atomar committet:

1. **Task 1: In-Memory-State von window auf Modul-Level-Variablen migrieren** - `9c6058a` (refactor)
2. **Task 2: FCM-Plugin typsicher per registerPlugin, App-Redundanz entfernt** - `94f1318` (refactor)

## Files Created/Modified
- `frontend/src/contexts/AppContext.tsx` - FCMPlugin-Interface, registerPlugin, Modul-Level-Variablen, alle window-as-any-Capacitor-Zugriffe entfernt

## Decisions Made
- `(App as any).fireRestoredResult` behaelt `as any` - diese Methode ist nicht Teil der offiziellen `@capacitor/app` API, daher bewusster Kompromiss fuer diesen einzelnen undokumentierten Aufruf
- FCMPlugin-Interface definiert nur `forceAPNSRegistration` und `forceTokenRetrieval` (die einzigen genutzten Methoden)
- `await` vor `(App as any).fireRestoredResult` entfernt, da der Aufruf in einem nicht-async useEffect-Callback liegt

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] await in synchronem useEffect-Kontext entfernt**
- **Found during:** Task 2 (TypeScript-Verifikation)
- **Issue:** Plan-Vorlage enthielt `await (App as any).fireRestoredResult(...)`, aber der Aufruf liegt in einem nicht-async `useEffect`-Callback - TypeScript-Fehler TS2311
- **Fix:** `await` entfernt, da `fireRestoredResult` fire-and-forget ist und kein Return-Wert erwartet wird
- **Files modified:** frontend/src/contexts/AppContext.tsx
- **Verification:** `npx tsc --noEmit` ohne Fehler
- **Committed in:** 94f1318 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Notwendige Korrektur fuer TypeScript-Korrektheit, kein Scope-Creep.

## Issues Encountered
- TypeScript-Fehler TS2311 durch `await` in synchronem Kontext - sofort in Task 2 behoben

## Known Stubs
Keine - alle Capacitor-Zugriffe sind vollstaendig typsicher umgeschrieben.

## Next Phase Readiness
- AppContext.tsx vollstaendig ohne `(window as any).Capacitor`-Zugriffe
- FCM-Plugin-Wrapper ist typsicher und updateresistent
- Bereit fuer Phase 83-03 (SQLite-Entfernung) oder Phase 84 (Schema-Hygiene)

---
*Phase: 83-performance-capacitor*
*Completed: 2026-03-22*
