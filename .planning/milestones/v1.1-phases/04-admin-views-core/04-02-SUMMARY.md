---
phase: 04-admin-views-core
plan: 02
subsystem: ui
tags: [react, ionic, css, section-header, detail-views]

requires:
  - phase: 04-admin-views-core
    plan: 01
    provides: CSS-Klassen (app-detail-header, app-status-chip, app-info-box) und SectionHeader/ListSection Komponenten
provides:
  - Admin-EventDetailView mit SectionHeader und dynamischen status-basierten Farben
  - Konfi-EventDetailView mit SectionHeader und dynamischen status-basierten Farben
  - AdminProfilePage mit app-detail-header CSS-Klassen statt Inline-Styles
affects: [04-03, 04-04]

tech-stack:
  added: []
  patterns:
    - "getStatusColors() liefert {primary, secondary} Objekt fuer SectionHeader colors-Prop"
    - "Komplexe Event-Status-Logik (Konfirmation, Warteliste, Ausstehend) bleibt in getStatusColors statt registration_status-Mapping"
    - "app-detail-header CSS-Klassen fuer Profile-Header statt SectionHeader (wenn stats nicht passend)"

key-files:
  created: []
  modified:
    - frontend/src/components/admin/views/EventDetailView.tsx
    - frontend/src/components/konfi/views/EventDetailView.tsx
    - frontend/src/components/admin/pages/AdminProfilePage.tsx

key-decisions:
  - "AdminProfilePage nutzt app-detail-header CSS-Klassen statt SectionHeader, da SectionHeader stats mit value:number nicht fuer E-Mail/Datum passt (Plan Option 2)"
  - "getStatusColors liefert secondary-Farbe als dunklere Variante der primary-Farbe fuer SectionHeader-Gradient"

patterns-established:
  - "getStatusColors(): Dynamische Farben fuer SectionHeader basierend auf komplexem Event-Zustand"
  - "app-detail-header + Inline-Styles fuer dynamische Backgrounds: Nur background/boxShadow bleiben inline"

requirements-completed: [ADM-03]

duration: 5min
completed: 2026-03-01
---

# Phase 4 Plan 02: Detail-Views und AdminProfilePage auf SectionHeader/CSS-Klassen Summary

**EventDetailViews (Admin + Konfi) auf SectionHeader mit dynamischen status-basierten Farben umgestellt, AdminProfilePage auf app-detail-header CSS-Klassen migriert**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-01T16:08:23Z
- **Completed:** 2026-03-01T16:14:11Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Admin-EventDetailView Header durch SectionHeader ersetzt mit getStatusColors() fuer dynamische Farben (Konfirmation=Lila, Offen=Gruen, Warteliste=Orange, etc.)
- Konfi-EventDetailView Header durch SectionHeader ersetzt mit identischem Farb-Mapping (erweitert um Konfi-spezifische Zustaende wie Ausstehend, Angemeldet)
- AdminProfilePage Inline-Header durch app-detail-header CSS-Klassen ersetzt (Option 2, da SectionHeader-Stats nicht fuer E-Mail/Datum passen)
- Inline-Styles deutlich reduziert: Admin-EventDetailView 82->63, Konfi-EventDetailView 53->34, AdminProfilePage 23->17

## Task Commits

Each task was committed atomically:

1. **Task 1: Admin-EventDetailView auf SectionHeader und CSS-Klassen umstellen** - `6b2a28b` (refactor)
2. **Task 2: Konfi-EventDetailView und AdminProfilePage auf SectionHeader umstellen** - `fc35ad9` (refactor)

## Files Created/Modified
- `frontend/src/components/admin/views/EventDetailView.tsx` - SectionHeader mit dynamischen status-basierten Farben, getHeaderColor->getStatusColors
- `frontend/src/components/konfi/views/EventDetailView.tsx` - SectionHeader mit dynamischen status-basierten Farben, getHeaderColor->getStatusColors
- `frontend/src/components/admin/pages/AdminProfilePage.tsx` - app-detail-header CSS-Klassen statt grossem Inline-Header

## Decisions Made
- AdminProfilePage nutzt app-detail-header CSS-Klassen statt SectionHeader (Plan Option 2), da SectionHeader.stats value:number erwartet und E-Mail/Datum keine sinnvollen numerischen Werte haben
- getStatusColors() liefert {primary, secondary} statt einzelner Farbe -- secondary ist jeweils eine dunklere Variante fuer den SectionHeader-Gradient
- Verbleibende Inline-Styles sind Ionic-CSS-Custom-Properties (--background, --padding-start etc.) und dynamische Werte -- nicht sinnvoll in CSS-Klassen auslagerbar

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Detail-Views sind auf SectionHeader umgestellt, konsistent mit allen anderen Views
- AdminProfilePage nutzt CSS-Klassen, bereit fuer weitere Bereinigungen in Plan 04-03/04-04
- Alle Funktionalitaet (Attendance, Teilnehmer-Management, Event-Booking, Modals) ist unveraendert erhalten

## Self-Check: PASSED

All files found. All commits verified.

---
*Phase: 04-admin-views-core*
*Completed: 2026-03-01*
