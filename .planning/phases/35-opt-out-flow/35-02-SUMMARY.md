---
phase: 35-opt-out-flow
plan: 02
subsystem: ui
tags: [react, ionic, typescript, event-booking, opt-out]

requires:
  - phase: 35-opt-out-flow
    plan: 01
    provides: "Opt-out/Opt-in API Endpoints, is_opted_out Feld, opt_out_reason in Participants"
provides:
  - "UnregisterModal mit mandatory-Prop und 5-Zeichen-Validierung"
  - "Konfi-EventDetailView mit Opt-out/Opt-in Buttons und Status-Anzeige"
  - "Konfi-EventsView mit roter Markierung bei opted_out Events"
  - "Admin-EventDetailView mit opted_out Badge, Begruendung und X/Y Zaehler"
affects: [frontend-events]

tech-stack:
  added: []
  patterns: ["Opt-out/Opt-in UI-Flow mit useIonModal und mandatory-Prop"]

key-files:
  created: []
  modified:
    - frontend/src/components/konfi/modals/UnregisterModal.tsx
    - frontend/src/components/konfi/views/EventDetailView.tsx
    - frontend/src/components/konfi/views/EventsView.tsx
    - frontend/src/components/admin/views/EventDetailView.tsx

key-decisions:
  - "Separater useIonModal-Hook fuer Opt-out (mit mandatory=true) statt bestehenden Modal-Hook umbauen"
  - "X/Y Zaehler bei Pflicht-Events: confirmed/gesamt statt confirmed/max_participants"
  - "Opted_out Teilnehmer bleiben inline in der Teilnehmerliste (keine separate Sektion)"

patterns-established:
  - "mandatory-Prop Pattern: Modal-Verhalten ueber Props steuern statt separate Modals"
  - "Status-Prioritaet: opted_out vor allen anderen Status-Checks pruefen"

requirements-completed: [OPT-01, OPT-02]

duration: 3min
completed: 2026-03-09
---

# Phase 35 Plan 02: Opt-out Frontend UI Summary

**Vollstaendiger Opt-out/Opt-in UI-Flow mit mandatory-Modal, Konfi-Status-Anzeige, Event-Listen-Markierung und Admin-Teilnehmer-Darstellung**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T17:28:10Z
- **Completed:** 2026-03-09T17:32:09Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- UnregisterModal mit mandatory-Prop: Hinweis-Text, 5-Zeichen-Mindestlaenge, Zeichenzaehler
- Konfi-EventDetailView: Opt-out Button bei Pflicht-Events, roter Status-Text bei Abmeldung, gruener Wieder-anmelden-Button
- Konfi-EventsView: opted_out Events mit rotem Badge "Abgemeldet" und closeCircle Icon
- Admin-EventDetailView: opted_out Teilnehmer mit rotem Badge, Begruendung unter dem Namen, X/Y Teilnehmer-Zaehler

## Task Commits

Each task was committed atomically:

1. **Task 1: UnregisterModal erweitern + Konfi-EventDetailView Opt-out/Opt-in** - `e57e5da` (feat)
2. **Task 2: Konfi-Event-Liste + Admin-Teilnehmerliste mit Opt-out-Darstellung** - `f73b5a5` (feat)

## Files Created/Modified
- `frontend/src/components/konfi/modals/UnregisterModal.tsx` - mandatory-Prop, 5-Zeichen-Validierung, Hinweis-Text
- `frontend/src/components/konfi/views/EventDetailView.tsx` - handleOptOut/handleOptIn, Action-Area mit 3 Zustaenden
- `frontend/src/components/konfi/views/EventsView.tsx` - opted_out Status-Logik und Badge in Event-Liste
- `frontend/src/components/admin/views/EventDetailView.tsx` - opted_out Darstellung, opt_out_reason Anzeige, X/Y Zaehler

## Decisions Made
- Separater useIonModal-Hook fuer Opt-out Modal mit mandatory=true statt bestehenden Hook umbauen -- saubere Trennung
- X/Y Zaehler zeigt confirmed/gesamt (alle Bookings inkl. opted_out) -- entspricht Jahrgangs-Groesse
- Opted_out Teilnehmer bleiben inline in der bestehenden Teilnehmerliste -- konsistent, keine UI-Fragmentierung

## Deviations from Plan

None - Plan exakt wie geschrieben ausgefuehrt.

## Issues Encountered
None

## User Setup Required
None - reine Frontend-Aenderungen, keine Konfiguration erforderlich.

## Next Phase Readiness
- Opt-out-Flow (Phase 35) komplett abgeschlossen (Backend + Frontend)
- Bereit fuer Phase 36 (QR-Code Attendance)

---
*Phase: 35-opt-out-flow*
*Completed: 2026-03-09*
