---
phase: 118-konfispruch-datenmodell
reviewed: 2026-06-09T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - backend/migrations/093_konfspruch.sql
  - backend/routes/konfi.js
  - backend/tests/helpers/db.js
  - backend/tests/routes/konfi.test.js
  - frontend/src/components/konfi/modals/KonfispruchSelectModal.tsx
  - frontend/src/components/konfi/pages/KonfiDashboardPage.tsx
  - frontend/src/components/konfi/views/DashboardView.tsx
  - frontend/src/theme/variables.css
findings:
  critical: 2
  warning: 5
  info: 3
  total: 10
status: issues_found
---

# Phase 118: Code Review Report

**Reviewed:** 2026-06-09
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the Konfispruch data model (Migration 093), the two new backend routes (`GET /konfi/konfsprueche`, `PATCH /konfi/profile`), the `GET /konfi/profile` konfspruch resolution, the React selection modal, the dashboard page wiring, the dashboard view card, the CSS, and the test suite.

The RBAC enforcement (konfi-only, own-profile scope via `WHERE user_id = req.user.id`), org-scoped spruch lookup in PATCH, parameterized SQL, list-vs-freetext exclusivity, mandatory-reference validation, and migration idempotency are all implemented correctly and well-tested. No SQL injection, no emojis, and no hardcoded secrets were found.

However, two correctness defects undermine the headline feature: (1) the new Konfispruch card will not render for any organization using the default dashboard section order, because the backend never emits `konfispruch` in `section_order` and the frontend fallback is dead; and (2) the konfispruch list-translation and the legacy Tageslosung translation preference are both stored in the single `konfi_profiles.bible_translation` column using two mutually incompatible value vocabularies, so the two features silently clobber each other. Several robustness and German-spelling (Umlaut) issues round out the findings.

## Critical Issues

### CR-01: Konfispruch dashboard card never renders for orgs using the default section order

**File:** `backend/routes/konfi.js:269` and `frontend/src/components/konfi/pages/KonfiDashboardPage.tsx:305`
**Issue:** The dashboard endpoint always returns a `dashboard_config.section_order`. When no `dashboard_section_order` setting is stored, it falls back to the hardcoded default `['konfirmation', 'events', 'losung', 'badges', 'ranking']` — which does **not** contain `'konfispruch'`. The frontend at `KonfiDashboardPage.tsx:305` only uses its own fallback (which *does* include `'konfispruch'`) when `section_order` is `undefined`/`null`:
```ts
const sectionOrder = dashboardData.dashboard_config?.section_order || ['konfirmation', 'konfispruch', ...];
```
Because the backend *always* provides a (konfispruch-less) array, the frontend `||` branch is dead code. `DashboardView` only renders sections whose key appears in `sectionOrder` (`DashboardView.tsx:330`), so the Konfispruch card — the central deliverable of Phase 118 — is invisible for every org that has not manually saved a custom section order containing `konfispruch`. No migration backfills the setting either.
**Fix:** Add `'konfispruch'` to the backend default and to any stored section orders:
```js
// backend/routes/konfi.js ~269
section_order: sectionOrder || ['konfirmation', 'konfispruch', 'events', 'losung', 'badges', 'ranking']
```
and ensure stored orders are upgraded (e.g. inject `konfispruch` after `konfirmation` when it is missing from a persisted order), so existing orgs with a saved order also see the card. Add a regression test asserting `section_order` contains `konfispruch` by default.

### CR-02: `bible_translation` column is overloaded by two features with incompatible value sets — silent data corruption

