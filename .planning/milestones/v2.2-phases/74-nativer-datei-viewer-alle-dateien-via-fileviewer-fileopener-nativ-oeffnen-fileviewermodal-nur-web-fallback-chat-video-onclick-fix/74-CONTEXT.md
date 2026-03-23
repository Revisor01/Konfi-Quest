# Phase 74: Nativer Datei-Viewer - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Alle Datei-Oeffnungen auf natives Pattern umstellen: FileViewer.openDocumentFromLocalPath() fuer Dokumente, FileOpener.open() fuer Bilder. FileViewerModal nur noch als Web-Fallback. Chat-Video onClick Fix.

</domain>

<decisions>
## Implementation Decisions

### Nativer Viewer (MaterialFormModal-Pattern als Referenz)
- **D-01:** Referenz-Implementierung: MaterialFormModal.tsx Zeile 163-209 — Datei laden → Filesystem speichern → nativ oeffnen
- **D-02:** Bilder: FileOpener.open({ filePath, contentType }) — oeffnet nativen Bild-Viewer
- **D-03:** PDFs/DOCX/andere Dokumente: FileViewer.openDocumentFromLocalPath({ path }) — oeffnet iOS Quick Look / Android Intent
- **D-04:** Fallback bei nativem Fehler: FileViewerModal (In-App) als Backup

### FileViewerModal Umbau
- **D-05:** FileViewerModal bekommt neue Funktion: openFileNatively(url, fileName, mimeType) als zentrale Methode
- **D-06:** Auf nativen Plattformen: Datei per API laden → Filesystem speichern → nativ oeffnen → Modal nicht zeigen
- **D-07:** Auf Web: Bisheriges Verhalten beibehalten (Bilder inline, PDF iframe, Video HTML5)
- **D-08:** ODER: Einfacher — openFileNatively als separate utility Funktion (nicht im Modal), Modal wird nur auf Web geoeffnet

### Chat-Video onClick Fix
- **D-09:** MessageBubble.tsx Zeile 462-472: Der onClick-Wrapper um VideoPreview oeffnet FileViewerModal bei Video-Tap
- **D-10:** Fix: onClick-Wrapper fuer Videos entfernen — VideoPreview handhabt Play/Pause selber
- **D-11:** Stattdessen: Long-Press oder separater Fullscreen-Button auf VideoPreview fuer natives Oeffnen

### Betroffene Consumer
- **D-12:** ChatRoom.tsx handleFileClick → nativ oeffnen statt FileViewerModal
- **D-13:** TeamerMaterialDetailPage.tsx Datei-Tap → nativ oeffnen
- **D-14:** MaterialFormModal.tsx — bleibt wie ist (bereits korrekt!)
- **D-15:** Alle anderen Stellen die FileViewerModal nutzen

### Claude's Discretion
- Ob openFileNatively eine separate Utility oder Teil des FileViewerModal wird
- Long-Press vs. Fullscreen-Button fuer Video-Vollbild
- Cleanup der temp-Dateien im Filesystem

</decisions>

<canonical_refs>
## Canonical References

### Referenz (das Pattern das funktioniert)
- `frontend/src/components/admin/modals/MaterialFormModal.tsx` Zeile 163-209 — openFile Funktion

### Zu aendernde Dateien
- `frontend/src/components/shared/FileViewerModal.tsx` — Zentrale Logik
- `frontend/src/components/chat/ChatRoom.tsx` — handleFileClick
- `frontend/src/components/chat/MessageBubble.tsx` — Video onClick entfernen
- `frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx` — Datei-Oeffnung

### Plugins
- `@capacitor/file-viewer` — openDocumentFromLocalPath (bereits installiert)
- `@capacitor-community/file-opener` — open (bereits installiert)
- `@capacitor/filesystem` — writeFile, getUri (bereits installiert)

</canonical_refs>

<code_context>
## Existing Code Insights

### MaterialFormModal Pattern (Referenz)
```
1. api.get(fileUrl, { responseType: 'blob' })
2. FileReader → base64
3. Filesystem.writeFile({ path: tempPath, data: base64, directory: Directory.Documents })
4. Filesystem.getUri → fileUri
5. if (image) → FileOpener.open({ filePath: fileUri.uri, contentType })
6. else → FileViewer.openDocumentFromLocalPath({ path: fileUri.uri })
7. catch → In-App Fallback
```

### VideoPreview
- Funktioniert eigenstaendig (load blob, thumbnail, inline play)
- Hat eigenen handleVideoClick (play/pause)
- Problem: MessageBubble onClick-Wrapper faengt den Tap ab

</code_context>

<specifics>
## Specific Ideas

No specific requirements.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>

---

*Phase: 74-nativer-datei-viewer*
*Context gathered: 2026-03-22*
