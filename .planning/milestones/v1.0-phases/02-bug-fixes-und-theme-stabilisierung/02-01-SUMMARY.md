---
phase: 02-bug-fixes-und-theme-stabilisierung
plan: 01
subsystem: ui
tags: [ionic, ios26, md3, css, theme, tabbar]

# Dependency graph
requires:
  - phase: 01-security-hardening
    provides: Stabile Backend-Grundlage fuer Frontend-Arbeit
provides:
  - TabBar ohne registerTabBarEffect JS-Code (CSS-only)
  - Verstaerkter backdrop-filter fuer iOS 26 TabBar
  - Android-Gradient-Neutralisierung fuer iOS26-Library
  - Verifizierte Theme-Isolation zwischen iOS26 und MD3
affects: [02-02, design-system]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CSS-only TabBar statt JS-basiertem registerTabBarEffect"
    - "Platform-scoped Overrides (.md/.ios) fuer Theme-Isolation"

key-files:
  created: []
  modified:
    - frontend/src/components/layout/MainTabs.tsx
    - frontend/src/theme/variables.css

key-decisions:
  - "registerTabBarEffect komplett entfernt statt gepatcht -- CSS-only Ansatz der Library funktioniert korrekt fuer 6+ Tabs"
  - "backdrop-filter auf blur(20px) saturate(180%) verstaerkt fuer realistischeren Glass-Effekt"
  - "Android-Gradient-Fix mit !important -- korrekt weil Library-Regel auf falscher Plattform deaktiviert wird"
  - "Theme-Variable-Namespaces als konfliktfrei verifiziert (--ios26-* vs --token-*)"

patterns-established:
  - "Platform-scoped CSS-Overrides: .md/.ios Klassen nutzen um Library-Regeln plattformspezifisch zu kontrollieren"

requirements-completed: [BUG-01, THM-01, THM-02, THM-03, THM-04]

# Metrics
duration: 2min
completed: 2026-03-01
---

# Phase 02 Plan 01: TabBar-Fix und Theme-Isolation Summary

**registerTabBarEffect JS-Code entfernt, iOS TabBar Blur auf blur(20px) verstaerkt, iOS26 unscoped Content-Gradienten auf Android neutralisiert**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-01T12:48:54Z
- **Completed:** 2026-03-01T12:50:45Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- registerTabBarEffect und zugehoeriger useRef/useEffect komplett aus MainTabs.tsx entfernt
- Verstaerkter backdrop-filter blur(20px) saturate(180%) fuer nativen iOS 26 Glass-Effekt
- 3 unscoped iOS26 ion-content-Gradient-Regeln auf Android (.md) neutralisiert
- Theme-Variable-Namespaces und CSS-Import-Reihenfolge als korrekt verifiziert
- TypeScript-Check und Vite-Build erfolgreich

## Task Commits

Jeder Task wurde atomar committed:

1. **Task 1: registerTabBarEffect entfernen und optionalen iOS-Blur verstaerken** - `fe1131f` (fix)
2. **Task 2: Theme-Isolation verifizieren und unscoped iOS26-Regeln auf Android neutralisieren** - `3d553f6` (fix)

## Files Created/Modified
- `frontend/src/components/layout/MainTabs.tsx` - registerTabBarEffect Import, useRef und useEffect entfernt
- `frontend/src/theme/variables.css` - iOS TabBar Blur verstaerkt, Android Content-Gradient-Fix hinzugefuegt

## Decisions Made
- registerTabBarEffect komplett entfernt statt gepatcht -- die CSS-only Styles der Library (Floating TabBar, abgerundete Ecken, Press-Animation) funktionieren korrekt fuer 6+ Tabs
- backdrop-filter auf blur(20px) saturate(180%) gesetzt (Library-Standard: blur(2px) saturate(360%)) fuer realistischeren nativen iOS 26 Look
- Android-Gradient-Fix mit !important -- korrekt weil eine Library-Regel auf einer Plattform deaktiviert werden muss, auf der sie nie greifen sollte
- Theme-Variable-Namespaces als konfliktfrei verifiziert: iOS26 nutzt --ios26-* Prefix, MD3 nutzt --token-* Prefix
- CSS-Import-Reihenfolge verifiziert: iOS26 vor MD3, korrekt da Selektoren verschiedene Plattform-Klassen nutzen

## Deviations from Plan

None - Plan exakt wie geschrieben ausgefuehrt.

## Issues Encountered
None

## User Setup Required
None - keine externe Konfiguration noetig.

## Next Phase Readiness
- TabBar funktioniert jetzt CSS-only auf iOS mit 6 Tabs
- Theme-Isolation zwischen iOS26 und MD3 ist verifiziert und abgesichert
- Bereit fuer Plan 02-02 (weitere Bug-Fixes und Theme-Stabilisierung)

---
*Phase: 02-bug-fixes-und-theme-stabilisierung*
*Completed: 2026-03-01*

## Self-Check: PASSED
- All files exist (MainTabs.tsx, variables.css, 02-01-SUMMARY.md)
- All commits verified (fe1131f, 3d553f6)
