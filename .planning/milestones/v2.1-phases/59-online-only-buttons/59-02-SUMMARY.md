---
phase: 59-online-only-buttons
plan: 02
subsystem: ui
tags: [ionic, react, offline, isOnline, useApp, modals]

requires:
  - phase: 55-network-state
    provides: "isOnline aus useApp() Hook"
  - phase: 59-online-only-buttons/01
    provides: "useActionGuard Hook, Online-Only Pattern Referenz"
provides:
  - "23 Modals mit isOnline-Check auf Submit-Buttons"
  - "'Du bist offline' Button-Text Pattern fuer alle Modals"
affects: [59-online-only-buttons/03, 60-queue]

tech-stack:
  added: []
  patterns: ["isOnline Button-Guard auf allen Modal Submit-Buttons"]

key-files:
  created: []
  modified:
    - frontend/src/components/admin/modals/ActivityModal.tsx
    - frontend/src/components/admin/modals/BonusModal.tsx
    - frontend/src/components/admin/modals/UserManagementModal.tsx
    - frontend/src/components/admin/modals/OrganizationManagementModal.tsx
    - frontend/src/components/admin/modals/KonfiModal.tsx
    - frontend/src/components/admin/modals/ChangeEmailModal.tsx
    - frontend/src/components/admin/modals/ChangePasswordModal.tsx
    - frontend/src/components/admin/modals/ChangeRoleTitleModal.tsx
    - frontend/src/components/admin/modals/ParticipantManagementModal.tsx
    - frontend/src/components/admin/modals/MaterialFormModal.tsx
    - frontend/src/components/admin/modals/LevelManagementModal.tsx
    - frontend/src/components/admin/modals/BadgeManagementModal.tsx
    - frontend/src/components/admin/modals/EventModal.tsx
    - frontend/src/components/admin/modals/ActivityManagementModal.tsx
    - frontend/src/components/admin/modals/ActivityRequestModal.tsx
    - frontend/src/components/konfi/modals/ActivityRequestModal.tsx
    - frontend/src/components/konfi/modals/ChangePasswordModal.tsx
    - frontend/src/components/konfi/modals/ChangeEmailModal.tsx
    - frontend/src/components/konfi/modals/UnregisterModal.tsx
    - frontend/src/components/chat/modals/SimpleCreateChatModal.tsx
    - frontend/src/components/chat/modals/DirectMessageModal.tsx
    - frontend/src/components/chat/modals/PollModal.tsx
    - frontend/src/components/chat/modals/MembersModal.tsx

key-decisions:
  - "Icon-only Submit-Buttons zeigen 'Du bist offline' als Text statt Icon wenn offline"
  - "Action-Handler (Remove-Participant, Direct-Message-Create, Confirm-Remove) haben zusaetzlichen isOnline Guard"

patterns-established:
  - "Modal Submit-Button Pattern: disabled={... || !isOnline} + {!isOnline ? 'Du bist offline' : ...}"
  - "Action-Handler Guard: if (!isOnline) return; am Anfang von Handler-Funktionen ohne Submit-Button"

requirements-completed: [OUI-11, OUI-12, OOA-01, OOA-02, OOA-03, OOA-04, OOA-05, OOA-06, OOA-07, OOA-08, OOA-09, OOA-12, OOA-13, OOA-16, OOA-17, OOA-18, OOA-19, OOA-20, OOA-21, OOA-37, OOA-38, OOA-39, OOA-40, OOA-41, OOA-42]

duration: 9min
completed: 2026-03-21
---

# Phase 59 Plan 02: Modal Online-Only Buttons Summary

**23 Modals mit isOnline-Check: Submit-Buttons zeigen 'Du bist offline' und sind disabled wenn offline**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-21T09:31:04Z
- **Completed:** 2026-03-21T09:40:23Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments
- Alle 15 Admin-Modal-Dateien haben isOnline-Check auf Submit-Buttons
- Alle 8 Konfi- und Chat-Modal-Dateien haben isOnline-Check auf Submit-Buttons
- Kein globales Offline-Banner -- nur Button-Text aendert sich
- OrganizationManagementModal: auch Passwort-Reset und Admin-Hinzufuegen Buttons geschuetzt
- ParticipantManagementModal und MembersModal: auch Entfernen-Aktionen geschuetzt
- TypeScript kompiliert fehlerfrei

## Task Commits

Each task was committed atomically:

1. **Task 1: Admin-Modals Online-Only Buttons (15 Dateien)** - `2b22b61` (feat)
2. **Task 2: Konfi- + Chat-Modals Online-Only Buttons (8 Dateien)** - `800acf0` (feat)

## Files Created/Modified
- 15 Admin-Modal-Dateien in `frontend/src/components/admin/modals/` -- isOnline-Check auf Submit-Buttons
- 4 Konfi-Modal-Dateien in `frontend/src/components/konfi/modals/` -- isOnline-Check auf Submit-Buttons
- 4 Chat-Modal-Dateien in `frontend/src/components/chat/modals/` -- isOnline-Check auf Submit-Buttons und Action-Handler

## Decisions Made
- Icon-only Submit-Buttons (Header-Checkmark) zeigen "Du bist offline" als Text statt Icon wenn offline
- Action-Handler ohne eigenen Submit-Button (z.B. handleRemoveParticipant, createDirectMessage, confirmRemoveUser) haben if (!isOnline) return; Guard
- DirectMessageModal hat keinen Submit-Button sondern onClick auf Listenelemente -- Items werden disabled + Hinweistext zeigt "Du bist offline"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Alle 23 Modals haben Online-Only-Check
- Plan 03 kann Views und Pages mit Online-Only-Buttons ausstatten
- Pattern ist etabliert und konsistent

---
*Phase: 59-online-only-buttons*
*Completed: 2026-03-21*
