---
phase: 59-online-only-buttons
plan: 03
subsystem: ui
tags: [ionic, react, offline, isOnline, button-disable]

requires:
  - phase: 55-network-state
    provides: "isOnline state in AppContext"
  - phase: 59-01
    provides: "Online-Only pattern on modal forms"
  - phase: 59-02
    provides: "Online-Only pattern on admin dashboard actions"
provides:
  - "isOnline guards on all destructive/server-validated buttons across 23 page/view files"
  - "Offline text on text-buttons, disabled on icon-buttons"
affects: [60-queue, 62-sync]

tech-stack:
  added: []
  patterns:
    - "if (!isOnline) return; as first guard in destructive handlers"
    - "disabled={!isOnline} on server-action buttons"
    - "Ternary text: !isOnline ? 'Du bist offline' : 'Originaltext'"

key-files:
  created: []
  modified:
    - frontend/src/components/admin/views/KonfiDetailView.tsx
    - frontend/src/components/admin/views/EventDetailView.tsx
    - frontend/src/components/admin/pages/AdminActivitiesPage.tsx
    - frontend/src/components/admin/pages/AdminBadgesPage.tsx
    - frontend/src/components/admin/pages/AdminCategoriesPage.tsx
    - frontend/src/components/admin/pages/AdminJahrgaengeePage.tsx
    - frontend/src/components/admin/pages/AdminLevelsPage.tsx
    - frontend/src/components/admin/pages/AdminCertificatesPage.tsx
    - frontend/src/components/admin/pages/AdminMaterialPage.tsx
    - frontend/src/components/admin/pages/AdminEventsPage.tsx
    - frontend/src/components/admin/pages/AdminKonfisPage.tsx
    - frontend/src/components/admin/pages/AdminUsersPage.tsx
    - frontend/src/components/admin/pages/AdminActivityRequestsPage.tsx
    - frontend/src/components/admin/pages/AdminOrganizationsPage.tsx
    - frontend/src/components/admin/pages/AdminInvitePage.tsx
    - frontend/src/components/admin/modals/QRDisplayModal.tsx
    - frontend/src/components/konfi/modals/QRScannerModal.tsx
    - frontend/src/components/konfi/views/EventDetailView.tsx
    - frontend/src/components/konfi/pages/KonfiRequestsPage.tsx
    - frontend/src/components/chat/ChatOverview.tsx
    - frontend/src/components/chat/ChatRoom.tsx
    - frontend/src/components/auth/KonfiRegisterPage.tsx
    - frontend/src/components/auth/ForgotPasswordPage.tsx

key-decisions:
  - "Handler-Guards statt Button-only-Disable: Beide Ebenen (Handler return + Button disabled) fuer doppelte Sicherheit"
  - "QRScannerModal zeigt Inline-Banner statt Alert bei Offline-Scan"

patterns-established:
  - "Destruktive Handler: if (!isOnline) return; als erste Zeile"
  - "Text-Buttons: Ternary mit 'Du bist offline'"
  - "Icon-Buttons: nur disabled={!isOnline}, kein Text"
  - "Slide-Actions (IonItemOption): Handler-Guard reicht, kein disabled noetig"

requirements-completed: [OOA-10, OOA-11, OOA-14, OOA-15, OOA-22, OOA-23, OOA-24, OOA-25, OOA-26, OOA-27, OOA-28, OOA-29, OOA-30, OOA-31, OOA-32, OOA-33, OOA-34, OOA-35, OOA-36]

duration: 7min
completed: 2026-03-21
---

# Phase 59 Plan 03: Online-Only Guards auf 23 Pages/Views Summary

**isOnline-Guards auf alle destruktiven und server-validierten Buttons in Admin, Chat, Konfi und Auth Pages -- kein Button fuehrt offline zu einem API-Call**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-21T09:31:06Z
- **Completed:** 2026-03-21T09:39:00Z
- **Tasks:** 2
- **Files modified:** 23

## Accomplishments
- 14 Admin Pages/Views mit isOnline-Guards auf Delete, Cancel, Promote, Password-Reset, Assign-Certificate, Attendance-Update
- 9 Chat/Konfi/Auth Dateien mit isOnline-Guards auf Chat-Leave, Message-Delete, Room-Delete, Event-Register/Unregister, QR-Scan, Invite-CRUD, Register, Password-Reset
- TypeScript kompiliert fehlerfrei

## Task Commits

Each task was committed atomically:

1. **Task 1: Admin Pages Delete-Buttons + KonfiDetailView Online-Only (14 Dateien)** - `10b3ba7` (feat)
2. **Task 2: Chat + Konfi + Auth Pages Online-Only (9 Dateien)** - `9acc4ec` (feat)

## Files Created/Modified
- `frontend/src/components/admin/views/KonfiDetailView.tsx` - 6 Handler-Guards + 3 Button-Disables (promote, delete activity/bonus/cert, assign cert, password)
- `frontend/src/components/admin/views/EventDetailView.tsx` - 7 Handler-Guards + 2 Button-Disables (cancel, chat, remove, attendance, waitlist)
- `frontend/src/components/admin/pages/Admin*Page.tsx` (12 Dateien) - Delete-Handler-Guards auf Activities, Badges, Categories, Jahrgaenge, Levels, Certificates, Material, Events, Konfis, Users, Requests, Organizations
- `frontend/src/components/chat/ChatOverview.tsx` - deleteRoom Handler-Guard
- `frontend/src/components/chat/ChatRoom.tsx` - handleLeaveChat + deleteMessage Guards + Button-Disable
- `frontend/src/components/admin/pages/AdminInvitePage.tsx` - generate/extend/delete Guards + Button-Disable
- `frontend/src/components/admin/modals/QRDisplayModal.tsx` - Retry-Button disabled
- `frontend/src/components/konfi/modals/QRScannerModal.tsx` - Scan-Submit Guard mit Offline-Banner
- `frontend/src/components/konfi/views/EventDetailView.tsx` - Register/Unregister Guards + 4 Button-Disables
- `frontend/src/components/konfi/pages/KonfiRequestsPage.tsx` - deleteRequest Guard
- `frontend/src/components/auth/KonfiRegisterPage.tsx` - Register-Button disabled + Offline-Text
- `frontend/src/components/auth/ForgotPasswordPage.tsx` - Submit-Button disabled + Offline-Text

## Decisions Made
- Handler-Guards UND Button-Disable auf beiden Ebenen fuer doppelte Sicherheit
- QRScannerModal: Inline-Banner "Du bist offline" statt Alert, weil Scanner-UI kein useIonAlert hat
- ForgotPasswordPage: useApp importiert (war bisher nicht vorhanden) fuer isOnline-Zugriff

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Alle 23 Page/View-Dateien haben isOnline-Guards
- Phase 59 (Online-Only Buttons) komplett abgeschlossen
- Bereit fuer Phase 60 (Queue) oder Phase 61 (Sync)

---
*Phase: 59-online-only-buttons*
*Completed: 2026-03-21*
