---
phase: 112-konfi-aktivitaeten-profil-modal
plan: 01
subsystem: frontend
tags: [ui, design-system, konfi, listen-pattern]
dependency_graph:
  requires: []
  provides: [KAV-01, KPR-01, KPR-02, MAB-01]
  affects: [ListSection, RequestsView, ProfileView, ActivityRequestModal]
tech_stack:
  patterns: [flex-div-listen, 12px-card-padding, conditional-padding]
key_files:
  created: []
  modified:
    - frontend/src/components/shared/ListSection.tsx
    - frontend/src/components/konfi/views/ProfileView.tsx
    - frontend/src/components/konfi/modals/ActivityRequestModal.tsx
decisions:
  - ListSection innere IonList durch flex-div ersetzt (globale Aenderung fuer alle 15 Nutzer)
  - IonItem-Wrapper in Konto-Einstellungen durch klickbare divs ersetzt
  - IonItemSliding in RequestsView beibehalten (Swipe-to-Delete braucht IonItem)
metrics:
  duration: 256s
  completed: 2026-04-04
  tasks: 2
  files: 3
---

# Phase 112 Plan 01: Konfi Aktivitaeten + Profil + Modal Listen-Pattern Summary

Listen-Pattern und Card-Padding in RequestsView, ProfileView und ActivityRequestModal auf 12px flex-div Design-System umgestellt.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RequestsView und ProfileView Listen-Stil anpassen | 8357c9a | ListSection.tsx, ProfileView.tsx |
| 2 | ActivityRequestModal Card-Abstaende anpassen | 2beb758 | ActivityRequestModal.tsx |

## Changes Made

### Task 1: RequestsView und ProfileView Listen-Stil

**ListSection.tsx (globale Komponente):**
- IonCardContent padding von default (16px) auf explizit 12px
- Innere `<IonList lines="none">` durch `<div style={{ display: 'flex', flexDirection: 'column' }}>` ersetzt
- Betrifft 15 Views die ListSection nutzen

**ProfileView.tsx:**
- Meine Wrappeds: padding 16px -> 12px, conditional `paddingBottom: 0` wenn nur 1 Wrapped vorhanden
- Letzte Aktivitaeten: IonList+IonItem komplett auf flex-div mit app-list-item CSS-Klassen umgestellt
- Konto-Einstellungen: 4x IonItem-Wrapper durch klickbare divs ersetzt, IonList entfernt, padding 12px
- marginBottom auf Wrappeds entfernt (app-list-item CSS hat bereits 8px margin-bottom)

**RequestsView.tsx:**
- Keine direkte Aenderung noetig - nutzt ListSection die jetzt 12px padding hat
- IonItemSliding beibehalten fuer Swipe-to-Delete Funktion

### Task 2: ActivityRequestModal Card-Abstaende

- Accordion-Content: horizontales padding von 16px auf 12px
- Datum-Card: explizit `padding: '12px'`
- Anmerkungen-Card: explizit `padding: '12px'`
- Foto-Card: explizit `padding: '12px'`
- Aktivitaet-waehlen Card: `padding: '0'` beibehalten (Accordion hat eigenes Padding)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Enhancement] ListSection globale Aenderung statt nur lokaler Fix**
- **Found during:** Task 1
- **Issue:** Plan sah nur lokale Aenderungen in RequestsView/ProfileView vor, aber ListSection ist die gemeinsame Komponente
- **Fix:** ListSection.tsx selbst angepasst (12px padding + flex-div), damit alle 15 Views konsistent profitieren
- **Files modified:** frontend/src/components/shared/ListSection.tsx
- **Commit:** 8357c9a

## Decisions Made

1. ListSection innere IonList durch flex-div ersetzt -- konsistenteres Pattern, keine IonList-Defaults die stören
2. IonItemSliding in RequestsView beibehalten -- Swipe-to-Delete benoetigt IonItem als Kind
3. Konto-Einstellungen IonItem-Wrapper komplett entfernt -- app-list-item divs mit cursor:pointer reichen fuer Klick-Interaktion

## Known Stubs

Keine.

## Self-Check: PASSED

All 3 modified files exist. Both commit hashes (8357c9a, 2beb758) verified.
