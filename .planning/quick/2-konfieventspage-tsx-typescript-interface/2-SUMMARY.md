---
phase: quick-2
plan: 1
subsystem: frontend/events
tags: [typescript, interface, v1.7]
key-files:
  modified:
    - frontend/src/components/konfi/pages/KonfiEventsPage.tsx
decisions: []
metrics:
  duration: 32s
  completed: "2026-03-09T20:03:43Z"
---

# Quick Task 2: KonfiEventsPage.tsx Event-Interface v1.7 Felder

Event-Interface in KonfiEventsPage.tsx um 8 fehlende v1.7-Felder und opted_out booking_status ergaenzt.

## Tasks

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Event-Interface um fehlende v1.7 Felder ergaenzen | b090734 | Erledigt |

## Aenderungen

Das Event-Interface in `KonfiEventsPage.tsx` wurde um folgende Felder erweitert:
- `booking_status` Union: `'opted_out'` hinzugefuegt
- `mandatory?: boolean` -- Pflicht-Event Flag
- `bring_items?: string` -- Mitbring-Items
- `is_opted_out?: boolean` -- Opt-out Status
- `point_type?: 'gottesdienst' | 'gemeinde'` -- Punkte-Typ
- `has_timeslots?: boolean` -- Timeslot-Flag
- `booked_timeslot_id?: number` -- Gebuchter Timeslot ID
- `booked_timeslot_start?: string` -- Timeslot Start
- `booked_timeslot_end?: string` -- Timeslot Ende

Das Interface ist jetzt ein Superset der Interfaces in EventsView.tsx und EventDetailView.tsx.

## Deviations from Plan

None -- Plan exakt wie geschrieben ausgefuehrt.

## Verification

- TypeScript-Kompilierung (`npx tsc --noEmit`): Erfolgreich, keine Fehler
- Kein funktionales Verhalten geaendert (nur Interface-Erweiterung)
