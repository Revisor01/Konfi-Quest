---
phase: 115-konfi-limits-pro-org-tarif-durchsetzung
plan: 02
subsystem: backend / limit-enforcement (beide Anlage-Wege)
tags: [konfi-limit, tarif, grace, invite-code, multi-tenancy, rbac]
requires:
  - "checkKonfiLimit(db, organizationId) aus Plan 01 (count/limit/stufe)"
  - "organizations.max_konfis (Migration 083)"
provides:
  - "3-Stufen-Grace-Durchsetzung in POST-Konfi-Route (Weg 1): 201/409/403"
  - "Hard-Block-Durchsetzung in Invite-Registrierung (Weg 2): nur 403 ab Limit+5"
  - "nextTier(limit) + TARIF_STUFEN (15/50/75/100) in konfiLimit.js"
  - "409/403-Response-Vertrag fuer Plan 03 (Frontend-Dialog)"
affects:
  - "Plan 03: Frontend-Grace-Dialog konsumiert 409 (limit_grace) + confirm-Flag"
tech-stack:
  added: []
  patterns:
    - "checkKonfiLimit in laufende client-Transaktion eingebettet (Util-Muster Phase 114)"
    - "error_code-Feld unterscheidet Grace-409 von Username-Kollisions-409"
key-files:
  created: []
  modified:
    - "backend/routes/konfi-management.js"
    - "backend/routes/auth.js"
    - "backend/utils/konfiLimit.js"
    - "backend/tests/routes/konfi-management.test.js"
    - "backend/tests/routes/auth.test.js"
decisions:
  - "next_tier zentral in konfiLimit.js (nextTier + TARIF_STUFEN), von Weg 1 genutzt — kein dupliziertes Stufen-Array"
  - "Confirm-Flag heisst req.body.confirm (Boolean, === true)"
  - "Weg 2 liefert KEIN count/limit/next_tier (Konfi braucht keinen Dialog) — nur error + error_code"
metrics:
  duration: "~12 min"
  completed: "2026-05-31"
  tasks: 2
  files: 5
---

# Phase 115 Plan 02: Konfi-Limit-Durchsetzung an beiden Anlage-Wegen Summary

Durchsetzung des Tarif-Limits an beiden verifizierten Konfi-Entstehungswegen ueber die gemeinsame
`checkKonfiLimit`-Util aus Plan 01: Weg 1 (Leitung legt an) mit vollem 3-Stufen-Grace inkl.
Bestaetigungs-409, Weg 2 (Invite-Selbstregistrierung) nur mit Hard-Block ab Limit+5. Damit ist der
Tarif serverseitig nicht mehr aushebelbar (Single Source of Truth).

## Was gebaut wurde

### Task 1: 3-Stufen-Grace in POST-Konfi-Route (Weg 1, TDD)
`backend/routes/konfi-management.js` POST `/`: `checkKonfiLimit(client, req.user.organization_id)`
wird nach dem jahrgang-/role-Check, VOR dem `users`-INSERT in der laufenden Transaktion aufgerufen.
Verzweigung nach `stufe`:
- `hard_block` -> ROLLBACK + 403 `{ error, error_code: 'limit_exceeded', count, limit, next_tier }`
  (kein Override, auch nicht mit `confirm:true`).
- `grace` UND `req.body.confirm !== true` -> ROLLBACK + 409
  `{ error, error_code: 'limit_grace', count, limit, next_tier }`.
- `under_limit` ODER (`grace` mit `confirm:true`) -> normal anlegen, 201.

`max_konfis NULL` faellt in `under_limit` (Plan-01-Util) -> 201, kein Check (D-06).
Die bestehende 23505-Behandlung (`{ error: 'Benutzername existiert bereits' }`, OHNE `error_code`)
bleibt 409 und ist damit vom Grace-409 abgegrenzt.

