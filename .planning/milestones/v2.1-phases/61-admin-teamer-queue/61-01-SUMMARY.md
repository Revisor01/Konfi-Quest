---
phase: 61-admin-teamer-queue
plan: 01
subsystem: ui
tags: [ionic, react, offline, writeQueue, networkMonitor, admin-modals]

requires:
  - phase: 60-queue-kern-konfi-aktionen
    provides: writeQueue.enqueue API und networkMonitor
provides:
  - 5 Admin-Modals mit Online/Offline-Branching im Submit-Handler
  - Queue-Fallback fuer Event, Aktivitaet, Badge, Level, Material CRUD
affects: [61-02, 61-03, 62-sync]

tech-stack:
  added: []
  patterns:
    - "Admin-Modal Queue-Pattern: networkMonitor.isOnline Branching im guard()-Block"
    - "Material Offline: Nur Metadaten gequeued, Dateien nur online"

key-files:
  created: []
  modified:
    - frontend/src/components/admin/modals/EventModal.tsx
    - frontend/src/components/admin/modals/ActivityManagementModal.tsx
    - frontend/src/components/admin/modals/BadgeManagementModal.tsx
    - frontend/src/components/admin/modals/LevelManagementModal.tsx
    - frontend/src/components/admin/modals/MaterialFormModal.tsx

key-decisions:
  - "Material Offline: Nur Metadaten queuen, Dateien nur online hochladbar (QUE-A16 konform)"
  - "Alle Submit-Buttons immer klickbar, Queue uebernimmt bei Offline"

patterns-established:
  - "Admin Queue-Pattern: if (networkMonitor.isOnline) { api.post/put } else { writeQueue.enqueue } im guard()-Block"

requirements-completed: [QUE-A01, QUE-A02, QUE-A03, QUE-A04, QUE-A05, QUE-A06, QUE-A07, QUE-A12, QUE-A13, QUE-A16, QUE-A17]

duration: 3min
completed: 2026-03-21
---

# Phase 61 Plan 01: Admin-Modals Queue Summary

**5 Admin-Modals (Event, Aktivitaet, Badge, Level, Material) mit writeQueue Offline-Fallback und immer klickbaren Submit-Buttons**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T11:28:31Z
- **Completed:** 2026-03-21T11:31:16Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- EventModal: 3 Queue-Pfade (Einzelevent, Serie, Bearbeiten) mit writeQueue.enqueue
- ActivityManagementModal + BadgeManagementModal: Je 2 Queue-Pfade (erstellen, bearbeiten)
- LevelManagementModal: 2 Queue-Pfade (erstellen, bearbeiten)
- MaterialFormModal: Metadaten offline gequeued, Dateien nur online (pragmatische Loesung)
- Alle 5 Submit-Buttons: !isOnline disabled und "Du bist offline" Text entfernt

## Task Commits

Each task was committed atomically:

1. **Task 1: EventModal + ActivityManagementModal + BadgeManagementModal queue-faehig** - `8380c13` (feat)
2. **Task 2: LevelManagementModal + MaterialFormModal queue-faehig** - `5a43dee` (feat)

## Files Created/Modified
- `frontend/src/components/admin/modals/EventModal.tsx` - 3 writeQueue.enqueue Pfade (PUT event, POST series, POST event)
- `frontend/src/components/admin/modals/ActivityManagementModal.tsx` - 2 writeQueue.enqueue Pfade (PUT/POST activities)
- `frontend/src/components/admin/modals/BadgeManagementModal.tsx` - 2 writeQueue.enqueue Pfade (PUT/POST badges)
- `frontend/src/components/admin/modals/LevelManagementModal.tsx` - 2 writeQueue.enqueue Pfade (PUT/POST levels)
- `frontend/src/components/admin/modals/MaterialFormModal.tsx` - 1 writeQueue.enqueue Pfad (PUT/POST material, nur Metadaten)

## Decisions Made
- Material Offline: Nur Metadaten queuen (hasFileUpload: false), Dateien nur online. Konsistent mit QUE-A16: "Metadaten sofort, Datei-Upload bei naechstem Vordergrund-Aufenthalt"
- Submit-Buttons immer klickbar: Queue uebernimmt bei Offline, kein separater Offline-Hinweis mehr noetig

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 5 Admin-Modals sind queue-faehig, ready fuer Plan 02 (Pages) und Plan 03 (Teamer)
- Pattern etabliert: networkMonitor.isOnline Branching + writeQueue.enqueue im guard()-Block

---
*Phase: 61-admin-teamer-queue*
*Completed: 2026-03-21*
