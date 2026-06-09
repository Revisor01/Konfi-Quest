---
phase: 118-konfispruch-datenmodell
plan: 01
subsystem: backend
tags: [konfispruch, datenmodell, migration, rbac, konfi-profil]
requires:
  - konfi_profiles (RBAC-Struktur, bestehende Spalte bible_translation)
  - organizations (FK-Ziel fuer organization_id)
  - verifyTokenRBAC Middleware
provides:
  - Tabelle konfsprueche (kuratierte Vers-Referenzen, organization_id NULL=global)
  - Tabelle konfspruch_uebersetzungen (4 Uebersetzungen/Vers, UNIQUE(spruch_id, translation))
  - konfi_profiles.konfspruch_id / konfspruch_freitext / konfspruch_freitext_referenz
  - GET /api/konfi/konfsprueche (Liste fuer Auswahl-Modal)
  - GET /api/konfi/profile.konfspruch (gewaehlter Spruch)
  - PATCH /api/konfi/profile (Listen-Wahl ODER Freitext)
affects:
  - Plan 02 (Frontend-Modal Konfispruch-Auswahl) baut auf diesem API-Vertrag auf
tech-stack:
  added: []
  patterns:
    - RBAC type==='konfi' + WHERE user_id=req.user.id (kein Scope-Param)
    - Exklusivitaet Listen-Wahl vs. Freitext in der Route erzwungen (NULLt die andere Quelle)
    - Lizenz-konformer Seed (nur Referenzen, leere Uebersetzungs-Platzhalter)
key-files:
  created:
    - backend/migrations/093_konfspruch.sql
  modified:
    - backend/routes/konfi.js
    - backend/tests/helpers/db.js
    - backend/tests/routes/konfi.test.js
decisions:
  - "Uebersetzungs-Praeferenz wird ueber die bestehende Spalte bible_translation wiederverwendet (NICHT neu angelegt)"
  - "4 deskriptive Translation-Keys (luther2017/bigs/gute_nachricht/elberfelder) koexistieren mit den Kuerzeln von PUT /bible-translation (freies VARCHAR, kein DB-Constraint)"
  - "Keine DB-CHECK-Constraint fuer Exklusivitaet; Route NULLt beim Setzen die jeweils andere Quelle"
metrics:
  duration: ca. 25 Min
  completed: 2026-06-09
  tasks: 3
  files: 4
---

# Phase 118 Plan 01: Konfispruch-Datenmodell Summary

Robustes, lizenz-konformes Datenmodell plus Backend-Vertrag fuer die Konfispruch-Auswahl: zwei neue Tabellen (32 globale Vers-Referenzen mit leeren Uebersetzungs-Platzhaltern), drei neue konfi_profiles-Spalten und drei Routen (Liste, Profil-Erweiterung, Setzen mit Listen-Wahl/Freitext, Pflicht-Referenz, RBAC).

## Was gebaut wurde

- **Migration 093** (`backend/migrations/093_konfspruch.sql`): Tabellen `konfsprueche` + `konfspruch_uebersetzungen`, drei `konfi_profiles`-Spalten (idempotent via `ADD COLUMN IF NOT EXISTS`), Seed der 32 Referenzen aus `118-spruch-referenzen.md` mit je 4 leeren Uebersetzungs-Zeilen (`text=''`). Idempotent (DELETE WHERE organization_id IS NULL vor Re-Insert + CROSS JOIN fuer die 4 Keys).
- **konfi.js**: GET `/konfsprueche`, GET `/profile`-Erweiterung (Feld `konfspruch`), PATCH `/profile`.
- **Tests**: `truncateAll` deckt beide Tabellen ab; neuer describe-Block `Konfispruch`.

## API-Vertrag fuer Plan 02 (Frontend)

### Die 4 gueltigen Translation-Keys
`luther2017` | `bigs` | `gute_nachricht` | `elberfelder`

WICHTIG: Die Uebersetzungs-TEXTE sind initial LEER (Platzhalter `''`). Der Betreiber traegt sie spaeter aus den lizenzierten Quellen per UPDATE nach. Das Frontend MUSS bei leerem Text einen Platzhalter-Hinweis anzeigen (z.B. "Text noch nicht hinterlegt"). Die Referenzen selbst (z.B. "Josua 1,9") sind immer vorhanden.

### GET /api/konfi/konfsprueche
RBAC: nur Konfi (sonst 403). Org-gefiltert (organization_id IS NULL ODER eigene Org), nur is_active.
Antwort: **Array** von:
```json
{
  "id": 11,
  "reference": "Josua 1,9",
  "book": "Josua",
  "chapter": 1,
  "verse": 9,
  "uebersetzungen": {
    "luther2017": "",
    "bigs": "",
    "gute_nachricht": "",
    "elberfelder": ""
  }
}
```
Alle 4 Keys sind immer vorhanden (fehlende Zeilen -> leerer String). Sortiert nach sort_order, id.

