---
phase: quick
plan: 260325-t3v
subsystem: frontend-konfi-dashboard
tags: [ui-polish, events-card, badge-popover, spacing]
dependency_graph:
  requires: []
  provides: [konfi-events-teamer-pattern, badge-popover-minwidth, points-compact-spacing]
  affects: [DashboardView, DashboardSections, PointsHistoryModal]
tech_stack:
  patterns: [teamer-events-pattern-reuse, glass-chip-link, css-margin-only-spacing]
key_files:
  modified:
    - frontend/src/components/konfi/views/DashboardView.tsx
    - frontend/src/components/konfi/views/DashboardSections.tsx
    - frontend/src/components/konfi/modals/PointsHistoryModal.tsx
decisions:
  - Corner Badge bei 0 Events zeigt 'ERSTES EVENT ENTDECKEN' statt 'EVENTS ENTDECKEN'
  - Alle Events Link nur im Zustand mit Events, nicht im Leerzustand
  - Spacing nur ueber CSS margin-bottom, kein doppelter gap
metrics:
  duration_seconds: 114
  completed: "2026-03-25T20:04:00Z"
  tasks_completed: 2
  tasks_total: 2
---

# Quick Task 260325-t3v: Konfi Dashboard Events-Card wie Teamer + Badge/Spacing Fixes

Konfi Events-Card 1:1 wie Teamer mit Corner Badge und "Alle Events anzeigen" Link, Badge Popover breiter (minWidth 200px), Punkte-Uebersicht kompakteres Spacing ohne doppelten gap.

## Completed Tasks

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Events-Card Corner Badge + Alle Events Link + Badge Popover minWidth | d008e89 | DashboardView.tsx, DashboardSections.tsx |
| 2 | Punkte-Uebersicht kompakteres Spacing | 87ac655 | PointsHistoryModal.tsx |

## Changes Made

### Task 1: Events-Card + Badge Popover

**DashboardView.tsx:**
- Corner Badge Text bei 0 Events: `'EVENTS ENTDECKEN'` -> `'ERSTES EVENT ENTDECKEN'`
- "Alle Events anzeigen" glass-chip Link mit chevronForward Icon nach den EventCards eingefuegt
- Link nur sichtbar wenn `regularEvents.length > 0` (innerhalb des bestehenden Blocks)

**DashboardSections.tsx:**
- DashboardBadgePopoverContent: `minWidth: '200px'` zum aeusseren Container hinzugefuegt

### Task 2: Punkte-Uebersicht Spacing

**PointsHistoryModal.tsx:**
- IonCardContent Padding: `8px` -> `12px` (gleichmaessig wie Chatroom-Listen-Pattern)
- Flex-Container `gap: '8px'` entfernt, nur CSS `.app-list-item` margin-bottom greift (verhindert doppelten 16px Abstand)

## Deviations from Plan

None - Plan exakt wie geschrieben umgesetzt.

## Known Stubs

None.

## Self-Check: PASSED
