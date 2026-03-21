---
phase: 57-retry-schutz
plan: 01
subsystem: ui
tags: [axios-retry, react-hooks, double-submit, exponential-backoff]

requires: []
provides:
  - "axios-retry Konfiguration fuer transiente Fehler (5xx/408/429)"
  - "useActionGuard Hook fuer Double-Submit-Schutz"
  - "22 Modals mit Submit-Schutz via useActionGuard"
affects: [offline-ui, queue, sync]

tech-stack:
  added: [axios-retry]
  patterns: [useActionGuard Hook mit guardRef fuer Race-Condition-Schutz]

key-files:
  created:
    - frontend/src/hooks/useActionGuard.ts
  modified:
    - frontend/src/services/api.ts
    - frontend/src/components/admin/modals/*.tsx (15 Dateien)
    - frontend/src/components/konfi/modals/*.tsx (4 Dateien)
    - frontend/src/components/chat/modals/*.tsx (3 Dateien)

key-decisions:
  - "axios-retry mit Jitter (Math.random() * 200ms) zur Vermeidung von Thundering Herd"
  - "guardRef statt nur useState fuer synchronen Double-Submit-Check"
  - "Kein IonSpinner bei allen Buttons — nur disabled reicht fuer RET-02"
  - "Aliasing isSubmitting: creating fuer Chat-Modals die creating-Variable weiterverwenden"

patterns-established:
  - "useActionGuard: Import + destructure {isSubmitting, guard} + guard() um Submit-Handler"
  - "axios-retry nach axios.create(), vor Interceptors"

requirements-completed: [RET-01, RET-02]

duration: 17min
completed: 2026-03-21
---

# Phase 57 Plan 01: Retry + Double-Submit-Schutz Summary

**axios-retry mit 3x Exponential Backoff + Jitter fuer transiente Fehler, useActionGuard Hook in allen 22 Submit-Modals**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-21T08:37:59Z
- **Completed:** 2026-03-21T08:55:26Z
- **Tasks:** 2
- **Files modified:** 24

## Accomplishments
- axios-retry wiederholt 5xx/408/429 automatisch 3x mit Exponential Backoff + Jitter
- 4xx (ausser 429) werden NICHT wiederholt
- useActionGuard Hook mit guardRef fuer Race-Condition-freien Double-Submit-Schutz
- Alle 22 Modals mit Submit-Buttons nutzen useActionGuard — Buttons disabled waehrend Request

## Task Commits

Each task was committed atomically:

1. **Task 1: axios-retry Konfiguration + useActionGuard Hook** - `a015324` (feat)
2. **Task 2: useActionGuard in alle Modals mit Submit-Buttons einbauen** - `54e6770` (feat)

## Files Created/Modified
- `frontend/src/services/api.ts` - axiosRetry Konfiguration nach axios.create()
- `frontend/src/hooks/useActionGuard.ts` - Reusable Hook mit isSubmitting + guard()
- `frontend/src/components/admin/modals/ActivityModal.tsx` - guard() + isSubmitting
- `frontend/src/components/admin/modals/ActivityRequestModal.tsx` - guard() + isSubmitting
- `frontend/src/components/admin/modals/BadgeManagementModal.tsx` - guard() + isSubmitting
- `frontend/src/components/admin/modals/BonusModal.tsx` - guard() ersetzt loading State
- `frontend/src/components/admin/modals/ChangeEmailModal.tsx` - guard() ersetzt saving State
- `frontend/src/components/admin/modals/ChangePasswordModal.tsx` - guard() ersetzt saving State
- `frontend/src/components/admin/modals/ChangeRoleTitleModal.tsx` - guard() ersetzt saving State
- `frontend/src/components/admin/modals/EventModal.tsx` - guard() + isSubmitting (loading bleibt fuer UI)
- `frontend/src/components/admin/modals/KonfiModal.tsx` - guard() ersetzt loading State
- `frontend/src/components/admin/modals/LevelManagementModal.tsx` - guard() + isSubmitting
- `frontend/src/components/admin/modals/MaterialFormModal.tsx` - guard() ersetzt saving State
- `frontend/src/components/admin/modals/OrganizationManagementModal.tsx` - guard() ersetzt saving State
- `frontend/src/components/admin/modals/ParticipantManagementModal.tsx` - guard() + isSubmitting
- `frontend/src/components/admin/modals/UserManagementModal.tsx` - guard() ersetzt saving State
- `frontend/src/components/admin/modals/ActivityManagementModal.tsx` - guard() + isSubmitting
- `frontend/src/components/konfi/modals/ActivityRequestModal.tsx` - guard() ersetzt submitting State
- `frontend/src/components/konfi/modals/ChangeEmailModal.tsx` - guard() ersetzt saving State
- `frontend/src/components/konfi/modals/ChangePasswordModal.tsx` - guard() ersetzt saving State
- `frontend/src/components/konfi/modals/UnregisterModal.tsx` - guard() + isSubmitting
- `frontend/src/components/chat/modals/SimpleCreateChatModal.tsx` - guard() ersetzt creating State
- `frontend/src/components/chat/modals/PollModal.tsx` - guard() ersetzt creating State
- `frontend/src/components/chat/modals/DirectMessageModal.tsx` - guard() ersetzt creating State

## Decisions Made
- axios-retry mit Jitter (Math.random() * 200ms) zur Vermeidung von Thundering Herd
- guardRef statt nur useState fuer synchronen Double-Submit-Check vor async setState
- Kein IonSpinner hinzugefuegt — bestehende Spinner beibehalten, nur disabled reicht
- Bei Modals mit loading fuer Daten UND Submit: loading beibehalten, guard() zusaetzlich

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- npm install axios-retry schlug mit Peer-Dependency-Konflikt fehl, geloest mit --legacy-peer-deps
- Einige Modals hatten Restverweise auf entfernte loading/saving States, nach TSC-Check gefixed

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Retry-Logik und Double-Submit-Schutz sind aktiv
- Bereit fuer Phase 57 Plan 02 (falls vorhanden)

---
*Phase: 57-retry-schutz*
*Completed: 2026-03-21*
