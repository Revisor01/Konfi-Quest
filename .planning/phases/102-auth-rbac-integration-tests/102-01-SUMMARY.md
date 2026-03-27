---
phase: 102-auth-rbac-integration-tests
plan: 01
subsystem: testing
tags: [vitest, supertest, auth, jwt, refresh-token, integration-test, postgresql]

requires:
  - phase: 101-test-infrastruktur-server-js-refactoring
    provides: createApp Factory, Test-DB Helpers, Seed-Fixtures, Auth-Token-Factory

provides:
  - 19 Auth-Lifecycle Integration-Tests gegen echte PostgreSQL Test-DB
  - 6 describe-Bloecke (Login, Refresh, Logout, /me, change-password, register-konfi)
  - Bug-Fix register-konfi fehlende organization_id

affects: [102-02, phase-103]

tech-stack:
  added: []
  patterns: [Auth-Lifecycle Test-Pattern mit Login -> Refresh -> Logout Kette]

key-files:
  created:
    - backend/tests/routes/auth.test.js
  modified:
    - backend/tests/globalSetup.js
    - backend/routes/auth.js

key-decisions:
  - "Passwoerter in Tests muessen Grossbuchstabe + Kleinbuchstabe + Zahl + Sonderzeichen enthalten (validatePassword)"
  - "Test-DB globalSetup braucht profile_image, invite_code_id, used_at Spalten"

patterns-established:
  - "Auth-Test-Pattern: Login -> extract token/refresh_token -> use in subsequent requests"
  - "Token-Rotation-Test: Login -> Refresh -> verify old token rejected"

metrics:
  duration_seconds: 402
  completed: "2026-03-27T13:39:00Z"
  tasks_completed: 1
  tasks_total: 1
  tests_added: 19
  test_file_lines: 310
---

# Phase 102 Plan 01: Auth-Lifecycle Integration-Tests Summary

19 Auth-Lifecycle Integration-Tests decken Login (Konfi/Admin/falsch/fehlend), Token-Refresh mit Rotation, Logout mit Revoke, Profil-Endpoint, Passwort-Aenderung und Konfi-Registrierung mit Invite-Code ab -- alles gegen echte PostgreSQL Test-DB.

## Task Completion

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Auth-Lifecycle Tests (Login, Refresh, Logout, /me, change-password, register-konfi) | 832882e | auth.test.js, globalSetup.js, auth.js |

## Test Coverage

| describe-Block | Tests | Inhalt |
|---------------|-------|--------|
| POST /api/auth/login | 5 | Konfi, Admin, falsches PW, fehlender User, leerer Body |
| POST /api/auth/refresh | 4 | Gueltig, Rotation (revoked), leer, ungueltig |
| POST /api/auth/logout | 3 | Mit Revoke, ohne refresh_token (best-effort), ohne Auth |
| GET /api/auth/me | 2 | Mit Token, ohne Token |
| POST /api/auth/change-password | 3 | Korrekt, falsches PW, zu kurz |
| POST /api/auth/register-konfi | 2 | Gueltiger Invite-Code, ungueltiger Code |
| **Gesamt** | **19** | |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] register-konfi fehlende organization_id im konfi_profiles INSERT**
- **Found during:** Task 1
- **Issue:** POST /api/auth/register-konfi INSERT in konfi_profiles enthielt kein organization_id, was bei NOT NULL Constraint zum 500 fuehrte
- **Fix:** organization_id aus invite-Objekt in INSERT aufgenommen
- **Files modified:** backend/routes/auth.js
- **Commit:** 832882e

**2. [Rule 3 - Blocking] Test-DB Schema fehlende Spalten**
- **Found during:** Task 1
- **Issue:** globalSetup.js fehlten profile_image (users), invite_code_id (konfi_profiles), used_at (password_resets)
- **Fix:** Spalten in globalSetup.js Step 4 ergaenzt
- **Files modified:** backend/tests/globalSetup.js
- **Commit:** 832882e

## Known Stubs

None.

## Verification

```
Test Files  2 passed (2)
     Tests  25 passed (25)  [6 smoke + 19 auth]
```

## Self-Check: PASSED
