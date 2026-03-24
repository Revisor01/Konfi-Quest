---
phase: 95-chat-farbschema-korrekturen
plan: "01"
subsystem: frontend/chat
tags: [css, design, farbschema, chat]
dependency_graph:
  requires: []
  provides: [chat-raumtyp-farben, css-klassen-raumtypen]
  affects: [ChatOverview, ChatRoomSections, ChatRoom]
tech_stack:
  added: []
  patterns: [CSS-Klassen statt inline styles, Helper-Funktion fuer Farbmapping]
key_files:
  created: []
  modified:
    - frontend/src/theme/variables.css
    - frontend/src/components/chat/ChatOverview.tsx
    - frontend/src/components/chat/ChatRoomSections.tsx
    - frontend/src/components/chat/ChatRoom.tsx
decisions:
  - "Chat-Raumtyp-Farben als CSS-Klassen statt inline styles (app-list-item--team, app-icon-circle--chat-jahrgang etc.)"
  - "Jahrgang-Chat-Klassen als --chat-jahrgang benannt (statt --jahrgang) um Kollision mit bestehender .app-list-item--jahrgang (#007aff) zu vermeiden"
  - "ChatHeader-Farbe als 3px borderBottom auf IonToolbar — dezenter Akzent statt vollflaeche Hintergrundfarbe"
metrics:
  duration_seconds: 134
  completed_date: "2026-03-24"
  tasks_completed: 2
  files_changed: 4
---

# Phase 95 Plan 01: Chat-Farbschema-Korrekturen Summary

**One-liner:** Einheitliches Chat-Farbschema via CSS-Klassen: admin=Rosa (#e11d48), jahrgang=Tuerkis, group=Orange, direct=Lila — konsistent in ChatOverview und ChatRoom Header.

## Was wurde gebaut

Korrektes Farbschema fuer alle Chat-Raumtypen ueber alle Rollen hinweg:

- **Team/Admin-Chats** (type: admin): Rosa #e11d48 — war zuvor faelschlicherweise Tuerkis
- **Jahrgangs-Chats** (type: jahrgang): Tuerkis #06b6d4 — unveraendert, aber jetzt via CSS-Klasse
- **Gruppen-Chats** (type: group): Orange #f97316 — unveraendert
- **Konfi/Direktchats** (type: direct): Lila #5b21b6 — unveraendert

## Tasks

### Task 1: CSS-Klassen fuer Raumtyp-Farben + ChatOverview Farblogik
**Commit:** ad3c177

- 12 neue CSS-Klassen in variables.css: `app-list-item--team/chat-jahrgang/konfi/group`, entsprechende `app-corner-badge--*` und `app-icon-circle--*` Klassen
- Selected-State Klasse fuer team (Rosa mit 8% Opacity Hintergrund)
- `getRoomColor()` und `getRoomColorClass()` Helper-Funktionen in ChatOverview
- Alle 3 inline styles (borderLeftColor, backgroundColor x2) durch CSS-Klassen ersetzt

### Task 2: ChatRoom Header-Farbe nach Raumtyp
**Commit:** b48a5a8

- `ChatHeaderProps` um `roomType: string` erweitert
- `getHeaderColor()` Helper-Funktion mit identischem Farbmapping
- IonToolbar erhaelt `borderBottom: 3px solid ${headerColor}` als dezenten Farb-Akzent
- ChatRoom.tsx uebergibt `room?.type ?? 'group'` als `roomType` prop

## Deviations from Plan

### Auto-fixed Issues

Keine Abweichungen — Plan wurde exakt wie geplant ausgefuehrt.

### Technische Entscheidung: Klassen-Naming

Der Plan sah `app-list-item--jahrgang` als CSS-Klasse vor, aber diese existiert bereits in variables.css mit Farbe `#007aff` (Blau fuer "Jahrgaenge" in anderen Kontexten). Um Kollision zu vermeiden, wurde `app-list-item--chat-jahrgang` mit `#06b6d4` (Tuerkis) verwendet. Tracked als Rule 1 (Bug-Prevention).

## Known Stubs

Keine Stubs — alle Farben sind korrekt verdrahtet.

## Self-Check

### Dateien vorhanden
- frontend/src/theme/variables.css — vorhanden
- frontend/src/components/chat/ChatOverview.tsx — vorhanden
- frontend/src/components/chat/ChatRoomSections.tsx — vorhanden
- frontend/src/components/chat/ChatRoom.tsx — vorhanden

### Commits vorhanden
- ad3c177 — feat(95-01): CSS-Klassen fuer Raumtyp-Farben + ChatOverview Farblogik
- b48a5a8 — feat(95-01): ChatRoom Header-Farbe nach Raumtyp

### TypeScript Build
- npx tsc --noEmit: keine Fehler

## Self-Check: PASSED
