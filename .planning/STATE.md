---
gsd_state_version: 1.0
milestone: v2.4
milestone_name: Codebase-Cleanup
status: unknown
stopped_at: Completed 82-03-PLAN.md
last_updated: "2026-03-22T22:17:29.796Z"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 6
  completed_plans: 6
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung
**Current focus:** Phase 82 — backend-sicherheit-cron

## Current Position

Phase: 83
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
- [Phase 82]: Fallback-Wert mit TODO-Kommentar behalten bis LOSUNG_API_KEY in Portainer-Stack gesetzt ist
- [Phase 82-backend-sicherheit-cron]: Socket.IO joinRoom: db require nach oben verschoben + async Handler mit chat_rooms Organization-Isolation-Check
- [Phase 82-backend-sicherheit-cron]: node-cron statt setInterval fuer Wrapped-Cron: kalendarisch korrekte Ausfuehrung nach Container-Neustart, kein Drift mehr

### Pending Todos

- v3.0 Onboarding + Landing geplant (nach v2.4)

### Blockers/Concerns

- Phase 81 (React Router): Ionic-Routing-Pattern muss nach Migration identisch bleiben — Regressionsgefahr
- Phase 84 (Schema-Hygiene): CLN-08 (activity_requests.konfi_id umbenennen) erfordert Migration + alle Query-Stellen anpassen

## Session Continuity

Last session: 2026-03-22T22:14:52.992Z
Stopped at: Completed 82-03-PLAN.md
Resume file: None
