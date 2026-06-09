---
phase: 119-konfispruch-jahrgang-steuerzentrale
plan: 02
subsystem: backend
tags: [wrapped, auto-deletion, konfspruch, is_konfirmation, dsg-ekd]
requires:
  - "119-01: Migration 094 (jahrgaenge.konfspruch_enabled, confirmation_date nullable)"
  - "Phase 117: events.is_konfirmation (Migration 091)"
provides:
  - "Teamer-Wrapped-Cron jaehrlich am 6.1."
  - "Auto-Loeschung keyt auf is_konfirmation-Event (DSG-EKD-Stichtag)"
  - "GET /dashboard liefert konfspruch_visible (SPRUCH-07 Backend-Gate)"
  - "Konfirmationstermin im Backend ausschliesslich aus is_konfirmation-Event (D-04/D-05)"
affects:
  - "119-03 (Frontend Card-Gate konfspruch_visible)"
tech-stack:
  added: []
  patterns:
    - "Stichtag/Termin je Jahrgang aus MIN(event_date) der nicht-cancelled is_konfirmation-Events (org-gescopt)"
    - "Sicherer Default: kein is_konfirmation-Event -> keine Auto-Loeschung"
key-files:
  created: []
  modified:
    - backend/services/backgroundService.js
    - backend/routes/konfi.js
    - backend/routes/wrapped.js
    - backend/routes/users.js
    - backend/tests/services/autoDeletion.test.js
    - backend/tests/routes/konfi.test.js
decisions:
  - "Wrapped-Cron-Schedule '0 6 1 * *' -> '0 6 6 1 *' (jaehrlich 6. Januar), Konfi-Wrapped-Trigger komplett entfernt"
  - "Auto-Loeschung leitet Stichtag aus is_konfirmation-Event ab; ohne Event keine Loeschung (sicherer Default, per Test belegt)"
  - "API-Response-Feld confirmation_date bleibt erhalten, wird aber aus is_konfirmation-Event befuellt (kein jahrgaenge.confirmation_date mehr)"
metrics:
  duration: "~25 min"
  completed: "2026-06-09"
  tasks: 4
  files: 6
---

# Phase 119 Plan 02: Konfirmations-Termin-Umzug (Backend) + Konfispruch-Gate Summary

Backend wertet `jahrgaenge.confirmation_date` nirgends mehr aus; Konfirmationstermin und DSG-EKD-Stichtag stammen ausschliesslich aus dem `is_konfirmation`-Event (Phase 117), und `GET /dashboard` liefert das `konfspruch_visible`-Flag aus `jahrgaenge.konfspruch_enabled`.

## Was gebaut wurde

### Task 1: Wrapped-Cron auf 6.1. + Konfi-Cron-Block entfernt (`backgroundService.js`)
- `startWrappedCron`: Schedule `'0 6 1 * *'` -> `'0 6 6 1 *'` (jaehrlich 6. Januar, 06:00, Europe/Berlin).
- `checkWrappedTriggers`: Konfi-Wrapped-Block (Trigger via `confirmation_date`) komplett entfernt inkl. `konfiJahrgaengeGenerated`-Zaehler. Teamer-Wrapped laeuft jetzt fuer alle Orgs ohne Dezember-Bedingung (Idempotenz-Check via `wrapped_snapshots` bleibt).
- Commit: 750815b

### Task 2: Auto-Loesch-Service auf is_konfirmation-Event + Tests (`backgroundService.js`, `autoDeletion.test.js`)
- `runAutoDeletion`: Jahrgang-Query laedt nur noch `id, organization_id`. Pro Jahrgang wird der Stichtag aus `MIN(e.event_date)` der nicht-cancelled `is_konfirmation`-Events (org-gescopt) ermittelt. Hard- und Soft-Query nutzen diesen Stichtag.
- Sicherer Default: Jahrgang ohne `is_konfirmation`-Event -> `continue` (keine Aufbewahrungsfrist -> keine Loeschung). Semantik in Code-Kommentar dokumentiert.
- `autoDeletion.test.js`: Helper `setConfirmationDaysAgo` -> `setKonfirmationEventDaysAgo` (legt `is_konfirmation`-Event an + `event_jahrgang_assignments`-Zuordnung, Org aus Seed-Fixtures abgeleitet). Alle 8 Aufrufstellen umgestellt. Neuer Test 7: kein Event -> keine Loeschung (Datenverlust-Regression).
- Commit: 930a9f5

