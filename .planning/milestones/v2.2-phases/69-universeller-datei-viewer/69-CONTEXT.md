# Phase 69: Universeller Datei-Viewer - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Fullscreen Datei-Viewer fuer alle gaengigen Dateitypen. Bilder mit Zoom/Pan, Swipe zwischen Dateien, Download, natives Teilen. Eingesetzt in Chat und Material.

</domain>

<decisions>
## Implementation Decisions

### Unterstuetzte Dateitypen
- **D-01:** Bilder: JPG, PNG, GIF, WebP — Fullscreen mit Zoom/Pan/Pinch
- **D-02:** PDFs — Inline-Viewer (kein externer PDF-Reader)
- **D-03:** Videos — Fullscreen Player (Chat hat bereits Video-Uploads)
- **D-04:** Office-Dokumente (DOCX, XLSX) — Vorschau wenn moeglich, sonst Download-Fallback mit Datei-Icon + Groesse
- **D-05:** Unbekannte Dateitypen — Download-Button mit Datei-Icon, kein Viewer

### Interaktion
- **D-06:** Zoom/Pan/Pinch fuer Bilder — Touch auf Mobile, Scroll/Drag auf Desktop
- **D-07:** Swipe zwischen Dateien im gleichen Kontext (z.B. alle Bilder in einem Chat-Raum oder alle Dateien eines Materials)
- **D-08:** Download-Button immer sichtbar im Viewer (alle Dateitypen)
- **D-09:** Share-Button oeffnet natives Share-Sheet (Capacitor Share Plugin) — nur auf nativen Plattformen sichtbar
- **D-10:** Schliessen via X-Button oben rechts + Swipe-Down-Geste (iOS-Pattern)

### Einsatzorte
- **D-11:** Chat: Tap auf Bild/Video/Datei in MessageBubble → Fullscreen Viewer
- **D-12:** Material: Tap auf Datei in MaterialDetailPage → Fullscreen Viewer
- **D-13:** NICHT: Profilbilder, Badge-Icons — kein Viewer dort (evtl. spaeter)

### Viewer-Architektur
- **D-14:** Ein universelles FileViewerModal das ueberall wiederverwendet wird (useIonModal Pattern)
- **D-15:** Modal bekommt: aktuelle Datei-URL, Dateityp, Liste aller Dateien im Kontext (fuer Swipe)
- **D-16:** Dunkler Fullscreen-Hintergrund (schwarz/transparent), kein Ionic-Header — eigenes minimales UI

### Claude's Discretion
- Library-Wahl fuer Zoom/Pan (react-zoom-pan-pinch, swiper, oder eigene Loesung — Research noetig)
- PDF-Viewer Library (react-pdf, pdf.js, oder nativer Capacitor-Viewer)
- Video-Player Implementation (HTML5 video oder Capacitor-nativer Player)
- Swipe-Implementation (Swiper.js, eigene Gesture, oder Library)
- Genauer Download-Mechanismus (Capacitor Filesystem + Share vs. Browser-Download)

</decisions>

<specifics>
## Specific Ideas

- Bilder-Swipe wie in WhatsApp/Signal — links/rechts durch alle Bilder im Chat wischen
- Zoom wie native Foto-App — Doppeltap zum Reinzoomen, Pinch-to-Zoom
- Dunkler Hintergrund damit das Bild im Fokus steht
- Office-Dokumente: Wenn kein Inline-Viewer moeglich, dann schoene Vorschau-Karte mit Icon + Name + Groesse + Download-Button

</specifics>

<canonical_refs>
## Canonical References

### Bestehende Datei-Infrastruktur
- `frontend/src/components/chat/MessageBubble.tsx` — Aktuelles Bild/Video-Rendering in Chat-Nachrichten
- `frontend/src/components/chat/ChatRoom.tsx` — Datei-Upload und Anzeige-Logik
- `frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx` — Material-Datei-Anzeige und Download
- `backend/routes/chat.js` — Datei-Upload Endpoints (multipart, multer)
- `backend/routes/material.js` — Material-Datei-Upload und -Download

### Research Flag
- Library-Wahl ist offen — Phase braucht Research vor Planning (react-zoom-pan-pinch vs swiper vs eigene Loesung, Capacitor-Kompatibilitaet)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- useIonModal Pattern — fuer FileViewerModal
- MessageBubble.tsx — hat bereits Bild/Video-Rendering, braucht onClick → Viewer oeffnen
- TeamerMaterialDetailPage — hat bereits Datei-Liste, braucht onClick → Viewer oeffnen
- Capacitor Share Plugin — moeglicherweise bereits installiert (pruefen)

### Established Patterns
- Alle Modals nutzen useIonModal (CLAUDE.md Regel)
- Dunkle Fullscreen-Modals: Noch kein Beispiel in der App, neues Pattern

### Integration Points
- MessageBubble.tsx → onClick auf Bild/Video/Datei oeffnet FileViewerModal
- TeamerMaterialDetailPage → onClick auf Datei oeffnet FileViewerModal
- FileViewerModal → api.ts fuer Datei-Download
- FileViewerModal → Capacitor Share fuer natives Teilen
- FileViewerModal → Capacitor Filesystem fuer lokalen Download

</code_context>

<deferred>
## Deferred Ideas

- Profilbild-Viewer — evtl. spaeterer Milestone
- Datei-Vorschau-Thumbnails in Chat (aktuell nur Bild-Inline) — eigene Phase

</deferred>

---

*Phase: 69-universeller-datei-viewer*
*Context gathered: 2026-03-21*
