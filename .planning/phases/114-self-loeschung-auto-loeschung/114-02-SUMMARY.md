# Plan 114-02 Summary: Self-Loeschung (In-App Account-Loeschung)

**Status:** Complete
**Wave:** 2
**Requirements:** D-01, D-02, D-03, D-05

## Was gebaut wurde

In-App Self-Loeschung des eigenen Accounts fuer ALLE Rollen (Konfi, Teamer, Admin).
Erfuellt Apple App Store Review Guideline 5.1.1(v) (Launch-Blocker).

### Backend
- **POST /api/auth/delete-account** (`backend/routes/auth.js:216`): RBAC-geschuetzt
  (nur `rbacVerifier`, kein requireAdmin -> alle Rollen, D-01). Ablauf:
  Passwort aus Body (fehlt -> 400), User laden, `bcrypt.compare` (falsch -> 400, D-03),
  Transaktion via `db.getClient()` BEGIN -> `deleteKonfiCascade(client, userId, organization_id)`
  -> COMMIT (ROLLBACK + 500 bei Fehler). Sofortiger kaskadierender Hard-Delete (D-02),
  nutzt die gemeinsame Loesch-Funktion aus Plan 114-01.

### Frontend
- **shared/DeleteAccountModal.tsx**: wiederverwendbares useIonModal-Modal mit klarer
  Warnung ("endgueltig, nicht rueckgaengig"), Passwort-Eingabefeld zur Bestaetigung,
  Loeschen-Button (color danger, disabled bei leerem Passwort/Submit). onSubmit ruft
  `api.post('/auth/delete-account', { password })`, bei Erfolg `logout()` + Redirect zum
  Login, bei 400 Inline-Fehler. Kein `<IonModal isOpen>` (D-05).
- **Einbindung in alle drei Profil-Ansichten** (D-01): ProfileView (Konfi),
  TeamerProfilePage, AdminProfilePage. Jeweils Import + useIonModal-Hook +
  "Account loeschen"-Button (color danger) nahe dem Abmelden-Button.

## Tests
- `tests/routes/auth.test.js`: 26 Tests gruen (inkl. 5 neue delete-account-Tests):
  korrektes Passwort -> 200 + User weg, falsches Passwort -> 400, ohne Passwort -> 400,
  Teamer/Admin koennen sich selbst loeschen, Loeschung kaskadiert.
- Verifiziert mit `npx vitest run --config tests/vitest.config.ts tests/routes/auth.test.js`
  gegen die echte Test-PostgreSQL (Port 5433).

## Commits
- 6ccae0a test(114-02): failing tests fuer POST /api/auth/delete-account (RED)
- 92da881 feat(114-02): POST /api/auth/delete-account mit Passwort-Check + Hard-Delete (GREEN)
- c1315ac feat(114-02): shared DeleteAccountModal (useIonModal)
- 13b1694 feat(114-02): DeleteAccountModal in alle drei Profil-Ansichten einbinden

## Hinweise
- Plan-Abschluss (Task-3-Commit + dieses SUMMARY) wurde vom Orchestrator manuell
  fertiggestellt, nachdem der Executor-Agent bei Task 3 durch einen API-Verbindungsabbruch
  (ConnectionRefused) unterbrochen wurde. Die Arbeit war zu dem Zeitpunkt inhaltlich
  vollstaendig (alle Dateien geschrieben), es fehlten nur der finale Commit und das SUMMARY.
- STATE.md/ROADMAP.md wurden NICHT veraendert (Orchestrator-Domaene).
