---
phase: 41-zertifikate-dashboard
plan: 01
subsystem: api
tags: [certificates, dashboard, settings, teamer, postgresql]

requires:
  - phase: 40-badges-aktivitaeten
    provides: "Teamer-Badges, custom_badges Tabelle, user_badges"
provides:
  - "certificate_types + user_certificates DB-Tabellen"
  - "Zertifikat-Typen CRUD-Endpoints"
  - "Zertifikat-Zuweisung an Teamer"
  - "Teamer-Dashboard-Endpoint (/teamer/dashboard)"
  - "Teamer-Dashboard-Config-Flags in Settings"
  - "Zertifikate im Konfi-Management Teamer-Detail"
affects: [41-02-frontend-dashboard, admin-settings]

tech-stack:
  added: []
  patterns: [idempotente-migration-in-route, dashboard-aggregation-endpoint]

key-files:
  created: []
  modified:
    - backend/routes/teamer.js
    - backend/routes/settings.js
    - backend/routes/konfi-managment.js

key-decisions:
  - "Idempotente Migration fuer Zertifikat-Tabellen direkt in teamer.js (gleich wie badges.js)"
  - "Events-Query im Dashboard nutzt teamer_only/teamer_needed statt target_role"
  - "Konfi-Management liefert Zertifikate nur wenn role_name='teamer'"

patterns-established:
  - "Teamer-Dashboard-Endpoint: Aggregiert greeting, certificates, events, badges, config in einem Request"
  - "Zertifikat-Status Berechnung: valid/expired/not_earned per SQL CASE"

requirements-completed: [ZRT-01, ZRT-03, DSH-01, DSH-02, DSH-03, DSH-04]

duration: 3min
completed: 2026-03-11
---

# Phase 41 Plan 01: Zertifikate + Dashboard Backend Summary

**Zertifikat-CRUD, Teamer-Dashboard-Endpoint mit 5 Sektionen, und Dashboard-Config-Flags in Settings**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-11T13:36:54Z
- **Completed:** 2026-03-11T13:39:38Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Idempotente DB-Migration fuer certificate_types und user_certificates Tabellen
- Vollstaendige Zertifikat-Typen CRUD-Endpoints (GET/POST/PUT/DELETE) mit Admin-Schutz
- Zertifikat-Zuweisung an Teamer mit Validierung (User existiert, ist Teamer, Typ gehoert zur Org)
- Teamer-Dashboard-Endpoint mit greeting, certificates, events, badges und config
- Settings-Erweiterung um 4 teamer_dashboard_show_* Flags
- Konfi-Management Detail liefert Zertifikate fuer Teamer

## Task Commits

1. **Task 1: DB-Migration + Zertifikat-CRUD in teamer.js** - `24f0bb4` (feat)
2. **Task 2: Settings-Erweiterung + Admin-Zertifikat-Zuweisung in konfi-management** - `aa6b0de` (feat)

## Files Created/Modified
- `backend/routes/teamer.js` - Migration, Zertifikat-CRUD, Dashboard-Endpoint
- `backend/routes/settings.js` - Teamer-Dashboard-Config-Flags (Validierung, GET, PUT)
- `backend/routes/konfi-managment.js` - Zertifikate im Teamer-Detail-Response

## Decisions Made
- Events-Tabelle hat kein target_role Feld, daher teamer_only/teamer_needed als Filter fuer Dashboard-Events
- DELETE von Zertifikat-Typen nur moeglich wenn keine user_certificates zugewiesen (409 Conflict), sonst Deaktivierung empfohlen
- Zertifikat-Status wird per SQL CASE berechnet: valid/expired/not_earned

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- konfi-management.js Dateiname hat Typo (konfi-managment.js ohne 'e') - wurde korrekt verwendet

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Alle Backend-Endpoints bereit fuer Frontend-Konsumierung in Plan 02
- Dashboard-Endpoint liefert alle 5 Sektionen (greeting, certificates, events, badges, config)
- Settings akzeptiert Teamer-Dashboard-Konfiguration

---
*Phase: 41-zertifikate-dashboard*
*Completed: 2026-03-11*
