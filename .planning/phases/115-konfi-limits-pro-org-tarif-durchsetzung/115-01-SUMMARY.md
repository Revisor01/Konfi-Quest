---
phase: 115-konfi-limits-pro-org-tarif-durchsetzung
plan: 01
subsystem: backend / organizations + limit-enforcement
tags: [konfi-limit, tarif, rbac, super_admin, multi-tenancy, migration]
requires:
  - "organizations-Tabelle (Multi-Tenancy)"
  - "users.deleted_at (Phase 114, Soft-Delete)"
  - "roles.name = 'konfi' (RBAC)"
provides:
  - "organizations.max_konfis (nullbare Tarif-Limit-Spalte)"
  - "checkKonfiLimit(db, organizationId) — Single Source of Truth fuer Limit-Pruefung"
  - "PATCH /api/organizations/:id/limit (super_admin-only)"
  - "GET /api/organizations/:id liefert max_konfis + konfi_count (fuer Plan 03)"
affects:
  - "Wave 2: POST-Konfi-Route + Invite-Code-Registrierung (importieren checkKonfiLimit)"
  - "Plan 03: read-only X-von-Y-Anzeige (GET /:id)"
tech-stack:
  added: []
  patterns:
    - "Util als Single Source of Truth mit db-Parameter (Pool ODER Client) — Muster Phase 114 deleteKonfiCascade"
    - "super_admin-only Endpunkt getrennt von org_admin-faehiger PUT-Route"
key-files:
  created:
    - "backend/migrations/083_org_konfi_limit.sql"
    - "backend/utils/konfiLimit.js"
    - "backend/tests/utils/konfiLimit.test.js"
  modified:
    - "backend/routes/organizations.js"
    - "backend/tests/routes/organizations.test.js"
decisions:
  - "max_konfis NICHT im POST-Create-Body — PATCH /:id/limit ist der einzige Setz-Weg (minimaler Eingriff)"
  - "Grace-Puffer als Konstante GRACE_BUFFER = 5 in konfiLimit.js exportiert"
  - "max_konfis im Test direkt per UPDATE gesetzt — seed.js unveraendert (bricht keine bestehenden Seeds)"
metrics:
  duration: "~15 min"
  completed: "2026-05-31"
  tasks: 3
  files: 5
---

# Phase 115 Plan 01: Konfi-Limit Fundament (Schema + Util + super_admin-Endpunkt) Summary

Fundament der Tarif-Durchsetzung: nullbare `organizations.max_konfis`-Spalte, die wiederverwendbare
4-Stufen-Pruef-Util `checkKonfiLimit` als Single Source of Truth und der super_admin-only
`PATCH /:id/limit`-Endpunkt — sodass Wave 2 (beide Konfi-Anlage-Wege) und Plan 03 (Anzeige) ohne
weitere Backend-Arbeit aufsetzen koennen.

## Was gebaut wurde

### Task 1: Migration 083
`backend/migrations/083_org_konfi_limit.sql` fuegt `max_konfis INTEGER NULL` idempotent hinzu
(`ADD COLUMN IF NOT EXISTS`), ohne Backfill und ohne DEFAULT (D-01). NULL = unbegrenzt.

### Task 2: checkKonfiLimit Util (TDD)
`backend/utils/konfiLimit.js` exportiert `checkKonfiLimit(db, organizationId)` und `GRACE_BUFFER`.
Zaehlt aktive Konfis via `users JOIN roles WHERE r.name='konfi' AND organization_id=$1 AND
u.deleted_at IS NULL` (NICHT konfi_profiles, damit der Phase-114-Soft-Delete-Filter greift, D-07).
8 Tests gruen (alle 4 Stufen, deleted_at-Ausschluss, Org-Isolation, Teamer/Admin zaehlen nicht).

### Task 3: PATCH /:id/limit (TDD)
`backend/routes/organizations.js`: neuer `router.patch('/:id/limit', rbacVerifier, requireSuperAdmin,
validateOrgId, ...)`. Setzt ausschliesslich `max_konfis` (UPDATE ... SET max_konfis, updated_at).
Validierung: null oder nicht-negativer Integer, sonst 400; 404 bei unbekannter Org. Die bestehende
PUT /:id-Route wurde NICHT angefasst und verwirft mitgesendetes `max_konfis` (D-03).

## Schnittstellen-Doku fuer Wave 2 / Plan 03

**checkKonfiLimit-Rueckgabe (fest):**
```js
const { checkKonfiLimit, GRACE_BUFFER } = require('../utils/konfiLimit');
const { count, limit, stufe } = await checkKonfiLimit(db, organizationId);
// count: number (aktive Konfis, deleted_at IS NULL)
// limit: number | null   (null = unbegrenzt)
// stufe: 'under_limit' | 'grace' | 'hard_block'
//   under_limit -> normal anlegen
//   grace       -> max_konfis <= count < max_konfis+5 (Bestaetigung noetig, D-05.2)
//   hard_block  -> count >= max_konfis+5 (verweigern, D-05.3)
// GRACE_BUFFER === 5
```
`db` darf ein Pool ODER ein laufender Client sein (in Transaktion einbettbar).

**Migration-Nummer:** 083.

**max_konfis im POST-Create-Body:** NEIN. Setzen ausschliesslich via `PATCH /api/organizations/:id/limit`.

**GET-Endpunkt fuer Plan 03 (X-von-Y-Anzeige):**
`GET /api/organizations/:id` liefert `max_konfis` (aus `SELECT *`) UND `konfi_count` (Statistik-Query).
super_admin sieht jede Org, org_admin die eigene. Plan 03 braucht damit KEINEN neuen Backend-Endpunkt.
Hinweis: `konfi_count` dort zaehlt aktuell ueber `konfi_profiles` (filtert deleted_at nicht) — fuer
eine deleted_at-genaue Anzeige kann Plan 03 stattdessen `checkKonfiLimit` nutzen oder den count aus
der Util beziehen.

## Deviations from Plan

None - Plan exakt wie geschrieben umgesetzt. seed.js wurde nicht erweitert, da `max_konfis` in den
Tests direkt per UPDATE gesetzt wird (vom Plan als "falls noetig" freigestellt) — kein Risiko fuer
bestehende Seeds.

## TDD Gate Compliance

Tasks 2 und 3 mit RED (test-Commit) vor GREEN (feat-Commit) ausgefuehrt:
- Task 2: test 5bf5bc2 (Modul fehlt) -> feat 42ea7a5
- Task 3: test 342d823 (5 Tests rot) -> feat 27500e8

## Tests

`cd backend && npx vitest run --config tests/vitest.config.ts tests/utils/konfiLimit.test.js
tests/routes/organizations.test.js` -> 51 passed (2 Dateien). Keine bestehenden Tests gebrochen.

## Self-Check: PASSED
