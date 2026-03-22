---
phase: 81-react-router-migration
plan: 02
subsystem: ui
tags: [react-router, ionic, useIonRouter, navigation, migration]

# Dependency graph
requires: []
provides:
  - Admin-Seiten (AdminSettingsPage, AdminEventsPage, AdminKonfisPage) ohne useHistory
  - Teamer-Seiten (TeamerDashboardPage, TeamerProfilePage, TeamerEventsPage) auf useIonRouter migriert
  - ChatOverviewPage ohne useHistory
  - MainTabs.tsx mit Wrapper-Komponenten statt props.history in Route render-props
affects:
  - 81-01 (parallele Migration Konfi-Seiten)
  - alle weiteren Phasen die Navigationspattern referenzieren

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useIonRouter als Drop-In fuer history.push/goBack in Ionic React"
    - "Route Wrapper-Komponenten statt render-props fuer History-unabhaengige Navigation"
    - "useHistory bleibt fuer State-Uebergabe (useIonRouter unterstuetzt kein State)"

key-files:
  created: []
  modified:
    - frontend/src/components/admin/pages/AdminSettingsPage.tsx
    - frontend/src/components/admin/pages/AdminEventsPage.tsx
    - frontend/src/components/admin/pages/AdminKonfisPage.tsx
    - frontend/src/components/teamer/pages/TeamerDashboardPage.tsx
    - frontend/src/components/teamer/pages/TeamerProfilePage.tsx
    - frontend/src/components/teamer/pages/TeamerEventsPage.tsx
    - frontend/src/components/chat/pages/ChatOverviewPage.tsx
    - frontend/src/components/layout/MainTabs.tsx

key-decisions:
  - "useHistory fuer State-Uebergabe behalten (TeamerDashboardPage -> TeamerEventsPage): useIonRouter.push akzeptiert kein State-Objekt, 5. Parameter ist AnimationBuilder"
  - "5 Wrapper-Komponenten in MainTabs.tsx eingefuehrt: KonfiDetailRoute, AdminEventDetailRoute, AdminChatRoomRoute, TeamerChatRoomRoute, KonfiChatRoomRoute"
  - "TeamerEventsPage: ungenutztes useHistory komplett entfernt (war nur deklariert, nie verwendet)"

patterns-established:
  - "Wrapper-Komponenten-Pattern: const XxxRoute: React.FC<RouteComponentProps<{id: string}>> = ({ match }) => { const router = useIonRouter(); return <View ... onBack={() => router.goBack()} />; }"
  - "Kommentarzeile nach useIonRouter-Import: // useIonRouter: Ionic 8 API - bei Ionic v9 ggf. auf useNavigate migrieren"

requirements-completed:
  - RR-01
  - RR-02
  - RR-03

# Metrics
duration: 25min
completed: 2026-03-22
---

# Phase 81 Plan 02: useHistory Migration Admin + Teamer + Chat + MainTabs Summary

**8 Dateien auf useIonRouter migriert, MainTabs mit 5 Wrapper-Komponenten statt props.history in Route render-props**

## Performance

- **Duration:** 25 min
- **Started:** 2026-03-22T21:30:00Z
- **Completed:** 2026-03-22T22:00:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- AdminSettingsPage, AdminEventsPage, AdminKonfisPage: alle history.push durch router.push ersetzt
- TeamerDashboardPage, TeamerProfilePage: history.push durch router.push ersetzt
- TeamerEventsPage: ungenutztes useHistory komplett entfernt
- ChatOverviewPage: history.push durch router.push ersetzt
- MainTabs.tsx: 5 Route render-props in Wrapper-Komponenten umgebaut (KonfiDetailRoute, AdminEventDetailRoute, AdminChatRoomRoute, TeamerChatRoomRoute, KonfiChatRoomRoute)
- TypeScript fehlerfrei nach allen Aenderungen

## Task Commits

1. **Task 1: Admin + Teamer + Chat Komponenten migrieren** - `4352db8` (feat)
2. **Task 2: MainTabs Wrapper-Komponenten + TeamerDashboard State-Bugfix** - `c7a97b2` (feat)

**Plan metadata:** (docs-Commit folgt)

## Files Created/Modified
- `frontend/src/components/admin/pages/AdminSettingsPage.tsx` - 9 history.push -> router.push
- `frontend/src/components/admin/pages/AdminEventsPage.tsx` - history.push -> router.push
- `frontend/src/components/admin/pages/AdminKonfisPage.tsx` - history.push -> router.push
- `frontend/src/components/teamer/pages/TeamerDashboardPage.tsx` - router.push + useHistory fuer State-Uebergabe
- `frontend/src/components/teamer/pages/TeamerProfilePage.tsx` - history.push -> router.push
- `frontend/src/components/teamer/pages/TeamerEventsPage.tsx` - ungenutztes useHistory entfernt
- `frontend/src/components/chat/pages/ChatOverviewPage.tsx` - history.push -> router.push
- `frontend/src/components/layout/MainTabs.tsx` - 5 Wrapper-Komponenten + RouteComponentProps

## Decisions Made
- `useIonRouter.push` hat kein State-Parameter (5. Argument ist `AnimationBuilder`). TeamerDashboardPage behaelt `useHistory` fuer den einen State-Push zu TeamerEventsPage.
- 5 separate Wrapper-Komponenten statt einer gemeinsamen (ChatRoomRoute fuer alle drei User-Typen), um Debugging-Klarheit zu behalten.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] useIonRouter State-Inkompatibilitaet**
- **Found during:** Task 2 / TypeScript-Check
- **Issue:** Plan schlug `router.push('/teamer/events', 'forward', 'push', undefined, { selectedEventId: event.id })` vor. useIonRouter.push nimmt als 5. Parameter AnimationBuilder, nicht State.
- **Fix:** TeamerDashboardPage behaelt `useHistory` fuer diesen einen State-Push. Alle anderen Navigationen nutzen `router.push`.
- **Files modified:** frontend/src/components/teamer/pages/TeamerDashboardPage.tsx
- **Verification:** TypeScript-Build fehlerfrei (`npx tsc --noEmit`)
- **Committed in:** c7a97b2

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Notwendig fuer TypeScript-Korrektheit. useHistory bleibt auf das Minimum beschraenkt.

## Issues Encountered
- useIonRouter API erlaubt kein State-Objekt, nur AnimationBuilder als 5. Parameter. TeamerDashboardPage braucht State-Uebergabe fuer selectedEventId an TeamerEventsPage.

## Next Phase Readiness
- Alle 8 Zieldateien migriert
- MainTabs hat saubere Wrapper-Komponenten
- TypeScript-Build fehlerfrei
- Plan 01 (Konfi-Seiten) laeuft parallel

---
*Phase: 81-react-router-migration*
*Completed: 2026-03-22*
