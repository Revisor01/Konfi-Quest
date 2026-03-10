---
phase: 40-badges-aktivitaeten
plan: 03
subsystem: ui
tags: [ionic, react, segment-toggle, badges, teamer, admin]

requires:
  - phase: 40-01
    provides: Backend-API mit target_role fuer Badges und Aktivitaeten
  - phase: 40-02
    provides: Teamer-Badge-Endpoints und Streak-Logik
provides:
  - Admin-UI Segment-Toggle fuer Konfi/Teamer-Badges
  - Admin-UI Segment-Toggle fuer Konfi/Teamer-Aktivitaeten
  - Teamer-Filter in Konfi-Verwaltungsliste
  - TeamerBadgesView Komponente mit Badge-Grid und Detail-Popover
  - TeamerProfilePage Integration fuer Teamer-Badges
affects: [teamer-dashboard, admin-settings]

tech-stack:
  added: []
  patterns: [segment-toggle-role-filter, target_role-prop-passing, teamer-badges-grid]

key-files:
  created:
    - frontend/src/components/teamer/views/TeamerBadgesView.tsx
  modified:
    - frontend/src/components/admin/pages/AdminBadgesPage.tsx
    - frontend/src/components/admin/BadgesView.tsx
    - frontend/src/components/admin/modals/BadgeManagementModal.tsx
    - frontend/src/components/admin/pages/AdminActivitiesPage.tsx
    - frontend/src/components/admin/modals/ActivityManagementModal.tsx
    - frontend/src/components/admin/KonfisView.tsx
    - frontend/src/components/admin/views/KonfiDetailView.tsx
    - frontend/src/components/teamer/pages/TeamerProfilePage.tsx

key-decisions:
  - "Segment-Toggle Pattern fuer Konfi/Teamer-Umschaltung in Badge- und Aktivitaeten-Seiten"
  - "Teamer:innen als Dropdown-Option im Jahrgang-Filter statt separater View"
  - "TeamerBadgesView als eigenstaendige Komponente mit internem Fetch"

patterns-established:
  - "Konfi/Teamer Segment-Toggle: IonSegment mit target_role State, lila Hervorhebung bei Teamer"
  - "target_role Prop-Passing: Page -> Modal fuer rollenspezifische Formular-Anpassung"

requirements-completed: [BDG-07, BDG-01]

duration: 8min
completed: 2026-03-10
---

# Phase 40 Plan 03: Frontend-UI fuer Teamer-Badges und -Aktivitaeten Summary

**Admin-Segment-Toggles fuer Konfi/Teamer-Badges und -Aktivitaeten, Teamer-Filter in Konfi-Liste, TeamerBadgesView mit Badge-Grid und Popover-Details im Teamer-Profil**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-10T22:03:16Z
- **Completed:** 2026-03-10T22:11:26Z
- **Tasks:** 3
- **Files modified:** 9

## Accomplishments
- Admin kann zwischen Konfi- und Teamer-Badges/Aktivitaeten umschalten via Segment-Toggle
- BadgeManagementModal blendet Punkte-basierte Kriterien bei Teamer aus, zeigt teamer_year nur bei Teamer
- ActivityManagementModal versteckt Punkte- und Typ-Felder bei Teamer-Aktivitaeten
- Teamer:innen erscheinen als Filter-Option in der Konfi-Verwaltung mit lila Akzent
- TeamerBadgesView zeigt Teamer-Badges mit earned/unearned Status, Neu-Markierung und Detail-Popover
- TeamerProfilePage integriert Teamer-Badges als eigene Sektion nach Konfi-Badges

## Task Commits

1. **Task 1: Admin Badge-Management um Konfi/Teamer-Toggle erweitern** - `48244ee` (feat)
2. **Task 2: Admin Aktivitaeten-Management und Konfi-Liste erweitern** - `5982827` (feat)
3. **Task 3: Teamer-Badge-View erstellen und in TeamerProfilePage integrieren** - `ae5669a` (feat)

## Files Created/Modified
- `frontend/src/components/teamer/views/TeamerBadgesView.tsx` - Teamer-Badge-Grid mit Popover-Details, Filter, Gruppierung
- `frontend/src/components/admin/pages/AdminBadgesPage.tsx` - Konfi/Teamer Segment-Toggle, target_role Query
- `frontend/src/components/admin/BadgesView.tsx` - teamer_year Kriterium-Text und -Icon
- `frontend/src/components/admin/modals/BadgeManagementModal.tsx` - target_role Feld, Punkte-Kriterien-Filter
- `frontend/src/components/admin/pages/AdminActivitiesPage.tsx` - Konfi/Teamer Segment-Toggle
- `frontend/src/components/admin/modals/ActivityManagementModal.tsx` - target_role, Punkte/Typ ausblenden
- `frontend/src/components/admin/KonfisView.tsx` - Teamer:innen Dropdown-Option, Teamer-Fetch
- `frontend/src/components/admin/views/KonfiDetailView.tsx` - role_name/user_type im Interface
- `frontend/src/components/teamer/pages/TeamerProfilePage.tsx` - TeamerBadgesView Integration

## Decisions Made
- Segment-Toggle Pattern (wie bei Events/Chat) fuer konsistente Konfi/Teamer-Umschaltung
- Teamer:innen als Dropdown-Option im bestehenden Jahrgang-Filter statt separater Seite
- TeamerBadgesView als eigenstaendige Komponente mit eigenem Fetch (wie KonfiBadgesView)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 40 vollstaendig abgeschlossen (alle 3 Plaene)
- Backend + Frontend fuer Teamer-Badges und -Aktivitaeten komplett

---
*Phase: 40-badges-aktivitaeten*
*Completed: 2026-03-10*
