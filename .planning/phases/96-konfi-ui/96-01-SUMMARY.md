---
phase: 96-konfi-ui
plan: 01
subsystem: ui
tags: [react, ionic, dashboard, events]

# Dependency graph
requires: []
provides:
  - Events-Card im Dashboard immer sichtbar (auch bei leerer Event-Liste)
  - Empty State mit Navigationslink zu /konfi/events
  - EventCard-Layout mit separaten Zeilen fuer Datum/Uhrzeit, Ort und Mitbringen
affects: [97-teamer-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Empty-State in Dashboard-Section zeigt Klick-Aktion mit Navigationsziel

key-files:
  created: []
  modified:
    - frontend/src/components/konfi/views/DashboardView.tsx
    - frontend/src/components/konfi/views/DashboardSections.tsx

key-decisions:
  - "Events-Section immer rendern: length-Check aus Section-Bedingung entfernt, nur dashboardConfig.show_events prueft"
  - "Empty State als klickbare glass-card implementiert (konsistent mit Chip-Stil)"

patterns-established:
  - "Dashboard-Section mit Empty-State: Chip-Text wechselt zwischen Entdecken/Zaehlung, Content wechselt zwischen Karten/Empty-State"

requirements-completed: [KDB-01, KDB-02]

# Metrics
duration: 8min
completed: 2026-03-25
---

# Phase 96 Plan 01: Dashboard Events-Card + Layout Summary

**Events-Card im Dashboard immer sichtbar mit klickbarem Empty-State und EventCard-Layout mit getrennten Zeilen fuer Datum/Uhrzeit, Ort und Mitbringen**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-25T09:00:00Z
- **Completed:** 2026-03-25T09:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Events-Section wird unabhaengig von der Event-Anzahl immer gerendert (KDB-01)
- Leere Event-Liste zeigt klickbare glass-card mit "Buche dein naechstes Event" und Navigation zu /konfi/events
- Header-Chip zeigt "EVENTS ENTDECKEN" bei 0 Events statt "DEINE 0 EVENTS"
- EventCard-Layout aufgeteilt: Datum/Uhrzeit (Zeile 1), Ort (Zeile 2, optional), Mitbringen (Zeile 3, optional) — konsistent mit EventsView (KDB-02)

## Task Commits

1. **Task 1: Events-Card immer sichtbar + Empty State** - `7b2fdad` (feat)
2. **Task 2: EventCard Layout mit eigenen Zeilen** - `7af6e13` (feat)

**Plan metadata:** (wird mit SUMMARY-Commit erstellt)

## Files Created/Modified
- `frontend/src/components/konfi/views/DashboardView.tsx` - Section-Bedingung ohne length-Check, Empty-State-Inhalt
- `frontend/src/components/konfi/views/DashboardSections.tsx` - EventCard: location aus flex-Row in eigenes meta-div verschoben

## Decisions Made
- Events-Section immer rendern: Nur `show_events !== false` als Gate, kein `length > 0`
- Empty State als klickbare `app-dashboard-glass-card` (konsistent mit bestehendem Chip-Design)

## Deviations from Plan

Keine — Plan exakt wie beschrieben umgesetzt. Umlaute korrekt verwendet (nächstes, verfügbare) statt Plan-Pseudotext.

## Issues Encountered

Keine.

## Next Phase Readiness
- Plan 96-02 bis 96-04 (Badges, Events, weitere Konfi-UI-Fixes) bereit

---
*Phase: 96-konfi-ui*
*Completed: 2026-03-25*

## Self-Check: PASSED

- FOUND: DashboardView.tsx
- FOUND: DashboardSections.tsx
- FOUND: 96-01-SUMMARY.md
- FOUND commit 7b2fdad (Task 1)
- FOUND commit 7af6e13 (Task 2)
