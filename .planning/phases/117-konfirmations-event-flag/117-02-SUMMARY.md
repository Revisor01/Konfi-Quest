---
phase: 117-konfirmations-event-flag
plan: 02
subsystem: frontend-events
tags: [events, konfirmation, ui, rbac-admin, konfi-view]
requires:
  - "117-01: Backend liefert/akzeptiert is_konfirmation (boolean) in GET/POST/PUT /events"
provides:
  - "is_konfirmation im Event-Typ (frontend/src/types/event.ts)"
  - "Toggle Konfirmation neben Pflicht-Event im Event-Formular"
  - "is_konfirmation in EventFormData + EventModal-Payload (POST/PUT)"
  - "Flag-basierte Konfirmation-Erkennung in Konfi-EventsView + Admin-EventDetailView"
  - "Lila Faerbung (var(--app-color-konfis)) fuer Konfirmations-Events"
affects:
  - "frontend/src/components/konfi/views/EventsView.tsx"
  - "frontend/src/components/admin/views/EventDetailView.tsx"
  - "frontend/src/components/admin/modals/EventModal.tsx"
  - "frontend/src/components/admin/modals/EventFormSections.tsx"
tech-stack:
  added: []
  patterns:
    - "Bestehende app-toggle--konfis Klasse (lila) fuer das Konfirmation-Toggle"
    - "Bestehendes Corner-Badge-System (zweites Badge flame-Icon) flag-getriggert"
key-files:
  created:
    - ".planning/phases/117-konfirmations-event-flag/117-02-SUMMARY.md"
  modified:
    - "frontend/src/types/event.ts"
    - "frontend/src/components/admin/modals/EventFormSections.tsx"
    - "frontend/src/components/admin/modals/EventModal.tsx"
    - "frontend/src/components/konfi/views/EventsView.tsx"
    - "frontend/src/components/admin/views/EventDetailView.tsx"
decisions:
  - "Toggle-Farbklasse: app-toggle--konfis (lila, var(--app-color-konfis)) — passt zur Konfirmations-/Konfis-Domaene, existierte bereits"
  - "Konfirmation automatisch lila (Locked Decision), Status-Farbe von blau (--app-color-info) auf lila (--app-color-konfis) umgestellt"
metrics:
  duration: "ca. 10 Minuten"
  completed: "2026-06-09"
requirements: [KONF-03, KONF-05, KONF-06]
---

# Phase 117 Plan 02: Konfirmations-Event-Flag Frontend Summary

is_konfirmation-Flag durchgaengig im Frontend verdrahtet: Toggle Konfirmation neben Pflicht-Event, Flag-basierte Erkennung (statt category_names-String) in Konfi- und Admin-Views, automatische lila Faerbung + bestehendes zweites Corner-Badge.

## Was umgesetzt wurde

### Task 1 — Typ + Formular-Toggle + EventModal-Verkabelung (Commit c7b2f14)
- `frontend/src/types/event.ts`: `is_konfirmation?: boolean;` im Pflicht/Optionen-Block (nach `mandatory?`).
- `frontend/src/components/admin/modals/EventFormSections.tsx`:
  - `is_konfirmation: boolean;` in `EventFormData`-Interface.
  - Neues `IonItem lines="inset"` mit `IonLabel position="stacked"` "Konfirmation" + `IonToggle` direkt nach dem "Pflicht-Event"-Toggle. Toggle-Klasse: **`app-toggle--konfis`** (lila). `checked={formData.is_konfirmation}`, `onIonChange` setzt `is_konfirmation`, `disabled={loading}`, `slot="end"`.
- `frontend/src/components/admin/modals/EventModal.tsx`:
  - Default-State: `is_konfirmation: false`.
  - Edit-Init: `is_konfirmation: event.is_konfirmation || false`.
  - Neu-Reset: `is_konfirmation: false`.
  - Payload: `is_konfirmation: formData.is_konfirmation` — **ohne mandatory-Guards** (max_participants/registration/waitlist bleiben unberuehrt).

