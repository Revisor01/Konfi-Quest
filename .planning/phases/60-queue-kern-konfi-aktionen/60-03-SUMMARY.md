---
phase: 60-queue-kern-konfi-aktionen
plan: 03
subsystem: ui
tags: [ionic, writeQueue, offline, capacitor-filesystem, networkMonitor]

requires:
  - phase: 60-queue-kern-konfi-aktionen-01
    provides: writeQueue.enqueue, writeQueue.getByMetadata, networkMonitor.isOnline
provides:
  - ActivityRequestModal offline-fähig mit Foto-Speicherung und Queue-Fallback
  - EventDetailView Opt-out offline-fähig mit Queue-Fallback
  - KonfiRequestsPage pending Queue-Anzeige mit Uhr-Icon
  - writeQueue resolveLocalPhoto Helfer für Foto-Upload beim Flush
affects: [60-queue-kern-konfi-aktionen-04, 61-queue-admin-crud]

tech-stack:
  added: []
  patterns: [Online/Offline-Branching mit networkMonitor.isOnline, lokale Foto-Speicherung mit Capacitor Filesystem, resolveLocalPhoto für Zwei-Schritt-Upload]

key-files:
  created: []
  modified:
    - frontend/src/components/konfi/modals/ActivityRequestModal.tsx
    - frontend/src/components/konfi/views/EventDetailView.tsx
    - frontend/src/components/konfi/pages/KonfiRequestsPage.tsx
    - frontend/src/services/writeQueue.ts

key-decisions:
  - "crypto.randomUUID() statt uuid-Paket für clientId-Generierung"
  - "resolveLocalPhoto in writeQueue.ts statt in ActivityRequestModal für saubere Trennung"
  - "Pending Queue-Items als separate Sektion über RequestsView statt inline-merge"

patterns-established:
  - "Online/Offline-Branching: networkMonitor.isOnline check im Handler, Online-Pfad unverändert, Offline-Pfad mit writeQueue.enqueue"
  - "Lokale Foto-Speicherung: FileReader -> base64 -> Filesystem.writeFile, Pfad als _localPhotoPath in Queue-Body"
  - "Queue-Flush Foto-Auflösung: resolveLocalPhoto liest Datei, konvertiert zu Blob, uploadet, setzt filename, löscht lokale Datei"

requirements-completed: [QUE-K03, QUE-K04, QUE-K05]

duration: 3min
completed: 2026-03-21
---

# Phase 60 Plan 03: Konfi-Aktionen offline Summary

**ActivityRequestModal + EventDetailView Opt-out offline-fähig mit Queue-Fallback, lokaler Foto-Speicherung und pending-Anzeige in KonfiRequestsPage**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T09:59:56Z
- **Completed:** 2026-03-21T10:02:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- ActivityRequestModal sendet Anträge offline via writeQueue mit lokalem Foto-Speicher
- EventDetailView Opt-out funktioniert offline mit Queue-Fallback und Erfolgs-Meldung
- KonfiRequestsPage zeigt wartende Queue-Anträge mit Uhr-Icon vor der echten Liste
- writeQueue.ts erweitert um resolveLocalPhoto für Zwei-Schritt Foto-Upload beim Flush

## Task Commits

Each task was committed atomically:

1. **Task 1: ActivityRequestModal offline-fähig machen** - `0b49e67` (feat)
2. **Task 2: Opt-out Queue + KonfiRequestsPage pending-Anzeige** - `fcdb4b5` (feat)

## Files Created/Modified
- `frontend/src/components/konfi/modals/ActivityRequestModal.tsx` - Online/Offline-Branching mit Foto-Queue
- `frontend/src/components/konfi/views/EventDetailView.tsx` - Opt-out Queue-Fallback
- `frontend/src/components/konfi/pages/KonfiRequestsPage.tsx` - Pending Queue-Anträge Anzeige
- `frontend/src/services/writeQueue.ts` - resolveLocalPhoto Helfer + Filesystem Import

## Decisions Made
- crypto.randomUUID() statt uuid-Paket: Bereits im Projekt-Pattern (writeQueue generateId), kein Extra-Dependency nötig
- resolveLocalPhoto in writeQueue.ts: Saubere Trennung, Flush-Logik kennt Foto-Upload-Prozess
- Pending Items als separate IonList-Sektion: Kein Umbau von RequestsView nötig, Items verschwinden nach Flush automatisch

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Konfi-Aktionen (Anträge + Opt-out) sind offline-fähig
- writeQueue hat Foto-Upload-Unterstützung für beliebige Queue-Items
- Bereit für Plan 04 (Admin-Queue / Teamer-Queue)

---
*Phase: 60-queue-kern-konfi-aktionen*
*Completed: 2026-03-21*
