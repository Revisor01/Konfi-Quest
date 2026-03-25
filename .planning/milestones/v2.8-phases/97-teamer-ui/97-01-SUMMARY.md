---
phase: 97-teamer-ui
plan: 01
subsystem: ui
tags: [react, ionic, dashboard, badges, teamer]

# Dependency graph
requires:
  - phase: 96-konfi-ui
    provides: Konfi-Dashboard Badge-Sektion als Referenz-Implementierung

provides:
  - Teamer-Dashboard Zertifikate-Card mit lila Gradient (#7c3aed/#6d28d9)
  - Teamer-Dashboard Losung-Config-Check verifiziert (Default = sichtbar)
  - Teamer-Dashboard Badge-Sektion 1:1 wie Konfi-Dashboard (sichtbar + geheim + Neu-Markierung)
  - badgePulse Animation und gruener Ring fuer kuerzlich verdiente Badges

affects:
  - 97-teamer-ui (Plan 02: Events/Material)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Badge-Neu-Markierung: awarded_date < 7 Tage -> gruener Ring (boxShadow) + !-Kreis absolut positioniert"
    - "TeamerBadgeFull Interface mit getBadgeColor Funktion analog zu DashboardSections"
    - "Zweiter useOfflineQuery fuer alle Badges parallel zum Dashboard-Query"

key-files:
  created: []
  modified:
    - frontend/src/components/teamer/pages/TeamerDashboardPage.tsx

key-decisions:
  - "eyeOff Icon fuer nicht-verdiente sichtbare Badges (analog Konfi-Dashboard)"
  - "Inline BadgePopoverContent statt Import von DashboardBadgePopoverContent (andere Badge-Typen)"
  - "allTeamerBadges ueber /teamer/badges geladen, nicht aus dashboardData.badges (reicht nur fuer Counts)"

patterns-established:
  - "badgePulse: @keyframes inline per <style> Tag in der Sektion"
  - "isRecent: (badge) => diff < 7 * 24 * 60 * 60 * 1000 — identisch in Teamer + Konfi"

requirements-completed:
  - TDB-01
  - TDB-02
  - TDB-03

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 97 Plan 01: Teamer-Dashboard Polish Summary

**Teamer-Dashboard Zertifikate auf Lila (#7c3aed), Badge-Sektion mit sichtbaren + geheimen Badges und Neu-Markierung (gruener Ring + !-Badge) 1:1 wie Konfi-Dashboard**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-25T00:29:42Z
- **Completed:** 2026-03-25T00:33:01Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Zertifikate-Card Gradient von Rosa (#e11d48/#be185d) auf Lila (#7c3aed/#6d28d9) geaendert
- Losung-Config verifiziert: `show_losung !== false` — Default ist sichtbar (kein Fix noetig)
- Badge-Sektion vollstaendig ueberarbeitet: zweiter useOfflineQuery fuer /teamer/badges, sichtbare und geheime Badges mit Neu-Markierung (gruener Ring + !-Kreis fuer Badges < 7 Tage) und Popover bei Klick

## Task Commits

1. **Task 1: Zertifikate Lila + Losung Config-Check** - `7d1b565` (feat)
2. **Task 2: Badge-Sektion 1:1 wie Konfi-Dashboard + Neu-Markierung** - `042bb24` (feat)

## Files Created/Modified

- `/Users/simonluthe/Documents/Konfipoints/frontend/src/components/teamer/pages/TeamerDashboardPage.tsx` — Lila Gradient, allTeamerBadges Query, TeamerBadgeFull Interface, getBadgeColor, BadgePopoverContent, neue Badge-Sektion mit Konfi-Pattern

## Decisions Made

- Separate `BadgePopoverContent` Komponente statt Import von `DashboardBadgePopoverContent` aus DashboardSections — Teamer-Badge hat anderen Typ als Konfi-Badge, separater Popover ist sauberer
- `/teamer/badges` Endpoint parallel zum Dashboard-Query laden — `dashboardData.badges` liefert nur Counts und `recent`, nicht alle Badges mit earned-Status
- `isRecent` Logik inline in TeamerDashboardPage statt Extraktion in Utility — konsistent mit Konfi-Dashboard Pattern

## Deviations from Plan

Keine — Plan wurde exakt wie beschrieben ausgefuehrt.

## Issues Encountered

Keine.

## User Setup Required

Keine — keine externen Dienste konfiguriert.

## Next Phase Readiness

- Teamer-Dashboard polish abgeschlossen (TDB-01, TDB-02, TDB-03)
- Plan 02 (TEV-01-04): Events Suchleiste, MaterialModal, Anwesenheits-Buttons, Material-Tab Beschreibung

---
*Phase: 97-teamer-ui*
*Completed: 2026-03-25*
