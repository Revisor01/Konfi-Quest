---
gsd_state_version: 1.0
milestone: v2.4
milestone_name: Codebase-Cleanup
status: unknown
stopped_at: Completed 85-01-PLAN.md
last_updated: "2026-03-22T22:50:32.024Z"
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 12
  completed_plans: 11
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung
**Current focus:** Phase 85 — code-cleanup

## Current Position

Phase: 85 (code-cleanup) — EXECUTING
Plan: 2 of 2

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
- [Phase 83]: Chat N+1-Bulk-Queries: ANY($1::int[]) Pattern fuer Reactions und Poll-Votes, max. 3 DB-Queries statt bis zu 400
- [Phase 83-performance-capacitor]: registerPlugin-Pattern fuer native Capacitor-Plugins ohne npm-Paket statt (window as any).Capacitor.Plugins
- [Phase 83-performance-capacitor]: Modul-Level-Variablen statt window-Properties fuer FCM Anti-Spam-State
- [Phase 84]: Migration-Runner ohne State-Tracking: alle .sql Dateien sind idempotent, kein Tracking noetig
- [Phase 84]: Fail-fast bei Migration-Fehler: Server startet nicht wenn .sql fehlschlaegt
- [Phase 84-schema-hygiene]: Inline-Migrations-Funktionen vollstaendig loeschen statt auskommentieren: sauberer Schnitt, kein totes Code-Rauschen
- [Phase 85-code-cleanup]: SMTP_SECURE: !== 'false' statt === 'true' || true — konsistent mit emailService.js Pattern

### Pending Todos

- v3.0 Onboarding + Landing geplant (nach v2.4)

### Blockers/Concerns

- Phase 81 (React Router): Ionic-Routing-Pattern muss nach Migration identisch bleiben — Regressionsgefahr
- Phase 84 (Schema-Hygiene): CLN-08 (activity_requests.konfi_id umbenennen) erfordert Migration + alle Query-Stellen anpassen

## Session Continuity

Last session: 2026-03-22T22:50:32.021Z
Stopped at: Completed 85-01-PLAN.md
Resume file: None
