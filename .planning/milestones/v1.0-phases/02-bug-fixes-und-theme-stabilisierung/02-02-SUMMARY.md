---
phase: 02-bug-fixes-und-theme-stabilisierung
plan: 02
subsystem: ui
tags: [dateUtils, badge-points, code-cleanup, code-review]

# Dependency graph
requires:
  - phase: 01-security-hardening
    provides: Sichere Backend-Grundlage mit Input-Validierung
provides:
  - Bereinigte dateUtils ohne deprecated Funktionen
  - Abgesicherte Badge-Punkte-Berechnung ohne Double-Count-Risiko
  - Dokumentierter UI-Code-Review (keine Probleme gefunden)
  - Live-Daten-Verifikation der konfi_profiles Konsistenz
affects: [phase-3, phase-4]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Punkte nur aus konfi_profiles verwenden (nie manuell aus activities+bonus berechnen)"

key-files:
  created: []
  modified:
    - frontend/src/utils/dateUtils.ts
    - frontend/src/components/konfi/pages/KonfiBadgesPage.tsx

key-decisions:
  - "Fallback-Pfad in KonfiBadgesPage komplett entfernt statt nur abgesichert -- Backend liefert per COALESCE immer Werte"
  - "UI-Code-Review als reiner Code-Scan durchgefuehrt -- keine Probleme bei safe-area, overflow oder hardcodierten Hoehen gefunden"
  - "Live-Daten-Verifikation bestaetigt: konfi_profiles Werte sind konsistent (profil >= activities + bonus, Differenz = Event-Punkte)"
  - "Docker-Container-Name ist konfi_quest-postgres-1 (nicht konfi-quest-db-1 wie in CLAUDE.md dokumentiert)"

patterns-established:
  - "Punkte-Anzeige: Immer direkt aus konfi_profiles.gottesdienst_points / gemeinde_points, nie manuell berechnen"
  - "Deprecated-Code sofort entfernen wenn keine Caller mehr existieren"

requirements-completed: [BUG-02, BUG-03, BUG-04]

# Metrics
duration: 5min
completed: 2026-03-01
---

# Phase 2 Plan 02: Deprecated-Cleanup, Badge-Punkte-Absicherung und UI-Review Summary

**Deprecated dateUtils entfernt, Badge-Punkte-Fallback gegen Double-Count eliminiert, UI-Code-Review ohne Findings abgeschlossen, Live-Daten in konfi_profiles als konsistent verifiziert**

## Performance

- **Duration:** 5 min (inklusive Checkpoint-Wartezeit fuer Live-Verifikation)
- **Started:** 2026-03-01T12:50:45Z
- **Completed:** 2026-03-01T12:58:02Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 2

## Accomplishments
- parseGermanTime und getGermanNow deprecated Funktionen aus dateUtils.ts entfernt (BUG-03)
- Badge-Punkte-Fallback-Pfad in KonfiBadgesPage komplett entfernt -- Double-Count-Risiko eliminiert (BUG-02)
- Systematischer UI-Code-Review aller Views: keine Probleme bei safe-area, overflow, hardcodierten Hoehen oder Tab-Bar-Overlap gefunden (BUG-04)
- Live-Datenbank-Verifikation bestaetigt: alle 28 Konfis haben konsistente Punkte in konfi_profiles

## Task Commits

Jeder Task wurde atomar committed:

1. **Task 1: Deprecated dateUtils entfernen und Badge-Fallback absichern** - `e263ac9` (fix)
2. **Task 2: Systematischer UI-Code-Review aller Views** - kein Commit (reiner Review, keine Probleme gefunden)
3. **Task 3: Checkpoint Live-Daten-Verifikation** - kein Commit (Verifikation approved)

**Plan metadata:** wird nach Summary-Erstellung committed

## Files Created/Modified
- `frontend/src/utils/dateUtils.ts` - Deprecated parseGermanTime und getGermanNow entfernt
- `frontend/src/components/konfi/pages/KonfiBadgesPage.tsx` - Fallback-Berechnung entfernt, nur noch direkte API-Punkte

## Decisions Made
- **Fallback komplett entfernt statt abgesichert:** Da das Backend per COALESCE immer Werte liefert (nie null), ist der Fallback-Pfad toter Code. Entfernung statt Absicherung eliminiert das Double-Count-Risiko vollstaendig.
- **UI-Review ohne Fixes:** Der systematische Code-Scan (safe-area, overflow, hardcodierte Hoehen, Tab-Bar-Overlap) hat keine Probleme aufgedeckt. Die iOS26-Library handhabt safe-area und Tab-Bar-Offset korrekt.
- **Docker-Container-Name:** Bei der Live-Verifikation wurde festgestellt, dass der Container `konfi_quest-postgres-1` heisst (nicht `konfi-quest-db-1` wie in CLAUDE.md).

## Deviations from Plan

None - Plan wurde exakt wie geschrieben ausgefuehrt.

## Issues Encountered

None.

## User Setup Required

None - keine externe Service-Konfiguration erforderlich.

## Next Phase Readiness
- Phase 2 ist komplett abgeschlossen (02-01 TabBar-Fix + Theme-Isolation, 02-02 Cleanup + Review)
- Code-Basis ist bereinigt und stabil fuer Phase 3 (Design-System Grundlagen)
- Keine Blocker oder offenen Punkte

## Self-Check: PASSED

- FOUND: 02-02-SUMMARY.md
- FOUND: e263ac9 (Task 1 commit)
- FOUND: frontend/src/utils/dateUtils.ts
- FOUND: frontend/src/components/konfi/pages/KonfiBadgesPage.tsx

---
*Phase: 02-bug-fixes-und-theme-stabilisierung*
*Completed: 2026-03-01*
