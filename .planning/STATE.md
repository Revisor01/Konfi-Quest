---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Push-Notifications
status: unknown
last_updated: "2026-03-06T10:02:23.548Z"
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 5
  completed_plans: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-05)

**Core value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung
**Current focus:** v1.5 Push-Notifications — Phase 27 complete

## Current Position

Phase: 27 of 29 (Badge-Count-Single-Source-of-Truth)
Plan: 2 of 2
Status: Phase 27 complete
Last activity: 2026-03-06 — Phase 27 Plan 02 (backgroundService Badge-Query) ausgefuehrt

Progress: [####░░░░░░] 40%

## Performance Metrics

**Velocity:**
- Total plans completed: 58 (v1.0-v1.4 + 25-01 + 26-01 + 26-02)
- Average duration: --
- Total execution time: --

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 25    | 01   | 1min     | 3     | 4     |
| 26    | 01   | 1min     | 2     | 1     |
| 26    | 02   | 2min     | 2     | 2     |
| 27    | 01   | 5min     | 2     | 6     |
| 27    | 02   | 1min     | 1     | 1     |

## Accumulated Context

### Decisions

All v1.0-v1.4 decisions archived in PROJECT.md Key Decisions table.

- [25-01] Push-Type Registry als Kommentar-Block in pushService.js statt separatem Config-File
- [25-01] Migration idempotent mit IF NOT EXISTS fuer sichere Wiederholbarkeit
- [26-01] Error-Handling direkt in sendToUser/sendChatNotification statt separate Methode
- [26-01] Zwei fatale Firebase-Codes fuer sofortige Token-Loeschung: registration-token-not-registered, invalid-registration-token
- [26-02] localStorage-Key umbenannt zu 'push_token_last_refresh' per CONTEXT.md Konvention
- [26-02] Logout loescht nur Token des aktuellen Devices (TKN-01 verifiziert)
- [26-02] User-Wechsel-Logik im Backend bereits korrekt (TKN-04 verifiziert)
- [Phase 27]: BadgeContext refreshAllCounts mit Promise.all fuer parallele API-Calls
- [Phase 27]: markRoomAsRead optimistisch + API im Hintergrund
- [Phase 27]: totalBadgeCount role-abhaengig: Admin=chat+requests+events, Konfi=nur chat
- [27-02] chat_read_status statt cp.last_read_at fuer konsistente Unread-Berechnung im backgroundService
- [27-02] activities.organization_id fuer pending_requests Filterung (konsistent mit activities.js)

### Research Findings (v1.5)

- sendLevelUpToKonfi() existiert aber wird nie aufgerufen
- Badge-Count wird von 4 unabhaengigen Systemen verwaltet (BadgeContext, AppContext, PushService, Capacitor Badge)
- event_reminders Tabelle wird referenziert aber existiert moeglicherweise nicht
- APNS Silent Push Header falsch konfiguriert (alert statt background)
- Push-Listener in AppContext akkumulieren ohne Cleanup
- Nur 1 neue Dependency noetig: node-cron

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-06
Stopped at: Completed 27-02-PLAN.md
Resume file: .planning/phases/27-badge-count-single-source-of-truth/27-02-SUMMARY.md
