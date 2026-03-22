---
gsd_state_version: 1.0
milestone: v2.3
milestone_name: Konfi + Teamer Wrapped
status: unknown
stopped_at: Completed 80-02-PLAN.md
last_updated: "2026-03-22T19:37:22.814Z"
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 11
  completed_plans: 11
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung
**Current focus:** Phase 80 — Wrapped Individualisierung

## Current Position

Phase: 80
Plan: Not started

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

## Accumulated Context

| Phase 75-backend-aggregation-db-schema P01 | 3min | 2 tasks | 3 files |
| Phase 75 P02 | 2min | 2 tasks | 5 files |
| Phase 76 P01 | 3min | 2 tasks | 7 files |
| Phase 76 P02 | 3min | 2 tasks | 6 files |
| Phase 76 P03 | 4min | 2 tasks | 6 files |
| Phase 77 P01 | 3min | 2 tasks | 9 files |
| Phase 78-share-funktion P01 | 4min | 2 tasks | 7 files |
| Phase 79 P01 | 3min | 2 tasks | 3 files |
| Phase 80 P01 | 2min | 2 tasks | 2 files |
| Phase 80 P03 | 4min | 2 tasks | 4 files |
| Phase 80 P02 | 4min | 2 tasks | 5 files |

### Decisions

All v1.0-v2.2 decisions archived in PROJECT.md and milestones/.

v2.3 Research-Entscheidungen:

- Swiper 12 fuer horizontale Slides (offiziell von Ionic empfohlen)
- html-to-image statt html2canvas (3-4x schneller, kleinerer Bundle)
- CSS @keyframes fuer Animationen (kein Framer Motion -- +50KB fuer triviale Animationen)
- Share-Cards als reines HTML/CSS (Ionic Shadow-DOM wird von html-to-image nicht zuverlaessig gerendert)
- Keine Percentil-Vergleiche mit anderen Konfis (Datenschutz Minderjaehrige)
- [Phase 75]: Wrapped JSONB v1 Schema mit 7 Konfi-Slides und 6 Teamer-Slides, UPSERT fuer Admin-Override
- [Phase 75]: Konfi has_wrapped ueber wrapped_released_at (Zeitsteuerung), Teamer has_wrapped direkt ueber wrapped_snapshots EXISTS
- [Phase 75]: wrappedRouter als options-Parameter an BackgroundService statt globalem require
- [Phase 76]: Swiper 12 mit EffectCreative fuer 3D-Slide-Uebergaenge
- [Phase 76]: SlideBase rendert Kinder nur bei isActive=true (Performance-Optimierung)
- [Phase 76]: getIconFromString aus DashboardSections re-used statt neue Helper-Funktion
- [Phase 76]: Endspurt-Slide bedingt ueber data.slides.endspurt.aktiv (7 oder 8 Slides dynamisch)
- [Phase 77]: wrappedType aus API-Response wrapped_type steuert Slide-Auswahl
- [Phase 77]: buildKonfiSlides/buildTeamerSlides als separate Funktionen
- [Phase 78]: ShareCard als reines HTML/CSS mit Inline-Styles (kein Ionic Shadow-DOM)
- [Phase 78]: handleShare als async Funktion statt useCallback (slides-Deklarationsreihenfolge)
- [Phase 79]: Wrapped-Card bleibt nach Oeffnen sichtbar (kein dismissed State)
- [Phase 79]: Push fire-and-forget nach COMMIT in wrapped.js (4 Pfade)
- [Phase 80]: highlight_type ueber_das_ziel hoechste Prio, dann staerkster Bereich nach fester Reihenfolge
- [Phase 80]: formulierung_seed deterministisch (userId * 31 + year * 17) % 97
- [Phase 80]: wrappedModalRef (useRef) statt useState fuer dynamische useIonModal-Props bei Listen-Eintraegen
- [Phase 80]: Renderer-Map Pattern statt cloneElement fuer TypeScript-kompatible dynamische Slide-Reihenfolge
- [Phase 80]: Formulierungen nur in neuen Slides aktiv (kein Breaking Change fuer bestehende Slides)

### Roadmap Evolution

- Phase 80 added: Wrapped Persistenz + Individualisierung (Wiederansicht, Konfi-History Card, individuelle Slides)

### Pending Todos

- v2.4 Design-Angleich geplant
- v3.0 Onboarding + Landing geplant

### Blockers/Concerns

- html-to-image + Ionic Shadow-DOM Rendering muss in Phase 78 getestet werden
- confirmation_date Feld auf jahrgaenge-Tabelle: existiert es bereits? (Phase 75 pruefen)

## Session Continuity

Last session: 2026-03-22T19:36:39.110Z
Stopped at: Completed 80-02-PLAN.md
Resume file: None
