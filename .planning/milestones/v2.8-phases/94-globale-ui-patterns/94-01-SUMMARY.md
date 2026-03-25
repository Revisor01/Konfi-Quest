---
phase: 94-globale-ui-patterns
plan: 01
subsystem: frontend-ui
tags: [ui-patterns, slider, card-padding, admin-modals]
dependency_graph:
  requires: []
  provides: [symmetrisches-card-padding, slider-min-max-labels]
  affects: [alle-views-mit-app-card, alle-admin-modals-mit-slider]
tech_stack:
  added: []
  patterns: [flex-container-slider-labels, css-padding-symmetrie]
key_files:
  created: []
  modified:
    - frontend/src/theme/variables.css
    - frontend/src/components/admin/modals/BadgeManagementModal.tsx
    - frontend/src/components/admin/modals/ActivityManagementModal.tsx
    - frontend/src/components/admin/modals/LevelManagementModal.tsx
    - frontend/src/components/admin/modals/EventModal.tsx
    - frontend/src/components/admin/modals/EventFormSections.tsx
    - frontend/src/components/admin/modals/BonusModal.tsx
    - frontend/src/components/admin/pages/AdminJahrgaengeePage.tsx
decisions:
  - "Slider-Labels als inline span-Elemente statt IonRange slot-Labels fuer maximale Kontrolle"
  - "flex: 1 auf IonRange damit Labels bündig an den Enden bleiben"
metrics:
  duration_minutes: 10
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_changed: 8
---

# Phase 94 Plan 01: Globale UI-Patterns Summary

**One-liner:** Symmetrisches 16px Card-Padding in variables.css und Min/Max-Labels mit Spannen-Tuning für alle 13 IonRange-Instanzen in 7 Admin-Dateien.

## Objective

Konsistente visuelle Basis schaffen, die alle nachfolgenden v2.8-Phasen automatisch erben: einheitliches Card-Padding und klar ablesbare Slider mit sinnvollen Wertbereichen.

## Tasks Completed

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Card-Padding symmetrisch | 1b8e8ee | `padding: 8px 16px` → `padding: 16px` in `ion-card.app-card ion-card-content` |
| Task 2: Slider Min/Max-Labels | 6977b02 | Alle 13 IonRange mit flex-Container + span-Labels, 7 Spannen angepasst |

## Decisions Made

- **Slider-Labels als inline span-Elemente:** IonRange `slot="start"` / `slot="end"` wurde nicht verwendet, da inline-style span-Elemente mit `minWidth: 24px` besser kontrollierbar sind und konsistent über alle Slider-Kontexte funktionieren.
- **flex: 1 auf IonRange:** IonRange erhält `style={{ flex: 1 }}`, sodass die Min/Max-Labels bündig an beiden Enden bleiben und der Slider den gesamten verbleibenden Raum einnimmt.

## Spannen-Änderungen

| Datei | Slider | Alt | Neu | Grund |
|-------|--------|-----|-----|-------|
| EventFormSections.tsx | Check-in-Fenster | max=120 | max=60 | 120 Min unrealistisch |
| EventFormSections.tsx | Max. Teilnehmer | max=100 | max=50 | >50 unrealistisch für Konfi-Events |
| EventFormSections.tsx | Anzahl Events (Serie) | max=52 | max=26 | Halbes Jahr reicht |
| BonusModal.tsx | Punkte | max=50 | max=10 | Bonus-Punkte selten >10 |
| BadgeManagementModal.tsx | Zeitraum Wochen | max=52 | max=26 | Halbes Jahr reicht |
| AdminJahrgaengeePage.tsx | Ziel Gottesdienst | max=40 | max=20 | 20 GD realistisch |
| AdminJahrgaengeePage.tsx | Ziel Gemeinde | max=40 | max=20 | 20 Gemeinde realistisch |

Unveraendert (bereits sinnvoll): ActivityManagementModal Punkte (max=5), LevelManagementModal Punkte (max=40), EventModal Slot-Teilnehmer (max=10), BadgeManagementModal criteria_value (max=20), EventFormSections Punkte (max=5), EventFormSections Warteliste (max=10).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `frontend/src/theme/variables.css` enthält `padding: 16px` in `ion-card.app-card ion-card-content`: FOUND
- Commit 1b8e8ee: FOUND
- Commit 6977b02: FOUND
- `npx tsc --noEmit`: keine neuen Fehler
- `npm run build`: erfolgreich (built in 2.04s)