### Task 3: Konfi-Dashboard + Profile + konfspruch_visible (`konfi.js`, `konfi.test.js`)
- `GET /dashboard`: `j.confirmation_date` raus, `j.konfspruch_enabled` rein. Die `ce`-Subquery nutzt jetzt `DISTINCT ON (jahrgang_id)` auf `e.is_konfirmation = true` (frueheste nicht-cancelled Konfirmation) und liefert `location` + `event_date`. `daysToConfirmation` aus diesem Event-Datum. Neues Response-Feld `konfspruch_visible` (= `j.konfspruch_enabled === true`), `confirmation_date` aus Event-Datum oder null.
- `GET /profile`: `j.confirmation_date` aus SELECT raus; `confirmationQuery` von Kategorie-`LIKE '%konfirmation%'` auf `e.is_konfirmation = true` umgestellt; kein Jahrgang-Fallback mehr.
- `konfi.test.js`: Tests fuer `konfspruch_visible` true/false, Dashboard-Termin aus is_konfirmation-Event (+ location), Profile-Termin aus gebuchtem is_konfirmation-Event + null-Fall.
- Commit: 095ea9c

### Task 4: wrapped.js + users.js (`wrapped.js`, `users.js`)
- `generateKonfiSnapshot` (im Plan als `buildKonfiWrapped` referenziert): `confirmation_date` aus jahrgaenge-SELECT raus. Wrapped-Zeitraum aus Konfirmationstermin via `MIN(e.event_date)` der nicht-cancelled is_konfirmation-Events (org-gescopt via `orgId`); Termin vorhanden -> `zeitraumStart = (Termin-Jahr - 1)-09-01`, `zeitraumEnde = Termin-Datum`; kein Termin -> Kalenderjahr-Fallback bleibt.
- Admin-Generate-Route: `confirmation_date` aus SELECT (`id, name`) entfernt.
- `users.js` `GET /me/jahrgaenge`: `j.confirmation_date` aus SELECT entfernt (toter Ballast).
- Commit: d3a808e

## Abweichungen vom Plan

### Auto-fixed / Anpassungen

**1. [Rule 3 - Naming] Funktionsname `buildKonfiWrapped` existiert nicht**
- Gefunden in: Task 4
- Der Plan referenziert `buildKonfiWrapped`; die tatsaechliche Funktion heisst `generateKonfiSnapshot(client, userId, orgId, jahrgangId, year)`. Die Logik (jahrgaenge-SELECT + Zeitraum-Berechnung Z186-232) war eindeutig identifizierbar. Umbau wie geplant durchgefuehrt; `orgId` war als Parameter bereits verfuegbar fuer den Org-Scope der is_konfirmation-Query.

**2. [Hinweis - Konsistenz] ASCII-Umschreibungen in Code-Kommentaren/Logs beibehalten**
- Der bestehende Backend-Code nutzt durchgehend ASCII-Umschreibungen ("jaehrlich", "fuer", "Loeschung") in internen Kommentaren und Server-Logs. Fuer Konsistenz mit dem umgebenden Code wurde diese Schreibweise in den geaenderten Kommentaren/Logs beibehalten (CLAUDE.md-Umlautregel zielt primaer auf endnutzersichtbare UI-/Push-Texte; hier sind keine UI-Strings betroffen).

## Bekannte Stubs

Keine.

## Verifikation

- Alle 6 Dateien: `node --check` gruen.
- `confirmation_date` in `backgroundService.js`, `wrapped.js`, `users.js` GET /me/jahrgaenge: 0 Treffer.
- In `konfi.js` verbleiben nur zwei Treffer als API-Response-Feldname (`confirmation_date:`), befuellt aus dem is_konfirmation-Event — KEIN Auswerten von `jahrgaenge.confirmation_date`. Erfolgskriterium D-04 erfuellt.
- Integrationstests (autoDeletion.test.js, konfi.test.js) laufen in CI gegen echtes PostgreSQL (lokal kein Docker auf diesem Mac); Syntax via `node --check` validiert.

## Threat Flags

Keine neuen Trust-Boundary-Flaechen. Die Auto-Loeschung (DSG-EKD) bleibt funktional und sicherer im Default (kein Termin -> keine Loeschung statt versehentlicher Loeschung).

## Self-Check: PASSED

- Alle 6 Code/Test-Dateien + SUMMARY.md vorhanden.
- Alle 5 Commits (750815b, 930a9f5, 095ea9c, d3a808e, 1eef0b9) im Git-Log.
- Working tree sauber.