`backend/utils/konfiLimit.js` erweitert um `nextTier(limit)` + `TARIF_STUFEN = [15,50,75,100]`
(kleinste Stufe > limit, null wenn keine groessere). Zentral, damit Plan 03 / Weg 2 dieselbe Logik
nutzen koennen.

### Task 2: Hard-Block in Invite-Registrierung (Weg 2, TDD)
`backend/routes/auth.js` POST `/register-konfi`: `checkKonfiLimit(client, invite.organization_id)`
direkt nach `BEGIN`, VOR dem `users`-INSERT. NUR `hard_block` -> ROLLBACK + 403
`{ error, error_code: 'limit_exceeded' }` mit deutschem Leitungs-Hinweis
("Bitte wende dich an deine Leitung — ein Tarif-Upgrade ist noetig."). `under_limit` und `grace`
laufen UNVERAENDERT durch (KEIN 409, KEIN confirm — der sich anmeldende Konfi kann keinen Dialog
bestaetigen, D-08b). Erfolgs-Response (token + refresh_token) unveraendert.

## Response-Vertrag fuer Plan 03 (Frontend-Dialog)

**Confirm-Flag:** `confirm` im Request-Body (Boolean). Nur `confirm === true` zaehlt als Bestaetigung.

**Weg 1 — POST /api/admin/konfis:**
```jsonc
// 201: Konfi angelegt (under_limit oder grace+confirm)
{ "id": 42, "username": "...", "temporaryPassword": "...", "message": "Konfi erfolgreich erstellt" }

// 409: Grace ohne confirm -> Dialog zeigen, dann mit confirm:true erneut senden
{ "error": "Tarif ausgeschoepft (15 von 15 Konfis). Du kannst bis zu 5 weitere anlegen — danach ist ein Upgrade noetig.",
  "error_code": "limit_grace", "count": 15, "limit": 15, "next_tier": 50 }

// 403: Hard-Block (count >= limit+5) -> kein Override
{ "error": "Tarif-Grenze erreicht (20 von 15 Konfis). Ein Tarif-Upgrade ist noetig, um weitere Konfis anzulegen.",
  "error_code": "limit_exceeded", "count": 20, "limit": 15, "next_tier": 50 }

// 409 Username-Kollision (NICHT Grace) -> error_code fehlt
{ "error": "Benutzername existiert bereits" }
```
`next_tier` ist `null`, wenn das Limit >= 100 ist (keine groessere Stufe).

**Weg 2 — POST /api/auth/register-konfi:**
```jsonc
// 200: Registrierung erfolgreich (under_limit ODER grace, ohne confirm)
{ "message": "Registrierung erfolgreich", "token": "...", "refresh_token": "...", "user": { ... } }

// 403: Hard-Block (count >= limit+5)
{ "error": "Die Anzahl der Konfis ist erreicht. Bitte wende dich an deine Leitung — ein Tarif-Upgrade ist noetig.",
  "error_code": "limit_exceeded" }
```
Weg 2 liefert bewusst KEIN count/limit/next_tier und KEINEN Grace-409 (Konfi hat keinen Dialog).

## Deviations from Plan

None - Plan exakt wie geschrieben umgesetzt. `next_tier`-Helper wurde (gemaess Discretion im Plan)
zentral in `konfiLimit.js` statt lokal angelegt, damit kein dupliziertes Stufen-Array entsteht.

## TDD Gate Compliance

Beide Tasks mit RED (test-Commit) vor GREEN (feat-Commit):
- Task 1: test 1c75ede (3 Tests rot) -> feat 7f85cd8
- Task 2: test 64aedf5 (Hard-Block-Test rot) -> feat 7088fde

## Tests

`cd backend && npx vitest run --config tests/vitest.config.ts tests/routes/konfi-management.test.js
tests/routes/auth.test.js` -> 83 passed (2 Dateien). 7 neue Limit-Tests (Weg 1) + 3 (Weg 2).
Keine bestehenden Tests gebrochen.

## Self-Check: PASSED
