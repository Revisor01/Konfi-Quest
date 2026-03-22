---
phase: 85
plan: "02"
subsystem: backend
tags: [cleanup, rename, migration, validation, activity_requests]
dependency_graph:
  requires: []
  provides:
    - konfi-management.js korrekt benannt
    - 077_activity_requests_rename_konfi_id.sql Migration
    - activity_requests.user_id statt konfi_id in allen Queries
    - express-validator auf material.js und teamer.js
  affects:
    - backend/routes/konfi-management.js
    - backend/routes/activities.js
    - backend/routes/konfi.js
    - backend/routes/organizations.js
    - backend/migrations/
    - backend/routes/material.js
    - backend/routes/teamer.js
tech_stack:
  added: []
  patterns:
    - express-validator body/param Validierung
    - Idempotente PostgreSQL DO-Block Migration
key_files:
  created:
    - backend/routes/konfi-management.js
    - backend/migrations/077_activity_requests_rename_konfi_id.sql
  modified:
    - backend/server.js
    - backend/routes/activities.js
    - backend/routes/konfi.js
    - backend/routes/organizations.js
    - backend/routes/material.js
    - backend/routes/teamer.js
decisions:
  - konfi-managment.js als neue Datei angelegt (nicht git-rename), damit Historie clean bleibt
  - teamer.js hat keine PUT /:id Route fuer name/icon -- Validierung daher auf certificate-types und certificates Routen fokussiert
metrics:
  duration: "~20 min"
  completed: "2026-03-22"
  tasks_completed: 3
  files_changed: 8
requirements:
  - CLN-07
  - CLN-08
  - CLN-09
---

# Phase 85 Plan 02: Datei-Typo, activity_requests Schema-Rename, Input-Validierung Summary

**One-liner:** Tippfehler in Route-Dateinamen behoben, activity_requests.konfi_id per idempotenter Migration auf user_id umbenannt (7 Dateien), express-validator auf material.js und teamer.js ergänzt.

## What Was Built

### Task 1: konfi-managment.js umbenennen (CLN-07)
- `backend/routes/konfi-managment.js` (Tippfehler) gelöscht
- `backend/routes/konfi-management.js` (korrekt) erstellt mit identischem Inhalt
- `backend/server.js` require-Pfad auf `'./routes/konfi-management'` korrigiert

### Task 2: activity_requests.konfi_id → user_id (CLN-08)
- Migration `077_activity_requests_rename_konfi_id.sql` mit idempotenter DO-Block Struktur erstellt
- `activities.js`: 3 SQL-JOIN Stellen + SELECT-Feld + alle `request.konfi_id` JS-Vars auf `request.user_id`
- `konfi.js`: JOIN, WHERE, SELECT-Felder, INSERT, JS-Variable `request.konfi_id` auf user_id
- `konfi-management.js`: 2 DELETE-Statements auf `WHERE user_id = $1`
- `organizations.js`: 2 JOIN-Stellen `ar.konfi_id = kp.user_id` auf `ar.user_id = kp.user_id`

### Task 3: express-validator auf material.js und teamer.js (CLN-09)
- `material.js`: validateCreateTag, validateUpdateTag, validateCreateMaterial, validateUpdateMaterial
- `teamer.js`: validateCreateCertificateType, validateUpdateCertificateType, validateCertificate
- Alle Middleware jeweils in die betroffenen Router-Definitionen eingefügt

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | f63f792 | chore(85-02): konfi-managment.js -> konfi-management.js umbenennen |
| Task 2 | fea6f07 | feat(85-02): activity_requests.konfi_id -> user_id Migration und Query-Anpassungen |
| Task 3 | c5033cd | feat(85-02): express-validator Validierung auf material.js und teamer.js ergänzen |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] teamer.js hat keine PUT /:id Route für name/icon/is_active**
- **Found during:** Task 3
- **Issue:** Plan beschreibt `validateUpdateTeamer` für `PUT /:id`, aber diese Route existiert nicht in `teamer.js`. Die mutierbaren Routen sind stattdessen `POST /certificate-types`, `PUT /certificate-types/:id` und `POST /:userId/certificates`.
- **Fix:** Validierung auf die tatsächlich existierenden Routen angepasst (validateCreateCertificateType, validateUpdateCertificateType, validateCertificate)
- **Files modified:** backend/routes/teamer.js
- **Commit:** c5033cd

## Known Stubs

Keine - alle Änderungen sind vollständig implementiert und verwenden Produktivdaten.

## Self-Check: PASSED

- backend/routes/konfi-management.js: FOUND
- backend/migrations/077_activity_requests_rename_konfi_id.sql: FOUND
- backend/routes/material.js: FOUND
- backend/routes/teamer.js: FOUND
- Commit f63f792: FOUND
- Commit fea6f07: FOUND
- Commit c5033cd: FOUND
