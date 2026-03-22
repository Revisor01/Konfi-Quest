---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Codebase-Hardening
status: unknown
stopped_at: Completed 74-01-PLAN.md
last_updated: "2026-03-22T09:27:56.278Z"
progress:
  total_phases: 19
  completed_phases: 11
  total_plans: 25
  completed_plans: 24
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung
**Current focus:** Phase 74 — Nativer Datei-Viewer

## Current Position

Phase: 74 (Nativer Datei-Viewer) — EXECUTING
Plan: 2 of 2

## Accumulated Context

### Decisions

All v1.0-v2.1 decisions archived in PROJECT.md Key Decisions table and milestones/.

- [Phase 63]: reduce-Accumulator mit generischem Typ-Parameter statt as any[] typisiert
- [Phase 63]: Zentrale Type-Dateien: User (BaseUser/AdminUser/ChatUser) und Event in types/ — alle Consumer importieren
- [Phase 64]: Schema-Definition in Migrations statt inline in Route-Dateien — badges.js Renames bleiben inline (komplexe Existenz-Checks)
- [Phase 64]: 73 Indizes basierend auf WHERE/JOIN-Analyse aller 17 Routes, Composite-Indizes nur wo Multi-Column-WHERE
- [Phase 64]: Alle 23 FKs mit ON DELETE CASCADE passend zur Organization-Delete-Kaskade
- [Phase 65]: LiveUpdateType um users + organizations erweitert fuer zukuenftige Nutzung
- [Phase 65]: System-Events (sync:reconnect, rate-limit) bleiben als window.addEventListener — nur Daten-Events ueber useLiveRefresh
- [Phase 66]: ErrorBoundary als Class Component innerhalb Provider-Kette, helmet-Config unveraendert (Audit bestanden)
- [Phase 67]: Component-Splitting: Haupt-Datei behaelt State/Effects/Handler, Sektionen-Datei bekommt React.memo JSX-Komponenten
- [Phase 67]: DashboardView Sektionen-Datei mit 16 Exports, ChatRoom bleibt bei 1124z (Custom-Hooks waere architekturelle Aenderung)
- [Phase 68]: SHA-256 fuer Refresh-Token-Hash konsistent mit Phase 66 Pattern
- [Phase 68]: Token-Rotation: altes Refresh-Token wird bei jedem Refresh sofort revoked
- [Phase 68]: Cleanup-Job im Auth-Modul via setInterval (24h Intervall)
- [Phase 68]: axios.post direkt fuer Refresh-Call um Interceptor-Loop zu vermeiden
- [Phase 68]: Subscriber-Pattern fuer parallele 401-Requests, auth:relogin-required CustomEvent
- [Phase 69]: Eigene Pinch-to-Zoom statt Library (CSS transform + Touch-Events), dunkles Overlay-UI statt IonPage
- [Phase 69]: API-Pfade als FileItem-URLs mit lazy Blob-Aufloesung im Viewer statt Vorladen aller Dateien
- [Phase 70-01]: S2 organizations.js bereits korrekt - kein Code-Change, nur Verifikation
- [Phase 70]: Timeslots/Participants separat ohne Cache laden — nur Event-Stammdaten gecacht
- [Phase 70]: KonfiRequestsPage Delete-Handler nutzt setError statt silent return — Swipe-Actions haben kein disabled
- [Phase 71]: margin-top statt padding-top bei .app-icon-circle (Icon-Position erhalten)
- [Phase 71]: Hauptmetriken einmalig per Promise.all abfragen statt pro Badge einzeln
- [Phase 71]: teamer_year Kategorie zwischen event_count und collection platziert
- [Phase 71]: Geheime Badge-Visibility als separates Segment (orthogonal zu Hauptfilter)
- [Phase 71]: Dashboard Badge-Platzhalter auf max 12 begrenzt
- [Phase 72]: Eigener Teamer-Endpoint statt /admin/konfis — sicherer, nur zugewiesene Jahrgaenge
- [Phase 72]: Cache-Luecken (D-14) sind erwartetes useOfflineQuery-Verhalten, kein Bug
- [Phase 72]: Searchbar in Pages statt Views eingefuegt - clientseitiger Filter vor Weitergabe
- [Phase 72]: user.type === 'teamer' als Unterscheidung fuer Konfis-Endpoint im DirectMessageModal
- [Phase 73]: Automatisches natives Oeffnen per useEffect bei PDF/DOCX auf nativer Plattform
- [Phase 73]: pageRef.current direkt im onClick statt presentingElement fuer Modal-Backdrop
- [Phase 73]: Task 3 keine Aenderung noetig — app-description-text bereits korrekt
- [Phase 74]: openFileNatively als separate Utility-Datei statt in bestehendem Modal
- [Phase 74]: Bilder via FileOpener, alles andere via FileViewer

### Roadmap Evolution

- 2026-03-21: v2.1 App-Resilienz shipped (8 Phasen, 23 Plans, 122 Requirements)
- 2026-03-21: Phasen 63-69 als v2.2 Codebase-Hardening markiert
- Phase 70 added: Rollen-Audit Fixes — Sicherheit, Logik, Frontend-Konsistenz
- Phase 71 added: Teamer+Badge Polish — Profil-Modale, Badge-Grid, Listen-Padding, Dashboard-Badges, Jahres-Badge-Luecken, Zertifikat-Karten
- Phase 72 added: UI-Testing Fixes — Suchleiste, Event-Suche, Teamer-Chat 403, Cache-Luecken, Offline-Icon
- Phase 73 added: Testing-Fixes Runde 2 — Stats, Backdrop, Back-Pfeile, Material-Text, FileViewer PDF/DOCX
- Phase 74 added: Nativer Datei-Viewer — FileViewer/FileOpener nativ, FileViewerModal nur Web-Fallback, Chat-Video onClick Fix

### Pending Todos

- v3.0 Milestone geplant: Onboarding, Landing Website, Readme, Wiki

### Blockers/Concerns

- Research Flag: Phase 69 (Datei-Viewer) — Library-Wahl (react-zoom-pan-pinch vs swiper vs eigene Loesung)

## Session Continuity

Last session: 2026-03-22T09:27:56.275Z
Stopped at: Completed 74-01-PLAN.md
Resume file: None
