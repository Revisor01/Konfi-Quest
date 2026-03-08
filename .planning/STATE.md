---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: Dashboard-Konfig + Punkte-Logik
status: in-progress
last_updated: "2026-03-08T07:25:57Z"
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 14
  completed_plans: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-07)

**Core value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung
**Current focus:** v1.6 Phase 32 complete - ready for Phase 33

## Current Position

Phase: 32 of 33 (Punkte-UI Frontend)
Plan: 2 of 2 in current phase (32-02 done)
Status: Phase 32 complete
Last activity: 2026-03-08 -- Plan 32-02 (Admin-Views Punkte-Typ-Config) abgeschlossen

Progress: [==========] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 64 (v1.0-v1.5 + 30-01)
- Average duration: ~15 min
- Total execution time: ~15.9 hours

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 30    | 01   | 5min     | 2     | 3     |
| 30    | 02   | 3min     | 2     | 4     |
| 31    | 01   | 2min     | 2     | 5     |
| 31    | 02   | 4min     | 2     | 2     |
| 32    | 01   | 5min     | 2     | 4     |
| 32    | 02   | 8min     | 2     | 3     |

## Accumulated Context

### Decisions

All v1.0-v1.5 decisions archived in PROJECT.md Key Decisions table.
v1.6 Entscheidungen:
- Punkte bleiben in DB bei Deaktivierung, werden in UI/Ranking ausgeblendet
- Punkte-Typ-Config als Boolean-Spalten auf jahrgaenge-Tabelle
- Punkteziele (target) von org-weit auf pro Jahrgang verschoben (Default 10)
- Altes Punkte-Settings-UI komplett entfernen
- Dashboard-Widget-Toggles in settings-Tabelle (Key-Value)
- Ranking summiert nur aktive Punkte-Typen
- both_categories Badge: nur aktive Typen muessen Kriterium erfuellen
- [Phase 30]: Punkte-Typ-Config als Spalten auf jahrgaenge-Tabelle, target-Werte automatisch migriert
- [Phase 30]: Dashboard-Widget-Toggles als Key-Value in settings mit Default true, alte target_* Keys entfernt
- [Phase 30-02]: Dashboard-Widget-Toggles nur fuer org_admin sichtbar
- [Phase 30-02]: Optimistisches Update mit Revert bei API-Fehler fuer Dashboard-Toggles
- [Phase 30-02]: Punkte-Ziel-Inputs bedingt gerendert (nur wenn jeweiliger Typ enabled)
- [Phase 31-01]: Guard gibt 400 zurueck bei deaktiviertem Punkte-Typ, nicht 403
- [Phase 31-01]: Event-Attendance Guard rollt Transaction zurueck bei deaktiviertem Typ
- [Phase 31-01]: Warnung bei Deaktivierung ist Info-only (200 mit warnings-Array)
- [Phase 31-02]: Jahrgang-Config wird pro checkAndAwardBadges-Aufruf geladen
- [Phase 31-02]: Badge-Progress-Queries ebenfalls an aktive Typen angepasst (Deviation)
- [Phase 32-01]: ActivityRings enabled-Props default true via !== false Check
- [Phase 32-01]: Bei 1 aktivem Typ einzelner Ring auf aeusserem Radius
- [Phase 32-01]: Settings-API-Aufruf entfernt, point_config aus Dashboard-Response
- [Phase 32-02]: Pro-Konfi Targets aus Backend-Response statt globalem Settings-Abruf
- [Phase 32-02]: Deaktivierte Typen: opacity 0.4 + grayscale(100%) + (deaktiviert) Label
- [Phase 32-02]: loadSettings() in KonfiDetailView entfernt

### Pending Todos

None.

### Blockers/Concerns

- Ranking-Entscheidung getroffen: nur aktive Typen zaehlen (alte Punkte bleiben in DB aber zaehlen nicht im Ranking)
- both_categories Badge-Semantik: wenn nur ein Typ aktiv, wird Kriterium uebersprungen

## Session Continuity

Last session: 2026-03-08
Stopped at: Completed 32-02-PLAN.md
Resume file: 33-01-PLAN.md
