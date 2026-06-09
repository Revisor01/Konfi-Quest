---
phase: 119-konfispruch-jahrgang-steuerzentrale
plan: 05
subsystem: jahrgang-steuerzentrale
tags: [konfispruch, anwesenheit, email, jahrgaenge, matrix]
requires:
  - "119-01: jahrgaenge.js konfspruch_enabled, confirmation_date entfernt"
  - "118: konfsprueche / konfspruch_uebersetzungen + konfi_profiles Spalten"
  - "117: events.is_konfirmation"
provides:
  - "GET /admin/jahrgaenge/:id/sprueche (Konfi -> gewaehlter Spruch)"
  - "POST /admin/jahrgaenge/:id/matrix-email (Anwesenheit ODER Sprueche-Liste an eigene Adresse)"
  - "emailService.sendKonfiMatrixEmail"
  - "AttendanceMatrixModal IonSegment Anwesenheit/Konfispruch + Mail-Button"
affects:
  - backend/routes/jahrgaenge.js
  - backend/services/emailService.js
  - frontend/src/components/admin/modals/AttendanceMatrixModal.tsx
tech-stack:
  added: []
  patterns:
    - "Konfispruch-Builder (Listen-Wahl vs. Freitext) wiederverwendet aus konfi.js:486-522"
    - "Konfirmationstermin via is_konfirmation-Event (MIN(event_date) je Jahrgang)"
    - "E-Mail an req.user.id-Adresse (users.email), da rbac.js keine email liefert"
key-files:
  created: []
  modified:
    - backend/routes/jahrgaenge.js
    - backend/services/emailService.js
    - backend/tests/routes/jahrgaenge.test.js
    - frontend/src/components/admin/modals/AttendanceMatrixModal.tsx
decisions:
  - "Uebersetzung aus dedizierter Spalte kp.konfspruch_translation (W1), NICHT kp.bible_translation"
  - "Sprueche-Ansicht ist eine Liste (D-07), kein Zellen-Layout"
  - "E-Mail nur an die eigene Admin-Adresse (D-08), keine Drittempfaenger"
  - "Konfirmationstermin aus is_konfirmation-Event (D-05/D-09), nicht aus jahrgaenge.confirmation_date"
  - "emailService.sendKonfiMatrixEmail mit HTML-Tabelle + Text-Fallback (D-10), HTML-Escaping fuer Nutzereingaben"
metrics:
  duration_min: 0
  completed: "2026-06-09"
  tasks_completed: 2
  tasks_total: 3
  files_modified: 4
---

# Phase 119 Plan 05: Anwesenheitsmatrix-Umschaltung + E-Mail-Versand Summary

JWT-freie Buero-Weitergabe: Die Anwesenheitsmatrix bekommt eine IonSegment-Umschaltung Anwesenheit/Konfispruch, die Spruch-Ansicht ist eine Liste Konfi -> gewaehlter Spruch, und der Admin kann sich Anwesenheit ODER Sprueche-Liste (Name + Konfirmationstermin + Spruch) per E-Mail an die eigene Adresse schicken (SPRUCH-09/10, D-07..D-10).

## Was gebaut wurde

### Task 1 — Backend (Commit ee10f2b)
- **GET `/admin/jahrgaenge/:id/sprueche`** (requireAdmin, org-gescopt): liefert `[{ user_id, display_name, konfspruch }]`. `konfspruch` ist `null`, ein Listen-Eintrag (`source: 'liste'`, `reference`, `text`, `translation`) oder ein Freitext (`source: 'freitext'`, `text`, `reference`). Der Builder entspricht 1:1 dem Profil-Builder in `konfi.js:486-522`. Uebersetzung aus `kp.konfspruch_translation` (Default `luther2017`), org-gescopt (`organization_id IS NULL OR = org`), nur `is_active`.
- **POST `/admin/jahrgaenge/:id/matrix-email`** (requireAdmin): Body `{ type: 'anwesenheit' | 'sprueche' }`. Validiert den Jahrgang gegen die Org (404 sonst), laedt die Admin-Adresse per `SELECT email FROM users WHERE id = req.user.id` (400 wenn leer), ermittelt bei `sprueche` den Konfirmationstermin via `is_konfirmation`-Event (`MIN(event_date)`, D-09) und ruft `emailService.sendKonfiMatrixEmail`. Antwort `{ success: true }`.
- **emailService.sendKonfiMatrixEmail(email, adminName, jahrgangName, type, rows)**: baut subject/text/html (wrapHtml) als HTML-Tabelle + Text-Fallback. `anwesenheit` -> Name + besuchte/gesamte Pflicht-Termine; `sprueche` -> Name + Konfirmationstermin + Spruch (Listen: Referenz+Text, Freitext: Text+Referenz, sonst "noch keiner"). HTML-Escaping fuer Konfi-Namen und Freitext-Sprueche. In `module.exports` aufgenommen.
- **Tests** (`jahrgaenge.test.js`): emailService gemockt (`vi.mock`); GET sprueche (Listen-Wahl mit Text, ohne Spruch null, Freitext mit Referenz, 403 Teamer, 404 fremde Org); POST matrix-email (beide Typen 200 + Versand-Args geprueft, Termin gesetzt, 400 ohne E-Mail, 404 fremder Jahrgang, 400 ungueltiger type).