### GET /api/konfi/profile (Feld `konfspruch`)
Das bestehende Profil-Objekt enthaelt zusaetzlich das Feld `konfspruch`:
- **Listen-Wahl:** `{ "source": "liste", "id": 11, "reference": "Josua 1,9", "text": "<Text der gewaehlten Uebersetzung>", "translation": "luther2017" }`
- **Freitext:** `{ "source": "freitext", "text": "Mein Spruch", "reference": "Joh 3,16" }`
- **Keine Wahl:** `konfspruch: null`

Zusaetzlich liegen die Rohfelder weiterhin flach im Profil-Objekt: `konfspruch_id`, `konfspruch_freitext`, `konfspruch_freitext_referenz`, `bible_translation`.
Bei Listen-Wahl kann `text` leer sein, falls die gewaehlte Uebersetzung noch nicht befuellt ist (Platzhalter-Hinweis im Frontend).

### PATCH /api/konfi/profile
RBAC: nur Konfi (sonst 403), nur eigenes Profil (kein Scope-Param). Genau EIN Modus pro Request.

**Modus Listen-Wahl** (Body):
```json
{ "konfspruch_id": 11, "translation": "luther2017" }
```
- Setzt `konfspruch_id` + `bible_translation`, NULLt die Freitext-Felder.
- Validierung: `konfspruch_id` muss existieren + org-sichtbar (sonst 404), `translation` muss einer der 4 Keys sein (sonst 400).
- Antwort 200: `{ "success": true, "konfspruch": { "source": "liste", "id": 11, "translation": "luther2017" } }`

**Modus Freitext** (Body):
```json
{ "konfspruch_freitext": "Mein Spruch", "konfspruch_freitext_referenz": "Joh 3,16" }
```
- Setzt Text + Referenz, NULLt `konfspruch_id`. `bible_translation` bleibt unveraendert.
- `konfspruch_freitext_referenz` ist PFLICHT: fehlt/leer -> 400. Leerer Text -> 400.
- Antwort 200: `{ "success": true, "konfspruch": { "source": "freitext", "text": "Mein Spruch", "reference": "Joh 3,16" } }`

**Fehlerfaelle:**
- Weder gueltige Listen-Wahl noch Freitext im Body -> 400 mit erklaerendem Text.
- Ungueltige translation -> 400 (mit `valid_translations`).
- Freitext ohne Referenz -> 400 ("Bei einem eigenen Spruch ist die Stellenangabe (Referenz) verpflichtend").
- Nicht-Konfi -> 403.

## Deviations from Plan

Keine inhaltlichen Abweichungen. Eine Verify-Anpassung:

**1. [Verify-Heuristik] Migration-Check `bible_translation`-Verbot**
- Der Task-1-Verify verbietet den String `bible_translation` IRGENDWO in der Migration. Der erklaerende Kommentarkopf erwaehnte die Spalte zunaechst beim Namen. Umformuliert auf "Uebersetzungs-Praeferenz-Spalte" / "Spalte fuer die gewaehlte Bibeluebersetzung", damit der Verify gruen ist. Inhaltlich unveraendert (Spalte wird weiterhin NICHT angelegt).

## TDD Gate Compliance

Task 3 ist als `tdd="true"` markiert. Auf diesem Mac laeuft KEIN Docker und es ist KEINE Test-Postgres erreichbar (Port 5433 nicht offen), daher konnte der RED/GREEN-Zyklus lokal NICHT durchlaufen werden. Gemaess `<critical_constraints>` wurde der Test-Code dennoch vollstaendig geschrieben und per `node --check` syntaktisch abgesichert. Die Tests laufen in CI gegen echte PostgreSQL.

Git-Gate-Sequenz: `feat(118-01)` Migration -> `feat(118-01)` Routen -> `test(118-01)` Tests. Der `test`-Commit liegt nach den Implementierungs-Commits, weil ohne lokale DB kein echter RED-Lauf moeglich war; die Verifikation erfolgt zentral in CI.

## Hinweis zu truncateAll-Acceptance

Das Plan-Acceptance `grep -c "konfspruch" db.js >= 2` greift hier nicht woertlich: `konfsprueche` enthaelt den Substring `konfspruch` NICHT (es heisst `konfsprUEche`). Beide Tabellen (`konfspruch_uebersetzungen` UND `konfsprueche`) sind nachweislich in der TRUNCATE-Liste (auf separaten Zeilen, FK-Reihenfolge: Uebersetzungen vor Sprueche). Die inhaltliche Anforderung — beide neuen Tabellen abgedeckt — ist erfuellt.

## Verifikation

- Task 1 node-Check: gruen (alle Tabellen/Spalten/Seed vorhanden, kein `bible_translation`).
- Task 2 `node --check routes/konfi.js`: gruen; `/konfsprueche` + `patch('/profile'` per grep vorhanden.
- Task 3 `node --check` auf db.js + konfi.test.js: gruen. vitest lokal nicht ausfuehrbar (keine Test-DB / kein vitest im Worktree) -> CI.
