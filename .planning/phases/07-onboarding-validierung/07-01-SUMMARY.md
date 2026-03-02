---
phase: 07-onboarding-validierung
plan: 01
subsystem: auth
tags: [jwt, express, email, invite-codes, registration]

# Dependency graph
requires:
  - phase: 06-modal-konsistenz
    provides: Design-System Grundlage und Modal-Patterns
provides:
  - Differenzierte Fehlermeldungen fuer validate-invite (404/410 mit error_code)
  - Username-Check Endpoint (GET /check-username/:username)
  - JWT Token 90 Tage Laufzeit
  - Auto-Login nach Registrierung (Token in Response)
  - invite_code_id Tracking in konfi_profiles
  - emailService.js Integration fuer Passwort-Reset
  - Multi-Use Invite Codes (used_at Bedingung entfernt)
affects: [07-02-PLAN, 07-03-PLAN, frontend-register, frontend-forgot-password]

# Tech tracking
tech-stack:
  added: []
  patterns: [emailService statt inline sendEmail, differenzierte error_code Felder in API-Responses]

key-files:
  created: []
  modified:
    - backend/routes/auth.js
    - backend/services/emailService.js

key-decisions:
  - "SMTP_SECURE Default auf true (statt false) damit Port 465 ohne explizite Env-Variable funktioniert"
  - "JWT 90d fuer Login UND Registrierung (Konfis bleiben ein Konfi-Jahr eingeloggt)"
  - "transporter Parameter in auth.js Signatur beibehalten (kein Breaking Change)"

patterns-established:
  - "error_code Feld in Fehler-Responses fuer differenzierte Frontend-Behandlung"
  - "emailService.js als zentrale E-Mail-Abstraktionsschicht"

requirements-completed: [ONB-01, ONB-02]

# Metrics
duration: 3min
completed: 2026-03-02
---

# Phase 7 Plan 1: Backend Auth Ueberarbeitung Summary

**Differenzierte Fehlermeldungen, Username-Check, JWT 90d, Auto-Login und emailService-Integration in auth.js**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-02T15:45:25Z
- **Completed:** 2026-03-02T15:48:22Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- validate-invite gibt differenzierte Fehlermeldungen (404 not_found / 410 expired) statt generischem Fehler
- Neuer GET /check-username/:username Endpoint fuer Echtzeit-Verfuegbarkeitspruefung
- JWT Token Laufzeit von 24h auf 90d erhoeht (Login + Registrierung)
- register-konfi gibt JWT Token zurueck fuer Auto-Login nach Registrierung
- invite_code_id wird in konfi_profiles gespeichert
- Passwort-Reset nutzt emailService.sendPasswordResetEmail statt inline sendEmail
- SMTP_SECURE Default auf true geaendert

## Task Commits

Each task was committed atomically:

1. **Task 1: validate-invite differenzierte Fehler + Username-Check + JWT 90d + invite_code_id** - `6a901aa` (feat)
2. **Task 2: Passwort-Reset auf emailService.js umstellen** - `47a98db` (fix)

## Files Created/Modified
- `backend/routes/auth.js` - Differenzierte Fehler, Username-Check, JWT 90d, Auto-Login, emailService
- `backend/services/emailService.js` - SMTP_SECURE Default auf true

## Decisions Made
- SMTP_SECURE Default auf `process.env.SMTP_SECURE !== 'false'` (Default true) statt `=== 'true'` (Default false), damit Port 465 auch ohne gesetzte Umgebungsvariable funktioniert
- transporter Parameter in auth.js Modul-Signatur beibehalten um Breaking Change zu vermeiden, obwohl er nicht mehr fuer E-Mail genutzt wird
- used_at IS NULL Bedingung in invite_codes Queries komplett entfernt (Multi-Use per User Decision)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Backend-Auth-Endpoints sind bereit fuer Frontend-Integration in Plan 07-02 und 07-03
- Frontend kann error_code Feld fuer differenzierte Fehlermeldungen auswerten
- Auto-Login Token kann direkt nach Registrierung gespeichert werden

## Self-Check: PASSED

All files and commits verified.

---
*Phase: 07-onboarding-validierung*
*Completed: 2026-03-02*
