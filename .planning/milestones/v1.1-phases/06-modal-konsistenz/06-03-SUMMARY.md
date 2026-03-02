---
phase: 06-modal-konsistenz
plan: 03
subsystem: ui
tags: [ionic, react, css, modals, domain-colors]

# Dependency graph
requires:
  - phase: 06-modal-konsistenz/01
    provides: Modal-CSS-Klassen (app-modal-close-btn, app-modal-submit-btn, app-modal-section)
provides:
  - 14 Konfi- und Chat-Modals mit einheitlichem Layout-Pattern
  - Alle Section-Icons in Domain-Farben (Lila fuer Konfi, Tuerkis fuer Chat)
affects: [06-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [Domain-Farben-Konsistenz in Modal-Sektionen]

key-files:
  modified:
    - frontend/src/components/konfi/modals/EditProfileModal.tsx
    - frontend/src/components/konfi/modals/ChangePasswordModal.tsx
    - frontend/src/components/konfi/modals/ChangeEmailModal.tsx
    - frontend/src/components/konfi/modals/UnregisterModal.tsx
    - frontend/src/components/konfi/modals/RequestDetailModal.tsx
    - frontend/src/components/konfi/modals/ActivityRequestModal.tsx
    - frontend/src/components/konfi/modals/PointsHistoryModal.tsx
    - frontend/src/components/chat/modals/GroupChatModal.tsx
    - frontend/src/components/chat/modals/DirectMessageModal.tsx
    - frontend/src/components/chat/modals/CreateChatModal.tsx
    - frontend/src/components/chat/modals/SimpleCreateChatModal.tsx
    - frontend/src/components/chat/modals/ChatOptionsModal.tsx
    - frontend/src/components/chat/modals/PollModal.tsx
    - frontend/src/components/chat/modals/MembersModal.tsx

key-decisions:
  - "UnregisterModal Section-Icons von events auf purple geaendert (Domain-Farbe hat Vorrang vor semantischer Farbe)"
  - "Chat-Modals IonCardHeader/IonCardTitle durch IonListHeader mit app-section-icon--chat Pattern ersetzt"

patterns-established:
  - "Domain-Farbe hat Vorrang: Alle Section-Icons innerhalb eines Modals nutzen eine einzige Domain-Farbe"
  - "Konfi-Modal Header: app-modal-close-btn + app-modal-submit-btn--konfi"
  - "Chat-Modal Header: app-modal-close-btn + app-modal-submit-btn--chat"

requirements-completed: [MOD-03]

# Metrics
duration: 6min
completed: 2026-03-02
---

# Phase 06 Plan 03: Konfi- und Chat-Modals Layout Summary

**14 Modals (7 Konfi + 7 Chat) auf einheitliche Header-Buttons, Domain-Farb-Section-Icons und app-modal-* CSS-Klassen angeglichen**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-02T12:17:24Z
- **Completed:** 2026-03-02T12:24:02Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- 7 Konfi-Modals: Header-Buttons auf app-modal-close-btn/app-modal-submit-btn--konfi, Section-Icons einheitlich auf app-section-icon--purple
- 7 Chat-Modals: Header-Buttons auf app-modal-close-btn/app-modal-submit-btn--chat, Section-Icons einheitlich auf app-section-icon--chat
- Inline-Styles (margin, Farben) durch CSS-Klassen ersetzt (app-modal-section, app-section-icon-Varianten)
- Chat-Modals ohne Section-Header (GroupChat, DirectMessage, CreateChat, ChatOptions) erhielten IonListHeader mit Icon-Kreis-Pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Konfi-Modals Layout angleichen** - `9544c9d` (feat)
2. **Task 2: Chat-Modals Layout angleichen** - `b952765` (feat)

## Files Created/Modified
- `frontend/src/components/konfi/modals/EditProfileModal.tsx` - app-section-icon--info zu --purple, Header-Buttons CSS
- `frontend/src/components/konfi/modals/ChangePasswordModal.tsx` - Header-Buttons CSS, margin zu app-modal-section
- `frontend/src/components/konfi/modals/ChangeEmailModal.tsx` - Header-Buttons CSS
- `frontend/src/components/konfi/modals/UnregisterModal.tsx` - app-section-icon--events zu --purple, Header-Buttons CSS
- `frontend/src/components/konfi/modals/RequestDetailModal.tsx` - app-section-icon--requests zu --purple, Header-Buttons CSS
- `frontend/src/components/konfi/modals/ActivityRequestModal.tsx` - app-section-icon--success zu --purple, Header-Buttons CSS
- `frontend/src/components/konfi/modals/PointsHistoryModal.tsx` - Header Close-Button CSS
- `frontend/src/components/chat/modals/GroupChatModal.tsx` - IonCardHeader durch IonListHeader mit Section-Icon ersetzt, Header-Buttons CSS
- `frontend/src/components/chat/modals/DirectMessageModal.tsx` - Section-Header fuer Suche/Kontakte/Hinweis hinzugefuegt, Close-Button CSS
- `frontend/src/components/chat/modals/CreateChatModal.tsx` - IonCardHeader durch IonListHeader ersetzt, Header-Buttons CSS
- `frontend/src/components/chat/modals/SimpleCreateChatModal.tsx` - Header-Buttons CSS, margin zu app-modal-section
- `frontend/src/components/chat/modals/ChatOptionsModal.tsx` - Inline Section-Header durch IonListHeader Pattern ersetzt, Close-Button CSS
- `frontend/src/components/chat/modals/PollModal.tsx` - Header-Buttons CSS
- `frontend/src/components/chat/modals/MembersModal.tsx` - Header-Buttons CSS, margin zu app-modal-section

## Decisions Made
- UnregisterModal: Section-Icons von events-rot auf purple (Konfi-Domain-Farbe) geaendert -- Domain-Farbe hat Vorrang vor semantischer Farbe fuer visuelle Konsistenz
- Chat-Modals: IonCardHeader/IonCardTitle Pattern durch IonListHeader mit app-section-icon--chat ersetzt fuer konsistentes Section-Header-Design ueber alle Modals hinweg
- RequestDetailModal Status-Sektion: Dynamische Hintergrundfarbe bleibt als inline-style (nicht durch CSS-Klasse ersetzbar wegen runtime-Logik)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Alle 14 Konfi- und Chat-Modals folgen dem einheitlichen Layout-Pattern
- Zusammen mit Plan 06-02 (Admin-Modals) sind nun alle 28 Modals auf das konsistente Design angeglichen
- Bereit fuer Plan 06-04 (iOS Card-Modal und Swipe-to-Dismiss)

## Self-Check: PASSED

All 14 files verified present. Both task commits (9544c9d, b952765) verified in git log.

---
*Phase: 06-modal-konsistenz*
*Completed: 2026-03-02*
