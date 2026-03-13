---
phase: quick-5
plan: 1
subsystem: chat
tags: [fileviewer, modal, chat, ux]
dependency_graph:
  requires: []
  provides: [in-app-file-viewer]
  affects: [chat-room]
tech_stack:
  added: []
  patterns: [useIonModal-with-ref, blob-url-viewer]
key_files:
  created:
    - frontend/src/components/chat/modals/FileViewerModal.tsx
  modified:
    - frontend/src/components/chat/ChatRoom.tsx
key_decisions:
  - viewerDataRef statt useState fuer reaktive Props mit useIonModal (useIonModal bindet Props bei Erstellung)
  - useCallback fuer openInAppViewer mit presentFileViewer Dependency
metrics:
  duration: 2min
  completed: "2026-03-13T09:33:00Z"
---

# Quick Task 5: Chat-Dateien und Bilder in In-App FileViewer

In-App FileViewerModal fuer Chat-Dateien mit iOS Card Style, Bild/PDF/Download-Vorschau und Blob-URL-basiertem Rendering.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | FileViewerModal Komponente erstellen | fcaaff4 | FileViewerModal.tsx |
| 2 | ChatRoom.tsx - window.open durch FileViewerModal ersetzen | c7945e3 | ChatRoom.tsx |

## Key Changes

### FileViewerModal.tsx (neu)
- IonPage mit Header (closeOutline Button, Dateiname als Titel)
- Bilder: img mit object-fit contain, zentriert
- PDFs: iframe fullscreen
- Andere: Hinweis "Vorschau nicht verfuegbar" mit Download-Button

### ChatRoom.tsx (geaendert)
- viewerDataRef (useRef) fuer Blob-URL, Dateiname, MIME-Type - umgeht useIonModal Prop-Binding-Problem
- useIonModal mit Getter-Props fuer reaktiven Zugriff auf Ref
- openInAppViewer Hilfsfunktion erstellt Blob-URL und praesentiert Modal
- openImageWithFileOpener: catch-Block nutzt jetzt In-App-Viewer statt setError
- handleImageOrFileClick: beide window.open Stellen durch openInAppViewer ersetzt
- Native Capacitor FileViewer/FileOpener bleibt primaerer Oeffnungspfad

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript kompiliert fehlerfrei
- Kein window.open mehr in ChatRoom.tsx
- FileViewerModal wird per useIonModal mit presentingElement geoeffnet
