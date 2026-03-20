---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: App-Resilienz
status: unknown
stopped_at: Completed 55-02-PLAN.md (localStorage-Migration)
last_updated: "2026-03-20T20:53:15.628Z"
progress:
  total_phases: 14
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung
**Current focus:** Phase 55 — Fundament

## Current Position

Phase: 55 (Fundament) — EXECUTING
Plan: 4 of 4

## Accumulated Context

### Decisions

All v1.0-v1.9 decisions archived in PROJECT.md Key Decisions table.

- Queue-Scope erweitert: Nicht nur Chat + Antraege, sondern auch Admin-CRUD (Events, Aktivitaeten, Badges, Kategorien, Jahrgaenge, Level, Zertifikate, Material)
- Kein globales Offline-Banner, stattdessen kontextbezogene UI (Corner-Badge Uhr-Icon, Button-Text "Du bist offline")
- Corner-Badge System: Flex-Container mit korrekten Rundungen fuer 1-3 Badges nebeneinander (Referenz: PointsHistoryModal)
- Material mit Dateien in Queue: Metadaten + Datei-Referenz in Queue, Datei lokal in Capacitor Filesystem, Upload nur im Vordergrund
- Teamer kann Events offline buchen/abmelden (anders als Konfi, da Teamer keine Kapazitaetspruefung braucht)
- [Phase 55]: Debounce 300ms fuer Netzwerkwechsel, Web-Fallback mit navigator.onLine, optimistischer Start (_isOnline = true)
- [Phase 55]: TokenStore Pattern: sync Memory-Getter + async Preferences-Setter fuer Axios-Interceptor Kompatibilitaet
- [Phase 55]: LIMIT 200 als Sicherheitsgrenze fuer ?after Chat-Queries
- [Phase 55]: Alias-Import setTokenStoreUser um Namenskollision mit AppContext setUser zu vermeiden

### Roadmap Evolution

- 2026-03-20: v2.1 Roadmap erstellt — 8 Phasen (55-62), 122 Requirements, Dependency Chain STR+NET -> CAC -> RET -> OUI+OOA -> QUE+SYN
- Phase 63 added: Codebase Cleanup — Quick-Wins, Konsolidierung, Bug-Fixes
- Phase 64 added: DB-Schema-Konsolidierung — Einheitliches Schema, Altlasten, Indizes, Foreign Keys
- Phase 65 added: Navigation und State-Konsistenz — Router-Migration, CustomEvents → LiveUpdateContext
- Phase 66 added: Error Boundary und Sicherheitshärtung
- Phase 67 added: Performance-Optimierung — Mega-Komponenten, Memoization, SELECT *, BackgroundService
- Phase 68 added: Token-Refresh-System
- Phase 69 added: Dependency-Upgrades — react-router-dom v6, qr-scanner native

### Pending Todos

- v3.0 Milestone geplant: Onboarding, Landing Website, Readme, Wiki

### Blockers/Concerns

- Research Flag: Phase 60 (Queue) — Socket.io + HTTP-Idempotency-Interaktion pruefen
- Research Flag: Phase 62 (Sync) — updated_at Felder auf DB-Tabellen pruefen

## Session Continuity

Last session: 2026-03-20T20:53:15.625Z
Stopped at: Completed 55-02-PLAN.md (localStorage-Migration)
Resume file: None
