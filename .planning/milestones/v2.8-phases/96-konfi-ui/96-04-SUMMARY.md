---
phase: 96-konfi-ui
plan: "04"
subsystem: frontend/konfi
tags: [profil, stats, akkordeon, bibel-modal, design-polish]
dependency_graph:
  requires: [96-02]
  provides: [ProfileView mit 6-Stat-SectionHeader, Punkte-Akkordeon, BibleTranslationModal]
  affects: [frontend/src/components/konfi/views/ProfileView.tsx]
tech_stack:
  added: []
  patterns: [IonAccordionGroup fuer inline History, useIonModal statt ActionSheet]
key_files:
  created: []
  modified:
    - frontend/src/components/konfi/views/ProfileView.tsx
decisions:
  - "IonAccordionGroup direkt in Profil statt PointsHistoryModal (D-06, KHI-01)"
  - "BibleTranslationModal mit Erklaerungstexten statt ActionSheet (D-09, KPR-02)"
  - "6 Stats in SectionHeader: PUNKTE, GD, GEMEINDE, EVENTS, BADGES, BONUS (D-08, KPR-01)"
metrics:
  duration_seconds: 131
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_modified: 1
---

# Phase 96 Plan 04: Profil-Ueberarbeitung Summary

**One-liner:** Profil-SectionHeader auf 6 Stats erweitert, Punkte-Uebersicht als IonAccordeon eingebaut, Bibeluebersetzung als erklaerungsreiches Modal mit RadioGroup.

## What Was Built

### Task 1: SectionHeader 6 Stats + Akkordeon-Historie

Der SectionHeader im Konfi-Profil zeigt nun 6 Stats in 2 Reihen statt bisher 3. Die neue Belegung:
- Reihe 1: PUNKTE, GD, GEMEINDE
- Reihe 2: EVENTS, BADGES, BONUS

Die bisherige Punkte-Uebersicht als Button (oeffnete PointsHistoryModal) wurde durch eine IonAccordionGroup ersetzt. Im ausgeklappten Zustand zeigt das Akkordeon:
- Stats-Grid 3x1 (GD / Gemeinde / Bonus Punkte)
- Letzte 10 Eintraege aus `/konfi/points-history` mit Icons je nach source_type

`PointsHistoryModal` Import und `useIonModal(PointsHistoryModal, ...)` Hook wurden entfernt. Die Datei `PointsHistoryModal.tsx` bleibt erhalten (wird ggf. noch von Teamer genutzt).

### Task 2: BibleTranslationModal mit Erklaerungen

Den Bibeluebersetzungs-ActionSheet durch ein vollwertiges Modal ersetzt. Das Modal zeigt alle 7 Uebersetzungen mit:
- Namen (fett)
- Erklaerungstext (1-2 Saetze je Uebersetzung)
- IonRadioGroup fuer die Auswahl (aktuell gewaehlte Uebersetzung vorselektiert)

`useIonActionSheet` Import entfernt. Neue Imports: `IonAccordion`, `IonAccordionGroup`, `IonButtons`, `IonContent`, `IonHeader`, `IonPage`, `IonRadio`, `IonRadioGroup`, `IonTitle`, `IonToolbar`, `closeOutline`, `giftOutline`.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 + 2 | ab736c0 | feat(96-04): Profil-Bereich ueberarbeiten — 6 Stats, Punkte-Akkordeon, Bibel-Modal |

## Deviations from Plan

None — Plan executed exactly as written.

## Known Stubs

None — alle Daten werden von echten API-Endpunkten geladen.

## Self-Check: PASSED

- [x] `frontend/src/components/konfi/views/ProfileView.tsx` existiert und enthaelt IonAccordionGroup
- [x] `presentPointsHistoryModal` nicht mehr in ProfileView.tsx
- [x] `BibleTranslationModal` 2x in ProfileView.tsx (Definition + useIonModal)
- [x] `presentActionSheet` nicht mehr in ProfileView.tsx
- [x] Commit ab736c0 vorhanden
- [x] TypeScript kompiliert ohne Fehler (tsc --noEmit --skipLibCheck)
