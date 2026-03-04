---
phase: 12-bug-fixes-sicherheit
plan: 02
subsystem: auth
tags: [smtp, password-reset, security, ionic-alert, clipboard-api]

# Dependency graph
requires:
  - phase: 12-bug-fixes-sicherheit
    provides: "RBAC System und Auth-Infrastruktur"
provides:
  - "Funktionierender Passwort-Reset-Flow mit SMTP-Validierung"
  - "Sicheres Einmalpasswort-System ohne Klartext-Speicherung"
  - "ResetPasswordPage mit korrekten Umlauten und Zurück-Button"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Einmalpasswort-Pattern: temporäres Passwort nur einmalig im Alert anzeigen"
    - "SMTP Transporter-Caching mit Fehler-Invalidierung"

key-files:
  created: []
  modified:
    - backend/services/emailService.js
    - backend/routes/auth.js
    - frontend/src/components/auth/ResetPasswordPage.tsx
    - backend/routes/konfi-managment.js
    - frontend/src/components/admin/views/KonfiDetailView.tsx

key-decisions:
  - "Eigener passwordResetLimiter (5 req/15min) statt Login-Limiter für /request-password-reset"
  - "Einmalpasswort im Alert mit Kopier-Button statt Toast-Nachricht"
  - "password_plain wird auf NULL gesetzt statt Spalte zu entfernen (nicht-destruktiv)"

patterns-established:
  - "Einmalpasswort-Pattern: temporaryPassword in Response, Alert mit navigator.clipboard.writeText"

requirements-completed: [BUG-04, BUG-05, BUG-06, SEC-01]

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 12 Plan 02: Auth-Bugs und Einmalpasswort Summary

**Passwort-Reset-Flow mit SMTP-Validierung und sicheres Einmalpasswort-System mit Kopier-Button statt Klartext-Anzeige**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T00:01:58Z
- **Completed:** 2026-03-03T00:05:54Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- E-Mail-Service mit SMTP-Credentials-Validierung und Transporter-Caching
- Eigener Rate-Limiter für Passwort-Reset (getrennt vom Login-Limiter)
- Zurück-zum-Login Button in ResetPasswordPage hinzugefügt
- Klartext-Passwort komplett aus Backend-Responses und Frontend-State entfernt
- Einmalpasswort wird nur einmalig im Alert mit Kopier-Button angezeigt

## Task Commits

Jeder Task wurde atomar committed:

1. **Task 1: ForgotPassword-Mail-Bug + ResetPassword-Umlaute + Zurück-Button** - `2987178` (fix) -- bereits im vorherigen Plan-Commit enthalten
2. **Task 2: SEC-01 -- Einmalpasswort statt Klartext-Passwort-Anzeige** - `4110c0a` (fix)

## Files Created/Modified
- `backend/services/emailService.js` - SMTP-Validierung, Transporter-Caching, dynamisches SMTP_FROM
- `backend/routes/auth.js` - Eigener passwordResetLimiter für /request-password-reset
- `frontend/src/components/auth/ResetPasswordPage.tsx` - arrowBack Import, Zurück-Button im Formular
- `backend/routes/konfi-managment.js` - password_plain auf NULL setzen, temporaryPassword in Response, password_plain aus SELECT entfernt
- `frontend/src/components/admin/views/KonfiDetailView.tsx` - ActionSheet durch Alert ersetzt, Einmalpasswort mit Kopier-Button, loadedPassword/password State entfernt

## Decisions Made
- Eigener passwordResetLimiter (5 req/15min) statt Login-Limiter: Verhindert dass fehlgeschlagene Login-Versuche den Reset-Flow blockieren
- password_plain wird auf NULL gesetzt statt Spalte zu entfernen: Nicht-destruktive Änderung, existierende Daten werden beim nächsten Regenerieren bereinigt
- Einmalpasswort im Alert mit Kopier-Button: Admin kann Passwort kopieren und weitergeben, kein Klartext in Toast oder persistent im State

## Deviations from Plan

### Vorherige Ausführung

**Task 1 war bereits im Commit 2987178 (12-01 Plan) enthalten.** Der vorherige Plan-Executor hat die Änderungen für emailService.js, auth.js und ResetPasswordPage.tsx zusammen mit den 12-01 Änderungen committed. Die Änderungen sind korrekt und vollständig -- es musste nur noch Task 2 (SEC-01) ausgeführt werden.

---

**Total deviations:** 0 auto-fixed, 1 Vorarbeit durch vorherigen Plan erkannt
**Impact on plan:** Kein Scope-Creep. Task 1 war bereits korrekt umgesetzt.

## Issues Encountered
None

## User Setup Required
None - keine externe Service-Konfiguration erforderlich.

## Next Phase Readiness
- Auth-System vollständig repariert und abgesichert
- Passwort-Reset-Flow funktioniert mit SMTP-Validierung
- Konfi-Passwort-Management sicher (kein Klartext mehr)
- Phase 12 Bug-Fixes abgeschlossen, bereit für Phase 13

## Self-Check: PASSED

- All 5 modified files exist
- Commit 4110c0a (Task 2) found
- Commit 2987178 (Task 1, from 12-01) found
- password_plain: nur NULL-Setzung in konfi-managment.js
- loadedPassword: entfernt
- Klartext-Passwort in Toast: entfernt

---
*Phase: 12-bug-fixes-sicherheit*
*Completed: 2026-03-03*