**File:** `backend/routes/konfi.js:2144-2167` (PATCH list mode), `backend/routes/konfi.js:477-491` (GET /profile resolution), `backend/routes/konfi.js:2039-2061` (legacy `PUT /bible-translation`)
**Issue:** The konfispruch list-mode PATCH writes the chosen translation key into `konfi_profiles.bible_translation` using the vocabulary `['luther2017','bigs','gute_nachricht','elberfelder']` (line 2163). GET /profile then reads that same column back as the translation key to look up the verse text (line 484). But the pre-existing `PUT /bible-translation` route writes the *same column* using a completely different vocabulary `['LUT','ELB','GNB','BIGS','NIV','LSG','RVR60']` (line 2049) for the Tageslosung translation preference. The two features now collide on one column:
- A konfi sets a list-spruch (`bible_translation = 'luther2017'`), then later changes their Tageslosung translation to `'LUT'`. The konfispruch verse-text lookup at line 484 joins on `translation = 'LUT'`, finds no `konfspruch_uebersetzungen` row, and returns empty text — the chosen spruch silently loses its text on the dashboard.
- Conversely, setting a konfispruch overwrites the user's Tageslosung translation preference with `'luther2017'`, which `PUT /bible-translation` would reject as invalid, leaving the Tageslosung feature in an inconsistent state.

This is an unguarded shared-mutable-state bug across modules; the migration comment ("Spalte wird WIEDERVERWENDET") explicitly relies on this reuse without reconciling the two value spaces.
**Fix:** Do not reuse `bible_translation` for the konfispruch translation. Add a dedicated column (e.g. `konfspruch_translation VARCHAR(30)`) in the migration and read/write it in the PATCH list mode and GET /profile resolution. If reuse is truly intended, unify both endpoints onto a single translation vocabulary and add a cross-route test proving they do not clobber each other.

## Warnings

### WR-01: Missing length validation on `konfspruch_freitext_referenz` causes a 500 instead of a 400

**File:** `backend/routes/konfi.js:2177-2196`
**Issue:** `konfspruch_freitext_referenz` maps to a `VARCHAR(100)` column (`093_konfspruch.sql:52`), but the PATCH route validates only that the trimmed referenz is non-empty — there is no max-length check. A referenz longer than 100 characters triggers a Postgres `22001` (string-too-long) error, which is swallowed by the generic catch and returned as a 500 "Datenbankfehler" rather than a clean 400 with a helpful message. `konfspruch_freitext` (TEXT) is unbounded, so an unbounded freetext can also be persisted.
**Fix:** Validate lengths before the UPDATE:
```js
if (referenz.length > 100) {
  return res.status(400).json({ error: 'Die Stellenangabe darf höchstens 100 Zeichen lang sein' });
}
if (freitext.length > 1000) { // pick a sane cap
  return res.status(400).json({ error: 'Der Spruchtext ist zu lang' });
}
```

### WR-02: GET /profile konfspruch lookup is not organization-scoped

**File:** `backend/routes/konfi.js:477-484`
**Issue:** The verse-resolution query in GET /profile selects `FROM konfsprueche ks WHERE ks.id = $1` with no `organization_id` predicate and no `is_active` check, unlike the PATCH route (lines 2152-2154) and the list route (lines 2096-2097) which both filter `(organization_id IS NULL OR organization_id = $org)` and `is_active = true`. Exposure is currently limited because `konfspruch_id` can only be set through the org-scoped PATCH, but if a spruch is later deactivated or its org changes, GET /profile would still surface it, diverging from the list/PATCH visibility rules. Defense-in-depth and consistency warrant the same filter.
**Fix:** Mirror the scope used elsewhere:
```sql
WHERE ks.id = $1 AND ks.is_active = true
  AND (ks.organization_id IS NULL OR ks.organization_id = $3)
```
passing `req.user.organization_id` as `$3`.

### WR-03: Konfispruch verse text lookup can pick the wrong row when `bible_translation` is NULL

**File:** `backend/routes/konfi.js:480-484`
**Issue:** The LEFT JOIN keys on `ku.translation = $2` where `$2` is `konfi.bible_translation`. If a konfi has a `konfspruch_id` set but `bible_translation` is NULL (possible if the row was created before any translation was ever chosen, or cleared elsewhere), `ku.translation = NULL` matches no rows and the spruch is returned with empty `text`, with no fallback to a default translation. The modal then shows "Text wird noch ergaenzt" even though a spruch is selected.
**Fix:** Fall back to a default translation when `bible_translation` is NULL, e.g. `COALESCE(konfi.bible_translation, 'luther2017')` as the join parameter, or `ORDER BY` a preferred translation when the exact one is missing.

