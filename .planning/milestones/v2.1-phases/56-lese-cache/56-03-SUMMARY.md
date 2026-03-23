---
phase: 56-lese-cache
plan: 03
subsystem: ui
tags: [react, ionic, offline-cache, stale-while-revalidate, useOfflineQuery]

requires:
  - phase: 56-01
    provides: useOfflineQuery hook and offlineCache service with CACHE_TTL constants

provides:
  - 14 Admin-Pages nutzen useOfflineQuery fuer Offline-Lesezugriff
  - Admin sieht Events, Konfis, Aktivitaeten, Badges, Kategorien, Jahrgaenge, Level, Zertifikate, Requests, Settings, Users, Material, Profil, Invite-Codes offline

affects: [56-04, 57-offline-ui, 60-queue]

tech-stack:
  added: []
  patterns:
    - "Admin-Pages: organization_id in Cache-Key fuer Multi-Tenant-Isolation"
    - "Role-dependent queries: selectedRole in Cache-Key (Activities, Badges)"
    - "Search/filter queries: search + filter params in Cache-Key (Material)"
    - "Null-Safety: (data || []) Pattern fuer useOfflineQuery-Rueckgabewerte"

key-files:
  modified:
    - frontend/src/components/admin/pages/AdminEventsPage.tsx
    - frontend/src/components/admin/pages/AdminKonfisPage.tsx
    - frontend/src/components/admin/pages/AdminActivitiesPage.tsx
    - frontend/src/components/admin/pages/AdminBadgesPage.tsx
    - frontend/src/components/admin/pages/AdminActivityRequestsPage.tsx
    - frontend/src/components/admin/pages/AdminCategoriesPage.tsx
    - frontend/src/components/admin/pages/AdminJahrgaengeePage.tsx
    - frontend/src/components/admin/pages/AdminLevelsPage.tsx
    - frontend/src/components/admin/pages/AdminCertificatesPage.tsx
    - frontend/src/components/admin/pages/AdminInvitePage.tsx
    - frontend/src/components/admin/pages/AdminProfilePage.tsx
    - frontend/src/components/admin/pages/AdminDashboardSettingsPage.tsx
    - frontend/src/components/admin/pages/AdminUsersPage.tsx
    - frontend/src/components/admin/pages/AdminMaterialPage.tsx

key-decisions:
  - "AdminSettingsPage uebersprungen - hat keine API-Calls (nur Navigation-Links)"
  - "AdminProfilePage nutzt user:me:{userId} statt organization_id (persoenliche Daten)"
  - "AdminDashboardSettingsPage: onSuccess Callback statt select, weil Settings in 2 lokale Config-Objekte aufgeteilt werden"
  - "AdminMaterialPage: search + jahrgang_id im Cache-Key fuer filterspezifisches Caching"
  - "AdminInvitePage: QR-Code-Logik bleibt imperativ (useEffect), nur API-Daten werden gecacht"

patterns-established:
  - "Null-Safety-Pattern: (data || []) fuer alle Array-Rueckgabewerte von useOfflineQuery"
  - "Write-Action-Pattern: refresh() nach erfolgreicher Mutation statt altem loadData()"
  - "Role-Switch-Pattern: selectedRole im Cache-Key, useOfflineQuery reagiert automatisch auf Key-Aenderung"

requirements-completed: [CAC-07, CAC-09]

duration: 14min
completed: 2026-03-21
---

# Phase 56 Plan 03: Admin-Pages Offline-Cache Summary

**14 Admin-Pages auf useOfflineQuery migriert -- Admins sehen alle Stammdaten, Listen und Konfigurationen offline mit SWR-Pattern**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-21T07:11:47Z
- **Completed:** 2026-03-21T07:26:12Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- 5 Admin-Core-Pages migriert (Events, Konfis, Activities, Badges, Requests) mit useLiveRefresh-Erhalt
- 9 Admin-Stammdaten-Pages migriert (Categories, Jahrgaenge, Levels, Certificates, Invite, Profile, DashboardSettings, Users, Material)
- TypeScript kompiliert fehlerfrei nach Migration
- Write-Aktionen (POST, PUT, DELETE) bleiben unveraendert als direkte API-Calls
- Alle Window-Event-Listener und useLiveRefresh-Hooks beibehalten

## Task Commits

1. **Task 1: Admin Core-Pages migrieren** - `1feddbc` (feat)
2. **Task 2: Admin Stammdaten-Pages migrieren** - `215ed2e` (feat)

## Files Created/Modified
- `AdminEventsPage.tsx` - 3 useOfflineQuery (events, cancelled, jahrgaenge)
- `AdminKonfisPage.tsx` - 3 useOfflineQuery (konfis, jahrgaenge, settings)
- `AdminActivitiesPage.tsx` - 1 useOfflineQuery mit role-abhaengigem Cache-Key
- `AdminBadgesPage.tsx` - 1 useOfflineQuery mit role-abhaengigem Cache-Key
- `AdminActivityRequestsPage.tsx` - 1 useOfflineQuery (requests)
- `AdminCategoriesPage.tsx` - 1 useOfflineQuery (categories)
- `AdminJahrgaengeePage.tsx` - 1 useOfflineQuery (jahrgaenge-detail)
- `AdminLevelsPage.tsx` - 1 useOfflineQuery (levels)
- `AdminCertificatesPage.tsx` - 1 useOfflineQuery (certificates)
- `AdminInvitePage.tsx` - 2 useOfflineQuery (jahrgaenge, invite-codes)
- `AdminProfilePage.tsx` - 1 useOfflineQuery (user:me)
- `AdminDashboardSettingsPage.tsx` - 1 useOfflineQuery mit onSuccess-Callback
- `AdminUsersPage.tsx` - 1 useOfflineQuery (users)
- `AdminMaterialPage.tsx` - 2 useOfflineQuery (jahrgaenge, material mit search/filter)

## Decisions Made
- AdminSettingsPage hat keine API-Calls und wurde nicht migriert (bestaetigt durch Grep)
- AdminProfilePage nutzt userId statt organization_id im Cache-Key (persoenliche Daten)
- AdminDashboardSettingsPage: onSuccess-Callback fuer Settings-Transformation in 2 Config-Objekte
- AdminMaterialPage: Filter-Parameter (search, jahrgang_id) direkt im Cache-Key fuer granulares Caching
- AdminInvitePage: QR-Code-Generierung bleibt als imperativer useEffect (nicht cache-faehig)
- pastEvents-State in AdminEventsPage eliminiert (war redundanter zweiter API-Call zum gleichen Endpunkt)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pastEvents redundanten API-Call entfernt**
- **Found during:** Task 1 (AdminEventsPage)
- **Issue:** loadPastEvents() rief /events erneut auf und filterte client-seitig -- identischer Call wie loadEvents
- **Fix:** pastEvents-State entfernt, events-Daten werden direkt fuer Past-Events genutzt
- **Files modified:** AdminEventsPage.tsx
- **Committed in:** 1feddbc

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Redundanten API-Call eliminiert, keine funktionale Aenderung.

## Issues Encountered
None

## Known Stubs
None - alle Pages sind vollstaendig auf useOfflineQuery migriert und zeigen gecachte Daten offline.

## Next Phase Readiness
- Alle Admin-Pages sind offline-lesbar
- Phase 56-04 (Teamer-Pages) kann unabhaengig fortgesetzt werden
- Fuer Phase 57 (Offline-UI) sind alle Lese-Caches bereit

---
*Phase: 56-lese-cache*
*Completed: 2026-03-21*
