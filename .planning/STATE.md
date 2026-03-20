---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: App-Resilienz
status: defining
stopped_at: Defining requirements
last_updated: "2026-03-20"
last_activity: 2026-03-20 — Milestone v2.1 gestartet, Requirements definiert (99 Requirements)
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung
**Current focus:** v2.1 App-Resilienz — Offline-Cache, Schreib-Queue, Retry-Logik

## Current Position

Phase: Not started (creating roadmap)
Plan: —
Status: Creating roadmap
Last activity: 2026-03-20 — Milestone v2.1 gestartet

Progress: [░░░░░░░░░░] 0%

## Accumulated Context

### Decisions

All v1.0-v1.9 decisions archived in PROJECT.md Key Decisions table.
- Queue-Scope erweitert: Nicht nur Chat + Antraege, sondern auch Admin-CRUD (Events, Aktivitaeten, Badges, Kategorien, Jahrgaenge, Level, Zertifikate, Material)
- Kein globales Offline-Banner, stattdessen kontextbezogene UI (Corner-Badge Uhr-Icon, Button-Text "Du bist offline")
- Corner-Badge System: Flex-Container mit korrekten Rundungen fuer 1-3 Badges nebeneinander (Referenz: PointsHistoryModal)
- Material mit Dateien in Queue: Metadaten + Datei-Referenz in Queue, Datei lokal in Capacitor Filesystem, Upload nur im Vordergrund
- Bonus-Punkte vergeben in Queue (QUE-A20), aber normale Punkte-Vergabe bleibt online-only (Server-Autoritaet)
- Teamer kann Events offline buchen/abmelden (anders als Konfi, da Teamer keine Kapazitaetspruefung braucht)

### Roadmap Evolution

None yet.

### Pending Todos

- v3.0 Milestone geplant: Onboarding, Landing Website mit Erklaerung, Readme Github, Wiki — letzter Schritt vor oeffentlichem Launch.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-03-20
Stopped at: Creating roadmap for v2.1
Resume file: None
