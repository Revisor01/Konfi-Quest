---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: App-Resilienz
status: unknown
stopped_at: Completed 61-03-PLAN.md (TeamerEventsPage Queue)
last_updated: "2026-03-21T11:29:43.234Z"
progress:
  total_phases: 15
  completed_phases: 6
  total_plans: 22
  completed_plans: 20
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung
**Current focus:** Phase 61 — Admin- + Teamer-Queue

## Current Position

Phase: 61 (Admin- + Teamer-Queue) — EXECUTING
Plan: 2 of 3

## Accumulated Context

### Decisions

All v1.0-v1.9 decisions archived in PROJECT.md Key Decisions table.

- Queue-Scope erweitert: Nicht nur Chat + Antraege, sondern auch Admin-CRUD (Events, Aktivitaeten, Badges, Kategorien, Jahrgaenge, Level, Zertifikate, Material)
- Kein globales Offline-Banner, stattdessen kontextbezogene UI (Corner-Badge Uhr-Icon, Button-Text "Du bist offline")
- Corner-Badge System: Flex-Container mit korrekten Rundungen fuer 1-3 Badges nebeneinander (Referenz: PointsHistoryModal)
- Material mit Dateien in Queue: Metadaten + Datei-Referenz in Queue, Datei lokal in Capacitor Filesystem, Upload nur im Vordergrund
- Teamer kann Events offline buchen/abmelden (anders als Konfi, da Teamer keine Kapazitaetspruefung braucht)
- [Phase 55]: Debounce 300ms fuer Netzwerkwechsel, Web-Fallback mit navigator.onLine, optimistischer Start (_isOnline = true)
- [Phase 55]: TokenStore Pattern: sync Memory-Getter + async Preferences-Setter fuer Axios-Interceptor Kompatibilitaet
- [Phase 55]: LIMIT 200 als Sicherheitsgrenze fuer ?after Chat-Queries
- [Phase 55]: Alias-Import setTokenStoreUser um Namenskollision mit AppContext setUser zu vermeiden
- [Phase 56-01]: cache: Praefix fuer Key-Isolation, clearAll loescht nur Cache-Keys nicht Auth-Daten
- [Phase 56]: KonfiEventDetailPage nicht migriert - delegiert an shared EventDetailView, kein eigener API-Call
- [Phase 56]: ChatRoom Hybrid-Pattern: useOfflineQuery Initial-Load + lokaler State fuer WebSocket Live-Updates
- [Phase 56]: TeamerMaterialPage: Client-seitiges Filtern statt API-Params fuer vollstaendigen Offline-Cache
- [Phase 56]: TeamerKonfiStatsPage teilt Cache-Key mit TeamerProfilePage (SWR-Deduplizierung)
- [Phase 56]: AdminSettingsPage hat keine API-Calls, keine Migration noetig
- [Phase 56]: AdminProfilePage nutzt userId statt organization_id (persoenliche Daten)
- [Phase 56]: AdminMaterialPage: search+filter im Cache-Key fuer granulares Offline-Caching
- [Phase 57]: Check-then-Insert + UNIQUE-Index-Fallback fuer Idempotency statt ON CONFLICT
- [Phase 57]: axios-retry mit Jitter zur Thundering-Herd-Vermeidung, guardRef fuer synchronen Double-Submit-Check
- [Phase 58]: font-weight von 600 auf 700 angeglichen (PointsHistory-Referenz)
- [Phase 58]: AdminInvitePage: exakter Farbton #059669 beibehalten statt --success Klasse
- [Phase 59]: Queue-Status Icons neben Zeitstempel statt separater Bereich
- [Phase 59]: Handler-Guards + Button-Disable auf beiden Ebenen fuer doppelte Offline-Sicherheit
- [Phase 59]: QRScannerModal: Inline-Banner statt Alert bei Offline-Scan
- [Phase 59]: Icon-only Submit-Buttons zeigen 'Du bist offline' als Text statt Icon wenn offline
- [Phase 59]: Action-Handler ohne Submit-Button haben if (\!isOnline) return; Guard
- [Phase 60]: Lazy-Load In-Memory-Cache statt _initialized Pattern fuer WriteQueue
- [Phase 60]: Transiente Fehler brechen Flush ab statt naechstes Item — verhindert Out-of-Order
- [Phase 60]: crypto.randomUUID() statt uuid-Paket für clientId-Generierung
- [Phase 60]: resolveLocalPhoto in writeQueue.ts für Zwei-Schritt Foto-Upload beim Flush
- [Phase 60]: Pending Queue-Items als separate IonList-Sektion über RequestsView
- [Phase 60]: crypto.randomUUID statt uuid-Library fuer clientId/localId — vermeidet Dependency
- [Phase 60]: Optimistic Message mit negativer ID (-Date.now()) als temporaerer Platzhalter
- [Phase 60]: Fire-and-Forget offline: Kein Queue-Feedback, rein optimistisch, maxRetries 3
- [Phase 61]: Kein refresh/selectedEvent-Update im Offline-Pfad — Daten kommen erst nach Queue-Flush

### Roadmap Evolution

- 2026-03-20: v2.1 Roadmap erstellt — 8 Phasen (55-62), 122 Requirements, Dependency Chain STR+NET -> CAC -> RET -> OUI+OOA -> QUE+SYN
- Phase 63 added: Codebase Cleanup — Quick-Wins, Konsolidierung, Bug-Fixes
- Phase 64 added: DB-Schema-Konsolidierung — Einheitliches Schema, Altlasten, Indizes, Foreign Keys
- Phase 65 added: Navigation und State-Konsistenz — Router-Migration, CustomEvents → LiveUpdateContext
- Phase 66 added: Error Boundary und Sicherheitshärtung
- Phase 67 added: Performance-Optimierung — Mega-Komponenten, Memoization, SELECT *, BackgroundService
- Phase 68 added: Token-Refresh-System
- Phase 69 removed: Dependency-Upgrades — Ionic 8 inkompatibel mit react-router v6/v7
- Phase 69 added: Universeller Datei-Viewer — Fullscreen Zoom/Pan für Chat + Material

### Pending Todos

- v3.0 Milestone geplant: Onboarding, Landing Website, Readme, Wiki

### Blockers/Concerns

- Research Flag: Phase 60 (Queue) — Socket.io + HTTP-Idempotency-Interaktion pruefen
- Research Flag: Phase 62 (Sync) — updated_at Felder auf DB-Tabellen pruefen
- Research Flag: Phase 69 (Datei-Viewer) — Library-Wahl (react-zoom-pan-pinch vs swiper vs eigene Loesung), Capacitor-Kompatibilitaet, FileViewerModal Refactor-Scope

## Session Continuity

Last session: 2026-03-21T11:29:43.231Z
Stopped at: Completed 61-03-PLAN.md (TeamerEventsPage Queue)
Resume file: None
