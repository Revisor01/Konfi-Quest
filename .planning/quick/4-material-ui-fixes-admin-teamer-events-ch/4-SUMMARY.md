---
phase: quick-4
plan: 01
subsystem: frontend
tags: [ui-fixes, material, chat, teamer, admin]
key-files:
  created: []
  modified:
    - frontend/src/components/admin/pages/AdminMaterialPage.tsx
    - frontend/src/components/admin/modals/MaterialFormModal.tsx
    - frontend/src/components/teamer/pages/TeamerMaterialPage.tsx
    - frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx
    - frontend/src/components/teamer/pages/TeamerEventsPage.tsx
    - frontend/src/components/chat/ChatOverview.tsx
    - frontend/src/components/chat/ChatRoom.tsx
decisions:
  - Corner Badges verwenden inline-Styles statt app-corner-badge Klasse fuer flexible borderRadius-Steuerung
  - Chat-Filter als IonSegment-Tabs ausserhalb der IonList platziert fuer bessere Sichtbarkeit
metrics:
  duration: 4min
  completed: "2026-03-13T09:25:00Z"
  tasks: 3
  files: 7
---

# Quick Task 4: Material UI-Fixes Admin, Teamer, Events, Chat

18 UI-Fixes in 3 Tasks: Admin Material Suche & Filter Section, Teamer Material SectionHeader mit Amber, korrekter Corner Badge borderRadius, rote Kalender-Icons, Chat IonSegment-Tabs statt Popover, kritischer Chat-Auth-Token Bug Fix.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Admin Material UI-Fixes (Punkte 1-7) | cb233f1 | AdminMaterialPage.tsx, MaterialFormModal.tsx |
| 2 | Teamer Material + Events UI-Fixes (Punkte 8-16) | ca79858 | TeamerMaterialPage.tsx, TeamerMaterialDetailPage.tsx, TeamerEventsPage.tsx |
| 3 | Chat Filter-Tabs + Auth-Token Bug Fix (Punkte 17-18) | 2e7361c | ChatOverview.tsx, ChatRoom.tsx |

## Changes by Task

### Task 1: Admin Material UI-Fixes
- Suchleiste und Jahrgang-Filter in "Suche & Filter" IonList mit IonListHeader und filterOutline Icon gruppiert
- Kalender-Icon bei Event-Datum von grau (#6c757d) auf rot (#dc2626) geaendert
- Neue Dateien im MaterialFormModal: Trash-Button durch IonItemSliding Swipe-Delete ersetzt
- Neue Dateien koennen per Klick geoeffnet werden (URL.createObjectURL)
- Punkte 4-6 (Events Filter, FileViewer Modal, Backdrop) waren bereits korrekt implementiert

### Task 2: Teamer Material + Events UI-Fixes
- TeamerMaterialPage: SectionHeader in Amber (#d97706/#b45309) mit Material-Anzahl hinzugefuegt
- TeamerMaterialPage: Suche & Filter Section mit IonListHeader
- TeamerMaterialPage: Corner Badge borderRadius-Logik - einzelner Badge: 0 0 8px 8px, linker von zwei: 0 0 0 8px, rechter von zwei: 0 0 8px 0
- TeamerMaterialPage: Datum-Icon auf rot (#dc2626)
- TeamerMaterialDetailPage: "Informationen" -> "Details", Icon auf calendarOutline
- TeamerEventsPage: Material-Modal mit presentingElement fuer Backdrop
- TeamerEventsPage: Material-Section Icon auf events-Klasse (rot)
- TeamerEventsPage: Beschreibung mit konsistenter Schriftgroesse (0.95rem, lineHeight 1.5, pre-wrap)
- Punkt 15 (Warteliste/Teamer-Button) war bereits korrekt

### Task 3: Chat Filter-Tabs + Auth-Token Bug Fix
- ChatOverview: IonSelect mit interface="popover" durch IonSegment-Tabs ersetzt (Alle/Direkt/Gruppe/Jahrgang)
- IonSelect und IonSelectOption Imports entfernt, IonSegment und IonSegmentButton hinzugefuegt
- ChatRoom KRITISCHER BUG FIX: 3 Stellen wo Dateien ohne Auth-Token geoeffnet wurden
  - handleImageOrFileClick Fallback: window.open(fileUrl) -> api.get mit Blob
  - handleImageOrFileClick Default: window.open(fileUrl) -> api.get mit Blob
  - handleShare: fetch(fileUrl) -> api.get mit Blob und Auth-Header

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TS2345 SegmentValue Type Error**
- **Found during:** Task 3
- **Issue:** IonSegment onIonChange liefert SegmentValue (string | number), nicht string
- **Fix:** String(e.detail.value) statt e.detail.value!
- **Files modified:** ChatOverview.tsx
- **Commit:** 2e7361c

## Verification

TypeScript kompiliert fehlerfrei nach allen 3 Tasks.