### WR-04: Modal loads spruch list but swallows the error with only a console.error

**File:** `frontend/src/components/konfi/modals/KonfispruchSelectModal.tsx:97-109`
**Issue:** When `GET /konfi/konfsprueche` fails, the catch only logs to the console and leaves `sprueche` empty, so the user sees the "Es sind noch keine Sprueche hinterlegt" empty state (line 234) — which is indistinguishable from a genuine empty list and misleads the user into thinking no sprueche exist rather than that loading failed. No toast or retry is offered.
**Fix:** Surface a user-facing error (the modal already has `showError`/`presentToast`) and/or a distinct error state so a transient network failure is not presented as "no sprueche configured".

### WR-05: `selectedSpruchId` is not validated against the loaded list / may reference a stale spruch

**File:** `frontend/src/components/konfi/modals/KonfispruchSelectModal.tsx:87-89, 115-132`
**Issue:** `selectedSpruchId` is initialised from `current.id` before `sprueche` loads. If that previously-selected spruch is no longer in the returned list (deactivated, removed, or org changed), the UI shows no selected item but `handleSave` still submits the stale `selectedSpruchId`. The backend correctly rejects it with 404 (PATCH line 2157-2158), so there is no data corruption — but the user gets the generic "konnte nicht gespeichert werden" toast with no explanation. Minor robustness gap.
**Fix:** After load, clear `selectedSpruchId` if it is not present in `sprueche`, or map the 404 to a clearer message ("Der gewählte Spruch ist nicht mehr verfügbar").

## Info

### IN-01: German spelling — Umlaut shortcuts in user-facing UI strings (project rule violation)

**File:** `frontend/src/components/konfi/modals/KonfispruchSelectModal.tsx:118, 224, 255`, `frontend/src/components/konfi/views/DashboardView.tsx:414`
**Issue:** CLAUDE.md mandates echte Umlaute (ü/ö/ä/ß) in all UI texts and messages. The following user-visible strings use the `ae`/`ue` shortcut form:
- `KonfispruchSelectModal.tsx:118` — `'Bitte waehle einen Spruch ...'` → "wähle"
- `KonfispruchSelectModal.tsx:224` — `<IonLabel>Spruch waehlen</IonLabel>` → "wählen"
- `KonfispruchSelectModal.tsx:255` — `<em>Text wird noch ergaenzt</em>` → "ergänzt"
- `DashboardView.tsx:414` — `Tippe, um deinen Konfirmationsspruch zu waehlen` → "wählen"

(The many `waehl`/`Uebersetzung`/`loesch` occurrences inside code comments are acceptable, but these four are rendered to the user.)
**Fix:** Replace with real umlauts: "wähle", "Spruch wählen", "ergänzt", "wählen".

### IN-02: Comment claims `bible_translation` keys are intentional but conflicts with legacy endpoint

**File:** `backend/routes/konfi.js:2075-2078`
**Issue:** The comment states the new translation keys "koennen beide Stil-Welten koexistieren" because `bible_translation` is an unconstrained VARCHAR. This documents the design choice that leads directly to CR-02 — coexistence in the same column is precisely the problem, not a benign property. Once CR-02 is addressed, update this comment so it does not mislead future maintainers into reusing the column.
**Fix:** Revise the comment to reflect a dedicated column (or a unified vocabulary) after fixing CR-02.

### IN-03: `.app-dashboard-quote` declared in two CSS rule blocks

**File:** `frontend/src/theme/variables.css:30` and `:2350`
**Issue:** `.app-dashboard-quote` appears in two separate rule blocks (line 30 sets only `font-family`; line 2350 sets the full quote styling including `font-family` again). Not a bug — the cascade resolves consistently — but the duplicated `font-family` declaration is redundant and easy to desynchronise during future edits. The konfispruch card reuses this class (`DashboardView.tsx:402`), so the styling is correctly shared.
**Fix:** Optional: drop `.app-dashboard-quote` from the grouped selector at line 30 since line 2350 already sets the same `font-family`.

---

_Reviewed: 2026-06-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
