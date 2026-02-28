---
phase: 01-security-hardening
plan: 02
subsystem: api
tags: [multi-tenant, organization-id, rbac, postgresql, notifications, settings]

# Dependency graph
requires:
  - phase: 01-security-hardening
    provides: "RBAC middleware (rbacVerifier) mit organization_id auf req.user"
provides:
  - "notifications.js mit organization_id-Filterung auf allen 3 Endpoints"
  - "settings.js mit organization_id-Filterung und idempotenter DB-Migration"
  - "Keine Route-Dateien mehr ohne Multi-Tenant-Isolation"
affects: [02-bug-fixes, 04-admin-views]

# Tech tracking
tech-stack:
  added: []
  patterns: [org-filter-via-join, idempotent-migration, upsert-with-org-key]

key-files:
  created: []
  modified:
    - backend/routes/notifications.js
    - backend/routes/settings.js
    - backend/server.js

key-decisions:
  - "Notifications braucht keinen Superadmin-Bypass, da Push-Tokens immer pro User gelten"
  - "Settings-Migration: idempotent via information_schema Check statt Migrations-Framework"
  - "Settings GET: Superadmin sieht alle Orgs, normale User nur eigene"

patterns-established:
  - "Org-Filter via JOIN users: Fuer Tabellen ohne eigene organization_id-Spalte"
  - "Idempotente ALTER TABLE: Column-Existenz pruefen via information_schema.columns"
  - "Upsert mit zusammengesetztem Key: ON CONFLICT (organization_id, key)"

requirements-completed: [SEC-02, SEC-03]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 01 Plan 02: Notifications & Settings Org-Isolation Summary

**Multi-Tenant-Isolation fuer notifications.js (rbacVerifier + JOIN-Filter) und settings.js (organization_id-Spalte + idempotente Migration)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-28T07:44:30Z
- **Completed:** 2026-02-28T07:47:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- notifications.js von verifyToken auf rbacVerifier umgestellt -- req.user hat jetzt organization_id
- Alle 3 Notification-Endpoints (POST /device-token, POST /test-push, DELETE /device-token) org-gefiltert
- settings.js komplett mit organization_id-Filterung umgeschrieben, inklusive Superadmin-Bypass im GET
- Idempotente DB-Migration fuer organization_id-Spalte in settings-Tabelle
- Sensitive Token-Daten werden nicht mehr vollstaendig in Logs ausgegeben

## Task Commits

Each task was committed atomically:

1. **Task 1: notifications.js auf rbacVerifier umstellen und Org-Isolation** - `12352f9` (fix)
2. **Task 2: settings.js mit organization_id-Filterung absichern** - `a6ac017` (fix)

## Files Created/Modified
- `backend/routes/notifications.js` - Push-Token-Endpoints mit org-gefiltertem JOIN auf users-Tabelle
- `backend/routes/settings.js` - Settings-CRUD mit organization_id, idempotente Migration, Superadmin-Bypass
- `backend/server.js` - rbacVerifier statt verifyToken fuer notificationsRoutes

## Decisions Made
- Notifications braucht keinen Superadmin-Bypass, da Push-Tokens immer pro User gelten
- Settings-Tabelle bekommt organization_id-Spalte via idempotenter Migration (kein separates Migrations-Tool)
- Settings GET: Superadmin-Bypass zeigt alle Settings org-uebergreifend
- DELETE /device-token nutzt PostgreSQL USING-Syntax fuer JOIN im DELETE

## Deviations from Plan

None - Plan exakt wie geschrieben umgesetzt.

## Issues Encountered
None

## User Setup Required
None - keine externe Service-Konfiguration erforderlich.

## Next Phase Readiness
- Alle Route-Dateien haben jetzt konsistente organization_id-Filterung
- Bereit fuer Plan 01-03 (weitere Security-Hardening-Tasks)

---
*Phase: 01-security-hardening*
*Completed: 2026-02-28*
