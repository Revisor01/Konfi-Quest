---
phase: quick-6b
plan: 1
subsystem: frontend
tags: [material, inline-detail, corner-badges, modal-context, ui]
dependency_graph:
  requires: []
  provides: [inline-material-detail, admin-material-presenting-element]
  affects: [TeamerMaterialPage, ModalContext]
tech_stack:
  patterns: [inline-detail-view, selectedState-conditional-rendering, app-corner-badge]
key_files:
  modified:
    - frontend/src/components/teamer/pages/TeamerMaterialPage.tsx
    - frontend/src/contexts/ModalContext.tsx
decisions:
  - "Material Detail als Inline-View statt Modal (wie TeamerEventsPage Pattern)"
  - "Nur Event Corner Badge behalten, Jahrgang Badge entfernt"
  - "app-corner-badge CSS-Klasse fuer Event Badge statt inline borderRadius"
  - "create Icon (SOLID) fuer Erstellt-am statt time/outline"
metrics:
  duration: 2min
  completed: "2026-03-13T10:10:00Z"
  tasks: 2
  files: 2
---

# Quick Task 6 (Revised): Teamer Material UI-Korrekturen Summary

Material Detail von Modal auf Inline-View umgebaut (selectedMaterial State + Conditional Rendering), Corner Badge nur noch Event mit app-corner-badge CSS-Klasse, admin-material Route-Mapping in ModalContext ergaenzt.

## Tasks Completed

### Task 1: Material Detail Inline + Corner Badge Fix (a96aeec)

**TeamerMaterialPage.tsx komplett ueberarbeitet:**
- `useIonModal` und `TeamerMaterialDetailPage`-Import entfernt
- `useModalPage` entfernt (kein Modal mehr noetig)
- `selectedMaterial` State mit `MaterialDetail` Interface statt `selectedMaterialId`
- `openDetail()` laedt Material per API und setzt `selectedMaterial`
- Inline Detail-View mit arrowBack Button, SectionHeader (amber), Beschreibung, Details, Dateien
- Detail-Icons: calendar (SOLID, rot) fuer Event, create (SOLID) fuer Erstellt-am, person fuer Admin
- File-Handling Funktionen (getFileIcon, formatFileSize, openFile) direkt in TeamerMaterialPage
- Corner Badge: Nur Event Badge mit `app-corner-badge` CSS-Klasse, Jahrgang Badge entfernt
- Stats: "Materialien" + "Dateien" (2 Felder)
- Kalender-Icon in Liste: calendar (SOLID, nicht outline)

### Task 2: Admin Material ModalContext Fix (d02ecf1)

- `admin-material` Route-Mapping in ModalContext.tsx hinzugefuegt
- MaterialFormModal bekommt jetzt korrektes presentingElement (iOS Backdrop)

## Deviations from Plan

None - plan executed with user overrides applied.

## Self-Check: PASSED