### Task 2 — String-Filter auf Flag + lila Faerbung (Commit 3155f0e)
- `frontend/src/components/konfi/views/EventsView.tsx`:
  - `konfirmationEvents` -> `e.is_konfirmation`, `nonKonfirmationEvents` -> `!e.is_konfirmation`.
  - `isKonfirmationEvent = event.is_konfirmation`.
  - C-Objekt um `konfis: 'var(--app-color-konfis)'` erweitert; Konfirmation-Status-Farbe von `C.info` (blau) auf `C.konfis` (lila).
  - Zweites Corner-Badge (flame-Icon, :344-355) unveraendert — wird nun durch das flag-basierte `isKonfirmationEvent` getriggert.
  - Tabs/Counts/getFilteredEvents nutzen die umgestellten useMemo-Filter automatisch korrekt.
- `frontend/src/components/admin/views/EventDetailView.tsx`:
  - `isKonfirmationEvent` in `getStatusColors` und `getStatusText` -> `eventData.is_konfirmation`.
  - `konfirm`-Farbe von `var(--app-color-info)` (blau) auf `var(--app-color-konfis)` (lila).
  - "Konfirmation"-Status-Text bleibt.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] is_konfirmation ins lokale Event-Interface der EventDetailView ergaenzt**
- **Found during:** Task 2 (tsc-Fehler TS2339)
- **Issue:** EventDetailView.tsx definiert ein eigenes lokales `interface Event` (Zeile 37ff), NICHT den Typ aus `types/event.ts`. Ohne Ergaenzung schlug tsc bei `eventData.is_konfirmation` fehl.
- **Fix:** `is_konfirmation?: boolean;` analog zu `mandatory?` ins lokale Event-Interface ergaenzt.
- **Files modified:** frontend/src/components/admin/views/EventDetailView.tsx
- **Commit:** 3155f0e

## Verifikation (automatisiert)

- `grep -rn "includes('konfirmation')"` in EventsView + EventDetailView -> **0 Treffer** (alle String-Checks entfernt).
- `grep -c is_konfirmation`: event.ts=1, EventFormSections=3, EventModal=4, EventsView=3, EventDetailView=3 (alle >= Acceptance).
- `npx tsc --noEmit -p tsconfig.json` -> **grun, keine neuen Fehler**.
- Emoji-Check ueber alle 5 Dateien -> **keine Emojis**, echte Umlaute.

## Known Stubs

Keine.

## Human-Verify (OFFEN — vom User durchzufuehren)

Der `checkpoint:human-verify` (Task 3) wurde bewusst NICHT vom Executor abgeschlossen. Voraussetzung: Frontend gebaut + Xcode-Build (Capacitor), Backend mit Migration aus 117-01.

1. **Event-Formular (Admin/Teamer):** Toggle "Konfirmation" muss neben "Pflicht-Event" stehen (lila Toggle). Aktivieren + speichern.
2. **Konfi-EventsView:** Konfirmations-Event muss **lila** sein + zweites Corner-Badge mit Flammen-Icon "Konfirmation" tragen. Erscheint im Tab "Konfi", NICHT im Tab "Alle".
3. **Event bearbeiten:** Toggle zeigt gespeicherten Zustand korrekt; aus-/einschalten + speichern wirkt.
4. **Admin-EventDetailView:** Status/Header muss **lila** sein, Status-Text "Konfirmation".
5. **Migrierte Alt-Events** (vormals ueber Kategorie "Konfirmation"): tragen jetzt das Flag, lila + Badge; Kategorie "Konfirmation" nicht mehr im Auswahl-Dialog.

## Notiz
Nach Frontend-Aenderung ist ein Xcode-Build noetig (Capacitor). Frontend-Tests/Build laufen in der CI.

## Self-Check: PASSED
- Alle 5 modifizierten Dateien existieren und enthalten is_konfirmation.
- Commits c7b2f14 + 3155f0e existieren im Log.
