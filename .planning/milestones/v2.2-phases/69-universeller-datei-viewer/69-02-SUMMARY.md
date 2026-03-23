---
phase: 69-universeller-datei-viewer
plan: 02
subsystem: ui
tags: [react, ionic, chat, material, fileviewer, integration]

requires:
  - phase: 69-universeller-datei-viewer
    provides: "FileViewerModal Komponente mit Zoom/Pan/Swipe (Plan 01)"
provides:
  - "Chat-Integration: Tap auf Bild/Video/Datei oeffnet universellen FileViewerModal"
  - "Material-Integration: Tap auf Datei oeffnet FileViewerModal mit Swipe durch alle Material-Dateien"
  - "Alle Einsatzorte (Chat, Material, Admin) nutzen einheitlichen shared/FileViewerModal"
affects: []

tech-stack:
  added: []
  patterns: [API-Pfad-Aufloesung in FileViewerModal fuer auth-geschuetzte Dateien]

key-files:
  created: []
  modified:
    - frontend/src/components/chat/ChatRoom.tsx
    - frontend/src/components/chat/MessageBubble.tsx
    - frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx
    - frontend/src/components/shared/FileViewerModal.tsx
    - frontend/src/components/chat/modals/FileViewerModal.tsx
    - frontend/src/components/admin/modals/MaterialFormModal.tsx
    - frontend/src/components/teamer/pages/TeamerMaterialPage.tsx

key-decisions:
  - "API-Pfade als FileItem-URLs mit lazy Blob-Aufloesung im Viewer statt Vorladen aller Dateien"
  - "getMimeFromFileName Helper in MessageBubble und ChatRoom fuer MIME-Ableitung aus Extension"

patterns-established:
  - "API-Pfad-Pattern: FileItem.url kann relativer API-Pfad (/api/...) sein, FileViewerModal laedt per Auth-fetch"
  - "Swipe-Kontext: files-Array aus allen Dateien im Kontext (Chat-Raum / Material), angeklickte Datei als Blob vorladen"

requirements-completed: [FV-08, FV-09]

duration: 6min
completed: 2026-03-21
---

# Phase 69 Plan 02: FileViewerModal Integration in Chat + Material Summary

**Chat und Material nutzen einheitlichen Fullscreen-Viewer mit Swipe-Kontext, API-Pfad-Aufloesung fuer Auth-geschuetzte Dateien, kein nativer FileOpener mehr**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-21T19:28:32Z
- **Completed:** 2026-03-21T19:35:11Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Chat: Tap auf Bild/Video/Datei oeffnet universellen FileViewerModal mit Swipe durch alle Dateien im Chat-Raum
- Material: Tap auf Datei oeffnet FileViewerModal mit Swipe durch alle Material-Dateien
- FileViewerModal erweitert: API-relative Pfade werden lazy per Auth-fetch in Blob-URLs aufgeloest
- Alle 4 Consumer (ChatRoom, TeamerMaterialDetailPage, MaterialFormModal, TeamerMaterialPage) nutzen shared/FileViewerModal
- Nativer FileOpener/FileViewer Code komplett aus Chat und Material entfernt
- Altes chat/modals/FileViewerModal als DEPRECATED markiert, keine Imports mehr darauf

## Task Commits

Each task was committed atomically:

1. **Task 1: Chat-Integration -- ChatRoom + MessageBubble auf neues FileViewerModal umstellen** - `c998f57` (feat)
2. **Task 2: Material-Integration -- TeamerMaterialDetailPage + alle alten Imports umstellen** - `31ebd06` (feat)

## Files Created/Modified
- `frontend/src/components/chat/MessageBubble.tsx` - onImageClick zu onFileClick mit filePath/fileName/mimeType, getMimeFromFileName Helper
- `frontend/src/components/chat/ChatRoom.tsx` - handleFileClick mit files-Array und Swipe-Kontext, Import auf shared/FileViewerModal
- `frontend/src/components/shared/FileViewerModal.tsx` - API-Pfad-Erkennung + Auth-fetch + Blob-URL-Cache, resolvedUrl State
- `frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx` - Swipe durch Material-Dateien, kein nativer Viewer
- `frontend/src/components/chat/modals/FileViewerModal.tsx` - DEPRECATED Kommentar
- `frontend/src/components/admin/modals/MaterialFormModal.tsx` - Import auf shared/FileViewerModal
- `frontend/src/components/teamer/pages/TeamerMaterialPage.tsx` - Import auf shared/FileViewerModal

## Decisions Made
- API-Pfade als FileItem-URLs statt Vorladen aller Dateien: Angeklickte Datei wird sofort als Blob geladen, andere Dateien im Swipe-Kontext als /api/-Pfad hinterlegt und erst beim Swipe lazy aufgeloest
- MIME-Type-Ableitung aus Dateiname (Extension-Mapping) als leichtgewichtiger Helper statt Server-Roundtrip

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] FileViewerModal um API-Pfad-Aufloesung erweitert**
- **Found during:** Task 1 (Chat-Integration)
- **Issue:** Chat-Dateien benoetigen Auth-Header, aber FileViewerModal nutzt `<img src>` direkt — relative API-Pfade funktionieren nicht ohne Auth
- **Fix:** `isApiPath()` + `resolveUrl()` Helper mit `api.get(url, {responseType:'blob'})`, Blob-URL-Cache, resolvedUrl State mit Ladeindikator
- **Files modified:** frontend/src/components/shared/FileViewerModal.tsx
- **Verification:** TypeScript kompiliert fehlerfrei
- **Committed in:** c998f57 (Task 1 commit)

**2. [Rule 2 - Missing Critical] MaterialFormModal + TeamerMaterialPage Imports umgestellt**
- **Found during:** Task 2 (Material-Integration)
- **Issue:** Neben TeamerMaterialDetailPage importierten noch 2 weitere Dateien das alte chat/modals/FileViewerModal
- **Fix:** Imports auf shared/FileViewerModal umgestellt (nutzen backward-kompatible blobUrl/fileName/mimeType Props)
- **Files modified:** frontend/src/components/admin/modals/MaterialFormModal.tsx, frontend/src/components/teamer/pages/TeamerMaterialPage.tsx
- **Verification:** grep nach "chat/modals/FileViewerModal" in src/ findet 0 Treffer
- **Committed in:** 31ebd06 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Beide Auto-Fixes noetig fuer Korrektheit. Kein Scope-Creep.

## Issues Encountered

None

## User Setup Required

None - keine externe Service-Konfiguration erforderlich.

## Next Phase Readiness
- Phase 69 vollstaendig: Universeller Datei-Viewer erstellt (Plan 01) und in alle Einsatzorte integriert (Plan 02)
- Altes FileViewerModal (chat/modals/) kann in einem zukuenftigen Cleanup geloescht werden
- v2.2 Codebase-Hardening Milestone komplett

## Known Stubs

None - keine Stubs oder Platzhalter.

---
*Phase: 69-universeller-datei-viewer*
*Completed: 2026-03-21*
