---
gsd_state_version: 1.0
milestone: v2.12
milestone_name: Konfirmation + Konfispruch
status: Awaiting next milestone
last_updated: "2026-06-10T09:30:58.854Z"
last_activity: 2026-06-10 — Milestone v2.12 completed and archived
progress:
  total_phases: 18
  completed_phases: 17
  total_plans: 44
  completed_plans: 46
  percent: 94
---

## Deferred Items

Items acknowledged and deferred at milestone close on 2026-06-10 (alle vom v2.12-Milestone-Audit als nicht-blockierend eingestuft):

| Category | Item | Status |
|----------|------|--------|
| uat_gap | 118-HUMAN-UAT | partial (0 pending) |
| uat_gap | 119-HUMAN-UAT (7 Xcode-Sichtchecks) | partial |
| verification_gap | 118-VERIFICATION | human_needed |
| verification_gap | 119-VERIFICATION | human_needed |
| verification_gap | 103-VERIFICATION (fremder Scope, nicht v2.12) | human_needed |
| verification_gap | 105-VERIFICATION (fremder Scope, nicht v2.12) | gaps_found |
| verification_gap | 107-VERIFICATION (fremder Scope, nicht v2.12) | human_needed |
| quick_task | 1-ui-fixes-checkboxen-umrandungen-farben-u | missing |
| quick_task | 2-konfieventspage-tsx-typescript-interface | missing |
| quick_task | 260324-k6j-github-readme-aktualisieren | missing |
| quick_task | 260324-lt3-6-sicherheits-und-cleanup-fixes | missing |
| quick_task | 260324-o5r-super-admin-useofflinequery-collapsible | missing |
| quick_task | 260325-t3v-konfi-dashboard-events-card-wie-teamer | missing |
| quick_task | 260326-ak9-punkte-uebersicht-stat-bubbles-wie-badge | missing |
| quick_task | 3-ui-fixes-levelmanagementmodal-backdrop-p | missing |
| quick_task | 4-material-ui-fixes-admin-teamer-events-ch | missing |
| quick_task | 5-chat-dateien-bilder-in-app-fileviewer-st | missing |
| quick_task | 6-teamer-material-ui-korrekturen-corner-ba | missing |

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-24)

**Core value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung
**Current focus:** Milestone complete

- **Phase 117 (Konfirmations-Flag): FERTIG + LIVE auf Prod** (commit 30e0c45, Migration 091+092 angewandt, is_konfirmation-Spalte da, Konfirmation-Kategorie bereinigt). OFFEN: nur visueller Human-Verify im App-Build (Toggle/lila/Corner-Badge) + ROADMAP-Plans abhaken.
- **Phase 118 (Konfispruch-Datenmodell + Auswahl): GEPLANT, NICHT gebaut** (Plans 118-01/118-02 committet 842ad1c). Naechster Schritt frische Session: /gsd:execute-phase 118. Vers-Referenzen liegen in .planning/phases/118-spruch-referenzen.md (~32, NUR Stellenangaben — Uebersetzungstexte traegt User lizenziert nach, NICHT erfinden).
- **Phase 119 (Konfispruch-Integration + Jahrgang-Steuerzentrale): GEPLANT (6 Plans, verifiziert PASS, commit d065cdd), NICHT gebaut.** Naechster Schritt: /gsd:execute-phase 119.

Requirements: REQUIREMENTS.md (KONF-01..08 erfuellt, SPRUCH-01..11 offen).

## Current Position

Phase: Milestone v2.12 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-06-10 — Milestone v2.12 completed and archived

## Performance Metrics

| Metric | Value |
|--------|-------|
| Requirements total | 64 |
| Requirements mapped | 64 |
| Phases planned | 7 |
| Phases completed | 0 |
| Plans completed | 0 |
| Phase 94-globale-ui-patterns P01 | 10 | 2 tasks | 8 files |
| Phase 95 P01 | 134 | 2 tasks | 4 files |
| Phase 95-chat-farbschema-korrekturen P03 | 12 | 1 tasks | 3 files |
| Phase 95-chat-farbschema-korrekturen P02 | 15 | 2 tasks | 4 files |
| Phase 96-konfi-ui P01 | 8 | 2 tasks | 2 files |
| Phase 96-konfi-ui P03 | 5 | 3 tasks | 4 files |
| Phase 96-konfi-ui P02 | 2 | 2 tasks | 2 files |
| Phase 96-konfi-ui P04 | 131 | 2 tasks | 1 files |
| Phase 97-teamer-ui P02 | 5 | 2 tasks | 3 files |
| Phase 97-teamer-ui P01 | 3 | 2 tasks | 1 files |
| Phase 98 P03 | 1 | 2 tasks | 2 files |
| Phase 98 P01 | 2 | 2 tasks | 3 files |
| Phase 98 P02 | 3 | 2 tasks | 2 files |
| Phase 99 P03 | 2 | 2 tasks | 3 files |
| Phase 99 P01 | 4 | 2 tasks | 4 files |
| Phase 99 P02 | 4 | 2 tasks | 3 files |
| Phase 100 P02 | 2 | 2 tasks | 2 files |
| Phase 100 P01 | 2 | 2 tasks | 2 files |
| Phase 100 P03 | 8 | 2 tasks | 7 files |
| Phase 111 P01 | 2 | 1 tasks | 1 files |
| Phase 111 P02 | 1 | 1 tasks | 2 files |

## Accumulated Context

Alle v1.0-v2.7 Entscheidungen in PROJECT.md und milestones/ archiviert.

### Phase-Uebersicht v2.8

| Phase | Requirements | Inhalt |
|-------|-------------|--------|
| 94 | AUI-01, AUI-02 | Globale UI-Patterns (Slider, Listen-Abstand) |
| 95 | TCH-01-04, KCH-01, ACH-01-06 | Chat-Farbschema + Korrekturen |
| 96 | KDB-01-02, KEV-01-03, KBD-01-03, KAK-01, KHI-01-02, KPR-01-02 | Konfi UI |
| 97 | TDB-01-03, TEV-01-04 | Teamer UI |
| 98 | AAK-01-05, ATD-01, AAN-01-02, APR-01-02, AJG-01 | Admin Teil 1 |
| 99 | AEV-01-08, ABG-01-02 | Admin Events + Bugs |
| 100 | AZE-01-04, AMA-01-04, ADA-01-02 | Admin Teil 2 |

### Pending Todos

- v3.0 Onboarding + Landing geplant (nach v2.8)

### Blockers/Concerns

(keine)

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260324-k6j | GitHub README mit allen 17 Milestones | 2026-03-24 | 38fede8 | [260324-k6j](./quick/260324-k6j-github-readme-aktualisieren-mit-allen-17/) |
| 260324-lt3 | 6 Sicherheits- und Cleanup-Fixes | 2026-03-24 | 86104ae | [260324-lt3](./quick/260324-lt3-6-sicherheits-und-cleanup-fixes/) |

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