### Task 2 — Frontend AttendanceMatrixModal (Commit 2034c8d)
- `viewMode`-State (`'anwesenheit' | 'sprueche'`) + IonSegment oberhalb der Matrix (Muster EventsView).
- Bei `sprueche`: laedt `GET /admin/jahrgaenge/:id/sprueche` und rendert eine Liste Konfi -> Spruch (`app-text-main` Name, `app-text-sub` Spruch; "noch keiner" kursiv). Kein Zellen-Layout (D-07). Teilt das Suchfeld mit der Matrix.
- Mail-Button (Toolbar `slot="end"`, `mailOutline`, Spinner waehrend Versand): `POST /admin/jahrgaenge/:id/matrix-email` mit `{ type: viewMode }`. Erfolg -> `setSuccess('E-Mail an deine Adresse gesendet')`, Fehler -> `setError`.
- `setSuccess` aus `useApp` ergaenzt (war bereits im Context vorhanden). Legende nur noch in `anwesenheit`-Modus. Titel wechselt zu "Konfisprüche".

## Verifikation

- Backend: `node --check routes/jahrgaenge.js services/emailService.js tests/routes/jahrgaenge.test.js` -> ok. Grep-Checks (`sprueche`, `matrix-email`, `konfspruch_translation`, `sendKonfiMatrixEmail`) -> ok.
- Frontend: `tsc --noEmit` (mit verlinktem node_modules der Hauptkopie) -> 0 Fehler im gesamten Projekt, keine in AttendanceMatrixModal. Grep-Checks (`IonSegment`, `matrix-email`, `sprueche`) -> ok.
- Backend-Integrationstests laufen NUR in CI (dieser Mac hat kein Docker, vitest braucht die Test-DB).

## Deviations from Plan

Keine Rule-1/2/3-Eingriffe. Eine kleine zusaetzliche Absicherung im Rahmen von Task 1/2:
- **[Rule 2 - Sicherheit] HTML-Escaping** in `sendKonfiMatrixEmail` fuer Konfi-Namen und Freitext-Sprueche (verhindert HTML-Injection im Mail-Body). Begruendet, da Freitext-Sprueche von Konfis stammen und ungefiltert ins HTML flossen.
- **[Rule 2 - Korrektheit] type-Whitelist** per express-validator (`isIn(['anwesenheit','sprueche'])`) am matrix-email-Endpoint, damit ein ungueltiger Body 400 statt undefiniertem Verhalten liefert.

## Checkpoint

Task 3 ist ein `checkpoint:human-verify` (gate="blocking"): visuelle Pruefung der Segment-Umschaltung und des E-Mail-Versands im App-Build (erfordert Xcode-Build). Autonome Arbeit (Task 1+2) ist abgeschlossen und committet. Verifikation siehe `## Checkpoint` im Plan (App bauen, als Admin mit E-Mail einloggen, Segment + Liste + beide Mail-Typen + Fehlerfall ohne Adresse pruefen).

## Self-Check: PASSED

- backend/routes/jahrgaenge.js — FOUND
- backend/services/emailService.js — FOUND
- backend/tests/routes/jahrgaenge.test.js — FOUND
- frontend/src/components/admin/modals/AttendanceMatrixModal.tsx — FOUND
- Commit ee10f2b — FOUND
- Commit 2034c8d — FOUND
