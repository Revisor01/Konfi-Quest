---
phase: 63-codebase-cleanup
plan: 01
subsystem: ui
tags: [typescript, types, refactoring, deduplication]

requires: []
provides:
  - "Zentrale User-Typen (BaseUser, AdminUser, ChatUser) in types/user.ts"
  - "Zentrale Event-Typen (Event, Category, Timeslot, Jahrgang) in types/event.ts"
  - "DashboardEvent Re-Export aus types/event"
affects: [63-codebase-cleanup, alle Frontend-Komponenten die User/Event nutzen]

tech-stack:
  added: []
  patterns: ["Zentrale Type-Dateien in frontend/src/types/ fuer geteilte Interfaces"]

key-files:
  created:
    - frontend/src/types/user.ts
    - frontend/src/types/event.ts
  modified:
    - frontend/src/types/dashboard.ts
    - frontend/src/services/auth.ts
    - frontend/src/services/tokenStore.ts
    - frontend/src/contexts/AppContext.tsx
    - frontend/src/components/chat/modals/DirectMessageModal.tsx
    - frontend/src/components/chat/modals/SimpleCreateChatModal.tsx
    - frontend/src/components/chat/modals/MembersModal.tsx
    - frontend/src/components/admin/UsersView.tsx
    - frontend/src/components/admin/modals/UserManagementModal.tsx
    - frontend/src/components/admin/pages/AdminUsersPage.tsx
    - frontend/src/components/admin/modals/EventModal.tsx
    - frontend/src/components/admin/EventsView.tsx
    - frontend/src/components/admin/pages/AdminEventsPage.tsx
    - frontend/src/components/konfi/views/EventDetailView.tsx
    - frontend/src/components/konfi/views/EventsView.tsx
    - frontend/src/components/konfi/pages/KonfiDashboardPage.tsx
    - frontend/src/components/konfi/pages/KonfiEventsPage.tsx
    - frontend/src/components/teamer/pages/TeamerEventsPage.tsx
    - frontend/src/components/teamer/pages/TeamerDashboardPage.tsx

key-decisions:
  - "registered_count und registration_status als required statt optional im zentralen Event-Typ (immer vom API vorhanden)"
  - "AdminUser.assigned_jahrgaenge_count als required (immer vom API vorhanden)"
  - "AdminEventsPage zusaetzlich migriert obwohl nicht im Plan (Rule 3 - blockierte den Build)"

patterns-established:
  - "Zentrale Typen: Alle geteilten Interfaces in frontend/src/types/ definieren, Consumer importieren"
  - "User-Varianten: BaseUser (auth/context), AdminUser (Verwaltung), ChatUser (Chat-Modals)"
  - "Event: Ein vollstaendiges Interface mit allen optionalen Feldern statt 8 Teildefinitionen"

requirements-completed: [CLEANUP-01]

duration: 11min
completed: 2026-03-21
---

# Phase 63 Plan 01: Typ-Konsolidierung Summary

**User (9x) und Event (8x) duplizierte Interfaces in zentrale types/ Dateien konsolidiert, 19 as-any Casts eliminiert, -404 Netto-Zeilen**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-21T12:44:18Z
- **Completed:** 2026-03-21T12:55:27Z
- **Tasks:** 2
- **Files modified:** 21

## Accomplishments
- 3 zentrale User-Typen (BaseUser, AdminUser, ChatUser) in types/user.ts erstellt
- 4 zentrale Event-Typen (Event, Category, Timeslot, Jahrgang) in types/event.ts erstellt
- 18 Consumer-Dateien auf zentrale Imports umgestellt (9 User + 9 Event inkl. AdminEventsPage)
- 19 as-any Casts bei Event-Properties eliminiert (has_timeslots, waitlist_*, booking_status, mandatory, bring_items, checkin_window, teamer_*)
- TypeScript Build erfolgreich ohne Errors
- 404 Zeilen Code entfernt (duplizierte Interface-Definitionen)

## Task Commits

1. **Task 1: Zentrale User- und Event-Type-Dateien erstellen** - `7c2e289` (feat)
2. **Task 2: Alle Consumer auf zentrale Types umstellen + as-any eliminieren** - `93c0e37` (refactor)

