---
phase: 32-punkte-ui-frontend
plan: 02
subsystem: ui
tags: [react, ionic, typescript, postgresql, admin-views]

requires:
  - phase: 32-01
    provides: ActivityRings mit enabled-Props
  - phase: 31-01
    provides: Punkte-Typ-Guard im Backend
  - phase: 30-01
    provides: Jahrgang-Config-Spalten in DB

provides:
  - KonfisView bedingte Progress-Bars pro Jahrgang-Config
  - KonfiDetailView ausgegraut-Pattern fuer deaktivierte Typen
  - Backend Konfi-Queries mit Jahrgang-Config-Spalten

affects: [33-punkte-ui-tests]

tech-stack:
  added: []
  patterns: [ausgegraut-pattern-deaktivierte-typen, pro-jahrgang-targets-statt-global]

key-files:
  created: []
  modified:
    - backend/routes/konfi-managment.js
    - frontend/src/components/admin/KonfisView.tsx
    - frontend/src/components/admin/views/KonfiDetailView.tsx

key-decisions:
  - "Pro-Konfi Targets direkt aus Backend-Response statt globalem Settings-Abruf"
  - "Deaktivierte Typen: opacity 0.4 + grayscale(100%) + (deaktiviert) Label"
  - "loadSettings() in KonfiDetailView komplett entfernt"

patterns-established:
  - "Ausgegraut-Pattern: opacity 0.4, filter grayscale(100%), (deaktiviert) Label fuer deaktivierte Punkte-Typen"
  - "Pro-Jahrgang-Targets: konfi.target_gottesdienst statt settings.target_gottesdienst"

requirements-completed: [PUI-02, PUI-05]

duration: 8min
completed: 2026-03-08
---

# Phase 32 Plan 02: Admin-Views Punkte-Typ-Config Summary

**Admin KonfisView mit bedingten Progress-Bars pro Jahrgang und KonfiDetailView mit ausgegrautem Muster fuer deaktivierte Punkte-Typen**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-08T07:17:03Z
- **Completed:** 2026-03-08T07:25:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Backend Konfi-Queries (Liste + Detail) liefern Jahrgang-Config-Spalten mit
- KonfisView zeigt Progress-Bars nur fuer aktive Punkte-Typen mit pro-Jahrgang Targets
- KonfiDetailView zeigt deaktivierte Typen in Bonus/Events/Aktivitaeten ausgegraut mit "(deaktiviert)" Label
- ActivityRings nutzt enabled-Flags und Targets direkt aus Konfi-Response
- Globaler Settings-Abruf fuer Punkte-Targets in KonfiDetailView entfernt

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend Konfi-Detail + Liste mit Jahrgang-Config erweitern** - `2c66557` (feat)
2. **Task 2: KonfisView bedingte Progress-Bars + KonfiDetailView ausgegraut-Pattern** - `2209f80` (feat)

## Files Created/Modified
- `backend/routes/konfi-managment.js` - 3 SQL-Queries um gottesdienst_enabled, gemeinde_enabled, target_gottesdienst, target_gemeinde erweitert
- `frontend/src/components/admin/KonfisView.tsx` - Bedingte Progress-Bars, pro-Jahrgang Targets, globale target-Variablen entfernt
- `frontend/src/components/admin/views/KonfiDetailView.tsx` - loadSettings entfernt, ActivityRings mit enabled-Props, ausgegraut-Pattern fuer Bonus/Events/Aktivitaeten

## Decisions Made
- Pro-Konfi Targets direkt aus Backend-Response statt globalem Settings-Abruf (ein API-Call weniger)
- Deaktivierte Typen: opacity 0.4 + grayscale(100%) + "(deaktiviert)" Label - konsistentes Pattern fuer alle Listen
- loadSettings() in KonfiDetailView komplett entfernt, da Targets jetzt pro Konfi aus Jahrgang kommen

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 32 (Punkte-UI Frontend) komplett abgeschlossen
- Alle Admin-Views reagieren korrekt auf Jahrgang-Config
- Bereit fuer Phase 33 (Tests/Verifikation)

---
*Phase: 32-punkte-ui-frontend*
*Completed: 2026-03-08*
