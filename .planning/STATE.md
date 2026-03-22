---
gsd_state_version: 1.0
milestone: v2.4
milestone_name: Codebase-Cleanup
status: unknown
stopped_at: Completed 81-02-PLAN.md
last_updated: "2026-03-22T22:07:42.953Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung
**Current focus:** Phase 81 — react-router-migration

## Current Position

Phase: 82
Plan: Not started

## Accumulated Context

### Decisions

- v2.4: 5 Phasen fuer Cleanup-Arbeit (81-85), kein neues Feature-Work
- v2.3: Renderer-Map Pattern, html-to-image statt html2canvas, deterministische Seeds
- [Phase 81-react-router-migration]: useIonRouter statt useHistory: Ionic 8 verwaltet Tab-History-Stack korrekt nur ueber useIonRouter
- [Phase 81-react-router-migration]: history.replace → router.push(path, 'root', 'replace'): Semantisch aequivalent fuer Stack-Reset nach Login
- [Phase 81-react-router-migration]: canGoBack()-Check in KonfiEventDetailPage: Fallback auf /konfi/events wenn kein History-Stack
- [Phase 81]: useIonRouter.push hat kein State-Parameter (AnimationBuilder statt State) - useHistory fuer State-Uebergabe in TeamerDashboardPage behalten
- [Phase 81]: Wrapper-Komponenten-Pattern in MainTabs: KonfiDetailRoute, AdminEventDetailRoute, AdminChatRoomRoute, TeamerChatRoomRoute, KonfiChatRoomRoute mit useIonRouter.goBack

### Pending Todos

- v3.0 Onboarding + Landing geplant (nach v2.4)

### Blockers/Concerns

- Phase 81 (React Router): Ionic-Routing-Pattern muss nach Migration identisch bleiben — Regressionsgefahr
- Phase 84 (Schema-Hygiene): CLN-08 (activity_requests.konfi_id umbenennen) erfordert Migration + alle Query-Stellen anpassen

## Session Continuity

Last session: 2026-03-22T21:30:47.533Z
Stopped at: Completed 81-02-PLAN.md
Resume file: None