## Files Created/Modified
- `frontend/src/types/user.ts` - BaseUser, AdminUser, ChatUser Interfaces
- `frontend/src/types/event.ts` - Event, Category, Timeslot, Jahrgang Interfaces
- `frontend/src/types/dashboard.ts` - DashboardEvent Re-Export von Event
- `frontend/src/services/auth.ts` - BaseUser statt lokales User Interface
- `frontend/src/services/tokenStore.ts` - BaseUser statt lokales User Interface
- `frontend/src/contexts/AppContext.tsx` - BaseUser statt lokales User Interface
- `frontend/src/components/chat/modals/DirectMessageModal.tsx` - ChatUser Import
- `frontend/src/components/chat/modals/SimpleCreateChatModal.tsx` - ChatUser Import
- `frontend/src/components/chat/modals/MembersModal.tsx` - ChatUser Import
- `frontend/src/components/admin/UsersView.tsx` - AdminUser Import
- `frontend/src/components/admin/modals/UserManagementModal.tsx` - AdminUser Import
- `frontend/src/components/admin/pages/AdminUsersPage.tsx` - AdminUser Import
- `frontend/src/components/admin/modals/EventModal.tsx` - Event/Category/Timeslot/Jahrgang Import, 8 as-any eliminiert
- `frontend/src/components/admin/EventsView.tsx` - Event Import
- `frontend/src/components/admin/pages/AdminEventsPage.tsx` - Event Import (zusaetzlich migriert)
- `frontend/src/components/konfi/views/EventDetailView.tsx` - Event/Category Import, 11 as-any eliminiert
- `frontend/src/components/konfi/views/EventsView.tsx` - Event Import
- `frontend/src/components/konfi/pages/KonfiDashboardPage.tsx` - Event Import
- `frontend/src/components/konfi/pages/KonfiEventsPage.tsx` - Event Import
- `frontend/src/components/teamer/pages/TeamerEventsPage.tsx` - Event Import
- `frontend/src/components/teamer/pages/TeamerDashboardPage.tsx` - DashboardEvent als Event type alias

## Decisions Made
- registered_count und registration_status als required im zentralen Event-Typ markiert (werden immer vom API mitgeliefert)
- assigned_jahrgaenge_count im AdminUser als required (wird immer vom API mitgeliefert)
- AdminEventsPage zusaetzlich migriert da sonst TS-Build fehlschlug (gleiche Event-Referenz wie admin/EventsView)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] AdminEventsPage.tsx zusaetzlich migriert**
- **Found during:** Task 2
- **Issue:** AdminEventsPage hatte ein lokales Event-Interface das mit dem neuen zentralen Event in admin/EventsView kollidierte (TS2322 Type-Inkompatibilitaet)
- **Fix:** Lokales Interface entfernt und `import { Event } from '../../../types/event'` hinzugefuegt; `jahrgang_ids` Feld zum zentralen Event-Typ hinzugefuegt
- **Files modified:** frontend/src/components/admin/pages/AdminEventsPage.tsx, frontend/src/types/event.ts
- **Committed in:** 93c0e37

**2. [Rule 1 - Bug] Optional-Check fuer assigned_at in UserManagementModal**
- **Found during:** Task 2
- **Issue:** assigned_at war im zentralen AdminUser-Typ optional, aber new Date(assignment.assigned_at) schlug bei undefined fehl
- **Fix:** Conditional rendering: `{assignment.assigned_at && new Date(...)}`
- **Files modified:** frontend/src/components/admin/modals/UserManagementModal.tsx
- **Committed in:** 93c0e37

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Beide Fixes notwendig fuer korrekten TS-Build. Kein Scope-Creep.

## Deferred Items

- `ParticipantManagementModal.tsx` hat noch ein lokales `interface Event` (nicht Teil dieses Plans, verursacht keinen Konflikt)
- `admin/views/EventDetailView.tsx` hat noch ein lokales `interface Event` (nicht Teil dieses Plans, verursacht keinen Konflikt)

## Issues Encountered
None

## User Setup Required
None - keine externe Konfiguration erforderlich.

## Next Phase Readiness
- Zentrale Type-Dateien bereit fuer alle zukuenftigen Typ-Aenderungen
- 2 weitere Dateien mit lokalen Event-Interfaces koennten in Plan 02 oder spaeter migriert werden

---
*Phase: 63-codebase-cleanup*
*Completed: 2026-03-21*
