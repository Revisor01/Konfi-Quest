---
phase: 60-queue-kern-konfi-aktionen
plan: 02
subsystem: ui
tags: [chat, offline-queue, optimistic-ui, capacitor-filesystem, writeQueue]

requires:
  - phase: 60-queue-kern-konfi-aktionen
    provides: writeQueue Service (enqueue, flush, remove, getByMetadata)
  - phase: 59-online-only-buttons
    provides: queueStatus/localId auf Message-Interface, handleRetryMessage/handleDeleteQueuedMessage Stubs
provides:
  - ChatRoom sendMessage mit Offline-Queue-Fallback und Optimistic UI
  - Retry/Delete Handler fuer fehlgeschlagene Queue-Nachrichten
  - Bild-Nachrichten lokal in Capacitor Filesystem bei Offline
affects: [60-queue-kern-konfi-aktionen, chat, sync]

tech-stack:
  added: []
  patterns: [optimistic-ui-with-queue-fallback, local-file-storage-for-offline-uploads]

key-files:
  created: []
  modified:
    - frontend/src/components/chat/ChatRoom.tsx

key-decisions:
  - "crypto.randomUUID statt uuid-Library fuer clientId/localId Generation"
  - "Optimistic Message mit negativer ID (-Date.now()) als temporaerer Platzhalter"
  - "Online-Pfad entfernt optimistic msg nach 2s Delay (WebSocket ersetzt)"
  - "Offline-Pfad speichert Bilder als Base64 in Capacitor Directory.Data"

patterns-established:
  - "Optimistic-UI-Queue: Nachricht sofort anzeigen, offline in Queue, online normal senden"
  - "File-Queue-Pattern: Base64 in Capacitor Filesystem, Pfad in Queue-Body als _localFilePath"

requirements-completed: [QUE-K01, QUE-K02]

duration: 3min
completed: 2026-03-21
---

# Phase 60 Plan 02: Chat Offline-Queue Summary

**Chat sendMessage mit writeQueue-Fallback, Optimistic UI (pending/error), Retry/Delete ActionSheet und lokaler Bild-Speicherung**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T09:59:53Z
- **Completed:** 2026-03-21T10:03:09Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- sendMessage erkennt Online/Offline-Status via networkMonitor und verzweigt entsprechend
- Optimistic UI: Nachricht erscheint sofort mit queueStatus: 'pending' und localId
- Offline: Text-Nachrichten und Bild-Nachrichten werden in writeQueue gespeichert
- Bild-Nachrichten werden als Base64 in Capacitor Filesystem gespeichert (queue-uploads/)
- handleRetryMessage: Queue-Item finden, entfernen, neu enqueuen, flush bei Online
- handleDeleteQueuedMessage: UI + Queue + lokale Datei aufraumen

## Task Commits

Each task was committed atomically:

1. **Task 1: sendMessage mit Queue-Fallback + Optimistic UI** - `8f16db6` (feat)

## Files Created/Modified
- `frontend/src/components/chat/ChatRoom.tsx` - sendMessage mit Online/Offline-Branching, Optimistic UI, Retry/Delete Handler

## Decisions Made
- crypto.randomUUID (mit Fallback) statt uuid-Library — vermeidet zusaetzliche Dependency
- Negative IDs (-Date.now()) fuer temporaere optimistic Messages — kollidieren nicht mit Server-IDs
- 2-Sekunden-Delay fuer Entfernung der optimistic msg im Online-Pfad — WebSocket-Event kommt normalerweise schneller
- Base64-Speicherung in Capacitor Directory.Data — plattformunabhaengig, wird bei Queue-Flush gelesen

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - alle Stubs aus Phase 59 wurden mit funktionaler Logik ersetzt.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Queue-Integration fuer Chat komplett, bereit fuer Plan 03 (Aktivitaets-Antraege)
- writeQueue.flush() muss noch FormData-Konvertierung fuer Datei-Uploads implementieren (in writeQueue.ts)

---
*Phase: 60-queue-kern-konfi-aktionen*
*Completed: 2026-03-21*
